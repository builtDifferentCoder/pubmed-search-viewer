// NCBI E-utilities Pipeline (esearch, esummary, efetch) with Rate Limiting & Backoff
import { config } from './config.js';
import {
    extractPubYear,
    extractStudyType,
    extractSubjectType,
    extractSampleSize,
    determineSampleSizeBucket,
    extractConclusion,
    determineConclusionType
} from './parsers.js';

let lastNcbiRequestTime = 0;

export function buildNcbiUrl(endpoint, params = {}) {
    const url = new URL(endpoint, config.API_BASE);
    Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
            url.searchParams.set(key, val);
        }
    });
    // Add optional API key and email/tool params if present
    if (config.NCBI_API_KEY) {
        url.searchParams.set('api_key', config.NCBI_API_KEY);
    }
    if (config.NCBI_TOOL) {
        url.searchParams.set('tool', config.NCBI_TOOL);
    }
    if (config.NCBI_EMAIL) {
        url.searchParams.set('email', config.NCBI_EMAIL);
    }
    return url.toString();
}

export async function fetchWithRetry(url, options = {}, retries = 1) {
    let res = await fetch(url, options);
    if (res.status === 429 && retries > 0) {
        await new Promise(r => setTimeout(r, config.PRIMER_RETRY_DELAY_MS));
        res = await fetch(url, options);
    }
    return res;
}

export async function rateLimitedNcbiFetch(url, options = {}) {
    const gap = config.NCBI_API_KEY ? 110 : config.PRIMER_REQUEST_GAP_MS;
    const now = Date.now();
    const elapsed = now - lastNcbiRequestTime;
    if (elapsed < gap) {
        await new Promise(r => setTimeout(r, gap - elapsed));
    }
    lastNcbiRequestTime = Date.now();
    return fetchWithRetry(url, options);
}

export async function esearchPmids(query, retmax = config.MAX_RESULTS, useRateLimit = false) {
    let esearchUrl = `${config.API_BASE}esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&reldate=${config.DAYS_BACK}&datetype=pdat&retmax=${retmax}&retmode=json`;
    if (config.NCBI_API_KEY) esearchUrl += `&api_key=${encodeURIComponent(config.NCBI_API_KEY)}`;
    if (config.NCBI_TOOL) esearchUrl += `&tool=${encodeURIComponent(config.NCBI_TOOL)}`;
    if (config.NCBI_EMAIL) esearchUrl += `&email=${encodeURIComponent(config.NCBI_EMAIL)}`;

    const reqFetch = useRateLimit ? rateLimitedNcbiFetch : fetchWithRetry;
    const searchRes = await reqFetch(esearchUrl);
    if (!searchRes.ok) throw new Error(`Failed to connect to NCBI Esearch API (Status: ${searchRes.status}).`);
    const searchData = await searchRes.json();
    const pmids = searchData.esearchresult?.idlist || [];
    const totalCount = parseInt(searchData.esearchresult?.count || '0', 10);
    return { pmids, totalCount };
}

export async function hydrate(pmids, useRateLimit = false) {
    if (!pmids || pmids.length === 0) return [];

    const reqFetch = useRateLimit ? rateLimitedNcbiFetch : fetchWithRetry;
    const pmidString = pmids.join(',');
    const usePost = pmids.length > config.POST_ID_THRESHOLD || pmidString.length > 1500;

    // 1. Citation data via esummary
    let summaryRes;
    if (usePost) {
        const bodyParams = new URLSearchParams({
            db: 'pubmed',
            id: pmidString,
            retmode: 'json'
        });
        if (config.NCBI_API_KEY) bodyParams.set('api_key', config.NCBI_API_KEY);
        if (config.NCBI_TOOL) bodyParams.set('tool', config.NCBI_TOOL);
        if (config.NCBI_EMAIL) bodyParams.set('email', config.NCBI_EMAIL);

        summaryRes = await reqFetch(`${config.API_BASE}esummary.fcgi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: bodyParams.toString()
        });
    } else {
        const summaryUrl = buildNcbiUrl('esummary.fcgi', {
            db: 'pubmed',
            id: pmidString,
            retmode: 'json'
        });
        summaryRes = await reqFetch(summaryUrl);
    }

    const citationData = {};
    if (summaryRes.ok) {
        try {
            const summaryData = await summaryRes.json();
            (summaryData.result?.uids || []).forEach(uid => {
                citationData[uid] = parseInt(summaryData.result[uid]?.pmcrefcount || 0, 10) || 0;
            });
        } catch (e) {
            console.warn('Failed to parse esummary JSON:', e);
        }
    }

    // 2. Article details via efetch
    let fetchRes;
    if (usePost) {
        const bodyParams = new URLSearchParams({
            db: 'pubmed',
            id: pmidString,
            retmode: 'xml'
        });
        if (config.NCBI_API_KEY) bodyParams.set('api_key', config.NCBI_API_KEY);
        if (config.NCBI_TOOL) bodyParams.set('tool', config.NCBI_TOOL);
        if (config.NCBI_EMAIL) bodyParams.set('email', config.NCBI_EMAIL);

        fetchRes = await reqFetch(`${config.API_BASE}efetch.fcgi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: bodyParams.toString()
        });
    } else {
        const fetchUrl = buildNcbiUrl('efetch.fcgi', {
            db: 'pubmed',
            id: pmidString,
            retmode: 'xml'
        });
        fetchRes = await reqFetch(fetchUrl);
    }

    if (!fetchRes.ok) throw new Error(`Failed to fetch article details from NCBI Efetch API (Status: ${fetchRes.status}).`);
    const xmlDoc = new DOMParser().parseFromString(await fetchRes.text(), 'text/xml');

    const articles = [];
    xmlDoc.querySelectorAll('PubmedArticle').forEach(article => {
        const pmid = article.querySelector('PMID')?.textContent || '';
        const articleEl = article.querySelector('Article');

        const title = articleEl?.querySelector('ArticleTitle')?.textContent?.trim() || 'Untitled Article';

        const pubDateNode = articleEl?.querySelector('Journal PubDate');
        const pubYear = extractPubYear(pubDateNode, articleEl);
        const month = pubDateNode?.querySelector('Month')?.textContent || '';
        const dateStr = pubYear ? `${pubYear} ${month}`.trim() : 'Date Unknown';

        const keywords = Array.from(article.querySelectorAll('KeywordList Keyword'))
            .map(k => k.textContent.trim()).filter(Boolean);
        const keywordsNorm = [...new Set(keywords.map(k => k.toLowerCase()))];

        const { conclusion, conclusionLabel, hasConclusion, hasAbstract } = extractConclusion(articleEl);

        const abstractAll = Array.from(articleEl?.querySelectorAll('Abstract AbstractText') || [])
            .map(n => n.textContent).join(' ');
        const fullText = `${title} ${abstractAll}`;

        const studyType = extractStudyType(article);
        const subjectType = extractSubjectType(article, keywordsNorm, fullText);
        const sampleSize = extractSampleSize(fullText);
        const sampleSizeBucket = determineSampleSizeBucket(sampleSize, fullText);
        const conclusionType = determineConclusionType(conclusion, hasConclusion);

        articles.push({
            pmid,
            title,
            pubYear,
            dateStr,
            keywords,
            keywordsNorm,
            conclusion,
            conclusionLabel,
            hasConclusion,
            hasAbstract,
            studyType,
            subjectType,
            sampleSize,
            sampleSizeBucket,
            conclusionType,
            citations: citationData[pmid] ?? 0
        });
    });
    return articles;
}

export async function fetchArticles(query, onProgress) {
    if (onProgress) onProgress('Searching PubMed for matching articles...');
    const { pmids, totalCount } = await esearchPmids(query, config.MAX_RESULTS);
    if (pmids.length === 0) return { articles: [], totalCount };

    if (onProgress) onProgress('Fetching citation and article data...');
    const articles = await hydrate(pmids);
    return { articles, totalCount };
}

if (typeof window !== 'undefined') {
    window.esearchPmids = esearchPmids;
    window.hydrate = hydrate;
    window.fetchArticles = fetchArticles;
}

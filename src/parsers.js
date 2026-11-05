// Biomedical XML & Text Parsers and Extraction Heuristics
import { config, SAMPLE_SIZE_THRESHOLDS } from './config.js';

export function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

export function extractPubYear(pubDateNode, articleEl) {
    let yearStr = pubDateNode?.querySelector('Year')?.textContent?.trim() || '';
    if (!yearStr) {
        const medlineDate = pubDateNode?.querySelector('MedlineDate')?.textContent || '';
        const m = medlineDate.match(/\b(19\d\d|20\d\d)\b/);
        if (m) yearStr = m[1];
    }
    if (!yearStr) {
        const articleDateYear = articleEl?.querySelector('ArticleDate Year')?.textContent?.trim() || '';
        if (articleDateYear) yearStr = articleDateYear;
    }
    const y = parseInt(yearStr, 10);
    return (!isNaN(y) && y > 1800 && y < 2100) ? y : 0;
}

export function extractStudyType(articleEl) {
    const pubTypes = Array.from(articleEl.querySelectorAll('PublicationTypeList PublicationType'))
        .map(p => p.textContent.trim().toLowerCase());

    if (pubTypes.some(t => t.includes('randomized controlled trial'))) return 'Randomized Controlled Trial';
    if (pubTypes.some(t => t.includes('clinical trial'))) return 'Clinical Trial';
    if (pubTypes.some(t => t.includes('meta-analysis') || t.includes('meta analysis'))) return 'Meta-Analysis';
    if (pubTypes.some(t => t.includes('systematic review'))) return 'Systematic Review';
    if (pubTypes.some(t => t.includes('review'))) return 'Review';
    if (pubTypes.some(t => t.includes('case reports') || t.includes('case report'))) return 'Case Reports';
    if (pubTypes.some(t => t.includes('observational study'))) return 'Observational Study';
    return 'Other';
}

export function extractSubjectType(articleEl, keywordsNorm, fullText) {
    const meshHeadings = Array.from(articleEl.querySelectorAll('MeshHeadingList MeshHeading DescriptorName'))
        .map(m => m.textContent.trim().toLowerCase());

    // 1. Human Check
    if (meshHeadings.some(m => m.includes('human'))) return 'Human';
    if (keywordsNorm.some(k => k === 'human' || k === 'humans' || k.includes('patient') || k.includes('participant'))) return 'Human';

    // 2. Animal Check
    if (meshHeadings.some(m => m.includes('animal'))) return 'Animal';
    if (/\b(mice|mouse|rats?|murine|rodents?|bovine|porcine|swine|rabbit|canine|animal model|in vivo)\b/i.test(fullText)) {
        return 'Animal';
    }

    // 3. In vitro Check
    if (/\b(in vitro|cell line|cell lines|cultured cells?|cell culture)\b/i.test(fullText) ||
        keywordsNorm.some(k => k.includes('in vitro') || k.includes('cell line') || k.includes('cultured cell'))) {
        return 'In vitro';
    }

    return 'Other/Unknown';
}

export function extractSampleSize(text) {
    if (!text) return null;
    const matches = [];

    // Pattern 1: n = 120, N=120, N = 1,200
    const reN = /\b[nN]\s*=\s*([0-9]{1,3}(?:,[0-9]{3})*|\d+)\b/g;
    let m;
    while ((m = reN.exec(text)) !== null) {
        const val = parseInt(m[1].replace(/,/g, ''), 10);
        if (val > 0 && val < 10000000) matches.push(val);
    }

    // Pattern 2: 120 participants/patients/subjects/adults/men/women/volunteers/cases
    const reParticipants = /\b([0-9]{1,3}(?:,[0-9]{3})*|\d+)\s+(?:participants|patients|subjects|adults|men|women|volunteers|individuals|cases|children|adolescents|infants|respondents)\b/gi;
    while ((m = reParticipants.exec(text)) !== null) {
        const val = parseInt(m[1].replace(/,/g, ''), 10);
        if (val > 0 && val < 10000000) matches.push(val);
    }

    // Pattern 3: sample size of 120, cohort of 120, total of 120
    const reCohort = /\b(?:sample size of|cohort of|total of)\s+([0-9]{1,3}(?:,[0-9]{3})*|\d+)\b/gi;
    while ((m = reCohort.exec(text)) !== null) {
        const val = parseInt(m[1].replace(/,/g, ''), 10);
        if (val > 0 && val < 10000000) matches.push(val);
    }

    if (matches.length === 0) return null;
    return Math.max(...matches);
}

export function determineSampleSizeBucket(sampleSize, text) {
    if (sampleSize === null || sampleSize === undefined || isNaN(sampleSize) || sampleSize <= 0) {
        return 'Unknown';
    }
    const thresholds = config.SAMPLE_SIZE_THRESHOLDS || SAMPLE_SIZE_THRESHOLDS;
    if (sampleSize <= thresholds.PILOT_MAX) {
        return 'Pilot';
    }
    if (sampleSize <= thresholds.SMALL_MAX) {
        return 'Small';
    }
    if (sampleSize <= thresholds.MEDIUM_MAX) {
        return 'Medium';
    }
    // N >= 500
    const isLongitudinal = /\b(longitudinal|follow-up|prospective cohort|years of follow-up)\b/i.test(text || '');
    return isLongitudinal ? 'Large + Longitudinal' : 'Large';
}

export function extractConclusion(articleEl) {
    let conclusion = '';
    let conclusionLabel = '';
    let hasConclusion = 0;
    const abstractTexts = articleEl?.querySelectorAll('Abstract AbstractText');

    if (abstractTexts && abstractTexts.length > 0) {
        for (const node of abstractTexts) {
            const label = node.getAttribute('Label');
            if (label && (label.toUpperCase().includes('CONCLUSION') || label.toUpperCase() === 'DISCUSSION')) {
                conclusion = node.textContent?.trim() || '';
                conclusionLabel = label;
                hasConclusion = 1;
                break;
            }
        }
        if (!hasConclusion) {
            // Fallback to last section
            conclusion = abstractTexts[abstractTexts.length - 1].textContent?.trim() || '';
        }
    }
    return {
        conclusion,
        conclusionLabel,
        hasConclusion,
        hasAbstract: abstractTexts && abstractTexts.length > 0 ? 1 : 0
    };
}

export function determineConclusionType(conclusionText, hasConclusion) {
    if (!hasConclusion || !conclusionText || !conclusionText.trim()) {
        return 'None';
    }
    const text = conclusionText.toLowerCase();

    // Null-Inconclusive patterns check
    const nullPatterns = [
        /\bno significant(?:ly)?\b/,
        /\bnot statistically significant\b/,
        /\bno difference\b/,
        /\bdid not differ\b/,
        /\bdoes not differ\b/,
        /\binconclusive\b/,
        /\bremains unclear\b/,
        /\bfurther (?:research|studies|investigation) (?:is|are) needed\b/,
        /\bwarrants? further (?:research|investigation|evaluation)\b/,
        /\binsufficient evidence\b/,
        /\bneither beneficial nor\b/,
        /\bcomparable to placebo\b/,
        /\bsimilar to control\b/
    ];
    for (const pat of nullPatterns) {
        if (pat.test(text)) return 'Null-Inconclusive';
    }

    // Negative patterns check
    const negPatterns = [
        /\bineffective\b/,
        /\bfailed to\b/,
        /\bfails to\b/,
        /\bno benefit\b/,
        /\bharmful\b/,
        /\badverse effects?\b/,
        /\bworsened\b/,
        /\bdetrimental\b/,
        /\binferior\b/,
        /\bnot recommended\b/,
        /\bnegative correlation\b/,
        /\bdid not improve\b/,
        /\bnot improve\b/
    ];
    for (const pat of negPatterns) {
        if (pat.test(text)) return 'Negative';
    }

    // Positive patterns check
    const posPatterns = [
        /\beffective\b/,
        /\befficacy\b/,
        /\bsignificant(?:ly)? improved\b/,
        /\bsignificant(?:ly)? reduced\b/,
        /\bsignificant(?:ly)? increased\b/,
        /\bsignificant(?:ly)? enhanced\b/,
        /\bsignificant benefit\b/,
        /\bbeneficial\b/,
        /\bpromising\b/,
        /\bfavorable\b/,
        /\bsuperior\b/,
        /\bimproves?\b/,
        /\bimproved\b/,
        /\benhances?\b/,
        /\benhanced\b/,
        /\bpotential therapeutic\b/,
        /\bsuccessfully\b/,
        /\bpositive effect\b/,
        /\bpositive correlation\b/,
        /\bsafe and well tolerated\b/
    ];
    for (const pat of posPatterns) {
        if (pat.test(text)) return 'Positive';
    }

    // Default polarity for conclusion section without strong sentiment
    return 'Null-Inconclusive';
}

if (typeof window !== 'undefined') {
    window.esc = esc;
    window.extractPubYear = extractPubYear;
    window.extractStudyType = extractStudyType;
    window.extractSubjectType = extractSubjectType;
    window.extractSampleSize = extractSampleSize;
    window.determineSampleSizeBucket = determineSampleSizeBucket;
    window.extractConclusion = extractConclusion;
    window.determineConclusionType = determineConclusionType;
}

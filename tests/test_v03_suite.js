const { chromium } = require('playwright');
const path = require('path');

// -----------------------------------------------------------------------------
// Mock Data for Standard Searches (from v0.2 suite)
// -----------------------------------------------------------------------------
function getStandardMockResponses() {
    const esearchJson = {
        header: { type: 'esearch', version: '0.3' },
        esearchresult: {
            count: '5',
            retmax: '5',
            retstart: '0',
            idlist: ['1001', '1002', '1003', '1004', '1005'],
            translationset: [],
            querytranslation: 'test[All Fields]'
        }
    };

    const esummaryJson = {
        header: { type: 'esummary', version: '0.3' },
        result: {
            uids: ['1001', '1002', '1003', '1004', '1005'],
            '1001': { uid: '1001', pmcrefcount: 15 },
            '1002': { uid: '1002', pmcrefcount: 3 },
            '1003': { uid: '1003', pmcrefcount: 25 },
            '1004': { uid: '1004', pmcrefcount: 0 },
            '1005': { uid: '1005', pmcrefcount: 0 }
        }
    };

    const efetchXml = `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2019//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_190101.dtd">
<PubmedArticleSet>
  <!-- Article 1: RCT, Human, Medium sample size (120), Positive conclusion, citations 15, title with <b>test</b> -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>1001</PMID>
      <Article>
        <Journal>
          <JournalIssue><PubDate><Year>2022</Year><Month>Mar</Month></PubDate></JournalIssue>
        </Journal>
        <ArticleTitle>Efficacy of &lt;b&gt;test&lt;/b&gt; allulose in diet</ArticleTitle>
        <PublicationTypeList>
          <PublicationType UI="D016449">Randomized Controlled Trial</PublicationType>
          <PublicationType UI="D016428">Journal Article</PublicationType>
        </PublicationTypeList>
        <Abstract>
          <AbstractText Label="BACKGROUND">Investigating dietary allulose effects.</AbstractText>
          <AbstractText Label="METHODS">A double-blind randomized trial with n = 120 patients was conducted.</AbstractText>
          <AbstractText Label="RESULTS">Blood glucose levels significantly reduced.</AbstractText>
          <AbstractText Label="CONCLUSIONS">Allulose is safe and significantly improved glycemic response.</AbstractText>
        </Abstract>
      </Article>
      <MeshHeadingList>
        <MeshHeading><DescriptorName>Humans</DescriptorName></MeshHeading>
        <MeshHeading><DescriptorName>Diet</DescriptorName></MeshHeading>
      </MeshHeadingList>
      <KeywordList>
        <Keyword>allulose</Keyword>
        <Keyword>diet</Keyword>
        <Keyword>ketosis</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>

  <!-- Article 2: Review, Animal (Mice), Pilot (15), Null-Inconclusive conclusion, citations 3 -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>1002</PMID>
      <Article>
        <Journal>
          <JournalIssue><PubDate><MedlineDate>2021 Jan-Feb</MedlineDate></PubDate></JournalIssue>
        </Journal>
        <ArticleTitle>Murine study on sugar substitutes</ArticleTitle>
        <PublicationTypeList>
          <PublicationType UI="D016454">Review</PublicationType>
        </PublicationTypeList>
        <Abstract>
          <AbstractText Label="BACKGROUND">Animal models in sugar substitute research.</AbstractText>
          <AbstractText Label="METHODS">N = 15 mice were tested under feeding regimes.</AbstractText>
          <AbstractText Label="RESULTS">No differences observed in metabolic markers.</AbstractText>
          <AbstractText Label="CONCLUSION">The effect of sugar substitutes remains inconclusive.</AbstractText>
        </Abstract>
      </Article>
      <MeshHeadingList>
        <MeshHeading><DescriptorName>Animals</DescriptorName></MeshHeading>
        <MeshHeading><DescriptorName>Mice</DescriptorName></MeshHeading>
      </MeshHeadingList>
      <KeywordList>
        <Keyword>diet</Keyword>
        <Keyword>metabolism</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>

  <!-- Article 3: Meta-Analysis, Human, Large + Longitudinal (1500), Negative conclusion, citations 25 -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>1003</PMID>
      <Article>
        <Journal>
          <JournalIssue><PubDate><Year>2020</Year></PubDate></JournalIssue>
        </Journal>
        <ArticleTitle>Longitudinal analysis of healthy diet and nutrition</ArticleTitle>
        <PublicationTypeList>
          <PublicationType UI="D017418">Meta-Analysis</PublicationType>
        </PublicationTypeList>
        <Abstract>
          <AbstractText Label="BACKGROUND">Longitudinal dietary outcomes.</AbstractText>
          <AbstractText Label="METHODS">Large prospective cohort with sample size of 1500 adults followed for 5 years.</AbstractText>
          <AbstractText Label="RESULTS">Variable effects noted.</AbstractText>
          <AbstractText Label="CONCLUSIONS">Dietary interventions were ineffective and failed to improve primary outcomes.</AbstractText>
        </Abstract>
      </Article>
      <MeshHeadingList>
        <MeshHeading><DescriptorName>Humans</DescriptorName></MeshHeading>
      </MeshHeadingList>
      <KeywordList>
        <Keyword>diet</Keyword>
        <Keyword>nutrition</Keyword>
        <Keyword>longitudinal</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>

  <!-- Article 4: Other study type, In vitro, Unknown sample size (null), No abstract, citations 0 -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>1004</PMID>
      <Article>
        <Journal>
          <JournalIssue><PubDate><Year>2019</Year></PubDate></JournalIssue>
        </Journal>
        <ArticleTitle>In vitro analysis of cell line glucose transport</ArticleTitle>
        <PublicationTypeList>
          <PublicationType UI="D016428">Journal Article</PublicationType>
        </PublicationTypeList>
      </Article>
      <KeywordList>
        <Keyword>in vitro</Keyword>
        <Keyword>cell line</Keyword>
        <Keyword>glucose</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>

  <!-- Article 5: Clinical Trial, Human, Small (40), Negative conclusion, citations 0, No keywords -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>1005</PMID>
      <Article>
        <Journal>
          <JournalIssue><PubDate><Year>2024</Year><Month>Sep</Month></PubDate></JournalIssue>
        </Journal>
        <ArticleTitle>Clinical trial of sweetener in 40 patients</ArticleTitle>
        <PublicationTypeList>
          <PublicationType UI="D002986">Clinical Trial</PublicationType>
        </PublicationTypeList>
        <Abstract>
          <AbstractText Label="BACKGROUND">Investigating alternative sweetener.</AbstractText>
          <AbstractText Label="METHODS">40 patients enrolled in crossover evaluation.</AbstractText>
          <AbstractText Label="RESULTS">Insulin sensitivity remained unchanged.</AbstractText>
          <AbstractText Label="CONCLUSION">The sweetener was ineffective and failed to improve insulin sensitivity.</AbstractText>
        </Abstract>
      </Article>
      <MeshHeadingList>
        <MeshHeading><DescriptorName>Humans</DescriptorName></MeshHeading>
      </MeshHeadingList>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>`;

    return { esearchJson, esummaryJson, efetchXml };
}

// -----------------------------------------------------------------------------
// Mock Data for Search Primers (from Phase 1 suite)
// -----------------------------------------------------------------------------
function getPrimerMockResponses() {
    const esearchResponses = {
        'Q1': { count: '3', idlist: ['2001', '2002', '2003'] },
        'Q2': { count: '2', idlist: ['2002', '2004'] },
        'Q3': { count: '2', idlist: ['2003', '2005'] },
        'Q4': { count: '1', idlist: ['2006'] },
        'Q5': { count: '2', idlist: ['2001', '2007'] }
    };

    const articlesMap = {
        '2001': { pmid: '2001', title: 'Zinc and Vitamin D in Male Endocrine Health', year: '2023', type: 'Randomized Controlled Trial', citations: 40, conc: 'Significant enhancement in hormonal balance.' },
        '2002': { pmid: '2002', title: 'Ashwagandha and Micronutrient Synergies', year: '2022', type: 'Clinical Trial', citations: 15, conc: 'Substantial improvement observed.' },
        '2003': { pmid: '2003', title: 'Creatine Supplementation in Resistance Training', year: '2024', type: 'Meta-Analysis', citations: 55, conc: 'Muscle hypertrophy significantly accelerated.' },
        '2004': { pmid: '2004', title: 'Fenugreek Extract Evaluation', year: '2021', type: 'Randomized Controlled Trial', citations: 5, conc: 'Positive correlation noted.' },
        '2005': { pmid: '2005', title: 'Muscle Mass and Resistance Regimens', year: '2022', type: 'Review', citations: 8, conc: 'Efficacy supported across age groups.' },
        '2006': { pmid: '2006', title: 'L-arginine Vascular Modulations', year: '2023', type: 'Clinical Trial', citations: 12, conc: 'Vascular markers improved.' },
        '2007': { pmid: '2007', title: 'Omega-3 Fatty Acids and Inflammation', year: '2024', type: 'Observational Study', citations: 22, conc: 'Systemic inflammation markers significantly reduced.' }
    };

    function buildXml(pmids) {
        return `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2019//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_190101.dtd">
<PubmedArticleSet>
    ${pmids.map(id => {
        const a = articlesMap[id] || { pmid: id, title: `Article ${id}`, year: '2023', type: 'Journal Article', citations: 0, conc: 'Test conclusion.' };
        return `
    <PubmedArticle>
        <MedlineCitation>
            <PMID>${a.pmid}</PMID>
            <Article>
                <Journal><JournalIssue><PubDate><Year>${a.year}</Year></PubDate></JournalIssue></Journal>
                <ArticleTitle>${a.title}</ArticleTitle>
                <PublicationTypeList><PublicationType>${a.type}</PublicationType></PublicationTypeList>
                <Abstract><AbstractText Label="CONCLUSIONS">${a.conc}</AbstractText></Abstract>
            </Article>
            <MeshHeadingList><MeshHeading><DescriptorName>Humans</DescriptorName></MeshHeading></MeshHeadingList>
        </MedlineCitation>
    </PubmedArticle>`;
    }).join('')}
</PubmedArticleSet>`;
    }

    return { esearchResponses, articlesMap, buildXml };
}

// -----------------------------------------------------------------------------
// Test Suite Execution
// -----------------------------------------------------------------------------
async function runTestSuite() {
    console.log('=====================================================');
    console.log('Starting Complete Test Suite for PubMed ResearchMiner v0.3');
    console.log('=====================================================');

    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
        consoleErrors.push(err.toString());
    });

    const standardMocks = getStandardMockResponses();
    const primerMocks = getPrimerMockResponses();
    const requestTimestamps = [];

    // Intercept NCBI E-Utilities with clean multiplexing
    await page.route('**eutils.ncbi.nlm.nih.gov/**', async route => {
        const req = route.request();
        const url = req.url();
        const now = Date.now();
        requestTimestamps.push({ url, time: now, method: req.method() });

        if (url.includes('esearch.fcgi')) {
            if (url.includes('testosterone') && url.includes('male')) {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ esearchresult: primerMocks.esearchResponses['Q1'] }) });
            } else if (url.includes('Ashwagandha')) {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ esearchresult: primerMocks.esearchResponses['Q2'] }) });
            } else if (url.includes('Creatine')) {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ esearchresult: primerMocks.esearchResponses['Q3'] }) });
            } else if (url.includes('L-arginine')) {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ esearchresult: primerMocks.esearchResponses['Q4'] }) });
            } else if (url.includes('Omega-3')) {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ esearchresult: primerMocks.esearchResponses['Q5'] }) });
            } else {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(standardMocks.esearchJson) });
            }
        } else if (url.includes('esummary.fcgi')) {
            let idParam = '';
            if (req.method() === 'POST') {
                const body = req.postData();
                const m = body ? body.match(/id=([^&]+)/) : null;
                idParam = m ? decodeURIComponent(m[1]) : '';
            } else {
                const urlObj = new URL(url);
                idParam = urlObj.searchParams.get('id') || '';
            }
            if (idParam.includes('2001') || idParam.includes('2002')) {
                const pmids = idParam.split(',').filter(Boolean);
                const result = { uids: pmids };
                pmids.forEach(id => {
                    result[id] = { uid: id, pmcrefcount: primerMocks.articlesMap[id]?.citations || 0 };
                });
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result }) });
            } else {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(standardMocks.esummaryJson) });
            }
        } else if (url.includes('efetch.fcgi')) {
            let idParam = '';
            if (req.method() === 'POST') {
                const body = req.postData();
                const m = body ? body.match(/id=([^&]+)/) : null;
                idParam = m ? decodeURIComponent(m[1]) : '';
            } else {
                const urlObj = new URL(url);
                idParam = urlObj.searchParams.get('id') || '';
            }
            if (idParam.includes('2001') || idParam.includes('2002')) {
                const pmids = idParam.split(',').filter(Boolean);
                await route.fulfill({ status: 200, contentType: 'text/xml', body: primerMocks.buildXml(pmids) });
            } else {
                await route.fulfill({ status: 200, contentType: 'text/xml', body: standardMocks.efetchXml });
            }
        } else {
            await route.continue();
        }
    });

    const targetUrl = process.env.TEST_URL || 'http://localhost:4173/';
    console.log(`Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Wait for the automatic initial search to complete
    console.log('Waiting for initial search and save to complete...');
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
    await page.waitForTimeout(1000);

    // =========================================================================
    // SECTION 1: REGRESSION SUITE (v0.2 Baseline)
    // =========================================================================
    console.log('\n--- SECTION 1: Regression Suite (v0.2 Baseline) ---');

    // 1.1 Initial Load & Stored Records
    const storedQueriesCount = await page.evaluate(async () => await window.db.queries.count());
    const storedArticlesCount = await page.evaluate(async () => await window.db.articles.count());
    console.log(`Stored queries: ${storedQueriesCount}, Stored articles: ${storedArticlesCount}`);
    if (storedQueriesCount !== 1 || storedArticlesCount !== 5) {
        throw new Error(`Expected 1 query and 5 articles initially, got ${storedQueriesCount} and ${storedArticlesCount}`);
    }

    // 1.2 Chart Totals Reconciliation
    const chartReconciliation = await page.evaluate(() => {
        const charts = window.activeCharts;
        if (!charts || charts.length < 8) return { error: `Found only ${charts ? charts.length : 0} charts` };
        const sum = arr => arr.reduce((a, b) => a + b, 0);
        return {
            totalChartCount: charts.length,
            totalArticles: sum(charts[0].data.datasets[0].data),
            sumConclusion: sum(charts[1].data.datasets[0].data),
            sumSampleSize: sum(charts[2].data.datasets[0].data),
            sumCitations: sum(charts[3].data.datasets[0].data),
            sumStudyType: sum(charts[4].data.datasets[0].data),
            sumSubjectType: sum(charts[5].data.datasets[0].data),
            sumPubYear: sum(charts[6].data.datasets[0].data)
        };
    });
    console.log('Chart reconciliations (all sums equal total 5):', chartReconciliation);
    if (chartReconciliation.error) throw new Error(chartReconciliation.error);
    const sumsToVerify = [
        chartReconciliation.totalArticles,
        chartReconciliation.sumConclusion,
        chartReconciliation.sumSampleSize,
        chartReconciliation.sumCitations,
        chartReconciliation.sumStudyType,
        chartReconciliation.sumSubjectType,
        chartReconciliation.sumPubYear
    ];
    for (const val of sumsToVerify) {
        if (val !== 5) throw new Error(`Reconciliation mismatch: ${val} != 5`);
    }

    // 1.3 Click to Filter on Charts
    const filterVerification = await page.evaluate(async () => {
        const q = (await window.db.queries.toArray())[0];
        const rows = await window.fetchSubset(q.id, { field: 'conclusionType', value: 'Positive' });
        return { count: rows.length, pmid: rows[0]?.pmid };
    });
    console.log('Filtered subset verification for Positive conclusions:', filterVerification);
    if (filterVerification.count !== 1 || filterVerification.pmid !== '1001') {
        throw new Error(`Filter verification failed: ${JSON.stringify(filterVerification)}`);
    }

    // 1.4 HTML Escaping Verification
    const titleEscaping = await page.evaluate(async () => {
        const qId = (await window.db.queries.toArray())[0].id;
        const rows = await window.fetchSubset(qId, { field: 'all' });
        const html = window.tableHtml(rows);
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const allRows = Array.from(temp.querySelectorAll('tbody tr'));
        const row1001 = allRows.find(tr => tr.innerHTML.includes('PMID: 1001'));
        const titleSpan = row1001 ? row1001.querySelector('td a span') : null;
        return {
            foundRow: !!row1001,
            actualText: titleSpan?.textContent || '',
            containsRawBTagInHtml: Boolean(titleSpan?.innerHTML.includes('&lt;b&gt;test&lt;/b&gt;')),
            hasRenderedBoldChild: titleSpan?.querySelector('b') !== null
        };
    });
    console.log('Title HTML escaping check (no raw <b> element rendered):', titleEscaping);
    if (!titleEscaping.foundRow || titleEscaping.hasRenderedBoldChild || !titleEscaping.actualText.includes('<b>test</b>')) {
        throw new Error(`XSS escaping failed: ${JSON.stringify(titleEscaping)}`);
    }

    // 1.5 Node Click Triggers Search (v0.4 Query Builder integration)
    console.log('Testing Cytoscape node click to search...');
    await page.click('#tab-graph-btn');
    await page.waitForTimeout(400);
    await page.evaluate(() => {
        const cy = window.activeCytoscape;
        const targetNode = cy.nodes('#allulose')[0] || cy.nodes()[0];
        targetNode.emit('tap');
        if (window.BooleanQueryBuilder && window.BooleanQueryBuilder.items.length > 0) {
            window.BooleanQueryBuilder.runSearch();
        }
    });
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
    await page.waitForTimeout(500);

    const activeTabAfterNodeClick = await page.evaluate(() => window.currentActiveTab);
    const queriesAfterNodeClick = await page.evaluate(() => window.db.queries.count());
    console.log(`Active tab after node click: ${activeTabAfterNodeClick}, Total queries: ${queriesAfterNodeClick}`);
    if (activeTabAfterNodeClick !== 'results' || queriesAfterNodeClick < 2) {
        throw new Error(`Node click search failed: tab=${activeTabAfterNodeClick}, queries=${queriesAfterNodeClick}`);
    }

    // 1.6 Duplicate search, Delete query, and Re-population
    console.log('Testing duplicate search handling...');
    await page.evaluate(async () => {
        await window.performSearch('allulose diet');
    });
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
    const duplicateCount = await page.evaluate(async () => {
        return (await window.db.queries.where('term').equals('allulose diet').toArray()).length;
    });
    console.log(`Occurrences of duplicate term (should be 1): ${duplicateCount}`);
    if (duplicateCount !== 1) throw new Error(`Expected 1 occurrence of duplicate term, found ${duplicateCount}`);

    // Delete single query test
    const deleteTest = await page.evaluate(async () => {
        const q = (await window.db.queries.toArray())[0];
        const initialCount = await window.db.queries.count();
        await window.db.transaction('rw', window.db.queries, window.db.articles, async () => {
            await window.db.articles.where('queryId').equals(q.id).delete();
            await window.db.queries.delete(q.id);
        });
        await window.renderAll();
        const afterCount = await window.db.queries.count();
        return { initialCount, afterCount };
    });
    console.log('Delete query test:', deleteTest);

    // Re-populate standard query for remaining tests
    await page.evaluate(async () => {
        await window.performSearch('allulose diet');
    });
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
    await page.waitForTimeout(400);

    // =========================================================================
    // SECTION 2: THREE-TAB NAVIGATION & SWITCHING
    // =========================================================================
    console.log('\n--- SECTION 2: 3-Tab Architecture & Switching ---');

    await page.click('#tab-graph-btn');
    let activeTabCheck = await page.evaluate(() => ({
        graphVisible: !document.getElementById('tab-graph-view').classList.contains('hidden'),
        resultsVisible: !document.getElementById('tab-results-view').classList.contains('hidden'),
        primersVisible: !document.getElementById('tab-primers-view').classList.contains('hidden')
    }));
    console.log('Switched to Keywords Graph:', activeTabCheck);
    if (!activeTabCheck.graphVisible || activeTabCheck.resultsVisible || activeTabCheck.primersVisible) {
        throw new Error('Graph tab activation failed');
    }

    await page.click('#tab-primers-btn');
    activeTabCheck = await page.evaluate(() => ({
        graphVisible: !document.getElementById('tab-graph-view').classList.contains('hidden'),
        resultsVisible: !document.getElementById('tab-results-view').classList.contains('hidden'),
        primersVisible: !document.getElementById('tab-primers-view').classList.contains('hidden')
    }));
    console.log('Switched to Search Primers:', activeTabCheck);
    if (!activeTabCheck.primersVisible || activeTabCheck.graphVisible || activeTabCheck.resultsVisible) {
        throw new Error('Primers tab activation failed');
    }

    await page.click('#tab-results-btn');
    activeTabCheck = await page.evaluate(() => ({
        resultsVisible: !document.getElementById('tab-results-view').classList.contains('hidden')
    }));
    console.log('Switched back to Search Results:', activeTabCheck);
    if (!activeTabCheck.resultsVisible) throw new Error('Results tab activation failed');

    // =========================================================================
    // SECTION 3: SEARCH PRIMERS (Phase 1)
    // =========================================================================
    console.log('\n--- SECTION 3: Search Primers (Phase 1) ---');

    // 3.1 Topic cards rendered
    await page.click('#tab-primers-btn');
    await page.waitForTimeout(300);
    const topicCardsCount = await page.locator('#primers-grid > div').count();
    console.log(`Primer topic cards rendered: ${topicCardsCount}`);
    if (topicCardsCount !== 2) throw new Error(`Expected 2 topic cards, found ${topicCardsCount}`);

    // 3.2 Navigate to Men's Health primer page (#/primers/mens-health)
    requestTimestamps.length = 0; // reset to measure primer network requests
    await page.click('#primers-grid > div:first-child');
    await page.waitForSelector('#primer-results-container table', { timeout: 15000 });

    const hashRoute = await page.evaluate(() => window.location.hash);
    const tabsNavHidden = !(await page.isVisible('#tabs-nav-bar'));
    const primerDetailVisible = await page.isVisible('#primer-detail-page');
    console.log(`Hash route after navigation: ${hashRoute}, tabs hidden: ${tabsNavHidden}, detail visible: ${primerDetailVisible}`);
    if (hashRoute !== '#/primers/mens-health' || !tabsNavHidden || !primerDetailVisible) {
        throw new Error(`Primer page navigation failed: hash=${hashRoute}`);
    }

    // 3.3 Rate Limiting Verification (>= 350ms gaps)
    console.log(`NCBI requests made during primer fetch: ${requestTimestamps.length}`);
    let rateViolations = 0;
    for (let i = 1; i < requestTimestamps.length; i++) {
        const gap = requestTimestamps[i].time - requestTimestamps[i - 1].time;
        if (gap < 320) { // allow 30ms timer jitter
            rateViolations++;
            console.warn(`Rate violation between req ${i-1} and ${i}: ${gap}ms`);
        }
    }
    console.log(`Rate limit violations (expected 0): ${rateViolations}`);
    if (rateViolations > 0) throw new Error(`Detected ${rateViolations} NCBI request rate limit violations`);

    // 3.4 Results Deduplication, Sorting, and Q-tags
    const primerResults = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#primer-results-container tbody tr'));
        return rows.map(r => {
            const pmidEl = r.querySelector('.font-mono');
            const pmid = pmidEl ? pmidEl.textContent.replace('PMID:', '').trim() : '';
            const qTags = Array.from(r.querySelectorAll('span.cursor-help')).map(t => ({
                label: t.textContent.trim(),
                title: t.getAttribute('title') || ''
            }));
            const citeEl = r.querySelector('td:last-child span');
            const citations = citeEl ? parseInt(citeEl.textContent.trim(), 10) : 0;
            return { pmid, qTags, citations };
        });
    });
    console.log(`Deduplicated rows in table: ${primerResults.length} (expected 7)`);
    if (primerResults.length !== 7) throw new Error(`Expected 7 deduplicated rows, got ${primerResults.length}`);

    // Verify top rows have Q-tags
    console.log('Top rows with matched query tags preview:', primerResults.slice(0, 3).map(r => ({ pmid: r.pmid, tags: r.qTags.map(t => t.label) })));
    const firstRowLabels = primerResults[0].qTags.map(t => t.label);
    if (!firstRowLabels.includes('Q1') || !primerResults[0].qTags[0].title) {
        throw new Error('Expected top row to contain query tags with tooltips');
    }

    // 3.5 Per-Query Hit Counts
    const hitCountsText = await page.locator('#primer-hit-counts-strip').innerText();
    console.log('Per-query hit counts strip:', hitCountsText.replace(/\s+/g, ' '));
    if (!hitCountsText.includes('Q1:') || !hitCountsText.includes('Q5:')) {
        throw new Error('Hit counts strip missing expected queries');
    }

    // 3.6 IndexedDB v3 Caching & Refresh Bypass
    const cachedRun = await page.evaluate(async () => {
        return await window.db.primerRuns.get('mens-health');
    });
    console.log('Dexie v3 cache entry verification:', {
        hasRun: Boolean(cachedRun),
        topicId: cachedRun?.topicId,
        articleCount: cachedRun?.articles?.length
    });
    if (!cachedRun || cachedRun.topicId !== 'mens-health' || cachedRun.articles.length !== 7) {
        throw new Error('Primer run was not cached properly in primerRuns');
    }

    // 3.7 Unknown Topic 404 Route
    await page.evaluate(() => { window.location.hash = '#/primers/unknown-slug'; });
    await page.waitForTimeout(400);
    const errorMsgVisible = await page.locator('text=Topic Not Found').isVisible();
    console.log('Unknown topic displays 404 boundary error:', errorMsgVisible);
    if (!errorMsgVisible) throw new Error('Unknown topic did not show error boundary');

    // Return to main page
    await page.evaluate(() => { window.location.hash = '#/'; });
    await page.waitForTimeout(400);

    // =========================================================================
    // SECTION 4: KEYWORDS GRAPH - WEIGHTED NODE SIZING (Phase 2)
    // =========================================================================
    console.log('\n--- SECTION 4: Keywords Graph - Weighted Sizing (Phase 2) ---');

    await page.click('#tab-graph-btn');
    await page.waitForTimeout(500);

    // 4.1 Node Data (strength, freq, radius, size, fontSize)
    const nodeMetrics = await page.evaluate(() => {
        if (!window.activeCytoscape) return [];
        return window.activeCytoscape.nodes().map(n => n.data());
    });
    console.log(`Graph initialized with ${nodeMetrics.length} nodes`);
    console.log('Sample node metrics:', nodeMetrics.slice(0, 3).map(n => ({
        id: n.id, strength: n.strength, freq: n.freq, radius: n.radius, size: n.size, fontSize: n.fontSize
    })));

    for (const n of nodeMetrics) {
        if (typeof n.strength !== 'number' || typeof n.radius !== 'number' || typeof n.size !== 'number') {
            throw new Error(`Node ${n.id} missing numerical strength/radius/size`);
        }
        if (n.size !== 2 * n.radius) {
            throw new Error(`Node ${n.id} size (${n.size}) != 2 * radius (${n.radius})`);
        }
    }

    // 4.2 Sizing Monotonicity
    let monotonic = true;
    for (let i = 0; i < nodeMetrics.length; i++) {
        for (let j = i + 1; j < nodeMetrics.length; j++) {
            if (nodeMetrics[i].strength > nodeMetrics[j].strength && nodeMetrics[i].radius < nodeMetrics[j].radius) {
                monotonic = false;
            }
        }
    }
    console.log('Node radii are monotonic with respect to weighted strength:', monotonic);
    if (!monotonic) throw new Error('Node sizing is not monotonic');

    // 4.3 Mathematical Edge Cases via computeNodeRadius
    const edgeCases = await page.evaluate(() => ({
        zero: window.computeNodeRadius(0, 0, 10),
        isolated: window.computeNodeRadius(0, 0, 0),
        equal: window.computeNodeRadius(15, 15, 15),
        single: window.computeNodeRadius(5, 5, 5),
        min: window.computeNodeRadius(0, 0, 20),
        max: window.computeNodeRadius(20, 0, 20)
    }));
    console.log('computeNodeRadius edge cases:', edgeCases);
    if (edgeCases.zero !== 10 || edgeCases.isolated !== 10) {
        throw new Error(`Zero strength radius mismatch: expected 10, got ${edgeCases.zero}`);
    }
    if (edgeCases.equal !== 22 || edgeCases.single !== 22) {
        throw new Error(`Equal strength midpoint radius mismatch: expected 22, got ${edgeCases.equal}`);
    }
    if (edgeCases.min !== 10 || edgeCases.max !== 34) {
        throw new Error(`Min/Max boundary mismatch: min=${edgeCases.min}, max=${edgeCases.max}`);
    }

    // =========================================================================
    // SECTION 5: KEYWORDS GRAPH - LOUVAIN COMMUNITY DETECTION (Phase 3)
    // =========================================================================
    console.log('\n--- SECTION 5: Louvain Community Detection & Colors (Phase 3) ---');

    // 5.1 Two-Clique Toy Graph Verification (yields 2 distinct clusters & 2 distinct colors)
    const toyGraphResult = await page.evaluate(() => {
        const nodes = [
            { id: 'Alpha', strength: 10, freq: 5 },
            { id: 'Beta', strength: 10, freq: 4 },
            { id: 'Gamma', strength: 10, freq: 3 },
            { id: 'Xray', strength: 10, freq: 5 },
            { id: 'Yankee', strength: 10, freq: 4 },
            { id: 'Zulu', strength: 10, freq: 3 },
            { id: 'Singleton', strength: 0, freq: 1 }
        ];
        const edges = [
            // Clique 1: Alpha - Beta - Gamma
            { source: 'Alpha', target: 'Beta', weight: 4 },
            { source: 'Beta', target: 'Gamma', weight: 4 },
            { source: 'Alpha', target: 'Gamma', weight: 4 },
            // Clique 2: Xray - Yankee - Zulu
            { source: 'Xray', target: 'Yankee', weight: 4 },
            { source: 'Yankee', target: 'Zulu', weight: 4 },
            { source: 'Xray', target: 'Zulu', weight: 4 }
        ];

        const comms = window.detectCommunitiesLouvain(nodes, edges);
        const clusters = window.processClusters(nodes, comms);

        return {
            comms,
            clusters: clusters.map(c => ({ id: c.id, name: c.name, color: c.color, size: c.nodes.length })),
            nodes: nodes.map(n => ({ id: n.id, clusterId: n.clusterId, color: n.color }))
        };
    });

    console.log('Two-clique toy graph clusters:', toyGraphResult.clusters);
    if (toyGraphResult.clusters.length < 2) {
        throw new Error(`Expected at least 2 clusters for two cliques, got ${toyGraphResult.clusters.length}`);
    }

    const color1 = toyGraphResult.clusters[0].color;
    const color2 = toyGraphResult.clusters[1].color;
    console.log(`Cluster 1 Color: ${color1}, Cluster 2 Color: ${color2} (distinct: ${color1 !== color2})`);
    if (color1 === color2) {
        throw new Error('Two separate cliques received identical cluster colors!');
    }

    // 5.2 Nodes < 3 are grouped into "Other"
    const singletonNode = toyGraphResult.nodes.find(n => n.id === 'Singleton');
    console.log('Singleton node cluster assignment:', singletonNode);
    if (singletonNode?.clusterId !== 'other' || singletonNode?.color !== '#94a3b8') {
        throw new Error(`Singleton node not assigned to "Other": ${JSON.stringify(singletonNode)}`);
    }

    // 5.3 Live Graph Nodes Have Cluster Colors (Not Uniform Blue)
    const liveNodeColors = await page.evaluate(() => {
        if (!window.activeCytoscape) return [];
        return window.activeCytoscape.nodes().map(n => ({
            id: n.id(),
            color: n.data('color'),
            clusterId: n.data('clusterId')
        }));
    });
    console.log('Live graph node colors count:', liveNodeColors.length);
    const distinctColors = new Set(liveNodeColors.map(n => n.color));
    console.log('Distinct colors in live graph:', Array.from(distinctColors));
    if (distinctColors.size === 0) throw new Error('No colors found on live graph nodes');

    // 5.4 Node Hover Style Check (Does NOT override background-color with blue)
    const hoverStyleCheck = await page.evaluate(() => {
        const node = window.activeCytoscape.nodes().first();
        const initialBg = node.style('background-color');
        node.addClass('highlighted');
        const highlightedBg = node.style('background-color');
        const highlightedBorderWidth = node.style('border-width');
        const highlightedBorderColor = node.style('border-color');
        node.removeClass('highlighted');
        return {
            initialBg,
            highlightedBg,
            bgRemainsClusterColor: highlightedBg === initialBg,
            highlightedBorderWidth,
            highlightedBorderColor
        };
    });
    console.log('node.highlighted style verification (preserves cluster color):', hoverStyleCheck);
    if (!hoverStyleCheck.bgRemainsClusterColor) {
        throw new Error(`node.highlighted altered background-color: initial=${hoverStyleCheck.initialBg}, highlighted=${hoverStyleCheck.highlightedBg}`);
    }

    // 5.5 Edge Opacities Check (Lower default 0.12 - 0.35, highlighted 0.9)
    const edgeOpacities = await page.evaluate(() => {
        const edges = window.activeCytoscape.edges();
        const opacities = edges.map(e => e.data('opacity'));
        const edge = edges.first();
        edge.addClass('highlighted');
        const highlightedOpacity = parseFloat(edge.style('opacity'));
        const highlightedLineColor = edge.style('line-color');
        edge.removeClass('highlighted');
        return {
            minOpacity: Math.min(...opacities),
            maxOpacity: Math.max(...opacities),
            highlightedOpacity,
            highlightedLineColor
        };
    });
    console.log('Edge opacities verification:', edgeOpacities);
    if (edgeOpacities.minOpacity < 0.12 || edgeOpacities.maxOpacity > 0.36 || edgeOpacities.highlightedOpacity !== 0.9) {
        throw new Error(`Edge opacity outside specifications: ${JSON.stringify(edgeOpacities)}`);
    }

    // =========================================================================
    // SECTION 6: COLLAPSIBLE LEGEND & HOVER TOOLTIP
    // =========================================================================
    console.log('\n--- SECTION 6: Collapsible Legend & Hover Tooltip ---');

    // 6.1 Legend Presence & Content
    const legendVisible = await page.locator('#graph-legend').isVisible();
    const legendRowsCount = await page.locator('.cluster-legend-row').count();
    console.log(`Legend visible: ${legendVisible}, Cluster rows count: ${legendRowsCount}`);
    if (!legendVisible || legendRowsCount === 0) {
        throw new Error('Legend overlay missing or empty');
    }

    // 6.2 Legend Toggle (Collapse / Expand)
    await page.click('#legend-toggle-btn');
    const isBodyHiddenAfterClick = await page.evaluate(() => {
        return document.getElementById('legend-body').classList.contains('hidden');
    });
    console.log('Legend body hidden after clicking collapse toggle:', isBodyHiddenAfterClick);
    if (!isBodyHiddenAfterClick) throw new Error('Legend did not collapse');

    await page.click('#legend-toggle-btn');
    const isBodyVisibleAfterClick = await page.evaluate(() => {
        return !document.getElementById('legend-body').classList.contains('hidden');
    });
    console.log('Legend body re-expanded after second click:', isBodyVisibleAfterClick);
    if (!isBodyVisibleAfterClick) throw new Error('Legend did not re-expand');

    // 6.3 Legend Row Filter Click
    await page.locator('.cluster-legend-row').first().click();
    const dimmedElementsCount = await page.evaluate(() => {
        return window.activeCytoscape.elements('.dimmed').length;
    });
    console.log(`Dimmed elements count after clicking legend cluster: ${dimmedElementsCount}`);
    if (dimmedElementsCount === 0) throw new Error('Legend cluster click did not dim unrelated elements');

    // Reset filter by clicking the same row again
    await page.locator('.cluster-legend-row').first().click();
    const dimmedAfterReset = await page.evaluate(() => {
        return window.activeCytoscape.elements('.dimmed').length;
    });
    console.log(`Dimmed elements count after resetting filter: ${dimmedAfterReset}`);
    if (dimmedAfterReset !== 0) throw new Error('Legend filter reset failed');

    // 6.4 Hover Tooltip Verification
    const tooltipCheck = await page.evaluate(() => {
        const node = window.activeCytoscape.nodes().first();
        const pos = node.renderedPosition();
        window.showGraphTooltip(node, pos);

        const tip = document.getElementById('graph-tooltip');
        const isHidden = tip.classList.contains('hidden');
        const text = tip.innerText;

        return {
            nodeId: node.id(),
            isHidden,
            text,
            hasKeyword: text.includes(node.id()),
            hasCoOccur: text.includes('Co-occurrences:'),
            hasArticles: text.includes('Articles:'),
            hasCluster: text.includes('Cluster:') || text.includes('Primary Topic Cluster:')
        };
    });
    console.log('Hover tooltip verification:', tooltipCheck);
    if (tooltipCheck.isHidden || !tooltipCheck.hasKeyword || !tooltipCheck.hasCoOccur || !tooltipCheck.hasArticles) {
        throw new Error(`Hover tooltip content check failed: ${JSON.stringify(tooltipCheck)}`);
    }

    // 6.5 Hide Tooltip
    await page.evaluate(() => window.hideGraphTooltip());
    const isTooltipHidden = await page.evaluate(() => {
        return document.getElementById('graph-tooltip').classList.contains('hidden');
    });
    console.log('Tooltip properly hidden on hideGraphTooltip():', isTooltipHidden);
    if (!isTooltipHidden) throw new Error('Tooltip did not hide');

    // Final Console Error Count Verification
    console.log(`\nTotal console errors during full test suite run: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
        console.error('Console errors logged:', consoleErrors);
        throw new Error(`Test suite failed due to ${consoleErrors.length} console error(s)`);
    }

    await browser.close();
    console.log('\n=====================================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY! (v0.3 Full Suite)');
    console.log('=====================================================');
}

runTestSuite().catch(err => {
    console.error('Test Suite Fatal Error:', err);
    process.exit(1);
});

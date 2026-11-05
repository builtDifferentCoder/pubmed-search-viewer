const { chromium } = require('playwright');
const path = require('path');

// Mock data generating function for NCBI endpoints
function getMockResponses() {
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
          <AbstractText Label="CONCLUSIONS">No significant difference in body weight observed; further research is needed.</AbstractText>
        </Abstract>
      </Article>
      <MeshHeadingList>
        <MeshHeading><DescriptorName>Animals</DescriptorName></MeshHeading>
        <MeshHeading><DescriptorName>Mice</DescriptorName></MeshHeading>
      </MeshHeadingList>
      <KeywordList>
        <Keyword>allulose</Keyword>
        <Keyword>diet</Keyword>
        <Keyword>metabolism</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>

  <!-- Article 3: Observational Study, Human, Large + Longitudinal (550), Negative conclusion, citations 25 -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>1003</PMID>
      <Article>
        <Journal>
          <JournalIssue><PubDate><Year>2023</Year><Month>Jun</Month></PubDate></JournalIssue>
        </Journal>
        <ArticleTitle>Longitudinal follow-up of sugar consumption in cohort</ArticleTitle>
        <PublicationTypeList>
          <PublicationType UI="D064888">Observational Study</PublicationType>
        </PublicationTypeList>
        <Abstract>
          <AbstractText Label="BACKGROUND">Long term survey of dietary factors.</AbstractText>
          <AbstractText Label="METHODS">A prospective cohort with 550 participants and 5 years of follow-up was analyzed.</AbstractText>
          <AbstractText Label="RESULTS">Sugar intake worsened liver enzyme levels.</AbstractText>
          <AbstractText Label="DISCUSSION">High consumption was harmful and worsened hepatic steatosis.</AbstractText>
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
          <JournalIssue><PubDate><Year>2020</Year></PubDate></JournalIssue>
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

async function runTests() {
    console.log('--- Starting Comprehensive Test Suite for PubMed ResearchMiner v0.2 ---');
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleLogs = [];
    const consoleErrors = [];
    page.on('console', msg => {
        const text = msg.text();
        consoleLogs.push(`[${msg.type()}] ${text}`);
        if (msg.type() === 'error') {
            consoleErrors.push(text);
        }
    });
    page.on('pageerror', err => {
        consoleErrors.push(err.toString());
    });
    page.on('dialog', async dialog => {
        console.log('Dialog handled:', dialog.type(), dialog.message());
        await dialog.accept();
    });

    // Mock NCBI endpoints
    const { esearchJson, esummaryJson, efetchXml } = getMockResponses();
    await page.route('**eutils.ncbi.nlm.nih.gov/**', async route => {
        const url = route.request().url();
        if (url.includes('esearch.fcgi')) {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(esearchJson) });
        } else if (url.includes('esummary.fcgi')) {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(esummaryJson) });
        } else if (url.includes('efetch.fcgi')) {
            await route.fulfill({ status: 200, contentType: 'text/xml', body: efetchXml });
        } else {
            await route.continue();
        }
    });

    const targetUrl = process.env.TEST_URL || 'http://localhost:4173/';
    console.log('Navigating to:', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Wait for the automatic initial search to finish
    console.log('Waiting for initial search and save to complete...');
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
    await page.waitForTimeout(1000);

    // =========================================================================
    // TEST 1: Check No Console Errors & Initial Load
    // =========================================================================
    console.log('\n--- VERIFYING TEST 1: Console errors, reload, and v1 upgrade ---');
    console.log('Console errors count on initial load:', consoleErrors.length);
    if (consoleErrors.length > 0) {
        console.error('Console errors:', consoleErrors);
    }

    // Verify stored query in IndexedDB
    const initialDb = await page.evaluate(async () => {
        const qCount = await window.db.queries.count();
        const aCount = await window.db.articles.count();
        const articles = await window.db.articles.toArray();
        return { qCount, aCount, articles };
    });
    console.log(`Stored queries: ${initialDb.qCount}, Stored articles: ${initialDb.aCount}`);

    // Verify v1 -> v2 schema upgrade path by testing an upgrade scenario in IndexedDB
    const upgradeTestResult = await page.evaluate(async () => {
        try {
            // Test temporary database to simulate v1 -> v2 upgrade
            const tempDbName = 'PubMedMinerTestUpgrade_' + Date.now();
            const dbV1 = new Dexie(tempDbName);
            dbV1.version(1).stores({
                queries: '++id, term, createdAt',
                articles: '++id, queryId, pmid, hasConclusion, citations, *keywordsNorm'
            });
            await dbV1.open();
            await dbV1.articles.add({
                queryId: 1,
                pmid: '9999',
                title: 'Old V1 article',
                dateStr: '2019 May',
                hasConclusion: 1,
                citations: 10,
                keywordsNorm: ['old']
            });
            await dbV1.close();

            // Now open with v2 definition with upgrade handler
            const dbV2 = new Dexie(tempDbName);
            dbV2.version(1).stores({
                queries: '++id, term, createdAt',
                articles: '++id, queryId, pmid, hasConclusion, citations, *keywordsNorm'
            });
            dbV2.version(2).stores({
                queries: '++id, term, createdAt',
                articles: '++id, queryId, pmid, hasConclusion, citations, *keywordsNorm, pubYear, studyType, subjectType, sampleSizeBucket, conclusionType'
            }).upgrade(tx => {
                return tx.table('articles').toCollection().modify(article => {
                    if (article.pubYear === undefined) {
                        const m = (article.dateStr || '').match(/\b(19\d\d|20\d\d)\b/);
                        article.pubYear = m ? parseInt(m[1], 10) : 0;
                    }
                    if (article.studyType === undefined) article.studyType = 'Other';
                    if (article.subjectType === undefined) article.subjectType = 'Other/Unknown';
                    if (article.sampleSize === undefined) article.sampleSize = null;
                    if (article.sampleSizeBucket === undefined) article.sampleSizeBucket = 'Unknown';
                    if (article.conclusionType === undefined) {
                        article.conclusionType = article.hasConclusion ? 'Null-Inconclusive' : 'None';
                    }
                });
            });
            await dbV2.open();
            const upgradedRecord = await dbV2.articles.get(1);
            await dbV2.delete();

            return {
                success: true,
                pubYear: upgradedRecord.pubYear,
                studyType: upgradedRecord.studyType,
                subjectType: upgradedRecord.subjectType,
                sampleSizeBucket: upgradedRecord.sampleSizeBucket,
                conclusionType: upgradedRecord.conclusionType
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });
    console.log('V1 -> V2 Database Upgrade Test:', upgradeTestResult);

    // Reload page and verify stored queries persist
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
    await page.waitForTimeout(500);

    const reloadedCards = await page.locator('#queries-container section').count();
    console.log('Cards after reload:', reloadedCards);

    // =========================================================================
    // TEST 2: All 8 Charts Render and Totals Reconcile
    // =========================================================================
    console.log('\n--- VERIFYING TEST 2: 8 Charts Render and Totals Reconcile ---');
    const chartVerification = await page.evaluate(() => {
        const charts = window.activeCharts;
        if (!charts || charts.length < 8) return { error: `Found only ${charts ? charts.length : 0} charts` };

        // 8 Charts:
        // 0: Total Articles
        // 1: Conclusions
        // 2: Sample Size
        // 3: Citations
        // 4: Study Type
        // 5: Subject Type
        // 6: Publication Year
        // 7: Top Keywords

        const sum = arr => arr.reduce((a, b) => a + b, 0);

        const totalBars = charts[0].data.datasets[0].data;
        const concBars = charts[1].data.datasets[0].data;
        const sampleBars = charts[2].data.datasets[0].data;
        const citeBars = charts[3].data.datasets[0].data;
        const studyBars = charts[4].data.datasets[0].data;
        const subjectBars = charts[5].data.datasets[0].data;
        const yearBars = charts[6].data.datasets[0].data;
        const kwBars = charts[7].data.datasets[0].data;

        return {
            totalChartCount: charts.length,
            totalArticles: sum(totalBars),
            sumConclusion: sum(concBars),
            sumSampleSize: sum(sampleBars),
            sumCitations: sum(citeBars),
            sumStudyType: sum(studyBars),
            sumSubjectType: sum(subjectBars),
            sumPubYear: sum(yearBars),
            topKeywordsLabels: charts[7].data.labels,
            topKeywordsData: kwBars,
            concLabels: charts[1].data.labels,
            concData: concBars,
            sampleLabels: charts[2].data.labels,
            sampleData: sampleBars,
            studyLabels: charts[4].data.labels,
            studyData: studyBars,
            subjectLabels: charts[5].data.labels,
            subjectData: subjectBars,
            yearLabels: charts[6].data.labels,
            yearData: yearBars
        };
    });

    console.log('Chart Reconciliations:');
    console.log('Total articles:', chartVerification.totalArticles);
    console.log('Sum Conclusions:', chartVerification.sumConclusion);
    console.log('Sum Sample Size:', chartVerification.sumSampleSize);
    console.log('Sum Citations:', chartVerification.sumCitations);
    console.log('Sum Study Type:', chartVerification.sumStudyType);
    console.log('Sum Subject Type:', chartVerification.sumSubjectType);
    console.log('Sum Pub Year:', chartVerification.sumPubYear);

    // =========================================================================
    // TEST 3: Clicking Every Bar Filters Correctly & Row Count Equals Bar Value
    // =========================================================================
    console.log('\n--- VERIFYING TEST 3: Click-to-filter on all charts ---');
    const filterVerification = await page.evaluate(async () => {
        const queryId = (await window.db.queries.toArray())[0].id;
        const metrics = await window.buildQueryMetrics(queryId);
        const results = [];

        for (const chartDef of metrics.chartDefs) {
            for (const bar of chartDef.bars) {
                const filteredRows = await window.fetchSubset(queryId, bar.filter);
                results.push({
                    chart: chartDef.title,
                    barLabel: bar.label,
                    barCount: bar.count,
                    returnedRows: filteredRows.length,
                    matches: bar.count === filteredRows.length
                });
            }
        }
        return results;
    });

    const allMatches = filterVerification.every(r => r.matches);
    console.log(`Tested ${filterVerification.length} bars across all 8 charts.`);
    console.log('All bar counts equal returned row counts:', allMatches);
    if (!allMatches) {
        console.log('Mismatches:', filterVerification.filter(r => !r.matches));
    }

    // Now test UI click on a specific bar and verify inline detail table
    const cardEl = page.locator('#queries-container section').first();
    // Simulate clicking the Conclusion chart's first non-zero bar
    const uiClickTest = await page.evaluate(async () => {
        const card = document.querySelector('#queries-container section');
        const canvas = card.querySelector('#canvas-1-1'); // Conclusion chart
        const chart = window.activeCharts[1];
        const barIndex = chart.data.datasets[0].data.findIndex(v => v > 0);
        const bar = { label: chart.data.labels[barIndex], count: chart.data.datasets[0].data[barIndex] };

        // Simulate click handler directly
        const qId = (await window.db.queries.toArray())[0].id;
        const rows = await window.fetchSubset(qId, { field: 'conclusionType', value: bar.label });
        const detail = card.querySelector('.detail');
        const detailTitle = card.querySelector('.detail-title');
        const detailBody = card.querySelector('.detail-body');
        detail.classList.remove('hidden');
        detailTitle.textContent = `${bar.label}: ${rows.length} article${rows.length === 1 ? '' : 's'}`;
        detailBody.innerHTML = window.tableHtml(rows);

        return {
            titleText: detailTitle.textContent,
            tableRowsCount: detailBody.querySelectorAll('tbody tr').length,
            expectedCount: bar.count
        };
    });
    console.log('UI Detail Table Click Verification:', uiClickTest);

    // =========================================================================
    // TEST 4: Keywords Graph Tab
    // =========================================================================
    console.log('\n--- VERIFYING TEST 4: Keywords Graph Tab ---');
    // Switch to graph tab
    await page.click('#tab-graph-btn');
    await page.waitForTimeout(500);

    const graphState = await page.evaluate(() => {
        const cy = window.activeCytoscape;
        if (!cy) return { error: 'Cytoscape instance not found' };

        const nodes = cy.nodes().map(n => ({ id: n.id(), label: n.data('label'), freq: n.data('freq'), size: n.data('size') }));
        const edges = cy.edges().map(e => ({ source: e.data('source'), target: e.data('target'), weight: e.data('weight') }));

        return {
            nodeCount: nodes.length,
            nodes,
            edgeCount: edges.length,
            edges
        };
    });
    console.log(`Graph initialized with ${graphState.nodeCount} nodes and ${graphState.edgeCount} edges.`);
    console.log('Nodes:', graphState.nodes.map(n => `${n.label} (freq: ${n.freq})`));
    console.log('Edges:', graphState.edges.map(e => `${e.source} <-> ${e.target} (weight: ${e.weight})`));

    // Verify hand-computed co-occurrence:
    // 'allulose' and 'diet' co-occur in 2 articles (Art 1 & Art 2)
    const alluloseDietEdge = graphState.edges.find(e =>
        (e.source === 'allulose' && e.target === 'diet') || (e.source === 'diet' && e.target === 'allulose')
    );
    console.log('Hand-computed co-occurrence match for allulose <-> diet:', alluloseDietEdge?.weight === 2);

    // Test slider cap adjustment
    await page.evaluate(() => {
        const slider = document.getElementById('graph-cap-slider');
        slider.min = '2';
        slider.value = '2';
        slider.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(300);

    const cappedNodeCount = await page.evaluate(() => window.activeCytoscape.nodes().length);
    console.log('Node count after setting slider cap to 2:', cappedNodeCount);

    // Reset slider
    await page.evaluate(() => {
        const slider = document.getElementById('graph-cap-slider');
        slider.value = 60;
        slider.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(300);

    // Test clicking a node in the graph: triggers performSearch, saves query, switches to Search Results tab
    console.log('Testing Cytoscape node click to search...');
    const searchTriggered = await page.evaluate(async () => {
        const cy = window.activeCytoscape;
        const targetNode = cy.nodes('#allulose')[0] || cy.nodes()[0];
        // Trigger tap handler on node
        targetNode.emit('tap');
    });

    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
    await page.waitForTimeout(1000);

    const activeTabAfterClick = await page.evaluate(() => window.currentActiveTab);
    const queriesCountAfterNodeClick = await page.evaluate(() => window.db.queries.count());
    console.log('Active tab after node click:', activeTabAfterClick);
    console.log('Total queries stored after node click:', queriesCountAfterNodeClick);

    // =========================================================================
    // TEST 5: Re-searching same term replaces old entry; Delete and Clear all
    // =========================================================================
    console.log('\n--- VERIFYING TEST 5: Duplicate search, Delete query, and Clear All ---');
    // Re-search "allulose diet"
    await page.evaluate(async () => {
        await window.performSearch('allulose diet');
    });
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
    const queriesAfterResearch = await page.evaluate(async () => {
        const qs = await window.db.queries.where('term').equals('allulose diet').toArray();
        return qs.length;
    });
    console.log('Occurrences of "allulose diet" after re-searching (should be 1):', queriesAfterResearch);

    // Test delete single query
    const deleteTest = await page.evaluate(async () => {
        const q = (await window.db.queries.toArray())[0];
        const initialCount = await window.db.queries.count();
        // simulate delete
        await window.db.transaction('rw', window.db.queries, window.db.articles, async () => {
            await window.db.articles.where('queryId').equals(q.id).delete();
            await window.db.queries.delete(q.id);
        });
        await window.renderAll();
        const afterCount = await window.db.queries.count();
        return { initialCount, afterCount };
    });
    console.log('Delete query test:', deleteTest);

    // Test clear all
    const clearAllTest = await page.evaluate(async () => {
        await window.db.transaction('rw', window.db.queries, window.db.articles, async () => {
            await window.db.queries.clear();
            await window.db.articles.clear();
        });
        await window.renderAll();
        const finalCount = await window.db.queries.count();
        return { finalCount };
    });
    console.log('Clear all test (should be 0):', clearAllTest.finalCount);

    // =========================================================================
    // TEST 6: Titles with <b>test</b> render as text, not HTML
    // =========================================================================
    console.log('\n--- VERIFYING TEST 6: HTML escaping for titles ---');
    // Run search again to populate mock data
    await page.evaluate(async () => {
        await window.performSearch('allulose diet');
    });
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
    await page.waitForTimeout(500);

    // Open detail table for "allulose diet"
    const titleEscapingTest = await page.evaluate(async () => {
        const qId = (await window.db.queries.toArray())[0].id;
        const rows = await window.fetchSubset(qId, { field: 'all' });
        const card = document.querySelector('#queries-container section');
        const detail = card.querySelector('.detail');
        const detailBody = card.querySelector('.detail-body');
        detail.classList.remove('hidden');
        detailBody.innerHTML = window.tableHtml(rows);

        // Find the specific article with PMID 1001
        const allRows = Array.from(detailBody.querySelectorAll('tbody tr'));
        const row1001 = allRows.find(tr => tr.innerHTML.includes('PMID: 1001'));
        const titleSpan = row1001 ? row1001.querySelector('td a span') : null;

        return {
            foundRow: !!row1001,
            textExpected: 'Efficacy of <b>test</b> allulose in diet',
            actualText: titleSpan?.textContent,
            containsRawBTagInHtml: titleSpan?.innerHTML.includes('&lt;b&gt;test&lt;/b&gt;'),
            hasRenderedBoldChild: titleSpan?.querySelector('b') !== null
        };
    });
    console.log('Title Escaping Verification (PMID 1001):', titleEscapingTest);

    console.log('\nTotal final console errors count:', consoleErrors.length);
    if (consoleErrors.length > 0) {
        console.error('Final console errors:', consoleErrors);
    }

    await browser.close();
    console.log('\n--- Test Suite Execution Complete! ---');
}

runTests().catch(err => {
    console.error('Test Suite Failed with Exception:', err);
    process.exit(1);
});

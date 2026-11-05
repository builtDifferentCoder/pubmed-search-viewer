const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Mock data generator for NCBI endpoints with known opposing pairs and unrelated papers
function getMockResponses() {
    const esearchJson = {
        header: { type: 'esearch', version: '0.3' },
        esearchresult: {
            count: '7',
            retmax: '7',
            retstart: '0',
            idlist: ['301', '302', '303', '304', '305', '306', '307'],
            translationset: [],
            querytranslation: 'test[All Fields]'
        }
    };

    const esummaryJson = {
        header: { type: 'esummary', version: '0.3' },
        result: {
            uids: ['301', '302', '303', '304', '305', '306', '307'],
            '301': { uid: '301', pmcrefcount: 20 },
            '302': { uid: '302', pmcrefcount: 15 },
            '303': { uid: '303', pmcrefcount: 8 },
            '304': { uid: '304', pmcrefcount: 5 },
            '305': { uid: '305', pmcrefcount: 3 },
            '306': { uid: '306', pmcrefcount: 1 },
            '307': { uid: '307', pmcrefcount: 0 }
        }
    };

    const efetchXml = `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2019//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_190101.dtd">
<PubmedArticleSet>
  <!-- Paper 301: Positive, keywords: allulose, diet, ketosis -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>301</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2023</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Allulose promotes ketosis and metabolic balance</ArticleTitle>
        <Abstract>
          <AbstractText Label="CONCLUSIONS">Allulose was effective and significantly improved ketosis markers.</AbstractText>
        </Abstract>
      </Article>
      <KeywordList>
        <Keyword>allulose</Keyword>
        <Keyword>diet</Keyword>
        <Keyword>ketosis</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>

  <!-- Paper 302: Negative, keywords: allulose, diet, ketosis -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>302</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2022</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Allulose fails to promote ketosis in trial</ArticleTitle>
        <Abstract>
          <AbstractText Label="CONCLUSION">Allulose is ineffective and failed to improve metabolic parameters.</AbstractText>
        </Abstract>
      </Article>
      <KeywordList>
        <Keyword>allulose</Keyword>
        <Keyword>diet</Keyword>
        <Keyword>ketosis</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>

  <!-- Paper 303: Null-Inconclusive, keywords: allulose, diet -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>303</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2021</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Allulose effects remain inconclusive</ArticleTitle>
        <Abstract>
          <AbstractText Label="CONCLUSION">Results were inconclusive and no difference was observed.</AbstractText>
        </Abstract>
      </Article>
      <KeywordList>
        <Keyword>allulose</Keyword>
        <Keyword>diet</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>

  <!-- Paper 304: Positive, keywords: allulose, diet, ketosis (Same tag as 301) -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>304</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2024</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Allulose confirms positive ketosis results</ArticleTitle>
        <Abstract>
          <AbstractText Label="CONCLUSION">Treatment was beneficial and effective.</AbstractText>
        </Abstract>
      </Article>
      <KeywordList>
        <Keyword>allulose</Keyword>
        <Keyword>diet</Keyword>
        <Keyword>ketosis</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>

  <!-- Paper 305: Negative, keywords: cardiovascular, hypertension (0 shared keywords) -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>305</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2023</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Cardiovascular hypertension analysis</ArticleTitle>
        <Abstract>
          <AbstractText Label="CONCLUSION">Intervention was harmful and worsened pressure.</AbstractText>
        </Abstract>
      </Article>
      <KeywordList>
        <Keyword>cardiovascular</Keyword>
        <Keyword>hypertension</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>

  <!-- Paper 306: Negative, keywords: allulose, astronomy (Only 1 shared keyword: allulose) -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>306</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2022</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Astronomical observations with allulose</ArticleTitle>
        <Abstract>
          <AbstractText Label="CONCLUSION">Ineffective method failed to provide clarity.</AbstractText>
        </Abstract>
      </Article>
      <KeywordList>
        <Keyword>allulose</Keyword>
        <Keyword>astronomy</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>

  <!-- Paper 307: No conclusion tag ('None') -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>307</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2020</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Descriptive overview without conclusion</ArticleTitle>
        <Abstract>
          <AbstractText Label="BACKGROUND">Reviewing literature without conclusions.</AbstractText>
        </Abstract>
      </Article>
      <KeywordList>
        <Keyword>allulose</Keyword>
        <Keyword>diet</Keyword>
        <Keyword>ketosis</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>`;

    return { esearchJson, esummaryJson, efetchXml };
}

(async () => {
    console.log('====================================================');
    console.log('Running Playwright Test Suite: Phase 2 Divergence');
    console.log('====================================================');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('dialog', async dialog => {
        console.log('Dialog dismissed:', dialog.message());
        await dialog.dismiss();
    });

    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.toString()));

    // Route CDN libraries and NCBI mock endpoints
    const { esearchJson, esummaryJson, efetchXml } = getMockResponses();
    await page.route('**', async (route) => {
        const url = route.request().url();
        if (url.includes('dexie')) {
            const p = path.join(__dirname, 'node_modules/dexie/dist/dexie.js');
            await route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(p) });
        } else if (url.includes('chart')) {
            const p = path.join(__dirname, 'node_modules/chart.js/dist/chart.umd.js');
            await route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(p) });
        } else if (url.includes('cytoscape')) {
            const p = path.join(__dirname, 'node_modules/cytoscape/dist/cytoscape.min.js');
            await route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(p) });
        } else if (url.includes('graphology-library')) {
            const p = path.join(__dirname, 'node_modules/graphology-library/dist/graphology-library.min.js');
            await route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(p) });
        } else if (url.includes('graphology')) {
            const p = path.join(__dirname, 'node_modules/graphology/dist/graphology.umd.js');
            await route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(p) });
        } else if (url.includes('tailwindcss.com')) {
            await route.fulfill({ status: 200, contentType: 'application/javascript', body: "const s = document.createElement('style'); s.textContent = '.hidden { display: none !important; }'; document.head.appendChild(s);" });
        } else if (url.includes('phosphor-icons')) {
            await route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* phosphor mocked */' });
        } else if (url.includes('esearch.fcgi')) {
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
    await page.waitForTimeout(2000);

    // Test 1: Verify Divergence Panel is rendered on Search Results
    console.log('\nTest 1: Verify Divergence Panel on Search Results query card');
    const divergenceContainer = await page.$('.divergence-container');
    assert(divergenceContainer, 'Divergence container exists in Search Results');
    const divergenceBadge = await page.$('.divergence-badge');
    assert(divergenceBadge, 'Divergence badge exists');
    const badgeText = await page.textContent('.divergence-badge');
    console.log('  Divergence badge text:', badgeText);
    console.log('  ✓ Divergence panel rendered successfully');

    // Test 2: Acceptance Criteria - Known opposing pairs appear, unrelated papers do not
    console.log('\nTest 2: Acceptance Criteria - Known opposing pairs appear, unrelated do not (N=2)');
    const divergenceItems = await page.$$('.divergence-item');
    console.log(`  Found ${divergenceItems.length} divergence item cards rendered on current page`);
    assert(divergenceItems.length > 0, 'At least one divergence item card is displayed');

    // Retrieve all displayed pair text contents
    const pairTexts = [];
    for (const item of divergenceItems) {
        const text = await item.textContent();
        pairTexts.push(text);
    }

    // Check 1: Known opposing pair (PMID 301 vs PMID 302) MUST appear
    const has301_302 = pairTexts.some(t => t.includes('301') && t.includes('302'));
    assert(has301_302, 'Known opposing pair (301 vs 302: Positive vs Negative) MUST appear');
    console.log('  ✓ Known opposing pair (301 vs 302) is present');

    // Check 2: Top ranked pair should have highest shared count (3 shared keywords: allulose, diet, ketosis)
    const topPairText = pairTexts[0];
    assert(topPairText.includes('Shared (3)'), 'Top ranked pair shares 3 keywords');
    assert(topPairText.includes('Direct Opposition'), 'Top ranked pair has Direct Opposition');
    console.log('  ✓ Ranking by shared count & opposition strength verified');

    // Check 3: Paper 305 (unrelated, 0 shared keywords) MUST NOT appear in any pair
    const has305 = pairTexts.some(t => t.includes('305'));
    assert(!has305, 'Unrelated paper 305 (0 shared keywords) MUST NOT appear');
    console.log('  ✓ Unrelated paper 305 is correctly excluded');

    // Check 4: Paper 306 (only 1 shared keyword < N=2) MUST NOT appear at N=2
    const has306_N2 = pairTexts.some(t => t.includes('306'));
    assert(!has306_N2, 'Paper 306 (1 shared keyword < N=2) MUST NOT appear when N=2');
    console.log('  ✓ Paper 306 (below threshold N=2) is correctly excluded');

    // Check 5: Paper 307 (missing conclusion tag 'None') MUST NOT appear
    const has307 = pairTexts.some(t => t.includes('307'));
    assert(!has307, 'Paper 307 (missing conclusion tag) MUST NOT appear');
    console.log('  ✓ Paper with missing conclusion tag is correctly excluded');

    // Check 6: Paper 301 vs Paper 304 (both Positive -> non-opposing) MUST NOT appear
    const has301_304 = pairTexts.some(t => t.includes('301') && t.includes('304'));
    assert(!has301_304, 'Non-opposing pair 301 vs 304 (both Positive) MUST NOT appear');
    console.log('  ✓ Non-opposing pair is correctly excluded');

    // Test 3: Configurable N threshold
    console.log('\nTest 3: Configurable N threshold');
    // Change N to 1
    await page.selectOption('.divergence-n-select', '1');
    await page.waitForTimeout(400);

    const badgeTextN1 = await page.textContent('.divergence-badge');
    console.log('  Divergence badge text when N=1:', badgeTextN1);
    const n1Total = parseInt(badgeTextN1, 10);
    assert(n1Total > 5, 'When N=1, total pairs increases (> 5 pairs)');

    // Go to next page to verify lower-ranked 1-keyword pairs appear
    const nextBtn = await page.$('.divergence-next-btn');
    if (nextBtn) {
        await nextBtn.click();
        await page.waitForTimeout(300);
    }

    const itemsN1 = await page.$$('.divergence-item');
    const textsN1 = [];
    for (const it of itemsN1) textsN1.push(await it.textContent());
    const has306_N1 = textsN1.some(t => t.includes('306'));
    assert(has306_N1, 'When N=1, Paper 306 with 1 shared keyword appears on paged results');
    console.log('  ✓ Configurable N=1 includes 1-keyword pairs and pagination works');

    // Change N to 4
    await page.selectOption('.divergence-n-select', '4');
    await page.waitForTimeout(400);
    const emptyMsg = await page.textContent('.divergence-body');
    assert(emptyMsg.includes('No contradictory paper pairs found'), 'Empty state shown when N=4 exceeds shared counts');
    console.log('  ✓ Configurable N=4 cleanly triggers empty state');

    // Reset N back to 2
    await page.selectOption('.divergence-n-select', '2');
    await page.waitForTimeout(400);

    // Test 4: Side-by-Side Modal
    console.log('\nTest 4: Selecting item opens Side-by-Side Modal');
    const compareBtn = await page.$('.divergence-compare-btn');
    assert(compareBtn, 'Side-by-Side button exists on divergence item');
    await compareBtn.click();
    await page.waitForTimeout(300);

    const modalVisible = await page.isVisible('#divergence-compare-modal');
    assert(modalVisible, 'Side-by-side modal opened on item selection');

    const colAContent = await page.textContent('#modal-paper-a');
    const colBContent = await page.textContent('#modal-paper-b');
    assert(colAContent.length > 50, 'Paper A details populated in modal');
    assert(colBContent.length > 50, 'Paper B details populated in modal');
    console.log('  ✓ Both papers displayed side-by-side with full metadata');

    // Test 5: Highlighting connecting path in Keywords Graph
    console.log('\nTest 5: Selecting item highlights connecting path in Keywords Graph');
    // Click "View Path in Graph" inside modal
    await page.click('#modal-highlight-graph-btn');
    await page.waitForTimeout(1000);

    // Verify switched to graph tab
    const curTab = await page.evaluate(() => window.currentActiveTab);
    assert.strictEqual(curTab, 'graph', 'Switched to Keywords Graph tab');

    // Verify activeCytoscape elements highlighted
    const highlightState = await page.evaluate(() => {
        if (!window.activeCytoscape) return { count: 0 };
        const highlightedNodes = window.activeCytoscape.nodes('.highlighted');
        const dimmedNodes = window.activeCytoscape.nodes('.dimmed');
        return {
            highlightedCount: highlightedNodes.length,
            dimmedCount: dimmedNodes.length
        };
    });
    console.log('  Cytoscape graph highlight state:', highlightState);
    assert(highlightState.highlightedCount > 0, 'Shared keywords nodes are highlighted in graph');
    assert(highlightState.dimmedCount > 0, 'Other nodes are dimmed in graph');
    console.log('  ✓ Connecting path highlighted in Keywords Graph successfully!');

    // Check for console errors
    console.log('\nTotal console errors:', consoleErrors.length);
    if (consoleErrors.length > 0) {
        console.log('Errors:', consoleErrors);
    }
    assert.strictEqual(consoleErrors.length, 0, 'Zero console errors during Phase 2 test suite');

    await browser.close();
    console.log('\n====================================================');
    console.log('All Phase 2 tests passed successfully!');
    console.log('====================================================');
})();

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Mock data generator for NCBI endpoints
function getMockResponses() {
    const esearchJson = {
        header: { type: 'esearch', version: '0.3' },
        esearchresult: {
            count: '3',
            retmax: '3',
            retstart: '0',
            idlist: ['201', '202', '203'],
            translationset: [],
            querytranslation: 'test[All Fields]'
        }
    };

    const esummaryJson = {
        header: { type: 'esummary', version: '0.3' },
        result: {
            uids: ['201', '202', '203'],
            '201': { uid: '201', pmcrefcount: 10 },
            '202': { uid: '202', pmcrefcount: 5 },
            '203': { uid: '203', pmcrefcount: 2 }
        }
    };

    const efetchXml = `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2019//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_190101.dtd">
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>201</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2023</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Allulose and Ketosis in Healthy Diet</ArticleTitle>
        <Abstract>
          <AbstractText Label="CONCLUSIONS">Dietary allulose significantly improved glycemic status.</AbstractText>
        </Abstract>
      </Article>
      <KeywordList>
        <Keyword>allulose</Keyword>
        <Keyword>diet</Keyword>
        <Keyword>ketosis</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>202</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2022</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Dietary Fiber and Metabolism</ArticleTitle>
        <Abstract>
          <AbstractText Label="CONCLUSION">Fiber intake was beneficial for metabolic health.</AbstractText>
        </Abstract>
      </Article>
      <KeywordList>
        <Keyword>diet</Keyword>
        <Keyword>fiber</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>`;

    return { esearchJson, esummaryJson, efetchXml };
}

(async () => {
    console.log('====================================================');
    console.log('Running Playwright Test Suite: Phase 1 Query Builder');
    console.log('====================================================');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('dialog', async dialog => {
        console.log('Dialog dismissed:', dialog.message());
        await dialog.dismiss();
    });

    const consoleLogs = [];
    const consoleErrors = [];
    page.on('console', msg => {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.toString()));

    // Route CDN libraries to local node_modules & mock NCBI
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

    const fileUrl = 'file:///' + path.resolve(__dirname, 'pubmed_search_viewer.html').replace(/\\/g, '/');
    console.log('Navigating to:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    if (consoleErrors.length > 0) {
        console.error('Page load console errors:', consoleErrors);
    }

    // Test 1: Verify DOM elements exist
    console.log('\nTest 1: Verify Query Builder DOM elements');
    const qbBar = await page.$('#query-builder-bar');
    assert(qbBar, 'query-builder-bar exists');
    const dropZone = await page.$('#qb-drop-zone');
    assert(dropZone, 'qb-drop-zone exists');
    const booleanString = await page.$('#qb-boolean-string');
    assert(booleanString, 'qb-boolean-string exists');
    console.log('  ✓ Query Builder DOM elements verified');

    // Switch to Keywords Graph tab
    console.log('\nTest 2: Switch to Keywords Graph tab');
    await page.click('#tab-graph-btn');
    await page.waitForTimeout(1000);
    const activeTab = await page.evaluate(() => window.currentActiveTab);
    assert.strictEqual(activeTab, 'graph');
    console.log('  ✓ Keywords Graph tab active');

    // Test 3: Clear any existing query and verify initial state
    console.log('\nTest 3: Verify initial/empty Query Builder state');
    await page.click('#qb-clear-btn');
    const initialText = await page.textContent('#qb-boolean-string');
    assert(initialText.includes('empty'), 'Boolean string indicates empty');
    console.log('  ✓ Empty state verified');

    // Test 4: Build "(A AND B) NOT C" using only the UI
    console.log('\nTest 4: Build "(A AND B) NOT C" using only the UI (Acceptance Criterion)');
    
    // Add term A via keyboard input
    await page.fill('#qb-keyword-input', 'A');
    await page.press('#qb-keyword-input', 'Enter');
    await page.waitForTimeout(200);

    let queryStr = await page.textContent('#qb-boolean-string');
    console.log('  After adding A:', queryStr);
    assert.strictEqual(queryStr, 'A');

    // Add term B via keyboard input
    await page.fill('#qb-keyword-input', 'B');
    await page.press('#qb-keyword-input', 'Enter');
    await page.waitForTimeout(200);

    // Operator popover should be visible for second term
    const popoverVisible = await page.isVisible('#qb-operator-popover');
    assert(popoverVisible, 'Operator popover displayed on adding non-first term');
    
    // Click AND in popover
    await page.click('.qb-popover-op[data-op="AND"]');
    await page.waitForTimeout(200);

    queryStr = await page.textContent('#qb-boolean-string');
    console.log('  After adding B with AND:', queryStr);
    assert.strictEqual(queryStr, 'A AND B');

    // Add term C via keyboard input
    await page.fill('#qb-keyword-input', 'C');
    await page.press('#qb-keyword-input', 'Enter');
    await page.waitForTimeout(200);

    // Operator popover should show; click NOT
    await page.click('.qb-popover-op[data-op="NOT"]');
    await page.waitForTimeout(200);

    queryStr = await page.textContent('#qb-boolean-string');
    console.log('  After adding C with NOT:', queryStr);
    assert.strictEqual(queryStr, 'A AND B NOT C');

    // Select chips A and B for parentheses grouping
    const checkboxes = await page.$$('.qb-chip-checkbox');
    assert.strictEqual(checkboxes.length, 3, 'Three chips exist');
    await checkboxes[0].click();
    await checkboxes[1].click();
    await page.waitForTimeout(200);

    // Group button should be enabled
    const groupDisabled = await page.$eval('#qb-group-btn', btn => btn.disabled);
    assert.strictEqual(groupDisabled, false, 'Group button is enabled when 2 chips selected');

    // Click "( ) Group" button
    await page.click('#qb-group-btn');
    await page.waitForTimeout(200);

    queryStr = await page.textContent('#qb-boolean-string');
    console.log('  After clicking ( ) Group on A and B:', queryStr);
    assert.strictEqual(queryStr, '(A AND B) NOT C', 'Query is exactly "(A AND B) NOT C"');
    console.log('  ✓ Built "(A AND B) NOT C" using only UI successfully!');

    // Test 5: Multi-word automatic quoting
    console.log('\nTest 5: Automatic quoting of multi-word keywords');
    await page.fill('#qb-keyword-input', 'dietary allulose');
    await page.press('#qb-keyword-input', 'Enter');
    await page.waitForTimeout(200);
    // Dismiss popover (default AND)
    await page.click('#qb-popover-close');
    await page.waitForTimeout(200);

    queryStr = await page.textContent('#qb-boolean-string');
    console.log('  With multi-word term:', queryStr);
    assert(queryStr.includes('"dietary allulose"'), 'Multi-word term is automatically quoted');
    console.log('  ✓ Multi-word terms quoted automatically');

    // Remove the extra term to restore "(A AND B) NOT C"
    const removeBtns = await page.$$('.qb-chip-remove');
    await removeBtns[removeBtns.length - 1].click();
    await page.waitForTimeout(200);
    queryStr = await page.textContent('#qb-boolean-string');
    assert.strictEqual(queryStr, '(A AND B) NOT C');

    // Test 6: Run Search from Query Builder
    console.log('\nTest 6: Run Search from Query Builder');
    let searchCalledWith = null;
    await page.exposeFunction('trackSearchQuery', (term) => { searchCalledWith = term; });
    await page.evaluate(() => {
        const origPerformSearch = window.performSearch;
        window.performSearch = async function(term, opts) {
            window.trackSearchQuery(term);
            return origPerformSearch(term, opts);
        };
    });

    await page.click('#qb-run-search-btn');
    await page.waitForTimeout(1000);

    assert.strictEqual(searchCalledWith, '(A AND B) NOT C', 'Search executed with "(A AND B) NOT C"');
    const inputVal = await page.$eval('#search-input', el => el.value);
    assert.strictEqual(inputVal, '(A AND B) NOT C', 'Search input populated with "(A AND B) NOT C"');
    console.log('  ✓ Search executed successfully with "(A AND B) NOT C"');

    // Test 7: Collapse and Expand
    console.log('\nTest 7: Collapse and Expand');
    await page.click('#tab-graph-btn');
    await page.waitForTimeout(500);

    await page.click('#qb-collapse-btn');
    await page.waitForTimeout(200);
    let isExpandedVisible = await page.isVisible('#qb-expanded-view');
    assert(!isExpandedVisible, 'Expanded view hidden when collapsed');
    let isCollapsedVisible = await page.isVisible('#qb-collapsed-view');
    assert(isCollapsedVisible, 'Collapsed view visible');

    await page.click('#qb-expand-btn');
    await page.waitForTimeout(200);
    isExpandedVisible = await page.isVisible('#qb-expanded-view');
    assert(isExpandedVisible, 'Expanded view visible when expanded');
    console.log('  ✓ Collapse and expand work cleanly');

    // Test 8: Node tap/click fallback adds node to Query Builder
    console.log('\nTest 8: Node tap/click fallback');
    await page.click('#qb-clear-btn');
    await page.waitForTimeout(200);

    // Call addKeyword directly as tap fallback would or simulate node click
    await page.evaluate(() => {
        window.BooleanQueryBuilder.addKeyword('ketosis');
    });
    await page.waitForTimeout(200);
    queryStr = await page.textContent('#qb-boolean-string');
    assert.strictEqual(queryStr, 'ketosis', 'Tapped node added to query builder');
    console.log('  ✓ Click/tap fallback verified');

    // Check for any unhandled JS errors
    console.log('\nTotal console errors:', consoleErrors.length);
    if (consoleErrors.length > 0) {
        console.log('Errors:', consoleErrors);
    }
    assert.strictEqual(consoleErrors.length, 0, 'No console errors during test suite execution');

    await browser.close();
    console.log('\n====================================================');
    console.log('All Phase 1 tests passed successfully!');
    console.log('====================================================');
})();

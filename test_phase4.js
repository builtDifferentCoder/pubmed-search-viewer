const { chromium } = require('playwright');
const path = require('path');

// -----------------------------------------------------------------------------
// Mock Data for Phase 4 Suite
// -----------------------------------------------------------------------------
function getPhase4MockResponses() {
    const esearchDefaultJson = {
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

    const esummaryDefaultJson = {
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

    const efetchDefaultXml = `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2019//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_190101.dtd">
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>1001</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2022</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Default Article</ArticleTitle>
        <PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList>
      </Article>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>`;

    const longevityQ1Xml = `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2019//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_190101.dtd">
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>3001</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2023</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Caloric restriction and intermittent fasting in longevity</ArticleTitle>
        <PublicationTypeList><PublicationType>Randomized Controlled Trial</PublicationType></PublicationTypeList>
        <Abstract><AbstractText Label="CONCLUSIONS">Intermittent fasting significantly extended healthspan biomarkers.</AbstractText></Abstract>
      </Article>
      <MeshHeadingList><MeshHeading><DescriptorName>Humans</DescriptorName></MeshHeading></MeshHeadingList>
      <KeywordList><Keyword>caloric restriction</Keyword><Keyword>longevity</Keyword></KeywordList>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>`;

    return { esearchDefaultJson, esummaryDefaultJson, efetchDefaultXml, longevityQ1Xml };
}

async function runPhase4Tests() {
    console.log('=====================================================');
    console.log('Starting Phase 4 Test Suite: Search Primers Query Search');
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

    const mocks = getPhase4MockResponses();
    const esearchRequests = [];

    await page.route('**eutils.ncbi.nlm.nih.gov/**', async route => {
        const req = route.request();
        const url = req.url();

        if (url.includes('esearch.fcgi')) {
            esearchRequests.push({ url, postData: req.postData() });

            // Check if this is the zero-result test query (Longevity Q5: Sleep quality/circadian rhythm)
            if (url.includes('Sleep%20quality') || url.includes('circadian%20rhythm')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ esearchresult: { count: '0', retmax: '0', retstart: '0', idlist: [] } })
                });
                return;
            }

            // Longevity Q1 query
            if (url.includes('Caloric%20restriction') || url.includes('intermittent%20fasting')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ esearchresult: { count: '1', retmax: '1', retstart: '0', idlist: ['3001'] } })
                });
                return;
            }

            // Default esearch response
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mocks.esearchDefaultJson)
            });
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

            if (idParam.includes('3001')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ result: { uids: ['3001'], '3001': { uid: '3001', pmcrefcount: 42 } } })
                });
                return;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mocks.esummaryDefaultJson)
            });
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

            if (idParam.includes('3001')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'text/xml',
                    body: mocks.longevityQ1Xml
                });
                return;
            }

            await route.fulfill({
                status: 200,
                contentType: 'text/xml',
                body: mocks.efetchDefaultXml
            });
        } else {
            await route.continue();
        }
    });

    const targetUrl = process.env.TEST_URL || 'http://localhost:4173/';
    const fileUrl = targetUrl;
    console.log(`Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
    await page.waitForTimeout(500);

    // =========================================================================
    // TEST 4.1: Button Exists Once Per Query (10 Total Across Both Topics)
    // =========================================================================
    console.log('\n--- TEST 4.1: Verify [Search] button count across both topics ---');

    // Topic 1: Men's Health
    await page.goto(fileUrl + '#/primers/mens-health');
    await page.waitForSelector('#primer-detail-page', { state: 'visible', timeout: 15000 });
    const mensHealthButtonsCount = await page.locator('.primer-query-search-btn').count();
    console.log(`Men's Health query [Search] buttons: ${mensHealthButtonsCount} (expected 5)`);
    if (mensHealthButtonsCount !== 5) {
        throw new Error(`Expected 5 search buttons on Men's Health, found ${mensHealthButtonsCount}`);
    }

    // Verify title attribute / tooltip
    const buttonTitle = await page.locator('.primer-query-search-btn').first().getAttribute('title');
    console.log(`Button title/tooltip: "${buttonTitle}"`);
    if (buttonTitle !== 'Run this query in Search Results') {
        throw new Error(`Expected title 'Run this query in Search Results', got '${buttonTitle}'`);
    }

    // Topic 2: Longevity
    await page.goto(fileUrl + '#/primers/longevity');
    await page.waitForSelector('#primer-detail-page', { state: 'visible', timeout: 15000 });
    const longevityButtonsCount = await page.locator('.primer-query-search-btn').count();
    console.log(`Longevity query [Search] buttons: ${longevityButtonsCount} (expected 5)`);
    if (longevityButtonsCount !== 5) {
        throw new Error(`Expected 5 search buttons on Longevity, found ${longevityButtonsCount}`);
    }

    const totalButtons = mensHealthButtonsCount + longevityButtonsCount;
    console.log(`Total [Search] buttons across both topics: ${totalButtons} (expected 10)`);
    if (totalButtons !== 10) {
        throw new Error(`Expected 10 total buttons across both primer topics, got ${totalButtons}`);
    }

    // =========================================================================
    // TEST 4.2: Accordion Open State & Double-Click Guard
    // =========================================================================
    console.log('\n--- TEST 4.2: Open Accordion & Double-Click Guard ---');

    // Open details accordion
    await page.click('#primer-detail-page details summary');
    const isAccordionOpenBefore = await page.evaluate(() => {
        return document.querySelector('#primer-detail-page details').hasAttribute('open');
    });
    console.log('Accordion is open before clicking search:', isAccordionOpenBefore);
    if (!isAccordionOpenBefore) throw new Error('Details accordion failed to open');

    // =========================================================================
    // TEST 4.3: Clicking Longevity Q1 Runs Exact String & Populates #search-input
    // =========================================================================
    console.log('\n--- TEST 4.3: Click Longevity Q1 [Search] Button ---');

    const expectedQ1String = '("Caloric restriction" OR "intermittent fasting") AND ("longevity" OR "healthspan")';
    esearchRequests.length = 0; // reset tracker

    // Target button for Q1 (data-query-index="0")
    const q1Button = page.locator('.primer-query-search-btn[data-query-index="0"]');

    // Click Longevity Q1 Search button
    await q1Button.click();

    // Verify searchInput value immediately equals the exact string
    const searchInputValue = await page.inputValue('#search-input');
    console.log('Search input value:', searchInputValue);
    if (searchInputValue !== expectedQ1String) {
        throw new Error(`Expected searchInput value "${expectedQ1String}", got "${searchInputValue}"`);
    }

    // Wait for search to complete and land on Search Results
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
    await page.waitForTimeout(500);

    // =========================================================================
    // TEST 4.4: App Ends on Search Results Tab with Matching Stored Query Card
    // =========================================================================
    console.log('\n--- TEST 4.4: Verify Landing on Search Results Tab & Card Title ---');

    const activeTab = await page.evaluate(() => window.currentActiveTab);
    const resultsViewVisible = await page.isVisible('#tab-results-view');
    const primerDetailHidden = !(await page.isVisible('#primer-detail-page'));
    const currentHash = await page.evaluate(() => window.location.hash);

    console.log(`Active tab: ${activeTab}, Results view visible: ${resultsViewVisible}, Primer detail hidden: ${primerDetailHidden}, Current Hash: "${currentHash}"`);
    if (activeTab !== 'results' || !resultsViewVisible || !primerDetailHidden) {
        throw new Error('App did not navigate cleanly to Search Results tab');
    }

    // Verify stored query in IndexedDB
    const storedQueryRecord = await page.evaluate(async (term) => {
        return await window.db.queries.where('term').equals(term).first();
    }, expectedQ1String);
    console.log('Stored query in IndexedDB:', {
        hasRecord: Boolean(storedQueryRecord),
        term: storedQueryRecord?.term,
        retrieved: storedQueryRecord?.retrieved
    });
    if (!storedQueryRecord || storedQueryRecord.term !== expectedQ1String) {
        throw new Error(`IndexedDB record mismatch for term "${expectedQ1String}"`);
    }

    // Verify card in DOM has clean text and no horizontal overflow
    const queryCardTitle = await page.locator('#queries-container section h3').first().innerText();
    console.log('Query card title in Search Results DOM:', queryCardTitle);
    if (!queryCardTitle.includes(expectedQ1String)) {
        throw new Error(`Query card title did not contain exact string: "${queryCardTitle}"`);
    }

    // Verify esearch request URL encoded the exact string
    const matchingEsearch = esearchRequests.find(r => r.url.includes(encodeURIComponent(expectedQ1String)));
    console.log('Found matching esearch request with exact encoded query string:', Boolean(matchingEsearch));
    if (!matchingEsearch) {
        throw new Error(`No esearch request found with properly encoded query string "${expectedQ1String}"`);
    }

    // =========================================================================
    // TEST 4.5: Zero-Result Edge Case (User Stays on Primer Page with Notification)
    // =========================================================================
    console.log('\n--- TEST 4.5: Zero-Result Edge Case Keeps User on Primer Page ---');

    // Return to Longevity primer page
    await page.goto(fileUrl + '#/primers/longevity');
    await page.waitForSelector('#primer-detail-page', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 15000 });

    // Open accordion again
    await page.click('#primer-detail-page details summary');
    const isAccordionOpenBeforeZeroTest = await page.evaluate(() => {
        return document.querySelector('#primer-detail-page details').hasAttribute('open');
    });
    console.log('Accordion opened for zero-result test:', isAccordionOpenBeforeZeroTest);

    // Q5: Sleep quality and circadian rhythm (mocked to return 0 hits)
    const q5Button = page.locator('.primer-query-search-btn[data-query-index="4"]');
    await q5Button.click();

    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
    await page.waitForTimeout(500);

    // Verify user is STILL on primer detail page
    const primerDetailStillVisible = await page.isVisible('#primer-detail-page');
    const resultsViewStillHidden = !(await page.isVisible('#tab-results-view'));
    const isAccordionStillOpen = await page.evaluate(() => {
        return document.querySelector('#primer-detail-page details').hasAttribute('open');
    });
    const notificationVisible = await page.isVisible('#notification-area');
    const notificationText = await page.locator('#notification-area').innerText();

    console.log('Zero-result state check:', {
        primerDetailStillVisible,
        resultsViewStillHidden,
        isAccordionStillOpen,
        notificationVisible,
        notificationText
    });

    if (!primerDetailStillVisible || !resultsViewStillHidden) {
        throw new Error('Zero-result search navigated away from primer detail page!');
    }
    if (!isAccordionStillOpen) {
        throw new Error('Accordion collapsed after clicking search button!');
    }
    if (!notificationVisible || !notificationText.includes('No articles found')) {
        throw new Error(`Expected zero-result notification, got "${notificationText}"`);
    }

    // =========================================================================
    // TEST 4.6: Browser Back Returns from Search Results to Primer Page
    // =========================================================================
    console.log('\n--- TEST 4.6: Browser Back Navigation ---');

    // Click Q1 again (success search) to go to Search Results
    await q1Button.click();
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });
    await page.waitForTimeout(500);

    console.log('Navigated to Search Results. Now pressing Browser Back...');
    await page.goBack();
    await page.waitForTimeout(800);

    const backHash = await page.evaluate(() => window.location.hash);
    const primerDetailAfterBack = await page.isVisible('#primer-detail-page');
    const tabsNavBarAfterBack = !(await page.isVisible('#tabs-nav-bar'));

    console.log(`Browser Back check: hash="${backHash}", primerDetailVisible=${primerDetailAfterBack}, tabsHidden=${tabsNavBarAfterBack}`);
    if (backHash !== '#/primers/longevity' || !primerDetailAfterBack || !tabsNavBarAfterBack) {
        throw new Error(`Browser Back navigation failed: hash=${backHash}, detail=${primerDetailAfterBack}`);
    }

    // Final console errors check
    console.log(`\nTotal console errors during Phase 4 test suite: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
        console.error('Console errors logged:', consoleErrors);
        throw new Error(`Phase 4 tests failed with ${consoleErrors.length} console error(s)`);
    }

    await browser.close();
    console.log('\n=====================================================');
    console.log('ALL PHASE 4 TESTS PASSED SUCCESSFULLY!');
    console.log('=====================================================');
}

runPhase4Tests().catch(err => {
    console.error('Phase 4 Fatal Error:', err);
    process.exit(1);
});

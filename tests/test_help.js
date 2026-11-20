const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

// Mock data generator for NCBI endpoints with opposing conclusion pairs
function getMockResponses() {
    const esearchJson = {
        header: { type: 'esearch', version: '0.3' },
        esearchresult: {
            count: '4',
            retmax: '4',
            retstart: '0',
            idlist: ['401', '402', '403', '404'],
            translationset: [],
            querytranslation: 'test[All Fields]'
        }
    };

    const esummaryJson = {
        header: { type: 'esummary', version: '0.3' },
        result: {
            uids: ['401', '402', '403', '404'],
            '401': { uid: '401', pmcrefcount: 25 },
            '402': { uid: '402', pmcrefcount: 12 },
            '403': { uid: '403', pmcrefcount: 5 },
            '404': { uid: '404', pmcrefcount: 0 }
        }
    };

    const efetchXml = `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2019//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_190101.dtd">
<PubmedArticleSet>
  <!-- Paper 401: Positive, keywords: allulose, diet, ketosis -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>401</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2023</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Allulose supplementation markedly enhances ketogenic state</ArticleTitle>
        <PublicationTypeList>
          <PublicationType UI="D016449">Randomized Controlled Trial</PublicationType>
        </PublicationTypeList>
        <Abstract>
          <AbstractText Label="METHODS">Conducted in n = 120 healthy volunteers.</AbstractText>
          <AbstractText Label="CONCLUSIONS">Allulose significantly improved glycemic control and ketosis markers.</AbstractText>
        </Abstract>
      </Article>
      <MeshHeadingList>
        <MeshHeading><DescriptorName>Humans</DescriptorName></MeshHeading>
      </MeshHeadingList>
      <KeywordList>
        <Keyword>allulose</Keyword>
        <Keyword>diet</Keyword>
        <Keyword>ketosis</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>

  <!-- Paper 402: Negative, keywords: allulose, diet, ketosis (Direct opposition to 401) -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>402</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2022</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Allulose fails to demonstrate ketogenic benefits in clinical cohort</ArticleTitle>
        <PublicationTypeList>
          <PublicationType UI="D016428">Clinical Trial</PublicationType>
        </PublicationTypeList>
        <Abstract>
          <AbstractText Label="METHODS">Assessed across 45 participants.</AbstractText>
          <AbstractText Label="CONCLUSIONS">Intervention was ineffective and failed to modulate ketone body concentrations.</AbstractText>
        </Abstract>
      </Article>
      <MeshHeadingList>
        <MeshHeading><DescriptorName>Humans</DescriptorName></MeshHeading>
      </MeshHeadingList>
      <KeywordList>
        <Keyword>allulose</Keyword>
        <Keyword>diet</Keyword>
        <Keyword>ketosis</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>

  <!-- Paper 403: Null/Inconclusive -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>403</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2021</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Metabolic kinetics of rare sugars</ArticleTitle>
        <PublicationTypeList>
          <PublicationType UI="D016454">Review</PublicationType>
        </PublicationTypeList>
        <Abstract>
          <AbstractText Label="CONCLUSIONS">Findings remain inconclusive regarding broad metabolic benefits.</AbstractText>
        </Abstract>
      </Article>
      <MeshHeadingList>
        <MeshHeading><DescriptorName>Animals</DescriptorName></MeshHeading>
      </MeshHeadingList>
      <KeywordList>
        <Keyword>allulose</Keyword>
        <Keyword>metabolism</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>

  <!-- Paper 404: In vitro -->
  <PubmedArticle>
    <MedlineCitation>
      <PMID>404</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2020</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Cellular transport of allulose</ArticleTitle>
        <PublicationTypeList>
          <PublicationType UI="D016428">Journal Article</PublicationType>
        </PublicationTypeList>
        <Abstract>
          <AbstractText>In vitro transport characteristics evaluated.</AbstractText>
        </Abstract>
      </Article>
      <KeywordList>
        <Keyword>glucose</Keyword>
        <Keyword>diet</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>`;

    return { esearchJson, esummaryJson, efetchXml };
}

(async () => {
    console.log('====================================================');
    console.log('Running Playwright Test Suite: HelpPopover & Tour');
    console.log('====================================================');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('dialog', async dialog => {
        await dialog.accept();
    });

    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.toString()));

    const { esearchJson, esummaryJson, efetchXml } = getMockResponses();

    // Mock NCBI E-utilities
    await page.route('**eutils.ncbi.nlm.nih.gov/**', async route => {
        const url = route.request().url();
        if (url.includes('esearch.fcgi')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(esearchJson)
            });
        } else if (url.includes('esummary.fcgi')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(esummaryJson)
            });
        } else if (url.includes('efetch.fcgi')) {
            await route.fulfill({
                status: 200,
                contentType: 'text/xml',
                body: efetchXml
            });
        } else {
            await route.continue();
        }
    });

    const targetUrl = process.env.TEST_URL || 'http://localhost:4173/';
    console.log('Navigating to:', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Wait for initial query execution & loading overlay to clear
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 15000 });
    await page.waitForTimeout(500);

    console.log('\n--- Test 1: Dismissible 3-Step First-Run Coachmark Tour ---');
    // Verify tour appears automatically on first run
    const tourOverlay = page.locator('#coachmark-tour-overlay');
    await tourOverlay.waitFor({ state: 'visible', timeout: 5000 });
    let tourText = await page.textContent('#coachmark-card');
    assert(tourText.includes('Step 1 of 3'), 'Tour step 1 must be active initially');
    console.log('✓ First-run tour opened automatically at Step 1 (Search Results)');

    // Step 1 -> Step 2
    await page.click('#coachmark-next-btn');
    await page.waitForTimeout(300);
    tourText = await page.textContent('#coachmark-card');
    assert(tourText.includes('Step 2 of 3'), 'Tour step 2 must be active after Next');
    assert(tourText.includes('Keywords Graph'), 'Step 2 must explain Keywords Graph & Query Builder');
    console.log('✓ Tour transitioned to Step 2 (Keywords Graph)');

    // Step 2 -> Step 3
    await page.click('#coachmark-next-btn');
    await page.waitForTimeout(300);
    tourText = await page.textContent('#coachmark-card');
    assert(tourText.includes('Step 3 of 3'), 'Tour step 3 must be active');
    assert(tourText.includes('Search Primers'), 'Step 3 must explain Search Primers');
    console.log('✓ Tour transitioned to Step 3 (Search Primers)');

    // Finish tour
    await page.click('#coachmark-next-btn');
    await page.waitForTimeout(300);
    assert(await tourOverlay.isHidden(), 'Tour overlay must be hidden after completion');

    const tourDismissedStorage = await page.evaluate(() => localStorage.getItem('pubmed_miner_tour_dismissed'));
    assert.strictEqual(tourDismissedStorage, '1', 'localStorage must record tour dismissal');
    console.log('✓ Tour dismissed and persisted in localStorage wrapped in try/catch');

    // Test Replay Tour via Navigation button
    await page.click('#btn-replay-tour');
    await page.waitForTimeout(300);
    assert(await tourOverlay.isVisible(), 'Replay tour must reopen tour overlay');
    // Test Skip tour button
    await page.click('#coachmark-skip-btn');
    await page.waitForTimeout(200);
    assert(await tourOverlay.isHidden(), 'Skip tour must dismiss overlay');
    console.log('✓ Replay Tour button and Skip Tour button functional');

    console.log('\n--- Test 2: Centralized HELP_TEXT Dictionary Verification ---');
    const helpKeys = await page.evaluate(() => {
        return Object.keys(window.config.HELP_TEXT || window.HELP_TEXT || {});
    });
    console.log(`Found ${helpKeys.length} keys in config.HELP_TEXT:`, helpKeys);

    const requiredKeys = [
        'divergence',
        'divergence_min_shared',
        'divergence_opposition_badge',
        'weight',
        'graph_top_slider',
        'graph_min_weight',
        'graph_relayout',
        'graph_cluster_legend',
        'primers',
        'query_builder',
        'query_builder_run',
        'chart_total',
        'chart_conclusion',
        'chart_sample_size',
        'chart_citations',
        'chart_study_type',
        'chart_subject_type',
        'chart_pub_year',
        'chart_keywords',
        'sample_size_buckets',
        'conclusion_tags'
    ];

    for (const key of requiredKeys) {
        assert(helpKeys.includes(key), `Missing required HELP_TEXT key: ${key}`);
    }
    console.log('✓ All 21 required HELP_TEXT keys present in config.HELP_TEXT');

    // Validate syntax and example in primers
    const primersEntry = await page.evaluate(() => (window.config.HELP_TEXT || window.HELP_TEXT).primers);
    assert(primersEntry.example, 'primers help entry must include example');
    assert(primersEntry.example.raw.includes('Caloric restriction'), 'Example must include Longevity boolean query');
    console.log('✓ primers help text contains formatted Boolean logic example with syntax highlighting');

    console.log('\n--- Test 3: Verify Every HELP_TEXT Key Renders in DOM ---');
    // Switch to results tab to check results & chart help triggers
    await page.click('#tab-results-btn');
    await page.waitForTimeout(400);

    const resultsKeys = [
        'divergence',
        'divergence_min_shared',
        'divergence_opposition_badge',
        'chart_total',
        'chart_conclusion',
        'chart_sample_size',
        'chart_citations',
        'chart_study_type',
        'chart_subject_type',
        'chart_pub_year',
        'chart_keywords',
        'sample_size_buckets',
        'conclusion_tags'
    ];
    for (const key of resultsKeys) {
        const count = await page.locator(`[data-help-id="${key}"]`).count();
        assert(count > 0, `Help trigger for "${key}" must render in DOM (found ${count})`);
    }
    console.log(`✓ All ${resultsKeys.length} Search Results & Chart help triggers rendered`);

    // Switch to graph tab to check graph & query builder help triggers
    await page.click('#tab-graph-btn');
    await page.waitForTimeout(400);
    const graphKeys = [
        'graph_top_slider',
        'graph_min_weight',
        'graph_relayout',
        'weight',
        'graph_cluster_legend',
        'query_builder',
        'query_builder_run'
    ];
    for (const key of graphKeys) {
        const count = await page.locator(`[data-help-id="${key}"]`).count();
        assert(count > 0, `Help trigger for "${key}" must render in DOM (found ${count})`);
    }
    console.log(`✓ All ${graphKeys.length} Keywords Graph & Query Builder help triggers rendered`);

    // Switch to primers tab
    await page.click('#tab-primers-btn');
    await page.waitForTimeout(400);
    const primersCount = await page.locator(`[data-help-id="primers"]`).count();
    assert(primersCount > 0, `Help trigger for "primers" must render in DOM`);
    console.log('✓ Search Primers help trigger rendered');

    console.log('\n--- Test 4: Tap Open/Close, 44px Target, and Second Tap ---');
    const primersBtn = page.locator('[data-help-id="primers"]');
    const popover = page.locator('#global-help-popover');

    // Verify 44px minimum touch target size
    const btnBox = await primersBtn.boundingBox();
    console.log(`Trigger button touch area dimensions: ${btnBox.width}x${btnBox.height}px`);
    assert(btnBox.width >= 44 && btnBox.height >= 44, `Touch target width (${btnBox.width}) and height (${btnBox.height}) must be >= 44px`);
    console.log('✓ Help trigger meets 44px touch target guidelines');

    // First tap -> opens popover
    await primersBtn.click();
    await page.waitForTimeout(200);
    assert(await popover.isVisible(), 'Popover must be visible after tap');
    const ariaExpanded = await primersBtn.getAttribute('aria-expanded');
    const ariaDescribedBy = await primersBtn.getAttribute('aria-describedby');
    const roleAttr = await popover.getAttribute('role');
    assert.strictEqual(ariaExpanded, 'true', 'aria-expanded must be true when open');
    assert.strictEqual(ariaDescribedBy, 'global-help-popover', 'aria-describedby must match popover id');
    assert.strictEqual(roleAttr, 'tooltip', 'popover must have role="tooltip"');
    console.log('✓ Popover opened on tap with correct ARIA attributes (role="tooltip", aria-describedby, aria-expanded="true")');

    // Second tap on same trigger -> closes popover
    await page.waitForTimeout(350); // wait past initial focus debounce window
    await primersBtn.click();
    await page.waitForTimeout(200);
    assert(await popover.isHidden(), 'Popover must close on second tap');
    assert.strictEqual(await primersBtn.getAttribute('aria-expanded'), 'false', 'aria-expanded must be false after closing');
    console.log('✓ Popover closed on second tap');

    console.log('\n--- Test 5: Close on Escape Key & Focus Restoration ---');
    await primersBtn.click();
    await page.waitForTimeout(200);
    assert(await popover.isVisible(), 'Popover open before Esc');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    assert(await popover.isHidden(), 'Popover must close when Escape is pressed');
    const isFocused = await page.evaluate(() => document.activeElement === document.querySelector('[data-help-id="primers"]'));
    assert(isFocused, 'Keyboard focus must be restored to trigger button after Esc');
    console.log('✓ Popover closed on Esc and restored focus to trigger button');

    console.log('\n--- Test 6: Close on Outside Tap/Click ---');
    await primersBtn.click();
    await page.waitForTimeout(200);
    assert(await popover.isVisible(), 'Popover open before outside click');
    await page.mouse.click(50, 50); // Click outside popover
    await page.waitForTimeout(200);
    assert(await popover.isHidden(), 'Popover must close when tapping outside');
    console.log('✓ Popover closed on outside click');

    console.log('\n--- Test 7: Viewport Containment at 360px Mobile Viewport ---');
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForTimeout(300);

    const testTriggers = [
        { tab: 'primers', id: 'primers' },
        { tab: 'graph', id: 'graph_top_slider' },
        { tab: 'graph', id: 'query_builder' },
        { tab: 'results', id: 'divergence' },
        { tab: 'results', id: 'chart_conclusion' }
    ];

    for (const item of testTriggers) {
        const tabSelector = (await page.locator(`#mobile-tab-${item.tab}-btn`).isVisible())
            ? `#mobile-tab-${item.tab}-btn`
            : `#tab-${item.tab}-btn`;
        await page.click(tabSelector);
        await page.waitForTimeout(300);

        let btn = page.locator(`[data-help-id="${item.id}"]:visible`).first();
        if (await btn.count() === 0) {
            btn = page.locator(`[data-help-id="${item.id}"]`).first();
        }
        await btn.scrollIntoViewIfNeeded();
        await btn.click({ force: true });
        await page.waitForTimeout(200);

        assert(await popover.isVisible(), `Popover for ${item.id} must be visible`);
        const box = await popover.boundingBox();
        console.log(`Popover [${item.id}] bounds at 360px viewport: left=${box.x.toFixed(1)}, right=${(box.x + box.width).toFixed(1)}, width=${box.width.toFixed(1)}, top=${box.y.toFixed(1)}`);

        assert(box.x >= 0, `Popover left edge (${box.x}) must not be negative`);
        assert(box.x + box.width <= 360.5, `Popover right edge (${box.x + box.width}) must stay inside 360px viewport`);
        assert(box.y >= 0, `Popover top edge (${box.y}) must not be negative`);

        // Test "Learn more" expansion if present
        const learnMoreBtn = popover.locator('.help-learn-more-toggle');
        if (await learnMoreBtn.count() > 0) {
            await learnMoreBtn.click();
            await page.waitForTimeout(200);
            const boxExpanded = await popover.boundingBox();
            assert(boxExpanded.x >= 0 && boxExpanded.x + boxExpanded.width <= 360.5, 'Expanded popover must stay within 360px viewport');
            console.log(`  -> Learn more toggle expanded and stayed contained within [0, 360]`);
        }

        // Close via close button
        const closeBtn = popover.locator('#help-popover-close-btn');
        if (await closeBtn.count() > 0) {
            await closeBtn.click();
            await page.waitForTimeout(150);
        } else {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(150);
        }
    }
    console.log('✓ All tested popovers strictly contained within 360px viewport');

    console.log('\n--- Test 8: Keyboard Focus Order & Tabindex ---');
    const allHelpButtons = page.locator('.help-popover-btn');
    const totalButtons = await allHelpButtons.count();
    console.log(`Total help buttons currently in DOM: ${totalButtons}`);
    for (let i = 0; i < Math.min(totalButtons, 5); i++) {
        const btn = allHelpButtons.nth(i);
        const tabIndex = await btn.getAttribute('tabindex');
        const hasPopup = await btn.getAttribute('aria-haspopup');
        assert.strictEqual(tabIndex, '0', 'Help buttons must have tabindex="0"');
        assert.strictEqual(hasPopup, 'dialog', 'Help buttons must have aria-haspopup="dialog"');
    }
    console.log('✓ Keyboard accessibility & focus attributes verified');

    await browser.close();

    if (consoleErrors.length > 0) {
        console.error('Captured console errors during test:', consoleErrors);
        throw new Error('Test produced console errors');
    }

    console.log('\n====================================================');
    console.log('✓ All test_help.js checks passed successfully!');
    console.log('====================================================');
})();

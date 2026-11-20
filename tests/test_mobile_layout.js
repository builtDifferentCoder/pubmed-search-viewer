const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Generate 50 mock articles for testing mobile layout, paged bottom sheet, and 50-article smooth scroll
function getMockResponses(count = 50) {
    const idlist = Array.from({ length: count }, (_, i) => String(1000 + i + 1));
    const esearchJson = {
        header: { type: 'esearch', version: '0.3' },
        esearchresult: {
            count: String(count),
            retmax: String(count),
            retstart: '0',
            idlist: idlist,
            translationset: [],
            querytranslation: 'mobile test[All Fields]'
        }
    };

    const result = { uids: idlist };
    idlist.forEach((id, idx) => {
        result[id] = { uid: id, pmcrefcount: (idx * 3) % 45 };
    });
    const esummaryJson = {
        header: { type: 'esummary', version: '0.3' },
        result
    };

    const studyTypes = ['Randomized Controlled Trial', 'Clinical Trial', 'Review', 'Meta-Analysis', 'Journal Article'];
    const conclusions = [
        { label: 'CONCLUSIONS', type: 'Positive', text: 'Significant benefit observed in metabolic parameters.' },
        { label: 'CONCLUSION', type: 'Negative', text: 'No significant divergence in markers across cohorts.' },
        { label: 'CONCLUSIONS', type: 'Neutral', text: 'Comparable outcomes between baseline and intervention.' },
        { label: 'ABSTRACT', type: 'None', text: 'General observation of molecular kinetics in vivo.' }
    ];

    const efetchXml = `<?xml version="1.0" encoding="UTF-8" ?>
<PubmedArticleSet>
  ${idlist.map((id, idx) => {
      const conc = conclusions[idx % conclusions.length];
      const sType = studyTypes[idx % studyTypes.length];
      const year = 2018 + (idx % 7);
      const isHuman = (idx % 2 === 0);
      const sampleSize = 20 + (idx * 5);
      return `
      <PubmedArticle>
        <MedlineCitation>
          <PMID>${id}</PMID>
          <Article>
            <Journal><JournalIssue><PubDate><Year>${year}</Year></PubDate></JournalIssue></Journal>
            <ArticleTitle>Biomedical Evaluation Study ${id}: Therapeutic Impact in Clinical Cohort</ArticleTitle>
            <PublicationTypeList>
              <PublicationType UI="D016449">${sType}</PublicationType>
            </PublicationTypeList>
            <Abstract>
              <AbstractText Label="METHODS">Conducted with n = ${sampleSize} participants.</AbstractText>
              <AbstractText Label="${conc.label}">${conc.text}</AbstractText>
            </Abstract>
          </Article>
          <MeshHeadingList>
            <MeshHeading><DescriptorName>${isHuman ? 'Humans' : 'Animals'}</DescriptorName></MeshHeading>
          </MeshHeadingList>
          <KeywordList>
            <Keyword>longevity</Keyword>
            <Keyword>${idx % 2 === 0 ? 'metabolism' : 'biomarkers'}</Keyword>
            <Keyword>clinical</Keyword>
          </KeywordList>
        </MedlineCitation>
      </PubmedArticle>`;
  }).join('')}
</PubmedArticleSet>`;

    return { esearchJson, esummaryJson, efetchXml };
}

(async () => {
    console.log('================================================================');
    console.log('Running Mobile Layout Test Suite: Accordions, Carousels & Sheets');
    console.log('================================================================');

    const screenshotDir = path.resolve(__dirname, '../docs/screens');
    fs.mkdirSync(screenshotDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('dialog', async dialog => {
        await dialog.accept();
    });

    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.toString()));

    const { esearchJson, esummaryJson, efetchXml } = getMockResponses(50);

    // Mock NCBI API routes
    await page.route('**/esearch.fcgi*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(esearchJson)
        });
    });

    await page.route('**/esummary.fcgi*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(esummaryJson)
        });
    });

    await page.route('**/efetch.fcgi*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'text/xml',
            body: efetchXml
        });
    });

    const TEST_URL = process.env.TEST_URL || 'http://localhost:4173/';

    // -------------------------------------------------------------
    // PART 1: Desktop Viewport (1280x800) Baseline Verification
    // -------------------------------------------------------------
    console.log('\n--- Part 1: Desktop Viewport (1280x800) Verification ---');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(TEST_URL, { waitUntil: 'networkidle' });

    // Dismiss coachmark if open
    await page.evaluate(() => {
        if (window.dismissCoachmarkTour) window.dismissCoachmarkTour();
    });
    await page.waitForTimeout(300);

    // Wait for the query card to render in results
    const cardSelector = '#queries-container section';
    await page.waitForSelector(cardSelector, { timeout: 15000 });
    const card = page.locator(cardSelector).first();
    const cardId = await card.getAttribute('id');
    const qId = cardId.replace('query-card-', '');
    console.log(`  -> Operating on Query Card: #${cardId} (queryId=${qId})`);

    // Desktop assertions
    const desktopTabsVisible = await page.locator('#tabs-nav-bar').isVisible();
    assert(desktopTabsVisible, 'Top navigation tabs must be visible on desktop viewport');

    const mobileBottomNavHidden = await page.locator('#mobile-bottom-nav').isHidden();
    assert(mobileBottomNavHidden, 'Mobile sticky bottom nav must be hidden on desktop viewport');

    const desktopCharts = card.locator('.desktop-charts');
    assert(await desktopCharts.isVisible(), 'Desktop 3-row charts grid must be visible on desktop viewport');

    const mobileCharts = card.locator('.mobile-charts');
    assert(await mobileCharts.isHidden(), 'Mobile accordions view must be hidden on desktop viewport');

    // Desktop chart canvas click behavior (opens inline .detail table)
    const desktopCanvas = card.locator(`#canvas-${qId}-1`);
    assert(await desktopCanvas.isVisible(), `Desktop canvas #canvas-${qId}-1 must be visible`);
    await desktopCanvas.scrollIntoViewIfNeeded();

    await page.evaluate(async (queryId) => {
        const canvas = document.querySelector(`#canvas-${queryId}-1`);
        const chart = (window.activeCharts || []).find(c => c.canvas === canvas);
        if (chart && chart.options && chart.options.onClick) {
            await chart.options.onClick({ native: { target: canvas } }, [{ index: 0 }]);
        }
    }, qId);
    await page.waitForTimeout(500);

    const inlineDetail = card.locator('.detail');
    assert(await inlineDetail.isVisible(), 'Desktop bar click must open inline .detail table');
    console.log('  -> Desktop layout and inline detail table verified.');

    // Save desktop screenshot
    const desktopScreenshotPath = path.join(screenshotDir, 'desktop_unchanged.png');
    await page.screenshot({ path: desktopScreenshotPath, fullPage: false });
    console.log(`  -> Desktop screenshot saved: ${desktopScreenshotPath}`);

    // -------------------------------------------------------------
    // PART 2: Mobile Viewport (360x640) Verification
    // -------------------------------------------------------------
    console.log('\n--- Part 2: Mobile Viewport (360x640) Verification ---');
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForTimeout(400);

    // Verify top tabs hidden & mobile bottom nav visible
    assert(await page.locator('#tabs-nav-bar').isHidden(), 'Top navigation tabs must be hidden on mobile 360px');
    assert(await page.locator('#mobile-bottom-nav').isVisible(), 'Mobile sticky bottom nav must be visible on mobile 360px');

    // Test sticky bottom tab switching
    console.log('  Testing mobile sticky bottom nav tabs...');
    await page.click('#mobile-tab-graph-btn');
    await page.waitForTimeout(300);
    assert(await page.locator('#tab-graph-view').isVisible(), 'Mobile bottom nav must switch to Keywords Graph tab');

    await page.click('#mobile-tab-primers-btn');
    await page.waitForTimeout(300);
    assert(await page.locator('#tab-primers-view').isVisible(), 'Mobile bottom nav must switch to Search Primers tab');

    await page.click('#mobile-tab-results-btn');
    await page.waitForTimeout(300);
    assert(await page.locator('#tab-results-view').isVisible(), 'Mobile bottom nav must switch back to Search Results tab');
    console.log('  -> Mobile sticky tab navigation verified.');

    // Card Mobile Header: Overflow Menu
    console.log('  Testing mobile overflow menu...');
    const overflowBtn = card.locator('.overflow-menu-btn');
    assert(await overflowBtn.isVisible(), 'Mobile overflow menu button must be visible');
    await overflowBtn.click();
    await page.waitForTimeout(200);

    const overflowDropdown = card.locator('.overflow-dropdown');
    assert(await overflowDropdown.isVisible(), 'Overflow dropdown must open on tap');

    const rerunBtn = card.locator('.overflow-action-rerun');
    assert(await rerunBtn.isVisible(), 'Re-run Search action must be present');

    const shareBtn = card.locator('.overflow-action-share');
    assert(await shareBtn.isDisabled(), 'Share* action must be disabled');

    const exportBtn = card.locator('.overflow-action-export');
    assert(await exportBtn.isDisabled(), 'Export* action must be disabled');

    // Close dropdown on outside tap
    await card.locator('h3').click();
    await page.waitForTimeout(200);
    assert(await overflowDropdown.isHidden(), 'Overflow dropdown must close on outside tap');
    console.log('  -> Mobile overflow menu verified.');

    // Three Collapsible Accordions in exact order
    console.log('  Testing 3 collapsible accordions in order...');
    const accordions = card.locator('.mobile-accordion');
    assert.strictEqual(await accordions.count(), 3, 'Must render exactly 3 mobile accordions');

    const acc1 = accordions.nth(0);
    const acc2 = accordions.nth(1);
    const acc3 = accordions.nth(2);

    assert.strictEqual(await acc1.getAttribute('data-accordion-id'), 'articles', 'Accordion 1 must be articles');
    assert.strictEqual(await acc2.getAttribute('data-accordion-id'), 'impact', 'Accordion 2 must be impact');
    assert.strictEqual(await acc3.getAttribute('data-accordion-id'), 'keywords', 'Accordion 3 must be keywords');

    // Check titles
    const text1 = await acc1.innerText();
    const text2 = await acc2.innerText();
    const text3 = await acc3.innerText();
    assert(text1.includes('Articles & Conclusions'), 'Accordion 1 title must contain "Articles & Conclusions"');
    assert(text2.includes('Impact & Design'), 'Accordion 2 title must contain "Impact & Design"');
    assert(text3.includes('Keywords'), 'Accordion 3 title must contain "Keywords"');

    // Check default open state: 1 open, 2 and 3 closed
    assert(await acc1.locator('.accordion-content').isVisible(), 'Accordion 1 must be open by default');
    assert(await acc2.locator('.accordion-content').isHidden(), 'Accordion 2 must be collapsed by default');
    assert(await acc3.locator('.accordion-content').isHidden(), 'Accordion 3 must be collapsed by default');

    // Check summaries
    assert(text1.includes('articles'), 'Accordion 1 summary must mention articles');
    assert(text2.includes('citations'), 'Accordion 2 summary must mention citations');
    assert(text3.includes('keywords'), 'Accordion 3 summary must mention keywords');
    console.log('  -> Accordion titles, order, summaries, and default open state verified.');

    // Test Accordion Persistence in localStorage across reload
    console.log('  Testing accordion open/close persistence across reload...');
    // Open accordion 2 (impact), close accordion 1 (articles)
    await acc2.locator('.accordion-header').click();
    await page.waitForTimeout(200);
    await acc1.locator('.accordion-header').click();
    await page.waitForTimeout(200);

    assert(await acc1.locator('.accordion-content').isHidden(), 'Accordion 1 should now be closed');
    assert(await acc2.locator('.accordion-content').isVisible(), 'Accordion 2 should now be open');

    // Check localStorage
    const savedState = await page.evaluate((queryId) => localStorage.getItem(`pubmed_miner_accordion_${queryId}`), qId);
    console.log(`  Saved localStorage state: ${savedState}`);
    assert(savedState && savedState.includes('impact'), 'localStorage must persist that impact accordion is open');

    // Reload page to verify persistence
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const reloadedCard = page.locator('#' + cardId);
    const reloadedAcc1 = reloadedCard.locator('.mobile-accordion[data-accordion-id="articles"]');
    const reloadedAcc2 = reloadedCard.locator('.mobile-accordion[data-accordion-id="impact"]');
    assert(await reloadedAcc1.locator('.accordion-content').isHidden(), 'Accordion 1 must remain closed after page reload');
    assert(await reloadedAcc2.locator('.accordion-content').isVisible(), 'Accordion 2 must remain open after page reload');
    console.log('  -> Accordion persistence across reload verified.');

    // Reopen Accordion 1 for carousel & chart checks
    await reloadedAcc1.locator('.accordion-header').click();
    await page.waitForTimeout(300);

    // Horizontal Scroll-Snap Carousel verification
    console.log('  Testing carousel scroll-snap & dot indicators...');
    const track = reloadedAcc1.locator('.carousel-track');
    assert(await track.isVisible(), 'Carousel track must be visible inside accordion 1');

    const slides = reloadedAcc1.locator('.carousel-slide');
    assert.strictEqual(await slides.count(), 3, 'Accordion 1 carousel must contain 3 slides (Charts 0, 1, 2)');

    const dots = reloadedAcc1.locator('.carousel-dot');
    assert.strictEqual(await dots.count(), 3, 'Accordion 1 must render 3 carousel dot indicators');

    // Test carousel dot click navigation
    const initialScroll = await track.evaluate(el => el.scrollLeft);
    await dots.nth(1).click();
    await page.waitForTimeout(400);
    const nextScroll = await track.evaluate(el => el.scrollLeft);
    assert(nextScroll > initialScroll, `Tapping dot 2 must scroll the carousel (initial=${initialScroll}, next=${nextScroll})`);
    console.log('  -> Carousel scroll-snap and dot indicators verified.');

    // Accessibility: aria-label and "View as table" toggle
    console.log('  Testing accessibility: aria-label & "View as table" toggle...');
    const canvasM1 = reloadedAcc1.locator(`#canvas-m-${qId}-1`);
    const ariaLabel = await canvasM1.getAttribute('aria-label');
    assert(ariaLabel && ariaLabel.length > 5, 'Canvas must have a descriptive aria-label');
    assert.strictEqual(await canvasM1.getAttribute('role'), 'img', 'Canvas must have role="img"');

    const slide1 = slides.nth(1);
    const tableBtn = slide1.locator('.view-as-table-btn');
    assert(await tableBtn.isVisible(), '"View as table" button must be visible');
    assert.strictEqual(await tableBtn.getAttribute('aria-expanded'), 'false', 'aria-expanded must be false initially');

    // Click "View as table"
    await tableBtn.click();
    await page.waitForTimeout(200);

    const tableWrapper = slide1.locator('.chart-table-wrapper');
    assert(await tableWrapper.isVisible(), 'Accessible data table must become visible');
    assert(await slide1.locator('.chart-canvas-wrapper').isHidden(), 'Chart canvas wrapper must become hidden');
    assert.strictEqual(await tableBtn.getAttribute('aria-expanded'), 'true', 'aria-expanded must flip to true');

    // Check table headers and content
    const tableHtml = await tableWrapper.innerHTML();
    assert(tableHtml.includes('Category') && tableHtml.includes('Count') && tableHtml.includes('%'), 'Accessible table must include Category, Count, and % headers');

    // Click again to toggle back to chart
    await tableBtn.click();
    await page.waitForTimeout(200);
    assert(await slide1.locator('.chart-canvas-wrapper').isVisible(), 'Chart canvas wrapper must become visible again');
    assert(await tableWrapper.isHidden(), 'Accessible data table must be hidden again');
    console.log('  -> Accessibility: aria-label and "View as table" toggle verified.');

    // Bar Tap -> Slide-Up Bottom Sheet
    console.log('  Testing mobile bar tap -> Slide-up Bottom Sheet...');
    const sheetBackdrop = page.locator('#mobile-bottom-sheet-backdrop');
    const sheetBody = page.locator('#bottom-sheet-body');
    const sheetCloseBtn = page.locator('#bottom-sheet-close-btn');

    assert(await sheetBackdrop.isHidden(), 'Bottom sheet backdrop must be hidden initially');

    // Trigger mobile bar tap on canvas-m-${qId}-1 -> Opens Slide-up Bottom Sheet
    await page.evaluate(async (queryId) => {
        const canvas = document.querySelector(`#canvas-m-${queryId}-1`);
        const chart = (window.activeCharts || []).find(c => c.canvas === canvas);
        if (chart && chart.options && chart.options.onClick) {
            await chart.options.onClick({ native: { target: canvas } }, [{ index: 0 }]);
        }
    }, qId);
    await page.waitForTimeout(600);

    assert(await sheetBackdrop.isVisible(), 'Bottom sheet must be visible after bar tap');
    assert(await sheetBody.isVisible(), 'Bottom sheet body must be visible');

    // Paged articles verification (5 per page)
    const sheetArticles = sheetBody.locator('> div');
    const articleCountOnPage = await sheetArticles.count();
    console.log(`  Articles displayed on bottom sheet page 1: ${articleCountOnPage}`);
    assert(articleCountOnPage > 0 && articleCountOnPage <= 5, 'Bottom sheet must display at most 5 articles per page');

    // Pagination buttons
    const nextBtn = page.locator('#bottom-sheet-next-btn');
    const prevBtn = page.locator('#bottom-sheet-prev-btn');
    const pageInfo = page.locator('#bottom-sheet-page-info');

    const infoText = await pageInfo.innerText();
    console.log(`  Pagination info: ${infoText}`);
    assert(infoText.includes('Page 1 of'), 'Pagination info must show page 1');
    assert(await prevBtn.isDisabled(), 'Previous button must be disabled on page 1');

    if (!await nextBtn.isDisabled()) {
        await nextBtn.click();
        await page.waitForTimeout(300);
        const infoTextPage2 = await pageInfo.innerText();
        assert(infoTextPage2.includes('Page 2 of'), 'Pagination info must update to Page 2');
        console.log('  -> Pagination to next page verified.');
    }

    // Save mobile bottom sheet screenshot
    const mobileSheetScreenshotPath = path.join(screenshotDir, 'mobile_360_bottom_sheet.png');
    await page.screenshot({ path: mobileSheetScreenshotPath, fullPage: false });
    console.log(`  -> Mobile 360 bottom sheet screenshot saved: ${mobileSheetScreenshotPath}`);

    // Close bottom sheet
    await sheetCloseBtn.click();
    await page.waitForTimeout(300);
    assert(await sheetBackdrop.isHidden(), 'Bottom sheet must close when close button is clicked');
    console.log('  -> Bottom sheet open, paging, and close verified.');

    // Save mobile 360 accordions screenshot
    const mobile360ScreenshotPath = path.join(screenshotDir, 'mobile_360_accordions.png');
    await page.screenshot({ path: mobile360ScreenshotPath, fullPage: false });
    console.log(`  -> Mobile 360 accordions screenshot saved: ${mobile360ScreenshotPath}`);

    // -------------------------------------------------------------
    // PART 3: Mobile Viewport (390x844) & 50 Articles Scroll Performance
    // -------------------------------------------------------------
    console.log('\n--- Part 3: Mobile Viewport (390x844) & Scroll Performance ---');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);

    // Save mobile 390 accordions screenshot
    const mobile390ScreenshotPath = path.join(screenshotDir, 'mobile_390_accordions.png');
    await page.screenshot({ path: mobile390ScreenshotPath, fullPage: false });
    console.log(`  -> Mobile 390 screenshot saved: ${mobile390ScreenshotPath}`);

    // Measure frame times during smooth scroll with 50 articles
    console.log('  Measuring scroll smoothness with 50 articles...');
    const frameStats = await page.evaluate(async () => {
        return new Promise(resolve => {
            const frameDurations = [];
            let lastTime = performance.now();
            let isScrolling = true;

            function checkFrame(currentTime) {
                const delta = currentTime - lastTime;
                lastTime = currentTime;
                frameDurations.push(delta);
                if (isScrolling) {
                    requestAnimationFrame(checkFrame);
                } else {
                    // Compute statistics (skip first frame warmup)
                    const frames = frameDurations.slice(2);
                    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
                    const max = Math.max(...frames);
                    const min = Math.min(...frames);
                    const fps = 1000 / avg;
                    resolve({ totalFrames: frames.length, avgFrameTimeMs: avg, maxFrameTimeMs: max, minFrameTimeMs: min, estimatedFps: fps });
                }
            }

            requestAnimationFrame(checkFrame);

            // Programmatically scroll down and back up
            let scrollY = 0;
            const interval = setInterval(() => {
                scrollY += 40;
                window.scrollTo(0, scrollY);
                if (scrollY >= 1200) {
                    clearInterval(interval);
                    setTimeout(() => {
                        isScrolling = false;
                    }, 200);
                }
            }, 16);
        });
    });

    console.log(`  Scroll Frame Metrics:`);
    console.log(`    Total Frames Sampled: ${frameStats.totalFrames}`);
    console.log(`    Average Frame Time:   ${frameStats.avgFrameTimeMs.toFixed(2)} ms`);
    console.log(`    Min / Max Frame Time: ${frameStats.minFrameTimeMs.toFixed(2)} ms / ${frameStats.maxFrameTimeMs.toFixed(2)} ms`);
    console.log(`    Estimated FPS:        ${frameStats.estimatedFps.toFixed(1)} fps`);

    assert(frameStats.avgFrameTimeMs < 33.3, `Average frame time (${frameStats.avgFrameTimeMs.toFixed(2)} ms) must be < 33.3 ms (>= 30 fps) for smooth scrolling`);
    console.log('  -> Smooth scroll performance verified (< 33.3 ms average frame time).');

    // Verify console errors
    if (consoleErrors.length > 0) {
        console.warn('Console page errors detected during test:');
        consoleErrors.forEach(err => console.warn('  ', err));
    }
    assert.strictEqual(consoleErrors.length, 0, 'There should be zero uncaught JavaScript page errors');

    await browser.close();
    console.log('\n================================================================');
    console.log('All Mobile Layout & Responsive Tests PASSED 100%!');
    console.log('================================================================\n');
})();

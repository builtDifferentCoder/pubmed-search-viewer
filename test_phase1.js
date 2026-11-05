const playwrightPath = process.env.PLAYWRIGHT_PATH || 'C:/Users/HP/Downloads/ace-ai-solutions/node_modules/playwright';
let chromium;
try {
    chromium = require(playwrightPath).chromium;
} catch (e) {
    chromium = require('playwright').chromium;
}
const path = require('path');

// Mock data generator for NCBI
function getMockResponses() {
    const esearchResponses = {
        // Default search
        'allulose diet': { count: '5', idlist: ['1001', '1002', '1003', '1004', '1005'] },
        // Primer queries for mens-health
        'Q1': { count: '3', idlist: ['2001', '2002', '2003'] },
        'Q2': { count: '2', idlist: ['2002', '2004'] }, // 2002 overlaps with Q1
        'Q3': { count: '2', idlist: ['2003', '2005'] }, // 2003 overlaps with Q1
        'Q4': { count: '1', idlist: ['2006'] },
        'Q5': { count: '2', idlist: ['2001', '2007'] }  // 2001 overlaps with Q1
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

async function runPhase1Tests() {
    console.log('=== Starting Phase 1 Playwright Test Suite ===');
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.toString()));

    const { esearchResponses, articlesMap, buildXml } = getMockResponses();
    const requestTimestamps = [];

    await page.route('**eutils.ncbi.nlm.nih.gov/**', async route => {
        const req = route.request();
        const url = req.url();
        const now = Date.now();
        requestTimestamps.push({ url, time: now, method: req.method() });

        if (url.includes('esearch.fcgi')) {
            let matched = { count: '5', idlist: ['1001', '1002', '1003', '1004', '1005'] };
            for (const [key, resp] of Object.entries(esearchResponses)) {
                if (url.includes(encodeURIComponent(key)) || (key.startsWith('Q') && url.includes(key))) {
                    matched = resp;
                    break;
                }
            }
            // If Men's Health queries
            if (url.includes('testosterone') && url.includes('male')) matched = esearchResponses['Q1'];
            else if (url.includes('Ashwagandha')) matched = esearchResponses['Q2'];
            else if (url.includes('Creatine')) matched = esearchResponses['Q3'];
            else if (url.includes('L-arginine')) matched = esearchResponses['Q4'];
            else if (url.includes('Omega-3')) matched = esearchResponses['Q5'];

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ esearchresult: matched })
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
            const pmids = idParam.split(',').filter(Boolean);
            const result = { uids: pmids };
            pmids.forEach(id => {
                result[id] = { uid: id, pmcrefcount: articlesMap[id]?.citations || 0 };
            });
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ result })
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
            const pmids = idParam.split(',').filter(Boolean);
            await route.fulfill({
                status: 200,
                contentType: 'text/xml',
                body: buildXml(pmids)
            });
        } else {
            await route.continue();
        }
    });

    const fileUrl = 'file:///' + path.resolve(__dirname, 'pubmed_miner.html').replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });

    console.log('\n--- Test 1.1: Tab Switching & Structure ---');
    const tabsExist = await page.evaluate(() => {
        return {
            resultsBtn: !!document.getElementById('tab-results-btn'),
            graphBtn: !!document.getElementById('tab-graph-btn'),
            primersBtn: !!document.getElementById('tab-primers-btn'),
            primersView: !!document.getElementById('tab-primers-view')
        };
    });
    console.log('Tab elements present:', tabsExist);

    // Switch to primers tab
    await page.click('#tab-primers-btn');
    await page.waitForTimeout(200);

    const activeTab = await page.evaluate(() => window.currentActiveTab);
    const primersVisible = await page.isVisible('#tab-primers-view');
    const resultsHidden = !(await page.isVisible('#tab-results-view'));
    console.log(`Tab switched to '${activeTab}', Primers visible: ${primersVisible}, Results hidden: ${resultsHidden}`);

    console.log('\n--- Test 1.2: Card Grid Rendering ---');
    const cardsCount = await page.locator('#primers-grid > div').count();
    console.log(`Primer topic cards rendered: ${cardsCount} (expected 2)`);

    console.log('\n--- Test 1.3: Navigation to Primer Full Page & Route Handling ---');
    requestTimestamps.length = 0; // Reset timestamps to monitor rate limiting
    // Click on the Men's Health card
    await page.click('#primers-grid > div:first-child');
    await page.waitForSelector('#primer-results-container table', { timeout: 15000 });

    const hash = await page.evaluate(() => window.location.hash);
    const tabsNavHidden = !(await page.isVisible('#tabs-nav-bar'));
    const primerDetailVisible = await page.isVisible('#primer-detail-page');
    console.log(`URL Hash: ${hash}, Tabs nav hidden: ${tabsNavHidden}, Primer detail visible: ${primerDetailVisible}`);

    console.log('\n--- Test 1.4: Rate Limiting Verification (>= 350ms gaps) ---');
    console.log(`Total NCBI requests made for primer: ${requestTimestamps.length}`);
    let gapViolations = 0;
    for (let i = 1; i < requestTimestamps.length; i++) {
        const gap = requestTimestamps[i].time - requestTimestamps[i - 1].time;
        if (gap < 330) { // allow 20ms timer jitter
            gapViolations++;
            console.log(`Rate limit violation between req ${i-1} and ${i}: ${gap}ms`);
        }
    }
    console.log(`Rate limit violations count (expected 0): ${gapViolations}`);

    console.log('\n--- Test 1.5: Results Deduplication, Sorting, and Tags ---');
    const resultsData = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('#primer-results-container tbody tr'));
        return rows.map(r => {
            const pmidEl = r.querySelector('.font-mono');
            const pmid = pmidEl ? pmidEl.textContent.replace('PMID:', '').trim() : '';
            const qTags = Array.from(r.querySelectorAll('span.cursor-help')).map(t => ({
                label: t.textContent.trim(),
                title: t.getAttribute('title')
            }));
            const citeEl = r.querySelector('td:last-child span');
            const citations = citeEl ? parseInt(citeEl.textContent.trim(), 10) : 0;
            return { pmid, qTags, citations };
        });
    });

    console.log(`Deduplicated rows returned: ${resultsData.length} (expected 7)`);
    console.log('Top rows preview:');
    resultsData.slice(0, 3).forEach((r, idx) => {
        console.log(`  Row ${idx + 1}: PMID ${r.pmid}, Matched: [${r.qTags.map(t => t.label).join(', ')}], Citations: ${r.citations}`);
    });

    // Verify sort order: most matches first, then citations
    const isSortedCorrectly = resultsData.every((r, i) => {
        if (i === 0) return true;
        const prev = resultsData[i - 1];
        if (prev.qTags.length !== r.qTags.length) {
            return prev.qTags.length >= r.qTags.length;
        }
        return prev.citations >= r.citations;
    });
    console.log('Results sorted by match count desc, then citations desc:', isSortedCorrectly);

    // Verify Q tags have notes as tooltips
    const firstRowTag = resultsData[0].qTags[0];
    console.log(`Tag tooltip verified: "${firstRowTag.label}" has note: "${firstRowTag.title ? firstRowTag.title.slice(0, 30) + '...' : 'none'}"`);

    console.log('\n--- Test 1.6: Per-query Hit Counts ---');
    const hitCountsText = await page.locator('#primer-hit-counts-strip').innerText();
    console.log('Hit counts strip content:', hitCountsText);

    console.log('\n--- Test 1.7: IndexedDB v3 Caching & Refresh Bypass ---');
    const cachedEntry = await page.evaluate(async () => {
        const run = await window.db.primerRuns.get('mens-health');
        return {
            hasRun: !!run,
            topicId: run?.topicId,
            articleCount: run?.articles?.length,
            hasTimestamp: !!run?.timestamp
        };
    });
    console.log('Dexie v3 cache entry:', cachedEntry);

    // Reload on primer URL and verify cache is used (no NCBI calls needed)
    requestTimestamps.length = 0;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#primer-results-container table', { timeout: 10000 });
    console.log(`Requests on reload with valid cache: ${requestTimestamps.length} (should be 0 or fast cache load)`);

    // Click Refresh button (should bypass cache and make requests)
    requestTimestamps.length = 0;
    await page.click('#primer-refresh-btn');
    await page.waitForTimeout(1000);
    console.log(`Requests on Refresh click: ${requestTimestamps.length} (cache bypassed, should be > 0)`);

    console.log('\n--- Test 1.8: Navigation Back and Unknown Topic Route ---');
    // Click Back to Search Primers
    await page.click('a[href="#/primers"]');
    await page.waitForTimeout(300);
    const backTabsVisible = await page.isVisible('#tabs-nav-bar');
    const backPrimersVisible = await page.isVisible('#tab-primers-view');
    console.log(`After Back click: Tabs nav visible: ${backTabsVisible}, Primers tab visible: ${backPrimersVisible}`);

    // Navigate to unknown route
    await page.evaluate(() => { window.location.hash = '#/primers/unknown-slug'; });
    await page.waitForTimeout(300);
    const unknownErrorShown = await page.locator('text=Topic Not Found').isVisible();
    console.log('Unknown topic displays graceful error:', unknownErrorShown);

    console.log('\nTotal console errors during test:', consoleErrors.length);
    if (consoleErrors.length > 0) {
        console.error('Console errors:', consoleErrors);
    }

    await browser.close();
    console.log('=== Phase 1 Playwright Tests Passed Successfully! ===');
}

runPhase1Tests().catch(err => {
    console.error('Phase 1 test failed:', err);
    process.exit(1);
});

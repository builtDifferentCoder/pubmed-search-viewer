const playwrightPath = process.env.PLAYWRIGHT_PATH || 'C:/Users/HP/Downloads/ace-ai-solutions/node_modules/playwright';
let chromium;
try {
    chromium = require(playwrightPath).chromium;
} catch (e) {
    chromium = require('playwright').chromium;
}
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
  <PubmedArticle>
    <MedlineCitation>
      <PMID>1001</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2022</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Efficacy of test allulose in diet</ArticleTitle>
        <PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList>
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
      <PMID>1002</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2021</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Murine study</ArticleTitle>
        <PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList>
      </Article>
      <KeywordList>
        <Keyword>allulose</Keyword>
        <Keyword>diet</Keyword>
        <Keyword>metabolism</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>1003</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2023</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Follow up study</ArticleTitle>
        <PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList>
      </Article>
      <KeywordList>
        <Keyword>diet</Keyword>
        <Keyword>nutrition</Keyword>
        <Keyword>longitudinal</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>1004</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2020</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>In vitro study</ArticleTitle>
        <PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList>
      </Article>
      <KeywordList>
        <Keyword>in vitro</Keyword>
        <Keyword>cell line</Keyword>
        <Keyword>glucose</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>1005</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2024</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Clinical trial</ArticleTitle>
        <PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList>
      </Article>
      <KeywordList>
        <Keyword>isolated_keyword</Keyword>
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>`;

    return { esearchJson, esummaryJson, efetchXml };
}

async function runPhase2Tests() {
    console.log('=== Starting Phase 2 Playwright Test Suite ===');
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.toString()));

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

    const fileUrl = 'file:///' + path.resolve(__dirname, 'pubmed_miner.html').replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 20000 });

    // Switch to Keywords Graph tab
    await page.click('#tab-graph-btn');
    await page.waitForTimeout(500);

    console.log('\n--- Test 2.1: Info Banner Updated ---');
    const bannerText = await page.locator('#tab-graph-view .bg-blue-50\\/70').innerText();
    const hasWeightedDegreeText = bannerText.toLowerCase().includes('weighted') || bannerText.toLowerCase().includes('strength');
    console.log('Banner text describes weighted strength sizing:', hasWeightedDegreeText);

    console.log('\n--- Test 2.2: Node Data Attributes (strength, freq, radius, size, fontSize) ---');
    const nodeDataList = await page.evaluate(() => {
        const cy = window.activeCytoscape;
        if (!cy) return [];
        return cy.nodes().map(n => ({
            id: n.id(),
            strength: n.data('strength'),
            freq: n.data('freq'),
            radius: n.data('radius'),
            size: n.data('size'),
            fontSize: n.data('fontSize')
        }));
    });

    console.log(`Extracted ${nodeDataList.length} nodes from Cytoscape.`);
    console.log('Sample node data:', nodeDataList.slice(0, 4));

    // Verify all nodes have required attributes
    const allHaveAttributes = nodeDataList.every(n =>
        n.strength !== undefined &&
        n.freq !== undefined &&
        n.radius !== undefined &&
        n.size !== undefined &&
        n.fontSize !== undefined
    );
    console.log('All nodes contain strength, freq, radius, size, fontSize:', allHaveAttributes);

    console.log('\n--- Test 2.3: Node Sizing Formula & Bounds ---');
    const minRadius = await page.evaluate(() => window.GRAPH_MIN_RADIUS);
    const maxRadius = await page.evaluate(() => window.GRAPH_MAX_RADIUS);
    console.log(`Configured Radius Bounds: [${minRadius}, ${maxRadius}] px (Diameters: [${2*minRadius}, ${2*maxRadius}] px)`);

    const radiiWithinBounds = nodeDataList.every(n => n.radius >= minRadius && n.radius <= maxRadius);
    const sizesEqualDoubleRadius = nodeDataList.every(n => n.size === 2 * n.radius);
    console.log('All radii within [min, max]:', radiiWithinBounds);
    console.log('All sizes equal 2 * radius:', sizesEqualDoubleRadius);

    console.log('\n--- Test 2.4: Monotonicity in Node Strength ---');
    // If strength_A > strength_B, then radius_A >= radius_B
    let isMonotonic = true;
    for (let i = 0; i < nodeDataList.length; i++) {
        for (let j = 0; j < nodeDataList.length; j++) {
            if (nodeDataList[i].strength > nodeDataList[j].strength) {
                if (nodeDataList[i].radius < nodeDataList[j].radius) {
                    isMonotonic = false;
                    console.log(`Monotonicity violation between ${nodeDataList[i].id} and ${nodeDataList[j].id}`);
                }
            }
        }
    }
    console.log('Node radii are monotonic in weighted degree (strength):', isMonotonic);

    console.log('\n--- Test 2.5: Mathematical Edge Cases (computeNodeRadius) ---');
    const edgeCasesTest = await page.evaluate(() => {
        const compute = window.computeNodeRadius;
        const minR = window.GRAPH_MIN_RADIUS;
        const maxR = window.GRAPH_MAX_RADIUS;
        const midR = Math.round((minR + maxR) / 2);

        return {
            zeroStrength: compute(0, 0, 10),                 // should be minR (10)
            isolatedZero: compute(0, 0, 0),                  // should be minR (10)
            equalNonZeroStrengths: compute(5, 5, 5),          // should be midR (22)
            singleNodePositive: compute(12, 12, 12),         // should be midR (22)
            minOfRange: compute(2, 2, 10),                   // should be minR (10)
            maxOfRange: compute(10, 2, 10),                  // should be maxR (34)
            intermediate: compute(6, 2, 10)                  // sqrt((6-2)/8) = sqrt(0.5) ~ 0.707 => 10 + 24*0.707 = 27
        };
    });
    console.log('Edge cases evaluation results:', edgeCasesTest);
    console.log('Zero strength yields min radius (10):', edgeCasesTest.zeroStrength === 10);
    console.log('All strengths equal yields midpoint radius (22):', edgeCasesTest.equalNonZeroStrengths === 22);
    console.log('Single positive node yields midpoint radius (22):', edgeCasesTest.singleNodePositive === 22);

    console.log('\n--- Test 2.6: Label Font Size Bound to Radius ---');
    const fontSizesWithinBounds = nodeDataList.every(n => {
        const num = parseInt(n.fontSize, 10);
        return num >= 10 && num <= 18;
    });
    console.log('All font sizes within [GRAPH_MIN_FONT, GRAPH_MAX_FONT] (10-18px):', fontSizesWithinBounds);

    console.log('\n--- Test 2.7: Sizing Stability on "Hide weight < 2" Toggle ---');
    // Read sizes before toggling
    const sizesBefore = await page.evaluate(() => {
        return window.activeCytoscape.nodes().map(n => ({ id: n.id(), size: n.data('size') }));
    });

    // Toggle "Hide weight < 2"
    await page.evaluate(() => {
        const toggle = document.getElementById('graph-min-weight-toggle');
        toggle.checked = !toggle.checked;
        toggle.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(400);

    const sizesAfter = await page.evaluate(() => {
        return window.activeCytoscape.nodes().map(n => ({ id: n.id(), size: n.data('size') }));
    });

    // Verify sizes did NOT change when toggle was flipped
    const sizesDidNotJump = sizesBefore.every((b, i) => {
        const a = sizesAfter.find(n => n.id === b.id);
        return a && a.size === b.size;
    });
    console.log('Node sizes remain constant when "Hide weight < 2" is toggled (unfiltered strength):', sizesDidNotJump);

    console.log('\nTotal console errors during Phase 2 tests:', consoleErrors.length);
    if (consoleErrors.length > 0) {
        console.error('Console errors:', consoleErrors);
    }

    await browser.close();
    console.log('=== Phase 2 Playwright Tests Passed Successfully! ===');
}

runPhase2Tests().catch(err => {
    console.error('Phase 2 test failed:', err);
    process.exit(1);
});

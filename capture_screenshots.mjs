import { chromium } from 'playwright';
import { spawn, spawnSync } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4176;
const TEST_URL = `http://localhost:${PORT}/`;
const OUT_DIR = path.join(__dirname, 'docs', 'screenshots');
const BRAIN_DIR = path.resolve('C:/Users/HP/.gemini/antigravity/brain/c08e4d6a-2d13-41ea-b088-f21657c25b3a/screenshots');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(BRAIN_DIR, { recursive: true });

function getMockBioData() {
    const ids = Array.from({ length: 15 }, (_, i) => String(401 + i));
    
    const esearchJson = {
        header: { type: 'esearch', version: '0.3' },
        esearchresult: {
            count: String(ids.length),
            retmax: String(ids.length),
            retstart: '0',
            idlist: ids,
            translationset: [],
            querytranslation: 'allulose diet metabolism[All Fields]'
        }
    };

    const summaries = {};
    ids.forEach((id, i) => {
        summaries[id] = { uid: id, pmcrefcount: (15 - i) * 3 + 2 };
    });
    const esummaryJson = {
        header: { type: 'esummary', version: '0.3' },
        result: { uids: ids, ...summaries }
    };

    const articles = [
        { id: '401', year: 2024, type: 'RCT', sub: 'Human', n: 120, title: 'Dietary D-allulose significantly improves glycemic control and accelerates ketosis in humans', conc: 'D-allulose was safe, well-tolerated, and demonstrated robust positive efficacy for ketosis and metabolic regulation.', kw: ['allulose', 'diet', 'ketosis', 'glycemic control', 'metabolism'] },
        { id: '402', year: 2023, type: 'RCT', sub: 'Human', n: 95, title: 'Evaluation of D-allulose on human glycemic variability: A double-blind negative outcome trial', conc: 'No significant difference was observed; allulose failed to produce measurable positive changes in ketosis compared to placebo.', kw: ['allulose', 'diet', 'ketosis', 'glycemic control', 'insulin'] },
        { id: '403', year: 2024, type: 'Cohort', sub: 'Human', n: 350, title: 'Long-term metabolic outcomes of rare sugar intake: Allulose inconclusive cohort findings', conc: 'Findings were inconclusive regarding allulose benefits on sustained weight loss and ketosis in mixed dietary cohorts.', kw: ['allulose', 'diet', 'ketosis', 'weight loss', 'obesity'] },
        { id: '404', year: 2023, type: 'RCT', sub: 'Human', n: 60, title: 'D-allulose supplementation enhances fat oxidation and supports weight loss in overweight subjects', conc: 'Results support allulose supplementation for visceral fat reduction and enhanced postprandial fat oxidation.', kw: ['allulose', 'fat oxidation', 'weight loss', 'metabolism', 'obesity'] },
        { id: '405', year: 2022, type: 'Animal', sub: 'Murine', n: 40, title: 'Allulose supplementation fails to attenuate diet-induced obesity in murine models', conc: 'Allulose administration refutes earlier claims of weight reduction and showed adverse gastrointestinal tolerance.', kw: ['allulose', 'fat oxidation', 'weight loss', 'obesity', 'diet'] },
        { id: '406', year: 2024, type: 'Meta-Analysis', sub: 'Human', n: 840, title: 'Systematic review of rare sugars in cardiometabolic disease: Positive clinical synthesis', conc: 'Pooled analysis demonstrates positive reduction in HbA1c and fasting blood glucose following rare sugar substitution.', kw: ['allulose', 'glycemic control', 'diabetes', 'metabolism', 'cardiometabolic'] },
        { id: '407', year: 2023, type: 'Systematic Review', sub: 'Human', n: 510, title: 'Efficacy and safety of allulose in prediabetic populations: A critical null analysis', conc: 'Evidence remains inconclusive with high heterogeneity across randomized clinical trials.', kw: ['allulose', 'glycemic control', 'prediabetes', 'diabetes', 'metabolism'] },
        { id: '408', year: 2024, type: 'In Vitro', sub: 'Cellular', n: 0, title: 'Molecular mechanisms of allulose-induced GLP-1 secretion in intestinal L-cells', conc: 'Allulose directly stimulates GLP-1 release, supporting its positive role in incretin-mediated satiety.', kw: ['allulose', 'glp-1', 'satiety', 'incretin', 'metabolism'] },
        { id: '409', year: 2023, type: 'RCT', sub: 'Human', n: 80, title: 'Combined allulose and ketogenic diet protocol: Enhanced metabolic flexibility', conc: 'Synergistic combination of allulose with ketogenic dietary intervention positively accelerated deep ketosis.', kw: ['allulose', 'ketogenic diet', 'ketosis', 'metabolic flexibility', 'diet'] },
        { id: '410', year: 2022, type: 'Animal', sub: 'Murine', n: 30, title: 'Hepatic lipid accumulation under high-fat diet: Neutral effect of D-psicose (allulose)', conc: 'No protective effect was detected against non-alcoholic fatty liver disease progression.', kw: ['allulose', 'liver', 'steatosis', 'fatty liver', 'diet'] },
        { id: '411', year: 2024, type: 'Clinical Trial', sub: 'Human', n: 150, title: 'Postprandial insulin sensitivity after acute allulose ingestion in healthy adults', conc: 'Significantly lowered peak insulin requirements, supporting improved glucose disposal kinetics.', kw: ['allulose', 'insulin sensitivity', 'glucose', 'metabolism', 'glycemic control'] },
        { id: '412', year: 2023, type: 'Case Series', sub: 'Human', n: 25, title: 'Safety and gastrointestinal tolerability of high-dose allulose during fasting', conc: 'Doses above 30g induced mild osmotic diarrhea, refuting high-dose safety assumptions.', kw: ['allulose', 'safety', 'gastrointestinal', 'tolerability', 'fasting'] },
        { id: '413', year: 2024, type: 'RCT', sub: 'Human', n: 110, title: 'Microbiome remodeling and short-chain fatty acid generation induced by rare sugars', conc: 'Allulose consumption positively enriched Akkermansia muciniphila abundance and propionate production.', kw: ['allulose', 'microbiome', 'scfa', 'gut health', 'diet'] },
        { id: '414', year: 2023, type: 'Observational', sub: 'Human', n: 420, title: 'Dietary intake patterns of non-nutritive sweeteners and metabolic syndrome risk', conc: 'Epidemiological data shows inconclusive associations between sweetener intake and metabolic syndrome.', kw: ['sweeteners', 'metabolic syndrome', 'diet', 'obesity', 'glycemic control'] },
        { id: '415', year: 2024, type: 'RCT', sub: 'Human', n: 75, title: 'Appetite regulation and caloric compensation following allulose-sweetened beverages', conc: 'Subjects reported reduced subjective hunger and reduced subsequent caloric intake, confirming positive satiety benefits.', kw: ['allulose', 'appetite', 'satiety', 'caloric intake', 'obesity'] }
    ];

    const xmlArticles = articles.map(a => `
  <PubmedArticle>
    <MedlineCitation>
      <PMID>${a.id}</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>${a.year}</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>${a.title}</ArticleTitle>
        <Abstract>
          <AbstractText Label="CONCLUSIONS">${a.conc}</AbstractText>
        </Abstract>
      </Article>
      <KeywordList>
        ${a.kw.map(k => `<Keyword>${k}</Keyword>`).join('\n        ')}
      </KeywordList>
    </MedlineCitation>
  </PubmedArticle>`).join('\n');

    const efetchXml = `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE PubmedArticleSet PUBLIC "-//NLM//DTD PubMedArticle, 1st January 2019//EN" "https://dtd.nlm.nih.gov/ncbi/pubmed/out/pubmed_190101.dtd">
<PubmedArticleSet>
${xmlArticles}
</PubmedArticleSet>`;

    return { esearchJson, esummaryJson, efetchXml };
}

function checkServerReady(url) {
    return new Promise((resolve) => {
        const req = http.get(url, (res) => resolve(res.statusCode >= 200 && res.statusCode < 400));
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => { req.destroy(); resolve(false); });
    });
}

async function waitForServer(url, maxWaitMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        if (await checkServerReady(url)) return true;
        await new Promise((r) => setTimeout(r, 200));
    }
    return false;
}

function stopProcess(child) {
    if (!child || child.killed) return;
    try {
        if (process.platform === 'win32') {
            spawnSync('taskkill', ['/pid', child.pid.toString(), '/T', '/F']);
        } else {
            child.kill('SIGTERM');
        }
    } catch {}
}

async function main() {
    console.log('Building app bundle...');
    spawnSync(process.execPath, [
        path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
        'build'
    ], { stdio: 'inherit' });

    console.log(`Starting Vite preview on port ${PORT}...`);
    const viteCli = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
    const previewProcess = spawn(process.execPath, [viteCli, 'preview', '--port', String(PORT), '--strictPort'], {
        cwd: __dirname,
        stdio: 'pipe'
    });

    const ready = await waitForServer(TEST_URL);
    if (!ready) {
        console.error('Failed to start server.');
        stopProcess(previewProcess);
        process.exit(1);
    }
    console.log('Preview server ready.');

    const mock = getMockBioData();
    const browser = await chromium.launch({ headless: true });

    try {
        console.log('Capturing Desktop Screenshots (1440x900 @2x DPR)...');
        const desktopContext = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            deviceScaleFactor: 2
        });
        const desktopPage = await desktopContext.newPage();

        await desktopPage.route('**', async (route) => {
            const url = route.request().url();
            if (url.includes('esearch.fcgi')) {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mock.esearchJson) });
            } else if (url.includes('esummary.fcgi')) {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mock.esummaryJson) });
            } else if (url.includes('efetch.fcgi')) {
                await route.fulfill({ status: 200, contentType: 'application/xml', body: mock.efetchXml });
            } else {
                await route.continue();
            }
        });

        await desktopPage.goto(TEST_URL, { waitUntil: 'networkidle' });
        await desktopPage.waitForTimeout(2000);

        // Perform search
        await desktopPage.fill('#search-input', 'allulose diet metabolism');
        await desktopPage.click('#search-form button[type="submit"]');
        await desktopPage.waitForSelector('#loading-overlay', { state: 'hidden', timeout: 30000 });
        await desktopPage.waitForTimeout(2000);

        // 1. Desktop Search Overview (Cards + 8 Charts)
        const d1Path = path.join(OUT_DIR, '01_desktop_search_overview.png');
        await desktopPage.screenshot({ path: d1Path });
        console.log('Saved:', d1Path);

        // 2. Desktop Contradiction Mapping (Divergence Panel)
        const divergenceSection = desktopPage.locator('.divergence-container').first();
        if (await divergenceSection.count() > 0) {
            await divergenceSection.scrollIntoViewIfNeeded();
            await desktopPage.waitForTimeout(1000);
            const d2Path = path.join(OUT_DIR, '02_desktop_divergence_mapping.png');
            await desktopPage.screenshot({ path: d2Path });
            console.log('Saved:', d2Path);

            // 3. Side-by-Side Comparison Modal
            const sideBySideBtn = desktopPage.locator('.divergence-compare-btn').first();
            if (await sideBySideBtn.count() > 0) {
                await sideBySideBtn.click();
                await desktopPage.waitForSelector('#divergence-compare-modal:not(.hidden)');
                await desktopPage.waitForTimeout(1000);
                const d3Path = path.join(OUT_DIR, '03_desktop_comparison_modal.png');
                await desktopPage.screenshot({ path: d3Path });
                console.log('Saved:', d3Path);
                await desktopPage.click('#modal-close-btn');
                await desktopPage.waitForTimeout(500);
            }
        }

        // 4. Desktop Keywords Graph & Query Builder
        await desktopPage.click('#tab-graph-btn');
        await desktopPage.waitForTimeout(3000);
        // Add a few chips to query builder for visual impact
        await desktopPage.evaluate(() => {
            if (window.BooleanQueryBuilder) {
                window.BooleanQueryBuilder.addKeyword('diet');
                window.BooleanQueryBuilder.addKeyword('ketosis', 'AND');
                window.BooleanQueryBuilder.addKeyword('obesity', 'NOT');
            }
            if (window.activeCytoscape) {
                window.activeCytoscape.fit();
                window.activeCytoscape.zoom(window.activeCytoscape.zoom() * 1.05);
            }
        });
        await desktopPage.waitForTimeout(1000);
        const d4Path = path.join(OUT_DIR, '04_desktop_keywords_graph.png');
        await desktopPage.screenshot({ path: d4Path });
        console.log('Saved:', d4Path);

        // 5. Desktop Search Primers
        await desktopPage.click('#tab-primers-btn');
        await desktopPage.waitForTimeout(1500);
        const d5Path = path.join(OUT_DIR, '05_desktop_search_primers.png');
        await desktopPage.screenshot({ path: d5Path });
        console.log('Saved:', d5Path);

        await desktopContext.close();

        // Mobile Captures (iPhone 14/15 390x844 @3x DPR)
        console.log('Capturing Mobile Screenshots (390x844 @3x DPR)...');
        const mobileContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true
        });
        const mobilePage = await mobileContext.newPage();

        await mobilePage.route('**', async (route) => {
            const url = route.request().url();
            if (url.includes('esearch.fcgi')) {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mock.esearchJson) });
            } else if (url.includes('esummary.fcgi')) {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mock.esummaryJson) });
            } else if (url.includes('efetch.fcgi')) {
                await route.fulfill({ status: 200, contentType: 'application/xml', body: mock.efetchXml });
            } else {
                await route.continue();
            }
        });

        await mobilePage.goto(TEST_URL, { waitUntil: 'networkidle' });
        await mobilePage.waitForTimeout(2000);

        // 6. Mobile Search Results & Charts
        const m1Path = path.join(OUT_DIR, '06_mobile_search_results.png');
        await mobilePage.screenshot({ path: m1Path });
        console.log('Saved:', m1Path);

        // 7. Mobile Keywords Graph & Query Builder
        await mobilePage.click('#tab-graph-btn');
        await mobilePage.waitForTimeout(2500);
        await mobilePage.evaluate(() => {
            if (window.BooleanQueryBuilder) {
                window.BooleanQueryBuilder.addKeyword('diet');
                window.BooleanQueryBuilder.addKeyword('ketosis', 'AND');
            }
            if (window.activeCytoscape) {
                window.activeCytoscape.fit();
            }
        });
        await mobilePage.waitForTimeout(1000);
        const m2Path = path.join(OUT_DIR, '07_mobile_keywords_graph.png');
        await mobilePage.screenshot({ path: m2Path });
        console.log('Saved:', m2Path);

        // 8. Mobile Divergence Panel
        await mobilePage.click('#tab-results-btn');
        await mobilePage.waitForTimeout(1000);
        const mobDivergence = mobilePage.locator('.divergence-container').first();
        if (await mobDivergence.count() > 0) {
            await mobDivergence.scrollIntoViewIfNeeded();
            await mobilePage.waitForTimeout(1000);
            const m3Path = path.join(OUT_DIR, '08_mobile_divergence_cards.png');
            await mobilePage.screenshot({ path: m3Path });
            console.log('Saved:', m3Path);
        }

        await mobileContext.close();

        // Copy all screenshots to brain directory so they are persistent and accessible
        for (const file of fs.readdirSync(OUT_DIR)) {
            if (file.endsWith('.png')) {
                fs.copyFileSync(path.join(OUT_DIR, file), path.join(BRAIN_DIR, file));
            }
        }
        console.log('All screenshots mirrored to brain directory.');

    } finally {
        await browser.close();
        stopProcess(previewProcess);
        console.log('Screenshots complete.');
    }
}

main().catch(console.error);

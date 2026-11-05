const { chromium } = require('C:/Users/Hamza/AppData/Roaming/npm/node_modules/omniroute/node_modules/playwright');
const path = require('path');

async function runTestSuite() {
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
        console.log('Dialog opened:', dialog.type(), dialog.message());
        await dialog.accept();
    });

    const fileUrl = 'file:///' + path.resolve(__dirname, 'pubmed_search_viewer.html').replace(/\\/g, '/');
    console.log('Navigating to:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });

    // Wait for the loading overlay to disappear or search to finish
    console.log('Waiting for search to finish (loading overlay hidden)...');
    try {
        await page.waitForSelector('#loading-overlay:not(.hidden)', { timeout: 2000 });
        console.log('Loading overlay appeared, now waiting for it to hide...');
        await page.waitForSelector('#loading-overlay.hidden', { timeout: 30000 });
    } catch (e) {
        // Maybe it finished already or never showed
        console.log('Note on loading overlay wait:', e.message);
        await page.waitForSelector('#loading-overlay.hidden', { timeout: 30000 });
    }

    // Check if query card rendered
    const cardCount = await page.locator('#queries-container section').count();
    console.log('Query cards rendered:', cardCount);

    // Inspect IndexedDB contents
    const dbState = await page.evaluate(async () => {
        const qCount = await window.db.queries.count();
        const aCount = await window.db.articles.count();
        const queries = await window.db.queries.toArray();
        return { qCount, aCount, queries };
    });
    console.log('IndexedDB state:', dbState);

    // Inspect chart info
    const chartInfo = await page.evaluate(() => {
        const chartIds = Object.keys(window.charts);
        if (chartIds.length === 0) return null;
        const chart = window.charts[chartIds[0]];
        return {
            id: chartIds[0],
            labels: chart.data.labels,
            data: chart.data.datasets[0].data
        };
    });
    console.log('Chart info:', JSON.stringify(chartInfo, null, 2));

    await browser.close();
}

runTestSuite().catch(e => console.error('Test suite failed:', e));

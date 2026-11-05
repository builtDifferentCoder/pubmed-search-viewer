const { chromium } = require('C:/Users/Hamza/AppData/Roaming/npm/node_modules/omniroute/node_modules/playwright');
const path = require('path');

(async () => {
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

    const fileUrl = 'file:///' + path.resolve(__dirname, 'pubmed_search_viewer.html').replace(/\\/g, '/');
    console.log('Navigating to:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });

    console.log('Page loaded. Waiting for network idle or 5 seconds...');
    await page.waitForTimeout(5000);

    console.log('Console logs:');
    consoleLogs.forEach(l => console.log(l));
    console.log('Console errors count:', consoleErrors.length);
    if (consoleErrors.length > 0) {
        console.log('Errors:', consoleErrors);
    }

    // Check Dexie and Chart.js
    const libsLoaded = await page.evaluate(() => {
        return {
            hasDexie: typeof window.Dexie !== 'undefined',
            hasChart: typeof window.Chart !== 'undefined',
        };
    });
    console.log('Libraries loaded:', libsLoaded);

    await browser.close();
})();

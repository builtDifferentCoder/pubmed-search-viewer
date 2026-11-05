const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
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

    const targetUrl = process.env.TEST_URL || 'http://localhost:4173/';
    console.log('Navigating to:', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    console.log('Page loaded. Waiting for network idle or 3 seconds...');
    await page.waitForTimeout(3000);

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
    if (!libsLoaded.hasDexie || !libsLoaded.hasChart) {
        throw new Error('Dexie or Chart.js failed to load!');
    }
    console.log('✓ test_app passed successfully!');
})();

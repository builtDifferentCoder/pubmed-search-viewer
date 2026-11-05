import { spawn, spawnSync } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4173;
const TEST_URL = `http://localhost:${PORT}/`;

function checkServerReady(url, timeoutMs = 1000) {
    return new Promise((resolve) => {
        const req = http.get(url, (res) => {
            resolve(res.statusCode >= 200 && res.statusCode < 400);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(timeoutMs, () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function waitForServer(url, maxWaitMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        if (await checkServerReady(url, 500)) return true;
        await new Promise((r) => setTimeout(r, 250));
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
    } catch {
        // ignore
    }
}

async function run() {
    console.log('Generating Lighthouse Mobile Report...');
    const distIndex = path.join(__dirname, 'dist', 'index.html');
    if (!fs.existsSync(distIndex)) {
        console.log('Building app first...');
        spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
    }

    let previewProcess = null;
    let serverRunning = await checkServerReady(TEST_URL);

    if (!serverRunning) {
        console.log(`Starting preview server on ${TEST_URL}...`);
        const viteCli = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
        previewProcess = spawn(process.execPath, [viteCli, 'preview', '--port', String(PORT), '--strictPort'], {
            cwd: __dirname,
            stdio: 'pipe',
            env: { ...process.env, PORT: String(PORT) }
        });
        const ready = await waitForServer(TEST_URL, 10000);
        if (!ready) {
            console.error('Failed to start preview server.');
            stopProcess(previewProcess);
            process.exit(1);
        }
    }

    try {
        console.log('Running Lighthouse mobile audit...');
        const outBase = path.join(__dirname, 'docs', 'lighthouse-mobile-report');
        const args = [
            '--yes',
            'lighthouse',
            TEST_URL,
            '--output=html,json',
            `--output-path=${outBase}`,
            '--form-factor=mobile',
            '--screenEmulation.mobile=true',
            '--screenEmulation.width=390',
            '--screenEmulation.height=844',
            '--screenEmulation.deviceScaleFactor=3',
            '--chrome-flags="--headless --no-sandbox --disable-gpu"',
            '--quiet'
        ];

        const res = spawnSync('npx', args, {
            cwd: __dirname,
            shell: true,
            stdio: 'inherit',
            timeout: 180000
        });

        if (res.status !== 0) {
            console.error('Lighthouse exited with code', res.status);
        }

        const jsonFile = `${outBase}.report.json`;
        if (fs.existsSync(jsonFile)) {
            const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
            const cats = data.categories || {};
            const scores = {
                performance: cats.performance ? Math.round(cats.performance.score * 100) : 'N/A',
                accessibility: cats.accessibility ? Math.round(cats.accessibility.score * 100) : 'N/A',
                bestPractices: cats['best-practices'] ? Math.round(cats['best-practices'].score * 100) : 'N/A',
                seo: cats.seo ? Math.round(cats.seo.score * 100) : 'N/A',
                pwa: cats.pwa ? Math.round(cats.pwa.score * 100) : 'N/A',
            };

            const mdContent = `# Lighthouse Mobile Audit Report

**Target URL:** \`${TEST_URL}\`  
**Date:** ${new Date().toISOString()}  
**Form Factor:** Mobile (390x844, DPR: 3)  
**Lighthouse Version:** ${data.lighthouseVersion || '13.x'}

## Category Scores

| Category | Score | Status |
| :--- | :--- | :--- |
| **Performance** | **${scores.performance}%** | ${scores.performance >= 90 ? '🟢 Good' : scores.performance >= 50 ? '🟠 Needs Improvement' : '🔴 Poor'} |
| **Accessibility** | **${scores.accessibility}%** | ${scores.accessibility >= 90 ? '🟢 Good' : '🟠 Needs Improvement'} |
| **Best Practices** | **${scores.bestPractices}%** | ${scores.bestPractices >= 90 ? '🟢 Good' : '🟠 Needs Improvement'} |
| **SEO** | **${scores.seo}%** | ${scores.seo >= 90 ? '🟢 Good' : '🟠 Needs Improvement'} |

## Key Performance Metrics

- **First Contentful Paint (FCP):** ${data.audits?.['first-contentful-paint']?.displayValue || 'N/A'}
- **Speed Index:** ${data.audits?.['speed-index']?.displayValue || 'N/A'}
- **Largest Contentful Paint (LCP):** ${data.audits?.['largest-contentful-paint']?.displayValue || 'N/A'}
- **Total Blocking Time (TBT):** ${data.audits?.['total-blocking-time']?.displayValue || 'N/A'}
- **Cumulative Layout Shift (CLS):** ${data.audits?.['cumulative-layout-shift']?.displayValue || 'N/A'}

## Artifacts Generated
- JSON Report: [\`lighthouse-mobile-report.report.json\`](./lighthouse-mobile-report.report.json)
- HTML Report: [\`lighthouse-mobile-report.report.html\`](./lighthouse-mobile-report.report.html)
`;
            fs.writeFileSync(`${outBase}.md`, mdContent, 'utf8');
            console.log('Lighthouse summary written to docs/lighthouse-mobile-report.md');
            console.log('Scores:', JSON.stringify(scores, null, 2));
        }
    } finally {
        if (previewProcess) {
            stopProcess(previewProcess);
        }
    }
}

run().catch(console.error);

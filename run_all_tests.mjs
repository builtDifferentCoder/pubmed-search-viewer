import { spawn, spawnSync } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4173;
const TEST_URL = `http://localhost:${PORT}/`;

const TEST_FILES = [
    'test_boolean_builder.js',
    'test_divergence_logic.js',
    'test_app.js',
    'test_suite.js',
    'test_phase1.js',
    'test_phase1_query_builder.js',
    'test_phase2.js',
    'test_phase2_divergence.js',
    'test_phase4.js',
    'test_v02_suite.js',
    'test_v03_suite.js'
];

function checkServerReady(url, timeoutMs = 1000) {
    return new Promise((resolve) => {
        const req = http.get(url, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 400) {
                resolve(true);
            } else {
                resolve(false);
            }
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
        // ignore error during kill
    }
}

async function run() {
    console.log('====================================================');
    console.log('       PubMed ResearchMiner - Test Runner           ');
    console.log('====================================================');

    const distIndex = path.join(__dirname, 'dist', 'index.html');
    if (!fs.existsSync(distIndex)) {
        console.log('\n[1/3] Building production assets (dist/)...');
        const buildResult = spawnSync(process.execPath, [
            path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
            'build'
        ], { stdio: 'inherit' });
        if (buildResult.status !== 0) {
            console.error('Build failed with exit code', buildResult.status);
            process.exit(1);
        }
    } else {
        console.log('\n[1/3] Production build dist/ exists.');
    }

    console.log('\n[2/3] Checking preview server on port ' + PORT + '...');
    let previewProcess = null;
    let serverRunning = await checkServerReady(TEST_URL);

    if (!serverRunning) {
        console.log(`Starting Vite preview server on ${TEST_URL}...`);
        const viteCli = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
        previewProcess = spawn(process.execPath, [viteCli, 'preview', '--port', String(PORT), '--strictPort'], {
            cwd: __dirname,
            stdio: 'pipe',
            env: { ...process.env, PORT: String(PORT) }
        });

        previewProcess.on('error', (err) => {
            console.error('Failed to spawn preview server:', err);
        });

        const ready = await waitForServer(TEST_URL, 15000);
        if (!ready) {
            console.error('Preview server failed to start within timeout.');
            stopProcess(previewProcess);
            process.exit(1);
        }
        console.log('Preview server ready.');
    } else {
        console.log('Preview server is already running.');
    }

    console.log('\n[3/3] Running test suites against ' + TEST_URL + '...');
    const results = [];
    let allPassed = true;

    try {
        for (const testFile of TEST_FILES) {
            const testPath = path.join(__dirname, testFile);
            if (!fs.existsSync(testPath)) {
                console.warn(`Warning: test file ${testFile} not found.`);
                results.push({ name: testFile, status: 'NOT FOUND', duration: 0 });
                allPassed = false;
                continue;
            }

            process.stdout.write(`  -> Running ${testFile.padEnd(30)} ... `);
            const startTime = Date.now();
            const res = spawnSync(process.execPath, [testPath], {
                cwd: __dirname,
                env: {
                    ...process.env,
                    TEST_URL
                },
                encoding: 'utf-8',
                timeout: 120000
            });
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            if (res.status === 0) {
                console.log(`PASSED (${duration}s)`);
                results.push({ name: testFile, status: 'PASSED', duration });
            } else {
                console.log(`FAILED (${duration}s)`);
                console.error('\n--- Failure Output (' + testFile + ') ---');
                if (res.stdout) console.error(res.stdout);
                if (res.stderr) console.error(res.stderr);
                console.error('-------------------------------------------\n');
                results.push({ name: testFile, status: 'FAILED', duration, error: res.stderr || res.stdout });
                allPassed = false;
            }
        }
    } finally {
        if (previewProcess) {
            console.log('\nStopping preview server...');
            stopProcess(previewProcess);
        }
    }

    console.log('\n====================================================');
    console.log('                  Test Summary                      ');
    console.log('====================================================');
    for (const r of results) {
        const mark = r.status === 'PASSED' ? '✓' : '✗';
        console.log(` ${mark} ${r.name.padEnd(32)} ${r.status.padEnd(8)} (${r.duration}s)`);
    }
    console.log('====================================================');
    const passedCount = results.filter((r) => r.status === 'PASSED').length;
    console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${results.length - passedCount}`);
    console.log('====================================================\n');

    process.exit(allPassed ? 0 : 1);
}

run().catch((err) => {
    console.error('Unhandled error in test runner:', err);
    process.exit(1);
});

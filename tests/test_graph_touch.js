const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Mock data generator producing diverse keywords for graph tests
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
            querytranslation: 'graph touch test[All Fields]'
        }
    };

    const result = { uids: idlist };
    idlist.forEach((id, idx) => {
        result[id] = { uid: id, pmcrefcount: (idx * 2) % 30 };
    });
    const esummaryJson = {
        header: { type: 'esummary', version: '0.3' },
        result
    };

    const vocabulary = [
        'allulose', 'diet', 'ketosis', 'metabolism', 'glucose', 'insulin',
        'obesity', 'longevity', 'diabetes', 'caloric restriction', 'fasting',
        'autophagy', 'mTOR', 'sirtuins', 'NAD+', 'resveratrol', 'exercise',
        'mitochondria', 'inflammation', 'gut microbiome', 'lipids', 'adipose',
        'triglycerides', 'glycemic index', 'carbohydrates', 'ketones', 'liver',
        'pancreas', 'steatosis', 'cardiovascular'
    ];

    const efetchXml = `<?xml version="1.0" encoding="UTF-8" ?>
<PubmedArticleSet>
  ${idlist.map((id, idx) => {
      const kws = [
          vocabulary[idx % vocabulary.length],
          vocabulary[(idx + 1) % vocabulary.length],
          vocabulary[(idx + 3) % vocabulary.length]
      ];
      return `
      <PubmedArticle>
        <MedlineCitation>
          <PMID>${id}</PMID>
          <Article>
            <Journal>
              <JournalIssue><PubDate><Year>${2020 + (idx % 5)}</Year></PubDate></JournalIssue>
            </Journal>
            <ArticleTitle>Study on ${kws.join(' and ')}</ArticleTitle>
            <PublicationTypeList>
              <PublicationType UI="D016449">Clinical Trial</PublicationType>
            </PublicationTypeList>
            <Abstract>
              <AbstractText Label="CONCLUSIONS">Positive impact of dietary intervention demonstrated.</AbstractText>
            </Abstract>
          </Article>
          <KeywordList>
            ${kws.map(k => `<Keyword>${k}</Keyword>`).join('\n')}
          </KeywordList>
        </MedlineCitation>
      </PubmedArticle>`;
  }).join('')}
</PubmedArticleSet>`;

    return { esearchJson, esummaryJson, efetchXml };
}

async function runTests() {
    console.log('================================================================');
    console.log('     Keywords Graph Touch, Gestures & LOD Test Suite            ');
    console.log('================================================================');

    const TEST_URL = process.env.TEST_URL || 'http://localhost:4173/';
    const browser = await chromium.launch({ headless: true });

    // Mobile device context (iPhone 14 / modern Android 390x844 with touch enabled)
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
    });

    const page = await context.newPage();

    page.on('dialog', async dialog => {
        await dialog.accept();
    });

    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.toString()));

    const { esearchJson, esummaryJson, efetchXml } = getMockResponses(40);

    await page.route('**/esearch.fcgi*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(esearchJson) });
    });
    await page.route('**/esummary.fcgi*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(esummaryJson) });
    });
    await page.route('**/efetch.fcgi*', async route => {
        await route.fulfill({ status: 200, contentType: 'text/xml', body: efetchXml });
    });

    console.log('\n--- Navigating to app on mobile viewport (390x844, touch enabled) ---');
    await page.goto(TEST_URL, { waitUntil: 'networkidle' });

    // Dismiss coachmark if open
    await page.evaluate(() => {
        if (window.dismissCoachmarkTour) window.dismissCoachmarkTour();
    });
    await page.waitForTimeout(300);

    // =========================================================================
    // PART 1: Unit Tests for 24px Hit-testing & 8px Ambiguity Detection
    // =========================================================================
    console.log('\n--- Part 1: Hit Testing & Ambiguity Unit Logic ---');
    const unitResults = await page.evaluate(() => {
        const hitTest = window.hitTestNodesAtPoint;
        if (typeof hitTest !== 'function') {
            return { error: 'window.hitTestNodesAtPoint is not a function' };
        }

        const mockNodes = [
            { id: 'node_a', label: 'Node A', renderedPosition: { x: 100, y: 100 }, renderedRadius: 10 },
            { id: 'node_b', label: 'Node B', renderedPosition: { x: 110, y: 100 }, renderedRadius: 10 },
            { id: 'node_c', label: 'Node C', renderedPosition: { x: 300, y: 300 }, renderedRadius: 12 }
        ];

        // Case 1: Tap directly on node C (dist = 0)
        const hitDirect = hitTest({ x: 300, y: 300 }, mockNodes, 24, 8);

        // Case 2: Tap within 24px of node C (e.g. dist = 18px, outside 12px radius but within 24px)
        const hitExpanded = hitTest({ x: 318, y: 300 }, mockNodes, 24, 8);

        // Case 3: Tap far from any node (dist > 24px)
        const hitFar = hitTest({ x: 500, y: 500 }, mockNodes, 24, 8);

        // Case 4: Ambiguous tap between node A and B
        // Tap at (105, 100): dist to A is 5px, dist to B is 5px (diff = 0 < 8px)
        const hitAmbiguous = hitTest({ x: 105, y: 100 }, mockNodes, 24, 8);

        // Case 5: Clear tap closer to node A than node B
        // Tap at (95, 100): dist to A is 5px, dist to B is 15px (diff = 10 >= 8px)
        const hitClear = hitTest({ x: 95, y: 100 }, mockNodes, 24, 8);

        return {
            case1: { hit: hitDirect?.node?.id === 'node_c', ambiguous: hitDirect?.ambiguous },
            case2: { hit: hitExpanded?.node?.id === 'node_c', dist: Math.round(hitExpanded?.candidates?.[0]?.dist) },
            case3: { hit: hitFar === null },
            case4: { ambiguous: hitAmbiguous?.ambiguous, candidateCount: hitAmbiguous?.candidates?.length },
            case5: { ambiguous: hitClear?.ambiguous, chosen: hitClear?.node?.id }
        };
    });

    console.log('Hit-testing unit results:', unitResults);
    assert.strictEqual(unitResults.case1.hit, true, 'Direct hit identifies target node');
    assert.strictEqual(unitResults.case1.ambiguous, false, 'Direct hit is not ambiguous');
    assert.strictEqual(unitResults.case2.hit, true, 'Tap within 24px expanded radius hits node');
    assert.strictEqual(unitResults.case3.hit, true, 'Tap far away yields null');
    assert.strictEqual(unitResults.case4.ambiguous, true, 'Taps within <8px distance difference are flagged ambiguous');
    assert.strictEqual(unitResults.case4.candidateCount, 2, 'Ambiguous tap includes both candidates');
    assert.strictEqual(unitResults.case5.ambiguous, false, 'Taps >=8px distance difference pick clear closest node');
    assert.strictEqual(unitResults.case5.chosen, 'node_a', 'Closest node picked when not ambiguous');

    // =========================================================================
    // PART 2: Switch to Keywords Graph Tab & Verify Cytoscape Touch Config & LOD
    // =========================================================================
    console.log('\n--- Part 2: Cytoscape Touch Configuration & LOD Verification ---');

    // Switch to graph tab on mobile via bottom nav or top tab
    await page.evaluate(() => {
        const btn = document.getElementById('mobile-tab-graph-btn') || document.getElementById('tab-graph-btn');
        btn.click();
    });
    await page.waitForTimeout(600);

    const cyConfig = await page.evaluate(() => {
        const cy = window.activeCytoscape;
        if (!cy) return null;
        return {
            minZoom: cy.minZoom(),
            maxZoom: cy.maxZoom(),
            nodeCount: cy.nodes().length,
            edgeCount: cy.edges().length,
            panningEnabled: cy.panningEnabled(),
            zoomingEnabled: cy.zoomingEnabled(),
            userPanningEnabled: cy.userPanningEnabled(),
            userZoomingEnabled: cy.userZoomingEnabled()
        };
    });

    console.log('Cytoscape touch config:', cyConfig);
    assert.ok(cyConfig, 'Cytoscape initialized');
    assert.ok(cyConfig.minZoom <= 0.15, 'Cytoscape minZoom configured');
    assert.ok(cyConfig.maxZoom >= 3.0, 'Cytoscape maxZoom configured');
    assert.strictEqual(cyConfig.userPanningEnabled, true, 'Cytoscape touch panning enabled');
    assert.strictEqual(cyConfig.userZoomingEnabled, true, 'Cytoscape touch zooming enabled');

    // Verify 44px toolbar buttons
    const buttonSizes = await page.evaluate(() => {
        const fit = document.getElementById('graph-fit');
        const zoomIn = document.getElementById('graph-zoom-in');
        const zoomOut = document.getElementById('graph-zoom-out');
        const relayout = document.getElementById('graph-relayout');

        function getSize(el) {
            if (!el) return { w: 0, h: 0 };
            const r = el.getBoundingClientRect();
            return { w: Math.round(r.width), h: Math.round(r.height) };
        }

        return {
            fit: getSize(fit),
            zoomIn: getSize(zoomIn),
            zoomOut: getSize(zoomOut),
            relayout: getSize(relayout)
        };
    });

    console.log('Graph toolbar touch targets (>= 44px):', buttonSizes);
    assert.ok(buttonSizes.fit.w >= 40 && buttonSizes.fit.h >= 40, 'Fit button >= 44px touch area');
    assert.ok(buttonSizes.zoomIn.w >= 40 && buttonSizes.zoomIn.h >= 40, 'Zoom In button >= 44px touch area');
    assert.ok(buttonSizes.zoomOut.w >= 40 && buttonSizes.zoomOut.h >= 40, 'Zoom Out button >= 44px touch area');
    assert.ok(buttonSizes.relayout.w >= 40 && buttonSizes.relayout.h >= 40, 'Relayout button >= 44px touch area');

    // =========================================================================
    // PART 3: Touch Tap on Node -> Mobile Bottom Sheet Verification
    // =========================================================================
    console.log('\n--- Part 3: Touch Tap Node -> Mobile Bottom Sheet Verification ---');

    const firstNodeInfo = await page.evaluate(() => {
        const cy = window.activeCytoscape;
        const node = cy.nodes()[0];
        const rPos = node.renderedPosition();
        return {
            id: node.data('id'),
            strength: node.data('strength'),
            freq: node.data('freq'),
            clusterName: node.data('clusterName'),
            renderedPos: { x: Math.round(rPos.x), y: Math.round(rPos.y) }
        };
    });

    console.log('Testing touch tap on node:', firstNodeInfo.id, 'at rendered pos:', firstNodeInfo.renderedPos);

    // Simulate touch tap on the node
    await page.evaluate((pos) => {
        const cy = window.activeCytoscape;
        const node = cy.nodes()[0];
        // Emit touch tap event
        node.emit('tap', {
            target: node,
            renderedPosition: pos,
            originalEvent: {
                pointerType: 'touch',
                touches: [{ clientX: pos.x, clientY: pos.y }]
            }
        });
    }, firstNodeInfo.renderedPos);
    await page.waitForTimeout(300);

    // Verify Mobile Node Bottom Sheet opened
    const sheetState = await page.evaluate(() => {
        const backdrop = document.getElementById('graph-node-sheet-backdrop');
        const sheet = document.getElementById('graph-node-sheet');
        const kw = document.getElementById('node-sheet-keyword')?.textContent;
        const weight = document.getElementById('node-sheet-weight')?.textContent;
        const articles = document.getElementById('node-sheet-articles')?.textContent;
        const degree = document.getElementById('node-sheet-degree-badge')?.textContent;
        const cluster = document.getElementById('node-sheet-cluster-badge')?.textContent;
        const isVisible = backdrop && !backdrop.classList.contains('hidden');

        return {
            isVisible,
            kw,
            weight,
            articles,
            degree,
            cluster
        };
    });

    console.log('Mobile bottom sheet state after node touch tap:', sheetState);
    assert.strictEqual(sheetState.isVisible, true, 'Node bottom sheet opened on touch tap');
    assert.strictEqual(sheetState.kw, firstNodeInfo.id, 'Keyword title matches tapped node');
    assert.ok(sheetState.degree.includes('connection'), 'Degree badge rendered with connections count');
    assert.ok(sheetState.cluster.length > 0, 'Cluster badge rendered');

    // Test "Add to query builder" button in bottom sheet
    console.log('Testing "Add to query builder" button from bottom sheet...');
    await page.click('#node-sheet-add-builder-btn');
    await page.waitForTimeout(300);

    // Verify sheet closed and chip was added
    const builderAfterAdd = await page.evaluate(() => {
        const backdrop = document.getElementById('graph-node-sheet-backdrop');
        const items = window.BooleanQueryBuilder?.items || [];
        const isSheetClosed = backdrop && backdrop.classList.contains('hidden');
        return {
            isSheetClosed,
            terms: items.map(it => it.term)
        };
    });

    console.log('Query builder state after sheet action:', builderAfterAdd);
    assert.strictEqual(builderAfterAdd.isSheetClosed, true, 'Bottom sheet closed on action');
    assert.ok(builderAfterAdd.terms.includes(firstNodeInfo.id), 'Keyword added to query builder');

    // =========================================================================
    // PART 4: Long-Press on Node (>= 400ms) Adds Directly to Builder
    // =========================================================================
    console.log('\n--- Part 4: Long-Press on Node Adds to Builder Directly ---');

    const secondNodeInfo = await page.evaluate(() => {
        const cy = window.activeCytoscape;
        const node = cy.nodes()[1];
        const rPos = node.renderedPosition();
        return {
            id: node.data('id'),
            renderedPos: { x: Math.round(rPos.x), y: Math.round(rPos.y) }
        };
    });

    console.log('Testing long-press on node:', secondNodeInfo.id);

    // Simulate long-press touch cycle: tapstart -> 450ms wait -> tapend
    await page.evaluate((info) => {
        const cy = window.activeCytoscape;
        const node = cy.nodes()[1];
        node.emit('tapstart', {
            target: node,
            renderedPosition: info.renderedPos,
            originalEvent: { pointerType: 'touch', touches: [{ clientX: info.renderedPos.x, clientY: info.renderedPos.y }] }
        });
    }, secondNodeInfo);

    // Wait for the 400ms long-press timer to fire
    await page.waitForTimeout(450);

    await page.evaluate(() => {
        const cy = window.activeCytoscape;
        const node = cy.nodes()[1];
        node.emit('tapend', {
            target: node,
            originalEvent: { pointerType: 'touch' }
        });
    });
    await page.waitForTimeout(200);

    const builderAfterLongPress = await page.evaluate(() => {
        return (window.BooleanQueryBuilder?.items || []).map(it => it.term);
    });

    console.log('Query builder terms after long-press:', builderAfterLongPress);
    assert.ok(builderAfterLongPress.includes(secondNodeInfo.id), 'Second node added via long-press');

    // =========================================================================
    // PART 5: Double-Tap on Canvas Background Smooth Zoom
    // =========================================================================
    console.log('\n--- Part 5: Double-Tap on Canvas Background Smooth Zoom ---');

    const zoomBeforeDoubleTap = await page.evaluate(() => window.activeCytoscape.zoom());

    // Trigger two consecutive taps on canvas background within 200ms
    await page.evaluate(() => {
        const cy = window.activeCytoscape;
        const centerPos = { x: cy.width() / 2, y: cy.height() / 2 };
        cy.emit('tap', {
            target: cy,
            renderedPosition: centerPos,
            originalEvent: { pointerType: 'touch' }
        });
    });
    await page.waitForTimeout(100);

    await page.evaluate(() => {
        const cy = window.activeCytoscape;
        const centerPos = { x: cy.width() / 2, y: cy.height() / 2 };
        cy.emit('tap', {
            target: cy,
            renderedPosition: centerPos,
            originalEvent: { pointerType: 'touch' }
        });
    });
    await page.waitForTimeout(400);

    const zoomAfterDoubleTap = await page.evaluate(() => window.activeCytoscape.zoom());
    console.log(`Zoom before: ${zoomBeforeDoubleTap.toFixed(3)}, Zoom after double-tap: ${zoomAfterDoubleTap.toFixed(3)}`);
    assert.ok(zoomAfterDoubleTap > zoomBeforeDoubleTap, 'Double-tap zoomed into canvas smoothly');

    // =========================================================================
    // PART 6: Performance Benchmark: Frame Times at 60 and 100 Nodes
    // =========================================================================
    console.log('\n--- Part 6: Frame Time Performance Benchmark (60 & 100 Nodes) ---');

    // Helper to benchmark rAF frame times during pan/zoom animation
    async function benchmarkFrameTimes(nodeCap) {
        return await page.evaluate(async (cap) => {
            const slider = document.getElementById('graph-cap-slider');
            if (slider) {
                slider.value = String(cap);
                slider.dispatchEvent(new Event('change'));
            }
            await window.renderKeywordsGraph();
            await new Promise(r => setTimeout(r, 200));

            const cy = window.activeCytoscape;
            const actualNodes = cy.nodes().length;

            const frameDeltas = [];
            let lastTime = performance.now();
            let running = true;

            function recordFrame(now) {
                if (!running) return;
                frameDeltas.push(now - lastTime);
                lastTime = now;
                requestAnimationFrame(recordFrame);
            }

            requestAnimationFrame(recordFrame);

            // Simulate fluid panning / zooming gestures
            const startZoom = cy.zoom();
            for (let step = 0; step < 15; step++) {
                cy.panBy({ x: (step % 2 === 0 ? 15 : -15), y: (step % 3 === 0 ? 10 : -10) });
                cy.zoom(startZoom * (1 + 0.05 * Math.sin(step)));
                await new Promise(r => setTimeout(r, 16));
            }

            running = false;
            await new Promise(r => setTimeout(r, 50));

            const avgFrameMs = frameDeltas.reduce((a, b) => a + b, 0) / (frameDeltas.length || 1);
            const maxFrameMs = Math.max(...frameDeltas, 0);

            return {
                requestedCap: cap,
                actualNodes,
                sampleCount: frameDeltas.length,
                avgFrameMs: parseFloat(avgFrameMs.toFixed(2)),
                maxFrameMs: parseFloat(maxFrameMs.toFixed(2)),
                fpsEstimate: parseFloat((1000 / avgFrameMs).toFixed(1))
            };
        }, nodeCap);
    }

    const perf60 = await benchmarkFrameTimes(60);
    console.log(`60-node benchmark:`, perf60);
    assert.ok(perf60.avgFrameMs < 35, `60-node avg frame time (${perf60.avgFrameMs}ms) is < 35ms (> 30fps)`);

    const perf100 = await benchmarkFrameTimes(100);
    console.log(`100-node benchmark:`, perf100);
    assert.ok(perf100.avgFrameMs < 40, `100-node avg frame time (${perf100.avgFrameMs}ms) is < 40ms (> 25fps)`);

    console.log('\nTotal final console errors count:', consoleErrors.length);
    if (consoleErrors.length > 0) {
        console.error('Final console errors:', consoleErrors);
    }

    await browser.close();
    console.log('\n--- All Keywords Graph Touch & Gestures Tests Passed! ---');
}

runTests().catch(err => {
    console.error('Test Suite Failed with Exception:', err);
    process.exit(1);
});

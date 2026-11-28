// Keywords Co-occurrence Graph via Cytoscape 3.28.1 & Louvain Clustering (Graphology 0.25.4)
import cytoscape from 'cytoscape';
import Graph from 'graphology';
import * as graphologyLibrary from 'graphology-library';
import { db } from './db.js';
import { config } from './config.js';
import { esc } from './parsers.js';

export let activeCytoscape = null;
let activeClusterFilter = null;
let lastDropTimestamp = 0;
let lastBackgroundTapTime = 0;
let lastBackgroundTapPos = { x: 0, y: 0 };
let longPressTimer = null;
let longPressTriggered = false;
let touchStartPos = { x: 0, y: 0 };

export function hitTestNodesAtPoint(renderedPoint, nodesList, hitRadius = config.GRAPH_TOUCH_HIT_RADIUS || 24, ambiguityThreshold = config.GRAPH_AMBIGUITY_THRESHOLD || 8) {
    if (!renderedPoint || !nodesList) return null;
    const candidates = [];
    const px = renderedPoint.x;
    const py = renderedPoint.y;

    const list = Array.isArray(nodesList) ? nodesList : (typeof nodesList.toArray === 'function' ? nodesList.toArray() : Array.from(nodesList));

    list.forEach(n => {
        let pos = null;
        let r = config.GRAPH_MIN_RADIUS;
        let id = '';
        let label = '';

        if (typeof n.renderedPosition === 'function') {
            pos = n.renderedPosition();
            r = (typeof n.renderedWidth === 'function') ? (n.renderedWidth() / 2) : (n.data('radius') || config.GRAPH_MIN_RADIUS);
            id = n.data('id') || n.id();
            label = n.data('label') || id;
        } else if (n.renderedPosition) {
            pos = n.renderedPosition;
            r = n.renderedRadius || n.radius || config.GRAPH_MIN_RADIUS;
            id = n.id || n.data?.id || '';
            label = n.label || n.data?.label || id;
        } else if (n.position) {
            pos = n.position;
            r = n.radius || config.GRAPH_MIN_RADIUS;
            id = n.id || '';
            label = n.label || id;
        }

        if (!pos) return;
        const d = Math.hypot(px - pos.x, py - pos.y);
        const effectiveHitRadius = Math.max(r, hitRadius);
        if (d <= effectiveHitRadius) {
            candidates.push({ node: n, dist: d, id, label });
        }
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.dist - b.dist);

    if (candidates.length === 1) {
        return { ambiguous: false, node: candidates[0].node, candidates, diff: 999 };
    }

    const diff = candidates[1].dist - candidates[0].dist;
    const isAmbiguous = diff < ambiguityThreshold;

    return {
        ambiguous: isAmbiguous,
        node: candidates[0].node,
        candidates,
        diff
    };
}

export function hideDisambiguationPopup() {
    const popup = document.getElementById('graph-disambiguation-popup');
    if (popup) popup.classList.add('hidden');
}

export function showDisambiguationPopup(candidates, pos) {
    const popup = document.getElementById('graph-disambiguation-popup');
    const list = document.getElementById('graph-disambiguation-list');
    const cyWrapper = document.getElementById('cy-wrapper');
    if (!popup || !list || !candidates || candidates.length === 0) return;

    list.innerHTML = candidates.map(c => {
        const data = typeof c.node.data === 'function' ? c.node.data() : (c.node.data || c.node);
        const color = data.color || '#0072B2';
        return `
            <button type="button" class="disambig-choice-btn flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-white text-xs font-medium transition-colors cursor-pointer text-left w-full min-h-[36px]" data-id="${esc(c.id)}">
                <span class="flex items-center gap-1.5 truncate">
                    <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${esc(color)}"></span>
                    <span class="truncate">${esc(c.label || c.id)}</span>
                </span>
                <span class="text-[10px] text-slate-400 font-mono flex-shrink-0">${Math.round(c.dist)}px</span>
            </button>
        `;
    }).join('');

    list.querySelectorAll('.disambig-choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const chosenId = btn.dataset.id;
            hideDisambiguationPopup();
            if (activeCytoscape) {
                const target = activeCytoscape.nodes(`[id = "${chosenId}"]`)[0];
                if (target) openNodeBottomSheet(target);
            }
        });
    });

    if (pos && cyWrapper) {
        const wrapperRect = cyWrapper.getBoundingClientRect();
        let left = Math.min(Math.max(10, pos.x - 60), wrapperRect.width - 200);
        let top = Math.min(Math.max(10, pos.y - 40), wrapperRect.height - 180);
        popup.style.left = `${Math.round(left)}px`;
        popup.style.top = `${Math.round(top)}px`;
    }

    popup.classList.remove('hidden');
}

export function closeNodeBottomSheet() {
    const backdrop = document.getElementById('graph-node-sheet-backdrop');
    if (backdrop) backdrop.classList.add('hidden');
}

export function openNodeBottomSheet(node) {
    if (!node) return;
    const data = typeof node.data === 'function' ? node.data() : (node.data || node);
    const kw = data.id || data.label || '';
    const strength = data.strength !== undefined ? data.strength : 0;
    const freq = data.freq !== undefined ? data.freq : 1;
    const clusterName = data.clusterName || 'Other';
    const color = data.color || '#0072B2';

    let degree = 0;
    const neighbors = [];

    if (typeof node.connectedEdges === 'function') {
        const edges = node.connectedEdges();
        degree = edges.length;
        edges.forEach(edge => {
            const s = edge.source().data('id');
            const t = edge.target().data('id');
            const other = (s === kw) ? t : s;
            const w = edge.data('weight') || 1;
            neighbors.push({ kw: other, weight: w });
        });
        neighbors.sort((a, b) => b.weight - a.weight);
    }

    const backdrop = document.getElementById('graph-node-sheet-backdrop');
    const kwEl = document.getElementById('node-sheet-keyword');
    const weightEl = document.getElementById('node-sheet-weight');
    const articlesEl = document.getElementById('node-sheet-articles');
    const degreeEl = document.getElementById('node-sheet-degree-badge');
    const clusterEl = document.getElementById('node-sheet-cluster-badge');
    const neighborsEl = document.getElementById('node-sheet-neighbors');
    const searchBtn = document.getElementById('node-sheet-search-btn');
    const addBuilderBtn = document.getElementById('node-sheet-add-builder-btn');
    const highlightBtn = document.getElementById('node-sheet-highlight-btn');
    const closeBtn = document.getElementById('node-sheet-close-btn');

    if (kwEl) kwEl.textContent = kw;
    if (weightEl) weightEl.textContent = String(strength);
    if (articlesEl) articlesEl.textContent = String(freq);
    if (degreeEl) degreeEl.textContent = `${degree} connection${degree === 1 ? '' : 's'}`;
    if (clusterEl) {
        clusterEl.textContent = clusterName;
        clusterEl.style.backgroundColor = color;
    }

    if (neighborsEl) {
        if (neighbors.length === 0) {
            neighborsEl.innerHTML = `<span class="text-xs text-slate-400 italic">No connected keywords</span>`;
        } else {
            neighborsEl.innerHTML = neighbors.slice(0, 8).map(n => `
                <button type="button" class="node-neighbor-chip px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 text-xs font-medium border border-slate-200 transition-colors cursor-pointer" data-kw="${esc(n.kw)}">
                    ${esc(n.kw)} <span class="text-slate-400 font-mono text-[10px]">(${n.weight})</span>
                </button>
            `).join('');

            neighborsEl.querySelectorAll('.node-neighbor-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const neighborKw = chip.dataset.kw;
                    if (neighborKw && activeCytoscape) {
                        const neighborNode = activeCytoscape.nodes(`[id = "${neighborKw}"]`);
                        if (neighborNode.length > 0) {
                            openNodeBottomSheet(neighborNode[0]);
                        }
                    }
                });
            });
        }
    }

    if (searchBtn) {
        searchBtn.onclick = () => {
            closeNodeBottomSheet();
            if (typeof window.performSearch === 'function') {
                window.performSearch(kw, { switchTabOnSuccess: true });
            }
        };
    }

    if (addBuilderBtn) {
        addBuilderBtn.onclick = () => {
            closeNodeBottomSheet();
            if (window.BooleanQueryBuilder) {
                window.BooleanQueryBuilder.addKeyword(kw);
            }
        };
    }

    if (highlightBtn) {
        highlightBtn.onclick = () => {
            closeNodeBottomSheet();
            if (activeCytoscape && typeof node.connectedEdges === 'function') {
                activeCytoscape.elements().addClass('dimmed');
                node.removeClass('dimmed').addClass('highlighted');
                node.connectedEdges().removeClass('dimmed').addClass('highlighted');
                node.neighborhood().nodes().removeClass('dimmed').addClass('highlighted');
            }
        };
    }

    if (closeBtn) {
        closeBtn.onclick = () => closeNodeBottomSheet();
    }

    if (backdrop) {
        backdrop.onclick = (e) => {
            if (e.target === backdrop) closeNodeBottomSheet();
        };
        backdrop.classList.remove('hidden');
    }
}

export function destroyCytoscape() {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    if (activeCytoscape) {
        try { activeCytoscape.destroy(); } catch (e) { /* ignore cleanup errors */ }
        activeCytoscape = null;
    }
    hideGraphTooltip();
    hideDisambiguationPopup();
    closeNodeBottomSheet();
    const graphLegend = document.getElementById('graph-legend');
    if (graphLegend) graphLegend.classList.add('hidden');
    const progressOverlay = document.getElementById('graph-progress-overlay');
    if (progressOverlay) progressOverlay.classList.add('hidden');
}

export function computeNodeRadius(strength, sMin, sMax) {
    if (strength === 0) {
        return config.GRAPH_MIN_RADIUS;
    }
    if (sMax === sMin) {
        return Math.round((config.GRAPH_MIN_RADIUS + config.GRAPH_MAX_RADIUS) / 2);
    }
    const ratio = (strength - sMin) / (sMax - sMin);
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    return Math.round(config.GRAPH_MIN_RADIUS + (config.GRAPH_MAX_RADIUS - config.GRAPH_MIN_RADIUS) * Math.sqrt(clampedRatio));
}

export function computeNodeFontSize(radius) {
    const radiusSpan = config.GRAPH_MAX_RADIUS - config.GRAPH_MIN_RADIUS;
    const fontSpan = config.GRAPH_MAX_FONT - config.GRAPH_MIN_FONT;
    const ratio = radiusSpan > 0 ? (radius - config.GRAPH_MIN_RADIUS) / radiusSpan : 0.5;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    return Math.round(config.GRAPH_MIN_FONT + fontSpan * clampedRatio);
}

export function coseNodeRepulsion(node) {
    const size = (node && typeof node.data === 'function') ? (node.data('size') || 40) : 40;
    return config.GRAPH_NODE_REPULSION_BASE + size * config.GRAPH_NODE_REPULSION_FACTOR;
}

export function coseIdealEdgeLength(edge) {
    if (!edge || typeof edge.source !== 'function') return 100;
    const sSize = edge.source().data('size') || 40;
    const tSize = edge.target().data('size') || 40;
    return Math.round(config.GRAPH_IDEAL_EDGE_BASE + (sSize + tSize) * config.GRAPH_IDEAL_EDGE_FACTOR);
}

export function darkenHex(hex, factor = 0.28) {
    if (!hex || typeof hex !== 'string') return '#1d4ed8';
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    let r = parseInt(hex.substring(0, 2), 16) || 0;
    let g = parseInt(hex.substring(2, 4), 16) || 0;
    let b = parseInt(hex.substring(4, 6), 16) || 0;
    r = Math.max(0, Math.floor(r * (1 - factor)));
    g = Math.max(0, Math.floor(g * (1 - factor)));
    b = Math.max(0, Math.floor(b * (1 - factor)));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function runInFileLouvain(nodes, edges) {
    const nodeMap = new Map();
    const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
    sortedNodes.forEach((n, idx) => nodeMap.set(n.id, idx));

    const adj = Array.from({ length: sortedNodes.length }, () => new Map());
    const k = new Array(sortedNodes.length).fill(0);
    let totalWeight = 0;

    edges.forEach(e => {
        const u = nodeMap.get(e.source);
        const v = nodeMap.get(e.target);
        if (u !== undefined && v !== undefined && u !== v) {
            const w = e.weight || 1;
            adj[u].set(v, (adj[u].get(v) || 0) + w);
            adj[v].set(u, (adj[v].get(u) || 0) + w);
            k[u] += w;
            k[v] += w;
            totalWeight += w;
        }
    });

    const m2 = totalWeight * 2;
    if (m2 === 0) {
        const res = {};
        sortedNodes.forEach(n => res[n.id] = 0);
        return res;
    }

    const c = sortedNodes.map((_, idx) => idx);
    const sTot = [...k];

    let improved = true;
    let passes = 0;
    while (improved && passes < 25) {
        improved = false;
        passes++;
        for (let i = 0; i < sortedNodes.length; i++) {
            const curC = c[i];
            const ki = k[i];
            sTot[curC] -= ki;

            const cWeights = new Map();
            for (const [neighbor, w] of adj[i]) {
                const nC = c[neighbor];
                cWeights.set(nC, (cWeights.get(nC) || 0) + w);
            }

            let bestC = curC;
            let bestGain = (cWeights.get(curC) || 0) - (sTot[curC] * ki) / m2;

            for (const [targetC, qIn] of cWeights) {
                const gain = qIn - (sTot[targetC] * ki) / m2;
                if (gain > bestGain) {
                    bestGain = gain;
                    bestC = targetC;
                }
            }

            c[i] = bestC;
            sTot[bestC] += ki;
            if (bestC !== curC) improved = true;
        }
    }

    const res = {};
    sortedNodes.forEach((n, idx) => res[n.id] = c[idx]);
    return res;
}

export function detectCommunitiesLouvain(nodes, edges) {
    const LouvainLib = graphologyLibrary.communitiesLouvain || window.graphologyLibrary?.communitiesLouvain;
    const GraphClass = Graph || window.graphology?.Graph || window.graphology;
    if (GraphClass && LouvainLib) {
        try {
            const g = new GraphClass({ type: 'undirected' });
            const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
            sortedNodes.forEach(n => g.addNode(n.id));
            edges.forEach(e => {
                if (g.hasNode(e.source) && g.hasNode(e.target) && !g.hasEdge(e.source, e.target)) {
                    g.addEdge(e.source, e.target, { weight: e.weight || 1 });
                }
            });
            const comms = LouvainLib(g, {
                getEdgeWeight: 'weight',
                randomWalk: false
            });
            if (comms && Object.keys(comms).length === nodes.length) {
                return comms;
            }
        } catch (err) {
            console.warn('Graphology Louvain failed, using in-file Louvain fallback:', err);
        }
    }
    return runInFileLouvain(nodes, edges);
}

export function processClusters(rawNodes, communities) {
    const rawGroups = {};
    rawNodes.forEach(node => {
        const cId = communities[node.id] !== undefined ? communities[node.id] : -1;
        if (!rawGroups[cId]) rawGroups[cId] = [];
        rawGroups[cId].push(node);
    });

    Object.values(rawGroups).forEach(group => {
        group.sort((a, b) => {
            if (b.strength !== a.strength) return b.strength - a.strength;
            if (b.freq !== a.freq) return b.freq - a.freq;
            return a.id.localeCompare(b.id);
        });
    });

    const candidateGroups = Object.values(rawGroups)
        .filter(g => g.length >= config.GRAPH_MIN_CLUSTER_SIZE)
        .sort((gA, gB) => {
            const sA = gA.reduce((sum, n) => sum + n.strength, 0);
            const sB = gB.reduce((sum, n) => sum + n.strength, 0);
            if (sB !== sA) return sB - sA;
            if (gB.length !== gA.length) return gB.length - gA.length;
            return gA[0].id.localeCompare(gB[0].id);
        });

    const topGroups = candidateGroups.slice(0, config.GRAPH_MAX_CLUSTERS);
    const topGroupSet = new Set(topGroups);

    const clusters = [];
    const nodeClusterMap = new Map();

    topGroups.forEach((group, idx) => {
        const leader = group[0].id;
        const color = config.CLUSTER_PALETTE[idx % config.CLUSTER_PALETTE.length];
        const borderColor = darkenHex(color, 0.28);
        const cluster = {
            id: `cluster_${idx + 1}`,
            name: leader,
            color,
            borderColor,
            nodes: group
        };
        clusters.push(cluster);
        group.forEach(n => nodeClusterMap.set(n.id, cluster));
    });

    const otherNodes = [];
    Object.values(rawGroups).forEach(group => {
        if (!topGroupSet.has(group)) {
            otherNodes.push(...group);
        }
    });

    if (otherNodes.length > 0) {
        const otherCluster = {
            id: 'other',
            name: 'Other',
            color: config.CLUSTER_OTHER_COLOR,
            borderColor: config.CLUSTER_OTHER_BORDER,
            nodes: otherNodes
        };
        clusters.push(otherCluster);
        otherNodes.forEach(n => nodeClusterMap.set(n.id, otherCluster));
    }

    rawNodes.forEach(n => {
        const cl = nodeClusterMap.get(n.id) || {
            id: 'other',
            name: 'Other',
            color: config.CLUSTER_OTHER_COLOR,
            borderColor: config.CLUSTER_OTHER_BORDER
        };
        n.clusterId = cl.id;
        n.clusterName = cl.name;
        n.color = cl.color;
        n.borderColor = cl.borderColor;
    });

    return clusters;
}

export function renderLegend(clusters) {
    const graphLegend = document.getElementById('graph-legend');
    const legendBody = document.getElementById('legend-body');
    const legendToggleBtn = document.getElementById('legend-toggle-btn');
    if (!graphLegend || !legendBody) return;
    activeClusterFilter = null;

    if (!clusters || clusters.length === 0) {
        graphLegend.classList.add('hidden');
        return;
    }
    graphLegend.classList.remove('hidden');

    legendBody.innerHTML = clusters.map(c => `
        <div class="cluster-legend-row flex items-center justify-between gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-slate-100 transition-colors border border-transparent select-none" data-cluster-id="${esc(c.id)}">
            <div class="flex items-center gap-1.5 min-w-0">
                <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${esc(c.color)}; border: 1.5px solid ${esc(c.borderColor)}"></span>
                <span class="font-medium text-slate-700 truncate text-[11px]" title="${esc(c.name)}">${esc(c.name)}</span>
            </div>
            <span class="text-slate-400 font-mono text-[10px] flex-shrink-0">${c.nodes.length}</span>
        </div>
    `).join('');

    legendBody.querySelectorAll('.cluster-legend-row').forEach(row => {
        row.addEventListener('click', (e) => {
            e.stopPropagation();
            const cId = row.dataset.clusterId;
            if (activeClusterFilter === cId) {
                activeClusterFilter = null;
                legendBody.querySelectorAll('.cluster-legend-row').forEach(r => {
                    r.classList.remove('bg-blue-50', 'border-blue-200');
                });
                if (activeCytoscape) {
                    activeCytoscape.elements().removeClass('dimmed highlighted');
                }
            } else {
                activeClusterFilter = cId;
                legendBody.querySelectorAll('.cluster-legend-row').forEach(r => {
                    r.classList.remove('bg-blue-50', 'border-blue-200');
                });
                row.classList.add('bg-blue-50', 'border-blue-200');
                if (activeCytoscape) {
                    activeCytoscape.elements().addClass('dimmed');
                    const clusterNodes = activeCytoscape.nodes(`[clusterId = "${cId}"]`);
                    const clusterEdges = clusterNodes.edgesWith(clusterNodes);
                    clusterNodes.removeClass('dimmed').addClass('highlighted');
                    clusterEdges.removeClass('dimmed').addClass('highlighted');
                }
            }
        });
    });

    const header = graphLegend.querySelector('.legend-header');
    if (header && !header.dataset.listenerAttached) {
        header.dataset.listenerAttached = 'true';
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = legendBody.classList.toggle('hidden');
            if (legendToggleBtn) {
                legendToggleBtn.innerHTML = isHidden
                    ? '<i class="ph-bold ph-caret-down"></i>'
                    : '<i class="ph-bold ph-caret-up"></i>';
            }
        });
    }

    if (!graphLegend.dataset.eventsAttached) {
        graphLegend.dataset.eventsAttached = 'true';
        graphLegend.addEventListener('mousedown', e => e.stopPropagation());
        graphLegend.addEventListener('wheel', e => e.stopPropagation());
    }
}

export function showGraphTooltip(node, pos) {
    const graphTooltip = document.getElementById('graph-tooltip');
    if (!graphTooltip) return;
    const data = node.data();
    graphTooltip.innerHTML = `
        <div class="font-bold text-slate-100 flex items-center gap-1.5 border-b border-slate-700/80 pb-1">
            <span class="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style="background-color: ${esc(data.color)}; border: 1px solid ${esc(data.borderColor)}"></span>
            <span class="truncate">${esc(data.label || data.id)}</span>
        </div>
        <div class="flex items-center justify-between gap-3 text-[11px] text-slate-300 mt-1">
            <span>Co-occurrences:</span>
            <span class="font-semibold text-white font-mono">${esc(data.strength)}</span>
        </div>
        <div class="flex items-center justify-between gap-3 text-[11px] text-slate-300">
            <span>Articles:</span>
            <span class="font-semibold text-white font-mono">${esc(data.freq)}</span>
        </div>
        <div class="flex items-center justify-between gap-3 text-[11px] text-slate-300">
            <span>Primary Topic Cluster:</span>
            <span class="font-medium text-slate-200">${esc(data.clusterName)} <span class="text-slate-400 font-mono text-[10px]">(${esc(data.clusterId)})</span></span>
        </div>
    `;
    updateGraphTooltipPosition(pos);
    graphTooltip.classList.remove('hidden');
}

export function updateGraphTooltipPosition(pos) {
    const graphTooltip = document.getElementById('graph-tooltip');
    const cyWrapper = document.getElementById('cy-wrapper');
    if (!pos || !graphTooltip || !cyWrapper) return;
    const offset = 14;
    const wrapperRect = cyWrapper.getBoundingClientRect();
    let left = pos.x + offset;
    let top = pos.y + offset;

    const tooltipRect = graphTooltip.getBoundingClientRect();
    if (left + tooltipRect.width > wrapperRect.width - 10) {
        left = pos.x - tooltipRect.width - offset;
    }
    if (top + tooltipRect.height > wrapperRect.height - 10) {
        top = pos.y - tooltipRect.height - offset;
    }

    graphTooltip.style.left = `${Math.max(10, Math.round(left))}px`;
    graphTooltip.style.top = `${Math.max(10, Math.round(top))}px`;
}

export function hideGraphTooltip() {
    const graphTooltip = document.getElementById('graph-tooltip');
    if (graphTooltip) graphTooltip.classList.add('hidden');
}

export async function renderKeywordsGraph(selectedQueryId) {
    destroyCytoscape();

    const graphQuerySelect = document.getElementById('graph-query-select');
    const graphCapSlider = document.getElementById('graph-cap-slider');
    const graphMinWeightToggle = document.getElementById('graph-min-weight-toggle');
    const graphEmpty = document.getElementById('graph-empty');
    const graphEmptyTitle = document.getElementById('graph-empty-title');
    const graphEmptyDesc = document.getElementById('graph-empty-desc');
    const legendBody = document.getElementById('legend-body');

    const queries = await db.queries.orderBy('createdAt').reverse().toArray();
    if (!queries.length) {
        if (graphEmpty) {
            graphEmptyTitle.textContent = 'No Graph Data';
            graphEmptyDesc.textContent = 'Run a search to populate queries and build the keyword co-occurrence graph.';
            graphEmpty.classList.remove('hidden');
        }
        return;
    }

    let queryId = selectedQueryId !== undefined ? selectedQueryId : parseInt(graphQuerySelect?.value, 10);
    if (!queryId) {
        queryId = queries[0].id;
    } else if (isNaN(queryId) && queries.length > 0) queryId = queries[0].id;

    if (graphQuerySelect && graphQuerySelect.value !== String(queryId)) {
        graphQuerySelect.value = String(queryId);
    }

    const articles = await db.articles.where('queryId').equals(queryId).toArray();
    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 768;
    let kwCap = graphCapSlider ? parseInt(graphCapSlider.value, 10) : config.DEFAULT_GRAPH_KEYWORD_CAP;
    if (isMobileScreen && graphCapSlider && !graphCapSlider.dataset.userInteracted) {
        kwCap = config.DEFAULT_GRAPH_KEYWORD_CAP_MOBILE || 35;
        graphCapSlider.value = String(kwCap);
        const capValEl = document.getElementById('graph-cap-val');
        if (capValEl) capValEl.textContent = String(kwCap);
    }
    const filterMinWeight = graphMinWeightToggle ? graphMinWeightToggle.checked : false;

    const kwCounts = {};
    articles.forEach(a => {
        (a.keywordsNorm || []).forEach(k => {
            const cleanK = k.trim().toLowerCase();
            if (cleanK) kwCounts[cleanK] = (kwCounts[cleanK] || 0) + 1;
        });
    });

    const uniqueKws = Object.keys(kwCounts);
    if (uniqueKws.length === 0) {
        if (graphEmpty) {
            graphEmptyTitle.textContent = 'No Keywords Available';
            graphEmptyDesc.textContent = 'Articles in this query did not contain any indexed MeSH or author keywords.';
            graphEmpty.classList.remove('hidden');
        }
        return;
    }

    const topKeywordsList = Object.entries(kwCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, kwCap);

    const allowedKeywords = new Set(topKeywordsList.map(item => item[0]));

    const suggestionsList = document.getElementById('qb-keyword-suggestions');
    if (suggestionsList) {
        suggestionsList.innerHTML = topKeywordsList.map(([kw]) => `<option value="${esc(kw)}"></option>`).join('');
    }

    const coOccurrence = new Map();
    articles.forEach(art => {
        const kwsInArt = (art.keywordsNorm || [])
            .map(k => k.trim().toLowerCase())
            .filter(k => allowedKeywords.has(k));

        const uniqueInArt = Array.from(new Set(kwsInArt)).sort();
        for (let i = 0; i < uniqueInArt.length; i++) {
            for (let j = i + 1; j < uniqueInArt.length; j++) {
                const pairKey = `${uniqueInArt[i]}|||${uniqueInArt[j]}`;
                coOccurrence.set(pairKey, (coOccurrence.get(pairKey) || 0) + 1);
            }
        }
    });

    const totalEdgesCount = coOccurrence.size;
    const isDense = totalEdgesCount > config.DENSE_GRAPH_EDGE_THRESHOLD;

    if (graphMinWeightToggle && isDense && !graphMinWeightToggle.dataset.userInteracted) {
        graphMinWeightToggle.checked = true;
    }

    const nodeStrength = {};
    allowedKeywords.forEach(k => nodeStrength[k] = 0);

    const edges = [];
    coOccurrence.forEach((weight, pairKey) => {
        const [source, target] = pairKey.split('|||');
        if (nodeStrength[source] !== undefined) nodeStrength[source] += weight;
        if (nodeStrength[target] !== undefined) nodeStrength[target] += weight;
        edges.push({ source, target, weight });
    });

    const rawNodes = Array.from(allowedKeywords).map(k => ({
        id: k,
        label: k,
        freq: kwCounts[k] || 1,
        strength: nodeStrength[k] || 0
    }));

    // IndexedDB layout cache check
    const cacheKey = `${queryId}_${kwCap}_${filterMinWeight ? 1 : 0}`;
    let cachedLayout = null;
    try {
        if (db && db.graphLayouts) {
            cachedLayout = await db.graphLayouts.get(cacheKey);
        }
    } catch (cacheErr) {
        console.warn('Error reading graphLayouts cache:', cacheErr);
    }

    let communities = cachedLayout?.communities || detectCommunitiesLouvain(rawNodes, edges);
    const clusters = processClusters(rawNodes, communities);

    const strengths = rawNodes.map(n => n.strength);
    const sMin = strengths.length ? Math.min(...strengths) : 0;
    const sMax = strengths.length ? Math.max(...strengths) : 0;

    const cyNodes = rawNodes.map(n => {
        const radius = computeNodeRadius(n.strength, sMin, sMax);
        const fontSize = computeNodeFontSize(radius);
        return {
            group: 'nodes',
            data: {
                id: n.id,
                label: n.label,
                radius: radius,
                size: radius * 2,
                fontSize: `${fontSize}px`,
                color: n.color,
                borderColor: n.borderColor,
                strength: n.strength,
                freq: n.freq,
                clusterId: n.clusterId,
                clusterName: n.clusterName
            }
        };
    });

    const effectiveFilterMinWeight = graphMinWeightToggle ? graphMinWeightToggle.checked : false;
    let maxWeight = 1;
    edges.forEach(e => { if (e.weight > maxWeight) maxWeight = e.weight; });

    const cyEdges = [];
    edges.forEach((e) => {
        if (effectiveFilterMinWeight && e.weight < 2) return;
        const edgeWidth = Math.max(1.5, Math.min(7, 1.5 + 5.5 * ((e.weight - 1) / (maxWeight - 1 || 1))));
        const opacity = Math.max(0.12, Math.min(0.35, 0.12 + 0.23 * ((e.weight - 1) / (maxWeight - 1 || 1))));
        cyEdges.push({
            group: 'edges',
            data: {
                id: `${e.source}__${e.target}`,
                source: e.source,
                target: e.target,
                weight: e.weight,
                edgeWidth: edgeWidth,
                opacity: opacity
            }
        });
    });

    if (graphEmpty) graphEmpty.classList.add('hidden');

    // Layout resolution: Cached -> Web Worker -> Fallback CoSE
    let workerPositions = cachedLayout?.positions || null;

    if (!workerPositions && typeof Worker !== 'undefined') {
        const progressOverlay = document.getElementById('graph-progress-overlay');
        const progressBar = document.getElementById('graph-progress-bar');
        const progressText = document.getElementById('graph-progress-text');

        if (progressOverlay) {
            if (progressBar) progressBar.style.width = '25%';
            if (progressText) progressText.textContent = 'Clustering keywords (Louvain)...';
            progressOverlay.classList.remove('hidden');
        }

        try {
            const workerResult = await new Promise((resolve, reject) => {
                const worker = new Worker(new URL('./graphWorker.js', import.meta.url), { type: 'module' });
                const timer = setTimeout(() => {
                    worker.terminate();
                    reject(new Error('Graph worker timeout'));
                }, 3500);

                worker.onmessage = (msgEvt) => {
                    const msg = msgEvt.data || {};
                    if (msg.type === 'PROGRESS') {
                        if (progressText) progressText.textContent = msg.message;
                        if (progressBar) progressBar.style.width = msg.stage === 'clustering' ? '50%' : '80%';
                    } else if (msg.type === 'COMPLETE') {
                        clearTimeout(timer);
                        worker.terminate();
                        resolve(msg.payload);
                    } else if (msg.type === 'ERROR') {
                        clearTimeout(timer);
                        worker.terminate();
                        reject(new Error(msg.error));
                    }
                };
                worker.onerror = (err) => {
                    clearTimeout(timer);
                    worker.terminate();
                    reject(err);
                };

                const simpleNodes = cyNodes.map(n => ({ id: n.data.id, radius: n.data.radius }));
                const simpleEdges = edges.map(e => ({ source: e.source, target: e.target, weight: e.weight }));
                const cyEl = document.getElementById('cy');
                const width = cyEl?.clientWidth || 800;
                const height = cyEl?.clientHeight || 600;

                worker.postMessage({
                    type: 'COMPUTE_GRAPH',
                    payload: {
                        queryId,
                        cap: kwCap,
                        minWeight: filterMinWeight ? 1 : 0,
                        nodes: simpleNodes,
                        edges: simpleEdges,
                        width,
                        height
                    }
                });
            });

            if (workerResult && workerResult.positions) {
                workerPositions = workerResult.positions;
                try {
                    if (db && db.graphLayouts) {
                        await db.graphLayouts.put({
                            id: cacheKey,
                            queryId,
                            cap: kwCap,
                            minWeight: filterMinWeight ? 1 : 0,
                            positions: workerPositions,
                            communities: workerResult.communities
                        });
                    }
                } catch (e) { /* ignore cache write errors */ }
            }
        } catch (wErr) {
            console.warn('Worker computation fallback to local thread:', wErr);
        } finally {
            if (progressOverlay) {
                if (progressBar) progressBar.style.width = '100%';
                setTimeout(() => progressOverlay.classList.add('hidden'), 150);
            }
        }
    }

    const layoutConfig = workerPositions
        ? {
            name: 'preset',
            positions: (n) => workerPositions[n.id()] || { x: 0, y: 0 },
            padding: 30
        }
        : {
            name: 'cose',
            animate: false,
            nodeRepulsion: coseNodeRepulsion,
            idealEdgeLength: coseIdealEdgeLength,
            padding: 30
        };

    activeCytoscape = cytoscape({
        container: document.getElementById('cy'),
        elements: [...cyNodes, ...cyEdges],
        layout: layoutConfig,
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(label)',
                    'width': 'data(size)',
                    'height': 'data(size)',
                    'background-color': 'data(color)',
                    'border-width': 2,
                    'border-color': 'data(borderColor)',
                    'color': '#0f172a',
                    'font-size': 'data(fontSize)',
                    'font-family': 'Inter, sans-serif',
                    'font-weight': 600,
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'text-outline-width': 2,
                    'text-outline-color': '#ffffff',
                    'text-outline-opacity': 0.9,
                    'min-zoomed-font-size': config.GRAPH_MIN_ZOOMED_FONT_SIZE,
                    'transition-property': 'background-color, border-color, width, height, opacity',
                    'transition-duration': '0.15s'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 'data(edgeWidth)',
                    'opacity': 'data(opacity)',
                    'line-color': '#94a3b8',
                    'curve-style': 'bezier'
                }
            },
            {
                selector: 'node.highlighted',
                style: {
                    'border-width': 4,
                    'border-color': '#0f172a',
                    'z-index': 999,
                    'opacity': 1
                }
            },
            {
                selector: 'edge.highlighted',
                style: {
                    'line-color': '#1e293b',
                    'opacity': 0.9,
                    'z-index': 998
                }
            },
            {
                selector: 'node.dimmed',
                style: {
                    'opacity': 0.15
                }
            },
            {
                selector: 'edge.dimmed',
                style: {
                    'opacity': 0.05
                }
            },
            {
                selector: '.dimmed',
                style: {
                    'opacity': 0.08
                }
            }
        ],
        wheelSensitivity: 0.25,
        minZoom: config.GRAPH_MIN_ZOOM,
        maxZoom: config.GRAPH_MAX_ZOOM,
        touchTapThreshold: config.GRAPH_TOUCH_TAP_THRESHOLD,
        hideEdgesOnViewport: true,
        textureOnViewport: true,
        userPanningEnabled: true,
        userZoomingEnabled: true,
        boxSelectionEnabled: false
    });

    renderLegend(clusters);

    // Toolbar buttons (Zoom In / Out / Fit / Relayout)
    const zoomInBtn = document.getElementById('graph-zoom-in');
    const zoomOutBtn = document.getElementById('graph-zoom-out');
    const fitBtn = document.getElementById('graph-fit');
    const relayoutBtn = document.getElementById('graph-relayout');

    if (zoomInBtn && !zoomInBtn.dataset.wired) {
        zoomInBtn.dataset.wired = 'true';
        zoomInBtn.addEventListener('click', () => {
            if (activeCytoscape) {
                const z = activeCytoscape.zoom();
                activeCytoscape.zoom({ level: Math.min(config.GRAPH_MAX_ZOOM, z * 1.25), renderedPosition: { x: activeCytoscape.width() / 2, y: activeCytoscape.height() / 2 } });
            }
        });
    }
    if (zoomOutBtn && !zoomOutBtn.dataset.wired) {
        zoomOutBtn.dataset.wired = 'true';
        zoomOutBtn.addEventListener('click', () => {
            if (activeCytoscape) {
                const z = activeCytoscape.zoom();
                activeCytoscape.zoom({ level: Math.max(config.GRAPH_MIN_ZOOM, z / 1.25), renderedPosition: { x: activeCytoscape.width() / 2, y: activeCytoscape.height() / 2 } });
            }
        });
    }
    if (fitBtn && !fitBtn.dataset.wired) {
        fitBtn.dataset.wired = 'true';
        fitBtn.addEventListener('click', () => {
            if (activeCytoscape) activeCytoscape.fit(undefined, 30);
        });
    }
    if (relayoutBtn && !relayoutBtn.dataset.wired) {
        relayoutBtn.dataset.wired = 'true';
        relayoutBtn.addEventListener('click', async () => {
            if (db && db.graphLayouts) {
                try {
                    await db.graphLayouts.delete(cacheKey);
                } catch (e) { /* ignore */ }
            }
            renderKeywordsGraph();
        });
    }

    // Helper: detect if event originates from touch
    function isTouchInteraction(e, extra) {
        const oe = e?.originalEvent || extra?.originalEvent || extra;
        if (oe?.pointerType === 'touch' || oe?.pointerType === 'pen') return true;
        if (typeof TouchEvent !== 'undefined' && oe instanceof TouchEvent) return true;
        if (oe?.touches && oe.touches.length > 0) return true;
        if (oe?.changedTouches && oe.changedTouches.length > 0) return true;
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches && oe?.pointerType !== 'mouse') return true;
        if (typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) && oe?.pointerType !== 'mouse' && (!e?.originalEvent || e.originalEvent?.pointerType !== 'mouse')) return true;
        return false;
    }

    // Graph background tap handling (Dismiss popups, Double tap zoom, & Touch hit-test on empty space near nodes)
    activeCytoscape.on('tap', (e, extra) => {
        if (e.target === activeCytoscape) {
            hideDisambiguationPopup();
            hideGraphTooltip();
            if (activeClusterFilter) {
                activeClusterFilter = null;
                if (legendBody) {
                    legendBody.querySelectorAll('.cluster-legend-row').forEach(r => {
                        r.classList.remove('bg-blue-50', 'border-blue-200');
                    });
                }
            }
            activeCytoscape.elements().removeClass('dimmed highlighted');

            const isTouch = isTouchInteraction(e, extra);
            const rPos = e.renderedPosition || extra?.renderedPosition;
            if (isTouch && rPos) {
                // Check if user tapped within 24px screen radius of a node
                const hitResult = hitTestNodesAtPoint(rPos, activeCytoscape.nodes(), config.GRAPH_TOUCH_HIT_RADIUS, config.GRAPH_AMBIGUITY_THRESHOLD);
                if (hitResult && hitResult.node) {
                    if (hitResult.ambiguous && hitResult.candidates.length > 1) {
                        showDisambiguationPopup(hitResult.candidates, rPos);
                    } else {
                        openNodeBottomSheet(hitResult.node);
                    }
                    return;
                }
            }

            // Double tap zoom handling
            const now = Date.now();
            const pos = rPos || { x: 0, y: 0 };
            const dist = Math.hypot(pos.x - lastBackgroundTapPos.x, pos.y - lastBackgroundTapPos.y);
            if (now - lastBackgroundTapTime < 350 && dist < 30) {
                const currentZoom = activeCytoscape.zoom();
                const newZoom = Math.min(config.GRAPH_MAX_ZOOM, currentZoom * config.GRAPH_DOUBLE_TAP_ZOOM_FACTOR);
                activeCytoscape.animate({
                    zoom: newZoom,
                    renderedPosition: pos,
                    duration: 250
                });
                lastBackgroundTapTime = 0;
            } else {
                lastBackgroundTapTime = now;
                lastBackgroundTapPos = { ...pos };
            }
        }
    });

    activeCytoscape.on('mouseover', 'node', (e) => {
        const node = e.target;
        if (!activeClusterFilter) {
            activeCytoscape.elements().addClass('dimmed');
            node.removeClass('dimmed').addClass('highlighted');
            node.connectedEdges().removeClass('dimmed').addClass('highlighted');
            node.neighborhood().nodes().removeClass('dimmed').addClass('highlighted');
        }
        const pos = e.renderedPosition;
        showGraphTooltip(node, pos);
    });

    activeCytoscape.on('mousemove', 'node', (e) => {
        const pos = e.renderedPosition;
        if (pos) updateGraphTooltipPosition(pos);
    });

    activeCytoscape.on('mouseout', 'node', () => {
        hideGraphTooltip();
        if (!activeClusterFilter) {
            activeCytoscape.elements().removeClass('dimmed highlighted');
        }
    });

    // Touch Long-Press detection on nodes (>= 400ms adds directly to builder)
    activeCytoscape.on('tapstart', 'node', (e, extra) => {
        const isTouch = isTouchInteraction(e, extra);
        if (isTouch) {
            longPressTriggered = false;
            const rPos = e.renderedPosition || extra?.renderedPosition || (typeof e.target.renderedPosition === 'function' ? e.target.renderedPosition() : { x: 0, y: 0 });
            touchStartPos = { ...rPos };
            clearTimeout(longPressTimer);
            const node = e.target;
            const kw = node.data('id');
            longPressTimer = setTimeout(() => {
                longPressTriggered = true;
                if (window.BooleanQueryBuilder && kw) {
                    window.BooleanQueryBuilder.addKeyword(kw);
                    if (window.showNotification) {
                        window.showNotification(`Added "${kw}" to Query Builder`, 'success');
                    }
                }
            }, 400);
        }
    });

    activeCytoscape.on('tapdrag', (e) => {
        if (longPressTimer) {
            const pos = e.renderedPosition || { x: 0, y: 0 };
            if (Math.hypot(pos.x - touchStartPos.x, pos.y - touchStartPos.y) > 10) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }
    });

    activeCytoscape.on('tapend', () => {
        clearTimeout(longPressTimer);
    });

    // Drag avatar and node drop handling
    let grabbedNode = null;
    let grabbedNodeOriginalPos = null;
    let dragAvatar = document.getElementById('cy-drag-avatar');

    activeCytoscape.on('grab', 'node', (e) => {
        clearTimeout(longPressTimer);
        hideGraphTooltip();
        grabbedNode = e.target;
        grabbedNodeOriginalPos = { ...grabbedNode.position() };

        if (!dragAvatar) {
            dragAvatar = document.createElement('div');
            dragAvatar.id = 'cy-drag-avatar';
            dragAvatar.className = 'fixed pointer-events-none z-50 bg-blue-600 text-white font-semibold text-xs px-2.5 py-1 rounded-full shadow-lg border border-blue-400 opacity-95 hidden select-none';
            document.body.appendChild(dragAvatar);
        }

        const kw = grabbedNode.data('id');
        let pointerClientX = 0;
        let pointerClientY = 0;

        function updatePointerCoords(pe) {
            pointerClientX = pe.clientX;
            pointerClientY = pe.clientY;
            if (grabbedNode && dragAvatar && !dragAvatar.classList.contains('hidden')) {
                dragAvatar.style.left = `${pointerClientX + 12}px`;
                dragAvatar.style.top = `${pointerClientY + 12}px`;
            }
        }

        window.addEventListener('pointermove', updatePointerCoords, { passive: true });
        window.addEventListener('mousemove', updatePointerCoords, { passive: true });
        window.addEventListener('touchmove', updatePointerCoords, { passive: true });

        const onDragMove = (de) => {
            if (dragAvatar && kw) {
                dragAvatar.textContent = kw;
                dragAvatar.classList.remove('hidden');
                dragAvatar.style.left = `${de.originalEvent.clientX + 12}px`;
                dragAvatar.style.top = `${de.originalEvent.clientY + 12}px`;
            }
            const dropZone = document.getElementById('qb-drop-zone');
            if (dropZone) dropZone.classList.add('border-blue-500', 'bg-blue-50/90', 'ring-2', 'ring-blue-300');
        };

        const handleNodeRelease = (rawEvt) => {
            if (!grabbedNode) return;
            const releasedKw = grabbedNode.data('id');

            window.removeEventListener('pointermove', updatePointerCoords);
            window.removeEventListener('mousemove', updatePointerCoords);
            window.removeEventListener('touchmove', updatePointerCoords);

            if (dragAvatar) dragAvatar.classList.add('hidden');

            const dropZone = document.getElementById('qb-drop-zone');
            if (dropZone) dropZone.classList.remove('border-blue-500', 'bg-blue-50/90', 'ring-2', 'ring-blue-300');

            if (grabbedNodeOriginalPos) {
                grabbedNode.position(grabbedNodeOriginalPos);
                grabbedNodeOriginalPos = null;
            }

            const bar = document.getElementById('query-builder-bar');
            const cx = rawEvt?.clientX || pointerClientX;
            const cy = rawEvt?.clientY || pointerClientY;

            if (bar && cx && cy) {
                const rect = bar.getBoundingClientRect();
                const isInside = (cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom);
                if (isInside && releasedKw) {
                    lastDropTimestamp = Date.now();
                    if (window.BooleanQueryBuilder) {
                        window.BooleanQueryBuilder.addKeyword(releasedKw);
                    }
                }
            }

            grabbedNode = null;
            window.removeEventListener('pointerup', handleNodeRelease, true);
            window.removeEventListener('mouseup', handleNodeRelease, true);
            window.removeEventListener('touchend', handleNodeRelease, true);
        };

        window.addEventListener('pointerup', handleNodeRelease, true);
        window.addEventListener('mouseup', handleNodeRelease, true);
        window.addEventListener('touchend', handleNodeRelease, true);

        grabbedNode.on('drag', onDragMove);
        grabbedNode.once('free', (fe) => {
            handleNodeRelease(fe.originalEvent);
        });
    });

    // Tap on node:
    // BEHAVIOR CHANGE: On touch devices opens bottom sheet (or disambiguation list); long-press adds to builder.
    // On desktop, click maintains existing search/builder action.
    activeCytoscape.on('tap', 'node', (e, extra) => {
        clearTimeout(longPressTimer);
        if (longPressTriggered) {
            longPressTriggered = false;
            return;
        }
        if (Date.now() - lastDropTimestamp < 350) return;

        const node = e.target;
        const kw = node.data('id');
        const isTouch = isTouchInteraction(e, extra);

        if (!isTouch) {
            // Desktop interaction: trigger search / add
            if (typeof window.performSearch === 'function') {
                window.performSearch(kw, { switchTabOnSuccess: true });
            } else if (kw && window.BooleanQueryBuilder) {
                window.BooleanQueryBuilder.addKeyword(kw);
            }
        } else {
            // Touch device tap: check 24px radius ambiguity
            const rPos = e.renderedPosition || extra?.renderedPosition || (typeof node.renderedPosition === 'function' ? node.renderedPosition() : null);
            const hitResult = rPos ? hitTestNodesAtPoint(rPos, activeCytoscape.nodes(), config.GRAPH_TOUCH_HIT_RADIUS, config.GRAPH_AMBIGUITY_THRESHOLD) : null;
            if (hitResult && hitResult.ambiguous && hitResult.candidates.length > 1) {
                showDisambiguationPopup(hitResult.candidates, rPos);
            } else {
                openNodeBottomSheet(node);
            }
        }
    });

    setTimeout(() => {
        if (activeCytoscape) {
            activeCytoscape.fit(undefined, 30);
        }
    }, 100);
}

if (typeof window !== 'undefined') {
    window.cytoscape = cytoscape;
    window.graphology = Graph;
    window.graphologyLibrary = graphologyLibrary;
    window.computeNodeRadius = computeNodeRadius;
    window.computeNodeFontSize = computeNodeFontSize;
    window.coseNodeRepulsion = coseNodeRepulsion;
    window.coseIdealEdgeLength = coseIdealEdgeLength;
    window.darkenHex = darkenHex;
    window.runInFileLouvain = runInFileLouvain;
    window.detectCommunitiesLouvain = detectCommunitiesLouvain;
    window.processClusters = processClusters;
    window.renderLegend = renderLegend;
    window.showGraphTooltip = showGraphTooltip;
    window.updateGraphTooltipPosition = updateGraphTooltipPosition;
    window.hideGraphTooltip = hideGraphTooltip;
    window.renderKeywordsGraph = renderKeywordsGraph;
    window.destroyCytoscape = destroyCytoscape;
    window.hitTestNodesAtPoint = hitTestNodesAtPoint;
    window.openNodeBottomSheet = openNodeBottomSheet;
    window.closeNodeBottomSheet = closeNodeBottomSheet;
    window.showDisambiguationPopup = showDisambiguationPopup;
    window.hideDisambiguationPopup = hideDisambiguationPopup;
    Object.defineProperty(window, 'activeCytoscape', {
        get() { return activeCytoscape; },
        set(v) { activeCytoscape = v; }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeNodeBottomSheet();
            hideDisambiguationPopup();
        }
    });
}

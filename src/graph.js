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

export function destroyCytoscape() {
    if (activeCytoscape) {
        try { activeCytoscape.destroy(); } catch (e) { /* ignore cleanup errors */ }
        activeCytoscape = null;
    }
    hideGraphTooltip();
    const graphLegend = document.getElementById('graph-legend');
    if (graphLegend) graphLegend.classList.add('hidden');
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
    const kwCap = graphCapSlider ? parseInt(graphCapSlider.value, 10) : config.DEFAULT_GRAPH_KEYWORD_CAP;
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

    const communities = detectCommunitiesLouvain(rawNodes, edges);
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

    activeCytoscape = cytoscape({
        container: document.getElementById('cy'),
        elements: [...cyNodes, ...cyEdges],
        layout: {
            name: 'cose',
            animate: false,
            nodeRepulsion: coseNodeRepulsion,
            idealEdgeLength: coseIdealEdgeLength,
            padding: 30
        },
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
        minZoom: 0.1,
        maxZoom: 3.0
    });

    renderLegend(clusters);

    // Graph interactions & Drag-and-drop to Query Builder
    activeCytoscape.on('tap', (e) => {
        if (e.target === activeCytoscape) {
            if (activeClusterFilter) {
                activeClusterFilter = null;
                if (legendBody) {
                    legendBody.querySelectorAll('.cluster-legend-row').forEach(r => {
                        r.classList.remove('bg-blue-50', 'border-blue-200');
                    });
                }
            }
            activeCytoscape.elements().removeClass('dimmed highlighted');
            hideGraphTooltip();
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

    // Drag avatar and node drop handling
    let grabbedNode = null;
    let grabbedNodeOriginalPos = null;
    let dragAvatar = document.getElementById('cy-drag-avatar');

    activeCytoscape.on('grab', 'node', (e) => {
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

    // Tap on node: fallback to add keyword to builder or click search
    activeCytoscape.on('tap', 'node', (e) => {
        if (Date.now() - lastDropTimestamp < 350) return; // Drop just occurred
        const node = e.target;
        const kw = node.data('id');
        if (kw && window.BooleanQueryBuilder) {
            window.BooleanQueryBuilder.addKeyword(kw);
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
    Object.defineProperty(window, 'activeCytoscape', {
        get() { return activeCytoscape; },
        set(v) { activeCytoscape = v; }
    });
}

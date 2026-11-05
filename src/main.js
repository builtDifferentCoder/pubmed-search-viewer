// Application Entry Point - PubMed ResearchMiner
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/bold';
import '@phosphor-icons/web/fill';
import './style.css';
import { config } from './config.js';
import { db } from './db.js';
import * as parsers from './parsers.js';
import * as ncbi from './ncbi.js';
import * as charts from './charts.js';
import * as graph from './graph.js';
import * as builder from './builder.js';
import * as divergence from './divergence.js';
import * as primers from './primers.js';
import * as ui from './ui.js';

// Attach all functions and objects to window for tests and runtime compatibility
if (typeof window !== 'undefined') {
    window.config = config;
    window.db = db;
    Object.assign(window, parsers);
    Object.assign(window, ncbi);
    Object.assign(window, charts);
    Object.assign(window, graph);
    Object.assign(window, builder);
    Object.assign(window, divergence);
    Object.assign(window, primers);
    Object.assign(window, ui);
}

async function handleRoute() {
    const hash = window.location.hash || '';
    const primerDetailPage = document.getElementById('primer-detail-page');
    const tabsNavBar = document.getElementById('tabs-nav-bar');

    if (hash.startsWith('#/primers/')) {
        const topicId = hash.replace('#/primers/', '').trim();
        await primers.showPrimerPage(topicId);
    } else if (hash === '#/primers') {
        if (primerDetailPage) primerDetailPage.classList.add('hidden');
        ui.switchTab('primers');
    } else {
        if (primerDetailPage && !primerDetailPage.classList.contains('hidden')) {
            primerDetailPage.classList.add('hidden');
            if (tabsNavBar) tabsNavBar.classList.remove('hidden');
            ui.switchTab(ui.currentActiveTab || 'results');
        }
    }
}

function initEventHandlers() {
    const form = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const clearAllBtn = document.getElementById('clear-all');
    const tabResultsBtn = document.getElementById('tab-results-btn');
    const tabGraphBtn = document.getElementById('tab-graph-btn');
    const tabPrimersBtn = document.getElementById('tab-primers-btn');

    const graphQuerySelect = document.getElementById('graph-query-select');
    const graphCapSlider = document.getElementById('graph-cap-slider');
    const capDisplay = document.getElementById('cap-display');
    const graphMinWeightToggle = document.getElementById('graph-min-weight-toggle');
    const graphFitBtn = document.getElementById('graph-fit');
    const graphZoomInBtn = document.getElementById('graph-zoom-in');
    const graphZoomOutBtn = document.getElementById('graph-zoom-out');
    const graphRelayoutBtn = document.getElementById('graph-relayout');

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = searchInput ? searchInput.value.trim() : '';
            if (query) ui.performSearch(query, { switchTabOnSuccess: true });
        });
    }

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', async () => {
            if (!confirm('Delete all stored queries and articles?')) return;
            try {
                await db.transaction('rw', db.queries, db.articles, async () => {
                    await db.queries.clear();
                    await db.articles.clear();
                });
                await ui.renderAll();
            } catch (err) {
                console.error('Clear all error:', err);
                ui.showNotification('Could not clear stored data: ' + err.message);
            }
        });
    }

    if (tabResultsBtn) {
        tabResultsBtn.addEventListener('click', () => {
            if (window.location.hash.startsWith('#/primers/')) window.location.hash = '';
            ui.switchTab('results');
        });
    }
    if (tabGraphBtn) {
        tabGraphBtn.addEventListener('click', () => {
            if (window.location.hash.startsWith('#/primers/')) window.location.hash = '';
            ui.switchTab('graph');
        });
    }
    if (tabPrimersBtn) {
        tabPrimersBtn.addEventListener('click', () => {
            if (window.location.hash.startsWith('#/primers/')) window.location.hash = '#/primers';
            ui.switchTab('primers');
        });
    }

    if (graphQuerySelect) {
        graphQuerySelect.addEventListener('change', () => {
            const queryId = parseInt(graphQuerySelect.value, 10);
            if (!isNaN(queryId)) graph.renderKeywordsGraph(queryId);
        });
    }

    if (graphCapSlider) {
        graphCapSlider.addEventListener('input', (e) => {
            if (capDisplay) capDisplay.textContent = e.target.value;
        });
        graphCapSlider.addEventListener('change', () => {
            const queryId = parseInt(graphQuerySelect?.value, 10);
            if (!isNaN(queryId)) graph.renderKeywordsGraph(queryId);
        });
    }

    if (graphMinWeightToggle) {
        graphMinWeightToggle.addEventListener('change', () => {
            graphMinWeightToggle.dataset.userInteracted = 'true';
            const queryId = parseInt(graphQuerySelect?.value, 10);
            if (!isNaN(queryId)) graph.renderKeywordsGraph(queryId);
        });
    }

    if (graphFitBtn) {
        graphFitBtn.addEventListener('click', () => {
            if (graph.activeCytoscape) graph.activeCytoscape.fit(undefined, 30);
        });
    }

    if (graphZoomInBtn) {
        graphZoomInBtn.addEventListener('click', () => {
            if (graph.activeCytoscape) {
                graph.activeCytoscape.zoom({
                    level: graph.activeCytoscape.zoom() * 1.25,
                    renderedPosition: { x: graph.activeCytoscape.width() / 2, y: graph.activeCytoscape.height() / 2 }
                });
            }
        });
    }

    if (graphZoomOutBtn) {
        graphZoomOutBtn.addEventListener('click', () => {
            if (graph.activeCytoscape) {
                graph.activeCytoscape.zoom({
                    level: graph.activeCytoscape.zoom() * 0.8,
                    renderedPosition: { x: graph.activeCytoscape.width() / 2, y: graph.activeCytoscape.height() / 2 }
                });
            }
        });
    }

    if (graphRelayoutBtn) {
        graphRelayoutBtn.addEventListener('click', () => {
            if (graph.activeCytoscape) {
                graph.activeCytoscape.layout({
                    name: 'cose',
                    animate: true,
                    animationDuration: 600,
                    nodeRepulsion: graph.coseNodeRepulsion,
                    idealEdgeLength: graph.coseIdealEdgeLength,
                    padding: 30
                }).run();
            }
        });
    }

    window.addEventListener('hashchange', handleRoute);
}

// App Initialization
async function initApp() {
    initEventHandlers();
    builder.BooleanQueryBuilder.init();
    primers.renderPrimersGrid();
    ui.initDebugPanel();

    try {
        await ui.renderAll();
        if (window.location.hash) {
            await handleRoute();
        } else {
            const searchInput = document.getElementById('search-input');
            if ((await db.queries.count()) === 0 && searchInput && searchInput.value.trim()) {
                await ui.performSearch(searchInput.value.trim());
            }
        }
    } catch (err) {
        console.error('App init error:', err);
        ui.showNotification('Could not initialize application data: ' + err.message);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

export default {
    config,
    db,
    parsers,
    ncbi,
    charts,
    graph,
    builder,
    divergence,
    primers,
    ui
};

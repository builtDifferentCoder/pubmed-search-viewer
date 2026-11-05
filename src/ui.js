// UI Management, Tab Navigation, Query Cards, and ?debug=1 Panel
import { config, COLOR_MAPS } from './config.js';
import { db } from './db.js';
import { esc } from './parsers.js';
import { fetchArticles } from './ncbi.js';
import { buildQueryMetrics, fetchSubset, initCardCharts, destroyAllCharts } from './charts.js';
import { renderKeywordsGraph } from './graph.js';
import { initDivergencePanelForCard } from './divergence.js';
import { renderPrimersGrid } from './primers.js';

export let currentActiveTab = 'results';

export function showLoading(message) {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = message;
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
}

export function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
}

export function showNotification(message, type = 'error') {
    const notificationArea = document.getElementById('notification-area');
    if (!notificationArea) return;
    notificationArea.className = `p-4 rounded-lg border ${
        type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'
    } flex items-center gap-3`;
    const icon = type === 'error' ? '<i class="ph-fill ph-warning-circle text-xl flex-shrink-0"></i>' : '<i class="ph-fill ph-info text-xl flex-shrink-0"></i>';
    notificationArea.innerHTML = `${icon} <p class="font-medium text-sm">${esc(message)}</p>`;
    notificationArea.classList.remove('hidden');
}

export function hideNotification() {
    const notificationArea = document.getElementById('notification-area');
    if (notificationArea) notificationArea.classList.add('hidden');
}

export function switchTab(tabId) {
    const tabResultsBtn = document.getElementById('tab-results-btn');
    const tabGraphBtn = document.getElementById('tab-graph-btn');
    const tabPrimersBtn = document.getElementById('tab-primers-btn');
    const tabResultsView = document.getElementById('tab-results-view');
    const tabGraphView = document.getElementById('tab-graph-view');
    const tabPrimersView = document.getElementById('tab-primers-view');
    const tabsNavBar = document.getElementById('tabs-nav-bar');
    const primerDetailPage = document.getElementById('primer-detail-page');
    const graphQuerySelect = document.getElementById('graph-query-select');

    const TABS = {
        results: { btn: tabResultsBtn, view: tabResultsView },
        graph: { btn: tabGraphBtn, view: tabGraphView },
        primers: { btn: tabPrimersBtn, view: tabPrimersView }
    };
    const TAB_ACTIVE_CLASS = 'px-5 py-2.5 font-semibold text-sm border-b-2 border-blue-600 text-blue-600 flex items-center gap-2 transition-colors';
    const TAB_INACTIVE_CLASS = 'px-5 py-2.5 font-semibold text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center gap-2 transition-colors';

    if (!TABS[tabId]) tabId = 'results';
    currentActiveTab = tabId;

    if (tabsNavBar) tabsNavBar.classList.remove('hidden');
    if (primerDetailPage) primerDetailPage.classList.add('hidden');

    Object.entries(TABS).forEach(([id, cfg]) => {
        const isActive = id === tabId;
        if (cfg.btn) cfg.btn.className = isActive ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS;
        if (cfg.view) {
            if (isActive) cfg.view.classList.remove('hidden');
            else cfg.view.classList.add('hidden');
        }
    });

    if (tabId === 'graph') {
        const selectedQueryId = parseInt(graphQuerySelect?.value, 10);
        if (!isNaN(selectedQueryId)) {
            renderKeywordsGraph(selectedQueryId);
        } else {
            renderKeywordsGraph();
        }
    } else if (tabId === 'primers') {
        renderPrimersGrid();
    }
}

export function rowHtml(a) {
    const url = `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(a.pmid)}/`;
    const kwHtml = a.keywords && a.keywords.length
        ? a.keywords.map(kw => `<span class="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded border border-slate-200 m-0.5">${esc(kw)}</span>`).join('')
        : '<span class="text-slate-400 italic text-xs">None listed</span>';

    let concHtml;
    if (!a.conclusion) {
        concHtml = '<span class="text-slate-400 italic text-xs">No abstract available</span>';
    } else {
        const typeColor = (config.COLOR_MAPS || COLOR_MAPS).conclusion[a.conclusionType] || '#94a3b8';
        const label = a.hasConclusion
            ? `<span class="font-semibold text-slate-800">${esc(a.conclusionLabel)}:</span> `
            : '<span class="font-semibold text-slate-400">Abstract (no conclusion section):</span> ';
        const badge = a.conclusionType && a.conclusionType !== 'None'
            ? `<span class="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mr-1" style="background:${typeColor}20; color:${typeColor}; border: 1px solid ${typeColor}40;">${esc(a.conclusionType)}</span>`
            : '';
        concHtml = `<div class="conc-cell line-clamp-3 cursor-pointer" title="Click to expand/collapse">${badge}${label}${esc(a.conclusion)}</div>`;
    }

    const c = a.citations || 0;
    const badge = c > 0
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-slate-50 text-slate-700 border-slate-200';

    const sampleSizeBadge = a.sampleSize !== null && a.sampleSize !== undefined
        ? `<span class="inline-block text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200" title="Extracted Sample Size">N = ${a.sampleSize} (${esc(a.sampleSizeBucket)})</span>`
        : `<span class="inline-block text-[10px] font-medium bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200">N: Unknown</span>`;

    const queryTagsHtml = (a.matchedQueries && a.matchedQueries.length > 0)
        ? a.matchedQueries.map(mq => `<span class="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 cursor-help" title="${esc(mq.note || '')}">${esc(mq.label)}</span>`).join(' ')
        : '';

    return `
        <tr class="hover:bg-slate-50 transition-colors group">
            <td class="p-4 align-top">
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 font-medium leading-snug hover:underline flex flex-col gap-1">
                    <span>${esc(a.title)}</span>
                    <span class="text-xs text-slate-400 flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"><i class="ph ph-arrow-square-out"></i> View on PubMed</span>
                </a>
                <div class="flex items-center gap-2 flex-wrap mt-2">
                    ${queryTagsHtml}
                    <span class="text-xs text-slate-500 font-mono">PMID: ${esc(a.pmid)}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">${esc(a.studyType)}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">${esc(a.subjectType)}</span>
                    ${sampleSizeBadge}
                </div>
            </td>
            <td class="p-4 align-top whitespace-nowrap text-slate-600 text-xs font-medium">${esc(a.dateStr)}</td>
            <td class="p-4 align-top text-slate-700 leading-relaxed text-sm">${concHtml}</td>
            <td class="p-4 align-top"><div class="flex flex-wrap gap-1">${kwHtml}</div></td>
            <td class="p-4 align-top text-center">
                <span class="inline-flex items-center justify-center border px-3 py-1 rounded-full text-xs font-bold ${badge}">${c}</span>
            </td>
        </tr>`;
}

export function tableHtml(rows) {
    if (!rows.length) {
        return '<div class="p-8 text-center text-slate-500">No articles match this selection.</div>';
    }
    return `
        <div class="overflow-x-auto custom-scrollbar">
            <table class="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                    <tr class="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        <th class="p-4 w-1/3">Title &amp; Meta</th>
                        <th class="p-4 w-28">Published</th>
                        <th class="p-4 w-1/3">Conclusion / Abstract</th>
                        <th class="p-4 w-44">Key Words</th>
                        <th class="p-4 w-24 text-center">Citations</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-sm text-slate-700">${rows.map(rowHtml).join('')}</tbody>
            </table>
        </div>`;
}

export async function renderQueryCard(q) {
    const container = document.getElementById('queries-container');
    if (!container) return;
    const { chartDefs, total, withConc, totalCitations, uniqueKeywords } = await buildQueryMetrics(q.id);

    const card = document.createElement('section');
    card.id = `query-card-${q.id}`;
    card.className = 'bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden';
    card.innerHTML = `
        <div class="p-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 max-w-full flex-1">
                <h3 class="text-base font-semibold text-slate-900 break-words">"${esc(q.term)}"</h3>
                <p class="text-xs text-slate-500 mt-1">
                    Saved ${esc(new Date(q.createdAt).toLocaleString())} &middot;
                    ${total} of ${q.totalCount} matches retrieved
                </p>
            </div>
            <div class="flex items-center gap-2 flex-wrap text-xs">
                <span class="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">${total} articles</span>
                <span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">${withConc} with conclusion</span>
                <span class="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">${totalCitations} total citations</span>
                <span class="px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-medium">${uniqueKeywords} unique keywords</span>
                <button class="delete-btn text-slate-400 hover:text-red-600 px-2 py-1 transition-colors" title="Delete this query"><i class="ph ph-trash text-base"></i></button>
            </div>
        </div>

        <!-- Contradiction Mapping (Divergence) Panel (Phase 2) -->
        <div class="divergence-container border-b border-slate-100 bg-slate-50/50 p-4">
            <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-2">
                    <span class="w-6 h-6 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        <i class="ph-bold ph-arrows-split"></i>
                    </span>
                    <span class="text-xs font-bold text-slate-800">Contradiction Mapping (Divergence)</span>
                    <span class="divergence-badge px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-semibold">0 pairs</span>
                </div>
                <div class="flex items-center gap-3 text-xs">
                    <label class="flex items-center gap-1.5 text-slate-600 font-medium">
                        <span>Min Shared (N):</span>
                        <select class="divergence-n-select border border-slate-200 bg-white rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:border-blue-500">
                            <option value="1">1</option>
                            <option value="2" selected>2 (Default)</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                        </select>
                    </label>
                    <button class="divergence-toggle-btn p-1 hover:bg-slate-200 text-slate-600 rounded transition-colors" title="Toggle Divergence Panel">
                        <i class="ph-bold ph-caret-down text-sm"></i>
                    </button>
                </div>
            </div>
            <div class="divergence-body mt-3 flex flex-col gap-2.5"></div>
        </div>

        <!-- 3 Rows of Bar Charts -->
        <div class="p-5 flex flex-col gap-5">
            <div>
                <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <i class="ph ph-chart-bar"></i> Overview &amp; Study Characteristics
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col">
                        <h4 class="text-xs font-semibold text-slate-700 mb-2 truncate">${esc(chartDefs[0].title)}</h4>
                        <div class="relative h-44 w-full"><canvas id="canvas-${q.id}-0"></canvas></div>
                    </div>
                    <div class="bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col">
                        <h4 class="text-xs font-semibold text-slate-700 mb-2 truncate">${esc(chartDefs[1].title)}</h4>
                        <div class="relative h-44 w-full"><canvas id="canvas-${q.id}-1"></canvas></div>
                    </div>
                    <div class="bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col">
                        <h4 class="text-xs font-semibold text-slate-700 mb-2 truncate">${esc(chartDefs[2].title)}</h4>
                        <div class="relative h-44 w-full"><canvas id="canvas-${q.id}-2"></canvas></div>
                    </div>
                </div>
            </div>

            <div>
                <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <i class="ph ph-sliders"></i> Study Breakdown &amp; Timeline
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col">
                        <h4 class="text-xs font-semibold text-slate-700 mb-2 truncate">${esc(chartDefs[3].title)}</h4>
                        <div class="relative h-44 w-full"><canvas id="canvas-${q.id}-3"></canvas></div>
                    </div>
                    <div class="bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col">
                        <h4 class="text-xs font-semibold text-slate-700 mb-2 truncate">${esc(chartDefs[4].title)}</h4>
                        <div class="relative h-44 w-full"><canvas id="canvas-${q.id}-4"></canvas></div>
                    </div>
                    <div class="bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col">
                        <h4 class="text-xs font-semibold text-slate-700 mb-2 truncate">${esc(chartDefs[5].title)}</h4>
                        <div class="relative h-44 w-full"><canvas id="canvas-${q.id}-5"></canvas></div>
                    </div>
                    <div class="bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col">
                        <h4 class="text-xs font-semibold text-slate-700 mb-2 truncate">${esc(chartDefs[6].title)}</h4>
                        <div class="relative h-44 w-full"><canvas id="canvas-${q.id}-6"></canvas></div>
                    </div>
                </div>
            </div>

            <div>
                <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <i class="ph ph-tag"></i> Keyword Distribution
                </div>
                <div class="grid grid-cols-1 gap-4">
                    <div class="bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col">
                        <h4 class="text-xs font-semibold text-slate-700 mb-2 truncate">${esc(chartDefs[7].title)}</h4>
                        <div class="relative h-52 w-full"><canvas id="canvas-${q.id}-7"></canvas></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Inline Filtered Articles Table -->
        <div class="detail hidden border-t border-slate-200 bg-slate-50/50">
            <div class="detail-head px-5 py-3 flex items-center justify-between text-sm bg-slate-100/60 border-b border-slate-200">
                <span class="detail-title font-semibold text-slate-800 flex items-center gap-2"></span>
                <button class="close-btn text-slate-500 hover:text-slate-800 text-xs font-medium flex items-center gap-1 px-2.5 py-1 rounded hover:bg-slate-200 transition-colors">
                    <i class="ph ph-x"></i> Close details
                </button>
            </div>
            <div class="detail-body bg-white"></div>
        </div>`;
    container.appendChild(card);

    const detail = card.querySelector('.detail');
    const detailTitle = card.querySelector('.detail-title');
    const detailBody = card.querySelector('.detail-body');

    card.querySelector('.close-btn').addEventListener('click', () => detail.classList.add('hidden'));
    card.querySelector('.delete-btn').addEventListener('click', async () => {
        if (!confirm(`Delete stored query "${q.term}"?`)) return;
        try {
            await db.transaction('rw', db.queries, db.articles, async () => {
                await db.articles.where('queryId').equals(q.id).delete();
                await db.queries.delete(q.id);
            });
            await renderAll();
        } catch (err) {
            console.error('Delete error:', err);
            showNotification('Could not delete query: ' + err.message);
        }
    });

    detailBody.addEventListener('click', (e) => {
        const cell = e.target.closest('.conc-cell');
        if (cell) cell.classList.toggle('line-clamp-3');
    });

    initCardCharts(card, q, chartDefs, async (bar) => {
        detail.classList.remove('hidden');
        detailTitle.innerHTML = `<span class="spinner inline-block !w-4 !h-4 !border-2 align-middle mr-1.5"></span> Loading ${esc(bar.label)} articles...`;
        detailBody.innerHTML = '';
        try {
            const rows = await fetchSubset(q.id, bar.filter);
            detailTitle.innerHTML = `<i class="ph ph-funnel text-blue-600"></i> ${esc(bar.label)}: <span class="text-blue-700 font-bold ml-1">${rows.length} article${rows.length === 1 ? '' : 's'}</span>`;
            detailBody.innerHTML = tableHtml(rows);
            detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (err) {
            console.error('Filter query error:', err);
            detailTitle.textContent = 'Error loading articles';
            detailBody.innerHTML = `<div class="p-4 text-red-600 text-sm">Failed to retrieve filtered articles: ${esc(err.message)}</div>`;
        }
    });

    initDivergencePanelForCard(card, q.id);
}

export async function renderAll() {
    destroyAllCharts();
    const container = document.getElementById('queries-container');
    const resultsMeta = document.getElementById('results-meta');
    const graphQuerySelect = document.getElementById('graph-query-select');
    if (!container) return;
    container.innerHTML = '';

    const queries = await db.queries.orderBy('createdAt').reverse().toArray();
    if (resultsMeta) {
        resultsMeta.textContent = queries.length
            ? `${queries.length} stored ${queries.length === 1 ? 'query' : 'queries'}. Click any bar to list the matching articles.`
            : 'No stored queries yet. Run a search to save one.';
    }

    if (graphQuerySelect) {
        graphQuerySelect.innerHTML = '';
        queries.forEach(q => {
            const opt = document.createElement('option');
            opt.value = q.id;
            opt.textContent = `"${q.term}" (${q.retrieved} articles, ${new Date(q.createdAt).toLocaleDateString()})`;
            graphQuerySelect.appendChild(opt);
        });
    }

    if (!queries.length) {
        container.innerHTML = `
            <div class="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
                <i class="ph ph-books text-4xl mb-3 text-slate-300"></i>
                <p class="text-base font-medium">Ready to search PubMed</p>
                <p class="text-sm mt-1">Press "Search &amp; Save" to store results and chart them.</p>
            </div>`;
        if (currentActiveTab === 'graph') {
            renderKeywordsGraph();
        }
        return;
    }

    for (const q of queries) {
        await renderQueryCard(q);
    }

    if (currentActiveTab === 'graph') {
        const currentVal = parseInt(graphQuerySelect?.value, 10);
        await renderKeywordsGraph(isNaN(currentVal) ? queries[0].id : currentVal);
    }
}

export async function performSearch(query, options = {}) {
    hideNotification();
    try {
        const { articles, totalCount } = await fetchArticles(query, showLoading);
        if (articles.length === 0) {
            showNotification(`No articles found for "${query}" in the past ${config.YEARS_BACK} years.`, 'info');
            return false;
        }

        showLoading('Saving to IndexedDB...');
        let newQueryId;
        await db.transaction('rw', db.queries, db.articles, async () => {
            const old = await db.queries.where('term').equals(query).toArray();
            for (const q of old) {
                await db.articles.where('queryId').equals(q.id).delete();
                await db.queries.delete(q.id);
            }
            newQueryId = await db.queries.add({
                term: query, createdAt: Date.now(), totalCount, retrieved: articles.length
            });
            await db.articles.bulkAdd(articles.map(a => ({ ...a, queryId: newQueryId })));
        });

        await renderAll();

        if (options.switchTabOnSuccess) {
            switchTab('results');
            setTimeout(() => {
                const targetCard = document.getElementById(`query-card-${newQueryId}`);
                if (targetCard) targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
        }
        return true;
    } catch (error) {
        console.error('PubMed Search Error:', error);
        showNotification(`An error occurred while fetching data: ${error.message}`);
        return false;
    } finally {
        hideLoading();
    }
}

export function toggleDebugPanel(forceOpen) {
    let panel = document.getElementById('debug-info-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'debug-info-panel';
        panel.className = 'fixed bottom-4 right-4 z-50 bg-slate-900/95 text-white font-mono text-xs p-4 rounded-xl shadow-2xl border border-slate-700 backdrop-blur-md max-w-sm w-80';
        panel.innerHTML = `
            <div class="flex items-center justify-between pb-2 border-b border-slate-700 font-bold text-blue-400">
                <span class="flex items-center gap-1.5"><i class="ph-bold ph-info"></i> System &amp; Build Info</span>
                <button id="debug-panel-close" class="text-slate-400 hover:text-white text-base leading-none px-1">&times;</button>
            </div>
            <div class="mt-2.5 flex flex-col gap-1.5 text-slate-300">
                <div class="flex justify-between"><span class="text-slate-500 font-semibold">App Version:</span> <span class="text-blue-300 font-bold">${esc(config.APP_VERSION)}</span></div>
                <div class="flex justify-between"><span class="text-slate-500 font-semibold">Build Time:</span> <span class="text-slate-200 text-[11px]">${esc(config.BUILD_TIME)}</span></div>
                <div class="flex justify-between"><span class="text-slate-500 font-semibold">NCBI API Key:</span> <span class="${config.NCBI_API_KEY ? 'text-emerald-400' : 'text-amber-400'}">${config.NCBI_API_KEY ? 'Present (110ms gap)' : 'Not set (350ms gap)'}</span></div>
                <div class="flex justify-between"><span class="text-slate-500 font-semibold">NCBI Tool:</span> <span class="text-slate-200">${esc(config.NCBI_TOOL)}</span></div>
                <div class="flex justify-between"><span class="text-slate-500 font-semibold">Database:</span> <span class="text-slate-200">Dexie IndexedDB v3</span></div>
                <div class="flex justify-between"><span class="text-slate-500 font-semibold">Bundle:</span> <span class="text-slate-200">Vite Vanilla ES Modules</span></div>
            </div>
            <div class="mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-500 text-center">
                PubMed ResearchMiner Mobile Foundations
            </div>
        `;
        document.body.appendChild(panel);
        panel.querySelector('#debug-panel-close').addEventListener('click', () => {
            panel.classList.add('hidden');
        });
    }

    if (forceOpen === true) {
        panel.classList.remove('hidden');
    } else if (forceOpen === false) {
        panel.classList.add('hidden');
    } else {
        panel.classList.toggle('hidden');
    }
}

export function initDebugPanel() {
    const params = new URLSearchParams(window.location.search);
    const shouldOpenDefault = params.has('debug') && params.get('debug') !== '0';

    const btnNav = document.getElementById('btn-build-info');
    if (btnNav) {
        btnNav.addEventListener('click', () => toggleDebugPanel());
    }
    const btnFooter = document.getElementById('btn-build-info-footer');
    if (btnFooter) {
        btnFooter.addEventListener('click', () => toggleDebugPanel());
    }

    if (shouldOpenDefault) {
        toggleDebugPanel(true);
    }
}

if (typeof window !== 'undefined') {
    window.switchTab = switchTab;
    window.renderAll = renderAll;
    window.performSearch = performSearch;
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    window.showNotification = showNotification;
    window.hideNotification = hideNotification;
    window.tableHtml = tableHtml;
    window.rowHtml = rowHtml;
    Object.defineProperty(window, 'currentActiveTab', {
        get() { return currentActiveTab; },
        set(v) { currentActiveTab = v; }
    });
}

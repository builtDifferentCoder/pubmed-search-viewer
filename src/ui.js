// UI Management, Tab Navigation, Query Cards, Mobile Layout & Bottom Sheet
import { config, COLOR_MAPS } from './config.js';
import { db } from './db.js';
import { esc } from './parsers.js';
import { fetchArticles } from './ncbi.js';
import { buildQueryMetrics, fetchSubset, initCardCharts, destroyAllCharts, renderAccessibleChartTable } from './charts.js';
import { renderKeywordsGraph } from './graph.js';
import { initDivergencePanelForCard } from './divergence.js';
import { renderPrimersGrid } from './primers.js';
import { renderHelpButton } from './help.js';

export let currentActiveTab = 'results';

// Mobile Bottom Sheet State
export let bottomSheetState = {
    title: '',
    articles: [],
    page: 1,
    pageSize: config.BOTTOM_SHEET_PAGE_SIZE || 5
};

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
    if (!notificationArea) return;
    notificationArea.classList.add('hidden');
}

export function switchTab(tabId) {
    const tabResultsBtn = document.getElementById('tab-results-btn');
    const tabGraphBtn = document.getElementById('tab-graph-btn');
    const tabPrimersBtn = document.getElementById('tab-primers-btn');
    const mobileResultsBtn = document.getElementById('mobile-tab-results-btn');
    const mobileGraphBtn = document.getElementById('mobile-tab-graph-btn');
    const mobilePrimersBtn = document.getElementById('mobile-tab-primers-btn');

    const tabResultsView = document.getElementById('tab-results-view');
    const tabGraphView = document.getElementById('tab-graph-view');
    const tabPrimersView = document.getElementById('tab-primers-view');
    const tabsNavBar = document.getElementById('tabs-nav-bar');
    const primerDetailPage = document.getElementById('primer-detail-page');
    const graphQuerySelect = document.getElementById('graph-query-select');

    const TABS = {
        results: { btn: tabResultsBtn, mBtn: mobileResultsBtn, view: tabResultsView },
        graph: { btn: tabGraphBtn, mBtn: mobileGraphBtn, view: tabGraphView },
        primers: { btn: tabPrimersBtn, mBtn: mobilePrimersBtn, view: tabPrimersView }
    };
    const TAB_ACTIVE_CLASS = 'px-5 py-2.5 font-semibold text-sm border-b-2 border-blue-600 text-blue-600 flex items-center gap-2 transition-colors';
    const TAB_INACTIVE_CLASS = 'px-5 py-2.5 font-semibold text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center gap-2 transition-colors';

    const MOBILE_ACTIVE_CLASS = 'flex flex-col items-center justify-center flex-1 py-1 text-blue-600 font-bold transition-colors cursor-pointer';
    const MOBILE_INACTIVE_CLASS = 'flex flex-col items-center justify-center flex-1 py-1 text-slate-500 hover:text-slate-800 font-medium transition-colors cursor-pointer';

    if (!TABS[tabId]) tabId = 'results';
    currentActiveTab = tabId;

    if (tabsNavBar) tabsNavBar.classList.remove('hidden');
    if (primerDetailPage) primerDetailPage.classList.add('hidden');

    Object.entries(TABS).forEach(([id, cfg]) => {
        const isActive = id === tabId;
        if (cfg.btn) cfg.btn.className = isActive ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS;
        if (cfg.mBtn) cfg.mBtn.className = isActive ? MOBILE_ACTIVE_CLASS : MOBILE_INACTIVE_CLASS;
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

// Mobile Bottom Sheet Implementation
export function openMobileBottomSheet(title, articles = []) {
    bottomSheetState.title = title;
    bottomSheetState.articles = articles;
    bottomSheetState.page = 1;

    const backdrop = document.getElementById('mobile-bottom-sheet-backdrop');
    const titleEl = document.getElementById('bottom-sheet-title');
    if (titleEl) titleEl.textContent = title;
    renderBottomSheetPage(1);

    if (backdrop) backdrop.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
}

export function closeMobileBottomSheet() {
    const backdrop = document.getElementById('mobile-bottom-sheet-backdrop');
    if (backdrop) backdrop.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

export function renderBottomSheetPage(page = 1) {
    const bodyEl = document.getElementById('bottom-sheet-body');
    const pageInfo = document.getElementById('bottom-sheet-page-info');
    const prevBtn = document.getElementById('bottom-sheet-prev-btn');
    const nextBtn = document.getElementById('bottom-sheet-next-btn');
    if (!bodyEl) return;

    const { articles, pageSize } = bottomSheetState;
    const totalPages = Math.ceil(articles.length / pageSize) || 1;
    page = Math.max(1, Math.min(page, totalPages));
    bottomSheetState.page = page;

    if (pageInfo) pageInfo.textContent = `Page ${page} of ${totalPages} (${articles.length} article${articles.length === 1 ? '' : 's'})`;
    if (prevBtn) prevBtn.disabled = (page <= 1);
    if (nextBtn) nextBtn.disabled = (page >= totalPages);

    if (!articles.length) {
        bodyEl.innerHTML = '<div class="p-8 text-center text-slate-500">No articles found.</div>';
        return;
    }

    const start = (page - 1) * pageSize;
    const pageItems = articles.slice(start, start + pageSize);

    bodyEl.innerHTML = pageItems.map(a => {
        const url = `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(a.pmid)}/`;
        const kwHtml = a.keywords && a.keywords.length
            ? a.keywords.map(kw => `<span class="inline-block bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded border border-slate-200 mr-1 mb-1">${esc(kw)}</span>`).join('')
            : '<span class="text-slate-400 italic text-[11px]">None listed</span>';

        const typeColor = (config.COLOR_MAPS || COLOR_MAPS).conclusion[a.conclusionType] || '#94a3b8';
        const concBadge = a.conclusionType && a.conclusionType !== 'None'
            ? `<span class="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mr-1" style="background:${typeColor}20; color:${typeColor}; border: 1px solid ${typeColor}40;">${esc(a.conclusionType)}</span>`
            : '';
        const concText = a.conclusion
            ? `<p class="text-xs text-slate-600 leading-relaxed mt-1"><span class="font-semibold text-slate-700">${esc(a.conclusionLabel || 'Abstract')}:</span> ${esc(a.conclusion)}</p>`
            : '<p class="text-xs text-slate-400 italic mt-1">No abstract available</p>';

        return `
            <div class="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col gap-2">
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-blue-600 hover:text-blue-800 leading-snug hover:underline flex items-start justify-between gap-2">
                    <span>${esc(a.title)}</span>
                    <i class="ph ph-arrow-square-out text-sm flex-shrink-0 text-slate-400"></i>
                </a>
                <div class="flex items-center gap-1.5 flex-wrap text-[10px]">
                    <span class="text-slate-500 font-mono">PMID: ${esc(a.pmid)}</span>
                    <span class="text-slate-400">&bull;</span>
                    <span class="text-slate-600">${esc(a.dateStr)}</span>
                    <span class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">${esc(a.studyType)}</span>
                    <span class="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">${esc(a.subjectType)}</span>
                    <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold">${a.citations || 0} citations</span>
                </div>
                <div class="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                    <div class="flex items-center gap-1">${concBadge}</div>
                    ${concText}
                </div>
                <div class="flex flex-wrap items-center pt-1">
                    ${kwHtml}
                </div>
            </div>
        `;
    }).join('');
}

export function initMobileBottomSheetHandlers() {
    const backdrop = document.getElementById('mobile-bottom-sheet-backdrop');
    const closeBtn = document.getElementById('bottom-sheet-close-btn');
    const prevBtn = document.getElementById('bottom-sheet-prev-btn');
    const nextBtn = document.getElementById('bottom-sheet-next-btn');

    if (closeBtn) closeBtn.addEventListener('click', closeMobileBottomSheet);
    if (prevBtn) prevBtn.addEventListener('click', () => renderBottomSheetPage(bottomSheetState.page - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => renderBottomSheetPage(bottomSheetState.page + 1));

    if (backdrop) {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeMobileBottomSheet();
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && backdrop && !backdrop.classList.contains('hidden')) {
            closeMobileBottomSheet();
        }
    });
}

// Mobile Pull-to-Refresh
export function initPullToRefresh() {
    const ptrIndicator = document.getElementById('pull-to-refresh-indicator');
    const ptrIcon = document.getElementById('ptr-icon');
    const ptrText = document.getElementById('ptr-text');
    if (!ptrIndicator || !ptrIcon || !ptrText) return;

    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    const threshold = config.PULL_TO_REFRESH_THRESHOLD_PX || 70;

    window.addEventListener('touchstart', (e) => {
        if (window.scrollY <= 0 && currentActiveTab === 'results') {
            startY = e.touches[0].clientY;
            isPulling = true;
        } else {
            isPulling = false;
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 10 && window.scrollY <= 0) {
            ptrIndicator.classList.remove('hidden');
            const pullDist = Math.min(diff * 0.5, 90);
            ptrIndicator.style.transform = `translateY(${pullDist}px)`;
            if (pullDist >= threshold * 0.5) {
                ptrIcon.classList.add('rotate-180');
                ptrText.textContent = 'Release to refresh...';
            } else {
                ptrIcon.classList.remove('rotate-180');
                ptrText.textContent = 'Pull down to refresh...';
            }
        }
    }, { passive: true });

    window.addEventListener('touchend', async () => {
        if (!isPulling) return;
        isPulling = false;
        const diff = currentY - startY;
        startY = 0;
        currentY = 0;
        const pullDist = diff * 0.5;
        if (pullDist >= threshold * 0.5 && window.scrollY <= 0) {
            ptrText.textContent = 'Refreshing...';
            ptrIcon.className = 'ph ph-arrows-clockwise animate-spin text-base';
            try {
                await renderAll();
            } finally {
                setTimeout(() => {
                    ptrIndicator.classList.add('hidden');
                    ptrIndicator.style.transform = '';
                    ptrIcon.className = 'ph ph-arrow-down text-base transition-transform duration-200';
                    ptrText.textContent = 'Pull down to refresh...';
                }, 400);
            }
        } else {
            ptrIndicator.classList.add('hidden');
            ptrIndicator.style.transform = '';
            ptrIcon.classList.remove('rotate-180');
        }
    }, { passive: true });
}

// Skeleton Loaders
export function showSkeletonLoaders() {
    const container = document.getElementById('queries-container');
    if (!container) return;
    container.innerHTML = `
        <div class="skeleton-loader bg-white border border-slate-200 rounded-xl p-5 shadow-xs animate-pulse flex flex-col gap-4">
            <div class="flex items-center justify-between">
                <div class="h-5 bg-slate-200 rounded w-1/3"></div>
                <div class="h-4 bg-slate-200 rounded w-20"></div>
            </div>
            <div class="h-3 bg-slate-100 rounded w-1/2"></div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div class="h-40 bg-slate-100 rounded-lg"></div>
                <div class="h-40 bg-slate-100 rounded-lg"></div>
                <div class="h-40 bg-slate-100 rounded-lg"></div>
            </div>
        </div>
    `;
}

export function hideSkeletonLoaders() {
    const skeletons = document.querySelectorAll('.skeleton-loader');
    skeletons.forEach(s => s.remove());
}

// Helper: Chart Help Buttons Mapping
function getHelpButtonsForChart(idx) {
    switch (idx) {
        case 0:
            return renderHelpButton('chart_total');
        case 1:
            return renderHelpButton('chart_conclusion') + renderHelpButton('conclusion_tags');
        case 2:
            return renderHelpButton('chart_sample_size') + renderHelpButton('sample_size_buckets');
        case 3:
            return renderHelpButton('chart_citations');
        case 4:
            return renderHelpButton('chart_study_type');
        case 5:
            return renderHelpButton('chart_subject_type');
        case 6:
            return renderHelpButton('chart_pub_year');
        case 7:
            return renderHelpButton('chart_keywords');
        default:
            return '';
    }
}

export async function renderQueryCard(q) {
    const container = document.getElementById('queries-container');
    if (!container) return;
    const { chartDefs, total, withConc, totalCitations, uniqueKeywords } = await buildQueryMetrics(q.id);

    const posBar = chartDefs[1]?.bars?.find(b => b.label.toLowerCase() === 'positive');
    const posCount = posBar ? posBar.count : 0;
    const topStudy = chartDefs[4]?.bars?.[0]?.label || 'Diverse';

    const acc1Summary = `${total} articles \u2022 ${posCount} positive`;
    const acc2Summary = `${totalCitations} citations \u2022 ${topStudy}`;
    const acc3Summary = `${uniqueKeywords} unique keywords`;

    const accordionGroups = [
        {
            id: 'articles',
            title: '(1) Articles & Conclusions',
            icon: 'ph-article',
            summary: acc1Summary,
            indices: [0, 1, 2]
        },
        {
            id: 'impact',
            title: '(2) Impact & Design',
            icon: 'ph-trend-up',
            summary: acc2Summary,
            indices: [3, 4, 5, 6]
        },
        {
            id: 'keywords',
            title: '(3) Keywords',
            icon: 'ph-tag',
            summary: acc3Summary,
            indices: [7]
        }
    ];

    // Accordion persistence state per query
    const storageKey = `pubmed_miner_accordion_${q.id}`;
    let openAccordions = [config.DEFAULT_OPEN_ACCORDION || 'articles'];
    try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                openAccordions = parsed;
            } else if (typeof parsed === 'string') {
                openAccordions = [parsed];
            }
        }
    } catch (e) {
        console.warn('Could not read accordion state from localStorage', e);
    }

    const card = document.createElement('section');
    card.id = `query-card-${q.id}`;
    card.className = 'bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden';

    // Build Desktop Charts Grid HTML
    const desktopChartsHtml = `
        <div class="desktop-charts hidden md:flex flex-col gap-5 p-5">
            <div>
                <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <i class="ph ph-chart-bar"></i> Overview &amp; Study Characteristics
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    ${[0, 1, 2].map(idx => `
                        <div class="chart-card-box bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col">
                            <div class="flex items-center justify-between gap-1 mb-2">
                                <div class="flex items-center gap-1 min-w-0">
                                    <h4 class="text-xs font-semibold text-slate-700 truncate">${esc(chartDefs[idx].title)}</h4>
                                    ${getHelpButtonsForChart(idx)}
                                </div>
                                <button type="button" class="view-as-table-btn text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors cursor-pointer" aria-expanded="false" title="Toggle table view">
                                    <i class="ph ph-table"></i><span>Table</span>
                                </button>
                            </div>
                            <div class="chart-canvas-wrapper relative h-44 w-full">
                                <canvas id="canvas-${q.id}-${idx}"></canvas>
                            </div>
                            <div class="chart-table-wrapper hidden overflow-y-auto max-h-44 custom-scrollbar border border-slate-200 rounded bg-white mt-1">
                                ${renderAccessibleChartTable(chartDefs[idx], total)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div>
                <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <i class="ph ph-sliders"></i> Study Breakdown &amp; Timeline
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    ${[3, 4, 5, 6].map(idx => `
                        <div class="chart-card-box bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col">
                            <div class="flex items-center justify-between gap-1 mb-2">
                                <div class="flex items-center gap-1 min-w-0">
                                    <h4 class="text-xs font-semibold text-slate-700 truncate">${esc(chartDefs[idx].title)}</h4>
                                    ${getHelpButtonsForChart(idx)}
                                </div>
                                <button type="button" class="view-as-table-btn text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors cursor-pointer" aria-expanded="false" title="Toggle table view">
                                    <i class="ph ph-table"></i><span>Table</span>
                                </button>
                            </div>
                            <div class="chart-canvas-wrapper relative h-44 w-full">
                                <canvas id="canvas-${q.id}-${idx}"></canvas>
                            </div>
                            <div class="chart-table-wrapper hidden overflow-y-auto max-h-44 custom-scrollbar border border-slate-200 rounded bg-white mt-1">
                                ${renderAccessibleChartTable(chartDefs[idx], total)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div>
                <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <i class="ph ph-tag"></i> Keyword Distribution
                </div>
                <div class="grid grid-cols-1 gap-4">
                    ${[7].map(idx => `
                        <div class="chart-card-box bg-slate-50/70 border border-slate-200 rounded-lg p-3 flex flex-col">
                            <div class="flex items-center justify-between gap-1 mb-2">
                                <div class="flex items-center gap-1 min-w-0">
                                    <h4 class="text-xs font-semibold text-slate-700 truncate">${esc(chartDefs[idx].title)}</h4>
                                    ${getHelpButtonsForChart(idx)}
                                </div>
                                <button type="button" class="view-as-table-btn text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors cursor-pointer" aria-expanded="false" title="Toggle table view">
                                    <i class="ph ph-table"></i><span>Table</span>
                                </button>
                            </div>
                            <div class="chart-canvas-wrapper relative h-52 w-full">
                                <canvas id="canvas-${q.id}-${idx}"></canvas>
                            </div>
                            <div class="chart-table-wrapper hidden overflow-y-auto max-h-52 custom-scrollbar border border-slate-200 rounded bg-white mt-1">
                                ${renderAccessibleChartTable(chartDefs[idx], total)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Build Mobile Accordions HTML
    const mobileAccordionsHtml = `
        <div class="mobile-charts flex md:hidden flex-col gap-3 p-4">
            ${accordionGroups.map(group => {
                const isOpen = openAccordions.includes(group.id);
                const slidesHtml = group.indices.map(idx => `
                    <div class="carousel-slide flex-shrink-0 w-[88%] bg-slate-50/70 border border-slate-200 rounded-xl p-3 flex flex-col snap-center">
                        <div class="flex items-center justify-between gap-1 mb-2">
                            <div class="flex items-center gap-1 min-w-0">
                                <h4 class="text-xs font-semibold text-slate-700 truncate">${esc(chartDefs[idx].title)}</h4>
                                ${getHelpButtonsForChart(idx)}
                            </div>
                            <button type="button" class="view-as-table-btn text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors cursor-pointer" aria-expanded="false" title="Toggle table view">
                                <i class="ph ph-table"></i><span>Table</span>
                            </button>
                        </div>
                        <div class="chart-canvas-wrapper relative h-48 w-full">
                            <canvas id="canvas-m-${q.id}-${idx}"></canvas>
                        </div>
                        <div class="chart-table-wrapper hidden overflow-y-auto max-h-48 custom-scrollbar border border-slate-200 rounded bg-white mt-1">
                            ${renderAccessibleChartTable(chartDefs[idx], total)}
                        </div>
                    </div>
                `).join('');

                const dotsHtml = group.indices.map((idx, i) => `
                    <button type="button" class="carousel-dot h-2 rounded-full transition-all duration-200 ${i === 0 ? 'w-5 bg-blue-600' : 'w-2 bg-slate-300'}" data-slide-index="${i}" aria-label="Go to chart ${i + 1}"></button>
                `).join('');

                return `
                    <div class="mobile-accordion border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs" data-accordion-id="${group.id}">
                        <button type="button" class="accordion-header w-full flex items-center justify-between p-3.5 min-h-[48px] bg-slate-50 hover:bg-slate-100/80 transition-colors text-left cursor-pointer" aria-expanded="${isOpen ? 'true' : 'false'}">
                            <div class="flex flex-col gap-0.5 min-w-0 pr-2">
                                <div class="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                                    <i class="ph ${group.icon} text-blue-600 text-sm"></i>
                                    <span>${group.title}</span>
                                </div>
                                <span class="accordion-summary text-[11px] text-slate-500 truncate">${group.summary}</span>
                            </div>
                            <i class="accordion-chevron ph ph-caret-down text-slate-400 text-base transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}"></i>
                        </button>
                        <div class="accordion-content p-3.5 pt-2 border-t border-slate-100 ${isOpen ? '' : 'hidden'}">
                            <div class="carousel-container relative">
                                <div class="carousel-track flex overflow-x-auto snap-x snap-mandatory gap-3 no-scrollbar pb-1" style="-webkit-overflow-scrolling: touch;">
                                    ${slidesHtml}
                                </div>
                                <div class="carousel-dots flex items-center justify-center gap-1.5 pt-2.5">
                                    ${dotsHtml}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    card.innerHTML = `
        <div class="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 max-w-full flex-1">
                <h3 class="text-base font-semibold text-slate-900 break-words">"${esc(q.term)}"</h3>
                <p class="text-xs text-slate-500 mt-1">
                    Saved ${esc(new Date(q.createdAt).toLocaleString())} &middot;
                    ${total} of ${q.totalCount} matches retrieved
                </p>
            </div>

            <!-- Desktop Badges & Delete (md:flex) -->
            <div class="hidden md:flex items-center gap-2 flex-wrap text-xs">
                <span class="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">${total} articles</span>
                <span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">${withConc} with conclusion</span>
                <span class="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">${totalCitations} total citations</span>
                <span class="px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-medium">${uniqueKeywords} unique keywords</span>
                <button class="delete-btn text-slate-400 hover:text-red-600 px-2 py-1 transition-colors cursor-pointer" title="Delete this query"><i class="ph ph-trash text-base"></i></button>
            </div>

            <!-- Mobile Badges & Overflow Menu (< 768px: flex md:hidden) -->
            <div class="flex md:hidden items-center justify-between w-full gap-2 pt-1 border-t border-slate-50">
                <div class="flex items-center gap-1.5 flex-wrap text-[11px]">
                    <span class="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">${total} articles</span>
                    <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">${withConc} conclusions</span>
                </div>
                <div class="relative overflow-menu-wrapper">
                    <button type="button" class="overflow-menu-btn w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors cursor-pointer" aria-label="Query options menu" aria-expanded="false">
                        <i class="ph-bold ph-dots-three-vertical text-lg"></i>
                    </button>
                    <div class="overflow-dropdown hidden absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1.5 text-xs">
                        <button type="button" class="overflow-action-rerun w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                            <i class="ph ph-arrows-clockwise text-blue-600"></i> Re-run Search
                        </button>
                        <button type="button" class="overflow-action-share w-full text-left px-3.5 py-2 text-slate-400 flex items-center justify-between cursor-not-allowed opacity-60" disabled title="Coming soon">
                            <span class="flex items-center gap-2"><i class="ph ph-share-network"></i> Share*</span>
                            <span class="text-[9px] uppercase px-1 py-0.5 bg-slate-100 rounded text-slate-400 font-bold">Soon</span>
                        </button>
                        <button type="button" class="overflow-action-export w-full text-left px-3.5 py-2 text-slate-400 flex items-center justify-between cursor-not-allowed opacity-60" disabled title="Coming soon">
                            <span class="flex items-center gap-2"><i class="ph ph-export"></i> Export*</span>
                            <span class="text-[9px] uppercase px-1 py-0.5 bg-slate-100 rounded text-slate-400 font-bold">Soon</span>
                        </button>
                        <div class="my-1 border-t border-slate-100"></div>
                        <button type="button" class="overflow-action-delete delete-btn w-full text-left px-3.5 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600 font-medium cursor-pointer">
                            <i class="ph ph-trash"></i> Delete
                        </button>
                    </div>
                </div>
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
                    ${renderHelpButton('divergence')}
                    <span class="divergence-badge px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-semibold">0 pairs</span>
                </div>
                <div class="flex items-center gap-3 text-xs">
                    <label class="flex items-center gap-1.5 text-slate-600 font-medium">
                        <span>Min Shared (N):</span>
                        ${renderHelpButton('divergence_min_shared')}
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

        <!-- Desktop Charts View (3 Rows) -->
        ${desktopChartsHtml}

        <!-- Mobile Accordions View -->
        ${mobileAccordionsHtml}

        <!-- Inline Filtered Articles Table (Desktop Click Target) -->
        <div class="detail hidden border-t border-slate-200 bg-slate-50/50">
            <div class="detail-head px-5 py-3 flex items-center justify-between text-sm bg-slate-100/60 border-b border-slate-200">
                <span class="detail-title font-semibold text-slate-800 flex items-center gap-2"></span>
                <button class="close-btn text-slate-500 hover:text-slate-800 text-xs font-medium flex items-center gap-1 px-2.5 py-1 rounded hover:bg-slate-200 transition-colors cursor-pointer">
                    <i class="ph ph-x"></i> Close details
                </button>
            </div>
            <div class="detail-body bg-white"></div>
        </div>
    `;

    container.appendChild(card);

    const detail = card.querySelector('.detail');
    const detailTitle = card.querySelector('.detail-title');
    const detailBody = card.querySelector('.detail-body');

    // Wire up Detail Close button
    const closeBtn = card.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => detail.classList.add('hidden'));
    }

    // Wire up Delete buttons (desktop + mobile)
    card.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
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
    });

    // Wire up Mobile Overflow Menu
    const overflowBtn = card.querySelector('.overflow-menu-btn');
    const overflowDropdown = card.querySelector('.overflow-dropdown');
    if (overflowBtn && overflowDropdown) {
        overflowBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = overflowDropdown.classList.contains('hidden');
            if (isHidden) {
                overflowDropdown.classList.remove('hidden');
                overflowBtn.setAttribute('aria-expanded', 'true');
            } else {
                overflowDropdown.classList.add('hidden');
                overflowBtn.setAttribute('aria-expanded', 'false');
            }
        });

        document.addEventListener('click', (e) => {
            if (!overflowDropdown.contains(e.target) && e.target !== overflowBtn) {
                overflowDropdown.classList.add('hidden');
                overflowBtn.setAttribute('aria-expanded', 'false');
            }
        });

        const rerunBtn = card.querySelector('.overflow-action-rerun');
        if (rerunBtn) {
            rerunBtn.addEventListener('click', () => {
                overflowDropdown.classList.add('hidden');
                performSearch(q.term, { switchTabOnSuccess: true });
            });
        }
    }

    // Wire up Accordions toggle & persistence
    card.querySelectorAll('.mobile-accordion').forEach(accEl => {
        const headerBtn = accEl.querySelector('.accordion-header');
        const content = accEl.querySelector('.accordion-content');
        const chevron = accEl.querySelector('.accordion-chevron');
        const accId = accEl.dataset.accordionId;

        if (headerBtn && content) {
            headerBtn.addEventListener('click', () => {
                const isCurrentlyOpen = !content.classList.contains('hidden');
                if (isCurrentlyOpen) {
                    content.classList.add('hidden');
                    if (chevron) chevron.classList.remove('rotate-180');
                    headerBtn.setAttribute('aria-expanded', 'false');
                    openAccordions = openAccordions.filter(id => id !== accId);
                } else {
                    content.classList.remove('hidden');
                    if (chevron) chevron.classList.add('rotate-180');
                    headerBtn.setAttribute('aria-expanded', 'true');
                    if (!openAccordions.includes(accId)) openAccordions.push(accId);

                    // Resize charts in this accordion
                    if (window.activeCharts) {
                        window.activeCharts.forEach(c => {
                            if (c.canvas && content.contains(c.canvas)) {
                                try { c.resize(); } catch (err) {}
                            }
                        });
                    }
                }

                try {
                    localStorage.setItem(storageKey, JSON.stringify(openAccordions));
                } catch (e) {
                    console.warn('Could not save accordion state to localStorage', e);
                }
            });
        }

        // Wire up Carousel Dots & Scroll listener
        const track = accEl.querySelector('.carousel-track');
        const dots = accEl.querySelectorAll('.carousel-dot');
        const slides = accEl.querySelectorAll('.carousel-slide');

        dots.forEach((dot, dotIdx) => {
            dot.addEventListener('click', () => {
                const slide = slides[dotIdx];
                if (slide && track) {
                    track.scrollTo({
                        left: slide.offsetLeft - track.offsetLeft,
                        behavior: 'smooth'
                    });
                }
            });
        });

        if (track && dots.length > 1) {
            let scrollFrame = null;
            track.addEventListener('scroll', () => {
                if (scrollFrame) cancelAnimationFrame(scrollFrame);
                scrollFrame = requestAnimationFrame(() => {
                    const scrollLeft = track.scrollLeft;
                    let closestIdx = 0;
                    let minDiff = Infinity;
                    slides.forEach((slide, sIdx) => {
                        const diff = Math.abs((slide.offsetLeft - track.offsetLeft) - scrollLeft);
                        if (diff < minDiff) {
                            minDiff = diff;
                            closestIdx = sIdx;
                        }
                    });
                    dots.forEach((d, dIdx) => {
                        if (dIdx === closestIdx) {
                            d.className = 'carousel-dot h-2 rounded-full transition-all duration-200 w-5 bg-blue-600';
                        } else {
                            d.className = 'carousel-dot h-2 rounded-full transition-all duration-200 w-2 bg-slate-300';
                        }
                    });
                });
            }, { passive: true });
        }
    });

    // Wire up "View as table" Toggle Buttons (both desktop cards and mobile slides)
    card.querySelectorAll('.view-as-table-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const parent = btn.closest('.chart-card-box') || btn.closest('.carousel-slide');
            if (!parent) return;
            const canvasWrapper = parent.querySelector('.chart-canvas-wrapper');
            const tableWrapper = parent.querySelector('.chart-table-wrapper');
            if (!canvasWrapper || !tableWrapper) return;

            const isTableCurrentlyVisible = !tableWrapper.classList.contains('hidden');
            if (isTableCurrentlyVisible) {
                tableWrapper.classList.add('hidden');
                canvasWrapper.classList.remove('hidden');
                btn.innerHTML = '<i class="ph ph-table"></i><span>Table</span>';
                btn.setAttribute('aria-expanded', 'false');
            } else {
                canvasWrapper.classList.add('hidden');
                tableWrapper.classList.remove('hidden');
                btn.innerHTML = '<i class="ph ph-chart-bar"></i><span>Chart</span>';
                btn.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // Inline Detail Table click to expand conclusion
    if (detailBody) {
        detailBody.addEventListener('click', (e) => {
            const cell = e.target.closest('.conc-cell');
            if (cell) cell.classList.toggle('line-clamp-3');
        });
    }

    // Initialize Desktop + Mobile Charts
    initCardCharts(
        card,
        q,
        chartDefs,
        // Desktop click handler -> inline .detail table
        async (bar) => {
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
        },
        // Mobile bar click handler -> Slide-up Bottom Sheet
        async (bar) => {
            openMobileBottomSheet(`${bar.label} Articles`, []);
            const bodyEl = document.getElementById('bottom-sheet-body');
            if (bodyEl) {
                bodyEl.innerHTML = '<div class="p-8 text-center text-slate-500 flex items-center justify-center gap-2"><span class="spinner inline-block !w-4 !h-4 !border-2 align-middle"></span><span>Loading articles...</span></div>';
            }
            try {
                const rows = await fetchSubset(q.id, bar.filter);
                bottomSheetState.articles = rows;
                renderBottomSheetPage(1);
            } catch (err) {
                console.error('Mobile bottom sheet filter error:', err);
                if (bodyEl) {
                    bodyEl.innerHTML = `<div class="p-4 text-red-600 text-xs">Failed to retrieve articles: ${esc(err.message)}</div>`;
                }
            }
        }
    );

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
    showSkeletonLoaders();
    try {
        const { articles, totalCount } = await fetchArticles(query, showLoading);
        if (articles.length === 0) {
            hideSkeletonLoaders();
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
        hideSkeletonLoaders();
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
    window.openMobileBottomSheet = openMobileBottomSheet;
    window.closeMobileBottomSheet = closeMobileBottomSheet;
    window.renderBottomSheetPage = renderBottomSheetPage;
    window.initPullToRefresh = initPullToRefresh;
    window.initMobileBottomSheetHandlers = initMobileBottomSheetHandlers;
    window.showSkeletonLoaders = showSkeletonLoaders;
    window.hideSkeletonLoaders = hideSkeletonLoaders;
    Object.defineProperty(window, 'currentActiveTab', {
        get() { return currentActiveTab; },
        set(v) { currentActiveTab = v; }
    });
}

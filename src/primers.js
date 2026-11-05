// Search Primers Multi-Query Orchestration, Hash Routing & Caching
import { config } from './config.js';
import { db } from './db.js';
import { esearchPmids, hydrate } from './ncbi.js';
import { esc } from './parsers.js';

export const PRIMER_TOPICS = [
    {
        id: 'mens-health',
        title: "Men's Health",
        description: "Evidence-based interventions covering endocrine support, botanicals, resistance training, cardiovascular modulators, and systemic inflammation.",
        queries: [
            { q: '("Vitamin D" OR "Zinc") AND "testosterone" AND "male"', note: 'Endocrine and hormonal support interventions targeting male micronutrient deficiencies' },
            { q: '("Ashwagandha" OR "Fenugreek") AND "testosterone"', note: 'Botanical and herbal therapies evaluated for male hormonal and sexual health' },
            { q: '"Creatine monohydrate" AND "resistance training" AND "muscle mass"', note: 'Ergogenic aids and physical activity optimization; sarcopenia and hypertrophy' },
            { q: '"L-arginine" AND "erectile dysfunction"', note: 'Cardiovascular and dietary modulators for vascular support and sexual function' },
            { q: '"Omega-3 fatty acids" AND "inflammation" AND "cardiovascular"', note: 'Anti-inflammatory dietary interventions for systemic inflammation and vascular health' }
        ]
    },
    {
        id: 'longevity',
        title: 'Longevity',
        description: 'Key longevity science literature across caloric restriction, Mediterranean diet, exercise, psychosocial factors, and sleep/circadian biology.',
        queries: [
            { q: '("Caloric restriction" OR "intermittent fasting") AND ("longevity" OR "healthspan")', note: 'Dietary timing and energy restriction; metabolic pathways and cellular senescence in aging' },
            { q: '"Mediterranean diet" AND ("longevity" OR "mortality") AND "healthy aging"', note: 'Evidence-based nutritional patterns linked to reduced all-cause mortality and cardiovascular protection' },
            { q: '("Physical activity" OR "exercise") AND "all-cause mortality" AND "aging"', note: 'Aerobic and resistance training, lifespan, sarcopenia prevention, morbidity reduction' },
            { q: '("Social isolation" OR "loneliness") AND "mortality" AND "public health"', note: 'Psychosocial determinants: community integration and social support linked to survival' },
            { q: '("Sleep quality" OR "circadian rhythm") AND "aging" AND "healthspan"', note: 'Restorative, neuroprotective and chronobiological factors in age-related decline' }
        ]
    }
];

export async function fetchPrimerArticles(topic, bypassCache = false) {
    if (!bypassCache) {
        try {
            const cached = await db.primerRuns.get(topic.id);
            if (cached && (Date.now() - cached.timestamp) < config.PRIMER_CACHE_TTL_MS) {
                return { ...cached, isCached: true };
            }
        } catch (e) {
            console.warn('Error reading primer cache:', e);
        }
    }

    const pmidMap = new Map();
    const queryHitCounts = [];
    const queries = topic.queries;

    for (let i = 0; i < queries.length; i++) {
        const qObj = queries[i];
        const qNum = i + 1;
        const label = `Q${qNum}`;

        const loadingEl = document.getElementById('primer-loading-msg');
        if (loadingEl) {
            loadingEl.textContent = `Running query ${qNum} of ${queries.length}: ${label}...`;
        }

        if (i > 0) {
            await new Promise(r => setTimeout(r, config.PRIMER_REQUEST_GAP_MS));
        }

        const { pmids, totalCount } = await esearchPmids(qObj.q, config.PRIMER_MAX_PER_QUERY, true);
        queryHitCounts.push({
            label,
            q: qObj.q,
            note: qObj.note,
            count: totalCount,
            returned: pmids.length
        });

        pmids.forEach(pmid => {
            if (!pmidMap.has(pmid)) {
                pmidMap.set(pmid, []);
            }
            pmidMap.get(pmid).push({ label, note: qObj.note, index: qNum });
        });
    }

    const unionPmids = Array.from(pmidMap.keys());
    let articles = [];

    if (unionPmids.length > 0) {
        const loadingEl = document.getElementById('primer-loading-msg');
        if (loadingEl) {
            loadingEl.textContent = `Hydrating ${unionPmids.length} unique articles via NCBI E-utilities...`;
        }

        articles = await hydrate(unionPmids, true);
        articles.forEach(art => {
            art.matchedQueries = pmidMap.get(art.pmid) || [];
        });

        articles.sort((a, b) => {
            const matchDiff = (b.matchedQueries?.length || 0) - (a.matchedQueries?.length || 0);
            if (matchDiff !== 0) return matchDiff;
            return (b.citations || 0) - (a.citations || 0);
        });
    }

    const runRecord = {
        topicId: topic.id,
        timestamp: Date.now(),
        articles,
        queryHitCounts,
        totalCount: unionPmids.length
    };

    try {
        await db.primerRuns.put(runRecord);
    } catch (e) {
        console.warn('Failed to cache primer run:', e);
    }

    return { ...runRecord, isCached: false };
}

export function renderPrimersGrid() {
    const grid = document.getElementById('primers-grid');
    if (!grid) return;
    grid.innerHTML = PRIMER_TOPICS.map(topic => `
        <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between cursor-pointer group" onclick="window.location.hash='#/primers/${esc(topic.id)}'">
            <div>
                <div class="flex items-center justify-between mb-3">
                    <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <i class="ph-fill ph-compass"></i>
                    </div>
                    <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">${topic.queries.length} Queries</span>
                </div>
                <h3 class="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">${esc(topic.title)}</h3>
                <p class="text-sm text-slate-600 mt-2 leading-relaxed">${esc(topic.description)}</p>
            </div>
            <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600 group-hover:text-blue-700">
                <span>Open Domain Primer</span>
                <i class="ph-bold ph-arrow-right group-hover:translate-x-1 transition-transform"></i>
            </div>
        </div>
    `).join('');
}

export async function showPrimerPage(topicId, bypassCache = false) {
    const topic = PRIMER_TOPICS.find(t => t.id === topicId);
    const tabsNavBar = document.getElementById('tabs-nav-bar');
    const primerDetailPage = document.getElementById('primer-detail-page');
    const searchInput = document.getElementById('search-input');

    if (tabsNavBar) tabsNavBar.classList.add('hidden');
    const tabViews = [
        document.getElementById('tab-results-view'),
        document.getElementById('tab-graph-view'),
        document.getElementById('tab-primers-view')
    ];
    tabViews.forEach(v => v?.classList.add('hidden'));

    if (primerDetailPage) primerDetailPage.classList.remove('hidden');

    if (!topic) {
        if (primerDetailPage) {
            primerDetailPage.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-xl p-8 text-center">
                    <i class="ph ph-warning-circle text-4xl text-amber-500 mb-3"></i>
                    <h3 class="text-lg font-semibold text-slate-800">Topic Not Found</h3>
                    <p class="text-sm text-slate-500 mt-1 mb-4">No search primer found matching "${esc(topicId)}".</p>
                    <a href="#/primers" class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        <i class="ph ph-arrow-left"></i> Return to Search Primers
                    </a>
                </div>`;
        }
        return;
    }

    if (primerDetailPage) {
        primerDetailPage.innerHTML = `
            <div class="flex flex-col gap-6">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <a href="#/primers" class="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                        <i class="ph-bold ph-arrow-left"></i> Back to Search Primers
                    </a>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-slate-500 bg-slate-200 px-3 py-1 rounded-full flex items-center gap-1 shadow-inner">
                            <i class="ph ph-calendar-blank"></i> Past 5 Years Filter Applied (NCBI reldate)
                        </span>
                        <button id="primer-refresh-btn" class="text-xs font-semibold text-slate-700 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors">
                            <i class="ph ph-arrows-clockwise text-sm"></i> Refresh
                        </button>
                    </div>
                </div>

                <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <div class="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <span class="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">Domain Primer</span>
                            <h2 class="text-2xl font-bold text-slate-900 mt-2">${esc(topic.title)}</h2>
                            <p class="text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">${esc(topic.description)}</p>
                        </div>
                        <div id="primer-header-stats" class="flex flex-wrap items-center gap-2 text-xs">
                            <span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">Cap: ${config.PRIMER_MAX_PER_QUERY} / query</span>
                        </div>
                    </div>

                    <details class="mt-5 border border-slate-200 rounded-lg bg-slate-50/70 overflow-hidden group">
                        <summary class="px-4 py-3 text-xs font-semibold text-slate-700 cursor-pointer flex items-center justify-between hover:bg-slate-100/70 transition-colors select-none">
                            <span class="flex items-center gap-2">
                                <i class="ph-fill ph-list-magnifying-glass text-blue-600 text-sm"></i>
                                <span>5 Pre-set Queries (Exact strings &amp; focus notes)</span>
                            </span>
                            <span class="text-slate-400 group-open:rotate-180 transition-transform">
                                <i class="ph-bold ph-caret-down text-xs"></i>
                            </span>
                        </summary>
                        <div class="p-4 border-t border-slate-200 divide-y divide-slate-200/70 bg-white">
                            ${topic.queries.map((q, idx) => `
                                <div class="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-xs">
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px]">Q${idx + 1}</span>
                                            <code class="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] break-all">${esc(q.q)}</code>
                                            <button type="button" class="primer-query-search-btn bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 shadow-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" data-topic-id="${esc(topic.id)}" data-query-index="${idx}" title="Run this query in Search Results">
                                                <i class="ph-bold ph-magnifying-glass text-xs"></i>
                                                <span>Search</span>
                                            </button>
                                        </div>
                                        <p class="text-slate-500 mt-1 pl-7 text-[11px] italic">${esc(q.note)}</p>
                                    </div>
                                    <div id="primer-q-hit-${idx + 1}" class="text-slate-600 font-medium pl-7 sm:pl-0 sm:text-right whitespace-nowrap text-[11px] flex-shrink-0">
                                        Pending fetch...
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </details>
                </div>

                <div id="primer-hit-counts-strip" class="hidden bg-blue-50/70 border border-blue-200/80 px-4 py-2.5 rounded-lg text-xs text-slate-700 flex items-center flex-wrap gap-x-4 gap-y-1"></div>

                <div id="primer-results-container" class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div class="p-12 flex flex-col items-center justify-center text-slate-600">
                        <div class="spinner mb-4"></div>
                        <p class="font-medium text-sm animate-pulse" id="primer-loading-msg">Executing sequential NCBI queries with rate limiting...</p>
                    </div>
                </div>
            </div>`;

        const refreshBtn = primerDetailPage.querySelector('#primer-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                showPrimerPage(topicId, true);
            });
        }

        primerDetailPage.querySelectorAll('.primer-query-search-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (btn.disabled) return;

                const tId = btn.dataset.topicId;
                const qIdx = parseInt(btn.dataset.queryIndex, 10);
                const tObj = PRIMER_TOPICS.find(t => t.id === tId);
                const targetQuery = tObj?.queries?.[qIdx]?.q;
                if (!targetQuery) return;

                const allSearchBtns = primerDetailPage.querySelectorAll('.primer-query-search-btn');
                allSearchBtns.forEach(b => { b.disabled = true; });

                if (searchInput) searchInput.value = targetQuery;
                if (window.showLoading) window.showLoading(`Searching PubMed for "${targetQuery}"...`);

                try {
                    const success = window.performSearch ? await window.performSearch(targetQuery, { switchTabOnSuccess: true }) : false;
                    if (success) {
                        window.location.hash = '#/';
                    }
                } catch (err) {
                    console.error('Primer query search execution error:', err);
                    if (window.showNotification) window.showNotification(`Search error: ${err.message}`, 'error');
                } finally {
                    allSearchBtns.forEach(b => { b.disabled = false; });
                    if (window.hideLoading) window.hideLoading();
                }
            });
        });

        try {
            const run = await fetchPrimerArticles(topic, bypassCache);
            const statsEl = primerDetailPage.querySelector('#primer-header-stats');
            const hitStrip = primerDetailPage.querySelector('#primer-hit-counts-strip');
            const resultsContainer = primerDetailPage.querySelector('#primer-results-container');

            if (statsEl) {
                statsEl.innerHTML = `
                    <span class="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">${run.articles.length} unique articles</span>
                    <span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">${run.isCached ? 'Cached (last 24h)' : 'Freshly fetched'}</span>
                `;
            }

            (run.queryHitCounts || []).forEach((h, idx) => {
                const hitEl = primerDetailPage.querySelector(`#primer-q-hit-${idx + 1}`);
                if (hitEl) {
                    hitEl.innerHTML = `<span class="text-blue-700 font-semibold">${h.count} hits</span> <span class="text-slate-400">(${h.returned} retrieved)</span>`;
                }
            });

            if (hitStrip && run.queryHitCounts && run.queryHitCounts.length > 0) {
                hitStrip.innerHTML = `
                    <div class="flex items-center gap-1.5 font-semibold text-slate-800">
                        <i class="ph-fill ph-check-circle text-emerald-600"></i> Query Hits:
                    </div>
                    ${run.queryHitCounts.map(h => `<span><span class="font-bold text-blue-700">${esc(h.label)}:</span> ${h.count} hits <span class="text-slate-400">(${h.returned} retrieved)</span></span>`).join('<span class="text-slate-300">&bull;</span>')}
                `;
                hitStrip.classList.remove('hidden');
            }

            if (resultsContainer && window.tableHtml) {
                resultsContainer.innerHTML = window.tableHtml(run.articles);
                resultsContainer.addEventListener('click', (e) => {
                    const cell = e.target.closest('.conc-cell');
                    if (cell) cell.classList.toggle('line-clamp-3');
                });
            }
        } catch (err) {
            console.error('Error loading primer:', err);
            const resultsContainer = primerDetailPage.querySelector('#primer-results-container');
            if (resultsContainer) {
                resultsContainer.innerHTML = `
                    <div class="p-8 text-center text-red-600">
                        <i class="ph ph-warning-circle text-4xl mb-3 text-red-400"></i>
                        <p class="text-base font-semibold">Error Loading Primer Articles</p>
                        <p class="text-sm mt-1 text-slate-600">${esc(err.message)}</p>
                        <button id="primer-retry-btn" class="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors">
                            Retry
                        </button>
                    </div>`;
                const retryBtn = resultsContainer.querySelector('#primer-retry-btn');
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => showPrimerPage(topicId, true));
                }
            }
        }
    }
}

if (typeof window !== 'undefined') {
    window.PRIMER_TOPICS = PRIMER_TOPICS;
    window.fetchPrimerArticles = fetchPrimerArticles;
    window.showPrimerPage = showPrimerPage;
    window.renderPrimersGrid = renderPrimersGrid;
}

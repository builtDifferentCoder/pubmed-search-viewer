// 8 Biomedical Metric Charts via Chart.js 4.4.1 (vendored npm package)
import Chart from 'chart.js/auto';
import { db } from './db.js';
import { config, CONCLUSION_TYPES, SAMPLE_SIZE_BUCKETS, CITE_BUCKETS, STUDY_TYPES, SUBJECT_TYPES, COLOR_MAPS } from './config.js';
import { esc } from './parsers.js';

export let activeCharts = [];

export function destroyAllCharts() {
    activeCharts.forEach(c => {
        try { c.destroy(); } catch (e) { /* ignore cleanup errors */ }
    });
    activeCharts.length = 0;
}

export function generateChartAriaSummary(def) {
    if (!def || !def.bars) return '';
    const parts = def.bars.map(b => `${b.label}: ${b.count}`);
    return `${def.title} chart. ${parts.join(', ')}`;
}

export function renderAccessibleChartTable(def, totalArticles = 0) {
    if (!def || !def.bars) return '';
    const totalCount = def.bars.reduce((sum, b) => sum + (b.count || 0), 0) || totalArticles || 1;
    return `
    <table class="w-full text-left border-collapse text-xs bg-white rounded-lg border border-slate-200 overflow-hidden" role="table" aria-label="${esc(def.title)} data table">
        <thead>
            <tr class="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
                <th class="p-2">Category</th>
                <th class="p-2 text-right">Count</th>
                <th class="p-2 text-right">Percent</th>
            </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
            ${def.bars.map(bar => {
                const pct = totalCount > 0 ? Math.round(((bar.count || 0) / totalCount) * 100) : 0;
                return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-2 font-medium text-slate-800 flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${bar.color || '#3b82f6'};"></span>
                        <span class="truncate">${esc(bar.label)}</span>
                    </td>
                    <td class="p-2 text-right font-mono font-semibold text-slate-700">${bar.count || 0}</td>
                    <td class="p-2 text-right font-mono text-slate-500">${pct}%</td>
                </tr>`;
            }).join('')}
        </tbody>
    </table>`;
}

function showMobileExactValuePill(canvasEl, text) {
    let pill = document.getElementById('mobile-chart-pill');
    if (!pill) {
        pill = document.createElement('div');
        pill.id = 'mobile-chart-pill';
        pill.className = 'fixed z-50 pointer-events-none bg-slate-900/95 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-xl transition-all duration-200 border border-slate-700/80';
        document.body.appendChild(pill);
    }
    const rect = canvasEl.getBoundingClientRect();
    pill.textContent = text;
    pill.style.left = `${Math.max(10, rect.left + (rect.width / 2) - 80)}px`;
    pill.style.top = `${Math.max(10, rect.top - 36)}px`;
    pill.classList.remove('hidden', 'opacity-0');
    pill.classList.add('opacity-100');

    clearTimeout(pill._timer);
    pill._timer = setTimeout(() => {
        pill.classList.add('opacity-0');
        setTimeout(() => pill.classList.add('hidden'), 200);
    }, 2200);
}

function attachLongPressValueTooltip(canvasEl, chart, def) {
    let pressTimer = null;
    let startX = 0;
    let startY = 0;

    canvasEl.addEventListener('touchstart', (e) => {
        if (!e.touches.length) return;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        pressTimer = setTimeout(() => {
            const rect = canvasEl.getBoundingClientRect();
            const x = startX - rect.left;
            const y = startY - rect.top;
            const elements = chart.getElementsAtEventForMode({ x, y }, 'nearest', { intersect: false }, false);
            if (elements && elements.length) {
                const bar = def.bars[elements[0].index];
                if (bar) {
                    showMobileExactValuePill(canvasEl, `${bar.label}: ${bar.count} articles`);
                }
            }
        }, config.LONG_PRESS_MS || 400);
    }, { passive: true });

    canvasEl.addEventListener('touchmove', (e) => {
        if (!e.touches.length) return;
        const touch = e.touches[0];
        if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    }, { passive: true });

    canvasEl.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
        pressTimer = null;
    }, { passive: true });
}

export async function buildQueryMetrics(queryId) {
    const arts = await db.articles.where('queryId').equals(queryId).toArray();
    const total = arts.length;
    const withConc = arts.filter(a => a.hasConclusion === 1).length;
    const totalCitations = arts.reduce((s, a) => s + (a.citations || 0), 0);

    // Keyword frequencies
    const kwCounts = {};
    arts.forEach(a => (a.keywordsNorm || []).forEach(k => { kwCounts[k] = (kwCounts[k] || 0) + 1; }));
    const topKw = Object.entries(kwCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, config.TOP_KEYWORDS);

    // Distinct publication years sorted ascending
    const distinctYears = [...new Set(arts.map(a => a.pubYear || 0))].sort((a, b) => a - b);

    // 8 Metric Chart Definitions
    const chartDefs = [
        // Top Row (3 charts)
        {
            id: 'total',
            title: 'Total Articles',
            bars: [
                { label: 'All Articles', count: total, filter: { field: 'all', value: null }, color: '#3b82f6' }
            ]
        },
        {
            id: 'conclusion',
            title: 'Conclusions by Type',
            bars: CONCLUSION_TYPES.map(type => ({
                label: type,
                count: arts.filter(a => a.conclusionType === type).length,
                filter: { field: 'conclusionType', value: type },
                color: COLOR_MAPS.conclusion[type] || '#94a3b8'
            }))
        },
        {
            id: 'sampleSize',
            title: 'Study Sample Size',
            bars: SAMPLE_SIZE_BUCKETS.map(b => ({
                label: b,
                count: arts.filter(a => a.sampleSizeBucket === b).length,
                filter: { field: 'sampleSizeBucket', value: b },
                color: COLOR_MAPS.sampleSize[b] || '#94a3b8'
            }))
        },
        // Middle Row (4 charts)
        {
            id: 'citations',
            title: 'Citation Count',
            bars: CITE_BUCKETS.map(b => ({
                label: b.label,
                count: arts.filter(a => b.test(a.citations || 0)).length,
                filter: { field: 'citations', value: b.id },
                color: COLOR_MAPS.citations[b.id] || '#f59e0b'
            }))
        },
        {
            id: 'studyType',
            title: 'Study Type',
            bars: STUDY_TYPES.map(st => ({
                label: st,
                count: arts.filter(a => a.studyType === st).length,
                filter: { field: 'studyType', value: st },
                color: COLOR_MAPS.studyType[st] || '#94a3b8'
            }))
        },
        {
            id: 'subjectType',
            title: 'Subject Type',
            bars: SUBJECT_TYPES.map(sub => ({
                label: sub,
                count: arts.filter(a => a.subjectType === sub).length,
                filter: { field: 'subjectType', value: sub },
                color: COLOR_MAPS.subjectType[sub] || '#94a3b8'
            }))
        },
        {
            id: 'pubYear',
            title: 'Publication Year',
            bars: distinctYears.map(y => ({
                label: y === 0 ? 'Unknown' : String(y),
                count: arts.filter(a => (a.pubYear || 0) === y).length,
                filter: { field: 'pubYear', value: y },
                color: '#0d9488'
            }))
        },
        // Bottom Row (1 chart full width)
        {
            id: 'keywords',
            title: 'Top Keywords Frequency',
            bars: topKw.map(([kw, n]) => ({
                label: kw,
                count: n,
                filter: { field: 'keywordsNorm', value: kw },
                color: '#8b5cf6'
            }))
        }
    ];

    return {
        chartDefs,
        total,
        withConc,
        totalCitations,
        uniqueKeywords: Object.keys(kwCounts).length
    };
}

export async function fetchSubset(queryId, filter) {
    let rows;
    if (!filter || filter.field === 'all') {
        rows = await db.articles.where('queryId').equals(queryId).toArray();
    } else if (filter.field === 'citations') {
        const bucket = CITE_BUCKETS.find(b => b.id === filter.value);
        rows = await db.articles.where('queryId').equals(queryId)
            .and(a => bucket ? bucket.test(a.citations || 0) : true).toArray();
    } else if (filter.field === 'keywordsNorm') {
        rows = await db.articles.where('keywordsNorm').equals(filter.value)
            .and(a => a.queryId === queryId).toArray();
    } else {
        // Generically filters pubYear, studyType, subjectType, sampleSizeBucket, conclusionType
        rows = await db.articles.where('queryId').equals(queryId)
            .and(a => a[filter.field] === filter.value).toArray();
    }
    return rows.sort((a, b) => (b.citations || 0) - (a.citations || 0));
}

export function initCardCharts(card, q, chartDefs, onBarClick, onMobileBarClick) {
    // 1. Desktop Charts (Canvas #canvas-${q.id}-${index})
    chartDefs.forEach((def, index) => {
        const canvasEl = card.querySelector(`#canvas-${q.id}-${index}`);
        if (!canvasEl) return;

        canvasEl.setAttribute('role', 'img');
        canvasEl.setAttribute('aria-label', generateChartAriaSummary(def));

        const chart = new Chart(canvasEl, {
            type: 'bar',
            data: {
                labels: def.bars.map(b => b.label),
                datasets: [{
                    data: def.bars.map(b => b.count),
                    backgroundColor: def.bars.map(b => b.color || '#3b82f6'),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.parsed.y} article${ctx.parsed.y === 1 ? '' : 's'} (click to view)`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0, font: { size: 10 } },
                        title: { display: false }
                    },
                    x: {
                        ticks: {
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 0,
                            font: { size: 10 }
                        }
                    }
                },
                onHover: (evt, els) => {
                    evt.native.target.style.cursor = els.length ? 'pointer' : 'default';
                },
                onClick: async (evt, els) => {
                    if (!els.length) return;
                    const bar = def.bars[els[0].index];
                    if (onBarClick) {
                        onBarClick(bar);
                    }
                }
            }
        });
        activeCharts.push(chart);
    });

    // 2. Mobile Charts (Canvas #canvas-m-${q.id}-${index})
    chartDefs.forEach((def, index) => {
        const canvasEl = card.querySelector(`#canvas-m-${q.id}-${index}`);
        if (!canvasEl) return;

        canvasEl.setAttribute('role', 'img');
        canvasEl.setAttribute('aria-label', generateChartAriaSummary(def));

        // Use horizontal bars (indexAxis: 'y') for long labels on mobile
        const isHorizontal = ['conclusion', 'studyType', 'subjectType', 'keywords'].includes(def.id);
        const mobileFontSize = config.MOBILE_CHART_FONT_SIZE || 11;

        const chart = new Chart(canvasEl, {
            type: 'bar',
            data: {
                labels: def.bars.map(b => b.label),
                datasets: [{
                    data: def.bars.map(b => b.count),
                    backgroundColor: def.bars.map(b => b.color || '#3b82f6'),
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: isHorizontal ? 'y' : 'x',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const val = isHorizontal ? ctx.parsed.x : ctx.parsed.y;
                                return `${val} article${val === 1 ? '' : 's'} (tap for details)`;
                            }
                        }
                    }
                },
                scales: isHorizontal ? {
                    x: {
                        beginAtZero: true,
                        ticks: { precision: 0, font: { size: mobileFontSize } }
                    },
                    y: {
                        ticks: {
                            autoSkip: false,
                            font: { size: mobileFontSize, weight: '500' }
                        }
                    }
                } : {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0, font: { size: mobileFontSize } }
                    },
                    x: {
                        ticks: {
                            autoSkip: false,
                            maxRotation: 40,
                            minRotation: 0,
                            font: { size: mobileFontSize, weight: '500' }
                        }
                    }
                },
                onHover: (evt, els) => {
                    evt.native.target.style.cursor = els.length ? 'pointer' : 'default';
                },
                onClick: async (evt, els) => {
                    if (!els.length) return;
                    const bar = def.bars[els[0].index];
                    if (onMobileBarClick) {
                        onMobileBarClick(bar);
                    } else if (onBarClick) {
                        onBarClick(bar);
                    }
                }
            }
        });

        attachLongPressValueTooltip(canvasEl, chart, def);
        activeCharts.push(chart);
    });
}

if (typeof window !== 'undefined') {
    window.Chart = Chart;
    window.buildQueryMetrics = buildQueryMetrics;
    window.fetchSubset = fetchSubset;
    window.destroyAllCharts = destroyAllCharts;
    window.generateChartAriaSummary = generateChartAriaSummary;
    window.renderAccessibleChartTable = renderAccessibleChartTable;
    Object.defineProperty(window, 'activeCharts', {
        get() { return activeCharts; },
        set(v) { activeCharts = v; }
    });
}

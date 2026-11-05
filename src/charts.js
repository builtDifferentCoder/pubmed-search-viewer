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

export function initCardCharts(card, q, chartDefs, onBarClick) {
    chartDefs.forEach((def, index) => {
        const canvasEl = card.querySelector(`#canvas-${q.id}-${index}`);
        if (!canvasEl) return;

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
}

if (typeof window !== 'undefined') {
    window.Chart = Chart;
    window.buildQueryMetrics = buildQueryMetrics;
    window.fetchSubset = fetchSubset;
    window.destroyAllCharts = destroyAllCharts;
    Object.defineProperty(window, 'activeCharts', {
        get() { return activeCharts; },
        set(v) { activeCharts = v; }
    });
}

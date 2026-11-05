// Contradiction / Divergence Mapping Engine (Phase 2)
import { config, DEFAULT_OPPOSING_CONFIG, COLOR_MAPS } from './config.js';
import { db } from './db.js';
import { esc } from './parsers.js';

export function getOpposition(tagA, tagB, opposingConfig = config.DEFAULT_OPPOSING_CONFIG || DEFAULT_OPPOSING_CONFIG) {
    if (!tagA || !tagB || tagA === 'None' || tagB === 'None') {
        return { isOpposing: false, strength: 0, label: '' };
    }
    const cleanA = tagA.trim().toLowerCase();
    const cleanB = tagB.trim().toLowerCase();
    if (cleanA === cleanB) {
        return { isOpposing: false, strength: 0, label: '' };
    }

    for (const rule of opposingConfig) {
        const r0 = rule.tags[0].trim().toLowerCase();
        const r1 = rule.tags[1].trim().toLowerCase();
        if ((cleanA === r0 && cleanB === r1) || (cleanA === r1 && cleanB === r0)) {
            return {
                isOpposing: true,
                strength: rule.strength || 1.0,
                label: rule.label || `${rule.tags[0]} vs ${rule.tags[1]}`
            };
        }
    }
    return { isOpposing: false, strength: 0, label: '' };
}

export function findDivergentPairs(articles, options = {}) {
    const minSharedKeywords = options.minSharedKeywords ?? 2;
    const opposingConfig = options.opposingConfig || config.DEFAULT_OPPOSING_CONFIG || DEFAULT_OPPOSING_CONFIG;
    const maxPairs = options.maxPairs || config.MAX_DIVERGENCE_PAIRS || 100;

    if (!articles || articles.length < 2) return [];

    const pairs = [];

    for (let i = 0; i < articles.length; i++) {
        const a = articles[i];
        if (!a.conclusionType || a.conclusionType === 'None') continue;

        const kwsA = new Set((a.keywordsNorm || []).map(k => k.trim().toLowerCase()).filter(Boolean));
        if (kwsA.size === 0) continue;

        for (let j = i + 1; j < articles.length; j++) {
            const b = articles[j];
            if (!b.conclusionType || b.conclusionType === 'None') continue;

            const opposition = getOpposition(a.conclusionType, b.conclusionType, opposingConfig);
            if (!opposition.isOpposing) continue;

            const kwsB = (b.keywordsNorm || []).map(k => k.trim().toLowerCase()).filter(Boolean);
            const shared = [];
            const seen = new Set();
            for (const k of kwsB) {
                if (kwsA.has(k) && !seen.has(k)) {
                    shared.push(k);
                    seen.add(k);
                }
            }

            if (shared.length >= minSharedKeywords) {
                shared.sort();
                pairs.push({
                    paperA: a,
                    paperB: b,
                    sharedKeywords: shared,
                    sharedCount: shared.length,
                    tagA: a.conclusionType,
                    tagB: b.conclusionType,
                    oppositionStrength: opposition.strength,
                    oppositionLabel: opposition.label,
                    score: shared.length * 10 + opposition.strength
                });
            }
        }
    }

    pairs.sort((p1, p2) => {
        if (p2.sharedCount !== p1.sharedCount) {
            return p2.sharedCount - p1.sharedCount;
        }
        return p2.oppositionStrength - p1.oppositionStrength;
    });

    return pairs.slice(0, maxPairs);
}

export function renderPaperDetailsHtml(paper, tag, sharedKeywords) {
    const colorMaps = config.COLOR_MAPS || COLOR_MAPS;
    const typeColor = colorMaps.conclusion[tag] || '#94a3b8';
    const sharedLower = (sharedKeywords || []).map(k => k.toLowerCase());
    const kwPills = (paper.keywordsNorm || []).map(k => {
        const isShared = sharedLower.includes(k.toLowerCase());
        return `<span class="px-2 py-0.5 rounded text-[11px] ${isShared ? 'bg-blue-100 text-blue-800 font-bold border border-blue-300' : 'bg-slate-100 text-slate-600'}">${esc(k)}</span>`;
    }).join(' ');

    return `
        <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <span class="inline-block text-xs font-bold px-2 py-0.5 rounded" style="background:${typeColor}20; color:${typeColor}; border: 1px solid ${typeColor}40;">
                ${esc(tag)} Conclusion
            </span>
            <a href="https://pubmed.ncbi.nlm.nih.gov/${esc(paper.pmid)}/" target="_blank" class="text-xs text-blue-600 hover:underline font-mono flex items-center gap-1">
                PMID: ${esc(paper.pmid)} <i class="ph ph-arrow-square-out text-sm"></i>
            </a>
        </div>
        <h4 class="text-sm font-bold text-slate-900 leading-snug">${esc(paper.title)}</h4>
        <div class="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
            <span>${esc(paper.dateStr || paper.pubYear || '')}</span>
            <span>&middot;</span>
            <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${esc(paper.studyType || 'Other')}</span>
            <span>&middot;</span>
            <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${paper.sampleSize ? `n = ${paper.sampleSize}` : 'Sample: ' + esc(paper.sampleSizeBucket || 'Unknown')}</span>
            <span>&middot;</span>
            <span>${paper.citations || 0} citations</span>
        </div>
        <div class="mt-1">
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Conclusion Statement:</div>
            <div class="text-xs text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200 font-medium leading-relaxed">
                ${esc(paper.conclusion || 'No explicit conclusion section found.')}
            </div>
        </div>
        ${paper.abstract && paper.abstract !== paper.conclusion ? `
        <div class="mt-1">
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Full Abstract:</div>
            <div class="text-xs text-slate-600 max-h-40 overflow-y-auto bg-slate-50/50 p-2.5 rounded border border-slate-100 leading-relaxed custom-scrollbar">
                ${esc(paper.abstract)}
            </div>
        </div>` : ''}
        <div class="mt-auto pt-2">
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Keywords (shared highlighted):</div>
            <div class="flex items-center gap-1 flex-wrap">${kwPills || '<span class="text-xs text-slate-400 italic">None</span>'}</div>
        </div>
    `;
}

export function openDivergenceCompareModal(pair, queryId) {
    const modal = document.getElementById('divergence-compare-modal');
    const colA = document.getElementById('modal-paper-a');
    const colB = document.getElementById('modal-paper-b');
    const banner = document.getElementById('modal-shared-keywords-banner');
    const highlightBtn = document.getElementById('modal-highlight-graph-btn');
    const closeBtn = document.getElementById('modal-close-btn');

    if (!modal) return;

    if (banner) {
        banner.innerHTML = `
            <span class="font-bold text-slate-700">Shared keywords (${pair.sharedCount}):</span>
            ${pair.sharedKeywords.map(k => `<span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-xs border border-blue-200">${esc(k)}</span>`).join(' ')}
            <span class="mx-1 text-slate-300">|</span>
            <span class="font-bold text-slate-700">Opposition:</span>
            <span class="px-2 py-0.5 rounded text-xs font-bold ${pair.oppositionStrength === 1.0 ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}">
                ${esc(pair.oppositionLabel)}
            </span>`;
    }

    if (colA) colA.innerHTML = renderPaperDetailsHtml(pair.paperA, pair.tagA, pair.sharedKeywords);
    if (colB) colB.innerHTML = renderPaperDetailsHtml(pair.paperB, pair.tagB, pair.sharedKeywords);

    if (highlightBtn) {
        highlightBtn.onclick = () => {
            modal.classList.add('hidden');
            highlightConnectingPath(queryId, pair.sharedKeywords);
        };
    }

    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.add('hidden');
    }

    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    };

    modal.classList.remove('hidden');
}

export async function highlightConnectingPath(queryId, sharedKeywords) {
    if (window.switchTab) window.switchTab('graph');
    const graphQuerySelect = document.getElementById('graph-query-select');
    if (graphQuerySelect && graphQuerySelect.value !== String(queryId)) {
        graphQuerySelect.value = String(queryId);
        if (window.renderKeywordsGraph) await window.renderKeywordsGraph(queryId);
    }

    setTimeout(() => {
        const cy = window.activeCytoscape;
        if (!cy) return;

        const sharedLower = (sharedKeywords || []).map(k => k.toLowerCase().trim());
        const targetNodes = cy.nodes().filter(n => sharedLower.includes(n.data('id').toLowerCase().trim()));

        if (targetNodes.length > 0) {
            cy.elements().removeClass('highlighted dimmed');
            cy.elements().addClass('dimmed');

            const targetEdges = targetNodes.edgesWith(targetNodes);
            targetNodes.removeClass('dimmed').addClass('highlighted');
            targetEdges.removeClass('dimmed').addClass('highlighted');

            cy.fit(targetNodes, 80);
            if (window.showNotification) {
                window.showNotification(`Highlighted connecting path for ${sharedKeywords.length} shared keywords: ${sharedKeywords.join(', ')}`, 'info');
            }
        } else {
            if (window.showNotification) {
                window.showNotification(`Shared keywords not in current graph view (check Top Keywords cap slider).`, 'warning');
            }
        }
    }, 150);
}

export async function renderDivergencePanel(card, queryId, currentN = 2, page = 1) {
    const body = card.querySelector('.divergence-body');
    const badge = card.querySelector('.divergence-badge');
    if (!body) return;

    const articles = await db.articles.where('queryId').equals(queryId).toArray();
    const pairs = findDivergentPairs(articles, { minSharedKeywords: currentN });

    if (badge) {
        badge.textContent = `${pairs.length} pair${pairs.length === 1 ? '' : 's'}`;
        if (pairs.length > 0) {
            badge.className = 'divergence-badge px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold';
        } else {
            badge.className = 'divergence-badge px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-semibold';
        }
    }

    if (pairs.length === 0) {
        body.innerHTML = `
            <div class="p-4 bg-white border border-slate-200 rounded-lg text-center text-xs text-slate-500">
                <i class="ph ph-check-circle text-2xl text-emerald-500 mb-1 inline-block"></i>
                <p class="font-medium text-slate-700">No contradictory paper pairs found</p>
                <p class="text-[11px] text-slate-400 mt-0.5">No pairs in this query result set share at least ${currentN} keyword${currentN === 1 ? '' : 's'} with opposing conclusion tags.</p>
            </div>`;
        return;
    }

    const pageSize = config.DIVERGENCE_PAGE_SIZE || 5;
    const totalPages = Math.ceil(pairs.length / pageSize);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const pagedPairs = pairs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    let html = '<div class="flex flex-col gap-2.5">';

    pagedPairs.forEach((pair, localIdx) => {
        const globalIdx = (currentPage - 1) * pageSize + localIdx;
        const colorMaps = config.COLOR_MAPS || COLOR_MAPS;
        const colorA = colorMaps.conclusion[pair.tagA] || '#94a3b8';
        const colorB = colorMaps.conclusion[pair.tagB] || '#94a3b8';

        html += `
        <div class="divergence-item border border-slate-200 bg-white hover:border-slate-300 rounded-lg p-3 shadow-xs flex flex-col gap-2 transition-all" data-pair-idx="${globalIdx}">
            <div class="flex items-center justify-between gap-2 flex-wrap text-xs">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400"><i class="ph ph-tag"></i> Shared (${pair.sharedCount}):</span>
                    ${pair.sharedKeywords.map(k => `<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200">${esc(k)}</span>`).join('')}
                </div>
                <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded text-[11px] font-bold ${pair.oppositionStrength === 1.0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
                        ${esc(pair.oppositionLabel)}
                    </span>
                    <button class="divergence-compare-btn px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md font-medium text-xs flex items-center gap-1 transition-colors" data-global-idx="${globalIdx}">
                        <i class="ph ph-columns"></i> Side-by-Side
                    </button>
                    <button class="divergence-graph-btn px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md font-medium text-xs flex items-center gap-1 transition-colors" data-global-idx="${globalIdx}">
                        <i class="ph ph-graph"></i> View in Graph
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-100">
                <!-- Paper A -->
                <div class="p-2.5 rounded bg-slate-50/60 border border-slate-100 flex flex-col gap-1">
                    <div class="flex items-center justify-between gap-2">
                        <span class="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded" style="background:${colorA}20; color:${colorA}; border: 1px solid ${colorA}40;">${esc(pair.tagA)}</span>
                        <span class="text-[11px] text-slate-400">PMID: <a href="https://pubmed.ncbi.nlm.nih.gov/${esc(pair.paperA.pmid)}/" target="_blank" class="text-blue-600 hover:underline font-mono">${esc(pair.paperA.pmid)}</a> &middot; ${esc(pair.paperA.pubYear || 'Unknown')}</span>
                    </div>
                    <h5 class="font-semibold text-slate-800 line-clamp-2">${esc(pair.paperA.title)}</h5>
                    <p class="text-[11px] text-slate-500 italic line-clamp-2 mt-auto">"${esc(pair.paperA.conclusion || pair.paperA.abstract || '')}"</p>
                </div>

                <!-- Paper B -->
                <div class="p-2.5 rounded bg-slate-50/60 border border-slate-100 flex flex-col gap-1">
                    <div class="flex items-center justify-between gap-2">
                        <span class="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded" style="background:${colorB}20; color:${colorB}; border: 1px solid ${colorB}40;">${esc(pair.tagB)}</span>
                        <span class="text-[11px] text-slate-400">PMID: <a href="https://pubmed.ncbi.nlm.nih.gov/${esc(pair.paperB.pmid)}/" target="_blank" class="text-blue-600 hover:underline font-mono">${esc(pair.paperB.pmid)}</a> &middot; ${esc(pair.paperB.pubYear || 'Unknown')}</span>
                    </div>
                    <h5 class="font-semibold text-slate-800 line-clamp-2">${esc(pair.paperB.title)}</h5>
                    <p class="text-[11px] text-slate-500 italic line-clamp-2 mt-auto">"${esc(pair.paperB.conclusion || pair.paperB.abstract || '')}"</p>
                </div>
            </div>
        </div>`;
    });

    html += '</div>';

    if (totalPages > 1) {
        html += `
        <div class="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200">
            <span class="text-[11px]">Showing ${(currentPage - 1) * pageSize + 1}&ndash;${Math.min(currentPage * pageSize, pairs.length)} of ${pairs.length} divergent pairs</span>
            <div class="flex items-center gap-1.5">
                <button class="divergence-prev-btn px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
                <span class="font-medium px-1">Page ${currentPage} of ${totalPages}</span>
                <button class="divergence-next-btn px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
            </div>
        </div>`;
    }

    body.innerHTML = html;

    body.querySelectorAll('.divergence-compare-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.globalIdx, 10);
            if (pairs[idx]) {
                openDivergenceCompareModal(pairs[idx], queryId);
            }
        });
    });

    body.querySelectorAll('.divergence-graph-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.globalIdx, 10);
            if (pairs[idx]) {
                highlightConnectingPath(queryId, pairs[idx].sharedKeywords);
            }
        });
    });

    const prevBtn = body.querySelector('.divergence-prev-btn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            renderDivergencePanel(card, queryId, currentN, currentPage - 1);
        });
    }

    const nextBtn = body.querySelector('.divergence-next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            renderDivergencePanel(card, queryId, currentN, currentPage + 1);
        });
    }
}

export function initDivergencePanelForCard(card, queryId) {
    const nSelect = card.querySelector('.divergence-n-select');
    const toggleBtn = card.querySelector('.divergence-toggle-btn');
    const body = card.querySelector('.divergence-body');

    let currentN = 2;
    let currentPage = 1;

    if (nSelect) {
        nSelect.addEventListener('change', () => {
            currentN = parseInt(nSelect.value, 10) || 2;
            currentPage = 1;
            renderDivergencePanel(card, queryId, currentN, currentPage);
        });
    }

    if (toggleBtn && body) {
        toggleBtn.addEventListener('click', () => {
            const isHidden = body.classList.toggle('hidden');
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.className = isHidden ? 'ph-bold ph-caret-right text-sm' : 'ph-bold ph-caret-down text-sm';
            }
        });
    }

    renderDivergencePanel(card, queryId, currentN, currentPage);
}

if (typeof window !== 'undefined') {
    window.getOpposition = getOpposition;
    window.findDivergentPairs = findDivergentPairs;
    window.renderPaperDetailsHtml = renderPaperDetailsHtml;
    window.openDivergenceCompareModal = openDivergenceCompareModal;
    window.highlightConnectingPath = highlightConnectingPath;
    window.renderDivergencePanel = renderDivergencePanel;
    window.initDivergencePanelForCard = initDivergencePanelForCard;
}

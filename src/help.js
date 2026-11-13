// Reusable HelpPopover component, centralized HELP_TEXT copy, and 3-step First-run Coachmark Tour
import { esc } from './parsers.js';

export const HELP_TEXT = {
    divergence: {
        title: "Contradiction Mapping (Divergence)",
        body: "Finds pairs of papers in this search that study the same biomedical concepts but reach opposite clinical findings. Papers are paired when they share at least N keywords and their conclusions are classified as opposing (e.g. Positive vs. Negative, or Positive vs. Null/Inconclusive).",
        learnMore: "Usage: Raise 'Min Shared (N)' to compare only closely overlapping studies, or lower it to widen the scope. Divergent pairs are ranked first by shared keyword count, then by opposition strength. Tap 'Side-by-Side' to compare full abstracts, or 'View in Graph' to light up the connecting pathway in the Keywords Graph.\n\nCaveat: Conclusion tags are inferred automatically from abstract text using heuristic analysis — treat them as investigative leads rather than absolute clinical verdicts. Papers without detectable conclusions are skipped."
    },
    divergence_min_shared: {
        title: "Min Shared Keywords (N)",
        body: "Sets the minimum number of identical normalized keywords that two papers must share before they are evaluated for contradictory conclusions.",
        learnMore: "Setting N = 2 (default) ensures papers share a solid contextual basis before comparison. Setting N = 1 broadens the search, while N ≥ 3 restricts comparisons to highly overlapping investigations."
    },
    divergence_opposition_badge: {
        title: "Opposition Classification Badge",
        body: "Classifies the degree of disagreement between two studies. Direct Opposition (Positive vs. Negative or Supports vs. Refutes) receives a maximum score of 1.0.",
        learnMore: "Positive vs. Null/Inconclusive is rated at 0.7, and Negative vs. Null/Inconclusive is rated at 0.6. Symmetrical matching ensures unbiased evaluation regardless of publication order."
    },
    weight: {
        title: "Co-occurrence Weight & Weighted Degree",
        body: "Weight represents the number of scientific articles in this search mentioning both keywords together. Thicker edges connect keyword pairs that frequently appear together across multiple studies.",
        learnMore: "A node's size reflects its weighted degree — the sum of the weights of all its connecting edges, demonstrating how central it is to the research network. 'Hide weight < 2' hides pairs seen in only one paper to reduce visual noise (auto-suggested on dense graphs). Colors denote topical clusters detected automatically using the Louvain modularity algorithm."
    },
    graph_top_slider: {
        title: "Top Keywords Cap",
        body: "Controls the maximum number of high-degree keyword nodes displayed in the co-occurrence network (adjustable between 10 and 100, default 60).",
        learnMore: "Lowering the cap simplifies dense networks to highlight core themes; raising it reveals peripheral, emerging, or niche research topics."
    },
    graph_min_weight: {
        title: "Hide Weight < 2 Filter",
        body: "Hides connections where two keywords appear together in only a single publication. Eliminating low-weight links reduces clutter and clarifies multi-study trends.",
        learnMore: "When a search yields a very dense network (>40 edges), this filter is recommended to highlight strong associations."
    },
    graph_relayout: {
        title: "Force-Directed Re-layout",
        body: "Re-runs the physics simulation (CoSE layout) to untangle overlapping nodes and optimize spacing after adjusting filters or zooming.",
        learnMore: "Node positions are computed client-side using simulated electrostatic repulsion and spring stiffness based on co-occurrence weights."
    },
    graph_cluster_legend: {
        title: "Topic Clusters (Louvain Communities)",
        body: "Colors denote distinct thematic sub-topics detected automatically by the Louvain community detection algorithm.",
        learnMore: "Keywords clustered into the same color share higher internal co-occurrence than with the rest of the network. Tap any cluster in the legend to spotlight its member keywords and dim unrelated terms."
    },
    primers: {
        title: "How Search Primers Work",
        body: "Each primer is a curated multi-query starter pack designed for high-impact biomedical domains. Open a primer and tap any query to activate it — it runs against NCBI and saves the results to Search Results. You can also edit the query text on the fly to narrow or widen your search.",
        example: {
            title: "PubMed Boolean Logic",
            explanation: "AND requires both terms (narrows); OR matches either term (widens for synonyms); NOT excludes terms. Operators MUST be UPPERCASE. PubMed evaluates left to right, so use parentheses ( ) to group expressions — (A OR B) AND C differs fundamentally from A OR (B AND C). Enclose multi-word terms in double quotes.",
            raw: `("Caloric restriction" OR "intermittent fasting") AND ("longevity" OR "healthspan")`
        },
        learnMore: "Primers synthesize literature across distinct therapeutic angles (e.g. human RCTs, mechanistic pathways, safety/tolerability). Results are cached in client-side IndexedDB for 24 hours to minimize redundant network calls."
    },
    query_builder: {
        title: "Drag-and-Drop & Tap Boolean Query Builder",
        body: "Build syntactically valid PubMed queries visually. Drag keyword nodes from the graph into the drop zone, or tap any node on mobile to append it as an interactive query chip.",
        learnMore: "Tap operator badges between chips to toggle between AND, OR, and NOT. Select multiple chips with their checkboxes and tap '( ) Group' to enclose them in parentheses. Multi-word keywords are automatically quoted."
    },
    query_builder_run: {
        title: "Run Boolean Search",
        body: "Compiles the chips into a standardized PubMed Boolean query string, populates the search bar, queries NCBI E-utilities, and immediately transitions to Search Results.",
        learnMore: "You can also tap 'Copy' to paste the raw Boolean query into native PubMed, an email, or your reference manager."
    },
    chart_total: {
        title: "Total Articles Retrieved",
        body: "Total number of PubMed articles retrieved for this search query. Tap the bar to display the complete matching article list in the detail drawer below."
    },
    chart_conclusion: {
        title: "Conclusions by Type",
        body: "Categorizes articles by automated outcome sentiment: Positive, Negative, Null/Inconclusive, or Unspecified. Tap any bar to filter and read the matching studies."
    },
    chart_sample_size: {
        title: "Study Sample Size",
        body: "Groups studies into cohort size buckets: N < 30, 30–99, 100–499, and 500+ participants. Tap any bar to view the corresponding clinical trials."
    },
    chart_citations: {
        title: "Citation Count",
        body: "Groups articles by PubMed Central citation frequency (0, 1–5, 6–20, 21–50, 50+) indicating academic impact. Tap any bar to view cited papers."
    },
    chart_study_type: {
        title: "Study Methodology Type",
        body: "Classifies methodological design: Randomized Controlled Trial (RCT), Clinical Trial, Meta-Analysis, Review, Observational, or In Vitro. Tap any bar to filter."
    },
    chart_subject_type: {
        title: "Subject Population Model",
        body: "Distinguishes study subjects: Human clinical studies, Animal/Murine models, or Cellular/In Vitro systems. Tap any bar to inspect matching articles."
    },
    chart_pub_year: {
        title: "Publication Year",
        body: "Displays the chronological distribution of published papers over the past 5 years. Tap any year bar to view studies from that year."
    },
    chart_keywords: {
        title: "Top Keywords Frequency",
        body: "Ranks the most frequently occurring normalized MeSH keywords across the search results. Tap any keyword bar to list papers featuring that term."
    },
    sample_size_buckets: {
        title: "Sample Size (N) Bucketing",
        body: "Participant counts are extracted from abstract text using heuristic regular expressions (e.g. 'n = 120', '85 patients') and grouped into small (<30), medium (30–99), large (100–499), and extensive (500+) tiers."
    },
    conclusion_tags: {
        title: "Conclusion Classification Tags",
        body: "Heuristics classify findings by scanning outcome sentences. Positive tags identify significant improvements or efficacy; Negative tags identify lack of efficacy or adverse outcomes; Null/Inconclusive tags indicate mixed or statistically non-significant results."
    }
};

let activePopoverTrigger = null;

export function renderHelpButton(helpId, customClass = '') {
    const item = HELP_TEXT[helpId];
    const title = item ? item.title : 'Help information';
    // 44px minimum tap target with -m-3 negative margin for tight visual alignment
    return `<button type="button" 
        class="help-popover-btn inline-flex items-center justify-center w-11 h-11 -my-3 -mx-2.5 text-slate-400 hover:text-blue-600 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded-full transition-colors cursor-pointer flex-shrink-0 align-middle ${esc(customClass)}" 
        data-help-id="${esc(helpId)}" 
        aria-label="Help: ${esc(title)}"
        aria-haspopup="dialog"
        aria-expanded="false"
        tabindex="0"
    >
        <span class="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-serif font-bold italic leading-none pointer-events-none select-none">i</span>
    </button>`;
}

export function positionPopover(triggerEl, popoverEl) {
    if (!triggerEl || !popoverEl) return;
    const margin = 8;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;

    popoverEl.style.left = '0px';
    popoverEl.style.top = '0px';
    // Contain within viewport width and height at 360px
    const maxW = Math.min(340, vw - margin * 2);
    popoverEl.style.maxWidth = `${maxW}px`;
    popoverEl.style.width = `${maxW}px`;
    popoverEl.style.maxHeight = `${vh - margin * 2}px`;
    popoverEl.style.overflowY = 'auto';

    const triggerRect = triggerEl.getBoundingClientRect();
    const popRect = popoverEl.getBoundingClientRect();

    // Horizontal calculation: center horizontally over trigger, then clamp strictly inside viewport
    let left = triggerRect.left + (triggerRect.width / 2) - (popRect.width / 2);
    if (left < margin) {
        left = margin;
    } else if (left + popRect.width > vw - margin) {
        left = vw - margin - popRect.width;
    }

    // Vertical calculation: prefer opening below trigger
    let top = triggerRect.bottom + 6;
    if (top + popRect.height > vh - margin) {
        // Try opening above trigger
        const topAbove = triggerRect.top - popRect.height - 6;
        if (topAbove >= margin) {
            top = topAbove;
        } else {
            // Clamp within screen height
            top = Math.max(margin, Math.min(top, vh - popRect.height - margin));
        }
    }

    popoverEl.style.position = 'fixed';
    popoverEl.style.left = `${Math.round(left)}px`;
    popoverEl.style.top = `${Math.round(top)}px`;
}

export function openHelpPopover(triggerEl, helpId) {
    const item = HELP_TEXT[helpId];
    if (!item || !triggerEl) return;

    let popover = document.getElementById('global-help-popover');
    if (!popover) {
        popover = document.createElement('div');
        popover.id = 'global-help-popover';
        document.body.appendChild(popover);
    }

    popover.id = `global-help-popover`;
    popover.setAttribute('role', 'tooltip');
    popover.className = 'fixed z-50 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200/90 p-4 text-xs animate-in fade-in zoom-in-95 duration-150 backdrop-blur-sm select-text';

    let exampleHtml = '';
    if (item.example) {
        exampleHtml = `
        <div class="mt-3 p-2.5 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono leading-relaxed border border-slate-800">
            <div class="text-[10px] uppercase tracking-wider text-slate-400 font-sans font-bold mb-1">${esc(item.example.title || 'Example')}</div>
            <p class="text-[11px] text-slate-300 font-sans mb-2">${esc(item.example.explanation || '')}</p>
            <div class="p-1.5 bg-black/40 rounded border border-slate-700/60 overflow-x-auto whitespace-pre-wrap">
                <span class="text-cyan-400 font-bold">(</span><span class="text-amber-300">"Caloric restriction"</span> <span class="text-purple-400 font-bold">OR</span> <span class="text-amber-300">"intermittent fasting"</span><span class="text-cyan-400 font-bold">)</span> <span class="text-blue-400 font-bold">AND</span> <span class="text-cyan-400 font-bold">(</span><span class="text-amber-300">"longevity"</span> <span class="text-purple-400 font-bold">OR</span> <span class="text-amber-300">"healthspan"</span><span class="text-cyan-400 font-bold">)</span>
            </div>
        </div>`;
    }

    let learnMoreHtml = '';
    if (item.learnMore) {
        learnMoreHtml = `
        <div class="mt-2.5 pt-2 border-t border-slate-100">
            <button type="button" class="help-learn-more-toggle text-blue-600 hover:text-blue-800 font-semibold text-xs inline-flex items-center gap-1 cursor-pointer focus:outline-none">
                <span>Learn more</span>
                <i class="ph-bold ph-caret-down text-[11px] transition-transform"></i>
            </button>
            <div class="help-learn-more-drawer hidden mt-2 text-[11px] text-slate-600 leading-relaxed space-y-1.5 whitespace-pre-line bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                ${esc(item.learnMore)}
            </div>
        </div>`;
    }

    popover.innerHTML = `
        <div class="flex items-start justify-between gap-3 pb-2 border-b border-slate-100">
            <div class="flex items-center gap-1.5 font-bold text-slate-900 text-xs leading-snug">
                <span class="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-serif text-[10px] italic flex-shrink-0">i</span>
                <span>${esc(item.title)}</span>
            </div>
            <button type="button" id="help-popover-close-btn" class="w-6 h-6 -mr-1 -mt-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center text-sm font-bold focus:outline-none transition-colors" aria-label="Close help">&times;</button>
        </div>
        <p class="mt-2 text-slate-600 leading-relaxed text-xs">${esc(item.body)}</p>
        ${exampleHtml}
        ${learnMoreHtml}
    `;

    popover.classList.remove('hidden');

    // Update ARIA on trigger
    popover.id = 'global-help-popover';
    popover.setAttribute('data-current-help-id', helpId);
    triggerEl.setAttribute('aria-describedby', 'global-help-popover');
    triggerEl.setAttribute('aria-expanded', 'true');
    activePopoverTrigger = triggerEl;

    // Attach learn more toggle
    const toggleBtn = popover.querySelector('.help-learn-more-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const drawer = popover.querySelector('.help-learn-more-drawer');
            const caret = toggleBtn.querySelector('i');
            if (drawer) {
                drawer.classList.toggle('hidden');
                const isExpanded = !drawer.classList.contains('hidden');
                toggleBtn.querySelector('span').textContent = isExpanded ? 'Show less' : 'Learn more';
                if (caret) caret.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
                // Re-position in case expanded size overflows viewport
                positionPopover(triggerEl, popover);
            }
        });
    }

    const closeBtn = popover.querySelector('#help-popover-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeHelpPopover(true);
        });
    }

    positionPopover(triggerEl, popover);
}

export function closeHelpPopover(restoreFocus = false) {
    const popover = document.getElementById('global-help-popover');
    if (popover) {
        popover.classList.add('hidden');
    }
    if (activePopoverTrigger) {
        activePopoverTrigger.setAttribute('aria-expanded', 'false');
        activePopoverTrigger.removeAttribute('aria-describedby');
        if (restoreFocus) {
            activePopoverTrigger.focus();
        }
        activePopoverTrigger = null;
    }
}

export function toggleHelpPopover(triggerEl) {
    if (activePopoverTrigger === triggerEl) {
        closeHelpPopover();
    } else {
        const helpId = triggerEl.dataset.helpId;
        openHelpPopover(triggerEl, helpId);
    }
}

export function initHelpPopovers() {
    let focusIgnoredUntil = 0;

    // Record pointerdown so focusin from pointer interaction does not double-trigger
    document.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('.help-popover-btn');
        if (btn) {
            focusIgnoredUntil = Date.now() + 350;
        }
    });

    // Focus handling: opens when focused (e.g. keyboard navigation via Tab)
    document.addEventListener('focusin', (e) => {
        if (Date.now() < focusIgnoredUntil) return;
        const btn = e.target.closest('.help-popover-btn');
        if (btn && activePopoverTrigger !== btn) {
            openHelpPopover(btn, btn.dataset.helpId);
            return;
        }

        // If focus moved outside active trigger and outside popover, close popover
        const popover = document.getElementById('global-help-popover');
        if (popover && !popover.classList.contains('hidden')) {
            if (!e.target.closest('#global-help-popover') && !e.target.closest('.help-popover-btn')) {
                closeHelpPopover(false);
            }
        }
    });

    // Global event delegation for all current and future help buttons
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.help-popover-btn');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            toggleHelpPopover(btn);
            return;
        }

        const popover = document.getElementById('global-help-popover');
        if (popover && !popover.classList.contains('hidden')) {
            if (!e.target.closest('#global-help-popover')) {
                closeHelpPopover();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const popover = document.getElementById('global-help-popover');
            if (popover && !popover.classList.contains('hidden')) {
                e.preventDefault();
                closeHelpPopover(true);
            }
        }
    });

    window.addEventListener('resize', () => {
        const popover = document.getElementById('global-help-popover');
        if (popover && !popover.classList.contains('hidden') && activePopoverTrigger) {
            positionPopover(activePopoverTrigger, popover);
        }
    });

    window.addEventListener('scroll', () => {
        const popover = document.getElementById('global-help-popover');
        if (popover && !popover.classList.contains('hidden') && activePopoverTrigger) {
            positionPopover(activePopoverTrigger, popover);
        }
    }, { passive: true });
}

// ---------------------------------------------------------------------
// 3-Step First-Run Coachmark Tour (Results -> Graph -> Primers)
// ---------------------------------------------------------------------

export const COACHMARK_STEPS = [
    {
        tabId: 'results',
        targetSelector: '#tab-results-btn',
        title: 'Step 1 of 3: Search Results & Contradictions',
        body: 'Search any biomedical topic to retrieve up to 50 studies. Review 8 interactive clinical distribution charts and explore automated Contradiction Mapping to uncover conflicting scientific findings.'
    },
    {
        tabId: 'graph',
        targetSelector: '#tab-graph-btn',
        title: 'Step 2 of 3: Keywords Graph & Query Builder',
        body: 'Analyze co-occurrence networks with automated Louvain topic clustering. Use the floating Boolean Query Builder to visually construct structured queries by dragging or tapping keyword nodes.'
    },
    {
        tabId: 'primers',
        targetSelector: '#tab-primers-btn',
        title: 'Step 3 of 3: Search Primers & Domain Syntheses',
        body: 'Access curated multi-query starter packs covering Longevity, Ketosis, Metabolic Flexibility, and Gut Health. Tap any query card to activate it and run live against PubMed.'
    }
];

let currentTourStep = 0;
let coachmarkEventsAttached = false;

export function showCoachmarkStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= COACHMARK_STEPS.length) return;
    currentTourStep = stepIndex;
    const step = COACHMARK_STEPS[stepIndex];

    // Only switch tabs on steps > 0 so step 0 never conflicts with current route/interaction
    if (stepIndex > 0 && window.switchTab) {
        window.switchTab(step.tabId);
    }

    let tourOverlay = document.getElementById('coachmark-tour-overlay');
    if (!tourOverlay) {
        tourOverlay = document.createElement('div');
        tourOverlay.id = 'coachmark-tour-overlay';
        tourOverlay.className = 'fixed inset-0 z-40 pointer-events-none flex items-start justify-center p-4 transition-opacity duration-200';
        document.body.appendChild(tourOverlay);
    }
    tourOverlay.classList.remove('hidden');

    const targetEl = document.querySelector(step.targetSelector);
    let targetTop = 120;
    if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        targetTop = rect.bottom + 12;
    }

    tourOverlay.innerHTML = `
        <div id="coachmark-card" class="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 max-w-md w-full animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3 relative" style="margin-top: ${Math.max(20, Math.min(targetTop, window.innerHeight - 260))}px;">
            <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                <span class="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <i class="ph-bold ph-compass"></i> Tour: ${esc(step.title)}
                </span>
                <button type="button" id="coachmark-skip-btn" class="text-slate-400 hover:text-slate-600 text-xs font-medium cursor-pointer">Skip tour</button>
            </div>
            <p class="text-slate-700 text-xs leading-relaxed">${esc(step.body)}</p>
            <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <div class="flex items-center gap-1.5">
                    ${COACHMARK_STEPS.map((_, i) => `<span class="w-2 h-2 rounded-full ${i === stepIndex ? 'bg-blue-600 w-4' : 'bg-slate-200'} transition-all"></span>`).join('')}
                </div>
                <div class="flex items-center gap-2">
                    ${stepIndex > 0 ? `<button type="button" id="coachmark-prev-btn" class="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-medium cursor-pointer">Back</button>` : ''}
                    <button type="button" id="coachmark-next-btn" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm cursor-pointer">
                        ${stepIndex === COACHMARK_STEPS.length - 1 ? 'Finish Tour' : 'Next →'}
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('coachmark-skip-btn')?.addEventListener('click', dismissCoachmark);
    document.getElementById('coachmark-prev-btn')?.addEventListener('click', () => showCoachmarkStep(stepIndex - 1));
    document.getElementById('coachmark-next-btn')?.addEventListener('click', () => {
        if (stepIndex === COACHMARK_STEPS.length - 1) {
            dismissCoachmark();
        } else {
            showCoachmarkStep(stepIndex + 1);
        }
    });
}

export function dismissCoachmark() {
    const tourOverlay = document.getElementById('coachmark-tour-overlay');
    if (tourOverlay) {
        tourOverlay.classList.add('hidden');
    }
    try {
        localStorage.setItem('pubmed_miner_tour_dismissed', '1');
    } catch (e) {
        console.warn('Could not save coachmark state:', e);
    }
}

export function initCoachmark(force = false) {
    if (!coachmarkEventsAttached) {
        coachmarkEventsAttached = true;
        window.addEventListener('hashchange', () => {
            const overlay = document.getElementById('coachmark-tour-overlay');
            if (overlay && !overlay.classList.contains('hidden')) {
                dismissCoachmark();
            }
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#coachmark-card') || e.target.closest('#btn-replay-tour') || e.target.closest('#btn-replay-tour-footer')) {
                return;
            }
            const overlay = document.getElementById('coachmark-tour-overlay');
            if (overlay && !overlay.classList.contains('hidden')) {
                dismissCoachmark();
            }
        }, true);
    }

    if (force) {
        showCoachmarkStep(0);
        return;
    }
    try {
        if (typeof window !== 'undefined' && window.location.hash) return;
        if (!localStorage.getItem('pubmed_miner_tour_dismissed')) {
            showCoachmarkStep(0);
        }
    } catch (e) {
        console.warn('localStorage check failed:', e);
    }
}

// Window API bindings for backwards compatibility and tests
if (typeof window !== 'undefined') {
    window.HELP_TEXT = HELP_TEXT;
    window.renderHelpButton = renderHelpButton;
    window.openHelpPopover = openHelpPopover;
    window.closeHelpPopover = closeHelpPopover;
    window.toggleHelpPopover = toggleHelpPopover;
    window.initHelpPopovers = initHelpPopovers;
    window.initCoachmark = initCoachmark;
    window.startTour = () => initCoachmark(true);
}

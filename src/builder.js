// Drag-and-Drop Boolean Query Builder (Phase 1)
import { esc } from './parsers.js';

export function formatKeyword(kw) {
    if (!kw) return '';
    const trimmed = String(kw).trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
        return trimmed;
    }
    if (/\s/.test(trimmed)) {
        return `"${trimmed}"`;
    }
    return trimmed;
}

export function compileBooleanQuery(items) {
    if (!items || items.length === 0) return '';
    let result = '';
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const formatted = formatKeyword(item.term);
        const openP = '('.repeat(item.openParens || 0);
        const closeP = ')'.repeat(item.closeParens || 0);

        if (i === 0) {
            result += `${openP}${formatted}${closeP}`;
        } else {
            const op = item.operator || 'AND';
            result += ` ${op} ${openP}${formatted}${closeP}`;
        }
    }
    return result.trim();
}

export function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
    } catch (e) {
        console.warn('Fallback copy failed', e);
    }
    document.body.removeChild(ta);
}

export const BooleanQueryBuilder = {
    items: [], // Array of { id, term, operator, openParens, closeParens, selected }
    isCollapsed: false,
    activePopoverItemId: null,
    idCounter: 0,

    init() {
        const collapseBtn = document.getElementById('qb-collapse-btn');
        const expandBtn = document.getElementById('qb-expand-btn');
        const collapsedView = document.getElementById('qb-collapsed-view');
        const clearBtn = document.getElementById('qb-clear-btn');
        const groupBtn = document.getElementById('qb-group-btn');
        const ungroupBtn = document.getElementById('qb-ungroup-btn');
        const copyBtn = document.getElementById('qb-copy-btn');
        const runSearchBtn = document.getElementById('qb-run-search-btn');
        const popoverClose = document.getElementById('qb-popover-close');
        const popoverOps = document.querySelectorAll('.qb-popover-op');
        const kwInput = document.getElementById('qb-keyword-input');
        const dropZone = document.getElementById('qb-drop-zone');

        if (collapseBtn) collapseBtn.addEventListener('click', () => this.toggleCollapse(true));
        if (expandBtn) expandBtn.addEventListener('click', () => this.toggleCollapse(false));
        if (collapsedView) collapsedView.addEventListener('click', (e) => {
            if (e.target.closest('#qb-expand-btn')) return;
            this.toggleCollapse(false);
        });
        if (clearBtn) clearBtn.addEventListener('click', () => this.clear());
        if (groupBtn) groupBtn.addEventListener('click', () => this.groupSelected());
        if (ungroupBtn) ungroupBtn.addEventListener('click', () => this.ungroupSelected());
        if (copyBtn) copyBtn.addEventListener('click', () => this.copy());
        if (runSearchBtn) runSearchBtn.addEventListener('click', () => this.runSearch());

        if (popoverClose) {
            popoverClose.addEventListener('click', () => this.hideOperatorPopover());
        }

        popoverOps.forEach(btn => {
            btn.addEventListener('click', () => {
                const op = btn.dataset.op;
                if (this.activePopoverItemId && op) {
                    this.setOperator(this.activePopoverItemId, op);
                }
                this.hideOperatorPopover();
            });
        });

        if (kwInput) {
            kwInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = kwInput.value.trim();
                    if (val) {
                        this.addKeyword(val);
                        kwInput.value = '';
                    }
                }
            });
        }

        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('text/plain');
                const targetChip = e.target.closest('.qb-chip');
                if (draggedId && targetChip) {
                    const targetId = targetChip.dataset.id;
                    if (draggedId !== targetId) {
                        const fromIdx = this.items.findIndex(it => it.id === draggedId);
                        const toIdx = this.items.findIndex(it => it.id === targetId);
                        if (fromIdx !== -1 && toIdx !== -1) {
                            const [moved] = this.items.splice(fromIdx, 1);
                            this.items.splice(toIdx, 0, moved);
                            this.syncOperators();
                            this.render();
                        }
                    }
                }
            });
        }

        document.addEventListener('click', (e) => {
            const popover = document.getElementById('qb-operator-popover');
            if (popover && !popover.classList.contains('hidden')) {
                if (!popover.contains(e.target) && !e.target.closest('.qb-op-toggle')) {
                    this.hideOperatorPopover();
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideOperatorPopover();
            }
        });

        this.render();
    },

    addKeyword(kw, preferredOp = 'AND') {
        if (!kw || !String(kw).trim()) return;
        const cleanKw = String(kw).trim();
        const isFirst = this.items.length === 0;
        this.idCounter++;
        const newItem = {
            id: `qb_item_${this.idCounter}_${Date.now()}`,
            term: cleanKw,
            operator: isFirst ? null : preferredOp,
            openParens: 0,
            closeParens: 0,
            selected: false
        };

        this.items.push(newItem);
        if (this.isCollapsed) this.toggleCollapse(false);
        this.render();

        if (!isFirst) {
            this.showOperatorPopover(newItem.id);
        }
    },

    removeChip(id) {
        const idx = this.items.findIndex(it => it.id === id);
        if (idx === -1) return;

        const removed = this.items[idx];
        const hadOpen = removed.openParens || 0;
        const hadClose = removed.closeParens || 0;

        this.items.splice(idx, 1);

        if (hadOpen > 0 || hadClose > 0) {
            this.autoBalanceParens();
        }

        this.syncOperators();
        if (this.activePopoverItemId === id) {
            this.hideOperatorPopover();
        }
        this.render();
    },

    updateChip(id, newTerm) {
        const item = this.items.find(it => it.id === id);
        if (item && newTerm && newTerm.trim()) {
            item.term = newTerm.trim();
            this.render();
        }
    },

    moveChip(id, direction) {
        const idx = this.items.findIndex(it => it.id === id);
        if (idx === -1) return;
        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= this.items.length) return;

        const [moved] = this.items.splice(idx, 1);
        this.items.splice(targetIdx, 0, moved);

        this.syncOperators();
        this.render();
    },

    syncOperators() {
        for (let i = 0; i < this.items.length; i++) {
            if (i === 0) {
                this.items[i].operator = null;
            } else if (!this.items[i].operator) {
                this.items[i].operator = 'AND';
            }
        }
    },

    setOperator(id, op) {
        const item = this.items.find(it => it.id === id);
        if (item) {
            item.operator = op;
            this.render();
        }
    },

    cycleOperator(id) {
        const item = this.items.find(it => it.id === id);
        if (!item) return;
        const ops = ['AND', 'OR', 'NOT'];
        const curIdx = ops.indexOf(item.operator || 'AND');
        item.operator = ops[(curIdx + 1) % ops.length];
        this.render();
    },

    toggleSelect(id) {
        const item = this.items.find(it => it.id === id);
        if (item) {
            item.selected = !item.selected;
            this.updateActionButtons();
            this.renderSelectionStyles();
        }
    },

    groupSelected() {
        const selectedIndices = [];
        this.items.forEach((it, idx) => {
            if (it.selected) selectedIndices.push(idx);
        });
        if (selectedIndices.length < 2) return;

        const minIdx = Math.min(...selectedIndices);
        const maxIdx = Math.max(...selectedIndices);

        this.items[minIdx].openParens = (this.items[minIdx].openParens || 0) + 1;
        this.items[maxIdx].closeParens = (this.items[maxIdx].closeParens || 0) + 1;

        this.items.forEach(it => { it.selected = false; });
        this.render();
    },

    ungroupSelected() {
        const selectedIndices = [];
        this.items.forEach((it, idx) => {
            if (it.selected) selectedIndices.push(idx);
        });
        if (selectedIndices.length === 0) return;

        const minIdx = Math.min(...selectedIndices);
        const maxIdx = Math.max(...selectedIndices);

        if ((this.items[minIdx].openParens || 0) > 0 && (this.items[maxIdx].closeParens || 0) > 0) {
            this.items[minIdx].openParens--;
            this.items[maxIdx].closeParens--;
        } else {
            selectedIndices.forEach(idx => {
                if (this.items[idx].openParens > 0) this.items[idx].openParens--;
                if (this.items[idx].closeParens > 0) this.items[idx].closeParens--;
            });
        }

        this.items.forEach(it => { it.selected = false; });
        this.autoBalanceParens();
        this.render();
    },

    autoBalanceParens() {
        let totalOpen = 0;
        let totalClose = 0;
        this.items.forEach(it => {
            totalOpen += (it.openParens || 0);
            totalClose += (it.closeParens || 0);
        });
        if (totalOpen !== totalClose) {
            const balanced = Math.min(totalOpen, totalClose);
            let opCount = 0;
            this.items.forEach(it => {
                if (it.openParens > 0) {
                    if (opCount < balanced) opCount += it.openParens;
                    else it.openParens = 0;
                }
            });
            let clCount = 0;
            for (let i = this.items.length - 1; i >= 0; i--) {
                if (this.items[i].closeParens > 0) {
                    if (clCount < balanced) clCount += this.items[i].closeParens;
                    else this.items[i].closeParens = 0;
                }
            }
        }
    },

    clear() {
        this.items = [];
        this.hideOperatorPopover();
        this.render();
    },

    compile() {
        return compileBooleanQuery(this.items);
    },

    copy() {
        const q = this.compile();
        if (!q) {
            if (window.showNotification) {
                window.showNotification('Query builder is empty. Add keywords first.', 'warning');
            }
            return;
        }
        const btn = document.getElementById('qb-copy-btn');
        const origHtml = btn ? btn.innerHTML : '';
        const onDone = () => {
            if (btn) {
                btn.innerHTML = '<i class="ph-bold ph-check text-emerald-600"></i> <span class="text-emerald-700">Copied!</span>';
                setTimeout(() => { btn.innerHTML = origHtml; }, 1800);
            }
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(q).then(onDone).catch(() => {
                fallbackCopy(q);
                onDone();
            });
        } else {
            fallbackCopy(q);
            onDone();
        }
    },

    runSearch() {
        const q = this.compile();
        if (!q) {
            if (window.showNotification) {
                window.showNotification('Query is empty. Add keywords to build a query.', 'warning');
            }
            return;
        }
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = q;
        if (window.showLoading) {
            window.showLoading(`Searching PubMed for ${q}...`);
        }
        if (window.performSearch) {
            window.performSearch(q, { switchTabOnSuccess: true });
        }
    },

    toggleCollapse(force) {
        this.isCollapsed = (typeof force === 'boolean') ? force : !this.isCollapsed;
        const collapsedView = document.getElementById('qb-collapsed-view');
        const expandedView = document.getElementById('qb-expanded-view');
        if (this.isCollapsed) {
            if (collapsedView) collapsedView.classList.remove('hidden');
            if (expandedView) expandedView.classList.add('hidden');
            this.hideOperatorPopover();
        } else {
            if (collapsedView) collapsedView.classList.add('hidden');
            if (expandedView) expandedView.classList.remove('hidden');
        }
    },

    showOperatorPopover(itemId) {
        this.activePopoverItemId = itemId;
        const popover = document.getElementById('qb-operator-popover');
        if (!popover) return;

        const item = this.items.find(it => it.id === itemId);
        const currentOp = (item && item.operator) ? item.operator : 'AND';

        popover.querySelectorAll('.qb-popover-op').forEach(btn => {
            if (btn.dataset.op === currentOp) {
                btn.className = 'qb-popover-op px-2 py-0.5 rounded font-bold bg-blue-600 text-white shadow-xs';
            } else {
                btn.className = 'qb-popover-op px-2 py-0.5 rounded font-bold bg-slate-800 text-slate-300 hover:bg-slate-700';
            }
        });

        popover.classList.remove('hidden');
    },

    hideOperatorPopover() {
        const popover = document.getElementById('qb-operator-popover');
        if (popover) popover.classList.add('hidden');
        this.activePopoverItemId = null;
    },

    updateActionButtons() {
        const groupBtn = document.getElementById('qb-group-btn');
        const ungroupBtn = document.getElementById('qb-ungroup-btn');
        const selCount = this.items.filter(it => it.selected).length;

        if (groupBtn) groupBtn.disabled = selCount < 2;
        if (ungroupBtn) {
            const hasParensInSel = this.items.some(it => it.selected && ((it.openParens || 0) > 0 || (it.closeParens || 0) > 0));
            ungroupBtn.disabled = !hasParensInSel || selCount === 0;
        }
    },

    renderSelectionStyles() {
        const dropZone = document.getElementById('qb-drop-zone');
        if (!dropZone) return;
        dropZone.querySelectorAll('.qb-chip').forEach(el => {
            const id = el.dataset.id;
            const item = this.items.find(it => it.id === id);
            if (item && item.selected) {
                el.className = 'qb-chip bg-blue-50 border-blue-400 ring-1 ring-blue-300 border shadow-xs rounded-md px-2 py-1 text-xs font-medium text-slate-800 flex items-center gap-1.5 cursor-grab select-none transition-all';
            } else {
                el.className = 'qb-chip bg-white border-slate-300 border shadow-xs rounded-md px-2 py-1 text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-grab select-none transition-all';
            }
        });
    },

    render() {
        const dropZone = document.getElementById('qb-drop-zone');
        const termsBadge = document.getElementById('qb-terms-badge');
        const booleanStringEl = document.getElementById('qb-boolean-string');
        const collapsedPreview = document.getElementById('qb-collapsed-preview');
        const collapsedCount = document.getElementById('qb-collapsed-count');

        const compiled = this.compile();

        if (booleanStringEl) booleanStringEl.textContent = compiled || '(query empty)';
        if (collapsedPreview) collapsedPreview.textContent = compiled || 'Empty (click or drag nodes to build)';
        if (termsBadge) termsBadge.textContent = `${this.items.length} term${this.items.length === 1 ? '' : 's'}`;
        if (collapsedCount) {
            if (this.items.length > 0) {
                collapsedCount.textContent = `${this.items.length} term${this.items.length === 1 ? '' : 's'}`;
                collapsedCount.classList.remove('hidden');
            } else {
                collapsedCount.classList.add('hidden');
            }
        }

        this.updateActionButtons();

        if (!dropZone) return;
        dropZone.innerHTML = '';

        if (this.items.length === 0) {
            dropZone.innerHTML = `<span id="qb-empty-msg" class="text-xs text-slate-400 italic">Drag keywords from graph or click a node to add...</span>`;
            return;
        }

        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];

            // Opening parentheses
            for (let p = 0; p < (item.openParens || 0); p++) {
                const openSpan = document.createElement('span');
                openSpan.className = 'font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded text-xs select-none';
                openSpan.textContent = '(';
                openSpan.title = 'Opening parenthesis';
                dropZone.appendChild(openSpan);
            }

            // The chip
            const chip = document.createElement('div');
            chip.className = `qb-chip ${item.selected ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300' : 'bg-white border-slate-300'} border shadow-xs rounded-md px-2 py-1 text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-grab select-none transition-all`;
            chip.dataset.id = item.id;
            chip.draggable = true;

            chip.innerHTML = `
                <input type="checkbox" class="qb-chip-checkbox rounded text-blue-600 cursor-pointer" data-id="${item.id}" ${item.selected ? 'checked' : ''} title="Select for grouping">
                <span class="qb-chip-text cursor-pointer hover:underline truncate max-w-[140px]" data-id="${item.id}" title="Click to edit">${esc(formatKeyword(item.term))}</span>
                <button type="button" class="qb-chip-edit text-slate-400 hover:text-slate-700" data-id="${item.id}" title="Edit keyword"><i class="ph ph-pencil-simple text-[11px]"></i></button>
                <button type="button" class="qb-chip-move-left text-slate-400 hover:text-slate-700 ${i === 0 ? 'opacity-25 pointer-events-none' : ''}" data-id="${item.id}" title="Move left"><i class="ph ph-arrow-left text-[11px]"></i></button>
                <button type="button" class="qb-chip-move-right text-slate-400 hover:text-slate-700 ${i === this.items.length - 1 ? 'opacity-25 pointer-events-none' : ''}" data-id="${item.id}" title="Move right"><i class="ph ph-arrow-right text-[11px]"></i></button>
                <button type="button" class="qb-chip-remove text-slate-400 hover:text-red-600 font-bold ml-0.5" data-id="${item.id}" title="Remove term"><i class="ph ph-x text-xs"></i></button>
            `;

            chip.querySelector('.qb-chip-checkbox').addEventListener('change', (e) => {
                e.stopPropagation();
                this.toggleSelect(item.id);
            });

            chip.querySelector('.qb-chip-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeChip(item.id);
            });

            chip.querySelector('.qb-chip-move-left').addEventListener('click', (e) => {
                e.stopPropagation();
                this.moveChip(item.id, -1);
            });

            chip.querySelector('.qb-chip-move-right').addEventListener('click', (e) => {
                e.stopPropagation();
                this.moveChip(item.id, 1);
            });

            const handleEdit = (e) => {
                e.stopPropagation();
                const current = item.term;
                const input = document.createElement('input');
                input.type = 'text';
                input.value = current;
                input.className = 'text-xs px-1.5 py-0.5 border border-blue-400 rounded w-24 focus:outline-none';
                const textSpan = chip.querySelector('.qb-chip-text');
                textSpan.replaceWith(input);
                input.focus();
                input.select();

                const commit = () => {
                    const val = input.value.trim();
                    if (val && val !== current) {
                        this.updateChip(item.id, val);
                    } else {
                        this.render();
                    }
                };
                input.addEventListener('blur', commit);
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') commit();
                    if (ev.key === 'Escape') this.render();
                });
            };

            chip.querySelector('.qb-chip-text').addEventListener('dblclick', handleEdit);
            chip.querySelector('.qb-chip-edit').addEventListener('click', handleEdit);

            chip.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.id);
                chip.classList.add('opacity-50');
            });
            chip.addEventListener('dragend', () => {
                chip.classList.remove('opacity-50');
            });

            dropZone.appendChild(chip);

            for (let p = 0; p < (item.closeParens || 0); p++) {
                const closeSpan = document.createElement('span');
                closeSpan.className = 'font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded text-xs select-none';
                closeSpan.textContent = ')';
                closeSpan.title = 'Closing parenthesis';
                dropZone.appendChild(closeSpan);
            }

            if (i < this.items.length - 1) {
                const nextItem = this.items[i + 1];
                const opBtn = document.createElement('button');
                opBtn.type = 'button';
                const opVal = nextItem.operator || 'AND';
                const colorCls = opVal === 'OR'
                    ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                    : opVal === 'NOT'
                    ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                    : 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200';
                opBtn.className = `qb-op-toggle px-2 py-0.5 rounded text-[11px] font-bold uppercase border transition-colors ${colorCls} select-none flex items-center gap-0.5`;
                opBtn.dataset.nextId = nextItem.id;
                opBtn.title = 'Click to cycle operator (AND / OR / NOT)';
                opBtn.innerHTML = `${opVal} <i class="ph ph-caret-down text-[9px]"></i>`;
                opBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.cycleOperator(nextItem.id);
                });
                dropZone.appendChild(opBtn);
            }
        }
    }
};

if (typeof window !== 'undefined') {
    window.formatKeyword = formatKeyword;
    window.compileBooleanQuery = compileBooleanQuery;
    window.BooleanQueryBuilder = BooleanQueryBuilder;
}

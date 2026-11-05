# PubMed ResearchMiner - Version 0.4 Documentation

This document provides a comprehensive technical overview and user guide for **PubMed ResearchMiner v0.4**, introducing the **Drag-and-Drop Boolean Query Builder** (Keywords Graph tab) and **Contradiction Mapping / Divergence Panel** (Search Results tab), alongside architecture specifications, algorithmic heuristics, developer reference, and the forward-looking Mobile Conversion Roadmap.

---

## 1. Version 0.4 Changelog

### Version 0.4.0
- **Drag-and-Drop Boolean Query Builder (Keywords Graph Tab):**
  - Added floating, collapsible frosted-glass Query Builder toolbar pinned above the Cytoscape graph canvas (`#cy-wrapper`).
  - Cytoscape node drag-and-drop onto the drop zone with automated position restoration (`node.position(savedPos)`) to prevent disruption of node physics, layout, and pan/zoom.
  - Interactive operator selector modal on drop (AND / OR / NOT, defaulting to AND on dismissal) to join new terms with previous expressions.
  - Interactive chip management: drag-to-reorder, keyboard-accessible move left/right (`<`, `>`), inline double-click editing, and chip removal (`×`).
  - Parentheses grouping: multi-chip selection checkboxes with `( ) Group` and `Ungroup` actions.
  - Automatic quoting for multi-word biomedical terms (e.g., `"dietary allulose"` vs `ketosis`).
  - Live plain Boolean query compilation with one-click **Copy** (Clipboard API with textarea fallback) and **Run Search** (executes pipeline and switches to Search Results).
  - Tap/click fallback and keyboard accessibility: clicking a node appends it to the builder; dedicated text input with datalist auto-suggestions populated from current graph keywords.
- **Contradiction Mapping ("Divergence" Panel in Search Results):**
  - Automated contradiction detection between pairs of papers sharing $\ge N$ keywords (configurable $N$, default 2) with opposing conclusion tags.
  - Single-source configuration map (`OPPOSING_CONCLUSION_PAIRS`) defining tags (e.g., Positive vs. Negative, Positive vs. Null-Inconclusive, Supports vs. Refutes) and strength coefficients.
  - Search Results query cards feature a dedicated Divergence panel showing paired papers, shared keyword tags, conclusion badges, and opposition rating.
  - Ranked by number of shared keywords descending, followed by opposition strength descending.
  - Side-by-Side Comparison modal (`#divergence-compare-modal`) displaying full dual-column abstracts, conclusions, study metadata, and highlighted shared keywords.
  - Graph path illumination: selecting an item or clicking "View Path in Graph" transitions to the Keywords Graph, dims unrelated elements, highlights the shared keywords and connecting edges, and smoothly fits the viewport.
  - Large result set handling with pagination (5 items per page) and capping (top 100 pairs); graceful handling of papers with missing or 'None' tags.
- **Mobile Roadmap Integration:**
  - Integrated summary and link to [`Mobile_Conversion_Proposal.docx`](Mobile_Conversion_Proposal.docx) outlining Flutter + Firebase cross-platform architecture, carousel/accordion UI conversion, and server-side graph layout computation.

---

## 2. Architecture Overview

PubMed ResearchMiner remains a zero-build, single-file client-side biomedical discovery application running entirely in modern web browsers:
- **No Backend / No Build Tools:** Served directly as plain HTML/CSS/JS without Node.js, Webpack, or Vite build steps.
- **CDN Dependencies:**
  - Tailwind CSS CDN for utility styling
  - Phosphor Icons CDN for vector iconography
  - Chart.js (v4.4.1) for interactive biomedical metrics bar charts
  - Cytoscape.js (v3.28.1) for force-directed co-occurrence network rendering
  - Dexie.js (v3.2.4) for transactional IndexedDB persistence
  - Graphology & Graphology Library (v0.8.0) for graph structures and Louvain community detection
- **NCBI E-Utilities Integration:** Direct browser HTTPS calls (`esearch`, `esummary`, `efetch`) subject to rate limiting ($\ge 350\text{ ms}$ interval) and HTTP 429 exponential backoff.
- **Client-Side Reactive Subsystems:**
  - `BooleanQueryBuilder`: Manages query state, tokenization, parentheses grouping, and compilation.
  - `Contradiction / Divergence Engine`: Pairwise combinatorial analysis for biomedical contradictions.

---

## 3. User Documentation & How-To Guides

### 1. Using the Drag-and-Drop Boolean Query Builder
The Boolean Query Builder floats at the bottom of the **Keywords Graph** tab:
1. **Adding Terms via Drag-and-Drop:**
   - Click and drag any keyword node from the Cytoscape graph toward the floating Query Builder bar.
   - The drop target illuminates (`#qb-drop-zone`). Release the mouse to drop the node.
   - The graph node immediately snaps back to its original layout position—panning, zooming, and force-directed graph physics are completely undisturbed.
2. **Joining with Operators (AND / OR / NOT):**
   - The first term added requires no operator.
   - On dropping subsequent terms, an operator selector instantly appears: `[ AND ] [ OR ] [ NOT ]`.
   - Click your desired operator, or click anywhere / press `Esc` to accept the default `AND`.
   - To change an operator later, simply click the operator badge (`[ AND ▾ ]`) between chips to cycle between `AND` $\to$ `OR` $\to$ `NOT`.
3. **Grouping with Parentheses `( )`:**
   - To build grouped expressions like `(A AND B) NOT C`:
     1. Add term `A`.
     2. Add term `B` (join with `AND`).
     3. Add term `C` (join with `NOT`).
     4. Check the selection boxes on chips `A` and `B`.
     5. Click the **`( ) Group`** button in the builder toolbar.
     6. Parentheses tokens `(` and `)` are placed around `A` and `B`, compiling to `(A AND B) NOT C`.
   - To remove parentheses, select the grouped chips and click **`Ungroup`**.
4. **Editing and Reordering Chips:**
   - **Edit:** Double-click the chip label or click the pencil icon (`✏`) to edit the keyword inline. Press `Enter` to save.
   - **Reorder:** Click the left/right arrow buttons (`<`, `>`) on any chip, or drag and drop chips horizontally.
   - **Remove:** Click the `×` button on any chip to remove it. Parentheses balances are automatically maintained.
5. **Running and Copying Queries:**
   - The live plain Boolean query string updates in real time in the query box. Multi-word keywords (e.g. `dietary allulose`) are automatically enclosed in quotes (`"dietary allulose"`).
   - Click **`Copy`** to copy the plain Boolean string to the system clipboard.
   - Click **`Run Search`** to populate the main search bar, execute the NCBI search, and transition to the Search Results view.
6. **Keyboard Access & Tap Fallback:**
   - Clicking or tapping any graph node immediately adds it to the Query Builder.
   - Use the `+ Add keyword...` text input to type terms directly and press `Enter`. The input includes an autocomplete datalist populated with the top keywords in the current graph.

---

### 2. Using Contradiction Mapping (Divergence Panel)
The Divergence panel is embedded in every query card in the **Search Results** tab:
1. **Understanding Contradiction Mapping:**
   - Biomedical studies frequently investigate identical interventions or biomarkers (e.g. allulose, ketosis, glycemic control) but report contradictory findings (e.g., one RCT reports significant efficacy while another reports no benefit or adverse effects).
   - The Divergence engine scans all papers in the query result set and identifies pairs of papers that share at least $N$ keywords while having opposing conclusion tags.
2. **Configuring the Minimum Shared Keywords ($N$):**
   - In the top-right of the Divergence panel, use the **`Min Shared (N):`** dropdown (`1`, `2`, `3`, `4`, `5`). Default is `2`.
   - Setting $N = 2$ ensures papers share a substantive contextual basis before being compared. Setting $N = 1$ broadens the search, while $N \ge 3$ limits comparisons to highly overlapping studies.
3. **Reading the Divergence Card:**
   - Each card displays:
     - **Shared Keywords:** Badges indicating the intersection of keywords between the two papers.
     - **Opposition Rating:** Badge displaying the opposition classification (e.g. `Direct Opposition - Positive vs. Negative`, `Positive vs. Null/Inconclusive`).
     - **Paper A vs. Paper B:** Titles, publication years, PMIDs, color-coded conclusion tags, and direct conclusion quotes.
4. **Side-by-Side Comparison Modal:**
   - Click **`Side-by-Side`** on any divergence card to open the dual-column comparison modal.
   - Review complete abstracts, conclusion sections, sample sizes, and study types side-by-side. Shared keywords are highlighted in bold blue badges.
5. **Visualizing the Connecting Path in Keywords Graph:**
   - Click **`View in Graph`** on the card or **`View Path in Graph`** within the modal.
   - The app transitions to the **Keywords Graph** tab, dims unrelated graph elements, highlights the shared keyword nodes and their connecting edges, and smoothly centers the viewport.

---

## 4. Configuration & Heuristics Reference

### 1. Opposing Conclusion Tags Configuration Map
Opposing pairs and their relative opposition weights are configured centrally in `DEFAULT_OPPOSING_CONFIG`:

```javascript
const DEFAULT_OPPOSING_CONFIG = [
    {
        tags: ['Positive', 'Negative'],
        strength: 1.0,
        label: 'Direct Opposition (Positive vs. Negative)'
    },
    {
        tags: ['Positive', 'Null-Inconclusive'],
        strength: 0.7,
        label: 'Positive vs. Null/Inconclusive'
    },
    {
        tags: ['Negative', 'Null-Inconclusive'],
        strength: 0.6,
        label: 'Negative vs. Null/Inconclusive'
    },
    {
        tags: ['Supports', 'Refutes'],
        strength: 1.0,
        label: 'Supports vs. Refutes'
    }
];
```

- **Order Independent:** `getOpposition(tagA, tagB)` matches `tagA` and `tagB` symmetrically.
- **Extensible:** To add custom pairs (e.g. `Safe` vs `Toxic` or `Up-regulated` vs `Down-regulated`), append an object with `{ tags: ['Safe', 'Toxic'], strength: 1.0, label: 'Safety Conflict' }`.

### 2. Divergence Ranking Algorithm
Pairs are ranked deterministically:
$$\text{Score}(P_A, P_B) = 10 \cdot |\text{Keywords}(P_A) \cap \text{Keywords}(P_B)| + \text{Strength}(\text{Opposition}(P_A, P_B))$$
1. **Primary Sort:** Number of shared keywords descending.
2. **Secondary Sort:** Strength of opposition descending ($1.0 > 0.7 > 0.6$).

### 3. Divergence Limits & Edge Cases
- **Missing Tags:** Articles where `conclusionType === 'None'` or undefined are automatically excluded from pairing.
- **Identical Tags:** Pairs sharing identical tags (e.g., Positive & Positive) are excluded.
- **Large Result Sets:** Candidate pairs are capped at `MAX_DIVERGENCE_PAIRS = 100` and paginated with 5 items per page (`pageSize = 5`) to guarantee responsive DOM rendering.
- **Empty States:** When 0 opposing pairs meet the threshold $N$, an empty state card informs the user and suggests lowering $N$.

---

## 5. Functions Reference (v0.4 Additions)

| Function | Inputs | Outputs | Description |
| :--- | :--- | :--- | :--- |
| `formatKeyword(kw)` | `kw: string` | `string` | Encloses multi-word keywords in quotes; preserves single words and already-quoted strings. |
| `compileBooleanQuery(items)` | `items: Array` | `string` | Compiles chip objects, operators, and parentheses into a valid PubMed Boolean string. |
| `BooleanQueryBuilder.init()` | None | `void` | Binds DOM event handlers, keyboard shortcuts, and drag-and-drop targets for the query builder. |
| `BooleanQueryBuilder.addKeyword(kw, op)` | `kw: string`, `op?: string` | `void` | Appends a keyword chip. Shows operator popover if index > 0. |
| `BooleanQueryBuilder.removeChip(id)` | `id: string` | `void` | Removes a chip and maintains parentheses balance. |
| `BooleanQueryBuilder.moveChip(id, dir)` | `id: string`, `dir: -1 \| 1` | `void` | Reorders a chip left or right; adjusts operators. |
| `BooleanQueryBuilder.setOperator(id, op)` | `id: string`, `op: string` | `void` | Sets the Boolean operator (`AND`, `OR`, `NOT`) joining a term. |
| `BooleanQueryBuilder.groupSelected()` | None | `void` | Encloses selected consecutive chips in parentheses `( )`. |
| `BooleanQueryBuilder.ungroupSelected()` | None | `void` | Removes outer parentheses from selected chips. |
| `BooleanQueryBuilder.runSearch()` | None | `void` | Copies query string to search bar and calls `performSearch(...)`. |
| `BooleanQueryBuilder.copy()` | None | `void` | Copies live query string to system clipboard. |
| `getOpposition(tagA, tagB, config?)` | `tagA: string`, `tagB: string` | `object` | Evaluates if two conclusion tags oppose each other per config rules. |
| `findDivergentPairs(articles, opts?)` | `articles: Article[]`, `opts?: object` | `Array` | Evaluates result set for pairs sharing $\ge N$ keywords with opposing tags; ranks results. |
| `renderDivergencePanel(card, queryId, n, page)` | `card: Element`, `queryId: number`, `n: number`, `page: number` | `Promise<void>` | Renders the paginated divergence cards inside a query card. |
| `openDivergenceCompareModal(pair, queryId)` | `pair: object`, `queryId: number` | `void` | Displays dual-column side-by-side comparison modal with highlighted shared keywords. |
| `highlightConnectingPath(queryId, kws)` | `queryId: number`, `kws: string[]` | `Promise<void>` | Switches to Keywords Graph, dims canvas, highlights connecting nodes/edges, and fits viewport. |

---

## 6. Mobile Conversion Roadmap

The mobile architecture plan is documented in [`Mobile_Conversion_Proposal.docx`](Mobile_Conversion_Proposal.docx) (located in the project distribution). Below is an executive summary of the conversion strategy:

### 1. Technology Stack: Flutter + Firebase
- **Client Framework:** Cross-platform **Flutter** (iOS & Android) utilizing a single reactive Dart codebase.
- **Backend Infrastructure:** **Firebase Cloud Functions** and **Firebase Firestore**:
  - Offloads heavy NCBI XML parsing, batch deduplication, and rate limiting from mobile cellular connections.
  - Caches primer topic runs and PubMed esearch responses centrally in Firestore with TTL expiration, drastically reducing redundant NCBI queries across devices.

### 2. Adaptive Mobile UI: Carousel & Accordion Patterns
- **Query Dashboard Transformation:**
  - The desktop 8-chart grid is refactored into a high-performance **swipeable Carousel** with page indicator dots, allowing smooth horizontal thumb navigation through Study Type, Sample Size, Citations, and Keywords.
  - Detail tables and primer multi-query lists convert into **collapsible Accordion widgets** (`ExpansionTile`), preserving vertical viewport budget.
- **Mobile Boolean Query Builder:**
  - Bottom sheet query builder (`showModalBottomSheet`) with haptic feedback on chip selection and tap-to-add gestures replacing desktop drag-and-drop.
  - Responsive chip wrap with single-tap operator switching.

### 3. Server-Side Graph Layout Computation
- Force-directed graph layouts (CoSE / Louvain community detection) require non-trivial CPU and memory on dense networks ($\ge 100$ nodes, $> 500$ edges).
- **Architecture:** Node coordinates $(x, y)$, cluster IDs, and edge routes are calculated in a Firebase Node.js Cloud Function running `graphology` and pre-computed CoSE simulation.
- **Mobile Rendering:** Flutter CustomPainter renders pre-computed vector coordinates with 60 FPS hardware acceleration via Skia / Impeller, eliminating mobile CPU thermal throttling and battery drain.

---

## 7. Testing & Verification

Comprehensive test suites verify both subsystems:
- `test_boolean_builder.js`: Pure logic tests for keyword quotation, parentheses balancing, and Boolean compilation.
- `test_divergence_logic.js`: Pure logic tests for contradiction mapping, opposition rules, configurable $N$, and ranking.
- `test_phase1_query_builder.js`: End-to-end Playwright suite verifying UI chip building, `(A AND B) NOT C` acceptance, keyboard inputs, operator popovers, and drag-and-drop Cytoscape position preservation.
- `test_phase2_divergence.js`: End-to-end Playwright suite verifying known opposing pair detection, exclusion of unrelated/single-keyword/missing-tag papers, threshold $N$ switching, side-by-side modal, and graph path highlighting.

Run all test suites with:
```bash
node test_boolean_builder.js
node test_divergence_logic.js
node test_phase1_query_builder.js
node test_phase2_divergence.js
```

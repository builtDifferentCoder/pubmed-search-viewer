# PubMed ResearchMiner - Version 0.3 Documentation

This document provides a comprehensive technical overview of **PubMed ResearchMiner v0.3**, including architecture, the multi-step NCBI data retrieval and rate-limiting pipeline, IndexedDB v3 schema, the "Search Primers" multi-query synthesis engine, weighted keyword graph visualization, and client-side Louvain community detection.

---

## 1. Architecture Overview

PubMed ResearchMiner is a single-file, zero-build client-side web application running entirely in modern web browsers:
- **No Backend / No Build Tools:** Served directly as plain HTML/CSS/JS without Node.js, Webpack, or Vite runtimes.
- **CDN Dependencies:**
  - Tailwind CSS CDN for reactive utility styling
  - Phosphor Icons CDN for vector iconography
  - Chart.js (v4.4.1) for interactive biomedical metrics bar charts
  - Cytoscape.js (v3.28.1) for force-directed co-occurrence network rendering
  - Dexie.js (v3.2.4) for transactional IndexedDB persistence
  - Graphology & Graphology Library (v0.8.0) for graph structures and Louvain community detection (with built-in deterministic JS fallback)
- **NCBI E-Utilities Integration:** Direct browser-to-NCBI HTTPS calls (`esearch`, `esummary`, `efetch`) subject to strict client-side rate limiting and HTTP 429 exponential backoff.
- **Hash-based Routing:** Single-page client-side router (`#/primers/:topicId`) with full browser history support (Back/Forward) and 404 error boundaries.

---

## 2. Dexie Schema Evolution (v1 &rarr; v2 &rarr; v3)

### Version 1 Schema
```javascript
db.version(1).stores({
    queries:  '++id, term, createdAt',
    articles: '++id, queryId, pmid, hasConclusion, citations, *keywordsNorm'
});
```

### Version 2 Schema
Added indexed dimensional fields for the 8-chart interactive dashboard:
```javascript
db.version(2).stores({
    queries:  '++id, term, createdAt',
    articles: '++id, queryId, pmid, hasConclusion, citations, *keywordsNorm, pubYear, studyType, subjectType, sampleSizeBucket, conclusionType'
}).upgrade(tx => {
    return tx.table('articles').toCollection().modify(article => {
        if (article.pubYear === undefined) {
            const m = (article.dateStr || '').match(/\b(19\d\d|20\d\d)\b/);
            article.pubYear = m ? parseInt(m[1], 10) : 0;
        }
        if (article.studyType === undefined) article.studyType = 'Other';
        if (article.subjectType === undefined) article.subjectType = 'Other/Unknown';
        if (article.sampleSize === undefined) article.sampleSize = null;
        if (article.sampleSizeBucket === undefined) article.sampleSizeBucket = 'Unknown';
        if (article.conclusionType === undefined) {
            article.conclusionType = article.hasConclusion ? 'Null-Inconclusive' : 'None';
        }
    });
});
```

### Version 3 Schema (Current)
Introduced the `primerRuns` table for caching multi-query primer syntheses:
```javascript
db.version(3).stores({
    queries:    '++id, term, createdAt',
    articles:   '++id, queryId, pmid, hasConclusion, citations, *keywordsNorm, pubYear, studyType, subjectType, sampleSizeBucket, conclusionType',
    primerRuns: 'topicId'
});
```
- **Primary Key:** `topicId` (string, e.g. `'mens-health'`, `'longevity'`).
- **Cached Record Structure:**
  ```javascript
  {
      topicId: string,
      queryHits: [{ q: string, note: string, hits: number, retrieved: number }],
      articles: Array<Article>,
      totalCount: number,
      timestamp: number
  }
  ```
- **TTL Cache Invalidation:** Reused automatically if younger than `PRIMER_CACHE_TTL_MS` (24 hours). The "Refresh" button bypasses the cache and forces live re-fetching.

---

## 3. Configuration Constants & Tunables

All tunable parameters are centrally declared in the configuration block at the top of the `<script>` tag:

```javascript
// NCBI API & Search Settings
const API_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
const MAX_RESULTS = 50;                  // Articles per single search
const YEARS_BACK = 5;                    // Date range lookback (years)
const DAYS_BACK = YEARS_BACK * 365;      // In days for esearch reldate
const TOP_KEYWORDS = 8;                  // Bar chart keyword count
const DEFAULT_GRAPH_KEYWORD_CAP = 60;    // Default top keywords in Cytoscape graph
const DENSE_GRAPH_EDGE_THRESHOLD = 40;   // Co-occurrence edge threshold for density toggle

// Search Primers Settings
const PRIMER_MAX_PER_QUERY = 25;         // Max PMIDs retrieved per primer query
const PRIMER_REQUEST_GAP_MS = 350;       // Minimum delay between sequential NCBI calls (>= 350ms)
const PRIMER_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24-hour IndexedDB cache TTL

// Keywords Graph Sizing & Typography
const GRAPH_MIN_RADIUS = 10;             // Minimum node radius in pixels
const GRAPH_MAX_RADIUS = 34;             // Maximum node radius in pixels (Cytoscape diameter = 2 * radius)
const GRAPH_MIN_FONT = 10;               // Label font size for min radius (px)
const GRAPH_MAX_FONT = 18;               // Label font size for max radius (px)

// Louvain Community Detection & Categorical Palette
const GRAPH_MAX_CLUSTERS = 8;            // Maximum number of named topic clusters
const GRAPH_MIN_CLUSTER_SIZE = 3;        // Minimum cluster size; smaller groups merge into "Other"
const CLUSTER_PALETTE = [
    '#0072b2', // Okabe-Ito Blue
    '#e69f00', // Okabe-Ito Orange
    '#009e73', // Okabe-Ito Bluish Green
    '#f0e442', // Okabe-Ito Yellow
    '#56b4e9', // Okabe-Ito Sky Blue
    '#d55e00', // Okabe-Ito Vermilion
    '#cc79a7', // Okabe-Ito Reddish Purple
    '#44aa99'  // Okabe-Ito Teal
];
const CLUSTER_OTHER_COLOR = '#94a3b8';   // Slate gray for unclustered/small components
const CLUSTER_OTHER_BORDER = '#64748b';

// Sample Size Thresholds
const SAMPLE_SIZE_THRESHOLDS = {
    PILOT_MAX: 19,                       // Pilot: 1..19
    SMALL_MIN: 20,
    SMALL_MAX: 99,                       // Small: 20..99
    MEDIUM_MIN: 100,
    MEDIUM_MAX: 499,                     // Medium: 100..499
    LARGE_MIN: 500                       // Large: 500+
};
```

---

## 4. Key Subsystems & Heuristics

### 1. Two-Step NCBI Retrieval & Sequential Rate Limiting
- **Decomposed Pipeline:**
  - `esearchPmids(term, retmax, options)`: Queries NCBI `esearch.fcgi` for matching PMIDs.
  - `hydrate(pmids)`: Performs one `esummary.fcgi` (fetching citation counts) and one `efetch.fcgi` (parsing full Medline XML), reconstructing rich Article objects. Automatically uses HTTP POST when the PMID list is long.
  - `rateLimitedNcbiFetch(url, options)`: Enforces a minimum `PRIMER_REQUEST_GAP_MS` (350 ms) spacing between consecutive network calls to respect NCBI's 3 req/sec limit. Automatically retries once with exponential backoff on HTTP 429.
- **Search Primers Engine:**
  - Iterates over the 5 topic queries sequentially with $\ge 350\text{ ms}$ pauses.
  - Deduplicates PMIDs across queries into a unified set.
  - Hydrates the union of PMIDs in a single batch.
  - Attaches `matchedQueries` (`Q1`, `Q2`...) and `matchedNotes` to each article.
  - Sorts deduplicated results by number of matching queries descending, then citation count descending.

### 2. Interactive Pre-Set Query Execution ([Search] Button)
- **Direct Drilldown Execution:**
  - Each pre-set query in the Search Primers detail page accordion features a dedicated `[Search]` button.
  - **Attribute-Based String Lookup:** Buttons store `data-topic-id` and `data-query-index` attributes. Clicking fetches the exact, untruncated query string directly from `PRIMER_TOPICS[topicId].queries[queryIndex].q` in memory. This eliminates string mangling or escaping vulnerabilities with complex Boolean syntax containing nested quotes and parentheses.
- **Shared Search Workflow:**
  - Invokes `performSearch(targetQuery, { switchTabOnSuccess: true })` directly—reusing the single search pipeline without duplication.
  - Populates the header `#search-input` field with the exact query string.
  - Saves the query and retrieved articles in IndexedDB (`queries` and `articles` tables).
  - Transitions to the "Search Results" tab and smoothly scrolls to the generated query card.
- **Event Isolation & Error Resilience:**
  - Click handlers invoke `e.stopPropagation()` and `e.preventDefault()`, preserving the accordion open/close state.
  - Search buttons are temporarily disabled and the global loading overlay is displayed during execution to guard against double-clicks.
  - If a search yields 0 results or encounters an error, the user remains on the primer detail page with the notification banner displayed rather than being navigated to an empty tab.
  - Upon successful search, the route hash cleanly resets (`window.location.hash = '#/'`), allowing standard browser Back button navigation back to the primer page.
  - Long Boolean query titles in Search Results cards utilize `break-words` and `min-w-0 max-w-full` to prevent horizontal layout overflow.

### 3. Keywords Graph Non-Linear Node Sizing & Size-Aware CoSE Layout
- **Node Strength (Weighted Degree):**
  $$\text{strength}(v) = \sum_{u \in \text{neighbors}(v)} \text{weight}(u, v)$$
  Computed strictly on the **unfiltered** co-occurrence matrix so toggling "Hide weight < 2" does not alter node dimensions.
- **Sub-Linear Radius Scaling:**
  $$\text{radius}(v) = R_{\min} + (R_{\max} - R_{\min}) \cdot \sqrt{\frac{\text{strength}(v) - S_{\min}}{S_{\max} - S_{\min}}}$$
  - Isolated/zero-strength nodes: clamped to $R_{\min} = 10\text{ px}$.
  - Equal-strength or single-node graphs: clamped to midpoint radius $\frac{R_{\min} + R_{\max}}{2} = 22\text{ px}$.
- **Typography Sizing:**
  $$\text{fontSize}(v) = \text{round}\left(F_{\min} + (F_{\max} - F_{\min}) \cdot \frac{\text{radius}(v) - R_{\min}}{R_{\max} - R_{\min}}\right)\text{ px}$$
- **Size-Aware CoSE Force Layout:**
  - Repulsion scales dynamically with node size:
    $$\text{repulsion}(n) = 4000 \cdot \left(\frac{\text{size}}{20}\right)^{1.35}$$
  - Edge length expands with endpoint sizes:
    $$\text{edgeLength}(e) = 60 + 0.6 \cdot (\text{sourceSize} + \text{targetSize})$$

### 4. Louvain Community Detection & Post-Processing Heuristics
- **Algorithm:**
  - Evaluates modularity optimization:
    $$\Delta Q = q_{\text{in}}(C) - \frac{s_{\text{tot}}(C) \cdot k_i}{2m}$$
  - Utilizes `graphology-library`'s Louvain implementation when available via CDN, falling back seamlessly to an in-file deterministic Louvain implementation.
  - Both engines sort nodes deterministically by string ID prior to passes, ensuring graph re-layouts or page refreshes produce identical cluster assignments.
- **Cluster Post-Processing:**
  1. Filters raw communities by minimum size: clusters must have at least `GRAPH_MIN_CLUSTER_SIZE = 3` nodes.
  2. Sorts candidate clusters by total aggregated strength descending.
  3. Retains top `GRAPH_MAX_CLUSTERS = 8` clusters.
  4. Names each cluster after its highest-strength keyword (broken by frequency, then alphabetical).
  5. Maps each cluster to an Okabe-Ito colorblind palette entry.
  6. Merges all remaining nodes (singletons, pairs, low-strength clusters) into a neutral gray `'Other'` cluster (`#94a3b8`).
- **Graph UI & Visual Feedback:**
  - Node hover preserves individual cluster colors (`node.highlighted` modifies only border width and dark slate border color).
  - Edge default opacity is reduced to $0.12\text{--}0.35$; incident edges pop to $0.9$ opacity and dark `#1e293b` on hover.
  - Floating cursor-following tooltip displays keyword, co-occurrences, article count, and cluster name.
  - Collapsible topic cluster legend overlay (`#graph-legend`) with click-to-filter capability.

---

## 5. Functions Reference

| Function | Inputs | Outputs | Description |
| :--- | :--- | :--- | :--- |
| `esc(str)` | `str: any` | `string` | Escapes HTML entities (`&`, `<`, `>`, `"`, `'`) for XSS protection. |
| `showLoading(msg)` | `msg: string` | `void` | Activates backdrop spinner with dynamic status message. |
| `hideLoading()` | None | `void` | Dismisses backdrop spinner overlay. |
| `showNotification(msg, type)` | `msg: string`, `type?: string` | `void` | Displays top banner notification. |
| `hideNotification()` | None | `void` | Hides notification banner. |
| `switchTab(tabId)` | `tabId: 'results' \| 'graph' \| 'primers'` | `void` | Switches between main tabs and manages active button styles. |
| `rateLimitedNcbiFetch(url, opts)` | `url: string`, `opts?: object` | `Promise<Response>` | Fetches NCBI endpoint with $\ge 350\text{ ms}$ interval and 429 retry backoff. |
| `esearchPmids(term, retmax, opts)` | `term: string`, `retmax?: number`, `opts?: object` | `Promise<{ pmids: string[], count: number }>` | Retrieves PMIDs from NCBI `esearch.fcgi`. |
| `hydrate(pmids)` | `pmids: string[]` | `Promise<Article[]>` | Hydrates PMIDs via `esummary.fcgi` (citations) and `efetch.fcgi` (Medline XML). |
| `fetchArticles(query)` | `query: string` | `Promise<{ articles: Article[], totalCount: number }>` | Backward-compatible wrapper executing `esearchPmids` + `hydrate`. |
| `fetchPrimerArticles(topic, onProgress)` | `topic: object`, `onProgress?: Function` | `Promise<object>` | Executes 5 sequential primer queries, deduplicates by PMID, and returns tagged records. |
| `showPrimerPage(topicId, opts)` | `topicId: string`, `opts?: object` | `Promise<void>` | Renders dedicated primer view with collapsible queries, hit counts, and results table. |
| `renderPrimersGrid()` | None | `void` | Renders topic cards grid in the "Search Primers" tab view. |
| `handleRoute()` | None | `Promise<void>` | Parses `window.location.hash` and routes to primer page or tabs view. |
| `computeNodeRadius(strength, min, max)`| `strength: number`, `min: number`, `max: number` | `number` | Calculates square-root scaled node radius within $[10, 34]\text{ px}$. |
| `computeNodeFontSize(radius)` | `radius: number` | `number` | Calculates label font size proportional to radius ($10\text{--}18\text{ px}$). |
| `runInFileLouvain(nodes, edges)` | `nodes: Array`, `edges: Array` | `Record<string, number>` | Deterministic local modularity optimization for community detection. |
| `detectCommunitiesLouvain(nodes, edges)`| `nodes: Array`, `edges: Array` | `Record<string, number>` | Dispatches to Graphology Louvain or in-file fallback. |
| `processClusters(rawNodes, communities)`| `rawNodes: Array`, `communities: object` | `Cluster[]` | Applies min size $\ge 3$, top 8 sort, cluster naming, and "Other" grouping. |
| `renderLegend(clusters)` | `clusters: Cluster[]` | `void` | Renders collapsible legend overlay in `#cy-wrapper` with click-to-filter. |
| `showGraphTooltip(node, pos)` | `node: cytoscape.NodeSingular`, `pos: object` | `void` | Displays floating card with node metrics near cursor position. |
| `updateGraphTooltipPosition(pos)`| `pos: { x: number, y: number }` | `void` | Positions floating tooltip within bounds of `#cy-wrapper`. |
| `hideGraphTooltip()` | None | `void` | Hides floating graph tooltip. |
| `renderKeywordsGraph(queryId?)` | `queryId?: number` | `Promise<void>` | Builds co-occurrence network, executes Louvain clustering, sizes nodes, and renders Cytoscape instance. |
| `renderQueryCard(q)` | `q: object` | `Promise<void>` | Renders 8-chart dashboard card for a stored query. |
| `renderAll()` | None | `Promise<void>` | Re-renders stored query cards and refreshes UI dropdowns. |

---

## 6. Known Limitations & Engineering Tradeoffs

1. **NCBI E-Utilities Rate Limits:**
   - NCBI limits unauthenticated client IP addresses to 3 requests per second.
   - Primers require 5 `esearch` calls, 1 `esummary` call, and 1 `efetch` call. Sequential request spacing ($\ge 350\text{ ms}$) prevents rate limit throttling, requiring $\sim 2.5\text{ seconds}$ to complete a full live primer run.
2. **Client-Side Louvain Scale Limits:**
   - Louvain modularity optimization runs in the browser thread. For typical keyword caps ($20\text{--}100$ nodes), execution completes in $< 5\text{ ms}$. For extreme node counts ($> 1,000$), clustering should be offloaded to a Web Worker.
3. **In-Memory Chart & Graph Lifecycle:**
   - Multiple query cards create multiple Chart.js canvas instances. To prevent memory leaks, `destroyAllCharts()` and `destroyCytoscape()` clean up active instances before DOM replacements.
4. **PMC-Only Citation Metric:**
   - Article citation counts originate strictly from PubMed Central (`pmcrefcount`), reflecting open-access citations rather than total global scientific citations.

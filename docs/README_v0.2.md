# PubMed ResearchMiner - Version 0.2 Documentation

This document describes the architecture, data extraction pipeline, configuration, IndexedDB schema migration, and extension points for **PubMed ResearchMiner v0.2**.

---

## 1. Dexie Schema (Version 1 &rarr; Version 2 Migration)

### Version 1 Schema
```javascript
db.version(1).stores({
    queries:  '++id, term, createdAt',
    articles: '++id, queryId, pmid, hasConclusion, citations, *keywordsNorm'
});
```

### Version 2 Schema
```javascript
db.version(2).stores({
    queries:  '++id, term, createdAt',
    articles: '++id, queryId, pmid, hasConclusion, citations, *keywordsNorm, pubYear, studyType, subjectType, sampleSizeBucket, conclusionType'
}).upgrade(tx => {
    return tx.table('articles').toCollection().modify(article => {
        // Safe default assignments for existing v1 records:
        if (article.pubYear === undefined) {
            const m = (article.dateStr || '').match(/\b(19\d\d|20\d\d)\b/);
            article.pubYear = m ? parseInt(m[1], 10) : 0;
        }
        if (article.studyType === undefined) {
            article.studyType = 'Other';
        }
        if (article.subjectType === undefined) {
            article.subjectType = 'Other/Unknown';
        }
        if (article.sampleSize === undefined) {
            article.sampleSize = null;
        }
        if (article.sampleSizeBucket === undefined) {
            article.sampleSizeBucket = 'Unknown';
        }
        if (article.conclusionType === undefined) {
            article.conclusionType = article.hasConclusion ? 'Null-Inconclusive' : 'None';
        }
    });
});
```

### Indexed Filter Fields
The newly added fields (`pubYear`, `studyType`, `subjectType`, `sampleSizeBucket`, `conclusionType`) are declared as indexed properties in Dexie. This permits direct indexed lookups and fast filtering when bars are clicked.

---

## 2. Functions Overview (Inputs and Outputs)

| Function | Inputs | Outputs | Description |
| :--- | :--- | :--- | :--- |
| `esc(str)` | `str: any` | `string` | Escapes `&`, `<`, `>`, `"`, and `'` characters for safe HTML injection (prevents XSS). |
| `showLoading(message)` | `message: string` | `void` | Activates backdrop spinner overlay with dynamic status text. |
| `hideLoading()` | None | `void` | Dismisses backdrop loading overlay. |
| `showNotification(msg, type)` | `message: string`, `type?: 'error'\|'info'` | `void` | Renders user-visible alerts in the notification container. |
| `hideNotification()` | None | `void` | Hides the notification container. |
| `destroyAllCharts()` | None | `void` | Loops through all active Chart.js instances, calls `.destroy()`, and clears the tracking array to avoid memory leaks. |
| `destroyCytoscape()` | None | `void` | Calls `.destroy()` on the active Cytoscape.js instance and nullifies the reference. |
| `switchTab(tabId)` | `tabId: 'results' \| 'graph'` | `void` | Switches between "Search Results" and "Keywords Graph" tabs, updating button states and refreshing graph layouts. |
| `extractPubYear(pubDateNode, articleEl)` | `pubDateNode: Element`, `articleEl: Element` | `number` | Parses year from `Journal/PubDate/Year`, falling back to `MedlineDate` regex or `ArticleDate/Year`. Returns 4-digit number or 0 if unknown. |
| `extractStudyType(articleEl)` | `articleEl: Element` | `string` | Extracts publication types from `PublicationTypeList` and matches by priority order against standard types (`Randomized Controlled Trial`, `Clinical Trial`, `Meta-Analysis`, `Systematic Review`, `Review`, `Case Reports`, `Observational Study`, `Other`). |
| `extractSubjectType(articleEl, keywordsNorm, fullText)` | `articleEl: Element`, `keywordsNorm: string[]`, `fullText: string` | `string` | Analyzes `MeshHeadingList`, author keywords, and abstract/title text to classify into `Human`, `Animal`, `In vitro`, or `Other/Unknown`. |
| `extractSampleSize(text)` | `text: string` (title + abstract) | `number \| null` | Runs regex patterns for participant/cohort mentions (`n = 120`, `120 patients`, `cohort of 120`) and returns the largest plausible integer match, or `null`. |
| `determineSampleSizeBucket(sampleSize, text)` | `sampleSize: number \| null`, `text: string` | `string` | Assigns sample size to `'Pilot'`, `'Small'`, `'Medium'`, `'Large'`, `'Large + Longitudinal'` (if N &ge; 500 and longitudinal terms detected), or `'Unknown'`. |
| `extractConclusion(articleEl)` | `articleEl: Element` | `object` | Extracts text and label from `AbstractText` sections marked with `CONCLUSION` or `DISCUSSION`. Falls back to the trailing abstract paragraph. |
| `determineConclusionType(conclusionText, hasConclusion)` | `conclusionText: string`, `hasConclusion: number` | `string` | Evaluates conclusion text against polarity keywords returning `'Positive'`, `'Negative'`, `'Null-Inconclusive'`, or `'None'`. |
| `fetchArticles(query)` | `query: string` | `Promise<{ articles: Array, totalCount: number }>` | Calls NCBI `esearch`, `esummary` (for `pmcrefcount`), and `efetch` (XML parser), building the enriched article records. |
| `performSearch(query, options)` | `query: string`, `options?: { switchTabOnSuccess: boolean }` | `Promise<boolean>` | Executes search, writes query and articles into IndexedDB in a single transaction (replacing duplicates), re-renders views, and optionally navigates to results. |
| `buildQueryMetrics(queryId)` | `queryId: number` | `Promise<object>` | Computes counts and bar chart definitions for all 8 charts, along with aggregate card summary chips. |
| `fetchSubset(queryId, filter)` | `queryId: number`, `filter: { field: string, value: any }` | `Promise<Array>` | Generic IndexedDB filter function that returns the matching article rows sorted by citation count descending. |
| `rowHtml(article)` | `article: object` | `string` | Returns escaped HTML table row representing an article with metadata chips and expandable abstract. |
| `tableHtml(rows)` | `rows: Array` | `string` | Wraps rows into an overflow-scrollable table structure. |
| `renderQueryCard(q)` | `q: object` | `Promise<void>` | Renders a stored query card with header chips, 3-row responsive grid of 8 Chart.js bar charts, and inline detail table. |
| `renderAll()` | None | `Promise<void>` | Cleans up charts, queries Dexie for stored searches, re-renders query cards, and updates the graph query dropdown. |
| `renderKeywordsGraph(selectedQueryId?)` | `selectedQueryId?: number` | `Promise<void>` | Builds keyword co-occurrence matrix from articles, initializes Cytoscape force-directed layout, configures hover neighbor highlighting, and binds node click to PubMed search. |

---

## 3. Configuration Constants & Thresholds

All thresholds and configuration constants are placed together at the top of the script:

```javascript
const API_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
const MAX_RESULTS = 50;                  // Articles per search
const YEARS_BACK = 5;                    // Date range lookback
const DAYS_BACK = YEARS_BACK * 365;      // In days for esearch reldate
const TOP_KEYWORDS = 8;                  // Bar chart keyword count
const DEFAULT_GRAPH_KEYWORD_CAP = 60;    // Default top keywords in Cytoscape graph
const DENSE_GRAPH_EDGE_THRESHOLD = 40;   // Co-occurrence edge count threshold for density filter

// Sample Size Threshold Configuration
const SAMPLE_SIZE_THRESHOLDS = {
    PILOT_MAX: 19,       // Pilot: N < 20 (1..19)
    SMALL_MIN: 20,
    SMALL_MAX: 99,       // Small: 20..99
    MEDIUM_MIN: 100,
    MEDIUM_MAX: 499,     // Medium: 100..499
    LARGE_MIN: 500       // Large: 500+
};

// Buckets and Study Types
const SAMPLE_SIZE_BUCKETS = ['Pilot', 'Small', 'Medium', 'Large', 'Large + Longitudinal', 'Unknown'];
const CONCLUSION_TYPES = ['Positive', 'Negative', 'Null-Inconclusive', 'None'];
const SUBJECT_TYPES = ['Human', 'Animal', 'In vitro', 'Other/Unknown'];
const STUDY_TYPES = [
    'Randomized Controlled Trial',
    'Clinical Trial',
    'Meta-Analysis',
    'Systematic Review',
    'Review',
    'Case Reports',
    'Observational Study',
    'Other'
];
```

---

## 4. Extraction Heuristics & Known Limitations

### 1. Sample Size Extraction Heuristic
- **Mechanism:** Searches title and abstract for explicit sample size expressions:
  - `n = <number>` or `N=<number>`
  - `<number> participants|patients|subjects|adults|men|women|volunteers|cases|individuals`
  - `sample size of <number>`, `cohort of <number>`, `total of <number>`
- **Selection:** Takes the largest plausible match (`val > 0 && val < 10,000,000`). If no match is found, sets `sampleSize = null` and bucket = `'Unknown'`.
- **Longitudinal Classification:** If $N \ge 500$ and the combined text contains terms matching `longitudinal`, `follow-up`, `prospective cohort`, or `years of follow-up`, the bucket is assigned `'Large + Longitudinal'`.
- **Known Limitations:**
  - Abstracts occasionally report intermediate subgroup sizes, dropout counts, or historical references rather than total enrolled cohort size.
  - Case studies with qualitative descriptions without explicit numerical digits will categorize as `Unknown`.

### 2. Conclusion Type Heuristic
- **Mechanism:** If an article has a labeled `CONCLUSION` or `DISCUSSION` abstract section, it is categorized via keyword heuristics:
  - **Null-Inconclusive:** Checked first to prevent negations (e.g., "no significant difference", "did not differ", "inconclusive", "further research is needed", "comparable to placebo").
  - **Negative:** Checked next for failure/harm signals ("ineffective", "failed to", "no benefit", "harmful", "adverse", "worsened", "inferior").
  - **Positive:** Checked for positive clinical efficacy ("effective", "significantly improved", "beneficial", "promising", "favorable", "superior").
  - **Fallback:** If labeled section exists without polarity indicators, defaults to `'Null-Inconclusive'`.
  - **None:** Assigned if no conclusion section exists.
- **Known Limitations:**
  - Biomedical conclusions are nuanced and conditional; keyword pattern matching cannot substitute for deep semantic context.

### 3. Citations (`pmcrefcount`)
- **Mechanism:** Retrieved from NCBI `esummary.fcgi` (`result[uid].pmcrefcount`).
- **Known Limitations:**
  - Counts citations originating from PubMed Central (PMC) open-access literature only. Cross-publisher closed literature citations (e.g., from Scopus or Web of Science) are not included.

---

## 5. Extension Hook Points

### How to Add a New Metric Chart
1. **Extraction:** In `fetchArticles()`, parse the new property from the XML DOM and add it to the article object.
2. **IndexedDB:** Add the field name to `db.version(3).stores({ articles: '..., newField' })` if filtering is needed.
3. **Definition:** In `buildQueryMetrics(queryId)`, append a new chart definition to `chartDefs`:
   ```javascript
   {
       id: 'myMetric',
       title: 'My Metric Title',
       bars: myCategories.map(cat => ({
           label: cat.label,
           count: arts.filter(a => a.myField === cat.val).length,
           filter: { field: 'myField', value: cat.val },
           color: cat.color
       }))
   }
   ```
4. **HTML Grid:** Add a canvas container inside the query card template.
5. **Filtering:** `fetchSubset(queryId, filter)` automatically handles `{ field: 'myField', value: cat.val }` without requiring any extra `switch` statements.

### How to Change Thresholds
Modify `SAMPLE_SIZE_THRESHOLDS` in the configuration block at the top of the file:
```javascript
const SAMPLE_SIZE_THRESHOLDS = {
    PILOT_MAX: 29,       // Change Pilot to N < 30
    SMALL_MIN: 30,
    SMALL_MAX: 149,
    MEDIUM_MIN: 150,
    MEDIUM_MAX: 999,
    LARGE_MIN: 1000
};
```

### How Node Clicks Trigger Searches
Inside `renderKeywordsGraph`:
```javascript
activeCytoscape.on('tap', 'node', async function(e) {
    const kw = e.target.data('id');
    searchInput.value = kw;
    const success = await performSearch(kw, { switchTabOnSuccess: true });
    if (!success) {
        switchTab('graph'); // Stay on graph if 0 results
    }
});
```
When `performSearch(kw, { switchTabOnSuccess: true })` resolves successfully, it automatically calls `switchTab('results')` and smoothly scrolls to `query-card-${newQueryId}`.

---

## 6. Layout and Grid Specifications

The Search Results panel renders an 8-chart grid in 3 rows:
- **Top Row (3 columns on desktop):**
  1. Total Articles Count
  2. Conclusions by Type (`Positive`, `Negative`, `Null-Inconclusive`, `None`)
  3. Study Sample Size (`Pilot`, `Small`, `Medium`, `Large`, `Large + Longitudinal`, `Unknown`)
- **Middle Row (4 columns on desktop):**
  4. Citation Count (`0`, `1-5`, `6-20`, `21+`)
  5. Study Type (`Randomized Controlled Trial`, `Clinical Trial`, `Meta-Analysis`, etc.)
  6. Subject Type (`Human`, `Animal`, `In vitro`, `Other/Unknown`)
  7. Publication Year (one bar per year)
- **Bottom Row (Full width):**
  8. Top Keywords Frequency (top 8 co-occurring keywords)

On mobile viewports ($< 640\text{px}$), all rows gracefully stack into a single column.

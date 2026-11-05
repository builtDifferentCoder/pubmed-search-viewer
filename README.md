# PubMed ResearchMiner — Mobile & Web Client

**Version:** `v0.4.0`  
**Current Phase:** Week 1 — Foundations, Build Pipeline, Offline Vendoring & Phone-Testable Hosting

PubMed ResearchMiner is a high-performance biomedical discovery and research synthesis application. Originally built as a client-side exploratory tool, the application is being evolved through a 12-week plan into an offline-first mobile app wrapped with Capacitor, maintaining zero backend hosting costs and adhering to strict $0 service constraints.

---

## 1. Quick Start & Developer Instructions

### Prerequisites
- Node.js `v18.0.0` or higher (verified with Node `v20.x` and `v24.x`)
- npm `v9.x` or higher

### Installation
Clone the repository and install dependencies using clean install:
```bash
npm ci
```

### Local Development Server
Start the Vite development server with Hot Module Replacement (HMR):
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Running Test Suites
Run all 11 comprehensive automated test suites (unit tests + Playwright browser suites for Query Builder, Contradiction Divergence, NCBI mock/live, and state machines) against a built preview environment:
```bash
npm test
```
*Note: This command automatically verifies `dist/`, starts an isolated preview server on port `4173`, executes each test file sequentially, and outputs a clean tabular summary before safely stopping the server.*

### Production Build & Preview
Compile production-ready minified ES modules and bundled CSS into `dist/`:
```bash
npm run build
```
Preview the production build locally:
```bash
npm run preview
```
To test on a mobile device on the same local network:
```bash
npm run preview -- --host
```

---

## 2. Environment Variables & NCBI Configuration

The application works out of the box using public NCBI E-utilities rate limits (~3 requests/second; 350ms request gap).

To accelerate NCBI request pacing down to ~110ms (~10 requests/second), you can configure an optional NCBI API Key. Create a `.env` file in the root directory (never committed to git):

```env
# Optional NCBI API Key for accelerated fetching (110ms request gap)
VITE_NCBI_API_KEY=your_ncbi_api_key_here

# Optional NCBI identification headers
VITE_NCBI_EMAIL=researcher@example.com
VITE_NCBI_TOOL=PubMedResearchMinerMobile
```

All constants and configuration values are centralized in `src/config.js`.

---

## 3. Architecture & Code Structure

The application has been modularized from a monolithic single-file format into clean, decoupled ES modules under `src/`:

```
pubmed_search_viewer/
├── .github/
│   └── workflows/
│       └── deploy.yml           # Automated CI/CD build, test & deploy to GitHub Pages
├── docs/
│   ├── lighthouse-mobile-report.md         # Mobile Lighthouse performance audit
│   ├── lighthouse-mobile-report.report.html # HTML Lighthouse interactive report
│   ├── lighthouse-mobile-report.report.json # Raw Lighthouse metrics JSON
│   ├── README_v0.2.md          # Historical documentation v0.2
│   ├── README_v0.3.md          # Historical documentation v0.3
│   └── README_v0.4.md          # Historical documentation v0.4
├── src/
│   ├── config.js               # Centralized configuration, rate limits, thresholds, palettes
│   ├── db.js                   # Dexie.js (IndexedDB v3 schema with migrations)
│   ├── parsers.js              # XML parser, study heuristics, sample size & conclusions
│   ├── ncbi.js                 # NCBI E-utilities client (rate limiting, retry, backoff)
│   ├── charts.js               # Chart.js (v4.4.1) 8-bar metrics configuration & filtering
│   ├── graph.js                # Cytoscape.js (v3.28.1) co-occurrence graph & Louvain clustering
│   ├── builder.js              # Drag-and-drop & tap Boolean Query Builder state machine
│   ├── divergence.js           # Contradiction mapping engine, opposition heuristics & modal
│   ├── primers.js              # Domain starter packs, hash router (#/primers/:topicId)
│   ├── ui.js                   # UI tabs, query card renderer, loading overlay, debug panel
│   ├── main.js                 # Entry point, router, event listeners, window API bindings
│   └── style.css               # PostCSS/Tailwind styles and self-hosted Phosphor icon fonts
├── index.html                  # Lightweight application entry markup
├── CLIENT_TESTING_GUIDE_WEEK1.md # Client-facing step-by-step test instructions
├── run_all_tests.mjs           # Unified end-to-end test runner
├── generate_lighthouse_report.mjs # Automated mobile Lighthouse audit script
├── vite.config.js              # Vite configuration (port 5173/4173, build define constants)
├── tailwind.config.cjs         # Tailwind utility configuration
└── postcss.config.cjs          # PostCSS Autoprefixer and Tailwind plugins
```

---

## 4. Key Subsystems & Features

### 1. Drag-and-Drop / Tap Boolean Query Builder
- Located at the bottom of the **Keywords Graph** tab.
- Allows desktop drag-and-drop of Cytoscape keyword nodes without disturbing network layout or physics.
- Full mobile-touch support: tapping any node or using the autocomplete datalist appends keywords directly.
- Chip management: reordering, inline editing, operator modal (**AND**, **OR**, **NOT**), and multi-chip parentheses grouping `( )`.
- One-click Boolean compilation, clipboard copy, and search execution.

### 2. Contradiction Mapping (Divergence Panel)
- Integrated into query cards on the **Search Results** tab.
- Automatically flags opposing research findings between studies sharing $\ge N$ keywords (configurable $N$, default 2).
- Classifies opposition types (Direct Opposition, Positive vs. Null/Inconclusive, Supports vs. Refutes).
- Side-by-side modal comparison with shared keyword highlights and "View Path in Graph" connecting illumination.

### 3. Search Primers & Hash Routing
- Curated domain starter packs across biomedical subjects.
- Client-side hash routing supporting `#/primers` and `#/primers/:topicId` with 24-hour IndexedDB caching.

### 4. Build Information & Debug Panel
- Tap the **v0.4.0 Build Info** badge in the navigation bar or footer (or append `?debug=1` to the URL).
- Displays live application version, build timestamp, NCBI key status, and IndexedDB schema version.

---

## 5. Mobile & Offline Readiness

- **Vendored Dependencies:** Chart.js `4.4.1`, Cytoscape `3.28.1`, Dexie `3.2.7`, Graphology `0.25.4`, and `@phosphor-icons/web` are self-hosted via npm, eliminating runtime CDN vulnerabilities.
- **Offline Static Bundle:** All CSS, JavaScript, and vector fonts load without external internet requests once cached.
- **Safe Area & Touch Targets:** Touch targets adhere to minimum 44px sizing for mobile viewport ergonomics (360×640, 390×844, 820×1180).

---

## 6. Verification & Test Suites

The test suite covers both unit logic and end-to-end browser workflows:
1. `test_boolean_builder.js` — Keyword quoting, operator precedence, parentheses balancing.
2. `test_divergence_logic.js` — Pairwise combinatorial contradiction rules and ranking.
3. `test_app.js` — Page load, Dexie IndexedDB initialization, and Chart.js instantiation.
4. `test_suite.js` — Live query card rendering, metric chart data binding, and IndexedDB persistence.
5. `test_phase1.js` — Graph tab switching, Cytoscape canvas mounting, and layout.
6. `test_phase1_query_builder.js` — Chip addition, drag-and-drop, grouping, and Boolean compilation.
7. `test_phase2.js` — Divergence UI component mounting and card controls.
8. `test_phase2_divergence.js` — Opposing paper detection, shared keyword threshold $N$, side-by-side modal.
9. `test_phase4.js` — Primer catalog rendering, detail page hash navigation, and caching.
10. `test_v02_suite.js` — Keyword normalization, study type heuristics, and table filtering.
11. `test_v03_suite.js` — Cytoscape node degree formulas, Louvain community clusters, and edge opacity.

Run all tests:
```bash
npm test
```

---

## 7. Continuous Integration & Deployment

A GitHub Actions workflow is configured at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). On every push to `main` or `master`, the workflow:
1. Performs clean dependency installation (`npm ci`).
2. Provisions headless Chromium via Playwright.
3. Executes the full test suite (`npm test`).
4. Generates the production bundle (`npm run build`).
5. Publishes the output artifacts directly to **GitHub Pages**.

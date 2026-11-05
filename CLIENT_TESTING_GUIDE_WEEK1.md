# PubMed ResearchMiner — Week 1 Client Testing Guide

**Sprint Goal:** Foundations, modern build pipeline, automated verification, and mobile-ready accessibility.  
**Version:** `v0.4.0` (Modular Vite Architecture)  
**Target Viewports:** Mobile (360×640, 390×844), Tablet (820×1180), and Desktop.

---

## 1. Quick Start: How to Run the App

### Option A: Testing on Desktop
1. Clone the repository and navigate to the folder:
   ```bash
   cd pubmed_search_viewer
   ```
2. Install dependencies (verified against exact package lockfile):
   ```bash
   npm ci
   ```
3. Run the automated test suite (verifies all 11 suites across logic, Cytoscape graph, Boolean builder, Divergence engine, and NCBI integrations):
   ```bash
   npm test
   ```
4. Build and start the production preview server:
   ```bash
   npm run build
   npm run preview
   ```
   Open your browser to: **`http://localhost:4173`** (or `http://localhost:5173` via `npm run dev`).

---

### Option B: Testing on a Mobile Phone
1. Ensure your phone is connected to the same Wi-Fi network as your computer.
2. Start the preview server with host exposure:
   ```bash
   npm run preview -- --host
   ```
3. The console will display your local network IP (e.g. `http://192.168.1.XX:4173/`).
4. Open that URL in your phone's browser (Safari on iOS, Chrome on Android).
   *(Alternatively, use the deployed GitHub Pages link once the repository is pushed to GitHub).*

---

## 2. Test Scenarios for This Week

### Test 1: Live PubMed Search & Interactive Bar Charts
1. On the home page, enter a biomedical query (e.g., `allulose diet` or `metformin longevity`) and tap **Search & Save**.
2. Notice the live search against NCBI E-utilities completes and persists the results to client-side IndexedDB.
3. Review the **8 metric bar charts** (Study Types, Subject Types, Sample Sizes, Conclusion Types, etc.).
4. Tap any individual chart bar (e.g. "Randomized Controlled Trial" or "Positive"):
   - Verify the filtered article drawer expands showing matching PMIDs, titles, and extracted conclusions.

---

### Test 2: Keywords Graph & Touch-Friendly Boolean Query Builder
1. Tap the **Keywords Graph** tab in the top navigation.
2. Observe the Cytoscape co-occurrence graph rendered with Louvain community detection colors and weighted degree sizing.
3. Above the graph, observe the frosted-glass **Boolean Query Builder**:
   - **On Desktop:** Drag a keyword node directly into the query builder drop zone.
   - **On Mobile:** Tap any node (or type into the `+ Add keyword...` autocomplete box) to add it as a query chip.
4. Select a logical operator (**AND**, **OR**, **NOT**) when prompted.
5. Select multiple chips and test **`( ) Group`** to create nested expressions (e.g., `(diet AND ketosis) NOT obesity`).
6. Tap **Run Search** to verify the compiled Boolean query is executed and switches back to Search Results.

---

### Test 3: Contradiction Mapping (Divergence Panel)
1. In the **Search Results** tab, scroll to the **Divergence** section of your search card.
2. Set the **Min Shared (N)** dropdown to `2` (or `1`).
3. Observe pairs of papers investigating identical keywords but reporting opposing conclusion classifications.
4. Tap **Side-by-Side** on any divergence card:
   - A modal opens comparing both abstracts, sample sizes, and study types side-by-side with shared keywords highlighted.
5. Tap **View Path in Graph**:
   - The app transitions to the Keywords Graph, dims unrelated nodes, and illuminates the connecting pathway.

---

### Test 4: Offline Static Asset Verification
1. Load the app once in your mobile or desktop browser.
2. In your browser's Developer Tools (Network tab), set throttling to **Offline** (or toggle Airplane Mode on your phone).
3. Refresh the page or navigate between tabs:
   - The entire application shell, Tailwind styling, self-hosted Phosphor icons, Dexie database, and Chart.js / Cytoscape libraries load instantly without network dependencies.
   *(Note: Querying new PubMed articles requires internet connectivity until Week 6 full offline caching).*

---

### Test 5: Version & Build Info Panel
1. Look at the top navigation bar or the page footer:
   - Tap **v0.4.0 Build Info** (or append `?debug=1` to the URL, e.g. `http://localhost:4173/?debug=1`).
2. An overlay panel appears showing:
   - App Version (`0.4.0`)
   - Build timestamp
   - NCBI API Key status (identifies whether the optional API key is configured for high-speed 110ms request gap)
   - IndexedDB schema status (Dexie v3)

---

## 3. Optional: NCBI API Key Configuration
If you have a personal NCBI API key to test higher rate limits:
1. Create a local `.env` file in the project root (ignored by git):
   ```env
   VITE_NCBI_API_KEY=your_ncbi_api_key_here
   VITE_NCBI_EMAIL=your_email@domain.com
   VITE_NCBI_TOOL=ResearchMinerMobile
   ```
2. Restart the dev server or re-run `npm run build`.
3. The app will automatically accelerate NCBI request pacing from the default 350ms down to ~110ms.

---

## 4. Reporting Feedback
When testing on your mobile device, please note:
- Device model (e.g., iPhone 14 Pro, Samsung Galaxy S23, Pixel 8)
- Browser and version (Safari, Chrome)
- Any tap target or layout clipping observations in portrait or landscape orientations.

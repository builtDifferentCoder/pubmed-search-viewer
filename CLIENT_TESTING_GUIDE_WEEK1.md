# PubMed ResearchMiner — Week 1 Client Testing Guide

**Sprint Goal:** Foundations, modern build pipeline, automated verification, and mobile-ready accessibility.  
**Version:** `v0.4.0` (Modular Vite Architecture)  
**Target Viewports:** Mobile (360×640, 390×844), Tablet (820×1180), and Desktop.

---

## 1. How to Test the App on a Mobile Phone (3 Methods)

### Method 1: Instant Mobile Tunnel via Localtunnel (Recommended — Works Anywhere)
This method works instantly on any phone (even on cellular 4G/5G) without firewall or router permissions:

1. **Start the Vite preview server** in your first terminal:
   ```bash
   npm run preview
   ```
2. **Start the tunnel** in a second terminal:
   ```bash
   npx localtunnel --port 4173
   ```
3. The terminal will generate a temporary public URL, for example:
   ```
   your url is: https://hip-kings-laugh.loca.lt
   ```
4. **Open that link on your phone** in Chrome or Safari.
   > **Note on Vite Host Verification:** `allowedHosts: true` is pre-configured in `vite.config.js`, ensuring tunnel hosts are fully allowed.
   > **Note on Localtunnel Landing Page:** When opened for the first time, localtunnel may display a friendly verification page asking for your laptop's public IP (shown on the page) or a "Click to Continue" button. Tap it to proceed to the app.

---

### Method 2: Live GitHub Pages (Zero-Setup Cloud Hosting)
Your repository includes an automated GitHub Actions CI/CD deployment workflow.

1. Open your repository: [https://github.com/builtDifferentCoder/pubmed-search-viewer](https://github.com/builtDifferentCoder/pubmed-search-viewer)
2. Go to **Settings** $\to$ **Pages** (in the left sidebar).
3. Under **Build and deployment** $\to$ **Source**, choose **GitHub Actions**.
4. Once the deployment action completes, open the live hosted link on any mobile phone:  
   **`https://builtdifferentcoder.github.io/pubmed-search-viewer/`**

---

### Method 3: Direct Wi-Fi Connection (Same Network)
To test directly using your laptop's Wi-Fi IP (e.g. `http://192.168.100.58:4173`):

1. **Allow port 4173 through Windows Firewall:**  
   Windows Defender blocks inbound connections from other Wi-Fi devices by default. Open **PowerShell as Administrator** and run:
   ```powershell
   New-NetFirewallRule -DisplayName "Vite Preview 4173" -Direction Inbound -LocalPort 4173 -Protocol TCP -Action Allow
   ```
2. **Start the preview server:**
   ```bash
   npm run preview
   ```
3. Note your Wi-Fi IPv4 address shown in the console (`http://192.168.100.58:4173/`).
4. Ensure your phone and laptop are connected to the same Wi-Fi network and open `http://192.168.100.58:4173/` in your phone's browser.

---

## 2. Desktop Quick Start

1. Install dependencies:
   ```bash
   npm ci
   ```
2. Run automated test suites (all 11 suites across unit logic, query builder, contradiction divergence, and NCBI mocks):
   ```bash
   npm test
   ```
3. Run the development or preview server:
   ```bash
   npm run dev      # Local dev server on http://localhost:5173
   npm run preview  # Production build preview on http://localhost:4173
   ```

---

## 3. Mobile Test Scenarios for This Week

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
   - **On Mobile:** Tap any node (or type into the `+ Add keyword...` autocomplete box) to add it as a query chip.
   - **On Desktop:** Drag a keyword node directly into the query builder drop zone.
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
2. Disconnect Wi-Fi / mobile data (or enable Airplane Mode on your phone).
3. Refresh the page or navigate between tabs:
   - The entire application shell, Tailwind styling, self-hosted Phosphor icons, Dexie database, and Chart.js / Cytoscape libraries load instantly without network dependencies.
   *(Note: Querying new PubMed articles requires internet connectivity until Week 6 full offline caching).*

---

### Test 5: Version & Build Info Panel
1. Look at the top navigation bar or the page footer:
   - Tap **v0.4.0 Build Info** (or append `?debug=1` to the URL, e.g. `/?debug=1`).
2. An overlay panel appears showing:
   - App Version (`0.4.0`)
   - Build timestamp
   - NCBI API Key status (identifies whether the optional API key is configured for high-speed 110ms request gap)
   - IndexedDB schema status (Dexie v3)

---

## 4. Optional: NCBI API Key Configuration
If you have a personal NCBI API key to test higher rate limits:
1. Create a local `.env` file in the project root (ignored by git):
   ```env
   VITE_NCBI_API_KEY=your_ncbi_api_key_here
   VITE_NCBI_EMAIL=your_email@domain.com
   VITE_NCBI_TOOL=ResearchMinerMobile
   ```
2. Restart the server or re-run `npm run build`.
3. The app will automatically accelerate NCBI request pacing from the default 350ms down to ~110ms.

---

## 5. Reporting Feedback
When testing on your mobile device, please note:
- Device model (e.g., iPhone 14 Pro, Samsung Galaxy S23, Pixel 8)
- Browser and version (Safari, Chrome)
- Any tap target or layout clipping observations in portrait or landscape orientations.

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

### Test 2: Touch-Optimized Keywords Graph & Finger-Friendly Query Builder
1. Tap the **Keywords Graph** tab (bottom tab bar on mobile, top bar on desktop).
2. **Smooth Touch Gestures & Navigation:**
   - **Pinch-to-zoom:** Pinch in or out to zoom smoothly between 0.1x and 3.5x.
   - **Double-tap to zoom:** Double-tap anywhere on empty canvas space to zoom in 1.5x toward your finger.
   - **One-finger pan:** Drag on empty space to pan the network. Notice edges simplify during movement (LOD) for 60fps fluidity.
   - **Zoom fallback:** Test the 44px **+**, **-**, and **Fit** buttons on the top-right toolbar.
3. **Finger Hit Targets (24px Expanded Radius & Disambiguation):**
   - Tap near any tiny node: even small nodes are easily tapped without pixel precision thanks to an expanded 24px screen hit radius.
   - If two nodes are clustered closely together (< 8px apart), a "Select keyword:" disambiguation menu pops up to let you pick the exact keyword.
4. **Mobile Node Bottom Sheet (Behavior Change):**
   - Tapping any keyword node on mobile opens an interactive **Node Bottom Sheet** showing:
     - Total co-occurrences, articles count, degree (# of connections), and topic cluster badge.
     - Tappable chips of top co-occurring neighbor keywords.
     - 3 Touch Action Buttons:
       1. **"Search PubMed for this"**: Launches a live PubMed query and switches to Search Results.
       2. **"Add to query builder"**: Appends the keyword to the docked Boolean query tray.
       3. **"Highlight neighbors"**: Dims unrelated nodes and illuminates the local network neighborhood.
5. **Node Long-Press Shortcut:**
   - Press and hold any node for ~0.4s: it adds the keyword directly into the Query Builder without opening the bottom sheet.
   - On desktop computers, mouse click and drag-and-drop remain fully supported.
6. **Mobile Docked Query Builder Tray:**
   - Observe the collapsible docked tray at the bottom of the graph.
   - **No drag-and-drop needed:** Tap nodes, use autocomplete, or tap the **+ Add keyword...** box.
   - **Cycle Operators:** Tap any operator badge (`AND`, `OR`, `NOT`) to cycle between them.
   - **Reorder with Arrows:** Tap `←` and `→` on any chip to rearrange terms.
   - **Inline Edit:** Tap the keyword text on any chip to edit it directly.
   - **Group in ( ):** Check two or more chip checkboxes and tap **`( ) Group`**.
7. **Fast Layout & Off-Thread Performance:**
   - Notice the Louvain clustering and force layout run off the main thread in a Web Worker (with progress indicator), and layout positions are persistently cached in IndexedDB for instant sub-20ms rendering upon return.
   - Topic cluster colors follow an extended Okabe-Ito colorblind-safe palette, and tapping legend chips filters the graph by topic.

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

# Client Testing Guide: Mobile Layout & Touch Experience (Week 3)

Welcome to the **PubMed ResearchMiner** mobile preview! This guide walks you through verifying all new mobile features, responsive tuning, touch interactions, and accessibility improvements on any smartphone or desktop browser.

---

## 1. How to Access & Launch the App

### Option A: Testing on Desktop Browser (Mobile DevTools)
1. In your terminal, run:
   ```bash
   npm run preview
   ```
2. Open Chrome, Edge, or Safari at `http://localhost:4173/`.
3. Press `F12` (or right-click $\to$ **Inspect**) to open Developer Tools.
4. Click the **Toggle device toolbar** icon (`Ctrl + Shift + M` / `Cmd + Shift + M`).
5. Choose **iPhone 12 / 14 (390 x 844)** or **Samsung Galaxy S8+ / S20 (360 x 640)** from the device dropdown.
6. Refresh the page to experience the mobile layout.

### Option B: Testing Directly on Your Smartphone (Same Wi-Fi)
1. Run the preview with host binding:
   ```bash
   npm run preview -- --host
   ```
2. Note your laptop's Wi-Fi IP address shown in the terminal (e.g. `http://192.168.1.X:4173/`).
3. Open Safari (iOS) or Chrome (Android) on your phone connected to the same Wi-Fi and navigate to that URL.

---

## 2. Key Features to Test

### 1. Sticky Bottom Navigation Bar (Replaces Desktop Top Tabs)
- **What to look for**: At the bottom of your phone screen, you'll see a native-feeling sticky tab bar with 3 tabs: **Results**, **Graph**, and **Primers**.
- **Test**:
  - Tap **Graph** $\to$ the view switches immediately to the Cytoscape Co-occurrence Network.
  - Tap **Primers** $\to$ the view switches to Search Primers.
  - Tap **Results** $\to$ switches back to your Stored Queries.
  - Notice the active tab has blue highlighting and bold text. The bar respects phone safe areas (e.g., iPhone home indicator bar).

### 2. Collapsible Mobile Accordions (In Exact 3-Section Order)
Instead of the desktop 3-row $\times$ 8-chart grid, each query card is organized into three clean collapsible accordions:
1. **(1) Articles & Conclusions** $\to$ Articles (Chart 0), Conclusions (Chart 1), Sample Size / N (Chart 2)
2. **(2) Impact & Design** $\to$ Citations (Chart 3), Study Type (Chart 4), Subject Type (Chart 5), Publication Year (Chart 6)
3. **(3) Keywords** $\to$ Keyword Distribution (Chart 7)

- **Test Accordion Toggling**:
  - By default, Accordion 1 (**Articles & Conclusions**) is open, while 2 and 3 are neatly collapsed.
  - Tap Accordion 2 (**Impact & Design**) $\to$ it expands smoothly with a 180° chevron animation.
  - Tap Accordion 1 $\to$ it collapses to save vertical screen space.
- **Test Persistence**:
  - Leave Accordion 2 open and Accordion 1 closed.
  - Refresh the browser page (`F5` or pull to reload).
  - Notice that your chosen accordion open/closed state is remembered per query!
- **Collapsed Summaries**:
  - When collapsed, notice each header displays a helpful one-line summary (e.g. `142 articles • 84 positive`, `412 citations • Randomized Controlled Trial`, `24 unique keywords`).

### 3. Horizontal Scroll-Snap Carousel with Peek & Dot Indicators
- **Inside each accordion**:
  - Swipe horizontally left/right through the charts.
  - Notice the smooth **CSS scroll-snap**: charts snap securely into center position.
  - Notice the **peek of the next card** (~12% peeking on the right edge) signaling to users that more charts are available.
  - Below the carousel, observe the **dot indicators**:
    - The active chart shows an elongated blue pill dot.
    - Swiping updates the active dot in real-time.
    - Tapping any dot smoothly scrolls directly to that chart!

### 4. Chart.js Mobile Tuning & Horizontal Bars
- **Readability**: Charts with longer text labels (Conclusions, Study Types, Subject Types, Keywords) are rendered with **horizontal bars** (`indexAxis: 'y'`) so labels are stacked vertically and clearly readable without truncation.
- **Long-Press Exact Value**:
  - Long-press ($\ge 400\text{ms}$) on any chart bar to see an exact value pill popup directly on touch.

### 5. Slide-Up Bottom Sheet (Bar Tap Article List)
- **Test**:
  - Tap any bar in a mobile chart (for example, the "Positive" bar in Conclusions, or "Randomized Controlled Trial" in Study Type).
  - A native-style **Slide-Up Bottom Sheet** smoothly appears from the bottom of the screen.
  - The sheet shows filtered matching articles with PubMed links, PMIDs, dates, study badges, and conclusions.
  - **Pagination**: Articles are paginated (5 per page). Tap **Next** and **Previous** to browse pages.
  - **Dismissing**: Tap the top **$\times$ close button**, tap the dark blurred backdrop, or press `Esc`.

### 6. Accessibility & "View as Table" Toggle
- Every chart canvas is equipped with `role="img"` and descriptive `aria-label` screen reader summaries.
- Next to each chart title, tap the **Table** toggle button:
  - The `<canvas>` seamlessly switches to an accessible, high-contrast HTML table showing Categories, Article Counts, and Percentages (`%`).
  - Tap **Chart** to return to the interactive chart view anytime.

### 7. Pull-to-Refresh Gesture
- Scroll to the very top of the **Search Results** tab on a mobile device or touch emulator.
- Pull down firmly ($\ge 70\text{px}$):
  - Notice the pull-to-refresh indicator and animated arrow icon.
  - Release when it prompts *"Release to refresh..."* $\to$ the icon spins and refreshes all stored query data and metrics smoothly without a full page reload!

### 8. Mobile 3-Dots Overflow Menu
- In the query card header on mobile, tap the vertical 3-dots button (`...`):
  - **Re-run Search**: Immediately re-executes the PubMed search against NCBI.
  - **Share\***: Marked with a "Soon" badge for future milestone.
  - **Export\***: Marked with a "Soon" badge for future milestone.
  - **Delete**: Confirms and deletes the stored query.

---

## 3. Desktop Verification (Zero Regressions)
- Expand your browser window to desktop width ($\ge 768\text{px}$, e.g. 1280x800).
- Verify:
  - Top tabs bar appears as before.
  - Mobile bottom navigation bar disappears.
  - Desktop 3-row $\times$ 8-chart grid is fully visible and identical to previous releases.
  - Clicking any chart bar on desktop still opens the familiar inline `.detail` table.

---
*Questions or feedback? All tunable values (breakpoint, carousel peek width, page size, touch threshold) can be adjusted in `src/config.js`.*

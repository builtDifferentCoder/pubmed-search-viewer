// Web Worker for off-main-thread Louvain clustering & 2D Force-directed layout
// Ground Rule 3: Heavy computation must not block the UI thread.

// In-worker deterministic Louvain implementation
function runLouvain(nodes, edges) {
    const nodeMap = new Map();
    const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
    sortedNodes.forEach((n, idx) => nodeMap.set(n.id, idx));

    const adj = Array.from({ length: sortedNodes.length }, () => new Map());
    const k = new Array(sortedNodes.length).fill(0);
    let totalWeight = 0;

    edges.forEach(e => {
        const u = nodeMap.get(e.source);
        const v = nodeMap.get(e.target);
        if (u !== undefined && v !== undefined && u !== v) {
            const w = e.weight || 1;
            adj[u].set(v, (adj[u].get(v) || 0) + w);
            adj[v].set(u, (adj[v].get(u) || 0) + w);
            k[u] += w;
            k[v] += w;
            totalWeight += w;
        }
    });

    const m2 = totalWeight * 2;
    if (m2 === 0) {
        const res = {};
        sortedNodes.forEach(n => res[n.id] = 0);
        return res;
    }

    const c = sortedNodes.map((_, idx) => idx);
    const sTot = [...k];

    let improved = true;
    let passes = 0;
    while (improved && passes < 25) {
        improved = false;
        passes++;
        for (let i = 0; i < sortedNodes.length; i++) {
            const curC = c[i];
            const ki = k[i];
            sTot[curC] -= ki;

            const cWeights = new Map();
            for (const [neighbor, w] of adj[i]) {
                const nC = c[neighbor];
                cWeights.set(nC, (cWeights.get(nC) || 0) + w);
            }

            let bestC = curC;
            let bestGain = (cWeights.get(curC) || 0) - (sTot[curC] * ki) / m2;

            for (const [targetC, qIn] of cWeights) {
                const gain = qIn - (sTot[targetC] * ki) / m2;
                if (gain > bestGain) {
                    bestGain = gain;
                    bestC = targetC;
                }
            }

            c[i] = bestC;
            sTot[bestC] += ki;
            if (bestC !== curC) improved = true;
        }
    }

    const res = {};
    sortedNodes.forEach((n, idx) => res[n.id] = c[idx]);
    return res;
}

// 2D Force-Directed Layout Simulation (Fruchterman-Reingold / CoSE physics)
function computeForceLayout(nodes, edges, width = 800, height = 600, iterations = 200) {
    const N = nodes.length;
    if (N === 0) return {};
    if (N === 1) {
        return { [nodes[0].id]: { x: Math.round(width / 2), y: Math.round(height / 2) } };
    }

    const cx = width / 2;
    const cy = height / 2;
    const area = width * height;
    const k = Math.sqrt(area / N) * 0.75; // Ideal distance constant

    // Initial spiral / circle placement to break symmetry
    const positions = {};
    const velocities = {};
    nodes.forEach((n, idx) => {
        const angle = idx * 2.399963229728653; // Golden angle
        const radius = Math.min(width, height) * 0.28 * Math.sqrt((idx + 1) / N);
        positions[n.id] = {
            x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 10,
            y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 10
        };
        velocities[n.id] = { vx: 0, vy: 0 };
    });

    let temp = Math.min(width, height) * 0.15;
    const cooling = 0.96;

    for (let iter = 0; iter < iterations; iter++) {
        // Reset forces
        nodes.forEach(n => {
            velocities[n.id].vx = 0;
            velocities[n.id].vy = 0;
        });

        // 1. Repulsive forces between all node pairs
        for (let i = 0; i < N; i++) {
            const u = nodes[i];
            const posU = positions[u.id];
            for (let j = i + 1; j < N; j++) {
                const v = nodes[j];
                const posV = positions[v.id];

                let dx = posU.x - posV.x;
                let dy = posU.y - posV.y;
                let dist = Math.hypot(dx, dy);
                if (dist < 0.1) {
                    dx = (Math.random() - 0.5) * 2;
                    dy = (Math.random() - 0.5) * 2;
                    dist = Math.hypot(dx, dy);
                }

                // Node size adjusted repulsion
                const minSeparation = (u.radius || 15) + (v.radius || 15) + 10;
                const effectiveDist = Math.max(dist, minSeparation * 0.5);
                const force = (k * k) / effectiveDist;

                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                velocities[u.id].vx += fx;
                velocities[u.id].vy += fy;
                velocities[v.id].vx -= fx;
                velocities[v.id].vy -= fy;
            }
        }

        // 2. Attractive forces along edges
        edges.forEach(e => {
            const posU = positions[e.source];
            const posV = positions[e.target];
            if (!posU || !posV) return;

            let dx = posU.x - posV.x;
            let dy = posU.y - posV.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 0.1) return;

            const w = Math.min(e.weight || 1, 8);
            const force = ((dist * dist) / k) * (0.35 + 0.15 * Math.log2(w + 1));

            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            velocities[e.source].vx -= fx;
            velocities[e.source].vy -= fy;
            velocities[e.target].vx += fx;
            velocities[e.target].vy += fy;
        });

        // 3. Central gravity force to keep graph centered
        nodes.forEach(n => {
            const p = positions[n.id];
            const gx = (cx - p.x) * 0.04;
            const gy = (cy - p.y) * 0.04;
            velocities[n.id].vx += gx;
            velocities[n.id].vy += gy;
        });

        // 4. Displace nodes capped by current temperature
        nodes.forEach(n => {
            const vel = velocities[n.id];
            const speed = Math.hypot(vel.vx, vel.vy);
            if (speed > 0) {
                const step = Math.min(speed, temp);
                positions[n.id].x += (vel.vx / speed) * step;
                positions[n.id].y += (vel.vy / speed) * step;
            }

            // Soft container boundary clamping
            const pad = 40;
            positions[n.id].x = Math.max(pad, Math.min(width - pad, positions[n.id].x));
            positions[n.id].y = Math.max(pad, Math.min(height - pad, positions[n.id].y));
        });

        temp *= cooling;
    }

    // Format output rounded to integers
    const result = {};
    nodes.forEach(n => {
        result[n.id] = {
            x: Math.round(positions[n.id].x),
            y: Math.round(positions[n.id].y)
        };
    });
    return result;
}

// Worker message handler
self.onmessage = function (evt) {
    const { type, payload } = evt.data || {};
    if (type !== 'COMPUTE_GRAPH' || !payload) return;

    try {
        const { queryId, cap, minWeight, nodes, edges, width = 800, height = 600 } = payload;

        // Step 1: Louvain community detection
        self.postMessage({ type: 'PROGRESS', stage: 'clustering', message: 'Clustering keywords (Louvain)...' });
        const communities = runLouvain(nodes, edges);

        // Step 2: 2D Force-Directed Layout Calculation
        self.postMessage({ type: 'PROGRESS', stage: 'layout', message: 'Computing graph layout...' });
        const positions = computeForceLayout(nodes, edges, width, height, 180);

        self.postMessage({
            type: 'COMPLETE',
            payload: {
                queryId,
                cap,
                minWeight,
                communities,
                positions
            }
        });
    } catch (err) {
        self.postMessage({
            type: 'ERROR',
            error: err.message || 'Worker computation error'
        });
    }
};

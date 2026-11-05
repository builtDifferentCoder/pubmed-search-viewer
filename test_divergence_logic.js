const assert = require('assert');

// -----------------------------------------------------------------------------
// Contradiction / Divergence Mapping Logic (Pure Functions)
// -----------------------------------------------------------------------------

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

function getOpposition(tagA, tagB, config = DEFAULT_OPPOSING_CONFIG) {
    if (!tagA || !tagB || tagA === 'None' || tagB === 'None') {
        return { isOpposing: false, strength: 0, label: '' };
    }
    const cleanA = tagA.trim().toLowerCase();
    const cleanB = tagB.trim().toLowerCase();
    if (cleanA === cleanB) {
        return { isOpposing: false, strength: 0, label: '' };
    }

    for (const rule of config) {
        const r0 = rule.tags[0].trim().toLowerCase();
        const r1 = rule.tags[1].trim().toLowerCase();
        if ((cleanA === r0 && cleanB === r1) || (cleanA === r1 && cleanB === r0)) {
            return {
                isOpposing: true,
                strength: rule.strength || 1.0,
                label: rule.label || `${rule.tags[0]} vs ${rule.tags[1]}`
            };
        }
    }
    return { isOpposing: false, strength: 0, label: '' };
}

function findDivergentPairs(articles, options = {}) {
    const minSharedKeywords = options.minSharedKeywords ?? 2;
    const config = options.opposingConfig || DEFAULT_OPPOSING_CONFIG;
    const maxPairs = options.maxPairs || 100;

    if (!articles || articles.length < 2) return [];

    const pairs = [];

    for (let i = 0; i < articles.length; i++) {
        const a = articles[i];
        if (!a.conclusionType || a.conclusionType === 'None') continue;

        const kwsA = new Set((a.keywordsNorm || []).map(k => k.trim().toLowerCase()).filter(Boolean));
        if (kwsA.size === 0) continue;

        for (let j = i + 1; j < articles.length; j++) {
            const b = articles[j];
            if (!b.conclusionType || b.conclusionType === 'None') continue;

            const opposition = getOpposition(a.conclusionType, b.conclusionType, config);
            if (!opposition.isOpposing) continue;

            const kwsB = (b.keywordsNorm || []).map(k => k.trim().toLowerCase()).filter(Boolean);
            const shared = [];
            const seen = new Set();
            for (const k of kwsB) {
                if (kwsA.has(k) && !seen.has(k)) {
                    shared.push(k);
                    seen.add(k);
                }
            }

            if (shared.length >= minSharedKeywords) {
                shared.sort();
                pairs.push({
                    paperA: a,
                    paperB: b,
                    sharedKeywords: shared,
                    sharedCount: shared.length,
                    tagA: a.conclusionType,
                    tagB: b.conclusionType,
                    oppositionStrength: opposition.strength,
                    oppositionLabel: opposition.label,
                    // Ranking score: shared count desc, then opposition strength desc
                    score: shared.length * 10 + opposition.strength
                });
            }
        }
    }

    // Sort by number of shared keywords descending, then strength of opposition descending
    pairs.sort((p1, p2) => {
        if (p2.sharedCount !== p1.sharedCount) {
            return p2.sharedCount - p1.sharedCount;
        }
        return p2.oppositionStrength - p1.oppositionStrength;
    });

    return pairs.slice(0, maxPairs);
}

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------
console.log('Running Divergence Mapping Logic Tests:');

// Test 1: getOpposition
console.log('Test 1: getOpposition rule checking');
assert.strictEqual(getOpposition('Positive', 'Negative').isOpposing, true);
assert.strictEqual(getOpposition('Negative', 'Positive').isOpposing, true);
assert.strictEqual(getOpposition('Positive', 'Positive').isOpposing, false);
assert.strictEqual(getOpposition('Positive', 'None').isOpposing, false);
assert.strictEqual(getOpposition('None', 'Negative').isOpposing, false);
assert.strictEqual(getOpposition('Supports', 'Refutes').isOpposing, true);
assert.strictEqual(getOpposition('Positive', 'Null-Inconclusive').strength, 0.7);
console.log('  ✓ getOpposition passed');

// Test 2: Sample papers
console.log('Test 2: findDivergentPairs with known opposing pairs and unrelated papers');

const paper1 = {
    pmid: '101',
    title: 'Paper 1 - Allulose is effective in ketosis and weight loss',
    conclusionType: 'Positive',
    keywordsNorm: ['allulose', 'ketosis', 'weight loss', 'diet']
};

const paper2 = {
    pmid: '102',
    title: 'Paper 2 - Allulose fails to induce ketosis or weight loss',
    conclusionType: 'Negative',
    keywordsNorm: ['allulose', 'ketosis', 'weight loss', 'metabolism']
};

const paper3 = {
    pmid: '103',
    title: 'Paper 3 - Allulose and dietary fiber results inconclusive',
    conclusionType: 'Null-Inconclusive',
    keywordsNorm: ['allulose', 'ketosis', 'diet']
};

const paper4 = {
    pmid: '104',
    title: 'Paper 4 - Allulose also positive in glycemic response',
    conclusionType: 'Positive', // Same tag as paper1!
    keywordsNorm: ['allulose', 'ketosis', 'weight loss', 'diet']
};

const paper5 = {
    pmid: '105',
    title: 'Paper 5 - Unrelated cardiovascular paper',
    conclusionType: 'Negative',
    keywordsNorm: ['cardiovascular', 'hypertension', 'sodium'] // 0 shared keywords
};

const paper6 = {
    pmid: '106',
    title: 'Paper 6 - Only one shared keyword',
    conclusionType: 'Negative',
    keywordsNorm: ['allulose', 'astronomy', 'physics'] // Only 1 shared keyword ('allulose')
};

const paper7 = {
    pmid: '107',
    title: 'Paper 7 - Missing conclusion tag',
    conclusionType: 'None',
    keywordsNorm: ['allulose', 'ketosis', 'weight loss']
};

const allSamplePapers = [paper1, paper2, paper3, paper4, paper5, paper6, paper7];

// Find divergent pairs with default N = 2
const resultsN2 = findDivergentPairs(allSamplePapers, { minSharedKeywords: 2 });
console.log(`  Found ${resultsN2.length} divergent pairs (N=2):`);
resultsN2.forEach((r, idx) => {
    console.log(`    #${idx + 1}: PMID ${r.paperA.pmid} (${r.tagA}) vs PMID ${r.paperB.pmid} (${r.tagB}) - Shared: [${r.sharedKeywords.join(', ')}] (count=${r.sharedCount}, strength=${r.oppositionStrength})`);
});

// Acceptance check 1: Known opposing pair (paper1 vs paper2) MUST appear
const p1_p2 = resultsN2.find(r => 
    (r.paperA.pmid === '101' && r.paperB.pmid === '102') ||
    (r.paperA.pmid === '102' && r.paperB.pmid === '101')
);
assert(p1_p2, 'Paper 1 vs Paper 2 (Positive vs Negative, 3 shared keywords) MUST be detected');
assert.strictEqual(p1_p2.sharedCount, 3);
assert.strictEqual(p1_p2.oppositionStrength, 1.0);

// Acceptance check 2: Paper 1 vs Paper 3 (Positive vs Null-Inconclusive, 2 shared: allulose, ketosis) MUST appear
const p1_p3 = resultsN2.find(r => 
    (r.paperA.pmid === '101' && r.paperB.pmid === '103') ||
    (r.paperA.pmid === '103' && r.paperB.pmid === '101')
);
assert(p1_p3, 'Paper 1 vs Paper 3 (Positive vs Null-Inconclusive) MUST be detected');
assert.strictEqual(p1_p3.sharedCount, 3); // 'allulose', 'diet', 'ketosis'

// Acceptance check 3: Unrelated papers MUST NOT appear
// Paper 4 (Positive vs Positive with Paper 1)
const p1_p4 = resultsN2.find(r => (r.paperA.pmid === '101' && r.paperB.pmid === '104') || (r.paperA.pmid === '104' && r.paperB.pmid === '101'));
assert(!p1_p4, 'Non-opposing pairs (Positive vs Positive) MUST NOT appear');

// Paper 5 (0 shared keywords)
const withP5 = resultsN2.filter(r => r.paperA.pmid === '105' || r.paperB.pmid === '105');
assert.strictEqual(withP5.length, 0, 'Unrelated paper (0 shared keywords) MUST NOT appear in any pair');

// Paper 6 (Only 1 shared keyword < N=2)
const withP6 = resultsN2.filter(r => r.paperA.pmid === '106' || r.paperB.pmid === '106');
assert.strictEqual(withP6.length, 0, 'Paper with only 1 shared keyword (< 2) MUST NOT appear when N=2');

// Paper 7 (Missing conclusion tag 'None')
const withP7 = resultsN2.filter(r => r.paperA.pmid === '107' || r.paperB.pmid === '107');
assert.strictEqual(withP7.length, 0, 'Paper with missing conclusion tag MUST NOT appear');

// Test 3: Configurable N
console.log('Test 3: Configurable N');
const resultsN1 = findDivergentPairs(allSamplePapers, { minSharedKeywords: 1 });
const withP6_N1 = resultsN1.filter(r => r.paperA.pmid === '106' || r.paperB.pmid === '106');
assert(withP6_N1.length > 0, 'When N=1, paper with 1 shared keyword appears');

const resultsN4 = findDivergentPairs(allSamplePapers, { minSharedKeywords: 4 });
assert.strictEqual(resultsN4.length, 0, 'When N=4, no pairs exceed threshold');
console.log('  ✓ Configurable N works as expected');

// Test 4: Ranking check
console.log('Test 4: Ranking verification');
// Top ranked should have highest sharedCount, then highest oppositionStrength
assert.strictEqual(resultsN2[0].sharedCount >= resultsN2[1].sharedCount, true);
console.log('  ✓ Ranking verification passed');

console.log('\nAll Divergence Logic tests passed successfully!');

// Configuration and Tunable Constants for PubMed ResearchMiner
// Ground Rule 2: All tunable constants live in this one config object.

const envApiKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_NCBI_API_KEY) ? import.meta.env.VITE_NCBI_API_KEY : '';
const envTool = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_NCBI_TOOL) ? import.meta.env.VITE_NCBI_TOOL : 'pubmed_research_miner';
const envEmail = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_NCBI_EMAIL) ? import.meta.env.VITE_NCBI_EMAIL : '';
const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.4.0';
const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();

export const config = {
    // API & Rate Limiting
    API_BASE: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/",
    NCBI_API_KEY: envApiKey,
    NCBI_TOOL: envTool,
    NCBI_EMAIL: envEmail,
    // When API key is present: ~110ms (~10 req/s), otherwise >= 350ms (3 req/s)
    PRIMER_REQUEST_GAP_MS: envApiKey ? 110 : 350,
    PRIMER_MAX_PER_QUERY: 25,
    PRIMER_CACHE_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
    PRIMER_RETRY_DELAY_MS: 1000,
    POST_ID_THRESHOLD: 50,

    // Search query limits & filters
    MAX_RESULTS: 50,
    YEARS_BACK: 5,
    DAYS_BACK: 5 * 365,
    TOP_KEYWORDS: 8,

    // Keywords Graph Layout & Node Sizing Constants
    DEFAULT_GRAPH_KEYWORD_CAP: 60,
    MIN_GRAPH_KEYWORD_CAP: 10,
    MAX_GRAPH_KEYWORD_CAP: 100,
    DENSE_GRAPH_EDGE_THRESHOLD: 40,
    GRAPH_MIN_RADIUS: 10,             // Minimum node radius (px)
    GRAPH_MAX_RADIUS: 34,             // Maximum node radius (px)
    GRAPH_MIN_FONT: 10,               // Minimum label font size (px)
    GRAPH_MAX_FONT: 18,               // Maximum label font size (px)
    GRAPH_NODE_REPULSION_BASE: 250000,
    GRAPH_NODE_REPULSION_FACTOR: 15000,
    GRAPH_IDEAL_EDGE_BASE: 50,
    GRAPH_IDEAL_EDGE_FACTOR: 0.8,

    // Community Detection & Clusters Constants (Louvain)
    GRAPH_MAX_CLUSTERS: 8,            // Maximum top clusters retained
    GRAPH_MIN_CLUSTER_SIZE: 3,        // Minimum cluster node count before folding into Other
    CLUSTER_PALETTE: [
        '#0072B2', // Blue
        '#E69F00', // Orange
        '#009E73', // Bluish Green
        '#CC79A7', // Reddish Purple
        '#56B4E9', // Sky Blue
        '#D55E00', // Vermilion
        '#F0E442', // Yellow
        '#33BBEE'  // Cyan
    ],
    CLUSTER_OTHER_COLOR: '#94a3b8',   // Neutral grey for singletons and tiny clusters
    CLUSTER_OTHER_BORDER: '#64748b',

    // Sample size bucket thresholds
    SAMPLE_SIZE_THRESHOLDS: {
        PILOT_MAX: 19,       // Pilot: N < 20 (1..19)
        SMALL_MIN: 20,
        SMALL_MAX: 99,       // Small: 20..99
        MEDIUM_MIN: 100,
        MEDIUM_MAX: 499,     // Medium: 100..499
        LARGE_MIN: 500       // Large: 500+
    },

    // Standard bucket categories
    SAMPLE_SIZE_BUCKETS: ['Pilot', 'Small', 'Medium', 'Large', 'Large + Longitudinal', 'Unknown'],
    CONCLUSION_TYPES: ['Positive', 'Negative', 'Null-Inconclusive', 'None'],
    SUBJECT_TYPES: ['Human', 'Animal', 'In vitro', 'Other/Unknown'],
    STUDY_TYPES: [
        'Randomized Controlled Trial',
        'Clinical Trial',
        'Meta-Analysis',
        'Systematic Review',
        'Review',
        'Case Reports',
        'Observational Study',
        'Other'
    ],

    // Citation buckets
    CITE_BUCKETS: [
        { id: 'c0',  label: 'Cited: 0',     test: c => c === 0 },
        { id: 'c1',  label: 'Cited: 1-5',   test: c => c >= 1 && c <= 5 },
        { id: 'c2',  label: 'Cited: 6-20',  test: c => c >= 6 && c <= 20 },
        { id: 'c3',  label: 'Cited: 21+',   test: c => c > 20 }
    ],

    // Color palettes for metrics
    COLOR_MAPS: {
        conclusion: {
            'Positive': '#10b981',
            'Negative': '#ef4444',
            'Null-Inconclusive': '#f59e0b',
            'None': '#94a3b8'
        },
        sampleSize: {
            'Pilot': '#06b6d4',
            'Small': '#3b82f6',
            'Medium': '#6366f1',
            'Large': '#8b5cf6',
            'Large + Longitudinal': '#a855f7',
            'Unknown': '#94a3b8'
        },
        citations: {
            'c0': '#94a3b8',
            'c1': '#38bdf8',
            'c2': '#f59e0b',
            'c3': '#ea580c'
        },
        studyType: {
            'Randomized Controlled Trial': '#059669',
            'Clinical Trial': '#10b981',
            'Meta-Analysis': '#0284c7',
            'Systematic Review': '#0ea5e9',
            'Review': '#6366f1',
            'Case Reports': '#8b5cf6',
            'Observational Study': '#d97706',
            'Other': '#94a3b8'
        },
        subjectType: {
            'Human': '#0ea5e9',
            'Animal': '#14b8a6',
            'In vitro': '#8b5cf6',
            'Other/Unknown': '#94a3b8'
        }
    },

    // Contradiction / Divergence Mapping Configuration
    DEFAULT_OPPOSING_CONFIG: [
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
    ],
    MAX_DIVERGENCE_PAIRS: 100,
    DIVERGENCE_PAGE_SIZE: 5,

    // App Version & Build Information
    APP_VERSION: appVersion,
    BUILD_TIME: buildTime,
};

// Export individual constants for convenient named imports & legacy compatibility
export const API_BASE = config.API_BASE;
export const MAX_RESULTS = config.MAX_RESULTS;
export const YEARS_BACK = config.YEARS_BACK;
export const DAYS_BACK = config.DAYS_BACK;
export const TOP_KEYWORDS = config.TOP_KEYWORDS;
export const DEFAULT_GRAPH_KEYWORD_CAP = config.DEFAULT_GRAPH_KEYWORD_CAP;
export const MIN_GRAPH_KEYWORD_CAP = config.MIN_GRAPH_KEYWORD_CAP;
export const MAX_GRAPH_KEYWORD_CAP = config.MAX_GRAPH_KEYWORD_CAP;
export const DENSE_GRAPH_EDGE_THRESHOLD = config.DENSE_GRAPH_EDGE_THRESHOLD;
export const GRAPH_MIN_RADIUS = config.GRAPH_MIN_RADIUS;
export const GRAPH_MAX_RADIUS = config.GRAPH_MAX_RADIUS;
export const GRAPH_MIN_FONT = config.GRAPH_MIN_FONT;
export const GRAPH_MAX_FONT = config.GRAPH_MAX_FONT;
export const GRAPH_NODE_REPULSION_BASE = config.GRAPH_NODE_REPULSION_BASE;
export const GRAPH_NODE_REPULSION_FACTOR = config.GRAPH_NODE_REPULSION_FACTOR;
export const GRAPH_IDEAL_EDGE_BASE = config.GRAPH_IDEAL_EDGE_BASE;
export const GRAPH_IDEAL_EDGE_FACTOR = config.GRAPH_IDEAL_EDGE_FACTOR;
export const GRAPH_MAX_CLUSTERS = config.GRAPH_MAX_CLUSTERS;
export const GRAPH_MIN_CLUSTER_SIZE = config.GRAPH_MIN_CLUSTER_SIZE;
export const CLUSTER_PALETTE = config.CLUSTER_PALETTE;
export const CLUSTER_OTHER_COLOR = config.CLUSTER_OTHER_COLOR;
export const CLUSTER_OTHER_BORDER = config.CLUSTER_OTHER_BORDER;
export const PRIMER_REQUEST_GAP_MS = config.PRIMER_REQUEST_GAP_MS;
export const PRIMER_MAX_PER_QUERY = config.PRIMER_MAX_PER_QUERY;
export const PRIMER_CACHE_TTL_MS = config.PRIMER_CACHE_TTL_MS;
export const PRIMER_RETRY_DELAY_MS = config.PRIMER_RETRY_DELAY_MS;
export const POST_ID_THRESHOLD = config.POST_ID_THRESHOLD;
export const SAMPLE_SIZE_THRESHOLDS = config.SAMPLE_SIZE_THRESHOLDS;
export const SAMPLE_SIZE_BUCKETS = config.SAMPLE_SIZE_BUCKETS;
export const CONCLUSION_TYPES = config.CONCLUSION_TYPES;
export const SUBJECT_TYPES = config.SUBJECT_TYPES;
export const STUDY_TYPES = config.STUDY_TYPES;
export const CITE_BUCKETS = config.CITE_BUCKETS;
export const COLOR_MAPS = config.COLOR_MAPS;
export const DEFAULT_OPPOSING_CONFIG = config.DEFAULT_OPPOSING_CONFIG;
export const MAX_DIVERGENCE_PAIRS = config.MAX_DIVERGENCE_PAIRS;
export const DIVERGENCE_PAGE_SIZE = config.DIVERGENCE_PAGE_SIZE;

// Expose on window for runtime and test verification
if (typeof window !== 'undefined') {
    window.config = config;
    window.GRAPH_MIN_RADIUS = GRAPH_MIN_RADIUS;
    window.GRAPH_MAX_RADIUS = GRAPH_MAX_RADIUS;
    window.GRAPH_MIN_FONT = GRAPH_MIN_FONT;
    window.GRAPH_MAX_FONT = GRAPH_MAX_FONT;
    window.GRAPH_MAX_CLUSTERS = GRAPH_MAX_CLUSTERS;
    window.GRAPH_MIN_CLUSTER_SIZE = GRAPH_MIN_CLUSTER_SIZE;
    window.CLUSTER_PALETTE = CLUSTER_PALETTE;
    window.CLUSTER_OTHER_COLOR = CLUSTER_OTHER_COLOR;
    window.CLUSTER_OTHER_BORDER = CLUSTER_OTHER_BORDER;
    window.DEFAULT_OPPOSING_CONFIG = DEFAULT_OPPOSING_CONFIG;
}

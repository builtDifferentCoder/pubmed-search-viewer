// IndexedDB persistence via Dexie.js (vendored npm package)
import Dexie from 'dexie';

export const db = new Dexie('PubMedMinerDB');

// Dexie Schema v1 -> v2 -> v3
db.version(1).stores({
    queries:  '++id, term, createdAt',
    articles: '++id, queryId, pmid, hasConclusion, citations, *keywordsNorm'
});

db.version(2).stores({
    queries:  '++id, term, createdAt',
    articles: '++id, queryId, pmid, hasConclusion, citations, *keywordsNorm, pubYear, studyType, subjectType, sampleSizeBucket, conclusionType'
}).upgrade(tx => {
    return tx.table('articles').toCollection().modify(article => {
        // Ensure safe defaults for existing v1 records
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

db.version(3).stores({
    primerRuns: 'topicId'
});

if (typeof window !== 'undefined') {
    window.db = db;
    window.Dexie = Dexie;
}

export default db;

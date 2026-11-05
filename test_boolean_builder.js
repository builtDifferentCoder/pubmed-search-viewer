const assert = require('assert');

// -----------------------------------------------------------------------------
// Core Boolean Query Builder Logic (Pure Functions)
// -----------------------------------------------------------------------------

function formatKeyword(kw) {
    if (!kw) return '';
    const trimmed = String(kw).trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
        return trimmed;
    }
    if (/\s/.test(trimmed)) {
        return `"${trimmed}"`;
    }
    return trimmed;
}

function compileBooleanQuery(items) {
    if (!items || items.length === 0) return '';
    let result = '';
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const formatted = formatKeyword(item.term);
        const openP = '('.repeat(item.openParens || 0);
        const closeP = ')'.repeat(item.closeParens || 0);

        if (i === 0) {
            result += `${openP}${formatted}${closeP}`;
        } else {
            const op = item.operator || 'AND';
            result += ` ${op} ${openP}${formatted}${closeP}`;
        }
    }
    return result.trim();
}

function groupRange(items, startIndex, endIndex) {
    if (startIndex < 0 || endIndex >= items.length || startIndex > endIndex) return false;
    items[startIndex].openParens = (items[startIndex].openParens || 0) + 1;
    items[endIndex].closeParens = (items[endIndex].closeParens || 0) + 1;
    return true;
}

function ungroupRange(items, startIndex, endIndex) {
    if (startIndex < 0 || endIndex >= items.length || startIndex > endIndex) return false;
    if ((items[startIndex].openParens || 0) > 0 && (items[endIndex].closeParens || 0) > 0) {
        items[startIndex].openParens--;
        items[endIndex].closeParens--;
        return true;
    }
    return false;
}

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------
console.log('Testing formatKeyword:');
assert.strictEqual(formatKeyword('allulose'), 'allulose');
assert.strictEqual(formatKeyword('allulose diet'), '"allulose diet"');
assert.strictEqual(formatKeyword('"already quoted"'), '"already quoted"');
assert.strictEqual(formatKeyword('vitamin d 1000iu'), '"vitamin d 1000iu"');
console.log('  ✓ formatKeyword passed');

console.log('Testing compileBooleanQuery - single keyword:');
const q1 = [{ term: 'allulose', operator: null, openParens: 0, closeParens: 0 }];
assert.strictEqual(compileBooleanQuery(q1), 'allulose');
console.log('  ✓ single keyword passed');

console.log('Testing compileBooleanQuery - two keywords default AND:');
const q2 = [
    { term: 'allulose', operator: null, openParens: 0, closeParens: 0 },
    { term: 'diet', operator: 'AND', openParens: 0, closeParens: 0 }
];
assert.strictEqual(compileBooleanQuery(q2), 'allulose AND diet');
console.log('  ✓ two keywords default AND passed');

console.log('Testing compileBooleanQuery - (A AND B) NOT C:');
const q3 = [
    { term: 'A', operator: null, openParens: 1, closeParens: 0 },
    { term: 'B', operator: 'AND', openParens: 0, closeParens: 1 },
    { term: 'C', operator: 'NOT', openParens: 0, closeParens: 0 }
];
assert.strictEqual(compileBooleanQuery(q3), '(A AND B) NOT C');
console.log('  ✓ (A AND B) NOT C passed');

console.log('Testing compileBooleanQuery with multi-word terms:');
const q4 = [
    { term: 'dietary allulose', operator: null, openParens: 1, closeParens: 0 },
    { term: 'ketogenic diet', operator: 'AND', openParens: 0, closeParens: 1 },
    { term: 'type 2 diabetes', operator: 'NOT', openParens: 0, closeParens: 0 }
];
assert.strictEqual(compileBooleanQuery(q4), '("dietary allulose" AND "ketogenic diet") NOT "type 2 diabetes"');
console.log('  ✓ multi-word terms quoted passed');

console.log('Testing grouping and ungrouping helper:');
const q5 = [
    { term: 'A', operator: null, openParens: 0, closeParens: 0 },
    { term: 'B', operator: 'AND', openParens: 0, closeParens: 0 },
    { term: 'C', operator: 'NOT', openParens: 0, closeParens: 0 }
];
assert.strictEqual(compileBooleanQuery(q5), 'A AND B NOT C');
groupRange(q5, 0, 1);
assert.strictEqual(compileBooleanQuery(q5), '(A AND B) NOT C');
ungroupRange(q5, 0, 1);
assert.strictEqual(compileBooleanQuery(q5), 'A AND B NOT C');
console.log('  ✓ group and ungroup passed');

console.log('\nAll unit tests passed!');

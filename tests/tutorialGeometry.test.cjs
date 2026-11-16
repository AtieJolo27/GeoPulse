const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/tutorialGeometry.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, context);
const { tutorialHighlight: highlight } = context.exports;

test('button highlight accounts for a status-bar or safe-area origin offset', () => {
  const rect = highlight({ x: 120, y: 80, width: 44, height: 44 }, { x: 0, y: 24 }, { width: 400, height: 800 });
  assert.equal(rect.x, 116);
  assert.equal(rect.y, 52);
  assert.equal(rect.width, 52);
  assert.equal(rect.height, 52);
});

test('full tab button including its label is highlighted rather than only its icon', () => {
  const rect = highlight({ x: 0, y: 730, width: 80, height: 60 }, { x: 0, y: 0 }, { width: 400, height: 800 });
  assert.equal(rect.x, 0);
  assert.equal(rect.width, 84);
  assert.equal(rect.height, 68);
});

test('hidden and offscreen targets never produce a misplaced highlight', () => {
  for (const rect of [{ x: 0, y: -20, width: 40, height: 40 }, { x: 0, y: 900, width: 40, height: 40 }, { x: 0, y: 0, width: 0, height: 0 }]) {
    assert.equal(highlight(rect, { x: 0, y: 0 }, { width: 400, height: 800 }), null);
  }
});

test('tutorial cards stay entirely outside header, middle and tab-bar highlights', () => {
  const { tutorialCardPlacement: place } = context.exports;
  for (const target of [
    { x: 300, y: 40, width: 44, height: 44 },
    { x: 20, y: 300, width: 350, height: 120 },
    { x: 0, y: 730, width: 80, height: 60 },
  ]) {
    const card = place(target, { width: 400, height: 800 }, { top: 24, bottom: 20 });
    assert.ok(card.maxHeight > 0);
    assert.ok(card.top + card.maxHeight <= target.y || card.top >= target.y + target.height);
    assert.ok(card.top >= 24);
    assert.ok(card.top + card.maxHeight <= 780);
  }
});

test('small screens cap tutorial height to available space without covering the target', () => {
  const { tutorialCardPlacement: place } = context.exports;
  const target = { x: 20, y: 160, width: 240, height: 120 };
  const card = place(target, { width: 320, height: 400 }, { top: 24, bottom: 24 });
  assert.ok(card.maxHeight < 180);
  assert.ok(card.top + card.maxHeight <= target.y || card.top >= target.y + target.height);
});

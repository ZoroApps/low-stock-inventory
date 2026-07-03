import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const blockPath = new URL(
  '../extensions/low-stock-counter/blocks/inventory-counter.liquid',
  import.meta.url,
);
const blocksPath = new URL('../extensions/low-stock-counter/blocks/', import.meta.url);
const block = readFileSync(blockPath, 'utf8');

test('extension exposes one clean low stock block', () => {
  assert.deepEqual(
    readdirSync(blocksPath).filter((name) => name.endsWith('.liquid')).sort(),
    ['inventory-counter.liquid'],
  );
  assert.match(block, /"name": "Low stock counter"/);
  assert.doesNotMatch(block, /Low stock counter NEW/);
});

test('schema is valid and keeps only core merchant settings', () => {
  const match = block.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
  assert.ok(match, 'schema block is present');

  const schema = JSON.parse(match[1]);
  assert.equal(schema.target, 'section');

  const ids = schema.settings.flatMap((setting) => setting.id ? [setting.id] : []);
  assert.equal(new Set(ids).size, ids.length);

  for (const id of [
    'low_stock_threshold',
    'show_sold_out',
    'alert_text',
    'sold_out_text',
    'background_color',
    'text_color',
    'warning_color',
    'track_color',
    'show_progress',
    'spacing_top',
    'spacing_bottom',
  ]) {
    assert.ok(ids.includes(id), `${id} setting exists`);
  }
});

test('block is product-page only and renders in normal theme flow', () => {
  assert.match(block, /request\.page_type == 'product'/);
  assert.match(block, /{% if is_product_page %}/);
  assert.match(block, /position: static/);
  assert.match(block, /z-index: auto/);
  assert.match(block, /margin: var\(--zoro-low-stock-gap-top\) 0 var\(--zoro-low-stock-gap-bottom\)/);
  assert.doesNotMatch(block, /insertAdjacentElement/);
  assert.doesNotMatch(block, /appendChild/);
  assert.doesNotMatch(block, /position:\s*fixed/);
  assert.doesNotMatch(block, /position:\s*absolute/);
});

test('counter stays backendless and reads native Shopify variant inventory', () => {
  assert.match(block, /variant\.inventory_quantity/);
  assert.match(block, /variant\.inventory_management/);
  assert.match(block, /variant\.inventory_policy/);
  assert.doesNotMatch(block, /https?:\/\/[^'"]+/);
  assert.doesNotMatch(block, /fetch\(/);
  assert.doesNotMatch(block, /XMLHttpRequest|WebSocket|localStorage|sessionStorage/);
});

test('embedded JavaScript is valid after Liquid replacement', () => {
  const scripts = [...block.matchAll(/<script>\s*([\s\S]*?)\s*<\/script>/g)]
    .map((match) => match[1])
    .filter((script) => !script.trim().startsWith('['));

  assert.ok(scripts.length >= 1, 'JavaScript block is present');
  for (const script of scripts) {
    assert.doesNotThrow(() => new Function(script.replaceAll('{{ block.id }}', 'test-block')));
  }
});

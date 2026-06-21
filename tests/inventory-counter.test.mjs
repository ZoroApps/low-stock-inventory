import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const blockPath = new URL(
  '../extensions/low-stock-counter/blocks/inventory-counter.liquid',
  import.meta.url,
);
const localesPath = new URL('../extensions/low-stock-counter/locales/', import.meta.url);
const block = readFileSync(blockPath, 'utf8');

test('schema is valid JSON with unique setting IDs', () => {
  const match = block.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
  assert.ok(match, 'schema block is present');
  const schema = JSON.parse(match[1]);
  const ids = schema.settings.flatMap((setting) => setting.id ? [setting.id] : []);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('alert_text'));
  assert.ok(ids.includes('message_language'));
  assert.ok(!ids.includes('preview_simulation'));
  assert.ok(!ids.includes('preview_stock_count'));
});

test('embedded JavaScript has valid syntax after Liquid ID replacement', () => {
  const match = block.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(match, 'JavaScript block is present');
  const script = match[1].replaceAll('{{ block.id }}', 'test-block');
  assert.doesNotThrow(() => new Function(script));
});

test('counter remains backendless and uses real Shopify inventory', () => {
  assert.match(block, /variant\.inventory_quantity/);
  assert.match(block, /variant\.inventory_management/);
  assert.doesNotMatch(block, /\bfetch\s*\(/);
  assert.doesNotMatch(block, /XMLHttpRequest|WebSocket|sessionStorage|localStorage/);
});

test('targeting and responsive controls are present', () => {
  for (const id of [
    'target_rule',
    'target_value',
    'show_on_mobile',
    'show_on_desktop',
    'mobile_font_size',
  ]) {
    assert.match(block, new RegExp(`"id":\s*"${id}"`));
  }
});

test('language selector exposes automatic and explicit languages', () => {
  for (const value of ['auto', 'en', 'es', 'fr', 'de', 'custom']) {
    assert.match(block, new RegExp(`"value":\s*"${value}"`));
  }
});

test('all locale files contain required storefront keys', () => {
  const required = [
    'low_stock_exact',
    'low_stock_general',
    'untracked',
    'sold_out',
    'editor_help',
    'target_help',
  ];

  for (const file of readdirSync(localesPath).filter((name) => name.endsWith('.json'))) {
    const locale = JSON.parse(readFileSync(new URL(file, localesPath), 'utf8'));
    for (const key of required) {
      assert.equal(typeof locale.inventory_counter?.[key], 'string', `${file}: ${key}`);
    }
  }
});

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const blockPath = new URL(
  '../extensions/low-stock-counter/blocks/inventory-counter.liquid',
  import.meta.url,
);
const collectionBlockPath = new URL(
  '../extensions/low-stock-counter/blocks/collection-stock-badge.liquid',
  import.meta.url,
);
const cartBlockPath = new URL(
  '../extensions/low-stock-counter/blocks/cart-stock-warning.liquid',
  import.meta.url,
);
const localesPath = new URL('../extensions/low-stock-counter/locales/', import.meta.url);
const block = readFileSync(blockPath, 'utf8');
const collectionBlock = readFileSync(collectionBlockPath, 'utf8');
const cartBlock = readFileSync(cartBlockPath, 'utf8');

test('schema is valid JSON with unique setting IDs', () => {
  const match = block.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
  assert.ok(match, 'schema block is present');
  const schema = JSON.parse(match[1]);
  const ids = schema.settings.flatMap((setting) => setting.id ? [setting.id] : []);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('alert_text'));
  assert.ok(ids.includes('message_language'));
  assert.ok(ids.includes('display_mode'));
  assert.ok(ids.includes('show_sold_out_badge'));
  assert.ok(ids.includes('companion_product'));
  assert.ok(!ids.includes('preview_simulation'));
  assert.ok(!ids.includes('preview_stock_count'));
});

test('embedded JavaScript has valid syntax after Liquid ID replacement', () => {
  const match = block.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(match, 'JavaScript block is present');
  const script = match[1].replaceAll('{{ block.id }}', 'test-block');
  assert.doesNotThrow(() => new Function(script));
});

test('counter remains backendless and uses Shopify inventory and cart APIs', () => {
  assert.match(block, /variant\.inventory_quantity/);
  assert.match(block, /variant\.inventory_management/);
  assert.match(block, /collection\.products/);
  assert.match(block, /cart\.items/);
  assert.match(block, /fetch\(`\$\{base\}cart\/add\.js`/);
  assert.match(block, /items:\s*\[\s*\{\s*id:\s*currentId,\s*quantity:\s*1\s*\},\s*\{\s*id:\s*companionId,\s*quantity:\s*1\s*\}/);
  assert.doesNotMatch(block, /https?:\/\/[^'"]+/);
  assert.doesNotMatch(block, /XMLHttpRequest|WebSocket|sessionStorage|localStorage/);
});

test('sold-out badge and optional companion offer are present', () => {
  assert.match(block, /data-zoro-sold-out-badge/);
  assert.match(block, /data-zoro-add-both/);
  assert.match(block, /"type": "product",\s*"id": "companion_product"/);
});

test('targeting and responsive controls are present', () => {
  for (const id of [
    'target_rule',
    'target_value',
    'show_on_mobile',
    'show_on_desktop',
    'mobile_font_size',
  ]) {
    assert.match(block, new RegExp(`"id": "${id}"`));
  }
});

test('language selector exposes automatic and explicit languages', () => {
  for (const value of ['auto', 'en', 'es', 'fr', 'de', 'custom']) {
    assert.match(block, new RegExp(`"value":\\s*"${value}"`));
  }
});

test('visibility supports always-on real inventory and low-stock-only modes', () => {
  assert.match(block, /data-display-mode/);
  assert.match(block, /displayMode === 'low_only'/);
  assert.match(block, /variants\.length\) show\(root\.dataset\.targetMessage/);
  assert.match(block, /pageType === 'product'/);
  assert.match(block, /"value":\s*"always"/);
  assert.match(block, /"value":\s*"low_only"/);
});

test('main low stock block adapts to collection and cart pages', () => {
  assert.match(block, /data-zoro-collection-products="{{ block\.id }}"/);
  assert.match(block, /data-zoro-cart-items="{{ block\.id }}"/);
  assert.match(block, /productCardFor\(product\.handle\)/);
  assert.match(block, /cartLineFor\(item\)/);
  assert.match(block, /zoro-adaptive-stock-badge-{{ block\.id }}/);
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

test('collection stock badge block is backendless and targets product cards', () => {
  const match = collectionBlock.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
  assert.ok(match, 'collection schema block is present');
  const schema = JSON.parse(match[1]);
  const ids = schema.settings.flatMap((setting) => setting.id ? [setting.id] : []);
  assert.equal(schema.target, 'section');
  assert.ok(ids.includes('low_stock_threshold'));
  assert.ok(ids.includes('show_sold_out'));
  assert.match(collectionBlock, /collection\.products/);
  assert.match(collectionBlock, /card_variant\.inventory_quantity/);
  assert.match(collectionBlock, /cardFor\(product\.handle\)/);
  assert.doesNotMatch(collectionBlock, /fetch\(|https?:\/\/|sessionStorage|localStorage/);
});

test('cart stock warning block is backendless and targets cart line items', () => {
  const match = cartBlock.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
  assert.ok(match, 'cart schema block is present');
  const schema = JSON.parse(match[1]);
  const ids = schema.settings.flatMap((setting) => setting.id ? [setting.id] : []);
  assert.equal(schema.target, 'section');
  assert.ok(ids.includes('low_stock_threshold'));
  assert.ok(ids.includes('show_sold_out'));
  assert.match(cartBlock, /cart\.items/);
  assert.match(cartBlock, /cart_variant\.inventory_quantity/);
  assert.match(cartBlock, /lineFor\(item\)/);
  assert.doesNotMatch(cartBlock, /fetch\(|https?:\/\/|sessionStorage|localStorage/);
});

test('new embedded JavaScript has valid syntax after Liquid ID replacement', () => {
  for (const liquidBlock of [collectionBlock, cartBlock]) {
    const match = liquidBlock.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
    assert.ok(match, 'JavaScript block is present');
    const script = match[1].replaceAll('{{ block.id }}', 'test-block');
    assert.doesNotThrow(() => new Function(script));
  }
});

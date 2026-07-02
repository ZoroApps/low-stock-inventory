import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const blockPath = new URL(
  '../extensions/low-stock-counter/blocks/inventory-counter.liquid',
  import.meta.url,
);
const blocksPath = new URL('../extensions/low-stock-counter/blocks/', import.meta.url);
const localesPath = new URL('../extensions/low-stock-counter/locales/', import.meta.url);
const block = readFileSync(blockPath, 'utf8');

test('extension exposes one unified app block without NEW in the name', () => {
  assert.deepEqual(
    readdirSync(blocksPath).filter((name) => name.endsWith('.liquid')).sort(),
    ['inventory-counter.liquid'],
  );
  assert.match(block, /"name": "Low stock counter"/);
  assert.doesNotMatch(block, /Low stock counter NEW/);
});

test('schema is valid JSON with unique setting IDs', () => {
  const match = block.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
  assert.ok(match, 'schema block is present');
  const schema = JSON.parse(match[1]);
  const ids = schema.settings.flatMap((setting) => setting.id ? [setting.id] : []);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of [
    'low_stock_threshold',
    'display_mode',
    'related_display',
    'alert_text',
    'message_language',
    'show_sold_out_badge',
    'background_color',
    'text_color',
    'warning_color',
  ]) {
    assert.ok(ids.includes(id), `${id} setting exists`);
  }
});

test('embedded JavaScript has valid syntax after Liquid replacement', () => {
  const scripts = [...block.matchAll(/<script>\s*([\s\S]*?)\s*<\/script>/g)]
    .map((match) => match[1])
    .filter((script) => !script.trim().startsWith('['));

  assert.ok(scripts.length >= 1, 'JavaScript block is present');
  for (const script of scripts) {
    assert.doesNotThrow(() => new Function(script.replaceAll('{{ block.id }}', 'test-block')));
  }
});

test('counter stays backendless and reads native Shopify product data', () => {
  assert.match(block, /variant\.inventory_quantity/);
  assert.match(block, /variant\.inventory_management/);
  assert.match(block, /collection\.products/);
  assert.match(block, /fetch\(`\$\{base\}products\/\$\{encodeURIComponent\(handle\)\}\.js`/);
  assert.doesNotMatch(block, /https?:\/\/[^'"]+/);
  assert.doesNotMatch(block, /XMLHttpRequest|WebSocket|localStorage/);
});

test('product page block is inserted beside pricing, not as a floating portal', () => {
  assert.match(block, /const priceTarget = \(\) =>/);
  assert.match(block, /price\.insertAdjacentElement\('afterend', root\)/);
  assert.match(block, /purchase\.insertAdjacentElement\('beforebegin', root\)/);
  assert.match(block, /data-zoro-inline="price"/);
  assert.doesNotMatch(block, /document\.body\.appendChild/);
  assert.doesNotMatch(block, /position:\s*fixed/);
  assert.doesNotMatch(block, /LowStockCounterPortal/);
  assert.doesNotMatch(block, /positionProductPortal|renderProductPortal|retryProductPlacement/);
});

test('collection and related product badges attach to product media only', () => {
  assert.match(block, /data-zoro-collection-products="{{ block\.id }}"/);
  assert.match(block, /const renderCollection = \(\) =>/);
  assert.match(block, /const renderRelated = async \(\) =>/);
  assert.match(block, /const mediaTarget = \(card\) =>/);
  assert.match(block, /target\.append\(makeBadge\(key, badge\)\)/);
  assert.match(block, /zoro-adaptive-stock-badge--overlay/);
  assert.doesNotMatch(block, /renderInline/);
  assert.doesNotMatch(block, /data-zoro-cart-items/);
  assert.doesNotMatch(block, /cart:updated/);
});

test('visibility and related badge controls are present', () => {
  assert.match(block, /displayMode === 'low_only'/);
  assert.match(block, /relatedDisplay === 'off'/);
  assert.match(block, /relatedDisplay === 'exact'/);
  assert.match(block, /simulatedCountFor/);
  assert.match(block, /root\.dataset\.showSoldOut/);
});

test('language selector exposes automatic and explicit languages', () => {
  for (const value of ['auto', 'en', 'es', 'fr', 'de', 'custom']) {
    assert.match(block, new RegExp(`"value":\\s*"${value}"`));
  }
});

test('locale files contain required storefront keys', () => {
  const required = [
    'low_stock_exact',
    'low_stock_general',
    'untracked',
    'sold_out',
    'editor_help',
  ];

  for (const file of readdirSync(localesPath).filter((name) => name.endsWith('.json'))) {
    const locale = JSON.parse(readFileSync(new URL(file, localesPath), 'utf8'));
    for (const key of required) {
      assert.equal(typeof locale.inventory_counter?.[key], 'string', `${file}: ${key}`);
    }
  }
});

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const blockPath = new URL(
  '../extensions/low-stock-counter/blocks/inventory-counter.liquid',
  import.meta.url,
);
const blocksPath = new URL(
  '../extensions/low-stock-counter/blocks/',
  import.meta.url,
);
const localesPath = new URL('../extensions/low-stock-counter/locales/', import.meta.url);
const block = readFileSync(blockPath, 'utf8');

test('extension exposes one unified app block', () => {
  assert.deepEqual(
    readdirSync(blocksPath).filter((name) => name.endsWith('.liquid')).sort(),
    ['inventory-counter.liquid'],
  );
  assert.match(block, /"name": "Low stock counter"/);
});

test('schema is valid JSON with unique setting IDs', () => {
  const match = block.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/);
  assert.ok(match, 'schema block is present');
  const schema = JSON.parse(match[1]);
  const ids = schema.settings.flatMap((setting) => setting.id ? [setting.id] : []);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('alert_text'));
  assert.ok(ids.includes('message_language'));
  assert.ok(ids.includes('display_mode'));
  assert.ok(ids.includes('related_display'));
  assert.ok(ids.includes('show_sold_out_badge'));
  assert.ok(ids.includes('companion_product'));
  assert.ok(!ids.includes('preview_simulation'));
  assert.ok(!ids.includes('preview_stock_count'));
});

test('embedded JavaScript has valid syntax after Liquid ID replacement', () => {
  const scripts = [...block.matchAll(/<script>\s*([\s\S]*?)\s*<\/script>/g)]
    .map((match) => match[1])
    .filter((script) => !script.trim().startsWith('['));

  assert.ok(scripts.length >= 2, 'JavaScript blocks are present');
  for (const script of scripts) {
    assert.doesNotThrow(() => new Function(script.replaceAll('{{ block.id }}', 'test-block')));
  }
});

test('counter remains backendless and uses Shopify inventory and cart APIs', () => {
  assert.match(block, /variant\.inventory_quantity/);
  assert.match(block, /variant\.inventory_management/);
  assert.match(block, /collection\.products/);
  assert.match(block, /cart\.items/);
  assert.match(block, /fetch\(`\$\{base\}products\/\$\{encodeURIComponent\(handle\)\}\.js`/);
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

test('responsive controls are present and product targeting is removed', () => {
  for (const id of [
    'show_on_mobile',
    'show_on_desktop',
    'mobile_font_size',
  ]) {
    assert.match(block, new RegExp(`"id": "${id}"`));
  }
  assert.doesNotMatch(block, /"id": "target_rule"/);
  assert.doesNotMatch(block, /"id": "target_value"/);
  assert.doesNotMatch(block, /targetEligible|target_eligible|target-message|targetMessage/);
});

test('language selector exposes automatic and explicit languages', () => {
  for (const value of ['auto', 'en', 'es', 'fr', 'de', 'custom']) {
    assert.match(block, new RegExp(`"value":\\s*"${value}"`));
  }
});

test('visibility supports always-on real inventory and low-stock-only modes', () => {
  assert.match(block, /data-display-mode/);
  assert.match(block, /data-related-display/);
  assert.match(block, /displayMode === 'low_only'/);
  assert.match(block, /pageType !== 'product'/);
  assert.doesNotMatch(block, /show\(root\.dataset\.targetMessage/);
  assert.doesNotMatch(block, /This product does not match/);
  assert.match(block, /pageType === 'product'/);
  assert.match(block, /"value":\s*"always"/);
  assert.match(block, /"value":\s*"low_only"/);
});

test('product targeting warnings are not renderable', () => {
  assert.match(block, /assign is_product_page = false/);
  assert.match(block, /if request\.page_type == 'product' and product != blank/);
  assert.match(block, /data-product-page="{{ is_product_page }}"/);
  assert.match(block, /data-design-mode="{{ product_design_mode }}"/);
  assert.doesNotMatch(block, /target_help|target_rule|target_value|target-message/);
});

test('main low stock block adapts to collection and cart pages', () => {
  assert.match(block, /data-zoro-collection-products="{{ block\.id }}"/);
  assert.match(block, /data-zoro-cart-items="{{ block\.id }}"/);
  assert.match(block, /data-zoro-adaptive-list/);
  assert.match(block, /renderInline\(inlineEntries\)/);
  assert.match(block, /window\.CSS\?\.escape/);
  assert.match(block, /productCardFor\(product\)/);
  assert.match(block, /relatedProductCards/);
  assert.match(block, /productDataForHandle/);
  assert.match(block, /renderRelatedProducts/);
  assert.match(block, /relatedBadgeFor/);
  assert.match(block, /relatedDisplay === 'off'/);
  assert.match(block, /relatedDisplay === 'exact'/);
  assert.match(block, /"id": "related_display"/);
  assert.match(block, /"default": "simple"/);
  assert.match(block, /renderProductPageOverlay/);
  assert.match(block, /productPagePriceTarget/);
  assert.match(block, /placeProductRootNearPrice/);
  assert.match(block, /placeRootNearProductPrice/);
  assert.match(block, /purchaseTarget/);
  assert.match(block, /productPurchaseTarget/);
  assert.match(block, /add to cart\|buy it now\|sold out/);
  assert.match(block, /visiblePriceTarget/);
  assert.match(block, /productVisiblePriceTarget/);
  assert.match(block, /exactCurrentPriceTarget/);
  assert.match(block, /retryProductPlacement/);
  assert.match(block, /const productPriceTarget = \(\) => \{\s*const price = exactCurrentPriceTarget\(\) \|\| visiblePriceTarget\(\);\s*if \(price\) return price;/);
  assert.match(block, /const productPriceTarget = \(\) => \{[\s\S]*?return null;\s*\};/);
  assert.doesNotMatch(block, /const purchase = purchaseTarget\(\);\s*if \(purchase\) return purchase;/);
  assert.match(block, /\[data-product-placement="price"\]/);
  assert.match(block, /overflow-wrap: anywhere/);
  assert.match(block, /const portalTarget = \(\) => purchaseTarget\(\) \|\| exactCurrentPriceTarget\(\) \|\| visiblePriceTarget\(\)/);
  assert.doesNotMatch(block, /const purchase = productPurchaseTarget\(\);\s*if \(purchase\?\.node\) return purchase\.node/);
  assert.match(block, /LowStockCounterPortal-{{ block\.id }}/);
  assert.match(block, /positionProductPortal/);
  assert.match(block, /node\.classList\.add\('zoro-stock--floating-purchase'\)/);
  assert.match(block, /document\.body\.appendChild\(portal\)/);
  assert.match(block, /node\.style\.left = `\$\{left\}px`/);
  assert.match(block, /node\.style\.top = `\$\{top\}px`/);
  assert.match(block, /data-zoro-portal-message/);
  assert.match(block, /lastPortalRender = \{ copy, count, progressVisible, soldOut \}/);
  assert.match(block, /const portalPlaced = pageType === 'product'\s*\?\s*renderProductPortal\(copy, count, progressVisible, soldOut\)\s*:\s*false/);
  assert.match(block, /root\.hidden = pageType === 'product' \? true : false/);
  assert.match(block, /root\.dataset\.productPlacement = 'price'/);
  assert.match(block, /root\.dataset\.productPlacement = 'portal'/);
  assert.match(block, /root\.dataset\.productPlacement === 'price'\) return/);
  assert.doesNotMatch(block, /productPageMedia/);
  assert.match(block, /hideProductInline/);
  assert.match(block, /root\.dataset\.cardMode = 'true'/);
  assert.match(block, /simulatedCountFor/);
  assert.match(block, /decrementSimulatedCounts/);
  assert.match(block, /root\.dataset\.pageType === 'product'\) return/);
  assert.doesNotMatch(block, /collectionSource \|\| cartSource \|\| root\.dataset\.pageType !== 'product'/);
  assert.match(block, /data-current-handle="{{ product\.handle }}"/);
  assert.match(block, /closestProductCard/);
  assert.match(block, /placeOverlayBadge/);
  assert.match(block, /mediaTargetFor/);
  assert.match(block, /zoro-adaptive-stock-badge--overlay/);
  assert.match(block, /getClientRects\(\)\.length/);
  assert.doesNotMatch(block, /placed === 0 \|\| window\.Shopify\?\.designMode/);
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
    assert.doesNotMatch(
      JSON.stringify(locale),
      /does not match|targeting rule|segmentación|ciblage|Ausrichtungsregel/i,
      `${file}: targeting warning must not be rendered`,
    );
  }
});

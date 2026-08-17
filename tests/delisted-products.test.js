const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "products.json"), "utf8"));
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");

test("all 蠻牛 and 乖乖 products remain stored but are delisted", () => {
  const targets = catalog.products.filter((product) => /蠻牛|乖乖/.test([
    product.name,
    product.rawName,
    product.displayName,
  ].filter(Boolean).join(" ")));

  const guaiGuai = targets.filter((product) => /乖乖/.test(product.name));
  const manNiu = targets.filter((product) => /蠻牛/.test(product.name));

  assert.equal(guaiGuai.length, 2);
  assert.equal(manNiu.length, 1);
  targets.forEach((product) => {
    assert.equal(product.isActive, false, `${product.name} should be delisted`);
    assert.ok(product.id, `${product.name} should retain its ID`);
    assert.ok(product.image, `${product.name} should retain its image`);
    assert.ok(Object.hasOwn(product, "price"), `${product.name} should retain its price`);
    assert.ok(Object.hasOwn(product, "stockQty"), `${product.name} should retain its stock`);
  });
});

test("storefront filters delisted products and prunes stale cart entries", () => {
  assert.match(script, /filter\(\(product\) => product\.isActive !== false && product\.stockQty > 0\)/);
  assert.match(script, /if \(!product \|\| product\.stockQty <= 0 \|\| product\.stock === "缺貨"\) \{\s*state\.cart\.delete\(key\)/);
});

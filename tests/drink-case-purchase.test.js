const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "products.json"), "utf8"));
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
const drinks = catalog.products.filter((product) => product.category === "飲料");

assert.equal(drinks.length, 40, "應核對全部40項飲料");

for (const product of drinks) {
  assert.equal(product.caseEnabled, true, `${product.name} 應開放整箱購買`);
  assert.equal(product.caseQuantity, 24, `${product.name} 每箱應為24入`);
  assert.equal(
    product.casePrice,
    Math.round(product.baseUnitPrice * product.caseQuantity * 100) / 100,
    `${product.name} 箱價應等於單入售價乘以每箱入數`,
  );
  assert.ok(product.stockQty >= product.caseQuantity, `${product.name} 庫存應足夠至少一箱`);
}

assert.match(script, /data-add-type="unit"/, "商品卡應提供單入按鈕");
assert.match(script, /data-add-type="case"/, "商品卡應提供整箱按鈕");
assert.match(script, /purchaseType === "case" \? qty \* \(product\.caseQuantity \|\| 0\)/, "整箱庫存應按每箱入數扣除");
assert.match(script, /product\.casePrice \* qty/, "整箱小計應使用箱價乘以箱數");

console.log("drink-case-purchase: 40 drinks verified for unit and 24-count case purchasing");

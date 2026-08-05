const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const products = JSON.parse(fs.readFileSync(path.join(root, "products.json"), "utf8")).products;
const targets = products.filter((product) => product.specText === "3碗／組");
const changedPriceIds = new Set([
  "barcode-47100885129630",
  "barcode-47100885129700",
  "barcode-4710088930682",
  "barcode-47100885119590",
  "barcode-47100885119800",
  "barcode-47100885119110",
  "barcode-4710088511935",
  "barcode-47100885143940",
  "barcode-47100889343690",
]);

assert.equal(targets.length, 18, "三碗組商品必須恰好 18 項");
assert.equal(targets.filter((product) => changedPriceIds.has(product.id)).length, 9);
assert.equal(targets.filter((product) => changedPriceIds.has(product.id) && product.baseUnitPrice === 6 && product.price === 18).length, 5);
assert.equal(targets.filter((product) => changedPriceIds.has(product.id) && product.baseUnitPrice === 4 && product.price === 12).length, 4);

for (const product of targets) {
  assert.equal(product.unitsPerSale, 3, `${product.name} unitsPerSale`);
  assert.equal(product.saleUnit, "組", `${product.name} saleUnit`);
  assert.equal(product.salePrice, product.baseUnitPrice * 3, `${product.name} salePrice`);
  assert.ok(!product.specText.includes("碗裝"), `${product.name} 不應顯示碗裝`);
  assert.ok(!product.specText.includes("桶裝"), `${product.name} 不應顯示桶裝`);
  assert.ok(fs.existsSync(path.join(root, product.image)), `${product.name} 圖片不存在`);
}

const appsScriptPath = path.join(root, "GoogleAppsScript", "google-apps-script-order-status.gs");
const appsScript = fs.readFileSync(appsScriptPath, "utf8");
const sandbox = {};
vm.runInNewContext(`${appsScript}\nthis.__pickingItemsToText = pickingItemsToText_;`, sandbox);
const telegramText = sandbox.__pickingItemsToText([{
  name: "統一阿Q桶麵 紅椒牛肉",
  specText: "3碗／組",
  saleUnit: "組",
  unitName: "桶",
  unitsPerSale: 3,
  quantity: 1,
  usedUnits: 3,
  salePrice: 18,
  lineTotal: 18,
}]);

assert.match(telegramText, /統一阿Q桶麵 紅椒牛肉（3碗／組）/);
assert.doesNotMatch(telegramText, /桶裝|單桶販售|單碗販售/);

console.log("three-cup-products: 18 products and Telegram picking text verified");

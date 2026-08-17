const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");

test("mobile storefront keeps a simple order guide and cart dock", () => {
  assert.match(html, /class="mobile-order-guide"/);
  assert.match(html, /點「＋」加入商品 → 點下方「查看購物車」/);
  assert.match(html, /data-mobile-cart-dock/);
  assert.match(html, /data-mobile-open-cart/);
  assert.match(script, /mobileCartCount\.textContent = `購物車 \$\{itemCount\} 項`/);
  assert.match(script, /mobileCartAmount\.textContent = amountText/);
  assert.match(script, /mobileOpenCart\?\.addEventListener\("click", openCart\)/);
});

test("mobile cart uses full-width vertical layout without changing desktop", () => {
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.cart-panel \{[\s\S]*?max-height: 100dvh/);
  assert.match(css, /\.cart-item \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.qty-tools button \{[\s\S]*?width: 44px;[\s\S]*?height: 44px/);
  assert.match(css, /padding-bottom: calc\(8px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /body\.cart-is-open \.mobile-cart-dock/);
});

const config = window.SHOP_CONFIG || {
  currencyLabel: "$",
  telegram: { mode: "proxy", orderEndpoint: "" },
};

const iconMap = {
  台灣泡麵補給: "麵",
  台灣經典飲料: "飲",
  台灣下飯料理: "飯",
  台灣日常用品: "用",
  台灣廚房補給: "廚",
  台灣人氣零食: "零",
  餅乾: "零",
  罐頭: "罐",
  調味料: "醬",
  泡麵: "麵",
  飲料: "飲",
  生活用品: "用",
  酒類: "酒",
};

const categoryKeyMap = {
  餅乾: "snacks",
  零食: "snacks",
  罐頭: "canned",
  調味料: "condiments",
  泡麵: "noodles",
  飲料: "drinks",
  生活用品: "daily",
  日用品: "daily",
  酒類: "drinks",
};

const categoryDisplayMap = {
  全部: { icon: "⌂", label: "全部" },
  泡麵: { icon: "🍜", label: "泡麵" },
  飲料: { icon: "🥤", label: "飲料" },
  餅乾: { icon: "🍪", label: "零食" },
  罐頭: { icon: "🥫", label: "罐頭" },
  調味料: { icon: "🧂", label: "調味料" },
  生活用品: { icon: "🧴", label: "日用品" },
  日用品: { icon: "🧴", label: "日用品" },
};

const state = {
  categories: [],
  products: [],
  hotNames: [],
  category: "全部",
  query: "",
  cart: new Map(),
};

const productGrid = document.querySelector("[data-product-grid]");
const hotList = document.querySelector("[data-hot-list]");
const newList = document.querySelector("[data-new-list]");
const tabs = document.querySelector("[data-category-tabs]");
const search = document.querySelector("#product-search");
const emptyState = document.querySelector("[data-empty-state]");
const cartDrawer = document.querySelector("[data-cart-drawer]");
const cartItems = document.querySelector("[data-cart-items]");
const cartCount = document.querySelector("[data-cart-count]");
const form = document.querySelector("[data-order-form]");
const orderSuccess = document.querySelector("[data-order-success]");
const orderCount = document.querySelector("[data-order-count]");
const orderDetailList = document.querySelector("[data-order-detail-list]");
const successDetail = document.querySelector("[data-success-detail]");
const paymentTitle = document.querySelector("[data-payment-title]");
const paymentAccount = document.querySelector("[data-payment-account]");
const paymentNote = document.querySelector("[data-payment-note]");
const checkoutTotal = document.querySelector("[data-checkout-total]");
const toast = document.querySelector("[data-toast]");
const productSection = document.querySelector(".all-products-section");
const productsTitle = document.querySelector("#products-title");

const headerOffset = 88;
let toastTimer;

const categorySlugMap = {
  全部: "all",
  飲料: "drinks",
  泡麵: "noodles",
  餅乾: "snacks",
  零食: "snacks",
  罐頭: "canned",
  調味料: "condiments",
  生活用品: "daily",
  日用品: "daily",
  酒類: "drinks",
};

function assetName(input) {
  return input.replace(/[／\s]+/g, "-").replace(/[\\/:*?"<>|]/g, "").toLowerCase();
}

function formatPrice(product) {
  if (isPriced(product.price)) {
    return formatMoney(product.price);
  }
  return product.priceText || "請詢價";
}

function formatMoney(value) {
  return `${config.currencyLabel || ""}${value.toLocaleString("zh-TW")}`;
}

function isPriced(value) {
  return value !== null && value !== undefined && !Number.isNaN(Number(value));
}

function normalizePriceValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text || /^(待定價|請詢價|未定|詢價)$/i.test(text)) return null;
  const number = Number(text.replace(/NT\$|TWD|\$|元|,|\s/g, ""));
  return Number.isFinite(number) ? number : null;
}

function normalizePositiveNumber(value) {
  const number = normalizePriceValue(value);
  return number && number > 0 ? number : null;
}

function normalizeProduct(product) {
  const category = state.categories.find((item) => item.name === product.category);
  const stockQty = Number.isFinite(Number(product.stockQty)) ? Number(product.stockQty) : 0;
  const price = normalizePriceValue(product.price);
  const caseQuantity = normalizePositiveNumber(product.caseQuantity);
  const casePrice = normalizePriceValue(product.casePrice);
  return {
    ...product,
    id: `${product.category}-${product.name}`,
    price,
    priceText: price === null ? product.priceText || "待定價" : "",
    tone: category?.tone || "#f0b95a",
    categoryKey: categoryKeyMap[product.category] || "daily",
    mark: iconMap[product.category] || "品",
    stockQty,
    stock: stockQty <= 0 ? "缺貨" : product.stock || "現貨",
    image: product.image || "",
    fallbackImage: product.fallbackImage || "",
    unitName: product.unitName || "件",
    caseEnabled: Boolean(product.caseEnabled && caseQuantity),
    caseQuantity,
    casePrice,
  };
}

function categoryId(name) {
  const slug = categorySlugMap[name] || String(name).trim().toLowerCase().replace(/\s+/g, "-");
  return `category-${slug}`;
}

function updateProductSectionAnchor() {
  if (!productSection) return;
  productSection.id = categoryId(state.category);
  productSection.dataset.activeCategory = state.category;
  if (productsTitle) {
    productsTitle.textContent = state.category === "全部" ? "全部商品" : `${state.category}商品`;
  }
}

function scrollToProductSection() {
  if (!productSection) return;
  const top = productSection.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({
    top: Math.max(top, 0),
    behavior: "smooth",
  });
}

function centerActiveCategoryButton(button) {
  if (!button || !tabs) return;
  button.scrollIntoView({
    behavior: "smooth",
    inline: "center",
    block: "nearest",
  });
}

function setCategory(name, options = {}) {
  state.category = name;
  renderProducts();
  renderActiveTabs();
  updateProductSectionAnchor();
  const activeButton = [...tabs.querySelectorAll("button")].find((button) => button.dataset.category === name);
  centerActiveCategoryButton(activeButton);
  if (options.updateHash !== false) {
    history.replaceState(null, "", `#${categoryId(name)}`);
  }
  if (options.scroll !== false) {
    scrollToProductSection();
  }
}

function categoryFromHash() {
  const hash = decodeURIComponent(window.location.hash.replace("#", ""));
  if (!hash) return "";
  return ["全部", ...state.categories.map((category) => category.name)].find((name) => categoryId(name) === hash) || "";
}

function productCard(product) {
  const card = document.createElement("article");
  const disabled = product.stock === "缺貨" || product.stockQty <= 0;
  const caseDisabled = disabled || !product.caseEnabled || !product.caseQuantity || maxPurchaseQty(product, "case") <= 0;
  const badges = [product.isHot ? '<span class="badge">HOT</span>' : "", product.isNew ? '<span class="badge badge-new">NEW</span>' : ""].join("");
  const placeholder = `
    <div class="product-placeholder product-placeholder-${product.categoryKey}" aria-hidden="true">
      <span>${product.mark}</span>
      <small>${product.category}</small>
    </div>
  `;
  const productVisual = product.image
    ? `<img src="${product.image}" data-fallback="${product.fallbackImage || ""}" alt="${product.name} 商品圖" loading="lazy" />`
    : placeholder;
  card.className = "product-card";
  card.style.setProperty("--card-color", product.tone);
  card.innerHTML = `
    <div class="badge-row">${badges}</div>
    <div class="product-art">
      ${productVisual}
    </div>
    <div class="product-body">
      <p class="category-label">${product.category}</p>
      <h3>${product.name}</h3>
      <div class="product-meta">
        <strong>${formatPrice(product)}</strong>
        <span class="${disabled ? "stock-out" : ""}">${product.stock}</span>
      </div>
      <p class="stock-line">庫存 ${product.stockQty}${product.unitName}</p>
      <div class="product-actions">
        <button class="add-button" type="button" data-add-type="unit" ${disabled ? "disabled" : ""}>${disabled ? "暫時缺貨" : `單${product.unitName}`}</button>
        ${
          product.caseEnabled
            ? `<button class="add-button case-button" type="button" data-add-type="case" ${caseDisabled ? "disabled" : ""}>${caseDisabled ? "整箱缺貨" : `整箱 ${product.caseQuantity}${product.unitName}`}</button>`
            : ""
        }
      </div>
    </div>
    <button class="quick-add-button" type="button" data-quick-add aria-label="加入 ${product.name} 到購物車" ${disabled ? "disabled" : ""}>＋</button>
  `;
  const image = card.querySelector("img");
  if (image) {
    image.addEventListener(
      "error",
      () => {
        const art = image.closest(".product-art");
        art.innerHTML = placeholder;
      },
      { once: true },
    );
  }
  card.querySelectorAll("[data-add-type]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (addToCart(product.id, button.dataset.addType)) {
        showAddedFeedback(button);
      }
    });
  });
  const quickAdd = card.querySelector("[data-quick-add]");
  quickAdd.addEventListener("click", (event) => {
    event.stopPropagation();
    if (addToCart(product.id, "unit")) {
      showAddedFeedback(quickAdd);
    }
  });
  return card;
}

function renderTabs() {
  tabs.innerHTML = "";
  ["全部", ...state.categories.map((category) => category.name)].forEach((name) => {
    const display = categoryDisplayMap[name] || { icon: "◦", label: name };
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab-button";
    button.dataset.category = name;
    button.dataset.target = categoryId(name);
    button.innerHTML = `<span>${display.icon}</span><strong>${display.label}</strong>`;
    button.addEventListener("click", () => {
      setCategory(name);
    });
    tabs.append(button);
  });
  updateProductSectionAnchor();
  renderActiveTabs();
}

function renderActiveTabs() {
  tabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.category === state.category);
  });
}

function filteredProducts() {
  return state.products.filter((product) => {
    const matchCategory = state.category === "全部" || product.category === state.category;
    const matchQuery =
      !state.query ||
      product.name.includes(state.query) ||
      (product.company || "").includes(state.query) ||
      (product.barcode || "").includes(state.query) ||
      product.category.includes(state.query) ||
      product.stock.includes(state.query);
    return matchCategory && matchQuery;
  });
}

function renderProducts() {
  productGrid.innerHTML = "";
  const list = filteredProducts();
  list.forEach((product) => productGrid.append(productCard(product)));
  emptyState.hidden = list.length > 0;
}

function renderHotProducts() {
  hotList.innerHTML = "";
  const hotNameSet = new Set(state.hotNames);
  state.hotNames
    .map((name) => state.products.find((product) => product.name === name))
    .filter(Boolean)
    .slice(0, 4)
    .forEach((product) => hotList.append(productCard({ ...product, isHot: true, isNew: false })));
  state.products = state.products.map((product) => ({ ...product, isHot: hotNameSet.has(product.name) }));
}

function renderNewProducts() {
  newList.innerHTML = "";
  const newProducts = state.products.slice(-4).reverse();
  const newNameSet = new Set(newProducts.map((product) => product.name));
  newProducts.forEach((product) => newList.append(productCard({ ...product, isNew: true })));
  state.products = state.products.map((product) => ({ ...product, isNew: newNameSet.has(product.name) }));
}

function cartKey(productId, purchaseType) {
  return `${productId}::${purchaseType}`;
}

function parseCartKey(key) {
  const [productId, purchaseType = "unit"] = key.split("::");
  return { productId, purchaseType };
}

function purchaseUnitCount(product, purchaseType, qty) {
  return purchaseType === "case" ? qty * (product.caseQuantity || 0) : qty;
}

function cartUsedUnits(productId, excludedKey = "") {
  return [...state.cart.entries()].reduce((sum, [key, qty]) => {
    if (key === excludedKey) return sum;
    const parsed = parseCartKey(key);
    if (parsed.productId !== productId) return sum;
    const product = state.products.find((item) => item.id === parsed.productId);
    if (!product) return sum;
    return sum + purchaseUnitCount(product, parsed.purchaseType, qty);
  }, 0);
}

function maxPurchaseQty(product, purchaseType, key = "") {
  const availableStock = Math.max(product.stockQty - cartUsedUnits(product.id, key), 0);
  if (purchaseType === "case") {
    if (!product.caseEnabled || !product.caseQuantity) return 0;
    return Math.floor(availableStock / product.caseQuantity);
  }
  return availableStock;
}

function lineTotal(product, purchaseType, qty) {
  if (purchaseType === "case") {
    return isPriced(product.casePrice) ? product.casePrice * qty : null;
  }
  return isPriced(product.price) ? product.price * qty : null;
}

function purchaseLabel(product, purchaseType) {
  if (purchaseType === "case") return `整箱 ${product.caseQuantity}${product.unitName}`;
  return `單${product.unitName}`;
}

function addToCart(id, purchaseType = "unit") {
  const product = state.products.find((item) => item.id === id);
  if (!product || product.stock === "缺貨") return false;
  const key = cartKey(id, purchaseType);
  const currentQty = state.cart.get(key) || 0;
  const maxQty = maxPurchaseQty(product, purchaseType, key);
  if (currentQty >= maxQty) return false;
  state.cart.set(key, currentQty + 1);
  renderCart();
  return true;
}

function showToast(message = "已加入購物車") {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.hidden = true;
  }, 1300);
}

function showAddedFeedback(button) {
  const originalText = button.textContent;
  button.classList.add("is-added");
  button.textContent = "✓";
  showToast("已加入購物車");
  setTimeout(() => {
    button.classList.remove("is-added");
    button.textContent = originalText;
  }, 650);
}

function changeQty(key, delta) {
  const { productId, purchaseType } = parseCartKey(key);
  const product = state.products.find((item) => item.id === productId);
  const next = (state.cart.get(key) || 0) + delta;
  if (next <= 0) {
    state.cart.delete(key);
  } else if (product && next <= maxPurchaseQty(product, purchaseType, key)) {
    state.cart.set(key, next);
  } else {
    alert(`目前庫存不足，最多可購買 ${maxPurchaseQty(product, purchaseType, key)} ${purchaseType === "case" ? "箱" : product.unitName}。`);
  }
  renderCart();
}

function cartSummary() {
  const entries = [...state.cart.entries()];
  const items = entries
    .map(([key, qty]) => {
      const { productId, purchaseType } = parseCartKey(key);
      const product = state.products.find((item) => item.id === productId);
      if (!product) return null;
      const usedUnits = purchaseUnitCount(product, purchaseType, qty);
      const subtotal = lineTotal(product, purchaseType, qty);
      return {
        key,
        productId,
        product,
        purchaseType,
        qty,
        usedUnits,
        lineTotal: subtotal,
      };
    })
    .filter(Boolean);
  const itemCount = items.length;
  const totalCount = items.reduce((sum, item) => sum + item.usedUnits, 0);
  const hasUnpriced = items.some((item) => item.lineTotal === null);
  const allPriced = itemCount > 0 && !hasUnpriced;
  const total = allPriced ? items.reduce((sum, item) => sum + item.lineTotal, 0) : null;
  const amountText = allPriced ? formatMoney(total) : "依店家回覆為準";
  return { entries, items, itemCount, totalCount, hasUnpriced, allPriced, total, amountText };
}

function renderCart() {
  cartItems.innerHTML = "";
  orderDetailList.innerHTML = "";
  const { items, itemCount, totalCount, hasUnpriced, amountText } = cartSummary();
  cartCount.textContent = totalCount;
  orderCount.textContent = `${totalCount} 件商品`;

  if (!items.length) {
    cartItems.innerHTML = '<p class="form-note">購物車目前是空的，先把想補貨的品項加進來。</p>';
    orderDetailList.innerHTML = '<p class="form-note">尚未選擇商品。</p>';
    if (checkoutTotal) {
      checkoutTotal.innerHTML = "<strong>訂單金額：依店家回覆為準</strong>";
    }
    return;
  }

  items.forEach(({ key, product, purchaseType, qty, usedUnits, lineTotal }) => {
    const unitMode = purchaseType === "unit";
    const unitPriceText = unitMode
      ? isPriced(product.price)
        ? `單價 ${formatMoney(product.price)}`
        : "待定價"
      : isPriced(product.casePrice)
        ? `箱價 ${formatMoney(product.casePrice)}`
        : "整箱待報價";
    const quantityText = unitMode ? `${qty}${product.unitName}` : `${qty}箱`;
    const caseOptionDisabled = !product.caseEnabled || maxPurchaseQty(product, "case", key) <= 0;
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <strong>${product.name}</strong>
        <p class="form-note">${product.category}｜${unitMode ? unitPriceText : `單件 ${formatPrice(product)}`}｜庫存 ${product.stockQty}${product.unitName}</p>
        <div class="purchase-type" aria-label="購買方式">
          <span>購買方式</span>
          <button type="button" class="${unitMode ? "is-active" : ""}" ${unitMode ? "disabled" : ""} data-purchase-type="unit">單${product.unitName}</button>
          ${
            product.caseEnabled
              ? `<button type="button" class="${purchaseType === "case" ? "is-active" : ""}" ${purchaseType === "case" || caseOptionDisabled ? "disabled" : ""} data-purchase-type="case">${caseOptionDisabled && purchaseType !== "case" ? "整箱缺貨" : `整箱 ${product.caseQuantity}${product.unitName}`}</button>`
              : ""
          }
        </div>
        <p class="quantity-label">購買數量：${quantityText}</p>
        ${unitMode ? "" : `<p class="quantity-label">${qty}箱 × ${product.caseQuantity}${product.unitName}｜實際商品數量：${usedUnits}${product.unitName}</p>`}
        <p class="line-total">商品小計：${lineTotal === null ? "請詢價" : formatMoney(lineTotal)}</p>
      </div>
      <div class="qty-tools">
        <button type="button" aria-label="減少 ${product.name}">-</button>
        <span>${quantityText}</span>
        <button type="button" aria-label="增加 ${product.name}">+</button>
      </div>
    `;
    const [minus, plus] = row.querySelectorAll(".qty-tools button");
    minus.addEventListener("click", () => changeQty(key, -1));
    plus.addEventListener("click", () => changeQty(key, 1));
    row.querySelectorAll("[data-purchase-type]").forEach((button) => {
      button.addEventListener("click", () => addToCart(product.id, button.dataset.purchaseType));
    });
    cartItems.append(row);

    const detail = document.createElement("div");
    detail.className = "order-detail-item";
    const detailVisual = product.image
      ? `<img src="${product.image}" alt="" />`
      : `<span class="order-detail-mark" aria-hidden="true">${product.mark}</span>`;
    detail.innerHTML = `
      ${detailVisual}
      <div>
        <strong>${product.name}</strong>
        <span>${product.category}｜${unitPriceText} x ${quantityText}</span>
      </div>
      <em>剩 ${Math.max(product.stockQty - cartUsedUnits(product.id), 0)}${product.unitName}</em>
    `;
    orderDetailList.append(detail);
  });

  const totalRow = document.createElement("div");
  totalRow.className = "cart-total";
  totalRow.innerHTML = `
    <div>
      <span>商品品項：${itemCount} 項</span>
      <span>商品數量：${totalCount} 件</span>
      <span>目前金額：${amountText}</span>
      ${hasUnpriced ? '<small>⚠️ 本訂單含待定價商品，實際金額請以店家回覆為準。</small>' : ""}
    </div>
  `;
  cartItems.append(totalRow);

  if (checkoutTotal) {
    checkoutTotal.innerHTML = `
      <strong>訂單金額：${amountText}</strong>
      ${hasUnpriced ? "<small>⚠️ 實際金額請以店家確認報價為準。</small>" : ""}
    `;
  }
}

function openCart() {
  cartDrawer.classList.add("is-open");
  cartDrawer.setAttribute("aria-hidden", "false");
  if (state.cart.size > 0) {
    form.hidden = false;
    orderSuccess.hidden = true;
  }
}

function closeCart() {
  cartDrawer.classList.remove("is-open");
  cartDrawer.setAttribute("aria-hidden", "true");
}

function orderMessage(formData) {
  const { items, itemCount, totalCount, amountText, hasUnpriced } = cartSummary();
  const orderId = makeOrderId();
  const orderTime = formatOrderTime(new Date());
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const anomalies = orderAnomalies({ name, phone, address, items, hasUnpriced });
  const lines = [
    "【LAOS DAILY SHOP｜新訂單通知】",
    "",
    "🔴 待報價｜待聯繫",
    "",
    `訂單編號：#${orderId}`,
    `下單時間：${orderTime}`,
    `商品數量：${totalCount} 件`,
    `商品品項：${itemCount} 項`,
    "",
    "━━━━━━━━━━━━━━━━━━",
    "🛒 商品明細",
    "━━━━━━━━━━━━━━━━━━",
    "",
  ];
  items.forEach(({ product, purchaseType, qty, usedUnits, lineTotal }, index) => {
    const subtotal = lineTotal === null ? "請詢價" : formatMoney(lineTotal);
    const unitPrice =
      purchaseType === "case"
        ? isPriced(product.casePrice)
          ? `箱價 ${formatMoney(product.casePrice)}`
          : "整箱待定價"
        : isPriced(product.price)
          ? `單價 ${formatPrice(product)}`
          : "待定價";
    const quantityText =
      purchaseType === "case" ? `${qty}箱（${usedUnits}${product.unitName}）` : `${qty}${product.unitName}`;
    lines.push(`${index + 1}. ${product.name} × ${quantityText}`);
    lines.push(`   ${unitPrice}｜小計 ${subtotal}`);
    lines.push("");
  });
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push("👤 客戶資料");
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push(`姓名：${name}`);
  lines.push(`電話：${phone}`);
  lines.push(`地址：${address}`);
  lines.push(`備註：${note || "無"}`);
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push("💳 付款與配送");
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push("訂單金額：");
  lines.push("");
  lines.push(amountText);
  lines.push("");
  lines.push("付款方式：匯款／U 帳號");
  lines.push("付款狀態：⏳ 待付款");
  lines.push("配送狀態：⏳ 待安排");
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push("⚠️ 訂單異常提醒");
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push(anomalies.length ? anomalies.map((item) => `• ${item}`).join("\n") : "目前無訂單異常。");
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push("📋 下一步處理");
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push("□ 1. 聯繫客戶並補齊資料");
  lines.push("□ 2. 確認商品售價與訂單總額");
  lines.push("□ 3. 回覆客戶報價及付款資訊");
  lines.push("□ 4. 確認款項入帳");
  lines.push("□ 5. 安排出貨並提供物流單號");
  lines.push("");
  lines.push("目前進度：0／5");
  lines.push("");
  lines.push(`訂單編號：#${orderId}`);
  return lines.join("\n");
}

function makeOrderId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
  return `${date}-${time}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function formatOrderTime(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

function orderAnomalies({ name, phone, address, items, hasUnpriced }) {
  const anomalies = [];
  if (!name) anomalies.push("客戶姓名未填寫");
  if (!phone) {
    anomalies.push("電話未填寫");
  } else if (!/^\+?[0-9][0-9\s()\-]{6,}$/.test(phone)) {
    anomalies.push("電話格式異常");
  }
  if (!address) anomalies.push("地址未填寫");
  if (hasUnpriced) anomalies.push("商品尚未設定售價");
  items.forEach(({ product, usedUnits }) => {
    if (cartUsedUnits(product.id) > product.stockQty || usedUnits > product.stockQty) {
      anomalies.push(`${product.name} 商品庫存不足`);
    }
  });
  return anomalies;
}

function renderSuccessDetail(formData) {
  const { items, amountText } = cartSummary();
  const list = items
    .map(({ product, purchaseType, qty, usedUnits, lineTotal }) => {
      const quantityText =
        purchaseType === "case" ? `${qty}箱（${usedUnits}${product.unitName}）` : `${qty}${product.unitName}`;
      return `<li>${product.name} x ${quantityText}｜${lineTotal === null ? "請詢價" : formatMoney(lineTotal)}</li>`;
    })
    .join("");
  successDetail.innerHTML = `
    <div class="success-section">
      <strong>訂單詳情</strong>
      <ul>${list}</ul>
      <p>合計：${amountText}</p>
    </div>
    <div class="success-section">
      <strong>${config.payment?.title || "匯款 / U 帳號"}</strong>
      <p>${config.payment?.account || "請洽專人提供 U 帳號"}</p>
      <small>${config.payment?.note || "確認付款後安排出貨"}</small>
    </div>
    <div class="success-section">
      <strong>收件資料</strong>
      <p>${formData.get("name")}｜${formData.get("phone")}</p>
      <p>${formData.get("address")}</p>
    </div>
  `;
}

function applyPaymentConfig() {
  paymentTitle.textContent = config.payment?.title || "匯款 / U 帳號";
  paymentAccount.textContent = config.payment?.account || "請洽專人提供 U 帳號";
  paymentNote.textContent = config.payment?.note || "確認付款後安排出貨";
}

async function sendTelegramMessage(message) {
  const telegram = config.telegram || {};
  if (telegram.mode === "proxy" && telegram.orderEndpoint) {
    await fetch(telegram.orderEndpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        message,
      }),
    });
    return;
  }
  alert("訂單通知尚未設定完成，請聯絡店家。");
}

async function loadShopData() {
  try {
    const response = await fetch("./products.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Cannot load products.json");
    const data = await response.json();
    state.categories = data.categories || [];
    state.hotNames = data.hotProducts || [];
    state.products = (data.products || []).map(normalizeProduct);
    renderTabs();
    renderHotProducts();
    renderNewProducts();
    renderProducts();
    renderCart();
    const hashedCategory = categoryFromHash();
    if (hashedCategory) {
      setCategory(hashedCategory, { updateHash: false, scroll: true });
    } else {
      updateProductSectionAnchor();
    }
  } catch (error) {
    productGrid.innerHTML = "";
    emptyState.hidden = false;
    emptyState.textContent = "商品資料載入失敗，請檢查 products.json。";
  }
}

document.querySelector("[data-open-cart]").addEventListener("click", openCart);
document.querySelector("[data-close-cart]").addEventListener("click", closeCart);
cartDrawer.addEventListener("click", (event) => {
  if (event.target === cartDrawer) closeCart();
});

search.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  renderProducts();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.cart.size === 0) {
    alert("請先加入至少一項商品。");
    return;
  }
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "送出中...";
  try {
    const formData = new FormData(form);
    const message = orderMessage(formData);
    await sendTelegramMessage(message);
    renderSuccessDetail(formData);
    form.reset();
    form.hidden = true;
    orderSuccess.hidden = false;
    state.cart.clear();
    renderCart();
  } catch (error) {
    alert("訂單送出失敗，請稍後再試或直接聯絡店家。");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "送出訂單";
  }
});

document.querySelector("[data-success-close]").addEventListener("click", closeCart);

let lastTouchEnd = 0;

document.addEventListener(
  "touchend",
  function (event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  },
  { passive: false },
);

applyPaymentConfig();
loadShopData();

const config = window.SHOP_CONFIG || {
  currencyLabel: "₭",
  telegram: { mode: "proxy", orderEndpoint: "" },
};

const iconMap = {
  台灣泡麵補給: "麵",
  台灣經典飲料: "飲",
  台灣下飯料理: "飯",
  台灣日常用品: "用",
  台灣廚房補給: "廚",
  台灣人氣零食: "零",
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
const tabs = document.querySelector("[data-category-tabs]");
const search = document.querySelector("#product-search");
const emptyState = document.querySelector("[data-empty-state]");
const cartDrawer = document.querySelector("[data-cart-drawer]");
const cartItems = document.querySelector("[data-cart-items]");
const cartCount = document.querySelector("[data-cart-count]");
const form = document.querySelector("[data-order-form]");

function assetName(input) {
  return input.replace(/[／\s]+/g, "-").replace(/[\\/:*?"<>|]/g, "").toLowerCase();
}

function formatPrice(product) {
  if (typeof product.price === "number") {
    return `${config.currencyLabel || ""}${product.price.toLocaleString("zh-TW")}`;
  }
  return product.priceText || "請詢價";
}

function productTotal(product, qty) {
  return typeof product.price === "number" ? product.price * qty : null;
}

function normalizeProduct(product) {
  const category = state.categories.find((item) => item.name === product.category);
  return {
    ...product,
    id: `${product.category}-${product.name}`,
    tone: category?.tone || "#f0b95a",
    mark: iconMap[product.category] || "品",
    stock: product.stock || "現貨",
    image: product.image || `assets/products/${assetName(product.name)}.svg`,
    fallbackImage: product.fallbackImage || `${assetName(product.name)}.svg`,
  };
}

function productCard(product) {
  const card = document.createElement("article");
  const disabled = product.stock === "缺貨";
  card.className = "product-card";
  card.style.setProperty("--card-color", product.tone);
  card.innerHTML = `
    <div class="product-art">
      <img src="${product.image}" data-fallback="${product.fallbackImage}" alt="${product.name} 商品圖" loading="lazy" />
    </div>
    <div class="product-body">
      <p class="category-label">${product.category}</p>
      <h3>${product.name}</h3>
      <div class="product-meta">
        <strong>${formatPrice(product)}</strong>
        <span class="${disabled ? "stock-out" : ""}">${product.stock}</span>
      </div>
      <button class="add-button" type="button" ${disabled ? "disabled" : ""}>${disabled ? "暫時缺貨" : "加入購物車"}</button>
    </div>
  `;
  const image = card.querySelector("img");
  image.addEventListener(
    "error",
    () => {
      if (image.dataset.fallback && !image.src.endsWith(image.dataset.fallback)) {
        image.src = image.dataset.fallback;
      }
    },
    { once: true },
  );
  card.querySelector("button").addEventListener("click", () => addToCart(product.id));
  return card;
}

function renderTabs() {
  tabs.innerHTML = "";
  ["全部", ...state.categories.map((category) => category.name)].forEach((name) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab-button";
    button.textContent = name;
    button.addEventListener("click", () => {
      state.category = name;
      renderProducts();
      renderActiveTabs();
    });
    tabs.append(button);
  });
  renderActiveTabs();
}

function renderActiveTabs() {
  tabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.textContent === state.category);
  });
}

function filteredProducts() {
  return state.products.filter((product) => {
    const matchCategory = state.category === "全部" || product.category === state.category;
    const matchQuery =
      !state.query ||
      product.name.includes(state.query) ||
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
  state.hotNames
    .map((name) => state.products.find((product) => product.name === name))
    .filter(Boolean)
    .forEach((product) => hotList.append(productCard(product)));
}

function addToCart(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product || product.stock === "缺貨") return;
  state.cart.set(id, (state.cart.get(id) || 0) + 1);
  renderCart();
}

function changeQty(id, delta) {
  const next = (state.cart.get(id) || 0) + delta;
  if (next <= 0) {
    state.cart.delete(id);
  } else {
    state.cart.set(id, next);
  }
  renderCart();
}

function cartSummary() {
  const entries = [...state.cart.entries()];
  const pricedEntries = entries
    .map(([id, qty]) => {
      const product = state.products.find((item) => item.id === id);
      return productTotal(product, qty);
    })
    .filter((total) => total !== null);
  const allPriced = entries.length > 0 && pricedEntries.length === entries.length;
  const total = pricedEntries.reduce((sum, value) => sum + value, 0);
  return { entries, allPriced, total };
}

function renderCart() {
  cartItems.innerHTML = "";
  const { entries, allPriced, total } = cartSummary();
  const totalCount = entries.reduce((sum, [, qty]) => sum + qty, 0);
  cartCount.textContent = totalCount;

  if (!entries.length) {
    cartItems.innerHTML = '<p class="form-note">購物車目前是空的，先把想補貨的品項加進來。</p>';
    return;
  }

  entries.forEach(([id, qty]) => {
    const product = state.products.find((item) => item.id === id);
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <strong>${product.name}</strong>
        <p class="form-note">${product.category}｜${formatPrice(product)}</p>
      </div>
      <div class="qty-tools">
        <button type="button" aria-label="減少 ${product.name}">-</button>
        <span>${qty}</span>
        <button type="button" aria-label="增加 ${product.name}">+</button>
      </div>
    `;
    const [minus, plus] = row.querySelectorAll("button");
    minus.addEventListener("click", () => changeQty(id, -1));
    plus.addEventListener("click", () => changeQty(id, 1));
    cartItems.append(row);
  });

  const totalRow = document.createElement("div");
  totalRow.className = "cart-total";
  totalRow.innerHTML = `
    <span>商品小計</span>
    <strong>${allPriced ? `${config.currencyLabel || ""}${total.toLocaleString("zh-TW")}` : "依店家回覆為準"}</strong>
  `;
  cartItems.append(totalRow);
}

function openCart() {
  cartDrawer.classList.add("is-open");
  cartDrawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
  cartDrawer.classList.remove("is-open");
  cartDrawer.setAttribute("aria-hidden", "true");
}

function orderMessage(formData) {
  const { entries, allPriced, total } = cartSummary();
  const lines = ["老撾日常屋新訂單", "", "商品："];
  entries.forEach(([id, qty]) => {
    const product = state.products.find((item) => item.id === id);
    const lineTotal = productTotal(product, qty);
    const subtotal = lineTotal === null ? "請詢價" : `${config.currencyLabel || ""}${lineTotal.toLocaleString("zh-TW")}`;
    lines.push(`- ${product.name} x ${qty}｜${formatPrice(product)}｜小計 ${subtotal}`);
  });
  lines.push("");
  lines.push(`總計：${allPriced ? `${config.currencyLabel || ""}${total.toLocaleString("zh-TW")}` : "依店家回覆為準"}`);
  lines.push("");
  lines.push(`姓名：${formData.get("name")}`);
  lines.push(`電話：${formData.get("phone")}`);
  lines.push(`地址：${formData.get("address")}`);
  return lines.join("\n");
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
    alert("訂單已送出。");
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
    renderProducts();
    renderCart();
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
    const message = orderMessage(new FormData(form));
    await sendTelegramMessage(message);
    state.cart.clear();
    form.reset();
    renderCart();
    closeCart();
  } catch (error) {
    alert("訂單送出失敗，請稍後再試或直接聯絡店家。");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "送出 Telegram 訂單";
  }
});

loadShopData();

const categories = [
  {
    name: "台灣泡麵補給",
    tone: "#f0b95a",
    items: ["維力炸醬麵", "來一客", "統一肉燥麵", "一度讚", "大乾麵", "關廟麵"],
  },
  {
    name: "台灣經典飲料",
    tone: "#8fb8c8",
    items: ["麥仔茶", "御茶園", "麥香紅茶／奶茶／綠茶", "茶裏王", "伯朗咖啡", "津津蘆筍汁", "貝納頌", "左岸奶茶"],
  },
  {
    name: "台灣下飯料理",
    tone: "#df9279",
    items: ["麵筋", "脆瓜", "魚罐頭", "肉醬", "料理包", "筍子", "五星上醬"],
  },
  {
    name: "台灣日常用品",
    tone: "#a7bfa0",
    items: ["沐浴乳", "洗髮乳", "洗面乳"],
  },
  {
    name: "台灣廚房補給",
    tone: "#d9c06d",
    items: ["醬油膏", "沙茶醬", "豬油蔥醬", "雞粉", "高湯塊", "醬油", "維力炸醬", "胡椒粉", "胡椒鹽"],
  },
  {
    name: "台灣人氣零食",
    tone: "#c99ac0",
    items: ["卡拉姆久", "可樂果", "蚵仔煎洋芋片", "乖乖", "波卡", "七七乳加"],
  },
];

const iconMap = {
  台灣泡麵補給: "麵",
  台灣經典飲料: "飲",
  台灣下飯料理: "飯",
  台灣日常用品: "用",
  台灣廚房補給: "廚",
  台灣人氣零食: "零",
};

function assetName(input) {
  return input.replace(/[／\s]+/g, "-").replace(/[\\/:*?"<>|]/g, "").toLowerCase();
}

const products = categories.flatMap((category) =>
  category.items.map((name) => ({
    id: `${category.name}-${name}`,
    name,
    category: category.name,
    tone: category.tone,
    mark: iconMap[category.name],
    image: `./assets/products/${assetName(name)}.svg`,
  })),
);

const hotNames = ["維力炸醬麵", "麥香紅茶／奶茶／綠茶", "沙茶醬", "可樂果", "麵筋"];
const hotProducts = hotNames.map((name) => products.find((product) => product.name === name));

const state = {
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

function productCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";
  card.style.setProperty("--card-color", product.tone);
  card.innerHTML = `
    <div class="product-art">
      <img src="${product.image}" alt="${product.name} 商品圖" loading="lazy" />
    </div>
    <div class="product-body">
      <p class="category-label">${product.category}</p>
      <h3>${product.name}</h3>
      <button class="add-button" type="button">加入購物車</button>
    </div>
  `;
  card.querySelector("button").addEventListener("click", () => addToCart(product.id));
  return card;
}

function renderTabs() {
  ["全部", ...categories.map((category) => category.name)].forEach((name) => {
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
  return products.filter((product) => {
    const matchCategory = state.category === "全部" || product.category === state.category;
    const matchQuery =
      !state.query || product.name.includes(state.query) || product.category.includes(state.query);
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
  hotProducts.forEach((product) => hotList.append(productCard(product)));
}

function addToCart(id) {
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

function renderCart() {
  cartItems.innerHTML = "";
  const entries = [...state.cart.entries()];
  const totalCount = entries.reduce((sum, [, qty]) => sum + qty, 0);
  cartCount.textContent = totalCount;

  if (!entries.length) {
    cartItems.innerHTML = '<p class="form-note">購物車目前是空的，先把想補貨的品項加進來。</p>';
    return;
  }

  entries.forEach(([id, qty]) => {
    const product = products.find((item) => item.id === id);
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <strong>${product.name}</strong>
        <p class="form-note">${product.category}</p>
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
  const lines = ["老撾日常屋新訂單", "", "商品："];
  state.cart.forEach((qty, id) => {
    const product = products.find((item) => item.id === id);
    lines.push(`- ${product.name} x ${qty}`);
  });
  lines.push("", `姓名：${formData.get("name")}`);
  lines.push(`電話：${formData.get("phone")}`);
  lines.push(`地址：${formData.get("address")}`);
  return lines.join("\n");
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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.cart.size === 0) {
    alert("請先加入至少一項商品。");
    return;
  }
  const message = orderMessage(new FormData(form));
  window.open(`https://t.me/share/url?text=${encodeURIComponent(message)}`, "_blank");
});

renderTabs();
renderHotProducts();
renderProducts();
renderCart();

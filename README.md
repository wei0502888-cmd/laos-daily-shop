# 老撾日常屋｜商城網站

這是一個手機版優先、可直接部署到 GitHub Pages 的靜態商城網站。

## 功能

- 商品分類
- 商品搜尋
- 購物車
- 下單表單：姓名、電話、地址
- Telegram 訂單訊息產生
- 無金流、無會員系統

## 後台維護方式

目前網站使用 GitHub 當簡易後台：

- 商品資料：編輯 `products.json`
- Telegram 設定：編輯 `config.js`
- 首頁文字：編輯 `index.html`
- 顏色版面：編輯 `styles.css`
- 商品圖片：替換 `assets/products` 裡的同名圖片
- 訂單轉送後端：使用 `google-apps-script-order-proxy.gs`

`products.json` 裡每個商品可調整：

- `name`：商品名稱
- `category`：商品分類
- `price`：數字價格，例如 `25000`。如果填 `null`，網站會顯示 `priceText`
- `priceText`：未填價格時顯示的文字，例如 `請詢價`
- `stock`：庫存狀態，例如 `現貨`、`預購`、`缺貨`
- `image`：商品圖片路徑

## GitHub Pages 發佈方式

1. 將 `index.html`、`styles.css`、`script.js`、`config.js`、`products.json`、`assets` 和這份 `README.md` 推到 GitHub repository。
2. 到 repository 的 `Settings`。
3. 選擇 `Pages`。
4. 在 `Build and deployment` 中選擇 `Deploy from a branch`。
5. Branch 選 `main`，資料夾選 `/root`，儲存後等待 GitHub Pages 產生網址。

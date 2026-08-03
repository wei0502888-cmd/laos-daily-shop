const ORDER_SHEET_NAME = "Orders";
const ORDER_STATUSES = [
  "已收到訂單",
  "已確認接單",
  "備貨中",
  "配送中",
  "已完成",
  "已取消",
];
const STATUS_FLOW = {
  "已收到訂單": 0,
  "已確認接單": 1,
  "備貨中": 2,
  "配送中": 3,
  "已完成": 4,
  "已取消": 99,
};
const ORDER_HEADERS = [
  "orderId",
  "createdAt",
  "updatedAt",
  "status",
  "customerName",
  "phone",
  "address",
  "items",
  "totalAmount",
  "note",
  "telegramMessageId",
];

function doPost(e) {
  let payload = {};
  try {
    payload = parsePostPayload_(e);
    Logger.log("doPost payload type: " + Object.keys(payload).join(","));

    if (payload.callback_query) {
      Logger.log("收到 Telegram callback_query");
      return handleTelegramCallback_(payload);
    }

    if (payload.action === "createOrder" || payload.order) {
      return createOrder_(payload.order || payload);
    }

    if (payload.message) {
      const telegram = sendTelegramMessage_(String(payload.message), null);
      return jsonResponse_({ ok: true, telegram });
    }

    return jsonResponse_({ ok: false, error: "UNKNOWN_POST_ACTION" });
  } catch (error) {
    Logger.log("doPost error: " + error.stack);
    if (payload.callback_query?.id) {
      answerCallbackQuery_(payload.callback_query.id, "處理失敗，請稍後再試或檢查 Apps Script 執行記錄");
    }
    return jsonResponse_({ ok: false, error: String(error.message || error) });
  }
}

function doGet(e) {
  const params = e.parameter || {};

  if (params.action === "setup") {
    setupOrderSheet();
    return jsonOrJsonp_(params, { ok: true, message: "Order sheet is ready." });
  }

  if (params.action === "query") {
    const result = queryOrders_(params.orderId || "", params.phone || "");
    return jsonOrJsonp_(params, result);
  }

  if (params.action === "createOrder") {
    try {
      const order = JSON.parse(params.order || "{}");
      const result = createOrderData_(order);
      return jsonOrJsonp_(params, result);
    } catch (error) {
      Logger.log("doGet createOrder error: " + error.stack);
      return jsonOrJsonp_(params, { ok: false, error: String(error.message || error) });
    }
  }

  if (params.action === "setWebhook") {
    const result = setTelegramWebhook_(params.url || ScriptApp.getService().getUrl());
    return jsonOrJsonp_(params, result);
  }

  if (params.action === "getWebhookInfo") {
    return jsonOrJsonp_(params, getWebhookInfo());
  }

  return jsonOrJsonp_(params, {
    ok: true,
    service: "LAOS DAILY SHOP order status API",
    actions: ["setup", "query", "setWebhook"],
  });
}

function setupOrderSheet() {
  const sheet = getOrderSheet_();
  ensureHeaders_(sheet);
  sheet.setFrozenRows(1);
  sheet.getRange(1, ORDER_HEADERS.indexOf("orderId") + 1, sheet.getMaxRows(), 1).setNumberFormat("@");
  sheet.getRange(1, ORDER_HEADERS.indexOf("phone") + 1, sheet.getMaxRows(), 1).setNumberFormat("@");
  sheet.autoResizeColumns(1, ORDER_HEADERS.length);
}

function createOrder_(order) {
  return jsonResponse_(createOrderData_(order));
}

function createOrderData_(order) {
  setupOrderSheet();

  const now = new Date();
  const sheet = getOrderSheet_();
  const orderId = String(order.orderId || makeOrderId_()).trim();
  const status = ORDER_STATUSES[0];
  const items = normalizeItems_(order.items);
  const itemsJson = JSON.stringify(items);
  const totalAmount = order.totalAmount || order.amountText || "依店家回覆為準";
  const row = [
    orderId,
    order.createdAt || formatDate_(now),
    formatDate_(now),
    status,
    order.customerName || order.telegramName || order.name || "",
    order.phone || "",
    order.address || "",
    itemsJson,
    totalAmount,
    order.note || "",
    "",
  ];

  const existingRow = findOrderRow_(sheet, orderId);
  if (existingRow > 1) {
    sheet.getRange(existingRow, 1, 1, ORDER_HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  const message = buildAdminMessage_({ ...order, orderId, status, items, totalAmount });
  const telegram = sendTelegramMessage_(message, buildStatusKeyboard_(orderId));
  const messageId = telegram?.result?.message_id || "";
  if (messageId) {
    const targetRow = findOrderRow_(sheet, orderId);
    sheet.getRange(targetRow, ORDER_HEADERS.indexOf("telegramMessageId") + 1).setValue(messageId);
  }

  return {
    ok: true,
    orderId,
    status,
    telegramMessageId: messageId,
  };
}

function handleTelegramCallback_(update) {
  const query = update.callback_query;
  const data = String(query.data || "");
  Logger.log("callback data: " + data);
  const parts = data.split("|");
  if (parts[0] !== "status" || parts.length < 3) {
    answerCallbackQuery_(query.id, "無法辨識這個操作");
    return jsonResponse_({ ok: false, error: "INVALID_CALLBACK_DATA" });
  }

  const orderId = parts[1];
  const newStatus = parts.slice(2).join("|");
  Logger.log("callback orderId: " + orderId);
  Logger.log("callback newStatus: " + newStatus);
  if (!ORDER_STATUSES.includes(newStatus)) {
    answerCallbackQuery_(query.id, "未知狀態：" + newStatus);
    return jsonResponse_({ ok: false, error: "INVALID_STATUS" });
  }

  const sheet = getOrderSheet_();
  const row = findOrderRow_(sheet, orderId);
  if (row <= 1) {
    answerCallbackQuery_(query.id, "找不到訂單 " + orderId);
    return jsonResponse_({ ok: false, error: "ORDER_NOT_FOUND" });
  }

  const rowObject = rowToObject_(sheet, row);
  const currentStatus = rowObject.status || ORDER_STATUSES[0];
  const transition = validateStatusTransition_(currentStatus, newStatus);
  if (!transition.ok) {
    answerCallbackQuery_(query.id, transition.message);
    Logger.log("status transition blocked: " + transition.message);
    return jsonResponse_({ ok: false, error: "INVALID_STATUS_TRANSITION", message: transition.message });
  }

  const now = formatDate_(new Date());
  const statusCol = ORDER_HEADERS.indexOf("status") + 1;
  const updatedCol = ORDER_HEADERS.indexOf("updatedAt") + 1;
  sheet.getRange(row, statusCol).setValue(newStatus);
  sheet.getRange(row, updatedCol).setValue(now);

  answerCallbackQuery_(query.id, "訂單 " + orderId + " 狀態已更新為：" + newStatus);

  const updatedRowObject = rowToObject_(sheet, row);
  const items = parseItems_(updatedRowObject.items);
  const editedMessage = buildAdminMessage_({
    orderId,
    status: newStatus,
    customerName: updatedRowObject.customerName,
    phone: updatedRowObject.phone,
    address: updatedRowObject.address,
    items,
    totalAmount: updatedRowObject.totalAmount,
    note: updatedRowObject.note,
  });
  const editResult = editTelegramMessage_(query.message.chat.id, query.message.message_id, editedMessage, buildStatusKeyboard_(orderId));
  Logger.log("editMessageText result: " + JSON.stringify(editResult));

  return jsonResponse_({ ok: true, orderId, status: newStatus });
}

function queryOrders_(orderId, phone) {
  setupOrderSheet();
  const sheet = getOrderSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || ORDER_HEADERS;
  const id = normalizeText_(orderId);
  const normalizedPhone = normalizePhone_(phone);
  if (!id || !normalizedPhone) {
    return { ok: false, orders: [], error: "ORDER_ID_AND_PHONE_REQUIRED" };
  }

  const orders = values.slice(1)
    .map((row) => objectFromRow_(headers, row))
    .filter((order) => {
      const matchId = id && normalizeText_(order.orderId) === id;
      const matchPhone = phonesMatch_(order.phone, normalizedPhone);
      return matchId && matchPhone;
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 10)
    .map(safeOrderForCustomer_);

  return { ok: true, orders };
}

function getOrderSheet_() {
  const spreadsheetId = getScriptProperty_("SPREADSHEET_ID");
  const ss = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("請先設定 SPREADSHEET_ID，或把這份 Apps Script 綁定到 Google Sheet。");
  }
  return ss.getSheetByName(ORDER_SHEET_NAME) || ss.insertSheet(ORDER_SHEET_NAME);
}

function ensureHeaders_(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, ORDER_HEADERS.length).getValues()[0];
  const hasHeaders = ORDER_HEADERS.every((header, index) => firstRow[index] === header);
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS]);
  }
}

function findOrderRow_(sheet, orderId) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][0]) === String(orderId)) return i + 1;
  }
  return -1;
}

function rowToObject_(sheet, rowNumber) {
  const headers = sheet.getRange(1, 1, 1, ORDER_HEADERS.length).getValues()[0];
  const row = sheet.getRange(rowNumber, 1, 1, ORDER_HEADERS.length).getValues()[0];
  return objectFromRow_(headers, row);
}

function objectFromRow_(headers, row) {
  return headers.reduce((object, header, index) => {
    object[header] = row[index] instanceof Date ? formatDate_(row[index]) : row[index];
    return object;
  }, {});
}

function safeOrderForCustomer_(order) {
  return {
    orderId: order.orderId || "",
    createdAt: order.createdAt || "",
    updatedAt: order.updatedAt || "",
    status: order.status || ORDER_STATUSES[0],
    customerName: order.customerName || "",
    phone: order.phone || "",
    address: order.address || "",
    items: itemsToText_(parseItems_(order.items)),
    totalAmount: order.totalAmount || "依店家回覆為準",
    note: order.note || "",
  };
}

function buildAdminMessage_(order) {
  const items = normalizeItems_(order.items || order.itemsText);
  const itemsText = order.itemsText || itemsToText_(items);
  const amountText = order.totalAmount || order.amountText || "依店家回覆為準";
  const anomalyText = summarizeAnomalies_(order, items, itemsText);
  const status = order.status || ORDER_STATUSES[0];
  const statusLine = statusLine_(status);
  const note = String(order.note || "").trim();

  const lines = [
    "【LAOS DAILY SHOP｜新訂單】",
    "",
    "訂單編號：" + order.orderId,
    "訂單狀態：" + statusLine,
    "Telegram 名稱：" + (order.customerName || order.telegramName || order.name || ""),
    "電話：" + (order.phone || ""),
    "地址：" + (order.address || ""),
    "",
    "付款：匯款／U帳號｜待付款",
    "備註：" + (note || "無"),
    "",
    "訂單詳情：",
    pickingItemsToText_(items) || "無商品明細",
    "",
    "合計：" + amountText,
  ];

  if (anomalyText) {
    lines.push("");
    lines.push("異常：" + anomalyText);
  }

  lines.push("");
  lines.push("下一步：" + nextStepText_(status));
  return lines.join("\n");
}

function statusLine_(status) {
  const map = {
    "已收到訂單": "🔴 待確認",
    "已確認接單": "🟠 已確認接單",
    "備貨中": "🟡 備貨中",
    "配送中": "🔵 配送中",
    "已完成": "🟢 已完成",
    "已取消": "⚫ 已取消",
  };
  return map[status] || "🔴 待確認";
}

function nextStepText_(status) {
  const map = {
    "已收到訂單": "聯繫客戶 → 確認付款 → 安排出貨",
    "已確認接單": "確認付款 → 開始備貨",
    "備貨中": "完成備貨 → 安排配送",
    "配送中": "確認送達 → 完成訂單",
    "已完成": "訂單已完成",
    "已取消": "訂單已取消",
  };
  return map[status] || map["已收到訂單"];
}

function validateStatusTransition_(currentStatus, newStatus) {
  if (currentStatus === newStatus) {
    return { ok: false, message: "訂單目前已是此狀態" };
  }
  if (currentStatus === "已取消") {
    return { ok: false, message: "目前訂單狀態為：已取消，無法再變更狀態" };
  }
  if (currentStatus === "已完成") {
    return { ok: false, message: "目前訂單狀態為：已完成，無法再變更狀態" };
  }
  if (newStatus === "已取消") {
    return { ok: true };
  }
  if (STATUS_FLOW[newStatus] < STATUS_FLOW[currentStatus]) {
    return { ok: false, message: "目前訂單狀態為：" + currentStatus + "，無法改回" + newStatus };
  }
  return { ok: true };
}

function summarizeItemsForTelegram_(items, itemsText, itemCount, totalCount) {
  items = normalizeItems_(items);
  if (items && items.length) {
    const totalItems = Number(itemCount || items.length);
    const totalSales = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    if (items.length > 2) {
      return "共 " + totalItems + " 項／" + totalSales + " 組";
    }
    return items.map((item) => {
      const unitName = item.unitName || "件";
      const quantityText = item.purchaseType === "case"
        ? item.quantity + "箱（" + item.usedUnits + unitName + "）"
        : item.quantity + (item.saleUnit || unitName) + (item.usedUnits !== item.quantity ? "（" + item.usedUnits + unitName + "）" : "");
      return item.name + " × " + quantityText;
    }).join("、");
  }

  const lines = String(itemsText || "").split("\n").filter(Boolean);
  if (lines.length > 2) {
    return "共 " + lines.length + " 項";
  }
  return lines.map((line) => line.replace(/^\d+\.\s*/, "").replace(/｜.*$/, "")).join("、") || "無商品明細";
}

function summarizeAnomalies_(order, items, itemsText) {
  items = normalizeItems_(items);
  const source = Array.isArray(order.anomalies) ? order.anomalies.slice() : [];
  const name = String(order.customerName || order.telegramName || order.name || "").trim();
  const phone = String(order.phone || "").trim();
  const address = String(order.address || "").trim();

  if (!name) {
    source.push("Telegram 名稱未填");
  } else if (!isValidTelegramName_(name)) {
    source.push("Telegram 名稱格式異常");
  }
  if (!phone) {
    source.push("電話未填");
  } else if (!/^\+?[0-9][0-9\s()\-]{6,}$/.test(phone)) {
    source.push("電話格式異常");
  }
  if (!address) source.push("地址未填");

  const hasUnpriced = Boolean(order.hasUnpriced)
    || (items || []).some((item) => item.lineTotal === null || item.lineTotal === undefined || item.salePrice === null || item.salePrice === undefined || item.price === null || item.price === undefined)
    || /待定價|請詢價|依店家回覆為準/.test(String(itemsText || ""));
  if (hasUnpriced) source.push("商品待定價");

  return [...new Set(source.map(shortAnomaly_).filter(Boolean))].join("／");
}

function shortAnomaly_(text) {
  const value = String(text || "");
  if (!value) return "";
  if (value.includes("Telegram 名稱格式")) return "Telegram 名稱格式異常";
  if (value.includes("Telegram 名稱") || value.includes("姓名")) return "Telegram 名稱未填";
  if (value.includes("電話格式")) return "電話格式異常";
  if (value.includes("電話")) return "電話未填";
  if (value.includes("地址")) return "地址未填";
  if (value.includes("售價") || value.includes("待定價") || value.includes("請詢價")) return "商品待定價";
  if (value.includes("庫存")) return "商品庫存不足";
  return value;
}

function buildAdminMessageLegacy_(order) {
  const itemsText = order.itemsText || itemsToText_(order.items || []);
  return [
    "【LAOS DAILY SHOP｜新訂單通知】",
    "",
    "訂單編號：" + order.orderId,
    "目前狀態：" + (order.status || ORDER_STATUSES[0]),
    "",
    "👤 顧客資料",
    "Telegram 名稱：" + (order.customerName || order.telegramName || order.name || ""),
    "電話：" + (order.phone || ""),
    "地址：" + (order.address || ""),
    "",
    "🛒 商品明細",
    itemsText || "無商品明細",
    "",
    "💳 總金額",
    order.totalAmount || order.amountText || "依店家回覆為準",
    "",
    "備註：" + (order.note || "無"),
  ].join("\n");
}

function isValidTelegramName_(value) {
  return /^[\u3400-\u4DBF\u4E00-\u9FFFA-Za-z0-9@ ]+$/.test(String(value || "").trim());
}

function buildStatusKeyboard_(orderId) {
  const buttons = [
    ["接單", "已確認接單"],
    ["備貨中", "備貨中"],
    ["配送中", "配送中"],
    ["已完成", "已完成"],
    ["取消", "已取消"],
  ].map(([text, status]) => ({
    text,
    callback_data: "status|" + orderId + "|" + status,
  }));

  return {
    inline_keyboard: [
      buttons.slice(0, 2),
      buttons.slice(2, 4),
      buttons.slice(4),
    ],
  };
}

function sendTelegramMessage_(text, replyMarkup) {
  const token = getScriptProperty_("BOT_TOKEN");
  const chatId = getScriptProperty_("CHAT_ID");
  if (!token || !chatId) throw new Error("請設定 BOT_TOKEN 與 CHAT_ID。");

  const response = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
    }),
    muteHttpExceptions: true,
  });
  const result = JSON.parse(response.getContentText());
  if (!result.ok) Logger.log("sendMessage error: " + response.getContentText());
  return result;
}

function editTelegramMessage_(chatId, messageId, text, replyMarkup) {
  const token = getScriptProperty_("BOT_TOKEN");
  if (!token || !chatId || !messageId) return;
  const response = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/editMessageText", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: replyMarkup,
    }),
    muteHttpExceptions: true,
  });
  const result = JSON.parse(response.getContentText());
  if (!result.ok) Logger.log("editMessageText error: " + response.getContentText());
  return result;
}

function answerCallbackQuery_(callbackQueryId, text) {
  const token = getScriptProperty_("BOT_TOKEN");
  if (!token || !callbackQueryId) return;
  UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/answerCallbackQuery", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    }),
    muteHttpExceptions: true,
  });
}

function setTelegramWebhook_(webAppUrl) {
  const token = getScriptProperty_("BOT_TOKEN");
  if (!token) throw new Error("請先設定 BOT_TOKEN。");
  const response = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/setWebhook", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ url: webAppUrl }),
    muteHttpExceptions: true,
  });
  return JSON.parse(response.getContentText());
}

function testBotConnection() {
  const token = getScriptProperty_("BOT_TOKEN");
  if (!token) throw new Error("請先設定 BOT_TOKEN。");
  const response = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/getMe", {
    muteHttpExceptions: true,
  });
  const result = JSON.parse(response.getContentText());
  Logger.log("Bot connection: " + JSON.stringify(result));
  return result;
}

function getWebhookInfo() {
  const token = getScriptProperty_("BOT_TOKEN");
  if (!token) throw new Error("請先設定 BOT_TOKEN。");
  const response = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/getWebhookInfo", {
    muteHttpExceptions: true,
  });
  const result = JSON.parse(response.getContentText());
  Logger.log("Webhook info: " + JSON.stringify({
    ok: result.ok,
    url: result.result?.url,
    pending_update_count: result.result?.pending_update_count,
    last_error_date: result.result?.last_error_date,
    last_error_message: result.result?.last_error_message,
  }));
  return result;
}

function testTelegramMessage() {
  return sendTelegramMessage_("LAOS DAILY SHOP 測試訊息：Telegram 連線正常", null);
}

function testOrderSheet() {
  setupOrderSheet();
  const sheet = getOrderSheet_();
  const result = {
    ok: true,
    spreadsheetId: sheet.getParent().getId(),
    sheetName: sheet.getName(),
    columns: ORDER_HEADERS.length,
    rows: sheet.getLastRow(),
  };
  Logger.log("Order sheet test: " + JSON.stringify(result));
  return result;
}

function testFullOrderFlow() {
  const testOrder = {
    customerName: "測試客戶",
    phone: "0912345678",
    address: "測試地址",
    note: "Apps Script 測試訂單",
    items: [
      {
        name: "測試商品",
        category: "測試",
        purchaseType: "unit",
        quantity: 1,
        unitName: "件",
        usedUnits: 1,
        price: null,
        lineTotal: null,
        lineTotalText: "請詢價",
      },
    ],
    itemCount: 1,
    totalCount: 1,
    totalAmount: "依店家回覆為準",
    amountText: "依店家回覆為準",
    hasUnpriced: true,
    anomalies: ["商品待定價"],
  };
  const result = createOrder_(testOrder);
  Logger.log("Full order flow test result: " + result.getContent());
  return result.getContent();
}

function parsePostPayload_(e) {
  const raw = e?.postData?.contents || "";
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return { message: raw };
    }
  }
  return e?.parameter || {};
}

function parseItems_(items) {
  if (Array.isArray(items)) return items;
  const text = String(items || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return text.split("\n").filter(Boolean).map((line) => ({
      name: line.replace(/^\d+\.\s*/, "").replace(/｜.*$/, ""),
      quantity: 1,
      unitName: "件",
      saleUnit: "件",
      unitsPerSale: 1,
      usedUnits: 1,
      lineTotal: null,
      lineTotalText: "",
      legacyText: line,
    }));
  }
}

function normalizeItems_(items) {
  return parseItems_(items).map((item) => normalizeOrderItem_(item));
}

function normalizeOrderItem_(item) {
  const purchaseType = item.purchaseType || "unit";
  const quantity = Math.max(Number(item.quantity || 0), 0);
  const unitName = item.unitName || "件";
  const saleUnit = purchaseType === "case" ? "箱" : (item.saleUnit || unitName);
  const unitsPerSale = purchaseType === "case"
    ? Math.max(Number(item.caseQuantity || item.unitsPerSale || 0), 0)
    : Math.max(Number(item.unitsPerSale || 1), 1);
  const usedUnits = Math.max(Number(item.usedUnits || quantity * unitsPerSale), 0);
  const salePrice = item.salePrice !== undefined ? item.salePrice : item.price;
  const lineTotal = item.lineTotal === undefined ? null : item.lineTotal;
  return {
    barcode: item.barcode || "",
    rawName: item.rawName || item.name || "",
    displayName: item.displayName || item.name || "",
    name: item.name || item.displayName || item.rawName || "",
    category: item.category || "",
    packageType: item.packageType || "",
    specText: item.specText || "",
    purchaseType,
    quantity,
    saleUnit,
    unitsPerSale,
    usedUnits,
    unitName,
    caseQuantity: item.caseQuantity || null,
    casePrice: item.casePrice ?? null,
    baseUnitPrice: item.baseUnitPrice ?? null,
    salePrice: salePrice ?? null,
    price: item.price ?? salePrice ?? null,
    lineTotal,
    lineTotalText: item.lineTotalText || "",
    legacyText: item.legacyText || "",
  };
}

function pickingItemsToText_(items) {
  return normalizeItems_(items).map((item, index) => {
    if (item.legacyText) return item.legacyText;
    const subtotal = item.lineTotal === null || item.lineTotal === undefined
      ? "請詢價"
      : formatUsd_(item.lineTotal);
    const unitPrice = item.salePrice === null || item.salePrice === undefined
      ? "待定價"
      : formatUsd_(item.salePrice);
    const spec = item.specText || item.packageType || "一般商品";
    const saleUnit = item.purchaseType === "case" ? "箱" : (item.saleUnit || item.unitName || "件");
    return [
      (index + 1) + ". " + item.name,
      "   " + spec,
      "   數量：" + item.quantity + saleUnit,
      "   實際揀貨：" + item.usedUnits + (item.unitName || "件"),
      "   單價：" + unitPrice,
      "   小計：" + subtotal,
    ].join("\n");
  }).join("\n\n");
}

function itemsToText_(items) {
  const normalizedItems = normalizeItems_(items);
  return normalizedItems.map((item, index) => {
    if (item.legacyText) return item.legacyText;
    const subtotal = item.lineTotal === null || item.lineTotal === undefined
      ? "請詢價"
      : item.lineTotalText || formatUsd_(item.lineTotal);
    const unit = item.purchaseType === "case"
      ? item.quantity + "箱（" + item.usedUnits + (item.unitName || "件") + "）"
      : item.quantity + (item.saleUnit || item.unitName || "件") + (item.usedUnits !== item.quantity ? "（" + item.usedUnits + (item.unitName || "件") + "）" : "");
    return (index + 1) + ". " + item.name + " × " + unit + "｜" + subtotal;
  }).join("\n");
}

function formatUsd_(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value || "");
  return "USD " + number.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

function makeOrderId_() {
  const now = new Date();
  const date = Utilities.formatDate(now, "Asia/Taipei", "yyyyMMdd");
  const sheet = getOrderSheet_();
  const values = sheet.getDataRange().getValues();
  const todayPrefix = "LDS-" + date + "-";
  const count = values.filter((row) => String(row[0]).startsWith(todayPrefix)).length + 1;
  return todayPrefix + String(count).padStart(3, "0");
}

function formatDate_(date) {
  return Utilities.formatDate(new Date(date), "Asia/Taipei", "yyyy/MM/dd HH:mm:ss");
}

function normalizeText_(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizePhone_(value) {
  return String(value || "").replace(/\D/g, "");
}

function phonesMatch_(storedPhone, queryPhone) {
  const stored = normalizePhone_(storedPhone);
  const query = normalizePhone_(queryPhone);
  if (!stored || !query) return false;
  if (stored === query) return true;
  if (stored.replace(/^0+/, "") === query.replace(/^0+/, "")) return true;
  const minTailLength = 8;
  if (stored.length >= minTailLength && query.length >= minTailLength) {
    return stored.slice(-minTailLength) === query.slice(-minTailLength);
  }
  return false;
}

function getScriptProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonOrJsonp_(params, data) {
  const json = JSON.stringify(data);
  if (params.callback) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(params.callback)) {
      return jsonResponse_({ ok: false, error: "INVALID_CALLBACK" });
    }
    return ContentService
      .createTextOutput(params.callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonResponse_(data);
}

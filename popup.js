/**
 * popup.js — Poll Everywhere 題目偵測器 Popup
 * Discord Webhook URL 可直接在這裡輸入儲存，不需編輯任何程式碼。
 */

// ─── DOM 元素 ──────────────────────────────────────────────────────────────
const notifToggle      = document.getElementById("notifToggle");
const statusDot        = document.getElementById("statusDot");
const statusLabel      = document.getElementById("statusLabel");
const lastQuestionText = document.getElementById("lastQuestionText");
const pageStatusBadge  = document.getElementById("pageStatusBadge");
const refreshBtn       = document.getElementById("refreshBtn");
const clearBtn         = document.getElementById("clearBtn");
const webhookInput     = document.getElementById("webhookInput");
const saveWebhookBtn   = document.getElementById("saveWebhookBtn");
const testWebhookBtn   = document.getElementById("testWebhookBtn");
const webhookStatus    = document.getElementById("webhookStatus");

// ─── 工具 ──────────────────────────────────────────────────────────────────
function isPollEvUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname.endsWith("polleverywhere.com") || hostname.endsWith("pollev.com");
  } catch { return false; }
}

function updateToggleUI(enabled) {
  notifToggle.checked = enabled;
  statusDot.classList.toggle("off", !enabled);
  statusLabel.textContent = enabled ? "通知已啟用" : "通知已停用";
}

function updateLastQuestion(text) {
  if (text) {
    lastQuestionText.textContent = text;
    lastQuestionText.classList.remove("empty");
  } else {
    lastQuestionText.textContent = "尚未偵測到任何題目";
    lastQuestionText.classList.add("empty");
  }
}

function setWebhookStatus(msg, type = "info") {
  webhookStatus.textContent = msg;
  webhookStatus.className = "webhook-status " + type;
}

function isValidWebhookUrl(url) {
  return url && url.startsWith("https://discord.com/api/webhooks/");
}

// ─── 初始化 ────────────────────────────────────────────────────────────────
async function initPopup() {
  const data = await chrome.storage.local.get([
    "notificationsEnabled", "lastQuestion", "discordWebhookUrl"
  ]);

  updateToggleUI(data.notificationsEnabled !== false);
  updateLastQuestion(data.lastQuestion || null);

  // 顯示已儲存的 Webhook URL（遮蔽中段）
  if (data.discordWebhookUrl) {
    webhookInput.value = data.discordWebhookUrl;
    webhookInput.classList.add("success");
    setWebhookStatus("✅ Webhook 已設定", "ok");
  } else {
    setWebhookStatus("尚未設定 Webhook URL", "info");
  }

  // 頁面狀態
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && isPollEvUrl(tab.url)) {
    pageStatusBadge.textContent = "✅ 在 Poll Everywhere 頁面";
    pageStatusBadge.classList.add("active");
  } else {
    pageStatusBadge.textContent = "❌ 非 Poll Everywhere 頁面";
    pageStatusBadge.classList.remove("active");
  }
}

// ─── 事件：通知開關 ────────────────────────────────────────────────────────
notifToggle.addEventListener("change", async () => {
  const enabled = notifToggle.checked;
  await chrome.storage.local.set({ notificationsEnabled: enabled });
  updateToggleUI(enabled);
  const tabs = await chrome.tabs.query({ url: ["*://*.polleverywhere.com/*", "*://*.pollev.com/*"] });
  for (const tab of tabs) {
    try { await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_NOTIFICATIONS", enabled }); } catch {}
  }
});

// ─── 事件：儲存 Webhook URL ────────────────────────────────────────────────
saveWebhookBtn.addEventListener("click", async () => {
  const url = webhookInput.value.trim();

  if (!url) {
    // 清除設定
    await chrome.storage.local.remove("discordWebhookUrl");
    webhookInput.classList.remove("success", "error");
    setWebhookStatus("已清除 Webhook URL", "info");
    return;
  }

  if (!isValidWebhookUrl(url)) {
    webhookInput.classList.add("error");
    webhookInput.classList.remove("success");
    setWebhookStatus("❌ URL 格式不正確，須以 https://discord.com/api/webhooks/ 開頭", "err");
    return;
  }

  await chrome.storage.local.set({ discordWebhookUrl: url });
  webhookInput.classList.add("success");
  webhookInput.classList.remove("error");
  setWebhookStatus("✅ 已儲存！", "ok");
});

// ─── 事件：測試 Webhook ────────────────────────────────────────────────────
testWebhookBtn.addEventListener("click", async () => {
  const url = webhookInput.value.trim();

  if (!isValidWebhookUrl(url)) {
    setWebhookStatus("❌ 請先填入有效的 Webhook URL", "err");
    return;
  }

  testWebhookBtn.disabled = true;
  testWebhookBtn.textContent = "發送中…";
  setWebhookStatus("📡 正在發送測試訊息…", "info");

  try {
    const resp = await chrome.runtime.sendMessage({ type: "TEST_DISCORD", webhookUrl: url });
    if (resp?.ok) {
      setWebhookStatus("✅ 測試成功！請查看 Discord", "ok");
    } else {
      setWebhookStatus("❌ 發送失敗，請確認 Webhook URL 是否正確", "err");
    }
  } catch {
    setWebhookStatus("❌ 發生錯誤，請重試", "err");
  }

  testWebhookBtn.disabled = false;
  testWebhookBtn.textContent = "測試發送";
});

// ─── 事件：輸入欄變動時重置樣式 ───────────────────────────────────────────
webhookInput.addEventListener("input", () => {
  webhookInput.classList.remove("success", "error");
  setWebhookStatus("按「儲存」以套用設定", "info");
});

// ─── 事件：重新整理 ────────────────────────────────────────────────────────
refreshBtn.addEventListener("click", initPopup);

// ─── 事件：清除題目記錄 ────────────────────────────────────────────────────
clearBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("lastQuestion");
  updateLastQuestion(null);
  const tabs = await chrome.tabs.query({ url: ["*://*.polleverywhere.com/*", "*://*.pollev.com/*"] });
  for (const tab of tabs) {
    try { await chrome.tabs.sendMessage(tab.id, { type: "CLEAR_LAST_QUESTION" }); } catch {}
  }
  clearBtn.textContent = "✅ 已清除";
  setTimeout(() => { clearBtn.textContent = "🗑️ 清除記錄"; }, 1500);
});

// ─── 啟動 ──────────────────────────────────────────────────────────────────
initPopup();

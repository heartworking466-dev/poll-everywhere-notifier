/**
 * background.js — Poll Everywhere 題目偵測器 Service Worker (Manifest V3)
 *
 * Discord Webhook URL 從 chrome.storage.local 讀取，
 * 可在 Popup 視窗中設定，不需手動編輯此檔案。
 */

const NOTIFICATION_ID_PREFIX = "pollev-question-";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "NEW_QUESTION") {
    const questionText = message.questionText || "（無法取得題目文字）";
    console.log("[PollEv BG] 收到新題目：", questionText);
    sendDesktopNotification(questionText, sender.tab);
    chrome.storage.local.get("discordWebhookUrl", (data) => {
      sendDiscordNotification(questionText, data.discordWebhookUrl || "");
    });
    sendResponse({ received: true });
  }

  // 測試 Discord Webhook（從 Popup 觸發）
  if (message.type === "TEST_DISCORD") {
    sendDiscordNotification("✅ 這是測試訊息，Discord Webhook 設定成功！", message.webhookUrl)
      .then((ok) => sendResponse({ ok }));
    return true;
  }

  if (message.type === "SET_NOTIFICATIONS_ENABLED") {
    chrome.storage.local.set({ notificationsEnabled: message.enabled }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "CLEAR_LAST_QUESTION") {
    chrome.storage.local.remove("lastQuestion", () => {
      sendResponse({ success: true });
    });
    return true;
  }

  return true;
});

function sendDesktopNotification(questionText, tab) {
  const notificationId = NOTIFICATION_ID_PREFIX + Date.now();
  const displayText = questionText.length > 200
    ? questionText.substring(0, 197) + "..." : questionText;
  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "🗳️ Poll Everywhere — 新題目！",
    message: displayText,
    contextMessage: tab?.title ? `來源：${tab.title}` : "polleverywhere.com",
    priority: 2,
    requireInteraction: false,
  });
}

async function sendDiscordNotification(questionText, webhookUrl) {
  if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
    console.log("[PollEv BG] Discord Webhook URL 未設定，略過");
    return false;
  }
  const displayText = questionText.length > 1000
    ? questionText.substring(0, 997) + "..." : questionText;
  const payload = {
    username: "Poll Everywhere 偵測器",
    avatar_url: "https://www.polleverywhere.com/favicon.ico",
    embeds: [{
      title: "🗳️ 出現新題目！",
      description: displayText,
      color: 0x4f8ef7,
      footer: { text: "Poll Everywhere 題目偵測器 · " + new Date().toLocaleTimeString("zh-TW") },
    }],
  };
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) { console.log("[PollEv BG] Discord 通知發送成功"); return true; }
    else { console.error(`[PollEv BG] Discord 通知失敗 (${response.status})`); return false; }
  } catch (err) {
    console.error("[PollEv BG] Discord Webhook 錯誤：", err);
    return false;
  }
}

chrome.notifications.onClicked.addListener((notificationId) => {
  if (!notificationId.startsWith(NOTIFICATION_ID_PREFIX)) return;
  chrome.tabs.query(
    { url: ["*://*.polleverywhere.com/*", "*://*.pollev.com/*"] },
    (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      }
    }
  );
  chrome.notifications.clear(notificationId);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("notificationsEnabled", (data) => {
    if (data.notificationsEnabled === undefined) {
      chrome.storage.local.set({ notificationsEnabled: true });
    }
  });
});

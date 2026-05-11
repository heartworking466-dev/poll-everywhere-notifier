/**
 * content.js — Poll Everywhere 題目偵測器
 *
 * 此 content script 注入至所有 polleverywhere.com / pollev.com 頁面。
 * 使用 MutationObserver 監看 DOM 變化，當偵測到新題目文字時，
 * 透過 chrome.runtime.sendMessage 通知 background service worker 發送桌面通知。
 */

// ─── 常數設定 ────────────────────────────────────────────────────────────────

// 嘗試抓取題目的 CSS 選擇器清單（依優先順序）
const QUESTION_SELECTORS = [
  '[data-testid="prompt-title"]',       // Poll Everywhere 新版主要問題容器
  '.prompt-title',                       // 舊版 class
  '.poll-prompt',                        // 另一個常見 class
  '[class*="prompt"][class*="title"]',   // 模糊匹配含 prompt + title 的 class
  '[class*="question-text"]',            // 問題文字區塊
  'h1[class*="poll"]',                   // poll 相關 h1
  'h2[class*="poll"]',                   // poll 相關 h2
  '[role="heading"][aria-level="1"]',    // ARIA heading level 1
  '[role="heading"][aria-level="2"]',    // ARIA heading level 2
  'h1',                                  // 通用 h1（最後備用）
  'h2',                                  // 通用 h2（最後備用）
];

// 避免把導覽列、頁尾之類的標題誤認為題目
const IGNORE_TEXT_PATTERNS = [
  /^poll everywhere$/i,
  /^pollev$/i,
  /^home$/i,
  /^menu$/i,
  /^navigation$/i,
  /^loading/i,
];

// 輪詢間隔（毫秒）：MutationObserver 的補充保障，每 5 秒主動確認一次
const POLLING_INTERVAL_MS = 5000;

// ─── 狀態 ────────────────────────────────────────────────────────────────────

let lastQuestionText = null;   // 記憶上次題目（記憶體層），避免重啟前重複通知
let notificationsEnabled = true; // 是否啟用通知（從 storage 讀取）
let observer = null;           // MutationObserver 實例

// ─── 工具函式 ─────────────────────────────────────────────────────────────────

/**
 * 從頁面中嘗試抓取目前顯示的題目文字。
 * 依序嘗試多個選擇器，回傳第一個有意義的文字。
 * @returns {string|null} 題目文字，或 null（找不到）
 */
function extractQuestionText() {
  for (const selector of QUESTION_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.innerText?.trim() || el.textContent?.trim();
      if (!text || text.length < 3) continue;                 // 太短，跳過
      if (IGNORE_TEXT_PATTERNS.some((p) => p.test(text))) continue; // 黑名單，跳過
      if (text.length > 500) continue;                        // 太長可能是說明文，跳過
      return text;
    }
  }
  return null;
}

/**
 * 判斷是否為新題目，如果是就送出通知請求給 background.js。
 * 同時更新記憶體狀態與 chrome.storage.local。
 */
async function checkForNewQuestion() {
  // 先確認通知是否已被使用者關閉
  if (!notificationsEnabled) return;

  const currentText = extractQuestionText();
  if (!currentText) return; // 頁面上找不到題目，略過

  // 若與上次題目相同，不重複通知
  if (currentText === lastQuestionText) return;

  // 再比對 storage（跨 session 記憶）
  const stored = await chrome.storage.local.get("lastQuestion");
  if (stored.lastQuestion === currentText) {
    // storage 裡已有，更新記憶體同步狀態即可
    lastQuestionText = currentText;
    return;
  }

  // ✅ 確認是新題目！
  console.log("[PollEv Detector] 偵測到新題目：", currentText);

  // 更新記憶體與 storage
  lastQuestionText = currentText;
  await chrome.storage.local.set({ lastQuestion: currentText });

  // 送訊息給 background service worker 發送桌面通知
  chrome.runtime.sendMessage({
    type: "NEW_QUESTION",
    questionText: currentText,
  });
}

// ─── MutationObserver 設定 ───────────────────────────────────────────────────

/**
 * 啟動 MutationObserver，監看整個 document.body 的 DOM 子樹變化。
 * 每次 DOM 發生變化時，呼叫 checkForNewQuestion()。
 */
function startObserver() {
  if (observer) {
    observer.disconnect(); // 避免重複啟動
  }

  observer = new MutationObserver(() => {
    // DOM 有任何變動就檢查一次
    checkForNewQuestion();
  });

  // 監看 body 子樹的節點新增/移除與屬性變化
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true, // 也監聽文字節點內容變化（某些框架只改 textNode）
  });

  console.log("[PollEv Detector] MutationObserver 已啟動");
}

/**
 * 停止 MutationObserver。
 */
function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
    console.log("[PollEv Detector] MutationObserver 已停止");
  }
}

// ─── 初始化 ───────────────────────────────────────────────────────────────────

/**
 * 從 storage 讀取設定、啟動觀察器、以及設定定時補充輪詢。
 */
async function init() {
  // 讀取「通知開關」與「上次題目」
  const data = await chrome.storage.local.get(["notificationsEnabled", "lastQuestion"]);

  // 預設為啟用（若尚未設定過）
  notificationsEnabled = data.notificationsEnabled !== false;

  // 同步記憶體狀態
  lastQuestionText = data.lastQuestion || null;

  console.log(
    `[PollEv Detector] 初始化完成｜通知：${notificationsEnabled ? "開啟" : "關閉"}｜上次題目：${lastQuestionText || "（無）"}`
  );

  if (notificationsEnabled) {
    startObserver();
    // 立即檢查一次（頁面可能已有題目）
    await checkForNewQuestion();
  }

  // 定時補充輪詢：某些 SPA 框架的 DOM 異動不會觸發 MutationObserver
  setInterval(() => {
    if (notificationsEnabled) checkForNewQuestion();
  }, POLLING_INTERVAL_MS);
}

// ─── 監聽來自 popup 的訊息 ────────────────────────────────────────────────────

/**
 * 接收來自 popup.js 的控制指令。
 * - "TOGGLE_NOTIFICATIONS"：切換通知開關，並更新 observer 狀態
 * - "GET_STATUS"：回傳目前狀態給 popup
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "TOGGLE_NOTIFICATIONS") {
    notificationsEnabled = message.enabled;

    if (notificationsEnabled) {
      startObserver();
    } else {
      stopObserver();
    }

    sendResponse({ success: true });
  }

  if (message.type === "GET_STATUS") {
    sendResponse({
      notificationsEnabled,
      lastQuestion: lastQuestionText,
    });
  }

  // 回傳 true 以支援非同步 sendResponse（若需要）
  return true;
});

// ─── 啟動 ────────────────────────────────────────────────────────────────────
init();

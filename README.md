# 🗳️ Poll Everywhere 題目偵測器 — Chrome Extension

自動偵測 Poll Everywhere 頁面出現的新題目，並發送 Chrome 桌面通知。

---

## 📁 檔案結構

```
pollev-notifier/
├── manifest.json      # Extension 設定（Manifest V3）
├── content.js         # 注入頁面的 DOM 偵測腳本
├── background.js      # Service Worker（發送通知）
├── popup.html         # 點擊工具列圖示的彈出視窗
├── popup.js           # 彈出視窗邏輯
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🚀 安裝步驟（載入 Unpacked Extension）

1. 開啟 Chrome，在網址列輸入：
   ```
   chrome://extensions
   ```

2. 開啟右上角的「**開發人員模式**」（Developer mode）切換開關。

3. 點選左上角「**載入未封裝項目**」（Load unpacked）按鈕。

4. 選擇本資料夾（`pollev-notifier/`），點選「**選取資料夾**」。

5. Extension 應出現在清單中，名稱為「Poll Everywhere 題目偵測器」。

6. 在 Chrome 網址列點選 ➕ 圖示將 Extension 固定到工具列（方便開關）。

---

## 🔔 如何使用

1. 開啟 [polleverywhere.com](https://www.polleverywhere.com) 或 [pollev.com](https://pollev.com) 的參與者頁面並登入。

2. Extension 自動在背景偵測頁面題目變化。

3. 當偵測到**新題目**時，桌面右下角會出現通知：
   - 標題：「🗳️ Poll Everywhere — 新題目！」
   - 內容：題目文字

4. 點擊工具列的 Extension 圖示可：
   - **開啟/關閉通知**（Toggle 開關）
   - 查看上次偵測到的題目
   - 清除上次題目記錄（讓相同題目重新觸發通知）

---

## ⚙️ 運作原理

| 元件 | 功能 |
|------|------|
| `content.js` | 注入 polleverywhere.com，使用 MutationObserver 監看 DOM 變化，嘗試多個 CSS 選擇器抓取題目文字 |
| `background.js` | Service Worker，接收 content.js 的訊息，調用 `chrome.notifications` 發送桌面通知 |
| `popup.js` | 讀寫 `chrome.storage.local`，控制開關與狀態顯示 |

### 防重複通知機制

- 使用 `chrome.storage.local` 儲存上次題目，跨分頁、跨 session 都不重複通知。
- 記憶體層也保留上次題目，避免短時間內重複觸發。

---

## ❗ 注意事項

- 需要授予「**通知**」權限（首次使用時 Chrome 會詢問）。
- 僅在您已登入並能看到題目的頁面上運作，**不繞過任何驗證**。
- 若題目使用非標準 HTML 結構，可能需要在 `content.js` 的 `QUESTION_SELECTORS` 陣列加入對應的 CSS 選擇器。

---

## 🛠️ 自訂選擇器

若偵測不到題目，請在瀏覽器 DevTools（F12）→ Elements 找到題目的 HTML 元素，
複製其 class 或 data attribute，加入 `content.js` 頂部的 `QUESTION_SELECTORS` 陣列：

```js
const QUESTION_SELECTORS = [
  '.your-custom-class',   // ← 在這裡加入
  '[data-testid="prompt-title"]',
  // ...
];
```

重新載入 Extension（chrome://extensions → 重新整理圖示）即可生效。

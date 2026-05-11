# 🗳️ Poll Everywhere Question Detector — Chrome Extension

Automatically detects new questions on Poll Everywhere pages and sends Chrome desktop notifications.

---

## 📁 Project Structure

pollev-notifier/
├── manifest.json      # Extension configuration (Manifest V3)
├── content.js         # DOM detection script injected into pages
├── background.js      # Service Worker (handles notifications)
├── popup.html         # Popup UI when clicking extension icon
├── popup.js           # Popup logic
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png


---

## 🚀 Installation (Load Unpacked Extension)

1. Open Chrome and go to:

chrome://extensions


2. Enable **Developer mode** (toggle in the top-right corner).

3. Click **Load unpacked** (top-left button).

4. Select the project folder (`pollev-notifier/`) and click **Select Folder**.

5. The extension should appear as:
**“Poll Everywhere Question Detector”**

6. Pin it to the Chrome toolbar for easy access.

---

## 🔔 How to Use

1. Open a Poll Everywhere participant page:
- https://www.polleverywhere.com  
- https://pollev.com  

and log in.

2. The extension will automatically monitor the page in the background.

3. When a **new question is detected**, a desktop notification appears:
- Title: 🗳️ Poll Everywhere — New Question!
- Content: question text

4. Click the extension icon to:
- Toggle notifications ON/OFF
- View last detected question
- Clear saved history (allowing repeat triggers)

---

## ⚙️ How It Works

| Component | Function |
|----------|----------|
| `content.js` | Injected into Poll Everywhere pages. Uses `MutationObserver` to detect DOM changes and extract question text via CSS selectors |
| `background.js` | Service worker that receives messages and triggers Chrome notifications |
| `popup.js` | Manages UI state using `chrome.storage.local` |

---

## 🔁 Duplicate Prevention

- Stores last detected question in `chrome.storage.local`
- Prevents repeated notifications across tabs and sessions
- Uses in-memory cache for rapid duplicate filtering

---

## ❗ Important Notes

- Requires **notification permission** (Chrome will prompt)
- Only works on pages where you are logged in and can already see questions
- Does **not bypass authentication or access restrictions**
- If detection fails, update selectors in `content.js`

---

## 🛠️ Custom Selectors

If questions are not detected:

1. Open DevTools (F12) → Elements
2. Find the question text element
3. Copy its class or data attribute
4. Add it to `QUESTION_SELECTORS` in `content.js`:

```js
const QUESTION_SELECTORS = [
'.your-custom-class',
'[data-testid="prompt-title"]',
];
Reload extension at:
chrome://extensions → Refresh

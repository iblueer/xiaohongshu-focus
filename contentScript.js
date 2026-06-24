/**
 * contentScript.js  / Unified Content Script
 *
 * Update Strategy:
 * - 在 document_start 时立即注入 CSS，避免内容闪现
 * - At document_start, inject CSS immediately to prevent content flash
 * - CSS 比 JS DOM 操作更早生效，内容从一开始就被隐藏
 * - CSS takes effect earlier than JS DOM manipulation, content is hidden from the start
 */

'use strict';

// ========== 第一步：立即注入初始CSS（防闪现）==========
// Step 1: Immediately inject initial CSS (prevent flash)
// 这段代码在脚本加载时立即执行，不等待任何东西
// This code executes immediately when script loads, doesn't wait for anything

(function injectInitialCSS() {
  const path = window.location.pathname;

  // 判断是否是需要隐藏Feed的页面 / Check if this page needs Feed hidden
  const isHomePage = path === '/' || path === '/explore' || path.startsWith('/explore?');
  const isExcluded = path.includes('/search_result') || path.startsWith('/user') || /^\/explore\/[0-9a-fA-F]{16,}/.test(path);
  const needsHideFeed = isHomePage && !isExcluded;

  if (needsHideFeed) {
    // 创建样式元素 / Create style element
    const style = document.createElement('style');
    style.id = 'xhs-blocker-initial-style';
    style.textContent = `
      /* 立即隐藏Feed - 防止闪现 / Immediately hide Feed - prevent flash */
      .feeds-container,
      .reds-sticky-box,
      .channel-container {
        display: none !important;
      }
    `;

    // 尽可能早地插入样式 / Insert style as early as possible
    const target = document.head || document.documentElement;
    if (target) {
      target.appendChild(style);
    }

    console.log('[Xiaohongshu Focus] 初始隐藏CSS已注入 / Initial hiding CSS injected');
  }
})();


// ========== 配置 / Configuration ==========

const DEFAULT_SETTINGS = {
  hideFeed: true,               // 主页推荐内容隐藏 / Hide feed
  hideSearchSuggest: true,      // 「猜你想搜」隐藏 / Hide search suggestions
  hideNotificationBadge: true,  // 通知小红点隐藏 / Hide notification badge
  hideNotificationEntry: false, // 通知入口隐藏 / Hide notification button
  hideImages: false             // 页面图片隐藏 / Hide all images
};

// 样式元素的ID / Style element IDs
const STYLE_IDS = {
  feed: 'xhs-blocker-feed-style',
  searchSuggest: 'xhs-blocker-search-suggest-style',
  notificationBadge: 'xhs-blocker-notification-badge-style',
  notificationEntry: 'xhs-blocker-notification-entry-style',
  images: 'xhs-blocker-image-style',
  homeFocus: 'xhs-blocker-home-focus-style'
};

// ========== 全局状态 / Global State ==========

let currentSettings = { ...DEFAULT_SETTINGS };
let lastURL = window.location.href;


// ========== 工具函数 / Utility Functions ==========

/**
 * 判断当前页面是否需要隐藏Feed / Check if current page needs Feed hidden
 */
function shouldHideFeed() {
  const path = window.location.pathname;

  // 排除页面 / Excluded pages
  if (path.includes('/search_result')) return false;
  if (path.startsWith('/user')) return false;
  if (/^\/explore\/[0-9a-fA-F]{16,}/.test(path)) return false;

  // 需要隐藏的页面 / Pages that need hiding
  if (path === '/' || path === '/explore' || path.startsWith('/explore?')) return true;

  return false;
}

/**
 * 注入或移除CSS样式 / Inject or remove CSS style
 * @param {string} id - 样式元素ID
 * @param {string} css - CSS内容
 * @param {boolean} shouldInject - 是否注入
 */
function manageStyle(id, css, shouldInject) {
  let style = document.getElementById(id);

  if (shouldInject) {
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
      console.log(`[Xiaohongshu Focus] 样式已注入 / Style injected: ${id}`);
    }
  } else {
    if (style) {
      style.remove();
      console.log(`[Xiaohongshu Focus] 样式已移除 / Style removed: ${id}`);
    }
  }
}


// ========== 五个功能的处理函数 / Five Feature Handlers ==========

/**
 * 1. Feed流隐藏 / Feed Hiding
 */
function handleFeedVisibility() {
  // 移除初始样式 / Remove initial style
  const initialStyle = document.getElementById('xhs-blocker-initial-style');
  if (initialStyle) initialStyle.remove();

  const shouldHide = currentSettings.hideFeed && shouldHideFeed();

  const css = `
    .feeds-container,
    .reds-sticky-box,
    .channel-container {
      display: none !important;
    }
  `;

  manageStyle(STYLE_IDS.feed, css, shouldHide);
}

/**
 * 2. "猜你想搜"隐藏 / Search Suggestions Hiding
 * 选择器：.sug-box 是猜你想搜的容器
 * Selector: .sug-box is the container for search suggestions
 */
function handleSearchSuggestVisibility() {
  const shouldHide = currentSettings.hideSearchSuggest;

  const css = `
    /* 猜你想搜容器 / Search suggestions container */
    .sug-box {
      display: none !important;
    }
  `;

  manageStyle(STYLE_IDS.searchSuggest, css, shouldHide);
}

/**
 * 3. 通知小红点隐藏 / Notification Badge Hiding
 * 选择器：.count 是显示未读数量的徽章
 * Selector: .count is the badge showing unread count
 * 只隐藏数字，不影响图标 / Only hide the count, not the icon
 */
function handleNotificationBadgeVisibility() {
  const shouldHide = currentSettings.hideNotificationBadge;

  const css = `
    /* 通知数字徽章隐藏 / Notification count badge hiding */
    .badge-container .count,
    .count {
      display: none !important;
    }
  `;

  manageStyle(STYLE_IDS.notificationBadge, css, shouldHide);
}

/**
 * 4. 通知入口隐藏 / Notification Entry Hiding
 * 选择器：a[href="/notification"] 是通知入口链接
 * Selector: a[href="/notification"] is the notification entry link
 * 使用 visibility 保持占位，避免布局跳动
 * Use visibility to maintain space, avoid layout shift
 */
function handleNotificationEntryVisibility() {
  const shouldHide = currentSettings.hideNotificationEntry;

  const css = `
    /* 通知入口隐藏 - 保持占位 / Notification entry hiding - maintain space */
    a[href="/notification"],
    a[title="通知"] {
      visibility: hidden !important;
      pointer-events: none !important;
    }
  `;

  manageStyle(STYLE_IDS.notificationEntry, css, shouldHide);
}

/**
 * 5. 图片屏蔽 / Image Blocking
 */
function handleImageVisibility() {
  const shouldHide = currentSettings.hideImages;

  const css = `
    img,
    video,
    [class*="cover"]:not(.cover-container),
    [style*="background-image"] {
      visibility: hidden !important;
    }
  `;

  manageStyle(STYLE_IDS.images, css, shouldHide);
}


/**
 * 6. 首页专注搜索布局 / Homepage Focus Search Layout
 */
function handleHomeFocusLayout() {
  const shouldActive = currentSettings.hideFeed && shouldHideFeed();

  // 注入/移出自定义CSS / Inject/remove custom CSS
  const css = `
    /* 首页专注模式自定义样式 / Homepage focus mode custom style */
    .xhs-focus-main-container {
      position: relative !important;
      height: 100vh !important;
      overflow: hidden !important;
    }

    .xhs-focus-centered-search-panel {
      position: absolute;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      max-width: 620px;
      padding: 0 24px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      animation: xhs-fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 10;
    }

    @keyframes xhs-fade-in {
      from {
        opacity: 0;
        transform: translate(-50%, calc(-50% + 15px));
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%);
      }
    }

    .xhs-focus-logo-container {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 28px;
      user-select: none;
    }

    .xhs-focus-logo-text {
      font-size: 48px;
      font-weight: 800;
      letter-spacing: 1px;
      background: linear-gradient(135deg, #ff2442 0%, #ff527b 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 2px 6px rgba(255, 36, 66, 0.12));
    }

    .xhs-focus-logo-badge {
      font-size: 11px;
      font-weight: 600;
      color: #ff2442;
      background: rgba(255, 36, 66, 0.08);
      padding: 2px 8px;
      border-radius: 12px;
      margin-left: 10px;
      border: 1px solid rgba(255, 36, 66, 0.15);
      letter-spacing: 0.5px;
      align-self: flex-start;
      margin-top: 8px;
    }

    .xhs-focus-search-bar-container {
      display: flex;
      align-items: center;
      width: 100%;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 36, 66, 0.12);
      border-radius: 30px;
      padding: 5px 5px 5px 18px;
      box-sizing: border-box;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(255, 36, 66, 0.02);
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    }

    .xhs-focus-search-bar-container:hover {
      border-color: rgba(255, 36, 66, 0.3);
      box-shadow: 0 12px 36px rgba(255, 36, 66, 0.06), 0 4px 12px rgba(0, 0, 0, 0.03);
    }

    .xhs-focus-search-bar-container:focus-within {
      border-color: rgba(255, 36, 66, 0.6);
      box-shadow: 0 15px 45px rgba(255, 36, 66, 0.12), 0 4px 16px rgba(255, 36, 66, 0.04);
      transform: translateY(-2px);
      background: #ffffff;
    }

    .xhs-focus-search-input-wrapper {
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 0;
    }

    .xhs-focus-search-icon {
      color: #8c8c8c;
      margin-right: 12px;
      flex-shrink: 0;
      transition: color 0.3s;
    }

    .xhs-focus-search-bar-container:focus-within .xhs-focus-search-icon {
      color: #ff2442;
    }

    .xhs-focus-custom-search-input {
      width: 100%;
      border: none;
      outline: none;
      background: transparent;
      font-size: 16px;
      font-weight: 400;
      color: #262626;
      line-height: 24px;
      padding: 8px 0;
      caret-color: #ff2442;
    }

    .xhs-focus-custom-search-input::placeholder {
      color: #bfbfbf;
    }

    .xhs-focus-clear-btn {
      border: none;
      background: transparent;
      color: #bfbfbf;
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
      margin-right: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;
      user-select: none;
    }

    .xhs-focus-clear-btn:hover {
      color: #595959;
      background: rgba(0, 0, 0, 0.05);
    }

    .xhs-focus-search-submit-btn {
      background: linear-gradient(135deg, #ff2442 0%, #ff527b 100%);
      color: #ffffff;
      border: none;
      border-radius: 24px;
      padding: 9px 24px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(255, 36, 66, 0.25);
      transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
      letter-spacing: 1px;
      flex-shrink: 0;
    }

    .xhs-focus-search-submit-btn:hover {
      box-shadow: 0 6px 18px rgba(255, 36, 66, 0.35);
      filter: brightness(1.05);
      transform: scale(1.02);
    }

    .xhs-focus-search-submit-btn:active {
      transform: scale(0.97);
    }

    /* Dark Mode Styles */
    @media (prefers-color-scheme: dark) {
      .xhs-focus-search-bar-container {
        background: rgba(38, 38, 38, 0.85);
        border-color: rgba(255, 255, 255, 0.1);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
      }
      .xhs-focus-search-bar-container:hover {
        border-color: rgba(255, 36, 66, 0.4);
      }
      .xhs-focus-search-bar-container:focus-within {
        background: #262626;
        border-color: rgba(255, 36, 66, 0.7);
        box-shadow: 0 15px 45px rgba(0, 0, 0, 0.35), 0 4px 16px rgba(255, 36, 66, 0.15);
      }
      .xhs-focus-custom-search-input {
        color: #f5f5f5;
      }
      .xhs-focus-custom-search-input::placeholder {
        color: #595959;
      }
      .xhs-focus-search-icon {
        color: #595959;
      }
    }
  `;

  manageStyle(STYLE_IDS.homeFocus, css, shouldActive);

  // 辅助函数：控制原顶部搜索栏的显示与隐藏
  function toggleOriginalHeader(show) {
    const originalInput = document.getElementById('search-input');
    if (!originalInput) return;

    let current = originalInput.parentElement;
    let searchContainer = null;
    for (let i = 0; i < 4; i++) {
      if (!current) break;
      const className = current.className || '';
      if (typeof className === 'string' && (className.includes('search') || className.includes('input-box'))) {
        searchContainer = current;
      }
      current = current.parentElement;
    }

    const target = searchContainer || originalInput.parentElement;
    if (target) {
      if (show) {
        target.style.removeProperty('display');
      } else {
        target.style.setProperty('display', 'none', 'important');
      }
    }
  }

  // 辅助函数：获取主面板容器
  function getMainContainer() {
    const feed = document.querySelector('.feeds-container') || 
                 document.querySelector('.channel-container') ||
                 document.querySelector('.explore-container');
    if (feed && feed.parentElement) {
      return feed.parentElement;
    }
    const mainContent = document.querySelector('.main-content') || 
                        document.querySelector('#app') ||
                        document.querySelector('#global');
    return mainContent;
  }

  if (shouldActive) {
    // 隐藏顶部原有搜索栏
    toggleOriginalHeader(false);

    // 检查并注入居中搜索栏
    let panel = document.getElementById('xhs-focus-centered-search-panel');
    const container = getMainContainer();

    if (container) {
      // 移除旧容器的类名，避免样式残留
      const oldContainers = document.querySelectorAll('.xhs-focus-main-container');
      oldContainers.forEach(el => {
        if (el !== container) {
          el.classList.remove('xhs-focus-main-container');
        }
      });
      container.classList.add('xhs-focus-main-container');
    }

    if (container) {
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'xhs-focus-centered-search-panel';
        panel.className = 'xhs-focus-centered-search-panel';
        panel.innerHTML = `
          <div class="xhs-focus-logo-container">
            <span class="xhs-focus-logo-text">小红书</span>
            <span class="xhs-focus-logo-badge">专注版</span>
          </div>
          <div class="xhs-focus-search-bar-container">
            <div class="xhs-focus-search-input-wrapper">
              <svg class="xhs-focus-search-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input type="text" id="xhs-focus-custom-search-input" class="xhs-focus-custom-search-input" placeholder="搜索小红书" autocomplete="off">
              <button id="xhs-focus-clear-btn" class="xhs-focus-clear-btn" style="display: none;">&times;</button>
            </div>
            <button id="xhs-focus-search-submit-btn" class="xhs-focus-search-submit-btn">搜索</button>
          </div>
        `;

        container.appendChild(panel);

        const customInput = panel.querySelector('#xhs-focus-custom-search-input');
        const clearBtn = panel.querySelector('#xhs-focus-clear-btn');
        const submitBtn = panel.querySelector('#xhs-focus-search-submit-btn');

        // 执行搜索的共享函数
        const runSearch = () => {
          const query = customInput.value.trim();
          if (!query) return;

          const originalInput = document.getElementById('search-input');
          if (originalInput) {
            originalInput.value = query;
            originalInput.dispatchEvent(new Event('input', { bubbles: true }));
            originalInput.dispatchEvent(new Event('change', { bubbles: true }));

            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            originalInput.dispatchEvent(enterEvent);
          }

          // 150ms 备用降级方案，防止 React 事件失效
          setTimeout(() => {
            if (!window.location.pathname.includes('/search_result')) {
              window.location.href = `/search_result?keyword=${encodeURIComponent(query)}`;
            }
          }, 150);
        };

        // 绑定事件
        customInput.addEventListener('input', () => {
          clearBtn.style.display = customInput.value ? 'flex' : 'none';
        });

        customInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            runSearch();
          }
        });

        clearBtn.addEventListener('click', () => {
          customInput.value = '';
          clearBtn.style.display = 'none';
          customInput.focus();
        });

        submitBtn.addEventListener('click', runSearch);

        // 自动聚焦
        setTimeout(() => customInput.focus(), 50);
      } else if (panel.parentElement !== container) {
        // 如果容器发生变化，将搜索面板移动至新容器中
        container.appendChild(panel);
      }
    }
  } else {
    // 恢复顶部搜索栏并移除自定义面板
    toggleOriginalHeader(true);
    const panel = document.getElementById('xhs-focus-centered-search-panel');
    if (panel) {
      panel.remove();
    }
    const container = getMainContainer();
    if (container) {
      container.classList.remove('xhs-focus-main-container');
    }
    const oldContainers = document.querySelectorAll('.xhs-focus-main-container');
    oldContainers.forEach(el => el.classList.remove('xhs-focus-main-container'));
  }
}

// 全局键盘快捷键：按下 '/' 且未聚焦到输入框时，聚焦到自定义搜索框或原始搜索框
function setupGlobalKeyboardShortcut() {
  document.addEventListener('keydown', (e) => {
    // 只有当用户没有聚焦在任何输入框或可编辑元素中时才触发
    const activeEl = document.activeElement;
    if (activeEl && (['INPUT', 'TEXTAREA'].includes(activeEl.tagName) || activeEl.isContentEditable)) {
      return;
    }

    if (e.key === '/') {
      const customInput = document.getElementById('xhs-focus-custom-search-input');
      if (customInput) {
        e.preventDefault();
        customInput.focus();
      } else {
        const originalInput = document.getElementById('search-input');
        if (originalInput && originalInput.offsetWidth > 0) { // 确保元素可见
          e.preventDefault();
          originalInput.focus();
        }
      }
    }
  });
}

// ========== 主控制函数 / Main Control Functions ==========

/**
 * 应用所有设置 / Apply all settings
 */
function applyAllSettings() {
  console.log('[Xiaohongshu Focus] 应用设置 / Applying settings:', currentSettings);
  console.log('[Xiaohongshu Focus] 当前路径 / Current path:', window.location.pathname);

  handleFeedVisibility();
  handleSearchSuggestVisibility();
  handleNotificationBadgeVisibility();
  handleNotificationEntryVisibility();
  handleImageVisibility();
  handleHomeFocusLayout();
}

/**
 * 处理URL变化 / Handle URL change
 */
function handleURLChange() {
  const currentURL = window.location.href;
  if (currentURL !== lastURL) {
    console.log(`[Xiaohongshu Focus] URL变化 / URL changed`);
    lastURL = currentURL;
    applyAllSettings();
  }
}


// ========== 设置和事件监听 / Settings & Event Listeners ==========

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      if (chrome.runtime.lastError) {
        console.error('[Xiao hong shu] 加载设置失败 / Failed to load settings');
        resolve(DEFAULT_SETTINGS);
        return;
      }
      currentSettings = { ...result };
      console.log('[Xiaohongshu Focus] 设置已加载 / Settings loaded:', currentSettings);
      resolve(currentSettings);
    });
  });
}

function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (key in currentSettings) {
        currentSettings[key] = newValue;
      }
    }
    applyAllSettings();
  });
}

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'SETTING_CHANGED') {
      if (message.key in currentSettings) {
        currentSettings[message.key] = message.value;
      }
      applyAllSettings();
      sendResponse({ success: true });
    }
    return true;
  });
}

function setupURLListeners() {
  // 监听浏览器前进/后退 / Listen for browser back/forward
  window.addEventListener('popstate', handleURLChange);

  // 劫持 pushState / Hijack pushState
  const originalPushState = history.pushState;
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    handleURLChange();
  };

  // 劫持 replaceState / Hijack replaceState
  const originalReplaceState = history.replaceState;
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    handleURLChange();
  };

  // 备用方案：定时检测URL变化（每500ms）
  // Fallback: periodic URL check (every 500ms)
  // 某些SPA框架可能绕过pushState，这个保证不会漏掉
  // Some SPA frameworks may bypass pushState, this ensures nothing is missed
  setInterval(handleURLChange, 500);
}


// ========== 初始化 / Initialization ==========

async function initialize() {
  console.log('[Xiaohongshu Focus] =====================================');
  console.log('[Xiaohongshu Focus] 脚本初始化 / Initializing');
  console.log('[Xiaohongshu Focus] URL:', window.location.href);
  console.log('[Xiaohongshu Focus] =====================================');

  await loadSettings();

  setupStorageListener();
  setupMessageListener();
  setupURLListeners();
  setupGlobalKeyboardShortcut();

  // 根据页面加载状态应用设置 / Apply settings based on page load state
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAllSettings);
  } else {
    applyAllSettings();
  }

  // 页面完全加载后再应用一次 / Apply again after full load
  window.addEventListener('load', () => setTimeout(applyAllSettings, 100));
}

initialize();

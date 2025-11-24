// ========== NGA 楼中楼脚本 v2.2.0（重构版）==========
import ConfigManager from './storage/config.js';
import StorageManager from './storage/storage-manager.js';
import PageLoader from './core/page-loader.js';
import ScrollLoader from './core/scroll-loader.js';
import ConfigPanel from './ui/config-panel.js';
import Toast from './ui/toast.js';
import type { PageInfo } from './types/index.js';

console.log('[NGA 楼中楼] 脚本启动 v2.2.0');

// ========== 工具函数 ==========

/**
 * 从 URL 提取 tid
 * @returns {string|null}
 */
function extractTid(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  const tidFromParam = urlParams.get('tid');

  if (tidFromParam) {
    console.log('[TID 提取] 从 URL 参数获取 tid:', tidFromParam);
    return tidFromParam;
  }

  const match = window.location.href.match(/[?&]tid=(\d+)/);
  if (match) {
    console.log('[TID 提取] 从 URL 匹配获取 tid:', match[1]);
    return match[1];
  }

  console.warn('[TID 提取] 未能提取 tid');
  return null;
}

/**
 * 解析页面信息
 * @returns {PageInfo}
 */
function parsePageInfo(): PageInfo {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    let totalPages = 1;
    let currentPage = parseInt(urlParams.get('page') || '1');

    const links = document.querySelectorAll('#pagebtop a, #pagebbtm a');
    links.forEach((link) => {
      const text = link.textContent?.trim();
      const num = parseInt(text || '');
      if (!isNaN(num)) totalPages = Math.max(totalPages, num);
    });

    const lastPageLink = document.querySelector(
      '#pagebtop a[title*="最后页"], #pagebbtm a[title*="最后页"]'
    );
    if (lastPageLink) {
      const match = (lastPageLink as HTMLAnchorElement).href.match(/page=(\d+)/);
      if (match) {
        const lastPage = parseInt(match[1]);
        if (lastPage > totalPages) totalPages = lastPage;
      }
    }

    console.log('[页面解析] 当前页:', currentPage, '总页数:', totalPages);
    return { totalPages, currentPage };
  } catch (e) {
    console.error('[页面解析] 解析失败:', e);
    return { totalPages: 1, currentPage: 1 };
  }
}

/**
 * 展开所有折叠内容
 * @param {HTMLElement} container
 */
function expandAllCollapses(container: HTMLElement): void {
  try {
    const buttons = container.querySelectorAll(
      'button[name="collapseSwitchButton"]'
    ) as NodeListOf<HTMLButtonElement>;
    console.log('[自动展开] 找到', buttons.length, '个折叠按钮');

    let expanded = 0;
    buttons.forEach((button) => {
      try {
        if (button.textContent === '+') {
          button.click();
          button.textContent = '-';
          expanded++;
        }
      } catch (e) {
        console.warn('[自动展开] 按钮点击失败:', e);
        const collapseDiv = button.parentNode?.nextSibling as HTMLElement;
        if (
          collapseDiv &&
          collapseDiv.classList.contains('collapse') &&
          (collapseDiv.style.display === 'none' || !collapseDiv.style.display)
        ) {
          collapseDiv.style.display = 'block';
          button.textContent = '-';
          expanded++;
        }
      }
    });

    console.log('[自动展开] 完成展开', expanded, '个折叠');
  } catch (e) {
    console.error('[自动展开] 展开折叠失败:', e);
  }
}

// ========== 进度条管理 ==========

let progressBar: HTMLElement | null = null;
let progressLine2: HTMLElement | null = null;
let isProgressLoading = true;

function createProgressBar(): void {
  progressBar = document.createElement('div');
  progressBar.id = 'nga-progress-bar';
  progressBar.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 30px;
        background: rgba(0,0,0,0.85);
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 13px;
        z-index: 9999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: all 0.3s ease;
        max-width: 350px;
        min-width: 50px;
    `;

  const compactIcon = document.createElement('div');
  compactIcon.id = 'progress-compact';
  compactIcon.innerHTML = '📊';
  compactIcon.style.cssText = 'display: none; font-size: 20px;';

  const expandedContent = document.createElement('div');
  expandedContent.id = 'progress-expanded';
  expandedContent.style.cssText = 'display: block;';

  const line1 = document.createElement('div');
  line1.textContent = '楼中楼加载中';
  line1.style.cssText = 'font-weight: bold; margin-bottom: 4px;';

  progressLine2 = document.createElement('div');
  progressLine2.textContent = '正在初始化...';
  progressLine2.style.cssText = 'font-size: 12px; margin-bottom: 2px;';

  const progressLine3 = document.createElement('div');
  progressLine3.id = 'progress-detail';
  progressLine3.style.cssText =
    'font-size: 11px; color: #d1d5db; display: none;';

  expandedContent.appendChild(line1);
  expandedContent.appendChild(progressLine2);
  expandedContent.appendChild(progressLine3);

  progressBar.appendChild(compactIcon);
  progressBar.appendChild(expandedContent);
  document.body.appendChild(progressBar);

  progressBar.addEventListener('mouseenter', () => {
    if (!progressBar) return;
    progressBar.style.maxWidth = '350px';
    const compactIcon = document.getElementById('progress-compact');
    const expandedContent = document.getElementById('progress-expanded');
    if (compactIcon) compactIcon.style.display = 'none';
    if (expandedContent) expandedContent.style.display = 'block';
  });

  progressBar.addEventListener('mouseleave', () => {
    if (!progressBar || isProgressLoading) return;
    progressBar.style.maxWidth = '50px';
    const compactIcon = document.getElementById('progress-compact');
    const expandedContent = document.getElementById('progress-expanded');
    if (compactIcon) compactIcon.style.display = 'block';
    if (expandedContent) expandedContent.style.display = 'none';
  });

  progressBar.addEventListener('click', () => {
    if (window.configPanel) {
      window.configPanel.togglePanel();
    }
  });
}

function updateProgressLine2(text: string): void {
  if (progressLine2) {
    progressLine2.textContent = text;
    isProgressLoading = !text.includes('完成') && !text.includes('错误');
  }
}

function updateProgressDetail(loaded: number, total: number, cached: number = 0): void {
  const detailDiv = document.getElementById('progress-detail');
  if (detailDiv) {
    detailDiv.style.display = 'block';
    detailDiv.textContent = `已加载: ${loaded} 页 | 总页数: ${total} | 已缓存: ${cached} 页`;
  }
}

// ========== Loader 页面处理 ==========

/**
 * 自动点击跳转链接
 */
function autoClickJump(): void {
  try {
    if (document.body.innerHTML.includes('访客不能直接访问')) {
      if (window.g) {
        window.g();
        return;
      }
      const link = document.querySelector('a[onclick="g()"]') as HTMLAnchorElement;
      if (link) {
        link.click();
        setTimeout(extractPosts, 2000);
        return;
      }
      setAntiBotCookie();
      return;
    }
    extractPosts();
  } catch (e) {
    console.error('[Loader] autoClickJump 错误:', e);
  }
}

/**
 * 设置反机器人 Cookie
 */
function setAntiBotCookie(): void {
  try {
    const now = Date.now();
    document.cookie = `guestJs=${Math.floor(now / 1000)}_9c1cuj;domain=bbs.nga.cn;path=/;max-age=1800`;
    document.cookie = `lastpath=0;domain=bbs.nga.cn;path=/;max-age=0`;
    const url = new URL(window.location.href);
    url.searchParams.set('rand', Math.floor(Math.random() * 1000).toString());
    setTimeout(() => window.location.replace(url.toString()), 300);
  } catch (e) {
    console.error('[Loader] setAntiBotCookie 错误:', e);
  }
}

/**
 * 提取帖子内容
 */
function extractPosts(): void {
  try {
    const page = new URLSearchParams(window.location.search).get('page') || '1';
    const container = document.getElementById('m_posts_c');
    if (container) {
      expandAllCollapses(container);
      GM_setValue(`POSTS_${page}`, container.innerHTML);
      console.log('[Loader] 子页', page, '数据写入 GM_setValue');
      setTimeout(() => window.close(), 500);
    } else {
      console.warn('[Loader] 子页', page, '未找到 m_posts_c，稍后重试');
      setTimeout(extractPosts, 1000);
    }
  } catch (e) {
    console.error('[Loader] extractPosts 错误:', e);
  }
}

// ========== 主程序初始化 ==========

async function initializeApp(): Promise<void> {
  try {
    // 检测运行环境
    const urlParams = new URLSearchParams(window.location.search);
    const isLoaderTab = urlParams.get('loader') === '1';
    const tid = extractTid();

    console.log('[初始化] tid:', tid, 'isLoaderTab:', isLoaderTab);

    // Loader 页面处理
    if (isLoaderTab) {
      setTimeout(autoClickJump, 2000);
      return;
    }

    // 主页面处理
    if (!tid) {
      console.warn('[初始化] 未找到 tid，脚本退出');
      return;
    }

    // 初始化存储层
    const storageManager = new StorageManager();
    await storageManager.initialize();

    // 初始化配置管理
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    console.log('[初始化] 配置加载完成:', config);

    // 创建进度条
    createProgressBar();

    // 展开当前页面的折叠内容
    const container = document.getElementById('m_posts_c');
    if (container) {
      expandAllCollapses(container);
    }

    // 解析页面信息
    const pageInfo = parsePageInfo();
    updateProgressLine2(
      `正在加载：第 ${pageInfo.currentPage} 页 / 共 ${pageInfo.totalPages} 页`
    );

    // 初始化配置面板（延迟创建）
    setTimeout(() => {
      try {
        window.configPanel = new ConfigPanel(configManager, storageManager);
        console.log('[配置面板] 已初始化');
      } catch (e) {
        console.error('[配置面板] 初始化失败:', e);
      }
    }, 3000);

    // 注册菜单命令
    try {
      GM_registerMenuCommand('⚙️ 打开设置', () => {
        if (window.configPanel) {
          window.configPanel.togglePanel();
        }
      });
    } catch (e) {
      console.warn('[菜单] 注册失败:', e);
    }

    // 延迟启动加载器（给页面足够的初始化时间）
    setTimeout(async () => {
      try {
        // 创建页面加载器
        const pageLoader = new PageLoader(
          tid,
          storageManager,
          config,
          (message: string, loaded: number, total: number) => {
            updateProgressLine2(message);
            updateProgressDetail(loaded, total);
          }
        );

        // 初始化加载
        await pageLoader.initialize(pageInfo, container);

        // 初始化滚动加载器
        setTimeout(() => {
          const scrollLoader = new ScrollLoader(pageLoader, config);
          scrollLoader.initialize(pageInfo.totalPages);
        }, 2000);
      } catch (e) {
        console.error('[初始化] 加载器启动失败:', e);
        Toast.error('楼中楼加载失败');
      }
    }, 8000);
  } catch (e) {
    console.error('[初始化] 主程序初始化失败:', e);
  }
}

// ========== 启动脚本 ==========

if (document.readyState === 'loading') {
  console.log('[启动] 页面加载中，等待 DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  console.log('[启动] 页面已加载，直接执行');
  initializeApp();
}
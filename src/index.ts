// ========== NGA 楼中楼脚本 v2.2.0（重构版）==========
import ConfigManager from './storage/config.js';
import StorageManager from './storage/storage-manager.js';
import PageLoader from './core/page-loader.js';
import ScrollLoader from './core/scroll-loader.js';
import ConfigPanel from './ui/config-panel.js';
import Toast from './ui/toast.js';
import { extractTid, parsePageInfo } from './utils/helpers.js';
import { expandAllCollapses } from './utils/dom-utils.js';
import {
  createProgressBar,
  updateProgressLine2,
  updateProgressDetail
} from './utils/progress-utils.js';
import { autoClickJump } from './utils/loader-utils.js';
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
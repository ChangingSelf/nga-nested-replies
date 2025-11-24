// ========== 滚动加载管理器 ==========

import { debounce } from '../utils/performance.js';
import type { AppConfig } from '../types/index.js';
import PageLoader from './page-loader.js';

// 类型声明
interface ThreadMeta {
  totalPages: number;
  cachedPages: number[];
}

/**
 * 滚动加载管理器
 * 监听滚动事件，触发懒加载更多内容
 */
class ScrollLoader {
  private pageLoader: PageLoader;
  private config: AppConfig;
  private isLoadingMore = false;
  private allPagesLoaded = false;
  private scrollHandler: ((() => void) & { cancel: () => void }) | null = null;
  private totalPages = 0;
  private threshold = 2; // 距底部2个屏幕高度触发

  constructor(pageLoader: PageLoader, config: AppConfig) {
    this.pageLoader = pageLoader;
    this.config = config;
  }

  /**
   * 初始化滚动监听
   */
  initialize(totalPages: number): void {
    this.totalPages = totalPages;

    // 创建防抖的滚动处理函数
    this.scrollHandler = debounce(() => {
      this.handleScroll();
    }, 200) as ((() => void) & { cancel: () => void });

    window.addEventListener('scroll', this.scrollHandler);
    console.log('[ScrollLoader] 已初始化滚动加载');
  }

  /**
   * 处理滚动事件
   */
  private handleScroll(): void {
    if (this.isLoadingMore || this.allPagesLoaded) {
      return;
    }

    if (this.checkLoadMore()) {
      console.log('[ScrollLoader] 触发加载更多');
      void this.triggerLoadMore();
    }
  }

  /**
   * 检查是否需要加载更多
   */
  private checkLoadMore(): boolean {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const clientHeight = document.documentElement.clientHeight;
    const scrollHeight = document.documentElement.scrollHeight;

    const threshold = clientHeight * this.threshold;

    return scrollTop + clientHeight >= scrollHeight - threshold;
  }

  /**
   * 触发加载更多
   */
  private async triggerLoadMore(): Promise<void> {
    const tid = this.pageLoader.getThreadId();
    if (!tid) {
      return;
    }

    this.isLoadingMore = true;
    this.showLoadingIndicator();

    try {
      const meta = await this.pageLoader.getStorageManager().getThreadMeta(
        tid
      ) as ThreadMeta | null;

      if (!meta) {
        this.isLoadingMore = false;
        this.hideLoadingIndicator();
        return;
      }

      const container = document.getElementById('m_posts_c');
      if (!container) {
        this.isLoadingMore = false;
        this.hideLoadingIndicator();
        return;
      }

      const loadedPages = this.pageLoader.getLoadedPages();
      const currentMaxPage = loadedPages.size > 0 ? Math.max(...loadedPages) : 0;
      const nextPageStart = currentMaxPage + 1;
      const loadCount = this.config.initialLoadPages || 5;
      const nextPageEnd = Math.min(
        nextPageStart + loadCount - 1,
        meta.totalPages
      );

      if (nextPageStart > meta.totalPages) {
        this.allPagesLoaded = true;
        this.isLoadingMore = false;
        this.showLoadComplete();
        return;
      }

      console.log(`[ScrollLoader] 加载第 ${nextPageStart}-${nextPageEnd} 页`);

      // 加载页面范围
      await this.loadPagesRange(
        nextPageStart,
        nextPageEnd,
        meta.totalPages,
        container
      );
    } catch (e) {
      console.error('[ScrollLoader] 加载更多失败:', e);
    } finally {
      this.isLoadingMore = false;
      this.hideLoadingIndicator();
    }
  }

  /**
   * 加载页面范围
   */
  private async loadPagesRange(
    startPage: number,
    endPage: number,
    totalPages: number,
    container: HTMLElement
  ): Promise<void> {
    const tid = this.pageLoader.getThreadId();
    // 注意：这里需要访问 PageLoader 的私有方法，在实际项目中需要重构为公共方法
    // 为简化起见，我们暂时假设这些方法是可访问的

    for (let page = startPage; page <= endPage; page++) {
      const loadedPages = this.pageLoader.getLoadedPages();
      if (loadedPages.has(page)) continue;

      try {
        const html = await this.pageLoader.loadSinglePagePublic(page);
        if (html) {
          this.pageLoader.appendPostsPublic(html, page, container);
          loadedPages.add(page);

          // 保存到缓存
          await this.pageLoader.getStorageManager().savePageContent(
            this.pageLoader.getThreadId(),
            page,
            html
          );

          const meta = await this.pageLoader.getStorageManager().getThreadMeta(
            tid
          ) as ThreadMeta | null;

          if (meta && meta.cachedPages && !meta.cachedPages.includes(page)) {
            const { tid, ...metaWithoutTid } = meta as any;
            await this.pageLoader.getStorageManager().saveThreadMeta(
              tid,
              {
                ...metaWithoutTid,
                cachedPages: [...meta.cachedPages, page]
              }
            );
          }
        }
      } catch (e) {
        console.error(`[ScrollLoader] 加载第 ${page} 页失败:`, e);
      }
    }

    // 重新渲染
    await this.pageLoader.parseAndRenderPublic(container);

    // 继续预加载
    if (endPage < totalPages) {
      const preloadStart = endPage + 1;
      const preloadEnd = Math.min(
        preloadStart + (this.config.preloadPages || 10) - 1,
        totalPages
      );

      if (preloadStart <= totalPages) {
        setTimeout(() => {
          void this.loadPagesRange(preloadStart, preloadEnd, totalPages, container);
        }, 1000);
      }
    }
  }

  /**
   * 显示加载指示器
   */
  private showLoadingIndicator(): void {
    let indicator = document.getElementById('nga-loading-more');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'nga-loading-more';
      indicator.style.cssText = `
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 14px;
                z-index: 9998;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            `;
      indicator.textContent = '正在加载更多内容...';
      document.body.appendChild(indicator);
    }
    (indicator as HTMLElement).style.display = 'block';
  }

  /**
   * 隐藏加载指示器
   */
  private hideLoadingIndicator(): void {
    const indicator = document.getElementById('nga-loading-more');
    if (indicator) {
      (indicator as HTMLElement).style.display = 'none';
    }
  }

  /**
   * 显示加载完成
   */
  private showLoadComplete(): void {
    const indicator = document.getElementById('nga-loading-more') as HTMLElement;
    if (indicator) {
      indicator.textContent = '已加载全部内容';
      indicator.style.background = 'rgba(16,185,129,0.9)';
      setTimeout(() => {
        indicator.style.display = 'none';
      }, 3000);
    }

    // 移除滚动监听
    this.destroy();
  }

  /**
   * 销毁滚动监听器
   */
  destroy(): void {
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
      console.log('[ScrollLoader] 已移除监听器');
    }
  }

  /**
   * 获取加载状态
   */
  getLoadingState(): {
    isLoadingMore: boolean;
    allPagesLoaded: boolean;
    totalPages: number;
  } {
    return {
      isLoadingMore: this.isLoadingMore,
      allPagesLoaded: this.allPagesLoaded,
      totalPages: this.totalPages
    };
  }
}

export default ScrollLoader;
// ========== 页面加载器 ==========

import { measure } from '../utils/performance.js';
import type { PageInfo, AppConfig, ProgressCallback } from '../types/index.js';
import StorageManager from '../storage/storage-manager.js';
import ThreadParser from './thread-parser.js';
import ThreadRenderer from './thread-renderer.js';
import VirtualRenderer from './virtual-renderer.js';

/**
 * 线程元数据接口
 */
interface ThreadMeta {
  tid: string;
  title?: string;
  totalPages?: number;
  cachedPages?: number[];
  lastAccess: number;
  cacheTime: number;
}

/**
 * 页面加载器
 * 管理多页面加载策略、缓存读取、后台预加载
 */
class PageLoader {
  private tid: string;
  private storageManager: StorageManager;
  private config: AppConfig;
  private progressCallback: ProgressCallback;
  private loadedPages = new Set<number>();
  private parser: ThreadParser;
  private renderer: ThreadRenderer | VirtualRenderer;
  private isFirstConversion = true;

  constructor(
    tid: string,
    storageManager: StorageManager,
    config: AppConfig,
    progressCallback: ProgressCallback
  ) {
    this.tid = tid;
    this.storageManager = storageManager;
    this.config = config;
    this.progressCallback = progressCallback;
    this.parser = new ThreadParser(config);

    // 根据配置选择渲染器（虚拟滚动或普通渲染）
    const useVirtualScroll = config.useVirtualScroll !== false; // 默认开启
    this.renderer = useVirtualScroll
      ? new VirtualRenderer(config, storageManager)
      : new ThreadRenderer(config, storageManager);

    console.log(
      `[PageLoader] 使用${useVirtualScroll ? '虚拟滚动' : '普通'}渲染器`
    );
  }

  /**
   * 初始化加载器
   */
  async initialize(pageInfo: PageInfo, container: HTMLElement | null): Promise<void> {
    return await measure('PageLoader.initialize', async () => {
      console.log('[PageLoader] 初始化，tid:', this.tid, 'pageInfo:', pageInfo);

      // 检查缓存
      const meta = await this.storageManager.getThreadMeta(this.tid);

      if (meta && this.isCacheValid(meta)) {
        console.log('[PageLoader] 命中缓存，从缓存加载');
        await this.loadFromCache(meta, pageInfo, container);
      } else {
        console.log('[PageLoader] 无有效缓存，全新加载');
        if (meta) {
          await this.storageManager.clearThreadCache(this.tid);
        }
        await this.loadFreshPages(pageInfo, container);
      }
    });
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(meta: ThreadMeta): boolean {
    if (!meta) return false;
    if (this.config.cacheExpireTime === -1) return true;
    const now = Date.now();
    return now - meta.lastAccess < this.config.cacheExpireTime;
  }

  /**
   * 从缓存加载
   */
  private async loadFromCache(
    meta: ThreadMeta,
    pageInfo: PageInfo,
    container: HTMLElement | null
  ): Promise<void> {
    try {
      this.progressCallback('🔄 正在从缓存加载...', 0, meta.totalPages || 0);

      // 清空容器
      if (container) {
        container.innerHTML = '';
      }
      this.loadedPages.clear();

      // 加载缓存的页面
      const cachedPages = (meta.cachedPages || []).sort((a, b) => a - b);
      console.log(`[PageLoader] 找到 ${cachedPages.length} 个缓存页面`);

      if (cachedPages.length === 0) {
        await this.loadFreshPages(pageInfo, container);
        return;
      }

      // 加载所有缓存页面到容器
      for (const page of cachedPages) {
        const pageContent = await this.storageManager.getPageContent(
          this.tid,
          page
        );
        if (pageContent && pageContent.rawHTML && container) {
          this.appendPosts(pageContent.rawHTML, page, container);
          this.loadedPages.add(page);
        }
      }

      // 更新访问时间
      await this.storageManager.updateLastAccess(this.tid);

      this.progressCallback(
        '🔄 缓存加载中 - 正在构建楼中楼...',
        cachedPages.length,
        meta.totalPages || 0
      );

      // 解析和渲染
      if (container) {
        await this.parseAndRender(container);
      }

      this.progressCallback(
        `✅ 缓存加载完成，共 ${cachedPages.length} 页`,
        cachedPages.length,
        meta.totalPages || 0
      );

      // 如果还有未缓存的页面，后台加载
      if (meta.totalPages && cachedPages.length < meta.totalPages) {
        const nextPage = Math.max(...cachedPages) + 1;
        if (meta.totalPages && nextPage <= meta.totalPages) {
          setTimeout(() => {
            this.loadRemainingPages(nextPage, meta.totalPages || 0, container);
          }, 1000);
        }
      }
    } catch (e) {
      console.error('[PageLoader] 缓存加载失败:', e);
      await this.loadFreshPages(pageInfo, container);
    }
  }

  /**
   * 全新加载页面
   */
  private async loadFreshPages(
    pageInfo: PageInfo,
    container: HTMLElement | null
  ): Promise<void> {
    try {
      const { currentPage, totalPages } = pageInfo;

      // 初始化元数据
      const meta: ThreadMeta = {
        tid: this.tid,
        title: this.extractThreadTitle(),
        totalPages: totalPages,
        cachedPages: [currentPage],
        lastAccess: Date.now(),
        cacheTime: Date.now(),
      };

      // 缓存当前页
      if (container) {
        await this.storageManager.savePageContent(
          this.tid,
          currentPage,
          container.innerHTML
        );
      }
      await this.storageManager.saveThreadMeta(this.tid, meta);
      this.loadedPages.add(currentPage);

      // 如果只有一页，直接渲染
      if (totalPages === 1) {
        this.progressCallback('📥 正在构建楼中楼...', 1, 1);
        if (container) {
          await this.parseAndRender(container);
        }
        this.progressCallback('✅ 完成！共 1 页', 1, 1);
        return;
      }

      // 加载更多页面
      const targetPage = Math.min(
        currentPage + this.config.initialLoadPages,
        totalPages
      );
      this.progressCallback(
        `📥 全新加载：第 ${currentPage + 1} 页 / 共 ${totalPages} 页`,
        currentPage,
        totalPages
      );

      await this.loadPageRange(
        currentPage + 1,
        targetPage,
        totalPages,
        container,
        meta
      );
    } catch (e) {
      console.error('[PageLoader] 全新加载失败:', e);
      this.progressCallback('❌ 加载失败', 0, 0);
    }
  }

  /**
   * 加载页面范围
   */
  private async loadPageRange(
    startPage: number,
    endPage: number,
    totalPages: number,
    container: HTMLElement | null,
    meta: ThreadMeta
  ): Promise<void> {
    for (let page = startPage; page <= endPage; page++) {
      if (this.loadedPages.has(page)) continue;

      try {
        this.progressCallback(
          `📥 加载中：第 ${page} 页 / 共 ${totalPages} 页`,
          this.loadedPages.size,
          totalPages
        );

        // 添加页面加载间隔
        if (page > startPage) {
          await new Promise(resolve => setTimeout(resolve, this.config.pageLoadInterval));
        }

        const html = await this.loadSinglePage(page);
        if (html && container) {
          this.appendPosts(html, page, container);
          this.loadedPages.add(page);

          // 保存到缓存
          await this.storageManager.savePageContent(this.tid, page, html);

          const currentMeta =
            (await this.storageManager.getThreadMeta(this.tid)) || meta;
          if (currentMeta.cachedPages && !currentMeta.cachedPages.includes(page)) {
            currentMeta.cachedPages.push(page);
          }
          await this.storageManager.saveThreadMeta(this.tid, currentMeta);
        }

        // 检查是否达到初始加载阈值
        if (
          this.isFirstConversion &&
          this.loadedPages.size >= this.config.initialLoadPages
        ) {
          console.log(
            `[PageLoader] 已加载 ${this.loadedPages.size} 页，开始转换`
          );
          await this.performProgressiveConversion(
            container,
            totalPages,
            endPage + 1
          );
          return;
        }
      } catch (e) {
        console.error(`[PageLoader] 加载第 ${page} 页失败:`, e);
      }
    }

    // 完成加载
    if (this.isFirstConversion && container) {
      await this.parseAndRender(container);
      this.progressCallback(
        `✅ 完成！共 ${this.loadedPages.size} 页`,
        this.loadedPages.size,
        totalPages
      );
    }

    // 继续后台预加载
    if (endPage < totalPages) {
      const nextStart = endPage + 1;
      setTimeout(() => {
        this.loadRemainingPages(nextStart, totalPages, container);
      }, 1000);
    }
  }

  /**
   * 加载单个页面
   */
  private loadSinglePage(page: number): Promise<string | null> {
    return new Promise((resolve) => {
      const url = `${window.location.origin}/read.php?tid=${this.tid}&loader=1&page=${page}`;
      GM_openInTab(url, false);

      const key = `POSTS_${page}`;
      const startTime = Date.now();
      const timeout = 30000;

      const check = setInterval(() => {
        const html = GM_getValue(key);
        if (html) {
          clearInterval(check);
          GM_setValue(key, null);
          resolve(html);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(check);
          console.warn(`[PageLoader] 第 ${page} 页加载超时`);
          resolve(null);
        }
      }, 500);
    });
  }

  /**
   * 追加帖子到容器
   */
  private appendPosts(html: string, page: number, container: HTMLElement): void {
    try {
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = html;

      // 展开折叠内容
      this.expandCollapses(tempContainer);

      const tables = tempContainer.querySelectorAll('table.forumbox.postbox');
      tables.forEach((t) => container.appendChild(t.cloneNode(true)));

      console.log(`[PageLoader] 第 ${page} 页追加 ${tables.length} 条帖子`);
    } catch (e) {
      console.error(`[PageLoader] 追加第 ${page} 页失败:`, e);
    }
  }

  /**
   * 展开折叠内容
   */
  private expandCollapses(container: HTMLElement): void {
    try {
      const buttons = container.querySelectorAll(
        'button[name="collapseSwitchButton"]'
      ) as NodeListOf<HTMLButtonElement>;
      buttons.forEach((button) => {
        try {
          if (button.textContent === '+') {
            button.click();
            button.textContent = '-';
          }
        } catch (e) {
          const collapseDiv = button.parentNode?.nextSibling as HTMLElement;
          if (collapseDiv && collapseDiv.classList.contains('collapse')) {
            collapseDiv.style.display = 'block';
            button.textContent = '-';
          }
        }
      });
    } catch (e) {
      console.error('[PageLoader] 展开折叠失败:', e);
    }
  }

  /**
   * 解析和渲染
   */
  private async parseAndRender(container: HTMLElement): Promise<void> {
    try {
      // 解析
      const result = await this.parser.parseThreadStructure(container);
      if (!result || !result.root) {
        console.error('[PageLoader] 解析失败');
        return;
      }

      // 渲染
      await this.renderer.render(result.root, container, this.tid);
    } catch (e) {
      console.error('[PageLoader] 解析和渲染失败:', e);
    }
  }

  /**
   * 渐进式转换
   */
  private async performProgressiveConversion(
    container: HTMLElement | null,
    totalPages: number,
    nextPage: number
  ): Promise<void> {
    this.isFirstConversion = false;

    this.progressCallback(
      '🔨 正在构建楼中楼...',
      this.loadedPages.size,
      totalPages
    );

    // 移除分页元素
    this.removeAllPaginationElements();

    // 解析和渲染
    if (container) {
      await this.parseAndRender(container);
    }

    this.progressCallback(
      `✅ 显示完成，共 ${this.loadedPages.size} 页`,
      this.loadedPages.size,
      totalPages
    );

    // 继续后台加载
    if (nextPage <= totalPages) {
      setTimeout(() => {
        this.loadRemainingPages(nextPage, totalPages, container);
      }, 1000);
    }
  }

  /**
   * 加载剩余页面
   */
  private async loadRemainingPages(
    startPage: number,
    totalPages: number,
    _container: HTMLElement | null
  ): Promise<void> {
    const endPage = totalPages;

    for (let page = startPage; page <= endPage; page++) {
      if (this.loadedPages.has(page)) continue;

      try {
        this.progressCallback(
          `⏬ 后台加载 ${page}/${totalPages}`,
          this.loadedPages.size,
          totalPages
        );

        const html = await this.loadSinglePage(page);
        if (html) {
          this.loadedPages.add(page);

          // 保存到缓存
          await this.storageManager.savePageContent(this.tid, page, html);

          const meta = await this.storageManager.getThreadMeta(this.tid);
          if (meta && meta.cachedPages && !meta.cachedPages.includes(page)) {
            meta.cachedPages.push(page);
            await this.storageManager.saveThreadMeta(this.tid, meta);
          }
        }
      } catch (e) {
        console.error(`[PageLoader] 后台加载第 ${page} 页失败:`, e);
      }
    }

    this.progressCallback(
      `✅ 后台加载完成！共 ${this.loadedPages.size} 页`,
      this.loadedPages.size,
      totalPages
    );
  }

  /**
   * 移除所有分页元素
   */
  private removeAllPaginationElements(): void {
    try {
      const paginationIds = ['m_pbtntop', 'm_pbtnbtm', 'pagebtop', 'pagebbtm'];
      paginationIds.forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
          element.remove();
        }
      });

      document.querySelectorAll('.page').forEach((el) => {
        const element = el as HTMLElement;
        if (
          element.textContent?.includes('页') ||
          element.querySelector('a[href*="page="]')
        ) {
          element.remove();
        }
      });
    } catch (e) {
      console.error('[PageLoader] 移除分页元素失败:', e);
    }
  }

  /**
   * 提取帖子标题
   */
  private extractThreadTitle(): string {
    try {
      const h1Title = document.querySelector('h1.w100') as HTMLHeadingElement;
      if (h1Title && h1Title.textContent?.trim()) {
        return h1Title.textContent.trim();
      }

      const topicSubject = document.getElementById('topicsubject') as HTMLElement;
      if (topicSubject && topicSubject.textContent?.trim()) {
        return topicSubject.textContent.trim();
      }

      const pageTitle = document.title;
      if (pageTitle) {
        return pageTitle.replace(/\s*-\s*NGA.*$/i, '').trim();
      }

      return '未命名帖子';
    } catch (e) {
      console.error('[PageLoader] 提取标题失败:', e);
      return '未命名帖子';
    }
  }

  /**
   * 获取已加载的页面数量
   */
  getLoadedPagesCount(): number {
    return this.loadedPages.size;
  }

  /**
   * 获取加载的页面集合
   */
  getLoadedPages(): Set<number> {
    return new Set(this.loadedPages);
  }

  /**
   * 获取存储管理器实例
   */
  getStorageManager(): StorageManager {
    return this.storageManager;
  }

  /**
   * 获取线程ID
   */
  getThreadId(): string {
    return this.tid;
  }

  /**
   * 公开的页面加载方法（供 ScrollLoader 使用）
   */
  async loadSinglePagePublic(page: number): Promise<string | null> {
    return await this.loadSinglePage(page);
  }

  /**
   * 公开的追加帖子方法（供 ScrollLoader 使用）
   */
  appendPostsPublic(html: string, page: number, container: HTMLElement): void {
    this.appendPosts(html, page, container);
  }

  /**
   * 公开的解析和渲染方法（供 ScrollLoader 使用）
   */
  async parseAndRenderPublic(container: HTMLElement): Promise<void> {
    await this.parseAndRender(container);
  }
}

export default PageLoader;
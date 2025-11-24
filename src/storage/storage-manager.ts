// ========== 存储管理器 ==========

import IndexedDBAdapter from './indexeddb-adapter.js';

/**
 * 线程元数据
 */
interface ThreadMeta {
  tid: string;
  title?: string;
  totalPages?: number;
  lastAccess: number;
  cacheTime: number;
  cachedPages?: number[];
}

/**
 * 页面内容数据
 */
interface PageContent {
  tid: string;
  page: number;
  rawHTML: string;
  timestamp: number;
}

/**
 * 配置数据
 */
interface ConfigData {
  key: string;
  value: any;
}

/**
 * 折叠状态数据
 */
interface CollapseStateData {
  tid: string;
  expandedFloors: number[];
}

/**
 * 存储管理器
 * 统一存储接口，自动选择 IndexedDB 或 GM 存储
 */
class StorageManager {
  private adapter: IndexedDBAdapter | null = null;
  private useIndexedDB = false;
  private initialized = false;
  private metaCache = new Map<string, ThreadMeta>(); // 内存缓存热数据

  /**
   * 初始化存储层
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[StorageManager] 开始初始化');

    // 尝试使用 IndexedDB
    if (IndexedDBAdapter.isAvailable()) {
      try {
        this.adapter = new IndexedDBAdapter();
        await this.adapter.openDatabase();
        this.useIndexedDB = true;
        console.log('[StorageManager] 使用 IndexedDB 存储');

        // 检查是否需要从 GM 迁移数据
        await this.migrateFromGM();
      } catch (e) {
        console.warn(
          '[StorageManager] IndexedDB 初始化失败，降级至 GM 存储:',
          e
        );
        this.useIndexedDB = false;
        this.adapter = null;
      }
    } else {
      console.log('[StorageManager] IndexedDB 不可用，使用 GM 存储');
      this.useIndexedDB = false;
    }

    this.initialized = true;
    console.log(
      '[StorageManager] 初始化完成，使用存储方式:',
      this.useIndexedDB ? 'IndexedDB' : 'GM'
    );
  }

  /**
   * 从 GM 存储迁移数据到 IndexedDB
   */
  private async migrateFromGM(): Promise<void> {
    try {
      // 检查是否已经迁移过
      const migrated = await this.getConfig('_migrated_from_gm');
      if (migrated) {
        console.log('[StorageManager] 数据已迁移，跳过');
        return;
      }

      // 检查 GM 中是否有旧数据
      const cacheIndexData = GM_getValue('NGA_CACHE_INDEX');
      if (!cacheIndexData) {
        console.log('[StorageManager] GM 存储中无数据，跳过迁移');
        await this.saveConfig('_migrated_from_gm', true);
        return;
      }

      console.log('[StorageManager] 检测到 GM 旧数据，开始迁移...');
      const tidList = JSON.parse(cacheIndexData) as string[];
      let migratedCount = 0;

      for (const tid of tidList) {
        try {
          // 迁移元数据
          const metaKey = `NGA_THREAD_META_${tid}`;
          const metaData = GM_getValue(metaKey);
          if (metaData) {
            const meta = JSON.parse(metaData) as ThreadMeta;
            await this.adapter!.put('thread_meta', meta);

            // 迁移页面内容
            if (meta.cachedPages && Array.isArray(meta.cachedPages)) {
              for (const page of meta.cachedPages) {
                const pageKey = `NGA_PAGE_CONTENT_${tid}_${page}`;
                const pageData = GM_getValue(pageKey);
                if (pageData) {
                  const pageContent = JSON.parse(pageData) as { rawHTML: string; timestamp: number };
                  await this.adapter!.put('page_content', {
                    tid: tid,
                    page: page,
                    rawHTML: pageContent.rawHTML,
                    timestamp: pageContent.timestamp,
                  });
                }
              }
            }

            migratedCount++;
            console.log(`[StorageManager] 已迁移帖子 ${tid}`);
          }
        } catch (e) {
          console.error(`[StorageManager] 迁移帖子 ${tid} 失败:`, e);
        }
      }

      // 迁移配置
      const config = GM_getValue('NGA_THREAD_CONFIG');
      if (config) {
        const configData = JSON.parse(config);
        for (const [key, value] of Object.entries(configData)) {
          await this.saveConfig(key, value);
        }
      }

      await this.saveConfig('_migrated_from_gm', true);
      console.log(
        `[StorageManager] 数据迁移完成，共迁移 ${migratedCount} 个帖子`
      );

      // 询问用户是否清理 GM 数据（可选）
      // 暂时保留，避免数据丢失
    } catch (e) {
      console.error('[StorageManager] 数据迁移失败:', e);
    }
  }

  /**
   * 获取帖子元数据
   */
  async getThreadMeta(tid: string): Promise<ThreadMeta | null> {
    // 先查内存缓存
    if (this.metaCache.has(tid)) {
      return this.metaCache.get(tid)!;
    }

    if (this.useIndexedDB) {
      try {
        const meta = await this.adapter!.get<ThreadMeta>('thread_meta', tid);
        if (meta) {
          this.metaCache.set(tid, meta);
        }
        return meta || null;
      } catch (e) {
        console.error(
          '[StorageManager] IndexedDB 读取元数据失败，降级至 GM:',
          e
        );
        return this._getThreadMetaFromGM(tid);
      }
    } else {
      return this._getThreadMetaFromGM(tid);
    }
  }

  /**
   * 从 GM 存储获取元数据
   */
  private _getThreadMetaFromGM(tid: string): ThreadMeta | null {
    try {
      const key = `NGA_THREAD_META_${tid}`;
      const data = GM_getValue(key);
      if (data) {
        const meta = JSON.parse(data) as ThreadMeta;
        this.metaCache.set(tid, meta);
        return meta;
      }
    } catch (e) {
      console.error('[StorageManager] GM 读取元数据失败:', e);
    }
    return null;
  }

  /**
   * 保存帖子元数据
   */
  async saveThreadMeta(tid: string, meta: Omit<ThreadMeta, 'tid'>): Promise<void> {
    const fullMeta: ThreadMeta = { tid, ...meta };

    // 更新内存缓存
    this.metaCache.set(tid, fullMeta);

    if (this.useIndexedDB) {
      try {
        await this.adapter!.put('thread_meta', fullMeta);
      } catch (e) {
        console.error(
          '[StorageManager] IndexedDB 保存元数据失败，降级至 GM:',
          e
        );
        this._saveThreadMetaToGM(tid, fullMeta);
      }
    } else {
      this._saveThreadMetaToGM(tid, fullMeta);
    }
  }

  /**
   * 保存元数据到 GM
   */
  private _saveThreadMetaToGM(tid: string, meta: ThreadMeta): void {
    try {
      const key = `NGA_THREAD_META_${tid}`;
      GM_setValue(key, JSON.stringify(meta));

      // 更新索引
      const indexKey = 'NGA_CACHE_INDEX';
      const indexData = GM_getValue(indexKey);
      let tidList = indexData ? JSON.parse(indexData) as string[] : [];
      if (!tidList.includes(tid)) {
        tidList.push(tid);
        GM_setValue(indexKey, JSON.stringify(tidList));
      }
    } catch (e) {
      console.error('[StorageManager] GM 保存元数据失败:', e);
    }
  }

  /**
   * 获取页面内容
   */
  async getPageContent(tid: string, page: number): Promise<PageContent | null> {
    if (this.useIndexedDB) {
      try {
        return await this.adapter!.get<PageContent>('page_content', [tid, page]);
      } catch (e) {
        console.error(
          '[StorageManager] IndexedDB 读取页面内容失败，降级至 GM:',
          e
        );
        return this._getPageContentFromGM(tid, page);
      }
    } else {
      return this._getPageContentFromGM(tid, page);
    }
  }

  /**
   * 从 GM 获取页面内容
   */
  private _getPageContentFromGM(tid: string, page: number): PageContent | null {
    try {
      const key = `NGA_PAGE_CONTENT_${tid}_${page}`;
      const data = GM_getValue(key);
      return data ? (JSON.parse(data) as PageContent) : null;
    } catch (e) {
      console.error('[StorageManager] GM 读取页面内容失败:', e);
      return null;
    }
  }

  /**
   * 保存页面内容
   */
  async savePageContent(tid: string, page: number, rawHTML: string): Promise<void> {
    const data: PageContent = {
      tid,
      page,
      rawHTML,
      timestamp: Date.now(),
    };

    if (this.useIndexedDB) {
      try {
        await this.adapter!.put('page_content', data);
      } catch (e) {
        console.error(
          '[StorageManager] IndexedDB 保存页面内容失败，降级至 GM:',
          e
        );
        this._savePageContentToGM(tid, page, data);
      }
    } else {
      this._savePageContentToGM(tid, page, data);
    }
  }

  /**
   * 保存页面内容到 GM
   */
  private _savePageContentToGM(tid: string, page: number, data: PageContent): void {
    try {
      const key = `NGA_PAGE_CONTENT_${tid}_${page}`;
      GM_setValue(key, JSON.stringify(data));
    } catch (e) {
      console.error('[StorageManager] GM 保存页面内容失败:', e);
    }
  }

  /**
   * 清除指定帖子的缓存
   */
  async clearThreadCache(tid: string): Promise<void> {
    // 清除内存缓存
    this.metaCache.delete(tid);

    if (this.useIndexedDB) {
      try {
        // 获取元数据以找到所有缓存页
        const meta = await this.adapter!.get<ThreadMeta>('thread_meta', tid);
        if (meta && meta.cachedPages) {
          // 删除所有页面内容
          for (const page of meta.cachedPages) {
            await this.adapter!.delete('page_content', [tid, page]);
          }
        }
        // 删除元数据
        await this.adapter!.delete('thread_meta', tid);
      } catch (e) {
        console.error('[StorageManager] IndexedDB 清除缓存失败，降级至 GM:', e);
        this._clearThreadCacheFromGM(tid);
      }
    } else {
      this._clearThreadCacheFromGM(tid);
    }
  }

  /**
   * 从 GM 清除缓存
   */
  private _clearThreadCacheFromGM(tid: string): void {
    try {
      const metaKey = `NGA_THREAD_META_${tid}`;
      const metaData = GM_getValue(metaKey);
      if (metaData) {
        const meta = JSON.parse(metaData) as ThreadMeta;
        if (meta.cachedPages) {
          meta.cachedPages.forEach((page) => {
            GM_setValue(`NGA_PAGE_CONTENT_${tid}_${page}`, null);
          });
        }
      }
      GM_setValue(metaKey, null);

      // 从索引中移除
      const indexKey = 'NGA_CACHE_INDEX';
      const indexData = GM_getValue(indexKey);
      if (indexData) {
        let tidList = JSON.parse(indexData) as string[];
        tidList = tidList.filter((t) => t !== tid);
        GM_setValue(indexKey, JSON.stringify(tidList));
      }
    } catch (e) {
      console.error('[StorageManager] GM 清除缓存失败:', e);
    }
  }

  /**
   * 获取所有缓存的帖子列表
   */
  async getAllCachedThreads(): Promise<ThreadMeta[]> {
    if (this.useIndexedDB) {
      try {
        return await this.adapter!.getAll<ThreadMeta>('thread_meta');
      } catch (e) {
        console.error(
          '[StorageManager] IndexedDB 获取缓存列表失败，降级至 GM:',
          e
        );
        return this._getAllCachedThreadsFromGM();
      }
    } else {
      return this._getAllCachedThreadsFromGM();
    }
  }

  /**
   * 从 GM 获取所有缓存帖子
   */
  private _getAllCachedThreadsFromGM(): ThreadMeta[] {
    try {
      const indexKey = 'NGA_CACHE_INDEX';
      const indexData = GM_getValue(indexKey);
      if (!indexData) return [];

      const tidList = JSON.parse(indexData) as string[];
      const threads: ThreadMeta[] = [];

      for (const tid of tidList) {
        const meta = this._getThreadMetaFromGM(tid);
        if (meta) {
          threads.push(meta);
        }
      }

      return threads;
    } catch (e) {
      console.error('[StorageManager] GM 获取缓存列表失败:', e);
      return [];
    }
  }

  /**
   * 获取缓存总大小（估算）
   */
  async getCacheSize(): Promise<number> {
    const threads = await this.getAllCachedThreads();
    let totalSize = 0;

    for (const meta of threads) {
      totalSize += JSON.stringify(meta).length * 2; // UTF-16

      if (meta.cachedPages) {
        for (const page of meta.cachedPages) {
          const pageContent = await this.getPageContent(meta.tid, page);
          if (pageContent) {
            totalSize += JSON.stringify(pageContent).length * 2;
          }
        }
      }
    }

    return totalSize;
  }

  /**
   * 清理旧缓存
   */
  async cleanOldCache(maxSize: number): Promise<void> {
    try {
      const threads = await this.getAllCachedThreads();

      // 按最后访问时间排序
      threads.sort((a, b) => a.lastAccess - b.lastAccess);

      let currentSize = await this.getCacheSize();
      let cleanedCount = 0;

      for (const meta of threads) {
        if (currentSize <= maxSize) break;

        // 计算该帖子的大小
        let threadSize = JSON.stringify(meta).length * 2;
        if (meta.cachedPages) {
          for (const page of meta.cachedPages) {
            const pageContent = await this.getPageContent(meta.tid, page);
            if (pageContent) {
              threadSize += JSON.stringify(pageContent).length * 2;
            }
          }
        }

        await this.clearThreadCache(meta.tid);
        currentSize -= threadSize;
        cleanedCount++;
        console.log(
          `[StorageManager] 清理旧缓存 tid=${meta.tid}, 大小=${(threadSize / 1024).toFixed(2)}KB`
        );
      }

      if (cleanedCount > 0) {
        console.log(`[StorageManager] 共清理 ${cleanedCount} 个帖子缓存`);
      }
    } catch (e) {
      console.error('[StorageManager] 清理旧缓存失败:', e);
    }
  }

  /**
   * 获取配置项
   */
  async getConfig(key: string): Promise<any> {
    if (this.useIndexedDB) {
      try {
        const result = await this.adapter!.get<ConfigData>('config', key);
        return result ? result.value : null;
      } catch (e) {
        console.error('[StorageManager] IndexedDB 读取配置失败，降级至 GM:', e);
        return GM_getValue(key);
      }
    } else {
      return GM_getValue(key);
    }
  }

  /**
   * 保存配置项
   */
  async saveConfig(key: string, value: any): Promise<void> {
    if (this.useIndexedDB) {
      try {
        await this.adapter!.put('config', { key, value });
      } catch (e) {
        console.error('[StorageManager] IndexedDB 保存配置失败，降级至 GM:', e);
        GM_setValue(key, value);
      }
    } else {
      GM_setValue(key, value);
    }
  }

  /**
   * 获取折叠状态
   */
  async getCollapseState(tid: string): Promise<Set<number> | null> {
    if (this.useIndexedDB) {
      try {
        const result = await this.adapter!.get<CollapseStateData>('collapse_state', tid);
        return result ? new Set(result.expandedFloors) : null;
      } catch (e) {
        console.error('[StorageManager] 读取折叠状态失败:', e);
        return null;
      }
    } else {
      // GM 存储暂不支持折叠状态
      return null;
    }
  }

  /**
   * 保存折叠状态
   */
  async saveCollapseState(tid: string, expandedFloors: Set<number>): Promise<void> {
    if (this.useIndexedDB) {
      try {
        await this.adapter!.put('collapse_state', {
          tid,
          expandedFloors: Array.from(expandedFloors),
        });
      } catch (e) {
        console.error('[StorageManager] 保存折叠状态失败:', e);
      }
    }
  }

  /**
   * 更新最后访问时间
   */
  async updateLastAccess(tid: string): Promise<void> {
    const meta = await this.getThreadMeta(tid);
    if (meta) {
      meta.lastAccess = Date.now();
      await this.saveThreadMeta(tid, meta);
    }
  }

  /**
   * 获取存储适配器实例（用于调试）
   */
  getAdapter(): IndexedDBAdapter | null {
    return this.adapter;
  }

  /**
   * 检查是否使用 IndexedDB
   */
  isUsingIndexedDB(): boolean {
    return this.useIndexedDB;
  }
}

export default StorageManager;
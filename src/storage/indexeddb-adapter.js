// ========== IndexedDB 适配器 ==========

/**
 * IndexedDB 适配器
 * 封装 IndexedDB 操作，提供 Promise 风格的 API
 */
class IndexedDBAdapter {
  constructor() {
    this.dbName = 'NGA_Thread_Cache';
    this.version = 1;
    this.db = null;
  }

  /**
   * 打开数据库
   * @returns {Promise<IDBDatabase>}
   */
  async openDatabase() {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('[IndexedDB] 打开数据库失败:', request.error);
        reject(new Error(`打开数据库失败: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IndexedDB] 数据库打开成功');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        console.log(
          '[IndexedDB] 数据库升级，版本:',
          event.oldVersion,
          '->',
          event.newVersion
        );
        const db = event.target.result;
        this.createObjectStores(db);
      };
    });
  }

  /**
   * 创建对象存储和索引
   * @param {IDBDatabase} db
   */
  createObjectStores(db) {
    try {
      // 创建 thread_meta 存储
      if (!db.objectStoreNames.contains('thread_meta')) {
        const threadMetaStore = db.createObjectStore('thread_meta', {
          keyPath: 'tid',
        });
        threadMetaStore.createIndex('lastAccess', 'lastAccess', {
          unique: false,
        });
        threadMetaStore.createIndex('cacheTime', 'cacheTime', {
          unique: false,
        });
        console.log('[IndexedDB] 创建 thread_meta 存储');
      }

      // 创建 page_content 存储
      if (!db.objectStoreNames.contains('page_content')) {
        const pageContentStore = db.createObjectStore('page_content', {
          keyPath: ['tid', 'page'],
        });
        pageContentStore.createIndex('tid', 'tid', { unique: false });
        pageContentStore.createIndex('timestamp', 'timestamp', {
          unique: false,
        });
        console.log('[IndexedDB] 创建 page_content 存储');
      }

      // 创建 config 存储
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
        console.log('[IndexedDB] 创建 config 存储');
      }

      // 创建 collapse_state 存储（用于楼中楼折叠状态）
      if (!db.objectStoreNames.contains('collapse_state')) {
        db.createObjectStore('collapse_state', { keyPath: 'tid' });
        console.log('[IndexedDB] 创建 collapse_state 存储');
      }
    } catch (e) {
      console.error('[IndexedDB] 创建对象存储失败:', e);
      throw e;
    }
  }

  /**
   * 创建事务
   * @param {string} storeName - 对象存储名称
   * @param {string} mode - 事务模式 ('readonly' | 'readwrite')
   * @returns {IDBObjectStore}
   */
  async getStore(storeName, mode = 'readonly') {
    const db = await this.openDatabase();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  /**
   * 获取单条记录
   * @param {string} storeName
   * @param {any} key
   * @returns {Promise<any>}
   */
  async get(storeName, key) {
    try {
      const store = await this.getStore(storeName, 'readonly');
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`[IndexedDB] 获取记录失败 (${storeName}):`, e);
      throw e;
    }
  }

  /**
   * 获取所有记录
   * @param {string} storeName
   * @returns {Promise<Array>}
   */
  async getAll(storeName) {
    try {
      const store = await this.getStore(storeName, 'readonly');
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`[IndexedDB] 获取所有记录失败 (${storeName}):`, e);
      throw e;
    }
  }

  /**
   * 按索引查询
   * @param {string} storeName
   * @param {string} indexName
   * @param {any} query
   * @returns {Promise<Array>}
   */
  async getByIndex(storeName, indexName, query) {
    try {
      const store = await this.getStore(storeName, 'readonly');
      const index = store.index(indexName);
      return new Promise((resolve, reject) => {
        const request = index.getAll(query);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(
        `[IndexedDB] 按索引查询失败 (${storeName}.${indexName}):`,
        e
      );
      throw e;
    }
  }

  /**
   * 添加记录
   * @param {string} storeName
   * @param {any} data
   * @returns {Promise<void>}
   */
  async add(storeName, data) {
    try {
      const store = await this.getStore(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const request = store.add(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`[IndexedDB] 添加记录失败 (${storeName}):`, e);
      throw e;
    }
  }

  /**
   * 更新或添加记录
   * @param {string} storeName
   * @param {any} data
   * @returns {Promise<void>}
   */
  async put(storeName, data) {
    try {
      const store = await this.getStore(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`[IndexedDB] 更新记录失败 (${storeName}):`, e);
      throw e;
    }
  }

  /**
   * 删除记录
   * @param {string} storeName
   * @param {any} key
   * @returns {Promise<void>}
   */
  async delete(storeName, key) {
    try {
      const store = await this.getStore(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`[IndexedDB] 删除记录失败 (${storeName}):`, e);
      throw e;
    }
  }

  /**
   * 清空对象存储
   * @param {string} storeName
   * @returns {Promise<void>}
   */
  async clear(storeName) {
    try {
      const store = await this.getStore(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`[IndexedDB] 清空存储失败 (${storeName}):`, e);
      throw e;
    }
  }

  /**
   * 统计记录数
   * @param {string} storeName
   * @returns {Promise<number>}
   */
  async count(storeName) {
    try {
      const store = await this.getStore(storeName, 'readonly');
      return new Promise((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`[IndexedDB] 统计记录数失败 (${storeName}):`, e);
      throw e;
    }
  }

  /**
   * 批量写入（在同一事务中）
   * @param {string} storeName
   * @param {Array} dataArray
   * @returns {Promise<void>}
   */
  async batchPut(storeName, dataArray) {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);

        dataArray.forEach((data) => {
          store.put(data);
        });
      });
    } catch (e) {
      console.error(`[IndexedDB] 批量写入失败 (${storeName}):`, e);
      throw e;
    }
  }

  /**
   * 获取所有键
   * @param {string} storeName
   * @returns {Promise<Array>}
   */
  async getAllKeys(storeName) {
    try {
      const store = await this.getStore(storeName, 'readonly');
      return new Promise((resolve, reject) => {
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`[IndexedDB] 获取所有键失败 (${storeName}):`, e);
      throw e;
    }
  }

  /**
   * 检查 IndexedDB 是否可用
   * @returns {boolean}
   */
  static isAvailable() {
    return typeof indexedDB !== 'undefined';
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[IndexedDB] 数据库连接已关闭');
    }
  }
}

export default IndexedDBAdapter;

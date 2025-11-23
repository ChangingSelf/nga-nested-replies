# 关键Bug分析和修复方案

## 问题1：预加载停止工作 ❌

### 问题诊断

查看 `performProgressiveConversion` (第1484行)：

```javascript
const preloadLimit = displayedPageCount + config.preloadPages;
const actualLimit = Math.min(preloadLimit, total);

if (nextPage <= actualLimit) {
  updateProgressLine2(`后台加载中 ${nextPage}/${actualLimit}`);
  loadNextPage(nextPage, actualLimit, tid, container, true, metaData);
}
```

**Bug**: `loadNextPage` 的第二个参数 `actualLimit` 被当作 `total`，导致加载到 `actualLimit` 就停止了！

### 修复方案

```javascript
// 错误：
loadNextPage(nextPage, actualLimit, tid, container, true, metaData);

// 正确：
loadNextPage(nextPage, total, tid, container, true, metaData);
// 然后在loadNextPage内部判断是否达到actualLimit时停止后台加载
```

或者添加一个参数控制：

```javascript
function loadNextPage(
  page,
  total,
  tid,
  container,
  isBackground = false,
  metaData = null,
  preloadLimit = null
) {
  // ...
  if (isBackground && preloadLimit && page > preloadLimit) {
    console.log('[预加载] 已达到预加载限制');
    return;
  }
  // ...
}
```

## 问题4：缓存不加载 ❌

### 问题诊断1：缓存检测逻辑

查看 `initializeThreadView` (第1261行)：

```javascript
if (meta && cacheManager.isCacheValid(config.cacheExpireTime)) {
  console.log('[NGA 楼中楼] 命中缓存，加载缓存内容');
  loadFromCache(meta, info);
}
```

**测试步骤**：

1. 打开控制台
2. 检查是否输出 `[NGA 楼中楼] 命中缓存，加载缓存内容`
3. 如果没有，说明缓存检测失败

### 问题诊断2：元数据保存时机

查看 `saveMeta` 调用的地方：

- `startFreshLoading` (第1362行) ✅
- `loadNextPage` (第1456行) ✅

**但是！** 查看 `extractThreadTitle`：

- 只在 `startFreshLoading` 中调用
- 如果页面已有缓存，不会更新 title

### 问题诊断3：缓存索引

检查 `NGA_CACHE_INDEX` 是否正确维护：

```javascript
// 在 saveMeta 中
if (!tidList.includes(this.tid)) {
  tidList.push(this.tid);
  GM_setValue(cacheIndexKey, JSON.stringify(tidList));
}
```

**可能的Bug**: 如果 tidList 已经包含 tid，但元数据实际不存在（被手动删除），会导致列表不准确。

## 问题2：迁移到IndexedDB

### 为什么现在必须迁移？

根据STORAGE_ANALYSIS.md的结论"不建议迁移"，但用户明确要求迁移，原因可能是：

1. GM存储容量不足（实际使用中）
2. 想要更好的性能
3. 想要更可靠的存储

### IndexedDB实现方案

```javascript
class IndexedDBStorage {
  constructor(dbName = 'NGA_THREAD_CACHE', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 配置存储
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'key' });
        }

        // 帖子元数据存储
        if (!db.objectStoreNames.contains('threads')) {
          const threadStore = db.createObjectStore('threads', {
            keyPath: 'tid',
          });
          threadStore.createIndex('lastAccess', 'lastAccess', {
            unique: false,
          });
        }

        // 页面内容存储
        if (!db.objectStoreNames.contains('pages')) {
          const pageStore = db.createObjectStore('pages', {
            keyPath: ['tid', 'page'],
          });
          pageStore.createIndex('tid', 'tid', { unique: false });
        }
      };
    });
  }

  async getConfig(key) {
    const tx = this.db.transaction(['config'], 'readonly');
    const store = tx.objectStore('config');
    return new Promise((resolve) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => resolve(null);
    });
  }

  async setConfig(key, value) {
    const tx = this.db.transaction(['config'], 'readwrite');
    const store = tx.objectStore('config');
    return new Promise((resolve) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  async getThread(tid) {
    const tx = this.db.transaction(['threads'], 'readonly');
    const store = tx.objectStore('threads');
    return new Promise((resolve) => {
      const request = store.get(tid);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }

  async saveThread(threadData) {
    const tx = this.db.transaction(['threads'], 'readwrite');
    const store = tx.objectStore('threads');
    return new Promise((resolve) => {
      const request = store.put(threadData);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  async getPage(tid, page) {
    const tx = this.db.transaction(['pages'], 'readonly');
    const store = tx.objectStore('pages');
    return new Promise((resolve) => {
      const request = store.get([tid, page]);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }

  async savePage(tid, page, rawHTML) {
    const tx = this.db.transaction(['pages'], 'readwrite');
    const store = tx.objectStore('pages');
    return new Promise((resolve) => {
      const request = store.put({ tid, page, rawHTML, timestamp: Date.now() });
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  async getAllThreads() {
    const tx = this.db.transaction(['threads'], 'readonly');
    const store = tx.objectStore('threads');
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
  }

  async deleteThread(tid) {
    const tx = this.db.transaction(['threads', 'pages'], 'readwrite');

    // 删除元数据
    tx.objectStore('threads').delete(tid);

    // 删除所有页面
    const pageStore = tx.objectStore('pages');
    const index = pageStore.index('tid');
    const request = index.openCursor(IDBKeyRange.only(tid));

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  async getCacheSize() {
    if (!navigator.storage || !navigator.storage.estimate) {
      return 0;
    }
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  }
}
```

## 问题3：进度条UI改进

### 当前问题

- 进度条在顶部中央，可能挡住内容
- 加载完成后直接消失，无法查看状态

### 改进方案

```javascript
class CompactProgress {
  constructor() {
    this.expanded = false;
    this.container = null;
    this.create();
  }

  create() {
    // 创建容器
    this.container = document.createElement('div');
    this.container.id = 'nga-progress-compact';
    this.container.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 0;
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 8px 12px;
            border-radius: 8px 0 0 8px;
            font-size: 13px;
            z-index: 9999;
            box-shadow: -2px 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: all 0.3s ease;
            max-width: 50px;
            overflow: hidden;
        `;

    // 缩略状态
    const compact = document.createElement('div');
    compact.className = 'progress-compact';
    compact.innerHTML = '📊';
    compact.style.cssText = 'display: block;';

    // 展开状态
    const expanded = document.createElement('div');
    expanded.className = 'progress-expanded';
    expanded.style.cssText = 'display: none; min-width: 300px;';
    expanded.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">加载进度</div>
            <div id="progress-status">正在初始化...</div>
            <div id="progress-detail" style="font-size: 11px; color: #d1d5db; margin-top: 4px;"></div>
        `;

    this.container.appendChild(compact);
    this.container.appendChild(expanded);
    document.body.appendChild(this.container);

    // 鼠标悬停展开
    this.container.addEventListener('mouseenter', () => this.expand());
    this.container.addEventListener('mouseleave', () => this.collapse());
  }

  expand() {
    this.expanded = true;
    this.container.style.maxWidth = '350px';
    this.container.querySelector('.progress-compact').style.display = 'none';
    this.container.querySelector('.progress-expanded').style.display = 'block';
  }

  collapse() {
    if (this.isLoading) return; // 加载中不自动折叠
    this.expanded = false;
    this.container.style.maxWidth = '50px';
    this.container.querySelector('.progress-compact').style.display = 'block';
    this.container.querySelector('.progress-expanded').style.display = 'none';
  }

  update(status, detail = '') {
    this.isLoading = !status.includes('完成') && !status.includes('错误');
    const statusEl = document.getElementById('progress-status');
    const detailEl = document.getElementById('progress-detail');
    if (statusEl) statusEl.textContent = status;
    if (detailEl) detailEl.textContent = detail;
  }

  hide() {
    if (this.container) {
      this.container.style.opacity = '0';
      setTimeout(() => this.container.remove(), 500);
    }
  }
}
```

## 推荐的修复优先级

### 立即修复（影响基本功能）

1. ✅ **修复预加载Bug** - 只需修改1行代码
2. ✅ **调试缓存加载** - 添加详细日志，找出真正原因

### 短期优化（1-2天）

3. ⚠️ **改进进度条UI** - 独立模块，不影响其他功能
4. ⚠️ **代码注释和文档** - 提高可维护性

### 中期重构（1周）

5. 📦 **迁移到IndexedDB** - 需要完整测试
6. 📦 **模块化拆分** - 需要建立构建流程

## 建议

**现在立即做**：

1. 修复预加载Bug（2分钟）
2. 添加详细日志诊断缓存问题（10分钟）
3. 测试并验证修复（30分钟）

**然后再决定是否**：

- 完整迁移到IndexedDB
- 进行代码重构

**理由**：

- 先确保基本功能正常
- 重构是大工程，需要充分测试
- IndexedDB迁移涉及数据迁移，有风险

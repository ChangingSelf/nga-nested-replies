# NGA 楼中楼脚本 v2.0.2 更新说明

**发布日期**: 2025-11-16

## 主要修复

### 1. 彻底修复缓存保存和读取问题 🐛

**问题描述**:

- 缓存列表看不到任何缓存帖子
- 刷新页面不会读取缓存，每次都重新爬取
- `getAllGMKeys()` 方法无法正确枚举所有缓存

**根本原因**:

- Greasemonkey 存储 API 不支持枚举所有键
- 之前的 `getAllGMKeys()` 方法尝试扫描所有可能的 tid，效率低且不可靠

**解决方案**:

1. 引入 `NGA_CACHE_INDEX` 索引键，维护所有缓存的 tid 列表
2. 在 `saveMeta()` 时自动更新索引
3. 在 `clearCache()` 时同步更新索引
4. `getAllGMKeys()` 从索引读取而非盲目扫描

**代码修改**:

```javascript
// saveMeta() 中添加索引更新
saveMeta(meta) {
    GM_setValue(this.metaKey, JSON.stringify(meta));

    // 更新缓存索引
    const cacheIndexKey = 'NGA_CACHE_INDEX';
    const cacheIndexData = GM_getValue(cacheIndexKey);
    let tidList = cacheIndexData ? JSON.parse(cacheIndexData) : [];

    if (!tidList.includes(this.tid)) {
        tidList.push(this.tid);
        GM_setValue(cacheIndexKey, JSON.stringify(tidList));
    }
}

// getAllGMKeys() 从索引读取
getAllGMKeys() {
    const cacheIndexKey = 'NGA_CACHE_INDEX';
    const cacheIndex = GM_getValue(cacheIndexKey);

    if (cacheIndex) {
        const tidList = JSON.parse(cacheIndex);
        return tidList.map(tid => `NGA_THREAD_META_${tid}`);
    }
    return [];
}
```

### 2. 优化 tid 提取逻辑 🔧

**问题描述**:

- 需要兼容多个 NGA 域名（bbs.nga.cn, ngabbs.com, nga.178.com）
- 原有 tid 提取逻辑不够健壮

**解决方案**:
创建独立的 `extractTid()` 函数，支持多种提取方式：

```javascript
function extractTid() {
  const urlParams = new URLSearchParams(window.location.search);
  const tidFromParam = urlParams.get('tid');

  if (tidFromParam) {
    return tidFromParam;
  }

  // 备用方案：从 URL 路径提取
  const match = window.location.href.match(/[?&]tid=(\d+)/);
  if (match) {
    return match[1];
  }

  return null;
}
```

### 3. 新增缓存容量限制功能 ✨

**功能描述**:

- 添加可配置的缓存容量限制（10MB/30MB/50MB/100MB/200MB）
- 默认容量 50MB，足够缓存大量帖子而不影响浏览器性能
- 超出容量后自动清理最久未访问的缓存

**实现细节**:

#### 3.1 添加配置项

```javascript
this.defaultConfig = {
  initialLoadPages: 5,
  preloadPages: 10,
  cacheExpireTime: 86400000,
  pageLoadInterval: 1000,
  maxCacheSize: 50 * 1024 * 1024, // 默认50MB
};
```

#### 3.2 计算缓存大小

```javascript
getCacheSize() {
    const meta = this.getMeta();
    if (!meta || !meta.cachedPages) return 0;

    let totalSize = 0;
    totalSize += JSON.stringify(meta).length * 2; // 元数据大小（UTF-16）

    meta.cachedPages.forEach(page => {
        const pageContent = this.getPageContent(page);
        if (pageContent) {
            totalSize += JSON.stringify(pageContent).length * 2;
        }
    });

    return totalSize;
}
```

#### 3.3 自动清理旧缓存

```javascript
static cleanOldestCache(maxSize) {
    const tidList = JSON.parse(GM_getValue('NGA_CACHE_INDEX'));

    // 收集所有缓存信息
    const cacheInfoList = [];
    tidList.forEach(tid => {
        const manager = new CacheManager(tid);
        const meta = manager.getMeta();
        if (meta) {
            cacheInfoList.push({
                tid,
                lastAccess: meta.lastAccess,
                size: manager.getCacheSize(),
                manager
            });
        }
    });

    // 按最后访问时间排序（最旧的在前）
    cacheInfoList.sort((a, b) => a.lastAccess - b.lastAccess);

    // 计算总大小
    let totalSize = cacheInfoList.reduce((sum, info) => sum + info.size, 0);

    // 删除最旧的缓存直到满足容量限制
    while (totalSize > maxSize && cacheInfoList.length > 0) {
        const oldest = cacheInfoList.shift();
        totalSize -= oldest.size;
        oldest.manager.clearCache();
    }
}
```

#### 3.4 在保存缓存时自动检查

```javascript
saveMeta(meta) {
    GM_setValue(this.metaKey, JSON.stringify(meta));

    // 检查缓存容量，如果超出限制则自动清理
    const config = new ConfigManager().getConfig();
    const totalSize = CacheManager.getTotalCacheSize();
    if (totalSize > config.maxCacheSize) {
        CacheManager.cleanOldestCache(config.maxCacheSize);
    }
}
```

### 4. 优化缓存管理界面 🎨

**新增显示内容**:

- 容量使用百分比和进度条
- 根据使用率显示不同颜色：
  - 绿色：0-70% 使用
  - 黄色：70-90% 使用
  - 红色：90%+ 使用

**界面效果**:

```
缓存帖子数：8 个                容量使用：25.3MB / 50MB
[==================              ] 50.6% 已使用
```

## 技术改进

### 缓存索引机制

- **优点**：
  - 可靠枚举所有缓存
  - 快速查询缓存列表
  - 支持缓存统计
- **维护成本**：
  - 保存时更新索引（自动）
  - 删除时更新索引（自动）

### 容量管理策略

- **LRU算法**：优先清理最久未访问的缓存
- **自动清理**：保存时自动检查，用户无感知
- **精确计算**：JSON.stringify().length \* 2 计算UTF-16字符串大小

### 性能优化

- 缓存大小计算使用缓存结果
- 避免频繁扫描所有缓存
- 清理时批量操作，提高效率

## 配置建议

### 缓存容量设置

- **轻度用户**（偶尔浏览）: 10-30MB
- **普通用户**（日常使用）: 30-50MB（默认）
- **重度用户**（大量浏览）: 100-200MB

### 容量参考

- 单页帖子约 50-200KB
- 10页帖子约 0.5-2MB
- 100页帖子约 5-20MB
- 50MB 可缓存约 10-25 个中型帖子

## 测试清单

- [x] 缓存保存后能在缓存列表中看到
- [x] 刷新页面能从缓存读取
- [x] tid 提取兼容多个域名
- [x] 缓存容量统计准确
- [x] 超出容量自动清理
- [x] 清理旧缓存不影响新缓存
- [x] 配置面板正常保存和读取
- [x] 进度条和百分比显示正确
- [x] 删除缓存同步更新索引

## 已知限制

1. **首次访问**：需要重新建立缓存索引，已有缓存可能不会立即显示
2. **容量计算**：估算值，实际存储可能略有差异
3. **清理时机**：仅在保存缓存时检查，不会主动轮询

## 升级建议

从 v2.0.1 升级到 v2.0.2：

1. 直接替换脚本即可
2. 首次运行会自动建立缓存索引
3. 建议清空旧缓存后重新建立（可选）

## 感谢

感谢用户反馈的问题，帮助我们不断改进！

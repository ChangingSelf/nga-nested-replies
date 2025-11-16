// ========== 缓存管理模块 ==========

class CacheManager {
    constructor(tid) {
        this.tid = tid;
        this.metaKey = `NGA_THREAD_META_${tid}`;
    }

    getMeta() {
        try {
            const data = GM_getValue(this.metaKey);
            if (data) return JSON.parse(data);
        } catch (e) {
            console.error('[缓存管理] 读取元数据失败:', e);
        }
        return null;
    }

    saveMeta(meta) {
        try {
            GM_setValue(this.metaKey, JSON.stringify(meta));
            
            // 更新缓存索引
            const cacheIndexKey = 'NGA_CACHE_INDEX';
            const cacheIndexData = GM_getValue(cacheIndexKey);
            let tidList = cacheIndexData ? JSON.parse(cacheIndexData) : [];
            
            if (!tidList.includes(this.tid)) {
                tidList.push(this.tid);
                GM_setValue(cacheIndexKey, JSON.stringify(tidList));
                console.log('[缓存管理] 已将 tid 添加到索引:', this.tid);
            }
            
            // 检查缓存容量，如果超出限制则自动清理
            const config = new ConfigManager().getConfig();
            const totalSize = CacheManager.getTotalCacheSize();
            if (totalSize > config.maxCacheSize) {
                console.log(`[缓存管理] 缓存容量超出限制: ${(totalSize / 1024 / 1024).toFixed(2)}MB > ${(config.maxCacheSize / 1024 / 1024).toFixed(2)}MB`);
                CacheManager.cleanOldestCache(config.maxCacheSize);
            }
            
            console.log('[缓存管理] 元数据已保存');
            return true;
        } catch (e) {
            console.error('[缓存管理] 保存元数据失败:', e);
            return false;
        }
    }

    updateLastAccess() {
        const meta = this.getMeta();
        if (meta) {
            meta.lastAccess = Date.now();
            this.saveMeta(meta);
        }
    }

    getPageContent(page) {
        try {
            const key = `NGA_PAGE_CONTENT_${this.tid}_${page}`;
            const data = GM_getValue(key);
            if (data) return JSON.parse(data);
        } catch (e) {
            console.error(`[缓存管理] 读取第${page}页内容失败:`, e);
        }
        return null;
    }

    savePageContent(page, rawHTML) {
        try {
            const key = `NGA_PAGE_CONTENT_${this.tid}_${page}`;
            const data = { page, rawHTML, timestamp: Date.now() };
            GM_setValue(key, JSON.stringify(data));
            console.log(`[缓存管理] 第${page}页内容已缓存`);
            return true;
        } catch (e) {
            console.error(`[缓存管理] 保存第${page}页内容失败:`, e);
            return false;
        }
    }

    isCacheValid(cacheExpireTime) {
        const meta = this.getMeta();
        if (!meta) return false;
        if (cacheExpireTime === -1) return true;
        const now = Date.now();
        return (now - meta.lastAccess) < cacheExpireTime;
    }

    clearCache() {
        try {
            const meta = this.getMeta();
            if (meta && meta.cachedPages) {
                meta.cachedPages.forEach(page => {
                    const key = `NGA_PAGE_CONTENT_${this.tid}_${page}`;
                    GM_setValue(key, null);
                });
            }
            GM_setValue(this.metaKey, null);
            
            // 从缓存索引中移除
            const cacheIndexKey = 'NGA_CACHE_INDEX';
            const cacheIndexData = GM_getValue(cacheIndexKey);
            if (cacheIndexData) {
                let tidList = JSON.parse(cacheIndexData);
                tidList = tidList.filter(tid => tid !== this.tid);
                GM_setValue(cacheIndexKey, JSON.stringify(tidList));
                console.log('[缓存管理] 已从索引中移除 tid:', this.tid);
            }
            
            console.log('[缓存管理] 已清理帖子缓存:', this.tid);
            return true;
        } catch (e) {
            console.error('[缓存管理] 清理缓存失败:', e);
            return false;
        }
    }
    
    // 获取缓存大小
    getCacheSize() {
        try {
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
        } catch (e) {
            console.error('[缓存管理] 计算缓存大小失败:', e);
            return 0;
        }
    }
    
    // 静态方法：获取所有缓存的总大小
    static getTotalCacheSize() {
        try {
            const cacheIndexKey = 'NGA_CACHE_INDEX';
            const cacheIndexData = GM_getValue(cacheIndexKey);
            if (!cacheIndexData) return 0;
            
            const tidList = JSON.parse(cacheIndexData);
            let totalSize = 0;
            
            tidList.forEach(tid => {
                const manager = new CacheManager(tid);
                totalSize += manager.getCacheSize();
            });
            
            return totalSize;
        } catch (e) {
            console.error('[缓存管理] 计算总缓存大小失败:', e);
            return 0;
        }
    }
    
    // 静态方法：清理最旧的缓存直到满足容量限制
    static cleanOldestCache(maxSize) {
        try {
            const cacheIndexKey = 'NGA_CACHE_INDEX';
            const cacheIndexData = GM_getValue(cacheIndexKey);
            if (!cacheIndexData) return;
            
            const tidList = JSON.parse(cacheIndexData);
            
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
            let cleanedCount = 0;
            while (totalSize > maxSize && cacheInfoList.length > 0) {
                const oldest = cacheInfoList.shift();
                totalSize -= oldest.size;
                oldest.manager.clearCache();
                cleanedCount++;
                console.log(`[缓存管理] 已清理旧缓存 tid=${oldest.tid}, 大小=${(oldest.size / 1024).toFixed(2)}KB`);
            }
            
            if (cleanedCount > 0) {
                console.log(`[缓存管理] 共清理 ${cleanedCount} 个帖子缓存，释放空间 ${((totalSize) / 1024 / 1024).toFixed(2)}MB`);
            }
        } catch (e) {
            console.error('[缓存管理] 清理旧缓存失败:', e);
        }
    }
}

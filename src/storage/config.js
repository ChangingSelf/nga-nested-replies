// ========== 配置管理模块 ==========

class ConfigManager {
    constructor() {
        this.defaultConfig = {
            initialLoadPages: 5,
            preloadPages: 10,
            cacheExpireTime: 86400000,
            pageLoadInterval: 1000,  // 页面读取间隔（毫秒）
            maxCacheSize: 50 * 1024 * 1024,  // 最大缓存容量（字节），默认50MB
            // 新增配置项
            useIndexedDB: true,  // 是否启用 IndexedDB
            replyCollapseThreshold: 3,  // 楼中楼折叠阈值
            enableReplyCollapse: true,  // 是否启用楼中楼折叠功能
            incrementalRenderBatch: 3,  // 增量渲染的批次大小（页数）
            enableWebWorkerParse: false,  // 是否启用 Web Worker 解析（实验性）
            webWorkerParseThreshold: 800,  // 启用 Web Worker 的帖子数量阈值
            enablePerformanceLog: false,  // 是否启用性能日志（调试用）
            useVirtualScroll: true,  // 是否启用虚拟滚动（性能优化）
            virtualScrollBufferSize: 10  // 虚拟滚动缓冲区大小（视口上下额外渲染的楼层数）
        };
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            const saved = GM_getValue('NGA_THREAD_CONFIG');
            if (saved) {
                const parsed = JSON.parse(saved);
                console.log('[配置管理] 加载已保存配置:', parsed);
                return { ...this.defaultConfig, ...parsed };
            }
        } catch (e) {
            console.warn('[配置管理] 加载配置失败，使用默认配置:', e);
        }
        return { ...this.defaultConfig };
    }

    saveConfig(newConfig) {
        try {
            this.config = { ...this.config, ...newConfig };
            GM_setValue('NGA_THREAD_CONFIG', JSON.stringify(this.config));
            console.log('[配置管理] 配置已保存:', this.config);
            return true;
        } catch (e) {
            console.error('[配置管理] 保存配置失败:', e);
            return false;
        }
    }

    getConfig() {
        return { ...this.config };
    }
}

export default ConfigManager;

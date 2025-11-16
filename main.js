// ==UserScript==
// @name         NGA 楼中楼（改进版）
// @namespace    http://tampermonkey.net/
// @version      2.0.3
// @description  遍历帖子所有界面并自动展开折叠内容，然后重新组织为楼中楼形式。支持渐进式加载、智能缓存、配置管理
// @author       cloud_rider
// @match        https://bbs.nga.cn/read.php?tid=*
// @match        https://ngabbs.com/read.php?tid=*
// @match        https://nga.178.com/read.php?tid=*
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/554439/NGA%20%E6%A5%BC%E4%B8%AD%E6%A5%BC.user.js
// @updateURL https://update.greasyfork.org/scripts/554439/NGA%20%E6%A5%BC%E4%B8%AD%E6%A5%BC.meta.js
// ==/UserScript==

(function() {
    'use strict';
    console.log('[NGA 楼中楼] 脚本启动 v2.0.3');

    // ========== 配置管理模块 ==========
    class ConfigManager {
        constructor() {
            this.defaultConfig = {
                initialLoadPages: 5,
                preloadPages: 10,
                cacheExpireTime: 86400000,
                pageLoadInterval: 1000,  // 页面读取间隔（毫秒）
                maxCacheSize: 50 * 1024 * 1024  // 最大缓存容量（字节），默认50MB
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

    // ========== 配置面板UI ==========
    class ConfigPanel {
        constructor(configMgr, cacheMgr) {
            this.configManager = configMgr;
            this.cacheManager = cacheMgr;
            this.panel = null;
            this.floatBtn = null;
            this.createFloatButton();
        }

        createFloatButton() {
            this.floatBtn = document.createElement('div');
            this.floatBtn.id = 'nga-thread-config-btn';
            this.floatBtn.innerHTML = '⚙️';
            this.floatBtn.style.cssText = `
                position: fixed;
                bottom: 80px;
                right: 30px;
                width: 50px;
                height: 50px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                transition: all 0.3s ease;
            `;
            
            this.floatBtn.addEventListener('mouseenter', () => {
                this.floatBtn.style.transform = 'scale(1.1)';
                this.floatBtn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)';
            });
            
            this.floatBtn.addEventListener('mouseleave', () => {
                this.floatBtn.style.transform = 'scale(1)';
                this.floatBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            });
            
            this.floatBtn.addEventListener('click', () => this.togglePanel());
            
            document.body.appendChild(this.floatBtn);
        }

        createPanel() {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;

            const panel = document.createElement('div');
            panel.style.cssText = `
                background: white;
                border-radius: 12px;
                width: 700px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                transform: translateY(-20px);
                transition: transform 0.3s ease;
            `;

            const config = this.configManager.getConfig();

            panel.innerHTML = `
                <div style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
                    <h2 style="margin: 0; font-size: 20px; color: #1f2937;">NGA 楼中楼配置</h2>
                    <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">管理加载策略和缓存设置</p>
                </div>
                
                <div style="padding: 0 24px;">
                    <div style="display: flex; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;">
                        <button class="tab-btn" data-tab="config" style="padding: 12px 20px; border: none; background: none; cursor: pointer; border-bottom: 2px solid #667eea; color: #667eea; font-weight: 600;">加载配置</button>
                        <button class="tab-btn" data-tab="cache" style="padding: 12px 20px; border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; color: #6b7280;">缓存管理</button>
                    </div>
                </div>
                
                <div id="config-tab" style="padding: 0 24px 24px;">
                    <div style="margin-bottom: 24px;">
                        <h3 style="margin: 0 0 16px; font-size: 16px; color: #374151;">加载配置</h3>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; color: #4b5563; font-size: 14px;">初始加载页数</label>
                            <input type="number" id="initialLoadPages" value="${config.initialLoadPages}" min="1" max="50" 
                                style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" />
                            <small style="color: #6b7280; font-size: 12px;">达到此页数后立即开始转换展示（1-50）</small>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; color: #4b5563; font-size: 14px;">预加载页数</label>
                            <input type="number" id="preloadPages" value="${config.preloadPages}" min="0" max="100" 
                                style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" />
                            <small style="color: #6b7280; font-size: 12px;">转换展示后继续后台加载的页数（0-100）</small>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; color: #4b5563; font-size: 14px;">页面读取间隔（毫秒）</label>
                            <input type="number" id="pageLoadInterval" value="${config.pageLoadInterval}" min="500" max="5000" step="100" 
                                style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" />
                            <small style="color: #6b7280; font-size: 12px;">每个页面读取的等待时间（500-5000毫秒）</small>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 24px;">
                        <h3 style="margin: 0 0 16px; font-size: 16px; color: #374151;">缓存配置</h3>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; color: #4b5563; font-size: 14px;">缓存有效期</label>
                            <select id="cacheExpireTime" 
                                style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                                <option value="3600000" ${config.cacheExpireTime === 3600000 ? 'selected' : ''}>1小时</option>
                                <option value="43200000" ${config.cacheExpireTime === 43200000 ? 'selected' : ''}>12小时</option>
                                <option value="86400000" ${config.cacheExpireTime === 86400000 ? 'selected' : ''}>24小时</option>
                                <option value="604800000" ${config.cacheExpireTime === 604800000 ? 'selected' : ''}>7天</option>
                                <option value="-1" ${config.cacheExpireTime === -1 ? 'selected' : ''}>永久</option>
                            </select>
                            <small style="color: #6b7280; font-size: 12px;">缓存的帖子数据在此时间后过期</small>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; color: #4b5563; font-size: 14px;">缓存容量限制（MB）</label>
                            <select id="maxCacheSize" 
                                style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                                <option value="${10 * 1024 * 1024}" ${config.maxCacheSize === 10 * 1024 * 1024 ? 'selected' : ''}>10 MB</option>
                                <option value="${30 * 1024 * 1024}" ${config.maxCacheSize === 30 * 1024 * 1024 ? 'selected' : ''}>30 MB</option>
                                <option value="${50 * 1024 * 1024}" ${config.maxCacheSize === 50 * 1024 * 1024 ? 'selected' : ''}>50 MB</option>
                                <option value="${100 * 1024 * 1024}" ${config.maxCacheSize === 100 * 1024 * 1024 ? 'selected' : ''}>100 MB</option>
                                <option value="${200 * 1024 * 1024}" ${config.maxCacheSize === 200 * 1024 * 1024 ? 'selected' : ''}>200 MB</option>
                            </select>
                            <small style="color: #6b7280; font-size: 12px;">超出此容量后自动清理最旧的缓存</small>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 12px;">
                        <button id="saveConfig" 
                            style="flex: 1; padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; transition: opacity 0.2s;">
                            保存配置
                        </button>
                        <button id="closePanel" 
                            style="flex: 1; padding: 10px 20px; background: #e5e7eb; color: #374151; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; transition: background 0.2s;">
                            关闭
                        </button>
                    </div>
                </div>
                
                <div id="cache-tab" style="padding: 0 24px 24px; display: none;">
                    <div style="margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h3 style="margin: 0; font-size: 16px; color: #374151;">缓存列表</h3>
                            <div style="display: flex; gap: 8px;">
                                <button id="refreshCache" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">刷新</button>
                                <button id="clearAllCache" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">清空全部</button>
                            </div>
                        </div>
                        <div id="cache-stats" style="padding: 12px; background: #f3f4f6; border-radius: 6px; margin-bottom: 16px; font-size: 13px; color: #4b5563;">
                            <div>统计信息加载中...</div>
                        </div>
                        <div id="cache-list" style="max-height: 300px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px;">
                            <div style="padding: 20px; text-align: center; color: #9ca3af;">加载中...</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button id="closePanelCache" 
                            style="flex: 1; padding: 10px 20px; background: #e5e7eb; color: #374151; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; transition: background 0.2s;">
                            关闭
                        </button>
                    </div>
                </div>
            `;

            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            setTimeout(() => {
                overlay.style.opacity = '1';
                panel.style.transform = 'translateY(0)';
            }, 10);

            // 标签页切换
            const tabBtns = panel.querySelectorAll('.tab-btn');
            const configTab = panel.querySelector('#config-tab');
            const cacheTab = panel.querySelector('#cache-tab');
            
            tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tab = btn.dataset.tab;
                    tabBtns.forEach(b => {
                        b.style.borderBottom = '2px solid transparent';
                        b.style.color = '#6b7280';
                        b.style.fontWeight = 'normal';
                    });
                    btn.style.borderBottom = '2px solid #667eea';
                    btn.style.color = '#667eea';
                    btn.style.fontWeight = '600';
                    
                    if (tab === 'config') {
                        configTab.style.display = 'block';
                        cacheTab.style.display = 'none';
                    } else {
                        configTab.style.display = 'none';
                        cacheTab.style.display = 'block';
                        this.loadCacheList();
                    }
                });
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closePanel(overlay);
            });

            panel.querySelector('#saveConfig').addEventListener('click', () => this.saveConfig(overlay));
            panel.querySelector('#closePanel').addEventListener('click', () => this.closePanel(overlay));
            panel.querySelector('#closePanelCache').addEventListener('click', () => this.closePanel(overlay));
            panel.querySelector('#refreshCache').addEventListener('click', () => this.loadCacheList());
            panel.querySelector('#clearAllCache').addEventListener('click', () => this.clearAllCaches());
            
            const saveBtn = panel.querySelector('#saveConfig');
            saveBtn.addEventListener('mouseenter', () => saveBtn.style.opacity = '0.9');
            saveBtn.addEventListener('mouseleave', () => saveBtn.style.opacity = '1');
            
            const closeBtn = panel.querySelector('#closePanel');
            closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = '#d1d5db');
            closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = '#e5e7eb');

            this.panel = overlay;
        }

        togglePanel() {
            if (this.panel) {
                this.closePanel(this.panel);
            } else {
                this.createPanel();
            }
        }

        closePanel(overlay) {
            overlay.style.opacity = '0';
            overlay.querySelector('div').style.transform = 'translateY(-20px)';
            setTimeout(() => {
                overlay.remove();
                this.panel = null;
            }, 300);
        }

        saveConfig(overlay) {
            const initialLoadPages = parseInt(document.getElementById('initialLoadPages').value);
            const preloadPages = parseInt(document.getElementById('preloadPages').value);
            const cacheExpireTime = parseInt(document.getElementById('cacheExpireTime').value);
            const pageLoadInterval = parseInt(document.getElementById('pageLoadInterval').value);
            const maxCacheSize = parseInt(document.getElementById('maxCacheSize').value);

            if (initialLoadPages < 1 || initialLoadPages > 50) {
                this.showToast('初始加载页数必须在1-50之间', 'error');
                return;
            }

            if (preloadPages < 0 || preloadPages > 100) {
                this.showToast('预加载页数必须在0-100之间', 'error');
                return;
            }

            if (pageLoadInterval < 500 || pageLoadInterval > 5000) {
                this.showToast('页面读取间隔必须在500-5000毫秒之间', 'error');
                return;
            }

            const success = this.configManager.saveConfig({
                initialLoadPages,
                preloadPages,
                cacheExpireTime,
                pageLoadInterval,
                maxCacheSize
            });

            if (success) {
                this.showToast('配置保存成功！刷新页面后生效', 'success');
                setTimeout(() => this.closePanel(overlay), 1500);
            } else {
                this.showToast('配置保存失败', 'error');
            }
        }

        showToast(message, type = 'info') {
            const toast = document.createElement('div');
            const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
            toast.style.cssText = `
                position: fixed;
                top: 80px;
                left: 50%;
                transform: translateX(-50%) translateY(-20px);
                background: ${bgColor};
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 10002;
                opacity: 0;
                transition: all 0.3s ease;
            `;
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(-50%) translateY(0)';
            }, 10);

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(-20px)';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        loadCacheList() {
            try {
                const allKeys = this.getAllGMKeys();
                const threadMetas = [];
                let totalSize = 0;
                
                allKeys.forEach(key => {
                    if (key.startsWith('NGA_THREAD_META_')) {
                        try {
                            const data = GM_getValue(key);
                            if (data) {
                                const meta = JSON.parse(data);
                                const tid = key.replace('NGA_THREAD_META_', '');
                                const size = this.estimateCacheSize(tid, meta);
                                totalSize += size;
                                threadMetas.push({ tid, meta, size, key });
                            }
                        } catch (e) {
                            console.error('读取缓存失败:', key, e);
                        }
                    }
                });
                
                threadMetas.sort((a, b) => b.meta.lastAccess - a.meta.lastAccess);
                
                const statsDiv = document.getElementById('cache-stats');
                if (statsDiv) {
                    const config = this.configManager.getConfig();
                    const maxSize = config.maxCacheSize;
                    const usagePercent = (totalSize / maxSize * 100).toFixed(1);
                    const progressColor = usagePercent > 90 ? '#ef4444' : usagePercent > 70 ? '#f59e0b' : '#10b981';
                    
                    statsDiv.innerHTML = `
                        <div style="margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span>缓存帖子数：<strong>${threadMetas.length}</strong> 个</span>
                                <span>容量使用：<strong style="color: ${progressColor};">${this.formatSize(totalSize)}</strong> / ${this.formatSize(maxSize)}</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                                <div style="width: ${Math.min(usagePercent, 100)}%; height: 100%; background: ${progressColor}; transition: width 0.3s ease;"></div>
                            </div>
                            <div style="text-align: right; margin-top: 4px; font-size: 11px; color: #6b7280;">${usagePercent}% 已使用</div>
                        </div>
                    `;
                }
                
                const listDiv = document.getElementById('cache-list');
                if (listDiv) {
                    if (threadMetas.length === 0) {
                        listDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #9ca3af;">暂无缓存</div>';
                    } else {
                        listDiv.innerHTML = threadMetas.map(item => {
                            const lastAccessTime = this.formatTime(item.meta.lastAccess);
                            const isExpired = !this.isCacheValid(item.meta);
                            const statusColor = isExpired ? '#ef4444' : '#10b981';
                            const statusText = isExpired ? '已过期' : '有效';
                            const threadTitle = item.meta.title || '未命名帖子';
                            
                            return `
                                <div style="padding: 12px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 500; color: #1f2937; margin-bottom: 4px;">
                                            <a href="https://bbs.nga.cn/read.php?tid=${item.tid}" target="_blank" style="color: #3b82f6; text-decoration: none;">${threadTitle}</a>
                                        </div>
                                        <div style="font-size: 12px; color: #6b7280;">
                                            TID: ${item.tid} | 
                                            页数：${item.meta.cachedPages.length}/${item.meta.totalPages} | 
                                            大小：${this.formatSize(item.size)} | 
                                            最后访问：${lastAccessTime} |
                                            <span style="color: ${statusColor};">${statusText}</span>
                                        </div>
                                    </div>
                                    <button data-tid="${item.tid}" class="delete-cache-btn" style="padding: 4px 12px; background: #f3f4f6; color: #374151; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; transition: background 0.2s;">删除</button>
                                </div>
                            `;
                        }).join('');
                        
                        listDiv.querySelectorAll('.delete-cache-btn').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                const tid = e.target.dataset.tid;
                                this.deleteSingleCache(tid);
                            });
                            btn.addEventListener('mouseenter', () => {
                                btn.style.background = '#ef4444';
                                btn.style.color = 'white';
                            });
                            btn.addEventListener('mouseleave', () => {
                                btn.style.background = '#f3f4f6';
                                btn.style.color = '#374151';
                            });
                        });
                    }
                }
            } catch (e) {
                console.error('[缓存管理] 加载缓存列表失败:', e);
                const listDiv = document.getElementById('cache-list');
                if (listDiv) {
                    listDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">加载失败</div>';
                }
            }
        }

        getAllGMKeys() {
            const keys = [];
            
            // 遍历所有可能的 tid，检查是否存在元数据
            // 由于不能直接枚举 GM 存储的所有 key，我们使用另一种方法
            // 维护一个缓存 tid 列表
            try {
                const cacheIndexKey = 'NGA_CACHE_INDEX';
                const cacheIndex = GM_getValue(cacheIndexKey);
                
                if (cacheIndex) {
                    const tidList = JSON.parse(cacheIndex);
                    console.log('[缓存索引] 找到', tidList.length, '个帖子');
                    
                    tidList.forEach(tid => {
                        const metaKey = `NGA_THREAD_META_${tid}`;
                        if (GM_getValue(metaKey)) {
                            keys.push(metaKey);
                        }
                    });
                } else {
                    console.log('[缓存索引] 索引为空，尝试扫描常见 tid');
                    // 如果没有索引，尝试扫描一些可能的 tid
                    // 这是一个备用方案，但不靠谱
                    for (let i = 1000000; i < 100000000; i += 1000) {
                        const testKey = `NGA_THREAD_META_${i}`;
                        if (GM_getValue(testKey)) {
                            keys.push(testKey);
                        }
                        // 限制扫描范围，避免过久
                        if (keys.length > 100) break;
                    }
                }
            } catch (e) {
                console.error('[缓存索引] 读取失败:', e);
            }
            
            console.log('[缓存索引] 总共找到', keys.length, '个缓存 key');
            return keys;
        }

        estimateCacheSize(tid, meta) {
            let size = JSON.stringify(meta).length;
            if (meta.cachedPages) {
                meta.cachedPages.forEach(page => {
                    try {
                        const pageData = GM_getValue(`NGA_PAGE_CONTENT_${tid}_${page}`);
                        if (pageData) {
                            size += pageData.length;
                        }
                    } catch (e) {}
                });
            }
            return size;
        }

        formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        }

        formatTime(timestamp) {
            const now = Date.now();
            const diff = now - timestamp;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            
            if (minutes < 1) return '刚刚';
            if (minutes < 60) return minutes + '分钟前';
            if (hours < 24) return hours + '小时前';
            return days + '天前';
        }

        isCacheValid(meta) {
            const config = this.configManager.getConfig();
            if (config.cacheExpireTime === -1) return true;
            const now = Date.now();
            return (now - meta.lastAccess) < config.cacheExpireTime;
        }

        deleteSingleCache(tid) {
            if (!confirm(`确认删除帖子 #${tid} 的缓存？`)) return;
            
            try {
                const cacheMgr = new CacheManager(tid);
                cacheMgr.clearCache();
                this.showToast('删除成功', 'success');
                this.loadCacheList();
            } catch (e) {
                console.error('[缓存管理] 删除失败:', e);
                this.showToast('删除失败', 'error');
            }
        }

        clearAllCaches() {
            if (!confirm('确认清空所有缓存？此操作不可恢复！')) return;
            
            try {
                const allKeys = this.getAllGMKeys();
                let count = 0;
                
                allKeys.forEach(key => {
                    if (key.startsWith('NGA_THREAD_META_') || key.startsWith('NGA_PAGE_CONTENT_')) {
                        GM_setValue(key, null);
                        count++;
                    }
                });
                
                this.showToast(`已清空 ${count} 条缓存记录`, 'success');
                this.loadCacheList();
            } catch (e) {
                console.error('[缓存管理] 清空失败:', e);
                this.showToast('清空失败', 'error');
            }
        }
    }

    // ========== 全局变量 ==========
    // 从 URL 提取 tid，兼容多个 NGA 域名
    function extractTid() {
        const urlParams = new URLSearchParams(window.location.search);
        const tidFromParam = urlParams.get('tid');
        
        if (tidFromParam) {
            console.log('[TID 提取] 从 URL 参数获取 tid:', tidFromParam);
            return tidFromParam;
        }
        
        // 备用方案：从 URL 路径提取
        const match = window.location.href.match(/[?&]tid=(\d+)/);
        if (match) {
            console.log('[TID 提取] 从 URL 匹配获取 tid:', match[1]);
            return match[1];
        }
        
        console.warn('[TID 提取] 未能提取 tid');
        return null;
    }
    
    // 提取帖子标题
    function extractThreadTitle() {
        try {
            // 尝试多种方法提取标题
            // 方法1：从 h1.w100 中提取
            const h1Title = document.querySelector('h1.w100');
            if (h1Title && h1Title.textContent.trim()) {
                return h1Title.textContent.trim();
            }
            
            // 方法2：从 topicsubject 中提取
            const topicSubject = document.getElementById('topicsubject');
            if (topicSubject && topicSubject.textContent.trim()) {
                return topicSubject.textContent.trim();
            }
            
            // 方法3：从页面 title 中提取
            const pageTitle = document.title;
            if (pageTitle) {
                // 移除 NGA 后缀
                const cleanTitle = pageTitle.replace(/\s*-\s*NGA.*$/i, '').trim();
                if (cleanTitle) return cleanTitle;
            }
            
            // 方法4：从主楼 postsubject 中提取
            const mainPostSubject = document.querySelector('[id^="postsubject0"]');
            if (mainPostSubject && mainPostSubject.textContent.trim()) {
                return mainPostSubject.textContent.trim();
            }
            
            console.warn('[标题提取] 未找到帖子标题');
            return '未命名帖子';
        } catch (e) {
            console.error('[标题提取] 提取失败:', e);
            return '未命名帖子';
        }
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const isLoaderTab = urlParams.get('loader') === '1';
    const tid = extractTid();
    
    const configManager = new ConfigManager();
    const cacheManager = tid ? new CacheManager(tid) : null;
    const config = configManager.getConfig();
    
    console.log('[NGA 楼中楼] 初始化 - tid:', tid, 'isLoaderTab:', isLoaderTab);
    
    const loadedPages = new Set();
    let progressBar = null, progressLine2 = null;
    let isFinished = false;
    let isFirstConversion = true;
    let displayedPageCount = 0;
    let configPanel = null;
    let scrollHandler = null;
    let isLoadingMore = false;
    let allPagesLoaded = false;

    // 初始化配置面板（延迟创建，避免影响页面加载）
    if (!isLoaderTab) {
        setTimeout(() => {
            try {
                configPanel = new ConfigPanel(configManager, cacheManager);
                console.log('[配置面板] 已初始化');
            } catch (e) {
                console.error('[配置面板] 初始化失败:', e);
            }
        }, 3000);
    }

    // ========== 滚动追加加载 ==========
    function initScrollLoading() {
        let debounceTimer = null;
        
        scrollHandler = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            
            debounceTimer = setTimeout(() => {
                if (isLoadingMore || allPagesLoaded || isLoaderTab) return;
                
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const clientHeight = document.documentElement.clientHeight;
                const scrollHeight = document.documentElement.scrollHeight;
                
                const threshold = clientHeight * 2;
                
                if (scrollTop + clientHeight >= scrollHeight - threshold) {
                    console.log('[滚动加载] 触发加载更多');
                    loadMorePages();
                }
            }, 200);
        };
        
        window.addEventListener('scroll', scrollHandler);
        console.log('[滚动加载] 已初始化');
    }

    function loadMorePages() {
        if (!tid || !cacheManager) return;
        
        isLoadingMore = true;
        const meta = cacheManager.getMeta();
        if (!meta) {
            isLoadingMore = false;
            return;
        }
        
        const container = document.getElementById('m_posts_c');
        if (!container) {
            isLoadingMore = false;
            return;
        }
        
        const currentMaxPage = Math.max(...loadedPages);
        const nextPageStart = currentMaxPage + 1;
        const loadCount = config.initialLoadPages;
        const nextPageEnd = Math.min(nextPageStart + loadCount - 1, meta.totalPages);
        
        if (nextPageStart > meta.totalPages) {
            allPagesLoaded = true;
            isLoadingMore = false;
            showLoadComplete();
            return;
        }
        
        console.log(`[滚动加载] 加载第 ${nextPageStart}-${nextPageEnd} 页`);
        showLoadingIndicator();
        
        loadPagesRange(nextPageStart, nextPageEnd, meta.totalPages, container);
    }

    function loadPagesRange(startPage, endPage, totalPages, container) {
        let currentPage = startPage;
        
        function loadNext() {
            if (currentPage > endPage) {
                appendAndRenderNewPages(container);
                
                const preloadStart = endPage + 1;
                const preloadEnd = Math.min(preloadStart + config.preloadPages - 1, totalPages);
                
                if (preloadStart <= totalPages) {
                    console.log(`[滚动加载] 后台预加载第 ${preloadStart}-${preloadEnd} 页`);
                    loadPagesRange(preloadStart, preloadEnd, totalPages, container);
                }
                
                isLoadingMore = false;
                hideLoadingIndicator();
                return;
            }
            
            if (loadedPages.has(currentPage)) {
                currentPage++;
                loadNext();
                return;
            }
            
            const cachedContent = cacheManager.getPageContent(currentPage);
            if (cachedContent && cachedContent.rawHTML) {
                appendPosts(cachedContent.rawHTML, currentPage, container);
                loadedPages.add(currentPage);
                currentPage++;
                setTimeout(loadNext, 100);
            } else {
                const url = `${window.location.origin}/read.php?tid=${tid}&loader=1&page=${currentPage}`;
                GM_openInTab(url, { active: false });
                
                const page = currentPage;
                const key = `POSTS_${page}`;
                const check = setInterval(() => {
                    const html = GM_getValue(key);
                    if (html) {
                        clearInterval(check);
                        GM_setValue(key, null);
                        appendPosts(html, page, container);
                        loadedPages.add(page);
                        cacheManager.savePageContent(page, html);
                        
                        const meta = cacheManager.getMeta();
                        if (meta && !meta.cachedPages.includes(page)) {
                            meta.cachedPages.push(page);
                            cacheManager.saveMeta(meta);
                        }
                        
                        currentPage++;
                        setTimeout(loadNext, 100);
                    }
                }, config.pageLoadInterval);
                
                setTimeout(() => {
                    clearInterval(check);
                    if (!loadedPages.has(page)) {
                        console.warn(`[滚动加载] 第 ${page} 页加载超时`);
                        loadedPages.add(page);
                        currentPage++;
                        loadNext();
                    }
                }, 30000);
            }
        }
        
        loadNext();
    }

    function appendAndRenderNewPages(container) {
        console.log('[滚动加载] 重新渲染楼中楼结构');
        try {
            enableThreadedView();
        } catch (e) {
            console.error('[滚加载] 渲染错误:', e);
        }
    }

    function showLoadingIndicator() {
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
        indicator.style.display = 'block';
    }

    function hideLoadingIndicator() {
        const indicator = document.getElementById('nga-loading-more');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    function showLoadComplete() {
        const indicator = document.getElementById('nga-loading-more');
        if (indicator) {
            indicator.textContent = '已加载全部内容';
            indicator.style.background = 'rgba(16,185,129,0.9)';
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 3000);
        }
        
        if (scrollHandler) {
            window.removeEventListener('scroll', scrollHandler);
            console.log('[滚动加载] 已移除监听器');
        }
    }

    // 展开折叠内容
    function expandAllCollapses(container) {
        try {
            const buttons = container.querySelectorAll('button[name="collapseSwitchButton"]');
            console.log('[NGA 自动展开] 找到', buttons.length, '个折叠按钮');

            let expanded = 0;
            buttons.forEach(button => {
                try {
                    if (button.textContent === '+') {
                        button.click();
                        button.textContent = '-';
                        expanded++;
                    }
                } catch (e) {
                    console.warn('[NGA 自动展开] 按钮点击失败:', e);
                    const collapseDiv = button.parentNode.nextSibling;
                    if (collapseDiv && collapseDiv.classList.contains('collapse') && collapseDiv.style.display === 'none') {
                        collapseDiv.style.display = 'block';
                        button.textContent = '-';
                        expanded++;
                    }
                }
            });

            console.log('[NGA 自动展开] 完成展开', expanded, '个折叠');
        } catch (e) {
            console.error('[NGA 自动展开] 展开折叠失败:', e);
        }
    }

    // 进度条管理
    function createProgressBar() {
        progressBar = document.createElement('div');
        progressBar.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:white;padding:12px 20px;border-radius:12px;font-size:15px;font-weight:bold;text-align:center;z-index:9999;min-width:350px;box-shadow:0 4px 12px rgba(0,0,0,0.3);`;
        const line1 = document.createElement('div'); 
        line1.textContent = '楼中楼脚本正在运行，请稍候'; 
        line1.style.marginBottom = '6px';
        progressLine2 = document.createElement('div'); 
        progressLine2.textContent = '正在初始化...'; 
        progressLine2.style.fontWeight = 'normal'; 
        progressLine2.style.fontSize = '14px';
        progressLine2.style.marginBottom = '4px';
        
        // 添加详细进度信息
        const progressLine3 = document.createElement('div');
        progressLine3.id = 'progress-detail';
        progressLine3.style.fontWeight = 'normal';
        progressLine3.style.fontSize = '12px';
        progressLine3.style.color = '#d1d5db';
        progressLine3.style.display = 'none';
        
        progressBar.appendChild(line1); 
        progressBar.appendChild(progressLine2);
        progressBar.appendChild(progressLine3);
        document.body.appendChild(progressBar);
    }

    function updateProgressLine2(t) { 
        if (progressLine2) progressLine2.textContent = t; 
    }
    
    function updateProgressDetail(loaded, total, cached = 0) {
        const detailDiv = document.getElementById('progress-detail');
        if (detailDiv) {
            detailDiv.style.display = 'block';
            detailDiv.textContent = `已加载: ${loaded} 页 | 总页数: ${total} | 已缓存: ${cached} 页`;
        }
    }
    
    function hideProgressDetail() {
        const detailDiv = document.getElementById('progress-detail');
        if (detailDiv) {
            detailDiv.style.display = 'none';
        }
    }
    
    function removeAllPaginationElements() {
        try {
            // 移除所有分页相关元素
            const paginationIds = [
                'm_pbtntop',    // 主楼顶部分页
                'm_pbtnbtm',    // 主楼底部分页
                'pagebtop',     // 顶部分页按钮
                'pagebbtm'      // 底部分页按钮
            ];
            
            paginationIds.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.remove();
                    console.log(`[分页移除] 已移除 ${id}`);
                }
            });
            
            // 移除所有包含分页链接的容器
            document.querySelectorAll('.page').forEach(el => {
                if (el.textContent.includes('页') || el.querySelector('a[href*="page="]')) {
                    el.remove();
                    console.log('[分页移除] 已移除分页容器');
                }
            });
        } catch (e) {
            console.error('[分页移除] 移除失败:', e);
        }
    }
    
    function removeProgressBar() { 
        if (progressBar) { 
            progressBar.style.opacity = '0'; 
            setTimeout(() => progressBar?.parentNode?.removeChild(progressBar), 500); 
        } 
    }

    function showInitialProgress() {
        try {
            createProgressBar();
            const info = parsePageInfo();
            updateProgressLine2(`正在加载：第 ${info.currentPage} 页 / 共 ${info.totalPages} 页`);
            const container = document.getElementById('m_posts_c');
            if (container) {
                expandAllCollapses(container);
            } else {
                console.warn('[NGA 楼中楼] 未找到 m_posts_c 容器');
            }
        } catch (e) {
            console.error('[NGA 楼中楼] showInitialProgress 错误:', e);
        }
    }

    if (document.readyState === 'loading') {
        console.log('[NGA 楼中楼] 页面加载中，等待 DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', showInitialProgress);
    } else {
        console.log('[NGA 楼中楼] 页面已加载，直接执行 showInitialProgress');
        showInitialProgress();
    }

    if (!isLoaderTab) {
        setTimeout(initializeThreadView, 8000);
    } else {
        setTimeout(autoClickJump, 2000);
    }

    // 初始化帖子视图
    function initializeThreadView() {
        try {
            if (!tid || !cacheManager) {
                console.warn('[NGA 楼中楼] 未找到 tid 参数');
                return;
            }

            const info = parsePageInfo();
            const meta = cacheManager.getMeta();
            
            if (meta && cacheManager.isCacheValid(config.cacheExpireTime)) {
                console.log('[NGA 楼中楼] 命中缓存，加载缓存内容');
                loadFromCache(meta, info);
            } else {
                console.log('[NGA 楼中楼] 无缓存或缓存已过期，开始全新加载');
                if (meta) cacheManager.clearCache();
                startFreshLoading(info);
            }
        } catch (e) {
            console.error('[NGA 楼中楼] initializeThreadView 错误:', e);
        }
    }

    // 从缓存加载
    function loadFromCache(meta, info) {
        try {
            updateProgressLine2('正在加载缓存...');
            
            const container = document.getElementById('m_posts_c');
            if (!container) {
                console.warn('[NGA 楼中楼] 未找到 m_posts_c 容器');
                startFreshLoading(info);
                return;
            }

            const cachedPages = meta.cachedPages || [];
            console.log(`[缓存加载] 找到 ${cachedPages.length} 个缓存页面`);
            
            // 清空容器，避免重复
            container.innerHTML = '';
            
            cachedPages.sort((a, b) => a - b);
            for (const page of cachedPages) {
                const pageData = cacheManager.getPageContent(page);
                if (pageData && pageData.rawHTML) {
                    appendPosts(pageData.rawHTML, page, container);
                    loadedPages.add(page);
                }
            }

            cacheManager.updateLastAccess();
            displayedPageCount = cachedPages.length;
            updateProgressLine2('正在构建楼中楼...');
            
            setTimeout(() => {
                enableThreadedView();
                
                // 初始化滚动加载
                if (!isLoaderTab) {
                    setTimeout(initScrollLoading, 1000);
                }
                
                if (cachedPages.length < info.totalPages) {
                    const nextPage = Math.max(...cachedPages) + 1;
                    if (nextPage <= info.totalPages) {
                        updateProgressLine2(`后台加载中 ${nextPage}/${info.totalPages}`);
                        loadNextPage(nextPage, info.totalPages, tid, container, true);
                    } else {
                        setTimeout(removeProgressBar, 2000);
                    }
                } else {
                    setTimeout(removeProgressBar, 2000);
                }
            }, 500);
        } catch (e) {
            console.error('[NGA 楼中楼] loadFromCache 错误:', e);
            startFreshLoading(info);
        }
    }

    // 全新加载
    function startFreshLoading(info) {
        try {
            if (info.totalPages <= info.currentPage) {
                console.log('[NGA 楼中楼] 已最后一页');
                updateProgressLine2('已是最后一页');
                setTimeout(removeProgressBar, 2000);
                return;
            }
            
            const container = document.getElementById('m_posts_c');
            if (!container) {
                console.warn('[NGA 楼中楼] 未找到 m_posts_c 容器');
                updateProgressLine2('错误：未找到容器');
                setTimeout(removeProgressBar, 3000);
                return;
            }

            // 初始化元数据，当前页已经在页面上，直接缓存
            const threadTitle = extractThreadTitle();
            const meta = {
                tid: tid,
                title: threadTitle,
                totalPages: info.totalPages,
                cachedPages: [info.currentPage],
                lastAccess: Date.now(),
                cacheTime: Date.now()
            };
            
            // 缓存当前页内容
            cacheManager.savePageContent(info.currentPage, container.innerHTML);
            cacheManager.saveMeta(meta);
            loadedPages.add(info.currentPage);
            
            // 如果只有一页，直接转换
            if (info.totalPages === 1) {
                updateProgressLine2('正在构建楼中楼...');
                setTimeout(() => {
                    enableThreadedView();
                    if (!isLoaderTab) {
                        setTimeout(initScrollLoading, 1000);
                    }
                    setTimeout(removeProgressBar, 2000);
                }, config.pageLoadInterval);
                return;
            }
            
            updateProgressLine2(`正在加载：第 ${info.currentPage + 1} 页 / 共 ${info.totalPages} 页`);
            loadNextPage(info.currentPage + 1, info.totalPages, tid, container, false, meta);
        } catch (e) {
            console.error('[NGA 楼中楼] startFreshLoading 错误:', e);
        }
    }

    function parsePageInfo() {
        try {
            let totalPages = 1;
            let currentPage = parseInt(urlParams.get('page')) || 1;
            const links = document.querySelectorAll('#pagebtop a, #pagebbtm a');
            links.forEach(link => {
                const text = link.textContent.trim();
                const num = parseInt(text);
                if (!isNaN(num)) totalPages = Math.max(totalPages, num);
            });
            const lastPageLink = document.querySelector('#pagebtop a[title*="最后页"], #pagebbtm a[title*="最后页"]');
            if (lastPageLink) {
                const match = lastPageLink.href.match(/page=(\d+)/);
                if (match) {
                    const lastPage = parseInt(match[1]);
                    if (lastPage > totalPages) totalPages = lastPage;
                }
            }
            console.log('[NGA 楼中楼] 解析页面: 当前页', currentPage, '总页数', totalPages);
            return { totalPages, currentPage };
        } catch (e) {
            console.error('[NGA 楼中楼] parsePageInfo 错误:', e);
            return { totalPages: 1, currentPage: 1 };
        }
    }

    function loadNextPage(page, total, tid, container, isBackground = false, metaData = null) {
        try {
            if (loadedPages.has(page)) {
                if (page < total) {
                    loadNextPage(page + 1, total, tid, container, isBackground, metaData);
                } else {
                    finishLoading(container, metaData);
                }
                return;
            }
            
            const shouldConvert = !isBackground && isFirstConversion && loadedPages.size >= config.initialLoadPages;
            
            if (shouldConvert) {
                console.log(`[NGA 楼中楼] 已加载 ${loadedPages.size} 页，达到初始加载页数，开始转换`);
                performProgressiveConversion(container, metaData, page, total, tid);
                return;
            }
            
            updateProgressLine2(`正在加载：第 ${page} 页 / 共 ${total} 页`);
            const cachedCount = cacheManager ? (cacheManager.getMeta()?.cachedPages.length || 0) : 0;
            updateProgressDetail(loadedPages.size, total, cachedCount);

            const url = `${window.location.origin}/read.php?tid=${tid}&loader=1&page=${page}`;
            GM_openInTab(url, { active: false });

            const key = `POSTS_${page}`;
            const check = setInterval(() => {
                const html = GM_getValue(key);
                if (html) {
                    clearInterval(check);
                    GM_setValue(key, null);
                    appendPosts(html, page, container);
                    loadedPages.add(page);
                    
                    if (cacheManager) {
                        cacheManager.savePageContent(page, html);
                        const meta = metaData || cacheManager.getMeta() || { 
                            tid, 
                            totalPages: total, 
                            cachedPages: [], 
                            lastAccess: Date.now(), 
                            cacheTime: Date.now() 
                        };
                        if (!meta.cachedPages.includes(page)) {
                            meta.cachedPages.push(page);
                        }
                        cacheManager.saveMeta(meta);
                    }
                    
                    if (page < total) {
                        loadNextPage(page + 1, total, tid, container, isBackground, metaData);
                    } else {
                        finishLoading(container, metaData);
                    }
                }
            }, 500);

            setTimeout(() => {
                if (!loadedPages.has(page)) {
                    clearInterval(check);
                    loadedPages.add(page);
                    console.warn(`[NGA 楼中楼] 第 ${page} 页加载超时，跳过`);
                    if (page < total) {
                        loadNextPage(page + 1, total, tid, container, isBackground, metaData);
                    } else {
                        finishLoading(container, metaData);
                    }
                }
            }, 30000);
        } catch (e) {
            console.error('[NGA 楼中楼] loadNextPage 错误:', e);
        }
    }

    function performProgressiveConversion(container, metaData, nextPage, total, tid) {
        try {
            isFirstConversion = false;
            displayedPageCount = loadedPages.size;
            
            updateProgressLine2('正在构建楼中楼...');
            removeAllPaginationElements();
            
            setTimeout(() => {
                try {
                    enableThreadedView();
                    expandAllCollapses(container);
                    
                    // 初始化滚动加载
                    if (!isLoaderTab) {
                        setTimeout(initScrollLoading, 1000);
                    }
                    
                    const preloadLimit = displayedPageCount + config.preloadPages;
                    const actualLimit = Math.min(preloadLimit, total);
                    
                    if (nextPage <= actualLimit) {
                        updateProgressLine2(`后台加载中 ${nextPage}/${actualLimit}`);
                        loadNextPage(nextPage, actualLimit, tid, container, true, metaData);
                    } else {
                        updateProgressLine2(`完成！共 ${displayedPageCount} 页`);
                        setTimeout(removeProgressBar, 3000);
                    }
                } catch (e) {
                    console.error('[NGA 楼中楼] performProgressiveConversion 内部错误:', e);
                }
            }, 1000);
        } catch (e) {
            console.error('[NGA 楼中楼] performProgressiveConversion 错误:', e);
        }
    }

    function appendPosts(html, page, container) {
        try {
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = html;
            expandAllCollapses(tempContainer);
            const tables = tempContainer.querySelectorAll('table.forumbox.postbox');
            tables.forEach(t => container.appendChild(t.cloneNode(true)));
            console.log('[NGA 楼中楼] 第', page, '页追加', tables.length, '条');
        } catch (e) {
            console.error('[NGA 楼中楼] appendPosts 错误:', e);
        }
    }

    function finishLoading(container, metaData = null) {
        if (isFinished) return;
        isFinished = true;
        
        if (isFirstConversion) {
            updateProgressLine2('正在构建楼中楼...');
            removeAllPaginationElements();
            setTimeout(() => {
                try {
                    enableThreadedView();
                    expandAllCollapses(container);
                    updateProgressLine2(`完成！共 ${loadedPages.size} 页`);
                    
                    // 初始化滚动加载
                    if (!isLoaderTab) {
                        setTimeout(initScrollLoading, 1000);
                    }
                    
                    setTimeout(removeProgressBar, 3000);
                } catch (e) {
                    console.error('[NGA 楼中楼] finishLoading 错误:', e);
                }
            }, 1000);
        } else {
            updateProgressLine2(`后台加载完成！共 ${loadedPages.size} 页`);
            setTimeout(removeProgressBar, 3000);
        }
    }

    function autoClickJump() {
        try {
            if (document.body.innerHTML.includes('访客不能直接访问')) {
                if (window.g) { window.g(); return; }
                const link = document.querySelector('a[onclick="g()"]');
                if (link) { link.click(); setTimeout(extractPosts, 2000); return; }
                setAntiBotCookie();
                return;
            }
            extractPosts();
        } catch (e) {
            console.error('[NGA 楼中楼] autoClickJump 错误:', e);
        }
    }

    function setAntiBotCookie() {
        try {
            const now = Date.now();
            document.cookie = `guestJs=${Math.floor(now/1000)}_9c1cuj;domain=bbs.nga.cn;path=/;max-age=1800`;
            document.cookie = `lastpath=0;domain=bbs.nga.cn;path=/;max-age=0`;
            const url = new URL(window.location.href);
            url.searchParams.set('rand', Math.floor(Math.random() * 1000));
            setTimeout(() => window.location.replace(url.toString()), 300);
        } catch (e) {
            console.error('[NGA 楼中楼] setAntiBotCookie 错误:', e);
        }
    }

    function extractPosts() {
        try {
            const page = new URLSearchParams(window.location.search).get('page') || '1';
            const container = document.getElementById('m_posts_c');
            if (container) {
                expandAllCollapses(container);
                GM_setValue(`POSTS_${page}`, container.innerHTML);
                console.log('[NGA 楼中楼] 子页', page, '数据写入 GM_setValue');
                setTimeout(() => window.close(), 500);
            } else {
                console.warn('[NGA 楼中楼] 子页', page, '未找到 m_posts_c，稍后重试');
                setTimeout(extractPosts, 1000);
            }
        } catch (e) {
            console.error('[NGA 楼中楼] extractPosts 错误:', e);
        }
    }

    function enableThreadedView() {
        try {
            const style = document.createElement('style');
            style.textContent = `table.forumbox.postbox.indented > tbody > tr > td { background: #F2EDDF !important; }`;
            document.head.appendChild(style);

            const container = document.getElementById('m_posts_c');
            const all = Array.from(container.querySelectorAll('table.forumbox.postbox'));
            if (!all.length) {
                updateProgressLine2('无帖子');
                setTimeout(removeProgressBar, 2000);
                return;
            }

            const pidToFloor = {}, floorToPost = {};
            all.forEach(t => {
                const floor = t.querySelector('a[name^="l"]') ? parseInt(t.querySelector('a[name^="l"]').textContent.replace('#','')) || 0 : 0;
                const pid = t.querySelector('a[id^="pid"][id$="Anchor"]') ? t.querySelector('a[id^="pid"][id$="Anchor"]').id.replace('pid','').replace('Anchor','') : '0';
                pidToFloor[pid] = floor;
                floorToPost[floor] = { element: t, pid, children: [] };
            });

            let removed = 0;
            all.forEach(t => {
                const pid = t.querySelector('a[id^="pid"][id$="Anchor"]') ? t.querySelector('a[id^="pid"][id$="Anchor"]').id.replace('pid','').replace('Anchor','') : '0';
                const floor = pidToFloor[pid];
                let parent = 0, removeQuote = false;
                const quote = t.querySelector('div.quote');
                if (quote) {
                    const link = quote.querySelector('a[href*="topid="]');
                    if (link) { const p = link.href.match(/topid=(\d+)/)?.[1]; parent = p ? pidToFloor[p] : 0; removeQuote = true; removed++; }
                }
                floorToPost[floor].parentFloor = parent;
                if (parent !== floor && parent !== undefined && floorToPost[parent]) floorToPost[parent].children.push(floorToPost[floor]);
                if (removeQuote) floorToPost[floor].removeQuote = true;
            });

            const root = floorToPost[0];
            if (!root) {
                updateProgressLine2('错误：无主楼');
                setTimeout(removeProgressBar, 3000);
                return;
            }

            function sort(node) { if (node.children) { node.children.sort((a,b)=>a.floor-b.floor); node.children.forEach(sort); } }
            sort(root);

            renderThreadedView(root, container);
            updateProgressLine2(`完成！共 ${all.length} 条`);
            setTimeout(removeProgressBar, 3000);
        } catch (e) {
            console.error('[NGA 楼中楼] enableThreadedView 错误:', e);
        }
    }

    function renderThreadedView(root, container) {
        try {
            container.innerHTML = '';
            function render(post, level = 0) {
                const dl = (post.floor === 0 || post.parentFloor === 0) ? 0 : level;
                if (post.removeQuote) { const q = post.element.querySelector('div.quote'); if (q) q.remove(); }
                if (dl > 0) {
                    const c1 = post.element.querySelector('td.c1');
                    if (c1) { const info = c1.querySelector('div[style*="text-align:left;line-height:1.5em"]'); if (info) { c1.innerHTML = ''; c1.appendChild(info.cloneNode(true)); } }
                }
                if (dl > 0) {
                    const c2 = post.element.querySelector('td.c2');
                    if (c2) {
                        ['.postInfo', '.goodbad', `[id^="postsubject"]`, '.x'].forEach(s => {
                            const el = c2.querySelector(s);
                            if (el) {
                                if (s.includes('postsubject') && el.textContent.trim() === '') el.style.display = 'none';
                                else if (s !== '.postInfo') el.style.display = 'none';
                                else { el.style.lineHeight = '1.2'; el.style.margin = '2px 0'; }
                            }
                        });
                        const content = c2.querySelector(`[id^="postcontent"]`);
                        if (content) { content.style.margin = '4px 0'; content.style.lineHeight = '1.45'; }
                    }
                }
                if (dl > 0) {
                    post.element.classList.add('indented');
                    const t = post.element;
                    t.style.border = '1px solid #fff';
                    t.style.borderRadius = '6px';
                    t.style.overflow = 'hidden';
                    t.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                }
                const wrapper = document.createElement('div');
                wrapper.style.marginLeft = `${dl * 20}px`;
                wrapper.style.marginBottom = '8px';
                wrapper.appendChild(post.element.cloneNode(true));
                container.appendChild(wrapper);
                post.children.forEach(c => render(c, level + 1));
            }
            render(root, 0);
        } catch (e) {
            console.error('[NGA 楼中楼] renderThreadedView 错误:', e);
        }
    }
})();

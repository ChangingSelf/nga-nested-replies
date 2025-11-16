// ========== 配置面板 UI ==========

import Toast from './toast.js';

/**
 * 配置面板组件
 */
class ConfigPanel {
    constructor(configManager, storageManager) {
        this.configManager = configManager;
        this.storageManager = storageManager;
        this.panel = null;
    }

    /**
     * 创建面板
     */
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
                
                <div style="margin-bottom: 24px;">
                    <h3 style="margin: 0 0 16px; font-size: 16px; color: #374151;">性能优化</h3>
                    <div style="margin-bottom: 16px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="useVirtualScroll" ${config.useVirtualScroll !== false ? 'checked' : ''}
                                style="width: 18px; height: 18px; margin-right: 8px; cursor: pointer;" />
                            <span style="color: #4b5563; font-size: 14px;">启用虚拟滚动（推荐）</span>
                        </label>
                        <small style="color: #6b7280; font-size: 12px; margin-left: 26px; display: block;">只渲染可见区域的楼层，大幅减少卡顿，适合500楼以上的长帖</small>
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; color: #4b5563; font-size: 14px;">虚拟滚动缓冲区大小</label>
                        <input type="number" id="virtualScrollBufferSize" value="${config.virtualScrollBufferSize || 10}" min="5" max="30" 
                            style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" />
                        <small style="color: #6b7280; font-size: 12px;">视口上下额外渲染的楼层数，越大滚动越流畅但内存占用越高（5-30）</small>
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

    /**
     * 切换面板显示
     */
    togglePanel() {
        if (this.panel) {
            this.closePanel(this.panel);
        } else {
            this.createPanel();
        }
    }

    /**
     * 关闭面板
     */
    closePanel(overlay) {
        overlay.style.opacity = '0';
        overlay.querySelector('div').style.transform = 'translateY(-20px)';
        setTimeout(() => {
            overlay.remove();
            this.panel = null;
        }, 300);
    }

    /**
     * 保存配置
     */
    saveConfig(overlay) {
        const initialLoadPages = parseInt(document.getElementById('initialLoadPages').value);
        const preloadPages = parseInt(document.getElementById('preloadPages').value);
        const cacheExpireTime = parseInt(document.getElementById('cacheExpireTime').value);
        const pageLoadInterval = parseInt(document.getElementById('pageLoadInterval').value);
        const maxCacheSize = parseInt(document.getElementById('maxCacheSize').value);
        const useVirtualScroll = document.getElementById('useVirtualScroll').checked;
        const virtualScrollBufferSize = parseInt(document.getElementById('virtualScrollBufferSize').value);

        if (initialLoadPages < 1 || initialLoadPages > 50) {
            Toast.error('初始加载页数必须在1-50之间');
            return;
        }

        if (preloadPages < 0 || preloadPages > 100) {
            Toast.error('预加载页数必须在0-100之间');
            return;
        }

        if (pageLoadInterval < 500 || pageLoadInterval > 5000) {
            Toast.error('页面读取间隔必须在500-5000毫秒之间');
            return;
        }

        if (virtualScrollBufferSize < 5 || virtualScrollBufferSize > 30) {
            Toast.error('虚拟滚动缓冲区大小必须在5-30之间');
            return;
        }

        const success = this.configManager.saveConfig({
            initialLoadPages,
            preloadPages,
            cacheExpireTime,
            pageLoadInterval,
            maxCacheSize,
            useVirtualScroll,
            virtualScrollBufferSize
        });

        if (success) {
            Toast.success('配置保存成功！刷新页面后生效');
            setTimeout(() => this.closePanel(overlay), 1500);
        } else {
            Toast.error('配置保存失败');
        }
    }

    /**
     * 加载缓存列表
     */
    async loadCacheList() {
        try {
            const threadMetas = await this.storageManager.getAllCachedThreads();
            let totalSize = 0;

            // 计算总大小
            for (const meta of threadMetas) {
                let size = JSON.stringify(meta).length * 2;
                if (meta.cachedPages) {
                    for (const page of meta.cachedPages) {
                        const pageContent = await this.storageManager.getPageContent(meta.tid, page);
                        if (pageContent) {
                            size += JSON.stringify(pageContent).length * 2;
                        }
                    }
                }
                meta.size = size;
                totalSize += size;
            }

            // 按访问时间排序
            threadMetas.sort((a, b) => b.lastAccess - a.lastAccess);

            // 更新统计信息
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

            // 更新列表
            const listDiv = document.getElementById('cache-list');
            if (listDiv) {
                if (threadMetas.length === 0) {
                    listDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #9ca3af;">暂无缓存</div>';
                } else {
                    listDiv.innerHTML = threadMetas.map(item => {
                        const lastAccessTime = this.formatTime(item.lastAccess);
                        const isExpired = !this.isCacheValid(item);
                        const statusColor = isExpired ? '#ef4444' : '#10b981';
                        const statusText = isExpired ? '已过期' : '有效';
                        const threadTitle = item.title || '未命名帖子';
                        
                        return `
                            <div style="padding: 12px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 500; color: #1f2937; margin-bottom: 4px;">
                                        <a href="https://bbs.nga.cn/read.php?tid=${item.tid}" target="_blank" style="color: #3b82f6; text-decoration: none;">${threadTitle}</a>
                                    </div>
                                    <div style="font-size: 12px; color: #6b7280;">
                                        TID: ${item.tid} | 
                                        页数：${item.cachedPages.length}/${item.totalPages} | 
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
            console.error('[ConfigPanel] 加载缓存列表失败:', e);
            const listDiv = document.getElementById('cache-list');
            if (listDiv) {
                listDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">加载失败</div>';
            }
        }
    }

    /**
     * 删除单个缓存
     */
    async deleteSingleCache(tid) {
        if (!confirm(`确认删除帖子 #${tid} 的缓存？`)) return;
        
        try {
            await this.storageManager.clearThreadCache(tid);
            Toast.success('删除成功');
            this.loadCacheList();
        } catch (e) {
            console.error('[ConfigPanel] 删除失败:', e);
            Toast.error('删除失败');
        }
    }

    /**
     * 清空所有缓存
     */
    async clearAllCaches() {
        if (!confirm('确认清空所有缓存？此操作不可恢复！')) return;
        
        try {
            const threadMetas = await this.storageManager.getAllCachedThreads();
            let count = 0;

            for (const meta of threadMetas) {
                await this.storageManager.clearThreadCache(meta.tid);
                count++;
            }

            Toast.success(`已清空 ${count} 个帖子缓存`);
            this.loadCacheList();
        } catch (e) {
            console.error('[ConfigPanel] 清空失败:', e);
            Toast.error('清空失败');
        }
    }

    /**
     * 格式化大小
     */
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    /**
     * 格式化时间
     */
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

    /**
     * 检查缓存是否有效
     */
    isCacheValid(meta) {
        const config = this.configManager.getConfig();
        if (config.cacheExpireTime === -1) return true;
        const now = Date.now();
        return (now - meta.lastAccess) < config.cacheExpireTime;
    }
}

export default ConfigPanel;

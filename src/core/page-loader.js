// ========== 页面加载器 ==========

import ThreadParser from './thread-parser.js';
import ThreadRenderer from './thread-renderer.js';
import { measure } from '../utils/performance.js';

/**
 * 页面加载器
 * 管理多页面加载策略、缓存读取、后台预加载
 */
class PageLoader {
    constructor(tid, storageManager, config, progressCallback) {
        this.tid = tid;
        this.storageManager = storageManager;
        this.config = config;
        this.progressCallback = progressCallback || (() => {});
        this.loadedPages = new Set();
        this.parser = new ThreadParser(config);
        this.renderer = new ThreadRenderer(config, storageManager);
        this.isFirstConversion = true;
    }

    /**
     * 初始化加载器
     * @param {Object} pageInfo - 页面信息 { currentPage, totalPages }
     * @param {HTMLElement} container - 容器元素
     * @returns {Promise<void>}
     */
    async initialize(pageInfo, container) {
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
     * @param {Object} meta
     * @returns {boolean}
     */
    isCacheValid(meta) {
        if (!meta) return false;
        if (this.config.cacheExpireTime === -1) return true;
        const now = Date.now();
        return (now - meta.lastAccess) < this.config.cacheExpireTime;
    }

    /**
     * 从缓存加载
     * @param {Object} meta
     * @param {Object} pageInfo
     * @param {HTMLElement} container
     * @returns {Promise<void>}
     */
    async loadFromCache(meta, pageInfo, container) {
        try {
            this.progressCallback('🔄 正在从缓存加载...', 0, meta.totalPages);

            // 清空容器
            container.innerHTML = '';
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
                const pageContent = await this.storageManager.getPageContent(this.tid, page);
                if (pageContent && pageContent.rawHTML) {
                    this.appendPosts(pageContent.rawHTML, page, container);
                    this.loadedPages.add(page);
                }
            }

            // 更新访问时间
            await this.storageManager.updateLastAccess(this.tid);

            this.progressCallback('🔄 缓存加载中 - 正在构建楼中楼...', cachedPages.length, meta.totalPages);

            // 解析和渲染
            await this.parseAndRender(container);

            this.progressCallback(`✅ 缓存加载完成，共 ${cachedPages.length} 页`, cachedPages.length, meta.totalPages);

            // 如果还有未缓存的页面，后台加载
            if (cachedPages.length < meta.totalPages) {
                const nextPage = Math.max(...cachedPages) + 1;
                if (nextPage <= meta.totalPages) {
                    setTimeout(() => {
                        this.loadRemainingPages(nextPage, meta.totalPages, container);
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
     * @param {Object} pageInfo
     * @param {HTMLElement} container
     * @returns {Promise<void>}
     */
    async loadFreshPages(pageInfo, container) {
        try {
            const { currentPage, totalPages } = pageInfo;

            // 初始化元数据
            const meta = {
                tid: this.tid,
                title: this.extractThreadTitle(),
                totalPages: totalPages,
                cachedPages: [currentPage],
                lastAccess: Date.now(),
                cacheTime: Date.now()
            };

            // 缓存当前页
            await this.storageManager.savePageContent(this.tid, currentPage, container.innerHTML);
            await this.storageManager.saveThreadMeta(this.tid, meta);
            this.loadedPages.add(currentPage);

            // 如果只有一页，直接渲染
            if (totalPages === 1) {
                this.progressCallback('📥 正在构建楼中楼...', 1, 1);
                await this.parseAndRender(container);
                this.progressCallback('✅ 完成！共 1 页', 1, 1);
                return;
            }

            // 加载更多页面
            const targetPage = Math.min(currentPage + this.config.initialLoadPages, totalPages);
            this.progressCallback(`📥 全新加载：第 ${currentPage + 1} 页 / 共 ${totalPages} 页`, currentPage, totalPages);

            await this.loadPageRange(currentPage + 1, targetPage, totalPages, container, meta);
        } catch (e) {
            console.error('[PageLoader] 全新加载失败:', e);
            this.progressCallback('❌ 加载失败', 0, 0);
        }
    }

    /**
     * 加载页面范围
     * @param {number} startPage
     * @param {number} endPage
     * @param {number} totalPages
     * @param {HTMLElement} container
     * @param {Object} meta
     * @returns {Promise<void>}
     */
    async loadPageRange(startPage, endPage, totalPages, container, meta) {
        for (let page = startPage; page <= endPage; page++) {
            if (this.loadedPages.has(page)) continue;

            try {
                this.progressCallback(`📥 加载中：第 ${page} 页 / 共 ${totalPages} 页`, this.loadedPages.size, totalPages);

                const html = await this.loadSinglePage(page);
                if (html) {
                    this.appendPosts(html, page, container);
                    this.loadedPages.add(page);

                    // 保存到缓存
                    await this.storageManager.savePageContent(this.tid, page, html);
                    
                    const currentMeta = await this.storageManager.getThreadMeta(this.tid) || meta;
                    if (!currentMeta.cachedPages.includes(page)) {
                        currentMeta.cachedPages.push(page);
                    }
                    await this.storageManager.saveThreadMeta(this.tid, currentMeta);
                }

                // 检查是否达到初始加载阈值
                if (this.isFirstConversion && this.loadedPages.size >= this.config.initialLoadPages) {
                    console.log(`[PageLoader] 已加载 ${this.loadedPages.size} 页，开始转换`);
                    await this.performProgressiveConversion(container, totalPages, endPage + 1);
                    return;
                }
            } catch (e) {
                console.error(`[PageLoader] 加载第 ${page} 页失败:`, e);
            }
        }

        // 完成加载
        if (this.isFirstConversion) {
            await this.parseAndRender(container);
            this.progressCallback(`✅ 完成！共 ${this.loadedPages.size} 页`, this.loadedPages.size, totalPages);
        }

        // 继续后台预加载
        if (endPage < totalPages) {
            const nextStart = endPage + 1;
            const nextEnd = Math.min(nextStart + this.config.preloadPages - 1, totalPages);
            setTimeout(() => {
                this.loadRemainingPages(nextStart, totalPages, container);
            }, 1000);
        }
    }

    /**
     * 加载单个页面
     * @param {number} page
     * @returns {Promise<string>}
     */
    loadSinglePage(page) {
        return new Promise((resolve, reject) => {
            const url = `${window.location.origin}/read.php?tid=${this.tid}&loader=1&page=${page}`;
            GM_openInTab(url, { active: false });

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
     * @param {string} html
     * @param {number} page
     * @param {HTMLElement} container
     */
    appendPosts(html, page, container) {
        try {
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = html;
            
            // 展开折叠内容
            this.expandCollapses(tempContainer);

            const tables = tempContainer.querySelectorAll('table.forumbox.postbox');
            tables.forEach(t => container.appendChild(t.cloneNode(true)));
            
            console.log(`[PageLoader] 第 ${page} 页追加 ${tables.length} 条帖子`);
        } catch (e) {
            console.error(`[PageLoader] 追加第 ${page} 页失败:`, e);
        }
    }

    /**
     * 展开折叠内容
     * @param {HTMLElement} container
     */
    expandCollapses(container) {
        try {
            const buttons = container.querySelectorAll('button[name="collapseSwitchButton"]');
            buttons.forEach(button => {
                try {
                    if (button.textContent === '+') {
                        button.click();
                        button.textContent = '-';
                    }
                } catch (e) {
                    const collapseDiv = button.parentNode?.nextSibling;
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
     * @param {HTMLElement} container
     * @returns {Promise<void>}
     */
    async parseAndRender(container) {
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
     * @param {HTMLElement} container
     * @param {number} totalPages
     * @param {number} nextPage
     * @returns {Promise<void>}
     */
    async performProgressiveConversion(container, totalPages, nextPage) {
        this.isFirstConversion = false;

        this.progressCallback('🔨 正在构建楼中楼...', this.loadedPages.size, totalPages);

        // 移除分页元素
        this.removeAllPaginationElements();

        // 解析和渲染
        await this.parseAndRender(container);

        this.progressCallback(`✅ 显示完成，共 ${this.loadedPages.size} 页`, this.loadedPages.size, totalPages);

        // 继续后台加载
        if (nextPage <= totalPages) {
            const preloadEnd = Math.min(nextPage + this.config.preloadPages - 1, totalPages);
            setTimeout(() => {
                this.loadRemainingPages(nextPage, totalPages, container);
            }, 1000);
        }
    }

    /**
     * 加载剩余页面
     * @param {number} startPage
     * @param {number} totalPages
     * @param {HTMLElement} container
     * @returns {Promise<void>}
     */
    async loadRemainingPages(startPage, totalPages, container) {
        const endPage = totalPages;
        
        for (let page = startPage; page <= endPage; page++) {
            if (this.loadedPages.has(page)) continue;

            try {
                this.progressCallback(`⏬ 后台加载 ${page}/${totalPages}`, this.loadedPages.size, totalPages);

                const html = await this.loadSinglePage(page);
                if (html) {
                    this.loadedPages.add(page);

                    // 保存到缓存
                    await this.storageManager.savePageContent(this.tid, page, html);
                    
                    const meta = await this.storageManager.getThreadMeta(this.tid);
                    if (meta && !meta.cachedPages.includes(page)) {
                        meta.cachedPages.push(page);
                        await this.storageManager.saveThreadMeta(this.tid, meta);
                    }
                }
            } catch (e) {
                console.error(`[PageLoader] 后台加载第 ${page} 页失败:`, e);
            }
        }

        this.progressCallback(`✅ 后台加载完成！共 ${this.loadedPages.size} 页`, this.loadedPages.size, totalPages);
    }

    /**
     * 移除所有分页元素
     */
    removeAllPaginationElements() {
        try {
            const paginationIds = ['m_pbtntop', 'm_pbtnbtm', 'pagebtop', 'pagebbtm'];
            paginationIds.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.remove();
                }
            });

            document.querySelectorAll('.page').forEach(el => {
                if (el.textContent.includes('页') || el.querySelector('a[href*="page="]')) {
                    el.remove();
                }
            });
        } catch (e) {
            console.error('[PageLoader] 移除分页元素失败:', e);
        }
    }

    /**
     * 提取帖子标题
     * @returns {string}
     */
    extractThreadTitle() {
        try {
            const h1Title = document.querySelector('h1.w100');
            if (h1Title && h1Title.textContent.trim()) {
                return h1Title.textContent.trim();
            }

            const topicSubject = document.getElementById('topicsubject');
            if (topicSubject && topicSubject.textContent.trim()) {
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
}

export default PageLoader;

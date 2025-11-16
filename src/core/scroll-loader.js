// ========== 滚动加载管理器 ==========

import { debounce } from '../utils/performance.js';

/**
 * 滚动加载管理器
 * 监听滚动事件，触发懒加载更多内容
 */
class ScrollLoader {
    constructor(pageLoader, config) {
        this.pageLoader = pageLoader;
        this.config = config || {};
        this.isLoadingMore = false;
        this.allPagesLoaded = false;
        this.scrollHandler = null;
        this.threshold = 2; // 距底部2个屏幕高度触发
    }

    /**
     * 初始化滚动监听
     * @param {number} totalPages
     */
    initialize(totalPages) {
        this.totalPages = totalPages;
        
        // 创建防抖的滚动处理函数
        this.scrollHandler = debounce(() => {
            this.handleScroll();
        }, 200);

        window.addEventListener('scroll', this.scrollHandler);
        console.log('[ScrollLoader] 已初始化滚动加载');
    }

    /**
     * 处理滚动事件
     */
    handleScroll() {
        if (this.isLoadingMore || this.allPagesLoaded) {
            return;
        }

        if (this.checkLoadMore()) {
            console.log('[ScrollLoader] 触发加载更多');
            this.triggerLoadMore();
        }
    }

    /**
     * 检查是否需要加载更多
     * @returns {boolean}
     */
    checkLoadMore() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const clientHeight = document.documentElement.clientHeight;
        const scrollHeight = document.documentElement.scrollHeight;

        const threshold = clientHeight * this.threshold;
        
        return scrollTop + clientHeight >= scrollHeight - threshold;
    }

    /**
     * 触发加载更多
     */
    async triggerLoadMore() {
        if (!this.pageLoader || !this.pageLoader.tid) {
            return;
        }

        this.isLoadingMore = true;
        this.showLoadingIndicator();

        try {
            const meta = await this.pageLoader.storageManager.getThreadMeta(this.pageLoader.tid);
            if (!meta) {
                this.isLoadingMore = false;
                this.hideLoadingIndicator();
                return;
            }

            const container = document.getElementById('m_posts_c');
            if (!container) {
                this.isLoadingMore = false;
                this.hideLoadingIndicator();
                return;
            }

            const currentMaxPage = Math.max(...this.pageLoader.loadedPages);
            const nextPageStart = currentMaxPage + 1;
            const loadCount = this.config.initialLoadPages || 5;
            const nextPageEnd = Math.min(nextPageStart + loadCount - 1, meta.totalPages);

            if (nextPageStart > meta.totalPages) {
                this.allPagesLoaded = true;
                this.isLoadingMore = false;
                this.showLoadComplete();
                return;
            }

            console.log(`[ScrollLoader] 加载第 ${nextPageStart}-${nextPageEnd} 页`);

            // 加载页面范围
            await this.loadPagesRange(nextPageStart, nextPageEnd, meta.totalPages, container);

        } catch (e) {
            console.error('[ScrollLoader] 加载更多失败:', e);
        } finally {
            this.isLoadingMore = false;
            this.hideLoadingIndicator();
        }
    }

    /**
     * 加载页面范围
     * @param {number} startPage
     * @param {number} endPage
     * @param {number} totalPages
     * @param {HTMLElement} container
     */
    async loadPagesRange(startPage, endPage, totalPages, container) {
        for (let page = startPage; page <= endPage; page++) {
            if (this.pageLoader.loadedPages.has(page)) continue;

            try {
                const html = await this.pageLoader.loadSinglePage(page);
                if (html) {
                    this.pageLoader.appendPosts(html, page, container);
                    this.pageLoader.loadedPages.add(page);

                    // 保存到缓存
                    await this.pageLoader.storageManager.savePageContent(this.pageLoader.tid, page, html);
                    
                    const meta = await this.pageLoader.storageManager.getThreadMeta(this.pageLoader.tid);
                    if (meta && !meta.cachedPages.includes(page)) {
                        meta.cachedPages.push(page);
                        await this.pageLoader.storageManager.saveThreadMeta(this.pageLoader.tid, meta);
                    }
                }
            } catch (e) {
                console.error(`[ScrollLoader] 加载第 ${page} 页失败:`, e);
            }
        }

        // 重新渲染
        await this.pageLoader.parseAndRender(container);

        // 继续预加载
        if (endPage < totalPages) {
            const preloadStart = endPage + 1;
            const preloadEnd = Math.min(preloadStart + (this.config.preloadPages || 10) - 1, totalPages);
            
            if (preloadStart <= totalPages) {
                setTimeout(() => {
                    this.loadPagesRange(preloadStart, preloadEnd, totalPages, container);
                }, 1000);
            }
        }
    }

    /**
     * 显示加载指示器
     */
    showLoadingIndicator() {
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

    /**
     * 隐藏加载指示器
     */
    hideLoadingIndicator() {
        const indicator = document.getElementById('nga-loading-more');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * 显示加载完成
     */
    showLoadComplete() {
        const indicator = document.getElementById('nga-loading-more');
        if (indicator) {
            indicator.textContent = '已加载全部内容';
            indicator.style.background = 'rgba(16,185,129,0.9)';
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 3000);
        }

        // 移除滚动监听
        this.destroy();
    }

    /**
     * 销毁滚动监听器
     */
    destroy() {
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
            this.scrollHandler = null;
            console.log('[ScrollLoader] 已移除监听器');
        }
    }
}

export default ScrollLoader;

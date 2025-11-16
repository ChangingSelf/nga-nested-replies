// ========== 虚拟滚动渲染器 ==========

import { measure } from '../utils/performance.js';
import { debounce } from '../utils/performance.js';
import ReplyCollapser from '../ui/reply-collapser.js';

/**
 * 虚拟滚动渲染器
 * 只渲染可见区域的楼层，大幅减少DOM节点数量
 */
class VirtualRenderer {
    constructor(config, storageManager) {
        this.config = config || {};
        this.storageManager = storageManager;
        this.replyCollapser = new ReplyCollapser(storageManager, config);
        
        // 虚拟滚动配置
        this.bufferSize = config.virtualScrollBufferSize || 10; // 视口上下额外渲染的楼层数
        this.itemHeight = 200; // 预估每个楼层的高度（像素）
        this.viewportHeight = window.innerHeight;
        
        // 数据
        this.flattenedNodes = []; // 扁平化的节点列表
        this.nodeHeights = new Map(); // 记录实际高度
        this.renderedRange = { start: 0, end: 0 };
        
        // 容器
        this.container = null;
        this.scrollContainer = null;
        this.contentContainer = null;
        
        // 滚动处理
        this.scrollHandler = null;
        
        this.injectStyles();
    }

    /**
     * 渲染楼中楼视图（虚拟滚动）
     * @param {Object} root - 根节点
     * @param {HTMLElement} container - 容器元素
     * @param {string} tid - 帖子 ID
     * @returns {Promise<void>}
     */
    async render(root, container, tid) {
        return await measure('VirtualRenderer.render', async () => {
            if (!root) {
                console.error('[VirtualRenderer] 根节点为空');
                return;
            }

            this.container = container;
            this.tid = tid;

            // 加载折叠状态
            if (tid) {
                await this.replyCollapser.loadState(tid);
            }

            // 扁平化节点树
            this.flattenedNodes = [];
            this.flattenTree(root, 0, 0);
            console.log(`[VirtualRenderer] 扁平化完成，共 ${this.flattenedNodes.length} 个节点`);

            // 创建虚拟滚动容器
            this.setupScrollContainer();

            // 初始渲染
            this.updateVisibleItems();

            // 监听滚动
            this.startScrollListener();

            console.log('[VirtualRenderer] 虚拟滚动渲染完成');
        });
    }

    /**
     * 扁平化节点树
     * @param {Object} node - 节点
     * @param {number} level - 层级
     * @param {number} index - 索引
     */
    flattenTree(node, level, index) {
        if (!node) return;

        // 计算显示层级
        const displayLevel = (node.floor === 0 || node.parentFloor === 0) ? 0 : level;

        this.flattenedNodes.push({
            index: this.flattenedNodes.length,
            node: node,
            level: level,
            displayLevel: displayLevel,
            height: this.estimateHeight(displayLevel)
        });

        // 递归处理子节点
        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                this.flattenTree(child, level + 1, index + 1);
            }
        }
    }

    /**
     * 估算节点高度
     * @param {number} level
     * @returns {number}
     */
    estimateHeight(level) {
        // 主楼通常更高
        if (level === 0) return 300;
        // 嵌套层级越深，通常内容越少
        return Math.max(150, 200 - level * 10);
    }

    /**
     * 设置滚动容器
     */
    setupScrollContainer() {
        // 清空原容器
        this.container.innerHTML = '';
        this.container.style.position = 'relative';

        // 创建总高度占位符（用于滚动条）
        const totalHeight = this.flattenedNodes.reduce((sum, item) => sum + item.height, 0);
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.className = 'nga-virtual-scroll-spacer';
        this.scrollContainer.style.height = `${totalHeight}px`;
        this.scrollContainer.style.position = 'relative';

        // 创建内容容器（绝对定位）
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'nga-virtual-content';
        this.contentContainer.style.position = 'absolute';
        this.contentContainer.style.top = '0';
        this.contentContainer.style.left = '0';
        this.contentContainer.style.right = '0';

        this.scrollContainer.appendChild(this.contentContainer);
        this.container.appendChild(this.scrollContainer);
    }

    /**
     * 更新可见项
     */
    updateVisibleItems() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const viewportHeight = window.innerHeight;

        // 计算可见范围
        const { start, end } = this.calculateVisibleRange(scrollTop, viewportHeight);

        // 如果范围没变，不需要重新渲染
        if (start === this.renderedRange.start && end === this.renderedRange.end) {
            return;
        }

        this.renderedRange = { start, end };

        // 渲染可见范围的节点
        this.renderVisibleNodes(start, end, scrollTop);
    }

    /**
     * 计算可见范围
     * @param {number} scrollTop
     * @param {number} viewportHeight
     * @returns {Object} { start, end }
     */
    calculateVisibleRange(scrollTop, viewportHeight) {
        let accumulatedHeight = 0;
        let start = 0;
        let end = this.flattenedNodes.length;

        // 找到起始索引
        for (let i = 0; i < this.flattenedNodes.length; i++) {
            const item = this.flattenedNodes[i];
            const itemHeight = this.nodeHeights.get(item.index) || item.height;
            
            if (accumulatedHeight + itemHeight >= scrollTop - viewportHeight) {
                start = Math.max(0, i - this.bufferSize);
                break;
            }
            accumulatedHeight += itemHeight;
        }

        // 找到结束索引
        accumulatedHeight = 0;
        for (let i = 0; i < this.flattenedNodes.length; i++) {
            const item = this.flattenedNodes[i];
            const itemHeight = this.nodeHeights.get(item.index) || item.height;
            accumulatedHeight += itemHeight;
            
            if (accumulatedHeight >= scrollTop + viewportHeight * 2) {
                end = Math.min(this.flattenedNodes.length, i + this.bufferSize);
                break;
            }
        }

        return { start, end };
    }

    /**
     * 渲染可见节点
     * @param {number} start
     * @param {number} end
     * @param {number} scrollTop
     */
    renderVisibleNodes(start, end, scrollTop) {
        // 计算偏移量
        let offsetTop = 0;
        for (let i = 0; i < start; i++) {
            const item = this.flattenedNodes[i];
            offsetTop += this.nodeHeights.get(item.index) || item.height;
        }

        // 清空内容容器
        this.contentContainer.innerHTML = '';
        this.contentContainer.style.transform = `translateY(${offsetTop}px)`;

        // 渲染可见节点
        const fragment = document.createDocumentFragment();
        
        for (let i = start; i < end; i++) {
            const item = this.flattenedNodes[i];
            const wrapper = this.renderSingleNode(item);
            fragment.appendChild(wrapper);

            // 异步测量实际高度
            requestAnimationFrame(() => {
                const actualHeight = wrapper.offsetHeight;
                if (actualHeight > 0) {
                    this.nodeHeights.set(item.index, actualHeight);
                    this.updateScrollContainerHeight();
                }
            });
        }

        this.contentContainer.appendChild(fragment);

        console.log(`[VirtualRenderer] 渲染范围 ${start}-${end}，共 ${end - start} 个节点`);
    }

    /**
     * 渲染单个节点
     * @param {Object} item - 扁平化的节点项
     * @returns {HTMLElement}
     */
    renderSingleNode(item) {
        const { node, displayLevel } = item;

        // 创建包装器
        const wrapper = document.createElement('div');
        wrapper.className = 'nga-virtual-item';
        wrapper.style.marginLeft = `${displayLevel * 20}px`;
        wrapper.style.marginBottom = '8px';
        wrapper.dataset.index = item.index;

        // 克隆帖子元素
        const post = node.element.cloneNode(true);

        // 应用样式
        this.applyStyles(post, displayLevel);

        // 清理引用块
        if (node.removeQuote) {
            this.cleanupQuotes(post);
        }

        // 优化布局
        if (displayLevel > 0) {
            this.optimizeLayout(post);
        }

        wrapper.appendChild(post);

        return wrapper;
    }

    /**
     * 更新滚动容器高度
     */
    updateScrollContainerHeight() {
        let totalHeight = 0;
        for (let i = 0; i < this.flattenedNodes.length; i++) {
            const item = this.flattenedNodes[i];
            totalHeight += this.nodeHeights.get(item.index) || item.height;
        }
        this.scrollContainer.style.height = `${totalHeight}px`;
    }

    /**
     * 开始滚动监听
     */
    startScrollListener() {
        this.scrollHandler = debounce(() => {
            this.updateVisibleItems();
        }, 100);

        window.addEventListener('scroll', this.scrollHandler);
        console.log('[VirtualRenderer] 滚动监听已启动');
    }

    /**
     * 停止滚动监听
     */
    stopScrollListener() {
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
            this.scrollHandler = null;
            console.log('[VirtualRenderer] 滚动监听已停止');
        }
    }

    /**
     * 应用样式类
     * @param {HTMLElement} post
     * @param {number} level
     */
    applyStyles(post, level) {
        if (level > 0) {
            post.classList.add('indented');
            post.classList.add(`nga-reply-level-${Math.min(level, 5)}`);
        } else {
            post.classList.add('nga-reply-level-0');
        }
    }

    /**
     * 清理引用块
     * @param {HTMLElement} post
     */
    cleanupQuotes(post) {
        const quote = post.querySelector('div.quote');
        if (quote) {
            quote.remove();
        }
    }

    /**
     * 优化楼中楼布局
     * @param {HTMLElement} post
     */
    optimizeLayout(post) {
        // 简化左侧信息栏
        const c1 = post.querySelector('td.c1');
        if (c1) {
            const info = c1.querySelector('div[style*="text-align:left;line-height:1.5em"]');
            if (info) {
                c1.innerHTML = '';
                c1.appendChild(info.cloneNode(true));
            }
        }

        // 简化右侧内容区
        const c2 = post.querySelector('td.c2');
        if (c2) {
            const selectorsToHide = ['.goodbad', '[id^="postsubject"]', '.x'];
            selectorsToHide.forEach(selector => {
                const el = c2.querySelector(selector);
                if (el) {
                    if (selector.includes('postsubject') && el.textContent.trim() === '') {
                        el.style.display = 'none';
                    } else if (selector !== '.postInfo') {
                        el.style.display = 'none';
                    }
                }
            });

            const postInfo = c2.querySelector('.postInfo');
            if (postInfo) {
                postInfo.style.lineHeight = '1.2';
                postInfo.style.margin = '2px 0';
            }

            const content = c2.querySelector('[id^="postcontent"]');
            if (content) {
                content.style.margin = '4px 0';
                content.style.lineHeight = '1.45';
            }
        }
    }

    /**
     * 注入样式
     */
    injectStyles() {
        if (document.getElementById('nga-virtual-renderer-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'nga-virtual-renderer-styles';
        style.textContent = `
            /* 虚拟滚动容器样式 */
            .nga-virtual-scroll-spacer {
                width: 100%;
            }

            .nga-virtual-content {
                will-change: transform;
            }

            .nga-virtual-item {
                contain: layout style paint;
            }

            /* 主楼样式 */
            .nga-reply-level-0 {
                /* 保持原样 */
            }

            /* 一级回复样式 */
            .nga-reply-level-1 {
                /* 保持原样 */
            }

            /* 二级及以上回复样式 */
            table.forumbox.postbox.indented > tbody > tr > td {
                background: #F2EDDF !important;
            }

            .nga-reply-level-2,
            .nga-reply-level-3,
            .nga-reply-level-4,
            .nga-reply-level-5 {
                border: 1px solid #fff !important;
                border-radius: 6px !important;
                overflow: hidden !important;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 销毁渲染器
     */
    destroy() {
        this.stopScrollListener();
        this.flattenedNodes = [];
        this.nodeHeights.clear();
    }
}

export default VirtualRenderer;

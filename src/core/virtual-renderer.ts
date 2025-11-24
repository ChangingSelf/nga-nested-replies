// ========== 虚拟滚动渲染器 ==========

import { measure, debounce } from '../utils/performance.js';
import type { AppConfig } from '../types/index.js';
import StorageManager from '../storage/storage-manager.js';
import ReplyCollapser from '../ui/reply-collapser.js';

/**
 * 帖子数据接口
 */
interface PostData {
  element: HTMLTableElement;
  pid: string;
  floor: number;
  children: PostData[];
  parentFloor: number;
  removeQuote?: boolean;
}

/**
 * 扁平化节点项
 */
interface FlattenedNodeItem {
  index: number;
  node: PostData;
  level: number;
  displayLevel: number;
  height: number;
}

/**
 * 渲染范围
 */
interface RenderRange {
  start: number;
  end: number;
}

/**
 * 虚拟滚动渲染器
 * 只渲染可见区域的楼层，大幅减少DOM节点数量
 */
class VirtualRenderer {
  private replyCollapser: ReplyCollapser;

  // 虚拟滚动配置
  private bufferSize: number;

  // 数据
  private flattenedNodes: FlattenedNodeItem[] = []; // 扁平化的节点列表
  private nodeHeights = new Map<number, number>(); // 记录实际高度
  private renderedRange: RenderRange = { start: 0, end: 0 };

  // 容器
  private container: HTMLElement | null = null;
  private scrollContainer: HTMLElement | null = null;
  private contentContainer: HTMLElement | null = null;

  // 滚动处理
  private scrollHandler: ((() => void) & { cancel: () => void }) | null = null;

  constructor(config: AppConfig, storageManager: StorageManager) {
    this.replyCollapser = new ReplyCollapser(storageManager, config);

    // 虚拟滚动配置
    this.bufferSize = config.virtualScrollBufferSize || 10; // 视口上下额外渲染的楼层数

    this.injectStyles();
  }

  /**
   * 渲染楼中楼视图（虚拟滚动）
   */
  async render(root: PostData, container: HTMLElement, tid: string): Promise<void> {
    return await measure('VirtualRenderer.render', async () => {
      if (!root) {
        console.error('[VirtualRenderer] 根节点为空');
        return;
      }

      this.container = container;

      // 加载折叠状态
      if (tid) {
        await this.replyCollapser.loadState(tid);
      }

      // 扁平化节点树
      this.flattenedNodes = [];
      this.flattenTree(root, 0, 0);
      console.log(
        `[VirtualRenderer] 扁平化完成，共 ${this.flattenedNodes.length} 个节点`
      );

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
   */
  private flattenTree(node: PostData, level: number, index: number): void {
    if (!node) return;

    // 计算显示层级
    const displayLevel = node.floor === 0 || node.parentFloor === 0 ? 0 : level;

    this.flattenedNodes.push({
      index: this.flattenedNodes.length,
      node: node,
      level: level,
      displayLevel: displayLevel,
      height: this.estimateHeight(displayLevel),
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
   */
  private estimateHeight(level: number): number {
    // 主楼通常更高
    if (level === 0) return 300;
    // 嵌套层级越深，通常内容越少
    return Math.max(150, 200 - level * 10);
  }

  /**
   * 设置滚动容器
   */
  private setupScrollContainer(): void {
    if (!this.container) return;

    // 清空原容器
    this.container.innerHTML = '';
    this.container.style.position = 'relative';

    // 创建总高度占位符（用于滚动条）
    const totalHeight = this.flattenedNodes.reduce(
      (sum, item) => sum + item.height,
      0
    );
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
  private updateVisibleItems(): void {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const viewportHeight = window.innerHeight;

    // 计算可见范围
    const { start, end } = this.calculateVisibleRange(
      scrollTop,
      viewportHeight
    );

    // 如果范围没变，不需要重新渲染
    if (start === this.renderedRange.start && end === this.renderedRange.end) {
      return;
    }

    this.renderedRange = { start, end };

    // 渲染可见范围的节点
    this.renderVisibleNodes(start, end);
  }

  /**
   * 计算可见范围
   */
  private calculateVisibleRange(scrollTop: number, viewportHeight: number): RenderRange {
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
   */
  private renderVisibleNodes(start: number, end: number): void {
    if (!this.contentContainer) return;

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

    console.log(
      `[VirtualRenderer] 渲染范围 ${start}-${end}，共 ${end - start} 个节点`
    );
  }

  /**
   * 渲染单个节点
   */
  private renderSingleNode(item: FlattenedNodeItem): HTMLElement {
    const { node, displayLevel } = item;

    // 创建包装器
    const wrapper = document.createElement('div');
    wrapper.className = 'nga-virtual-item';
    wrapper.style.marginLeft = `${displayLevel * 20}px`;
    wrapper.style.marginBottom = '8px';
    (wrapper as any).dataset.index = item.index;

    // 克隆帖子元素
    const post = node.element.cloneNode(true) as HTMLTableElement;

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
  private updateScrollContainerHeight(): void {
    if (!this.scrollContainer) return;

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
  private startScrollListener(): void {
    this.scrollHandler = debounce(() => {
      this.updateVisibleItems();
    }, 100) as ((() => void) & { cancel: () => void });

    window.addEventListener('scroll', this.scrollHandler);
    console.log('[VirtualRenderer] 滚动监听已启动');
  }

  /**
   * 停止滚动监听
   */
  private stopScrollListener(): void {
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
      console.log('[VirtualRenderer] 滚动监听已停止');
    }
  }

  /**
   * 应用样式类
   */
  private applyStyles(post: HTMLTableElement, level: number): void {
    if (level > 0) {
      post.classList.add('indented');
      post.classList.add(`nga-reply-level-${Math.min(level, 5)}`);
    } else {
      post.classList.add('nga-reply-level-0');
    }
  }

  /**
   * 清理引用块
   */
  private cleanupQuotes(post: HTMLTableElement): void {
    const quote = post.querySelector('div.quote');
    if (quote) {
      quote.remove();
    }
  }

  /**
   * 优化楼中楼布局
   */
  private optimizeLayout(post: HTMLTableElement): void {
    // 简化左侧信息栏
    const c1 = post.querySelector('td.c1') as HTMLTableDataCellElement;
    if (c1) {
      const info = c1.querySelector(
        'div[style*="text-align:left;line-height:1.5em"]'
      ) as HTMLElement;
      if (info) {
        c1.innerHTML = '';
        c1.appendChild(info.cloneNode(true));
      }
    }

    // 简化右侧内容区
    const c2 = post.querySelector('td.c2') as HTMLTableDataCellElement;
    if (c2) {
      const selectorsToHide = ['.goodbad', '[id^="postsubject"]', '.x'];
      selectorsToHide.forEach((selector) => {
        const el = c2.querySelector(selector) as HTMLElement;
        if (el) {
          if (
            selector.includes('postsubject') &&
            el.textContent?.trim() === ''
          ) {
            el.style.display = 'none';
          } else if (selector !== '.postInfo') {
            el.style.display = 'none';
          }
        }
      });

      const postInfo = c2.querySelector('.postInfo') as HTMLElement;
      if (postInfo) {
        postInfo.style.lineHeight = '1.2';
        postInfo.style.margin = '2px 0';
      }

      const content = c2.querySelector('[id^="postcontent"]') as HTMLElement;
      if (content) {
        content.style.margin = '4px 0';
        content.style.lineHeight = '1.45';
      }
    }
  }

  /**
   * 注入样式
   */
  private injectStyles(): void {
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
  destroy(): void {
    this.stopScrollListener();
    this.flattenedNodes = [];
    this.nodeHeights.clear();
  }

  /**
   * 获取当前渲染状态
   */
  getRenderState(): {
    totalNodes: number;
    renderedRange: RenderRange;
    bufferSize: number;
  } {
    return {
      totalNodes: this.flattenedNodes.length,
      renderedRange: this.renderedRange,
      bufferSize: this.bufferSize
    };
  }

  /**
   * 手动更新可见项
   */
  forceUpdate(): void {
    this.updateVisibleItems();
  }
}

export default VirtualRenderer;
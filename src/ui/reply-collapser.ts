// ========== 楼中楼折叠组件 ==========

import {
  createElement,
  addClass,
  removeClass,
  show,
  hide,
} from '../utils/dom-utils.js';
import type { AppConfig } from '../types/index.js';
import StorageManager from '../storage/storage-manager.js';

/**
 * 帖子节点数据接口
 */
interface PostData {
  floor: number;
  children?: PostData[];
}

/**
 * 楼中楼折叠组件
 */
class ReplyCollapser {
  private storageManager: StorageManager;
  private config: AppConfig;
  private threshold: number;
  private enabled: boolean;
  private expandedNodes = new Set<number>(); // 当前展开的节点

  constructor(storageManager: StorageManager, config: AppConfig) {
    this.storageManager = storageManager;
    this.config = config;
    this.threshold = this.config.replyCollapseThreshold || 3;
    this.enabled = this.config.enableReplyCollapse !== false;
  }

  /**
   * 判断是否需要折叠
   */
  shouldCollapse(node: PostData, level: number): boolean {
    if (!this.enabled) return false;
    if (level <= 1) return false; // 主楼和一级回复不折叠
    if (!node.children || node.children.length <= this.threshold) return false;
    return true;
  }

  /**
   * 创建折叠占位符
   */
  private createCollapsePlaceholder(hiddenCount: number, onExpand: () => void): HTMLElement {
    const placeholder = createElement('div', {
      className: 'nga-collapse-placeholder',
      styles: {
        background: '#F5F5F5',
        border: '1px dashed #CCCCCC',
        padding: '8px 12px',
        margin: '8px 0',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        fontSize: '13px',
        color: '#666',
      },
      innerHTML: `📦 还有 ${hiddenCount} 条回复被折叠 <span style="color: #3b82f6;">[点击展开]</span>`,
    });

    placeholder.addEventListener('mouseenter', () => {
      placeholder.style.background = '#E5E7EB';
    });

    placeholder.addEventListener('mouseleave', () => {
      placeholder.style.background = '#F5F5F5';
    });

    placeholder.addEventListener('click', onExpand);

    return placeholder;
  }

  /**
   * 创建收起按钮
   */
  private createCollapseButton(onCollapse: () => void): HTMLElement {
    const button = createElement('div', {
      className: 'nga-collapse-button',
      styles: {
        background: '#E5E7EB',
        border: '1px solid #D1D5DB',
        padding: '4px 12px',
        margin: '8px 0',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        fontSize: '12px',
        color: '#666',
        textAlign: 'center',
      },
      textContent: '收起',
    });

    button.addEventListener('mouseenter', () => {
      button.style.background = '#D1D5DB';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#E5E7EB';
    });

    button.addEventListener('click', onCollapse);

    return button;
  }

  /**
   * 应用折叠逻辑到节点
   */
  applyCollapse(container: HTMLElement, node: PostData, level: number, tid: string): void {
    if (!this.shouldCollapse(node, level)) {
      return;
    }

    const children = Array.from(container.children);
    const visibleCount = this.threshold;
    const hiddenCount = children.length - visibleCount;

    if (hiddenCount <= 0) return;

    // 检查是否已展开
    const isExpanded = this.expandedNodes.has(node.floor);

    if (!isExpanded) {
      // 隐藏超出阈值的回复
      for (let i = visibleCount; i < children.length; i++) {
        addClass(children[i] as HTMLElement, 'nga-collapsed');
        hide(children[i] as HTMLElement);
      }

      // 插入折叠占位符
      const placeholder = this.createCollapsePlaceholder(hiddenCount, () => {
        void this.expandNode(container, node, tid);
        placeholder.remove();
      });

      container.insertBefore(placeholder, children[visibleCount]);
    } else {
      // 已展开，添加收起按钮
      const button = this.createCollapseButton(() => {
        void this.collapseNode(container, node, tid);
      });
      container.appendChild(button);
    }
  }

  /**
   * 展开节点
   */
  private async expandNode(container: HTMLElement, node: PostData, tid: string): Promise<void> {
    const children = Array.from(container.children);

    // 显示所有隐藏的回复
    children.forEach((child) => {
      const childElement = child as HTMLElement;
      if (childElement.classList.contains('nga-collapsed')) {
        removeClass(childElement, 'nga-collapsed');
        show(childElement);

        // 添加展开动画
        childElement.style.animation = 'ngaFadeIn 0.3s ease';
      }
    });

    // 移除折叠占位符
    const placeholder = container.querySelector('.nga-collapse-placeholder');
    if (placeholder) {
      placeholder.remove();
    }

    // 添加收起按钮
    const button = this.createCollapseButton(() => {
      void this.collapseNode(container, node, tid);
    });
    container.appendChild(button);

    // 记录展开状态
    this.expandedNodes.add(node.floor);

    // 保存状态
    await this.saveState(tid);
  }

  /**
   * 折叠节点
   */
  private async collapseNode(container: HTMLElement, node: PostData, tid: string): Promise<void> {
    const children = Array.from(container.children);
    const visibleCount = this.threshold;
    let hiddenCount = 0;

    // 隐藏超出阈值的回复
    for (let i = visibleCount; i < children.length; i++) {
      const child = children[i] as HTMLElement;
      if (!child.classList.contains('nga-collapse-button')) {
        addClass(child, 'nga-collapsed');
        hide(child);
        hiddenCount++;
      }
    }

    // 移除收起按钮
    const button = container.querySelector('.nga-collapse-button');
    if (button) {
      button.remove();
    }

    // 添加折叠占位符
    if (hiddenCount > 0) {
      const placeholder = this.createCollapsePlaceholder(hiddenCount, () => {
        void this.expandNode(container, node, tid);
        placeholder.remove();
      });

      // 找到第一个被折叠的元素位置
      let insertPos = visibleCount;
      container.insertBefore(placeholder, children[insertPos]);
    }

    // 移除展开状态
    this.expandedNodes.delete(node.floor);

    // 保存状态
    await this.saveState(tid);
  }

  /**
   * 保存折叠状态
   */
  async saveState(tid: string): Promise<void> {
    if (this.storageManager) {
      try {
        await this.storageManager.saveCollapseState(tid, this.expandedNodes);
      } catch (e) {
        console.error('[ReplyCollapser] 保存状态失败:', e);
      }
    }
  }

  /**
   * 加载折叠状态
   */
  async loadState(tid: string): Promise<void> {
    if (this.storageManager) {
      try {
        const state = await this.storageManager.getCollapseState(tid);
        if (state) {
          this.expandedNodes = state;
        }
      } catch (e) {
        console.error('[ReplyCollapser] 加载状态失败:', e);
      }
    }
  }

  /**
   * 获取当前展开状态
   */
  getExpandedNodes(): Set<number> {
    return new Set(this.expandedNodes);
  }

  /**
   * 清空展开状态
   */
  clearExpandedNodes(): void {
    this.expandedNodes.clear();
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<AppConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.threshold = this.config.replyCollapseThreshold || 3;
    this.enabled = this.config.enableReplyCollapse !== false;
  }

  /**
   * 注入折叠样式
   */
  static injectStyles(): void {
    if (document.getElementById('nga-collapse-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nga-collapse-styles';
    style.textContent = `
            @keyframes ngaFadeIn {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .nga-collapsed {
                display: none !important;
            }

            .nga-collapse-placeholder:hover {
                background: #E5E7EB !important;
            }
        `;
    document.head.appendChild(style);
  }

  /**
   * 移除注入的样式
   */
  static removeStyles(): void {
    const style = document.getElementById('nga-collapse-styles');
    if (style) {
      style.remove();
    }
  }
}

// 注入样式
ReplyCollapser.injectStyles();

export default ReplyCollapser;
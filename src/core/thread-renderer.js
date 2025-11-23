// ========== 楼中楼渲染器 ==========

import { measure } from '../utils/performance.js';
import { createFragment } from '../utils/dom-utils.js';
import ReplyCollapser from '../ui/reply-collapser.js';

/**
 * 楼中楼渲染器
 * 将关系树渲染为楼中楼视图，应用样式和折叠逻辑
 */
class ThreadRenderer {
  constructor(config, storageManager) {
    this.config = config || {};
    this.storageManager = storageManager;
    this.replyCollapser = new ReplyCollapser(storageManager, config);
    this.injectStyles();
  }

  /**
   * 渲染楼中楼视图
   * @param {Object} root - 根节点
   * @param {HTMLElement} container - 容器元素
   * @param {string} tid - 帖子 ID
   * @returns {Promise<void>}
   */
  async render(root, container, tid) {
    return await measure('renderThreadedView', async () => {
      if (!root) {
        console.error('[ThreadRenderer] 根节点为空');
        return;
      }

      // 加载折叠状态
      if (tid) {
        await this.replyCollapser.loadState(tid);
      }

      // 清空容器
      container.innerHTML = '';

      // 使用 DocumentFragment 批量渲染
      const fragment = createFragment();
      await this.renderNode(root, fragment, 0, tid);

      // 一次性插入到 DOM
      container.appendChild(fragment);

      console.log('[ThreadRenderer] 渲染完成');
    });
  }

  /**
   * 递归渲染节点
   * @param {Object} node - 节点对象
   * @param {DocumentFragment|HTMLElement} parent - 父容器
   * @param {number} level - 层级
   * @param {string} tid - 帖子 ID
   */
  async renderNode(node, parent, level, tid) {
    if (!node || !node.element) return;

    // 创建包装器
    const wrapper = document.createElement('div');

    // 计算实际显示层级（主楼和一级回复不缩进）
    const displayLevel = node.floor === 0 || node.parentFloor === 0 ? 0 : level;

    // 设置样式
    wrapper.style.marginLeft = `${displayLevel * 20}px`;
    wrapper.style.marginBottom = '8px';

    // 克隆帖子元素
    const post = node.element.cloneNode(true);

    // 应用样式优化
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
    parent.appendChild(wrapper);

    // 渲染子节点
    if (node.children && node.children.length > 0) {
      // 创建子节点容器
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'nga-children-container';

      // 渲染所有子节点到子容器
      for (const child of node.children) {
        await this.renderNode(child, childrenContainer, level + 1, tid);
      }

      // 应用折叠逻辑
      if (this.config.enableReplyCollapse !== false) {
        this.replyCollapser.applyCollapse(childrenContainer, node, level, tid);
      }

      wrapper.appendChild(childrenContainer);
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
      const info = c1.querySelector(
        'div[style*="text-align:left;line-height:1.5em"]'
      );
      if (info) {
        c1.innerHTML = '';
        c1.appendChild(info.cloneNode(true));
      }
    }

    // 简化右侧内容区
    const c2 = post.querySelector('td.c2');
    if (c2) {
      // 隐藏不必要的元素
      const selectorsToHide = ['.goodbad', '[id^="postsubject"]', '.x'];
      selectorsToHide.forEach((selector) => {
        const el = c2.querySelector(selector);
        if (el) {
          if (
            selector.includes('postsubject') &&
            el.textContent.trim() === ''
          ) {
            el.style.display = 'none';
          } else if (selector !== '.postInfo') {
            el.style.display = 'none';
          }
        }
      });

      // 优化 postInfo 样式
      const postInfo = c2.querySelector('.postInfo');
      if (postInfo) {
        postInfo.style.lineHeight = '1.2';
        postInfo.style.margin = '2px 0';
      }

      // 优化内容区样式
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
    if (document.getElementById('nga-thread-renderer-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nga-thread-renderer-styles';
    style.textContent = `
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

            /* 子节点容器 */
            .nga-children-container {
                /* 容器样式 */
            }
        `;
    document.head.appendChild(style);
  }
}

export default ThreadRenderer;

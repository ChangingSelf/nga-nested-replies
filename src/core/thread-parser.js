// ========== 帖子解析器 ==========

import { measure } from '../utils/performance.js';

/**
 * 帖子解析器
 * 解析帖子 HTML，构建楼中楼关系树
 */
class ThreadParser {
  constructor(config) {
    this.config = config || {};
    this.pidToFloor = new Map();
    this.floorToPost = new Map();
  }

  /**
   * 解析帖子结构
   * @param {HTMLElement} container - 包含帖子的容器
   * @returns {Object} 解析结果 { root, pidToFloor, floorToPost }
   */
  async parseThreadStructure(container) {
    return await measure('parseThreadStructure', async () => {
      this.pidToFloor.clear();
      this.floorToPost.clear();

      const allPosts = Array.from(
        container.querySelectorAll('table.forumbox.postbox')
      );
      console.log('[ThreadParser] 找到帖子数量:', allPosts.length);

      if (allPosts.length === 0) {
        return null;
      }

      // 第一遍：提取 pid 和 floor 映射
      allPosts.forEach((post) => {
        const floor = this.extractFloor(post);
        const pid = this.extractPid(post);

        if (pid) {
          this.pidToFloor.set(pid, floor);
          this.floorToPost.set(floor, {
            element: post,
            pid,
            floor,
            children: [],
            parentFloor: 0,
          });
        }
      });

      // 第二遍：建立父子关系
      allPosts.forEach((post) => {
        const pid = this.extractPid(post);
        const floor = this.pidToFloor.get(pid);
        const postData = this.floorToPost.get(floor);

        if (!postData) return;

        const { parentFloor, removeQuote } = this.detectReplyParent(post);
        postData.parentFloor = parentFloor;
        postData.removeQuote = removeQuote;

        if (parentFloor !== floor && this.floorToPost.has(parentFloor)) {
          this.floorToPost.get(parentFloor).children.push(postData);
        }
      });

      // 构建树形结构
      const root = this.floorToPost.get(0);
      if (!root) {
        console.error('[ThreadParser] 未找到主楼');
        return null;
      }

      // 排序子节点
      this.sortReplies(root);

      return {
        root,
        pidToFloor: this.pidToFloor,
        floorToPost: this.floorToPost,
        totalPosts: allPosts.length,
      };
    });
  }

  /**
   * 提取楼层号
   * @param {HTMLElement} post
   * @returns {number}
   */
  extractFloor(post) {
    try {
      const floorLink = post.querySelector('a[name^="l"]');
      if (floorLink) {
        const floorText = floorLink.textContent.replace('#', '').trim();
        const floor = parseInt(floorText);
        return isNaN(floor) ? 0 : floor;
      }
    } catch (e) {
      console.warn('[ThreadParser] 提取楼层号失败:', e);
    }
    return 0;
  }

  /**
   * 提取 pid
   * @param {HTMLElement} post
   * @returns {string|null}
   */
  extractPid(post) {
    try {
      const pidAnchor = post.querySelector('a[id^="pid"][id$="Anchor"]');
      if (pidAnchor) {
        return pidAnchor.id.replace('pid', '').replace('Anchor', '');
      }
    } catch (e) {
      console.warn('[ThreadParser] 提取 pid 失败:', e);
    }
    return '0';
  }

  /**
   * 检测回复的父楼层
   * @param {HTMLElement} post
   * @returns {Object} { parentFloor, removeQuote }
   */
  detectReplyParent(post) {
    try {
      const quote = post.querySelector('div.quote');
      if (quote) {
        const link = quote.querySelector('a[href*="topid="]');
        if (link) {
          const match = link.href.match(/topid=(\d+)/);
          if (match) {
            const parentPid = match[1];
            const parentFloor = this.pidToFloor.get(parentPid);
            if (parentFloor !== undefined) {
              return { parentFloor, removeQuote: true };
            }
          }
        }
      }
    } catch (e) {
      console.warn('[ThreadParser] 检测父楼层失败:', e);
    }
    return { parentFloor: 0, removeQuote: false };
  }

  /**
   * 递归排序回复
   * @param {Object} node
   */
  sortReplies(node) {
    if (node.children && node.children.length > 0) {
      node.children.sort((a, b) => a.floor - b.floor);
      node.children.forEach((child) => this.sortReplies(child));
    }
  }

  /**
   * 获取节点路径
   * @param {number} floor
   * @returns {Array<number>}
   */
  getNodePath(floor) {
    const path = [];
    let current = this.floorToPost.get(floor);

    while (current) {
      path.unshift(current.floor);
      if (current.parentFloor === 0 || current.parentFloor === current.floor) {
        break;
      }
      current = this.floorToPost.get(current.parentFloor);
    }

    return path;
  }

  /**
   * 获取节点深度
   * @param {number} floor
   * @returns {number}
   */
  getNodeDepth(floor) {
    return this.getNodePath(floor).length - 1;
  }
}

export default ThreadParser;

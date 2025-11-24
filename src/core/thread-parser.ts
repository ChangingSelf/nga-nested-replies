// ========== 帖子解析器 ==========

import { measure } from '../utils/performance.js';
import type { AppConfig } from '../types/index.js';

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
 * 解析结果接口
 */
interface ParseResult {
  root: PostData;
  pidToFloor: Map<string, number>;
  floorToPost: Map<number, PostData>;
  totalPosts: number;
}

/**
 * 父楼层检测结果
 */
interface ParentDetectionResult {
  parentFloor: number;
  removeQuote: boolean;
}

/**
 * 帖子解析器
 * 解析帖子 HTML，构建楼中楼关系树
 */
class ThreadParser {
  private pidToFloor = new Map<string, number>();
  private floorToPost = new Map<number, PostData>();

  constructor(_config: AppConfig) {
    // 配置暂未使用，保留参数以备将来扩展
  }

  /**
   * 解析帖子结构
   */
  async parseThreadStructure(container: HTMLElement): Promise<ParseResult | null> {
    return await measure('parseThreadStructure', async () => {
      this.pidToFloor.clear();
      this.floorToPost.clear();

      const allPosts = Array.from(
        container.querySelectorAll('table.forumbox.postbox')
      ) as HTMLTableElement[];
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
        const postData = floor !== undefined ? this.floorToPost.get(floor) : undefined;

        if (!postData) return;

        const { parentFloor, removeQuote } = this.detectReplyParent(post);
        postData.parentFloor = parentFloor;
        postData.removeQuote = removeQuote;

        if (parentFloor !== floor && this.floorToPost.has(parentFloor)) {
          this.floorToPost.get(parentFloor)!.children.push(postData);
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
   */
  private extractFloor(post: HTMLTableElement): number {
    try {
      const floorLink = post.querySelector('a[name^="l"]') as HTMLAnchorElement;
      if (floorLink) {
        const floorText = floorLink.textContent?.replace('#', '').trim() || '0';
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
   */
  private extractPid(post: HTMLTableElement): string {
    try {
      const pidAnchor = post.querySelector('a[id^="pid"][id$="Anchor"]') as HTMLAnchorElement;
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
   */
  private detectReplyParent(post: HTMLTableElement): ParentDetectionResult {
    try {
      const quote = post.querySelector('div.quote') as HTMLElement;
      if (quote) {
        const link = quote.querySelector('a[href*="topid="]') as HTMLAnchorElement;
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
   */
  private sortReplies(node: PostData): void {
    if (node.children && node.children.length > 0) {
      node.children.sort((a, b) => a.floor - b.floor);
      node.children.forEach((child) => this.sortReplies(child));
    }
  }

  /**
   * 获取节点路径
   */
  getNodePath(floor: number): number[] {
    const path: number[] = [];
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
   */
  getNodeDepth(floor: number): number {
    return this.getNodePath(floor).length - 1;
  }

  /**
   * 获取指定楼层的所有子节点
   */
  getChildren(floor: number): PostData[] {
    const post = this.floorToPost.get(floor);
    return post ? post.children : [];
  }

  /**
   * 获取指定楼层的父节点
   */
  getParent(floor: number): PostData | null {
    const post = this.floorToPost.get(floor);
    if (!post || post.parentFloor === 0) {
      return null;
    }
    return this.floorToPost.get(post.parentFloor) || null;
  }

  /**
   * 获取根节点
   */
  getRootNode(): PostData | null {
    return this.floorToPost.get(0) || null;
  }

  /**
   * 获取所有帖子数据
   */
  getAllPosts(): Map<number, PostData> {
    return new Map(this.floorToPost);
  }

  /**
   * 根据楼层获取帖子数据
   */
  getPostByFloor(floor: number): PostData | null {
    return this.floorToPost.get(floor) || null;
  }

  /**
   * 根据PID获取楼层
   */
  getFloorByPid(pid: string): number | undefined {
    return this.pidToFloor.get(pid);
  }
}

export default ThreadParser;
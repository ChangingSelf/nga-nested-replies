// ========== 工具函数模块 ==========

import type { PageInfo } from '../types/index.js';

/**
 * 格式化文件大小
 * @param bytes - 字节数
 * @returns 格式化后的大小字符串
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

/**
 * 格式化时间
 * @param timestamp - 时间戳
 * @returns 格式化后的时间字符串
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 从 URL 提取 tid
 * @returns {string|null}
 */
export function extractTid(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  const tidFromParam = urlParams.get('tid');

  if (tidFromParam) {
    console.log('[TID 提取] 从 URL 参数获取 tid:', tidFromParam);
    return tidFromParam;
  }

  const match = window.location.href.match(/[?&]tid=(\d+)/);
  if (match) {
    console.log('[TID 提取] 从 URL 匹配获取 tid:', match[1]);
    return match[1];
  }

  console.warn('[TID 提取] 未能提取 tid');
  return null;
}

/**
 * 解析页面信息
 * @returns {PageInfo}
 */
export function parsePageInfo(): PageInfo {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    let totalPages = 1;
    let currentPage = parseInt(urlParams.get('page') || '1');

    const links = document.querySelectorAll('#pagebtop a, #pagebbtm a');
    links.forEach((link) => {
      const text = link.textContent?.trim();
      const num = parseInt(text || '');
      if (!isNaN(num)) totalPages = Math.max(totalPages, num);
    });

    const lastPageLink = document.querySelector(
      '#pagebtop a[title*="最后页"], #pagebbtm a[title*="最后页"]'
    );
    if (lastPageLink) {
      const match = (lastPageLink as HTMLAnchorElement).href.match(/page=(\d+)/);
      if (match) {
        const lastPage = parseInt(match[1]);
        if (lastPage > totalPages) totalPages = lastPage;
      }
    }

    console.log('[页面解析] 当前页:', currentPage, '总页数:', totalPages);
    return { totalPages, currentPage };
  } catch (e) {
    console.error('[页面解析] 解析失败:', e);
    return { totalPages: 1, currentPage: 1 };
  }
}

/**
 * 等待指定时间
 * @param ms - 毫秒数
 * @returns Promise对象
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 防抖函数
 * @param fn - 要防抖的函数
 * @param delay - 延迟时间(毫秒)
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * 节流函数
 * @param fn - 要节流的函数
 * @param delay - 延迟时间(毫秒)
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let last = 0;
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn.apply(this, args);
    }
  };
}
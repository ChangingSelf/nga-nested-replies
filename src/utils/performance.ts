// ========== 性能优化工具 ==========

/**
 * 测量代码执行时间
 * @param name - 测量名称
 * @param fn - 要测量的函数
 * @returns 函数执行结果
 */
export async function measure<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;
  const measureName = `${name}-duration`;

  performance.mark(startMark);
  const result = await fn();
  performance.mark(endMark);

  try {
    performance.measure(measureName, startMark, endMark);
    const measure = performance.getEntriesByName(measureName)[0];
    console.log(`[性能] ${name} 耗时: ${measure.duration.toFixed(2)}ms`);

    // 清理性能标记
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);
  } catch (e) {
    console.warn(`[性能] 测量 ${name} 失败:`, e);
  }

  return result;
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

/**
 * requestIdleCallback 选项
 */
interface RequestIdleOptions {
  timeout?: number;
}

/**
 * 空闲回调事件
 */
interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining(): number;
}

/**
 * requestIdleCallback polyfill
 * @param callback
 * @param options
 * @returns id
 */
export function requestIdleCallback(
  callback: (deadline: IdleDeadline) => void,
  options?: RequestIdleOptions
): number {
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, options);
  } else {
    // Polyfill
    const start = Date.now();
    return setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
      });
    }, 1) as unknown as number;
  }
}

/**
 * cancelIdleCallback polyfill
 * @param id
 */
export function cancelIdleCallback(id: number): void {
  if (typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * 分批处理大数据集
 * @param array - 数据数组
 * @param processor - 处理函数 (item, index) => void
 * @param batchSize - 每批处理的数量
 * @param delay - 批次间延迟(毫秒)
 */
export async function batchProcess<T>(
  array: T[],
  processor: (item: T, index: number) => void,
  batchSize: number = 50,
  delay: number = 10
): Promise<void> {
  for (let i = 0; i < array.length; i += batchSize) {
    const batch = array.slice(i, i + batchSize);

    batch.forEach((item, index) => {
      processor(item, i + index);
    });

    if (i + batchSize < array.length) {
      await sleep(delay);
    }
  }
}

/**
 * 等待指定时间
 * @param ms - 毫秒数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * RAF 节流
 * 使用 requestAnimationFrame 实现的节流函数
 * @param fn
 * @returns 函数
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      fn.apply(this, args);
      rafId = null;
    });
  };
}

/**
 * 性能条目类型
 */
type PerformanceEntryType =
  | 'navigation'
  | 'resource'
  | 'paint'
  | 'measure'
  | 'mark'
  | 'frame'
  | 'largest-contentful-paint'
  | 'first-input'
  | 'layout-shift';

/**
 * 创建性能观察器
 * @param entryType - 条目类型
 * @param callback - 回调函数
 * @returns PerformanceObserver|null
 */
export function createPerformanceObserver(
  entryType: PerformanceEntryType,
  callback: (entry: PerformanceEntry) => void
): PerformanceObserver | null {
  if (typeof PerformanceObserver === 'undefined') {
    console.warn('[性能] PerformanceObserver 不可用');
    return null;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        callback(entry);
      }
    });

    observer.observe({ entryTypes: [entryType] });
    return observer;
  } catch (e) {
    console.error('[性能] 创建 PerformanceObserver 失败:', e);
    return null;
  }
}

/**
 * 记录性能标记
 * @param name
 */
export function mark(name: string): void {
  try {
    performance.mark(name);
  } catch (e) {
    console.warn(`[性能] 标记 ${name} 失败:`, e);
  }
}

/**
 * 测量性能指标
 * @param name
 * @param startMark
 * @param endMark
 * @returns 持续时间(毫秒)
 */
export function measureDuration(
  name: string,
  startMark: string,
  endMark: string
): number | null {
  try {
    performance.measure(name, startMark, endMark);
    const measure = performance.getEntriesByName(name)[0];
    return measure ? measure.duration : null;
  } catch (e) {
    console.warn(`[性能] 测量 ${name} 失败:`, e);
    return null;
  }
}

/**
 * 清理性能标记
 * @param name
 */
export function clearMarks(name?: string): void {
  try {
    if (name) {
      performance.clearMarks(name);
    } else {
      performance.clearMarks();
    }
  } catch (e) {
    console.warn(`[性能] 清理标记失败:`, e);
  }
}

/**
 * 清理性能测量
 * @param name
 */
export function clearMeasures(name?: string): void {
  try {
    if (name) {
      performance.clearMeasures(name);
    } else {
      performance.clearMeasures();
    }
  } catch (e) {
    console.warn(`[性能] 清理测量失败:`, e);
  }
}

/**
 * 获取性能条目
 * @param name
 * @param type
 * @returns PerformanceEntry数组
 */
export function getEntries(
  name?: string,
  type?: string
): PerformanceEntry[] {
  try {
    if (name && type) {
      return performance.getEntriesByName(name, type);
    } else if (name) {
      return performance.getEntriesByName(name);
    } else if (type) {
      return performance.getEntriesByType(type);
    } else {
      return performance.getEntries();
    }
  } catch (e) {
    console.warn(`[性能] 获取条目失败:`, e);
    return [];
  }
}

/**
 * 导航时序信息
 */
interface NavigationInfo {
  // PerformanceNavigationTiming 的部分属性
  loadEventEnd: number;
  domContentLoadedEventEnd: number;
  fetchStart: number;
  responseEnd: number;
  transferSize: number;
  encodedBodySize: number;
}

/**
 * 获取导航时序
 * @returns Object|null
 */
export function getNavigationTiming(): NavigationInfo | PerformanceTiming | null {
  try {
    if (performance.getEntriesByType) {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      return navEntries.length > 0 ? navEntries[0] : null;
    } else if (performance.timing) {
      return performance.timing;
    }
  } catch (e) {
    console.warn(`[性能] 获取导航时序失败:`, e);
  }
  return null;
}

/**
 * 性能日志数据
 */
interface PerformanceLogData {
  [key: string]: any;
}

/**
 * 记录性能日志
 * @param message
 * @param data
 */
export function logPerformance(
  message: string,
  data: PerformanceLogData = {}
): void {
  const timestamp = Date.now();
  const memory = (performance as any).memory
    ? {
        used:
          ((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
        total:
          ((performance as any).memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
      }
    : null;

  console.log(`[性能] ${message}`, {
    timestamp: new Date(timestamp).toLocaleTimeString(),
    memory,
    ...data,
  });
}
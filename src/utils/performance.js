// ========== 性能优化工具 ==========

/**
 * 测量代码执行时间
 * @param {string} name - 测量名称
 * @param {Function} fn - 要测量的函数
 * @returns {Promise<any>} 函数执行结果
 */
export async function measure(name, fn) {
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
 * @param {Function} fn - 要防抖的函数
 * @param {number} delay - 延迟时间(毫秒)
 * @returns {Function} 防抖后的函数
 */
export function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}

/**
 * 节流函数
 * @param {Function} fn - 要节流的函数
 * @param {number} delay - 延迟时间(毫秒)
 * @returns {Function} 节流后的函数
 */
export function throttle(fn, delay) {
    let last = 0;
    return function(...args) {
        const now = Date.now();
        if (now - last >= delay) {
            last = now;
            fn.apply(this, args);
        }
    };
}

/**
 * requestIdleCallback polyfill
 * @param {Function} callback
 * @param {Object} options
 * @returns {number} id
 */
export function requestIdleCallback(callback, options) {
    if (typeof window.requestIdleCallback === 'function') {
        return window.requestIdleCallback(callback, options);
    } else {
        // Polyfill
        const start = Date.now();
        return setTimeout(() => {
            callback({
                didTimeout: false,
                timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
            });
        }, 1);
    }
}

/**
 * cancelIdleCallback polyfill
 * @param {number} id
 */
export function cancelIdleCallback(id) {
    if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(id);
    } else {
        clearTimeout(id);
    }
}

/**
 * 分批处理大数据集
 * @param {Array} array - 数据数组
 * @param {Function} processor - 处理函数 (item, index) => void
 * @param {number} batchSize - 每批处理的数量
 * @param {number} delay - 批次间延迟(毫秒)
 * @returns {Promise<void>}
 */
export async function batchProcess(array, processor, batchSize = 50, delay = 10) {
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
 * @param {number} ms - 毫秒数
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * RAF 节流
 * 使用 requestAnimationFrame 实现的节流函数
 * @param {Function} fn
 * @returns {Function}
 */
export function rafThrottle(fn) {
    let rafId = null;
    return function(...args) {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            fn.apply(this, args);
            rafId = null;
        });
    };
}

/**
 * 创建性能观察器
 * @param {string} entryType - 条目类型
 * @param {Function} callback - 回调函数
 * @returns {PerformanceObserver|null}
 */
export function createPerformanceObserver(entryType, callback) {
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
 * @param {string} name
 */
export function mark(name) {
    try {
        performance.mark(name);
    } catch (e) {
        console.warn(`[性能] 标记 ${name} 失败:`, e);
    }
}

/**
 * 测量性能指标
 * @param {string} name
 * @param {string} startMark
 * @param {string} endMark
 * @returns {number|null} 持续时间(毫秒)
 */
export function measureDuration(name, startMark, endMark) {
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
 * @param {string} name
 */
export function clearMarks(name) {
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
 * @param {string} name
 */
export function clearMeasures(name) {
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
 * @param {string} name
 * @param {string} type
 * @returns {Array<PerformanceEntry>}
 */
export function getEntries(name, type) {
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
 * 获取导航时序
 * @returns {Object|null}
 */
export function getNavigationTiming() {
    try {
        if (performance.getEntriesByType) {
            const navEntries = performance.getEntriesByType('navigation');
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
 * 记录性能日志
 * @param {string} message
 * @param {Object} data
 */
export function logPerformance(message, data = {}) {
    const timestamp = Date.now();
    const memory = performance.memory ? {
        used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
        total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB'
    } : null;

    console.log(`[性能] ${message}`, {
        timestamp: new Date(timestamp).toLocaleTimeString(),
        memory,
        ...data
    });
}

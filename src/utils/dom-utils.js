// ========== DOM 操作工具 ==========

/**
 * 创建元素并设置属性和样式
 * @param {string} tag - 标签名
 * @param {Object} options - 选项
 * @param {Object} options.attrs - 属性
 * @param {Object} options.styles - 样式
 * @param {string} options.className - 类名
 * @param {string} options.textContent - 文本内容
 * @param {string} options.innerHTML - HTML 内容
 * @returns {HTMLElement}
 */
export function createElement(tag, options = {}) {
    const element = document.createElement(tag);

    if (options.attrs) {
        for (const [key, value] of Object.entries(options.attrs)) {
            element.setAttribute(key, value);
        }
    }

    if (options.styles) {
        for (const [key, value] of Object.entries(options.styles)) {
            element.style[key] = value;
        }
    }

    if (options.className) {
        element.className = options.className;
    }

    if (options.textContent) {
        element.textContent = options.textContent;
    }

    if (options.innerHTML) {
        element.innerHTML = options.innerHTML;
    }

    return element;
}

/**
 * 创建文档片段
 * @returns {DocumentFragment}
 */
export function createFragment() {
    return document.createDocumentFragment();
}

/**
 * 批量添加子元素
 * @param {HTMLElement} parent - 父元素
 * @param {Array<HTMLElement>} children - 子元素数组
 */
export function batchAppend(parent, children) {
    const fragment = createFragment();
    children.forEach(child => {
        if (child) {
            fragment.appendChild(child);
        }
    });
    parent.appendChild(fragment);
}

/**
 * 安全移除元素
 * @param {HTMLElement} element
 */
export function removeElement(element) {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

/**
 * 添加 CSS 类
 * @param {HTMLElement} element
 * @param {string} className
 */
export function addClass(element, className) {
    if (element && className) {
        element.classList.add(className);
    }
}

/**
 * 移除 CSS 类
 * @param {HTMLElement} element
 * @param {string} className
 */
export function removeClass(element, className) {
    if (element && className) {
        element.classList.remove(className);
    }
}

/**
 * 切换 CSS 类
 * @param {HTMLElement} element
 * @param {string} className
 * @returns {boolean} 是否添加了类
 */
export function toggleClass(element, className) {
    if (element && className) {
        return element.classList.toggle(className);
    }
    return false;
}

/**
 * 批量设置样式
 * @param {HTMLElement} element
 * @param {Object} styles - 样式对象
 */
export function setStyles(element, styles) {
    if (element && styles) {
        for (const [key, value] of Object.entries(styles)) {
            element.style[key] = value;
        }
    }
}

/**
 * 批量设置属性
 * @param {HTMLElement} element
 * @param {Object} attrs - 属性对象
 */
export function setAttributes(element, attrs) {
    if (element && attrs) {
        for (const [key, value] of Object.entries(attrs)) {
            element.setAttribute(key, value);
        }
    }
}

/**
 * 查询单个元素
 * @param {string} selector
 * @param {HTMLElement} context
 * @returns {HTMLElement|null}
 */
export function query(selector, context = document) {
    return context.querySelector(selector);
}

/**
 * 查询所有元素
 * @param {string} selector
 * @param {HTMLElement} context
 * @returns {NodeList}
 */
export function queryAll(selector, context = document) {
    return context.querySelectorAll(selector);
}

/**
 * 显示元素
 * @param {HTMLElement} element
 * @param {string} display - 显示方式，默认 'block'
 */
export function show(element, display = 'block') {
    if (element) {
        element.style.display = display;
    }
}

/**
 * 隐藏元素
 * @param {HTMLElement} element
 */
export function hide(element) {
    if (element) {
        element.style.display = 'none';
    }
}

/**
 * 切换元素显示/隐藏
 * @param {HTMLElement} element
 * @param {string} display - 显示方式
 * @returns {boolean} 是否显示
 */
export function toggle(element, display = 'block') {
    if (element) {
        if (element.style.display === 'none') {
            show(element, display);
            return true;
        } else {
            hide(element);
            return false;
        }
    }
    return false;
}

/**
 * 添加事件监听器
 * @param {HTMLElement} element
 * @param {string} event
 * @param {Function} handler
 * @param {Object} options
 */
export function on(element, event, handler, options) {
    if (element && event && handler) {
        element.addEventListener(event, handler, options);
    }
}

/**
 * 移除事件监听器
 * @param {HTMLElement} element
 * @param {string} event
 * @param {Function} handler
 * @param {Object} options
 */
export function off(element, event, handler, options) {
    if (element && event && handler) {
        element.removeEventListener(event, handler, options);
    }
}

/**
 * 清空元素内容
 * @param {HTMLElement} element
 */
export function empty(element) {
    if (element) {
        element.innerHTML = '';
    }
}

/**
 * 获取元素的位置和尺寸
 * @param {HTMLElement} element
 * @returns {DOMRect}
 */
export function getRect(element) {
    return element ? element.getBoundingClientRect() : null;
}

/**
 * 滚动到元素
 * @param {HTMLElement} element
 * @param {Object} options
 */
export function scrollTo(element, options = { behavior: 'smooth', block: 'start' }) {
    if (element) {
        element.scrollIntoView(options);
    }
}

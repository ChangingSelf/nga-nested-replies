// ========== DOM 操作工具 ==========

/**
 * 元素创建选项
 */
interface CreateElementOptions {
  attrs?: Record<string, string>;
  styles?: Record<string, string>;
  className?: string;
  textContent?: string;
  innerHTML?: string;
}

/**
 * 滚动选项
 */
interface ScrollOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  inline?: ScrollLogicalPosition;
}

/**
 * 创建元素并设置属性和样式
 * @param tag - 标签名
 * @param options - 选项
 * @returns HTMLElement
 */
export function createElement(tag: string, options: CreateElementOptions = {}): HTMLElement {
  const element = document.createElement(tag);

  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      element.setAttribute(key, value);
    }
  }

  if (options.styles) {
    for (const [key, value] of Object.entries(options.styles)) {
      (element.style as any)[key] = value;
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
 * @returns DocumentFragment
 */
export function createFragment(): DocumentFragment {
  return document.createDocumentFragment();
}

/**
 * 批量添加子元素
 * @param parent - 父元素
 * @param children - 子元素数组
 */
export function batchAppend(parent: HTMLElement, children: (HTMLElement | null)[]): void {
  const fragment = createFragment();
  children.forEach((child) => {
    if (child) {
      fragment.appendChild(child);
    }
  });
  parent.appendChild(fragment);
}

/**
 * 安全移除元素
 * @param element
 */
export function removeElement(element: HTMLElement | null): void {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * 添加 CSS 类
 * @param element
 * @param className
 */
export function addClass(element: HTMLElement | null, className: string): void {
  if (element && className) {
    element.classList.add(className);
  }
}

/**
 * 移除 CSS 类
 * @param element
 * @param className
 */
export function removeClass(element: HTMLElement | null, className: string): void {
  if (element && className) {
    element.classList.remove(className);
  }
}

/**
 * 切换 CSS 类
 * @param element
 * @param className
 * @returns 是否添加了类
 */
export function toggleClass(element: HTMLElement | null, className: string): boolean {
  if (element && className) {
    return element.classList.toggle(className);
  }
  return false;
}

/**
 * 批量设置样式
 * @param element
 * @param styles - 样式对象
 */
export function setStyles(element: HTMLElement | null, styles: Record<string, string>): void {
  if (element && styles) {
    for (const [key, value] of Object.entries(styles)) {
      (element.style as any)[key] = value;
    }
  }
}

/**
 * 批量设置属性
 * @param element
 * @param attrs - 属性对象
 */
export function setAttributes(element: HTMLElement | null, attrs: Record<string, string>): void {
  if (element && attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      element.setAttribute(key, value);
    }
  }
}

/**
 * 批询单个元素
 * @param selector
 * @param context
 * @returns HTMLElement|null
 */
export function query(selector: string, context: HTMLElement | Document = document): HTMLElement | null {
  return context.querySelector(selector);
}

/**
 * 查询所有元素
 * @param selector
 * @param context
 * @returns NodeList
 */
export function queryAll(selector: string, context: HTMLElement | Document = document): NodeListOf<HTMLElement> {
  return context.querySelectorAll(selector);
}

/**
 * 显示元素
 * @param element
 * @param display - 显示方式，默认 'block'
 */
export function show(element: HTMLElement | null, display: string = 'block'): void {
  if (element) {
    element.style.display = display;
  }
}

/**
 * 隐藏元素
 * @param element
 */
export function hide(element: HTMLElement | null): void {
  if (element) {
    element.style.display = 'none';
  }
}

/**
 * 切换元素显示/隐藏
 * @param element
 * @param display - 显示方式
 * @returns 是否显示
 */
export function toggle(element: HTMLElement | null, display: string = 'block'): boolean {
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
 * @param element
 * @param event
 * @param handler
 * @param options
 */
export function on<T extends Event>(
  element: HTMLElement | null,
  event: string,
  handler: (e: T) => void,
  options?: AddEventListenerOptions
): void {
  if (element && event && handler) {
    element.addEventListener(event, handler as EventListener, options);
  }
}

/**
 * 移除事件监听器
 * @param element
 * @param event
 * @param handler
 * @param options
 */
export function off<T extends Event>(
  element: HTMLElement | null,
  event: string,
  handler: (e: T) => void,
  options?: EventListenerOptions
): void {
  if (element && event && handler) {
    element.removeEventListener(event, handler as EventListener, options);
  }
}

/**
 * 清空元素内容
 * @param element
 */
export function empty(element: HTMLElement | null): void {
  if (element) {
    element.innerHTML = '';
  }
}

/**
 * 获取元素的位置和尺寸
 * @param element
 * @returns DOMRect
 */
export function getRect(element: HTMLElement | null): DOMRect | null {
  return element ? element.getBoundingClientRect() : null;
}

/**
 * 滚动到元素
 * @param element
 * @param options
 */
export function scrollTo(
  element: HTMLElement | null,
  options: ScrollOptions = { behavior: 'smooth', block: 'start' }
): void {
  if (element) {
    element.scrollIntoView(options);
  }
}
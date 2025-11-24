// NGA 楼中楼脚本类型定义

// 基础类型
export interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: number;
  replies?: Comment[];
  level: number;
  parentId?: string;
  page?: number;
}

export interface ThreadData {
  title: string;
  comments: Comment[];
  totalPages: number;
  currentPage: number;
}

export interface AppConfig {
  initialLoadPages: number;
  preloadPages: number;
  cacheExpireTime: number;
  pageLoadInterval: number;
  maxCacheSize: number;
  useIndexedDB: boolean;
  replyCollapseThreshold: number;
  enableReplyCollapse: boolean;
  incrementalRenderBatch: number;
  enableWebWorkerParse: boolean;
  webWorkerParseThreshold: number;
  enablePerformanceLog: boolean;
  useVirtualScroll: boolean;
  virtualScrollBufferSize: number;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expires: number;
}

// 页面信息
export interface PageInfo {
  totalPages: number;
  currentPage: number;
}

// DOM 事件相关
export interface ProgressUpdateEvent {
  type: 'progress';
  loaded: number;
  total: number;
  current: number;
  totalPages: number;
}

export interface ToastMessage {
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

// Storage 相关
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

// 进度回调函数
export type ProgressCallback = (message: string, loaded: number, total: number) => void;

// Tampermonkey API 类型
export interface Tampermonkey {
  openInTab(url: string, open_in_background?: boolean): void;
  setValue(key: string, value: any): void;
  getValue(key: string, defaultValue?: any): any;
  registerMenuCommand(name: string, callback: () => void): void;
}

declare global {
  interface Window {
    GM_openInTab: Tampermonkey['openInTab'];
    GM_setValue: Tampermonkey['setValue'];
    GM_getValue: Tampermonkey['getValue'];
    GM_registerMenuCommand: Tampermonkey['registerMenuCommand'];
    configPanel?: any;
    g?: () => void;
  }

  // 类型扩展
  const GM_openInTab: Tampermonkey['openInTab'];
  const GM_setValue: Tampermonkey['setValue'];
  const GM_getValue: Tampermonkey['getValue'];
  const GM_registerMenuCommand: Tampermonkey['registerMenuCommand'];
}

// 模块声明
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// 工具类类型声明
declare class StorageManager {
  constructor();
  initialize(): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

declare class ConfigManager {
  constructor();
  getConfig(): AppConfig;
  saveConfig(config: Partial<AppConfig>): boolean;
}

declare class PageLoader {
  constructor(
    tid: string,
    storageManager: StorageManager,
    config: AppConfig,
    progressCallback: ProgressCallback
  );
  initialize(pageInfo: PageInfo, container?: HTMLElement | null): Promise<void>;
}

declare class ScrollLoader {
  constructor(pageLoader: PageLoader, config: AppConfig);
  initialize(totalPages: number): void;
}

declare class ConfigPanel {
  constructor(configManager: ConfigManager, storageManager: StorageManager);
  togglePanel(): void;
}

declare class Toast {
  static success(message: string): void;
  static error(message: string): void;
  static info(message: string): void;
}
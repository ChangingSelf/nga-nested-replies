# 架构设计文档

## 核心架构

### 模块化设计

项目采用模块化架构，将原本1700+行的单体文件拆分为多个职责明确的模块：

```
src/
├── index.ts              # 入口文件 (352行)
├── core/                 # 核心业务逻辑
│   ├── page-loader.ts    # 页面加载器
│   ├── scroll-loader.ts  # 滚动加载器
│   ├── thread-parser.ts  # 帖子解析器
│   ├── thread-renderer.ts # 普通渲染器
│   └── virtual-renderer.ts # 虚拟滚动渲染器
├── storage/              # 存储层
│   ├── storage-manager.ts # 存储管理器
│   ├── indexeddb-adapter.ts # IndexedDB适配器
│   ├── cache.ts          # 缓存管理
│   └── config.ts         # 配置管理
├── ui/                   # 用户界面
│   ├── config-panel.ts   # 配置面板
│   ├── toast.ts          # 通知组件
│   ├── reply-collapser.ts # 回复折叠器
│   └── progress.ts       # 进度显示
└── utils/                # 工具函数
    ├── dom-utils.ts      # DOM工具
    ├── performance.ts    # 性能工具
    └── helpers.ts        # 通用助手
```

### 数据流

```
用户访问 → index.ts → PageLoader → ThreadParser → ThreadRenderer/VirtualRenderer → 用户界面
                ↓
           StorageManager ← 缓存系统 ← 配置系统
```

### 存储架构

**GM存储键名规范：**
- `NGA_THREAD_CONFIG` - 用户配置
- `NGA_THREAD_META_{tid}` - 帖子元数据
- `NGA_PAGE_CONTENT_{tid}_{page}` - 页面内容
- `NGA_COLLAPSE_STATE_{tid}` - 折叠状态

## 性能特性

### 1. 渐进式加载
- 初始加载5页立即展示
- 后台继续预加载10页
- 滚动到底部按需加载

### 2. 智能缓存
- 24小时自动过期
- 可配置有效期（1小时-永久）
- 自动清理过期缓存

### 3. 虚拟滚动
- 大于500楼自动启用
- 可配置缓冲区大小
- 只渲染可见区域

## 技术栈

- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **vite-plugin-monkey** - Userscript支持
- **Tampermonkey API** - 浏览器扩展支持
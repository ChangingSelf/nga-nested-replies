# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

这是一个基于 TypeScript 的 Tampermonkey 用户脚本，用于 NGA 论坛，将平面主题结构转换为嵌套回复（楼中楼）。它具有渐进式加载、智能缓存和大主题的虚拟滚动功能。

## 构建命令

```bash
# 构建用户脚本（TypeScript 编译 + Vite 打包）
pnpm build

# 仅 TypeScript 类型检查
pnpm type-check

# 开发构建（仅 Vite，无 TypeScript）
pnpm build:dev

# 格式化代码
pnpm format

# 检查格式化
pnpm format:check
```

构建流程：`tsc && vite build` 将 TypeScript 编译为 JavaScript，然后使用 Vite + vite-plugin-monkey 打包。

## 架构

### 核心模块结构

- **入口点**：`src/index.ts` - 主脚本初始化、工具函数和 Tampermonkey API 交互
- **核心逻辑** (`src/core/`)：
  - `page-loader.ts` - 处理渐进式页面加载和缓存编排
  - `scroll-loader.ts` - 管理滚动触发的惰性加载
  - `thread-parser.ts` - 解析 HTML 以构建回复树结构
  - `thread-renderer.ts` - 标准基于 DOM 的主题渲染
  - `virtual-renderer.ts` - 大主题的虚拟滚动实现

- **存储层** (`src/storage/`)：
  - `storage-manager.ts` - 统一存储接口（GM 存储/IndexedDB）
  - `indexeddb-adapter.ts` - IndexedDB 实现
  - `cache.ts` - 主题元数据和页面内容缓存
  - `config.ts` - 用户配置管理

- **UI 组件** (`src/ui/`)：
  - `config-panel.ts` - 设置和缓存管理界面
  - `toast.ts` - 通知系统
  - `reply-collapser.ts` - 回复折叠/展开功能
  - `progress.ts` - 加载进度显示

- **工具类** (`src/utils/`)：
  - `dom-utils.ts` - DOM 操作助手
  - `performance.ts` - 性能测量和优化
  - `helpers.ts` - 通用工具函数

### 关键依赖项

构建系统具有必须维护的特定导入要求：

1. **实际实现不使用 `declare class`** - 所有核心类必须正确导入
2. **PageLoader 导入**：必须明确导入 ThreadParser、ThreadRenderer、VirtualRenderer
3. **渲染器导入**：必须明确导入 ReplyCollapser
4. **vite.config.ts 中禁用树摇** 以确保所有模块都被打包

### 加载策略

脚本分三个阶段运行：
1. **初始加载**：加载配置数量的页面（默认 5 页）并立即渲染
2. **后台预加载**：在用户阅读时继续加载额外页面（默认 10 页）
3. **滚动加载**：滚动到底部时按需加载更多页面

### 数据流

1. `index.ts` → 检测主题，提取 `tid`，初始化存储
2. `PageLoader` → 协调页面加载策略
3. `ThreadParser` → 从 HTML 构建回复层次结构
4. `ThreadRenderer/VirtualRenderer` → 渲染嵌套回复
5. `ScrollLoader` → 处理无限滚动
6. `ConfigPanel` → 提供用户界面设置

### 存储架构

- **主题元数据**：`NGA_THREAD_META_{tid}` - totalPages、cachedPages、lastAccess
- **页面内容**：`NGA_PAGE_CONTENT_{tid}_{page}` - 带时间戳的原始 HTML
- **配置**：`NGA_THREAD_CONFIG` - 用户设置
- **折叠状态**：`NGA_COLLAPSE_STATE_{tid}` - 展开的回复楼层

### 重要实现说明

- **页面加载间隔**：对后端加载至关重要 - 使用 `pageLoadInterval`（默认 1000ms）
- **GM_openInTab**：必须使用 `false` 参数进行后台标签页打开
- **虚拟滚动**：对大主题自动启用，可配置缓冲区大小
- **缓存过期**：可从 1 小时配置到永久存储
- **错误处理**：失败的页面加载不会停止整体加载过程

## Tampermonkey 集成

脚本需要这些 GM API（在 vite.config.ts 中声明）：
- `GM_openInTab` - 后台页面加载
- `GM_setValue/GM_getValue` - 存储
- `GM_registerMenuCommand` - 设置菜单条目

## 类型系统

所有接口都在 `src/types/index.d.ts` 中定义。关键类型：
- `AppConfig` - 用户配置结构
- `PageInfo` - 主题分页信息
- `Comment` - 带嵌套的回复数据结构
- `ThreadMeta` - 缓存元数据结构
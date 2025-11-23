# NGA 楼中楼脚本 - 模块化重构指南

## v2.2.0 模块化重构说明

### 重构目标

1. ✅ **代码组织**：将1800+行的单文件代码拆分为多个模块
2. ✅ **可维护性**：每个模块职责单一，便于理解和修改
3. ✅ **打包工具**：使用Node.js脚本自动合并为单文件用户脚本
4. ⏳ **后续优化**：为IndexedDB迁移奠定基础

### 模块结构

```
nga-nested-replies/
├── src/                          # 源代码模块目录
│   ├── utils/                    # 工具函数模块
│   │   └── helpers.js           # 通用工具函数（格式化、防抖等）
│   ├── storage/                  # 存储相关模块
│   │   ├── config.js            # 配置管理（ConfigManager）
│   │   └── cache.js             # 缓存管理（CacheManager）
│   └── ui/                       # UI组件模块
│       └── progress.js          # 进度条组件
├── main.js                       # 主文件（包含未模块化的部分）
├── build.js                      # 打包脚本
├── package.json                  # Node.js配置
└── nga-nested-replies.user.js   # 打包输出文件（用于Tampermonkey）
```

### 已提取的模块

#### 1. utils/helpers.js - 工具函数模块

- `formatSize(bytes)` - 格式化文件大小
- `formatTime(timestamp)` - 格式化时间
- `extractTid()` - 从URL提取tid
- `sleep(ms)` - 等待函数
- `debounce(fn, delay)` - 防抖函数
- `throttle(fn, delay)` - 节流函数

#### 2. storage/config.js - 配置管理模块

- `ConfigManager` 类
  - `loadConfig()` - 加载配置
  - `saveConfig(newConfig)` - 保存配置
  - `getConfig()` - 获取配置

#### 3. storage/cache.js - 缓存管理模块

- `CacheManager` 类
  - `getMeta()` - 获取元数据
  - `saveMeta(meta)` - 保存元数据
  - `getPageContent(page)` - 获取页面内容
  - `savePageContent(page, rawHTML)` - 保存页面内容
  - `isCacheValid(cacheExpireTime)` - 检查缓存有效性
  - `clearCache()` - 清理缓存
  - `getCacheSize()` - 获取缓存大小
  - 静态方法：
    - `getTotalCacheSize()` - 获取总缓存大小
    - `cleanOldestCache(maxSize)` - 清理旧缓存

#### 4. ui/progress.js - 进度条UI模块

- 进度条相关函数：
  - `createProgressBar()` - 创建进度条
  - `expandProgress()` - 展开进度条
  - `collapseProgress()` - 折叠进度条
  - `updateProgressLine2(t)` - 更新进度文本
  - `updateProgressDetail()` - 更新详细信息
  - `removeProgressBar()` - 移除进度条

### 未模块化的部分（保留在main.js）

以下代码暂时保留在main.js中，等待进一步重构：

1. **ConfigPanel 类**（280-822行）- 配置面板UI
2. **核心加载逻辑**（823-1801行）：
   - 页面解析函数（`parsePageInfo`, `extractThreadTitle`等）
   - 楼中楼构建算法（`buildNestedReplies`, `renderNestedReplies`等）
   - 页面加载器（`loadNextPage`, `fetchPageContent`等）
   - 缓存加载/保存逻辑
   - 滚动加载处理

### 如何打包

#### 方式1：直接执行

```bash
node build.js
```

#### 方式2：使用npm（推荐）

```bash
npm run build
```

#### 输出结果

- 生成文件：`nga-nested-replies.user.js`
- 文件位置：项目根目录
- 安装方式：在Tampermonkey中打开该文件并安装

### 下一步重构计划

#### 第二阶段：继续拆分模块

1. **ui/config-panel.js** - 配置面板模块
   - 提取 `ConfigPanel` 类及相关方法

2. **core/page-loader.js** - 页面加载模块
   - `loadNextPage()`
   - `fetchPageContent()`
   - `expandAllCollapses()`

3. **core/thread-builder.js** - 楼中楼构建模块
   - `buildNestedReplies()`
   - `renderNestedReplies()`
   - `performProgressiveConversion()`

4. **core/cache-loader.js** - 缓存加载模块
   - `loadFromCache()`
   - `startFreshLoading()`

5. **main.js** - 主入口（简化版）
   - 全局变量初始化
   - 事件监听
   - 函数调用组装

#### 第三阶段：IndexedDB迁移

1. **storage/indexeddb.js** - IndexedDB适配层
   - 替换所有 `GM_setValue`/`GM_getValue` 调用
   - 实现异步缓存读写
   - 数据迁移工具

### 重构优势

✅ **已实现的优势**：

1. 代码结构更清晰，职责分明
2. 便于团队协作和代码审查
3. 单个模块可独立测试
4. 便于后续功能扩展

⏳ **后续优势**：

1. 支持热重载开发（--watch模式）
2. 可以逐步引入TypeScript
3. 便于单元测试覆盖
4. 为CI/CD流程做准备

### 使用说明

#### 开发流程

1. **修改源码**：编辑 `src/` 目录下的模块文件
2. **重新打包**：运行 `npm run build`
3. **测试脚本**：在Tampermonkey中重新安装打包后的文件
4. **验证功能**：访问NGA帖子页面测试

#### 添加新模块

1. 在 `src/` 对应子目录创建新文件
2. 在 `build.js` 的 `extractedModules` 数组中添加模块路径
3. 运行打包命令

#### 调试技巧

1. 使用浏览器开发者工具的 Console 查看日志
2. 所有模块都有 `[模块名]` 前缀的日志
3. 可以在源码中添加更多 `console.log` 进行调试

### 常见问题

**Q: 为什么打包后文件变大了？**
A: 因为添加了详细的注释和文档字符串，实际可执行代码量是减少的。

**Q: 如何回退到单文件版本？**
A: 直接使用 `main.js` 文件，它仍然是完整可用的单文件版本。

**Q: 模块化后性能有影响吗？**
A: 没有。打包后仍然是单文件执行，性能与之前完全相同。

**Q: 可以不打包直接使用吗？**
A: 不可以。Tampermonkey要求单文件格式，必须打包后使用。

### 版本历史

- **v2.1.0** - 修复预加载Bug、改进进度条UI
- **v2.2.0** - 模块化重构，拆分4个核心模块
- **v3.0.0** (计划) - 完整模块化 + IndexedDB迁移

### 贡献指南

欢迎提交PR！请遵循以下规范：

1. 模块职责单一
2. 添加完整的JSDoc注释
3. 保持代码风格一致
4. 测试后再提交

---

_最后更新：2024-11-16_
_维护者：cloud_rider_

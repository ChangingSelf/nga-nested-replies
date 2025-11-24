# 开发指南

## 环境要求

- Node.js 16+
- pnpm (推荐)
- TypeScript 5.0+

## 构建命令

```bash
# 完整构建（TypeScript编译 + Vite打包）
pnpm build

# 仅类型检查
pnpm type-check

# 开发构建（仅Vite打包）
pnpm build:dev

# 代码格式化
pnpm format
```

## 关键依赖关系

⚠️ **重要**：由于Vite的tree-shaking机制，必须正确导入所有核心类：

### PageLoader必须导入
```typescript
import ThreadParser from './thread-parser.js';
import ThreadRenderer from './thread-renderer.js';
import VirtualRenderer from './virtual-renderer.js';
```

### 渲染器必须导入
```typescript
import ReplyCollapser from '../ui/reply-collapser.js';
```

## 构建配置

### vite.config.ts 关键设置
```typescript
build: {
  minify: false, // 保持代码可读性
  rollupOptions: {
    treeshake: false, // 禁用tree-shaking确保所有代码被打包
  },
}
```

### tsconfig.json 关键设置
```typescript
{
  "compilerOptions": {
    "noUnusedLocals": false,    // 防止过度优化
    "noUnusedParameters": false, // 防止过度优化
    "isolatedModules": true,    // Vite要求
  }
}
```

## 调试技巧

### 1. 开发模式
使用 `pnpm build:dev` 进行快速构建，跳过TypeScript编译。

### 2. 类型检查
`pnpm type-check` 可以在不构建的情况下检查类型错误。

### 3. 查看打包结果
构建后的文件在 `dist/nga-nested-replies.user.js`，可以直接在Tampermonkey中测试。

## 常见问题

### Q: 新增的类没有被打包？
A: 检查是否在相关文件中正确导入该类。Vite需要显式的import关系来识别依赖。

### Q: GM_openInTab 导致页面切换到前台？
A: 确保使用 `GM_openInTab(url, false)`，false参数表示后台打开。

### Q: 页面加载没有间隔？
A: 检查 `pageLoadInterval` 配置，默认1000ms间隔对后台加载很重要。
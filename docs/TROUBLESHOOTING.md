# 故障排除指南

## 常见问题

### Q: 脚本无法运行，页面无反应

**可能原因：**
1. Tampermonkey未正确安装
2. 脚本版本不兼容
3. 网站域名匹配问题

**解决方案：**
```bash
# 重新构建脚本
pnpm build

# 检查vite.config.ts中的match配置
match: [
  'https://bbs.nga.cn/read.php?tid=*',
  'https://ngabbs.com/read.php?tid=*',
  'https://nga.178.com/read.php?tid=*',
]
```

### Q: 页面加载时强制切换到前台

**症状：** 后台爬取时浏览器焦点被强制切换

**解决方案：**
检查 `GM_openInTab` 调用：
```typescript
// 正确写法 - 后台打开
GM_openInTab(url, false);

// 错误写法 - 前台打开
GM_openInTab(url);
GM_openInTab(url, true);
```

### Q: TypeScript编译错误

**常见错误：**
```
error TS2345: Argument of type '{ active: boolean; }' is not assignable to parameter of type 'boolean | undefined'.
```

**解决方案：**
GM_openInTab只接受布尔值参数：
```typescript
// 正确
GM_openInTab(url, false);

// 错误
GM_openInTab(url, { active: false });
```

### Q: 运行时错误 "ThreadParser is not defined"

**原因：** 类导入问题，Vite tree-shaking移除了未使用的类

**解决方案：**
确保所有核心类都被正确导入：
```typescript
// page-loader.ts 必须导入
import ThreadParser from './thread-parser.js';
import ThreadRenderer from './thread-renderer.js';
import VirtualRenderer from './virtual-renderer.js';

// 渲染器必须导入
import ReplyCollapser from '../ui/reply-collapser.js';
```

### Q: 缓存功能异常

**症状：** 页面重新加载时缓存无效

**检查项：**
1. GM存储权限是否授予
2. 浏览器是否清除数据
3. 脚本版本更新后缓存格式变化

**调试方法：**
```javascript
// 在控制台检查
console.log(GM_getValue('NGA_THREAD_CONFIG'));
```

### Q: 虚拟滚动不工作

**检查配置：**
1. `useVirtualScroll` 是否启用
2. `virtualScrollBufferSize` 设置是否合理
3. 楼层数量是否达到触发阈值

## 性能问题

### Q: 页面加载缓慢

**优化建议：**
1. 调整 `initialLoadPages`（减少初始加载页数）
2. 增加 `pageLoadInterval`（延长页面间隔）
3. 启用虚拟滚动（减少DOM节点）

### Q: 内存占用过高

**检查项：**
1. 缓存容量设置
2. 虚拟滚动缓冲区大小
3. 长时间使用后的内存泄漏

## 开发调试

### 启用日志
在脚本中添加调试代码：
```javascript
// 在index.ts开头添加
window.DEBUG = true;
```

### 检查打包结果
```bash
# 查看打包后文件大小
ls -la dist/nga-nested-replies.user.js

# 搜索关键函数是否存在
grep "GM_openInTab" dist/nga-nested-replies.user.js
```

### 类型检查
```bash
pnpm type-check
```

## 获取帮助

如果以上解决方案无法解决问题，请：
1. 提供浏览器控制台错误信息
2. 说明具体的操作步骤
3. 提供脚本版本和浏览器版本
4. 检查是否有其他脚本冲突
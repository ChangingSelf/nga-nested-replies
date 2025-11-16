import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/index.js',
      userscript: {
        name: 'NGA 楼中楼（改进版）',
        namespace: 'http://tampermonkey.net/',
        version: '2.2.0',
        description: '遍历帖子所有界面并自动展开折叠内容，然后重新组织为楼中楼形式。支持渐进式加载、智能缓存、配置管理（Vite构建版）',
        author: 'cloud_rider',
        match: [
          'https://bbs.nga.cn/read.php?tid=*',
          'https://ngabbs.com/read.php?tid=*',
          'https://nga.178.com/read.php?tid=*'
        ],
        grant: [
          'GM_openInTab',
          'GM_setValue',
          'GM_getValue',
          'GM_registerMenuCommand'
        ],
        'run-at': 'document-end',
        license: 'MIT',
        downloadURL: 'https://update.greasyfork.org/scripts/554439/NGA%20%E6%A5%BC%E4%B8%AD%E6%A5%BC.user.js',
        updateURL: 'https://update.greasyfork.org/scripts/554439/NGA%20%E6%A5%BC%E4%B8%AD%E6%A5%BC.meta.js'
      },
      build: {
        fileName: 'nga-nested-replies.user.js'
      }
    })
  ],
  build: {
    minify: false, // 不压缩，保持代码可读性
    target: 'esnext'
  }
});

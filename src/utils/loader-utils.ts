// ========== Loader 页面处理工具 ==========

/**
 * 自动点击跳转链接
 */
export function autoClickJump(): void {
  try {
    if (document.body.innerHTML.includes('访客不能直接访问')) {
      if (window.g) {
        window.g();
        return;
      }
      const link = document.querySelector('a[onclick="g()"]') as HTMLAnchorElement;
      if (link) {
        link.click();
        setTimeout(extractPosts, 2000);
        return;
      }
      setAntiBotCookie();
      return;
    }
    extractPosts();
  } catch (e) {
    console.error('[Loader] autoClickJump 错误:', e);
  }
}

/**
 * 设置反机器人 Cookie
 */
export function setAntiBotCookie(): void {
  try {
    const now = Date.now();
    document.cookie = `guestJs=${Math.floor(now / 1000)}_9c1cuj;domain=bbs.nga.cn;path=/;max-age=1800`;
    document.cookie = `lastpath=0;domain=bbs.nga.cn;path=/;max-age=0`;
    const url = new URL(window.location.href);
    url.searchParams.set('rand', Math.floor(Math.random() * 1000).toString());
    setTimeout(() => window.location.replace(url.toString()), 300);
  } catch (e) {
    console.error('[Loader] setAntiBotCookie 错误:', e);
  }
}

/**
 * 提取帖子内容
 */
export function extractPosts(): void {
  try {
    const page = new URLSearchParams(window.location.search).get('page') || '1';
    const container = document.getElementById('m_posts_c');
    if (container) {
      GM_setValue(`POSTS_${page}`, container.innerHTML);
      console.log('[Loader] 子页', page, '数据写入 GM_setValue');
      setTimeout(() => window.close(), 500);
    } else {
      console.warn('[Loader] 子页', page, '未找到 m_posts_c，稍后重试');
      setTimeout(extractPosts, 1000);
    }
  } catch (e) {
    console.error('[Loader] extractPosts 错误:', e);
  }
}

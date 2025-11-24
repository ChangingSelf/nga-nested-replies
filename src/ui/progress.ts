// ========== 进度条UI模块 ==========

// 进度条全局变量
let progressBar: HTMLElement | null = null;
let progressLine2: HTMLElement | null = null;
let isProgressLoading = true;

/**
 * 创建进度条
 */
function createProgressBar(): void {
  progressBar = document.createElement('div');
  progressBar.id = 'nga-progress-bar';
  progressBar.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 30px;
        background: rgba(0,0,0,0.85);
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 13px;
        z-index: 9999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: all 0.3s ease;
        max-width: 350px;
        min-width: 50px;
    `;

  // 紧凑状态图标
  const compactIcon = document.createElement('div');
  compactIcon.id = 'progress-compact';
  compactIcon.innerHTML = '📊';
  compactIcon.style.cssText = 'display: none; font-size: 20px;';

  // 展开状态内容
  const expandedContent = document.createElement('div');
  expandedContent.id = 'progress-expanded';
  expandedContent.style.cssText = 'display: block;';

  const line1 = document.createElement('div');
  line1.textContent = '楼中楼加载中';
  line1.style.cssText = 'font-weight: bold; margin-bottom: 4px;';

  progressLine2 = document.createElement('div');
  progressLine2.textContent = '正在初始化...';
  progressLine2.style.cssText = 'font-size: 12px; margin-bottom: 2px;';

  const progressLine3 = document.createElement('div');
  progressLine3.id = 'progress-detail';
  progressLine3.style.cssText =
    'font-size: 11px; color: #d1d5db; display: none;';

  expandedContent.appendChild(line1);
  expandedContent.appendChild(progressLine2);
  expandedContent.appendChild(progressLine3);

  progressBar.appendChild(compactIcon);
  progressBar.appendChild(expandedContent);
  document.body.appendChild(progressBar);

  // 鼠标悬停展开/折叠
  progressBar.addEventListener('mouseenter', expandProgress);
  progressBar.addEventListener('mouseleave', collapseProgress);
}

/**
 * 展开进度条
 */
function expandProgress(): void {
  if (!progressBar) return;
  progressBar.style.maxWidth = '350px';
  const compactIcon = document.getElementById('progress-compact');
  const expandedContent = document.getElementById('progress-expanded');
  if (compactIcon) compactIcon.style.display = 'none';
  if (expandedContent) expandedContent.style.display = 'block';
}

/**
 * 折叠进度条
 */
function collapseProgress(): void {
  if (!progressBar || isProgressLoading) return; // 加载中不自动折叠
  progressBar.style.maxWidth = '50px';
  const compactIcon = document.getElementById('progress-compact');
  const expandedContent = document.getElementById('progress-expanded');
  if (compactIcon) compactIcon.style.display = 'block';
  if (expandedContent) expandedContent.style.display = 'none';
}

/**
 * 更新进度条第二行文字
 */
function updateProgressLine2(text: string): void {
  if (progressLine2) {
    progressLine2.textContent = text;
    // 检查是否完成加载
    isProgressLoading = !text.includes('完成') && !text.includes('错误');
  }
}

/**
 * 更新进度详情
 */
function updateProgressDetail(loaded: number, total: number, cached: number = 0): void {
  const detailDiv = document.getElementById('progress-detail');
  if (detailDiv) {
    detailDiv.style.display = 'block';
    detailDiv.textContent = `已加载: ${loaded} 页 | 总页数: ${total} | 已缓存: ${cached} 页`;
  }
}

/**
 * 隐藏进度详情
 */
function hideProgressDetail(): void {
  const detailDiv = document.getElementById('progress-detail');
  if (detailDiv) {
    detailDiv.style.display = 'none';
  }
}

/**
 * 移除进度条（实际上只是折叠并保持显示）
 */
function removeProgressBar(): void {
  if (progressBar) {
    isProgressLoading = false;
    // 加载完成后保持显示并自动折叠
    collapseProgress();
    // 不自动移除，让用户可以看到最终状态
  }
}

export {
  createProgressBar,
  updateProgressLine2,
  updateProgressDetail,
  hideProgressDetail,
  removeProgressBar,
  expandProgress,
  collapseProgress
};
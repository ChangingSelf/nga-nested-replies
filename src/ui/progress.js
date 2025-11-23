// ========== 进度条UI模块 ==========

// 注意：这些全局变量在main.js中也需要声明一次，因为它们会在多个地方使用
// 打包时会自动处理重复声明问题
var progressBar = null;
var progressLine2 = null;
var isProgressExpanded = true;
var isProgressLoading = true;

function createProgressBar() {
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

function expandProgress() {
  if (!progressBar) return;
  isProgressExpanded = true;
  progressBar.style.maxWidth = '350px';
  document.getElementById('progress-compact').style.display = 'none';
  document.getElementById('progress-expanded').style.display = 'block';
}

function collapseProgress() {
  if (!progressBar || isProgressLoading) return; // 加载中不自动折叠
  isProgressExpanded = false;
  progressBar.style.maxWidth = '50px';
  document.getElementById('progress-compact').style.display = 'block';
  document.getElementById('progress-expanded').style.display = 'none';
}

function updateProgressLine2(t) {
  if (progressLine2) {
    progressLine2.textContent = t;
    // 检查是否完成加载
    isProgressLoading = !t.includes('完成') && !t.includes('错误');
  }
}

function updateProgressDetail(loaded, total, cached = 0) {
  const detailDiv = document.getElementById('progress-detail');
  if (detailDiv) {
    detailDiv.style.display = 'block';
    detailDiv.textContent = `已加载: ${loaded} 页 | 总页数: ${total} | 已缓存: ${cached} 页`;
  }
}

function hideProgressDetail() {
  const detailDiv = document.getElementById('progress-detail');
  if (detailDiv) {
    detailDiv.style.display = 'none';
  }
}

function removeProgressBar() {
  if (progressBar) {
    isProgressLoading = false;
    // 加载完成后保持显示并自动折叠
    collapseProgress();
    // 不自动移除，让用户可以看到最终状态
  }
}

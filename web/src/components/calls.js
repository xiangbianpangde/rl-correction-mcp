/**
 * 调用记录组件
 * 加载、渲染调用记录列表和统计
 */

import { apiService } from '../api.js';
import { appStore } from '../store.js';
import { elements } from '../dom.js';
import { showToast } from '../toast.js';
import { escapeHtml } from '../utils.js';
import { API_BASE } from '../api.js';
import { openCallDrawer } from './drawer.js';

/** 调用记录本地状态 */
const callState = {
  page: 0,
  limit: 50,
  total: 0,
  calls: [],
  filterTool: '',
  filterStatus: '',
};

/**
 * 加载调用记录
 */
export async function loadCalls() {
  try {
    const params = new URLSearchParams({
      limit: callState.limit,
      offset: callState.page * callState.limit,
    });
    if (callState.filterTool) params.append('tool_name', callState.filterTool);
    if (callState.filterStatus) params.append('result_status', callState.filterStatus);

    const response = await fetch(`${API_BASE}/api/calls?${params}`);
    if (!response.ok) throw new Error('加载调用记录失败');

    const data = await response.json();
    callState.calls = data.calls;
    callState.total = data.total;

    renderCalls();
    updateCallPagination();
  } catch (error) {
    console.error('加载调用记录失败:', error);
    showToast('加载调用记录失败: ' + error.message, 'error');
  }
}

/**
 * 加载调用统计
 */
export async function loadCallStats() {
  try {
    const response = await fetch(`${API_BASE}/api/calls/stats`);
    if (!response.ok) throw new Error('加载调用统计失败');

    const stats = await response.json();

    // 更新统计卡片
    const statTotal = document.getElementById('stat-call-total');
    const statSuccess = document.getElementById('stat-call-success');
    const statError = document.getElementById('stat-call-error');
    const statToday = document.getElementById('stat-call-today');
    const callCount = document.getElementById('call-count');

    if (statTotal) statTotal.textContent = stats.total || 0;
    if (statSuccess) statSuccess.textContent = stats.success || 0;
    if (statError) statError.textContent = stats.error || 0;
    if (statToday) statToday.textContent = stats.today || 0;
    if (callCount) callCount.textContent = stats.total || 0;

    // 更新工具分布
    const toolStats = document.getElementById('call-tool-stats');
    if (toolStats && stats.by_tool) {
      toolStats.innerHTML = Object.entries(stats.by_tool)
        .map(([tool, count]) => `<span class="tag">${tool}: ${count}</span>`)
        .join('');
    }
  } catch (error) {
    console.error('加载调用统计失败:', error);
  }
}

/**
 * 渲染调用记录列表
 */
export function renderCalls() {
  const container = document.getElementById('calls-list');
  if (!container) return;

  if (callState.calls.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无调用记录</div>';
    return;
  }

  container.innerHTML = callState.calls.map(call => {
    const statusIcon = call.result_status === 'success' ? '✅' : '❌';
    const statusClass = call.result_status === 'success' ? 'success' : 'error';
    const time = new Date(call.timestamp).toLocaleString('zh-CN');
    const params = call.parameters ? JSON.stringify(call.parameters).slice(0, 100) + '...' : '无参数';

    return `
      <article class="record-card clickable" data-call-id="${call.id}">
        <div class="record-header">
          <span class="record-type correction">${statusIcon} ${call.tool_name}</span>
          <span class="priority-badge ${statusClass}">${call.result_status}</span>
        </div>
        <p class="record-title">时间: ${time}</p>
        <p class="record-preview">参数: ${escapeHtml(params)}</p>
        ${call.related_correction_id ? `<p class="record-preview">关联修正对: ${call.related_correction_id.slice(0, 8)}...</p>` : ''}
        ${call.duration_ms ? `<span class="quality-score">耗时: ${call.duration_ms}ms</span>` : ''}
      </article>
    `;
  }).join('');

  // 添加点击事件
  container.querySelectorAll('.record-card.clickable').forEach(card => {
    card.addEventListener('click', () => {
      const callId = card.dataset.callId;
      const call = callState.calls.find(c => c.id === callId);
      if (call) openCallDrawer(call);
    });
  });
}

/**
 * 更新调用记录分页
 */
export function updateCallPagination() {
  const prevBtn = document.getElementById('call-prev');
  const nextBtn = document.getElementById('call-next');
  const pageInfo = document.getElementById('call-page-info');

  const totalPages = Math.ceil(callState.total / callState.limit);
  const currentPage = callState.page + 1;

  if (prevBtn) prevBtn.disabled = callState.page === 0;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (pageInfo) pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页 (${callState.total} 条)`;
}

/**
 * 绑定调用记录事件
 */
export function bindCallEvents() {
  // 刷新按钮
  const refreshBtn = document.getElementById('btn-refresh-calls');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadCalls();
      loadCallStats();
    });
  }

  // 筛选器
  const toolFilter = document.getElementById('call-filter-tool');
  const statusFilter = document.getElementById('call-filter-status');

  if (toolFilter) {
    toolFilter.addEventListener('change', (e) => {
      callState.filterTool = e.target.value;
      callState.page = 0;
      loadCalls();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      callState.filterStatus = e.target.value;
      callState.page = 0;
      loadCalls();
    });
  }

  // 分页按钮
  const prevBtn = document.getElementById('call-prev');
  const nextBtn = document.getElementById('call-next');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (callState.page > 0) {
        callState.page--;
        loadCalls();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(callState.total / callState.limit);
      if (callState.page + 1 < totalPages) {
        callState.page++;
        loadCalls();
      }
    });
  }
}

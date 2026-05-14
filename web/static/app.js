/**
 * RL Correction MCP Web UI - 前端应用
 * 三链存储版
 */

// API 基础 URL
const API_BASE = '';

// ============================================================
// 工具函数
// ============================================================

// 全局加载指示器
const loader = {
  element: null,
  count: 0,
  
  init() {
    this.element = document.getElementById('global-loader');
  },
  
  show() {
    this.count++;
    if (this.element) {
      this.element.classList.remove('hidden');
    }
  },
  
  hide() {
    this.count = Math.max(0, this.count - 1);
    if (this.count === 0 && this.element) {
      this.element.classList.add('hidden');
    }
  },
  
  forceHide() {
    this.count = 0;
    if (this.element) {
      this.element.classList.add('hidden');
    }
  }
};

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 状态管理
const state = {
  currentView: 'dashboard',
  corrections: { page: 0, limit: 20, total: 0, records: [] },
  rules: { page: 0, limit: 20, total: 0, records: [] },
  stats: null,
  currentRecord: null,
  deleteTarget: null,
};

// DOM 元素缓存
const elements = {};

function cacheElements() {
  elements.navItems = document.querySelectorAll('.nav-item');
  elements.views = document.querySelectorAll('.view');
  elements.statTotal = document.getElementById('stat-total');
  elements.statCorrections = document.getElementById('stat-corrections');
  elements.statRules = document.getElementById('stat-rules');
  elements.correctionCount = document.getElementById('correction-count');
  elements.ruleCount = document.getElementById('rule-count');
  elements.ruleTypes = document.getElementById('rule-types');
  elements.allTags = document.getElementById('all-tags');
  elements.correctionsList = document.getElementById('corrections-list');
  elements.rulesList = document.getElementById('rules-list');
  elements.correctionPrev = document.getElementById('correction-prev');
  elements.correctionNext = document.getElementById('correction-next');
  elements.rulePrev = document.getElementById('rule-prev');
  elements.ruleNext = document.getElementById('rule-next');
  elements.correctionPageInfo = document.getElementById('correction-page-info');
  elements.rulePageInfo = document.getElementById('rule-page-info');
  elements.ragSearchForm = document.getElementById('rag-search-form');
  elements.searchResults = document.getElementById('search-results');
  elements.modal = document.getElementById('modal');
  elements.modalTitle = document.getElementById('modal-title');
  elements.modalBody = document.getElementById('modal-body');
  elements.modalSubmit = document.getElementById('modal-submit');
  elements.modalClose = document.getElementById('modal-close');
  elements.modalCancel = document.getElementById('modal-cancel');
  elements.drawer = document.getElementById('drawer');
  elements.drawerTitle = document.getElementById('drawer-title');
  elements.drawerBody = document.getElementById('drawer-body');
  elements.drawerClose = document.getElementById('drawer-close');
  elements.drawerCloseBtn = document.getElementById('drawer-close-btn');
  elements.drawerDelete = document.getElementById('drawer-delete');
  elements.drawerEdit = document.getElementById('drawer-edit');
  elements.confirmModal = document.getElementById('confirm-modal');
  elements.confirmCancel = document.getElementById('confirm-cancel');
  elements.confirmDelete = document.getElementById('confirm-delete');
  elements.toastContainer = document.getElementById('toast-container');
  elements.btnAddNew = document.getElementById('btn-add-new');
  elements.btnAddCorrection = document.getElementById('btn-add-correction');
  elements.btnAddRule = document.getElementById('btn-add-rule');
}

// API 调用（带加载指示器）
async function api(endpoint, options = {}) {
  const url = `${API_BASE}/api${endpoint}`;
  loader.show();
  
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: '未知错误' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json();
  } catch (error) {
    // 统一错误提示
    showToast(error.message || '网络请求失败', 'error');
    throw error;
  } finally {
    loader.hide();
  }
}

const apiService = {
  getStats: () => api('/stats'),
  listRecords: (params) => api(`/records?${new URLSearchParams(params)}`),
  getRecord: (id) => api(`/records/${id}`),
  addCorrection: (data) => api('/corrections', { method: 'POST', body: data }),
  addRule: (data) => api('/rules', { method: 'POST', body: data }),
  updateCorrection: (id, data) => api(`/records/${id}`, { method: 'PUT', body: data }),
  updateRule: (id, data) => api(`/rules/${id}`, { method: 'PUT', body: data }),
  deleteRecord: (id) => api(`/records/${id}`, { method: 'DELETE' }),
  search: (data) => api('/search', { method: 'POST', body: data }),
  // 新增：三链专用 API
  reviewRecord: (id, data) => api(`/records/${id}/review`, { method: 'POST', body: data }),
  updateLogicChain: (id, data) => api(`/records/${id}/logic-chain`, { method: 'PUT', body: data }),
};

// 视图切换
function switchView(viewName) {
  state.currentView = viewName;
  elements.navItems.forEach(item => {
    const isActive = item.dataset.view === viewName;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-current', isActive ? 'page' : undefined);
  });
  elements.views.forEach(view => {
    view.classList.toggle('hidden', view.id !== `view-${viewName}`);
  });
  if (viewName === 'dashboard') loadDashboard();
  else if (viewName === 'corrections') loadCorrections();
  else if (viewName === 'rules') loadRules();
  else if (viewName === 'calls') {
    loadCalls();
    loadCallStats();
  }
}

// 概览
async function loadDashboard() {
  try {
    // 显示骨架屏
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.show(
        document.querySelector('.stats-grid'), 'stat', 3
      );
    }

    const stats = await apiService.getStats();
    state.stats = stats;

    // 隐藏骨架屏并使用数字动画
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.hide(
        document.querySelector('.stats-grid')
      );
      window.EnhancedInteractions.animateNumber(elements.statTotal, stats.total_records);
      window.EnhancedInteractions.animateNumber(elements.statCorrections, stats.correction_pairs);
      window.EnhancedInteractions.animateNumber(elements.statRules, stats.behavior_rules);
    } else {
      elements.statTotal.textContent = stats.total_records;
      elements.statCorrections.textContent = stats.correction_pairs;
      elements.statRules.textContent = stats.behavior_rules;
    }

    elements.correctionCount.textContent = stats.correction_pairs;
    elements.ruleCount.textContent = stats.behavior_rules;
    elements.ruleTypes.innerHTML = Object.entries(stats.rule_type_breakdown || {})
      .map(([type, count]) => `
        <div class="rule-type">
          <span class="rule-type-indicator ${type}"></span>
          <span>${getRuleTypeLabel(type)}: ${count}</span>
        </div>
      `).join('');
    elements.allTags.innerHTML = (stats.all_tags || [])
      .map(tag => `<span class="tag">${tag}</span>`).join('');
  } catch (error) {
    showToast('加载统计失败: ' + error.message, 'error');
  }
}

function getRuleTypeLabel(type) {
  const labels = { must: '必须', must_not: '禁止', should: '建议', should_not: '不建议' };
  return labels[type] || type;
}

// 获取记录标题（优先使用后端返回的title字段）
function getRecordTitle(record) {
  // 后端已处理标题提取，优先使用
  if (record.title && record.title !== '(无标题)') {
    return record.title;
  }
  // 兼容：如果前端有完整数据，尝试本地提取
  if (record.input_chain?.extracted_context) {
    return record.input_chain.extracted_context;
  }
  // 旧版兼容: scenario 或 trigger_condition
  return record.extracted_context || record.scenario || record.trigger_condition || '(无标题)';
}

// 获取标签列表
function getRecordTags(record) {
  // 三链新版: metadata.tags (数组)
  if (record.metadata?.tags && Array.isArray(record.metadata.tags)) {
    return record.metadata.tags;
  }
  // 旧版: tags (数组)
  if (record.tags && Array.isArray(record.tags)) {
    return record.tags;
  }
  // 字符串格式
  const tagsStr = record.metadata?.tags || record.tags || '';
  if (typeof tagsStr === 'string' && tagsStr) {
    return tagsStr.split(',').map(t => t.trim()).filter(t => t);
  }
  return [];
}

// 修正对列表
async function loadCorrections() {
  try {
    // 显示骨架屏
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.show(
        elements.correctionsList, 'card', 5
      );
    }

    const result = await apiService.listRecords({
      limit: state.corrections.limit,
      offset: state.corrections.page * state.corrections.limit,
      filter_type: 'correction_pair',
    });

    state.corrections.total = result.total;
    state.corrections.records = result.records || [];

    // 隐藏骨架屏并渲染
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.hide(elements.correctionsList);
    }
    renderCorrectionsList(result.records || []);
    updatePagination('correction');
  } catch (error) {
    // 确保骨架屏被隐藏
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.hide(elements.correctionsList);
    }
    elements.correctionsList.innerHTML = `<p class="empty-state error">加载失败: ${escapeHtml(error.message)}</p>`;
    showToast('加载修正对失败: ' + error.message, 'error');
  }
}

function renderCorrectionsList(records) {
  if (!records || records.length === 0) {
    elements.correctionsList.innerHTML = '<p class="empty-state">暂无修正对记录</p>';
    return;
  }

  elements.correctionsList.innerHTML = records.map(record => {
    const title = getRecordTitle(record);
    const tags = getRecordTags(record);
    const priority = record.priority || record.metadata?.priority || 'P1';
    const qualityScore = record.quality_score || record.metadata?.quality_score;

    return `
      <article class="record-card" data-id="${record.id}" tabindex="0" role="listitem">
        <div class="record-header">
          <span class="record-type correction">📋 修正对</span>
          <span class="priority-badge ${priority}">${priority}</span>
          ${qualityScore ? `<span class="quality-score">评分: ${qualityScore}</span>` : ''}
        </div>
        <p class="record-title">${escapeHtml(title)}</p>
        <p class="record-preview">${escapeHtml(record.preview || '')}</p>
        <div class="record-meta">
          ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      </article>
    `;
  }).join('');

  // 绑定点击事件
  elements.correctionsList.querySelectorAll('.record-card').forEach(card => {
    card.addEventListener('click', () => openDrawer(card.dataset.id));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') openDrawer(card.dataset.id); });
  });
}

// 行为规则列表
async function loadRules() {
  try {
    // 显示骨架屏
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.show(
        elements.rulesList, 'card', 5
      );
    }

    const result = await apiService.listRecords({
      limit: state.rules.limit,
      offset: state.rules.page * state.rules.limit,
      filter_type: 'behavior_rule',
    });

    state.rules.total = result.total;
    state.rules.records = result.records || [];

    // 隐藏骨架屏并渲染
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.hide(elements.rulesList);
    }
    renderRulesList(result.records || []);
    updatePagination('rule');
  } catch (error) {
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.hide(elements.rulesList);
    }
    elements.rulesList.innerHTML = `<p class="empty-state error">加载失败: ${escapeHtml(error.message)}</p>`;
    showToast('加载行为规则失败: ' + error.message, 'error');
  }
}

function renderRulesList(records) {
  if (!records || records.length === 0) {
    elements.rulesList.innerHTML = '<p class="empty-state">暂无行为规则</p>';
    return;
  }

  elements.rulesList.innerHTML = records.map(record => {
    const title = getRecordTitle(record);
    const tags = getRecordTags(record);
    const ruleType = record.rule_type || record.metadata?.rule_type || 'must';
    const priority = record.priority || record.metadata?.priority || 'P1';

    return `
      <article class="record-card" data-id="${record.id}" tabindex="0" role="listitem">
        <div class="record-header">
          <span class="record-type rule">📜 ${getRuleTypeLabel(ruleType)}</span>
          <span class="priority-badge ${priority}">${priority}</span>
        </div>
        <p class="record-title">${escapeHtml(title)}</p>
        <p class="record-preview">${escapeHtml(record.preview || '')}</p>
        <div class="record-meta">
          ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      </article>
    `;
  }).join('');

  elements.rulesList.querySelectorAll('.record-card').forEach(card => {
    card.addEventListener('click', () => openDrawer(card.dataset.id));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') openDrawer(card.dataset.id); });
  });
}

// 分页
function updatePagination(type) {
  if (type === 'correction') {
    const totalPages = Math.ceil(state.corrections.total / state.corrections.limit) || 1;
    const currentPage = state.corrections.page + 1;
    elements.correctionPageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;
    elements.correctionPrev.disabled = state.corrections.page === 0;
    elements.correctionNext.disabled = currentPage >= totalPages;
  } else {
    const totalPages = Math.ceil(state.rules.total / state.rules.limit) || 1;
    const currentPage = state.rules.page + 1;
    elements.rulePageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;
    elements.rulePrev.disabled = state.rules.page === 0;
    elements.ruleNext.disabled = currentPage >= totalPages;
  }
}

// 抽屉 - 三链版详情 (优化显示)
async function openDrawer(recordId) {
  try {
    const record = await apiService.getRecord(recordId);
    state.currentRecord = record;
    state.deleteTarget = recordId;

    const isCorrection = record.type === 'correction_pair';
    elements.drawerTitle.textContent = isCorrection ? '修正对详情' : '行为规则详情';

    // 辅助函数：安全获取值
    const getVal = (obj, key, fallback = '') => obj?.[key] || fallback;
    
    // 辅助函数：渲染思维链
    const renderCoT = (cotData) => {
      if (!cotData) return '<p class="empty-field">无思维链数据</p>';
      try {
        const steps = typeof cotData === 'string' ? JSON.parse(cotData) : cotData;
        if (!Array.isArray(steps) || steps.length === 0) return '<p class="empty-field">无思维链数据</p>';
        return `<div class="chain-of-thought">
          ${steps.map((step, idx) => `
            <div class="cot-step">
              <span class="cot-step-number">${idx + 1}</span>
              <span class="cot-step-content">${escapeHtml(step)}</span>
            </div>
          `).join('')}
        </div>`;
      } catch (e) {
        return `<div class="field-content">${escapeHtml(String(cotData))}</div>`;
      }
    };

    if (isCorrection) {
      // 三链修正对详情 - 优化版
      const ic = record.input_chain || {};
      const oc = record.output_chain || {};
      const lc = record.logic_chain || {};
      const meta = record.metadata || {};
      const tags = Array.isArray(meta.tags) ? meta.tags : (Array.isArray(record.tags) ? record.tags : []);

      elements.drawerBody.innerHTML = `
        <!-- 输入链 -->
        <div class="chain-section">
          <div class="chain-section-header input-chain">
            <span class="chain-section-icon">🔗</span>
            <span class="chain-section-title">输入链</span>
          </div>
          <div class="chain-section-body">
            <div class="field-group">
              <div class="field-label">
                <span class="field-label-icon">📝</span> 原始输入
              </div>
              <div class="field-content">${escapeHtml(getVal(ic, 'raw_input', record.raw_input) || '无')}</div>
            </div>
            <div class="field-group">
              <div class="field-label">
                <span class="field-label-icon">🎯</span> 场景上下文
              </div>
              <div class="field-content">${escapeHtml(getVal(ic, 'extracted_context', record.extracted_context) || '无')}</div>
            </div>
          </div>
        </div>

        <!-- 输出链 -->
        <div class="chain-section">
          <div class="chain-section-header output-chain">
            <span class="chain-section-icon">📤</span>
            <span class="chain-section-title">输出链</span>
          </div>
          <div class="chain-section-body">
            <div class="comparison-view">
              <div class="comparison-item wrong">
                <div class="comparison-label wrong">❌ 错误输出</div>
                <div class="comparison-content">${escapeHtml(getVal(oc, 'wrong_output', record.wrong_output) || '无')}</div>
              </div>
              <div class="comparison-item correct">
                <div class="comparison-label correct">✅ 正确输出</div>
                <div class="comparison-content">${escapeHtml(getVal(oc, 'correct_output', record.correct_output) || '无')}</div>
              </div>
            </div>
            ${oc.quality_score ? `
            <div class="field-group" style="margin-top: var(--space-md);">
              <div class="field-label">📊 质量评分</div>
              <div class="field-content">
                <span class="quality-score ${oc.quality_score >= 80 ? 'high' : oc.quality_score >= 50 ? 'medium' : 'low'}">${oc.quality_score}/100</span>
              </div>
            </div>` : ''}
          </div>
        </div>

        <!-- 逻辑链 -->
        <div class="chain-section">
          <div class="chain-section-header logic-chain">
            <span class="chain-section-icon">🧠</span>
            <span class="chain-section-title">逻辑链</span>
          </div>
          <div class="chain-section-body">
            <div class="field-group">
              <div class="field-label">❌ 错误原因</div>
              <div class="field-content wrong-output">${escapeHtml(getVal(lc, 'wrong_reason', record.wrong_reason) || record.reason || '无')}</div>
            </div>
            ${lc.correct_reason ? `
            <div class="field-group">
              <div class="field-label">✅ 正确原因</div>
              <div class="field-content correct-output">${escapeHtml(lc.correct_reason)}</div>
            </div>` : ''}
            ${lc.wrong_cot || record.chain_of_thought ? `
            <div class="field-group">
              <div class="field-label">🔄 错误思维链</div>
              ${renderCoT(lc.wrong_cot || record.chain_of_thought)}
            </div>` : ''}
            ${lc.correct_cot || record.correct_chain_of_thought ? `
            <div class="field-group">
              <div class="field-label">💡 正确思维链</div>
              ${renderCoT(lc.correct_cot || record.correct_chain_of_thought)}
            </div>` : ''}
          </div>
        </div>

        <!-- 元数据 -->
        <div class="chain-section">
          <div class="chain-section-header">
            <span class="chain-section-icon">📋</span>
            <span class="chain-section-title">元数据</span>
          </div>
          <div class="chain-section-body">
            <div class="metadata-section">
              <div class="metadata-row">
                <div class="metadata-item-inline">
                  <span class="metadata-label">优先级:</span>
                  <span class="priority-badge ${meta.priority || 'P1'}">${meta.priority || 'P1'}</span>
                </div>
                <div class="metadata-item-inline">
                  <span class="metadata-label">审核状态:</span>
                  <span class="review-status ${meta.review_status || 'pending'}">${getReviewStatusLabel(meta.review_status)}</span>
                </div>
              </div>
              ${meta.reviewer_notes ? `
              <div class="metadata-row">
                <div class="field-group" style="flex: 1; margin-bottom: 0;">
                  <div class="field-label">审核备注</div>
                  <div class="field-content">${escapeHtml(meta.reviewer_notes)}</div>
                </div>
              </div>` : ''}
            </div>
          </div>
        </div>

        <!-- 标签 -->
        ${tags.length ? `
        <div class="chain-section">
          <div class="chain-section-header">
            <span class="chain-section-icon">🏷️</span>
            <span class="chain-section-title">标签</span>
          </div>
          <div class="chain-section-body">
            <div class="tags-section">
              ${tags.map(t => `<span class="tag-item">${escapeHtml(t)}</span>`).join('')}
            </div>
          </div>
        </div>` : ''}

        <!-- 时间信息 -->
        <div class="chain-section">
          <div class="chain-section-header">
            <span class="chain-section-icon">⏰</span>
            <span class="chain-section-title">时间信息</span>
          </div>
          <div class="chain-section-body">
            <div class="timeline">
              <div class="timeline-item">
                <div class="timeline-label">创建时间</div>
                <div class="timeline-value">${formatDate(record.created_at)}</div>
              </div>
              ${meta.reviewed_at ? `
              <div class="timeline-item">
                <div class="timeline-label">审核时间</div>
                <div class="timeline-value">${formatDate(meta.reviewed_at)}</div>
              </div>` : ''}
              ${meta.reviewed_by ? `
              <div class="timeline-item">
                <div class="timeline-label">审核人</div>
                <div class="timeline-value">${escapeHtml(meta.reviewed_by)}</div>
              </div>` : ''}
            </div>
          </div>
        </div>

        <!-- 记录 ID -->
        <div class="chain-section">
          <div class="chain-section-header">
            <span class="chain-section-icon">🔑</span>
            <span class="chain-section-title">记录 ID</span>
          </div>
          <div class="chain-section-body">
            <div class="record-id">
              <code>${record.id}</code>
            </div>
          </div>
        </div>
      `;
    } else {
      // 行为规则详情 - 优化版
      const ic = record.input_chain || {};
      const oc = record.output_chain || {};
      const lc = record.logic_chain || {};
      const meta = record.metadata || {};
      const tags = Array.isArray(meta.tags) ? meta.tags : (Array.isArray(record.tags) ? record.tags : []);

      elements.drawerBody.innerHTML = `
        <!-- 输入链 -->
        <div class="chain-section">
          <div class="chain-section-header input-chain">
            <span class="chain-section-icon">🔗</span>
            <span class="chain-section-title">输入链</span>
          </div>
          <div class="chain-section-body">
            <div class="field-group">
              <div class="field-label">
                <span class="field-label-icon">⚡</span> 触发条件
              </div>
              <div class="field-content">${escapeHtml(getVal(ic, 'trigger_condition', record.trigger_condition) || '无')}</div>
            </div>
            ${ic.scenario_description || record.scenario_description ? `
            <div class="field-group">
              <div class="field-label">
                <span class="field-label-icon">📝</span> 场景描述
              </div>
              <div class="field-content">${escapeHtml(getVal(ic, 'scenario_description', record.scenario_description))}</div>
            </div>` : ''}
          </div>
        </div>

        <!-- 输出链 -->
        <div class="chain-section">
          <div class="chain-section-header output-chain">
            <span class="chain-section-icon">📤</span>
            <span class="chain-section-title">输出链</span>
          </div>
          <div class="chain-section-body">
            <div class="field-group">
              <div class="field-label">规则类型</div>
              <div class="field-content">
                <span class="rule-type-badge ${oc.rule_type || record.rule_type}">${getRuleTypeLabel(oc.rule_type || record.rule_type)}</span>
              </div>
            </div>
            <div class="field-group">
              <div class="field-label">规则内容</div>
              <div class="field-content">${escapeHtml(getVal(oc, 'rule_content', record.rule_content) || '无')}</div>
            </div>
          </div>
        </div>

        <!-- 逻辑链 -->
        <div class="chain-section">
          <div class="chain-section-header logic-chain">
            <span class="chain-section-icon">🧠</span>
            <span class="chain-section-title">逻辑链</span>
          </div>
          <div class="chain-section-body">
            ${lc.reason || record.reason ? `
            <div class="field-group">
              <div class="field-label">规则原因</div>
              <div class="field-content reasoning">${escapeHtml(getVal(lc, 'reason', record.reason))}</div>
            </div>` : ''}
            ${lc.examples || record.examples ? `
            <div class="field-group">
              <div class="field-label">示例</div>
              <div class="field-content">${escapeHtml(getVal(lc, 'examples', record.examples))}</div>
            </div>` : ''}
          </div>
        </div>

        <!-- 元数据 -->
        <div class="chain-section">
          <div class="chain-section-header">
            <span class="chain-section-icon">📋</span>
            <span class="chain-section-title">元数据</span>
          </div>
          <div class="chain-section-body">
            <div class="metadata-section">
              <div class="metadata-row">
                <div class="metadata-item-inline">
                  <span class="metadata-label">优先级:</span>
                  <span class="priority-badge ${meta.priority || 'P1'}">${meta.priority || 'P1'}</span>
                </div>
                <div class="metadata-item-inline">
                  <span class="metadata-label">审核状态:</span>
                  <span class="review-status ${meta.review_status || 'pending'}">${getReviewStatusLabel(meta.review_status)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 标签 -->
        ${tags.length ? `
        <div class="chain-section">
          <div class="chain-section-header">
            <span class="chain-section-icon">🏷️</span>
            <span class="chain-section-title">标签</span>
          </div>
          <div class="chain-section-body">
            <div class="tags-section">
              ${tags.map(t => `<span class="tag-item">${escapeHtml(t)}</span>`).join('')}
            </div>
          </div>
        </div>` : ''}

        <!-- 时间信息 -->
        <div class="chain-section">
          <div class="chain-section-header">
            <span class="chain-section-icon">⏰</span>
            <span class="chain-section-title">时间信息</span>
          </div>
          <div class="chain-section-body">
            <div class="timeline">
              <div class="timeline-item">
                <div class="timeline-label">创建时间</div>
                <div class="timeline-value">${formatDate(record.created_at)}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 记录 ID -->
        <div class="chain-section">
          <div class="chain-section-header">
            <span class="chain-section-icon">🔑</span>
            <span class="chain-section-title">记录 ID</span>
          </div>
          <div class="chain-section-body">
            <div class="record-id">
              <code>${record.id}</code>
            </div>
          </div>
        </div>
      `;
    }

    elements.drawer.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  } catch (error) {
    showToast('加载记录详情失败: ' + error.message, 'error');
  }
}

function getReviewStatusLabel(status) {
  const labels = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };
  return labels[status] || status || '未知';
}

function closeDrawer() {
  elements.drawer.classList.add('hidden');
  document.body.style.overflow = '';
  state.currentRecord = null;

  // 恢复编辑和删除按钮显示
  const editBtn = document.getElementById('drawer-edit');
  const deleteBtn = document.getElementById('drawer-delete');
  if (editBtn) editBtn.style.display = '';
  if (deleteBtn) deleteBtn.style.display = '';
}

// 模态框 - 三链版表单
function openModal(type, mode = 'add', record = null) {
  const isEdit = mode === 'edit';
  elements.modalTitle.textContent = isEdit 
    ? (type === 'correction' ? '编辑修正对 (三链)' : '编辑行为规则 (三链)')
    : (type === 'correction' ? '添加修正对 (三链)' : '添加行为规则 (三链)');

  // 获取编辑时的默认值
  const getValue = (field, defaultVal = '') => {
    if (!isEdit || !record) return defaultVal;
    // 支持三链结构和老数据结构
    if (field.startsWith('input_chain.')) {
      const key = field.replace('input_chain.', '');
      return record.input_chain?.[key] || record[key] || defaultVal;
    }
    if (field.startsWith('output_chain.')) {
      const key = field.replace('output_chain.', '');
      return record.output_chain?.[key] || record[key] || defaultVal;
    }
    if (field.startsWith('logic_chain.')) {
      const key = field.replace('logic_chain.', '');
      return record.logic_chain?.[key] || record[key] || defaultVal;
    }
    return record[field] || defaultVal;
  };

  const getTags = () => {
    if (!isEdit || !record) return '';
    const tags = record.metadata?.tags || record.tags || [];
    return Array.isArray(tags) ? tags.join(', ') : tags;
  };

  const getPriority = () => {
    if (!isEdit || !record) return 'P1';
    return record.priority || record.metadata?.priority || 'P1';
  };

  if (type === 'correction') {
    elements.modalBody.innerHTML = `
      <form id="correction-form" class="triple-chain-form">
        <div class="form-section">
          <h4>🔗 输入链</h4>
          <div class="form-group">
            <label for="raw_input">原始输入 *</label>
            <textarea id="raw_input" name="raw_input" required placeholder="原始用户输入/问题…" rows="2">${escapeHtml(getValue('input_chain.raw_input') || getValue('scenario', ''))}</textarea>
          </div>
          <div class="form-group">
            <label for="extracted_context">场景上下文 *</label>
            <textarea id="extracted_context" name="extracted_context" required placeholder="提取的场景上下文（精炼描述）…" rows="2">${escapeHtml(getValue('input_chain.extracted_context') || getValue('scenario', ''))}</textarea>
          </div>
        </div>
        <div class="form-section">
          <h4>📤 输出链</h4>
          <div class="form-group">
            <label for="wrong_output">错误输出 *</label>
            <textarea id="wrong_output" name="wrong_output" required placeholder="模型的错误输出…" rows="2">${escapeHtml(getValue('output_chain.wrong_output') || getValue('wrong_output', ''))}</textarea>
          </div>
          <div class="form-group">
            <label for="correct_output">正确输出 *</label>
            <textarea id="correct_output" name="correct_output" required placeholder="期望的正确输出…" rows="2">${escapeHtml(getValue('output_chain.correct_output') || getValue('correct_output', ''))}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="quality_score">质量评分</label>
              <input type="number" id="quality_score" name="quality_score" min="0" max="100" value="${getValue('output_chain.quality_score', 50)}" placeholder="0-100">
            </div>
            <div class="form-group">
              <label for="priority">优先级</label>
              <select id="priority" name="priority">
                <option value="P0" ${getPriority() === 'P0' ? 'selected' : ''}>P0 - 关键</option>
                <option value="P1" ${getPriority() === 'P1' ? 'selected' : ''}>P1 - 重要</option>
                <option value="P2" ${getPriority() === 'P2' ? 'selected' : ''}>P2 - 次要</option>
              </select>
            </div>
          </div>
        </div>
        <div class="form-section">
          <h4>🧠 逻辑链</h4>
          <div class="form-group">
            <label for="wrong_reason">错误原因 *</label>
            <textarea id="wrong_reason" name="wrong_reason" required placeholder="为什么这是错误的…" rows="2">${escapeHtml(getValue('logic_chain.wrong_reason') || getValue('reason', ''))}</textarea>
          </div>
          <div class="form-group">
            <label for="correct_reason">正确原因</label>
            <textarea id="correct_reason" name="correct_reason" placeholder="为什么正确输出更好…" rows="2">${escapeHtml(getValue('logic_chain.correct_reason') || '')}</textarea>
          </div>
          <div class="form-group">
            <label for="wrong_cot">错误思维链 (JSON数组)</label>
            <textarea id="wrong_cot" name="wrong_cot" placeholder='["步骤1: …", "步骤2: …"]' rows="2">${escapeHtml(getValue('logic_chain.wrong_cot') || getValue('chain_of_thought', ''))}</textarea>
          </div>
          <div class="form-group">
            <label for="correct_cot">正确思维链 (JSON数组)</label>
            <textarea id="correct_cot" name="correct_cot" placeholder='["步骤1: …", "步骤2: …"]' rows="2">${escapeHtml(getValue('logic_chain.correct_cot') || getValue('correct_chain_of_thought', ''))}</textarea>
          </div>
        </div>
        <div class="form-section">
          <h4>🏷️ 标签</h4>
          <div class="form-group">
            <label for="tags">标签 (逗号分隔)</label>
            <input type="text" id="tags" name="tags" value="${escapeHtml(getTags())}" placeholder="医学, 基础知识">
          </div>
        </div>
      </form>
    `;
  } else {
    elements.modalBody.innerHTML = `
      <form id="rule-form" class="triple-chain-form">
        <div class="form-section">
          <h4>🔗 输入链</h4>
          <div class="form-group">
            <label for="trigger_condition">触发条件 *</label>
            <textarea id="trigger_condition" name="trigger_condition" required placeholder="什么情况下应用此规则…" rows="2">${escapeHtml(getValue('input_chain.trigger_condition') || getValue('trigger_condition', ''))}</textarea>
          </div>
          <div class="form-group">
            <label for="scenario_description">场景描述</label>
            <textarea id="scenario_description" name="scenario_description" placeholder="场景描述（如不填则使用触发条件）…" rows="2">${escapeHtml(getValue('input_chain.scenario_description') || '')}</textarea>
          </div>
        </div>
        <div class="form-section">
          <h4>📤 输出链</h4>
          <div class="form-group">
            <label for="rule_content">规则内容 *</label>
            <textarea id="rule_content" name="rule_content" required placeholder="应该做什么或不应该做什么…" rows="3">${escapeHtml(getValue('output_chain.rule_content') || getValue('rule_content', ''))}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="rule_type">规则类型</label>
              <select id="rule_type" name="rule_type">
                <option value="must" ${getValue('output_chain.rule_type', 'must') === 'must' ? 'selected' : ''}>必须 (must)</option>
                <option value="must_not" ${getValue('output_chain.rule_type', '') === 'must_not' ? 'selected' : ''}>禁止 (must_not)</option>
                <option value="should" ${getValue('output_chain.rule_type', '') === 'should' ? 'selected' : ''}>建议 (should)</option>
                <option value="should_not" ${getValue('output_chain.rule_type', '') === 'should_not' ? 'selected' : ''}>不建议 (should_not)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="rule_priority">优先级</label>
              <select id="rule_priority" name="rule_priority">
                <option value="P0" ${getPriority() === 'P0' ? 'selected' : ''}>P0 - 关键</option>
                <option value="P1" ${getPriority() === 'P1' ? 'selected' : ''}>P1 - 重要</option>
                <option value="P2" ${getPriority() === 'P2' ? 'selected' : ''}>P2 - 次要</option>
              </select>
            </div>
          </div>
        </div>
        <div class="form-section">
          <h4>🧠 逻辑链</h4>
          <div class="form-group">
            <label for="rule_reason">规则原因</label>
            <textarea id="rule_reason" name="rule_reason" placeholder="为什么需要这条规则…" rows="2">${escapeHtml(getValue('logic_chain.rule_reason') || getValue('rule_reason', ''))}</textarea>
          </div>
          <div class="form-group">
            <label for="examples">示例</label>
            <textarea id="examples" name="examples" placeholder="规则应用示例…" rows="2">${escapeHtml(getValue('logic_chain.examples') || getValue('examples', ''))}</textarea>
          </div>
        </div>
        <div class="form-section">
          <h4>🏷️ 标签</h4>
          <div class="form-group">
            <label for="rule_tags">标签 (逗号分隔)</label>
            <input type="text" id="rule_tags" name="rule_tags" value="${escapeHtml(getTags())}" placeholder="医疗安全, 行为规范">
          </div>
        </div>
      </form>
    `;
  }

  elements.modalSubmit.textContent = isEdit ? '保存' : '添加';
  elements.modalSubmit.dataset.type = type;
  elements.modalSubmit.dataset.mode = mode;
  elements.modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// 打开编辑模态框
function openEditModal() {
  if (!state.currentRecord) return;
  const type = state.currentRecord.type === 'behavior_rule' ? 'rule' : 'correction';
  openModal(type, 'edit', state.currentRecord);
}

function closeModal() {
  elements.modal.classList.add('hidden');
  document.body.style.overflow = '';
  elements.modalSubmit.textContent = '添加';
}

function showConfirmDelete() {
  const confirmBody = elements.confirmModal.querySelector('.modal-body p');
  const recordName = getRecordTitle(state.currentRecord) || '此记录';
  const truncated = recordName.length > 50 ? recordName.slice(0, 50) + '…' : recordName;
  if (confirmBody) {
    confirmBody.textContent = `确定要删除「${truncated}」吗？此操作不可撤销。`;
  }
  elements.confirmModal.classList.remove('hidden');
}

function closeConfirmDelete() {
  elements.confirmModal.classList.add('hidden');
}

// 搜索
async function performSearch(e) {
  e.preventDefault();
  const query = document.getElementById('rag-query').value;
  const top_k = parseInt(document.getElementById('rag-topk').value);
  const filter_type = document.getElementById('rag-filter').value || undefined;

  if (!query.trim()) {
    showToast('请输入搜索关键词', 'error');
    return;
  }

  try {
    elements.searchResults.innerHTML = '<p class="empty-state">搜索中…</p>';
    const result = await apiService.search({ query, top_k, filter_type });

    if (!result.results || result.results.length === 0) {
      elements.searchResults.innerHTML = '<p class="empty-state">未找到相关记录</p>';
      return;
    }

    elements.searchResults.innerHTML = result.results.map(r => `
      <article class="search-result">
        <div class="search-result-header">
          <span class="record-type ${r.type === 'correction_pair' ? 'correction' : 'rule'}">${r.type === 'correction_pair' ? '📋 修正对' : '📜 规则'}</span>
          <span class="similarity-badge">相似度 ${((r.similarity || 0) * 100).toFixed(0)}%</span>
          ${r.metadata?.priority ? `<span class="priority-badge ${r.metadata.priority}">${r.metadata.priority}</span>` : ''}
        </div>
        <div class="detail-content">${escapeHtml(r.content || '')}</div>
      </article>
    `).join('');
  } catch (error) {
    elements.searchResults.innerHTML = `<p class="empty-state error">搜索失败: ${escapeHtml(error.message)}</p>`;
    showToast('搜索失败: ' + error.message, 'error');
  }
}

// Toast 通知
function showToast(message, type = 'success') {
  if (window.EnhancedInteractions && window.EnhancedInteractions.showToast) {
    window.EnhancedInteractions.showToast(message, type);
  } else {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
}

// 工具函数
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatChainOfThought(jsonStr) {
  if (!jsonStr) return '';
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.map((step, idx) => `${idx + 1}. ${step}`).join('\n');
    }
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    return jsonStr;
  }
}

function formatDate(isoString) {
  if (!isoString) return '-';
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

function filterLocalList(type, query) {
  const listEl = type === 'corrections' ? elements.correctionsList : elements.rulesList;
  const records = type === 'corrections' ? state.corrections.records : state.rules.records;
  const q = query.toLowerCase().trim();

  if (!q) {
    listEl.querySelectorAll('.record-card').forEach(card => {
      card.style.display = '';
    });
    return;
  }

  listEl.querySelectorAll('.record-card').forEach((card, idx) => {
    const record = records[idx];
    if (!record) return;

    const title = getRecordTitle(record);
    const searchable = [
      title,
      (record.metadata?.tags || record.tags || []).join(' '),
      record.preview || '',
    ].join(' ').toLowerCase();

    card.style.display = searchable.includes(q) ? '' : 'none';
  });
}

// 事件绑定
function bindEvents() {
  // 导航
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });

  // 添加按钮
  elements.btnAddNew.addEventListener('click', () => {
    openModal('correction');
  });
  elements.btnAddCorrection?.addEventListener('click', () => openModal('correction'));
  elements.btnAddRule?.addEventListener('click', () => openModal('rule'));

  // 分页
  elements.correctionPrev?.addEventListener('click', () => {
    if (state.corrections.page > 0) {
      state.corrections.page--;
      loadCorrections();
    }
  });
  elements.correctionNext?.addEventListener('click', () => {
    state.corrections.page++;
    loadCorrections();
  });
  elements.rulePrev?.addEventListener('click', () => {
    if (state.rules.page > 0) {
      state.rules.page--;
      loadRules();
    }
  });
  elements.ruleNext?.addEventListener('click', () => {
    state.rules.page++;
    loadRules();
  });

  // 抽屉关闭
  elements.drawerClose?.addEventListener('click', closeDrawer);
  elements.drawerCloseBtn?.addEventListener('click', closeDrawer);
  elements.drawer.querySelector('.drawer-backdrop')?.addEventListener('click', closeDrawer);

  // 删除
  elements.drawerDelete?.addEventListener('click', showConfirmDelete);
  elements.drawerEdit?.addEventListener('click', () => {
    elements.drawer.classList.add('hidden');
    document.body.style.overflow = '';
    openEditModal();
  });
  elements.confirmCancel?.addEventListener('click', closeConfirmDelete);
  elements.confirmDelete?.addEventListener('click', async () => {
    try {
      await apiService.deleteRecord(state.deleteTarget);
      closeConfirmDelete();
      closeDrawer();
      showToast('删除成功');
      if (state.currentView === 'corrections') loadCorrections();
      else if (state.currentView === 'rules') loadRules();
      loadDashboard();
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    }
  });

  // 模态框
  elements.modalClose?.addEventListener('click', closeModal);
  elements.modalCancel?.addEventListener('click', closeModal);
  elements.modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);

  // 表单验证函数
  function validateForm(type) {
    const errors = [];
    
    if (type === 'correction') {
      const rawInput = document.getElementById('raw_input')?.value?.trim() || document.getElementById('scenario')?.value?.trim();
      const wrongOutput = document.getElementById('wrong_output')?.value?.trim();
      const correctOutput = document.getElementById('correct_output')?.value?.trim();
      
      if (!rawInput) {
        errors.push({ field: 'raw_input', message: '请输入场景描述' });
      }
      if (!wrongOutput) {
        errors.push({ field: 'wrong_output', message: '请输入错误输出' });
      }
      if (!correctOutput) {
        errors.push({ field: 'correct_output', message: '请输入正确输出' });
      }
      
      // 长度检查
      if (rawInput && rawInput.length > 2000) {
        errors.push({ field: 'raw_input', message: '场景描述不能超过2000字符' });
      }
    } else if (type === 'rule') {
      const triggerCondition = document.getElementById('trigger_condition')?.value?.trim();
      const ruleContent = document.getElementById('rule_content')?.value?.trim();
      
      if (!triggerCondition) {
        errors.push({ field: 'trigger_condition', message: '请输入触发条件' });
      }
      if (!ruleContent) {
        errors.push({ field: 'rule_content', message: '请输入规则内容' });
      }
    }
    
    return errors;
  }

  // 显示字段错误
  function showFieldErrors(errors) {
    // 清除之前的错误
    document.querySelectorAll('.field-error').forEach(el => el.remove());
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    
    errors.forEach(error => {
      const field = document.getElementById(error.field);
      if (field) {
        field.classList.add('input-error');
        const errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        errorEl.textContent = error.message;
        field.parentNode.appendChild(errorEl);
      }
    });
  }

  // 提交锁状态
  let isSubmitting = false;

  // 模态框提交 - 三链版（带防抖和验证）
  const handleSubmit = debounce(async () => {
    if (isSubmitting) return;
    
    const type = elements.modalSubmit.dataset.type;
    const mode = elements.modalSubmit.dataset.mode || 'add';

    // 表单验证
    const errors = validateForm(type);
    if (errors.length > 0) {
      showFieldErrors(errors);
      showToast('请检查表单填写', 'error');
      return;
    }

    // 设置提交状态
    isSubmitting = true;
    elements.modalSubmit.disabled = true;
    elements.modalSubmit.classList.add('btn-submitting');
    const originalText = elements.modalSubmit.textContent;
    elements.modalSubmit.textContent = '提交中...';

    try {
      if (type === 'correction') {
        // 三链修正对
        const tagsValue = document.getElementById('tags')?.value || '';
        const tags = tagsValue ? tagsValue.split(',').map(t => t.trim()).filter(t => t) : [];

        const payload = {
          // 输入链
          raw_input: document.getElementById('raw_input')?.value || document.getElementById('scenario')?.value || '',
          extracted_context: document.getElementById('extracted_context')?.value || document.getElementById('scenario')?.value || '',
          // 输出链
          wrong_output: document.getElementById('wrong_output')?.value || '',
          correct_output: document.getElementById('correct_output')?.value || '',
          quality_score: parseInt(document.getElementById('quality_score')?.value) || 50,
          // 逻辑链
          wrong_reason: document.getElementById('wrong_reason')?.value || '',
          correct_reason: document.getElementById('correct_reason')?.value || undefined,
          wrong_cot: document.getElementById('wrong_cot')?.value || undefined,
          correct_cot: document.getElementById('correct_cot')?.value || undefined,
          // 元数据
          priority: document.getElementById('priority')?.value || 'P1',
          tags,
        };

        // 移除 undefined 值
        Object.keys(payload).forEach(key => {
          if (payload[key] === undefined) delete payload[key];
        });

        await apiService.addCorrection(payload);
      } else {
        // 行为规则
        const tagsValue = document.getElementById('rule_tags')?.value || '';
        const tags = tagsValue ? tagsValue.split(',').map(t => t.trim()).filter(t => t) : [];

        const payload = {
          // 输入链
          trigger_condition: document.getElementById('trigger_condition')?.value || '',
          scenario_description: document.getElementById('scenario_description')?.value || '',
          // 输出链
          rule_content: document.getElementById('rule_content')?.value || '',
          rule_type: document.getElementById('rule_type')?.value || 'must',
          // 逻辑链
          reason: document.getElementById('rule_reason')?.value || undefined,
          examples: document.getElementById('examples')?.value || undefined,
          // 元数据
          priority: document.getElementById('rule_priority')?.value || 'P1',
          tags,
        };

        Object.keys(payload).forEach(key => {
          if (payload[key] === undefined) delete payload[key];
        });

        await apiService.addRule(payload);
      }

      closeModal();
      closeDrawer();
      showToast(mode === 'edit' ? '修改成功' : '添加成功');

      // 刷新列表
      if (type === 'correction') loadCorrections();
      else loadRules();
      loadDashboard();

    } catch (error) {
      // 错误已在 api() 函数中处理
    } finally {
      isSubmitting = false;
      elements.modalSubmit.disabled = false;
      elements.modalSubmit.classList.remove('btn-submitting');
      elements.modalSubmit.textContent = originalText;
    }
  }, 300);

  elements.modalSubmit?.addEventListener('click', handleSubmit);

  // 搜索
  elements.ragSearchForm?.addEventListener('submit', performSearch);

  // 本地搜索
  const correctionSearchInput = document.getElementById('correction-search');
  const ruleSearchInput = document.getElementById('rule-search');

  correctionSearchInput?.addEventListener('input', (e) => {
    filterLocalList('corrections', e.target.value);
  });
  ruleSearchInput?.addEventListener('input', (e) => {
    filterLocalList('rules', e.target.value);
  });

  // ESC 关闭
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!elements.drawer.classList.contains('hidden')) closeDrawer();
      else if (!elements.modal.classList.contains('hidden')) closeModal();
      else if (!elements.confirmModal.classList.contains('hidden')) closeConfirmDelete();
    }
  });
}

// ============================================================
// 调用记录管理
// ============================================================

const callState = {
  page: 0,
  limit: 50,
  total: 0,
  calls: [],
  filterTool: '',
  filterStatus: '',
};

// 加载调用记录
async function loadCalls() {
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

// 加载调用统计
async function loadCallStats() {
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

// 渲染调用记录列表
function renderCalls() {
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

// 打开调用详情抽屉
function openCallDrawer(call) {
  const statusIcon = call.result_status === 'success' ? '✅' : '❌';
  const statusClass = call.result_status === 'success' ? 'success' : 'error';
  const time = new Date(call.timestamp).toLocaleString('zh-CN');

  // 格式化参数
  let paramsHtml = '<code>无参数</code>';
  if (call.parameters) {
    try {
      paramsHtml = `<pre class="code-block">${escapeHtml(JSON.stringify(call.parameters, null, 2))}</pre>`;
    } catch (e) {
      paramsHtml = `<code>${escapeHtml(JSON.stringify(call.parameters))}</code>`;
    }
  }

  // 格式化返回结果
  let resultHtml = '<code>无返回数据</code>';
  if (call.result_data) {
    try {
      resultHtml = `<pre class="code-block">${escapeHtml(JSON.stringify(call.result_data, null, 2))}</pre>`;
    } catch (e) {
      resultHtml = `<code>${escapeHtml(JSON.stringify(call.result_data))}</code>`;
    }
  }

  elements.drawerTitle.textContent = '调用详情';
  elements.drawerBody.innerHTML = `
    <div class="chain-section">
      <div class="chain-section-header">
        <span class="chain-section-icon">📞</span>
        <span class="chain-section-title">基本信息</span>
      </div>
      <div class="chain-section-body">
        <div class="field-group">
          <span class="field-label">工具名称</span>
          <span class="field-content">${escapeHtml(call.tool_name)}</span>
        </div>
        <div class="field-group">
          <span class="field-label">执行状态</span>
          <span class="priority-badge ${statusClass}">${statusIcon} ${call.result_status}</span>
        </div>
        <div class="field-group">
          <span class="field-label">调用时间</span>
          <span class="field-content">${time}</span>
        </div>
        ${call.duration_ms ? `
        <div class="field-group">
          <span class="field-label">执行耗时</span>
          <span class="field-content">${call.duration_ms} ms</span>
        </div>
        ` : ''}
        ${call.related_correction_id ? `
        <div class="field-group">
          <span class="field-label">关联修正对</span>
          <span class="record-id">${call.related_correction_id}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="chain-section">
      <div class="chain-section-header">
        <span class="chain-section-icon">📥</span>
        <span class="chain-section-title">调用参数</span>
      </div>
      <div class="chain-section-body">
        ${paramsHtml}
      </div>
    </div>

    ${call.result_data ? `
    <div class="chain-section">
      <div class="chain-section-header">
        <span class="chain-section-icon">📤</span>
        <span class="chain-section-title">返回结果</span>
      </div>
      <div class="chain-section-body">
        ${resultHtml}
      </div>
    </div>
    ` : ''}

    ${call.error_message ? `
    <div class="chain-section">
      <div class="chain-section-header" style="border-left-color: #ef4444;">
        <span class="chain-section-icon">⚠️</span>
        <span class="chain-section-title">错误信息</span>
      </div>
      <div class="chain-section-body">
        <div class="comparison-view">
          <div class="comparison-item wrong">
            <div class="comparison-label">错误详情</div>
            <div class="comparison-content">${escapeHtml(call.error_message)}</div>
          </div>
        </div>
      </div>
    </div>
    ` : ''}

    <div class="chain-section">
      <div class="chain-section-header">
        <span class="chain-section-icon">📋</span>
        <span class="chain-section-title">元数据</span>
      </div>
      <div class="chain-section-body">
        <div class="metadata-section">
          <div class="metadata-item">
            <span class="metadata-label">记录ID</span>
            <span class="record-id">${call.id}</span>
          </div>
          ${call.caller_info ? `
          <div class="metadata-item">
            <span class="metadata-label">调用者</span>
            <span class="metadata-value">${escapeHtml(call.caller_info)}</span>
          </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  // 隐藏编辑和删除按钮（调用记录不可编辑）
  const editBtn = document.getElementById('drawer-edit');
  const deleteBtn = document.getElementById('drawer-delete');
  if (editBtn) editBtn.style.display = 'none';
  if (deleteBtn) deleteBtn.style.display = 'none';

  elements.drawer.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// 更新调用记录分页
function updateCallPagination() {
  const prevBtn = document.getElementById('call-prev');
  const nextBtn = document.getElementById('call-next');
  const pageInfo = document.getElementById('call-page-info');

  const totalPages = Math.ceil(callState.total / callState.limit);
  const currentPage = callState.page + 1;

  if (prevBtn) prevBtn.disabled = callState.page === 0;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (pageInfo) pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页 (${callState.total} 条)`;
}

// 绑定调用记录事件
function bindCallEvents() {
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

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loader.init();  // 初始化加载指示器
  cacheElements();
  bindEvents();
  bindCallEvents();
  loadDashboard();
});

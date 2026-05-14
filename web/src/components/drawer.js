/**
 * 详情抽屉组件
 * 三链版详情展示，包含输入链/输出链/逻辑链/元数据/标签/时间信息渲染
 */

import { apiService } from '../api.js';
import { appStore } from '../store.js';
import { elements } from '../dom.js';
import { showToast } from '../toast.js';
import { escapeHtml, formatDate, getRuleTypeLabel, getReviewStatusLabel } from '../utils.js';

/**
 * 打开记录详情抽屉（三链版）
 * @param {string} recordId - 记录 ID
 */
export async function openDrawer(recordId) {
  try {
    const record = await apiService.getRecord(recordId);
    appStore.setState({
      currentRecord: record,
      deleteTarget: recordId,
    });

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

/**
 * 关闭抽屉
 */
export function closeDrawer() {
  elements.drawer.classList.add('hidden');
  document.body.style.overflow = '';
  appStore.setState({ currentRecord: null });

  // 恢复编辑和删除按钮显示
  const editBtn = document.getElementById('drawer-edit');
  const deleteBtn = document.getElementById('drawer-delete');
  if (editBtn) editBtn.style.display = '';
  if (deleteBtn) deleteBtn.style.display = '';
}

/**
 * 打开调用详情抽屉
 * @param {Object} call - 调用记录对象
 */
export function openCallDrawer(call) {
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

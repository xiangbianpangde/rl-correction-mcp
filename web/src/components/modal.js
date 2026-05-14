/**
 * 模态框组件
 * 三链版表单，包含完整的输入链/输出链/逻辑链/标签表单
 */

import { apiService } from '../api.js';
import { appStore } from '../store.js';
import { elements } from '../dom.js';
import { escapeHtml, debounce } from '../utils.js';
import { showToast } from '../toast.js';
import loader from '../loader.js';

/** 提交锁状态 */
let isSubmitting = false;

/**
 * 打开添加/编辑模态框（三链版表单）
 * @param {'correction'|'rule'} type - 记录类型
 * @param {'add'|'edit'} mode - 模式
 * @param {Object|null} record - 编辑时的记录对象
 */
export function openModal(type, mode = 'add', record = null) {
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

/**
 * 打开编辑模态框
 */
export function openEditModal() {
  const { currentRecord } = appStore.getState();
  if (!currentRecord) return;
  const type = currentRecord.type === 'behavior_rule' ? 'rule' : 'correction';
  openModal(type, 'edit', currentRecord);
}

/**
 * 关闭模态框
 */
export function closeModal() {
  elements.modal.classList.add('hidden');
  document.body.style.overflow = '';
  elements.modalSubmit.textContent = '添加';
}

/**
 * 表单验证
 * @param {'correction'|'rule'} type - 记录类型
 * @returns {Array<{field: string, message: string}>} 错误列表
 */
export function validateForm(type) {
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

/**
 * 显示字段错误
 * @param {Array<{field: string, message: string}>} errors - 错误列表
 */
export function showFieldErrors(errors) {
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

/**
 * 表单提交（带防抖和验证）
 * @type {Function}
 */
export const handleSubmit = debounce(async () => {
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

    // 刷新列表 - 通过事件通知
    window.dispatchEvent(new CustomEvent('app:record-updated', { detail: { type } }));

  } catch (error) {
    // 错误已在 api() 函数中处理
  } finally {
    isSubmitting = false;
    elements.modalSubmit.disabled = false;
    elements.modalSubmit.classList.remove('btn-submitting');
    elements.modalSubmit.textContent = originalText;
  }
}, 300);

/**
 * 显示确认删除对话框
 */
export function showConfirmDelete() {
  const { currentRecord } = appStore.getState();
  const confirmBody = elements.confirmModal.querySelector('.modal-body p');
  const recordName = currentRecord?.title || currentRecord?.extracted_context || currentRecord?.scenario || currentRecord?.trigger_condition || '此记录';
  const truncated = recordName.length > 50 ? recordName.slice(0, 50) + '…' : recordName;
  if (confirmBody) {
    confirmBody.textContent = `确定要删除「${truncated}」吗？此操作不可撤销。`;
  }
  elements.confirmModal.classList.remove('hidden');
}

/**
 * 关闭确认删除对话框
 */
export function closeConfirmDelete() {
  elements.confirmModal.classList.add('hidden');
}

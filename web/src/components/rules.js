/**
 * 行为规则列表组件
 * 加载和渲染行为规则记录列表
 */

import { apiService } from '../api.js';
import { appStore } from '../store.js';
import { elements } from '../dom.js';
import { showToast } from '../toast.js';
import { escapeHtml, getRecordTitle, getRecordTags, getRuleTypeLabel } from '../utils.js';

/** 注入的 openDrawer 函数引用 */
let _openDrawer = null;

/**
 * 注入 openDrawer 函数，解决循环依赖
 * @param {Function} fn - openDrawer 函数
 */
export function setDrawerOpener(fn) {
  _openDrawer = fn;
}

/**
 * 加载行为规则列表
 */
export async function loadRules() {
  try {
    // 显示骨架屏
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.show(
        elements.rulesList, 'card', 5
      );
    }

    const { rules } = appStore.getState();
    const result = await apiService.listRecords({
      limit: rules.limit,
      offset: rules.page * rules.limit,
      filter_type: 'behavior_rule',
    });

    appStore.setState({
      rules: {
        ...rules,
        total: result.total,
        records: result.records || [],
      }
    });

    // 隐藏骨架屏并渲染
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.hide(elements.rulesList);
    }
    renderRulesList(result.records || []);
  } catch (error) {
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.hide(elements.rulesList);
    }
    elements.rulesList.innerHTML = `<p class="empty-state error">加载失败: ${escapeHtml(error.message)}</p>`;
    showToast('加载行为规则失败: ' + error.message, 'error');
  }
}

/**
 * 渲染行为规则列表
 * @param {Array} records - 行为规则记录数组
 */
export function renderRulesList(records) {
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
    card.addEventListener('click', () => {
      if (_openDrawer) _openDrawer(card.dataset.id);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' && _openDrawer) _openDrawer(card.dataset.id);
    });
  });
}

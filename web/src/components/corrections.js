/**
 * 修正对列表组件
 * 加载和渲染修正对记录列表
 */

import { apiService } from '../api.js';
import { appStore } from '../store.js';
import { elements } from '../dom.js';
import { showToast } from '../toast.js';
import { escapeHtml, getRecordTitle, getRecordTags } from '../utils.js';

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
 * 加载修正对列表
 */
export async function loadCorrections() {
  try {
    // 显示骨架屏
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.show(
        elements.correctionsList, 'card', 5
      );
    }

    const { corrections } = appStore.getState();
    const result = await apiService.listRecords({
      limit: corrections.limit,
      offset: corrections.page * corrections.limit,
      filter_type: 'correction_pair',
    });

    appStore.setState({
      corrections: {
        ...corrections,
        total: result.total,
        records: result.records || [],
      }
    });

    // 隐藏骨架屏并渲染
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.hide(elements.correctionsList);
    }
    renderCorrectionsList(result.records || []);
  } catch (error) {
    // 确保骨架屏被隐藏
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.hide(elements.correctionsList);
    }
    elements.correctionsList.innerHTML = `<p class="empty-state error">加载失败: ${escapeHtml(error.message)}</p>`;
    showToast('加载修正对失败: ' + error.message, 'error');
  }
}

/**
 * 渲染修正对列表
 * @param {Array} records - 修正对记录数组
 */
export function renderCorrectionsList(records) {
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
    card.addEventListener('click', () => {
      if (_openDrawer) _openDrawer(card.dataset.id);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' && _openDrawer) _openDrawer(card.dataset.id);
    });
  });
}

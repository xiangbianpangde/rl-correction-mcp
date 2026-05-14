/**
 * 分页组件
 * 管理修正对和行为规则列表的分页状态
 */

import { appStore } from '../store.js';
import { elements } from '../dom.js';

/**
 * 分页更新
 * @param {'correction'|'rule'} type - 分页类型
 */
export function updatePagination(type) {
  const state = appStore.getState();

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

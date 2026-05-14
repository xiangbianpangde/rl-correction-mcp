/**
 * 搜索组件
 * RAG 搜索执行和本地列表搜索过滤
 */

import { apiService } from '../api.js';
import { elements } from '../dom.js';
import { showToast } from '../toast.js';
import { escapeHtml } from '../utils.js';

/**
 * RAG 搜索执行
 * @param {Event} e - 表单提交事件
 */
export async function performSearch(e) {
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

/**
 * 本地列表搜索过滤
 * @param {'corrections'|'rules'} type - 列表类型
 * @param {string} query - 搜索关键词
 */
export function filterLocalList(type, query) {
  const listEl = type === 'corrections' ? elements.correctionsList : elements.rulesList;
  const cards = listEl.querySelectorAll('.record-card');
  const q = query.toLowerCase().trim();

  if (!q) {
    cards.forEach(card => {
      card.style.display = '';
    });
    return;
  }

  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(q) ? '' : 'none';
  });
}

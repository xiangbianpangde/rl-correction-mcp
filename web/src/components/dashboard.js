/**
 * 仪表板组件
 * 加载概览仪表板数据
 */

import { apiService } from '../api.js';
import { appStore } from '../store.js';
import { elements } from '../dom.js';
import { showToast } from '../toast.js';
import { getRuleTypeLabel } from '../utils.js';

/**
 * 加载概览仪表板数据
 */
export async function loadDashboard() {
  try {
    // 显示骨架屏
    if (window.EnhancedInteractions) {
      window.EnhancedInteractions.SkeletonLoader.show(
        document.querySelector('.stats-grid'), 'stat', 3
      );
    }

    const stats = await apiService.getStats();
    appStore.setState({ stats });

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

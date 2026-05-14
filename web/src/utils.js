/**
 * 工具函数模块
 * 从 app.js 提取的纯函数，无副作用
 */

/**
 * 防抖函数
 * @param {Function} func - 需要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait) {
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

/**
 * HTML 转义，防止 XSS
 * @param {string} text - 需要转义的文本
 * @returns {string} 转义后的安全 HTML
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 日期格式化
 * @param {string} isoString - ISO 格式日期字符串
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(isoString) {
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

/**
 * 思维链 JSON 格式化
 * @param {string} jsonStr - JSON 字符串（数组或对象）
 * @returns {string} 格式化后的可读文本
 */
export function formatChainOfThought(jsonStr) {
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

/**
 * 规则类型标签映射
 * @param {string} type - 规则类型标识
 * @returns {string} 中文标签
 */
export function getRuleTypeLabel(type) {
  const labels = { must: '必须', must_not: '禁止', should: '建议', should_not: '不建议' };
  return labels[type] || type;
}

/**
 * 审核状态标签映射
 * @param {string} status - 审核状态标识
 * @returns {string} 中文标签
 */
export function getReviewStatusLabel(status) {
  const labels = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };
  return labels[status] || status || '未知';
}

/**
 * 获取记录标题（优先使用后端返回的 title 字段，兼容新旧格式）
 * @param {Object} record - 记录对象
 * @returns {string} 标题文本
 */
export function getRecordTitle(record) {
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

/**
 * 获取标签列表（兼容新旧格式）
 * @param {Object} record - 记录对象
 * @returns {string[]} 标签数组
 */
export function getRecordTags(record) {
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

/**
 * Toast 通知模块
 * 支持 EnhancedInteractions 增强模式，降级为原生 DOM 实现
 */

/**
 * 显示 Toast 通知
 * @param {string} message - 通知消息
 * @param {'success'|'error'|'info'|'warning'} type - 通知类型
 */
export function showToast(message, type = 'success') {
  if (window.EnhancedInteractions && window.EnhancedInteractions.showToast) {
    window.EnhancedInteractions.showToast(message, type);
    return;
  }
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

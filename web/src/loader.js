/**
 * 全局加载指示器模块
 * 使用引用计数管理多个并发请求的加载状态
 */

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

export default loader;

/**
 * 状态管理模块（发布-订阅模式）
 * 提供集中式状态存储和响应式更新机制
 */

/**
 * 创建响应式 store
 * @param {Object} initialState - 初始状态
 * @returns {{ getState: Function, setState: Function, subscribe: Function }}
 */
function createStore(initialState) {
  const listeners = new Map();
  let state = { ...initialState };

  return {
    /** 获取当前完整状态 */
    getState() {
      return state;
    },

    /**
     * 更新状态并通知所有订阅者
     * @param {Object} updates - 需要合并的状态片段
     */
    setState(updates) {
      state = { ...state, ...updates };
      // 通知所有订阅者
      listeners.forEach((callback) => callback(state));
    },

    /**
     * 订阅状态变化
     * @param {string} key - 订阅键名
     * @param {Function} callback - 状态变化回调，接收最新 state
     * @returns {Function} 取消订阅函数
     */
    subscribe(key, callback) {
      if (!listeners.has(key)) listeners.set(key, []);
      listeners.get(key).push(callback);
      return () => {
        const cbs = listeners.get(key);
        if (cbs) {
          const idx = cbs.indexOf(callback);
          if (idx > -1) cbs.splice(idx, 1);
        }
      };
    }
  };
}

/**
 * 全局 store 实例
 * 包含应用所有共享状态
 */
export const appStore = createStore({
  currentView: 'dashboard',
  corrections: { page: 0, limit: 20, total: 0, records: [] },
  rules: { page: 0, limit: 20, total: 0, records: [] },
  stats: null,
  currentRecord: null,
  deleteTarget: null,
  calls: { page: 0, limit: 50, total: 0, records: [] },
});

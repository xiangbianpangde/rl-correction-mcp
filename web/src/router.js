/**
 * SPA 路由模块
 * 管理视图切换逻辑
 */

import { appStore } from './store.js';
import { elements } from './dom.js';
import { loadDashboard } from './components/dashboard.js';
import { loadCorrections } from './components/corrections.js';
import { loadRules } from './components/rules.js';
import { loadCalls, loadCallStats } from './components/calls.js';
import { updatePagination } from './components/pagination.js';

/**
 * 视图切换
 * @param {string} viewName - 视图名称 (dashboard|corrections|rules|calls)
 */
export function switchView(viewName) {
  appStore.setState({ currentView: viewName });

  elements.navItems.forEach(item => {
    const isActive = item.dataset.view === viewName;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-current', isActive ? 'page' : undefined);
  });
  elements.views.forEach(view => {
    view.classList.toggle('hidden', view.id !== `view-${viewName}`);
  });

  if (viewName === 'dashboard') {
    loadDashboard();
  } else if (viewName === 'corrections') {
    loadCorrections().then(() => updatePagination('correction'));
  } else if (viewName === 'rules') {
    loadRules().then(() => updatePagination('rule'));
  } else if (viewName === 'calls') {
    loadCalls();
    loadCallStats();
  }
}

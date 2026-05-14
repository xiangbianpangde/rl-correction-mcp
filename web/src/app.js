/**
 * RL Correction MCP Web UI - 主入口文件
 * 整合所有模块，绑定事件，初始化应用
 */

import loader from './loader.js';
import { cacheElements, elements } from './dom.js';
import { appStore } from './store.js';
import { apiService } from './api.js';
import { showToast } from './toast.js';
import { getRecordTitle } from './utils.js';

// 组件导入
import { loadDashboard } from './components/dashboard.js';
import { loadCorrections, setDrawerOpener as setCorrectionsDrawerOpener } from './components/corrections.js';
import { loadRules, setDrawerOpener as setRulesDrawerOpener } from './components/rules.js';
import { openDrawer, closeDrawer } from './components/drawer.js';
import {
  openModal, openEditModal, closeModal,
  validateForm, showFieldErrors, handleSubmit,
  showConfirmDelete, closeConfirmDelete,
} from './components/modal.js';
import { performSearch, filterLocalList } from './components/search.js';
import { loadCalls, loadCallStats, bindCallEvents } from './components/calls.js';
import { updatePagination } from './components/pagination.js';
import { switchView } from './router.js';

/**
 * 绑定所有事件
 */
function bindEvents() {
  // 导航
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });

  // 添加按钮
  elements.btnAddNew.addEventListener('click', () => {
    openModal('correction');
  });
  elements.btnAddCorrection?.addEventListener('click', () => openModal('correction'));
  elements.btnAddRule?.addEventListener('click', () => openModal('rule'));

  // 分页
  elements.correctionPrev?.addEventListener('click', () => {
    const { corrections } = appStore.getState();
    if (corrections.page > 0) {
      appStore.setState({ corrections: { ...corrections, page: corrections.page - 1 } });
      loadCorrections().then(() => updatePagination('correction'));
    }
  });
  elements.correctionNext?.addEventListener('click', () => {
    const { corrections } = appStore.getState();
    appStore.setState({ corrections: { ...corrections, page: corrections.page + 1 } });
    loadCorrections().then(() => updatePagination('correction'));
  });
  elements.rulePrev?.addEventListener('click', () => {
    const { rules } = appStore.getState();
    if (rules.page > 0) {
      appStore.setState({ rules: { ...rules, page: rules.page - 1 } });
      loadRules().then(() => updatePagination('rule'));
    }
  });
  elements.ruleNext?.addEventListener('click', () => {
    const { rules } = appStore.getState();
    appStore.setState({ rules: { ...rules, page: rules.page + 1 } });
    loadRules().then(() => updatePagination('rule'));
  });

  // 抽屉关闭
  elements.drawerClose?.addEventListener('click', closeDrawer);
  elements.drawerCloseBtn?.addEventListener('click', closeDrawer);
  elements.drawer.querySelector('.drawer-backdrop')?.addEventListener('click', closeDrawer);

  // 删除
  elements.drawerDelete?.addEventListener('click', showConfirmDelete);
  elements.drawerEdit?.addEventListener('click', () => {
    elements.drawer.classList.add('hidden');
    document.body.style.overflow = '';
    openEditModal();
  });
  elements.confirmCancel?.addEventListener('click', closeConfirmDelete);
  elements.confirmDelete?.addEventListener('click', async () => {
    try {
      const { deleteTarget } = appStore.getState();
      await apiService.deleteRecord(deleteTarget);
      closeConfirmDelete();
      closeDrawer();
      showToast('删除成功');
      const { currentView } = appStore.getState();
      if (currentView === 'corrections') loadCorrections().then(() => updatePagination('correction'));
      else if (currentView === 'rules') loadRules().then(() => updatePagination('rule'));
      loadDashboard();
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    }
  });

  // 模态框
  elements.modalClose?.addEventListener('click', closeModal);
  elements.modalCancel?.addEventListener('click', closeModal);
  elements.modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);

  // 模态框提交
  elements.modalSubmit?.addEventListener('click', handleSubmit);

  // 搜索
  elements.ragSearchForm?.addEventListener('submit', performSearch);

  // 本地搜索
  const correctionSearchInput = document.getElementById('correction-search');
  const ruleSearchInput = document.getElementById('rule-search');

  correctionSearchInput?.addEventListener('input', (e) => {
    filterLocalList('corrections', e.target.value);
  });
  ruleSearchInput?.addEventListener('input', (e) => {
    filterLocalList('rules', e.target.value);
  });

  // ESC 关闭
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!elements.drawer.classList.contains('hidden')) closeDrawer();
      else if (!elements.modal.classList.contains('hidden')) closeModal();
      else if (!elements.confirmModal.classList.contains('hidden')) closeConfirmDelete();
    }
  });

  // 记录更新事件（由 modal.js handleSubmit 触发）
  window.addEventListener('app:record-updated', (e) => {
    const { type } = e.detail;
    if (type === 'correction') loadCorrections().then(() => updatePagination('correction'));
    else if (type === 'rule') loadRules().then(() => updatePagination('rule'));
    loadDashboard();
  });
}

/**
 * 初始化应用
 */
function init() {
  loader.init();
  cacheElements();

  // 注入 openDrawer 到 corrections 和 rules 组件
  setCorrectionsDrawerOpener(openDrawer);
  setRulesDrawerOpener(openDrawer);

  bindEvents();
  bindCallEvents();
  loadDashboard();
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);

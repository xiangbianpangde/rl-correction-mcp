/**
 * DOM 元素缓存模块
 * 避免重复查询 DOM，提升性能
 */

/** 缓存的 DOM 元素引用 */
export const elements = {};

/**
 * 缓存所有常用 DOM 元素
 * 应在 DOMContentLoaded 后调用一次
 */
export function cacheElements() {
  // 导航和视图
  elements.navItems = document.querySelectorAll('.nav-item');
  elements.views = document.querySelectorAll('.view');

  // 仪表盘统计
  elements.statTotal = document.getElementById('stat-total');
  elements.statCorrections = document.getElementById('stat-corrections');
  elements.statRules = document.getElementById('stat-rules');
  elements.correctionCount = document.getElementById('correction-count');
  elements.ruleCount = document.getElementById('rule-count');
  elements.ruleTypes = document.getElementById('rule-types');
  elements.allTags = document.getElementById('all-tags');

  // 修正对列表
  elements.correctionsList = document.getElementById('corrections-list');
  elements.correctionPrev = document.getElementById('correction-prev');
  elements.correctionNext = document.getElementById('correction-next');
  elements.correctionPageInfo = document.getElementById('correction-page-info');

  // 行为规则列表
  elements.rulesList = document.getElementById('rules-list');
  elements.rulePrev = document.getElementById('rule-prev');
  elements.ruleNext = document.getElementById('rule-next');
  elements.rulePageInfo = document.getElementById('rule-page-info');

  // 搜索
  elements.ragSearchForm = document.getElementById('rag-search-form');
  elements.searchResults = document.getElementById('search-results');

  // 模态框
  elements.modal = document.getElementById('modal');
  elements.modalTitle = document.getElementById('modal-title');
  elements.modalBody = document.getElementById('modal-body');
  elements.modalSubmit = document.getElementById('modal-submit');
  elements.modalClose = document.getElementById('modal-close');
  elements.modalCancel = document.getElementById('modal-cancel');

  // 抽屉
  elements.drawer = document.getElementById('drawer');
  elements.drawerTitle = document.getElementById('drawer-title');
  elements.drawerBody = document.getElementById('drawer-body');
  elements.drawerClose = document.getElementById('drawer-close');
  elements.drawerCloseBtn = document.getElementById('drawer-close-btn');
  elements.drawerDelete = document.getElementById('drawer-delete');
  elements.drawerEdit = document.getElementById('drawer-edit');

  // 确认删除对话框
  elements.confirmModal = document.getElementById('confirm-modal');
  elements.confirmCancel = document.getElementById('confirm-cancel');
  elements.confirmDelete = document.getElementById('confirm-delete');

  // Toast 容器
  elements.toastContainer = document.getElementById('toast-container');

  // 添加按钮
  elements.btnAddNew = document.getElementById('btn-add-new');
  elements.btnAddCorrection = document.getElementById('btn-add-correction');
  elements.btnAddRule = document.getElementById('btn-add-rule');
}

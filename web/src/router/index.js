import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { title: '概览' },
  },
  {
    path: '/corrections',
    name: 'CorrectionList',
    component: () => import('../views/CorrectionList.vue'),
    meta: { title: '修正对列表' },
  },
  {
    path: '/rules',
    name: 'RuleList',
    component: () => import('../views/RuleList.vue'),
    meta: { title: '行为规则' },
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('../views/Search.vue'),
    meta: { title: '搜索' },
  },
  {
    path: '/calls',
    name: 'CallList',
    component: () => import('../views/CallList.vue'),
    meta: { title: '调用记录' },
  },
  {
    path: '/add',
    name: 'AddCorrection',
    component: () => import('../views/CorrectionForm.vue'),
    meta: { title: '添加修正对' },
  },
  {
    path: '/add-rule',
    name: 'AddRule',
    component: () => import('../views/RuleForm.vue'),
    meta: { title: '添加行为规则' },
  },
  {
    path: '/edit/:id',
    name: 'EditCorrection',
    component: () => import('../views/CorrectionForm.vue'),
    meta: { title: '编辑修正对' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 更新页面标题
router.beforeEach((to, from, next) => {
  document.title = to.meta.title
    ? `${to.meta.title} - RL Correction MCP`
    : 'RL Correction MCP';
  next();
});

export default router;

import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '../views/Dashboard.vue';
import CorrectionList from '../views/CorrectionList.vue';
import RuleList from '../views/RuleList.vue';
import Search from '../views/Search.vue';
import CallList from '../views/CallList.vue';
import CorrectionForm from '../views/CorrectionForm.vue';

const routes = [
  { path: '/', name: 'Dashboard', component: Dashboard },
  { path: '/corrections', name: 'CorrectionList', component: CorrectionList },
  { path: '/rules', name: 'RuleList', component: RuleList },
  { path: '/search', name: 'Search', component: Search },
  { path: '/calls', name: 'CallList', component: CallList },
  { path: '/add', name: 'AddCorrection', component: CorrectionForm },
  { path: '/edit/:id', name: 'EditCorrection', component: CorrectionForm, props: true },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;

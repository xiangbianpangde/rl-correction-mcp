<template>
  <div class="app">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <header class="sidebar-header">
        <h1 class="logo">
          <el-icon><Tools /></el-icon>
          <span>RL Correction MCP</span>
        </h1>
        <p class="logo-subtitle">Web 管理界面</p>
      </header>

      <nav class="nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: $route.path === item.path }"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <el-button type="primary" @click="goToAdd">
          <el-icon><Plus /></el-icon>
          添加新记录
        </el-button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const navItems = ref([
  { path: '/', label: '概览', icon: 'DataLine' },
  { path: '/corrections', label: '修正对', icon: 'Document' },
  { path: '/rules', label: '行为规则', icon: 'List' },
  { path: '/search', label: '搜索', icon: 'Search' },
  { path: '/calls', label: '调用记录', icon: 'Phone' },
]);

const goToAdd = () => {
  router.push('/add');
};
</script>

<style scoped>
.app {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  background: #f5f4ed;
  border-right: 1px solid #e5e5e0;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid #e5e5e0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.logo-subtitle {
  font-size: 0.875rem;
  color: #666;
  margin: 4px 0 0;
}

.nav {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  color: #666;
  text-decoration: none;
  transition: all 0.2s;
}

.nav-item:hover {
  background: #e8e6df;
  color: #333;
}

.nav-item.active {
  background: #c45c3e;
  color: white;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #e5e5e0;
}

.main {
  flex: 1;
  margin-left: 240px;
  padding: 24px;
  background: #fafaf8;
  min-height: 100vh;
}
</style>

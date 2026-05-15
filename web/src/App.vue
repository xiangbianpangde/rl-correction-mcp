<template>
  <div class="app" :class="{ dark: isDark }">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <header class="sidebar-header">
        <h1 class="logo">
          <el-icon :size="24"><Tools /></el-icon>
          <span>RL Correction</span>
        </h1>
        <p class="logo-subtitle">MCP 管理界面</p>
      </header>

      <nav class="nav" role="navigation" aria-label="主导航">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: $route.path === item.path }"
          :aria-current="$route.path === item.path ? 'page' : undefined"
        >
          <el-icon :size="18"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <!-- 主题切换 -->
        <el-tooltip :content="isDark ? '切换到亮色模式' : '切换到暗黑模式'" placement="top">
          <el-button
            class="theme-toggle"
            :aria-label="isDark ? '切换到亮色模式' : '切换到暗黑模式'"
            @click="toggleTheme"
          >
            <el-icon :size="20">
              <Moon v-if="!isDark" />
              <Sunny v-else />
            </el-icon>
          </el-button>
        </el-tooltip>

        <el-button type="primary" @click="goToAdd" class="add-btn">
          <el-icon><Plus /></el-icon>
          添加新记录
        </el-button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main id="main" class="main" role="main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useThemeStore } from './stores/theme';
import {
  Tools,
  DataLine,
  Document,
  List,
  Search,
  Phone,
  Plus,
  Moon,
  Sunny,
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();
const isDark = computed(() => themeStore.isDark);
const toggleTheme = themeStore.toggleTheme;

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
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s, color 0.3s;
}

.sidebar {
  width: 240px;
  background-color: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
  transition: background-color 0.3s, border-color 0.3s;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid var(--sidebar-border);
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.125rem;
  font-weight: 600;
  font-family: var(--font-heading);
  letter-spacing: 0.02em;
  color: var(--text-primary);
  margin: 0;
}

.logo-subtitle {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 4px 0 0;
}

.nav {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  color: var(--sidebar-text);
  text-decoration: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.875rem;
}

.nav-item:hover {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
  transform: translateX(2px);
}

.nav-item.active {
  background-color: var(--sidebar-active);
  color: var(--color-primary-text);
  font-weight: 500;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.theme-toggle {
  width: 100%;
  padding: 12px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-toggle:hover {
  background-color: var(--bg-tertiary);
}

.add-btn {
  width: 100%;
}

.main {
  flex: 1;
  margin-left: 240px;
  padding: 32px;
  background-color: var(--bg-primary);
  min-height: 100vh;
}

/* 响应式 */
@media (max-width: 768px) {
  .sidebar {
    width: 60px;
  }

  .logo span,
  .logo-subtitle,
  .nav-item span,
  .add-btn span:not(.el-icon) {
    display: none;
  }

  .nav-item {
    justify-content: center;
    padding: 12px;
  }

  .sidebar-footer {
    padding: 12px;
  }

  .theme-toggle,
  .add-btn {
    width: auto;
    padding: 12px;
  }

  .add-btn span:not(.el-icon) {
    display: none;
  }

  .main {
    margin-left: 60px;
    padding: 16px;
  }
}
</style>

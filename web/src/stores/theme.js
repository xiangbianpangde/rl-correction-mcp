import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { usePreferredDark } from '@vueuse/core';

export const useThemeStore = defineStore('theme', () => {
  // 从 localStorage 读取或使用系统偏好
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = usePreferredDark();
  
  const isDark = ref(
    savedTheme ? savedTheme === 'dark' : prefersDark.value
  );

  // 切换主题
  function toggleTheme() {
    isDark.value = !isDark.value;
  }

  // 设置特定主题
  function setTheme(dark) {
    isDark.value = dark;
  }

  // 监听主题变化，更新 DOM 和 localStorage
  watch(isDark, (dark) => {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, { immediate: true });

  return {
    isDark,
    toggleTheme,
    setTheme,
  };
});

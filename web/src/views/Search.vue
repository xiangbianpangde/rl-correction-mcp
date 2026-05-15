<template>
  <div class="search-page">
    <h2>RAG 搜索</h2>
    <p class="description">基于向量相似度搜索修正记录</p>

    <el-card class="search-card">
      <el-form :model="searchForm" label-position="top">
        <el-form-item label="搜索查询">
          <el-input
            ref="searchInput"
            v-model="searchForm.query"
            type="textarea"
            :rows="3"
            placeholder="输入要搜索的内容，按 Ctrl+K 聚焦"
            @keyup.ctrl.k.prevent="focusSearch"
          />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="返回数量">
              <el-select v-model="searchForm.topK" style="width: 100%">
                <el-option :value="5" label="5 条" />
                <el-option :value="10" label="10 条" />
                <el-option :value="20" label="20 条" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="类型过滤">
              <el-select v-model="searchForm.type" style="width: 100%" clearable placeholder="全部">
                <el-option value="correction_pair" label="仅修正对" />
                <el-option value="behavior_rule" label="仅行为规则" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
        </el-form-item>
      </el-form>
      <p class="shortcut-hint">
        <kbd>Ctrl</kbd> + <kbd>K</kbd> 聚焦搜索框
      </p>
    </el-card>

    <el-card v-if="results.length" class="results-card">
      <template #header>
        <span>搜索结果 ({{ results.length }} 条)</span>
      </template>
      <div
        v-for="(result, index) in results"
        :key="index"
        class="result-item"
        role="article"
        :aria-label="`搜索结果 ${index + 1}: ${getResultTitle(result)}`"
      >
        <div class="result-header">
          <el-tag :type="result.type === 'correction_pair' ? 'warning' : 'success'">
            {{ result.type === 'correction_pair' ? '修正对' : '行为规则' }}
          </el-tag>
          <span class="similarity" aria-label="相似度">
            相似度: {{ (result.similarity * 100).toFixed(1) }}%
          </span>
        </div>
        <div class="result-content">
          <p><strong>触发条件:</strong> {{ result.metadata?.trigger_condition || result.metadata?.extracted_context || '-' }}</p>
          <p><strong>内容:</strong> {{ result.content?.substring(0, 200) }}{{ result.content?.length > 200 ? '...' : '' }}</p>
        </div>
      </div>
    </el-card>

    <el-empty v-else-if="searched" description="未找到相关结果" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useCorrectionsStore } from '../stores/corrections';

const store = useCorrectionsStore();

const loading = ref(false);
const searched = ref(false);
const results = ref([]);
const searchInput = ref(null);

const searchForm = reactive({
  query: '',
  topK: 5,
  type: null,
});

const getResultTitle = (result) => {
  return result.metadata?.trigger_condition || result.metadata?.extracted_context || '未知';
};

const focusSearch = () => {
  searchInput.value?.focus();
};

const handleSearch = async () => {
  if (!searchForm.query.trim()) {
    ElMessage.warning('请输入搜索内容');
    return;
  }

  loading.value = true;
  searched.value = false;
  results.value = [];
  try {
    const data = await store.search(searchForm.query, searchForm.topK, searchForm.type);
    results.value = data.results || [];
    searched.value = true;
    if (results.value.length === 0) {
      ElMessage.info('未找到相关结果，请尝试其他关键词');
    }
  } catch (error) {
    console.error('Search failed:', error);
    ElMessage.error(error.message || '搜索失败，请稍后重试');
    searched.value = true;
  } finally {
    loading.value = false;
  }
};

// 全局键盘快捷键
const handleGlobalKeydown = (e) => {
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    focusSearch();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
  // 自动聚焦搜索框
  focusSearch();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<style scoped>
.search-page {
  max-width: 800px;
}

.description {
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.search-card {
  margin-bottom: 24px;
}

.shortcut-hint {
  margin-top: 12px;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
}

.shortcut-hint kbd {
  display: inline-block;
  padding: 2px 6px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.75rem;
}

.result-item {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.2s;
}

.result-item:last-child {
  border-bottom: none;
}

.result-item:hover {
  background-color: var(--bg-secondary);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.similarity {
  font-size: 14px;
  color: var(--color-info);
}

.result-content p {
  margin: 4px 0;
  color: var(--text-secondary);
}

.result-content strong {
  color: var(--text-primary);
}
</style>

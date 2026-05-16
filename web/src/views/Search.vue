<template>
  <div class="search-page">
    <div class="title-section">
      <h2>RAG 搜索</h2>
      <p class="description">基于向量相似度搜索修正记录</p>
    </div>

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

    <!-- 高级过滤器 -->
    <DynamicFilterPanel v-model="advancedFilters" />

    <!-- 搜索结果 -->
    <el-card v-if="searchResults.length > 0" class="results-card">
      <template #header>
        <span>搜索结果 ({{ totalResults }} 条)</span>
      </template>

      <el-table
        :data="searchResults"
        style="width: 100%"
        @row-click="handleRowClick"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-content">
              <el-descriptions :column="1" border>
                <el-descriptions-item label="场景描述">
                  {{ row.metadata?.scenario || row.metadata?.extracted_context || '-' }}
                </el-descriptions-item>
                <el-descriptions-item label="错误输出">
                  <span class="wrong-text">{{ row.metadata?.wrong_output || '-' }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="正确输出">
                  <span class="correct-text">{{ row.metadata?.correct_output || '-' }}</span>
                </el-descriptions-item>
                <el-descriptions-item v-if="row.metadata?.chain_of_thought" label="错误逻辑链">
                  <span class="wrong-text">{{ row.metadata.chain_of_thought }}</span>
                </el-descriptions-item>
                <el-descriptions-item v-if="row.metadata?.correct_chain_of_thought" label="正确逻辑链">
                  <span class="correct-text">{{ row.metadata.correct_chain_of_thought }}</span>
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="similarity" label="相似度" width="100">
          <template #default="{ row }">
            <el-tag :type="getSimilarityType(row.similarity)">
              {{ (row.similarity * 100).toFixed(1) }}%
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">
              {{ row.type === 'correction_pair' ? '修正对' : '行为规则' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="标签" width="200">
          <template #default="{ row }">
            <el-tag
              v-for="tag in parseTags(row.metadata?.tags)"
              :key="tag"
              size="small"
              style="margin-right: 4px"
            >
              {{ tag }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="metadata.priority" label="优先级" width="80">
          <template #default="{ row }">
            <el-tag
              :type="getPriorityType(row.metadata?.priority)"
              size="small"
            >
              {{ row.metadata?.priority || 'P1' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="预览">
          <template #default="{ row }">
            <div class="preview-text">
              {{ row.content?.substring(0, 100) }}...
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import { useCorrectionsStore } from '../stores/corrections';
import DynamicFilterPanel from '../components/DynamicFilterPanel.vue'

const store = useCorrectionsStore();

const loading = ref(false);
const searched = ref(false);
const results = ref([]);
const searchResults = ref([]);
const totalResults = ref(0);
const searchInput = ref(null);

const searchForm = reactive({
  query: '',
  topK: 5,
  type: null,
});

const advancedFilters = ref({})

const getResultTitle = (result) => {
  return result.metadata?.trigger_condition || result.metadata?.extracted_context || '未知';
};

const getSimilarityType = (similarity) => {
  if (similarity >= 0.8) return 'success'
  if (similarity >= 0.6) return 'warning'
  return 'info'
}

const parseTags = (tags) => {
  if (!tags) return []
  if (Array.isArray(tags)) return tags
  return tags.split(',').filter(t => t)
}

const getPriorityType = (priority) => {
  const priorityMap = {
    'P0': 'danger',
    'P1': 'warning',
    'P2': 'info',
    'P3': 'info'
  }
  return priorityMap[priority] || 'info'
}

const handleRowClick = (row) => {
  console.log('Clicked row:', row.id)
}

const focusSearch = () => {
  searchInput.value?.focus();
};

const handleSearch = async () => {
  if (!searchForm.query.trim()) {
    ElMessage.warning('请输入搜索关键词')
    return
  }

  loading.value = true
  try {
    const response = await axios.post('/api/search', {
      query: searchForm.query,
      top_k: searchForm.topK,
      filters: Object.keys(advancedFilters.value).length > 0 ? advancedFilters.value : null
    })
    
    searchResults.value = response.data.results
    totalResults.value = response.data.total
  } catch (error) {
    ElMessage.error('搜索失败: ' + (error.response?.data?.detail || error.message))
  } finally {
    loading.value = false
  }
}

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
  margin: 0 auto;
}

.title-section {
  text-align: center;
  margin-bottom: 24px;
}

.description {
  color: var(--text-secondary);
  margin-bottom: 24px;
  text-align: center;
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

.results-card {
  margin-top: 16px;
}

.expand-content {
  padding: 16px;
  background: var(--el-fill-color-light);
}

.wrong-text {
  color: var(--el-color-danger);
}

.correct-text {
  color: var(--el-color-success);
}

.preview-text {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>

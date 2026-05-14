<template>
  <div class="search-page">
    <h2>RAG 搜索</h2>
    <p class="description">基于向量相似度搜索修正记录</p>

    <el-card class="search-card">
      <el-form :model="searchForm" label-position="top">
        <el-form-item label="搜索查询">
          <el-input
            v-model="searchForm.query"
            type="textarea"
            :rows="3"
            placeholder="输入要搜索的内容"
            @keyup.enter.ctrl="handleSearch"
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
              <el-select v-model="searchForm.type" style="width: 100%">
                <el-option :value="null" label="全部" />
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
    </el-card>

    <el-card v-if="results.length" class="results-card">
      <template #header>
        <span>搜索结果 ({{ results.length }} 条)</span>
      </template>
      <div v-for="(result, index) in results" :key="index" class="result-item">
        <div class="result-header">
          <el-tag :type="result.record_type === 'correction_pair' ? 'warning' : 'success'">
            {{ result.record_type === 'correction_pair' ? '修正对' : '行为规则' }}
          </el-tag>
          <span class="similarity">相似度: {{ (result.similarity * 100).toFixed(1) }}%</span>
        </div>
        <div class="result-content">
          <p><strong>场景:</strong> {{ result.input_chain?.raw_input || result.input_chain?.trigger_condition }}</p>
          <p><strong>输出:</strong> {{ result.output_chain?.wrong_output || result.output_chain?.rule_content }}</p>
        </div>
      </div>
    </el-card>

    <el-empty v-else-if="searched" description="未找到相关结果" />
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useCorrectionsStore } from '../stores/corrections';

const store = useCorrectionsStore();

const loading = ref(false);
const searched = ref(false);
const results = ref([]);

const searchForm = reactive({
  query: '',
  topK: 5,
  type: null,
});

const handleSearch = async () => {
  if (!searchForm.query.trim()) return;

  loading.value = true;
  searched.value = false;
  try {
    const data = await store.search(searchForm.query, searchForm.topK, searchForm.type);
    results.value = data.results || [];
    searched.value = true;
  } catch (error) {
    console.error('Search failed:', error);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.search-page {
  max-width: 800px;
}

.description {
  color: #666;
  margin-bottom: 24px;
}

.search-card {
  margin-bottom: 24px;
}

.result-item {
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.result-item:last-child {
  border-bottom: none;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.similarity {
  font-size: 14px;
  color: #409eff;
}

.result-content p {
  margin: 4px 0;
  color: #666;
}
</style>

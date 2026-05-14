<template>
  <div class="dashboard">
    <h2>概览</h2>
    <p class="description">查看 RL Correction MCP 的整体状态</p>

    <el-row :gutter="20" class="stats-row">
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-icon">
            <el-icon :size="32"><Document /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.total_records || 0 }}</div>
            <div class="stat-label">总记录数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-icon correction">
            <el-icon :size="32"><Edit /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.correction_pairs || 0 }}</div>
            <div class="stat-label">修正对</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-icon rule">
            <el-icon :size="32"><List /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.behavior_rules || 0 }}</div>
            <div class="stat-label">行为规则</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>规则类型分布</span>
          </template>
          <div v-if="stats?.rule_type_breakdown" class="tag-list">
            <el-tag
              v-for="(count, type) in stats.rule_type_breakdown"
              :key="type"
              class="tag-item"
              :type="type === 'must' ? 'danger' : 'warning'"
            >
              {{ type === 'must' ? '必须' : '建议' }}: {{ count }}
            </el-tag>
          </div>
          <el-empty v-else description="暂无数据" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>所有标签</span>
          </template>
          <div v-if="stats?.all_tags?.length" class="tag-list">
            <el-tag
              v-for="tag in stats.all_tags"
              :key="tag"
              class="tag-item"
              size="small"
            >
              {{ tag }}
            </el-tag>
          </div>
          <el-empty v-else description="暂无标签" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useCorrectionsStore } from '../stores/corrections';
import { storeToRefs } from 'pinia';

const store = useCorrectionsStore();
const { stats } = storeToRefs(store);

onMounted(() => {
  store.fetchStats();
});
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
}

.description {
  color: #666;
  margin-bottom: 24px;
}

.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  background: #e6f2ff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  color: #409eff;
}

.stat-icon.correction {
  background: #fdf2e9;
  color: #e6a23c;
}

.stat-icon.rule {
  background: #f0f9eb;
  color: #67c23a;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.charts-row {
  margin-bottom: 24px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  margin: 0;
}
</style>

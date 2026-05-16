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
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: var(--radius-lg);
  background: var(--color-info-light);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  color: var(--color-info);
  flex-shrink: 0;
}

.stat-icon.correction {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.stat-icon.rule {
  background: var(--color-success-light);
  color: var(--color-success);
}

.stat-content {
  flex: 1;
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  font-family: var(--font-heading);
  color: var(--text-primary);
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  font-family: var(--font-heading);
  color: var(--text-secondary);
  margin-top: 4px;
  text-align: center;
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

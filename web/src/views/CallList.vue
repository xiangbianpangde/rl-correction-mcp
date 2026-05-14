<template>
  <div class="call-list">
    <h2>调用记录</h2>
    <p class="description">查看 MCP 工具调用日志</p>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ callStats?.total || 0 }}</div>
          <div class="stat-label">总调用次数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value" style="color: #67c23a">{{ callStats?.success || 0 }}</div>
          <div class="stat-label">成功</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value" style="color: #f56c6c">{{ callStats?.error || 0 }}</div>
          <div class="stat-label">失败</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ callStats?.today || 0 }}</div>
          <div class="stat-label">今日调用</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选器 -->
    <el-card class="filter-card">
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="工具">
          <el-select v-model="filterForm.tool" placeholder="全部工具" clearable>
            <el-option label="添加修正对" value="rlc_add_correction" />
            <el-option label="添加规则" value="rlc_add_rule" />
            <el-option label="搜索" value="rlc_search" />
            <el-option label="列出记录" value="rlc_list_all" />
            <el-option label="删除" value="rlc_delete" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable>
            <el-option label="成功" value="success" />
            <el-option label="失败" value="error" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleFilter">
            <el-icon><Filter /></el-icon>
            筛选
          </el-button>
          <el-button @click="handleRefresh">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 调用记录列表 -->
    <el-table v-loading="loading" :data="calls" style="width: 100%">
      <el-table-column prop="timestamp" label="时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.timestamp) }}
        </template>
      </el-table-column>
      <el-table-column prop="tool_name" label="工具名称" width="150" />
      <el-table-column prop="result_status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.result_status === 'success' ? 'success' : 'danger'">
            {{ row.result_status === 'success' ? '✅ 成功' : '❌ 失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="duration_ms" label="耗时" width="100">
        <template #default="{ row }">
          {{ row.duration_ms }}ms
        </template>
      </el-table-column>
      <el-table-column prop="related_correction_id" label="关联记录">
        <template #default="{ row }">
          <span v-if="row.related_correction_id" class="record-id">
            {{ row.related_correction_id.slice(0, 8) }}...
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useCorrectionsStore } from '../stores/corrections';
import { storeToRefs } from 'pinia';

const store = useCorrectionsStore();
const { calls, callStats, loading } = storeToRefs(store);

const currentPage = ref(1);
const pageSize = ref(50);
const total = ref(0);

const filterForm = reactive({
  tool: '',
  status: '',
});

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN');
};

const handleFilter = () => {
  currentPage.value = 1;
  loadCalls();
};

const handleRefresh = () => {
  store.fetchCalls();
  store.fetchCallStats();
};

const handlePageChange = (page) => {
  currentPage.value = page;
  loadCalls();
};

const loadCalls = async () => {
  await store.fetchCalls();
  total.value = store.calls.length;
};

onMounted(() => {
  handleRefresh();
});
</script>

<style scoped>
.call-list {
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
  text-align: center;
  padding: 20px;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: #1a1a1a;
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-top: 8px;
}

.filter-card {
  margin-bottom: 24px;
}

.record-id {
  font-family: monospace;
  color: #409eff;
}

.pagination {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}
</style>

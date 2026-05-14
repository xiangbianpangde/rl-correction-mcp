<template>
  <div class="rule-list">
    <div class="header">
      <h2>行为规则列表</h2>
      <el-button type="primary" @click="$router.push('/add')">
        <el-icon><Plus /></el-icon>
        添加规则
      </el-button>
    </div>

    <el-table v-loading="loading" :data="rules" style="width: 100%">
      <el-table-column prop="input_chain.trigger_condition" label="触发条件" min-width="200">
        <template #default="{ row }">
          <div class="cell-text">{{ row.input_chain?.trigger_condition || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="output_chain.rule_content" label="规则内容" min-width="250">
        <template #default="{ row }">
          <div class="cell-text">{{ row.output_chain?.rule_content?.slice(0, 80) }}...</div>
        </template>
      </el-table-column>
      <el-table-column prop="output_chain.rule_type" label="规则类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.output_chain?.rule_type === 'must' ? 'danger' : 'warning'">
            {{ row.output_chain?.rule_type === 'must' ? '必须' : '建议' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="metadata.priority" label="优先级" width="100">
        <template #default="{ row }">
          <el-tag :type="getPriorityType(row.metadata?.priority)">
            {{ row.metadata?.priority || 'P1' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button type="danger" size="small" @click="handleDelete(row)">
            删除
          </el-button>
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
import { onMounted } from 'vue';
import { useCorrectionsStore } from '../stores/corrections';
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox } from 'element-plus';

const store = useCorrectionsStore();
const { rules, loading, total, currentPage, pageSize } = storeToRefs(store);

const getPriorityType = (priority) => {
  const map = { P0: 'danger', P1: 'warning', P2: 'info' };
  return map[priority] || 'info';
};

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除这条规则吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await store.deleteRecord(row.id);
    ElMessage.success('删除成功');
    store.fetchRules(currentPage.value);
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + error.message);
    }
  }
};

const handlePageChange = (page) => {
  store.fetchRules(page);
};

onMounted(() => {
  store.fetchRules();
});
</script>

<style scoped>
.rule-list {
  max-width: 1400px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.cell-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pagination {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}
</style>

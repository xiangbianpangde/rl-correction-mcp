<template>
  <div class="correction-list">
    <div class="header">
      <h2>修正对列表</h2>
      <el-button type="primary" @click="$router.push('/add')">
        <el-icon><Plus /></el-icon>
        添加修正对
      </el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="corrections"
      style="width: 100%"
      row-class-name="clickable-row"
      @row-click="handleRowClick"
    >
      <el-table-column prop="input_chain.raw_input" label="场景描述" min-width="200">
        <template #default="{ row }">
          <div class="cell-text clickable">{{ row.input_chain?.raw_input || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="output_chain.wrong_output" label="错误输出" min-width="150">
        <template #default="{ row }">
          <div class="cell-text wrong clickable">{{ row.output_chain?.wrong_output?.slice(0, 50) }}...</div>
        </template>
      </el-table-column>
      <el-table-column prop="output_chain.correct_output" label="正确输出" min-width="150">
        <template #default="{ row }">
          <div class="cell-text correct clickable">{{ row.output_chain?.correct_output?.slice(0, 50) }}...</div>
        </template>
      </el-table-column>
      <el-table-column prop="metadata.priority" label="优先级" width="100">
        <template #default="{ row }">
          <el-tag :type="getPriorityType(row.metadata?.priority)">
            {{ row.metadata?.priority || 'P1' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="metadata.quality_score" label="质量分" width="100">
        <template #default="{ row }">
          <el-progress
            :percentage="row.output_chain?.quality_score || 0"
            :color="getScoreColor"
            :show-text="false"
            style="width: 60px"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click.stop="handleEdit(row)">
            编辑
          </el-button>
          <el-button type="danger" size="small" @click.stop="handleDelete(row)">
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
        layout="prev, pager, next, jumper"
        @current-change="handlePageChange"
      />
    </div>

    <!-- 详情抽屉 -->
    <CorrectionDetail
      v-model="detailVisible"
      :record="selectedRecord"
      @edit="handleEdit"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useCorrectionsStore } from '../stores/corrections';
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox } from 'element-plus';
import CorrectionDetail from './CorrectionDetail.vue';

const router = useRouter();
const store = useCorrectionsStore();
const { corrections, loading, total, currentPage, pageSize } = storeToRefs(store);

// 详情抽屉状态
const detailVisible = ref(false);
const selectedRecord = ref(null);

const getPriorityType = (priority) => {
  const map = { P0: 'danger', P1: 'warning', P2: 'info' };
  return map[priority] || 'info';
};

const getScoreColor = (percentage) => {
  if (percentage >= 80) return '#67c23a';
  if (percentage >= 60) return '#e6a23c';
  return '#f56c6c';
};

const handleRowClick = (row) => {
  selectedRecord.value = row;
  detailVisible.value = true;
};

const handleEdit = (row) => {
  detailVisible.value = false;
  router.push(`/edit/${row.id}`);
};

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除这条记录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await store.deleteRecord(row.id);
    ElMessage.success('删除成功');
    store.fetchCorrections(currentPage.value);
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + error.message);
    }
  }
};

const handlePageChange = (page) => {
  store.fetchCorrections(page);
};

onMounted(() => {
  store.fetchCorrections();
});
</script>

<style scoped>
.correction-list {
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

.cell-text.clickable {
  cursor: pointer;
}

.cell-text.clickable:hover {
  color: #409eff;
}

.cell-text.wrong {
  color: #f56c6c;
}

.cell-text.correct {
  color: #67c23a;
}

:deep(.clickable-row) {
  cursor: pointer;
}

:deep(.clickable-row:hover) {
  background-color: #f5f7fa;
}

.pagination {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}
</style>

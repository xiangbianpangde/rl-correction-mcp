<template>
  <el-drawer
    v-model="visible"
    title="修正对详情"
    size="600px"
    direction="rtl"
  >
    <div v-if="record" class="detail-content">
      <!-- 基本信息 -->
      <el-card class="detail-card">
        <template #header>
          <span>📋 基本信息</span>
        </template>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="ID">
            <span class="id-text">{{ record.id }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDate(record.created_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatDate(record.updated_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="优先级">
            <el-tag :type="getPriorityType(record.metadata?.priority)">
              {{ record.metadata?.priority || 'P1' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="质量评分">
            <el-progress
              :percentage="record.output_chain?.quality_score || 0"
              :color="getScoreColor"
            />
          </el-descriptions-item>
          <el-descriptions-item v-if="record.tags?.length" label="标签">
            <el-tag v-for="tag in record.tags" :key="tag" size="small" style="margin-right: 4px">
              {{ tag }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 场景描述 -->
      <el-card class="detail-card">
        <template #header>
          <span>🎯 场景描述</span>
        </template>
        <div class="content-box">
          {{ record.input_chain?.raw_input || '-' }}
        </div>
      </el-card>

      <!-- 提取的上下文 -->
      <el-card v-if="record.input_chain?.extracted_context" class="detail-card">
        <template #header>
          <span>📎 提取的上下文</span>
        </template>
        <div class="content-box">
          {{ record.input_chain.extracted_context }}
        </div>
      </el-card>

      <!-- 错误输出 -->
      <el-card class="detail-card">
        <template #header>
          <span class="wrong-header">❌ 错误输出</span>
        </template>
        <div class="content-box wrong-content">
          {{ record.output_chain?.wrong_output || '-' }}
        </div>
        <div v-if="record.output_chain?.wrong_reason" class="reason-box">
          <div class="reason-label">错误原因：</div>
          <div class="reason-content">{{ record.output_chain.wrong_reason }}</div>
        </div>
      </el-card>

      <!-- 正确输出 -->
      <el-card class="detail-card">
        <template #header>
          <span class="correct-header">✅ 正确输出</span>
        </template>
        <div class="content-box correct-content">
          {{ record.output_chain?.correct_output || '-' }}
        </div>
        <div v-if="record.output_chain?.correct_reason" class="reason-box">
          <div class="reason-label">正确原因：</div>
          <div class="reason-content">{{ record.output_chain.correct_reason }}</div>
        </div>
      </el-card>

      <!-- 元数据 -->
      <el-card v-if="record.metadata?.notes" class="detail-card">
        <template #header>
          <span>📝 备注</span>
        </template>
        <div class="content-box">
          {{ record.metadata.notes }}
        </div>
      </el-card>

      <div class="actions">
        <el-button type="primary" @click="$emit('edit', record)">
          编辑
        </el-button>
        <el-button @click="visible = false">关闭</el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  record: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:modelValue', 'edit']);

const visible = ref(false);

watch(() => props.modelValue, (val) => {
  visible.value = val;
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

const getPriorityType = (priority) => {
  const map = { P0: 'danger', P1: 'warning', P2: 'info', P3: '' };
  return map[priority] || 'info';
};

const getScoreColor = (percentage) => {
  if (percentage >= 80) return '#67c23a';
  if (percentage >= 60) return '#e6a23c';
  return '#f56c6c';
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};
</script>

<style scoped>
.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-card {
  margin-bottom: 0;
}

.id-text {
  font-size: 12px;
  word-break: break-all;
  color: var(--text-muted);
}

.content-box {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  padding: 8px 0;
}

.wrong-content {
  color: var(--color-danger);
}

.correct-content {
  color: var(--color-success);
}

.wrong-header {
  color: var(--color-danger);
}

.correct-header {
  color: var(--color-success);
}

.reason-box {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-light);
}

.reason-label {
  font-weight: bold;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.reason-content {
  color: var(--text-secondary);
  line-height: 1.6;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}
</style>

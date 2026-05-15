<template>
  <div class="rule-form">
    <h2>{{ isEdit ? '编辑行为规则' : '添加行为规则' }}</h2>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="form"
    >
      <!-- 触发条件 -->
      <el-card class="section-card">
        <template #header>
          <span>🎯 触发条件</span>
        </template>
        <el-form-item label="触发条件" prop="trigger_condition">
          <el-input
            v-model="form.trigger_condition"
            type="textarea"
            :rows="3"
            placeholder="请输入触发条件，例如：当用户要求修改现有文件时"
          />
        </el-form-item>
      </el-card>

      <!-- 规则内容 -->
      <el-card class="section-card">
        <template #header>
          <span>📋 规则内容</span>
        </template>
        <el-form-item label="规则内容" prop="rule_content">
          <el-input
            v-model="form.rule_content"
            type="textarea"
            :rows="5"
            placeholder="请输入规则内容，描述应该遵循的行为"
          />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="规则类型" prop="rule_type">
              <el-select v-model="form.rule_type" style="width: 100%">
                <el-option label="必须做 (Must)" value="must" />
                <el-option label="禁止做 (Must Not)" value="must_not" />
                <el-option label="建议做 (Should)" value="should" />
                <el-option label="建议不做 (Should Not)" value="should_not" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="优先级">
              <el-select v-model="form.priority" style="width: 100%">
                <el-option label="P0 - 紧急" value="P0" />
                <el-option label="P1 - 高" value="P1" />
                <el-option label="P2 - 中" value="P2" />
                <el-option label="P3 - 低" value="P3" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>

      <!-- 元数据 -->
      <el-card class="section-card">
        <template #header>
          <span>🏷️ 元数据</span>
        </template>
        <el-form-item label="标签">
          <el-input
            v-model="form.tags"
            placeholder="用逗号分隔多个标签"
          />
        </el-form-item>
      </el-card>

      <div class="actions">
        <el-button @click="$router.back()">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '添加规则' }}
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCorrectionsStore } from '../stores/corrections';
import { ElMessage } from 'element-plus';

const route = useRoute();
const router = useRouter();
const store = useCorrectionsStore();

const isEdit = ref(false);
const submitting = ref(false);
const formRef = ref(null);

const form = reactive({
  trigger_condition: '',
  rule_content: '',
  rule_type: 'must',
  priority: 'P1',
  tags: '',
});

const rules = {
  trigger_condition: [{ required: true, message: '请输入触发条件', trigger: 'blur' }],
  rule_content: [{ required: true, message: '请输入规则内容', trigger: 'blur' }],
};

const handleSubmit = async () => {
  submitting.value = true;
  try {
    const payload = {
      trigger_condition: form.trigger_condition,
      scenario_description: form.trigger_condition, // 使用触发条件作为场景描述
      rule_content: form.rule_content,
      rule_type: form.rule_type,
      priority: form.priority,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(t => t) : [],
    };

    await store.addRule(payload);
    ElMessage.success('添加成功');
    router.push('/rules');
  } catch (error) {
    ElMessage.error(error.message || '添加失败');
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  if (route.params.id) {
    isEdit.value = true;
    // TODO: 加载编辑数据
  }
});
</script>

<style scoped>
.rule-form {
  max-width: 800px;
}

.section-card {
  margin-bottom: 24px;
  border-left: 3px solid var(--color-primary);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}
</style>

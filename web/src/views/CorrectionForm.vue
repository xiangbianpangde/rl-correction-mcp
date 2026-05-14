<template>
  <div class="correction-form">
    <h2>{{ isEdit ? '编辑修正对' : '添加修正对' }}</h2>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="form"
    >
      <!-- 输入链 -->
      <el-card class="section-card">
        <template #header>
          <span>📥 输入链</span>
        </template>
        <el-form-item label="场景描述" prop="raw_input">
          <el-input
            v-model="form.raw_input"
            type="textarea"
            :rows="3"
            placeholder="请输入场景描述"
          />
        </el-form-item>
        <el-form-item label="提取的上下文">
          <el-input
            v-model="form.extracted_context"
            type="textarea"
            :rows="2"
            placeholder="可选：提取的上下文信息"
          />
        </el-form-item>
      </el-card>

      <!-- 输出链 -->
      <el-card class="section-card">
        <template #header>
          <span>📤 输出链</span>
        </template>
        <el-form-item label="错误输出" prop="wrong_output">
          <el-input
            v-model="form.wrong_output"
            type="textarea"
            :rows="4"
            placeholder="请输入错误输出"
          />
        </el-form-item>
        <el-form-item label="正确输出" prop="correct_output">
          <el-input
            v-model="form.correct_output"
            type="textarea"
            :rows="4"
            placeholder="请输入正确输出"
          />
        </el-form-item>
        <el-form-item label="质量评分">
          <el-slider v-model="form.quality_score" :max="100" show-stops />
        </el-form-item>
      </el-card>

      <!-- 逻辑链 -->
      <el-card class="section-card">
        <template #header>
          <span>🧠 逻辑链</span>
        </template>
        <el-form-item label="错误原因">
          <el-input
            v-model="form.wrong_reason"
            type="textarea"
            :rows="2"
            placeholder="分析错误原因"
          />
        </el-form-item>
        <el-form-item label="正确原因">
          <el-input
            v-model="form.correct_reason"
            type="textarea"
            :rows="2"
            placeholder="分析正确做法的原因"
          />
        </el-form-item>
      </el-card>

      <!-- 元数据 -->
      <el-card class="section-card">
        <template #header>
          <span>📋 元数据</span>
        </template>
        <el-row :gutter="20">
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
          <el-col :span="12">
            <el-form-item label="标签">
              <el-input
                v-model="form.tags"
                placeholder="用逗号分隔多个标签"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>

      <div class="actions">
        <el-button @click="$router.back()">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '添加记录' }}
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
  raw_input: '',
  extracted_context: '',
  wrong_output: '',
  correct_output: '',
  quality_score: 50,
  wrong_reason: '',
  correct_reason: '',
  priority: 'P1',
  tags: '',
});

const rules = {
  raw_input: [{ required: true, message: '请输入场景描述', trigger: 'blur' }],
  wrong_output: [{ required: true, message: '请输入错误输出', trigger: 'blur' }],
  correct_output: [{ required: true, message: '请输入正确输出', trigger: 'blur' }],
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    submitting.value = true;
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(t => t) : [],
      };

      if (isEdit.value) {
        // await store.updateCorrection(route.params.id, payload);
        ElMessage.success('修改成功');
      } else {
        await store.addCorrection(payload);
        ElMessage.success('添加成功');
      }
      router.push('/corrections');
    } catch (error) {
      ElMessage.error(error.message);
    } finally {
      submitting.value = false;
    }
  });
};

onMounted(() => {
  if (route.params.id) {
    isEdit.value = true;
    // 加载编辑数据
  }
});
</script>

<style scoped>
.correction-form {
  max-width: 800px;
}

.section-card {
  margin-bottom: 24px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}
</style>

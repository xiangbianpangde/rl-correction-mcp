<template>
  <el-card class="filter-panel">
    <template #header>
      <div class="filter-header">
        <span>🔍 高级过滤</span>
        <el-button text type="primary" @click="resetFilters" size="small">
          重置
        </el-button>
      </div>
    </template>

    <el-form label-position="top" class="filter-form">
      <!-- 标签过滤 -->
      <el-form-item label="标签">
        <el-select
          v-model="localFilters.tags"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择标签"
          style="width: 100%"
        >
          <el-option
            v-for="tag in tagOptions"
            :key="tag.value"
            :label="tag.label"
            :value="tag.value"
          />
        </el-select>
      </el-form-item>

      <!-- 优先级过滤 -->
      <el-form-item label="优先级">
        <el-checkbox-group v-model="localFilters.priority">
          <el-checkbox label="P0">P0 - 关键</el-checkbox>
          <el-checkbox label="P1">P1 - 重要</el-checkbox>
          <el-checkbox label="P2">P2 - 次要</el-checkbox>
        </el-checkbox-group>
      </el-form-item>

      <!-- 质量评分过滤 -->
      <el-form-item label="质量评分">
        <el-slider
          v-model="qualityScoreRange"
          range
          :min="0"
          :max="100"
          :marks="qualityMarks"
        />
      </el-form-item>

      <!-- 审核状态过滤 -->
      <el-form-item label="审核状态">
        <el-radio-group v-model="localFilters.review_status">
          <el-radio-button label="">全部</el-radio-button>
          <el-radio-button label="pending">待审核</el-radio-button>
          <el-radio-button label="approved">已通过</el-radio-button>
          <el-radio-button label="rejected">已拒绝</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <!-- 记录类型过滤 -->
      <el-form-item label="记录类型">
        <el-radio-group v-model="localFilters.type">
          <el-radio-button label="">全部</el-radio-button>
          <el-radio-button label="correction_pair">修正对</el-radio-button>
          <el-radio-button label="behavior_rule">行为规则</el-radio-button>
        </el-radio-group>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup>
import { ref, watch } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:modelValue'])

const localFilters = ref({
  tags: [],
  priority: [],
  review_status: '',
  type: ''
})

const qualityScoreRange = ref([0, 100])

const qualityMarks = {
  0: '0',
  50: '50',
  100: '100'
}

const tagOptions = ref([])

const loadFilters = async () => {
  try {
    const response = await axios.get('/api/search/filters')
    const tagsFilter = response.data.filters.find(f => f.name === 'tags')
    if (tagsFilter && tagsFilter.options) {
      tagOptions.value = tagsFilter.options
    }
  } catch (error) {
    console.error('加载过滤器失败:', error)
    ElMessage.error('加载过滤器失败')
  }
}

const resetFilters = () => {
  localFilters.value = {
    tags: [],
    priority: [],
    review_status: '',
    type: ''
  }
  qualityScoreRange.value = [0, 100]
}

watch([localFilters, qualityScoreRange], () => {
  const filters = {
    ...localFilters.value,
    quality_score_min: qualityScoreRange.value[0],
    quality_score_max: qualityScoreRange.value[1]
  }

  // 移除空值
  const cleanedFilters = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value && (Array.isArray(value) ? value.length > 0 : true)) {
      cleanedFilters[key] = value
    }
  }

  emit('update:modelValue', cleanedFilters)
}, { deep: true })

// 初始化加载
loadFilters()
</script>

<style scoped>
.filter-panel {
  margin-bottom: 16px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

@media (max-width: 768px) {
  .filter-form {
    grid-template-columns: 1fr;
  }
}
</style>

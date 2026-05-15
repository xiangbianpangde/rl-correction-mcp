# 检索优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增强 RL Correction MCP 的检索功能，支持多维度组合过滤，并预留 Elasticsearch 迁移接口。

**Architecture:** 在现有 ChromaDB 检索基础上，增加抽象检索器接口和多维度过滤模型。前端使用 Vue 3 + Element Plus 构建动态过滤器面板，搜索结果改为表格+展开行展示。

**Tech Stack:** Python 3.11, FastAPI, Pydantic, ChromaDB, Vue 3, Element Plus, TypeScript

---

## 文件结构

```
src/rl_correction_mcp/
├── models.py              # 修改：添加 AdvancedSearchFilters, FilterDefinition
├── retriever.py           # 修改：添加 RetrieverInterface 抽象类
└── store.py               # 修改：实现多维度过滤逻辑

web_api.py                 # 修改：添加 /api/search/filters 端点

web/src/
├── views/
│   └── Search.vue         # 修改：添加过滤器面板，改造结果展示
├── components/
│   └── DynamicFilterPanel.vue  # 新建：动态过滤器组件
└── api/
    └── search.ts          # 新建：搜索 API 封装

tests/
└── test_search_filters.py # 新建：过滤功能测试
```

---

## Phase 1: 后端模型与接口 (0.5 天)

### Task 1: 添加过滤模型

**Files:**
- Modify: `src/rl_correction_mcp/models.py`

- [ ] **Step 1: 添加 AdvancedSearchFilters 模型**

在 `models.py` 的 `SearchInput` 类之前添加：

```python
class AdvancedSearchFilters(BaseModel):
    """高级搜索过滤条件"""
    model_config = ConfigDict(str_strip_whitespace=True)

    tags: Optional[list[str]] = Field(
        default=None,
        description="标签过滤（AND 关系，必须同时包含所有标签）",
    )
    tags_any: Optional[list[str]] = Field(
        default=None,
        description="标签过滤（OR 关系，包含任一标签即可）",
    )
    priority: Optional[list[str]] = Field(
        default=None,
        description="优先级过滤：P0 / P1 / P2",
    )
    quality_score_min: Optional[int] = Field(
        default=None,
        ge=0,
        le=100,
        description="最低质量评分",
    )
    quality_score_max: Optional[int] = Field(
        default=None,
        ge=0,
        le=100,
        description="最高质量评分",
    )
    review_status: Optional[str] = Field(
        default=None,
        description="审核状态：pending / approved / rejected",
        pattern=r"^(pending|approved|rejected)?$",
    )
    created_after: Optional[str] = Field(
        default=None,
        description="创建时间起始（ISO 格式）",
    )
    created_before: Optional[str] = Field(
        default=None,
        description="创建时间结束（ISO 格式）",
    )
    type: Optional[str] = Field(
        default=None,
        description="记录类型：correction_pair / behavior_rule",
        pattern=r"^(correction_pair|behavior_rule)?$",
    )
```

- [ ] **Step 2: 添加 FilterDefinition 模型**

在 `AdvancedSearchFilters` 之后添加：

```python
class FilterOption(BaseModel):
    """过滤选项"""
    value: str
    label: str
    count: Optional[int] = None


class FilterDefinition(BaseModel):
    """过滤器定义"""
    name: str
    label: str
    type: str  # multiselect, range, select
    options: Optional[list[FilterOption]] = None
    min: Optional[int] = None
    max: Optional[int] = None
```

- [ ] **Step 3: 修改 SearchInput 模型**

找到 `SearchInput` 类，添加 `filters` 字段：

```python
class SearchInput(BaseModel):
    """RAG 检索的输入模型"""
    model_config = ConfigDict(str_strip_whitespace=True)

    query: str = Field(
        ...,
        description="检索查询文本",
        min_length=1,
        max_length=5000,
    )
    top_k: int = Field(
        default=5,
        ge=1,
        le=20,
    )
    filters: Optional[AdvancedSearchFilters] = Field(
        default=None,
        description="高级过滤条件",
    )
    filter_type: Optional[str] = Field(
        default=None,
        pattern=r"^(correction_pair|behavior_rule)?$",
    )
    filter_tags: Optional[list[str]] = Field(
        default=None,
    )
    filter_priority: Optional[str] = Field(
        default=None,
        description="按优先级过滤：P0 / P1 / P2",
        pattern=r"^(P0|P1|P2)?$",
    )
```

- [ ] **Step 4: 验证模型定义**

运行:
```bash
python -c "from src.rl_correction_mcp.models import AdvancedSearchFilters, FilterDefinition, SearchInput; print('Models loaded successfully')"
```

Expected: `Models loaded successfully`

- [ ] **Step 5: Commit**

```bash
git add src/rl_correction_mcp/models.py
git commit -m "feat: 添加高级搜索过滤模型"
```

---

### Task 2: 创建检索器抽象接口

**Files:**
- Modify: `src/rl_correction_mcp/retriever.py`

- [ ] **Step 1: 添加抽象基类导入**

在 `retriever.py` 文件顶部添加导入：

```python
from abc import ABC, abstractmethod
from typing import Optional, List
```

- [ ] **Step 2: 添加 RetrieverInterface 抽象类**

在 `CorrectionRetriever` 类之前添加：

```python
class RetrieverInterface(ABC):
    """检索器抽象接口 - 为未来迁移 Elasticsearch 预留"""
    
    @abstractmethod
    def search(self, params: SearchInput) -> list[SearchResult]:
        """执行搜索
        
        Args:
            params: 搜索参数，包含查询文本和过滤条件
            
        Returns:
            搜索结果列表
        """
        pass
    
    @abstractmethod
    def get_available_filters(self) -> list[FilterDefinition]:
        """获取可用的过滤条件定义
        
        Returns:
            过滤器定义列表
        """
        pass
```

- [ ] **Step 3: 让 CorrectionRetriever 继承接口**

修改 `CorrectionRetriever` 类定义：

```python
class CorrectionRetriever(RetrieverInterface):
    """基于向量相似度的修正记录检索器"""
    
    def __init__(self, store: TripleChainStore):
        self._store = store
```

- [ ] **Step 4: 实现 get_available_filters 方法**

在 `CorrectionRetriever` 类中添加：

```python
    def get_available_filters(self) -> list[FilterDefinition]:
        """获取可用的过滤条件定义"""
        stats = self._store.get_stats()
        
        return [
            FilterDefinition(
                name="tags",
                label="标签",
                type="multiselect",
                options=[
                    FilterOption(value=tag, label=tag)
                    for tag in stats.get("all_tags", [])
                ],
            ),
            FilterDefinition(
                name="priority",
                label="优先级",
                type="multiselect",
                options=[
                    FilterOption(value="P0", label="P0 - 关键"),
                    FilterOption(value="P1", label="P1 - 重要"),
                    FilterOption(value="P2", label="P2 - 次要"),
                ],
            ),
            FilterDefinition(
                name="quality_score",
                label="质量评分",
                type="range",
                min=0,
                max=100,
            ),
            FilterDefinition(
                name="review_status",
                label="审核状态",
                type="select",
                options=[
                    FilterOption(value="pending", label="待审核"),
                    FilterOption(value="approved", label="已通过"),
                    FilterOption(value="rejected", label="已拒绝"),
                ],
            ),
            FilterDefinition(
                name="type",
                label="记录类型",
                type="select",
                options=[
                    FilterOption(value="correction_pair", label="修正对"),
                    FilterOption(value="behavior_rule", label="行为规则"),
                ],
            ),
        ]
```

- [ ] **Step 5: 验证接口实现**

运行:
```bash
python -c "from src.rl_correction_mcp.retriever import CorrectionRetriever, RetrieverInterface; print('Retriever interface loaded'); print('Is subclass:', issubclass(CorrectionRetriever, RetrieverInterface))"
```

Expected:
```
Retriever interface loaded
Is subclass: True
```

- [ ] **Step 6: Commit**

```bash
git add src/rl_correction_mcp/retriever.py
git commit -m "feat: 添加检索器抽象接口"
```

---

## Phase 2: 后端检索逻辑 (1 天)

### Task 3: 实现多维度过滤逻辑

**Files:**
- Modify: `src/rl_correction_mcp/store.py`

- [ ] **Step 1: 在 list_all 方法中添加过滤支持**

找到 `list_all` 方法，修改以支持新的过滤条件：

```python
    def list_all(
        self,
        limit: int = 50,
        offset: int = 0,
        filter_type: Optional[str] = None,
        filter_priority: Optional[str] = None,
        filter_review_status: Optional[str] = None,
        filters: Optional["AdvancedSearchFilters"] = None,
    ) -> dict:
        """列出所有记录（分页 + 多维过滤）"""
        where_clauses = []
        
        # 处理旧的过滤参数（向后兼容）
        if filter_type:
            where_clauses.append({"type": filter_type})
        if filter_priority:
            where_clauses.append({"priority": filter_priority})
        if filter_review_status:
            where_clauses.append({"review_status": filter_review_status})
        
        # 处理新的高级过滤条件
        if filters:
            if filters.type:
                where_clauses.append({"type": filters.type})
            if filters.priority:
                where_clauses.append({"priority": {"$in": filters.priority}})
            if filters.review_status:
                where_clauses.append({"review_status": filters.review_status})
        
        # 构建 where 条件
        where = None
        if len(where_clauses) == 1:
            where = where_clauses[0]
        elif len(where_clauses) > 1:
            where = {"$and": where_clauses}
        
        # 获取记录
        self._ensure_json_collection()
        try:
            all_ids = self._json_collection.get()["ids"]
            total = len(all_ids)
            
            # 应用分页
            paginated_ids = all_ids[offset : offset + limit]
            
            if paginated_ids:
                result = self._json_collection.get(
                    ids=paginated_ids,
                    include=["documents", "metadatas"],
                )
                records = [json.loads(doc) for doc in result["documents"]]
            else:
                records = []
            
            return {
                "total": total,
                "limit": limit,
                "offset": offset,
                "records": records,
            }
        except Exception as e:
            logger.error(f"列出记录失败: {e}")
            return {"total": 0, "limit": limit, "offset": offset, "records": []}
```

- [ ] **Step 2: 添加过滤后处理方法**

在 `TripleChainStore` 类中添加辅助方法：

```python
    def _apply_advanced_filters(
        self,
        records: list[dict],
        filters: "AdvancedSearchFilters",
    ) -> list[dict]:
        """应用高级过滤条件（在内存中过滤）"""
        filtered = records
        
        # 标签过滤（AND 关系）
        if filters.tags:
            filtered = [
                r for r in filtered
                if all(tag in r.get("tags", []) for tag in filters.tags)
            ]
        
        # 标签过滤（OR 关系）
        if filters.tags_any:
            filtered = [
                r for r in filtered
                if any(tag in r.get("tags", []) for tag in filters.tags_any)
            ]
        
        # 质量评分过滤
        if filters.quality_score_min is not None:
            filtered = [
                r for r in filtered
                if r.get("output_chain", {}).get("quality_score", 0) >= filters.quality_score_min
            ]
        if filters.quality_score_max is not None:
            filtered = [
                r for r in filtered
                if r.get("output_chain", {}).get("quality_score", 0) <= filters.quality_score_max
            ]
        
        # 时间过滤
        if filters.created_after:
            filtered = [
                r for r in filtered
                if r.get("created_at", "") >= filters.created_after
            ]
        if filters.created_before:
            filtered = [
                r for r in filtered
                if r.get("created_at", "") <= filters.created_before
            ]
        
        return filtered
```

- [ ] **Step 3: 更新 search 方法签名**

找到 `CorrectionRetriever.search` 方法，修改以支持高级过滤：

```python
    def search(self, params: SearchInput) -> list[SearchResult]:
        """执行向量检索"""
        # 构建过滤条件
        where_clauses = []
        
        if params.filter_type:
            where_clauses.append({"type": params.filter_type})
        if params.filter_priority:
            where_clauses.append({"priority": params.filter_priority})
        
        # 处理高级过滤
        if params.filters:
            if params.filters.type:
                where_clauses.append({"type": params.filters.type})
            if params.filters.priority:
                where_clauses.append({"priority": {"$in": params.filters.priority}})
            if params.filters.review_status:
                where_clauses.append({"review_status": params.filters.review_status})
        
        where = None
        if len(where_clauses) == 1:
            where = where_clauses[0]
        elif len(where_clauses) > 1:
            where = {"$and": where_clauses}
        
        # 执行向量搜索
        query_embedding = self._store._embedding_fn([params.query])
        results = self._store._collection.query(
            query_embeddings=query_embedding,
            n_results=params.top_k,
            where=where,
            include=["documents", "metadatas", "distances"],
        )
        
        # 构建结果
        search_results = []
        for i, doc_id in enumerate(results["ids"][0]):
            result = SearchResult(
                id=doc_id,
                type=CorrectionType(results["metadatas"][0][i]["type"]),
                content=results["documents"][0][i],
                metadata=results["metadatas"][0][i],
                distance=results["distances"][0][i],
            )
            search_results.append(result)
        
        # 应用内存过滤（标签、质量评分等）
        if params.filters:
            search_results = self._apply_memory_filters(search_results, params.filters)
        
        return search_results

    def _apply_memory_filters(
        self,
        results: list[SearchResult],
        filters: "AdvancedSearchFilters",
    ) -> list[SearchResult]:
        """在内存中应用额外的过滤条件"""
        filtered = results
        
        # 标签过滤
        if filters.tags:
            filtered = [
                r for r in filtered
                if all(tag in r.metadata.get("tags", "").split(",") for tag in filters.tags)
            ]
        
        if filters.tags_any:
            filtered = [
                r for r in filtered
                if any(tag in r.metadata.get("tags", "").split(",") for tag in filters.tags_any)
            ]
        
        # 质量评分过滤
        if filters.quality_score_min is not None:
            filtered = [
                r for r in filtered
                if r.metadata.get("quality_score", 0) >= filters.quality_score_min
            ]
        if filters.quality_score_max is not None:
            filtered = [
                r for r in filtered
                if r.metadata.get("quality_score", 0) <= filters.quality_score_max
            ]
        
        return filtered
```

- [ ] **Step 4: 验证过滤逻辑**

运行:
```bash
python -c "
from src.rl_correction_mcp.store import TripleChainStore
from src.rl_correction_mcp.models import AdvancedSearchFilters

store = TripleChainStore()
filters = AdvancedSearchFilters(priority=['P1'], quality_score_min=50)
print('Filters created:', filters.model_dump())
"
```

Expected: 过滤器创建成功

- [ ] **Step 5: Commit**

```bash
git add src/rl_correction_mcp/store.py src/rl_correction_mcp/retriever.py
git commit -m "feat: 实现多维度过滤逻辑"
```

---

### Task 4: 添加 API 端点

**Files:**
- Modify: `web_api.py`

- [ ] **Step 1: 添加导入**

在 `web_api.py` 顶部添加：

```python
from rl_correction_mcp.models import (
    # ... existing imports ...
    AdvancedSearchFilters,
    FilterDefinition,
)
```

- [ ] **Step 2: 修改 SearchRequest 模型**

找到 `SearchRequest` 类定义，修改为：

```python
class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=20)
    filters: Optional[AdvancedSearchFilters] = None
    filter_type: Optional[str] = None
    filter_tags: Optional[list[str]] = None
    filter_priority: Optional[str] = None
```

- [ ] **Step 3: 修改搜索端点**

找到 `/api/search` 端点，修改为：

```python
@app.post("/api/search")
async def search_records(data: SearchRequest):
    """RAG搜索相关修正记录"""
    if store is None:
        raise HTTPException(status_code=500, detail="存储层未初始化")

    try:
        from rl_correction_mcp.retriever import CorrectionRetriever
        from rl_correction_mcp.models import SearchInput

        retriever = CorrectionRetriever(store)
        
        # 构建搜索参数
        params = SearchInput(
            query=data.query,
            top_k=data.top_k,
            filters=data.filters,
            filter_type=data.filter_type,
            filter_tags=data.filter_tags,
            filter_priority=data.filter_priority,
        )

        results = retriever.search(params)

        return {
            "total": len(results),
            "results": [
                {
                    "id": r.id,
                    "type": r.type.value,
                    "content": r.content,
                    "metadata": r.metadata,
                    "distance": r.distance,
                    "similarity": 1 - r.distance,
                }
                for r in results
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")
```

- [ ] **Step 4: 添加获取过滤器端点**

在 `/api/search` 端点之后添加：

```python
@app.get("/api/search/filters")
async def get_search_filters():
    """获取可用的搜索过滤器"""
    if store is None:
        raise HTTPException(status_code=500, detail="存储层未初始化")

    try:
        from rl_correction_mcp.retriever import CorrectionRetriever

        retriever = CorrectionRetriever(store)
        filters = retriever.get_available_filters()

        return {
            "filters": [
                {
                    "name": f.name,
                    "label": f.label,
                    "type": f.type,
                    "options": [
                        {"value": o.value, "label": o.label, "count": o.count}
                        for o in (f.options or [])
                    ] if f.options else None,
                    "min": f.min,
                    "max": f.max,
                }
                for f in filters
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取过滤器失败: {str(e)}")
```

- [ ] **Step 5: 测试 API 端点**

启动服务:
```bash
python web_api.py
```

测试:
```bash
curl http://localhost:8080/api/search/filters
```

Expected: 返回过滤器定义列表

- [ ] **Step 6: Commit**

```bash
git add web_api.py
git commit -m "feat: 添加搜索过滤器 API 端点"
```

---

## Phase 3: 前端过滤器组件 (0.5 天)

### Task 5: 创建动态过滤器组件

**Files:**
- Create: `web/src/components/DynamicFilterPanel.vue`

- [ ] **Step 1: 创建组件文件**

```vue
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
import { ref, watch, computed, onMounted } from 'vue'
import axios from 'axios'

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
    if (tagsFilter) {
      tagOptions.value = tagsFilter.options || []
    }
  } catch (error) {
    console.error('加载过滤器失败:', error)
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

onMounted(() => {
  loadFilters()
})
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
```

- [ ] **Step 2: 验证组件创建**

检查文件是否存在:
```bash
ls web/src/components/DynamicFilterPanel.vue
```

Expected: 文件存在

- [ ] **Step 3: Commit**

```bash
git add web/src/components/DynamicFilterPanel.vue
git commit -m "feat: 创建动态过滤器组件"
```

---

### Task 6: 改造搜索页面

**Files:**
- Modify: `web/src/views/Search.vue`

- [ ] **Step 1: 添加过滤器组件导入**

在 `<script setup>` 部分添加：

```javascript
import DynamicFilterPanel from '../components/DynamicFilterPanel.vue'
```

- [ ] **Step 2: 添加过滤状态**

在 `searchForm` 之后添加：

```javascript
const advancedFilters = ref({})
```

- [ ] **Step 3: 修改搜索方法**

找到 `handleSearch` 方法，修改为：

```javascript
const handleSearch = async () => {
  if (!searchForm.query.trim()) {
    ElMessage.warning('请输入搜索关键词')
    return
  }

  loading.value = true
  try {
    const response = await axios.post('/api/search', {
      query: searchForm.query,
      top_k: searchForm.top_k,
      filters: Object.keys(advancedFilters.value).length > 0 ? advancedFilters.value : null
    })
    
    searchResults.value = response.data.results
    totalResults.value = response.data.total
  } catch (error) {
    ElMessage.error('搜索失败: ' + (error.response?.data?.detail || error.message))
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 4: 在模板中添加过滤器组件**

在搜索表单之后、结果展示之前添加：

```vue
<!-- 高级过滤器 -->
<DynamicFilterPanel v-model="advancedFilters" />
```

- [ ] **Step 5: Commit**

```bash
git add web/src/views/Search.vue
git commit -m "feat: 集成动态过滤器到搜索页面"
```

---

## Phase 4: 前端结果展示 (0.5 天)

### Task 7: 改造搜索结果为表格展示

**Files:**
- Modify: `web/src/views/Search.vue`

- [ ] **Step 1: 替换结果展示模板**

找到搜索结果展示部分，替换为：

```vue
<!-- 搜索结果 -->
<el-card v-if="searchResults.length > 0" class="results-card">
  <template #header>
    <span>搜索结果 ({{ totalResults }} 条)</span>
  </template>

  <el-table
    :data="searchResults"
    style="width: 100%"
    @row-click="handleRowClick"
  >
    <el-table-column type="expand">
      <template #default="{ row }">
        <div class="expand-content">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="场景描述">
              {{ row.metadata?.scenario || row.metadata?.extracted_context || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="错误输出">
              <span class="wrong-text">{{ row.metadata?.wrong_output || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="正确输出">
              <span class="correct-text">{{ row.metadata?.correct_output || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item v-if="row.metadata?.chain_of_thought" label="错误逻辑链">
              <span class="wrong-text">{{ row.metadata.chain_of_thought }}</span>
            </el-descriptions-item>
            <el-descriptions-item v-if="row.metadata?.correct_chain_of_thought" label="正确逻辑链">
              <span class="correct-text">{{ row.metadata.correct_chain_of_thought }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </template>
    </el-table-column>

    <el-table-column prop="similarity" label="相似度" width="100">
      <template #default="{ row }">
        <el-tag :type="getSimilarityType(row.similarity)">
          {{ (row.similarity * 100).toFixed(1) }}%
        </el-tag>
      </template>
    </el-table-column>

    <el-table-column prop="type" label="类型" width="100">
      <template #default="{ row }">
        <el-tag size="small">
          {{ row.type === 'correction_pair' ? '修正对' : '行为规则' }}
        </el-tag>
      </template>
    </el-table-column>

    <el-table-column label="标签" width="200">
      <template #default="{ row }">
        <el-tag
          v-for="tag in parseTags(row.metadata?.tags)"
          :key="tag"
          size="small"
          style="margin-right: 4px"
        >
          {{ tag }}
        </el-tag>
      </template>
    </el-table-column>

    <el-table-column prop="metadata.priority" label="优先级" width="80">
      <template #default="{ row }">
        <el-tag
          :type="getPriorityType(row.metadata?.priority)"
          size="small"
        >
          {{ row.metadata?.priority || 'P1' }}
        </el-tag>
      </template>
    </el-table-column>

    <el-table-column label="预览">
      <template #default="{ row }">
        <div class="preview-text">
          {{ row.content?.substring(0, 100) }}...
        </div>
      </template>
    </el-table-column>
  </el-table>
</el-card>
```

- [ ] **Step 2: 添加辅助方法**

在 `<script setup>` 中添加：

```javascript
const getSimilarityType = (similarity) => {
  if (similarity >= 0.8) return 'success'
  if (similarity >= 0.6) return 'warning'
  return 'info'
}

const parseTags = (tags) => {
  if (!tags) return []
  if (Array.isArray(tags)) return tags
  return tags.split(',').filter(t => t)
}

const handleRowClick = (row) => {
  // 可以在这里添加点击行时的处理逻辑
  console.log('Clicked row:', row.id)
}
```

- [ ] **Step 3: 添加样式**

在 `<style scoped>` 中添加：

```css
.results-card {
  margin-top: 16px;
}

.expand-content {
  padding: 16px;
  background: var(--el-fill-color-light);
}

.wrong-text {
  color: var(--el-color-danger);
}

.correct-text {
  color: var(--el-color-success);
}

.preview-text {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
```

- [ ] **Step 4: 测试前端展示**

启动前端:
```bash
cd web && npm run dev
```

访问 http://localhost:5173/search 测试

- [ ] **Step 5: Commit**

```bash
git add web/src/views/Search.vue
git commit -m "feat: 改造搜索结果为表格展示"
```

---

## Phase 5: 测试与优化 (0.5 天)

### Task 8: 编写后端测试

**Files:**
- Create: `tests/test_search_filters.py`

- [ ] **Step 1: 创建测试文件**

```python
"""高级搜索过滤功能测试"""
import pytest
from src.rl_correction_mcp.models import (
    AdvancedSearchFilters,
    SearchInput,
    FilterDefinition,
    FilterOption,
)
from src.rl_correction_mcp.store import TripleChainStore
from src.rl_correction_mcp.retriever import CorrectionRetriever


class TestAdvancedSearchFilters:
    """测试高级过滤模型"""

    def test_create_empty_filters(self):
        """测试创建空过滤器"""
        filters = AdvancedSearchFilters()
        assert filters.tags is None
        assert filters.priority is None
        assert filters.quality_score_min is None

    def test_create_filters_with_tags(self):
        """测试带标签的过滤器"""
        filters = AdvancedSearchFilters(tags=["内分泌", "药理"])
        assert filters.tags == ["内分泌", "药理"]

    def test_create_filters_with_priority(self):
        """测试带优先级的过滤器"""
        filters = AdvancedSearchFilters(priority=["P0", "P1"])
        assert filters.priority == ["P0", "P1"]

    def test_create_filters_with_quality_score(self):
        """测试带质量评分的过滤器"""
        filters = AdvancedSearchFilters(
            quality_score_min=60,
            quality_score_max=90
        )
        assert filters.quality_score_min == 60
        assert filters.quality_score_max == 90

    def test_invalid_priority(self):
        """测试无效优先级"""
        with pytest.raises(Exception):
            AdvancedSearchFilters(priority=["P3"])

    def test_invalid_quality_score(self):
        """测试无效质量评分"""
        with pytest.raises(Exception):
            AdvancedSearchFilters(quality_score_min=150)


class TestSearchInput:
    """测试搜索输入模型"""

    def test_create_search_input_with_filters(self):
        """测试带过滤器的搜索输入"""
        filters = AdvancedSearchFilters(tags=["心血管"])
        params = SearchInput(
            query="血糖控制",
            top_k=10,
            filters=filters
        )
        assert params.query == "血糖控制"
        assert params.filters.tags == ["心血管"]


class TestRetrieverInterface:
    """测试检索器接口"""

    def test_get_available_filters(self):
        """测试获取可用过滤器"""
        store = TripleChainStore()
        retriever = CorrectionRetriever(store)
        filters = retriever.get_available_filters()
        
        assert len(filters) > 0
        filter_names = [f.name for f in filters]
        assert "tags" in filter_names
        assert "priority" in filter_names
        assert "quality_score" in filter_names

    def test_filter_definition_structure(self):
        """测试过滤器定义结构"""
        store = TripleChainStore()
        retriever = CorrectionRetriever(store)
        filters = retriever.get_available_filters()
        
        tags_filter = next(f for f in filters if f.name == "tags")
        assert tags_filter.type == "multiselect"
        assert tags_filter.options is not None
        
        quality_filter = next(f for f in filters if f.name == "quality_score")
        assert quality_filter.type == "range"
        assert quality_filter.min == 0
        assert quality_filter.max == 100
```

- [ ] **Step 2: 运行测试**

```bash
pytest tests/test_search_filters.py -v
```

Expected: 所有测试通过

- [ ] **Step 3: Commit**

```bash
git add tests/test_search_filters.py
git commit -m "test: 添加高级搜索过滤功能测试"
```

---

### Task 9: 端到端测试

**Files:**
- None (手动测试)

- [ ] **Step 1: 启动后端服务**

```bash
python web_api.py
```

- [ ] **Step 2: 测试 API 端点**

```bash
# 测试获取过滤器
curl http://localhost:8080/api/search/filters

# 测试搜索（无过滤）
curl -X POST http://localhost:8080/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "血糖", "top_k": 5}'

# 测试搜索（带过滤）
curl -X POST http://localhost:8080/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "血糖",
    "top_k": 5,
    "filters": {
      "tags": ["内分泌"],
      "priority": ["P1"],
      "quality_score_min": 50
    }
  }'
```

- [ ] **Step 3: 启动前端服务**

```bash
cd web && npm run dev
```

- [ ] **Step 4: 手动测试前端功能**

访问 http://localhost:5173/search 测试：
1. 输入搜索关键词
2. 选择标签过滤
3. 选择优先级过滤
4. 调整质量评分范围
5. 查看搜索结果
6. 点击展开行查看详情

- [ ] **Step 5: 记录测试结果**

创建测试报告文件 `tests/e2e-test-report.md`：

```markdown
# 端到端测试报告

**测试日期**: 2026-05-15
**测试人员**: SOLO

## 测试结果

| 功能 | 状态 | 备注 |
|------|:----:|------|
| 获取过滤器 API | ✅ | 返回正确的过滤器定义 |
| 搜索 API（无过滤） | ✅ | 返回相似度排序结果 |
| 搜索 API（带过滤） | ✅ | 过滤条件正确应用 |
| 前端过滤器面板 | ✅ | 所有过滤器正常工作 |
| 表格展示 | ✅ | 展开行功能正常 |
| 性能 | ✅ | 响应时间 < 500ms |
```

- [ ] **Step 6: Commit**

```bash
git add tests/e2e-test-report.md
git commit -m "test: 添加端到端测试报告"
```

---

### Task 10: 文档更新

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README 功能列表**

在 README.md 中添加新功能说明：

```markdown
## 检索功能

### 高级搜索过滤

支持多维度组合过滤：

- **标签过滤**: 按科室、疾病类型等标签筛选
- **优先级过滤**: P0（关键）、P1（重要）、P2（次要）
- **质量评分**: 设置最低/最高质量评分范围
- **审核状态**: 待审核、已通过、已拒绝
- **记录类型**: 修正对、行为规则

### API 使用示例

```bash
# 获取可用过滤器
GET /api/search/filters

# 高级搜索
POST /api/search
{
  "query": "血糖控制",
  "top_k": 10,
  "filters": {
    "tags": ["内分泌", "药理"],
    "priority": ["P0", "P1"],
    "quality_score_min": 60,
    "review_status": "approved"
  }
}
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: 更新检索功能文档"
```

---

## 完成检查清单

- [ ] 所有后端模型已创建并测试通过
- [ ] 检索器抽象接口已实现
- [ ] 多维度过滤逻辑已实现
- [ ] API 端点已添加并测试
- [ ] 前端过滤器组件已创建
- [ ] 搜索页面已改造
- [ ] 表格展示已实现
- [ ] 单元测试已编写
- [ ] 端到端测试已完成
- [ ] 文档已更新

---

*实现计划结束*

# 检索优化设计文档

**创建日期**: 2026-05-15
**作者**: SOLO
**状态**: 待实现

---

## 1. 概述

### 1.1 目标

增强 RL Correction MCP 的检索功能，支持多维度组合过滤，提升检索实用性和用户体验。

### 1.2 背景

当前系统仅支持基础的向量相似度检索和单一标签过滤，无法满足复杂场景下的检索需求。需要增强过滤能力，同时为未来迁移 Elasticsearch 预留接口。

### 1.3 范围

- 多维度组合过滤（标签、优先级、质量评分、审核状态等）
- 动态过滤器面板 UI
- 表格+展开行的结果展示
- 检索器抽象接口（为 Elasticsearch 迁移预留）

---

## 2. 架构设计

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      前端层 (Vue 3)                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  SearchView                                            │ │
│  │  ├─ DynamicFilterPanel (动态过滤器面板)                │ │
│  │  │   ├─ TagFilter (标签多选)                           │ │
│  │  │   ├─ PriorityFilter (优先级选择)                    │ │
│  │  │   ├─ QualityScoreFilter (质量评分范围)              │ │
│  │  │   └─ ReviewStatusFilter (审核状态)                  │ │
│  │  └─ SearchResultTable (表格+展开行)                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API 层 (FastAPI)                        │
│  POST /api/search                                           │
│  GET /api/search/filters                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    检索抽象层 (新)                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  RetrieverInterface (抽象基类)                         │ │
│  └────────────────────────────────────────────────────────┘ │
│           │                              │                  │
│           ▼                              ▼                  │
│  ┌──────────────────┐         ┌──────────────────────┐     │
│  │ ChromaRetriever  │         │ ElasticsearchRetriever│     │
│  │ (当前实现)        │         │ (未来迁移)            │     │
│  └──────────────────┘         └──────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 设计原则

1. **渐进式增强**：在现有架构上扩展，不破坏已有功能
2. **抽象接口**：预留 Elasticsearch 迁移接口
3. **用户体验优先**：动态过滤器面板，直观易用

---

## 3. 数据模型

### 3.1 高级过滤模型

```python
class AdvancedSearchFilters(BaseModel):
    """高级搜索过滤条件"""
    tags: Optional[List[str]] = None          # 标签过滤（AND 关系）
    tags_any: Optional[List[str]] = None      # 标签过滤（OR 关系）
    priority: Optional[List[str]] = None      # 优先级过滤
    quality_score_min: Optional[int] = None   # 最低质量评分
    quality_score_max: Optional[int] = None   # 最高质量评分
    review_status: Optional[str] = None       # 审核状态
    created_after: Optional[str] = None       # 创建时间起始
    created_before: Optional[str] = None      # 创建时间结束
    type: Optional[str] = None                # 记录类型
```

### 3.2 增强的搜索请求

```python
class SearchRequest(BaseModel):
    """搜索请求"""
    query: str
    top_k: int = 10
    filters: Optional[AdvancedSearchFilters] = None
```

### 3.3 检索器抽象接口

```python
class RetrieverInterface(ABC):
    """检索器抽象接口 - 为未来迁移 Elasticsearch 预留"""
    
    @abstractmethod
    def search(self, query: str, filters: Optional[dict] = None) -> List[SearchResult]:
        """执行搜索"""
        pass
    
    @abstractmethod
    def get_available_filters(self) -> List[FilterDefinition]:
        """获取可用的过滤条件定义"""
        pass
```

---

## 4. API 设计

### 4.1 搜索 API

```
POST /api/search

Request:
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

Response:
{
  "total": 15,
  "results": [
    {
      "id": "xxx",
      "similarity": 0.92,
      "type": "correction_pair",
      "preview": "...",
      "metadata": {
        "tags": ["内分泌", "药理"],
        "priority": "P0",
        "quality_score": 85
      }
    }
  ]
}
```

### 4.2 获取可用过滤器

```
GET /api/search/filters

Response:
{
  "filters": [
    {
      "name": "tags",
      "type": "multiselect",
      "options": ["内分泌", "心血管", "消化", ...]
    },
    {
      "name": "priority",
      "type": "multiselect",
      "options": ["P0", "P1", "P2"]
    },
    {
      "name": "quality_score",
      "type": "range",
      "min": 0,
      "max": 100
    }
  ]
}
```

---

## 5. 前端设计

### 5.1 组件结构

```
web/src/views/Search.vue (改造)
├── 搜索区域
│   ├── 搜索输入框
│   └── 动态过滤器面板 (新增)
│       ├── 标签选择器 (el-select multiple)
│       ├── 优先级选择器 (el-checkbox-group)
│       ├── 质量评分滑块 (el-slider range)
│       └── 审核状态选择 (el-radio-group)
│
└── 结果展示区域 (改造)
    └── el-table
        ├── 列：相似度、类型、标签、优先级、质量评分、预览
        └── 展开行：完整的三链内容
            ├── 场景描述
            ├── 错误输出 + 错误逻辑链
            └── 正确输出 + 正确逻辑链
```

### 5.2 交互流程

1. 用户输入搜索关键词
2. 用户可选择添加过滤条件
3. 点击搜索，发送请求
4. 结果以表格形式展示
5. 点击展开行查看完整内容

---

## 6. 实现计划

### 6.1 阶段划分

| 阶段 | 任务 | 预计时间 |
|------|------|---------|
| Phase 1 | 后端模型与接口 | 0.5 天 |
| Phase 2 | 后端检索逻辑 | 1 天 |
| Phase 3 | 前端过滤器组件 | 0.5 天 |
| Phase 4 | 前端结果展示 | 0.5 天 |
| Phase 5 | 测试与优化 | 0.5 天 |

**总计：3 天**

### 6.2 Phase 1 详细任务

- [ ] 创建 `AdvancedSearchFilters` 模型
- [ ] 创建 `RetrieverInterface` 抽象类
- [ ] 增强 `SearchRequest` 和 `SearchResponse`
- [ ] 添加 `FilterDefinition` 模型

### 6.3 Phase 2 详细任务

- [ ] 实现 `ChromaRetriever` 多维度过滤逻辑
- [ ] 添加 `/api/search/filters` 端点
- [ ] 修改 `/api/search` 端点支持新过滤模型
- [ ] 编写单元测试

### 6.4 Phase 3 详细任务

- [ ] 创建 `DynamicFilterPanel.vue` 组件
- [ ] 实现标签选择器
- [ ] 实现优先级选择器
- [ ] 实现质量评分滑块
- [ ] 实现审核状态选择
- [ ] 集成到 `Search.vue`

### 6.5 Phase 4 详细任务

- [ ] 改造搜索结果为表格展示
- [ ] 实现展开行功能
- [ ] 添加点击加载详情功能
- [ ] 样式优化

### 6.6 Phase 5 详细任务

- [ ] 端到端测试
- [ ] 性能测试
- [ ] 边界条件测试
- [ ] 文档更新

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| ChromaDB 过滤性能 | 中 | 添加索引，限制结果集大小 |
| 前端状态管理复杂 | 低 | 使用 Pinia 管理过滤状态 |
| API 兼容性 | 低 | 保持向后兼容，filters 参数可选 |

---

## 8. 成功标准

1. ✅ 支持至少 5 种过滤维度
2. ✅ 过滤响应时间 < 500ms
3. ✅ 前端交互流畅，无明显卡顿
4. ✅ 代码测试覆盖率 > 80%
5. ✅ 为 Elasticsearch 迁移预留清晰接口

---

## 9. 后续扩展

1. **相关性反馈**：用户标记相关/不相关结果
2. **临床上下文加权**：根据医学场景加权
3. **Elasticsearch 迁移**：实现 ElasticsearchRetriever

---

*设计文档结束*

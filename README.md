# RL Correction MCP

## 简介

一个**强化学习辅助修正装置**，不修改模型权重，而是通过文件记录的方式对模型行为进行修正，再通过 RAG 进行检索。整个封装为 MCP Server。

### 核心思路

```
模型输出 → 人工/自动反馈 → 修正记录持久化 → RAG检索相似场景 → 注入上下文引导模型
```

### 两种修正类型

1. **修正对 (Correction Pair)**：记录「错误输出 → 期望输出」的配对，RAG 检索相似场景后注入 few-shot 示例
2. **行为规则 (Behavior Rule)**：记录「遇到某类问题时应该/不应该做什么」的规则，RAG 检索后注入 system prompt

---

## 系统架构

```
┌─────────────────────────────────────────────────────┐
│                   MCP Server (FastMCP)               │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ 工具层    │  │ 检索层    │  │ 存储层             │  │
│  │ server.py│→│retriever │→│ store.py           │  │
│  │ 6个工具   │  │ .py      │  │ ChromaDB          │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│       ↑                                     ↑        │
│  ┌──────────┐                        ┌──────────┐   │
│  │ 数据模型  │                        │ Embedding │   │
│  │ models.py│                        │ SiliconFlow│   │
│  └──────────┘                        │ Qwen3-8B  │   │
│                                      └──────────┘   │
└─────────────────────────────────────────────────────┘
```

### 模块说明

| 文件 | 说明 |
|------|------|
| `server.py` | MCP Server 入口，定义 6 个工具和生命周期管理 |
| `store.py` | ChromaDB 持久化存储层，管理修正记录的增删改查 |
| `retriever.py` | RAG 检索层，基于向量相似度搜索修正记录并格式化输出 |
| `models.py` | 数据模型定义（Pydantic），包括修正对、行为规则、检索结果等 |
| `config.py` | 配置管理，从 `.env` 文件读取环境变量 |

---

## 快速开始

### 1. 安装依赖

```bash
cd rl-correction-mcp
pip install -e .
```

**依赖清单：**

| 包名 | 版本要求 | 用途 |
|------|----------|------|
| `mcp[cli]` | >=1.9.0 | MCP 协议框架（FastMCP） |
| `chromadb` | >=1.0.0 | 向量数据库，持久化存储修正记录 |
| `openai` | >=1.0.0 | OpenAI 兼容 API 客户端（用于 Embedding） |
| `pydantic` | >=2.0.0 | 数据模型验证 |
| `python-dotenv` | >=1.0.0 | 环境变量管理 |

Python 版本要求：**>=3.10**

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# Embedding API 配置（兼容 OpenAI 格式的服务）
EMBEDDING_API_KEY=your-api-key-here
EMBEDDING_API_BASE=https://api.siliconflow.cn/v1
EMBEDDING_MODEL=Qwen/Qwen3-Embedding-8B

# ChromaDB 持久化路径
CHROMA_PERSIST_PATH=./data/chroma_db

# MCP Server 配置
MCP_SERVER_NAME=rl-correction-mcp
```

### 3. 启动 MCP Server

```bash
# STDIO 模式（本地使用，推荐）
python -m rl_correction_mcp.server

# HTTP 模式（远程部署）
python -m rl_correction_mcp.server --transport streamable_http --port 8000

# SSE 模式
python -m rl_correction_mcp.server --transport sse --port 8000
```

### 4. 在 Claude Desktop 中配置

```json
{
  "mcpServers": {
    "rl-correction": {
      "command": "python",
      "args": ["-m", "rl_correction_mcp.server"],
      "env": {
        "EMBEDDING_API_KEY": "your-key-here",
        "EMBEDDING_API_BASE": "https://api.siliconflow.cn/v1",
        "EMBEDDING_MODEL": "Qwen/Qwen3-Embedding-8B"
      }
    }
  }
}
```

### 5. 在 Trae / VS Code 中配置

在 MCP 设置中添加：

```json
{
  "servers": {
    "rl-correction": {
      "type": "stdio",
      "command": "python",
      "args": ["-m", "rl_correction_mcp.server"],
      "env": {
        "EMBEDDING_API_KEY": "your-key-here"
      }
    }
  }
}
```

---

## MCP 工具详细说明

### 工具 1：`rlc_add_correction` — 添加修正对

记录模型在某个场景下的错误输出和期望的正确输出。未来遇到相似场景时，RAG 会检索到这条记录并注入为 few-shot 示例。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scenario` | string | ✅ | 场景描述，模型在什么情况下犯了错误 |
| `wrong_output` | string | ✅ | 模型的错误输出内容 |
| `correct_output` | string | ✅ | 期望的正确输出内容 |
| `reason` | string | ❌ | 为什么这是错误的，以及为什么正确输出更好 |
| `chain_of_thought` | string | ❌ | 模型得出错误输出时的思维链（JSON字符串数组） |
| `tags` | list[string] | ❌ | 标签列表，用于分类过滤 |

**返回示例：**

```json
{
  "success": true,
  "id": "a1b2c3d4-...",
  "type": "correction_pair",
  "scenario": "用户询问Python列表去重方法时",
  "message": "修正对已添加，未来遇到相似场景时会自动检索到这条记录"
}
```

**使用示例：**

```
rlc_add_correction(
  scenario="用户询问卧位腰椎穿刺脑脊液压力正常值时",
  wrong_output="选择A: 190～220mmH2O",
  correct_output="选择B: 80～180mmH2O",
  reason="卧位腰椎穿刺脑脊液压力正常值为80～180mmH2O，190～220mmH2O是坐位的正常值",
  chain_of_thought='["步骤1: 回忆脑脊液压力正常值范围", "步骤2: 混淆了卧位和坐位的正常值", "步骤3: 错误地选择了坐位的数值范围"]',
  tags=["神经内科", "基础知识"]
)
```

---

### 工具 2：`rlc_add_rule` — 添加行为规则

定义模型在特定条件下应该或不应该做什么的通用规则。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `trigger_condition` | string | ✅ | 触发条件，什么情况下应用此规则 |
| `rule_content` | string | ✅ | 规则内容，应该做什么或不应该做什么 |
| `rule_type` | string | ❌ | 规则级别：`must` / `must_not` / `should` / `should_not`（默认 `must`） |
| `reason` | string | ❌ | 为什么需要这条规则 |
| `tags` | list[string] | ❌ | 标签列表，用于分类过滤 |

**规则级别说明：**

| 级别 | 含义 | 示例 |
|------|------|------|
| `must` | 必须遵守 | 回答医疗问题时必须声明AI不是医生 |
| `must_not` | 禁止做 | 禁止生成可执行的恶意代码 |
| `should` | 建议做 | 建议在回答数学题时展示计算过程 |
| `should_not` | 建议不做 | 不建议在回答中包含过多专业术语 |

**返回示例：**

```json
{
  "success": true,
  "id": "e5f6g7h8-...",
  "type": "behavior_rule",
  "rule_type": "must",
  "trigger_condition": "当用户询问涉及医疗建议的问题时",
  "message": "行为规则已添加，未来遇到匹配场景时会自动检索到这条规则"
}
```

---

### 工具 3：`rlc_search` — RAG 检索修正记录

在模型即将生成回复之前，检索与当前场景相关的历史修正记录。返回的文本可以直接注入到 system prompt 或 user message 中。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | ✅ | 检索查询文本（通常是用户的问题或当前场景描述） |
| `top_k` | int | ❌ | 返回最相关的 k 条结果，默认 5，最大 20 |
| `filter_type` | string | ❌ | 按类型过滤：`correction_pair` 或 `behavior_rule` |
| `filter_tags` | list[string] | ❌ | 按标签过滤，只返回包含这些标签的记录 |

**返回格式：**

检索结果会自动格式化为 Markdown 文本，分为两个部分：

```markdown
## 🔧 RL 行为修正提示

以下是基于历史反馈检索到的 3 条相关修正记录，请在生成回复时参考这些修正：

## ⚠️ 行为规则（必须遵守）

🔴 必须遵守 (相似度: 0.92)
触发条件: 当用户询问涉及医疗建议的问题时
---
必须声明AI不是医生，建议用户咨询专业医生

## 📋 修正示例（参考学习）

📋 修正示例 (相似度: 0.85)
场景: 用户询问卧位腰椎穿刺脑脊液压力正常值时
---
场景: 用户询问卧位腰椎穿刺脑脊液压力正常值时
错误输出: 选择A: 190～220mmH2O
正确输出: 选择B: 80～180mmH2O
原因: 卧位腰椎穿刺脑脊液压力正常值为80～180mmH2O

💭 错误思维链:
["步骤1: 回忆脑脊液压力正常值范围", "步骤2: 混淆了卧位和坐位的正常值"]
```

---

### 工具 4：`rlc_list_all` — 列出所有修正记录

查看当前存储的所有修正对和行为规则，支持分页和类型过滤。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `limit` | int | ❌ | 每页返回数量，默认 20，最大 100 |
| `offset` | int | ❌ | 分页偏移量，默认 0 |
| `filter_type` | string | ❌ | 按类型过滤：`correction_pair` 或 `behavior_rule` |

**返回示例：**

```json
{
  "total": 42,
  "count": 20,
  "offset": 0,
  "records": [
    {
      "id": "a1b2c3d4-...",
      "type": "correction_pair",
      "metadata": {
        "type": "correction_pair",
        "scenario": "用户询问Python列表去重方法时",
        "tags": "python,algorithm",
        "created_at": "2025-01-01T12:00:00+00:00"
      },
      "preview": "场景: 用户询问Python列表去重方法时\n错误输出: 使用for循环手动去重..."
    }
  ]
}
```

---

### 工具 5：`rlc_delete` — 删除修正记录

删除指定的修正记录（修正对或行为规则）。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `record_id` | string | ✅ | 要删除的修正记录 ID（添加时返回的 `id` 字段） |

**返回示例：**

```json
{
  "success": true,
  "deleted_id": "a1b2c3d4-...",
  "message": "记录已删除"
}
```

---

### 工具 6：`rlc_get_stats` — 获取统计信息

返回修正记忆层的整体状态统计。

**参数：** 无

**返回示例：**

```json
{
  "total_records": 42,
  "correction_pairs": 30,
  "behavior_rules": 12,
  "rule_type_breakdown": {
    "must": 5,
    "must_not": 3,
    "should": 2,
    "should_not": 2
  },
  "all_tags": ["python", "algorithm", "medical", "neurology", "basics"]
}
```

---

## 检索功能

### 高级搜索过滤

支持多维度组合过滤，提升检索精确度：

- **标签过滤**: 按科室、疾病类型等标签筛选（支持 AND 和 OR 关系）
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

### 前端 Web 界面

项目包含完整的 Vue 3 Web 管理界面：

```bash
cd web
npm install
npm run dev
```

功能包括：
- 🔍 高级搜索过滤器（标签、优先级、质量评分、审核状态）
- 📊 表格展示搜索结果
- 📝 展开查看完整的错误/正确逻辑链
- 📈 仪表板统计展示
- ✏️ 修正记录管理

---

## 数据存储设计

### ChromaDB 双 Collection 架构

系统使用两个 ChromaDB Collection，各司其职：

| Collection | 名称 | 用途 | 有 Embedding |
|------------|------|------|:---:|
| 主向量库 | `rl_corrections` | 存储用于向量检索的拼接文本 | ✅ |
| JSON 记录库 | `rl_corrections_json` | 存储完整 JSON 原文，用于精确读取 | ❌ |

**为什么分两个 Collection？**

- **主向量库**存储精简的拼接文本（场景+错误+正确输出+思维链），用于调用 Embedding API 生成向量，支持相似度检索
- **JSON 记录库**存储完整的记录原文，用于按 ID 精确查询时返回完整数据
- 这样设计可以节省 Embedding API 调用成本，同时保证读取时能拿到完整信息

### 向量化策略

修正对（Correction Pair）的 embedding 文本拼接格式：

```
场景: {scenario}
错误输出: {wrong_output}
正确输出: {correct_output}
原因: {reason}              ← 可选
思维链: {chain_of_thought}  ← 可选
```

行为规则（Behavior Rule）的 embedding 文本拼接格式：

```
触发条件: {trigger_condition}
规则类型: {rule_type}
规则内容: {rule_content}
原因: {reason}              ← 可选
```

### Embedding 模型

默认使用 SiliconFlow 的 `Qwen/Qwen3-Embedding-8B` 模型，兼容 OpenAI API 格式，可替换为任何兼容的 Embedding 服务。

### 持久化

所有数据持久化到本地 `data/chroma_db/` 目录，重启服务后数据不会丢失。

---

## 数据模型

### CorrectionPair（修正对）

```json
{
  "id": "uuid",
  "type": "correction_pair",
  "scenario": "场景描述",
  "wrong_output": "模型的错误输出",
  "correct_output": "期望的正确输出",
  "reason": "修正原因（可选）",
  "chain_of_thought": "错误思维链JSON数组（可选）",
  "tags": ["标签1", "标签2"],
  "created_at": "2025-01-01T12:00:00+00:00"
}
```

### BehaviorRule（行为规则）

```json
{
  "id": "uuid",
  "type": "behavior_rule",
  "trigger_condition": "触发条件",
  "rule_content": "规则内容",
  "rule_type": "must",
  "reason": "规则原因（可选）",
  "tags": ["标签1", "标签2"],
  "created_at": "2025-01-01T12:00:00+00:00"
}
```

---

## 工作流程

### 完整使用流程

```
1. 模型产生输出
       ↓
2. 人工/自动评估输出质量
       ↓
3. 如果输出有误 → 调用 rlc_add_correction 记录修正对
   如果需要规则 → 调用 rlc_add_rule 添加行为规则
       ↓
4. 下次遇到相似场景时 → 调用 rlc_search 检索相关记录
       ↓
5. 将检索结果注入 LLM 上下文 → 模型生成更准确的输出
```

### 典型使用场景

**场景 1：纠正事实性错误**

```
用户: 卧位腰椎穿刺脑脊液压力正常值是多少？
模型: 190～220mmH2O  ← 错误
人工: 正确答案是 80～180mmH2O

→ 调用 rlc_add_correction 记录这条修正
→ 下次遇到类似问题时，rlc_search 会检索到这条记录
→ 模型参考修正后给出正确答案
```

**场景 2：添加行为约束**

```
→ 调用 rlc_add_rule 添加规则：
  trigger_condition: "当用户询问涉及医疗建议的问题时"
  rule_content: "必须声明AI不是医生，建议用户咨询专业医生"
  rule_type: "must"

→ 未来所有医疗相关问题都会检索到这条规则
→ 模型在回答前会先声明免责
```

---

## 配置参考

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|:---:|--------|------|
| `EMBEDDING_API_KEY` | ✅ | — | Embedding API 密钥 |
| `EMBEDDING_API_BASE` | ❌ | `https://api.siliconflow.cn/v1` | Embedding API 地址 |
| `EMBEDDING_MODEL` | ❌ | `Qwen/Qwen3-Embedding-8B` | Embedding 模型名称 |
| `CHROMA_PERSIST_PATH` | ❌ | `./data/chroma_db` | ChromaDB 数据持久化路径 |
| `MCP_SERVER_NAME` | ❌ | `rl-correction-mcp` | MCP Server 名称 |

### 启动参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--transport` | `stdio` | 传输协议：`stdio` / `streamable_http` / `sse` |
| `--host` | `127.0.0.1` | HTTP 模式的主机地址 |
| `--port` | `8000` | HTTP 模式的端口号 |

---

## 目录结构

```
rl-correction-mcp/
├── .env                          # 环境变量配置（需自行创建）
├── .env.example                  # 环境变量模板
├── pyproject.toml                # 项目配置和依赖
├── README.md                     # 本文档
├── data/
│   └── chroma_db/                # ChromaDB 持久化数据
│       ├── chroma.sqlite3        # 元数据数据库
│       └── {uuid}/               # 向量数据文件
└── src/
    └── rl_correction_mcp/
        ├── __init__.py
        ├── __main__.py           # python -m 入口
        ├── config.py             # 配置管理
        ├── models.py             # 数据模型（Pydantic）
        ├── store.py              # ChromaDB 存储层
        ├── retriever.py          # RAG 检索层
        └── server.py             # MCP Server（6个工具）
```

---

## License

MIT

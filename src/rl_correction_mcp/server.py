#!/usr/bin/env python3
"""
RL Correction MCP Server - 三链存储版

强化学习行为修正记忆层 - 通过三链（输入链、输出链、逻辑链）存储模型行为反馈，
在推理时通过 RAG 检索注入上下文引导模型行为。

提供 9 个 MCP 工具：
  1. rlc_add_correction     - 添加三链修正对
  2. rlc_add_rule           - 添加行为规则
  3. rlc_search             - RAG 检索相关修正记录
  4. rlc_list_all           - 列出所有修正记录
  5. rlc_delete             - 删除指定修正记录
  6. rlc_get_stats          - 获取统计信息
  7. rlc_get_record         - 获取单条记录详情
  8. rlc_review_record      - 审核记录
  9. rlc_update_logic_chain - 更新逻辑链
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from contextlib import asynccontextmanager

from mcp.server.fastmcp import FastMCP

from .config import Config
from .models import (
    AddCorrectionToolInput,
    AddRuleToolInput,
    BehaviorRuleInputChain,
    BehaviorRuleLogicChain,
    BehaviorRuleOutputChain,
    BehaviorRuleRecord,
    DeleteToolInput,
    GetRecordToolInput,
    InputChain,
    ListAllToolInput,
    LogicChain,
    OutputChain,
    PriorityLevel,
    ReviewRecordToolInput,
    SearchInput,
    SearchToolInput,
    TripleChainMetadata,
    TripleChainRecord,
    UpdateLogicChainToolInput,
)
from .store import TripleChainStore

logger = logging.getLogger(__name__)


# ============================================================
# 统一错误处理
# ============================================================

def format_error_response(error: Exception, context: str = "") -> str:
    error_msg = str(error)
    error_type = type(error).__name__
    suggestions = {
        "ValidationError": "请检查输入参数是否符合要求（必填字段、长度限制、格式等）",
        "KeyError": "请求的数据不存在，请确认 ID 或标识符是否正确",
        "ConnectionError": "无法连接到存储服务，请检查 ChromaDB 是否正常运行",
    }
    suggestion = suggestions.get(error_type, "请检查输入参数或稍后重试")
    return json.dumps({
        "success": False,
        "error": f"{context}: {error_msg}" if context else error_msg,
        "error_type": error_type,
        "suggestion": suggestion,
    }, ensure_ascii=False, indent=2)


def format_success_response(data: dict, message: str = "") -> str:
    response = {"success": True, **data}
    if message:
        response["message"] = message
    return json.dumps(response, ensure_ascii=False, indent=2)


# ============================================================
# 生命周期管理
# ============================================================

@asynccontextmanager
async def app_lifespan(server: FastMCP):
    errors = Config.validate()
    if errors:
        logger.error(f"配置错误: {errors}")
        print(f"❌ 配置错误: {'; '.join(errors)}", file=sys.stderr)
        sys.exit(1)

    store = TripleChainStore()

    logger.info(f"RL Correction MCP (三链版) 启动，当前记录数: {store.collection.count()}")

    yield {"store": store}

    logger.info("RL Correction MCP 关闭")


# ============================================================
# MCP Server
# ============================================================

mcp = FastMCP(
    name=Config.MCP_SERVER_NAME,
    lifespan=app_lifespan,
)


# ============================================================
# Resources
# ============================================================

@mcp.resource("config://server")
async def get_server_config() -> str:
    """获取服务器配置信息（不含敏感信息）"""
    return json.dumps({
        "server_name": Config.MCP_SERVER_NAME,
        "embedding_model": Config.EMBEDDING_MODEL,
        "embedding_api_base": Config.EMBEDDING_API_BASE,
        "chroma_persist_path": Config.CHROMA_PERSIST_PATH,
        "collection_name": Config.COLLECTION_NAME,
        "storage_model": "triple_chain",
    }, ensure_ascii=False, indent=2)


@mcp.resource("stats://corrections")
async def get_correction_stats() -> str:
    """获取修正记录的实时统计信息"""
    try:
        store: TripleChainStore = mcp.get_context().request_context.lifespan_state["store"]
        stats = store.get_stats()
        return json.dumps(stats, ensure_ascii=False, indent=2)
    except Exception as e:
        return format_error_response(e, "获取统计信息失败")


USAGE_GUIDE = """# RL Correction MCP 使用指南（三链版）

## 概述

RL Correction MCP 是一个强化学习行为修正记忆层，通过三链存储模型行为反馈，在推理时通过 RAG 检索注入上下文引导模型行为。

## 三链结构

### 输入链 (Input Chain)
- `raw_input`: 原始用户输入/问题
- `extracted_context`: 提取的场景上下文
- `input_tags`: 输入相关标签

### 输出链 (Output Chain)
- `wrong_output`: 模型的错误输出
- `correct_output`: 期望的正确输出
- `evaluation_notes`: 评估说明
- `quality_score`: 质量评分 (0-100)

### 逻辑链 (Logic Chain)
- `wrong_reason`: 为什么这是错误的
- `correct_reason`: 为什么正确输出更好
- `wrong_cot`: 错误的思维链
- `correct_cot`: 正确的思维链
- `alternative_approaches`: 其他可能的正确方法

## 元数据

- `priority`: P0（关键）/ P1（重要）/ P2（次要）
- `review_status`: pending / approved / rejected
- `tags`: 标签列表

## 工具列表

| 工具 | 用途 | 只读 |
|------|------|------|
| rlc_add_correction | 添加三链修正对 | ❌ |
| rlc_add_rule | 添加行为规则 | ❌ |
| rlc_search | RAG 检索相关记录 | ✅ |
| rlc_list_all | 列出所有记录 | ✅ |
| rlc_delete | 删除记录 | ❌ |
| rlc_get_stats | 获取统计信息 | ✅ |
| rlc_get_record | 获取单条记录详情 | ✅ |
| rlc_review_record | 审核记录 | ❌ |
| rlc_update_logic_chain | 更新逻辑链 | ❌ |
"""


@mcp.resource("docs://usage")
async def get_usage_guide() -> str:
    return USAGE_GUIDE


# ============================================================
# 工具 1: 添加三链修正对
# ============================================================

@mcp.tool(
    name="rlc_add_correction",
    annotations={
        "title": "添加三链修正对",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def rlc_add_correction(params: AddCorrectionToolInput) -> str:
    """添加一条三链修正对：包含输入链（原始输入+场景上下文）、输出链（错误输出+正确输出+质量评分）、逻辑链（错误原因+思维链）。

    当模型产生了不理想的输出时，使用此工具记录完整的三链修正信息。
    未来遇到相似场景时，RAG 会检索到这条记录并注入为上下文引导模型。

    Returns:
        JSON 字符串，包含创建的修正对 ID 和摘要信息
    """
    store: TripleChainStore = mcp.get_context().request_context.lifespan_state["store"]

    try:
        record = TripleChainRecord(
            input_chain=InputChain(
                raw_input=params.raw_input,
                extracted_context=params.extracted_context,
            ),
            output_chain=OutputChain(
                wrong_output=params.wrong_output,
                correct_output=params.correct_output,
                quality_score=params.quality_score,
            ),
            logic_chain=LogicChain(
                wrong_reason=params.wrong_reason,
                correct_reason=params.correct_reason,
                wrong_cot=params.wrong_cot,
                correct_cot=params.correct_cot,
            ),
            metadata=TripleChainMetadata(
                priority=PriorityLevel(params.priority),
                tags=params.tags or [],
            ),
        )
        store.add_correction(record)

        return format_success_response({
            "id": record.id,
            "type": "correction_pair",
            "priority": record.metadata.priority.value,
            "quality_score": record.output_chain.quality_score,
            "extracted_context": record.input_chain.extracted_context[:100],
        }, "三链修正对已添加，未来遇到相似场景时会自动检索到这条记录")

    except Exception as e:
        return format_error_response(e, "添加修正对失败")


# ============================================================
# 工具 2: 添加行为规则
# ============================================================

@mcp.tool(
    name="rlc_add_rule",
    annotations={
        "title": "添加行为规则",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def rlc_add_rule(params: AddRuleToolInput) -> str:
    """添加一条行为规则：定义模型在特定条件下应该或不应该做什么。

    行为规则使用简化版三链结构：输入链（触发条件+场景）、输出链（规则内容+级别）、逻辑链（原因+示例）。

    Returns:
        JSON 字符串，包含创建的规则 ID 和摘要信息
    """
    store: TripleChainStore = mcp.get_context().request_context.lifespan_state["store"]

    try:
        scenario = params.scenario_description or params.trigger_condition
        record = BehaviorRuleRecord(
            input_chain=BehaviorRuleInputChain(
                trigger_condition=params.trigger_condition,
                scenario_description=scenario,
            ),
            output_chain=BehaviorRuleOutputChain(
                rule_content=params.rule_content,
                rule_type=params.rule_type,
            ),
            logic_chain=BehaviorRuleLogicChain(
                reason=params.reason,
                examples=params.examples,
            ),
            metadata=TripleChainMetadata(
                priority=PriorityLevel(params.priority),
                tags=params.tags or [],
            ),
        )
        store.add_behavior_rule(record)

        return format_success_response({
            "id": record.id,
            "type": "behavior_rule",
            "rule_type": record.output_chain.rule_type,
            "priority": record.metadata.priority.value,
            "trigger_condition": record.input_chain.trigger_condition[:100],
        }, "行为规则已添加，未来遇到匹配场景时会自动检索到这条规则")

    except Exception as e:
        return format_error_response(e, "添加行为规则失败")


# ============================================================
# 工具 3: RAG 检索
# ============================================================

@mcp.tool(
    name="rlc_search",
    annotations={
        "title": "检索修正记录",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def rlc_search(params: SearchToolInput) -> str:
    """RAG 检索相关的修正记录，返回格式化的上下文文本。

    在模型即将生成回复之前，使用此工具检索与当前场景相关的历史修正记录。
    支持按类型、标签、优先级过滤。

    Returns:
        格式化的 Markdown 文本或 JSON，包含相关的修正记录
    """
    store: TripleChainStore = mcp.get_context().request_context.lifespan_state["store"]

    try:
        search_params = SearchInput(
            query=params.query,
            top_k=params.top_k,
            filter_type=params.filter_type,
            filter_tags=params.filter_tags,
            filter_priority=params.filter_priority,
        )

        results = store.search(search_params)

        if params.output_format == "json":
            return json.dumps({
                "success": True,
                "count": len(results),
                "query": params.query,
                "results": [{
                    "id": r["id"],
                    "type": r["type"].value,
                    "similarity": round(1 - r["distance"], 4),
                    "metadata": r["metadata"],
                    "content": r["content"],
                } for r in results],
            }, ensure_ascii=False, indent=2)

        if not results:
            return format_success_response({"context": "（未找到相关的修正记录）"}, "检索完成")

        # 格式化为 Markdown
        pairs = [r for r in results if r["type"].value == "correction_pair"]
        rules = [r for r in results if r["type"].value == "behavior_rule"]

        sections = []
        if rules:
            sections.append("## ⚠️ 行为规则（必须遵守）\n")
            for r in rules:
                sections.append(f"触发条件: {r['metadata'].get('trigger_condition', '')}")
                sections.append(f"---")
                sections.append(r["content"])
                sections.append("")

        if pairs:
            sections.append("## 📋 修正示例（参考学习）\n")
            for r in pairs:
                quality = r["metadata"].get("quality_score", "")
                sections.append(f"场景: {r['metadata'].get('extracted_context', '')} (质量评分: {quality})")
                sections.append(f"---")
                sections.append(r["content"])
                sections.append("")

        header = (
            f"## 🔧 RL 行为修正提示\n\n"
            f"以下是基于历史反馈检索到的 {len(results)} 条相关修正记录，"
            f"请在生成回复时参考这些修正：\n"
        )
        context = header + "\n".join(sections)
        return format_success_response({"context": context}, "检索完成")

    except Exception as e:
        return format_error_response(e, "检索失败")


# ============================================================
# 工具 4: 列出所有记录
# ============================================================

@mcp.tool(
    name="rlc_list_all",
    annotations={
        "title": "列出所有修正记录",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def rlc_list_all(params: ListAllToolInput) -> str:
    """列出所有修正记录，支持分页和多维过滤（类型、优先级、审核状态）。

    Returns:
        JSON 字符串，包含记录列表和分页信息
    """
    store: TripleChainStore = mcp.get_context().request_context.lifespan_state["store"]

    try:
        result = store.list_all(
            limit=min(params.limit, 100),
            offset=params.offset,
            filter_type=params.filter_type,
            filter_priority=params.filter_priority,
            filter_review_status=params.filter_review_status,
        )
        return format_success_response(result, f"成功获取 {len(result.get('records', []))} 条记录")

    except Exception as e:
        return format_error_response(e, "获取记录列表失败")


# ============================================================
# 工具 5: 删除记录
# ============================================================

@mcp.tool(
    name="rlc_delete",
    annotations={
        "title": "删除修正记录",
        "readOnlyHint": False,
        "destructiveHint": True,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def rlc_delete(params: DeleteToolInput) -> str:
    """删除指定的修正记录。

    Returns:
        JSON 字符串，包含操作结果
    """
    store: TripleChainStore = mcp.get_context().request_context.lifespan_state["store"]

    try:
        success = store.delete(params.record_id)
        if success:
            return format_success_response({"deleted_id": params.record_id}, "记录已删除")
        else:
            return format_error_response(
                KeyError(f"未找到 ID 为 {params.record_id} 的记录"),
                "删除失败"
            )

    except Exception as e:
        return format_error_response(e, "删除记录失败")


# ============================================================
# 工具 6: 获取统计信息
# ============================================================

@mcp.tool(
    name="rlc_get_stats",
    annotations={
        "title": "获取修正记录统计",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def rlc_get_stats() -> str:
    """获取修正记录的统计信息，包含优先级分布、审核状态分布、平均质量评分等。

    Returns:
        JSON 字符串，包含统计信息
    """
    store: TripleChainStore = mcp.get_context().request_context.lifespan_state["store"]

    try:
        stats = store.get_stats()
        return format_success_response(stats, "统计信息获取成功")

    except Exception as e:
        return format_error_response(e, "获取统计信息失败")


# ============================================================
# 工具 7: 获取单条记录详情
# ============================================================

@mcp.tool(
    name="rlc_get_record",
    annotations={
        "title": "获取单条记录详情",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def rlc_get_record(params: GetRecordToolInput) -> str:
    """获取单条修正记录的完整三链信息。

    Returns:
        JSON 字符串，包含完整的三链数据（输入链、输出链、逻辑链、元数据）
    """
    store: TripleChainStore = mcp.get_context().request_context.lifespan_state["store"]

    try:
        record = store.get_by_id(params.record_id)
        if record:
            return format_success_response(record, "记录获取成功")
        else:
            return format_error_response(
                KeyError(f"未找到 ID 为 {params.record_id} 的记录"),
                "获取记录失败"
            )

    except Exception as e:
        return format_error_response(e, "获取记录失败")


# ============================================================
# 工具 8: 审核记录
# ============================================================

@mcp.tool(
    name="rlc_review_record",
    annotations={
        "title": "审核修正记录",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def rlc_review_record(params: ReviewRecordToolInput) -> str:
    """审核一条修正记录（批准或拒绝）。

    审核后记录状态会更新，审核备注和时间会被记录。
    P0 优先级记录建议优先审核。

    Returns:
        JSON 字符串，包含更新后的记录信息
    """
    store: TripleChainStore = mcp.get_context().request_context.lifespan_state["store"]

    try:
        result = store.review_record(params)
        if result:
            action_text = "已通过审核" if params.action == "approve" else "已拒绝"
            return format_success_response({
                "id": result["id"],
                "review_status": result["metadata"]["review_status"],
                "reviewed_at": result["metadata"].get("reviewed_at"),
            }, f"记录{action_text}")
        else:
            return format_error_response(
                KeyError(f"未找到 ID 为 {params.record_id} 的记录"),
                "审核失败"
            )

    except Exception as e:
        return format_error_response(e, "审核记录失败")


# ============================================================
# 工具 9: 更新逻辑链
# ============================================================

@mcp.tool(
    name="rlc_update_logic_chain",
    annotations={
        "title": "更新逻辑链",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def rlc_update_logic_chain(params: UpdateLogicChainToolInput) -> str:
    """更新修正对的逻辑链（错误原因、正确原因、思维链等）。

    仅支持修正对（correction_pair）类型的记录。
    更新历史会被自动记录。

    Returns:
        JSON 字符串，包含更新后的记录信息
    """
    store: TripleChainStore = mcp.get_context().request_context.lifespan_state["store"]

    try:
        result = store.update_logic_chain(params)
        if result:
            return format_success_response({
                "id": result["id"],
                "logic_chain": result.get("logic_chain"),
            }, "逻辑链已更新")
        else:
            return format_error_response(
                KeyError(f"未找到 ID 为 {params.record_id} 的修正对记录，或该记录不是修正对类型"),
                "更新逻辑链失败"
            )

    except Exception as e:
        return format_error_response(e, "更新逻辑链失败")


# ============================================================
# 启动入口
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="RL Correction MCP Server (三链版)")
    parser.add_argument(
        "--transport",
        choices=["stdio", "streamable_http"],
        default="stdio",
        help="传输协议（默认: stdio）",
    )
    parser.add_argument("--host", default="127.0.0.1", help="HTTP 主机")
    parser.add_argument("--port", type=int, default=8000, help="HTTP 端口")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stderr,
    )

    logger.info(f"启动 RL Correction MCP Server (三链版), transport={args.transport}")

    if args.transport == "stdio":
        mcp.run()
    elif args.transport == "streamable_http":
        mcp.run(transport="streamable_http", host=args.host, port=args.port)


if __name__ == "__main__":
    main()

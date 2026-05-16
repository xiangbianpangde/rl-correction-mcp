"""Web管理界面后端API - 与MCP的三链存储层交互"""

from __future__ import annotations

import sys
import os
from pathlib import Path
from typing import Optional

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import uvicorn

# 导入 MCP 的三链存储层
from rl_correction_mcp.store import TripleChainStore
from rl_correction_mcp.call_logger import get_call_logger
from rl_correction_mcp.models import (
    TripleChainRecord,
    BehaviorRuleRecord,
    InputChain,
    OutputChain,
    LogicChain,
    BehaviorRuleInputChain,
    BehaviorRuleOutputChain,
    BehaviorRuleLogicChain,
    TripleChainMetadata,
    PriorityLevel,
    ReviewStatus,
    SearchInput,
    AdvancedSearchFilters,
    ReviewRecordToolInput,
    UpdateLogicChainToolInput,
)

# ============================================================
# 数据模型
# ============================================================

class CorrectionPairCreate(BaseModel):
    raw_input: str = Field(..., min_length=1, max_length=5000)
    extracted_context: str = Field(..., min_length=1, max_length=2000)
    wrong_output: str = Field(..., min_length=1, max_length=10000)
    correct_output: str = Field(..., min_length=1, max_length=10000)
    wrong_reason: str = Field(..., min_length=1, max_length=2000)
    correct_reason: Optional[str] = None
    wrong_cot: Optional[str] = None
    correct_cot: Optional[str] = None
    quality_score: int = Field(default=50, ge=0, le=100)
    priority: str = Field(default="P1", pattern=r"^(P0|P1|P2)$")
    tags: list[str] = Field(default_factory=list)


class BehaviorRuleCreate(BaseModel):
    trigger_condition: str = Field(..., min_length=1, max_length=2000)
    scenario_description: str = Field(default="")
    rule_content: str = Field(..., min_length=1, max_length=5000)
    rule_type: str = Field(default="must", pattern=r"^(must|must_not|should|should_not)$")
    reason: Optional[str] = None
    examples: Optional[str] = None
    priority: str = Field(default="P1", pattern=r"^(P0|P1|P2)$")
    tags: list[str] = Field(default_factory=list)


class DeleteRequest(BaseModel):
    record_id: str


class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=20)
    filters: Optional[AdvancedSearchFilters] = None
    filter_type: Optional[str] = None
    filter_tags: Optional[list[str]] = None
    filter_priority: Optional[str] = None


class ReviewRequest(BaseModel):
    action: str = Field(..., pattern=r"^(approve|reject)$")
    reviewer_notes: Optional[str] = None
    reviewer_id: Optional[str] = None


class UpdateLogicChainRequest(BaseModel):
    wrong_reason: Optional[str] = None
    correct_reason: Optional[str] = None
    wrong_cot: Optional[str] = None
    correct_cot: Optional[str] = None
    alternative_approaches: Optional[str] = None
    update_notes: Optional[str] = None


# ============================================================
# FastAPI 应用
# ============================================================

app = FastAPI(
    title="RL Correction MCP - Web管理界面（三链版）",
    description="查看和修改RL Correction MCP的三链修正记录和行为规则",
    version="2.0.0",
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化存储层
store: Optional[TripleChainStore] = None
call_logger = None


@app.on_event("startup")
async def startup():
    """启动时初始化存储层"""
    global store, call_logger
    store = TripleChainStore()
    call_logger = get_call_logger()
    print(f"RL Correction MCP Web API (三链版) 启动，当前记录数: {store.collection.count()}")


@app.on_event("shutdown")
async def shutdown():
    """关闭时清理资源"""
    print("RL Correction MCP Web API 关闭")


# ============================================================
# 统计接口
# ============================================================

@app.get("/api/stats")
async def get_stats():
    """获取修正记录统计信息（含优先级和审核状态分布）"""
    if store is None:
        raise HTTPException(status_code=500, detail="存储层未初始化")
    return store.get_stats()


# ============================================================
# 列表接口
# ============================================================

@app.get("/api/records")
async def list_records(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    filter_type: Optional[str] = Query(default=None),
    filter_priority: Optional[str] = Query(default=None),
    filter_review_status: Optional[str] = Query(default=None),
):
    """列出所有修正记录（分页 + 多维过滤）"""
    if store is None:
        raise HTTPException(status_code=500, detail="存储层未初始化")
    return store.list_all(
        limit=limit,
        offset=offset,
        filter_type=filter_type,
        filter_priority=filter_priority,
        filter_review_status=filter_review_status,
    )


# ============================================================
# 详情接口
# ============================================================

@app.get("/api/records/{record_id}")
async def get_record(record_id: str):
    """获取指定记录的完整三链信息"""
    if store is None:
        raise HTTPException(status_code=500, detail="存储层未初始化")

    record = store.get_by_id(record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


# ============================================================
# 添加接口
# ============================================================

@app.post("/api/corrections")
async def add_correction(data: CorrectionPairCreate):
    """添加三链修正对"""
    if store is None:
        raise HTTPException(status_code=500, detail="存储层未初始化")

    try:
        record = TripleChainRecord(
            input_chain=InputChain(
                raw_input=data.raw_input,
                extracted_context=data.extracted_context,
            ),
            output_chain=OutputChain(
                wrong_output=data.wrong_output,
                correct_output=data.correct_output,
                quality_score=data.quality_score,
            ),
            logic_chain=LogicChain(
                wrong_reason=data.wrong_reason,
                correct_reason=data.correct_reason,
                wrong_cot=data.wrong_cot,
                correct_cot=data.correct_cot,
            ),
            metadata=TripleChainMetadata(
                priority=PriorityLevel(data.priority),
                tags=data.tags,
            ),
        )
        store.add_correction(record)

        return {
            "success": True,
            "id": record.id,
            "type": "correction_pair",
            "priority": record.metadata.priority.value,
            "message": "三链修正对已添加",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/rules")
async def add_rule(data: BehaviorRuleCreate):
    """添加行为规则"""
    if store is None:
        raise HTTPException(status_code=500, detail="存储层未初始化")

    try:
        scenario = data.scenario_description or data.trigger_condition
        record = BehaviorRuleRecord(
            input_chain=BehaviorRuleInputChain(
                trigger_condition=data.trigger_condition,
                scenario_description=scenario,
            ),
            output_chain=BehaviorRuleOutputChain(
                rule_content=data.rule_content,
                rule_type=data.rule_type,
            ),
            logic_chain=BehaviorRuleLogicChain(
                reason=data.reason,
                examples=data.examples,
            ),
            metadata=TripleChainMetadata(
                priority=PriorityLevel(data.priority),
                tags=data.tags,
            ),
        )
        store.add_behavior_rule(record)

        return {
            "success": True,
            "id": record.id,
            "type": "behavior_rule",
            "rule_type": record.output_chain.rule_type,
            "message": "行为规则已添加",
        }
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "OPENAI_API_KEY" in error_msg or "embedding" in error_msg.lower():
            raise HTTPException(
                status_code=500, 
                detail="Embedding 服务配置错误。请设置有效的 EMBEDDING_API_KEY 环境变量，或确保 sentence-transformers 已安装以使用本地模型。"
            )
        raise HTTPException(status_code=400, detail=error_msg)


# ============================================================
# 删除接口
# ============================================================

@app.delete("/api/records/{record_id}")
async def delete_record(record_id: str):
    """删除指定记录"""
    if store is None:
        raise HTTPException(status_code=500, detail="存储层未初始化")

    success = store.delete(record_id)
    if not success:
        raise HTTPException(status_code=404, detail="记录不存在或删除失败")

    return {
        "success": True,
        "deleted_id": record_id,
        "message": "记录已删除",
    }


# ============================================================
# 审核接口
# ============================================================

@app.post("/api/records/{record_id}/review")
async def review_record(record_id: str, data: ReviewRequest):
    """审核记录（批准/拒绝）"""
    if store is None:
        raise HTTPException(status_code=500, detail="存储层未初始化")

    try:
        params = ReviewRecordToolInput(
            record_id=record_id,
            action=data.action,
            reviewer_notes=data.reviewer_notes,
            reviewer_id=data.reviewer_id,
        )
        result = store.review_record(params)
        if result is None:
            raise HTTPException(status_code=404, detail="记录不存在")

        action_text = "已通过审核" if data.action == "approve" else "已拒绝"
        return {
            "success": True,
            "id": record_id,
            "review_status": result["metadata"]["review_status"],
            "message": f"记录{action_text}",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# 更新逻辑链接口
# ============================================================

@app.put("/api/records/{record_id}/logic-chain")
async def update_logic_chain(record_id: str, data: UpdateLogicChainRequest):
    """更新修正对的逻辑链"""
    if store is None:
        raise HTTPException(status_code=500, detail="存储层未初始化")

    try:
        params = UpdateLogicChainToolInput(
            record_id=record_id,
            wrong_reason=data.wrong_reason,
            correct_reason=data.correct_reason,
            wrong_cot=data.wrong_cot,
            correct_cot=data.correct_cot,
            alternative_approaches=data.alternative_approaches,
            update_notes=data.update_notes,
        )
        result = store.update_logic_chain(params)
        if result is None:
            raise HTTPException(status_code=404, detail="修正对记录不存在")

        return {
            "success": True,
            "id": record_id,
            "logic_chain": result.get("logic_chain"),
            "message": "逻辑链已更新",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# 搜索接口
# ============================================================

@app.post("/api/search")
async def search_records(data: SearchRequest):
    """RAG搜索相关修正记录"""
    if store is None:
        raise HTTPException(status_code=500, detail="存储层未初始化")

    try:
        from rl_correction_mcp.retriever import CorrectionRetriever

        retriever = CorrectionRetriever(store)
        
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


# ============================================================
# 调用记录接口
# ============================================================

@app.get("/api/calls")
async def list_calls(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    tool_name: Optional[str] = Query(default=None),
    result_status: Optional[str] = Query(default=None),
    related_correction_id: Optional[str] = Query(default=None),
):
    """列出 MCP 工具调用记录"""
    if call_logger is None:
        raise HTTPException(status_code=500, detail="调用记录器未初始化")

    return call_logger.get_calls(
        limit=limit,
        offset=offset,
        tool_name=tool_name,
        result_status=result_status,
        related_correction_id=related_correction_id,
    )


@app.get("/api/calls/stats")
async def get_call_stats():
    """获取调用统计信息"""
    if call_logger is None:
        raise HTTPException(status_code=500, detail="调用记录器未初始化")

    return call_logger.get_stats()


# ============================================================
# 静态文件服务（前端）
# ============================================================

# 获取 web 目录路径
WEB_DIR = Path(__file__).parent / "web"
STATIC_DIR = WEB_DIR / "static"


@app.get("/")
async def root():
    """返回前端页面"""
    index_path = WEB_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "Web界面未找到，请先构建前端"}


@app.get("/favicon.ico")
async def favicon():
    """返回favicon"""
    favicon_path = STATIC_DIR / "favicon.ico"
    if favicon_path.exists():
        return FileResponse(str(favicon_path))
    return {"error": "favicon not found"}

# 挂载静态文件目录
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ============================================================
# 启动入口
# ============================================================

def main():
    """启动Web API服务器"""
    uvicorn.run(
        "web_api:app",
        host="0.0.0.0",
        port=8080,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()

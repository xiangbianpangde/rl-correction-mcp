"""RAG 检索层 - 基于向量相似度搜索修正记录（三链版）"""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Optional, List

from .models import (
    AdvancedSearchFilters,
    CorrectionType,
    SearchInput,
    SearchResult,
    FilterDefinition,
    FilterOption,
)
from .store import TripleChainStore

logger = logging.getLogger(__name__)


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


class CorrectionRetriever(RetrieverInterface):
    """基于向量相似度的修正记录检索器"""

    def __init__(self, store: TripleChainStore):
        self._store = store

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

    def search(self, params: SearchInput) -> list[SearchResult]:
        """
        执行 RAG 检索

        Args:
            params: 检索参数，包含 query、top_k、filter_type、filter_tags、filter_priority

        Returns:
            按相似度排序的检索结果列表
        """
        results = self._store.search(params)

        search_results = []
        for r in results:
            search_results.append(SearchResult(
                id=r["id"],
                type=r["type"],
                content=r["content"],
                metadata=r["metadata"],
                distance=r["distance"],
            ))

        logger.info(
            f"RAG 检索: query='{params.query[:50]}', "
            f"returned={len(search_results)}, top_k={params.top_k}"
        )

        if params.filters:
            search_results = self._apply_memory_filters(search_results, params.filters)

        return search_results

    def _apply_memory_filters(
        self,
        results: list[SearchResult],
        filters: AdvancedSearchFilters,
    ) -> list[SearchResult]:
        """在内存中应用额外的过滤条件"""
        filtered = results

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

        if filters.created_after:
            filtered = [
                r for r in filtered
                if r.metadata.get("created_at", "") >= filters.created_after
            ]
        if filters.created_before:
            filtered = [
                r for r in filtered
                if r.metadata.get("created_at", "") <= filters.created_before
            ]

        if filters.review_status:
            filtered = [
                r for r in filtered
                if r.metadata.get("review_status", "") == filters.review_status
            ]

        return filtered

    def search_and_format(self, params: SearchInput) -> str:
        """
        执行检索并格式化为可注入 LLM 的上下文文本

        Returns:
            格式化的 Markdown 文本，可直接注入到 system prompt 或 user message 中
        """
        results = self.search(params)

        if not results:
            return "（未找到相关的修正记录）"

        # 分组：修正对 vs 行为规则
        pairs = [r for r in results if r.type == CorrectionType.CORRECTION_PAIR]
        rules = [r for r in results if r.type == CorrectionType.BEHAVIOR_RULE]

        sections = []

        if rules:
            sections.append("## ⚠️ 行为规则（必须遵守）\n")
            for r in rules:
                sections.append(r.format_as_context())
                sections.append("")

        if pairs:
            sections.append("## 📋 修正示例（参考学习）\n")
            for r in pairs:
                sections.append(r.format_as_context())
                sections.append("")

        header = (
            f"## 🔧 RL 行为修正提示\n\n"
            f"以下是基于历史反馈检索到的 {len(results)} 条相关修正记录，"
            f"请在生成回复时参考这些修正：\n"
        )

        return header + "\n".join(sections)

    def search_and_format_json(self, params: SearchInput) -> str:
        """
        执行检索并返回 JSON 格式的结构化数据

        Returns:
            JSON 字符串，包含结构化的检索结果
        """
        results = self.search(params)

        if not results:
            return json.dumps({
                "success": True,
                "count": 0,
                "results": [],
                "message": "未找到相关的修正记录"
            }, ensure_ascii=False, indent=2)

        # 构建结构化结果
        structured_results = []
        for r in results:
            result_data = {
                "id": r.id,
                "type": r.type.value,
                "similarity_score": round(1 - r.distance, 4),
                "metadata": r.metadata,
                "content": r.content,
            }
            structured_results.append(result_data)

        return json.dumps({
            "success": True,
            "count": len(results),
            "query": params.query,
            "filters": {
                "filter_type": params.filter_type,
                "filter_tags": params.filter_tags,
                "filter_priority": getattr(params, 'filter_priority', None),
            },
            "results": structured_results,
        }, ensure_ascii=False, indent=2)

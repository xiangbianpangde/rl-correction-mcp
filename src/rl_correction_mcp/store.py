"""ChromaDB 持久化存储层 - 三链存储管理"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import chromadb
import chromadb.utils.embedding_functions as embedding_functions

from .config import Config
from .models import (
    BehaviorRuleRecord,
    CorrectionType,
    GetRecordToolInput,
    InputChain,
    LogicChain,
    OutputChain,
    PriorityLevel,
    ReviewRecordToolInput,
    ReviewStatus,
    SearchInput,
    TripleChainMetadata,
    TripleChainRecord,
    UpdateLogicChainToolInput,
)

logger = logging.getLogger(__name__)


class TripleChainStore:
    """三链存储层，基于 ChromaDB"""

    def __init__(
        self,
        persist_path: Optional[str] = None,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        embedding_model: Optional[str] = None,
        collection_name: Optional[str] = None,
    ):
        persist_path = persist_path or Config.CHROMA_PERSIST_PATH
        api_key = api_key or Config.EMBEDDING_API_KEY
        api_base = api_base or Config.EMBEDDING_API_BASE
        embedding_model = embedding_model or Config.EMBEDDING_MODEL
        collection_name = collection_name or Config.COLLECTION_NAME

        Path(persist_path).mkdir(parents=True, exist_ok=True)

        self._client = chromadb.PersistentClient(path=persist_path)

        self._embedding_fn = embedding_functions.OpenAIEmbeddingFunction(
            api_key=api_key,
            api_base=api_base,
            model_name=embedding_model,
        )

        # 主向量库
        self._collection = self._client.get_or_create_collection(
            name=collection_name,
            embedding_function=self._embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )

        logger.info(
            f"TripleChainStore 初始化完成: "
            f"path={persist_path}, collection={collection_name}, "
            f"count={self._collection.count()}"
        )

    @property
    def collection(self):
        return self._collection

    # ============================================================
    # JSON 存储（完整数据精确读取）
    # ============================================================

    def _ensure_json_collection(self):
        if not hasattr(self, "_json_collection"):
            self._json_collection = self._client.get_or_create_collection(
                name=f"{Config.COLLECTION_NAME}_json",
                embedding_function=self._embedding_fn,
            )

    # ============================================================
    # 增
    # ============================================================

    def add_correction(self, record: TripleChainRecord) -> TripleChainRecord:
        """添加一条三链修正对"""
        self._collection.add(
            documents=[record.embedding_text],
            metadatas=[record.to_metadata()],
            ids=[record.id],
        )

        self._ensure_json_collection()
        self._json_collection.add(
            documents=[record.to_json()],
            metadatas=[{"record_id": record.id, "type": record.type.value}],
            ids=[f"json_{record.id}"],
        )

        logger.info(f"添加三链修正对: id={record.id}, priority={record.metadata.priority.value}")
        return record

    def add_behavior_rule(self, record: BehaviorRuleRecord) -> BehaviorRuleRecord:
        """添加一条行为规则"""
        self._collection.add(
            documents=[record.embedding_text],
            metadatas=[record.to_metadata()],
            ids=[record.id],
        )

        self._ensure_json_collection()
        self._json_collection.add(
            documents=[record.to_json()],
            metadatas=[{"record_id": record.id, "type": record.type.value}],
            ids=[f"json_{record.id}"],
        )

        logger.info(
            f"添加行为规则: id={record.id}, "
            f"rule_type={record.output_chain.rule_type}, "
            f"priority={record.metadata.priority.value}"
        )
        return record

    # ============================================================
    # 删
    # ============================================================

    def delete(self, record_id: str) -> bool:
        """删除指定记录"""
        try:
            self._collection.delete(ids=[record_id])
            self._ensure_json_collection()
            try:
                self._json_collection.delete(ids=[f"json_{record_id}"])
            except Exception:
                pass
            logger.info(f"删除记录: id={record_id}")
            return True
        except Exception as e:
            logger.error(f"删除记录失败: id={record_id}, error={e}")
            return False

    # ============================================================
    # 查
    # ============================================================

    def get_by_id(self, record_id: str) -> Optional[dict]:
        """通过 ID 获取完整记录"""
        self._ensure_json_collection()
        try:
            result = self._json_collection.get(
                ids=[f"json_{record_id}"],
                include=["documents", "metadatas"],
            )
            if result["documents"]:
                return json.loads(result["documents"][0])
        except Exception as e:
            logger.error(f"获取记录失败: id={record_id}, error={e}")
        return None

    def list_all(
        self,
        limit: int = 50,
        offset: int = 0,
        filter_type: Optional[str] = None,
        filter_priority: Optional[str] = None,
        filter_review_status: Optional[str] = None,
    ) -> dict:
        """列出所有记录（分页 + 多维过滤）"""
        where_clauses = []

        if filter_type:
            where_clauses.append({"type": filter_type})
        if filter_priority:
            where_clauses.append({"priority": filter_priority})
        if filter_review_status:
            where_clauses.append({"review_status": filter_review_status})

        # 只有一个条件时直接使用，多个条件时使用 $and
        if len(where_clauses) == 1:
            where = where_clauses[0]
        elif len(where_clauses) > 1:
            where = {"$and": where_clauses}
        else:
            where = None

        results = self._collection.get(
            where=where,
            include=["metadatas", "documents"],
        )

        total = len(results["ids"])
        ids = results["ids"][offset : offset + limit]
        metadatas = results["metadatas"][offset : offset + limit]
        documents = results["documents"][offset : offset + limit]

        records = []
        for i, record_id in enumerate(ids):
            records.append({
                "id": record_id,
                "type": metadatas[i].get("type", "unknown"),
                "priority": metadatas[i].get("priority", "P1"),
                "review_status": metadatas[i].get("review_status", "pending"),
                "quality_score": metadatas[i].get("quality_score"),
                "metadata": metadatas[i],
                "preview": documents[i][:200] + "..." if len(documents[i]) > 200 else documents[i],
            })

        return {
            "total": total,
            "count": len(records),
            "offset": offset,
            "records": records,
        }

    def get_stats(self) -> dict:
        """获取统计信息（三链版）"""
        total = self._collection.count()

        all_meta = self._collection.get(include=["metadatas"])["metadatas"]

        # 按类型统计
        correction_count = sum(1 for m in all_meta if m.get("type") == "correction_pair")
        rule_count = sum(1 for m in all_meta if m.get("type") == "behavior_rule")

        # 按优先级统计
        priority_counts = {"P0": 0, "P1": 0, "P2": 0}
        for m in all_meta:
            p = m.get("priority", "P1")
            if p in priority_counts:
                priority_counts[p] += 1

        # 按审核状态统计
        review_counts = {"pending": 0, "approved": 0, "rejected": 0}
        for m in all_meta:
            s = m.get("review_status", "pending")
            if s in review_counts:
                review_counts[s] += 1

        # 按规则类型统计
        rule_type_counts = {}
        for m in all_meta:
            rt = m.get("rule_type", "")
            if rt:
                rule_type_counts[rt] = rule_type_counts.get(rt, 0) + 1

        # 平均质量评分
        quality_scores = [m.get("quality_score", 0) for m in all_meta if m.get("quality_score") is not None]
        avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0

        # 收集所有标签
        all_tags = set()
        for m in all_meta:
            tags_str = m.get("tags", "")
            if tags_str:
                all_tags.update(t.strip() for t in tags_str.split(",") if t.strip())

        return {
            "total_records": total,
            "correction_pairs": correction_count,
            "behavior_rules": rule_count,
            "priority_breakdown": priority_counts,
            "review_status_breakdown": review_counts,
            "rule_type_breakdown": rule_type_counts,
            "avg_quality_score": round(avg_quality, 1),
            "all_tags": sorted(all_tags),
        }

    # ============================================================
    # 改：审核
    # ============================================================

    def review_record(self, params: ReviewRecordToolInput) -> Optional[dict]:
        """审核记录（批准/拒绝）"""
        record_data = self.get_by_id(params.record_id)
        if not record_data:
            return None

        # 更新审核状态
        now = datetime.now(timezone.utc).isoformat()
        if "metadata" not in record_data:
            record_data["metadata"] = {}
        record_data["metadata"]["review_status"] = "approved" if params.action == "approve" else "rejected"
        record_data["metadata"]["reviewed_at"] = now
        if params.reviewer_notes:
            record_data["metadata"]["reviewer_notes"] = params.reviewer_notes
        if params.reviewer_id:
            record_data["metadata"]["reviewed_by"] = params.reviewer_id

        # 重建记录并更新
        record_type = record_data.get("type", "correction_pair")
        if record_type == "behavior_rule":
            record = BehaviorRuleRecord.model_validate(record_data)
        else:
            record = TripleChainRecord.model_validate(record_data)

        # 更新向量库 metadata
        self._collection.update(
            metadatas=[record.to_metadata()],
            ids=[record.id],
        )

        # 更新 JSON 存储
        self._ensure_json_collection()
        self._json_collection.update(
            documents=[record.to_json()],
            ids=[f"json_{record.id}"],
        )

        logger.info(f"审核记录: id={record.id}, action={params.action}")
        return record.model_dump()

    # ============================================================
    # 改：更新逻辑链
    # ============================================================

    def update_logic_chain(self, params: UpdateLogicChainToolInput) -> Optional[dict]:
        """更新逻辑链（仅修正对支持）"""
        record_data = self.get_by_id(params.record_id)
        if not record_data:
            return None

        record_type = record_data.get("type", "correction_pair")
        if record_type != "correction_pair":
            logger.warning(f"仅修正对支持逻辑链更新, id={params.record_id}, type={record_type}")
            return None

        # 更新逻辑链字段
        lc = record_data.get("logic_chain", {})
        if params.wrong_reason is not None:
            lc["wrong_reason"] = params.wrong_reason
        if params.correct_reason is not None:
            lc["correct_reason"] = params.correct_reason
        if params.wrong_cot is not None:
            lc["wrong_cot"] = params.wrong_cot
        if params.correct_cot is not None:
            lc["correct_cot"] = params.correct_cot
        if params.alternative_approaches is not None:
            lc["alternative_approaches"] = params.alternative_approaches
        record_data["logic_chain"] = lc

        # 记录更新历史
        if "update_history" not in record_data:
            record_data["update_history"] = []
        record_data["update_history"].append({
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "field": "logic_chain",
            "notes": params.update_notes,
        })

        # 重建记录
        record = TripleChainRecord.model_validate(record_data)

        # 更新向量库（embedding 文本可能变化）
        self.delete(params.record_id)
        self.add_correction(record)

        logger.info(f"更新逻辑链: id={record.id}")
        return record.model_dump()

    # ============================================================
    # 搜索
    # ============================================================

    def search(self, params: SearchInput) -> list:
        """向量相似度搜索"""
        where_clauses = []

        if params.filter_type:
            where_clauses.append({"type": params.filter_type})
        if params.filter_priority:
            where_clauses.append({"priority": params.filter_priority})
        if params.filter_tags:
            for tag in params.filter_tags:
                where_clauses.append({"tags": {"$contains": tag}})

        # 只有一个条件时直接使用，多个条件时使用 $and
        if len(where_clauses) == 1:
            where = where_clauses[0]
        elif len(where_clauses) > 1:
            where = {"$and": where_clauses}
        else:
            where = None

        results = self._collection.query(
            query_texts=[params.query],
            n_results=params.top_k,
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        search_results = []
        if results["ids"] and results["ids"][0]:
            for i in range(len(results["ids"][0])):
                meta = results["metadatas"][0][i]
                record_type = CorrectionType(meta.get("type", "correction_pair"))
                search_results.append({
                    "id": results["ids"][0][i],
                    "type": record_type,
                    "content": results["documents"][0][i],
                    "metadata": meta,
                    "distance": results["distances"][0][i],
                })

        return search_results

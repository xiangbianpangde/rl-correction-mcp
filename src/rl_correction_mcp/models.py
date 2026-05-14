"""数据模型定义 - 三链存储模型（输入链、输出链、逻辑链）"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict, field_validator


# ============================================================
# 枚举类型
# ============================================================

class CorrectionType(str, Enum):
    """修正记录类型"""
    CORRECTION_PAIR = "correction_pair"  # 三链修正对
    BEHAVIOR_RULE = "behavior_rule"      # 行为规则


class PriorityLevel(str, Enum):
    """优先级级别"""
    P0_CRITICAL = "P0"  # 关键错误，必须修复
    P1_IMPORTANT = "P1"  # 重要问题，建议修复
    P2_MINOR = "P2"      # 次要问题，可选修复


class ReviewStatus(str, Enum):
    """审核状态"""
    PENDING = "pending"     # 待审核
    APPROVED = "approved"  # 已通过
    REJECTED = "rejected"  # 已拒绝


# ============================================================
# 三链子模型
# ============================================================

class InputChain(BaseModel):
    """输入链：原始输入和提取的上下文"""
    raw_input: str = Field(
        ...,
        description="原始用户输入/问题",
        min_length=1,
        max_length=5000,
    )
    extracted_context: str = Field(
        ...,
        description="提取的场景上下文（精炼的场景描述）",
        min_length=1,
        max_length=2000,
    )
    input_tags: list[str] = Field(
        default_factory=list,
        description="输入相关标签",
        max_length=20,
    )


class OutputChain(BaseModel):
    """输出链：模型的输出"""
    wrong_output: str = Field(
        ...,
        description="模型的错误输出",
        min_length=1,
        max_length=10000,
    )
    correct_output: str = Field(
        ...,
        description="期望的正确输出",
        min_length=1,
        max_length=10000,
    )
    evaluation_notes: Optional[str] = Field(
        default=None,
        description="评估说明",
        max_length=2000,
    )
    quality_score: int = Field(
        default=50,
        ge=0,
        le=100,
        description="质量评分 0-100（越高表示修正越重要）",
    )


class LogicChain(BaseModel):
    """逻辑链：推理过程和原因分析"""
    wrong_reason: str = Field(
        ...,
        description="为什么这是错误的",
        min_length=1,
        max_length=2000,
    )
    correct_reason: Optional[str] = Field(
        default=None,
        description="为什么正确输出更好",
        max_length=2000,
    )
    wrong_cot: Optional[str] = Field(
        default=None,
        description="模型得出错误输出时的思维链（JSON字符串数组）",
        max_length=10000,
    )
    correct_cot: Optional[str] = Field(
        default=None,
        description="正确的思维链/推理过程（JSON字符串数组）",
        max_length=10000,
    )
    alternative_approaches: Optional[str] = Field(
        default=None,
        description="其他可能的正确方法",
        max_length=5000,
    )


class TripleChainMetadata(BaseModel):
    """元数据：优先级、审核状态等"""
    priority: PriorityLevel = Field(
        default=PriorityLevel.P1_IMPORTANT,
        description="优先级：P0（关键）/ P1（重要）/ P2（次要）",
    )
    review_status: ReviewStatus = Field(
        default=ReviewStatus.PENDING,
        description="审核状态",
    )
    reviewer_notes: Optional[str] = Field(
        default=None,
        description="审核备注",
        max_length=2000,
    )
    reviewed_at: Optional[str] = Field(
        default=None,
        description="审核时间（ISO格式）",
    )
    reviewed_by: Optional[str] = Field(
        default=None,
        description="审核人标识",
        max_length=200,
    )
    tags: list[str] = Field(
        default_factory=list,
        description="标签列表，用于分类和过滤",
        max_length=20,
    )
    related_record_ids: list[str] = Field(
        default_factory=list,
        description="关联的修正记录 ID 列表",
    )


# ============================================================
# 三链修正对（完整模型）
# ============================================================

class TripleChainRecord(BaseModel):
    """三链修正记录 - 完整数据模型

    包含输入链（InputChain）、输出链（OutputChain）、逻辑链（LogicChain）和元数据。
    """
    # 基础信息
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: CorrectionType = CorrectionType.CORRECTION_PAIR
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    # 三链
    input_chain: InputChain
    output_chain: OutputChain
    logic_chain: LogicChain

    # 元数据
    metadata: TripleChainMetadata = Field(default_factory=TripleChainMetadata)

    # ---- 派生属性 ----

    @property
    def embedding_text(self) -> str:
        """生成用于向量检索的文本"""
        parts = [
            f"输入: {self.input_chain.extracted_context}",
            f"错误输出: {self.output_chain.wrong_output}",
            f"正确输出: {self.output_chain.correct_output}",
            f"错误原因: {self.logic_chain.wrong_reason}",
        ]
        if self.logic_chain.correct_reason:
            parts.append(f"正确原因: {self.logic_chain.correct_reason}")
        if self.logic_chain.wrong_cot:
            parts.append(f"错误思维链: {self.logic_chain.wrong_cot}")
        if self.logic_chain.correct_cot:
            parts.append(f"正确思维链: {self.logic_chain.correct_cot}")
        if self.metadata.tags:
            parts.append(f"标签: {', '.join(self.metadata.tags)}")
        return "\n".join(parts)

    @property
    def preview_text(self) -> str:
        """生成预览文本（截断版）"""
        ctx = self.input_chain.extracted_context[:100]
        wrong = self.output_chain.wrong_output[:100]
        correct = self.output_chain.correct_output[:100]
        return (
            f"输入: {ctx}{'...' if len(self.input_chain.extracted_context) > 100 else ''}\n"
            f"错误: {wrong}{'...' if len(self.output_chain.wrong_output) > 100 else ''}\n"
            f"正确: {correct}{'...' if len(self.output_chain.correct_output) > 100 else ''}"
        )

    def to_metadata(self) -> dict:
        """转换为 ChromaDB metadata（受 metadata 长度限制）"""
        return {
            "type": self.type.value,
            "priority": self.metadata.priority.value,
            "review_status": self.metadata.review_status.value,
            "quality_score": self.output_chain.quality_score,
            "extracted_context": self.input_chain.extracted_context[:500],
            "tags": ",".join(self.metadata.tags) if self.metadata.tags else "",
            "created_at": self.created_at,
            "wrong_reason": self.logic_chain.wrong_reason[:500],
        }

    def to_json(self) -> str:
        """序列化为 JSON 字符串"""
        return json.dumps(self.model_dump(), ensure_ascii=False, indent=2)


# ============================================================
# 行为规则（简化版三链）
# ============================================================

class BehaviorRuleInputChain(BaseModel):
    """行为规则输入链"""
    trigger_condition: str = Field(
        ...,
        description="触发条件：什么情况下应用此规则",
        min_length=1,
        max_length=2000,
    )
    scenario_description: str = Field(
        ...,
        description="场景描述",
        min_length=1,
        max_length=2000,
    )


class BehaviorRuleOutputChain(BaseModel):
    """行为规则输出链"""
    rule_content: str = Field(
        ...,
        description="规则内容：应该做什么或不应该做什么",
        min_length=1,
        max_length=5000,
    )
    rule_type: str = Field(
        default="must",
        description="规则级别：must / must_not / should / should_not",
        pattern=r"^(must|must_not|should|should_not)$",
    )


class BehaviorRuleLogicChain(BaseModel):
    """行为规则逻辑链"""
    reason: Optional[str] = Field(
        default=None,
        description="为什么需要这条规则",
        max_length=2000,
    )
    examples: Optional[str] = Field(
        default=None,
        description="规则应用示例",
        max_length=5000,
    )


class BehaviorRuleRecord(BaseModel):
    """行为规则记录（简化版三链）"""
    # 基础信息
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: CorrectionType = CorrectionType.BEHAVIOR_RULE
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    # 简化版三链
    input_chain: BehaviorRuleInputChain
    output_chain: BehaviorRuleOutputChain
    logic_chain: BehaviorRuleLogicChain = Field(default_factory=BehaviorRuleLogicChain)

    # 元数据
    metadata: TripleChainMetadata = Field(default_factory=TripleChainMetadata)

    @property
    def embedding_text(self) -> str:
        """生成用于向量检索的文本"""
        parts = [
            f"触发条件: {self.input_chain.trigger_condition}",
            f"场景: {self.input_chain.scenario_description}",
            f"规则内容: {self.output_chain.rule_content}",
            f"规则类型: {self.output_chain.rule_type}",
        ]
        if self.logic_chain.reason:
            parts.append(f"原因: {self.logic_chain.reason}")
        if self.metadata.tags:
            parts.append(f"标签: {', '.join(self.metadata.tags)}")
        return "\n".join(parts)

    @property
    def preview_text(self) -> str:
        """生成预览文本"""
        trigger = self.input_chain.trigger_condition[:100]
        content = self.output_chain.rule_content[:100]
        return (
            f"触发条件: {trigger}{'...' if len(self.input_chain.trigger_condition) > 100 else ''}\n"
            f"规则内容: {content}{'...' if len(self.output_chain.rule_content) > 100 else ''}"
        )

    def to_metadata(self) -> dict:
        """转换为 ChromaDB metadata"""
        return {
            "type": self.type.value,
            "rule_type": self.output_chain.rule_type,
            "priority": self.metadata.priority.value,
            "review_status": self.metadata.review_status.value,
            "trigger_condition": self.input_chain.trigger_condition[:500],
            "tags": ",".join(self.metadata.tags) if self.metadata.tags else "",
            "created_at": self.created_at,
        }

    def to_json(self) -> str:
        """序列化为 JSON 字符串"""
        return json.dumps(self.model_dump(), ensure_ascii=False, indent=2)


# ============================================================
# 检索结果
# ============================================================

class SearchResult(BaseModel):
    """单条检索结果"""
    id: str
    type: CorrectionType
    content: str
    metadata: dict
    distance: float

    def format_as_context(self) -> str:
        """格式化为可注入 LLM 上下文的文本"""
        similarity = 1 - self.distance

        if self.type == CorrectionType.CORRECTION_PAIR:
            ctx = self.metadata.get("extracted_context", "")
            wrong_reason = self.metadata.get("wrong_reason", "")
            quality = self.metadata.get("quality_score", "")

            parts = [
                f"📋 修正示例 (相似度: {similarity:.2f}, 质量评分: {quality})",
                f"场景: {ctx}",
                f"---",
                f"{self.content}",
            ]
            if wrong_reason:
                parts.append("")
                parts.append(f"💡 错误原因: {wrong_reason}")
            return "\n".join(parts)
        else:
            rule_type = self.metadata.get("rule_type", "must")
            trigger = self.metadata.get("trigger_condition", "")
            priority = self.metadata.get("priority", "P1")
            label = {
                "must": "🔴 必须遵守",
                "must_not": "🚫 禁止做",
                "should": "🟡 建议做",
                "should_not": "⚠️ 建议不做",
            }
            return (
                f"{label.get(rule_type, '📌 规则')} (相似度: {similarity:.2f}, 优先级: {priority})\n"
                f"触发条件: {trigger}\n"
                f"---\n"
                f"{self.content}"
            )


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


# ============================================================
# MCP 工具输入模型
# ============================================================

class AddCorrectionToolInput(BaseModel):
    """rlc_add_correction 工具的输入模型（三链版）"""
    model_config = ConfigDict(str_strip_whitespace=True)

    # 输入链
    raw_input: str = Field(
        ...,
        description="原始用户输入/问题",
        min_length=1,
        max_length=5000,
    )
    extracted_context: str = Field(
        ...,
        description="提取的场景上下文（精炼的场景描述）",
        min_length=1,
        max_length=2000,
    )

    # 输出链
    wrong_output: str = Field(
        ...,
        description="模型的错误输出",
        min_length=1,
        max_length=10000,
    )
    correct_output: str = Field(
        ...,
        description="期望的正确输出",
        min_length=1,
        max_length=10000,
    )
    quality_score: int = Field(
        default=50,
        ge=0,
        le=100,
        description="质量评分 0-100（越高表示修正越重要）",
    )

    # 逻辑链
    wrong_reason: str = Field(
        ...,
        description="为什么这是错误的",
        min_length=1,
        max_length=2000,
    )
    correct_reason: Optional[str] = Field(
        default=None,
        description="为什么正确输出更好",
        max_length=2000,
    )
    wrong_cot: Optional[str] = Field(
        default=None,
        description="模型得出错误输出时的思维链（JSON字符串数组）",
        max_length=10000,
    )
    correct_cot: Optional[str] = Field(
        default=None,
        description="正确的思维链/推理过程（JSON字符串数组）",
        max_length=10000,
    )

    # 元数据
    priority: str = Field(
        default="P1",
        description="优先级：P0（关键）/ P1（重要）/ P2（次要）",
        pattern=r"^(P0|P1|P2)$",
    )
    tags: Optional[list[str]] = Field(
        default=None,
        description="标签列表用于分类过滤",
    )


class AddRuleToolInput(BaseModel):
    """rlc_add_rule 工具的输入模型（三链版）"""
    model_config = ConfigDict(str_strip_whitespace=True)

    # 输入链
    trigger_condition: str = Field(
        ...,
        description="触发条件，什么情况下应用此规则",
        min_length=1,
        max_length=2000,
    )
    scenario_description: str = Field(
        default="",
        description="场景描述（如不填则使用触发条件）",
        max_length=2000,
    )

    # 输出链
    rule_content: str = Field(
        ...,
        description="规则内容，应该做什么或不应该做什么",
        min_length=1,
        max_length=5000,
    )
    rule_type: str = Field(
        default="must",
        description="规则级别：must / must_not / should / should_not",
        pattern=r"^(must|must_not|should|should_not)$",
    )

    # 逻辑链
    reason: Optional[str] = Field(
        default=None,
        description="为什么需要这条规则",
        max_length=2000,
    )
    examples: Optional[str] = Field(
        default=None,
        description="规则应用示例",
        max_length=5000,
    )

    # 元数据
    priority: str = Field(
        default="P1",
        description="优先级：P0 / P1 / P2",
        pattern=r"^(P0|P1|P2)$",
    )
    tags: Optional[list[str]] = Field(
        default=None,
        description="标签列表用于分类过滤",
    )


class SearchToolInput(BaseModel):
    """rlc_search 工具的输入模型"""
    model_config = ConfigDict(str_strip_whitespace=True)

    query: str = Field(
        ...,
        description="检索查询文本",
        min_length=1,
        max_length=5000,
    )
    top_k: int = Field(default=5, ge=1, le=20)
    filter_type: Optional[str] = Field(
        default=None,
        pattern=r"^(correction_pair|behavior_rule)?$",
    )
    filter_tags: Optional[list[str]] = Field(default=None)
    filter_priority: Optional[str] = Field(
        default=None,
        description="按优先级过滤：P0 / P1 / P2",
        pattern=r"^(P0|P1|P2)?$",
    )
    output_format: str = Field(
        default="markdown",
        pattern=r"^(markdown|json)$",
    )


class ListAllToolInput(BaseModel):
    """rlc_list_all 工具的输入模型"""
    model_config = ConfigDict(str_strip_whitespace=True)

    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    filter_type: Optional[str] = Field(
        default=None,
        pattern=r"^(correction_pair|behavior_rule)?$",
    )
    filter_priority: Optional[str] = Field(
        default=None,
        description="按优先级过滤：P0 / P1 / P2",
        pattern=r"^(P0|P1|P2)?$",
    )
    filter_review_status: Optional[str] = Field(
        default=None,
        description="按审核状态过滤：pending / approved / rejected",
        pattern=r"^(pending|approved|rejected)?$",
    )


class DeleteToolInput(BaseModel):
    """rlc_delete 工具的输入模型"""
    model_config = ConfigDict(str_strip_whitespace=True)

    record_id: str = Field(..., min_length=1)


class GetRecordToolInput(BaseModel):
    """rlc_get_record 工具的输入模型"""
    model_config = ConfigDict(str_strip_whitespace=True)

    record_id: str = Field(
        ...,
        description="要查询的修正记录 ID",
        min_length=1,
    )


class ReviewRecordToolInput(BaseModel):
    """rlc_review_record 工具的输入模型"""
    model_config = ConfigDict(str_strip_whitespace=True)

    record_id: str = Field(
        ...,
        description="要审核的记录 ID",
        min_length=1,
    )
    action: str = Field(
        ...,
        description="审核动作：approve（通过）或 reject（拒绝）",
        pattern=r"^(approve|reject)$",
    )
    reviewer_notes: Optional[str] = Field(
        default=None,
        description="审核备注",
        max_length=2000,
    )
    reviewer_id: Optional[str] = Field(
        default=None,
        description="审核人标识",
        max_length=200,
    )


class UpdateLogicChainToolInput(BaseModel):
    """rlc_update_logic_chain 工具的输入模型"""
    model_config = ConfigDict(str_strip_whitespace=True)

    record_id: str = Field(
        ...,
        description="要更新的记录 ID",
        min_length=1,
    )
    wrong_reason: Optional[str] = Field(
        default=None,
        description="更新错误原因",
        max_length=2000,
    )
    correct_reason: Optional[str] = Field(
        default=None,
        description="更新正确原因",
        max_length=2000,
    )
    wrong_cot: Optional[str] = Field(
        default=None,
        description="更新错误思维链",
        max_length=10000,
    )
    correct_cot: Optional[str] = Field(
        default=None,
        description="更新正确思维链",
        max_length=10000,
    )
    alternative_approaches: Optional[str] = Field(
        default=None,
        description="更新其他可能方法",
        max_length=5000,
    )
    update_notes: Optional[str] = Field(
        default=None,
        description="更新说明（记录为什么修改逻辑链）",
        max_length=2000,
    )

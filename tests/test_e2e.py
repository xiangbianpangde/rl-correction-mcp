#!/usr/bin/env python3
"""
端到端测试 - 验证 RL Correction MCP 的完整功能流程

使用 mock embedding 来避免依赖真实 OpenAI API
"""

import sys
import os
import json
import tempfile
import shutil

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from unittest.mock import patch, MagicMock


class MockEmbeddingFunction:
    """Mock Embedding Function，符合 ChromaDB 的 EmbeddingFunction 接口"""

    def __call__(self, input: list[str]) -> list[list[float]]:
        return [[0.1] * 1536 for _ in input]

    def name(self) -> str:
        return "mock-embedding"

    def embed_documents(self, input: list[str]) -> list[list[float]]:
        return [[0.1] * 1536 for _ in input]

    def embed_query(self, input: list[str]) -> list[list[float]]:
        return [[0.1] * 1536 for _ in input]


def test_full_workflow():
    """测试完整的修正记录工作流"""

    print("=" * 60)
    print("RL Correction MCP - 端到端测试")
    print("=" * 60)

    # 使用临时目录
    tmp_dir = tempfile.mkdtemp()
    persist_path = os.path.join(tmp_dir, "chroma_test")

    try:
        mock_ef = MockEmbeddingFunction()

        # 1. 初始化 Store
        print("\n📦 步骤 1: 初始化存储层...")
        with patch("rl_correction_mcp.store.embedding_functions") as mock_ef_module:
            mock_ef_module.OpenAIEmbeddingFunction.return_value = mock_ef

            from rl_correction_mcp.store import CorrectionStore
            store = CorrectionStore(persist_path=persist_path, api_key="test-key")

        count = store.collection.count()
        print(f"   当前记录数: {count}")
        assert count == 0, "初始应为空"
        print("   ✅ 存储层初始化成功")

        # 2. 添加修正对
        print("\n📝 步骤 2: 添加修正对...")
        from rl_correction_mcp.models import CorrectionPairInput

        pair = store.add_correction_pair(CorrectionPairInput(
            scenario="用户询问 Python 如何反转字符串",
            wrong_output="使用 string.reverse() 方法",
            correct_output="使用 string[::-1] 切片语法，或 ''.join(reversed(string))",
            reason="Python 的 str 对象没有 reverse() 方法，那是 list 的方法",
            tags=["python", "string", "common-mistake"],
        ))
        print(f"   添加成功: id={pair.id[:8]}...")
        assert pair.id is not None
        assert store.collection.count() == 1
        print("   ✅ 修正对添加成功")

        # 3. 添加行为规则
        print("\n📜 步骤 3: 添加行为规则...")
        from rl_correction_mcp.models import BehaviorRuleInput

        rule = store.add_behavior_rule(BehaviorRuleInput(
            trigger_condition="当用户询问涉及医疗、法律、金融等专业领域的问题时",
            rule_content="必须在回复开头声明：'我是一个AI助手，不是专业医生/律师/金融顾问。以下信息仅供参考，请咨询专业人士。'",
            rule_type="must",
            reason="避免用户将 AI 回复当作专业建议，造成潜在危害",
            tags=["safety", "disclaimer"],
        ))
        print(f"   添加成功: id={rule.id[:8]}...")
        assert store.collection.count() == 2
        print("   ✅ 行为规则添加成功")

        # 再添加一条规则
        rule2 = store.add_behavior_rule(BehaviorRuleInput(
            trigger_condition="当用户要求生成代码时",
            rule_content="生成的代码必须包含基本的错误处理和注释",
            rule_type="should",
            tags=["code-quality"],
        ))
        print(f"   添加第二条规则: id={rule2.id[:8]}...")

        # 4. 检索测试
        print("\n🔍 步骤 4: 测试 RAG 检索...")
        from rl_correction_mcp.retriever import CorrectionRetriever
        from rl_correction_mcp.models import SearchInput

        retriever = CorrectionRetriever(store)

        results = retriever.search(SearchInput(
            query="Python 字符串操作",
            top_k=3,
        ))
        print(f"   检索到 {len(results)} 条结果")
        for r in results:
            print(f"   - [{r.type.value}] id={r.id[:8]}... distance={r.distance:.4f}")
        assert len(results) > 0
        print("   ✅ RAG 检索成功")

        # 5. 格式化输出测试
        print("\n📄 步骤 5: 测试格式化输出...")
        formatted = retriever.search_and_format(SearchInput(
            query="医疗建议",
            top_k=5,
        ))
        print(f"   格式化输出长度: {len(formatted)} 字符")
        assert "行为规则" in formatted or "修正" in formatted
        print("   ✅ 格式化输出成功")

        # 6. 列出所有记录
        print("\n📋 步骤 6: 列出所有记录...")
        all_records = store.list_all(limit=10)
        print(f"   总记录数: {all_records['total']}")
        print(f"   当前页: {all_records['count']} 条")
        for r in all_records["records"]:
            print(f"   - [{r['type']}] {r['id'][:8]}...")
        assert all_records["total"] == 3
        print("   ✅ 列出记录成功")

        # 7. 按类型过滤
        print("\n🎯 步骤 7: 按类型过滤...")
        rules_only = store.list_all(limit=10, filter_type="behavior_rule")
        print(f"   行为规则数: {rules_only['total']}")
        assert rules_only["total"] == 2
        pairs_only = store.list_all(limit=10, filter_type="correction_pair")
        print(f"   修正对数: {pairs_only['total']}")
        assert pairs_only["total"] == 1
        print("   ✅ 类型过滤成功")

        # 8. 统计信息
        print("\n📊 步骤 8: 获取统计信息...")
        stats = store.get_stats()
        print(f"   总记录: {stats['total_records']}")
        print(f"   修正对: {stats['correction_pairs']}")
        print(f"   行为规则: {stats['behavior_rules']}")
        print(f"   标签: {stats['all_tags']}")
        assert stats["total_records"] == 3
        assert stats["correction_pairs"] == 1
        assert stats["behavior_rules"] == 2
        print("   ✅ 统计信息正确")

        # 9. 删除记录
        print("\n🗑️  步骤 9: 删除记录...")
        deleted = store.delete(rule2.id)
        assert deleted is True
        print(f"   删除成功: id={rule2.id[:8]}...")
        assert store.collection.count() == 2
        print("   ✅ 删除成功")

        # 10. 验证持久化（重新加载）
        print("\n💾 步骤 10: 验证持久化...")
        with patch("rl_correction_mcp.store.embedding_functions") as mock_ef_module2:
            mock_ef_module2.OpenAIEmbeddingFunction.return_value = mock_ef

            store2 = CorrectionStore(persist_path=persist_path, api_key="test-key")

        count_after_reload = store2.collection.count()
        print(f"   重新加载后记录数: {count_after_reload}")
        assert count_after_reload == 2
        print("   ✅ 持久化验证成功")

        print("\n" + "=" * 60)
        print("🎉 所有测试通过！")
        print("=" * 60)

    finally:
        # 清理临时目录
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    test_full_workflow()

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

    def test_invalid_quality_score_min(self):
        """测试无效质量评分最小值"""
        with pytest.raises(Exception):
            AdvancedSearchFilters(quality_score_min=150)

    def test_invalid_quality_score_max(self):
        """测试无效质量评分最大值"""
        with pytest.raises(Exception):
            AdvancedSearchFilters(quality_score_max=150)

    def test_invalid_quality_score_negative(self):
        """测试负数质量评分"""
        with pytest.raises(Exception):
            AdvancedSearchFilters(quality_score_min=-10)

    def test_create_filters_with_all_options(self):
        """测试创建带所有选项的过滤器"""
        filters = AdvancedSearchFilters(
            tags=["内分泌"],
            tags_any=["糖尿病"],
            priority=["P0", "P1"],
            quality_score_min=50,
            quality_score_max=90,
            review_status="pending",
            type="correction_pair"
        )
        assert filters.tags == ["内分泌"]
        assert filters.tags_any == ["糖尿病"]
        assert filters.priority == ["P0", "P1"]
        assert filters.quality_score_min == 50
        assert filters.quality_score_max == 90
        assert filters.review_status == "pending"
        assert filters.type == "correction_pair"

    def test_invalid_review_status(self):
        """测试无效的审核状态"""
        with pytest.raises(Exception):
            AdvancedSearchFilters(review_status="invalid_status")

    def test_invalid_type(self):
        """测试无效的类型"""
        with pytest.raises(Exception):
            AdvancedSearchFilters(type="invalid_type")


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

    def test_create_search_input_minimal(self):
        """测试创建最小搜索输入"""
        params = SearchInput(query="测试查询")
        assert params.query == "测试查询"
        assert params.top_k == 5
        assert params.filters is None

    def test_search_input_with_priority_filter(self):
        """测试带优先级过滤的搜索输入"""
        params = SearchInput(
            query="药物相互作用",
            filter_priority="P0"
        )
        assert params.query == "药物相互作用"
        assert params.filter_priority == "P0"

    def test_search_input_invalid_priority(self):
        """测试无效的优先级过滤"""
        with pytest.raises(Exception):
            SearchInput(
                query="测试",
                filter_priority="P3"
            )

    def test_search_input_invalid_top_k(self):
        """测试无效的 top_k 参数"""
        with pytest.raises(Exception):
            SearchInput(
                query="测试",
                top_k=100
            )


class TestFilterOption:
    """测试过滤选项模型"""

    def test_create_filter_option(self):
        """测试创建过滤选项"""
        option = FilterOption(value="P0", label="P0 - 关键")
        assert option.value == "P0"
        assert option.label == "P0 - 关键"
        assert option.count is None

    def test_create_filter_option_with_count(self):
        """测试创建带数量的过滤选项"""
        option = FilterOption(value="内分泌", label="内分泌", count=15)
        assert option.value == "内分泌"
        assert option.count == 15


class TestFilterDefinition:
    """测试过滤器定义模型"""

    def test_create_multiselect_filter(self):
        """测试创建多选过滤器"""
        filter_def = FilterDefinition(
            name="tags",
            label="标签",
            type="multiselect",
            options=[
                FilterOption(value="内分泌", label="内分泌"),
                FilterOption(value="药理", label="药理")
            ]
        )
        assert filter_def.name == "tags"
        assert filter_def.type == "multiselect"
        assert len(filter_def.options) == 2

    def test_create_range_filter(self):
        """测试创建范围过滤器"""
        filter_def = FilterDefinition(
            name="quality_score",
            label="质量评分",
            type="range",
            min=0,
            max=100
        )
        assert filter_def.name == "quality_score"
        assert filter_def.type == "range"
        assert filter_def.min == 0
        assert filter_def.max == 100


class TestRetrieverInterface:
    """测试检索器接口"""

    def test_get_available_filters(self, tmp_path):
        """测试获取可用过滤器"""
        store = TripleChainStore(
            persist_path=str(tmp_path / "test_chroma"),
            api_key="dummy-key",  # 使用 dummy key 强制使用本地模型
            embedding_model="sentence-transformers/all-MiniLM-L6-v2"
        )
        retriever = CorrectionRetriever(store)
        filters = retriever.get_available_filters()

        assert len(filters) > 0
        filter_names = [f.name for f in filters]
        assert "tags" in filter_names
        assert "priority" in filter_names
        assert "quality_score" in filter_names

    def test_filter_definition_structure(self, tmp_path):
        """测试过滤器定义结构"""
        store = TripleChainStore(
            persist_path=str(tmp_path / "test_chroma"),
            api_key="dummy-key",  # 使用 dummy key 强制使用本地模型
            embedding_model="sentence-transformers/all-MiniLM-L6-v2"
        )
        retriever = CorrectionRetriever(store)
        filters = retriever.get_available_filters()

        tags_filter = next(f for f in filters if f.name == "tags")
        assert tags_filter.type == "multiselect"

        quality_filter = next(f for f in filters if f.name == "quality_score")
        assert quality_filter.type == "range"
        assert quality_filter.min == 0
        assert quality_filter.max == 100

    def test_search_with_filters(self, tmp_path):
        """测试带过滤器的搜索"""
        store = TripleChainStore(
            persist_path=str(tmp_path / "test_chroma"),
            api_key="dummy-key",  # 使用 dummy key 强制使用本地模型
            embedding_model="sentence-transformers/all-MiniLM-L6-v2"
        )
        retriever = CorrectionRetriever(store)

        filters = AdvancedSearchFilters(
            quality_score_min=50,
            quality_score_max=90
        )
        params = SearchInput(
            query="测试查询",
            top_k=5,
            filters=filters
        )
        results = retriever.search(params)
        assert isinstance(results, list)

    def test_search_returns_search_results(self, tmp_path):
        """测试搜索返回 SearchResult 对象"""
        store = TripleChainStore(
            persist_path=str(tmp_path / "test_chroma"),
            api_key="dummy-key",  # 使用 dummy key 强制使用本地模型
            embedding_model="sentence-transformers/all-MiniLM-L6-v2"
        )
        retriever = CorrectionRetriever(store)

        params = SearchInput(query="测试查询")
        results = retriever.search(params)
        
        assert isinstance(results, list)
        for result in results:
            assert hasattr(result, 'id')
            assert hasattr(result, 'distance')


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""KU-AI RAG 检索单元测试。"""

from __future__ import annotations

import pytest

from apps.kuaiai.retrieval.base import RAG_BACKEND_LLAMAINDEX, RAG_BACKEND_NATIVE
from apps.kuaiai.retrieval.chunk_store import chunk_to_result
from apps.kuaiai.services.embedding_service import EmbeddingService, tokenize
from core.utils.integration_settings import normalize_rag_backend


SOP_FAQ_SAMPLES = [
    {
        "title": "首件检验 SOP",
        "question": "首件检验什么时候做",
        "answer": "每班开机、换型、工艺参数变更后须做首件检验，合格后方可批量生产。",
        "query": "换型后要不要首件",
    },
    {
        "title": "报工规范",
        "question": "报工数量填什么",
        "answer": "报工数量填写本工序实际合格产出，不含待检与报废数量。",
        "query": "报工填合格数还是产出数",
    },
    {
        "title": "采购交期跟进",
        "question": "采购订单延误怎么处理",
        "answer": "确认供应商最新交期，评估对工单开工影响，必要时发起插单或替代料评审。",
        "query": "采购延误影响生产怎么办",
    },
]


class TestNormalizeRagBackend:
    def test_default_native(self):
        assert normalize_rag_backend(None) == RAG_BACKEND_NATIVE
        assert normalize_rag_backend("") == RAG_BACKEND_NATIVE
        assert normalize_rag_backend("unknown") == RAG_BACKEND_NATIVE

    def test_llamaindex(self):
        assert normalize_rag_backend("llamaindex") == RAG_BACKEND_LLAMAINDEX
        assert normalize_rag_backend("LlamaIndex") == RAG_BACKEND_LLAMAINDEX


class TestEmbeddingScoring:
    def test_keyword_overlap_scores_related_content_higher(self):
        sample = SOP_FAQ_SAMPLES[0]
        content = f"问：{sample['question']}\n答：{sample['answer']}"
        related = EmbeddingService.score_chunk(sample["query"], content, None, None)
        unrelated = EmbeddingService.score_chunk(sample["query"], "库存盘点周期为每月一次", None, None)
        assert related > unrelated

    def test_dense_cosine_prefers_similar_vectors(self):
        q = [1.0, 0.0, 0.0]
        near = [0.9, 0.1, 0.0]
        far = [0.0, 1.0, 0.0]
        assert EmbeddingService.score_chunk("ignored", "ignored", near, q) > EmbeddingService.score_chunk(
            "ignored", "ignored", far, q
        )


class TestChunkResultShape:
    def test_chunk_to_result_keys(self):
        class FakeDoc:
            title = "测试文档"

        class FakeChunk:
            document_id = 1
            chunk_index = 0
            content = "内容"
            id = 99

        result = chunk_to_result(score=0.88, chunk=FakeChunk(), doc_map={1: FakeDoc()})
        assert result["score"] == 0.88
        assert result["document_id"] == 1
        assert result["document_title"] == "测试文档"
        assert result["chunk_index"] == 0
        assert result["content"] == "内容"
        assert result["chunk_id"] == 99


class TestSopFaqSampleLexicon:
    """样本集：制造 SOP/FAQ 关键词应能命中对应语料。"""

    @pytest.mark.parametrize("sample", SOP_FAQ_SAMPLES)
    def test_query_tokens_overlap_answer(self, sample):
        body = f"{sample['question']} {sample['answer']}"
        q_tokens = set(tokenize(sample["query"]))
        body_tokens = set(tokenize(body))
        overlap = q_tokens & body_tokens
        assert overlap, f"样本 {sample['title']} 查询与正文无词重叠"

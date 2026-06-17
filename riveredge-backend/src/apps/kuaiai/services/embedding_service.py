"""文本向量化：DeepSeek Embeddings + 关键词回退。"""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any

import httpx
from loguru import logger

from infra.infrastructure.http import get_http_client

DEEPSEEK_EMBEDDING_MODEL = "deepseek-embedding-v2"
_TOKEN_RE = re.compile(r"[\u4e00-\u9fff]|[a-zA-Z0-9]+")


def tokenize(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text or "") if t.strip()]


def keyword_vector(text: str) -> dict[str, float]:
    tokens = tokenize(text)
    if not tokens:
        return {}
    counts = Counter(tokens)
    total = float(sum(counts.values()))
    return {k: v / total for k, v in counts.items()}


def cosine_sparse(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(a.get(k, 0.0) * b.get(k, 0.0) for k in a.keys() & b.keys())
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def cosine_dense(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class EmbeddingService:
    @staticmethod
    async def embed_texts(
        texts: list[str],
        *,
        api_key: str,
        base_url: str,
        use_api: bool = True,
    ) -> list[dict[str, Any] | list[float] | None]:
        if not texts:
            return []
        if not use_api:
            return [keyword_vector(t) for t in texts]

        url = f"{base_url.rstrip('/')}/embeddings"
        client = get_http_client()
        try:
            response = await client.post(
                url,
                json={"model": DEEPSEEK_EMBEDDING_MODEL, "input": texts},
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                timeout=60.0,
            )
            if response.status_code >= 400:
                logger.warning("DeepSeek embeddings 失败 status={} body={}", response.status_code, response.text[:200])
                return [keyword_vector(t) for t in texts]
            body = response.json()
            data = body.get("data") or []
            sorted_data = sorted(data, key=lambda x: int(x.get("index", 0)))
            vectors: list[dict[str, float] | list[float] | None] = []
            for item in sorted_data:
                emb = item.get("embedding")
                if isinstance(emb, list) and emb:
                    vectors.append([float(x) for x in emb])
                else:
                    vectors.append(None)
            while len(vectors) < len(texts):
                vectors.append(keyword_vector(texts[len(vectors)]))
            return vectors
        except (httpx.RequestError, ValueError) as exc:
            logger.warning("DeepSeek embeddings 请求异常: {}", exc)
            return [keyword_vector(t) for t in texts]

    @staticmethod
    def score_chunk(
        query: str,
        chunk_content: str,
        embedding: Any | None,
        query_vector: Any | None,
    ) -> float:
        if isinstance(embedding, list) and isinstance(query_vector, list):
            return cosine_dense(query_vector, embedding)
        if isinstance(embedding, dict) and isinstance(query_vector, dict):
            return cosine_sparse(query_vector, embedding)
        # 关键词回退
        q_tokens = set(tokenize(query))
        c_tokens = set(tokenize(chunk_content))
        if not q_tokens:
            return 0.0
        overlap = len(q_tokens & c_tokens)
        return overlap / len(q_tokens)

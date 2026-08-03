# KU-AI 知识库 RAG 检索

## 概述

KU-Know 知识库检索通过 **RetrievalBackend** 适配层实现，支持两种引擎：

| 引擎 | 配置值 | 说明 |
|------|--------|------|
| 原生 | `native` | 固定滑窗分块 + 内存/pgvector 检索（默认） |
| LlamaIndex | `llamaindex` | SentenceSplitter 分块 + LlamaIndex 向量检索 |

站点配置路径：`settings.integrations.deepseek.rag_backend`

## 架构

```
RagService.build_context_for_query
  → KnowledgeService.search_chunks
  → RetrievalBackendFactory.for_tenant
  → NativeRetrievalBackend | LlamaIndexRetrievalBackend
  → chunk_store（PostgreSQL apps_kuaiai_knowledge_chunks）
```

**不变契约**

- 对外 API：`GET /api/v1/apps/kuaiai/knowledge/search` 响应字段不变
- 权限：`kuaiai:knowledge:read`（检索）、创建/更新文档触发索引
- 租户隔离：所有 SQL / 内存过滤必须带 `tenant_id`

## 配置项

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `rag_enabled` | bool | true | 关闭后检索返回空 |
| `rag_use_embedding` | bool | true | 使用 DeepSeek Embedding |
| `rag_backend` | string | `native` | `native` 或 `llamaindex` |
| `rag_top_k` | int | 5 | 注入 KU-Ask 的片段数 |

## LlamaIndex 部署

```bash
cd riveredge-backend
uv sync --extra kuaiai-rag
```

未安装 extra 但配置为 `llamaindex` 时，索引/检索会返回明确配置错误。

## pgvector（Phase 3）

迁移 `517_20260804000000_kuaiai_chunk_pgvector` 会执行 `CREATE EXTENSION vector`，并增加 `embedding_vector vector(768)` 列。

**系统前提（安装脚本已处理）**：应用库所在 PostgreSQL 实例必须能 `CREATE EXTENSION vector`（以 `pg_available_extensions` 为准）。仅装 apt 包但库是宝塔 `/www/server/pgsql` 时无效。

| 场景 | 安装方式 |
|------|----------|
| Debian/Ubuntu 系统包 PG | `postgresql-N-pgvector`（PGDG） |
| RHEL/Rocky 系统包 PG | `pgvector_N`（PGDG） |
| 宝塔 PostgreSQL（`/www/server/pgsql`） | 按该实例 `pg_config` **源码编译**安装 |

`fast-deploy` 在 `migrate` 前：`ensure_postgresql_pgvector`（系统扩展）→ `ensure_vector_extension_created`（超级用户 `CREATE EXTENSION`，因业务账号通常无此权限）→ `aerich upgrade`。远程 `DB_HOST` 无法在本机代装，需在库所在主机安装并启用。

- 维度与 DeepSeek `deepseek-embedding-v2` 一致（768）
- 索引写入时双写 JSON `embedding` + `embedding_vector`
- 检索优先 ANN，无 vector 列时回退内存/LlamaIndex 索引

重建索引：

```bash
cd riveredge-backend
PYTHONPATH=src python scripts/reindex_kuaiai_knowledge.py --tenant-id 1
```

## 错误策略

| 路径 | embedding 失败 |
|------|----------------|
| `native` | 保留历史 keyword 回退（tech debt） |
| `llamaindex` | 抛 ValidationError，不 silent 降级 |

## 代码位置

- 协议： `kuaigeyun-pro/backend/apps/kuaiai/retrieval/base.py`
- 工厂： `kuaigeyun-pro/backend/apps/kuaiai/retrieval/factory.py`
- 原生： `kuaigeyun-pro/backend/apps/kuaiai/retrieval/native_backend.py`
- LlamaIndex： `kuaigeyun-pro/backend/apps/kuaiai/retrieval/llamaindex_backend.py`
- 持久化： `kuaigeyun-pro/backend/apps/kuaiai/retrieval/chunk_store.py`

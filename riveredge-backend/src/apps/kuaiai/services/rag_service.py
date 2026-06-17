"""RAG 检索上下文构建（注入 KU-AI 对话）。"""

from __future__ import annotations

from apps.kuaiai.services.knowledge_service import KnowledgeService
from core.services.system.site_setting_service import SiteSettingService
from core.utils.integration_settings import get_deepseek_integration


class RagService:
    @staticmethod
    async def build_context_for_query(*, tenant_id: int, query: str, top_k: int = 5) -> str:
        site_settings = await SiteSettingService.get_settings(tenant_id)
        deepseek = get_deepseek_integration(site_settings.settings or {})
        if deepseek.get("rag_enabled") is False:
            return ""

        chunks = await KnowledgeService.search_chunks(tenant_id=tenant_id, query=query, top_k=top_k)
        if not chunks:
            return ""

        lines = ["以下是与用户问题相关的内部知识库片段，请优先依据这些内容回答；若无相关内容请说明。"]
        for i, item in enumerate(chunks, 1):
            title = item.get("document_title") or "文档"
            lines.append(f"\n[{i}] 《{title}》\n{item.get('content', '')}")
        return "\n".join(lines)

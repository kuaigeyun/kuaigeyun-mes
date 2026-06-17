"""KU-AI 出厂默认 FAQ 种子服务（幂等）。"""

from __future__ import annotations

from loguru import logger

from apps.kuaiai.models.knowledge import KuaiKnowledgeDocument
from apps.kuaiai.services.default_faq_presets import DEFAULT_FAQ_PRESETS, SEED_TITLE_PREFIX
from apps.kuaiai.services.knowledge_service import KnowledgeService


class FaqSeedService:
    @staticmethod
    async def seed_default_faqs(
        tenant_id: int,
        *,
        user_id: int | None = None,
        skip_existing: bool = True,
    ) -> int:
        """
        写入出厂默认 FAQ，按问题文本幂等。

        Returns:
            本次新建条数
        """
        created = 0
        for preset in DEFAULT_FAQ_PRESETS:
            question = preset["question"].strip()
            if skip_existing:
                exists = await KuaiKnowledgeDocument.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                    source_type="faq",
                    faq_question=question,
                ).exists()
                if exists:
                    continue

            title = f"{SEED_TITLE_PREFIX}{preset['title']}"
            try:
                await KnowledgeService.create_faq_document(
                    tenant_id=tenant_id,
                    title=title,
                    question=question,
                    answer=preset["answer"],
                    user_id=user_id,
                    sync_training_sample=True,
                )
                created += 1
            except Exception as exc:
                logger.warning(
                    "KU-AI 默认 FAQ 写入失败 tenant_id={} seed_key={} error={}",
                    tenant_id,
                    preset.get("seed_key"),
                    exc,
                )
        return created

    @staticmethod
    async def count_seeded(tenant_id: int) -> int:
        return await KuaiKnowledgeDocument.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            source_type="faq",
            title__startswith=SEED_TITLE_PREFIX,
        ).count()

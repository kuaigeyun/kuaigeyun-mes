"""微调训练样本导出（JSONL）。"""

from __future__ import annotations

import json
from typing import Any

from apps.kuaiai.models.knowledge import KuaiKnowledgeDocument, KuaiTrainingSample
from core.utils.timezone_utils import to_api_isoformat


class TrainingExportService:
    @staticmethod
    async def list_samples(
        *,
        tenant_id: int,
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        query = KuaiTrainingSample.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, is_active=True
        )
        total = await query.count()
        rows = await query.order_by("-updated_at").offset((page - 1) * page_size).limit(page_size).all()
        return {
            "items": [
                {
                    "id": r.id,
                    "uuid": r.uuid,
                    "question": r.question,
                    "answer": r.answer,
                    "source": r.source,
                    "created_at": to_api_isoformat(r.created_at) if r.created_at else None,
                }
                for r in rows
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    @staticmethod
    async def create_sample(
        *,
        tenant_id: int,
        question: str,
        answer: str,
        source: str = "manual",
        user_id: int | None = None,
    ) -> dict[str, Any]:
        q = (question or "").strip()
        a = (answer or "").strip()
        if not q or not a:
            raise ValueError("问题与答案均不能为空")
        row = await KuaiTrainingSample.create(
            tenant_id=tenant_id,
            question=q,
            answer=a,
            source=(source or "manual").strip()[:30],
            created_by=user_id,
            updated_by=user_id,
        )
        return {"id": row.id, "uuid": row.uuid, "question": row.question, "answer": row.answer, "source": row.source}

    @staticmethod
    async def delete_sample(*, tenant_id: int, sample_id: int) -> None:
        from datetime import datetime, timezone

        row = await KuaiTrainingSample.filter(
            id=sample_id, tenant_id=tenant_id, deleted_at__isnull=True
        ).first()
        if row is None:
            raise ValueError("训练样本不存在")
        row.deleted_at = datetime.now(timezone.utc)
        await row.save()

    @staticmethod
    async def build_jsonl(*, tenant_id: int) -> str:
        lines: list[str] = []

        samples = await KuaiTrainingSample.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, is_active=True
        ).order_by("id").all()
        for s in samples:
            lines.append(
                json.dumps(
                    {
                        "messages": [
                            {"role": "user", "content": s.question},
                            {"role": "assistant", "content": s.answer},
                        ]
                    },
                    ensure_ascii=False,
                )
            )

        faq_docs = await KuaiKnowledgeDocument.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
            source_type="faq",
            status="indexed",
        ).all()
        seen = {(s.question, s.answer) for s in samples}
        for doc in faq_docs:
            pair = (doc.faq_question or "", doc.faq_answer or "")
            if not pair[0] or not pair[1] or pair in seen:
                continue
            seen.add(pair)
            lines.append(
                json.dumps(
                    {
                        "messages": [
                            {"role": "user", "content": pair[0]},
                            {"role": "assistant", "content": pair[1]},
                        ]
                    },
                    ensure_ascii=False,
                )
            )

        return "\n".join(lines)

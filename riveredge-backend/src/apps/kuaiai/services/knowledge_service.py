"""KU-AI 知识库业务服务。"""

from __future__ import annotations

from typing import Any

from apps.common.audit_actor import audit_response_fields
from apps.kuaiai.models.knowledge import KuaiKnowledgeChunk, KuaiKnowledgeDocument, KuaiTrainingSample
from apps.kuaiai.services.embedding_service import EmbeddingService
from apps.kuaiai.services.text_chunker import split_text_chunks
from core.services.file.file_service import FileService
from core.services.system.site_setting_service import SiteSettingService
from core.utils.integration_settings import get_deepseek_integration, is_deepseek_api_key_configured
from core.utils.timezone_utils import to_api_isoformat
from infra.exceptions.exceptions import NotFoundError, ValidationError


_TEXT_EXTENSIONS = {".txt", ".md", ".markdown", ".csv", ".json"}


def _document_to_dict(doc: KuaiKnowledgeDocument) -> dict[str, Any]:
    return {
        "id": doc.id,
        "uuid": doc.uuid,
        "title": doc.title,
        "source_type": doc.source_type,
        "status": doc.status,
        "chunk_count": doc.chunk_count,
        "error_message": doc.error_message,
        "is_active": doc.is_active,
        "file_uuid": doc.file_uuid,
        "faq_question": doc.faq_question,
        "created_at": to_api_isoformat(doc.created_at) if doc.created_at else None,
        "updated_at": to_api_isoformat(doc.updated_at) if doc.updated_at else None,
        **audit_response_fields(doc),
    }


class KnowledgeService:
    @staticmethod
    async def list_documents(
        *,
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        source_type: str | None = None,
        status: str | None = None,
    ) -> dict[str, Any]:
        query = KuaiKnowledgeDocument.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if source_type:
            query = query.filter(source_type=source_type.strip().lower())
        if status:
            query = query.filter(status=status.strip().lower())
        total = await query.count()
        rows = await query.order_by("-updated_at").offset((page - 1) * page_size).limit(page_size).all()
        return {
            "items": [_document_to_dict(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    @staticmethod
    async def get_document(*, tenant_id: int, document_id: int) -> dict[str, Any]:
        doc = await KuaiKnowledgeDocument.filter(
            id=document_id, tenant_id=tenant_id, deleted_at__isnull=True
        ).first()
        if doc is None:
            raise NotFoundError("知识库文档不存在")
        data = _document_to_dict(doc)
        if doc.source_type == "text":
            data["raw_content"] = doc.raw_content
        elif doc.source_type == "faq":
            data["faq_answer"] = doc.faq_answer
        return data

    @staticmethod
    async def create_text_document(
        *,
        tenant_id: int,
        title: str,
        content: str,
        user_id: int | None = None,
    ) -> dict[str, Any]:
        t = (title or "").strip()
        c = (content or "").strip()
        if not t:
            raise ValidationError("标题不能为空")
        if not c:
            raise ValidationError("正文不能为空")
        doc = await KuaiKnowledgeDocument.create(
            tenant_id=tenant_id,
            title=t,
            source_type="text",
            raw_content=c,
            status="pending",
            created_by=user_id,
            updated_by=user_id,
        )
        await KnowledgeService.index_document(tenant_id=tenant_id, document_id=doc.id)
        await doc.refresh_from_db()
        return _document_to_dict(doc)

    @staticmethod
    async def create_faq_document(
        *,
        tenant_id: int,
        title: str,
        question: str,
        answer: str,
        user_id: int | None = None,
        sync_training_sample: bool = True,
    ) -> dict[str, Any]:
        t = (title or "").strip() or (question or "").strip()[:80]
        q = (question or "").strip()
        a = (answer or "").strip()
        if not q or not a:
            raise ValidationError("FAQ 问题与答案均不能为空")
        doc = await KuaiKnowledgeDocument.create(
            tenant_id=tenant_id,
            title=t,
            source_type="faq",
            faq_question=q,
            faq_answer=a,
            raw_content=f"问：{q}\n答：{a}",
            status="pending",
            created_by=user_id,
            updated_by=user_id,
        )
        if sync_training_sample:
            await KuaiTrainingSample.create(
                tenant_id=tenant_id,
                question=q,
                answer=a,
                source="faq",
                created_by=user_id,
                updated_by=user_id,
            )
        await KnowledgeService.index_document(tenant_id=tenant_id, document_id=doc.id)
        await doc.refresh_from_db()
        return _document_to_dict(doc)

    @staticmethod
    async def create_file_document(
        *,
        tenant_id: int,
        title: str,
        file_uuid: str,
        user_id: int | None = None,
    ) -> dict[str, Any]:
        t = (title or "").strip()
        fid = (file_uuid or "").strip()
        if not t:
            raise ValidationError("标题不能为空")
        if not fid:
            raise ValidationError("file_uuid 不能为空")
        doc = await KuaiKnowledgeDocument.create(
            tenant_id=tenant_id,
            title=t,
            source_type="file",
            file_uuid=fid,
            status="pending",
            created_by=user_id,
            updated_by=user_id,
        )
        await KnowledgeService.index_document(tenant_id=tenant_id, document_id=doc.id)
        await doc.refresh_from_db()
        return _document_to_dict(doc)

    @staticmethod
    async def update_document(
        *,
        tenant_id: int,
        document_id: int,
        title: str | None = None,
        content: str | None = None,
        question: str | None = None,
        answer: str | None = None,
        is_active: bool | None = None,
        user_id: int | None = None,
    ) -> dict[str, Any]:
        doc = await KuaiKnowledgeDocument.filter(
            id=document_id, tenant_id=tenant_id, deleted_at__isnull=True
        ).first()
        if doc is None:
            raise NotFoundError("知识库文档不存在")

        if title is not None:
            doc.title = title.strip() or doc.title
        if is_active is not None:
            doc.is_active = is_active
        if doc.source_type == "text" and content is not None:
            doc.raw_content = content.strip()
        if doc.source_type == "faq":
            if question is not None:
                doc.faq_question = question.strip()
            if answer is not None:
                doc.faq_answer = answer.strip()
            q = doc.faq_question or ""
            a = doc.faq_answer or ""
            doc.raw_content = f"问：{q}\n答：{a}"
        doc.updated_by = user_id
        doc.status = "pending"
        await doc.save()
        await KnowledgeService.index_document(tenant_id=tenant_id, document_id=doc.id)
        await doc.refresh_from_db()
        return _document_to_dict(doc)

    @staticmethod
    async def delete_document(*, tenant_id: int, document_id: int) -> None:
        from datetime import datetime, timezone

        doc = await KuaiKnowledgeDocument.filter(
            id=document_id, tenant_id=tenant_id, deleted_at__isnull=True
        ).first()
        if doc is None:
            raise NotFoundError("知识库文档不存在")
        now = datetime.now(timezone.utc)
        await KuaiKnowledgeChunk.filter(document_id=document_id, tenant_id=tenant_id).update(deleted_at=now)
        doc.deleted_at = now
        await doc.save()

    @staticmethod
    async def _resolve_document_text(*, tenant_id: int, doc: KuaiKnowledgeDocument) -> str:
        if doc.source_type in {"text", "faq"}:
            return (doc.raw_content or "").strip()
        if doc.source_type == "file":
            if not doc.file_uuid:
                raise ValidationError("文件文档缺少 file_uuid")
            file_meta = await FileService.get_file_by_uuid(tenant_id, doc.file_uuid)
            name = (file_meta.original_name or "").lower()
            ext = ""
            if "." in name:
                ext = name[name.rfind(".") :]
            if ext and ext not in _TEXT_EXTENSIONS:
                raise ValidationError(f"暂不支持解析 {ext} 文件，请上传 txt/md/csv/json 或改用文本录入")
            raw = await FileService.get_file_content(tenant_id, doc.file_uuid)
            try:
                return raw.decode("utf-8").strip()
            except UnicodeDecodeError:
                return raw.decode("utf-8", errors="ignore").strip()
        raise ValidationError(f"未知来源类型: {doc.source_type}")

    @staticmethod
    async def index_document(*, tenant_id: int, document_id: int) -> None:
        doc = await KuaiKnowledgeDocument.filter(
            id=document_id, tenant_id=tenant_id, deleted_at__isnull=True
        ).first()
        if doc is None:
            raise NotFoundError("知识库文档不存在")

        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        await KuaiKnowledgeChunk.filter(document_id=document_id, tenant_id=tenant_id).update(deleted_at=now)

        try:
            text = await KnowledgeService._resolve_document_text(tenant_id=tenant_id, doc=doc)
            chunks = split_text_chunks(text)
            if not chunks:
                raise ValidationError("文档内容为空，无法建立索引")

            site_settings = await SiteSettingService.get_settings(tenant_id)
            deepseek = get_deepseek_integration(site_settings.settings or {})
            use_embedding = bool(deepseek.get("rag_use_embedding", True)) and is_deepseek_api_key_configured(deepseek)
            api_key = str(deepseek.get("api_key") or "")
            base_url = str(deepseek.get("base_url") or "https://api.deepseek.com")

            vectors = await EmbeddingService.embed_texts(
                chunks,
                api_key=api_key,
                base_url=base_url,
                use_api=use_embedding,
            )

            for idx, (piece, vec) in enumerate(zip(chunks, vectors)):
                await KuaiKnowledgeChunk.create(
                    tenant_id=tenant_id,
                    document_id=document_id,
                    chunk_index=idx,
                    content=piece,
                    char_count=len(piece),
                    embedding=vec,
                )

            doc.status = "indexed"
            doc.chunk_count = len(chunks)
            doc.error_message = None
        except Exception as exc:
            doc.status = "failed"
            doc.chunk_count = 0
            doc.error_message = str(exc)
        await doc.save()

    @staticmethod
    async def search_chunks(
        *,
        tenant_id: int,
        query: str,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        kw = (query or "").strip()
        if not kw:
            return []

        site_settings = await SiteSettingService.get_settings(tenant_id)
        deepseek = get_deepseek_integration(site_settings.settings or {})
        if deepseek.get("rag_enabled") is False:
            return []

        use_embedding = bool(deepseek.get("rag_use_embedding", True)) and is_deepseek_api_key_configured(deepseek)
        api_key = str(deepseek.get("api_key") or "")
        base_url = str(deepseek.get("base_url") or "https://api.deepseek.com")

        query_vecs = await EmbeddingService.embed_texts(
            [kw], api_key=api_key, base_url=base_url, use_api=use_embedding
        )
        query_vec = query_vecs[0] if query_vecs else None

        active_doc_ids = await KuaiKnowledgeDocument.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
            status="indexed",
        ).values_list("id", flat=True)
        if not active_doc_ids:
            return []

        chunks = await KuaiKnowledgeChunk.filter(
            tenant_id=tenant_id,
            document_id__in=list(active_doc_ids),
            deleted_at__isnull=True,
        ).all()

        doc_map = {
            d.id: d
            for d in await KuaiKnowledgeDocument.filter(id__in=list(active_doc_ids)).all()
        }

        scored: list[tuple[float, KuaiKnowledgeChunk]] = []
        for ch in chunks:
            score = EmbeddingService.score_chunk(kw, ch.content, ch.embedding, query_vec)
            if score > 0:
                scored.append((score, ch))
        scored.sort(key=lambda x: x[0], reverse=True)

        results: list[dict[str, Any]] = []
        for score, ch in scored[:top_k]:
            doc = doc_map.get(ch.document_id)
            results.append(
                {
                    "score": round(score, 4),
                    "document_id": ch.document_id,
                    "document_title": doc.title if doc else "",
                    "chunk_index": ch.chunk_index,
                    "content": ch.content,
                }
            )
        return results

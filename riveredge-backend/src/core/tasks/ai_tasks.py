"""TaskIQ：AI 异步任务 worker 入口。"""

from __future__ import annotations

from typing import Any, Dict

from loguru import logger

from core.ai.jobs import AiJobService
from core.tasks.taskiq_app import task


@task()
async def run_ai_job(
    job_id: str,
    tenant_id: int,
    user_id: int,
    job_type: str,
    payload: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """执行 AI 长任务（OCR / RAG 索引等）。"""
    payload = payload or {}
    AiJobService.update_job(job_id, status="running", progress=10)
    try:
        if job_type == "ocr_extract":
            result = await _run_ocr_extract(tenant_id, payload)
        elif job_type == "rag_reindex":
            result = await _run_rag_reindex(tenant_id, payload)
        else:
            raise ValueError(f"未知 job_type: {job_type}")

        AiJobService.update_job(job_id, status="completed", result=result, progress=100)
        return {"job_id": job_id, "status": "completed", "result": result}
    except Exception as exc:
        logger.exception("AI job failed job_id={} type={}", job_id, job_type)
        AiJobService.update_job(job_id, status="failed", error=str(exc))
        return {"job_id": job_id, "status": "failed", "error": str(exc)}


async def _run_ocr_extract(tenant_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    schema_name = str(payload.get("schema_name") or "")
    source_text = payload.get("source_text")
    if source_text:
        from core.ai.structured_draft import StructuredDraftService
        from core.ai.draft_profiles import ensure_draft_profiles

        ensure_draft_profiles()
        profile = StructuredDraftService.get_profile(schema_name)
        data = await StructuredDraftService.complete_json(
            tenant_id,
            system=profile.system_prompt,
            user_content=f"{profile.json_spec}\n\n---\n{source_text}",
            error_prefix="OCR 结构化失败",
        )
        return {"schema_name": schema_name, "data": data}
    raise ValueError("ocr_extract 需要 source_text 或 image 引用")


async def _run_rag_reindex(tenant_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    document_id = payload.get("document_id") or payload.get("knowledge_id")
    if document_id is None:
        raise ValueError("rag_reindex 需要 document_id")
    try:
        from apps.kuaiai.services.knowledge_service import KnowledgeService
    except ImportError as exc:
        raise ValueError("KU-AI 未组装，无法执行 RAG 索引") from exc

    await KnowledgeService.index_document(tenant_id=tenant_id, document_id=int(document_id))
    return {"document_id": document_id, "status": "indexed"}

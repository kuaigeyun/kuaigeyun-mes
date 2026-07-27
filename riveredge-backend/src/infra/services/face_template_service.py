"""
工位人脸特征模板：录入与比对（仅存 descriptor）
"""

from __future__ import annotations

import math
from typing import List, Optional, Sequence

from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.face_template import UserFaceTemplate
from infra.models.user import User
from core.utils.timezone_utils import resolve_business_datetime

# 余弦相似度阈值（faceres 类描述子通常在 0.45~0.6 可区分）
DEFAULT_MATCH_THRESHOLD = 0.48
MAX_TEMPLATES_PER_USER = 5


def _as_vector(raw: Sequence[float] | list) -> List[float]:
    vec = [float(x) for x in raw]
    if len(vec) < 64:
        raise BusinessLogicError("人脸特征向量维度过低，请重新采集")
    return vec


def _cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    if len(a) != len(b) or not a:
        return -1.0
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        fx, fy = float(x), float(y)
        dot += fx * fy
        na += fx * fx
        nb += fy * fy
    if na <= 0 or nb <= 0:
        return -1.0
    return dot / (math.sqrt(na) * math.sqrt(nb))


class FaceTemplateService:
    @staticmethod
    async def enroll(
        tenant_id: int,
        user_id: int,
        descriptor: Sequence[float],
        quality: Optional[float] = None,
        device_info: Optional[str] = None,
    ) -> UserFaceTemplate:
        user = await User.get_or_none(id=user_id, deleted_at__isnull=True)
        if not user:
            raise NotFoundError(f"用户不存在: {user_id}")
        vec = _as_vector(descriptor)

        existing = await UserFaceTemplate.filter(
            tenant_id=tenant_id,
            user_id=user_id,
            deleted_at__isnull=True,
        ).order_by("created_at").all()
        if len(existing) >= MAX_TEMPLATES_PER_USER:
            oldest = existing[0]
            from datetime import datetime

            oldest.deleted_at = resolve_business_datetime()
            await oldest.save()

        return await UserFaceTemplate.create(
            tenant_id=tenant_id,
            user_id=user_id,
            descriptor=vec,
            quality=quality,
            device_info=device_info,
        )

    @staticmethod
    async def list_for_user(tenant_id: int, user_id: int) -> List[UserFaceTemplate]:
        return await UserFaceTemplate.filter(
            tenant_id=tenant_id,
            user_id=user_id,
            deleted_at__isnull=True,
        ).order_by("-created_at").all()

    @staticmethod
    async def delete_template(tenant_id: int, template_id: int, user_id: Optional[int] = None) -> None:
        from datetime import datetime

        q = UserFaceTemplate.filter(tenant_id=tenant_id, id=template_id, deleted_at__isnull=True)
        if user_id is not None:
            q = q.filter(user_id=user_id)
        tpl = await q.first()
        if not tpl:
            raise NotFoundError("人脸模板不存在")
        tpl.deleted_at = resolve_business_datetime()
        await tpl.save()

    @staticmethod
    async def identify(
        tenant_id: int,
        descriptor: Sequence[float],
        threshold: float = DEFAULT_MATCH_THRESHOLD,
    ) -> dict:
        vec = _as_vector(descriptor)
        templates = await UserFaceTemplate.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).all()
        if not templates:
            raise BusinessLogicError("当前组织尚未录入任何人脸模板")

        best: Optional[UserFaceTemplate] = None
        best_score = -1.0
        for tpl in templates:
            score = _cosine_similarity(vec, tpl.descriptor or [])
            if score > best_score:
                best_score = score
                best = tpl

        if best is None or best_score < threshold:
            raise BusinessLogicError("未识别到匹配的操作员，请重试或使用工号登录")

        user = await User.get_or_none(id=best.user_id, deleted_at__isnull=True)
        if not user:
            raise BusinessLogicError("匹配用户已失效，请重新录入人脸")

        return {
            "matched": True,
            "score": round(best_score, 4),
            "user_id": user.id,
            "username": user.username,
            "full_name": user.full_name or user.username,
            "template_id": best.id,
        }

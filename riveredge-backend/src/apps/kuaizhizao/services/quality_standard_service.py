"""
质检标准业务服务模块

提供质检标准相关的业务逻辑处理，包括创建、查询、更新质检标准等。

Author: Auto (AI Assistant)
Date: 2026-01-17
"""

import uuid
from datetime import datetime
from typing import List, Optional

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.quality_standard import QualityStandard
from apps.kuaizhizao.schemas.quality import (
    QualityStandardCreate,
    QualityStandardUpdate,
    QualityStandardResponse,
    QualityStandardListResponse,
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.services.business.code_rule_service import CodeRuleService


class QualityStandardService(AppBaseService[QualityStandard]):
    """
    质检标准服务类

    处理质检标准相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(QualityStandard)

    async def create_quality_standard(
        self,
        tenant_id: int,
        standard_data: QualityStandardCreate,
        created_by: int
    ) -> QualityStandardResponse:
        """
        创建质检标准

        Args:
            tenant_id: 组织ID
            standard_data: 质检标准创建数据
            created_by: 创建人ID

        Returns:
            QualityStandardResponse: 创建的质检标准
        """
        async with in_transaction():
            # 如果没有提供标准编码，自动生成
            if not standard_data.standard_code:
                code_rule_service = CodeRuleService()
                standard_code = await code_rule_service.generate_code(
                    tenant_id=tenant_id,
                    code_rule_code="quality_standard",
                    context={
                        "standard_type": standard_data.standard_type,
                        "material_code": standard_data.material_code or "",
                    }
                )
            else:
                standard_code = standard_data.standard_code

            # 检查标准编码是否已存在
            existing = await QualityStandard.filter(
                tenant_id=tenant_id,
                standard_code=standard_code,
                deleted_at__isnull=True
            ).first()
            if existing:
                raise ValidationError(f"质检标准编码 '{standard_code}' 已存在")

            # 如果关联了物料，验证物料信息
            if standard_data.material_id:
                # TODO: 从物料主数据获取物料信息并验证
                pass

            # 创建质检标准
            standard_dict = standard_data.model_dump(exclude_unset=True)
            standard_dict.update({
                "tenant_id": tenant_id,
                "standard_code": standard_code,
                "uuid": str(uuid.uuid4()),
                "created_by": created_by,
                "updated_by": created_by,
            })

            standard = await QualityStandard.create(**standard_dict)

            # 转换为响应格式
            return QualityStandardResponse.model_validate(standard)

    async def get_quality_standard_by_id(
        self,
        tenant_id: int,
        standard_id: int
    ) -> QualityStandardResponse:
        """
        根据ID获取质检标准

        Args:
            tenant_id: 组织ID
            standard_id: 标准ID

        Returns:
            QualityStandardResponse: 质检标准
        """
        standard = await QualityStandard.filter(
            tenant_id=tenant_id,
            id=standard_id,
            deleted_at__isnull=True
        ).first()

        if not standard:
            raise NotFoundError(f"质检标准 ID {standard_id} 不存在")

        return QualityStandardResponse.model_validate(standard)

    async def list_quality_standards(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[QualityStandardListResponse]:
        """
        获取质检标准列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 返回数量
            **filters: 过滤条件（standard_type, material_id, is_active等）

        Returns:
            List[QualityStandardListResponse]: 质检标准列表
        """
        query = QualityStandard.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        # 应用过滤条件
        if filters.get("standard_type"):
            query = query.filter(standard_type=filters["standard_type"])
        if filters.get("material_id"):
            query = query.filter(material_id=filters["material_id"])
        if filters.get("is_active") is not None:
            query = query.filter(is_active=filters["is_active"])
        if filters.get("standard_code"):
            query = query.filter(standard_code__icontains=filters["standard_code"])
        if filters.get("standard_name"):
            query = query.filter(standard_name__icontains=filters["standard_name"])

        # 按创建时间倒序
        standards = await query.order_by("-created_at").offset(skip).limit(limit).all()

        return [QualityStandardListResponse.model_validate(standard) for standard in standards]

    async def update_quality_standard(
        self,
        tenant_id: int,
        standard_id: int,
        standard_data: QualityStandardUpdate,
        updated_by: int
    ) -> QualityStandardResponse:
        """
        更新质检标准

        Args:
            tenant_id: 组织ID
            standard_id: 标准ID
            standard_data: 质检标准更新数据
            updated_by: 更新人ID

        Returns:
            QualityStandardResponse: 更新后的质检标准
        """
        async with in_transaction():
            standard = await QualityStandard.filter(
                tenant_id=tenant_id,
                id=standard_id,
                deleted_at__isnull=True
            ).first()

            if not standard:
                raise NotFoundError(f"质检标准 ID {standard_id} 不存在")

            # 更新字段
            update_dict = standard_data.model_dump(exclude_unset=True)
            update_dict["updated_by"] = updated_by
            update_dict["updated_at"] = datetime.now()

            for key, value in update_dict.items():
                setattr(standard, key, value)

            await standard.save()

            return QualityStandardResponse.model_validate(standard)

    async def delete_quality_standard(
        self,
        tenant_id: int,
        standard_id: int
    ) -> None:
        """
        删除质检标准（软删除）

        Args:
            tenant_id: 组织ID
            standard_id: 标准ID
        """
        async with in_transaction():
            standard = await QualityStandard.filter(
                tenant_id=tenant_id,
                id=standard_id,
                deleted_at__isnull=True
            ).first()

            if not standard:
                raise NotFoundError(f"质检标准 ID {standard_id} 不存在")

            standard.deleted_at = datetime.now()
            await standard.save()

    async def get_standards_by_material(
        self,
        tenant_id: int,
        material_id: int,
        standard_type: Optional[str] = None
    ) -> List[QualityStandardListResponse]:
        """
        根据物料ID获取适用的质检标准

        Args:
            tenant_id: 组织ID
            material_id: 物料ID
            standard_type: 标准类型（可选，用于过滤）

        Returns:
            List[QualityStandardListResponse]: 质检标准列表
        """
        query = QualityStandard.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True
        ).filter(
            Q(material_id=material_id) | Q(material_id__isnull=True)
        )

        if standard_type:
            query = query.filter(standard_type=standard_type)

        # 优先返回物料特定的标准，然后是通用标准
        standards = await query.order_by("-material_id", "-created_at").all()

        return [QualityStandardListResponse.model_validate(standard) for standard in standards]

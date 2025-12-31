"""
质量管理服务模块

提供质量管理相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from loguru import logger

from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
from apps.kuaizhizao.models.process_inspection import ProcessInspection
from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

from apps.kuaizhizao.schemas.quality import (
    # 来料检验单
    IncomingInspectionCreate, IncomingInspectionUpdate, IncomingInspectionResponse, IncomingInspectionListResponse,
    # 过程检验单
    ProcessInspectionCreate, ProcessInspectionUpdate, ProcessInspectionResponse, ProcessInspectionListResponse,
    # 成品检验单
    FinishedGoodsInspectionCreate, FinishedGoodsInspectionUpdate, FinishedGoodsInspectionResponse, FinishedGoodsInspectionListResponse,
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class IncomingInspectionService(AppBaseService[IncomingInspection]):
    """来料检验单服务"""

    def __init__(self):
        super().__init__(IncomingInspection)

    async def create_incoming_inspection(self, tenant_id: int, inspection_data: IncomingInspectionCreate, created_by: int) -> IncomingInspectionResponse:
        """创建来料检验单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "INCOMING_INSPECTION_CODE", prefix=f"IQ{today}")

            inspection = await IncomingInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                **inspection_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            return IncomingInspectionResponse.model_validate(inspection)

    async def get_incoming_inspection_by_id(self, tenant_id: int, inspection_id: int) -> IncomingInspectionResponse:
        """根据ID获取来料检验单"""
        inspection = await IncomingInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            raise NotFoundError(f"来料检验单不存在: {inspection_id}")
        return IncomingInspectionResponse.model_validate(inspection)

    async def list_incoming_inspections(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[IncomingInspectionListResponse]:
        """获取来料检验单列表"""
        query = IncomingInspection.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('quality_status'):
            query = query.filter(quality_status=filters['quality_status'])
        if filters.get('supplier_id'):
            query = query.filter(supplier_id=filters['supplier_id'])
        if filters.get('material_id'):
            query = query.filter(material_id=filters['material_id'])

        inspections = await query.offset(skip).limit(limit).order_by('-created_at')
        return [IncomingInspectionListResponse.model_validate(inspection) for inspection in inspections]

    async def update_incoming_inspection(self, tenant_id: int, inspection_id: int, inspection_data: IncomingInspectionUpdate, updated_by: int) -> IncomingInspectionResponse:
        """更新来料检验单"""
        async with in_transaction():
            inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)
            update_data = inspection_data.model_dump(exclude_unset=True, exclude={'updated_by'})
            update_data['updated_by'] = updated_by

            await IncomingInspection.filter(tenant_id=tenant_id, id=inspection_id).update(**update_data)
            updated_inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)
            return updated_inspection

    async def conduct_inspection(self, tenant_id: int, inspection_id: int, inspection_data: dict, inspected_by: int) -> IncomingInspectionResponse:
        """执行检验"""
        async with in_transaction():
            inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)

            if inspection.status != '待检验':
                raise BusinessLogicError("只有待检验状态的检验单才能执行检验")

            inspector_name = await self.get_user_name(inspected_by)

            # 计算合格/不合格数量
            qualified_quantity = inspection_data.get('qualified_quantity', 0)
            unqualified_quantity = inspection_data.get('unqualified_quantity', 0)

            if qualified_quantity + unqualified_quantity != inspection.inspection_quantity:
                raise ValidationError("合格数量和不合格数量之和必须等于检验数量")

            quality_status = "合格" if unqualified_quantity == 0 else "不合格"

            await IncomingInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                qualified_quantity=qualified_quantity,
                unqualified_quantity=unqualified_quantity,
                inspection_result="已检验",
                quality_status=quality_status,
                inspector_id=inspected_by,
                inspector_name=inspector_name,
                inspection_time=datetime.now(),
                status="已检验",
                updated_by=inspected_by,
                **inspection_data
            )

            updated_inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)
            return updated_inspection

    async def approve_inspection(self, tenant_id: int, inspection_id: int, approved_by: int, rejection_reason: Optional[str] = None) -> IncomingInspectionResponse:
        """审核检验单"""
        async with in_transaction():
            inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)

            if inspection.review_status != '待审核':
                raise BusinessLogicError("检验单审核状态不是待审核")

            approver_name = await self.get_user_name(approved_by)

            review_status = "驳回" if rejection_reason else "通过"
            status = "已驳回" if rejection_reason else "已审核"

            await IncomingInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=review_status,
                review_remarks=rejection_reason,
                status=status,
                updated_by=approved_by
            )

            updated_inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)
            return updated_inspection



class ProcessInspectionService(AppBaseService[ProcessInspection]):
    """过程检验单服务"""

    def __init__(self):
        super().__init__(ProcessInspection)

    async def create_process_inspection(self, tenant_id: int, inspection_data: ProcessInspectionCreate, created_by: int) -> ProcessInspectionResponse:
        """创建过程检验单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "PROCESS_INSPECTION_CODE", prefix=f"PQ{today}")

            inspection = await ProcessInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                **inspection_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            return ProcessInspectionResponse.model_validate(inspection)

    async def get_process_inspection_by_id(self, tenant_id: int, inspection_id: int) -> ProcessInspectionResponse:
        """根据ID获取过程检验单"""
        inspection = await ProcessInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            raise NotFoundError(f"过程检验单不存在: {inspection_id}")
        return ProcessInspectionResponse.model_validate(inspection)

    async def list_process_inspections(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[ProcessInspectionListResponse]:
        """获取过程检验单列表"""
        query = ProcessInspection.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('quality_status'):
            query = query.filter(quality_status=filters['quality_status'])
        if filters.get('work_order_id'):
            query = query.filter(work_order_id=filters['work_order_id'])
        if filters.get('operation_id'):
            query = query.filter(operation_id=filters['operation_id'])

        inspections = await query.offset(skip).limit(limit).order_by('-created_at')
        return [ProcessInspectionListResponse.model_validate(inspection) for inspection in inspections]

    async def conduct_inspection(self, tenant_id: int, inspection_id: int, inspection_data: dict, inspected_by: int) -> ProcessInspectionResponse:
        """执行过程检验"""
        async with in_transaction():
            inspection = await self.get_process_inspection_by_id(tenant_id, inspection_id)

            if inspection.status != '待检验':
                raise BusinessLogicError("只有待检验状态的检验单才能执行检验")

            inspector_name = await self.get_user_name(inspected_by)

            # 计算合格/不合格数量
            qualified_quantity = inspection_data.get('qualified_quantity', 0)
            unqualified_quantity = inspection_data.get('unqualified_quantity', 0)

            if qualified_quantity + unqualified_quantity != inspection.inspection_quantity:
                raise ValidationError("合格数量和不合格数量之和必须等于检验数量")

            quality_status = "合格" if unqualified_quantity == 0 else "不合格"

            await ProcessInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                qualified_quantity=qualified_quantity,
                unqualified_quantity=unqualified_quantity,
                inspection_result="已检验",
                quality_status=quality_status,
                inspector_id=inspected_by,
                inspector_name=inspector_name,
                inspection_time=datetime.now(),
                status="已检验",
                updated_by=inspected_by,
                **inspection_data
            )

            updated_inspection = await self.get_process_inspection_by_id(tenant_id, inspection_id)
            return updated_inspection



class FinishedGoodsInspectionService(AppBaseService[FinishedGoodsInspection]):
    """成品检验单服务"""

    def __init__(self):
        super().__init__(FinishedGoodsInspection)

    async def create_finished_goods_inspection(self, tenant_id: int, inspection_data: FinishedGoodsInspectionCreate, created_by: int) -> FinishedGoodsInspectionResponse:
        """创建成品检验单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "FINISHED_GOODS_INSPECTION_CODE", prefix=f"FQ{today}")

            inspection = await FinishedGoodsInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                **inspection_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            return FinishedGoodsInspectionResponse.model_validate(inspection)

    async def get_finished_goods_inspection_by_id(self, tenant_id: int, inspection_id: int) -> FinishedGoodsInspectionResponse:
        """根据ID获取成品检验单"""
        inspection = await FinishedGoodsInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            raise NotFoundError(f"成品检验单不存在: {inspection_id}")
        return FinishedGoodsInspectionResponse.model_validate(inspection)

    async def list_finished_goods_inspections(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[FinishedGoodsInspectionListResponse]:
        """获取成品检验单列表"""
        query = FinishedGoodsInspection.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('quality_status'):
            query = query.filter(quality_status=filters['quality_status'])
        if filters.get('work_order_id'):
            query = query.filter(work_order_id=filters['work_order_id'])
        if filters.get('source_type'):
            query = query.filter(source_type=filters['source_type'])

        inspections = await query.offset(skip).limit(limit).order_by('-created_at')
        return [FinishedGoodsInspectionListResponse.model_validate(inspection) for inspection in inspections]

    async def conduct_inspection(self, tenant_id: int, inspection_id: int, inspection_data: dict, inspected_by: int) -> FinishedGoodsInspectionResponse:
        """执行成品检验"""
        async with in_transaction():
            inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)

            if inspection.status != '待检验':
                raise BusinessLogicError("只有待检验状态的检验单才能执行检验")

            inspector_name = await self.get_user_name(inspected_by)

            # 计算合格/不合格数量
            qualified_quantity = inspection_data.get('qualified_quantity', 0)
            unqualified_quantity = inspection_data.get('unqualified_quantity', 0)

            if qualified_quantity + unqualified_quantity != inspection.inspection_quantity:
                raise ValidationError("合格数量和不合格数量之和必须等于检验数量")

            quality_status = "合格" if unqualified_quantity == 0 else "不合格"

            await FinishedGoodsInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                qualified_quantity=qualified_quantity,
                unqualified_quantity=unqualified_quantity,
                inspection_result="已检验",
                quality_status=quality_status,
                inspector_id=inspected_by,
                inspector_name=inspector_name,
                inspection_time=datetime.now(),
                status="已检验",
                updated_by=inspected_by,
                **inspection_data
            )

            updated_inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)
            return updated_inspection

    async def issue_certificate(self, tenant_id: int, inspection_id: int, certificate_number: str, issued_by: int) -> FinishedGoodsInspectionResponse:
        """出具放行证书"""
        async with in_transaction():
            inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)

            if inspection.quality_status != '合格':
                raise BusinessLogicError("只有合格的成品才能出具放行证书")

            if inspection.certificate_issued:
                raise BusinessLogicError("该检验单已出具放行证书")

            await FinishedGoodsInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                release_certificate=certificate_number,
                certificate_issued=True,
                updated_by=issued_by
            )

            updated_inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)
            return updated_inspection


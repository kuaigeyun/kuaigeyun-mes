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
from datetime import timedelta
from decimal import Decimal


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

    # ============ 质量异常检测和统计分析 ============

    async def get_quality_anomalies(
        self,
        tenant_id: int,
        inspection_type: Optional[str] = None,  # "incoming", "process", "finished"
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        material_id: Optional[int] = None,
        supplier_id: Optional[int] = None
    ) -> List[dict]:
        """
        查询质量异常记录（不合格的检验单）

        Args:
            tenant_id: 租户ID
            inspection_type: 检验类型（可选：incoming/process/finished）
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            supplier_id: 供应商ID（可选，仅用于来料检验）

        Returns:
            List[dict]: 质量异常记录列表
        """
        anomalies = []

        # 查询来料检验异常
        if inspection_type is None or inspection_type == "incoming":
            query = IncomingInspection.filter(
                tenant_id=tenant_id,
                quality_status="不合格",
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)
            if supplier_id:
                query = query.filter(supplier_id=supplier_id)

            incoming_anomalies = await query.order_by("-inspection_time").limit(100).all()
            for inspection in incoming_anomalies:
                anomalies.append({
                    "inspection_type": "incoming",
                    "inspection_id": inspection.id,
                    "inspection_code": inspection.inspection_code,
                    "material_id": inspection.material_id,
                    "material_code": inspection.material_code,
                    "material_name": inspection.material_name,
                    "supplier_id": inspection.supplier_id,
                    "supplier_name": inspection.supplier_name,
                    "inspection_quantity": float(inspection.inspection_quantity),
                    "qualified_quantity": float(inspection.qualified_quantity),
                    "unqualified_quantity": float(inspection.unqualified_quantity),
                    "quality_status": inspection.quality_status,
                    "nonconformance_reason": inspection.nonconformance_reason,
                    "inspection_time": inspection.inspection_time.isoformat() if inspection.inspection_time else None
                })

        # 查询过程检验异常
        if inspection_type is None or inspection_type == "process":
            query = ProcessInspection.filter(
                tenant_id=tenant_id,
                quality_status="不合格",
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)

            process_anomalies = await query.order_by("-inspection_time").limit(100).all()
            for inspection in process_anomalies:
                anomalies.append({
                    "inspection_type": "process",
                    "inspection_id": inspection.id,
                    "inspection_code": inspection.inspection_code,
                    "work_order_id": inspection.work_order_id,
                    "work_order_code": inspection.work_order_code,
                    "operation_id": inspection.operation_id,
                    "operation_name": inspection.operation_name,
                    "material_id": inspection.material_id,
                    "material_code": inspection.material_code,
                    "material_name": inspection.material_name,
                    "inspection_quantity": float(inspection.inspection_quantity),
                    "qualified_quantity": float(inspection.qualified_quantity),
                    "unqualified_quantity": float(inspection.unqualified_quantity),
                    "quality_status": inspection.quality_status,
                    "nonconformance_reason": inspection.nonconformance_reason,
                    "inspection_time": inspection.inspection_time.isoformat() if inspection.inspection_time else None
                })

        # 查询成品检验异常
        if inspection_type is None or inspection_type == "finished":
            query = FinishedGoodsInspection.filter(
                tenant_id=tenant_id,
                quality_status="不合格",
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)

            finished_anomalies = await query.order_by("-inspection_time").limit(100).all()
            for inspection in finished_anomalies:
                anomalies.append({
                    "inspection_type": "finished",
                    "inspection_id": inspection.id,
                    "inspection_code": inspection.inspection_code,
                    "work_order_id": inspection.work_order_id,
                    "work_order_code": inspection.work_order_code,
                    "material_id": inspection.material_id,
                    "material_code": inspection.material_code,
                    "material_name": inspection.material_name,
                    "inspection_quantity": float(inspection.inspection_quantity),
                    "qualified_quantity": float(inspection.qualified_quantity),
                    "unqualified_quantity": float(inspection.unqualified_quantity),
                    "quality_status": inspection.quality_status,
                    "nonconformance_reason": inspection.nonconformance_reason,
                    "inspection_time": inspection.inspection_time.isoformat() if inspection.inspection_time else None
                })

        # 按检验时间降序排序
        anomalies.sort(key=lambda x: x.get("inspection_time") or "", reverse=True)
        return anomalies

    async def get_quality_statistics(
        self,
        tenant_id: int,
        inspection_type: Optional[str] = None,  # "incoming", "process", "finished"
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        material_id: Optional[int] = None,
        supplier_id: Optional[int] = None
    ) -> dict:
        """
        获取质量统计分析

        Args:
            tenant_id: 租户ID
            inspection_type: 检验类型（可选：incoming/process/finished）
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            supplier_id: 供应商ID（可选，仅用于来料检验）

        Returns:
            dict: 质量统计数据
        """
        stats = {
            "total_inspections": 0,
            "total_quantity": Decimal(0),
            "qualified_quantity": Decimal(0),
            "unqualified_quantity": Decimal(0),
            "by_type": {}
        }

        # 统计来料检验
        if inspection_type is None or inspection_type == "incoming":
            query = IncomingInspection.filter(
                tenant_id=tenant_id,
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)
            if supplier_id:
                query = query.filter(supplier_id=supplier_id)

            incoming_inspections = await query.all()
            incoming_stats = {
                "total_inspections": len(incoming_inspections),
                "total_quantity": Decimal(0),
                "qualified_quantity": Decimal(0),
                "unqualified_quantity": Decimal(0)
            }

            for inspection in incoming_inspections:
                incoming_stats["total_quantity"] += inspection.inspection_quantity
                incoming_stats["qualified_quantity"] += inspection.qualified_quantity
                incoming_stats["unqualified_quantity"] += inspection.unqualified_quantity

            if incoming_stats["total_quantity"] > 0:
                incoming_stats["qualified_rate"] = float(
                    incoming_stats["qualified_quantity"] / incoming_stats["total_quantity"] * 100
                )
                incoming_stats["unqualified_rate"] = float(
                    incoming_stats["unqualified_quantity"] / incoming_stats["total_quantity"] * 100
                )
            else:
                incoming_stats["qualified_rate"] = 0.0
                incoming_stats["unqualified_rate"] = 0.0

            stats["by_type"]["incoming"] = incoming_stats
            stats["total_inspections"] += incoming_stats["total_inspections"]
            stats["total_quantity"] += incoming_stats["total_quantity"]
            stats["qualified_quantity"] += incoming_stats["qualified_quantity"]
            stats["unqualified_quantity"] += incoming_stats["unqualified_quantity"]

        # 统计过程检验
        if inspection_type is None or inspection_type == "process":
            query = ProcessInspection.filter(
                tenant_id=tenant_id,
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)

            process_inspections = await query.all()
            process_stats = {
                "total_inspections": len(process_inspections),
                "total_quantity": Decimal(0),
                "qualified_quantity": Decimal(0),
                "unqualified_quantity": Decimal(0)
            }

            for inspection in process_inspections:
                process_stats["total_quantity"] += inspection.inspection_quantity
                process_stats["qualified_quantity"] += inspection.qualified_quantity
                process_stats["unqualified_quantity"] += inspection.unqualified_quantity

            if process_stats["total_quantity"] > 0:
                process_stats["qualified_rate"] = float(
                    process_stats["qualified_quantity"] / process_stats["total_quantity"] * 100
                )
                process_stats["unqualified_rate"] = float(
                    process_stats["unqualified_quantity"] / process_stats["total_quantity"] * 100
                )
            else:
                process_stats["qualified_rate"] = 0.0
                process_stats["unqualified_rate"] = 0.0

            stats["by_type"]["process"] = process_stats
            stats["total_inspections"] += process_stats["total_inspections"]
            stats["total_quantity"] += process_stats["total_quantity"]
            stats["qualified_quantity"] += process_stats["qualified_quantity"]
            stats["unqualified_quantity"] += process_stats["unqualified_quantity"]

        # 统计成品检验
        if inspection_type is None or inspection_type == "finished":
            query = FinishedGoodsInspection.filter(
                tenant_id=tenant_id,
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)

            finished_inspections = await query.all()
            finished_stats = {
                "total_inspections": len(finished_inspections),
                "total_quantity": Decimal(0),
                "qualified_quantity": Decimal(0),
                "unqualified_quantity": Decimal(0)
            }

            for inspection in finished_inspections:
                finished_stats["total_quantity"] += inspection.inspection_quantity
                finished_stats["qualified_quantity"] += inspection.qualified_quantity
                finished_stats["unqualified_quantity"] += inspection.unqualified_quantity

            if finished_stats["total_quantity"] > 0:
                finished_stats["qualified_rate"] = float(
                    finished_stats["qualified_quantity"] / finished_stats["total_quantity"] * 100
                )
                finished_stats["unqualified_rate"] = float(
                    finished_stats["unqualified_quantity"] / finished_stats["total_quantity"] * 100
                )
            else:
                finished_stats["qualified_rate"] = 0.0
                finished_stats["unqualified_rate"] = 0.0

            stats["by_type"]["finished"] = finished_stats
            stats["total_inspections"] += finished_stats["total_inspections"]
            stats["total_quantity"] += finished_stats["total_quantity"]
            stats["qualified_quantity"] += finished_stats["qualified_quantity"]
            stats["unqualified_quantity"] += finished_stats["unqualified_quantity"]

        # 计算总体合格率
        if stats["total_quantity"] > 0:
            stats["qualified_rate"] = float(
                stats["qualified_quantity"] / stats["total_quantity"] * 100
            )
            stats["unqualified_rate"] = float(
                stats["unqualified_quantity"] / stats["total_quantity"] * 100
            )
        else:
            stats["qualified_rate"] = 0.0
            stats["unqualified_rate"] = 0.0

        # 转换为float以便JSON序列化
        stats["total_quantity"] = float(stats["total_quantity"])
        stats["qualified_quantity"] = float(stats["qualified_quantity"])
        stats["unqualified_quantity"] = float(stats["unqualified_quantity"])

        return stats


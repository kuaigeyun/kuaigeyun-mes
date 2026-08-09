"""
不良品记录业务服务模块

提供不良品记录相关的业务逻辑处理，包括让步接收审批、统计分析等。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.defect_record import DefectRecord
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.schemas.defect_record import (
    DefectRecordResponse,
    DefectRecordListResponse,
    DefectRecordUpdate,
    DefectRecordCreateFromInspection
)

from apps.common.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService
from core.utils.timezone_utils import resolve_business_datetime, today_site_str


class DefectRecordService(AppBaseService[DefectRecord]):
    """
    不良品记录服务类

    处理不良品记录相关的所有业务逻辑，包括让步接收审批、统计分析等。
    """

    def __init__(self):
        super().__init__(DefectRecord)

    async def _assert_defect_handling_enabled(self, tenant_id: int) -> None:
        cfg = await BusinessConfigService().get_business_config(tenant_id)
        quality = cfg.get("parameters", {}).get("quality", {})
        if not quality.get("defect_handling", False):
            raise BusinessLogicError("当前组织未开启不良品处理，禁止创建不良品记录")

    async def approve_defect_acceptance(
        self,
        tenant_id: int,
        defect_id: int,
        approved: bool,
        approved_by: int,
        rejection_reason: Optional[str] = None
    ) -> DefectRecordResponse:
        """
        审批不良品让步接收

        Args:
            tenant_id: 组织ID
            defect_id: 不良品记录ID
            approved: 是否同意（True=同意，False=不同意）
            approved_by: 审批人ID
            rejection_reason: 驳回原因（当approved=False时必填）

        Returns:
            DefectRecordResponse: 更新后的不良品记录信息

        Raises:
            NotFoundError: 不良品记录不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误
        """
        async with in_transaction():
            # 获取不良品记录
            defect_record = await DefectRecord.get_or_none(
                id=defect_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not defect_record:
                raise NotFoundError(f"不良品记录不存在: {defect_id}")

            # 验证处理方式必须是accept（让步接收）
            if defect_record.disposition != 'accept':
                raise BusinessLogicError(f"只能审批处理方式为'让步接收'的不良品记录，当前处理方式：{defect_record.disposition}")

            # 验证状态
            if defect_record.status != 'draft':
                raise BusinessLogicError(f"只能审批草稿状态的不良品记录，当前状态：{defect_record.status}")

            # 获取审批人信息
            user_info = await self.get_user_info(approved_by)

            if approved:
                # 审批同意：更新状态为processed，允许继续下一工序
                defect_record.status = 'processed'
                defect_record.processed_at = resolve_business_datetime()
                defect_record.processed_by = approved_by
                defect_record.processed_by_name = user_info["name"]
                await defect_record.save()

                # 获取工单和工序信息
                work_order = await WorkOrder.get_or_none(
                    id=defect_record.work_order_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                )

                if work_order:
                    # 让步接收后，允许继续下一工序（不需要特殊处理，因为不良品已经记录）
                    # 可以在这里添加日志记录或其他业务逻辑
                    logger.info(
                        f"不良品记录 {defect_record.code} 让步接收审批通过，"
                        f"工单: {work_order.code}, 工序: {defect_record.operation_name}, "
                        f"允许继续下一工序"
                    )

                logger.info(f"不良品记录 {defect_record.code} 让步接收审批通过，审批人: {user_info['name']}")
            else:
                # 审批不同意：更新状态为cancelled
                if not rejection_reason or not rejection_reason.strip():
                    raise ValidationError("驳回时必须填写驳回原因")

                defect_record.status = 'cancelled'
                defect_record.remarks = (defect_record.remarks or '') + f"\n[让步接收审批驳回] {resolve_business_datetime().strftime('%Y-%m-%d %H:%M:%S')} 由 {user_info['name']} 驳回，原因：{rejection_reason}"
                await defect_record.save()

                logger.info(f"不良品记录 {defect_record.code} 让步接收审批驳回，审批人: {user_info['name']}, 原因: {rejection_reason}")

            return DefectRecordResponse.model_validate(defect_record)

    async def get_defect_statistics(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        work_order_id: Optional[int] = None,
        operation_id: Optional[int] = None,
        product_id: Optional[int] = None,
        defect_type: Optional[str] = None,
        disposition: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取不良品统计分析

        Args:
            tenant_id: 组织ID
            date_start: 开始日期
            date_end: 结束日期
            work_order_id: 工单ID（可选）
            operation_id: 工序ID（可选）
            product_id: 产品ID（可选）
            defect_type: 不良品类型（可选）
            disposition: 处理方式（可选）

        Returns:
            Dict[str, Any]: 统计分析结果
        """
        # 构建查询条件
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True)

        if date_start:
            query &= Q(created_at__gte=date_start)
        if date_end:
            query &= Q(created_at__lte=date_end)
        if work_order_id:
            query &= Q(work_order_id=work_order_id)
        if operation_id:
            query &= Q(operation_id=operation_id)
        if product_id:
            query &= Q(product_id=product_id)
        if defect_type:
            query &= Q(defect_type=defect_type)
        if disposition:
            query &= Q(disposition=disposition)

        # 查询不良品记录
        defect_records = await DefectRecord.filter(query).all()

        # 统计总数
        total_count = len(defect_records)
        total_defect_quantity = sum(r.defect_quantity for r in defect_records)

        # 获取报工记录总数和报工数量（用于计算不良品率）
        from apps.kuaizhizao.models.reporting_record import ReportingRecord
        reporting_query = Q(tenant_id=tenant_id, deleted_at__isnull=True)
        if date_start:
            reporting_query &= Q(created_at__gte=date_start)
        if date_end:
            reporting_query &= Q(created_at__lte=date_end)
        if work_order_id:
            reporting_query &= Q(work_order_id=work_order_id)
        if operation_id:
            reporting_query &= Q(operation_id=operation_id)
        if product_id:
            reporting_query &= Q(work_order__product_id=product_id)

        reporting_records = await ReportingRecord.filter(reporting_query).all()
        total_reported_quantity = sum(r.reported_quantity for r in reporting_records)
        defect_rate = (float(total_defect_quantity) / float(total_reported_quantity) * 100) if total_reported_quantity > 0 else 0

        # 按工单统计
        work_order_stats: Dict[int, Dict[str, Any]] = {}
        for record in defect_records:
            if record.work_order_id not in work_order_stats:
                work_order_stats[record.work_order_id] = {
                    'work_order_id': record.work_order_id,
                    'work_order_code': record.work_order_code,
                    'count': 0,
                    'defect_quantity': Decimal('0')
                }
            work_order_stats[record.work_order_id]['count'] += 1
            work_order_stats[record.work_order_id]['defect_quantity'] += record.defect_quantity

        # 按工序统计
        operation_stats: Dict[int, Dict[str, Any]] = {}
        for record in defect_records:
            if record.operation_id not in operation_stats:
                operation_stats[record.operation_id] = {
                    'operation_id': record.operation_id,
                    'operation_name': record.operation_name,
                    'count': 0,
                    'defect_quantity': Decimal('0')
                }
            operation_stats[record.operation_id]['count'] += 1
            operation_stats[record.operation_id]['defect_quantity'] += record.defect_quantity

        # 按物料统计
        product_stats: Dict[int, Dict[str, Any]] = {}
        for record in defect_records:
            if record.product_id not in product_stats:
                product_stats[record.product_id] = {
                    'product_id': record.product_id,
                    'product_code': record.product_code,
                    'product_name': record.product_name,
                    'count': 0,
                    'defect_quantity': Decimal('0')
                }
            product_stats[record.product_id]['count'] += 1
            product_stats[record.product_id]['defect_quantity'] += record.defect_quantity

        # 按不良品类型统计
        type_stats: Dict[str, Dict[str, Any]] = {}
        for record in defect_records:
            if record.defect_type not in type_stats:
                type_stats[record.defect_type] = {
                    'defect_type': record.defect_type,
                    'count': 0,
                    'defect_quantity': Decimal('0')
                }
            type_stats[record.defect_type]['count'] += 1
            type_stats[record.defect_type]['defect_quantity'] += record.defect_quantity

        # 按处理方式统计
        disposition_stats: Dict[str, Dict[str, Any]] = {}
        for record in defect_records:
            if record.disposition not in disposition_stats:
                disposition_stats[record.disposition] = {
                    'disposition': record.disposition,
                    'count': 0,
                    'defect_quantity': Decimal('0')
                }
            disposition_stats[record.disposition]['count'] += 1
            disposition_stats[record.disposition]['defect_quantity'] += record.defect_quantity

        return {
            'summary': {
                'total_count': total_count,
                'total_defect_quantity': float(total_defect_quantity),
                'total_reported_quantity': float(total_reported_quantity),
                'defect_rate': defect_rate
            },
            'by_work_order': list(work_order_stats.values()),
            'by_operation': list(operation_stats.values()),
            'by_product': list(product_stats.values()),
            'by_type': list(type_stats.values()),
            'by_disposition': list(disposition_stats.values())
        }

    async def list_defect_records(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        work_order_id: Optional[int] = None,
        operation_id: Optional[int] = None,
        status: Optional[str] = None,
        defect_type: Optional[str] = None,
        disposition: Optional[str] = None,
        incoming_inspection_id: Optional[int] = None,
        process_inspection_id: Optional[int] = None,
        finished_goods_inspection_id: Optional[int] = None,
        defect_id: Optional[int] = None,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        查询不良品记录列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            work_order_id: 工单ID（可选）
            operation_id: 工序ID（可选）
            status: 状态（可选）
            defect_type: 不良品类型（可选）
            disposition: 处理方式（可选）
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）

        Returns:
            List[DefectRecordListResponse]: 不良品记录列表
        """
        # 构建查询条件
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True)

        if work_order_id:
            query &= Q(work_order_id=work_order_id)
        if operation_id:
            query &= Q(operation_id=operation_id)
        if status:
            query &= Q(status=status)
        if defect_type:
            query &= Q(defect_type=defect_type)
        if disposition:
            query &= Q(disposition=disposition)
        if incoming_inspection_id:
            query &= Q(incoming_inspection_id=incoming_inspection_id)
        if process_inspection_id:
            query &= Q(process_inspection_id=process_inspection_id)
        if finished_goods_inspection_id:
            query &= Q(finished_goods_inspection_id=finished_goods_inspection_id)
        if defect_id:
            query &= Q(id=defect_id)
        if date_start:
            query &= Q(created_at__gte=date_start)
        if date_end:
            query &= Q(created_at__lte=date_end)

        from apps.kuaizhizao.services.quality_service import (
            NONCONFORMING_LEDGER_SORTABLE_FIELDS,
            _apply_quality_inspection_list_filters,
            _resolve_quality_list_order_by,
        )

        defect_query = DefectRecord.filter(query)
        defect_query = _apply_quality_inspection_list_filters(
            defect_query,
            {
                "keyword": keyword,
                "created_start_date": created_start_date,
                "created_end_date": created_end_date,
            },
            keyword_fields=[
                "code",
                "product_code",
                "product_name",
                "work_order_code",
                "operation_name",
                "defect_reason",
                "incoming_inspection_code",
                "process_inspection_code",
                "finished_goods_inspection_code",
            ],
            time_field="created_at",
        )

        total = await defect_query.count()
        order_clause = _resolve_quality_list_order_by(
            order_by,
            NONCONFORMING_LEDGER_SORTABLE_FIELDS,
            "-created_at",
        )
        defect_records = await defect_query.order_by(order_clause).offset(skip).limit(limit).all()

        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_nonconforming_ledger_list_capabilities,
        )

        responses = [DefectRecordListResponse.model_validate(record) for record in defect_records]
        data = await enrich_nonconforming_ledger_list_capabilities(
            tenant_id,
            defect_records,
            responses,
        )
        return {"data": data, "total": total, "success": True}

    async def update_disposition(
        self,
        tenant_id: int,
        defect_id: int,
        updated_by: int,
        disposition: str,
        status: Optional[str] = None,
        quarantine_location: Optional[str] = None,
        downgrade_material_id: Optional[int] = None,
        downgrade_warehouse_id: Optional[int] = None,
        remarks: Optional[str] = None,
        attachments: Optional[list] = None,
    ) -> DefectRecordResponse:
        """更新不合格品台账处置信息。"""
        async with in_transaction():
            defect_record = await DefectRecord.get_or_none(
                id=defect_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if not defect_record:
                raise NotFoundError(f"不良品记录不存在: {defect_id}")

            from apps.kuaizhizao.models.quality_8d_report import Quality8DReport
            from apps.kuaizhizao.services.document_action_policy.nonconforming_ledger import (
                assert_nonconforming_ledger_capability,
            )

            has_8d = await Quality8DReport.filter(
                tenant_id=tenant_id,
                defect_record_id=defect_id,
                deleted_at__isnull=True,
            ).exists()
            assert_nonconforming_ledger_capability(
                defect_record,
                "update_disposition",
                has_linked_8d_report=has_8d,
            )

            if disposition == "downgrade":
                resolved_material_id = downgrade_material_id or defect_record.downgrade_material_id
                resolved_warehouse_id = downgrade_warehouse_id or defect_record.downgrade_warehouse_id
                if not resolved_material_id or not resolved_warehouse_id:
                    raise ValidationError("降级回用必须指定目标原料物料与入库仓库")
                downgrade_material_id = resolved_material_id
                downgrade_warehouse_id = resolved_warehouse_id

            user_info = await self.get_user_info(updated_by)
            previous_disposition = defect_record.disposition
            defect_record.disposition = disposition
            if downgrade_material_id is not None:
                defect_record.downgrade_material_id = downgrade_material_id
            if downgrade_warehouse_id is not None:
                defect_record.downgrade_warehouse_id = downgrade_warehouse_id
            effective_status = status
            if disposition == "downgrade" and not effective_status:
                effective_status = "processed"
            if effective_status:
                defect_record.status = effective_status
                if effective_status == "processed":
                    defect_record.processed_at = resolve_business_datetime()
                    defect_record.processed_by = updated_by
                    defect_record.processed_by_name = user_info["name"]
            if quarantine_location is not None:
                defect_record.quarantine_location = quarantine_location
            if remarks:
                append_line = f"[处置更新 {resolve_business_datetime().strftime('%Y-%m-%d %H:%M:%S')}] {remarks}"
                defect_record.remarks = f"{defect_record.remarks}\n{append_line}".strip() if defect_record.remarks else append_line
            if attachments is not None:
                defect_record.attachments = attachments
            defect_record.updated_by = updated_by
            defect_record.updated_by_name = user_info["name"]
            await defect_record.save()

            if (
                disposition != previous_disposition
                or effective_status == "processed"
                or disposition == "downgrade"
            ):
                await self._execute_disposition_side_effects(
                    tenant_id=tenant_id,
                    defect_record=defect_record,
                    updated_by=updated_by,
                    quarantine_location=quarantine_location,
                )
                defect_record = await DefectRecord.get(id=defect_record.id)

            return DefectRecordResponse.model_validate(defect_record)

    async def _resolve_downgrade_targets(
        self,
        tenant_id: int,
        defect_record: DefectRecord,
    ) -> tuple[int, str, str, str, int, str]:
        material_id = defect_record.downgrade_material_id
        warehouse_id = defect_record.downgrade_warehouse_id
        if not material_id or not warehouse_id:
            raise ValidationError("降级回用必须指定目标原料物料与入库仓库")
        if material_id == defect_record.product_id:
            raise ValidationError("降级回用目标物料不能与原不合格产品相同")

        from apps.master_data.models.material import Material
        from apps.master_data.models.warehouse import Warehouse

        material = await Material.get_or_none(
            tenant_id=tenant_id,
            id=material_id,
            deleted_at__isnull=True,
        )
        if not material:
            raise NotFoundError(f"目标物料不存在: {material_id}")

        warehouse = await Warehouse.get_or_none(
            tenant_id=tenant_id,
            id=warehouse_id,
            deleted_at__isnull=True,
        )
        if not warehouse:
            raise NotFoundError(f"入库仓库不存在: {warehouse_id}")

        material_code = getattr(material, "main_code", None) or getattr(material, "code", "") or ""
        material_name = material.name or ""
        material_unit = material.base_unit or ""
        warehouse_name = warehouse.name or ""
        return material_id, material_code, material_name, material_unit, warehouse_id, warehouse_name

    async def _execute_downgrade_reuse(
        self,
        tenant_id: int,
        defect_record: DefectRecord,
        updated_by: int,
    ) -> None:
        if defect_record.other_inbound_id:
            return

        qty = float(defect_record.defect_quantity or 0)
        if qty <= 0:
            raise ValidationError("降级回用数量必须大于0")

        (
            material_id,
            material_code,
            material_name,
            material_unit,
            warehouse_id,
            warehouse_name,
        ) = await self._resolve_downgrade_targets(tenant_id, defect_record)

        defect_record.downgrade_material_code = material_code
        defect_record.downgrade_material_name = material_name
        defect_record.downgrade_material_unit = material_unit
        defect_record.downgrade_warehouse_name = warehouse_name
        await defect_record.save()

        reason_desc_parts = [f"不合格品台账 {defect_record.code}"]
        if defect_record.work_order_code:
            reason_desc_parts.append(f"原工单 {defect_record.work_order_code}")
        reason_desc_parts.append(
            f"原产品 {defect_record.product_code} {defect_record.product_name}"
        )

        from apps.kuaizhizao.services.warehouse_service import OtherInboundService
        from apps.kuaizhizao.schemas.warehouse import OtherInboundCreate, OtherInboundItemCreate

        inbound_service = OtherInboundService()
        inbound = await inbound_service.create_other_inbound(
            tenant_id=tenant_id,
            inbound_data=OtherInboundCreate(
                reason_type="降级回用",
                reason_desc="；".join(reason_desc_parts),
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_name,
                notes=f"由不合格品台账 {defect_record.code} 自动生成",
                items=[
                    OtherInboundItemCreate(
                        material_id=material_id,
                        material_code=material_code,
                        material_name=material_name,
                        material_unit=material_unit,
                        inbound_quantity=qty,
                        unit_price=0,
                    )
                ],
            ),
            created_by=updated_by,
        )
        confirmed = await inbound_service.confirm_inbound(
            tenant_id=tenant_id,
            inbound_id=inbound.id,
            confirmed_by=updated_by,
        )

        user_info = await self.get_user_info(updated_by)
        defect_record.other_inbound_id = confirmed.id
        defect_record.status = "processed"
        defect_record.processed_at = resolve_business_datetime()
        defect_record.processed_by = updated_by
        defect_record.processed_by_name = user_info["name"]
        await defect_record.save()
        logger.info(
            f"不合格品 {defect_record.code} 已降级回用入库 {confirmed.inbound_code}"
        )

    async def _execute_disposition_side_effects(
        self,
        tenant_id: int,
        defect_record: DefectRecord,
        updated_by: int,
        quarantine_location: Optional[str] = None,
    ) -> None:
        """处置为返工/报废/隔离时调用对应业务服务，失败则显式抛出。"""
        disposition = defect_record.disposition

        if disposition == "rework":
            if not defect_record.work_order_id:
                raise BusinessLogicError("来料不合格品无法直接返工，请先关联工单或选择其他处置方式")
            if defect_record.rework_order_id:
                return
            from apps.kuaizhizao.services.rework_order_service import ReworkOrderService
            from apps.kuaizhizao.schemas.rework_order import ReworkOrderCreate

            work_order = await WorkOrder.get_or_none(
                id=defect_record.work_order_id, tenant_id=tenant_id, deleted_at__isnull=True
            )
            if not work_order:
                raise NotFoundError(f"工单不存在: {defect_record.work_order_id}")

            rework_order = await ReworkOrderService().create_rework_order(
                tenant_id=tenant_id,
                rework_order_data=ReworkOrderCreate(
                    original_work_order_id=work_order.id,
                    original_work_order_uuid=work_order.uuid,
                    product_id=defect_record.product_id,
                    product_code=defect_record.product_code,
                    product_name=defect_record.product_name,
                    quantity=defect_record.defect_quantity,
                    rework_reason=defect_record.defect_reason,
                    rework_type="返工",
                    workshop_id=work_order.workshop_id,
                    workshop_name=work_order.workshop_name,
                    work_center_id=work_order.work_center_id,
                    work_center_name=work_order.work_center_name,
                    remarks=f"从不合格品台账 {defect_record.code} 处置返工",
                ),
                created_by=updated_by,
            )
            defect_record.rework_order_id = rework_order.id
            await defect_record.save()
            logger.info(f"不合格品 {defect_record.code} 已创建返工单 {rework_order.code}")

        elif disposition == "scrap":
            if not defect_record.work_order_id or not defect_record.operation_id:
                raise BusinessLogicError("报废处置需要工单与工序信息，来料不合格品请走退货流程")
            if defect_record.scrap_record_id:
                return
            import uuid
            from decimal import Decimal
            from apps.kuaizhizao.models.scrap_record import ScrapRecord

            today = today_site_str()
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="SCRAP_RECORD_CODE",
                prefix=f"SC{today}",
            )
            scrap_record = await ScrapRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                reporting_record_id=defect_record.reporting_record_id,
                work_order_id=defect_record.work_order_id,
                work_order_code=defect_record.work_order_code,
                operation_id=defect_record.operation_id,
                operation_code=defect_record.operation_code or "",
                operation_name=defect_record.operation_name or "",
                product_id=defect_record.product_id,
                product_code=defect_record.product_code,
                product_name=defect_record.product_name,
                scrap_quantity=defect_record.defect_quantity,
                total_cost=Decimal("0"),
                scrap_reason=f"不合格品报废：{defect_record.defect_reason}",
                scrap_type="quality",
                status="draft",
                remarks=f"从不合格品台账 {defect_record.code} 创建",
                created_by=updated_by,
                created_by_name=(await self.get_user_info(updated_by))["name"],
                updated_by=updated_by,
                updated_by_name=(await self.get_user_info(updated_by))["name"],
            )
            defect_record.scrap_record_id = scrap_record.id
            await defect_record.save()
            logger.info(f"不合格品 {defect_record.code} 已创建报废记录 {scrap_record.code}")

        elif disposition == "quarantine":
            location = quarantine_location or defect_record.quarantine_location
            if not location:
                from apps.master_data.models.warehouse import Warehouse

                wh = await Warehouse.filter(
                    tenant_id=tenant_id,
                    warehouse_type="quarantine",
                    is_active=True,
                    deleted_at__isnull=True,
                ).order_by("id").first()
                if wh:
                    location = wh.name
                else:
                    raise BusinessLogicError("未配置待检仓（quarantine）且未指定隔离库位")
            defect_record.quarantine_location = location
            await defect_record.save()
            logger.info(f"不合格品 {defect_record.code} 已隔离至 {location}")

        elif disposition == "downgrade":
            await self._execute_downgrade_reuse(
                tenant_id=tenant_id,
                defect_record=defect_record,
                updated_by=updated_by,
            )

    async def _maybe_execute_downgrade_after_create(
        self,
        tenant_id: int,
        defect_record: DefectRecord,
        created_by: int,
        downgrade_material_id: Optional[int],
        downgrade_warehouse_id: Optional[int],
    ) -> DefectRecord:
        if defect_record.disposition != "downgrade":
            return defect_record
        if not downgrade_material_id or not downgrade_warehouse_id:
            raise ValidationError("降级回用必须指定目标原料物料与入库仓库")
        defect_record.downgrade_material_id = downgrade_material_id
        defect_record.downgrade_warehouse_id = downgrade_warehouse_id
        await defect_record.save()
        await self._execute_downgrade_reuse(
            tenant_id=tenant_id,
            defect_record=defect_record,
            updated_by=created_by,
        )
        return await DefectRecord.get(id=defect_record.id)

    async def create_defect_from_incoming_inspection(
        self,
        tenant_id: int,
        inspection_id: int,
        defect_data: DefectRecordCreateFromInspection,
        created_by: int
    ) -> DefectRecordResponse:
        """
        从来料检验单创建不合格品记录

        Args:
            tenant_id: 组织ID
            inspection_id: 来料检验单ID
            defect_data: 不合格品记录创建数据
            created_by: 创建人ID

        Returns:
            DefectRecordResponse: 创建的不合格品记录信息

        Raises:
            NotFoundError: 来料检验单不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误
        """
        await self._assert_defect_handling_enabled(tenant_id)
        import uuid
        from apps.kuaizhizao.models.incoming_inspection import IncomingInspection

        async with in_transaction():
            # 获取来料检验单
            inspection = await IncomingInspection.get_or_none(
                id=inspection_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not inspection:
                raise NotFoundError(f"来料检验单不存在: {inspection_id}")

            from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
                assert_quality_inspection_capability,
            )
            assert_quality_inspection_capability(inspection, "create_defect")

            # 验证不合格数量
            if defect_data.defect_quantity > inspection.unqualified_quantity:
                raise ValidationError(
                    f"不合格品数量({defect_data.defect_quantity})不能超过检验单的不合格数量({inspection.unqualified_quantity})"
                )

            # 生成不良品记录编码
            today = today_site_str()
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="DEFECT_RECORD_CODE",
                prefix=f"DF{today}"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建不良品记录
            defect_record = await DefectRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                incoming_inspection_id=inspection_id,
                incoming_inspection_code=inspection.inspection_code,
                product_id=inspection.material_id,
                product_code=inspection.material_code,
                product_name=inspection.material_name,
                defect_quantity=defect_data.defect_quantity,
                defect_type=defect_data.defect_type,
                defect_reason=defect_data.defect_reason,
                disposition=defect_data.disposition,
                status="draft",
                remarks=defect_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            logger.info(f"从来料检验单 {inspection.inspection_code} 创建不合格品记录: {code}")

            from apps.kuaizhizao.services.exception_service import ExceptionService
            await ExceptionService().create_from_inspection(
                tenant_id=tenant_id,
                source_type="incoming_inspection",
                source_id=inspection_id,
                created_by=created_by,
                problem_description=defect_data.defect_reason,
            )

            defect_record = await self._maybe_execute_downgrade_after_create(
                tenant_id=tenant_id,
                defect_record=defect_record,
                created_by=created_by,
                downgrade_material_id=defect_data.downgrade_material_id,
                downgrade_warehouse_id=defect_data.downgrade_warehouse_id,
            )
            return DefectRecordResponse.model_validate(defect_record)

    async def create_defect_from_process_inspection(
        self,
        tenant_id: int,
        inspection_id: int,
        defect_data: DefectRecordCreateFromInspection,
        created_by: int
    ) -> DefectRecordResponse:
        """
        从过程检验单创建不合格品记录

        Args:
            tenant_id: 组织ID
            inspection_id: 过程检验单ID
            defect_data: 不合格品记录创建数据
            created_by: 创建人ID

        Returns:
            DefectRecordResponse: 创建的不合格品记录信息

        Raises:
            NotFoundError: 过程检验单不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误
        """
        await self._assert_defect_handling_enabled(tenant_id)
        import uuid
        from apps.kuaizhizao.models.process_inspection import ProcessInspection

        async with in_transaction():
            # 获取过程检验单
            inspection = await ProcessInspection.get_or_none(
                id=inspection_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not inspection:
                raise NotFoundError(f"过程检验单不存在: {inspection_id}")

            from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
                assert_quality_inspection_capability,
            )
            assert_quality_inspection_capability(inspection, "create_defect")

            # 验证不合格数量
            if defect_data.defect_quantity > inspection.unqualified_quantity:
                raise ValidationError(
                    f"不合格品数量({defect_data.defect_quantity})不能超过检验单的不合格数量({inspection.unqualified_quantity})"
                )

            # 生成不良品记录编码
            today = today_site_str()
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="DEFECT_RECORD_CODE",
                prefix=f"DF{today}"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建不良品记录
            defect_record = await DefectRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                process_inspection_id=inspection_id,
                process_inspection_code=inspection.inspection_code,
                work_order_id=inspection.work_order_id,
                work_order_code=inspection.work_order_code,
                operation_id=inspection.operation_id,
                operation_code=inspection.operation_code,
                operation_name=inspection.operation_name,
                product_id=inspection.material_id,
                product_code=inspection.material_code,
                product_name=inspection.material_name,
                defect_quantity=defect_data.defect_quantity,
                defect_type=defect_data.defect_type,
                defect_reason=defect_data.defect_reason,
                disposition=defect_data.disposition,
                status="draft",
                remarks=defect_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            logger.info(f"从过程检验单 {inspection.inspection_code} 创建不合格品记录: {code}")

            from apps.kuaizhizao.services.exception_service import ExceptionService
            await ExceptionService().create_from_inspection(
                tenant_id=tenant_id,
                source_type="process_inspection",
                source_id=inspection_id,
                created_by=created_by,
                problem_description=defect_data.defect_reason,
            )

            defect_record = await self._maybe_execute_downgrade_after_create(
                tenant_id=tenant_id,
                defect_record=defect_record,
                created_by=created_by,
                downgrade_material_id=defect_data.downgrade_material_id,
                downgrade_warehouse_id=defect_data.downgrade_warehouse_id,
            )
            return DefectRecordResponse.model_validate(defect_record)

    async def create_defect_from_finished_goods_inspection(
        self,
        tenant_id: int,
        inspection_id: int,
        defect_data: DefectRecordCreateFromInspection,
        created_by: int
    ) -> DefectRecordResponse:
        """
        从成品检验单创建不合格品记录

        Args:
            tenant_id: 组织ID
            inspection_id: 成品检验单ID
            defect_data: 不合格品记录创建数据
            created_by: 创建人ID

        Returns:
            DefectRecordResponse: 创建的不合格品记录信息

        Raises:
            NotFoundError: 成品检验单不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误
        """
        await self._assert_defect_handling_enabled(tenant_id)
        import uuid
        from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

        async with in_transaction():
            # 获取成品检验单
            inspection = await FinishedGoodsInspection.get_or_none(
                id=inspection_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not inspection:
                raise NotFoundError(f"成品检验单不存在: {inspection_id}")

            from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
                assert_quality_inspection_capability,
            )
            assert_quality_inspection_capability(inspection, "create_defect")

            # 验证不合格数量
            if defect_data.defect_quantity > inspection.unqualified_quantity:
                raise ValidationError(
                    f"不合格品数量({defect_data.defect_quantity})不能超过检验单的不合格数量({inspection.unqualified_quantity})"
                )

            # 生成不良品记录编码
            today = today_site_str()
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="DEFECT_RECORD_CODE",
                prefix=f"DF{today}"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建不良品记录
            defect_record = await DefectRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                finished_goods_inspection_id=inspection_id,
                finished_goods_inspection_code=inspection.inspection_code,
                work_order_id=inspection.work_order_id,
                work_order_code=inspection.work_order_code,
                product_id=inspection.material_id,
                product_code=inspection.material_code,
                product_name=inspection.material_name,
                defect_quantity=defect_data.defect_quantity,
                defect_type=defect_data.defect_type,
                defect_reason=defect_data.defect_reason,
                disposition=defect_data.disposition,
                status="draft",
                remarks=defect_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            logger.info(f"从成品检验单 {inspection.inspection_code} 创建不合格品记录: {code}")

            from apps.kuaizhizao.services.exception_service import ExceptionService
            await ExceptionService().create_from_inspection(
                tenant_id=tenant_id,
                source_type="finished_goods_inspection",
                source_id=inspection_id,
                created_by=created_by,
                problem_description=defect_data.defect_reason,
            )

            defect_record = await self._maybe_execute_downgrade_after_create(
                tenant_id=tenant_id,
                defect_record=defect_record,
                created_by=created_by,
                downgrade_material_id=defect_data.downgrade_material_id,
                downgrade_warehouse_id=defect_data.downgrade_warehouse_id,
            )
            return DefectRecordResponse.model_validate(defect_record)

"""
不良品记录业务服务模块

提供不良品记录相关的业务逻辑处理，包括让步接收审批、统计分析等。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import List, Optional, Dict, Any, Literal
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
    DefectRecordCreateFromInspection,
    DefectRecordCreateFromInspectionBatch,
)

from apps.common.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService
from core.utils.timezone_utils import resolve_business_datetime, today_site_str, to_api_isoformat


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
        # 入库 confirm 走 serialize_stock_document，必须在外层事务外执行，
        # 避免 advisory lock 在外层事务内膨胀（B3-R2 / Tortoise 嵌套边界）。
        pending_inbound_warehouse_id: Optional[int] = None
        async with in_transaction():
            defect_record = await DefectRecord.get_or_none(
                id=defect_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not defect_record:
                raise NotFoundError(f"不良品记录不存在: {defect_id}")

            if defect_record.disposition != 'accept':
                raise BusinessLogicError(f"只能审批处理方式为'让步接收'的不良品记录，当前处理方式：{defect_record.disposition}")

            if defect_record.status == 'processed':
                return DefectRecordResponse.model_validate(defect_record)

            if defect_record.status != 'draft':
                raise BusinessLogicError(f"只能审批草稿状态的不良品记录，当前状态：{defect_record.status}")

            user_info = await self.get_user_info(approved_by)

            if approved:
                defect_record.status = 'processed'
                defect_record.processed_at = resolve_business_datetime()
                defect_record.processed_by = approved_by
                defect_record.processed_by_name = user_info["name"]
                await defect_record.save()

                if not self._accept_inbound_already_linked(defect_record):
                    wh_id, _ = await self._resolve_defect_stock_warehouse(
                        tenant_id,
                        defect_record,
                    )
                    pending_inbound_warehouse_id = int(wh_id)

                await self._close_linked_quality_exceptions_after_disposition(
                    defect_record, approved_by
                )

                work_order = await WorkOrder.get_or_none(
                    id=defect_record.work_order_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                )
                if work_order:
                    logger.info(
                        f"不良品记录 {defect_record.code} 让步接收审批通过，"
                        f"工单: {work_order.code}, 工序: {defect_record.operation_name}, "
                        f"允许继续下一工序"
                    )
                logger.info(f"不良品记录 {defect_record.code} 让步接收审批通过，审批人: {user_info['name']}")
            else:
                if not rejection_reason or not rejection_reason.strip():
                    raise ValidationError("驳回时必须填写驳回原因")

                defect_record.status = 'cancelled'
                defect_record.remarks = (defect_record.remarks or '') + f"\n[让步接收审批驳回] {to_api_isoformat(resolve_business_datetime())} 由 {user_info['name']} 驳回，原因：{rejection_reason}"
                await defect_record.save()
                logger.info(f"不良品记录 {defect_record.code} 让步接收审批驳回，审批人: {user_info['name']}, 原因: {rejection_reason}")

            response = DefectRecordResponse.model_validate(defect_record)

        if pending_inbound_warehouse_id is not None:
            try:
                defect_for_inbound = await DefectRecord.get(
                    id=defect_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                )
                await self._execute_accept_concession_inbound(
                    tenant_id=tenant_id,
                    defect_record=defect_for_inbound,
                    updated_by=approved_by,
                    stock_warehouse_id=pending_inbound_warehouse_id,
                )
                await defect_for_inbound.refresh_from_db()
                response = DefectRecordResponse.model_validate(defect_for_inbound)
            except Exception:
                # 入库失败则回滚审批态，避免"已处理但无库存"悬挂
                defect_for_inbound = await DefectRecord.get_or_none(
                    id=defect_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                )
                if defect_for_inbound and defect_for_inbound.status == 'processed':
                    defect_for_inbound.status = 'draft'
                    defect_for_inbound.processed_at = None
                    defect_for_inbound.processed_by = None
                    defect_for_inbound.processed_by_name = None
                    await defect_for_inbound.save()
                raise

        return response

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
        await self._hydrate_source_inspection_codes(tenant_id, defect_records)

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

    async def _hydrate_source_inspection_codes(
        self,
        tenant_id: int,
        records: List[DefectRecord],
    ) -> None:
        """列表/详情展示用：有检验单 ID 但未落编码时，从源检验单补编码（不写回）。"""
        if not records:
            return

        def _blank(value: Optional[str]) -> bool:
            return not str(value or "").strip()

        incoming_ids = [
            int(r.incoming_inspection_id)
            for r in records
            if r.incoming_inspection_id and _blank(r.incoming_inspection_code)
        ]
        process_ids = [
            int(r.process_inspection_id)
            for r in records
            if r.process_inspection_id and _blank(r.process_inspection_code)
        ]
        finished_ids = [
            int(r.finished_goods_inspection_id)
            for r in records
            if r.finished_goods_inspection_id and _blank(r.finished_goods_inspection_code)
        ]

        incoming_map: Dict[int, str] = {}
        process_map: Dict[int, str] = {}
        finished_map: Dict[int, str] = {}
        if incoming_ids:
            from apps.kuaizhizao.models.incoming_inspection import IncomingInspection

            rows = await IncomingInspection.filter(
                tenant_id=tenant_id,
                id__in=incoming_ids,
                deleted_at__isnull=True,
            ).values_list("id", "inspection_code")
            incoming_map = {int(i): str(c) for i, c in rows if c}
        if process_ids:
            from apps.kuaizhizao.models.process_inspection import ProcessInspection

            rows = await ProcessInspection.filter(
                tenant_id=tenant_id,
                id__in=process_ids,
                deleted_at__isnull=True,
            ).values_list("id", "inspection_code")
            process_map = {int(i): str(c) for i, c in rows if c}
        if finished_ids:
            from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

            rows = await FinishedGoodsInspection.filter(
                tenant_id=tenant_id,
                id__in=finished_ids,
                deleted_at__isnull=True,
            ).values_list("id", "inspection_code")
            finished_map = {int(i): str(c) for i, c in rows if c}

        for record in records:
            if record.incoming_inspection_id and _blank(record.incoming_inspection_code):
                code = incoming_map.get(int(record.incoming_inspection_id))
                if code:
                    record.incoming_inspection_code = code
            if record.process_inspection_id and _blank(record.process_inspection_code):
                code = process_map.get(int(record.process_inspection_id))
                if code:
                    record.process_inspection_code = code
            if record.finished_goods_inspection_id and _blank(record.finished_goods_inspection_code):
                code = finished_map.get(int(record.finished_goods_inspection_id))
                if code:
                    record.finished_goods_inspection_code = code

    async def get_defect_record(self, tenant_id: int, defect_id: int) -> DefectRecordResponse:
        defect_record = await DefectRecord.get_or_none(
            id=defect_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not defect_record:
            raise NotFoundError(f"不良品记录不存在: {defect_id}")

        await self._hydrate_source_inspection_codes(tenant_id, [defect_record])

        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_nonconforming_ledger_list_capabilities,
        )

        response = DefectRecordResponse.model_validate(defect_record)
        enriched = await enrich_nonconforming_ledger_list_capabilities(
            tenant_id,
            [defect_record],
            [response],
        )
        return enriched[0]

    async def update_disposition(
        self,
        tenant_id: int,
        defect_id: int,
        updated_by: int,
        disposition: str,
        status: Optional[str] = None,
        quarantine_location: Optional[str] = None,
        quarantine_warehouse_id: Optional[int] = None,
        stock_warehouse_id: Optional[int] = None,
        downgrade_material_id: Optional[int] = None,
        downgrade_warehouse_id: Optional[int] = None,
        remarks: Optional[str] = None,
        attachments: Optional[list] = None,
    ) -> DefectRecordResponse:
        """更新不合格品台账处置信息并执行闭环副作用。"""
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

            self._validate_disposition_choice(defect_record, disposition)

            if disposition == "downgrade":
                resolved_material_id = downgrade_material_id or defect_record.downgrade_material_id
                resolved_warehouse_id = downgrade_warehouse_id or defect_record.downgrade_warehouse_id
                if not resolved_material_id or not resolved_warehouse_id:
                    raise ValidationError("降级回用必须指定目标原料物料与入库仓库")
                downgrade_material_id = resolved_material_id
                downgrade_warehouse_id = resolved_warehouse_id

            if disposition == "other":
                note = (remarks or "").strip() or (defect_record.remarks or "").strip()
                if not note:
                    raise ValidationError("处置为「其他」时必须填写备注")

            if disposition == "scrap" and not stock_warehouse_id:
                raise ValidationError("报废处置必须指定报废入库仓库")

            if disposition == "accept" and not stock_warehouse_id:
                raise ValidationError("让步接收必须指定放行仓库")

            if disposition == "quarantine" and not quarantine_warehouse_id:
                raise ValidationError("隔离处置必须指定隔离仓库")

            user_info = await self.get_user_info(updated_by)
            defect_record.disposition = disposition
            if downgrade_material_id is not None:
                defect_record.downgrade_material_id = downgrade_material_id
            if downgrade_warehouse_id is not None:
                defect_record.downgrade_warehouse_id = downgrade_warehouse_id
            if quarantine_location is not None:
                defect_record.quarantine_location = quarantine_location
            if remarks:
                append_line = f"[处置更新 {to_api_isoformat(resolve_business_datetime())}] {remarks}"
                defect_record.remarks = (
                    f"{defect_record.remarks}\n{append_line}".strip()
                    if defect_record.remarks
                    else append_line
                )
            if attachments is not None:
                defect_record.attachments = attachments
            # 客户端传入的 status 仅作参考；闭环成功后由副作用强制 processed
            if status and status != "processed":
                defect_record.status = status
            defect_record.updated_by = updated_by
            defect_record.updated_by_name = user_info["name"]
            await defect_record.save()

        defect_record = await self._apply_disposition_after_persist(
            tenant_id=tenant_id,
            defect_id=defect_id,
            updated_by=updated_by,
            quarantine_location=quarantine_location,
            quarantine_warehouse_id=quarantine_warehouse_id,
            stock_warehouse_id=stock_warehouse_id,
        )
        return DefectRecordResponse.model_validate(defect_record)

    def _validate_disposition_choice(self, defect_record: DefectRecord, disposition: str) -> None:
        allowed = {"return", "accept", "quarantine", "rework", "scrap", "downgrade", "other"}
        if disposition not in allowed:
            raise ValidationError(f"不支持的处置方式: {disposition}")
        if disposition == "return" and not defect_record.incoming_inspection_id:
            raise BusinessLogicError("退货处置仅适用于来料检验关联的不合格品，过程/成品请改用其他处置")
        if disposition in ("rework", "scrap") and not defect_record.work_order_id:
            if defect_record.incoming_inspection_id:
                raise BusinessLogicError(
                    "来料不合格品无法直接返工或报废，请选择退货、隔离、降级回用或其他处置"
                )
            raise BusinessLogicError("返工或报废处置需要关联工单")

    async def _resolve_scrap_operation_fields(
        self,
        tenant_id: int,
        defect_record: DefectRecord,
    ) -> tuple[int, str, str]:
        """报废单工序：优先台账已有工序；成品检验等无工序时取工单末道工序。"""
        if defect_record.operation_id:
            return (
                int(defect_record.operation_id),
                str(defect_record.operation_code or ""),
                str(defect_record.operation_name or ""),
            )
        if not defect_record.work_order_id:
            raise BusinessLogicError("报废处置需要关联工单")
        woo = (
            await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=int(defect_record.work_order_id),
                deleted_at__isnull=True,
            )
            .order_by("-sequence", "-id")
            .first()
        )
        if woo and woo.operation_id:
            return (
                int(woo.operation_id),
                str(woo.operation_code or ""),
                str(woo.operation_name or ""),
            )
        # 工单无工序排程时仍允许成品检验报废过账
        return (0, "FQC", "成品检验")

    @staticmethod
    def _resolve_linked_inspection(defect_record: DefectRecord) -> Optional[tuple[str, int]]:
        """解析不合格品台账关联的检验单（与质量异常 create_from_inspection 的 source 一致）。"""
        if defect_record.incoming_inspection_id:
            return "incoming_inspection", int(defect_record.incoming_inspection_id)
        if defect_record.process_inspection_id:
            return "process_inspection", int(defect_record.process_inspection_id)
        if defect_record.finished_goods_inspection_id:
            return "finished_goods_inspection", int(defect_record.finished_goods_inspection_id)
        return None

    async def _close_linked_quality_exceptions_after_disposition(
        self,
        defect_record: DefectRecord,
        handled_by: int,
    ) -> None:
        """不合格品处置闭环后，同步关闭同检验单下未闭环的质量异常。"""
        link = self._resolve_linked_inspection(defect_record)
        if not link:
            return
        source_type, source_id = link
        disposition = (defect_record.disposition or "").strip() or "-"
        from apps.kuaizhizao.services.exception_service import ExceptionService

        await ExceptionService().close_open_quality_exceptions_for_inspection(
            tenant_id=int(defect_record.tenant_id),
            inspection_source_type=source_type,
            inspection_record_id=source_id,
            handled_by=handled_by,
            remarks=f"[不合格品处置闭环] {defect_record.code} disposition={disposition}",
            verification_result=f"不合格品台账已处置完成（{disposition}）",
        )

    async def _mark_disposition_processed(
        self,
        defect_record: DefectRecord,
        updated_by: int,
    ) -> None:
        if not (defect_record.status == "processed" and defect_record.processed_by):
            user_info = await self.get_user_info(updated_by)
            defect_record.status = "processed"
            defect_record.processed_at = resolve_business_datetime()
            defect_record.processed_by = updated_by
            defect_record.processed_by_name = user_info["name"]
            defect_record.updated_by = updated_by
            defect_record.updated_by_name = user_info["name"]
            await defect_record.save()
        await self._close_linked_quality_exceptions_after_disposition(
            defect_record, updated_by
        )

    async def _apply_disposition_after_persist(
        self,
        tenant_id: int,
        defect_id: int,
        updated_by: int,
        *,
        quarantine_location: Optional[str] = None,
        quarantine_warehouse_id: Optional[int] = None,
        stock_warehouse_id: Optional[int] = None,
        downgrade_material_id: Optional[int] = None,
        downgrade_warehouse_id: Optional[int] = None,
    ) -> DefectRecord:
        """
        记录已持久化后执行处置闭环。退货下推禁止外层事务包裹，故单独分支。
        """
        defect_record = await DefectRecord.get(id=defect_id)
        if downgrade_material_id is not None:
            defect_record.downgrade_material_id = downgrade_material_id
        if downgrade_warehouse_id is not None:
            defect_record.downgrade_warehouse_id = downgrade_warehouse_id
        if downgrade_material_id is not None or downgrade_warehouse_id is not None:
            await defect_record.save()

        disposition = defect_record.disposition
        self._validate_disposition_choice(defect_record, disposition)

        if disposition == "scrap" and not stock_warehouse_id:
            raise ValidationError("报废处置必须指定报废入库仓库")
        if disposition == "accept" and not stock_warehouse_id:
            raise ValidationError("让步接收必须指定放行仓库")
        # 隔离：仅当调用方显式传入 quarantine_warehouse_id（如「更新处置」）时才闭环入待检仓。
        # 创建登记默认 disposition=quarantine 且未选仓时保持草稿，即使组织已配置待检仓也不自动已处理。
        if disposition == "quarantine" and not quarantine_warehouse_id:
            if not (defect_record.quarantine_location or "").strip():
                from apps.master_data.models.warehouse import Warehouse

                wh = await Warehouse.filter(
                    tenant_id=tenant_id,
                    warehouse_type="quarantine",
                    is_active=True,
                    deleted_at__isnull=True,
                ).order_by("id").first()
                if wh:
                    defect_record.quarantine_location = str(wh.name or "").strip() or None
                    if defect_record.quarantine_location:
                        await defect_record.save()
            return await DefectRecord.get(id=defect_id)

        if disposition == "other":
            if not (defect_record.remarks or "").strip():
                raise ValidationError("处置为「其他」时必须填写备注")
            await self._mark_disposition_processed(defect_record, updated_by)
            return await DefectRecord.get(id=defect_id)

        if disposition == "return":
            await self._execute_return_disposition(
                tenant_id=tenant_id,
                defect_record=defect_record,
                updated_by=updated_by,
            )
            defect_record = await DefectRecord.get(id=defect_id)
            await self._mark_disposition_processed(defect_record, updated_by)
            return await DefectRecord.get(id=defect_id)

        async with in_transaction():
            defect_record = await DefectRecord.get(id=defect_id)
            await self._execute_disposition_side_effects(
                tenant_id=tenant_id,
                defect_record=defect_record,
                updated_by=updated_by,
                quarantine_location=quarantine_location,
                quarantine_warehouse_id=quarantine_warehouse_id,
                stock_warehouse_id=stock_warehouse_id,
            )
            defect_record = await DefectRecord.get(id=defect_id)
            await self._mark_disposition_processed(defect_record, updated_by)
        return await DefectRecord.get(id=defect_id)

    async def _execute_return_disposition(
        self,
        tenant_id: int,
        defect_record: DefectRecord,
        updated_by: int,
    ) -> None:
        if defect_record.purchase_return_id:
            return
        if not defect_record.incoming_inspection_id:
            raise BusinessLogicError("退货处置需要关联来料检验单")
        from apps.kuaizhizao.services.quality_service import IncomingInspectionService

        # 禁止外层 in_transaction：push_to_purchase_return 内部自管事务与编码锁
        result = await IncomingInspectionService().push_to_purchase_return(
            tenant_id=tenant_id,
            inspection_id=int(defect_record.incoming_inspection_id),
            created_by=updated_by,
            quantity=float(defect_record.defect_quantity or 0),
        )
        return_id = result.get("return_id")
        if not return_id:
            raise BusinessLogicError("采购退货单创建失败，未返回单据ID")
        defect_record.purchase_return_id = int(return_id)
        await defect_record.save()
        logger.info(
            f"不合格品 {defect_record.code} 已下推采购退货单 {result.get('return_code')}"
        )

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

    async def _resolve_defect_stock_warehouse(
        self,
        tenant_id: int,
        defect_record: DefectRecord,
        *,
        prefer_quarantine: bool = False,
        warehouse_id_override: Optional[int] = None,
    ) -> tuple[int, str]:
        from apps.master_data.models.warehouse import Warehouse
        from apps.master_data.models.material import Material
        from apps.master_data.services.material_service import (
            resolve_primary_default_warehouse_from_material,
        )

        if warehouse_id_override:
            wh = await Warehouse.get_or_none(
                tenant_id=tenant_id,
                id=int(warehouse_id_override),
                deleted_at__isnull=True,
            )
            if not wh:
                raise NotFoundError(f"仓库不存在: {warehouse_id_override}")
            return int(wh.id), str(wh.name or "")

        if prefer_quarantine:
            wh = await Warehouse.filter(
                tenant_id=tenant_id,
                warehouse_type="quarantine",
                is_active=True,
                deleted_at__isnull=True,
            ).order_by("id").first()
            if wh:
                return int(wh.id), str(wh.name or "")

        if defect_record.downgrade_warehouse_id:
            wh = await Warehouse.get_or_none(
                tenant_id=tenant_id,
                id=int(defect_record.downgrade_warehouse_id),
                deleted_at__isnull=True,
            )
            if wh:
                return int(wh.id), str(wh.name or "")

        material = await Material.get_or_none(
            tenant_id=tenant_id,
            id=int(defect_record.product_id),
            deleted_at__isnull=True,
        )
        resolved = await resolve_primary_default_warehouse_from_material(
            tenant_id, material=material
        )
        if resolved:
            wh_id, wh_name = resolved
            return int(wh_id), str(wh_name or "")
        raise BusinessLogicError("未配置隔离仓或产品默认仓，无法处理不合格品库存")

    @staticmethod
    def _accept_inbound_already_linked(defect_record: DefectRecord) -> bool:
        return bool(
            defect_record.finished_goods_receipt_id
            or defect_record.accept_purchase_receipt_id
            or defect_record.other_inbound_id
        )

    async def _resolve_accept_material_and_warehouse(
        self,
        tenant_id: int,
        defect_record: DefectRecord,
        stock_warehouse_id: int,
    ) -> tuple[str, str, str, int, str]:
        from apps.master_data.models.material import Material
        from apps.master_data.models.warehouse import Warehouse

        material = await Material.get_or_none(
            tenant_id=tenant_id,
            id=int(defect_record.product_id),
            deleted_at__isnull=True,
        )
        if not material:
            raise NotFoundError(f"物料不存在: {defect_record.product_id}")

        warehouse = await Warehouse.get_or_none(
            tenant_id=tenant_id,
            id=int(stock_warehouse_id),
            deleted_at__isnull=True,
        )
        if not warehouse:
            raise NotFoundError(f"放行仓库不存在: {stock_warehouse_id}")

        material_code = (
            getattr(material, "main_code", None)
            or getattr(material, "code", "")
            or defect_record.product_code
            or ""
        )
        material_name = material.name or defect_record.product_name or ""
        material_unit = material.base_unit or "个"
        return (
            material_code,
            material_name,
            material_unit,
            int(warehouse.id),
            str(warehouse.name or ""),
        )

    async def _execute_accept_via_finished_goods_receipt(
        self,
        tenant_id: int,
        defect_record: DefectRecord,
        updated_by: int,
        *,
        stock_warehouse_id: int,
        material_code: str,
        material_name: str,
        material_unit: str,
        warehouse_id: int,
        warehouse_name: str,
        qty: float,
    ) -> None:
        from decimal import Decimal
        from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
        from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService
        from apps.kuaizhizao.services.semi_finished_goods_receipt_service import (
            SemiFinishedGoodsReceiptService,
        )
        from apps.kuaizhizao.schemas.warehouse import (
            FinishedGoodsReceiptCreate,
            FinishedGoodsReceiptItemCreate,
            SemiFinishedGoodsReceiptCreate,
            SemiFinishedGoodsReceiptItemCreate,
        )
        from apps.kuaizhizao.services.work_order_inbound_bom_role import (
            is_semi_finished_product_by_bom_role,
        )

        inspection = await FinishedGoodsInspection.get_or_none(
            tenant_id=tenant_id,
            id=int(defect_record.finished_goods_inspection_id),
            deleted_at__isnull=True,
        )
        if not inspection:
            raise NotFoundError(f"成品检验单不存在: {defect_record.finished_goods_inspection_id}")
        if not inspection.work_order_id:
            raise BusinessLogicError("成品检验单未关联工单，无法生成成品入库单")

        push_qty = Decimal(str(qty))
        notes = f"由不合格品台账 {defect_record.code} 让步接收（检验 {inspection.inspection_code}）"
        use_semi = await is_semi_finished_product_by_bom_role(tenant_id, inspection.material_id)

        if use_semi:
            sf_svc = SemiFinishedGoodsReceiptService()
            receipt = await sf_svc.create_semi_finished_goods_receipt(
                tenant_id=tenant_id,
                receipt_data=SemiFinishedGoodsReceiptCreate(
                    work_order_id=inspection.work_order_id,
                    work_order_code=inspection.work_order_code,
                    sales_order_id=inspection.sales_order_id,
                    sales_order_code=inspection.sales_order_code,
                    warehouse_id=warehouse_id,
                    warehouse_name=warehouse_name,
                    receipt_time=resolve_business_datetime(),
                    status="待入库",
                    notes=notes + "（半成品入库）",
                ),
                created_by=updated_by,
                items=[
                    SemiFinishedGoodsReceiptItemCreate(
                        material_id=inspection.material_id,
                        material_code=material_code or inspection.material_code,
                        material_name=material_name or inspection.material_name,
                        material_unit=material_unit,
                        receipt_quantity=push_qty,
                        qualified_quantity=push_qty,
                        unqualified_quantity=0,
                        batch_number=inspection.batch_number,
                        quality_inspection_id=inspection.id,
                        quality_status="合格",
                    )
                ],
            )
            defect_record.finished_goods_receipt_id = receipt.id
            await defect_record.save()
            confirmed = await sf_svc.confirm_receipt(
                tenant_id=tenant_id,
                receipt_id=receipt.id,
                confirmed_by=updated_by,
            )
            receipt_code = confirmed.receipt_code
            target_type = "semi_finished_goods_receipt"
        else:
            wh_svc = FinishedGoodsReceiptService()
            receipt = await wh_svc.create_finished_goods_receipt(
                tenant_id=tenant_id,
                receipt_data=FinishedGoodsReceiptCreate(
                    work_order_id=inspection.work_order_id,
                    work_order_code=inspection.work_order_code,
                    sales_order_id=inspection.sales_order_id,
                    sales_order_code=inspection.sales_order_code,
                    warehouse_id=warehouse_id,
                    warehouse_name=warehouse_name,
                    receipt_time=resolve_business_datetime(),
                    status="待入库",
                    notes=notes,
                ),
                created_by=updated_by,
                items=[
                    FinishedGoodsReceiptItemCreate(
                        material_id=inspection.material_id,
                        material_code=material_code or inspection.material_code,
                        material_name=material_name or inspection.material_name,
                        material_unit=material_unit,
                        receipt_quantity=push_qty,
                        qualified_quantity=push_qty,
                        unqualified_quantity=0,
                        batch_number=inspection.batch_number,
                        quality_inspection_id=inspection.id,
                        quality_status="合格",
                    )
                ],
            )
            defect_record.finished_goods_receipt_id = receipt.id
            await defect_record.save()
            confirmed = await wh_svc.confirm_receipt(
                tenant_id=tenant_id,
                receipt_id=receipt.id,
                confirmed_by=updated_by,
            )
            receipt_code = confirmed.receipt_code
            target_type = "finished_goods_receipt"

        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        await DocumentRelationNewService().create_relation(
            tenant_id=tenant_id,
            relation_data=DocumentRelationCreate(
                source_type="finished_goods_inspection",
                source_id=int(inspection.id),
                source_code=inspection.inspection_code,
                source_name=None,
                target_type=target_type,
                target_id=int(confirmed.id),
                target_code=receipt_code,
                target_name=None,
                relation_type="source",
                relation_mode="push",
                relation_desc="不合格品让步接收入库",
            ),
            created_by=updated_by,
        )
        logger.info(
            f"不合格品 {defect_record.code} 已让步接收入库 {receipt_code}"
        )

    async def _execute_accept_via_purchase_receipt(
        self,
        tenant_id: int,
        defect_record: DefectRecord,
        updated_by: int,
        *,
        stock_warehouse_id: int,
        material_code: str,
        material_name: str,
        material_unit: str,
        warehouse_id: int,
        warehouse_name: str,
        qty: float,
    ) -> None:
        from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.services.warehouse_service import PurchaseReceiptService
        from apps.kuaizhizao.schemas.warehouse import PurchaseReceiptCreate, PurchaseReceiptItemCreate

        inspection = await IncomingInspection.get_or_none(
            tenant_id=tenant_id,
            id=int(defect_record.incoming_inspection_id),
            deleted_at__isnull=True,
        )
        if not inspection:
            raise NotFoundError(f"来料检验单不存在: {defect_record.incoming_inspection_id}")
        if not inspection.supplier_id:
            raise BusinessLogicError("来料检验未关联供应商，无法生成采购入库单")

        purchase_order_id = 0
        purchase_order_code = ""
        if inspection.purchase_receipt_id:
            orig = await PurchaseReceipt.get_or_none(
                tenant_id=tenant_id,
                id=int(inspection.purchase_receipt_id),
                deleted_at__isnull=True,
            )
            if orig:
                purchase_order_id = int(orig.purchase_order_id or 0)
                purchase_order_code = str(orig.purchase_order_code or "")

        material_spec = getattr(inspection, "material_spec", None)
        receipt = await PurchaseReceiptService().create_purchase_receipt(
            tenant_id=tenant_id,
            receipt_data=PurchaseReceiptCreate(
                purchase_order_id=purchase_order_id,
                purchase_order_code=purchase_order_code,
                supplier_id=int(inspection.supplier_id),
                supplier_name=str(inspection.supplier_name or ""),
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_name,
                receipt_time=resolve_business_datetime(),
                status="待入库",
                notes=f"由不合格品台账 {defect_record.code} 让步接收（检验 {inspection.inspection_code}）",
                items=[
                    PurchaseReceiptItemCreate(
                        material_id=int(defect_record.product_id),
                        material_code=material_code or inspection.material_code,
                        material_name=material_name or inspection.material_name,
                        material_spec=material_spec,
                        material_unit=material_unit or inspection.material_unit,
                        receipt_quantity=qty,
                        unit_price=0,
                        total_amount=0,
                        qualified_quantity=qty,
                        unqualified_quantity=0,
                        quality_status="合格",
                    )
                ],
            ),
            created_by=updated_by,
        )

        defect_record.accept_purchase_receipt_id = receipt.id
        await defect_record.save()

        confirmed = await PurchaseReceiptService().confirm_receipt(
            tenant_id=tenant_id,
            receipt_id=receipt.id,
            confirmed_by=updated_by,
        )

        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        await DocumentRelationNewService().create_relation(
            tenant_id=tenant_id,
            relation_data=DocumentRelationCreate(
                source_type="incoming_inspection",
                source_id=int(inspection.id),
                source_code=inspection.inspection_code,
                source_name=None,
                target_type="purchase_receipt",
                target_id=int(confirmed.id),
                target_code=confirmed.receipt_code,
                target_name=None,
                relation_type="source",
                relation_mode="push",
                relation_desc="不合格品让步接收入库",
            ),
            created_by=updated_by,
        )
        logger.info(
            f"不合格品 {defect_record.code} 已让步接收入库 {confirmed.receipt_code}"
        )

    async def _execute_accept_via_other_inbound(
        self,
        tenant_id: int,
        defect_record: DefectRecord,
        updated_by: int,
        *,
        material_code: str,
        material_name: str,
        material_unit: str,
        warehouse_id: int,
        warehouse_name: str,
        qty: float,
    ) -> None:
        reason_desc_parts = [f"不合格品台账 {defect_record.code} 让步接收"]
        if defect_record.incoming_inspection_code:
            reason_desc_parts.append(f"来料检验 {defect_record.incoming_inspection_code}")
        if defect_record.finished_goods_inspection_code:
            reason_desc_parts.append(f"成品检验 {defect_record.finished_goods_inspection_code}")
        if defect_record.process_inspection_code:
            reason_desc_parts.append(f"过程检验 {defect_record.process_inspection_code}")
        if defect_record.work_order_code:
            reason_desc_parts.append(f"工单 {defect_record.work_order_code}")

        from apps.kuaizhizao.services.warehouse_service import OtherInboundService
        from apps.kuaizhizao.schemas.warehouse import OtherInboundCreate, OtherInboundItemCreate

        inbound_service = OtherInboundService()
        inbound = await inbound_service.create_other_inbound(
            tenant_id=tenant_id,
            inbound_data=OtherInboundCreate(
                reason_type="让步接收",
                reason_desc="；".join(reason_desc_parts),
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_name,
                notes=f"由不合格品台账 {defect_record.code} 自动生成",
                items=[
                    OtherInboundItemCreate(
                        material_id=int(defect_record.product_id),
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

        defect_record.other_inbound_id = confirmed.id
        await defect_record.save()
        logger.info(
            f"不合格品 {defect_record.code} 已让步接收入库 {confirmed.inbound_code}"
        )

    async def _execute_accept_concession_inbound(
        self,
        tenant_id: int,
        defect_record: DefectRecord,
        updated_by: int,
        *,
        stock_warehouse_id: int,
    ) -> None:
        """让步接收：按来源检验生成对应入库单并确认过账。"""
        if self._accept_inbound_already_linked(defect_record):
            return

        qty = float(defect_record.defect_quantity or 0)
        if qty <= 0:
            raise ValidationError("让步接收数量必须大于0")

        (
            material_code,
            material_name,
            material_unit,
            warehouse_id,
            warehouse_name,
        ) = await self._resolve_accept_material_and_warehouse(
            tenant_id,
            defect_record,
            stock_warehouse_id,
        )

        if defect_record.finished_goods_inspection_id:
            await self._execute_accept_via_finished_goods_receipt(
                tenant_id=tenant_id,
                defect_record=defect_record,
                updated_by=updated_by,
                stock_warehouse_id=stock_warehouse_id,
                material_code=material_code,
                material_name=material_name,
                material_unit=material_unit,
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_name,
                qty=qty,
            )
            return

        if defect_record.incoming_inspection_id:
            from apps.kuaizhizao.models.incoming_inspection import IncomingInspection

            inspection = await IncomingInspection.get_or_none(
                tenant_id=tenant_id,
                id=int(defect_record.incoming_inspection_id),
                deleted_at__isnull=True,
            )
            if inspection and inspection.supplier_id:
                await self._execute_accept_via_purchase_receipt(
                    tenant_id=tenant_id,
                    defect_record=defect_record,
                    updated_by=updated_by,
                    stock_warehouse_id=stock_warehouse_id,
                    material_code=material_code,
                    material_name=material_name,
                    material_unit=material_unit,
                    warehouse_id=warehouse_id,
                    warehouse_name=warehouse_name,
                    qty=qty,
                )
                return

        await self._execute_accept_via_other_inbound(
            tenant_id=tenant_id,
            defect_record=defect_record,
            updated_by=updated_by,
            material_code=material_code,
            material_name=material_name,
            material_unit=material_unit,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
            qty=qty,
        )

    async def _inbound_defect_quantity_as(
        self,
        tenant_id: int,
        defect_record: DefectRecord,
        *,
        quality_status: str,
        operator_id: int,
        prefer_quarantine: bool = False,
        warehouse_id_override: Optional[int] = None,
        movement_type: str,
        idempotency_suffix: str,
    ) -> None:
        from decimal import Decimal
        from apps.kuaizhizao.services.inventory_service import InventoryService

        qty = Decimal(str(defect_record.defect_quantity or 0))
        if qty <= 0:
            raise ValidationError("不合格品数量必须大于0")
        wh_id, wh_name = await self._resolve_defect_stock_warehouse(
            tenant_id,
            defect_record,
            prefer_quarantine=prefer_quarantine,
            warehouse_id_override=warehouse_id_override,
        )
        await InventoryService.increase_stock(
            tenant_id=tenant_id,
            material_id=int(defect_record.product_id),
            quantity=qty,
            warehouse_id=wh_id,
            source_type="defect_disposition",
            source_doc_id=int(defect_record.id),
            source_doc_code=defect_record.code,
            work_order_id=defect_record.work_order_id,
            work_order_code=defect_record.work_order_code,
            movement_type=movement_type,
            to_warehouse_id=wh_id,
            to_warehouse_name=wh_name,
            operator_id=operator_id,
            remark=f"不合格品处置 {defect_record.code}",
            idempotency_key=f"defect:{defect_record.id}:{idempotency_suffix}",
            quality_status=quality_status,
        )

    async def _write_off_defect_product_stock(
        self,
        tenant_id: int,
        defect_record: DefectRecord,
        operator_id: int,
        *,
        movement_type: str = "defect_downgrade_writeoff",
        source_type: str = "defect_downgrade",
        remark: Optional[str] = None,
        idempotency_prefix: str = "defect_downgrade",
        include_qualified: bool = False,
    ) -> None:
        from decimal import Decimal
        from apps.kuaizhizao.services.inventory_service import InventoryService
        from apps.master_data.constants.batch_quality_status import QUARANTINE, UNQUALIFIED, QUALIFIED
        from infra.exceptions.exceptions import BusinessLogicError

        qty = Decimal(str(defect_record.defect_quantity or 0))
        if qty <= 0:
            return
        wh_id, _ = await self._resolve_defect_stock_warehouse(tenant_id, defect_record)
        statuses = (UNQUALIFIED, QUARANTINE, QUALIFIED) if include_qualified else (UNQUALIFIED, QUARANTINE)
        note = remark or f"核销原产品 {defect_record.code}"
        for status in statuses:
            try:
                await InventoryService.decrease_stock(
                    tenant_id=tenant_id,
                    material_id=int(defect_record.product_id),
                    quantity=qty,
                    warehouse_id=wh_id,
                    source_type=source_type,
                    source_doc_id=int(defect_record.id),
                    source_doc_code=defect_record.code,
                    work_order_id=defect_record.work_order_id,
                    work_order_code=defect_record.work_order_code,
                    movement_type=movement_type,
                    from_warehouse_id=wh_id,
                    operator_id=operator_id,
                    remark=note,
                    idempotency_key=f"{idempotency_prefix}:{defect_record.id}:writeoff:{status}",
                    stock_quality_status=status,
                )
                return
            except BusinessLogicError:
                continue

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

        await self._write_off_defect_product_stock(
            tenant_id=tenant_id,
            defect_record=defect_record,
            operator_id=updated_by,
        )

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
        quarantine_warehouse_id: Optional[int] = None,
        stock_warehouse_id: Optional[int] = None,
    ) -> None:
        """处置返工/报废/隔离/让步/降级时调用对应业务服务；退货请走 _execute_return_disposition。"""
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
            if not defect_record.work_order_id:
                if defect_record.incoming_inspection_id:
                    raise BusinessLogicError(
                        "来料不合格品无法直接报废，请选择退货、隔离、降级回用或其他处置"
                    )
                raise BusinessLogicError("报废处置需要关联工单")
            operation_id, operation_code, operation_name = await self._resolve_scrap_operation_fields(
                tenant_id, defect_record
            )
            if not defect_record.operation_id:
                defect_record.operation_id = operation_id
                defect_record.operation_code = operation_code
                defect_record.operation_name = operation_name
                await defect_record.save()
            if not stock_warehouse_id:
                raise ValidationError("报废处置必须指定报废入库仓库")
            from apps.master_data.constants.batch_quality_status import UNQUALIFIED
            from apps.master_data.models.warehouse import Warehouse
            from apps.kuaizhizao.models.scrap_record import ScrapRecord
            from apps.kuaizhizao.services.scrap_record_service import ScrapRecordService

            scrap_wh_id = int(stock_warehouse_id)
            scrap_wh = await Warehouse.get_or_none(
                tenant_id=tenant_id,
                id=scrap_wh_id,
                deleted_at__isnull=True,
            )
            if not scrap_wh:
                raise NotFoundError(f"报废仓库不存在: {scrap_wh_id}")
            scrap_wh_name = str(scrap_wh.name or "")

            if defect_record.scrap_record_id:
                existing = await ScrapRecord.get_or_none(
                    id=defect_record.scrap_record_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                )
                if existing and existing.status == "draft":
                    await self._write_off_defect_product_stock(
                        tenant_id=tenant_id,
                        defect_record=defect_record,
                        operator_id=updated_by,
                        movement_type="defect_scrap_writeoff",
                        source_type="defect_disposition",
                        remark=f"不合格品报废核销 {defect_record.code}",
                        idempotency_prefix="defect_scrap",
                        include_qualified=True,
                    )
                    await self._inbound_defect_quantity_as(
                        tenant_id=tenant_id,
                        defect_record=defect_record,
                        quality_status=UNQUALIFIED,
                        operator_id=updated_by,
                        warehouse_id_override=scrap_wh_id,
                        movement_type="defect_scrap",
                        idempotency_suffix="scrap",
                    )
                    await ScrapRecordService().approve_scrap_record(
                        tenant_id=tenant_id,
                        scrap_id=existing.id,
                        approved=True,
                        approved_by=updated_by,
                        post_inventory=False,
                    )
                return

            await self._write_off_defect_product_stock(
                tenant_id=tenant_id,
                defect_record=defect_record,
                operator_id=updated_by,
                movement_type="defect_scrap_writeoff",
                source_type="defect_disposition",
                remark=f"不合格品报废核销 {defect_record.code}",
                idempotency_prefix="defect_scrap",
                include_qualified=True,
            )
            await self._inbound_defect_quantity_as(
                tenant_id=tenant_id,
                defect_record=defect_record,
                quality_status=UNQUALIFIED,
                operator_id=updated_by,
                warehouse_id_override=scrap_wh_id,
                movement_type="defect_scrap",
                idempotency_suffix="scrap",
            )

            import uuid
            from decimal import Decimal

            today = today_site_str()
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="SCRAP_RECORD_CODE",
                prefix=f"SC{today}",
            )
            user_info = await self.get_user_info(updated_by)
            scrap_record = await ScrapRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                reporting_record_id=defect_record.reporting_record_id,
                work_order_id=defect_record.work_order_id,
                work_order_code=defect_record.work_order_code,
                operation_id=operation_id,
                operation_code=operation_code,
                operation_name=operation_name,
                product_id=defect_record.product_id,
                product_code=defect_record.product_code,
                product_name=defect_record.product_name,
                scrap_quantity=defect_record.defect_quantity,
                total_cost=Decimal("0"),
                scrap_reason=f"不合格品报废：{defect_record.defect_reason}",
                scrap_type="quality",
                warehouse_id=scrap_wh_id,
                warehouse_name=scrap_wh_name,
                status="draft",
                remarks=f"从不合格品台账 {defect_record.code} 创建",
                created_by=updated_by,
                created_by_name=user_info["name"],
                updated_by=updated_by,
                updated_by_name=user_info["name"],
            )
            defect_record.scrap_record_id = scrap_record.id
            await defect_record.save()
            await ScrapRecordService().approve_scrap_record(
                tenant_id=tenant_id,
                scrap_id=scrap_record.id,
                approved=True,
                approved_by=updated_by,
                post_inventory=False,
            )
            logger.info(
                f"不合格品 {defect_record.code} 已报废入库至 {scrap_wh_name} 并确认报废记录 {scrap_record.code}"
            )

        elif disposition == "quarantine":
            if not quarantine_warehouse_id:
                raise ValidationError("隔离处置必须指定隔离仓库")
            location = quarantine_location or defect_record.quarantine_location
            wh_override = int(quarantine_warehouse_id)
            from apps.master_data.models.warehouse import Warehouse

            wh = await Warehouse.get_or_none(
                tenant_id=tenant_id,
                id=wh_override,
                deleted_at__isnull=True,
            )
            if not wh:
                raise NotFoundError(f"隔离仓库不存在: {wh_override}")
            location = location or str(wh.name or "")
            if not location:
                raise ValidationError("隔离处置缺少隔离位置或仓库名称")
            defect_record.quarantine_location = location
            await defect_record.save()
            from apps.master_data.constants.batch_quality_status import QUARANTINE

            await self._inbound_defect_quantity_as(
                tenant_id=tenant_id,
                defect_record=defect_record,
                quality_status=QUARANTINE,
                operator_id=updated_by,
                prefer_quarantine=True,
                warehouse_id_override=wh_override,
                movement_type="defect_quarantine",
                idempotency_suffix="quarantine",
            )
            logger.info(f"不合格品 {defect_record.code} 已隔离至 {location}")

        elif disposition == "accept":
            if not stock_warehouse_id:
                raise ValidationError("让步接收必须指定放行仓库")
            await self._execute_accept_concession_inbound(
                tenant_id=tenant_id,
                defect_record=defect_record,
                updated_by=updated_by,
                stock_warehouse_id=int(stock_warehouse_id),
            )

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
        quarantine_location: Optional[str] = None,
        quarantine_warehouse_id: Optional[int] = None,
        stock_warehouse_id: Optional[int] = None,
    ) -> DefectRecord:
        """创建后统一执行处置闭环（兼容旧名）。"""
        return await self._apply_disposition_after_persist(
            tenant_id=tenant_id,
            defect_id=int(defect_record.id),
            updated_by=created_by,
            quarantine_location=quarantine_location,
            quarantine_warehouse_id=quarantine_warehouse_id,
            stock_warehouse_id=stock_warehouse_id,
            downgrade_material_id=downgrade_material_id,
            downgrade_warehouse_id=downgrade_warehouse_id,
        )

    @staticmethod
    def _dec_qty(value: Any) -> Decimal:
        try:
            return Decimal(str(value or 0))
        except Exception:
            return Decimal("0")

    async def _sum_registered_defect_quantity(
        self,
        tenant_id: int,
        *,
        incoming_inspection_id: Optional[int] = None,
        process_inspection_id: Optional[int] = None,
        finished_goods_inspection_id: Optional[int] = None,
        reporting_record_id: Optional[int] = None,
    ) -> Decimal:
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True)
        query &= ~Q(status="cancelled")
        if incoming_inspection_id is not None:
            query &= Q(incoming_inspection_id=int(incoming_inspection_id))
        elif process_inspection_id is not None:
            query &= Q(process_inspection_id=int(process_inspection_id))
        elif finished_goods_inspection_id is not None:
            query &= Q(finished_goods_inspection_id=int(finished_goods_inspection_id))
        elif reporting_record_id is not None:
            query &= Q(reporting_record_id=int(reporting_record_id))
        else:
            return Decimal("0")
        rows = await DefectRecord.filter(query).all()
        return sum(self._dec_qty(row.defect_quantity) for row in rows)

    @staticmethod
    def _assert_defect_quantity_budget(
        new_quantity: Decimal,
        *,
        existing_registered: Decimal,
        unqualified_quantity: Decimal,
    ) -> None:
        remaining = max(
            Decimal("0"),
            DefectRecordService._dec_qty(unqualified_quantity) - existing_registered,
        )
        qty = DefectRecordService._dec_qty(new_quantity)
        if qty <= 0:
            raise ValidationError("不合格品数量必须大于 0")
        if qty > remaining:
            raise ValidationError(
                f"不合格品数量({qty})不能超过待登记不合格数量({remaining})"
            )

    @staticmethod
    def _validate_defect_line_for_source(
        defect_data: DefectRecordCreateFromInspection,
        source: Literal["incoming", "process", "finished"],
    ) -> None:
        if source == "incoming":
            if defect_data.disposition in ("rework", "scrap"):
                raise BusinessLogicError(
                    "来料不合格品无法直接返工或报废，请选择退货、隔离、降级回用或其他处置"
                )
        elif source == "process":
            if defect_data.disposition == "return":
                raise BusinessLogicError("过程检验不合格品不能使用退货处置，请选择返工、报废、隔离等")
        elif source == "finished":
            if defect_data.disposition == "return":
                raise BusinessLogicError("成品检验不合格品不能使用退货处置，请选择返工、报废、隔离等")
        if defect_data.disposition == "other" and not (defect_data.remarks or "").strip():
            raise ValidationError("处置为「其他」时必须填写备注")
        if defect_data.disposition == "downgrade" and (
            not defect_data.downgrade_material_id or not defect_data.downgrade_warehouse_id
        ):
            raise ValidationError("降级回用必须指定目标原料物料与入库仓库")

    def _validate_defect_lines_batch(
        self,
        lines: List[DefectRecordCreateFromInspection],
        *,
        existing_registered: Decimal,
        unqualified_quantity: Decimal,
        source: Literal["incoming", "process", "finished"],
    ) -> Decimal:
        if not lines:
            raise ValidationError("至少登记一行不合格明细")
        total_new = sum(self._dec_qty(line.defect_quantity) for line in lines)
        remaining = max(Decimal("0"), self._dec_qty(unqualified_quantity) - existing_registered)
        if total_new <= 0:
            raise ValidationError("明细数量合计必须大于 0")
        if total_new > remaining:
            raise ValidationError(
                f"明细数量合计({total_new})不能超过待登记不合格数量({remaining})"
            )
        for line in lines:
            if self._dec_qty(line.defect_quantity) <= 0:
                raise ValidationError("每行不合格品数量必须大于 0")
            if not (line.defect_reason or "").strip():
                raise ValidationError("每行必须填写不合格原因")
            self._validate_defect_line_for_source(line, source)
        return total_new

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

            existing_registered = await self._sum_registered_defect_quantity(
                tenant_id,
                incoming_inspection_id=inspection_id,
            )
            self._assert_defect_quantity_budget(
                defect_data.defect_quantity,
                existing_registered=existing_registered,
                unqualified_quantity=inspection.unqualified_quantity,
            )
            if not (defect_data.defect_reason or "").strip():
                raise ValidationError("必须填写不合格原因")
            self._validate_defect_line_for_source(defect_data, "incoming")

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
            created_id = int(defect_record.id)

        defect_record = await self._maybe_execute_downgrade_after_create(
            tenant_id=tenant_id,
            defect_record=await DefectRecord.get(id=created_id),
            created_by=created_by,
            downgrade_material_id=defect_data.downgrade_material_id,
            downgrade_warehouse_id=defect_data.downgrade_warehouse_id,
            quarantine_location=getattr(defect_data, "quarantine_location", None),
            quarantine_warehouse_id=getattr(defect_data, "quarantine_warehouse_id", None),
            stock_warehouse_id=getattr(defect_data, "stock_warehouse_id", None),
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

            existing_registered = await self._sum_registered_defect_quantity(
                tenant_id,
                process_inspection_id=inspection_id,
            )
            self._assert_defect_quantity_budget(
                defect_data.defect_quantity,
                existing_registered=existing_registered,
                unqualified_quantity=inspection.unqualified_quantity,
            )
            if not (defect_data.defect_reason or "").strip():
                raise ValidationError("必须填写不合格原因")
            self._validate_defect_line_for_source(defect_data, "process")

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
            created_id = int(defect_record.id)

        defect_record = await self._maybe_execute_downgrade_after_create(
            tenant_id=tenant_id,
            defect_record=await DefectRecord.get(id=created_id),
            created_by=created_by,
            downgrade_material_id=defect_data.downgrade_material_id,
            downgrade_warehouse_id=defect_data.downgrade_warehouse_id,
            quarantine_location=getattr(defect_data, "quarantine_location", None),
            quarantine_warehouse_id=getattr(defect_data, "quarantine_warehouse_id", None),
            stock_warehouse_id=getattr(defect_data, "stock_warehouse_id", None),
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

            existing_registered = await self._sum_registered_defect_quantity(
                tenant_id,
                finished_goods_inspection_id=inspection_id,
            )
            self._assert_defect_quantity_budget(
                defect_data.defect_quantity,
                existing_registered=existing_registered,
                unqualified_quantity=inspection.unqualified_quantity,
            )
            if not (defect_data.defect_reason or "").strip():
                raise ValidationError("必须填写不合格原因")
            self._validate_defect_line_for_source(defect_data, "finished")

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
            created_id = int(defect_record.id)

        defect_record = await self._maybe_execute_downgrade_after_create(
            tenant_id=tenant_id,
            defect_record=await DefectRecord.get(id=created_id),
            created_by=created_by,
            downgrade_material_id=defect_data.downgrade_material_id,
            downgrade_warehouse_id=defect_data.downgrade_warehouse_id,
            quarantine_location=getattr(defect_data, "quarantine_location", None),
            quarantine_warehouse_id=getattr(defect_data, "quarantine_warehouse_id", None),
            stock_warehouse_id=getattr(defect_data, "stock_warehouse_id", None),
        )
        return DefectRecordResponse.model_validate(defect_record)

    @staticmethod
    def _merge_defect_problem_descriptions(lines: List[DefectRecordCreateFromInspection]) -> str:
        seen: List[str] = []
        for line in lines:
            text = str(line.defect_reason or "").strip()
            if text and text not in seen:
                seen.append(text)
        return "；".join(seen) if seen else "检验不合格"

    async def create_defects_batch_from_incoming_inspection(
        self,
        tenant_id: int,
        inspection_id: int,
        batch: DefectRecordCreateFromInspectionBatch,
        created_by: int,
    ) -> List[DefectRecordResponse]:
        await self._assert_defect_handling_enabled(tenant_id)
        import uuid
        from apps.kuaizhizao.models.incoming_inspection import IncomingInspection

        created_payloads: List[tuple[int, DefectRecordCreateFromInspection]] = []

        async with in_transaction():
            inspection = await IncomingInspection.get_or_none(
                id=inspection_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not inspection:
                raise NotFoundError(f"来料检验单不存在: {inspection_id}")

            from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
                assert_quality_inspection_capability,
            )

            assert_quality_inspection_capability(inspection, "create_defect")
            existing_registered = await self._sum_registered_defect_quantity(
                tenant_id,
                incoming_inspection_id=inspection_id,
            )
            self._validate_defect_lines_batch(
                batch.lines,
                existing_registered=existing_registered,
                unqualified_quantity=inspection.unqualified_quantity,
                source="incoming",
            )

            user_info = await self.get_user_info(created_by)
            today = today_site_str()

            for line in batch.lines:
                code = await self.generate_code(
                    tenant_id=tenant_id,
                    code_type="DEFECT_RECORD_CODE",
                    prefix=f"DF{today}",
                )
                defect_record = await DefectRecord.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    code=code,
                    incoming_inspection_id=inspection_id,
                    incoming_inspection_code=inspection.inspection_code,
                    product_id=inspection.material_id,
                    product_code=inspection.material_code,
                    product_name=inspection.material_name,
                    defect_quantity=line.defect_quantity,
                    defect_type=line.defect_type,
                    defect_reason=line.defect_reason,
                    disposition=line.disposition,
                    status="draft",
                    remarks=line.remarks,
                    created_by=created_by,
                    created_by_name=user_info["name"],
                    updated_by=created_by,
                    updated_by_name=user_info["name"],
                )
                created_payloads.append((int(defect_record.id), line))
                logger.info(
                    f"从来料检验单 {inspection.inspection_code} 批量创建不合格品记录: {code}"
                )

            from apps.kuaizhizao.services.exception_service import ExceptionService

            await ExceptionService().create_from_inspection(
                tenant_id=tenant_id,
                source_type="incoming_inspection",
                source_id=inspection_id,
                created_by=created_by,
                problem_description=self._merge_defect_problem_descriptions(batch.lines),
            )

        responses: List[DefectRecordResponse] = []
        for created_id, line in created_payloads:
            defect_record = await self._maybe_execute_downgrade_after_create(
                tenant_id=tenant_id,
                defect_record=await DefectRecord.get(id=created_id),
                created_by=created_by,
                downgrade_material_id=line.downgrade_material_id,
                downgrade_warehouse_id=line.downgrade_warehouse_id,
                quarantine_location=getattr(line, "quarantine_location", None),
                quarantine_warehouse_id=getattr(line, "quarantine_warehouse_id", None),
                stock_warehouse_id=getattr(line, "stock_warehouse_id", None),
            )
            responses.append(DefectRecordResponse.model_validate(defect_record))
        return responses

    async def create_defects_batch_from_process_inspection(
        self,
        tenant_id: int,
        inspection_id: int,
        batch: DefectRecordCreateFromInspectionBatch,
        created_by: int,
    ) -> List[DefectRecordResponse]:
        await self._assert_defect_handling_enabled(tenant_id)
        import uuid
        from apps.kuaizhizao.models.process_inspection import ProcessInspection

        created_payloads: List[tuple[int, DefectRecordCreateFromInspection]] = []

        async with in_transaction():
            inspection = await ProcessInspection.get_or_none(
                id=inspection_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not inspection:
                raise NotFoundError(f"过程检验单不存在: {inspection_id}")

            from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
                assert_quality_inspection_capability,
            )

            assert_quality_inspection_capability(inspection, "create_defect")
            existing_registered = await self._sum_registered_defect_quantity(
                tenant_id,
                process_inspection_id=inspection_id,
            )
            self._validate_defect_lines_batch(
                batch.lines,
                existing_registered=existing_registered,
                unqualified_quantity=inspection.unqualified_quantity,
                source="process",
            )

            user_info = await self.get_user_info(created_by)
            today = today_site_str()

            for line in batch.lines:
                code = await self.generate_code(
                    tenant_id=tenant_id,
                    code_type="DEFECT_RECORD_CODE",
                    prefix=f"DF{today}",
                )
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
                    defect_quantity=line.defect_quantity,
                    defect_type=line.defect_type,
                    defect_reason=line.defect_reason,
                    disposition=line.disposition,
                    status="draft",
                    remarks=line.remarks,
                    created_by=created_by,
                    created_by_name=user_info["name"],
                    updated_by=created_by,
                    updated_by_name=user_info["name"],
                )
                created_payloads.append((int(defect_record.id), line))

            from apps.kuaizhizao.services.exception_service import ExceptionService

            await ExceptionService().create_from_inspection(
                tenant_id=tenant_id,
                source_type="process_inspection",
                source_id=inspection_id,
                created_by=created_by,
                problem_description=self._merge_defect_problem_descriptions(batch.lines),
            )

        responses: List[DefectRecordResponse] = []
        for created_id, line in created_payloads:
            defect_record = await self._maybe_execute_downgrade_after_create(
                tenant_id=tenant_id,
                defect_record=await DefectRecord.get(id=created_id),
                created_by=created_by,
                downgrade_material_id=line.downgrade_material_id,
                downgrade_warehouse_id=line.downgrade_warehouse_id,
                quarantine_location=getattr(line, "quarantine_location", None),
                quarantine_warehouse_id=getattr(line, "quarantine_warehouse_id", None),
                stock_warehouse_id=getattr(line, "stock_warehouse_id", None),
            )
            responses.append(DefectRecordResponse.model_validate(defect_record))
        return responses

    async def create_defects_batch_from_finished_goods_inspection(
        self,
        tenant_id: int,
        inspection_id: int,
        batch: DefectRecordCreateFromInspectionBatch,
        created_by: int,
    ) -> List[DefectRecordResponse]:
        await self._assert_defect_handling_enabled(tenant_id)
        import uuid
        from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

        created_payloads: List[tuple[int, DefectRecordCreateFromInspection]] = []

        async with in_transaction():
            inspection = await FinishedGoodsInspection.get_or_none(
                id=inspection_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not inspection:
                raise NotFoundError(f"成品检验单不存在: {inspection_id}")

            from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
                assert_quality_inspection_capability,
            )

            assert_quality_inspection_capability(inspection, "create_defect")
            existing_registered = await self._sum_registered_defect_quantity(
                tenant_id,
                finished_goods_inspection_id=inspection_id,
            )
            self._validate_defect_lines_batch(
                batch.lines,
                existing_registered=existing_registered,
                unqualified_quantity=inspection.unqualified_quantity,
                source="finished",
            )

            user_info = await self.get_user_info(created_by)
            today = today_site_str()

            for line in batch.lines:
                code = await self.generate_code(
                    tenant_id=tenant_id,
                    code_type="DEFECT_RECORD_CODE",
                    prefix=f"DF{today}",
                )
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
                    defect_quantity=line.defect_quantity,
                    defect_type=line.defect_type,
                    defect_reason=line.defect_reason,
                    disposition=line.disposition,
                    status="draft",
                    remarks=line.remarks,
                    created_by=created_by,
                    created_by_name=user_info["name"],
                    updated_by=created_by,
                    updated_by_name=user_info["name"],
                )
                created_payloads.append((int(defect_record.id), line))

            from apps.kuaizhizao.services.exception_service import ExceptionService

            await ExceptionService().create_from_inspection(
                tenant_id=tenant_id,
                source_type="finished_goods_inspection",
                source_id=inspection_id,
                created_by=created_by,
                problem_description=self._merge_defect_problem_descriptions(batch.lines),
            )

        responses: List[DefectRecordResponse] = []
        for created_id, line in created_payloads:
            defect_record = await self._maybe_execute_downgrade_after_create(
                tenant_id=tenant_id,
                defect_record=await DefectRecord.get(id=created_id),
                created_by=created_by,
                downgrade_material_id=line.downgrade_material_id,
                downgrade_warehouse_id=line.downgrade_warehouse_id,
                quarantine_location=getattr(line, "quarantine_location", None),
                quarantine_warehouse_id=getattr(line, "quarantine_warehouse_id", None),
                stock_warehouse_id=getattr(line, "stock_warehouse_id", None),
            )
            responses.append(DefectRecordResponse.model_validate(defect_record))
        return responses

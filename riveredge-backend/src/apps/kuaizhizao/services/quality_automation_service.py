"""
质检自动建单：组织配置 + 主数据策略下的统一触发入口。
失败仅记录日志，不回滚主业务事务（报工/入库/通知仓库等）。
"""

from __future__ import annotations

from typing import Any, Optional

from loguru import logger

from apps.kuaizhizao.services.inspection_policy_service import get_quality_effective_config


class QualityAutomationService:
    """按业务节点自动创建待检质检单。"""

    async def maybe_auto_create_iqc_from_purchase_receipt(
        self,
        tenant_id: int,
        purchase_receipt_id: int,
        created_by: int,
    ) -> None:
        cfg = await get_quality_effective_config(tenant_id)
        if not cfg["stage_enabled"]["iqc"]:
            return
        if not cfg["module_enabled"]["incoming"]:
            return
        if not cfg["auto_create"]["iqc_on_purchase_receipt"]:
            return
        try:
            from apps.kuaizhizao.services.quality_service import IncomingInspectionService

            created = await IncomingInspectionService().create_inspection_from_purchase_receipt(
                tenant_id=tenant_id,
                purchase_receipt_id=purchase_receipt_id,
                created_by=created_by,
            )
            if created:
                logger.info(
                    f"采购入库 {purchase_receipt_id} 自动创建来料检验 {len(created)} 张"
                )
        except Exception as e:
            logger.warning(
                f"采购入库 {purchase_receipt_id} 自动创建来料检验失败: {e}"
            )

    async def maybe_auto_create_ipqc_fqc_from_reporting(
        self,
        tenant_id: int,
        work_order: Any,
        work_order_operation: Any,
        reporting_record: Any,
        created_by: int,
    ) -> None:
        cfg = await get_quality_effective_config(tenant_id)
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation

        all_ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            deleted_at__isnull=True,
        ).order_by("sequence").all()

        is_last_op = bool(all_ops and all_ops[-1].id == work_order_operation.id)

        if is_last_op:
            if not cfg["stage_enabled"]["fqc"]:
                return
            if not cfg["module_enabled"]["finished"]:
                return
            if not cfg["auto_create"]["fqc_on_last_reporting"]:
                return
            try:
                from apps.kuaizhizao.services.quality_service import FinishedGoodsInspectionService

                await FinishedGoodsInspectionService().create_inspection_from_work_order(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    created_by=created_by,
                    reporting_record_id=reporting_record.id,
                )
                logger.info(f"末道工序报工 -> 自动创建成品检验: 工单 {work_order.code}")
            except Exception as e:
                logger.warning(
                    f"末道工序报工自动创建成品检验失败 工单 {work_order.code}: {e}"
                )
            return

        if not cfg["stage_enabled"]["ipqc"]:
            return
        if not cfg["module_enabled"]["process"]:
            return
        if not cfg["auto_create"]["ipqc_on_reporting"]:
            return
        try:
            from apps.kuaizhizao.services.quality_service import ProcessInspectionService

            await ProcessInspectionService().create_inspection_from_work_order(
                tenant_id=tenant_id,
                work_order_id=work_order.id,
                operation_id=work_order_operation.operation_id,
                created_by=created_by,
                reporting_record_id=reporting_record.id,
            )
            logger.info(
                f"报工 -> 自动创建过程检验: 工单 {work_order.code}, 工序 {work_order_operation.operation_name}"
            )
        except Exception as e:
            logger.warning(
                f"报工自动创建过程检验失败 工单 {work_order.code}: {e}"
            )

    async def maybe_auto_create_oqc_from_shipment_notice(
        self,
        tenant_id: int,
        notice_id: int,
        user_id: int,
    ) -> None:
        cfg = await get_quality_effective_config(tenant_id)
        if not cfg["stage_enabled"]["oqc"]:
            return
        if not cfg["auto_create"]["oqc_on_shipment_notice_notify"]:
            return
        try:
            from apps.kuaizhizao.services.quality_improvement_service import OQCInspectionService

            created = await OQCInspectionService().create_from_shipment_notice(
                tenant_id=tenant_id,
                notice_id=notice_id,
                user_id=user_id,
            )
            if created:
                logger.info(f"发货通知 {notice_id} 通知仓库前自动创建 OQC {len(created)} 张")
        except Exception as e:
            logger.warning(f"发货通知 {notice_id} 自动创建 OQC 失败: {e}")

    async def maybe_auto_create_oqc_from_sales_delivery(
        self,
        tenant_id: int,
        delivery_id: int,
        user_id: int,
    ) -> None:
        cfg = await get_quality_effective_config(tenant_id)
        if not cfg["stage_enabled"]["oqc"]:
            return
        if not cfg["auto_create"]["oqc_on_sales_delivery"]:
            return
        try:
            from apps.kuaizhizao.services.quality_improvement_service import OQCInspectionService

            created = await OQCInspectionService().create_from_sales_delivery(
                tenant_id=tenant_id,
                delivery_id=delivery_id,
                user_id=user_id,
            )
            if created:
                logger.info(f"销售出库 {delivery_id} 自动创建 OQC {len(created)} 张")
        except Exception as e:
            logger.warning(f"销售出库 {delivery_id} 自动创建 OQC 失败: {e}")

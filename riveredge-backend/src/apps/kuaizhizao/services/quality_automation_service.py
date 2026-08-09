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
        """
        报工生效后自动建过程检验待检单（IPQC，mode=plan，含末道）。

        成品检验（FQC）不再在报工时自动创建，也不再在工序展开时扫描补建；
        统一为：入库前 ensure + 工单「下推成品检验单」手工补。
        """
        cfg = await get_quality_effective_config(tenant_id)
        from apps.kuaizhizao.services.inspection_policy_service import resolve_inspection_policy

        master_op_id = int(work_order_operation.operation_id or 0)

        # 过程检验：任意工序（含末道）在 plan 模式下自动建单
        if (
            cfg["stage_enabled"]["ipqc"]
            and cfg["module_enabled"]["process"]
            and cfg["auto_create"]["ipqc_on_reporting"]
            and master_op_id > 0
        ):
            eff, _, _ = await resolve_inspection_policy(
                tenant_id, "ipqc", operation_id=master_op_id
            )
            if eff == "plan":
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
                        f"报工 -> 自动创建过程检验: 工单 {work_order.code}, "
                        f"工序 {work_order_operation.operation_name}"
                    )
                except Exception as e:
                    msg = str(e)
                    if "已存在待检验" in msg:
                        logger.info(
                            f"报工自动创建过程检验跳过（已有待检单）工单 {work_order.code}"
                        )
                    else:
                        logger.warning(
                            f"报工自动创建过程检验失败 工单 {work_order.code}: {e}"
                        )

    async def maybe_backfill_missing_ipqc_for_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
    ) -> None:
        """
        历史：展开工序卡时扫描补建过程检验。

        已停用（拖慢工序卡加载）。漏建请走过程检验「从工单创建」手工补；
        报工生效路径仍会自动建 IPQC。保留方法签名以免外部误调用报错。
        """
        _ = (tenant_id, work_order_id)
        return

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
                logger.info(f"发货通知 {notice_id} 通知仓库后自动创建 OQC {len(created)} 张")
        except Exception as e:
            msg = str(e)
            if "均已存在检验单" in msg or "没有需要 OQC" in msg:
                return
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
        # 通知仓库路径：create_sales_delivery 会先触发本钩子，随后 notice 回写关联并
        # maybe_auto_create_oqc_from_shipment_notice。双开关同时开时由发货通知路径唯一建单。
        if cfg["auto_create"]["oqc_on_shipment_notice_notify"]:
            from apps.kuaizhizao.models.sales_delivery import SalesDelivery
            from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
            from apps.kuaizhizao.services.inspection_policy_service import (
                _shipment_notice_ids_for_sales_delivery,
            )

            linked_notice_ids = await _shipment_notice_ids_for_sales_delivery(
                tenant_id, int(delivery_id)
            )
            if linked_notice_ids:
                logger.info(
                    f"销售出库 {delivery_id} 已关联发货通知 {linked_notice_ids}，"
                    "跳过出库侧自动建 OQC（由通知仓库路径建单）"
                )
                return
            delivery = await SalesDelivery.get_or_none(
                tenant_id=tenant_id, id=int(delivery_id), deleted_at__isnull=True
            )
            so_id = getattr(delivery, "sales_order_id", None) if delivery else None
            if so_id:
                pending_notice = await ShipmentNotice.filter(
                    tenant_id=tenant_id,
                    sales_order_id=int(so_id),
                    deleted_at__isnull=True,
                    status__in=["待发货", "已通知"],
                ).exists()
                if pending_notice:
                    logger.info(
                        f"销售出库 {delivery_id} 同销售订单存在发货通知且已开启通知仓库自动建 OQC，"
                        "跳过出库侧自动建单"
                    )
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
            msg = str(e)
            if "均已存在检验单" in msg or "没有需要 OQC" in msg:
                return
            logger.warning(f"销售出库 {delivery_id} 自动创建 OQC 失败: {e}")

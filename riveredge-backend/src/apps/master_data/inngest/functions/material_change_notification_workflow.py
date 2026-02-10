"""
物料变更通知工作流

监听 material/updated 事件，查询使用该物料的下游单据（BOM、需求计算、需求明细、工单、采购订单明细），
生成变更摘要与建议操作，并发送站内信通知更新人。
"""

from inngest import Event, TriggerEvent
from typing import Dict, Any, List
from loguru import logger

from core.inngest.client import inngest_client
from core.utils.inngest_tenant_isolation import with_tenant_isolation
from core.services.messaging.message_service import MessageService
from core.schemas.message_template import SendMessageRequest
from infra.domain.tenant_context import get_current_tenant_id


@inngest_client.create_function(
    fn_id="material-change-notification-workflow",
    name="物料变更通知工作流",
    trigger=TriggerEvent(event="material/updated"),
    retries=2,
)
@with_tenant_isolation
async def material_change_notification_workflow(event: Event, **kwargs) -> Dict[str, Any]:
    """
    物料变更后，汇总受影响的下游单据并通知更新人。

    租户隔离已由装饰器处理，可直接使用 get_current_tenant_id()。
    **kwargs 用于兼容 Inngest 运行时可能传入的 step/ctx 等参数。
    """
    tenant_id = get_current_tenant_id()
    data = event.data or {}
    material_id = data.get("material_id")
    material_uuid = data.get("material_uuid")
    material_name = data.get("material_name", "")
    main_code = data.get("main_code", "")
    updated_by = data.get("updated_by")

    if not material_id:
        logger.warning("物料变更通知工作流：缺少 material_id")
        return {"success": False, "error": "缺少必要参数：material_id"}

    try:
        summary_parts: List[str] = []
        actions: List[str] = []

        # BOM：作为父件或子件
        from apps.master_data.models.material import BOM

        bom_as_parent = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
        ).count()
        bom_as_component = await BOM.filter(
            tenant_id=tenant_id,
            component_id=material_id,
            deleted_at__isnull=True,
        ).count()
        bom_total = bom_as_parent + bom_as_component
        if bom_total > 0:
            summary_parts.append(f"BOM 共 {bom_total} 处（作为父件 {bom_as_parent}，作为子件 {bom_as_component}）")
            actions.append("BOM 需复核：物料信息变更后请检查相关 BOM 版本与用量。")

        # 需求计算明细
        from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem

        dci_count = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            material_id=material_id,
        ).count()
        if dci_count > 0:
            summary_parts.append(f"需求计算明细 {dci_count} 条")
            actions.append("需求计算需重新执行：物料来源或属性变更后，建议重新执行需求计算以更新工单/采购建议。")

        # 需求明细（销售订单/预测明细）
        from apps.kuaizhizao.models.demand_item import DemandItem

        di_count = await DemandItem.filter(
            tenant_id=tenant_id,
            material_id=material_id,
        ).count()
        if di_count > 0:
            summary_parts.append(f"需求明细 {di_count} 条")
            actions.append("需求明细已引用该物料，请核对规格与单位是否仍符合预期。")

        # 工单（产品即物料）
        from apps.kuaizhizao.models.work_order import WorkOrder

        wo_count = await WorkOrder.filter(
            tenant_id=tenant_id,
            product_id=material_id,
        ).count()
        if wo_count > 0:
            summary_parts.append(f"工单 {wo_count} 个")
            actions.append("工单需核对：物料信息变更后请检查相关工单的产品编码、名称与规格。")

        # 采购订单明细
        from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem

        poi_count = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            material_id=material_id,
        ).count()
        if poi_count > 0:
            summary_parts.append(f"采购订单明细 {poi_count} 条")
            actions.append("采购订单明细需核对：物料信息变更后请检查未完结采购单的物料编码、名称与规格。")

        # 有下游引用时：完整摘要 + 建议操作；无下游引用时：简短“已更新”提示
        if summary_parts:
            summary = f"物料「{material_name}」（{main_code}）已修改，影响：{'; '.join(summary_parts)}。"
            action_text = "\n".join(f"· {a}" for a in actions)
            content = f"{summary}\n\n建议操作：\n{action_text}"
            subject = "物料变更影响提示"
        else:
            content = f"物料「{material_name}」（{main_code}）已更新。当前无关联下游单据。"
            subject = "物料已更新"
            logger.info(f"物料 {material_id} 变更，无下游引用，发送简短通知")

        # 有更新人则发站内信；无更新人仅记录日志
        recipient_id = str(updated_by) if updated_by is not None else None
        if not recipient_id:
            logger.info(
                f"物料变更通知已汇总，未指定更新人，不创建站内信。material_id={material_id}"
            )
            return {
                "success": True,
                "material_id": material_id,
                "affected_summary": summary_parts,
                "actions": actions,
                "notification_sent": False,
            }

        # 使用统一的消息服务发送通知，调用模板 MATERIAL_CHANGE_NOTIFY
        result = await MessageService.send_message(
            tenant_id=tenant_id,
            request=SendMessageRequest(
                type="internal",
                recipient=recipient_id,
                template_code="MATERIAL_CHANGE_NOTIFY",
                variables={
                    "material_name": material_name,
                    "main_code": main_code,
                    "affected_summary": "; ".join(summary_parts) if summary_parts else "无关联下游单据",
                    "action_text": action_text if actions else "无建议操作",
                    "is_affected": "1" if summary_parts else "0",
                },
                content="" # 由于使用了模板，内容字段可选（此处传空字符串满足 Schema 基础验证，或者 Schema 已设为 Optional）
            )
        )

        logger.info(
            f"物料变更通知已通过模板发送: material_id={material_id}, recipient={recipient_id}, "
            f"message_log_uuid={result.message_log_uuid}"
        )
        return {
            "success": True,
            "material_id": material_id,
            "material_uuid": material_uuid,
            "affected_summary": summary_parts,
            "actions": actions,
            "message_log_uuid": str(result.message_log_uuid),
            "notification_sent": True,
        }
    except Exception as e:
        logger.exception(f"物料变更通知工作流执行失败: material_id={material_id}, error={e}")
        return {
            "success": False,
            "error": str(e),
            "material_id": material_id,
        }

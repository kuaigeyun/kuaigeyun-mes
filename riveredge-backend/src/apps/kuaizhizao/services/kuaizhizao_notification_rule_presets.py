"""快制造 — 业务配置「消息提醒」规则预设（配置中心「加载预设」）。

一期仅覆盖已接线的重要节点；默认 enabled=false，需管理员配置接收人并启用后才发送。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID

from loguru import logger

from apps.kuaizhizao.services.kuaizhizao_business_notification import (
    ACTION_APPROVED,
    ACTION_SUBMITTED,
    ACTION_ARRIVAL_OVERDUE,
    ACTION_ASSIGNED,
    ACTION_COMPLETED,
    ACTION_OPERATION_COMPLETED,
    ACTION_CONFIRMED,
    ACTION_CREATED,
    ACTION_DELIVERY_DELAYED,
    ACTION_ISSUED,
    ACTION_PASSED,
    ACTION_PUSHED_TO_WORK_ORDER,
    ACTION_REJECTED,
    ACTION_REMIND_BATCHING,
    ACTION_REPORTED,
    ACTION_RESOLVED,
    ACTION_REWORKED,
    ACTION_RELEASED,
    ACTION_TRIGGERED,
    DOC_EQUIPMENT_FAULT,
    DOC_INVENTORY_ALERT,
    DOC_PURCHASE_ORDER,
    DOC_PURCHASE_ORDER_CHANGE,
    DOC_QUALITY_EXCEPTION,
    DOC_SALES_ORDER,
    DOC_SALES_REVIEW,
    DOC_SHIPMENT_NOTICE,
    DOC_WORK_ORDER,
)
from core.models.message_template import MessageTemplate
from core.services.messaging.message_template_service import MessageTemplateService
from infra.services.business_config_service import BusinessConfigService

BUILTIN_IN_APP_CHANNEL_UUID = "__builtin_internal_channel__"

# 与 MessageTemplateService.PRESET_MESSAGE_TEMPLATES 中 KZ_* / 业务码一致
KUAIZHIZAO_NOTIFICATION_RULE_PRESETS: List[Dict[str, Any]] = [
    {
        "id": "kz_preset_sales_delivery_delayed",
        "scene_name": "销售订单交期延误",
        "trigger_document": DOC_SALES_ORDER,
        "trigger_action": ACTION_DELIVERY_DELAYED,
        "template_code": "KZ_SALES_DELIVERY_DELAYED",
        "recipient_scopes": ["salesman", "creator"],
        "enabled": False,
    },
    {
        "id": "kz_preset_sales_review_issued",
        "scene_name": "订单评审已下达",
        "trigger_document": DOC_SALES_REVIEW,
        "trigger_action": ACTION_ISSUED,
        "template_code": "KZ_SALES_REVIEW_ISSUED",
        "recipient_scopes": ["user_specified"],
        "enabled": False,
    },
    {
        "id": "kz_preset_sales_review_rejected",
        "scene_name": "订单评审已驳回",
        "trigger_document": DOC_SALES_REVIEW,
        "trigger_action": ACTION_REJECTED,
        "template_code": "KZ_SALES_REVIEW_REJECTED",
        "recipient_scopes": ["salesman", "creator"],
        "enabled": False,
    },
    {
        "id": "kz_preset_sales_review_passed",
        "scene_name": "订单评审已通过",
        "trigger_document": DOC_SALES_REVIEW,
        "trigger_action": ACTION_PASSED,
        "template_code": "KZ_SALES_REVIEW_PASSED",
        "recipient_scopes": ["salesman", "creator"],
        "enabled": False,
    },
    {
        "id": "kz_preset_po_delivery_delayed",
        "scene_name": "采购订单交期延误",
        "trigger_document": DOC_PURCHASE_ORDER,
        "trigger_action": ACTION_DELIVERY_DELAYED,
        "template_code": "KZ_PO_DELIVERY_DELAYED",
        "recipient_scopes": ["creator"],
        "enabled": False,
    },
    {
        "id": "kz_preset_quality_exception_created",
        "scene_name": "质量异常新建",
        "trigger_document": DOC_QUALITY_EXCEPTION,
        "trigger_action": ACTION_CREATED,
        "template_code": "KZ_QUALITY_EXCEPTION_CREATED",
        "recipient_scopes": ["creator", "user_specified"],
        "enabled": False,
    },
    {
        "id": "kz_preset_equipment_fault_reported",
        "scene_name": "设备故障报修",
        "trigger_document": DOC_EQUIPMENT_FAULT,
        "trigger_action": ACTION_REPORTED,
        "template_code": "KZ_EQUIPMENT_FAULT_REPORTED",
        # 固定接收人由管理员在规则中配置（recipient_user_ids）
        "recipient_scopes": [],
        "enabled": False,
    },
    {
        "id": "kz_preset_wo_remind_batching",
        "scene_name": "工单提醒仓库线边备料",
        "trigger_document": DOC_WORK_ORDER,
        "trigger_action": ACTION_REMIND_BATCHING,
        "template_code": "KZ_WO_REMIND_BATCHING",
        "recipient_scopes": [],
        "enabled": False,
    },
    {
        "id": "kz_preset_so_approved",
        "scene_name": "销售订单已审核",
        "trigger_document": DOC_SALES_ORDER,
        "trigger_action": ACTION_APPROVED,
        "template_code": "KZ_SO_APPROVED",
        "recipient_scopes": ["salesman", "creator"],
        "enabled": False,
    },
    {
        "id": "kz_preset_so_pushed_wo",
        "scene_name": "销售订单下推工单",
        "trigger_document": DOC_SALES_ORDER,
        "trigger_action": ACTION_PUSHED_TO_WORK_ORDER,
        "template_code": "KZ_SO_PUSHED_WO",
        "recipient_scopes": ["creator"],
        "enabled": False,
    },
    {
        "id": "kz_preset_po_approved",
        "scene_name": "采购订单已审核",
        "trigger_document": DOC_PURCHASE_ORDER,
        "trigger_action": ACTION_APPROVED,
        "template_code": "KZ_PO_APPROVED",
        "recipient_scopes": ["creator"],
        "enabled": False,
    },
    {
        "id": "kz_preset_poc_submitted",
        "scene_name": "采购变更单待审核",
        "trigger_document": DOC_PURCHASE_ORDER_CHANGE,
        "trigger_action": ACTION_SUBMITTED,
        "template_code": "KZ_POC_SUBMITTED",
        # 开单用户指定 + 提交时把当前审批人写入 submitted_notify_user_ids
        "recipient_scopes": ["user_specified"],
        "enabled": True,
    },
    {
        "id": "kz_preset_poc_approved",
        "scene_name": "采购变更单已审核",
        "trigger_document": DOC_PURCHASE_ORDER_CHANGE,
        "trigger_action": ACTION_APPROVED,
        "template_code": "KZ_POC_APPROVED",
        "recipient_scopes": ["creator"],
        "enabled": False,
    },
    {
        "id": "kz_preset_wo_released",
        "scene_name": "工单已下达",
        "trigger_document": DOC_WORK_ORDER,
        "trigger_action": ACTION_RELEASED,
        "template_code": "KZ_WO_RELEASED",
        "recipient_scopes": ["creator"],
        "enabled": False,
    },
    {
        "id": "kz_preset_wo_completed",
        "scene_name": "工单已完工",
        "trigger_document": DOC_WORK_ORDER,
        "trigger_action": ACTION_COMPLETED,
        "template_code": "KZ_WO_COMPLETED",
        "recipient_scopes": ["creator"],
        "enabled": False,
    },
    {
        "id": "kz_preset_wo_operation_completed",
        "scene_name": "工序完成后通知下一工序",
        "trigger_document": DOC_WORK_ORDER,
        "trigger_action": ACTION_OPERATION_COMPLETED,
        "template_code": "KZ_WO_NEXT_OPERATION",
        "recipient_scopes": ["next_operation_assignees"],
        "enabled": True,
    },
    {
        "id": "kz_preset_wo_reworked",
        "scene_name": "工单转返工",
        "trigger_document": DOC_WORK_ORDER,
        "trigger_action": ACTION_REWORKED,
        "template_code": "KZ_WO_REWORKED",
        "recipient_scopes": ["creator"],
        "enabled": False,
    },
    {
        "id": "kz_preset_qe_assigned",
        "scene_name": "质量异常已分派",
        "trigger_document": DOC_QUALITY_EXCEPTION,
        "trigger_action": ACTION_ASSIGNED,
        "template_code": "KZ_QE_ASSIGNED",
        "recipient_scopes": ["creator", "user_specified"],
        "enabled": False,
    },
    {
        "id": "kz_preset_eq_assigned",
        "scene_name": "设备故障已派工",
        "trigger_document": DOC_EQUIPMENT_FAULT,
        "trigger_action": ACTION_ASSIGNED,
        "template_code": "KZ_EQ_ASSIGNED",
        "recipient_scopes": ["user_specified"],
        "enabled": False,
    },
    {
        "id": "kz_preset_eq_resolved",
        "scene_name": "设备故障已恢复",
        "trigger_document": DOC_EQUIPMENT_FAULT,
        "trigger_action": ACTION_RESOLVED,
        "template_code": "KZ_EQ_RESOLVED",
        "recipient_scopes": ["creator"],
        "enabled": False,
    },
    {
        "id": "kz_preset_inv_alert_triggered",
        "scene_name": "库存预警触发",
        "trigger_document": DOC_INVENTORY_ALERT,
        "trigger_action": ACTION_TRIGGERED,
        "template_code": "KZ_INV_ALERT",
        "recipient_scopes": [],
        "enabled": False,
    },
    {
        "id": "kz_preset_po_arrival_overdue",
        "scene_name": "采购到货逾期",
        "trigger_document": DOC_PURCHASE_ORDER,
        "trigger_action": ACTION_ARRIVAL_OVERDUE,
        "template_code": "KZ_PO_ARRIVAL_OVERDUE",
        "recipient_scopes": ["creator"],
        "enabled": False,
    },
    {
        "id": "kz_preset_ship_confirmed",
        "scene_name": "发货通知已确认",
        "trigger_document": DOC_SHIPMENT_NOTICE,
        "trigger_action": ACTION_CONFIRMED,
        "template_code": "KZ_SHIP_CONFIRMED",
        "recipient_scopes": ["salesman", "creator"],
        "enabled": False,
    },
]

_KZ_TEMPLATE_CODES: Set[str] = {
    str(p.get("template_code") or "").strip()
    for p in KUAIZHIZAO_NOTIFICATION_RULE_PRESETS
    if str(p.get("template_code") or "").strip()
}


def _normalize_rules(raw: Any) -> List[dict]:
    if isinstance(raw, dict) and isinstance(raw.get("rules"), list):
        return [r for r in raw["rules"] if isinstance(r, dict)]
    if isinstance(raw, dict) and raw.get("trigger_document"):
        return [raw]
    return []


def _rule_identity(rule: dict) -> Tuple[str, str]:
    return (
        str(rule.get("trigger_document") or "").strip(),
        str(rule.get("trigger_action") or "").strip(),
    )


def _preset_by_document_action() -> Dict[Tuple[str, str], Dict[str, Any]]:
    out: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for preset in KUAIZHIZAO_NOTIFICATION_RULE_PRESETS:
        key = _rule_identity(preset)
        if key[0] and key[1]:
            out[key] = preset
    return out


def _merge_recipient_scopes_from_preset(
    existing_scopes: Any, preset_scopes: List[str]
) -> Tuple[List[str], bool]:
    current = [str(s).strip() for s in (existing_scopes or []) if str(s).strip()]
    want = [str(s).strip() for s in preset_scopes if str(s).strip()]
    merged = list(current)
    changed = False
    for scope in want:
        if scope not in merged:
            merged.append(scope)
            changed = True
    return merged, changed


async def _template_uuid_by_code(tenant_id: int, code: str) -> Optional[str]:
    row = await MessageTemplate.filter(
        tenant_id=tenant_id,
        code=code,
        deleted_at__isnull=True,
    ).first()
    if not row:
        return None
    return str(row.uuid)


async def _rule_template_ref_invalid(tenant_id: int, rule: dict) -> bool:
    ref = str(rule.get("template_uuid") or rule.get("template") or "").strip()
    if not ref:
        return True
    try:
        template_uuid = UUID(ref)
    except ValueError:
        return True
    return not await MessageTemplate.filter(
        tenant_id=tenant_id,
        uuid=str(template_uuid),
        deleted_at__isnull=True,
    ).exists()


async def load_kuaizhizao_notification_rule_presets(tenant_id: int) -> Dict[str, int]:
    """
    补齐快制造消息提醒规则到 parameters.notifications.rules。
    - 先确保对应消息模板存在（load_preset_sme）
    - 已存在同单据+动作：合并缺失收件范围、补绑模板；不改 enabled
    - 新建规则：enabled 取自预设（多数为 false 防打扰；少数业务关键节点可为 true）
    """
    templates_created = await MessageTemplateService.load_preset_sme(
        tenant_id,
        only_codes=_KZ_TEMPLATE_CODES,
    )

    cfg = await BusinessConfigService().get_business_config(tenant_id)
    existing = _normalize_rules((cfg.get("parameters") or {}).get("notifications"))
    existing_keys: Set[Tuple[str, str]] = {_rule_identity(r) for r in existing}
    existing_ids = {str(r.get("id") or "") for r in existing if r.get("id")}
    preset_index = _preset_by_document_action()

    updated = 0
    repaired_templates = 0
    for rule in existing:
        # 永久禁止场景名使用间隔号「·」
        current_scene = str(rule.get("scene_name") or "").strip()
        if "·" in current_scene or "・" in current_scene or "•" in current_scene:
            cleaned = (
                current_scene.replace("·", "").replace("・", "").replace("•", "")
            )
            if cleaned != current_scene:
                rule["scene_name"] = cleaned
                updated += 1
                current_scene = cleaned

        preset = preset_index.get(_rule_identity(rule))
        if not preset:
            continue
        merged_scopes, changed = _merge_recipient_scopes_from_preset(
            rule.get("recipient_scopes"),
            list(preset.get("recipient_scopes") or []),
        )
        if changed:
            rule["recipient_scopes"] = merged_scopes
            updated += 1
        # 采购变更单待审核：历史预设无接收范围且默认关闭，加载预设时对齐并开启
        if (
            _rule_identity(rule) == (DOC_PURCHASE_ORDER_CHANGE, ACTION_SUBMITTED)
            and bool(preset.get("enabled"))
            and rule.get("enabled") is False
        ):
            rule["enabled"] = True
            updated += 1
        preset_scene = str(preset.get("scene_name") or "").strip()
        if preset_scene and current_scene != preset_scene:
            rule["scene_name"] = preset_scene
            updated += 1
        template_code = str(preset.get("template_code") or "").strip()
        if template_code:
            rule["template_code"] = template_code
        if template_code and await _rule_template_ref_invalid(tenant_id, rule):
            template_uuid = await _template_uuid_by_code(tenant_id, template_code)
            if template_uuid:
                rule["template_uuid"] = template_uuid
                rule["template"] = template_uuid
                repaired_templates += 1

    created = 0
    skipped_missing_template = 0
    skipped_duplicate = 0

    for preset in KUAIZHIZAO_NOTIFICATION_RULE_PRESETS:
        doc, action = _rule_identity(preset)
        if (doc, action) in existing_keys:
            skipped_duplicate += 1
            continue
        preset_id = str(preset.get("id") or "").strip()
        if preset_id and preset_id in existing_ids:
            skipped_duplicate += 1
            continue

        template_code = str(preset.get("template_code") or "").strip()
        template_uuid = await _template_uuid_by_code(tenant_id, template_code)
        if not template_uuid:
            logger.warning(
                "快制造消息提醒预设跳过：未找到消息模板 tenant={} code={}",
                tenant_id,
                template_code,
            )
            skipped_missing_template += 1
            continue

        existing.append(
            {
                "id": preset_id or f"kz_preset_{doc}_{action}",
                "scene_name": preset.get("scene_name") or f"{doc} {action}",
                "enabled": bool(preset.get("enabled", False)),
                "trigger_document": doc,
                "trigger_action": action,
                "channel_uuids": [BUILTIN_IN_APP_CHANNEL_UUID],
                "channels": [BUILTIN_IN_APP_CHANNEL_UUID],
                "recipient_scopes": list(preset.get("recipient_scopes") or []),
                "recipient_user_ids": [],
                "form_notify_default_user_ids": [],
                "template_uuid": template_uuid,
                "template": template_uuid,
                "template_code": template_code,
            }
        )
        existing_keys.add((doc, action))
        if preset_id:
            existing_ids.add(preset_id)
        created += 1

    if created > 0 or updated > 0 or repaired_templates > 0:
        await BusinessConfigService().batch_update_process_parameters(
            tenant_id,
            {"notifications": {"rules": existing}},
        )

    return {
        "created": created,
        "updated": updated,
        "repaired_templates": repaired_templates,
        "templates_created": templates_created,
        "skipped_duplicate": skipped_duplicate,
        "skipped_missing_template": skipped_missing_template,
        "total_rules": len(existing),
    }

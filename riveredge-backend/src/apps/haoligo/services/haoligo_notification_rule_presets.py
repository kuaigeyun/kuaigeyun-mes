"""好力 GO — 业务配置「消息提醒」规则预设（配置中心可见）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID

from loguru import logger

from apps.haoligo.constants.message_template_codes import (
    HAOLIGO_EQUIPMENT_ROUTE_PATROL_REPORT,
    HAOLIGO_EQUIPMENT_SPOT_CHECK_REPORT,
    HAOLIGO_EQUIPMENT_UPKEEP_COMPLETE_CREATED,
    HAOLIGO_EQUIPMENT_UPKEEP_SHEET_CREATED,
    HAOLIGO_EQUIPMENT_OUTPUT_RECORD_CREATED,
    HAOLIGO_MOLD_MAINTENANCE_APPROVED,
    HAOLIGO_MOLD_MAINTENANCE_COMPLETE_CREATED,
    HAOLIGO_MOLD_MAINTENANCE_PENDING,
    HAOLIGO_MOLD_MAINTENANCE_REJECTED,
    HAOLIGO_MOLD_MAINTENANCE_REVOKED,
    HAOLIGO_MOLD_OUTSOURCE_COMPLETE_APPROVED,
    HAOLIGO_MOLD_OUTSOURCE_COMPLETE_PENDING,
    HAOLIGO_MOLD_OUTSOURCE_COMPLETE_REJECTED,
    HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_APPROVED,
    HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_PENDING,
    HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_REJECTED,
    HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_REVOKED,
    HAOLIGO_MOLD_OUTSOURCE_COMPLETE_REVOKED,
    HAOLIGO_MOLD_TRIAL_ADJUSTMENT_COMPLETE,
    HAOLIGO_MOLD_TRIAL_APPROVED,
    HAOLIGO_MOLD_TRIAL_FAILURE_PENDING,
    HAOLIGO_MOLD_TRIAL_FAILURE_REPAIR,
    HAOLIGO_MOLD_TRIAL_REJECTED,
    HAOLIGO_MOLD_TRIAL_SUBMITTED,
    HAOLIGO_MOLD_TRIAL_PRODUCTION_PENDING,
    HAOLIGO_MOLD_TRIAL_RECALLED,
    HAOLIGO_PATROL_ISSUE_REGISTER_REPORT,
    HAOLIGO_PATROL_ISSUE_REMEDIATED,
)
from apps.haoligo.services.haoligo_business_notification import (
    ACTION_APPROVED,
    ACTION_CREATED,
    ACTION_REJECTED,
    ACTION_REMEDIATED,
    ACTION_REPORTED,
    ACTION_SUBMITTED,
    ACTION_TRIAL_FAILURE_PENDING,
    ACTION_TRIAL_ADJUSTMENT_COMPLETE,
    ACTION_TRIAL_FAILURE_REPAIR,
    ACTION_REVOKED,
    ACTION_TRIAL_PRODUCTION_PENDING,
    ACTION_TRIAL_RECALLED,
    DOC_EQUIPMENT_ROUTE_PATROL,
    DOC_EQUIPMENT_SPOT_CHECK,
    DOC_EQUIPMENT_UPKEEP_COMPLETE,
    DOC_EQUIPMENT_UPKEEP_SHEET,
    DOC_EQUIPMENT_OUTPUT_RECORD,
    DOC_MOLD_MAINTENANCE,
    DOC_MOLD_MAINTENANCE_COMPLETE,
    DOC_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE,
    DOC_MOLD_TRIAL,
    DOC_OUTSOURCE_MAINTENANCE,
    DOC_PATROL_ISSUE_REGISTER,
)
from apps.haoligo.services.haoligo_message_template_registry import (
    load_haoligo_message_template_presets,
)
from core.models.message_template import MessageTemplate
from infra.services.business_config_service import BusinessConfigService

BUILTIN_IN_APP_CHANNEL_UUID = "__builtin_internal_channel__"

HAOLIGO_NOTIFICATION_RULE_PRESETS: List[Dict[str, Any]] = [
    {
        "id": "haoligo_preset_outsource_submitted",
        "scene_name": "外协维保单·提交待审",
        "trigger_document": DOC_OUTSOURCE_MAINTENANCE,
        "trigger_action": ACTION_SUBMITTED,
        "template_code": HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_PENDING,
        "recipient_scopes": ["module_reviewers", "supplier_bound", "user_specified"],
    },
    {
        "id": "haoligo_preset_outsource_approved",
        "scene_name": "外协维保单·审核通过",
        "trigger_document": DOC_OUTSOURCE_MAINTENANCE,
        "trigger_action": ACTION_APPROVED,
        "template_code": HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_APPROVED,
        "recipient_scopes": ["creator", "supplier_bound", "user_specified"],
    },
    {
        "id": "haoligo_preset_outsource_revoked",
        "scene_name": "外协维保单·撤销审核",
        "trigger_document": DOC_OUTSOURCE_MAINTENANCE,
        "trigger_action": ACTION_REVOKED,
        "template_code": HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_REVOKED,
        "recipient_scopes": ["creator", "module_reviewers", "user_specified"],
    },
    {
        "id": "haoligo_preset_outsource_rejected",
        "scene_name": "外协维保单·审核驳回",
        "trigger_document": DOC_OUTSOURCE_MAINTENANCE,
        "trigger_action": ACTION_REJECTED,
        "template_code": HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_REJECTED,
        "recipient_scopes": ["creator"],
    },
    {
        "id": "haoligo_preset_trial_submitted",
        "scene_name": "试模单·提交待审",
        "trigger_document": DOC_MOLD_TRIAL,
        "trigger_action": ACTION_SUBMITTED,
        "template_code": HAOLIGO_MOLD_TRIAL_SUBMITTED,
        "recipient_scopes": ["module_reviewers", "user_specified"],
    },
    {
        "id": "haoligo_preset_trial_failure_pending",
        "scene_name": "试模不合格·待处理",
        "trigger_document": DOC_MOLD_TRIAL,
        "trigger_action": ACTION_TRIAL_FAILURE_PENDING,
        "template_code": HAOLIGO_MOLD_TRIAL_FAILURE_PENDING,
        "recipient_scopes": ["creator", "trial_operator", "user_specified"],
    },
    {
        "id": "haoligo_preset_trial_failure_repair",
        "scene_name": "试模不合格·立即送修",
        "trigger_document": DOC_MOLD_TRIAL,
        "trigger_action": ACTION_TRIAL_FAILURE_REPAIR,
        "template_code": HAOLIGO_MOLD_TRIAL_FAILURE_REPAIR,
        "recipient_scopes": ["trial_operator", "supplier_bound", "user_specified"],
    },
    {
        "id": "haoligo_preset_trial_adjustment_complete",
        "scene_name": "试模单·调整完成",
        "trigger_document": DOC_MOLD_TRIAL,
        "trigger_action": ACTION_TRIAL_ADJUSTMENT_COMPLETE,
        "template_code": HAOLIGO_MOLD_TRIAL_ADJUSTMENT_COMPLETE,
        "recipient_scopes": ["creator", "user_specified", "recall_operators"],
    },
    {
        "id": "haoligo_preset_spot_check_reported",
        "scene_name": "设备点检·上报",
        "trigger_document": DOC_EQUIPMENT_SPOT_CHECK,
        "trigger_action": ACTION_REPORTED,
        "template_code": HAOLIGO_EQUIPMENT_SPOT_CHECK_REPORT,
        "recipient_scopes": ["reporter", "user_specified"],
    },
    {
        "id": "haoligo_preset_route_patrol_reported",
        "scene_name": "路线巡检·上报",
        "trigger_document": DOC_EQUIPMENT_ROUTE_PATROL,
        "trigger_action": ACTION_REPORTED,
        "template_code": HAOLIGO_EQUIPMENT_ROUTE_PATROL_REPORT,
        "recipient_scopes": ["reporter", "user_specified"],
    },
    {
        "id": "haoligo_preset_patrol_issue_reported",
        "scene_name": "问题登记·上报",
        "trigger_document": DOC_PATROL_ISSUE_REGISTER,
        "trigger_action": ACTION_REPORTED,
        "template_code": HAOLIGO_PATROL_ISSUE_REGISTER_REPORT,
        "recipient_scopes": ["reporter", "user_specified"],
    },
    {
        "id": "haoligo_preset_mold_maintenance_submitted",
        "scene_name": "厂内维保单·提交待审",
        "trigger_document": DOC_MOLD_MAINTENANCE,
        "trigger_action": ACTION_SUBMITTED,
        "template_code": HAOLIGO_MOLD_MAINTENANCE_PENDING,
        "recipient_scopes": ["creator", "module_reviewers", "user_specified"],
    },
    {
        "id": "haoligo_preset_mold_maintenance_approved",
        "scene_name": "厂内维保单·审核通过",
        "trigger_document": DOC_MOLD_MAINTENANCE,
        "trigger_action": ACTION_APPROVED,
        "template_code": HAOLIGO_MOLD_MAINTENANCE_APPROVED,
        "recipient_scopes": ["creator", "module_complete_operators", "user_specified"],
    },
    {
        "id": "haoligo_preset_mold_maintenance_rejected",
        "scene_name": "厂内维保单·审核驳回",
        "trigger_document": DOC_MOLD_MAINTENANCE,
        "trigger_action": ACTION_REJECTED,
        "template_code": HAOLIGO_MOLD_MAINTENANCE_REJECTED,
        "recipient_scopes": ["creator"],
    },
    {
        "id": "haoligo_preset_mold_maintenance_complete_created",
        "scene_name": "厂内完修单·创建",
        "trigger_document": DOC_MOLD_MAINTENANCE_COMPLETE,
        "trigger_action": ACTION_CREATED,
        "template_code": HAOLIGO_MOLD_MAINTENANCE_COMPLETE_CREATED,
        "recipient_scopes": ["source_applicant", "source_auditor", "user_specified"],
    },
    {
        "id": "haoligo_preset_outsource_complete_submitted",
        "scene_name": "外协维修完成",
        "trigger_document": DOC_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE,
        "trigger_action": ACTION_SUBMITTED,
        "template_code": HAOLIGO_MOLD_OUTSOURCE_COMPLETE_PENDING,
        "recipient_scopes": ["source_applicant", "source_auditor", "module_reviewers", "user_specified"],
    },
    {
        "id": "haoligo_preset_outsource_complete_approved",
        "scene_name": "外协完修单·审核通过",
        "trigger_document": DOC_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE,
        "trigger_action": ACTION_APPROVED,
        "template_code": HAOLIGO_MOLD_OUTSOURCE_COMPLETE_APPROVED,
        "recipient_scopes": ["creator", "supplier_bound", "source_applicant", "user_specified"],
    },
    {
        "id": "haoligo_preset_outsource_complete_rejected",
        "scene_name": "外协完修单·审核驳回",
        "trigger_document": DOC_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE,
        "trigger_action": ACTION_REJECTED,
        "template_code": HAOLIGO_MOLD_OUTSOURCE_COMPLETE_REJECTED,
        "recipient_scopes": ["creator", "supplier_bound"],
    },
    {
        "id": "haoligo_preset_outsource_complete_revoked",
        "scene_name": "外协完修单·撤销审核",
        "trigger_document": DOC_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE,
        "trigger_action": ACTION_REVOKED,
        "template_code": HAOLIGO_MOLD_OUTSOURCE_COMPLETE_REVOKED,
        "recipient_scopes": ["creator", "source_applicant", "module_reviewers", "user_specified"],
    },
    {
        "id": "haoligo_preset_equipment_upkeep_created",
        "scene_name": "设备维保单·创建",
        "trigger_document": DOC_EQUIPMENT_UPKEEP_SHEET,
        "trigger_action": ACTION_CREATED,
        "template_code": HAOLIGO_EQUIPMENT_UPKEEP_SHEET_CREATED,
        "recipient_scopes": ["creator", "module_complete_operators", "user_specified"],
    },
    {
        "id": "haoligo_preset_equipment_upkeep_complete_created",
        "scene_name": "设备维保完修单·创建",
        "trigger_document": DOC_EQUIPMENT_UPKEEP_COMPLETE,
        "trigger_action": ACTION_CREATED,
        "template_code": HAOLIGO_EQUIPMENT_UPKEEP_COMPLETE_CREATED,
        "recipient_scopes": ["source_applicant", "user_specified"],
    },
    {
        "id": "haoligo_preset_equipment_output_record_created",
        "scene_name": "设备产出单·保存",
        "trigger_document": DOC_EQUIPMENT_OUTPUT_RECORD,
        "trigger_action": ACTION_CREATED,
        "template_code": HAOLIGO_EQUIPMENT_OUTPUT_RECORD_CREATED,
        "recipient_scopes": ["reporter", "user_specified"],
    },
    {
        "id": "haoligo_preset_patrol_issue_remediated",
        "scene_name": "问题登记·治理完成",
        "trigger_document": DOC_PATROL_ISSUE_REGISTER,
        "trigger_action": ACTION_REMEDIATED,
        "template_code": HAOLIGO_PATROL_ISSUE_REMEDIATED,
        "recipient_scopes": ["reporter", "user_specified"],
    },
    {
        "id": "haoligo_preset_trial_approved",
        "scene_name": "试模单·审核通过",
        "trigger_document": DOC_MOLD_TRIAL,
        "trigger_action": ACTION_APPROVED,
        "template_code": HAOLIGO_MOLD_TRIAL_APPROVED,
        "recipient_scopes": ["creator", "trial_operator"],
    },
    {
        "id": "haoligo_preset_trial_production_pending",
        "scene_name": "试模单·待填试产",
        "trigger_document": DOC_MOLD_TRIAL,
        "trigger_action": ACTION_TRIAL_PRODUCTION_PENDING,
        "template_code": HAOLIGO_MOLD_TRIAL_PRODUCTION_PENDING,
        "recipient_scopes": ["production_trial_operator", "trial_operator", "user_specified"],
    },
    {
        "id": "haoligo_preset_trial_recalled",
        "scene_name": "试模单·已收回结案",
        "trigger_document": DOC_MOLD_TRIAL,
        "trigger_action": ACTION_TRIAL_RECALLED,
        "template_code": HAOLIGO_MOLD_TRIAL_RECALLED,
        "recipient_scopes": ["creator", "trial_operator", "user_specified"],
    },
    {
        "id": "haoligo_preset_mold_maintenance_revoked",
        "scene_name": "厂内维保单·撤销审核",
        "trigger_document": DOC_MOLD_MAINTENANCE,
        "trigger_action": ACTION_REVOKED,
        "template_code": HAOLIGO_MOLD_MAINTENANCE_REVOKED,
        "recipient_scopes": ["creator", "module_reviewers", "user_specified"],
    },
    {
        "id": "haoligo_preset_trial_rejected",
        "scene_name": "试模单·审核驳回",
        "trigger_document": DOC_MOLD_TRIAL,
        "trigger_action": ACTION_REJECTED,
        "template_code": HAOLIGO_MOLD_TRIAL_REJECTED,
        "recipient_scopes": ["creator"],
    },
]


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
    for preset in HAOLIGO_NOTIFICATION_RULE_PRESETS:
        key = _rule_identity(preset)
        if key[0] and key[1]:
            out[key] = preset
    return out


def _merge_recipient_scopes_from_preset(
    existing_scopes: Any, preset_scopes: List[str]
) -> Tuple[List[str], bool]:
    """将预设中缺失的收件范围并入已有规则，不删除管理员已配置的范围。"""
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
    """规则引用的模板 UUID 为空或指向已删除/不存在的模板。"""
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


async def load_haoligo_notification_rule_presets(tenant_id: int) -> Dict[str, int]:
    """
    补齐好力 GO 消息提醒规则到 parameters.notifications.rules。
    已存在相同「单据类型 + 触发动作」的规则时：合并预设里缺失的 recipient_scopes；
    若消息模板缺失则按预设 template_code 补绑（需先写入消息模板表）。
    """
    templates_created = await load_haoligo_message_template_presets(tenant_id)

    cfg = await BusinessConfigService().get_business_config(tenant_id)
    existing = _normalize_rules((cfg.get("parameters") or {}).get("notifications"))
    existing_keys: Set[Tuple[str, str]] = {_rule_identity(r) for r in existing}
    existing_ids = {str(r.get("id") or "") for r in existing if r.get("id")}
    preset_index = _preset_by_document_action()

    updated = 0
    repaired_templates = 0
    for rule in existing:
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
        preset_scene = str(preset.get("scene_name") or "").strip()
        if preset_scene and str(rule.get("scene_name") or "").strip() != preset_scene:
            rule["scene_name"] = preset_scene
            updated += 1
        template_code = str(preset.get("template_code") or "").strip()
        if template_code and await _rule_template_ref_invalid(tenant_id, rule):
            template_uuid = await _template_uuid_by_code(tenant_id, template_code)
            if template_uuid:
                rule["template_uuid"] = template_uuid
                rule["template"] = template_uuid
                repaired_templates += 1

    created = 0
    skipped_missing_template = 0
    skipped_duplicate = 0

    for preset in HAOLIGO_NOTIFICATION_RULE_PRESETS:
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
                "好力 GO 消息提醒预设跳过：未找到消息模板 tenant={} code={}",
                tenant_id,
                template_code,
            )
            skipped_missing_template += 1
            continue

        existing.append(
            {
                "id": preset_id or f"haoligo_preset_{doc}_{action}",
                "scene_name": preset.get("scene_name") or f"{doc}·{action}",
                "enabled": True,
                "trigger_document": doc,
                "trigger_action": action,
                "channel_uuids": [BUILTIN_IN_APP_CHANNEL_UUID],
                "channels": [BUILTIN_IN_APP_CHANNEL_UUID],
                "recipient_scopes": list(preset.get("recipient_scopes") or []),
                "recipient_user_ids": [],
                "form_notify_default_user_ids": [],
                "template_uuid": template_uuid,
                "template": template_uuid,
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

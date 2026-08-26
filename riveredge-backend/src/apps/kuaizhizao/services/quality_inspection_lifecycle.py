"""检验单生命周期：撤回检验（执行回退）统一逻辑。"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Literal, Optional

from infra.exceptions.exceptions import BusinessLogicError

QualityInspectionEntityType = Literal[
    "incoming_inspection",
    "process_inspection",
    "finished_goods_inspection",
    "oqc_inspection",
]

_REVOKE_CONDUCT_ALLOWED_STATUSES = frozenset({"已检验", "已驳回"})


def can_revoke_quality_inspection_conduct(status: Any, inspection_result: Any) -> bool:
    """是否允许撤回检验（须先撤销审核，不能从已审核直接撤回检验）。"""
    normalized_status = str(status or "").strip()
    if normalized_status == "已审核":
        return False
    if normalized_status not in _REVOKE_CONDUCT_ALLOWED_STATUSES:
        return False
    return str(inspection_result or "").strip() == "已检验"


def build_quality_inspection_revoke_conduct_fields(
    *,
    entity_type: QualityInspectionEntityType,
    updated_by: int,
    updated_by_name: str,
) -> Dict[str, Any]:
    """构建撤回检验后写入 ORM 的字段（四类检验单共用核心字段）。"""
    fields: Dict[str, Any] = {
        "status": "待检验",
        "inspection_result": "待检验",
        "quality_status": "待判定",
        "qualified_quantity": Decimal("0"),
        "unqualified_quantity": Decimal("0"),
        "inspector_id": None,
        "inspector_name": None,
        "inspection_time": None,
        "review_status": "",
        "reviewer_id": None,
        "reviewer_name": None,
        "review_time": None,
        "review_remarks": None,
        "nonconformance_reason": None,
        "disposition": None,
        "corrective_action": None,
        "updated_by": updated_by,
        "updated_by_name": updated_by_name,
    }

    if entity_type == "incoming_inspection":
        fields.update(
            {
                "appearance_check": None,
                "dimension_check": None,
                "performance_check": None,
                "other_checks": None,
            }
        )
    elif entity_type == "process_inspection":
        fields.update(
            {
                "process_parameters": None,
                "quality_characteristics": None,
                "measurement_data": None,
                "preventive_action": None,
            }
        )
    elif entity_type == "finished_goods_inspection":
        fields.update(
            {
                "appearance_check": None,
                "dimension_check": None,
                "performance_check": None,
                "function_test": None,
                "packaging_check": None,
                "documentation_check": None,
                "other_checks": None,
                "measurement_data": None,
                "preventive_action": None,
                "release_certificate": None,
                "certificate_issued": False,
            }
        )
    elif entity_type == "oqc_inspection":
        fields.update(
            {
                "release_decision": "pending",
                "release_note": None,
                "other_checks": None,
            }
        )
    return fields


async def assert_revoke_conduct_no_downstream(
    tenant_id: int,
    *,
    entity_type: QualityInspectionEntityType,
    source_id: int,
    pushed_purchase_return_quantity: float = 0.0,
    pushed_rework_quantity: float = 0.0,
    pushed_inbound_quantity: float = 0.0,
    certificate_issued: bool = False,
) -> None:
    """撤回检验前校验：存在有效下推或放行则禁止。"""
    if float(pushed_purchase_return_quantity or 0) > 0:
        raise BusinessLogicError(
            "该检验单已下推采购退货单，请先处理或删除下游单据后再撤回检验"
        )
    if float(pushed_rework_quantity or 0) > 0:
        raise BusinessLogicError(
            "该检验单已下推返工单，请先处理或删除下游单据后再撤回检验"
        )
    if float(pushed_inbound_quantity or 0) > 0:
        raise BusinessLogicError(
            "该检验单已下推入库单，请先处理或删除下游单据后再撤回检验"
        )
    if certificate_issued:
        raise BusinessLogicError(
            "该检验单已出具放行证书或触发入库，请先处理下游单据后再撤回检验"
        )

    from apps.kuaizhizao.models.document_relation import DocumentRelation

    relations = await DocumentRelation.filter(
        tenant_id=tenant_id,
        source_type=entity_type,
        source_id=int(source_id),
    ).values_list("target_type", "target_id")

    if not relations:
        return

    target_ids_by_type: Dict[str, set[int]] = {}
    for target_type, target_id in relations:
        if target_id is None:
            continue
        ttype = str(target_type or "").strip()
        if not ttype:
            continue
        target_ids_by_type.setdefault(ttype, set()).add(int(target_id))

    if not target_ids_by_type:
        return

    active_labels = await _resolve_active_downstream_labels(
        tenant_id, target_ids_by_type
    )
    if active_labels:
        joined = "、".join(active_labels)
        raise BusinessLogicError(
            f"该检验单已关联下游单据（{joined}），请先处理后再撤回检验"
        )


async def _resolve_active_downstream_labels(
    tenant_id: int,
    target_ids_by_type: Dict[str, set[int]],
) -> list[str]:
    """解析仍有效的下游单据类型中文标签。"""
    labels: list[str] = []

    type_labels = {
        "purchase_return": "采购退货单",
        "rework_order": "返工单",
        "finished_goods_receipt": "成品入库单",
        "semi_finished_goods_receipt": "半成品入库单",
        "sales_delivery": "销售出库单",
        "defect_record": "不良登记",
    }
    void_statuses = frozenset(
        {
            "已作废",
            "作废",
            "void",
            "VOID",
            "cancelled",
            "CANCELLED",
            "已取消",
            "cancel",
            "CANCEL",
        }
    )

    for target_type, ids in target_ids_by_type.items():
        if not ids:
            continue
        model = _resolve_relation_target_model(target_type)
        if model is None:
            labels.append(type_labels.get(target_type, target_type))
            continue
        active_count = await model.filter(
            tenant_id=tenant_id,
            id__in=list(ids),
            deleted_at__isnull=True,
        ).exclude(status__in=list(void_statuses)).count()
        if active_count > 0:
            labels.append(type_labels.get(target_type, target_type))

    return labels


def _resolve_relation_target_model(target_type: str):
    try:
        if target_type == "purchase_return":
            from apps.kuaizhizao.models.purchase_return import PurchaseReturn

            return PurchaseReturn
        if target_type == "rework_order":
            from apps.kuaizhizao.models.rework_order import ReworkOrder

            return ReworkOrder
        if target_type == "finished_goods_receipt":
            from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt

            return FinishedGoodsReceipt
        if target_type == "semi_finished_goods_receipt":
            from apps.kuaizhizao.models.semi_finished_goods_receipt import (
                SemiFinishedGoodsReceipt,
            )

            return SemiFinishedGoodsReceipt
        if target_type == "sales_delivery":
            from apps.kuaizhizao.models.sales_delivery import SalesDelivery

            return SalesDelivery
        if target_type == "defect_record":
            from apps.kuaizhizao.models.defect_record import DefectRecord

            return DefectRecord
    except Exception:
        return None
    return None

"""
库存预警业务服务模块

提供库存预警规则和预警记录相关的业务逻辑处理，包括预警规则配置、预警触发、预警处理等。

Author: Luigi Lu
Date: 2025-01-04
"""

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.inventory_alert import InventoryAlertRule, InventoryAlert
from apps.kuaizhizao.schemas.inventory_alert import (
    InventoryAlertRuleCreate,
    InventoryAlertRuleUpdate,
    InventoryAlertRuleResponse,
    InventoryAlertRuleListResponse,
    InventoryAlertResponse,
    InventoryAlertListResponse,
    InventoryAlertHandleRequest,
    InventoryAlertCheckResponse,
)
from apps.kuaizhizao.services.inventory_threshold_resolver import (
    alert_level_for,
    build_alert_message,
    is_threshold_breached,
    resolve_effective_threshold,
)

from apps.common.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from core.utils.timezone_utils import resolve_business_datetime


def _normalize_rule_threshold_fields(
    *,
    alert_type: str,
    threshold_type: str,
    threshold_value: Optional[Decimal],
    inherit_material_threshold: bool,
) -> Tuple[str, Optional[Decimal], bool]:
    """校验并规范化规则阈值字段。"""
    at = (alert_type or "").strip()
    tt = (threshold_type or "").strip() or "quantity"
    inherit = bool(inherit_material_threshold)

    if at == "expired":
        if inherit:
            raise ValidationError("过期预警不支持继承物料阈值，请配置天数阈值")
        if tt != "days":
            raise ValidationError("过期预警的阈值类型必须为天数")
        if threshold_value is None:
            raise ValidationError("过期预警必须填写阈值天数")
        return tt, threshold_value, False

    if at not in ("low_stock", "high_stock"):
        raise ValidationError(f"不支持的预警类型: {at}")

    if inherit:
        return "quantity", None, True

    if threshold_value is None:
        raise ValidationError("未继承物料阈值时必须填写阈值数值")
    if tt not in ("quantity", "percentage"):
        raise ValidationError("低/高库存阈值类型仅支持数量或百分比")
    return tt, threshold_value, False


async def _resolve_rule_material_scope(
    tenant_id: int,
    *,
    material_id: Optional[int],
    material_ids: Optional[List[int]],
    material_group_id: Optional[int],
    material_code: Optional[str],
    material_name: Optional[str],
) -> Tuple[Optional[int], Optional[List[int]], Optional[str], Optional[str]]:
    """解析规则物料范围，校验分组归属并生成列表展示字段。"""
    from apps.master_data.models.material import Material

    ids: List[int] = []
    if material_ids:
        for raw in material_ids:
            try:
                mid = int(raw)
            except (TypeError, ValueError):
                continue
            if mid > 0 and mid not in ids:
                ids.append(mid)
    if material_id is not None:
        mid = int(material_id)
        if mid > 0 and mid not in ids:
            ids.insert(0, mid)

    if not ids:
        return None, None, material_code, material_name

    materials = await Material.filter(
        tenant_id=tenant_id, id__in=ids, deleted_at__isnull=True
    ).all()
    found_ids = {int(m.id) for m in materials}
    missing = [mid for mid in ids if mid not in found_ids]
    if missing:
        raise ValidationError(f"物料不存在: {missing[0]}")

    if material_group_id is not None:
        gid = int(material_group_id)
        for material in materials:
            group_id = getattr(material, "group_id", None)
            if group_id is None or int(group_id) != gid:
                code = getattr(material, "main_code", None) or material.id
                raise ValidationError(f"物料 {code} 不属于所选物料分组")

    ids = [mid for mid in ids if mid in found_ids]
    if len(ids) == 1:
        material = next(m for m in materials if int(m.id) == ids[0])
        code = getattr(material, "main_code", None) or material_code
        name = getattr(material, "name", None) or material_name
        return ids[0], ids, code, name

    name_by_id = {int(m.id): str(getattr(m, "name", "") or "") for m in materials}
    ordered_names = [name_by_id[mid] for mid in ids if name_by_id.get(mid)]
    if len(ordered_names) <= 2:
        display_name = "、".join(ordered_names) if ordered_names else None
    else:
        display_name = f"{ordered_names[0]} 等{len(ids)}个物料"
    return None, ids, None, display_name


class InventoryAlertRuleService(AppBaseService[InventoryAlertRule]):
    """
    库存预警规则服务类

    处理库存预警规则相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(InventoryAlertRule)

    async def create_alert_rule(
        self,
        tenant_id: int,
        rule_data: InventoryAlertRuleCreate,
        created_by: int
    ) -> InventoryAlertRuleResponse:
        """
        创建库存预警规则

        Args:
            tenant_id: 组织ID
            rule_data: 预警规则创建数据
            created_by: 创建人ID

        Returns:
            InventoryAlertRuleResponse: 创建的预警规则信息

        Raises:
            ValidationError: 数据验证失败
        """
        threshold_type, threshold_value, inherit = _normalize_rule_threshold_fields(
            alert_type=rule_data.alert_type,
            threshold_type=rule_data.threshold_type,
            threshold_value=rule_data.threshold_value,
            inherit_material_threshold=rule_data.inherit_material_threshold,
        )
        async with in_transaction():
            # 生成预警规则编码
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="ALERT_RULE_CODE",
                prefix="AR"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            resolved_material_id, resolved_material_ids, resolved_code, resolved_name = (
                await _resolve_rule_material_scope(
                    tenant_id,
                    material_id=rule_data.material_id,
                    material_ids=rule_data.material_ids,
                    material_group_id=rule_data.material_group_id,
                    material_code=rule_data.material_code,
                    material_name=rule_data.material_name,
                )
            )

            # 创建预警规则
            alert_rule = await InventoryAlertRule.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                name=rule_data.name,
                alert_type=rule_data.alert_type,
                material_id=resolved_material_id,
                material_ids=resolved_material_ids,
                material_code=resolved_code,
                material_name=resolved_name,
                material_group_id=rule_data.material_group_id,
                material_group_name=rule_data.material_group_name,
                warehouse_id=rule_data.warehouse_id,
                warehouse_name=rule_data.warehouse_name,
                threshold_type=threshold_type,
                threshold_value=threshold_value,
                inherit_material_threshold=inherit,
                is_enabled=rule_data.is_enabled,
                notify_users=rule_data.notify_users,
                notify_roles=rule_data.notify_roles,
                remarks=rule_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            return InventoryAlertRuleResponse.model_validate(alert_rule)

    async def list_alert_rules(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        alert_type: Optional[str] = None,
        is_enabled: Optional[bool] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> Tuple[List[InventoryAlertRuleListResponse], int]:
        """
        获取库存预警规则列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            alert_type: 预警类型（可选）
            is_enabled: 是否启用（可选）

        Returns:
            List[InventoryAlertRuleListResponse]: 预警规则列表
        """
        query = InventoryAlertRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if alert_type:
            query = query.filter(alert_type=alert_type)
        if is_enabled is not None:
            query = query.filter(is_enabled=is_enabled)

        from apps.kuaizhizao.services.warehouse_list_core import (
            INVENTORY_ALERT_RULE_KEYWORD_FIELDS,
            INVENTORY_ALERT_RULE_SORTABLE_FIELDS,
            apply_warehouse_doc_list_filters,
        )
        query, order_clause = apply_warehouse_doc_list_filters(
            query,
            keyword=keyword,
            order_by=order_by,
            allowed_fields=INVENTORY_ALERT_RULE_SORTABLE_FIELDS,
            default_order="-created_at",
            keyword_fields=INVENTORY_ALERT_RULE_KEYWORD_FIELDS,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )

        total = await query.count()
        rules = await query.order_by(order_clause).offset(skip).limit(limit)

        return [InventoryAlertRuleListResponse.model_validate(rule) for rule in rules], total

    async def get_alert_rule_by_id(
        self,
        tenant_id: int,
        rule_id: int
    ) -> InventoryAlertRuleResponse:
        """
        根据ID获取库存预警规则详情

        Args:
            tenant_id: 组织ID
            rule_id: 预警规则ID

        Returns:
            InventoryAlertRuleResponse: 预警规则详情

        Raises:
            NotFoundError: 预警规则不存在
        """
        rule = await InventoryAlertRule.get_or_none(
            id=rule_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not rule:
            raise NotFoundError(f"预警规则不存在: {rule_id}")

        return InventoryAlertRuleResponse.model_validate(rule)

    async def update_alert_rule(
        self,
        tenant_id: int,
        rule_id: int,
        rule_data: InventoryAlertRuleUpdate,
        updated_by: int
    ) -> InventoryAlertRuleResponse:
        """
        更新库存预警规则

        Args:
            tenant_id: 组织ID
            rule_id: 预警规则ID
            rule_data: 预警规则更新数据
            updated_by: 更新人ID

        Returns:
            InventoryAlertRuleResponse: 更新后的预警规则信息

        Raises:
            NotFoundError: 预警规则不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取预警规则
            rule = await InventoryAlertRule.get_or_none(
                id=rule_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not rule:
                raise NotFoundError(f"预警规则不存在: {rule_id}")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新字段
            if rule_data.name is not None:
                rule.name = rule_data.name
            next_inherit = (
                rule_data.inherit_material_threshold
                if rule_data.inherit_material_threshold is not None
                else bool(rule.inherit_material_threshold)
            )
            next_type = rule_data.threshold_type if rule_data.threshold_type is not None else rule.threshold_type
            # 显式传入 inherit / threshold 时重算；仅改 threshold_value 也允许
            if (
                rule_data.inherit_material_threshold is not None
                or rule_data.threshold_type is not None
                or "threshold_value" in rule_data.model_fields_set
            ):
                next_value = (
                    rule_data.threshold_value
                    if "threshold_value" in rule_data.model_fields_set
                    else rule.threshold_value
                )
                next_type, next_value, next_inherit = _normalize_rule_threshold_fields(
                    alert_type=rule.alert_type,
                    threshold_type=next_type,
                    threshold_value=next_value,
                    inherit_material_threshold=next_inherit,
                )
                rule.threshold_type = next_type
                rule.threshold_value = next_value
                rule.inherit_material_threshold = next_inherit
            if rule_data.is_enabled is not None:
                rule.is_enabled = rule_data.is_enabled
            if rule_data.notify_users is not None:
                rule.notify_users = rule_data.notify_users
            if rule_data.notify_roles is not None:
                rule.notify_roles = rule_data.notify_roles
            if rule_data.remarks is not None:
                rule.remarks = rule_data.remarks

            rule.updated_by = updated_by
            rule.updated_by_name = user_info["name"]

            await rule.save()

            return InventoryAlertRuleResponse.model_validate(rule)

    async def delete_alert_rule(
        self,
        tenant_id: int,
        rule_id: int
    ) -> None:
        """
        删除库存预警规则（软删除）

        Args:
            tenant_id: 组织ID
            rule_id: 预警规则ID

        Raises:
            NotFoundError: 预警规则不存在
        """
        rule = await InventoryAlertRule.get_or_none(
            id=rule_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not rule:
            raise NotFoundError(f"预警规则不存在: {rule_id}")

        # 软删除
        rule.deleted_at = resolve_business_datetime()
        await rule.save()


class InventoryAlertService(AppBaseService[InventoryAlert]):
    """
    库存预警记录服务类

    处理库存预警记录相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(InventoryAlert)

    async def get_alerts(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        alert_type: Optional[str] = None,
        status: Optional[str] = None,
        alert_level: Optional[str] = None,
        material_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        triggered_start_date: Optional[str] = None,
        triggered_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
    ) -> Tuple[List[InventoryAlertListResponse], int]:
        """
        获取库存预警记录列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            alert_type: 预警类型（可选）
            status: 状态（可选）
            alert_level: 预警级别（可选）
            material_id: 物料ID（可选）
            warehouse_id: 仓库ID（可选）

        Returns:
            List[InventoryAlertListResponse]: 预警记录列表
        """
        query = InventoryAlert.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if alert_type:
            query = query.filter(alert_type=alert_type)
        if status:
            query = query.filter(status=status)
        if alert_level:
            query = query.filter(alert_level=alert_level)
        if material_id:
            query = query.filter(material_id=material_id)
        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)

        from apps.kuaizhizao.services.warehouse_list_core import (
            INVENTORY_ALERT_KEYWORD_FIELDS,
            INVENTORY_ALERT_SORTABLE_FIELDS,
            apply_warehouse_doc_list_filters,
        )
        query, order_clause = apply_warehouse_doc_list_filters(
            query,
            keyword=keyword,
            order_by=order_by,
            allowed_fields=INVENTORY_ALERT_SORTABLE_FIELDS,
            default_order="-triggered_at",
            keyword_fields=INVENTORY_ALERT_KEYWORD_FIELDS,
            doc_date_field="triggered_at",
            doc_start_date=triggered_start_date,
            doc_end_date=triggered_end_date,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
        )

        total = await query.count()
        alerts = await query.order_by(order_clause).offset(skip).limit(limit)

        from apps.kuaizhizao.services.document_action_policy.enricher import enrich_inventory_alert_list_capabilities
        responses = [InventoryAlertListResponse.model_validate(alert) for alert in alerts]
        return enrich_inventory_alert_list_capabilities(alerts, responses), total

    async def get_alert_by_id(
        self,
        tenant_id: int,
        alert_id: int
    ) -> InventoryAlertResponse:
        """
        根据ID获取库存预警记录详情

        Args:
            tenant_id: 组织ID
            alert_id: 预警记录ID

        Returns:
            InventoryAlertResponse: 预警记录详情

        Raises:
            NotFoundError: 预警记录不存在
        """
        alert = await InventoryAlert.get_or_none(
            id=alert_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not alert:
            raise NotFoundError(f"预警记录不存在: {alert_id}")

        return InventoryAlertResponse.model_validate(alert)

    async def get_alert_statistics(
        self,
        tenant_id: int
    ) -> Dict[str, Any]:
        """
        获取库存预警统计信息

        Args:
            tenant_id: 组织ID

        Returns:
            Dict[str, Any]: 预警统计信息（按类型、级别、状态统计）
        """
        # 统计待处理预警数量
        pending_count = await InventoryAlert.filter(
            tenant_id=tenant_id,
            status="pending",
            deleted_at__isnull=True
        ).count()

        # 统计按类型分组的预警数量
        low_stock_count = await InventoryAlert.filter(
            tenant_id=tenant_id,
            alert_type="low_stock",
            status="pending",
            deleted_at__isnull=True
        ).count()

        high_stock_count = await InventoryAlert.filter(
            tenant_id=tenant_id,
            alert_type="high_stock",
            status="pending",
            deleted_at__isnull=True
        ).count()

        expired_count = await InventoryAlert.filter(
            tenant_id=tenant_id,
            alert_type="expired",
            status="pending",
            deleted_at__isnull=True
        ).count()

        # 统计按级别分组的预警数量
        critical_count = await InventoryAlert.filter(
            tenant_id=tenant_id,
            alert_level="critical",
            status="pending",
            deleted_at__isnull=True
        ).count()

        warning_count = await InventoryAlert.filter(
            tenant_id=tenant_id,
            alert_level="warning",
            status="pending",
            deleted_at__isnull=True
        ).count()

        info_count = await InventoryAlert.filter(
            tenant_id=tenant_id,
            alert_level="info",
            status="pending",
            deleted_at__isnull=True
        ).count()

        return {
            "pending_count": pending_count,
            "by_type": {
                "low_stock": low_stock_count,
                "high_stock": high_stock_count,
                "expired": expired_count,
            },
            "by_level": {
                "critical": critical_count,
                "warning": warning_count,
                "info": info_count,
            },
        }

    async def handle_alert(
        self,
        tenant_id: int,
        alert_id: int,
        handle_data: InventoryAlertHandleRequest,
        handled_by: int
    ) -> InventoryAlertResponse:
        """
        处理库存预警

        Args:
            tenant_id: 组织ID
            alert_id: 预警记录ID
            handle_data: 处理数据
            handled_by: 处理人ID

        Returns:
            InventoryAlertResponse: 更新后的预警记录信息

        Raises:
            NotFoundError: 预警记录不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取预警记录
            alert = await InventoryAlert.get_or_none(
                id=alert_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not alert:
                raise NotFoundError(f"预警记录不存在: {alert_id}")

            from apps.kuaizhizao.services.document_action_policy.inventory_alert import (
                assert_inventory_alert_capability,
            )
            action = "resolve" if handle_data.status == "resolved" else "ignore"
            if handle_data.status not in ("resolved", "ignored"):
                action = "resolve"
            assert_inventory_alert_capability(alert, action)

            # 获取处理人信息
            user_info = await self.get_user_info(handled_by)

            # 更新预警记录
            alert.status = handle_data.status
            alert.handled_by = handled_by
            alert.handled_by_name = user_info["name"]
            alert.handled_at = resolve_business_datetime()
            alert.handling_notes = handle_data.handling_notes

            if handle_data.status == "resolved":
                alert.resolved_at = resolve_business_datetime()

            alert.updated_by = handled_by
            alert.updated_by_name = user_info["name"]

            await alert.save()

            return InventoryAlertResponse.model_validate(alert)

    async def check_and_trigger_alerts(
        self,
        tenant_id: int,
        material_id: int,
        warehouse_id: int,
        current_quantity: Decimal,
        *,
        warehouse_name: Optional[str] = None,
        material: Any = None,
        rules: Optional[List[InventoryAlertRule]] = None,
        operator_id: Optional[int] = None,
    ) -> List[InventoryAlertResponse]:
        """
        检查并触发（或自动解除）指定物料+仓库的低/高库存预警。
        """
        from apps.master_data.models.material import Material

        if material is None:
            material = await Material.get_or_none(
                id=material_id, tenant_id=tenant_id, deleted_at__isnull=True
            )
        if not material:
            raise NotFoundError(f"物料不存在: {material_id}")

        if rules is None:
            rules = await InventoryAlertRule.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                is_enabled=True,
            ).all()

        qty = Decimal(str(current_quantity or 0))
        wh_name = (warehouse_name or "").strip() or f"仓库({warehouse_id})"
        results: List[InventoryAlertResponse] = []
        for alert_type in ("low_stock", "high_stock"):
            threshold = resolve_effective_threshold(
                alert_type=alert_type,
                material=material,
                warehouse_id=warehouse_id,
                rules=rules,
            )
            breached = is_threshold_breached(qty, threshold)
            alert = await self._upsert_open_alert(
                tenant_id=tenant_id,
                alert_type=alert_type,
                material=material,
                warehouse_id=warehouse_id,
                warehouse_name=wh_name,
                quantity=qty,
                threshold=threshold,
                breached=breached,
                operator_id=operator_id,
            )
            if alert is not None:
                results.append(alert)
        return results

    async def run_inventory_alert_check(
        self,
        tenant_id: int,
        *,
        material_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        operator_id: Optional[int] = None,
    ) -> InventoryAlertCheckResponse:
        """
        批量检查库存余额并触发/解除预警（立即检查）。
        阈值链：匹配规则 → 物料 defaults.safetyStock/maxStock。
        """
        from apps.kuaizhizao.services.report_service import ReportService
        from apps.master_data.models.material import Material

        report = ReportService()
        rows = await report._load_inventory_rows(
            tenant_id=tenant_id,
            material_id=material_id,
            warehouse_id=warehouse_id,
            include_expired=True,
        )
        grouped: Dict[Tuple[int, int], Dict[str, Any]] = {}
        for row in rows:
            mid = row.get("material_id")
            wid = row.get("warehouse_id")
            if mid is None or wid is None:
                continue
            key = (int(mid), int(wid))
            if key not in grouped:
                grouped[key] = {
                    "material_id": int(mid),
                    "warehouse_id": int(wid),
                    "warehouse_name": row.get("warehouse_name") or f"仓库({wid})",
                    "material_code": row.get("material_code") or "",
                    "material_name": row.get("material_name") or "",
                    "quantity": Decimal("0"),
                    "min_expiry_days": None,
                }
            grouped[key]["quantity"] += Decimal(str(row.get("quantity") or 0))
            expiry = row.get("expiry_date")
            if expiry:
                try:
                    exp_date = date.fromisoformat(str(expiry)[:10])
                    days_left = (exp_date - date.today()).days
                    prev = grouped[key]["min_expiry_days"]
                    if prev is None or days_left < prev:
                        grouped[key]["min_expiry_days"] = days_left
                except Exception:
                    pass

        material_ids = sorted({g["material_id"] for g in grouped.values()})
        materials = await Material.filter(
            tenant_id=tenant_id, id__in=material_ids, deleted_at__isnull=True
        ).all() if material_ids else []
        material_map = {int(m.id): m for m in materials}
        rules = await InventoryAlertRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_enabled=True,
        ).all()

        touched: List[InventoryAlertResponse] = []
        triggered = 0
        resolved = 0
        for balance in grouped.values():
            material = material_map.get(int(balance["material_id"]))
            if not material:
                continue
            qty = Decimal(str(balance["quantity"]))
            wid = int(balance["warehouse_id"])
            wh_name = str(balance["warehouse_name"] or "")
            for alert_type in ("low_stock", "high_stock"):
                threshold = resolve_effective_threshold(
                    alert_type=alert_type,
                    material=material,
                    warehouse_id=wid,
                    rules=rules,
                )
                breached = is_threshold_breached(qty, threshold)
                before = await InventoryAlert.get_or_none(
                    tenant_id=tenant_id,
                    material_id=int(material.id),
                    warehouse_id=wid,
                    alert_type=alert_type,
                    status__in=["pending", "processing"],
                    deleted_at__isnull=True,
                )
                had_open = before is not None
                alert = await self._upsert_open_alert(
                    tenant_id=tenant_id,
                    alert_type=alert_type,
                    material=material,
                    warehouse_id=wid,
                    warehouse_name=wh_name,
                    quantity=qty,
                    threshold=threshold,
                    breached=breached,
                    operator_id=operator_id,
                    existing=before,
                )
                if alert is None:
                    continue
                touched.append(alert)
                if breached and not had_open:
                    triggered += 1
                elif not breached and had_open:
                    resolved += 1

            # 过期：仅规则驱动
            exp_threshold = resolve_effective_threshold(
                alert_type="expired",
                material=material,
                warehouse_id=wid,
                rules=rules,
            )
            days_left = balance.get("min_expiry_days")
            expired_breached = (
                exp_threshold.has_threshold
                and days_left is not None
                and Decimal(str(days_left)) <= (exp_threshold.effective_quantity or Decimal("0"))
            )
            before_exp = await InventoryAlert.get_or_none(
                tenant_id=tenant_id,
                material_id=int(material.id),
                warehouse_id=wid,
                alert_type="expired",
                status__in=["pending", "processing"],
                deleted_at__isnull=True,
            )
            had_open_exp = before_exp is not None
            alert_exp = await self._upsert_open_alert(
                tenant_id=tenant_id,
                alert_type="expired",
                material=material,
                warehouse_id=wid,
                warehouse_name=wh_name,
                quantity=qty,
                threshold=exp_threshold,
                breached=bool(expired_breached),
                operator_id=operator_id,
                existing=before_exp,
                override_message=(
                    build_alert_message(quantity=qty, threshold=exp_threshold)
                    if expired_breached
                    else None
                ),
            )
            if alert_exp is not None:
                touched.append(alert_exp)
                if expired_breached and not had_open_exp:
                    triggered += 1
                elif not expired_breached and had_open_exp:
                    resolved += 1

        return InventoryAlertCheckResponse(
            checked_balances=len(grouped),
            triggered_count=triggered,
            resolved_count=resolved,
            alerts=touched,
        )

    async def _upsert_open_alert(
        self,
        *,
        tenant_id: int,
        alert_type: str,
        material: Any,
        warehouse_id: int,
        warehouse_name: str,
        quantity: Decimal,
        threshold: Any,
        breached: bool,
        operator_id: Optional[int] = None,
        existing: Optional[InventoryAlert] = None,
        override_message: Optional[str] = None,
    ) -> Optional[InventoryAlertResponse]:
        """有突破则创建/更新 pending；已恢复则自动 resolved。"""
        if existing is None:
            existing = await InventoryAlert.get_or_none(
                tenant_id=tenant_id,
                material_id=int(material.id),
                warehouse_id=warehouse_id,
                alert_type=alert_type,
                status__in=["pending", "processing"],
                deleted_at__isnull=True,
            )

        now = resolve_business_datetime()

        if not breached:
            if existing is None:
                return None
            existing.status = "resolved"
            existing.resolved_at = now
            existing.current_quantity = quantity
            note = "库存恢复，系统自动解除"
            existing.handling_notes = (
                f"{existing.handling_notes}\n{note}" if existing.handling_notes else note
            )
            await existing.save()
            return InventoryAlertResponse.model_validate(existing)

        if not threshold.has_threshold or threshold.effective_quantity is None:
            return None

        message = override_message or build_alert_message(quantity=quantity, threshold=threshold)
        level = alert_level_for(quantity, alert_type)
        eff = threshold.effective_quantity

        if existing is not None:
            existing.current_quantity = quantity
            existing.threshold_value = eff
            existing.alert_level = level
            existing.alert_message = message
            existing.alert_rule_id = threshold.rule_id
            existing.warehouse_name = warehouse_name or existing.warehouse_name
            await existing.save()
            return InventoryAlertResponse.model_validate(existing)

        alert = await InventoryAlert.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            alert_rule_id=threshold.rule_id,
            alert_type=alert_type,
            material_id=int(material.id),
            material_code=getattr(material, "main_code", None) or "",
            material_name=getattr(material, "name", None) or "",
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
            current_quantity=quantity,
            threshold_value=eff,
            alert_level=level,
            alert_message=message,
            status="pending",
            triggered_at=now,
        )
        alert_resp = InventoryAlertResponse.model_validate(alert)
        from apps.kuaizhizao.services.kuaizhizao_business_notification import (
            ACTION_TRIGGERED,
            DOC_INVENTORY_ALERT,
            dispatch_kuaizhizao_notification,
        )

        alert_type_label = "低库存" if alert_type == "low_stock" else "高库存"
        try:
            await dispatch_kuaizhizao_notification(
                tenant_id,
                trigger_document=DOC_INVENTORY_ALERT,
                trigger_action=ACTION_TRIGGERED,
                variables={
                    "material_code": alert.material_code or "",
                    "material_name": alert.material_name or "",
                    "warehouse_name": warehouse_name or "",
                    "alert_type_label": alert_type_label,
                    "current_quantity": str(quantity),
                    "threshold_value": str(eff),
                    "alert_message": message,
                    "detail_path": "/apps/kuaizhizao/warehouse-management/inventory-alerts",
                    "inventory_alert_id": str(alert.id),
                },
                context={"creator_user_id": operator_id},
            )
        except Exception as exc:
            logger.warning("库存预警消息提醒失败 tenant={}: {}", tenant_id, exc)
        return alert_resp


"""通用外推门面：按 source_type + target_profile 分发到业务适配。

与「系统内下推」document_push_pull 无关；本模块只推外部系统。

P2：支持多目标 fan-out（target_profiles / target_profile=*）。
分发走 (source_type, profile)→handler 注册表；禁止再扩品牌 if/elif。
正式写回：push_ready ∧ SUPPORTED_PROFILES（见 document_push_readiness）。
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, List, Optional, Set, Tuple

from apps.kuaizhizao.services.feishu_work_order_push_service import (
    TARGET_PROFILE as WO_FEISHU_PROFILE,
    FeishuWorkOrderPushService,
)
from apps.kuaizhizao.services.kingdee_inventory_push_service import (
    TARGET_PROFILE as INV_KD_PROFILE,
    KingdeeInventoryPushService,
)
from apps.kuaizhizao.services.kingdee_production_order_push_service import (
    TARGET_PROFILE as WO_KD_PROFILE,
    KingdeeProductionOrderPushService,
)
from apps.kuaizhizao.services.kingdee_production_report_push_service import (
    TARGET_PROFILE as RPT_KD_PROFILE,
    KingdeeProductionReportPushService,
)
from apps.kuaizhizao.services.kingdee_purchase_order_push_service import (
    TARGET_PROFILE as PO_KD_PROFILE,
    KingdeePurchaseOrderPushService,
)
from apps.kuaizhizao.services.kingdee_sales_order_push_service import (
    TARGET_PROFILE as SO_KD_PROFILE,
    KingdeeSalesOrderPushService,
)
from apps.kuaizhizao.services.oa_document_push_service import (
    TARGET_PROFILE as WO_OA_PROFILE,
    OaDocumentPushService,
)
from core.services.integration.document_push_readiness import assert_document_push_ready
from infra.exceptions.exceptions import ValidationError
from infra.services.business_config_service import BusinessConfigService

# (source_type, target_profile) — 仅注册已实现适配；禁止假装支持无限类型
SUPPORTED_PROFILES: Set[Tuple[str, str]] = {
    ("work_order", WO_KD_PROFILE),
    ("work_order", WO_OA_PROFILE),
    ("work_order", WO_FEISHU_PROFILE),
    ("reporting_record", RPT_KD_PROFILE),
    ("sales_order", SO_KD_PROFILE),
    ("purchase_order", PO_KD_PROFILE),
    ("material_batch", INV_KD_PROFILE),
}

# source_type → business_config 分类键
_SOURCE_CONFIG_CATEGORY: Dict[str, str] = {
    "work_order": "work_order",
    "reporting_record": "reporting",
    "sales_order": "sales",
    "purchase_order": "purchase",
    "material_batch": "warehouse",
}

MULTI_PROFILE_TOKEN = "*"

PushHandler = Callable[..., Awaitable[Dict[str, Any]]]

# (source_type, target_profile) → handler；禁止用品牌 if 扩张
_PUSH_HANDLERS: Dict[Tuple[str, str], PushHandler] = {}


def _disabled_result(
    *,
    source_type: str,
    source_id: int,
    target_profile: str,
    message: str,
) -> Dict[str, Any]:
    return {
        "success": False,
        "message": message,
        "source_type": source_type,
        "source_id": int(source_id),
        "target_profile": target_profile,
    }


def register_push_handler(
    source_type: str,
    target_profile: str,
    handler: PushHandler,
) -> None:
    key = (str(source_type).strip(), str(target_profile).strip())
    _PUSH_HANDLERS[key] = handler


def list_registered_push_handlers() -> list[Tuple[str, str]]:
    return sorted(_PUSH_HANDLERS.keys())


async def _handle_work_order_kingdee(
    *,
    tenant_id: int,
    acting_user_id: int,
    source_id: int,
    connection_code: Optional[str],
    save_api_uuid: Optional[str],
    dry_run: bool,
    **_: Any,
) -> Dict[str, Any]:
    result = await KingdeeProductionOrderPushService().push_work_order(
        tenant_id=tenant_id,
        work_order_id=int(source_id),
        acting_user_id=acting_user_id,
        connection_code=connection_code,
        save_api_uuid=save_api_uuid,
        dry_run=dry_run,
    )
    if result is None:
        return _disabled_result(
            source_type="work_order",
            source_id=source_id,
            target_profile=WO_KD_PROFILE,
            message="推送未启用或工单不存在",
        )
    return result


async def _handle_work_order_oa(
    *,
    tenant_id: int,
    acting_user_id: int,
    source_id: int,
    connection_code: Optional[str],
    save_api_uuid: Optional[str],
    dry_run: bool,
    **_: Any,
) -> Dict[str, Any]:
    result = await OaDocumentPushService().push_work_order(
        tenant_id=tenant_id,
        work_order_id=int(source_id),
        acting_user_id=acting_user_id,
        connection_code=connection_code,
        save_api_uuid=save_api_uuid,
        dry_run=dry_run,
    )
    if result is None:
        return _disabled_result(
            source_type="work_order",
            source_id=source_id,
            target_profile=WO_OA_PROFILE,
            message="OA 推送未启用或工单不存在",
        )
    return result


async def _handle_work_order_feishu(
    *,
    tenant_id: int,
    acting_user_id: int,
    source_id: int,
    connection_code: Optional[str],
    save_api_uuid: Optional[str],
    dry_run: bool,
    **_: Any,
) -> Dict[str, Any]:
    result = await FeishuWorkOrderPushService().push_work_order(
        tenant_id=tenant_id,
        work_order_id=int(source_id),
        acting_user_id=acting_user_id,
        connection_code=connection_code,
        save_api_uuid=save_api_uuid,
        dry_run=dry_run,
    )
    if result is None:
        return _disabled_result(
            source_type="work_order",
            source_id=source_id,
            target_profile=WO_FEISHU_PROFILE,
            message="飞书推送未启用或工单不存在",
        )
    return result


async def _handle_reporting_kingdee(
    *,
    tenant_id: int,
    acting_user_id: int,
    source_id: int,
    connection_code: Optional[str],
    save_api_uuid: Optional[str],
    dry_run: bool,
    **_: Any,
) -> Dict[str, Any]:
    return await DocumentPushService()._push_reporting(
        tenant_id=tenant_id,
        record_id=int(source_id),
        acting_user_id=acting_user_id,
        connection_code=connection_code,
        save_api_uuid=save_api_uuid,
        dry_run=dry_run,
    )


async def _handle_sales_order_kingdee(
    *,
    tenant_id: int,
    acting_user_id: int,
    source_id: int,
    connection_code: Optional[str],
    save_api_uuid: Optional[str],
    dry_run: bool,
    **_: Any,
) -> Dict[str, Any]:
    result = await KingdeeSalesOrderPushService().push_sales_order(
        tenant_id=tenant_id,
        sales_order_id=int(source_id),
        acting_user_id=acting_user_id,
        connection_code=connection_code,
        save_api_uuid=save_api_uuid,
        dry_run=dry_run,
    )
    if result is None:
        return _disabled_result(
            source_type="sales_order",
            source_id=source_id,
            target_profile=SO_KD_PROFILE,
            message="金蝶销售订单推送未启用或订单不存在",
        )
    return result


async def _handle_purchase_order_kingdee(
    *,
    tenant_id: int,
    acting_user_id: int,
    source_id: int,
    connection_code: Optional[str],
    save_api_uuid: Optional[str],
    dry_run: bool,
    **_: Any,
) -> Dict[str, Any]:
    result = await KingdeePurchaseOrderPushService().push_purchase_order(
        tenant_id=tenant_id,
        purchase_order_id=int(source_id),
        acting_user_id=acting_user_id,
        connection_code=connection_code,
        save_api_uuid=save_api_uuid,
        dry_run=dry_run,
    )
    if result is None:
        return _disabled_result(
            source_type="purchase_order",
            source_id=source_id,
            target_profile=PO_KD_PROFILE,
            message="金蝶采购订单推送未启用或订单不存在",
        )
    return result


async def _handle_material_batch_kingdee(
    *,
    tenant_id: int,
    acting_user_id: int,
    source_id: int,
    connection_code: Optional[str],
    save_api_uuid: Optional[str],
    dry_run: bool,
    **_: Any,
) -> Dict[str, Any]:
    result = await KingdeeInventoryPushService().push_material_batch(
        tenant_id=tenant_id,
        material_batch_id=int(source_id),
        acting_user_id=acting_user_id,
        connection_code=connection_code,
        save_api_uuid=save_api_uuid,
        dry_run=dry_run,
    )
    if result is None:
        return _disabled_result(
            source_type="material_batch",
            source_id=source_id,
            target_profile=INV_KD_PROFILE,
            message="金蝶即时库存推送未启用或批次不存在",
        )
    return result


def ensure_default_push_handlers_registered() -> None:
    """惰性注册真实已实现 profile；禁止把 WMS/PLM/CRM 虚报进来。"""
    if _PUSH_HANDLERS:
        return
    register_push_handler("work_order", WO_KD_PROFILE, _handle_work_order_kingdee)
    register_push_handler("work_order", WO_OA_PROFILE, _handle_work_order_oa)
    register_push_handler("work_order", WO_FEISHU_PROFILE, _handle_work_order_feishu)
    register_push_handler("reporting_record", RPT_KD_PROFILE, _handle_reporting_kingdee)
    register_push_handler("sales_order", SO_KD_PROFILE, _handle_sales_order_kingdee)
    register_push_handler("purchase_order", PO_KD_PROFILE, _handle_purchase_order_kingdee)
    register_push_handler("material_batch", INV_KD_PROFILE, _handle_material_batch_kingdee)


class DocumentPushService:
    """任意页面可调的外推入口。"""

    def list_profiles(self) -> list[Dict[str, str]]:
        return [
            {
                "source_type": source_type,
                "target_profile": target_profile,
            }
            for source_type, target_profile in sorted(SUPPORTED_PROFILES)
        ]

    async def resolve_target_profiles(
        self,
        *,
        tenant_id: int,
        source_type: str,
        target_profile: Optional[str] = None,
        target_profiles: Optional[List[str]] = None,
    ) -> List[str]:
        """解析最终要推送的 profile 列表（显式 > 业务配置 document_push_targets > 单 profile）。"""
        source_type = str(source_type or "").strip()
        explicit: List[str] = []
        if target_profiles:
            explicit = [str(p).strip() for p in target_profiles if str(p or "").strip()]
        single = str(target_profile or "").strip()

        if explicit:
            profiles = explicit
        elif single and single != MULTI_PROFILE_TOKEN:
            profiles = [single]
        else:
            # target_profile=* 或未传：读业务配置多目标列表
            profiles = await self._load_configured_targets(tenant_id, source_type)
            if not profiles and single == MULTI_PROFILE_TOKEN:
                # * 但未配置：该 source 下全部已注册 profile
                profiles = [
                    p for st, p in sorted(SUPPORTED_PROFILES) if st == source_type
                ]
            if not profiles and single:
                profiles = [single]

        if not profiles:
            raise ValidationError(
                "未指定 target_profile / target_profiles，且业务配置 document_push_targets 为空"
            )

        for profile in profiles:
            if (source_type, profile) not in SUPPORTED_PROFILES:
                raise ValidationError(
                    f"不支持的推送组合 source_type={source_type!r} target_profile={profile!r}；"
                    f"可用：{sorted(SUPPORTED_PROFILES)}"
                )
        # 去重且保序
        seen: Set[str] = set()
        ordered: List[str] = []
        for p in profiles:
            if p not in seen:
                seen.add(p)
                ordered.append(p)
        return ordered

    async def _load_configured_targets(self, tenant_id: int, source_type: str) -> List[str]:
        category = _SOURCE_CONFIG_CATEGORY.get(source_type)
        if not category:
            return []
        biz = await BusinessConfigService().get_business_config(tenant_id)
        params = (biz.get("parameters", {}) or {}).get(category, {}) or {}
        raw = params.get("document_push_targets")
        if isinstance(raw, str):
            import json

            try:
                raw = json.loads(raw) if raw.strip() else []
            except Exception:
                raw = [x.strip() for x in raw.split(",") if x.strip()]
        if not isinstance(raw, list):
            return []
        return [str(x).strip() for x in raw if str(x or "").strip()]

    async def push(
        self,
        *,
        tenant_id: int,
        acting_user_id: int,
        source_type: str,
        source_id: int,
        target_profile: Optional[str] = None,
        target_profiles: Optional[List[str]] = None,
        connection_code: Optional[str] = None,
        save_api_uuid: Optional[str] = None,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        source_type = str(source_type or "").strip()
        if int(source_id or 0) <= 0:
            raise ValidationError("source_id 无效")

        profiles = await self.resolve_target_profiles(
            tenant_id=tenant_id,
            source_type=source_type,
            target_profile=target_profile,
            target_profiles=target_profiles,
        )

        if len(profiles) == 1:
            return await self._push_one(
                tenant_id=tenant_id,
                acting_user_id=acting_user_id,
                source_type=source_type,
                source_id=int(source_id),
                target_profile=profiles[0],
                connection_code=connection_code,
                save_api_uuid=save_api_uuid,
                dry_run=dry_run,
            )

        # 多目标 fan-out：各目标独立成败，汇总 results
        results: List[Dict[str, Any]] = []
        for profile in profiles:
            try:
                one = await self._push_one(
                    tenant_id=tenant_id,
                    acting_user_id=acting_user_id,
                    source_type=source_type,
                    source_id=int(source_id),
                    target_profile=profile,
                    connection_code=connection_code,
                    save_api_uuid=save_api_uuid,
                    dry_run=dry_run,
                )
            except Exception as exc:
                one = {
                    "success": False,
                    "source_type": source_type,
                    "source_id": int(source_id),
                    "target_profile": profile,
                    "message": str(exc),
                }
            results.append(one)

        ok_count = sum(1 for r in results if r.get("success") and not r.get("skipped"))
        skip_count = sum(1 for r in results if r.get("skipped"))
        fail_count = sum(1 for r in results if r.get("success") is False)
        all_ok = fail_count == 0
        return {
            "success": all_ok,
            "multi": True,
            "source_type": source_type,
            "source_id": int(source_id),
            "target_profiles": profiles,
            "created": ok_count,
            "skipped": skip_count,
            "failed": fail_count,
            "results": results,
            "message": f"多目标推送：成功 {ok_count}，跳过 {skip_count}，失败 {fail_count}",
            "dry_run": dry_run,
            # 兼容单目标预览：取首个 dry_run model
            "model": next((r.get("model") for r in results if r.get("model")), None),
            "body": next((r.get("body") for r in results if r.get("body")), None),
        }

    async def _push_one(
        self,
        *,
        tenant_id: int,
        acting_user_id: int,
        source_type: str,
        source_id: int,
        target_profile: str,
        connection_code: Optional[str],
        save_api_uuid: Optional[str],
        dry_run: bool,
    ) -> Dict[str, Any]:
        ensure_default_push_handlers_registered()

        key = (source_type, target_profile)
        # 正式写回条件之一：必须 ∈ SUPPORTED_PROFILES（禁止虚报）
        if key not in SUPPORTED_PROFILES:
            raise ValidationError(
                f"不支持的推送组合 source_type={source_type!r} target_profile={target_profile!r}"
            )

        # 写门：正式推必须 push_ready；dry_run 可组装预览、不得假装已接通
        await assert_document_push_ready(
            tenant_id,
            source_type=source_type,
            target_profile=target_profile,
            connection_code=connection_code,
            dry_run=dry_run,
        )

        from core.services.integration.document_push_guard import (
            document_push_guard,
            resolve_push_dimensions,
        )
        from core.services.integration.document_push_slo import document_push_slo

        category, connector_type, profile = resolve_push_dimensions(
            target_profile=target_profile
        )
        document_push_guard.assert_allowed(
            tenant_id,
            category=category,
            connector_type=connector_type,
            target_profile=profile,
            dry_run=dry_run,
        )

        handler = _PUSH_HANDLERS.get(key)
        if handler is None:
            raise ValidationError(f"未实现的推送适配: {source_type}/{target_profile}")

        try:
            result = await handler(
                tenant_id=tenant_id,
                acting_user_id=acting_user_id,
                source_type=source_type,
                source_id=int(source_id),
                target_profile=target_profile,
                connection_code=connection_code,
                save_api_uuid=save_api_uuid,
                dry_run=dry_run,
            )
        except Exception:
            document_push_guard.record_outcome(
                tenant_id,
                category=category,
                connector_type=connector_type,
                target_profile=profile,
                success=False,
                dry_run=dry_run,
            )
            if dry_run:
                document_push_slo.record(
                    category=category,
                    connector_type=connector_type,
                    target_profile=profile,
                    success=False,
                    dry_run=True,
                )
            raise

        success = bool(result.get("success")) if isinstance(result, dict) else True
        if isinstance(result, dict) and result.get("skipped"):
            success = True
        document_push_guard.record_outcome(
            tenant_id,
            category=category,
            connector_type=connector_type,
            target_profile=profile,
            success=success,
            dry_run=dry_run,
        )
        if dry_run:
            document_push_slo.record(
                category=category,
                connector_type=connector_type,
                target_profile=profile,
                success=True,
                dry_run=True,
            )
        return result

    async def _push_reporting(
        self,
        *,
        tenant_id: int,
        record_id: int,
        acting_user_id: int,
        connection_code: Optional[str],
        save_api_uuid: Optional[str],
        dry_run: bool,
    ) -> Dict[str, Any]:
        """报工适配：dry_run / 连接覆盖；正式推写 kingdee_push_* 重试水位。"""
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        from apps.kuaizhizao.models.reporting_record import ReportingRecord
        from apps.kuaizhizao.services.kingdee_production_report_push_service import (
            TARGET_TYPE,
        )

        svc = KingdeeProductionReportPushService()
        config = await svc._get_push_config(tenant_id)
        code = str(connection_code or "").strip()
        api_uuid = str(save_api_uuid or "").strip()
        if code or api_uuid:
            config = {
                **config,
                **({"connection_code": code} if code else {}),
                **({"save_api_uuid": api_uuid} if api_uuid else {}),
                "enabled": True,
            }
        if not bool(config.get("enabled", False)):
            return {
                "success": False,
                "message": "金蝶生产汇报单推送未启用",
                "source_type": "reporting_record",
                "source_id": record_id,
                "target_profile": RPT_KD_PROFILE,
            }

        record = await ReportingRecord.get_or_none(
            tenant_id=tenant_id,
            id=record_id,
            deleted_at__isnull=True,
        )
        if not record:
            return {
                "success": False,
                "message": "报工记录不存在",
                "source_type": "reporting_record",
                "source_id": record_id,
                "target_profile": RPT_KD_PROFILE,
            }
        if record.status != "approved" and not dry_run:
            return {
                "success": False,
                "message": "仅已审核报工可推送",
                "source_type": "reporting_record",
                "source_id": record_id,
                "target_profile": RPT_KD_PROFILE,
            }

        if not dry_run and await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="reporting_record",
            source_id=record_id,
            target_type=TARGET_TYPE,
        ).exists():
            await svc._record_push_success(record=record)
            return {
                "success": True,
                "skipped": True,
                "message": "已推送过金蝶生产汇报单",
                "source_type": "reporting_record",
                "source_id": record_id,
                "target_profile": RPT_KD_PROFILE,
            }

        try:
            result = await svc._push_now(
                tenant_id=tenant_id,
                record=record,
                acting_user_id=acting_user_id,
                config=config,
                dry_run=dry_run,
            )
            if not dry_run:
                await svc._record_push_success(record=record)
            return result
        except Exception as exc:
            if not dry_run:
                await svc._record_push_failure(
                    tenant_id=tenant_id, record=record, error=str(exc)
                )
            if bool(config.get("fail_on_error", False)):
                from infra.exceptions.exceptions import BusinessLogicError

                raise BusinessLogicError(f"推送金蝶生产汇报单失败：{exc}") from exc
            return {
                "success": False,
                "message": str(exc),
                "source_type": "reporting_record",
                "source_id": record_id,
                "target_profile": RPT_KD_PROFILE,
            }

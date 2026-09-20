"""通用外推门面：按 source_type + target_profile 分发到业务适配。

与「系统内下推」document_push_pull 无关；本模块只推外部系统。

P2：支持多目标 fan-out（target_profiles / target_profile=*）。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple

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
        if source_type == "work_order" and target_profile == WO_KD_PROFILE:
            result = await KingdeeProductionOrderPushService().push_work_order(
                tenant_id=tenant_id,
                work_order_id=int(source_id),
                acting_user_id=acting_user_id,
                connection_code=connection_code,
                save_api_uuid=save_api_uuid,
                dry_run=dry_run,
            )
            if result is None:
                return {
                    "success": False,
                    "message": "推送未启用或工单不存在",
                    "source_type": source_type,
                    "source_id": int(source_id),
                    "target_profile": target_profile,
                }
            return result

        if source_type == "work_order" and target_profile == WO_OA_PROFILE:
            result = await OaDocumentPushService().push_work_order(
                tenant_id=tenant_id,
                work_order_id=int(source_id),
                acting_user_id=acting_user_id,
                connection_code=connection_code,
                save_api_uuid=save_api_uuid,
                dry_run=dry_run,
            )
            if result is None:
                return {
                    "success": False,
                    "message": "OA 推送未启用或工单不存在",
                    "source_type": source_type,
                    "source_id": int(source_id),
                    "target_profile": target_profile,
                }
            return result

        if source_type == "work_order" and target_profile == WO_FEISHU_PROFILE:
            result = await FeishuWorkOrderPushService().push_work_order(
                tenant_id=tenant_id,
                work_order_id=int(source_id),
                acting_user_id=acting_user_id,
                connection_code=connection_code,
                save_api_uuid=save_api_uuid,
                dry_run=dry_run,
            )
            if result is None:
                return {
                    "success": False,
                    "message": "飞书推送未启用或工单不存在",
                    "source_type": source_type,
                    "source_id": int(source_id),
                    "target_profile": target_profile,
                }
            return result

        if source_type == "reporting_record" and target_profile == RPT_KD_PROFILE:
            return await self._push_reporting(
                tenant_id=tenant_id,
                record_id=int(source_id),
                acting_user_id=acting_user_id,
                connection_code=connection_code,
                save_api_uuid=save_api_uuid,
                dry_run=dry_run,
            )

        if source_type == "sales_order" and target_profile == SO_KD_PROFILE:
            result = await KingdeeSalesOrderPushService().push_sales_order(
                tenant_id=tenant_id,
                sales_order_id=int(source_id),
                acting_user_id=acting_user_id,
                connection_code=connection_code,
                save_api_uuid=save_api_uuid,
                dry_run=dry_run,
            )
            if result is None:
                return {
                    "success": False,
                    "message": "金蝶销售订单推送未启用或订单不存在",
                    "source_type": source_type,
                    "source_id": int(source_id),
                    "target_profile": target_profile,
                }
            return result

        if source_type == "purchase_order" and target_profile == PO_KD_PROFILE:
            result = await KingdeePurchaseOrderPushService().push_purchase_order(
                tenant_id=tenant_id,
                purchase_order_id=int(source_id),
                acting_user_id=acting_user_id,
                connection_code=connection_code,
                save_api_uuid=save_api_uuid,
                dry_run=dry_run,
            )
            if result is None:
                return {
                    "success": False,
                    "message": "金蝶采购订单推送未启用或订单不存在",
                    "source_type": source_type,
                    "source_id": int(source_id),
                    "target_profile": target_profile,
                }
            return result

        if source_type == "material_batch" and target_profile == INV_KD_PROFILE:
            result = await KingdeeInventoryPushService().push_material_batch(
                tenant_id=tenant_id,
                material_batch_id=int(source_id),
                acting_user_id=acting_user_id,
                connection_code=connection_code,
                save_api_uuid=save_api_uuid,
                dry_run=dry_run,
            )
            if result is None:
                return {
                    "success": False,
                    "message": "金蝶即时库存推送未启用或批次不存在",
                    "source_type": source_type,
                    "source_id": int(source_id),
                    "target_profile": target_profile,
                }
            return result

        raise ValidationError(f"未实现的推送适配: {source_type}/{target_profile}")

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
        """报工适配：支持 dry_run / 连接覆盖（审核通过自动推仍走原入口）。"""
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
            return {
                "success": True,
                "skipped": True,
                "message": "已推送过金蝶生产汇报单",
                "source_type": "reporting_record",
                "source_id": record_id,
                "target_profile": RPT_KD_PROFILE,
            }

        return await svc._push_now(
            tenant_id=tenant_id,
            record=record,
            acting_user_id=acting_user_id,
            config=config,
            dry_run=dry_run,
        )

"""固定资产服务。"""

from __future__ import annotations

from typing import Any, Optional

from apps.kuaioa.models.asset import KuaioaAsset, KuaioaAssetPurchase
from apps.kuaioa.schemas.asset import AssetCreate, AssetPurchaseCreate, AssetPurchaseUpdate, AssetUpdate
from apps.kuaioa.services.approval_helper import (
    AUDIT_NODE_ASSET_PURCHASE,
    cancel_approval,
    enrich_with_approval,
    is_audit_required,
    start_approval,
)
from apps.kuaioa.services.kuaioa_list_core import (
    build_keyword_q,
    generate_daily_code,
    model_to_dict,
    parse_optional_date,
    touch_updated,
)
from core.utils.timezone_utils import resolve_business_datetime, to_site_date
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User


class AssetPurchaseService:
    async def list_purchases(
        self, tenant_id: int, *, keyword: Optional[str] = None, status: Optional[str] = None
    ) -> list[dict[str, Any]]:
        q = KuaioaAssetPurchase.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            q = q.filter(status=status)
        if keyword:
            q = q.filter(build_keyword_q(keyword, "purchase_code", "title", "applicant_name"))
        rows = await q.order_by("-created_at", "-id")
        result = []
        for row in rows:
            item = model_to_dict(row)
            await enrich_with_approval(item, tenant_id, "kuaioa_asset_purchase")
            result.append(item)
        return result

    async def get_purchase(self, tenant_id: int, purchase_id: int) -> dict[str, Any]:
        row = await KuaioaAssetPurchase.get_or_none(
            id=purchase_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("采买申请不存在")
        item = model_to_dict(row)
        return await enrich_with_approval(item, tenant_id, "kuaioa_asset_purchase")

    async def create_purchase(
        self, tenant_id: int, data: AssetPurchaseCreate, user: User
    ) -> dict[str, Any]:
        purchase_code = await generate_daily_code(
            KuaioaAssetPurchase, tenant_id, "AP", code_field="purchase_code"
        )
        row = await KuaioaAssetPurchase.create(
            tenant_id=tenant_id,
            purchase_code=purchase_code,
            title=data.title.strip(),
            asset_category=data.asset_category,
            quantity=data.quantity,
            estimated_amount=data.estimated_amount,
            currency=data.currency,
            applicant_id=user.id,
            applicant_name=getattr(user, "name", None) or getattr(user, "username", None),
            department_name=data.department_name,
            purpose=data.purpose,
            status="draft",
            created_by=user.id,
            updated_by=user.id,
        )
        return model_to_dict(row)

    async def update_purchase(
        self, tenant_id: int, purchase_id: int, data: AssetPurchaseUpdate, user_id: int
    ) -> dict[str, Any]:
        row = await KuaioaAssetPurchase.get_or_none(
            id=purchase_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("采买申请不存在")
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("当前状态不可编辑")
        payload = data.model_dump(exclude_unset=True)
        for key, value in payload.items():
            setattr(row, key, value)
        touch_updated(row, user_id)
        await row.save()
        return model_to_dict(row)

    async def delete_purchase(self, tenant_id: int, purchase_id: int, user_id: int) -> None:
        row = await KuaioaAssetPurchase.get_or_none(
            id=purchase_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("采买申请不存在")
        if row.status not in {"draft", "cancelled"}:
            raise BusinessLogicError("仅草稿或已撤销状态可删除")
        row.deleted_at = resolve_business_datetime()
        touch_updated(row, user_id)
        await row.save()

    async def submit_purchase(
        self, tenant_id: int, purchase_id: int, user_id: int
    ) -> dict[str, Any]:
        row = await KuaioaAssetPurchase.get_or_none(
            id=purchase_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("采买申请不存在")
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("当前状态不可提交")
        row.status = "pending"
        row.submitted_at = resolve_business_datetime()
        touch_updated(row, user_id)
        await row.save()
        if await is_audit_required(tenant_id, AUDIT_NODE_ASSET_PURCHASE):
            await start_approval(
                tenant_id,
                node_key=AUDIT_NODE_ASSET_PURCHASE,
                entity_type="kuaioa_asset_purchase",
                entity_id=int(row.id),
                entity_uuid=str(row.uuid),
                title=f"固定资产采买: {row.title}",
                content=row.purpose or row.title,
                submitter_id=user_id,
            )
        else:
            row.status = "approved"
            touch_updated(row, user_id)
            await row.save()
        return await self.get_purchase(tenant_id, purchase_id)

    async def revoke_purchase(
        self, tenant_id: int, purchase_id: int, user_id: int
    ) -> dict[str, Any]:
        row = await KuaioaAssetPurchase.get_or_none(
            id=purchase_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("采买申请不存在")
        if row.status != "pending":
            raise BusinessLogicError("仅待审批状态可撤销")
        row.status = "cancelled"
        touch_updated(row, user_id)
        await row.save()
        await cancel_approval(
            tenant_id,
            entity_type="kuaioa_asset_purchase",
            entity_id=int(row.id),
            operator_id=user_id,
        )
        return model_to_dict(row)

    async def register_asset_from_purchase(
        self, tenant_id: int, purchase_id: int, user_id: int
    ) -> dict[str, Any]:
        purchase = await KuaioaAssetPurchase.get_or_none(
            id=purchase_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not purchase:
            raise NotFoundError("采买申请不存在")
        if purchase.status != "approved":
            raise BusinessLogicError("仅已批准的采买申请可建卡")
        asset_service = AssetRegistryService()
        return await asset_service.create_asset(
            tenant_id,
            AssetCreate(
                asset_name=purchase.title,
                asset_category=purchase.asset_category,
                purchase_id=purchase.id,
                purchase_amount=purchase.estimated_amount,
                purchase_date=to_site_date(resolve_business_datetime()).isoformat(),
                custodian_id=purchase.applicant_id,
                custodian_name=purchase.applicant_name,
                department_name=purchase.department_name,
            ),
            user_id,
        )


class AssetRegistryService:
    async def list_assets(
        self, tenant_id: int, *, keyword: Optional[str] = None, status: Optional[str] = None
    ) -> list[dict[str, Any]]:
        q = KuaioaAsset.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            q = q.filter(status=status)
        if keyword:
            q = q.filter(build_keyword_q(keyword, "asset_code", "asset_name", "custodian_name"))
        rows = await q.order_by("-created_at", "-id")
        return [model_to_dict(row) for row in rows]

    async def get_asset(self, tenant_id: int, asset_id: int) -> dict[str, Any]:
        row = await KuaioaAsset.get_or_none(
            id=asset_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("固定资产不存在")
        return model_to_dict(row)

    async def create_asset(
        self, tenant_id: int, data: AssetCreate, user_id: int
    ) -> dict[str, Any]:
        asset_code = await generate_daily_code(
            KuaioaAsset, tenant_id, "FA", code_field="asset_code"
        )
        row = await KuaioaAsset.create(
            tenant_id=tenant_id,
            asset_code=asset_code,
            asset_name=data.asset_name.strip(),
            asset_category=data.asset_category,
            purchase_id=data.purchase_id,
            purchase_amount=data.purchase_amount,
            purchase_date=parse_optional_date(data.purchase_date),
            custodian_id=data.custodian_id,
            custodian_name=data.custodian_name,
            department_name=data.department_name,
            location=data.location,
            notes=data.notes,
            status="in_stock",
            created_by=user_id,
            updated_by=user_id,
        )
        return model_to_dict(row)

    async def update_asset(
        self, tenant_id: int, asset_id: int, data: AssetUpdate, user_id: int
    ) -> dict[str, Any]:
        row = await KuaioaAsset.get_or_none(
            id=asset_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("固定资产不存在")
        payload = data.model_dump(exclude_unset=True)
        if "purchase_date" in payload:
            payload["purchase_date"] = parse_optional_date(payload["purchase_date"])
        for key, value in payload.items():
            setattr(row, key, value)
        touch_updated(row, user_id)
        await row.save()
        return model_to_dict(row)

    async def delete_asset(self, tenant_id: int, asset_id: int, user_id: int) -> None:
        row = await KuaioaAsset.get_or_none(
            id=asset_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("固定资产不存在")
        row.deleted_at = resolve_business_datetime()
        touch_updated(row, user_id)
        await row.save()

    async def assign_asset(
        self, tenant_id: int, asset_id: int, *, custodian_id: int, custodian_name: str, user_id: int
    ) -> dict[str, Any]:
        row = await KuaioaAsset.get_or_none(
            id=asset_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("固定资产不存在")
        row.custodian_id = custodian_id
        row.custodian_name = custodian_name
        row.status = "in_use"
        touch_updated(row, user_id)
        await row.save()
        return model_to_dict(row)

    async def return_asset(self, tenant_id: int, asset_id: int, user_id: int) -> dict[str, Any]:
        row = await KuaioaAsset.get_or_none(
            id=asset_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("固定资产不存在")
        row.status = "in_stock"
        touch_updated(row, user_id)
        await row.save()
        return model_to_dict(row)

    async def scrap_asset(self, tenant_id: int, asset_id: int, user_id: int) -> dict[str, Any]:
        row = await KuaioaAsset.get_or_none(
            id=asset_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("固定资产不存在")
        row.status = "scrapped"
        touch_updated(row, user_id)
        await row.save()
        return model_to_dict(row)


async def apply_asset_purchase_decision(
    tenant_id: int, purchase_id: int, approved: bool, user_id: int
) -> None:
    row = await KuaioaAssetPurchase.get_or_none(
        id=purchase_id, tenant_id=tenant_id, deleted_at__isnull=True
    )
    if not row:
        return
    row.status = "approved" if approved else "rejected"
    touch_updated(row, user_id)
    await row.save()

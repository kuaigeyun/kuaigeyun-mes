"""装机档案（保修卡）服务"""

from __future__ import annotations

import calendar
import uuid
from datetime import datetime
from typing import List, Optional, Sequence

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaizhizao.models.after_sales_service import ServiceAsset
from apps.kuaizhizao.models.install_execution_job import InstallExecutionJob
from apps.kuaizhizao.schemas.after_sales_service import (
    SERVICE_ASSET_STATUSES,
    ServiceAssetCreate,
    ServiceAssetListEnvelope,
    ServiceAssetResponse,
    ServiceAssetUpdate,
)
from apps.master_data.models.customer import Customer
from apps.master_data.models.material import Material
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

DEFAULT_WARRANTY_MONTHS = 12


class ServiceAssetService:
    @staticmethod
    def _gen_asset_code() -> str:
        return f"ZJDA{today_site_str()}{uuid.uuid4().hex[:6].upper()}"

    @staticmethod
    def _add_months(dt: datetime, months: int) -> datetime:
        month_index = dt.month - 1 + months
        year = dt.year + month_index // 12
        month = month_index % 12 + 1
        day = min(dt.day, calendar.monthrange(year, month)[1])
        return dt.replace(year=year, month=month, day=day)

    @staticmethod
    def _validate_status(value: str) -> str:
        v = (value or "").strip()
        if v not in SERVICE_ASSET_STATUSES:
            raise ValidationError(f"无效的状态: {value}")
        return v

    @classmethod
    async def _load_customer(cls, tenant_id: int, customer_id: int) -> Customer:
        customer = await Customer.filter(
            id=customer_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not customer:
            raise NotFoundError(f"客户不存在: {customer_id}")
        return customer

    @classmethod
    async def _resolve_material(
        cls,
        tenant_id: int,
        material_id: Optional[int],
        *,
        material_code: Optional[str] = None,
        material_name: Optional[str] = None,
        material_spec: Optional[str] = None,
    ) -> tuple[Optional[int], Optional[str], Optional[str], Optional[str]]:
        if material_id is None:
            return None, material_code, material_name, material_spec
        mat = await Material.filter(
            id=material_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not mat:
            raise ValidationError(f"物料不存在: {material_id}")
        return (
            mat.id,
            material_code or mat.main_code or mat.code,
            material_name or mat.name,
            material_spec or mat.specification,
        )

    @classmethod
    async def _to_response(cls, row: ServiceAsset) -> ServiceAssetResponse:
        return ServiceAssetResponse.model_validate(row)

    @classmethod
    async def create(
        cls,
        tenant_id: int,
        data: ServiceAssetCreate,
        current_user: User,
    ) -> ServiceAssetResponse:
        customer = await cls._load_customer(tenant_id, data.customer_id)
        mid, mcode, mname, mspec = await cls._resolve_material(
            tenant_id,
            data.material_id,
            material_code=data.material_code,
            material_name=data.material_name,
            material_spec=data.material_spec,
        )
        status = cls._validate_status(data.status or "在用")
        accepted_at = resolve_business_datetime(data.accepted_at) if data.accepted_at else None
        warranty_start = resolve_business_datetime(data.warranty_start_at) if data.warranty_start_at else accepted_at
        warranty_end = resolve_business_datetime(data.warranty_end_at) if data.warranty_end_at else None
        warranty_months = data.warranty_months
        if warranty_start and warranty_months and not warranty_end:
            warranty_end = cls._add_months(warranty_start, warranty_months)

        from apps.kuaizhizao.models.sales_order import SalesOrder
        from apps.kuaizhizao.models.sales_delivery import SalesDelivery

        so_id, so_code = None, None
        if data.sales_order_id:
            so = await SalesOrder.filter(
                id=data.sales_order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if not so:
                raise ValidationError(f"销售订单不存在: {data.sales_order_id}")
            so_id, so_code = so.id, so.order_code

        sd_id, sd_code = None, None
        if data.sales_delivery_id:
            sd = await SalesDelivery.filter(
                id=data.sales_delivery_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if not sd:
                raise ValidationError(f"销售出库单不存在: {data.sales_delivery_id}")
            sd_id, sd_code = sd.id, sd.delivery_code

        ie_id, ie_code = None, None
        if data.install_execution_id:
            ie = await InstallExecutionJob.filter(
                id=data.install_execution_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if not ie:
                raise ValidationError(f"安装执行单不存在: {data.install_execution_id}")
            ie_id, ie_code = ie.id, ie.job_code

        payload = {
            "tenant_id": tenant_id,
            "asset_code": cls._gen_asset_code(),
            "customer_id": customer.id,
            "customer_name": customer.name,
            "material_id": mid,
            "material_code": mcode,
            "material_name": mname,
            "material_spec": mspec,
            "serial_number": (data.serial_number or "").strip() or None,
            "sales_order_id": so_id,
            "sales_order_code": so_code,
            "sales_delivery_id": sd_id,
            "sales_delivery_code": sd_code,
            "install_execution_id": ie_id,
            "install_execution_code": ie_code,
            "install_address": (data.install_address or "").strip() or None,
            "accepted_at": accepted_at,
            "warranty_start_at": warranty_start,
            "warranty_end_at": warranty_end,
            "warranty_months": warranty_months,
            "warranty_policy": (data.warranty_policy or "").strip() or None,
            "status": status,
            "notes": (data.notes or "").strip() or None,
        }
        apply_create_audit(payload, current_user)
        row = await ServiceAsset.create(**payload)
        return await cls._to_response(row)

    @classmethod
    async def create_from_install_execution(
        cls,
        tenant_id: int,
        job: InstallExecutionJob,
        current_user: User,
        *,
        warranty_months: int = DEFAULT_WARRANTY_MONTHS,
    ) -> ServiceAssetResponse:
        existing = await ServiceAsset.filter(
            tenant_id=tenant_id,
            install_execution_id=job.id,
            deleted_at__isnull=True,
        ).first()
        if existing:
            return await cls._to_response(existing)

        accepted_at = resolve_business_datetime(job.closed_at) if job.closed_at else resolve_business_datetime()
        warranty_start = accepted_at
        warranty_end = cls._add_months(warranty_start, warranty_months)

        return await cls.create(
            tenant_id,
            ServiceAssetCreate(
                customer_id=job.customer_id,
                sales_order_id=job.sales_order_id,
                sales_delivery_id=job.sales_delivery_id,
                install_execution_id=job.id,
                install_address=job.site_address,
                accepted_at=accepted_at,
                warranty_start_at=warranty_start,
                warranty_end_at=warranty_end,
                warranty_months=warranty_months,
                warranty_policy="标准保修",
                status="在用",
                notes=f"由安装执行单 {job.job_code} 关闭时自动建档",
            ),
            current_user,
        )

    @classmethod
    async def get(cls, tenant_id: int, asset_id: int) -> ServiceAssetResponse:
        row = await ServiceAsset.filter(
            id=asset_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"装机档案不存在: {asset_id}")
        return await cls._to_response(row)

    @classmethod
    async def list_assets(
        cls,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        customer_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> ServiceAssetListEnvelope:
        query = ServiceAsset.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if customer_id is not None:
            query = query.filter(customer_id=customer_id)
        if status:
            query = query.filter(status=status.strip())
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(asset_code__icontains=kw)
                    | Q(customer_name__icontains=kw)
                    | Q(serial_number__icontains=kw)
                    | Q(material_code__icontains=kw)
                    | Q(material_name__icontains=kw)
                )
        total = await query.count()
        rows = await query.order_by("-created_at", "-id").offset(skip).limit(limit)
        return ServiceAssetListEnvelope(
            items=[await cls._to_response(r) for r in rows],
            total=total,
        )

    @classmethod
    async def update(
        cls,
        tenant_id: int,
        asset_id: int,
        data: ServiceAssetUpdate,
        current_user: User,
    ) -> ServiceAssetResponse:
        row = await ServiceAsset.filter(
            id=asset_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"装机档案不存在: {asset_id}")

        dump = data.model_dump(exclude_unset=True)
        if "status" in dump and dump["status"] is not None:
            dump["status"] = cls._validate_status(dump["status"])
        if "material_id" in dump:
            mid, mcode, mname, mspec = await cls._resolve_material(
                tenant_id,
                dump.get("material_id"),
                material_code=dump.get("material_code"),
                material_name=dump.get("material_name"),
                material_spec=dump.get("material_spec"),
            )
            dump["material_id"] = mid
            dump["material_code"] = mcode
            dump["material_name"] = mname
            dump["material_spec"] = mspec
        for field in ("accepted_at", "warranty_start_at", "warranty_end_at"):
            if field in dump and dump[field] is not None:
                dump[field] = resolve_business_datetime(dump[field])
        if "serial_number" in dump:
            dump["serial_number"] = (dump["serial_number"] or "").strip() or None
        if "install_address" in dump:
            dump["install_address"] = (dump["install_address"] or "").strip() or None
        if "notes" in dump:
            dump["notes"] = (dump["notes"] or "").strip() or None

        if dump:
            apply_update_audit(dump, current_user)
            await ServiceAsset.filter(id=asset_id, tenant_id=tenant_id).update(**dump)
        row = await ServiceAsset.get(id=asset_id, tenant_id=tenant_id)
        return await cls._to_response(row)

    @classmethod
    async def delete(cls, tenant_id: int, asset_id: int, current_user: User) -> None:
        row = await ServiceAsset.filter(
            id=asset_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"装机档案不存在: {asset_id}")
        dump = {"deleted_at": resolve_business_datetime()}
        apply_update_audit(dump, current_user)
        await ServiceAsset.filter(id=asset_id, tenant_id=tenant_id).update(**dump)

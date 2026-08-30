"""外部主数据 / 单据定时同步调度。"""



from __future__ import annotations



from datetime import timedelta

from typing import Any, Optional, Type



from loguru import logger



from infra.models.user import User



from apps.kuaizhizao.models.purchase_order_sync_binding import PurchaseOrderSyncBinding

from apps.kuaizhizao.models.sales_order_sync_binding import SalesOrderSyncBinding

from apps.kuaizhizao.models.work_order_sync_binding import WorkOrderSyncBinding

from apps.kuaizhizao.schemas.purchase_order_sync import PurchaseOrderSyncFromSourceRequest

from apps.kuaizhizao.schemas.sales_order_sync import SalesOrderSyncFromSourceRequest

from apps.kuaizhizao.schemas.work_order_sync import WorkOrderSyncFromSourceRequest

from apps.kuaizhizao.services.purchase_order_sync_service import PurchaseOrderSyncService

from apps.kuaizhizao.services.sales_order_sync_service import SalesOrderSyncService

from apps.kuaizhizao.services.work_order_sync_service import WorkOrderSyncService

from apps.master_data.models.master_data_sync_binding import (

    CustomerSyncBinding,

    MaterialGroupSyncBinding,

    MaterialSyncBinding,

    MaterialUnitSyncBinding,

    SupplierSyncBinding,

    WarehouseSyncBinding,

)

from apps.master_data.schemas.master_data_sync import MasterDataSyncFromSourceRequest

from apps.master_data.services.customer_sync_service import CustomerSyncService

from apps.master_data.services.material_group_sync_service import MaterialGroupSyncService

from apps.master_data.services.material_sync_service import MaterialSyncService

from apps.master_data.services.supplier_sync_service import SupplierSyncService

from apps.master_data.services.unit_sync_service import MaterialUnitSyncService

from apps.master_data.services.warehouse_sync_service import WarehouseSyncService

from core.utils.timezone_utils import resolve_business_datetime



SCHEDULED_MODES = ("scheduled_full", "scheduled_incremental")





def _due(binding: Any) -> bool:

    mode = (getattr(binding, "sync_mode", None) or "").strip()

    if mode not in SCHEDULED_MODES:

        return False

    if not (getattr(binding, "source_type", None) or "").strip():

        return False

    interval = int(getattr(binding, "schedule_interval_minutes", None) or 15)

    last = getattr(binding, "last_success_at", None) or getattr(binding, "last_attempt_at", None)

    if last is None:

        return True

    now = resolve_business_datetime()

    return now >= last + timedelta(minutes=interval)





async def _resolve_actor(tenant_id: int, binding: Any) -> Optional[User]:

    for attr in ("updated_by", "created_by"):

        uid = getattr(binding, attr, None)

        if uid:

            user = await User.filter(id=uid, tenant_id=tenant_id, deleted_at__isnull=True).first()

            if user:

                return user

    return await User.filter(tenant_id=tenant_id, is_active=True, deleted_at__isnull=True).order_by("id").first()





class ExternalSyncSchedulerService:

    """按依赖序扫描定时绑定并执行增量/全量同步。"""



    @classmethod

    async def run_due_syncs(cls) -> dict[str, int]:

        stats = {

            "tenants": 0,

            "unit": 0,

            "group": 0,

            "material": 0,

            "customer": 0,

            "supplier": 0,

            "warehouse": 0,

            "sales_order": 0,

            "purchase_order": 0,

            "work_order": 0,

            "errors": 0,

        }

        tenant_ids = set()

        for model in (

            MaterialUnitSyncBinding,

            MaterialGroupSyncBinding,

            MaterialSyncBinding,

            CustomerSyncBinding,

            SupplierSyncBinding,

            WarehouseSyncBinding,

            SalesOrderSyncBinding,

            PurchaseOrderSyncBinding,

            WorkOrderSyncBinding,

        ):

            rows = await model.filter(sync_mode__in=list(SCHEDULED_MODES)).all()

            for row in rows:

                tenant_ids.add(row.tenant_id)



        for tenant_id in sorted(tenant_ids):

            stats["tenants"] += 1

            await cls._run_tenant(tenant_id, stats)

        return stats



    @classmethod

    async def _run_tenant(cls, tenant_id: int, stats: dict[str, int]) -> None:

        # 单位 → 分组 → 物料 → 客户 → 供应商 → 仓库 → 销售订单 → 采购订单 → 生产工单

        await cls._run_master(

            tenant_id,

            MaterialUnitSyncBinding,

            MaterialUnitSyncService(),

            "unit",

            stats,

            require_user=False,

        )

        await cls._run_master(

            tenant_id,

            MaterialGroupSyncBinding,

            MaterialGroupSyncService(),

            "group",

            stats,

            require_user=False,

        )

        await cls._run_master(

            tenant_id,

            MaterialSyncBinding,

            MaterialSyncService(),

            "material",

            stats,

            require_user=False,

            skip_prerequisite=True,

        )

        await cls._run_master(

            tenant_id,

            CustomerSyncBinding,

            CustomerSyncService(),

            "customer",

            stats,

            require_user=True,

        )

        await cls._run_master(

            tenant_id,

            SupplierSyncBinding,

            SupplierSyncService(),

            "supplier",

            stats,

            require_user=True,

        )

        await cls._run_master(

            tenant_id,

            WarehouseSyncBinding,

            WarehouseSyncService(),

            "warehouse",

            stats,

            require_user=True,

        )

        await cls._run_sales_order(tenant_id, stats)

        await cls._run_purchase_order(tenant_id, stats)

        await cls._run_work_order(tenant_id, stats)



    @classmethod

    async def _run_master(

        cls,

        tenant_id: int,

        binding_model: Type[Any],

        service: Any,

        key: str,

        stats: dict[str, int],

        *,

        require_user: bool,

        skip_prerequisite: bool = False,

    ) -> None:

        binding = await binding_model.filter(tenant_id=tenant_id).first()

        if not binding or not _due(binding):

            return

        actor = await _resolve_actor(tenant_id, binding)

        if require_user and actor is None:

            logger.warning("external sync skip tenant={} entity={}: no actor user", tenant_id, key)

            stats["errors"] += 1

            return

        incremental = (binding.sync_mode or "") == "scheduled_incremental"

        try:

            kwargs: dict[str, Any] = {

                "request": MasterDataSyncFromSourceRequest(

                    incremental=incremental if incremental else False,

                    skip_prerequisite_syncs=skip_prerequisite,

                ),

            }

            if skip_prerequisite:

                result = await service.sync_from_source(

                    tenant_id,

                    actor,

                    kwargs["request"],

                    skip_prerequisite_syncs=True,

                )

            else:

                result = await service.sync_from_source(tenant_id, actor, kwargs["request"])

            stats[key] += 1

            logger.info(

                "external sync ok tenant={} entity={} created={} updated={} failed={}",

                tenant_id,

                key,

                result.created,

                result.updated,

                result.failed,

            )

        except Exception as exc:

            stats["errors"] += 1

            logger.warning("external sync failed tenant={} entity={}: {}", tenant_id, key, exc)



    @classmethod

    async def _run_sales_order(cls, tenant_id: int, stats: dict[str, int]) -> None:

        binding = await SalesOrderSyncBinding.filter(tenant_id=tenant_id).first()

        if not binding or not _due(binding):

            return

        actor = await _resolve_actor(tenant_id, binding)

        if actor is None:

            logger.warning("external sync skip tenant={} entity=sales_order: no actor user", tenant_id)

            stats["errors"] += 1

            return

        incremental = (binding.sync_mode or "") == "scheduled_incremental"

        try:

            result = await SalesOrderSyncService().sync_from_source(

                tenant_id,

                int(actor.id),

                SalesOrderSyncFromSourceRequest(

                    incremental=incremental if incremental else False,

                    skip_prerequisite_syncs=True,

                ),

            )

            stats["sales_order"] += 1

            logger.info(

                "external sync ok tenant={} entity=sales_order created={} updated={} failed={}",

                tenant_id,

                result.created,

                result.updated,

                result.failed,

            )

        except Exception as exc:

            stats["errors"] += 1

            logger.warning("external sync failed tenant={} entity=sales_order: {}", tenant_id, exc)



    @classmethod

    async def _run_purchase_order(cls, tenant_id: int, stats: dict[str, int]) -> None:

        binding = await PurchaseOrderSyncBinding.filter(tenant_id=tenant_id).first()

        if not binding or not _due(binding):

            return

        actor = await _resolve_actor(tenant_id, binding)

        if actor is None:

            logger.warning("external sync skip tenant={} entity=purchase_order: no actor user", tenant_id)

            stats["errors"] += 1

            return

        incremental = (binding.sync_mode or "") == "scheduled_incremental"

        try:

            result = await PurchaseOrderSyncService().sync_from_source(

                tenant_id,

                int(actor.id),

                PurchaseOrderSyncFromSourceRequest(

                    incremental=incremental if incremental else False,

                    skip_prerequisite_syncs=True,

                ),

            )

            stats["purchase_order"] += 1

            logger.info(

                "external sync ok tenant={} entity=purchase_order created={} updated={} failed={}",

                tenant_id,

                result.created,

                result.updated,

                result.failed,

            )

        except Exception as exc:

            stats["errors"] += 1

            logger.warning("external sync failed tenant={} entity=purchase_order: {}", tenant_id, exc)



    @classmethod

    async def _run_work_order(cls, tenant_id: int, stats: dict[str, int]) -> None:

        binding = await WorkOrderSyncBinding.filter(tenant_id=tenant_id).first()

        if not binding or not _due(binding):

            return

        actor = await _resolve_actor(tenant_id, binding)

        if actor is None:

            logger.warning("external sync skip tenant={} entity=work_order: no actor user", tenant_id)

            stats["errors"] += 1

            return

        incremental = (binding.sync_mode or "") == "scheduled_incremental"

        try:

            result = await WorkOrderSyncService().sync_from_source(

                tenant_id,

                int(actor.id),

                WorkOrderSyncFromSourceRequest(

                    incremental=incremental if incremental else False,

                    skip_prerequisite_syncs=True,

                ),

            )

            stats["work_order"] += 1

            logger.info(

                "external sync ok tenant={} entity=work_order created={} updated={} failed={}",

                tenant_id,

                result.created,

                result.updated,

                result.failed,

            )

        except Exception as exc:

            stats["errors"] += 1

            logger.warning("external sync failed tenant={} entity=work_order: {}", tenant_id, exc)


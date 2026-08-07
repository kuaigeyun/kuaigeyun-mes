"""
安装执行单服务
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import List, Optional, Sequence

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaizhizao.models.install_execution_cost import InstallExecutionCost
from apps.kuaizhizao.models.install_execution_job import InstallExecutionJob
from apps.kuaizhizao.models.install_execution_stage import InstallExecutionStage
from apps.kuaizhizao.models.install_execution_task import InstallExecutionTask
from apps.kuaizhizao.models.packing_binding import PackingBinding
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.schemas.install_execution import (
    COST_TYPES,
    INSTALL_EXECUTION_STAGE_DICT_CODE,
    JOB_STATUSES,
    MAX_TASK_ATTACHMENTS,
    STAGE_STATUSES,
    SUPPLY_SOURCES,
    TASK_STATUSES,
    InstallExecutionAdvanceStage,
    InstallExecutionClose,
    InstallExecutionCostCreate,
    InstallExecutionCreate,
    InstallExecutionListEnvelope,
    InstallExecutionPullFromSalesDeliveryRequest,
    InstallExecutionPullFromSalesOrderRequest,
    InstallExecutionResponse,
    InstallExecutionStageUpdate,
    InstallExecutionTaskCreate,
    InstallExecutionUpdate,
)
from apps.kuaizhizao.services.document_action_policy.install_execution import (
    assert_install_execution_capability,
    derive_install_execution_capabilities,
)
from apps.master_data.models.customer import Customer
from core.services.authorization.data_scope_service import DataScopeService
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User
from loguru import logger

INSTALL_EXECUTION_SORTABLE_FIELDS = frozenset({
    "job_code",
    "customer_name",
    "status",
    "supply_source",
    "total_cost_amount",
    "started_at",
    "closed_at",
    "sales_order_code",
    "created_at",
    "updated_at",
})

RESOURCE_INSTALL_EXECUTION = "kuaizhizao:after-sales-install"
RESOURCE_INSTALL_EXECUTION_CUSTOMER = "kuaizhizao:after-sales-install-customer"


class InstallExecutionService:
    """安装执行业务逻辑"""

    @staticmethod
    def _gen_job_code() -> str:
        return f"AZZX{today_site_str()}{uuid.uuid4().hex[:6].upper()}"

    @staticmethod
    def _validate_supply_source(value: str) -> str:
        v = (value or "").strip()
        if v not in SUPPLY_SOURCES:
            raise ValidationError(f"无效的供给来源: {value}")
        return v

    @staticmethod
    def _validate_job_status(value: str) -> str:
        v = (value or "").strip()
        if v not in JOB_STATUSES:
            raise ValidationError(f"无效的单据状态: {value}")
        return v

    @staticmethod
    def _validate_stage_status(value: str) -> str:
        v = (value or "").strip()
        if v not in STAGE_STATUSES:
            raise ValidationError(f"无效的阶段状态: {value}")
        return v

    @staticmethod
    def _validate_cost_type(value: str) -> str:
        v = (value or "").strip()
        if v not in COST_TYPES:
            raise ValidationError(f"无效的费用类型: {value}")
        return v

    @staticmethod
    def _validate_task_status(value: str) -> str:
        v = (value or "").strip()
        if v not in TASK_STATUSES:
            raise ValidationError(f"无效的任务状态: {value}")
        return v

    @staticmethod
    def _normalize_task_attachments(raw) -> Optional[list]:
        if raw is None:
            return None
        if not isinstance(raw, list):
            raise ValidationError("任务附件格式无效")
        if len(raw) > MAX_TASK_ATTACHMENTS:
            raise ValidationError(f"任务照片最多 {MAX_TASK_ATTACHMENTS} 张")
        normalized: list = []
        for idx, item in enumerate(raw, start=1):
            if isinstance(item, str):
                uid = item.strip()
                if not uid:
                    raise ValidationError(f"第 {idx} 张任务照片无效")
                normalized.append({"uid": uid, "name": f"照片{idx}", "status": "done"})
                continue
            if not isinstance(item, dict):
                raise ValidationError(f"第 {idx} 张任务照片格式无效")
            uid = str(item.get("uid") or item.get("uuid") or item.get("file_uuid") or "").strip()
            if not uid:
                raise ValidationError(f"第 {idx} 张任务照片缺少文件标识")
            normalized.append({
                "uid": uid,
                "name": (item.get("name") or f"照片{idx}"),
                "status": "done",
                "url": item.get("url"),
            })
        return normalized or None

    @staticmethod
    async def _load_customer(
        tenant_id: int,
        customer_id: int,
        current_user: Optional[User],
    ) -> Customer:
        customer = await Customer.filter(
            id=customer_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not customer:
            raise NotFoundError(f"客户不存在: {customer_id}")
        if current_user:
            await DataScopeService.assert_row_visible(
                customer,
                tenant_id=tenant_id,
                user=current_user,
                resource=RESOURCE_INSTALL_EXECUTION_CUSTOMER,
            )
        return customer

    @staticmethod
    async def _apply_list_scope(query, tenant_id: int, current_user: Optional[User]):
        if not current_user:
            return query
        return await DataScopeService.apply(
            query,
            tenant_id=tenant_id,
            user=current_user,
            resource=RESOURCE_INSTALL_EXECUTION,
        )

    @staticmethod
    async def _resolve_sales_order(
        tenant_id: int,
        customer_id: int,
        sales_order_id: Optional[int],
    ) -> tuple[Optional[int], Optional[str]]:
        if sales_order_id is None:
            return None, None
        so = await SalesOrder.filter(
            id=sales_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not so:
            raise ValidationError(f"销售订单不存在: {sales_order_id}")
        if so.customer_id != customer_id:
            raise ValidationError("销售订单不属于所选客户")
        return so.id, so.order_code

    @staticmethod
    async def _resolve_sales_delivery(
        tenant_id: int,
        customer_id: int,
        sales_delivery_id: Optional[int],
    ) -> tuple[Optional[int], Optional[str], Optional[int], Optional[str]]:
        if sales_delivery_id is None:
            return None, None, None, None
        row = await SalesDelivery.filter(
            id=sales_delivery_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise ValidationError(f"销售出库单不存在: {sales_delivery_id}")
        if row.customer_id != customer_id:
            raise ValidationError("销售出库单不属于所选客户")
        return row.id, row.delivery_code, row.sales_order_id, row.sales_order_code

    @staticmethod
    async def _resolve_packing_binding(
        tenant_id: int,
        packing_binding_id: Optional[int],
        sales_delivery_id: Optional[int],
    ) -> Optional[int]:
        if packing_binding_id is None:
            return None
        row = await PackingBinding.filter(
            id=packing_binding_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise ValidationError(f"装箱绑定不存在: {packing_binding_id}")
        if sales_delivery_id and row.sales_delivery_id and row.sales_delivery_id != sales_delivery_id:
            raise ValidationError("装箱绑定与销售出库单不匹配")
        return row.id

    @classmethod
    async def _ensure_source_ref(cls, tenant_id: int, sales_order_id: Optional[int], sales_delivery_id: Optional[int]) -> None:
        if sales_order_id is None and sales_delivery_id is None:
            raise ValidationError("请关联销售订单或销售出库单")

    @classmethod
    async def _stage_catalog(cls, tenant_id: int) -> dict[str, str]:
        from core.services.data.data_dictionary_service import DataDictionaryService

        await DataDictionaryService.ensure_system_dictionary_exists(
            tenant_id, INSTALL_EXECUTION_STAGE_DICT_CODE
        )
        dictionary = await DataDictionaryService.get_dictionary_by_code(
            tenant_id, INSTALL_EXECUTION_STAGE_DICT_CODE
        )
        if not dictionary:
            raise ValidationError("安装阶段数据字典未配置")
        items = await DataDictionaryService.get_items_by_dictionary(
            tenant_id, str(dictionary.uuid), is_active=True
        )
        return {item.value: item.label for item in items}

    @classmethod
    async def _normalize_stages(
        cls,
        tenant_id: int,
        stages: Sequence[InstallExecutionStageUpdate],
    ) -> List[dict]:
        catalog = await cls._stage_catalog(tenant_id)
        normalized: List[dict] = []
        seen: set[str] = set()
        for idx, row in enumerate(stages, start=1):
            stage_key = (row.stage_key or "").strip()
            if not stage_key:
                raise ValidationError(f"第 {idx} 行安装阶段不能为空")
            if stage_key in seen:
                raise ValidationError(f"安装阶段重复: {stage_key}")
            seen.add(stage_key)
            stage_name = catalog.get(stage_key)
            if not stage_name:
                raise ValidationError(f"无效的安装阶段: {stage_key}")
            normalized.append({
                "stage_key": stage_key,
                "stage_name": stage_name,
                "sort_order": idx,
                "status": cls._validate_stage_status(row.status) if row.status else "待开始",
                "planned_at": row.planned_at,
                "actual_at": row.actual_at,
                "notes": (row.notes or "").strip() or None,
            })
        return normalized

    @classmethod
    async def _replace_stages(
        cls,
        tenant_id: int,
        job_id: int,
        stages: Sequence[InstallExecutionStageUpdate],
        current_user: User,
    ) -> List[InstallExecutionStage]:
        normalized = await cls._normalize_stages(tenant_id, stages)
        await InstallExecutionStage.filter(tenant_id=tenant_id, job_id=job_id).delete()
        created: List[InstallExecutionStage] = []
        for row in normalized:
            payload = {"tenant_id": tenant_id, "job_id": job_id, **row}
            apply_create_audit(payload, current_user)
            created.append(await InstallExecutionStage.create(**payload))
        return created

    @classmethod
    async def _normalize_costs(
        cls,
        costs: Sequence[InstallExecutionCostCreate],
    ) -> List[dict]:
        normalized: List[dict] = []
        for idx, row in enumerate(costs, start=1):
            amount = row.amount
            if amount is None or amount < 0:
                raise ValidationError(f"第 {idx} 行费用金额无效")
            normalized.append({
                "line_no": idx,
                "cost_type": cls._validate_cost_type(row.cost_type),
                "amount": amount,
                "occurred_at": row.occurred_at or resolve_business_datetime(),
                "description": (row.description or "").strip() or None,
            })
        return normalized

    @classmethod
    async def _replace_costs(
        cls,
        tenant_id: int,
        job_id: int,
        costs: Sequence[InstallExecutionCostCreate],
        current_user: User,
    ) -> List[InstallExecutionCost]:
        normalized = await cls._normalize_costs(costs)
        await InstallExecutionCost.filter(tenant_id=tenant_id, job_id=job_id).delete()
        created: List[InstallExecutionCost] = []
        for row in normalized:
            payload = {"tenant_id": tenant_id, "job_id": job_id, **row}
            apply_create_audit(payload, current_user)
            created.append(await InstallExecutionCost.create(**payload))
        return created

    @staticmethod
    def _sum_costs(costs: Sequence[InstallExecutionCost]) -> Optional[Decimal]:
        if not costs:
            return None
        total = Decimal("0")
        for row in costs:
            total += Decimal(str(row.amount))
        return total

    @classmethod
    async def _load_stages(cls, tenant_id: int, job_id: int) -> List[InstallExecutionStage]:
        return await InstallExecutionStage.filter(
            tenant_id=tenant_id,
            job_id=job_id,
        ).order_by("sort_order", "id")

    @classmethod
    async def _load_costs(cls, tenant_id: int, job_id: int) -> List[InstallExecutionCost]:
        return await InstallExecutionCost.filter(
            tenant_id=tenant_id,
            job_id=job_id,
        ).order_by("line_no", "id")

    @classmethod
    async def _load_tasks(cls, tenant_id: int, job_id: int) -> List[InstallExecutionTask]:
        return await InstallExecutionTask.filter(
            tenant_id=tenant_id,
            job_id=job_id,
        ).order_by("line_no", "id")

    @classmethod
    def _derive_current_stage_key(cls, stages: Sequence[InstallExecutionStage]) -> Optional[str]:
        in_progress = next((s.stage_key for s in stages if s.status == "进行中"), None)
        if in_progress:
            return in_progress
        pending = next((s.stage_key for s in stages if s.status in {"待开始", "进行中"}), None)
        if pending:
            return pending
        if stages and all(s.status == "已完成" for s in stages):
            return stages[-1].stage_key
        return stages[0].stage_key if stages else None

    @classmethod
    def _derive_job_status_from_stages(cls, stages: Sequence[InstallExecutionStage], current: str) -> str:
        if current == "已关闭":
            return current
        if not stages:
            return current or "待派工"
        if all(s.status == "已完成" for s in stages):
            return "待验收"
        if any(s.status in {"进行中", "已完成"} for s in stages):
            return "进行中"
        return "待派工"

    @classmethod
    async def _to_response(
        cls,
        row: InstallExecutionJob,
        stages: Optional[List[InstallExecutionStage]] = None,
        costs: Optional[List[InstallExecutionCost]] = None,
        tasks: Optional[List[InstallExecutionTask]] = None,
        *,
        include_tasks: bool = False,
    ) -> InstallExecutionResponse:
        if stages is None:
            stages = await cls._load_stages(row.tenant_id, row.id)
        if costs is None:
            costs = await cls._load_costs(row.tenant_id, row.id)
        if include_tasks and tasks is None:
            tasks = await cls._load_tasks(row.tenant_id, row.id)
        caps = derive_install_execution_capabilities(row, stages=stages)
        total = cls._sum_costs(costs)
        base = InstallExecutionResponse.model_validate(row)
        from apps.kuaizhizao.schemas.install_execution import (
            InstallExecutionCostResponse,
            InstallExecutionStageResponse,
            InstallExecutionTaskResponse,
        )

        stage_name_by_key = {s.stage_key: s.stage_name for s in stages}
        task_responses: list = []
        if include_tasks and tasks is not None:
            for task in tasks:
                item = InstallExecutionTaskResponse.model_validate(task)
                task_responses.append(
                    item.model_copy(
                        update={"stage_name": stage_name_by_key.get(task.stage_key)},
                    )
                )

        return base.model_copy(
            update={
                "stages": [InstallExecutionStageResponse.model_validate(s) for s in stages],
                "costs": [InstallExecutionCostResponse.model_validate(c) for c in costs],
                "tasks": task_responses,
                "total_cost_amount": total if total is not None else row.total_cost_amount,
                "capabilities": caps.model_dump(),
            }
        )

    @classmethod
    async def create(
        cls,
        tenant_id: int,
        data: InstallExecutionCreate,
        current_user: User,
    ) -> InstallExecutionResponse:
        customer = await cls._load_customer(tenant_id, data.customer_id, current_user)
        supply_source = cls._validate_supply_source(data.supply_source)
        so_id, so_code = await cls._resolve_sales_order(tenant_id, customer.id, data.sales_order_id)
        sd_id, sd_code, sd_so_id, sd_so_code = await cls._resolve_sales_delivery(
            tenant_id, customer.id, data.sales_delivery_id
        )
        if so_id is None and sd_so_id is not None:
            so_id, so_code = sd_so_id, sd_so_code
        await cls._ensure_source_ref(tenant_id, so_id, sd_id)
        packing_binding_id = await cls._resolve_packing_binding(
            tenant_id, data.packing_binding_id, sd_id
        )

        async with in_transaction():
            payload = {
                "tenant_id": tenant_id,
                "job_code": cls._gen_job_code(),
                "customer_id": customer.id,
                "customer_name": customer.name,
                "sales_order_id": so_id,
                "sales_order_code": so_code,
                "sales_delivery_id": sd_id,
                "sales_delivery_code": sd_code,
                "packing_binding_id": packing_binding_id,
                "supply_source": supply_source,
                "site_address": (data.site_address or "").strip() or None,
                "owner_id": data.owner_id,
                "owner_name": (data.owner_name or "").strip() or None,
                "status": "待派工",
                "notes": (data.notes or "").strip() or None,
            }
            apply_create_audit(payload, current_user)
            job = await InstallExecutionJob.create(**payload)
            stages = await cls._replace_stages(
                tenant_id, job.id, data.stages or [], current_user
            )
            costs = await cls._replace_costs(tenant_id, job.id, data.costs, current_user)
            job.current_stage_key = cls._derive_current_stage_key(stages)
            job.status = cls._derive_job_status_from_stages(stages, job.status)
            job.total_cost_amount = cls._sum_costs(costs)
            if job.status == "进行中" and not job.started_at:
                job.started_at = resolve_business_datetime()
            apply_update_audit(job, current_user)
            await job.save()
        return await cls._to_response(job, include_tasks=True)

    @classmethod
    async def get_by_id(
        cls,
        tenant_id: int,
        job_id: int,
        current_user: Optional[User] = None,
    ) -> InstallExecutionResponse:
        job = await InstallExecutionJob.filter(
            id=job_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not job:
            raise NotFoundError(f"安装执行单不存在: {job_id}")
        if current_user:
            await DataScopeService.assert_row_visible(
                job,
                tenant_id=tenant_id,
                user=current_user,
                resource=RESOURCE_INSTALL_EXECUTION,
            )
        return await cls._to_response(job, include_tasks=True)

    @classmethod
    async def list_jobs(
        cls,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        customer_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        sales_order_code: Optional[str] = None,
        order_by: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> InstallExecutionListEnvelope:
        qs = InstallExecutionJob.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        qs = await cls._apply_list_scope(qs, tenant_id, current_user)
        if customer_id is not None:
            qs = qs.filter(customer_id=customer_id)
        if status:
            qs = qs.filter(status=status.strip())
        if sales_order_code:
            qs = qs.filter(sales_order_code__icontains=sales_order_code.strip())
        if keyword:
            kw = keyword.strip()
            qs = qs.filter(
                Q(job_code__icontains=kw)
                | Q(customer_name__icontains=kw)
                | Q(site_address__icontains=kw)
                | Q(sales_order_code__icontains=kw)
                | Q(sales_delivery_code__icontains=kw)
            )
        total = await qs.count()
        order_field = "-created_at"
        if order_by:
            field = order_by.lstrip("-")
            if field in INSTALL_EXECUTION_SORTABLE_FIELDS:
                order_field = order_by
        rows = await qs.order_by(order_field).offset(skip).limit(limit)
        data = [await cls._to_response(r) for r in rows]
        return InstallExecutionListEnvelope(data=data, total=total, success=True)

    @classmethod
    async def update(
        cls,
        tenant_id: int,
        job_id: int,
        data: InstallExecutionUpdate,
        current_user: User,
    ) -> InstallExecutionResponse:
        job = await InstallExecutionJob.filter(
            id=job_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not job:
            raise NotFoundError(f"安装执行单不存在: {job_id}")
        assert_install_execution_capability(job, "update")

        update_fields: dict = {}
        if data.supply_source is not None:
            update_fields["supply_source"] = cls._validate_supply_source(data.supply_source)
        if data.site_address is not None:
            update_fields["site_address"] = (data.site_address or "").strip() or None
        if data.owner_id is not None:
            update_fields["owner_id"] = data.owner_id
        if data.owner_name is not None:
            update_fields["owner_name"] = (data.owner_name or "").strip() or None
        if data.notes is not None:
            update_fields["notes"] = (data.notes or "").strip() or None
        if data.status is not None:
            update_fields["status"] = cls._validate_job_status(data.status)

        customer_id = job.customer_id
        so_id = job.sales_order_id
        so_code = job.sales_order_code
        sd_id = job.sales_delivery_id
        sd_code = job.sales_delivery_code
        if data.sales_order_id is not None:
            so_id, so_code = await cls._resolve_sales_order(tenant_id, customer_id, data.sales_order_id)
        if data.sales_delivery_id is not None:
            sd_id, sd_code, sd_so_id, sd_so_code = await cls._resolve_sales_delivery(
                tenant_id, customer_id, data.sales_delivery_id
            )
            if so_id is None and sd_so_id is not None:
                so_id, so_code = sd_so_id, sd_so_code
        if data.sales_order_id is not None or data.sales_delivery_id is not None:
            await cls._ensure_source_ref(tenant_id, so_id, sd_id)
            update_fields["sales_order_id"] = so_id
            update_fields["sales_order_code"] = so_code
            update_fields["sales_delivery_id"] = sd_id
            update_fields["sales_delivery_code"] = sd_code
        if data.packing_binding_id is not None:
            update_fields["packing_binding_id"] = await cls._resolve_packing_binding(
                tenant_id, data.packing_binding_id, sd_id
            )

        async with in_transaction():
            if update_fields:
                apply_update_audit(update_fields, current_user)
                await job.update_from_dict(update_fields).save()
            stages = await cls._load_stages(tenant_id, job_id)
            if data.stages is not None:
                stages = await cls._replace_stages(tenant_id, job_id, data.stages, current_user)
            costs = await cls._load_costs(tenant_id, job_id)
            if data.costs is not None:
                costs = await cls._replace_costs(tenant_id, job_id, data.costs, current_user)
            job.current_stage_key = cls._derive_current_stage_key(stages)
            derived_status = cls._derive_job_status_from_stages(stages, job.status)
            if data.status is None:
                job.status = derived_status
            job.total_cost_amount = cls._sum_costs(costs)
            if job.status == "进行中" and not job.started_at:
                job.started_at = resolve_business_datetime()
            apply_update_audit(job, current_user)
            await job.save()
        return await cls.get_by_id(tenant_id, job_id, current_user)

    @classmethod
    async def close(
        cls,
        tenant_id: int,
        job_id: int,
        data: InstallExecutionClose,
        current_user: User,
    ) -> InstallExecutionResponse:
        job = await InstallExecutionJob.filter(
            id=job_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not job:
            raise NotFoundError(f"安装执行单不存在: {job_id}")
        assert_install_execution_capability(job, "close")
        update_fields = {
            "status": "已关闭",
            "closed_at": resolve_business_datetime(),
        }
        if data.notes:
            prev = (job.notes or "").strip()
            extra = data.notes.strip()
            update_fields["notes"] = f"{prev}\n{extra}".strip() if prev else extra
        apply_update_audit(update_fields, current_user)
        await job.update_from_dict(update_fields).save()
        job = await InstallExecutionJob.get(id=job_id, tenant_id=tenant_id)
        from apps.kuaizhizao.services.service_asset_service import ServiceAssetService

        await ServiceAssetService.create_from_install_execution(
            tenant_id,
            job,
            current_user,
        )
        return await cls.get_by_id(tenant_id, job_id, current_user)

    @classmethod
    async def delete(
        cls,
        tenant_id: int,
        job_id: int,
        current_user: User,
    ) -> None:
        job = await InstallExecutionJob.filter(
            id=job_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not job:
            raise NotFoundError(f"安装执行单不存在: {job_id}")
        assert_install_execution_capability(job, "delete")
        update_fields = {"deleted_at": resolve_business_datetime()}
        apply_update_audit(update_fields, current_user)
        await job.update_from_dict(update_fields).save()

    @classmethod
    async def _get_job_or_raise(
        cls,
        tenant_id: int,
        job_id: int,
        current_user: Optional[User] = None,
    ) -> InstallExecutionJob:
        job = await InstallExecutionJob.filter(
            id=job_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not job:
            raise NotFoundError(f"安装执行单不存在: {job_id}")
        if current_user:
            await DataScopeService.assert_row_visible(
                job,
                tenant_id=tenant_id,
                user=current_user,
                resource=RESOURCE_INSTALL_EXECUTION,
            )
        return job

    @classmethod
    async def _validate_task_stage_key(
        cls,
        tenant_id: int,
        job_id: int,
        stage_key: str,
    ) -> str:
        key = (stage_key or "").strip()
        if not key:
            raise ValidationError("任务所属阶段不能为空")
        stages = await cls._load_stages(tenant_id, job_id)
        valid_keys = {s.stage_key for s in stages}
        if valid_keys and key not in valid_keys:
            raise ValidationError(f"无效的安装阶段: {key}")
        if not valid_keys:
            catalog = await cls._stage_catalog(tenant_id)
            if key not in catalog:
                raise ValidationError(f"无效的安装阶段: {key}")
        return key

    @classmethod
    async def _next_task_line_no(cls, tenant_id: int, job_id: int) -> int:
        row = await InstallExecutionTask.filter(
            tenant_id=tenant_id,
            job_id=job_id,
        ).order_by("-line_no").first()
        return (row.line_no + 1) if row else 1

    @classmethod
    async def _next_cost_line_no(cls, tenant_id: int, job_id: int) -> int:
        row = await InstallExecutionCost.filter(
            tenant_id=tenant_id,
            job_id=job_id,
        ).order_by("-line_no").first()
        return (row.line_no + 1) if row else 1

    @classmethod
    async def _sync_job_progress(
        cls,
        job: InstallExecutionJob,
        stages: List[InstallExecutionStage],
        current_user: User,
    ) -> None:
        job.current_stage_key = cls._derive_current_stage_key(stages)
        job.status = cls._derive_job_status_from_stages(stages, job.status)
        if job.status == "进行中" and not job.started_at:
            job.started_at = resolve_business_datetime()
        apply_update_audit(job, current_user)
        await job.save()

    @classmethod
    async def register_task(
        cls,
        tenant_id: int,
        job_id: int,
        data: InstallExecutionTaskCreate,
        current_user: User,
    ) -> InstallExecutionResponse:
        job = await cls._get_job_or_raise(tenant_id, job_id, current_user)
        stages = await cls._load_stages(tenant_id, job_id)
        assert_install_execution_capability(job, "assign_task", stages=stages)

        stage_key = await cls._validate_task_stage_key(tenant_id, job_id, data.stage_key)
        task_title = (data.task_title or "").strip()
        if not task_title:
            raise ValidationError("任务标题不能为空")

        async with in_transaction():
            line_no = await cls._next_task_line_no(tenant_id, job_id)
            payload = {
                "tenant_id": tenant_id,
                "job_id": job_id,
                "line_no": line_no,
                "stage_key": stage_key,
                "task_title": task_title,
                "executor_id": data.executor_id,
                "executor_name": (data.executor_name or "").strip() or None,
                "status": cls._validate_task_status(data.status or "待处理"),
                "planned_at": data.planned_at,
                "actual_at": data.actual_at,
                "notes": (data.notes or "").strip() or None,
                "attachments": cls._normalize_task_attachments(data.attachments),
            }
            apply_create_audit(payload, current_user)
            await InstallExecutionTask.create(**payload)

            if job.status == "待派工":
                job.status = "进行中"
                if not job.started_at:
                    job.started_at = resolve_business_datetime()
                apply_update_audit(job, current_user)
                await job.save()

        return await cls.get_by_id(tenant_id, job_id, current_user)

    @classmethod
    async def advance_stage(
        cls,
        tenant_id: int,
        job_id: int,
        data: InstallExecutionAdvanceStage,
        current_user: User,
    ) -> InstallExecutionResponse:
        job = await cls._get_job_or_raise(tenant_id, job_id, current_user)
        stages = await cls._load_stages(tenant_id, job_id)
        assert_install_execution_capability(job, "advance_stage", stages=stages)

        if not stages:
            raise ValidationError("未配置安装阶段，无法推进")

        now = resolve_business_datetime()
        note_extra = (data.notes or "").strip() or None

        in_progress = next((s for s in stages if s.status == "进行中"), None)
        target = in_progress or next((s for s in stages if s.status == "待开始"), None)
        if target is None:
            raise ValidationError("所有安装阶段均已完成，无需推进")

        async with in_transaction():
            if target.status == "进行中":
                target.status = "已完成"
                target.actual_at = now
                if note_extra:
                    prev = (target.notes or "").strip()
                    target.notes = f"{prev}\n{note_extra}".strip() if prev else note_extra
                apply_update_audit(target, current_user)
                await target.save()

                next_stage = next(
                    (s for s in stages if s.sort_order > target.sort_order and s.status != "已完成"),
                    None,
                )
                if next_stage:
                    next_stage.status = "进行中"
                    if not next_stage.planned_at:
                        next_stage.planned_at = now
                    apply_update_audit(next_stage, current_user)
                    await next_stage.save()
            else:
                target.status = "进行中"
                if not target.planned_at:
                    target.planned_at = now
                apply_update_audit(target, current_user)
                await target.save()

            stages = await cls._load_stages(tenant_id, job_id)
            await cls._sync_job_progress(job, stages, current_user)

        return await cls.get_by_id(tenant_id, job_id, current_user)

    @classmethod
    async def append_cost(
        cls,
        tenant_id: int,
        job_id: int,
        data: InstallExecutionCostCreate,
        current_user: User,
    ) -> InstallExecutionResponse:
        job = await cls._get_job_or_raise(tenant_id, job_id, current_user)
        stages = await cls._load_stages(tenant_id, job_id)
        assert_install_execution_capability(job, "register_cost", stages=stages)

        amount = data.amount
        if amount is None or amount < 0:
            raise ValidationError("费用金额无效")

        async with in_transaction():
            line_no = await cls._next_cost_line_no(tenant_id, job_id)
            payload = {
                "tenant_id": tenant_id,
                "job_id": job_id,
                "line_no": line_no,
                "cost_type": cls._validate_cost_type(data.cost_type),
                "amount": amount,
                "occurred_at": data.occurred_at or resolve_business_datetime(),
                "description": (data.description or "").strip() or None,
            }
            apply_create_audit(payload, current_user)
            await InstallExecutionCost.create(**payload)

            costs = await cls._load_costs(tenant_id, job_id)
            job.total_cost_amount = cls._sum_costs(costs)
            apply_update_audit(job, current_user)
            await job.save()

        return await cls.get_by_id(tenant_id, job_id, current_user)

    @classmethod
    async def pull_from_sales_order(
        cls,
        tenant_id: int,
        data: InstallExecutionPullFromSalesOrderRequest,
        current_user: User,
    ) -> InstallExecutionResponse:
        so = await SalesOrder.filter(
            id=data.sales_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not so:
            raise NotFoundError(f"销售订单不存在: {data.sales_order_id}")
        create_data = InstallExecutionCreate(
            customer_id=so.customer_id,
            supply_source=data.supply_source,
            site_address=data.site_address,
            sales_order_id=so.id,
        )
        return await cls.create(tenant_id, create_data, current_user)

    @classmethod
    async def pull_from_sales_delivery(
        cls,
        tenant_id: int,
        data: InstallExecutionPullFromSalesDeliveryRequest,
        current_user: User,
    ) -> InstallExecutionResponse:
        sd = await SalesDelivery.filter(
            id=data.sales_delivery_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not sd:
            raise NotFoundError(f"销售出库单不存在: {data.sales_delivery_id}")
        create_data = InstallExecutionCreate(
            customer_id=sd.customer_id,
            supply_source=data.supply_source,
            site_address=data.site_address,
            sales_delivery_id=sd.id,
            sales_order_id=sd.sales_order_id,
            packing_binding_id=data.packing_binding_id,
        )
        return await cls.create(tenant_id, create_data, current_user)

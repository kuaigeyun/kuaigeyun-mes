"""
员工绩效服务模块

提供员工绩效配置、工时单价、KPI 定义的 CRUD 及绩效汇总查询；计件单价查价由产品工艺同步维护。
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from infra.models.user import User
from apps.master_data.models.employee_performance import (
    EmployeePerformanceConfig,
    PieceRate,
    HourlyRate,
    KPIDefinition,
    EmployeeKPIScore,
    PerformanceSummary,
)
from apps.master_data.schemas.employee_performance_schemas import (
    EmployeePerformanceConfigCreate,
    EmployeePerformanceConfigUpdate,
    EmployeePerformanceConfigResponse,
    HourlyRateCreate,
    HourlyRateUpdate,
    HourlyRateResponse,
    KPIDefinitionCreate,
    KPIDefinitionUpdate,
    KPIDefinitionResponse,
    PerformanceSummaryResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.utils.timezone_utils import resolve_business_datetime


class EmployeePerformanceConfigService:
    """员工绩效配置服务"""

    @staticmethod
    async def create(
        tenant_id: int,
        data: EmployeePerformanceConfigCreate,
        operator: Optional[User] = None,
    ) -> EmployeePerformanceConfigResponse:
        existing = await EmployeePerformanceConfig.filter(
            tenant_id=tenant_id,
            employee_id=data.employee_id,
            deleted_at__isnull=True,
        ).first()
        if existing:
            raise ValidationError(f"员工 {data.employee_id} 已存在绩效配置")
        payload = data.model_dump(exclude_unset=True)
        apply_create_audit(payload, operator)
        config = await EmployeePerformanceConfig.create(
            tenant_id=tenant_id,
            **payload,
        )
        return EmployeePerformanceConfigResponse.model_validate(config)

    @staticmethod
    async def get_by_id(tenant_id: int, config_id: int) -> EmployeePerformanceConfigResponse:
        config = await EmployeePerformanceConfig.filter(
            id=config_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not config:
            raise NotFoundError(f"绩效配置 {config_id} 不存在")
        return EmployeePerformanceConfigResponse.model_validate(config)

    @staticmethod
    async def get_by_employee(tenant_id: int, employee_id: int) -> Optional[EmployeePerformanceConfigResponse]:
        config = await EmployeePerformanceConfig.filter(
            tenant_id=tenant_id,
            employee_id=employee_id,
            deleted_at__isnull=True,
            is_active=True,
        ).first()
        if not config:
            return None
        return EmployeePerformanceConfigResponse.model_validate(config)

    @staticmethod
    async def list_configs(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        employee_id: Optional[int] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        calc_mode: Optional[str] = None,
        is_active: Optional[bool] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> dict:
        from apps.master_data.services.performance_list_core import apply_employee_config_list_filters

        query = EmployeePerformanceConfig.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        query, order_clause = apply_employee_config_list_filters(
            query,
            keyword=keyword,
            order_by=order_by,
            employee_id=employee_id,
            calc_mode=calc_mode,
            is_active=is_active,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await query.count()
        configs = await query.order_by(order_clause).offset(skip).limit(limit).all()
        items = [EmployeePerformanceConfigResponse.model_validate(c) for c in configs]
        return {"items": items, "total": total}

    @staticmethod
    async def update(
        tenant_id: int,
        config_id: int,
        data: EmployeePerformanceConfigUpdate,
        operator: Optional[User] = None,
    ) -> EmployeePerformanceConfigResponse:
        config = await EmployeePerformanceConfig.filter(
            id=config_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not config:
            raise NotFoundError(f"绩效配置 {config_id} 不存在")
        update_data = data.model_dump(exclude_unset=True)
        apply_update_audit(update_data, operator)
        await config.update_from_dict(update_data)
        await config.save()
        config = await EmployeePerformanceConfig.get(id=config_id)
        return EmployeePerformanceConfigResponse.model_validate(config)

    @staticmethod
    async def delete(tenant_id: int, config_id: int) -> None:
        config = await EmployeePerformanceConfig.filter(
            id=config_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not config:
            raise NotFoundError(f"绩效配置 {config_id} 不存在")
        await config.update_from_dict({"deleted_at": resolve_business_datetime()})


class PieceRateService:
    """计件单价查价（数据由产品工艺维护，不提供独立 CRUD API）"""

    @staticmethod
    async def get_rate_for_operation(
        tenant_id: int,
        operation_id: int,
        material_id: Optional[int] = None,
        as_of_date: Optional[date] = None,
    ) -> Optional[Decimal]:
        """获取工序（及可选物料）的计件单价，优先工序+物料，其次仅工序"""
        dt = as_of_date or date.today()
        effective_q = (Q(effective_from__isnull=True) | Q(effective_from__lte=dt)) & (
            Q(effective_to__isnull=True) | Q(effective_to__gte=dt)
        )
        # 优先：工序+物料
        if material_id:
            rate = await PieceRate.filter(
                tenant_id=tenant_id,
                operation_id=operation_id,
                material_id=material_id,
                is_active=True,
                deleted_at__isnull=True,
            ).filter(effective_q).order_by("-effective_from").first()
            if rate:
                return rate.rate
        # 其次：仅工序
        rate = await PieceRate.filter(
            tenant_id=tenant_id,
            operation_id=operation_id,
            material_id__isnull=True,
            is_active=True,
            deleted_at__isnull=True,
        ).filter(effective_q).order_by("-effective_from").first()
        if rate:
            return rate.rate
        return None


class HourlyRateService:
    """工时单价服务"""

    @staticmethod
    async def _resolve_department_name(tenant_id: int, department_id: Optional[int]) -> Optional[str]:
        if not department_id:
            return None
        from core.models.department import Department

        dept = await Department.filter(
            tenant_id=tenant_id, id=department_id, deleted_at__isnull=True
        ).first()
        return dept.name if dept else None

    @staticmethod
    async def _resolve_position_name(tenant_id: int, position_id: Optional[int]) -> Optional[str]:
        if not position_id:
            return None
        from core.models.position import Position

        pos = await Position.filter(
            tenant_id=tenant_id, id=position_id, deleted_at__isnull=True
        ).first()
        return pos.name if pos else None

    @staticmethod
    async def _apply_department_position_names(
        tenant_id: int,
        payload: Dict[str, Any],
        *,
        existing: Optional[HourlyRate] = None,
    ) -> None:
        """按 ID 写入 department_name / position_name（创建与更新的唯一写路径）。"""
        if existing is None:
            payload["department_name"] = await HourlyRateService._resolve_department_name(
                tenant_id, payload.get("department_id")
            )
            payload["position_name"] = await HourlyRateService._resolve_position_name(
                tenant_id, payload.get("position_id")
            )
            return
        if "department_id" in payload:
            payload["department_name"] = await HourlyRateService._resolve_department_name(
                tenant_id, payload.get("department_id")
            )
        if "position_id" in payload:
            payload["position_name"] = await HourlyRateService._resolve_position_name(
                tenant_id, payload.get("position_id")
            )

    @staticmethod
    async def _hydrate_response(tenant_id: int, rate: HourlyRate) -> HourlyRateResponse:
        """单条详情：名称缺失时按 ID 补齐展示。"""
        items = await HourlyRateService._hydrate_responses(tenant_id, [rate])
        return items[0]

    @staticmethod
    async def _hydrate_responses(tenant_id: int, rates: List[HourlyRate]) -> List[HourlyRateResponse]:
        """批量：名称缺失时按 ID 从主数据补齐展示（不写库；历史行靠迁移回填）。"""
        if not rates:
            return []
        need_dept_ids = {
            int(r.department_id)
            for r in rates
            if r.department_id and not (getattr(r, "department_name", None) or "").strip()
        }
        need_pos_ids = {
            int(r.position_id)
            for r in rates
            if r.position_id and not (getattr(r, "position_name", None) or "").strip()
        }
        dept_names: Dict[int, str] = {}
        pos_names: Dict[int, str] = {}
        if need_dept_ids:
            from core.models.department import Department

            rows = await Department.filter(
                tenant_id=tenant_id, id__in=list(need_dept_ids), deleted_at__isnull=True
            ).values_list("id", "name")
            dept_names = {int(i): (n or "") for i, n in rows}
        if need_pos_ids:
            from core.models.position import Position

            rows = await Position.filter(
                tenant_id=tenant_id, id__in=list(need_pos_ids), deleted_at__isnull=True
            ).values_list("id", "name")
            pos_names = {int(i): (n or "") for i, n in rows}

        out: List[HourlyRateResponse] = []
        for rate in rates:
            resp = HourlyRateResponse.model_validate(rate)
            data = resp.model_dump()
            if resp.department_id and not (resp.department_name or "").strip():
                name = dept_names.get(int(resp.department_id))
                data["department_name"] = name or None
            if resp.position_id and not (resp.position_name or "").strip():
                name = pos_names.get(int(resp.position_id))
                data["position_name"] = name or None
            out.append(HourlyRateResponse.model_validate(data))
        return out

    @staticmethod
    async def create(
        tenant_id: int,
        data: HourlyRateCreate,
        operator: Optional[User] = None,
    ) -> HourlyRateResponse:
        import uuid as uuid_mod
        payload = data.model_dump(exclude_unset=True)
        await HourlyRateService._apply_department_position_names(tenant_id, payload)
        apply_create_audit(payload, operator)
        rate = await HourlyRate.create(
            tenant_id=tenant_id,
            uuid=str(uuid_mod.uuid4()),
            **payload,
        )
        return await HourlyRateService._hydrate_response(tenant_id, rate)

    @staticmethod
    async def get_rate_for_employee(
        tenant_id: int,
        employee_id: int,
        department_id: Optional[int] = None,
        position_id: Optional[int] = None,
        as_of_date: Optional[date] = None,
    ) -> Optional[Decimal]:
        """获取员工的工时单价：优先员工配置，其次部门/职位"""
        from apps.master_data.services.employee_performance_service import EmployeePerformanceConfigService
        config = await EmployeePerformanceConfigService.get_by_employee(tenant_id, employee_id)
        if config and config.hourly_rate is not None:
            return config.hourly_rate
        dt = as_of_date or date.today()
        effective_q = (Q(effective_from__isnull=True) | Q(effective_from__lte=dt)) & (
            Q(effective_to__isnull=True) | Q(effective_to__gte=dt)
        )
        if department_id:
            rate = await HourlyRate.filter(
                tenant_id=tenant_id,
                department_id=department_id,
                is_active=True,
                deleted_at__isnull=True,
            ).filter(effective_q).order_by("-effective_from").first()
            if rate:
                return rate.rate
        if position_id:
            rate = await HourlyRate.filter(
                tenant_id=tenant_id,
                position_id=position_id,
                is_active=True,
                deleted_at__isnull=True,
            ).filter(effective_q).order_by("-effective_from").first()
            if rate:
                return rate.rate
        return None

    @staticmethod
    async def list_rates(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        is_active: Optional[bool] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> dict:
        from apps.master_data.services.performance_list_core import apply_hourly_rate_list_filters

        query = HourlyRate.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        query, order_clause = apply_hourly_rate_list_filters(
            query,
            keyword=keyword,
            order_by=order_by,
            is_active=is_active,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await query.count()
        rates = await query.order_by(order_clause).offset(skip).limit(limit).all()
        items = await HourlyRateService._hydrate_responses(tenant_id, list(rates))
        return {"items": items, "total": total}

    @staticmethod
    async def get_by_id(tenant_id: int, rate_id: int) -> HourlyRateResponse:
        rate = await HourlyRate.filter(id=rate_id, tenant_id=tenant_id, deleted_at__isnull=True).first()
        if not rate:
            raise NotFoundError(f"工时单价 {rate_id} 不存在")
        return await HourlyRateService._hydrate_response(tenant_id, rate)

    @staticmethod
    async def update(
        tenant_id: int,
        rate_id: int,
        data: HourlyRateUpdate,
        operator: Optional[User] = None,
    ) -> HourlyRateResponse:
        rate = await HourlyRate.filter(id=rate_id, tenant_id=tenant_id, deleted_at__isnull=True).first()
        if not rate:
            raise NotFoundError(f"工时单价 {rate_id} 不存在")
        update_data = data.model_dump(exclude_unset=True)
        await HourlyRateService._apply_department_position_names(
            tenant_id, update_data, existing=rate
        )
        apply_update_audit(update_data, operator)
        await rate.update_from_dict(update_data)
        await rate.save()
        rate = await HourlyRate.get(id=rate_id)
        return await HourlyRateService._hydrate_response(tenant_id, rate)

    @staticmethod
    async def delete(tenant_id: int, rate_id: int) -> None:
        rate = await HourlyRate.filter(id=rate_id, tenant_id=tenant_id, deleted_at__isnull=True).first()
        if not rate:
            raise NotFoundError(f"工时单价 {rate_id} 不存在")
        await rate.update_from_dict({"deleted_at": resolve_business_datetime()})


class KPIDefinitionService:
    """KPI 指标定义服务"""

    @staticmethod
    async def create(
        tenant_id: int,
        data: KPIDefinitionCreate,
        operator: Optional[User] = None,
    ) -> KPIDefinitionResponse:
        existing = await KPIDefinition.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True,
        ).first()
        if existing:
            raise ValidationError(f"KPI 指标编码 {data.code} 已存在")
        import uuid as uuid_mod
        payload = data.model_dump(exclude_unset=True)
        apply_create_audit(payload, operator)
        kpi = await KPIDefinition.create(
            tenant_id=tenant_id,
            uuid=str(uuid_mod.uuid4()),
            **payload,
        )
        return KPIDefinitionResponse.model_validate(kpi)

    @staticmethod
    async def list(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        calc_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> dict:
        from apps.master_data.services.performance_list_core import apply_kpi_definition_list_filters

        query = KPIDefinition.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        query, order_clause = apply_kpi_definition_list_filters(
            query,
            keyword=keyword,
            order_by=order_by,
            calc_type=calc_type,
            is_active=is_active,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await query.count()
        kpis = await query.order_by(order_clause).offset(skip).limit(limit).all()
        items = [KPIDefinitionResponse.model_validate(k) for k in kpis]
        return {"items": items, "total": total}

    @staticmethod
    async def get_by_id(tenant_id: int, kpi_id: int) -> KPIDefinitionResponse:
        kpi = await KPIDefinition.filter(id=kpi_id, tenant_id=tenant_id, deleted_at__isnull=True).first()
        if not kpi:
            raise NotFoundError(f"KPI 指标 {kpi_id} 不存在")
        return KPIDefinitionResponse.model_validate(kpi)

    @staticmethod
    async def update(
        tenant_id: int,
        kpi_id: int,
        data: KPIDefinitionUpdate,
        operator: Optional[User] = None,
    ) -> KPIDefinitionResponse:
        kpi = await KPIDefinition.filter(id=kpi_id, tenant_id=tenant_id, deleted_at__isnull=True).first()
        if not kpi:
            raise NotFoundError(f"KPI 指标 {kpi_id} 不存在")
        update_data = data.model_dump(exclude_unset=True)
        apply_update_audit(update_data, operator)
        await kpi.update_from_dict(update_data)
        await kpi.save()
        kpi = await KPIDefinition.get(id=kpi_id)
        return KPIDefinitionResponse.model_validate(kpi)

    @staticmethod
    async def delete(tenant_id: int, kpi_id: int) -> None:
        kpi = await KPIDefinition.filter(id=kpi_id, tenant_id=tenant_id, deleted_at__isnull=True).first()
        if not kpi:
            raise NotFoundError(f"KPI 指标 {kpi_id} 不存在")
        await kpi.update_from_dict({"deleted_at": resolve_business_datetime()})

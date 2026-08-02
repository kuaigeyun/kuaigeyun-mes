"""
维护保养计划服务模块

提供维护保养计划的 CRUD 操作。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import List, Optional, Any
from datetime import datetime
from decimal import Decimal
from tortoise.exceptions import IntegrityError
from tortoise.expressions import Q

from apps.kuaizhizao.models.maintenance_plan import MaintenancePlan, MaintenanceExecution
from apps.kuaizhizao.models.equipment import Equipment
from apps.kuaizhizao.services.spare_part_service import SparePartService
from apps.kuaizhizao.schemas.maintenance_plan import (
    MaintenancePlanCreate,
    MaintenancePlanUpdate,
    MaintenanceExecutionCreate,
    MaintenanceExecutionUpdate,
)
from apps.common.audit_actor import apply_create_audit
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User
from core.utils.timezone_utils import resolve_business_datetime


class MaintenancePlanService:
    """
    维护保养计划服务类
    
    提供维护保养计划的 CRUD 操作。
    """

    @staticmethod
    async def _resolve_equipment_items(tenant_id: int, equipment_uuids: List[str]) -> List[dict[str, Any]]:
        ordered: list[str] = []
        seen: set[str] = set()
        for raw in equipment_uuids:
            value = str(raw).strip()
            if not value or value in seen:
                continue
            seen.add(value)
            ordered.append(value)
        if not ordered:
            raise ValidationError("至少选择一个关联设备")

        rows = await Equipment.filter(
            tenant_id=tenant_id,
            uuid__in=ordered,
            deleted_at__isnull=True,
        ).all()
        by_uuid = {row.uuid: row for row in rows}
        missing = [uuid for uuid in ordered if uuid not in by_uuid]
        if missing:
            raise ValidationError(f"设备不存在: {', '.join(missing)}")

        return [
            {
                "id": by_uuid[uuid].id,
                "uuid": by_uuid[uuid].uuid,
                "code": by_uuid[uuid].code,
                "name": by_uuid[uuid].name,
            }
            for uuid in ordered
        ]

    @staticmethod
    def _apply_equipment_items(plan: MaintenancePlan, items: List[dict[str, Any]]) -> None:
        primary = items[0]
        plan.equipment_id = primary["id"]
        plan.equipment_uuid = primary["uuid"]
        plan.equipment_name = (
            primary["name"]
            if len(items) == 1
            else f"{primary['name']} 等{len(items)}台"
        )
        plan.equipment_items = items

    @staticmethod
    def _fallback_equipment_items(plan: MaintenancePlan) -> List[dict[str, Any]]:
        if plan.equipment_items:
            return list(plan.equipment_items)
        if plan.equipment_uuid:
            return [
                {
                    "id": plan.equipment_id,
                    "uuid": plan.equipment_uuid,
                    "code": None,
                    "name": plan.equipment_name,
                }
            ]
        return []

    @staticmethod
    def serialize_plan_response(plan: MaintenancePlan):
        from apps.kuaizhizao.schemas.maintenance_plan import MaintenancePlanResponse

        items = MaintenancePlanService._fallback_equipment_items(plan)
        resp = MaintenancePlanResponse.model_validate(plan)
        resp.equipment_items = items
        resp.equipment_uuids = [str(item.get("uuid")) for item in items if item.get("uuid")]
        if resp.equipment_uuids and not resp.equipment_uuid:
            resp.equipment_uuid = resp.equipment_uuids[0]
        return resp
    
    @staticmethod
    async def create_maintenance_plan(
        tenant_id: int,
        data: MaintenancePlanCreate,
        created_by: Optional[int] = None
    ) -> MaintenancePlan:
        """
        创建维护计划
        
        Args:
            tenant_id: 组织ID
            data: 维护计划创建数据
            created_by: 创建人ID（可选）
            
        Returns:
            MaintenancePlan: 创建的维护计划对象
            
        Raises:
            ValidationError: 当设备不存在或计划编号已存在时抛出
        """
        try:
            payload = data.model_dump(exclude_none=True)
            equipment_uuids = payload.pop("equipment_uuids", None) or []
            legacy_uuid = payload.pop("equipment_uuid", None)
            if legacy_uuid and legacy_uuid not in equipment_uuids:
                equipment_uuids.insert(0, legacy_uuid)
            equipment_items = await MaintenancePlanService._resolve_equipment_items(
                tenant_id,
                equipment_uuids,
            )
            primary = equipment_items[0]
            equipment = await Equipment.filter(
                tenant_id=tenant_id,
                uuid=primary["uuid"],
                deleted_at__isnull=True,
            ).first()
            if not equipment:
                raise ValidationError(f"设备不存在: {primary['uuid']}")
            
            # 如果没有提供计划编号，自动生成
            if not data.plan_no:
                try:
                    data.plan_no = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code="maintenance_plan_code",
                        context=None
                    )
                except ValidationError:
                    # 如果编码规则不存在，使用默认编码格式
                    timestamp = resolve_business_datetime().strftime("%Y%m%d%H%M%S")
                    data.plan_no = f"MP{timestamp}"
            
            plan = MaintenancePlan(
                tenant_id=tenant_id,
                **payload,
            )
            MaintenancePlanService._apply_equipment_items(plan, equipment_items)
            actor = None
            if created_by is not None:
                actor = await User.filter(id=created_by, tenant_id=tenant_id).first()
            apply_create_audit(plan, actor)
            await plan.save()
            return plan
        except IntegrityError:
            raise ValidationError(f"维护计划编号 {data.plan_no} 已存在")
    
    @staticmethod
    async def get_maintenance_plan_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> MaintenancePlan:
        """
        根据UUID获取维护计划（ORM 模型，供更新/删除等写操作使用）
        """
        plan = await MaintenancePlan.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()

        if not plan:
            raise NotFoundError("维护计划不存在")

        return plan

    @staticmethod
    async def build_maintenance_plan_response(plan: MaintenancePlan):
        """组装带生命周期的维护计划 API 响应"""
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_maintenance_plan_lifecycle,
            get_document_milestones,
        )
        from apps.kuaizhizao.schemas.maintenance_plan import MaintenancePlanResponse

        milestones = await get_document_milestones(plan.tenant_id, "maintenance_plan", plan.id)
        resp = MaintenancePlanService.serialize_plan_response(plan)
        resp.lifecycle = get_maintenance_plan_lifecycle(plan, milestones=milestones)
        return resp
    
    @staticmethod
    async def list_maintenance_plans(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        equipment_uuid: Optional[str] = None,
        status: Optional[str] = None,
        plan_type: Optional[str] = None,
        maintenance_type: Optional[str] = None,
        search: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        planned_start_date: Optional[str] = None,
        planned_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[MaintenancePlan], int]:
        """
        获取维护计划列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            equipment_uuid: 设备UUID（可选）
            status: 计划状态（可选）
            plan_type: 计划类型（可选）
            search: 搜索关键词（可选，搜索计划编号、计划名称）
            
        Returns:
            tuple[List[MaintenancePlanResponse], int]: 维护计划列表和总数量（包含生命周期信息）
        """
        query = MaintenancePlan.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        # 筛选条件
        if equipment_uuid:
            query = query.filter(
                Q(equipment_uuid=equipment_uuid)
                | Q(equipment_items__contains=[{"uuid": equipment_uuid}])
            )
        if status:
            query = query.filter(status=status)
        if plan_type:
            query = query.filter(plan_type=plan_type)
        if maintenance_type:
            query = query.filter(maintenance_type=maintenance_type)

        from apps.kuaizhizao.services.equipment_list_core import (
            MAINTENANCE_PLAN_SORTABLE_FIELDS,
            apply_equipment_created_date_range,
            apply_equipment_document_date_range,
            apply_equipment_keyword_filter,
            apply_equipment_updated_date_range,
            pick_search_keyword,
            resolve_equipment_list_order_by,
        )

        query = apply_equipment_keyword_filter(
            query,
            pick_search_keyword(keyword, search),
            ["plan_no", "plan_name", "equipment_name"],
        )
        query = apply_equipment_document_date_range(
            query,
            date_field="planned_start_date",
            start_date=planned_start_date,
            end_date=planned_end_date,
        )
        query = apply_equipment_created_date_range(
            query,
            start_date=created_start_date,
            end_date=created_end_date,
        )
        query = apply_equipment_updated_date_range(
            query,
            start_date=updated_start_date,
            end_date=updated_end_date,
        )

        total = await query.count()
        order_clause = resolve_equipment_list_order_by(
            order_by,
            MAINTENANCE_PLAN_SORTABLE_FIELDS,
            "-updated_at",
        )
        plans = await query.offset(skip).limit(limit).order_by(order_clause)
        
        return plans, total
    
    @staticmethod
    async def update_maintenance_plan(
        tenant_id: int,
        uuid: str,
        data: MaintenancePlanUpdate
    ) -> MaintenancePlan:
        """
        更新维护计划
        
        Args:
            tenant_id: 组织ID
            uuid: 维护计划UUID
            data: 维护计划更新数据
            
        Returns:
            MaintenancePlan: 更新后的维护计划对象
            
        Raises:
            NotFoundError: 当维护计划不存在时抛出
        """
        plan = await MaintenancePlanService.get_maintenance_plan_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        equipment_uuids = update_data.pop("equipment_uuids", None)
        update_data.pop("equipment_uuid", None)
        if equipment_uuids is not None:
            items = await MaintenancePlanService._resolve_equipment_items(tenant_id, equipment_uuids)
            MaintenancePlanService._apply_equipment_items(plan, items)
        
        # 更新字段
        for key, value in update_data.items():
            setattr(plan, key, value)
        
        await plan.save()
        return plan
    
    @staticmethod
    async def delete_maintenance_plan(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除维护计划（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 维护计划UUID
            
        Raises:
            NotFoundError: 当维护计划不存在时抛出
        """
        plan = await MaintenancePlanService.get_maintenance_plan_by_uuid(tenant_id, uuid)
        
        # 软删除
        plan.deleted_at = resolve_business_datetime()
        await plan.save()


class MaintenanceExecutionService:
    """
    维护执行记录服务类
    
    提供维护执行记录的 CRUD 操作。
    """
    
    @staticmethod
    async def create_maintenance_execution(
        tenant_id: int,
        data: MaintenanceExecutionCreate,
        created_by: Optional[int] = None
    ) -> MaintenanceExecution:
        """
        创建维护执行记录
        
        Args:
            tenant_id: 组织ID
            data: 维护执行记录创建数据
            created_by: 创建人ID（可选）
            
        Returns:
            MaintenanceExecution: 创建的维护执行记录对象
            
        Raises:
            ValidationError: 当设备不存在或执行记录编号已存在时抛出
        """
        try:
            # 验证设备是否存在
            equipment = await Equipment.filter(
                tenant_id=tenant_id,
                uuid=data.equipment_uuid,
                deleted_at__isnull=True
            ).first()
            
            if not equipment:
                raise ValidationError(f"设备不存在: {data.equipment_uuid}")
            
            # 如果关联了维护计划，验证维护计划是否存在
            maintenance_plan = None
            if data.maintenance_plan_uuid:
                maintenance_plan = await MaintenancePlan.filter(
                    tenant_id=tenant_id,
                    uuid=data.maintenance_plan_uuid,
                    deleted_at__isnull=True
                ).first()
                
                if not maintenance_plan:
                    raise ValidationError(f"维护计划不存在: {data.maintenance_plan_uuid}")
            
            # 如果没有提供执行记录编号，自动生成
            if not data.execution_no:
                try:
                    data.execution_no = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code="maintenance_execution_code",
                        context=None
                    )
                except ValidationError:
                    # 如果编码规则不存在，使用默认编码格式
                    timestamp = resolve_business_datetime().strftime("%Y%m%d%H%M%S")
                    data.execution_no = f"ME{timestamp}"
            
            source_type = (data.source_type or "").strip() or None
            source_uuid = (data.source_uuid or "").strip() or None
            linked_fault = None
            if source_type == "equipment_fault":
                if not source_uuid:
                    raise ValidationError("故障转保养须提供 source_uuid")
                from apps.kuaizhizao.models.equipment_fault import EquipmentFault

                linked_fault = await EquipmentFault.filter(
                    tenant_id=tenant_id,
                    uuid=source_uuid,
                    deleted_at__isnull=True,
                ).first()
                if not linked_fault:
                    raise ValidationError(f"设备故障记录不存在: {source_uuid}")
                if linked_fault.equipment_id != equipment.id:
                    raise ValidationError("故障单关联设备与保养执行设备不一致")

            execution = MaintenanceExecution(
                tenant_id=tenant_id,
                equipment_id=equipment.id,
                equipment_uuid=equipment.uuid,
                equipment_name=equipment.name,
                maintenance_plan_id=maintenance_plan.id if maintenance_plan else None,
                maintenance_plan_uuid=maintenance_plan.uuid if maintenance_plan else None,
                **data.model_dump(
                    exclude_none=True,
                    exclude={
                        "equipment_uuid",
                        "maintenance_plan_uuid",
                        "source_type",
                        "source_uuid",
                    },
                ),
                source_type=source_type,
                source_uuid=source_uuid,
            )
            if created_by is not None:
                actor = await User.filter(id=created_by).first()
                apply_create_audit(execution, actor)
            await execution.save()

            # 故障转保养：故障置处理中，并同步设备状态
            if linked_fault and linked_fault.status not in ("已关闭", "已修复"):
                if linked_fault.status != "处理中":
                    linked_fault.status = "处理中"
                    await linked_fault.save()
                from apps.kuaizhizao.services.equipment_fault_service import (
                    sync_equipment_status_from_faults,
                )

                await sync_equipment_status_from_faults(tenant_id, equipment.id)

            if data.spare_parts_used:
                await SparePartService().apply_parts_usage(
                    tenant_id,
                    data.spare_parts_used,
                    rel_type="maintenance_execution",
                    rel_id=execution.id,
                    operator_id=data.executor_id or created_by,
                    operator_name=data.executor_name,
                )
            return execution
        except IntegrityError:
            raise ValidationError(f"维护执行记录编号 {data.execution_no} 已存在")
    
    @staticmethod
    async def get_maintenance_execution_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> MaintenanceExecution:
        """
        根据UUID获取维护执行记录
        
        Args:
            tenant_id: 组织ID
            uuid: 维护执行记录UUID
            
        Returns:
            MaintenanceExecution: 维护执行记录对象
            
        Raises:
            NotFoundError: 当维护执行记录不存在时抛出
        """
        execution = await MaintenanceExecution.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not execution:
            raise NotFoundError("维护执行记录不存在")
        
        return execution
    
    @staticmethod
    async def list_maintenance_executions(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        equipment_uuid: Optional[str] = None,
        maintenance_plan_uuid: Optional[str] = None,
        status: Optional[str] = None,
        execution_result: Optional[str] = None,
        search: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        execution_start_date: Optional[str] = None,
        execution_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[MaintenanceExecution], int]:
        """
        获取维护执行记录列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            equipment_uuid: 设备UUID（可选）
            maintenance_plan_uuid: 维护计划UUID（可选）
            status: 记录状态（可选）
            search: 搜索关键词（可选，搜索执行记录编号）
            
        Returns:
            tuple[List[MaintenanceExecution], int]: 维护执行记录列表和总数量
        """
        query = MaintenanceExecution.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        # 筛选条件
        if equipment_uuid:
            query = query.filter(equipment_uuid=equipment_uuid)
        if maintenance_plan_uuid:
            query = query.filter(maintenance_plan_uuid=maintenance_plan_uuid)
        if status:
            query = query.filter(status=status)
        if execution_result:
            query = query.filter(execution_result=execution_result)

        from apps.kuaizhizao.services.equipment_list_core import (
            MAINTENANCE_EXECUTION_SORTABLE_FIELDS,
            apply_equipment_created_date_range,
            apply_equipment_document_date_range,
            apply_equipment_keyword_filter,
            apply_equipment_updated_date_range,
            pick_search_keyword,
            resolve_equipment_list_order_by,
        )

        query = apply_equipment_keyword_filter(
            query,
            pick_search_keyword(keyword, search),
            ["execution_no", "equipment_name", "executor_name"],
        )
        query = apply_equipment_document_date_range(
            query,
            date_field="execution_date",
            start_date=execution_start_date,
            end_date=execution_end_date,
        )
        query = apply_equipment_created_date_range(
            query,
            start_date=created_start_date,
            end_date=created_end_date,
        )
        query = apply_equipment_updated_date_range(
            query,
            start_date=updated_start_date,
            end_date=updated_end_date,
        )

        total = await query.count()
        order_clause = resolve_equipment_list_order_by(
            order_by,
            MAINTENANCE_EXECUTION_SORTABLE_FIELDS,
            "-execution_date",
        )
        executions = await query.offset(skip).limit(limit).order_by(order_clause)
        
        return executions, total
    
    @staticmethod
    async def update_maintenance_execution(
        tenant_id: int,
        uuid: str,
        data: MaintenanceExecutionUpdate
    ) -> MaintenanceExecution:
        """
        更新维护执行记录
        
        Args:
            tenant_id: 组织ID
            uuid: 维护执行记录UUID
            data: 维护执行记录更新数据
            
        Returns:
            MaintenanceExecution: 更新后的维护执行记录对象
            
        Raises:
            NotFoundError: 当维护执行记录不存在时抛出
        """
        execution = await MaintenanceExecutionService.get_maintenance_execution_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        
        # 更新字段
        for key, value in update_data.items():
            setattr(execution, key, value)
        
        await execution.save()

        # 验收合格且来源为故障 → 闭环故障并同步设备状态
        accepted = (
            execution.status == "已验收"
            and str(execution.acceptance_result or "") == "合格"
            and str(execution.source_type or "") == "equipment_fault"
            and execution.source_uuid
        )
        if accepted and ("status" in update_data or "acceptance_result" in update_data):
            from apps.kuaizhizao.models.equipment_fault import EquipmentFault
            from apps.kuaizhizao.services.equipment_fault_service import (
                sync_equipment_status_from_faults,
            )

            linked_fault = await EquipmentFault.filter(
                tenant_id=tenant_id,
                uuid=execution.source_uuid,
                deleted_at__isnull=True,
            ).first()
            if linked_fault and linked_fault.status not in ("已关闭", "已修复"):
                linked_fault.status = "已修复"
                linked_fault.repair_required = False
                await linked_fault.save()
            await sync_equipment_status_from_faults(tenant_id, execution.equipment_id)

        return execution
    
    @staticmethod
    async def delete_maintenance_execution(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除维护执行记录（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 维护执行记录UUID
            
        Raises:
            NotFoundError: 当维护执行记录不存在时抛出
        """
        execution = await MaintenanceExecutionService.get_maintenance_execution_by_uuid(tenant_id, uuid)
        
        # 软删除
        execution.deleted_at = resolve_business_datetime()
        await execution.save()


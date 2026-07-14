"""
维护保养计划服务模块

提供维护保养计划的 CRUD 操作。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from tortoise.exceptions import IntegrityError

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


class MaintenancePlanService:
    """
    维护保养计划服务类
    
    提供维护保养计划的 CRUD 操作。
    """
    
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
            # 验证设备是否存在
            equipment = await Equipment.filter(
                tenant_id=tenant_id,
                uuid=data.equipment_uuid,
                deleted_at__isnull=True
            ).first()
            
            if not equipment:
                raise ValidationError(f"设备不存在: {data.equipment_uuid}")
            
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
                    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                    data.plan_no = f"MP{timestamp}"
            
            plan = MaintenancePlan(
                tenant_id=tenant_id,
                equipment_id=equipment.id,
                equipment_uuid=equipment.uuid,
                equipment_name=equipment.name,
                **data.model_dump(exclude_none=True, exclude={'equipment_uuid'})
            )
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
        根据UUID获取维护计划
        
        Args:
            tenant_id: 组织ID
            uuid: 维护计划UUID
            
        Returns:
            MaintenancePlan: 维护计划对象
            
        Raises:
            NotFoundError: 当维护计划不存在时抛出
        """
        plan = await MaintenancePlan.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plan:
            raise NotFoundError("维护计划不存在")
        
        from apps.kuaizhizao.services.document_lifecycle_service import get_maintenance_plan_lifecycle, get_document_milestones
        from apps.kuaizhizao.schemas.maintenance_plan import MaintenancePlanResponse
        
        milestones = await get_document_milestones(plan.tenant_id, "maintenance_plan", plan.id)
        
        resp = MaintenancePlanResponse.model_validate(plan)
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
            query = query.filter(equipment_uuid=equipment_uuid)
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
        plan.deleted_at = datetime.now()
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
                    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                    data.execution_no = f"ME{timestamp}"
            
            execution = MaintenanceExecution(
                tenant_id=tenant_id,
                equipment_id=equipment.id,
                equipment_uuid=equipment.uuid,
                equipment_name=equipment.name,
                maintenance_plan_id=maintenance_plan.id if maintenance_plan else None,
                maintenance_plan_uuid=maintenance_plan.uuid if maintenance_plan else None,
                **data.model_dump(exclude_none=True, exclude={'equipment_uuid', 'maintenance_plan_uuid'})
            )
            if created_by is not None:
                actor = await User.filter(id=created_by).first()
                apply_create_audit(execution, actor)
            await execution.save()
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
        execution.deleted_at = datetime.now()
        await execution.save()


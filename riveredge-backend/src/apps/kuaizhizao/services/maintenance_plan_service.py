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
from apps.kuaizhizao.schemas.maintenance_plan import (
    MaintenancePlanCreate,
    MaintenancePlanUpdate,
    MaintenanceExecutionCreate,
    MaintenanceExecutionUpdate,
)
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError


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
        
        return plan
    
    @staticmethod
    async def list_maintenance_plans(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        equipment_uuid: Optional[str] = None,
        status: Optional[str] = None,
        plan_type: Optional[str] = None,
        search: Optional[str] = None
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
            tuple[List[MaintenancePlan], int]: 维护计划列表和总数量
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
        
        # 搜索条件
        if search:
            query = query.filter(
                plan_no__icontains=search
            ) | query.filter(
                plan_name__icontains=search
            )
        
        # 获取总数量
        total = await query.count()
        
        # 获取列表
        plans = await query.offset(skip).limit(limit).order_by("-created_at")
        
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
            await execution.save()
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
        search: Optional[str] = None
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
        
        # 搜索条件
        if search:
            query = query.filter(execution_no__icontains=search)
        
        # 获取总数量
        total = await query.count()
        
        # 获取列表
        executions = await query.offset(skip).limit(limit).order_by("-execution_date")
        
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


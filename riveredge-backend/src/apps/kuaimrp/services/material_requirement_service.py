"""
物料需求服务模块

提供物料需求的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaimrp.models.material_requirement import MaterialRequirement
from apps.kuaimrp.schemas.material_requirement_schemas import (
    MaterialRequirementCreate, MaterialRequirementUpdate, MaterialRequirementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MaterialRequirementService:
    """物料需求服务"""
    
    @staticmethod
    async def create_material_requirement(
        tenant_id: int,
        data: MaterialRequirementCreate
    ) -> MaterialRequirementResponse:
        """
        创建物料需求
        
        Args:
            tenant_id: 租户ID
            data: 需求创建数据
            
        Returns:
            MaterialRequirementResponse: 创建的需求对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await MaterialRequirement.filter(
            tenant_id=tenant_id,
            requirement_no=data.requirement_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"需求编号 {data.requirement_no} 已存在")
        
        # 创建需求
        requirement = await MaterialRequirement.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return MaterialRequirementResponse.model_validate(requirement)
    
    @staticmethod
    async def get_material_requirement_by_uuid(
        tenant_id: int,
        requirement_uuid: str
    ) -> MaterialRequirementResponse:
        """
        根据UUID获取物料需求
        
        Args:
            tenant_id: 租户ID
            requirement_uuid: 需求UUID
            
        Returns:
            MaterialRequirementResponse: 需求对象
            
        Raises:
            NotFoundError: 当需求不存在时抛出
        """
        requirement = await MaterialRequirement.filter(
            tenant_id=tenant_id,
            uuid=requirement_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not requirement:
            raise NotFoundError(f"物料需求 {requirement_uuid} 不存在")
        
        return MaterialRequirementResponse.model_validate(requirement)
    
    @staticmethod
    async def list_material_requirements(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        requirement_type: Optional[str] = None,
        plan_id: Optional[int] = None,
        material_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[MaterialRequirementResponse]:
        """
        获取物料需求列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            requirement_type: 需求类型（过滤）
            plan_id: 计划ID（过滤）
            material_id: 物料ID（过滤）
            status: 需求状态（过滤）
            
        Returns:
            List[MaterialRequirementResponse]: 需求列表
        """
        query = MaterialRequirement.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if requirement_type:
            query = query.filter(requirement_type=requirement_type)
        if plan_id:
            query = query.filter(plan_id=plan_id)
        if material_id:
            query = query.filter(material_id=material_id)
        if status:
            query = query.filter(status=status)
        
        requirements = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [MaterialRequirementResponse.model_validate(req) for req in requirements]
    
    @staticmethod
    async def update_material_requirement(
        tenant_id: int,
        requirement_uuid: str,
        data: MaterialRequirementUpdate
    ) -> MaterialRequirementResponse:
        """
        更新物料需求
        
        Args:
            tenant_id: 租户ID
            requirement_uuid: 需求UUID
            data: 需求更新数据
            
        Returns:
            MaterialRequirementResponse: 更新后的需求对象
            
        Raises:
            NotFoundError: 当需求不存在时抛出
        """
        requirement = await MaterialRequirement.filter(
            tenant_id=tenant_id,
            uuid=requirement_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not requirement:
            raise NotFoundError(f"物料需求 {requirement_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(requirement, key, value)
        
        await requirement.save()
        
        return MaterialRequirementResponse.model_validate(requirement)
    
    @staticmethod
    async def delete_material_requirement(
        tenant_id: int,
        requirement_uuid: str
    ) -> None:
        """
        删除物料需求（软删除）
        
        Args:
            tenant_id: 租户ID
            requirement_uuid: 需求UUID
            
        Raises:
            NotFoundError: 当需求不存在时抛出
        """
        requirement = await MaterialRequirement.filter(
            tenant_id=tenant_id,
            uuid=requirement_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not requirement:
            raise NotFoundError(f"物料需求 {requirement_uuid} 不存在")
        
        requirement.deleted_at = datetime.utcnow()
        await requirement.save()

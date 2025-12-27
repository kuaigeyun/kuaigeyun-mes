"""
薪资结构服务模块

提供薪资结构的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaihrm.models.salary import SalaryStructure
from apps.kuaihrm.schemas.salary_structure_schemas import (
    SalaryStructureCreate, SalaryStructureUpdate, SalaryStructureResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SalaryStructureService:
    """薪资结构服务"""
    
    @staticmethod
    async def create_salary_structure(
        tenant_id: int,
        data: SalaryStructureCreate
    ) -> SalaryStructureResponse:
        """创建薪资结构"""
        existing = await SalaryStructure.filter(
            tenant_id=tenant_id,
            structure_code=data.structure_code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"结构编码 {data.structure_code} 已存在")
        
        structure = await SalaryStructure.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SalaryStructureResponse.model_validate(structure)
    
    @staticmethod
    async def get_salary_structure_by_uuid(
        tenant_id: int,
        structure_uuid: str
    ) -> SalaryStructureResponse:
        """根据UUID获取薪资结构"""
        structure = await SalaryStructure.filter(
            tenant_id=tenant_id,
            uuid=structure_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not structure:
            raise NotFoundError(f"薪资结构 {structure_uuid} 不存在")
        
        return SalaryStructureResponse.model_validate(structure)
    
    @staticmethod
    async def list_salary_structures(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        structure_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[SalaryStructureResponse]:
        """获取薪资结构列表"""
        query = SalaryStructure.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if structure_type:
            query = query.filter(structure_type=structure_type)
        if status:
            query = query.filter(status=status)
        
        structures = await query.offset(skip).limit(limit).all()
        
        return [SalaryStructureResponse.model_validate(s) for s in structures]
    
    @staticmethod
    async def update_salary_structure(
        tenant_id: int,
        structure_uuid: str,
        data: SalaryStructureUpdate
    ) -> SalaryStructureResponse:
        """更新薪资结构"""
        structure = await SalaryStructure.filter(
            tenant_id=tenant_id,
            uuid=structure_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not structure:
            raise NotFoundError(f"薪资结构 {structure_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(structure, key, value)
        
        await structure.save()
        
        return SalaryStructureResponse.model_validate(structure)
    
    @staticmethod
    async def delete_salary_structure(
        tenant_id: int,
        structure_uuid: str
    ) -> None:
        """删除薪资结构（软删除）"""
        structure = await SalaryStructure.filter(
            tenant_id=tenant_id,
            uuid=structure_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not structure:
            raise NotFoundError(f"薪资结构 {structure_uuid} 不存在")
        
        from datetime import datetime
        structure.deleted_at = datetime.now()
        await structure.save()


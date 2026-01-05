"""
物料编码映射服务模块

提供物料编码映射的业务逻辑处理，支持外部编码映射到内部编码。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import List, Optional, Dict, Any
from tortoise.expressions import Q
from loguru import logger

from apps.master_data.models.material_code_mapping import MaterialCodeMapping
from apps.master_data.models.material import Material
from apps.master_data.schemas.material_schemas import (
    MaterialCodeMappingCreate,
    MaterialCodeMappingUpdate,
    MaterialCodeMappingResponse,
    MaterialCodeMappingListResponse,
    MaterialCodeConvertRequest,
    MaterialCodeConvertResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MaterialCodeMappingService:
    """
    物料编码映射服务类
    
    提供物料编码映射的 CRUD 操作和编码转换功能。
    """
    
    @staticmethod
    async def create_mapping(
        tenant_id: int,
        data: MaterialCodeMappingCreate
    ) -> MaterialCodeMappingResponse:
        """
        创建物料编码映射
        
        Args:
            tenant_id: 组织ID
            data: 映射创建数据
            
        Returns:
            MaterialCodeMappingResponse: 创建的映射对象
            
        Raises:
            NotFoundError: 当物料不存在时抛出
            ValidationError: 当映射已存在时抛出
        """
        # 验证物料是否存在
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=data.material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError("物料", data.material_uuid)
        
        # 检查映射是否已存在（同一组织、同一外部系统、同一外部编码）
        existing = await MaterialCodeMapping.filter(
            tenant_id=tenant_id,
            external_system=data.external_system,
            external_code=data.external_code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(
                f"外部编码 {data.external_code} 在系统 {data.external_system} 中已存在映射"
            )
        
        # 创建映射
        mapping = await MaterialCodeMapping.create(
            tenant_id=tenant_id,
            material_id=material.id,
            internal_code=data.internal_code,
            external_code=data.external_code,
            external_system=data.external_system,
            description=data.description,
            is_active=data.is_active,
        )
        
        return MaterialCodeMappingResponse.model_validate(mapping)
    
    @staticmethod
    async def get_mapping_by_uuid(
        tenant_id: int,
        mapping_uuid: str
    ) -> MaterialCodeMappingResponse:
        """
        根据UUID获取映射
        
        Args:
            tenant_id: 组织ID
            mapping_uuid: 映射UUID
            
        Returns:
            MaterialCodeMappingResponse: 映射对象
            
        Raises:
            NotFoundError: 当映射不存在时抛出
        """
        mapping = await MaterialCodeMapping.filter(
            tenant_id=tenant_id,
            uuid=mapping_uuid,
            deleted_at__isnull=True
        ).prefetch_related("material").first()
        
        if not mapping:
            raise NotFoundError("物料编码映射", mapping_uuid)
        
        return MaterialCodeMappingResponse.model_validate(mapping)
    
    @staticmethod
    async def list_mappings(
        tenant_id: int,
        material_uuid: Optional[str] = None,
        external_system: Optional[str] = None,
        internal_code: Optional[str] = None,
        external_code: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20
    ) -> MaterialCodeMappingListResponse:
        """
        查询映射列表
        
        Args:
            tenant_id: 组织ID
            material_uuid: 物料UUID（可选）
            external_system: 外部系统名称（可选）
            internal_code: 内部编码（可选）
            external_code: 外部编码（可选）
            is_active: 是否启用（可选）
            page: 页码（默认1）
            page_size: 每页大小（默认20）
            
        Returns:
            MaterialCodeMappingListResponse: 映射列表响应
        """
        # 构建查询条件
        query = MaterialCodeMapping.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        # 物料UUID过滤
        if material_uuid:
            material = await Material.filter(
                tenant_id=tenant_id,
                uuid=material_uuid,
                deleted_at__isnull=True
            ).first()
            if material:
                query = query.filter(material_id=material.id)
            else:
                # 如果物料不存在，返回空列表
                return MaterialCodeMappingListResponse(items=[], total=0)
        
        # 外部系统过滤
        if external_system:
            query = query.filter(external_system=external_system)
        
        # 内部编码过滤
        if internal_code:
            query = query.filter(internal_code__icontains=internal_code)
        
        # 外部编码过滤
        if external_code:
            query = query.filter(external_code__icontains=external_code)
        
        # 启用状态过滤
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        # 获取总数
        total = await query.count()
        
        # 分页查询
        offset = (page - 1) * page_size
        mappings = await query.prefetch_related("material").offset(offset).limit(page_size).all()
        
        items = [MaterialCodeMappingResponse.model_validate(m) for m in mappings]
        
        return MaterialCodeMappingListResponse(items=items, total=total)
    
    @staticmethod
    async def update_mapping(
        tenant_id: int,
        mapping_uuid: str,
        data: MaterialCodeMappingUpdate
    ) -> MaterialCodeMappingResponse:
        """
        更新映射
        
        Args:
            tenant_id: 组织ID
            mapping_uuid: 映射UUID
            data: 映射更新数据
            
        Returns:
            MaterialCodeMappingResponse: 更新后的映射对象
            
        Raises:
            NotFoundError: 当映射不存在时抛出
            ValidationError: 当数据验证失败时抛出
        """
        # 获取映射
        mapping = await MaterialCodeMapping.filter(
            tenant_id=tenant_id,
            uuid=mapping_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not mapping:
            raise NotFoundError("物料编码映射", mapping_uuid)
        
        # 验证物料（如果更新）
        if data.material_uuid is not None:
            material = await Material.filter(
                tenant_id=tenant_id,
                uuid=data.material_uuid,
                deleted_at__isnull=True
            ).first()
            
            if not material:
                raise NotFoundError("物料", data.material_uuid)
            
            mapping.material_id = material.id
        
        # 检查外部编码唯一性（如果更新）
        if data.external_code is not None or data.external_system is not None:
            external_system = data.external_system or mapping.external_system
            external_code = data.external_code or mapping.external_code
            
            existing = await MaterialCodeMapping.filter(
                tenant_id=tenant_id,
                external_system=external_system,
                external_code=external_code,
                deleted_at__isnull=True
            ).exclude(uuid=mapping_uuid).first()
            
            if existing:
                raise ValidationError(
                    f"外部编码 {external_code} 在系统 {external_system} 中已存在映射"
                )
        
        # 更新字段
        update_data = data.model_dump(exclude_unset=True, exclude={"material_uuid"})
        for key, value in update_data.items():
            setattr(mapping, key, value)
        
        await mapping.save()
        
        # 重新加载关联数据
        await mapping.fetch_related("material")
        
        return MaterialCodeMappingResponse.model_validate(mapping)
    
    @staticmethod
    async def delete_mapping(
        tenant_id: int,
        mapping_uuid: str
    ) -> None:
        """
        删除映射（软删除）
        
        Args:
            tenant_id: 组织ID
            mapping_uuid: 映射UUID
            
        Raises:
            NotFoundError: 当映射不存在时抛出
        """
        mapping = await MaterialCodeMapping.filter(
            tenant_id=tenant_id,
            uuid=mapping_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not mapping:
            raise NotFoundError("物料编码映射", mapping_uuid)
        
        # 软删除
        from datetime import datetime
        mapping.deleted_at = datetime.utcnow()
        await mapping.save()
    
    @staticmethod
    async def convert_code(
        tenant_id: int,
        request: MaterialCodeConvertRequest
    ) -> MaterialCodeConvertResponse:
        """
        编码转换（外部编码 -> 内部编码）
        
        Args:
            tenant_id: 组织ID
            request: 编码转换请求
            
        Returns:
            MaterialCodeConvertResponse: 编码转换响应
        """
        # 查找映射
        mapping = await MaterialCodeMapping.filter(
            tenant_id=tenant_id,
            external_system=request.external_system,
            external_code=request.external_code,
            is_active=True,
            deleted_at__isnull=True
        ).prefetch_related("material").first()
        
        if not mapping:
            return MaterialCodeConvertResponse(
                internal_code="",
                material_uuid="",
                material_name="",
                found=False
            )
        
        # 获取物料信息
        material = await Material.get_or_none(id=mapping.material_id)
        if not material:
            return MaterialCodeConvertResponse(
                internal_code="",
                material_uuid="",
                material_name="",
                found=False
            )
        
        return MaterialCodeConvertResponse(
            internal_code=mapping.internal_code,
            material_uuid=material.uuid,
            material_name=material.name,
            found=True
        )
    
    @staticmethod
    async def batch_create_mappings(
        tenant_id: int,
        mappings_data: List[MaterialCodeMappingCreate]
    ) -> Dict[str, Any]:
        """
        批量创建映射
        
        Args:
            tenant_id: 组织ID
            mappings_data: 映射创建数据列表
            
        Returns:
            dict: 批量创建结果（成功数、失败数、错误列表）
        """
        success_count = 0
        failure_count = 0
        errors = []
        
        for idx, data in enumerate(mappings_data, start=1):
            try:
                await MaterialCodeMappingService.create_mapping(
                    tenant_id=tenant_id,
                    data=data
                )
                success_count += 1
            except Exception as e:
                failure_count += 1
                errors.append({
                    "index": idx,
                    "external_code": data.external_code,
                    "external_system": data.external_system,
                    "error": str(e)
                })
                logger.error(f"批量创建映射失败（第{idx}条）: {e}")
        
        return {
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors,
        }


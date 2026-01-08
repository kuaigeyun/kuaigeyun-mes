"""
物料数据服务模块

提供物料数据的业务逻辑处理（物料分组、物料、BOM），支持多组织隔离。
"""

from typing import List, Optional, TYPE_CHECKING
from decimal import Decimal

from tortoise.models import Q
from apps.master_data.models.material import MaterialGroup, Material, BOM
from apps.master_data.schemas.material_schemas import (
    MaterialGroupCreate, MaterialGroupUpdate, MaterialGroupResponse,
    MaterialCreate, MaterialUpdate, MaterialResponse,
    BOMCreate, BOMUpdate, BOMResponse, BOMBatchCreate
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

if TYPE_CHECKING:
    from apps.master_data.schemas.material_schemas import (
        MaterialGroupTreeResponse,
        MaterialTreeResponse
    )


class MaterialService:
    """物料数据服务"""
    
    # ==================== 物料分组相关方法 ====================
    
    @staticmethod
    async def create_material_group(
        tenant_id: int,
        data: MaterialGroupCreate
    ) -> MaterialGroupResponse:
        """
        创建物料分组
        
        Args:
            tenant_id: 租户ID
            data: 物料分组创建数据
            
        Returns:
            MaterialGroupResponse: 创建的物料分组对象
            
        Raises:
            ValidationError: 当编码已存在或父分组不存在时抛出
        """
        # 如果指定了父分组，检查父分组是否存在
        if data.parent_id:
            parent = await MaterialGroup.filter(
                tenant_id=tenant_id,
                id=data.parent_id,
                deleted_at__isnull=True
            ).first()
            
            if not parent:
                raise ValidationError(f"父分组 {data.parent_id} 不存在")
        
        # 检查编码是否已存在
        existing = await MaterialGroup.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"物料分组编码 {data.code} 已存在")
        
        # 创建物料分组
        material_group = await MaterialGroup.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return MaterialGroupResponse.model_validate(material_group)
    
    @staticmethod
    async def get_material_group_by_uuid(
        tenant_id: int,
        group_uuid: str
    ) -> MaterialGroupResponse:
        """
        根据UUID获取物料分组
        
        Args:
            tenant_id: 租户ID
            group_uuid: 物料分组UUID
            
        Returns:
            MaterialGroupResponse: 物料分组对象
            
        Raises:
            NotFoundError: 当物料分组不存在时抛出
        """
        material_group = await MaterialGroup.filter(
            tenant_id=tenant_id,
            uuid=group_uuid,
            deleted_at__isnull=True
        ).prefetch_related("parent").first()
        
        if not material_group:
            raise NotFoundError(f"物料分组 {group_uuid} 不存在")
        
        return MaterialGroupResponse.model_validate(material_group)
    
    @staticmethod
    async def list_material_groups(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        parent_id: Optional[int] = None,
        is_active: Optional[bool] = None
    ) -> List[MaterialGroupResponse]:
        """
        获取物料分组列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            parent_id: 父分组ID（可选，用于过滤）
            is_active: 是否启用（可选）
            
        Returns:
            List[MaterialGroupResponse]: 物料分组列表
        """
        query = MaterialGroup.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if parent_id is not None:
            query = query.filter(parent_id=parent_id)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        # 预加载关联关系（优化，修复500错误）
        material_groups = await query.prefetch_related("process_route").offset(skip).limit(limit).order_by("code").all()
        
        # 构建响应数据（包含process_route_id和process_route_name）
        result = []
        for mg in material_groups:
            try:
                group_data = MaterialGroupResponse.model_validate(mg)
                # 安全地添加process_route_id和process_route_name
                # 优先使用模型的process_route_id字段（如果存在），否则从关联对象获取
                if hasattr(mg, 'process_route_id'):
                    group_data.process_route_id = getattr(mg, 'process_route_id', None)
                elif hasattr(mg, 'process_route') and mg.process_route:
                    group_data.process_route_id = getattr(mg.process_route, 'id', None)
                else:
                    group_data.process_route_id = None
                
                if hasattr(mg, 'process_route') and mg.process_route:
                    group_data.process_route_name = getattr(mg.process_route, 'name', None)
                else:
                    group_data.process_route_name = None
                result.append(group_data)
            except Exception as e:
                # 如果序列化失败，记录错误并跳过
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"序列化物料分组 {mg.id if hasattr(mg, 'id') else 'unknown'} 失败: {str(e)}")
                # 尝试手动构建响应数据
                try:
                    group_dict = {
                        "id": mg.id,
                        "uuid": str(mg.uuid),
                        "tenant_id": mg.tenant_id,
                        "code": mg.code,
                        "name": mg.name,
                        "parent_id": getattr(mg, 'parent_id', None),
                        "description": getattr(mg, 'description', None),
                        "is_active": getattr(mg, 'is_active', True),
                        "created_at": mg.created_at,
                        "updated_at": mg.updated_at,
                        "deleted_at": getattr(mg, 'deleted_at', None),
                        "process_route_id": getattr(mg, 'process_route_id', None) if hasattr(mg, 'process_route_id') else (getattr(mg.process_route, 'id', None) if hasattr(mg, 'process_route') and mg.process_route else None),
                        "process_route_name": getattr(mg.process_route, 'name', None) if hasattr(mg, 'process_route') and mg.process_route else None,
                    }
                    group_data = MaterialGroupResponse.model_validate(group_dict)
                    result.append(group_data)
                except Exception as e2:
                    logger.error(f"手动构建物料分组 {mg.id if hasattr(mg, 'id') else 'unknown'} 响应数据失败: {str(e2)}")
                    # 跳过该分组，继续处理下一个
                    continue
        
        return result
    
    @staticmethod
    async def update_material_group(
        tenant_id: int,
        group_uuid: str,
        data: MaterialGroupUpdate
    ) -> MaterialGroupResponse:
        """
        更新物料分组
        
        Args:
            tenant_id: 租户ID
            group_uuid: 物料分组UUID
            data: 物料分组更新数据
            
        Returns:
            MaterialGroupResponse: 更新后的物料分组对象
            
        Raises:
            NotFoundError: 当物料分组不存在时抛出
            ValidationError: 当编码已存在或父分组不存在时抛出
        """
        material_group = await MaterialGroup.filter(
            tenant_id=tenant_id,
            uuid=group_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material_group:
            raise NotFoundError(f"物料分组 {group_uuid} 不存在")
        
        # 如果更新父分组ID，检查父分组是否存在且不能是自己
        if data.parent_id is not None:
            if data.parent_id == material_group.id:
                raise ValidationError("不能将自己设置为父分组")
            
            if data.parent_id:
                parent = await MaterialGroup.filter(
                    tenant_id=tenant_id,
                    id=data.parent_id,
                    deleted_at__isnull=True
                ).first()
                
                if not parent:
                    raise ValidationError(f"父分组 {data.parent_id} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != material_group.code:
            existing = await MaterialGroup.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"物料分组编码 {data.code} 已存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(material_group, key, value)
        
        await material_group.save()
        
        return MaterialGroupResponse.model_validate(material_group)
    
    @staticmethod
    async def delete_material_group(
        tenant_id: int,
        group_uuid: str
    ) -> None:
        """
        删除物料分组（软删除）
        
        Args:
            tenant_id: 租户ID
            group_uuid: 物料分组UUID
            
        Raises:
            NotFoundError: 当物料分组不存在时抛出
            ValidationError: 当分组下有关联的子分组或物料时抛出
        """
        material_group = await MaterialGroup.filter(
            tenant_id=tenant_id,
            uuid=group_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material_group:
            raise NotFoundError(f"物料分组 {group_uuid} 不存在")
        
        # 检查是否有关联的子分组
        children_count = await MaterialGroup.filter(
            tenant_id=tenant_id,
            parent_id=material_group.id,
            deleted_at__isnull=True
        ).count()
        
        if children_count > 0:
            raise ValidationError(f"物料分组下存在 {children_count} 个子分组，无法删除")
        
        # 检查是否有关联的物料
        materials_count = await Material.filter(
            tenant_id=tenant_id,
            group_id=material_group.id,
            deleted_at__isnull=True
        ).count()
        
        if materials_count > 0:
            raise ValidationError(f"物料分组下存在 {materials_count} 个物料，无法删除")
        
        # 软删除
        from tortoise import timezone
        material_group.deleted_at = timezone.now()
        await material_group.save()
    
    # ==================== 物料相关方法 ====================
    
    @staticmethod
    async def create_material(
        tenant_id: int,
        data: MaterialCreate
    ) -> MaterialResponse:
        """
        创建物料
        
        Args:
            tenant_id: 租户ID
            data: 物料创建数据
            
        Returns:
            MaterialResponse: 创建的物料对象
            
        Raises:
            ValidationError: 当编码已存在或分组不存在时抛出
        """
        # 如果指定了分组，检查分组是否存在
        if data.group_id:
            group = await MaterialGroup.filter(
                tenant_id=tenant_id,
                id=data.group_id,
                deleted_at__isnull=True
            ).first()
            
            if not group:
                raise ValidationError(f"物料分组 {data.group_id} 不存在")
        
        # 检查编码是否已存在
        existing = await Material.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"物料编码 {data.code} 已存在")
        
        # 创建物料
        material = await Material.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return MaterialResponse.model_validate(material)
    
    @staticmethod
    async def get_material_by_uuid(
        tenant_id: int,
        material_uuid: str
    ) -> MaterialResponse:
        """
        根据UUID获取物料
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            
        Returns:
            MaterialResponse: 物料对象
            
        Raises:
            NotFoundError: 当物料不存在时抛出
        """
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).prefetch_related("group").first()
        
        if not material:
            raise NotFoundError(f"物料 {material_uuid} 不存在")
        
        return MaterialResponse.model_validate(material)
    
    @staticmethod
    async def list_materials(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        group_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        code: Optional[str] = None,
        name: Optional[str] = None
    ) -> List[MaterialResponse]:
        """
        获取物料列表

        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            group_id: 物料分组ID（可选，用于过滤）
            is_active: 是否启用（可选）
            keyword: 搜索关键词（物料编码或名称）
            code: 物料编码（精确匹配）
            name: 物料名称（模糊匹配）

        Returns:
            List[MaterialResponse]: 物料列表
        """
        query = Material.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if group_id is not None:
            query = query.filter(group_id=group_id)

        if is_active is not None:
            query = query.filter(is_active=is_active)

        # 添加搜索条件
        if keyword:
            # 关键词搜索物料编码或名称
            query = query.filter(
                Q(code__icontains=keyword) | Q(name__icontains=keyword)
            )

        if code:
            # 精确匹配物料编码
            query = query.filter(code__icontains=code)

        if name:
            # 模糊匹配物料名称
            query = query.filter(name__icontains=name)
        
        # 预加载关联关系（优化，修复500错误）
        materials = await query.prefetch_related("group", "process_route").offset(skip).limit(limit).order_by("code").all()
        
        # 构建响应数据（包含process_route_id和process_route_name）
        result = []
        for m in materials:
            try:
                material_data = MaterialResponse.model_validate(m)
                # 安全地添加process_route_id和process_route_name
                # 优先使用模型的process_route_id字段（如果存在），否则从关联对象获取
                if hasattr(m, 'process_route_id'):
                    material_data.process_route_id = getattr(m, 'process_route_id', None)
                elif hasattr(m, 'process_route') and m.process_route:
                    material_data.process_route_id = getattr(m.process_route, 'id', None)
                else:
                    material_data.process_route_id = None
                
                if hasattr(m, 'process_route') and m.process_route:
                    material_data.process_route_name = getattr(m.process_route, 'name', None)
                else:
                    material_data.process_route_name = None
                result.append(material_data)
            except Exception as e:
                # 如果序列化失败，记录错误并尝试手动构建
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"序列化物料 {m.id if hasattr(m, 'id') else 'unknown'} 失败: {str(e)}")
                # 尝试手动构建响应数据
                try:
                    material_dict = {
                        "id": m.id,
                        "uuid": str(m.uuid),
                        "tenant_id": m.tenant_id,
                        "code": m.code,
                        "name": m.name,
                        "group_id": m.group_id,
                        "specification": getattr(m, 'specification', None),
                        "base_unit": m.base_unit,
                        "units": getattr(m, 'units', None),
                        "batch_managed": getattr(m, 'batch_managed', False),
                        "variant_managed": getattr(m, 'variant_managed', False),
                        "variant_attributes": getattr(m, 'variant_attributes', None),
                        "description": getattr(m, 'description', None),
                        "brand": getattr(m, 'brand', None),
                        "model": getattr(m, 'model', None),
                        "is_active": getattr(m, 'is_active', True),
                        "created_at": m.created_at,
                        "updated_at": m.updated_at,
                        "deleted_at": getattr(m, 'deleted_at', None),
                        "process_route_id": getattr(m.process_route, 'id', None) if hasattr(m, 'process_route') and m.process_route else None,
                        "process_route_name": getattr(m.process_route, 'name', None) if hasattr(m, 'process_route') and m.process_route else None,
                    }
                    material_data = MaterialResponse.model_validate(material_dict)
                    result.append(material_data)
                except Exception as e2:
                    logger.error(f"手动构建物料 {m.id if hasattr(m, 'id') else 'unknown'} 响应数据失败: {str(e2)}")
                    # 跳过该物料，继续处理下一个
                    continue
        
        return result
    
    @staticmethod
    async def update_material(
        tenant_id: int,
        material_uuid: str,
        data: MaterialUpdate
    ) -> MaterialResponse:
        """
        更新物料
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            data: 物料更新数据
            
        Returns:
            MaterialResponse: 更新后的物料对象
            
        Raises:
            NotFoundError: 当物料不存在时抛出
            ValidationError: 当编码已存在或分组不存在时抛出
        """
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError(f"物料 {material_uuid} 不存在")
        
        # 如果更新分组ID，检查分组是否存在
        if data.group_id is not None and data.group_id != material.group_id:
            if data.group_id:
                group = await MaterialGroup.filter(
                    tenant_id=tenant_id,
                    id=data.group_id,
                    deleted_at__isnull=True
                ).first()
                
                if not group:
                    raise ValidationError(f"物料分组 {data.group_id} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != material.code:
            existing = await Material.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"物料编码 {data.code} 已存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(material, key, value)
        
        await material.save()
        
        return MaterialResponse.model_validate(material)
    
    @staticmethod
    async def delete_material(
        tenant_id: int,
        material_uuid: str
    ) -> None:
        """
        删除物料（软删除）
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            
        Raises:
            NotFoundError: 当物料不存在时抛出
            ValidationError: 当物料被BOM使用时抛出
        """
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError(f"物料 {material_uuid} 不存在")
        
        # 检查是否被BOM使用（作为主物料或子物料）
        bom_as_material_count = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material.id,
            deleted_at__isnull=True
        ).count()
        
        bom_as_component_count = await BOM.filter(
            tenant_id=tenant_id,
            component_id=material.id,
            deleted_at__isnull=True
        ).count()
        
        if bom_as_material_count > 0 or bom_as_component_count > 0:
            raise ValidationError(f"物料被 {bom_as_material_count + bom_as_component_count} 个BOM使用，无法删除")
        
        # 软删除
        from tortoise import timezone
        material.deleted_at = timezone.now()
        await material.save()
    
    # ==================== BOM相关方法 ====================
    
    @staticmethod
    async def create_bom(
        tenant_id: int,
        data: BOMCreate
    ) -> BOMResponse:
        """
        创建BOM（单个）
        
        Args:
            tenant_id: 租户ID
            data: BOM创建数据
            
        Returns:
            BOMResponse: 创建的BOM对象
            
        Raises:
            ValidationError: 当主物料或子物料不存在时抛出
        """
        # 检查主物料是否存在
        material = await Material.filter(
            tenant_id=tenant_id,
            id=data.material_id,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise ValidationError(f"主物料 {data.material_id} 不存在")
        
        # 检查子物料是否存在
        component = await Material.filter(
            tenant_id=tenant_id,
            id=data.component_id,
            deleted_at__isnull=True
        ).first()
        
        if not component:
            raise ValidationError(f"子物料 {data.component_id} 不存在")
        
        # 检查主物料和子物料不能相同
        if data.material_id == data.component_id:
            raise ValidationError("主物料和子物料不能相同")
        
        # 创建BOM
        bom = await BOM.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return BOMResponse.model_validate(bom)
    
    @staticmethod
    async def create_bom_batch(
        tenant_id: int,
        data: BOMBatchCreate
    ) -> List[BOMResponse]:
        """
        批量创建BOM（为一个主物料添加多个子物料）
        
        Args:
            tenant_id: 租户ID
            data: 批量创建BOM数据
            
        Returns:
            List[BOMResponse]: 创建的BOM对象列表
            
        Raises:
            ValidationError: 当主物料或子物料不存在时抛出
        """
        # 检查主物料是否存在
        material = await Material.filter(
            tenant_id=tenant_id,
            id=data.material_id,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise ValidationError(f"主物料 {data.material_id} 不存在")
        
        # 检查所有子物料是否存在，并检查主物料和子物料不能相同
        component_ids = [item.component_id for item in data.items]
        components = await Material.filter(
            tenant_id=tenant_id,
            id__in=component_ids,
            deleted_at__isnull=True
        )
        
        found_component_ids = {c.id for c in components}
        missing_ids = set(component_ids) - found_component_ids
        if missing_ids:
            raise ValidationError(f"子物料 {missing_ids} 不存在")
        
        # 检查主物料和子物料不能相同
        if data.material_id in component_ids:
            raise ValidationError("主物料和子物料不能相同")
        
        # 自动生成BOM编码（如果未提供）
        if not data.bom_code:
            material = await Material.filter(
                tenant_id=tenant_id,
                id=data.material_id,
                deleted_at__isnull=True
            ).first()
            if material:
                # 使用物料编码作为BOM编码前缀
                from datetime import datetime
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                data.bom_code = f"BOM-{material.code}-{timestamp}"
        
        # 批量创建BOM
        bom_list = []
        for item in data.items:
            bom = await BOM.create(
                tenant_id=tenant_id,
                material_id=data.material_id,
                component_id=item.component_id,
                quantity=item.quantity,
                unit=item.unit,
                version=data.version,
                bom_code=data.bom_code,
                effective_date=data.effective_date,
                expiry_date=data.expiry_date,
                approval_status=data.approval_status,
                is_alternative=item.is_alternative,
                alternative_group_id=item.alternative_group_id,
                priority=item.priority,
                description=data.description,
                remark=item.remark or data.remark,
                is_active=data.is_active,
            )
            bom_list.append(bom)
        
        return [BOMResponse.model_validate(bom) for bom in bom_list]
    
    @staticmethod
    async def get_bom_by_uuid(
        tenant_id: int,
        bom_uuid: str
    ) -> BOMResponse:
        """
        根据UUID获取BOM
        
        Args:
            tenant_id: 租户ID
            bom_uuid: BOM UUID
            
        Returns:
            BOMResponse: BOM对象
            
        Raises:
            NotFoundError: 当BOM不存在时抛出
        """
        bom = await BOM.filter(
            tenant_id=tenant_id,
            uuid=bom_uuid,
            deleted_at__isnull=True
        ).prefetch_related("material", "component").first()
        
        if not bom:
            raise NotFoundError(f"BOM {bom_uuid} 不存在")
        
        return BOMResponse.model_validate(bom)
    
    @staticmethod
    async def list_bom(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        material_id: Optional[int] = None,
        is_active: Optional[bool] = None
    ) -> List[BOMResponse]:
        """
        获取BOM列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            material_id: 主物料ID（可选，用于过滤）
            is_active: 是否启用（可选）
            
        Returns:
            List[BOMResponse]: BOM列表
        """
        query = BOM.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if material_id is not None:
            query = query.filter(material_id=material_id)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        bom_list = await query.offset(skip).limit(limit).order_by("priority", "id").all()
        
        return [BOMResponse.model_validate(b) for b in bom_list]
    
    @staticmethod
    async def update_bom(
        tenant_id: int,
        bom_uuid: str,
        data: BOMUpdate
    ) -> BOMResponse:
        """
        更新BOM
        
        Args:
            tenant_id: 租户ID
            bom_uuid: BOM UUID
            data: BOM更新数据
            
        Returns:
            BOMResponse: 更新后的BOM对象
            
        Raises:
            NotFoundError: 当BOM不存在时抛出
            ValidationError: 当主物料或子物料不存在时抛出
        """
        bom = await BOM.filter(
            tenant_id=tenant_id,
            uuid=bom_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not bom:
            raise NotFoundError(f"BOM {bom_uuid} 不存在")
        
        # 如果更新主物料ID，检查主物料是否存在
        if data.material_id and data.material_id != bom.material_id:
            material = await Material.filter(
                tenant_id=tenant_id,
                id=data.material_id,
                deleted_at__isnull=True
            ).first()
            
            if not material:
                raise ValidationError(f"主物料 {data.material_id} 不存在")
        
        # 如果更新子物料ID，检查子物料是否存在
        if data.component_id and data.component_id != bom.component_id:
            component = await Material.filter(
                tenant_id=tenant_id,
                id=data.component_id,
                deleted_at__isnull=True
            ).first()
            
            if not component:
                raise ValidationError(f"子物料 {data.component_id} 不存在")
        
        # 检查主物料和子物料不能相同
        material_id = data.material_id if data.material_id else bom.material_id
        component_id = data.component_id if data.component_id else bom.component_id
        
        if material_id == component_id:
            raise ValidationError("主物料和子物料不能相同")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(bom, key, value)
        
        await bom.save()
        
        return BOMResponse.model_validate(bom)
    
    @staticmethod
    async def delete_bom(
        tenant_id: int,
        bom_uuid: str
    ) -> None:
        """
        删除BOM（软删除）
        
        Args:
            tenant_id: 租户ID
            bom_uuid: BOM UUID
            
        Raises:
            NotFoundError: 当BOM不存在时抛出
        """
        bom = await BOM.filter(
            tenant_id=tenant_id,
            uuid=bom_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not bom:
            raise NotFoundError(f"BOM {bom_uuid} 不存在")
        
        # 软删除
        from tortoise import timezone
        bom.deleted_at = timezone.now()
        await bom.save()
    
    @staticmethod
    async def approve_bom(
        tenant_id: int,
        bom_uuid: str,
        approved_by: int,
        approval_comment: Optional[str] = None,
        approved: bool = True
    ) -> BOMResponse:
        """
        审核BOM
        
        Args:
            tenant_id: 租户ID
            bom_uuid: BOM UUID
            approved_by: 审核人ID
            approval_comment: 审核意见
            approved: 是否通过（True=通过，False=拒绝）
            
        Returns:
            BOMResponse: 审核后的BOM对象
            
        Raises:
            NotFoundError: 当BOM不存在时抛出
        """
        bom = await BOM.filter(
            tenant_id=tenant_id,
            uuid=bom_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not bom:
            raise NotFoundError(f"BOM {bom_uuid} 不存在")
        
        from tortoise import timezone
        bom.approval_status = "approved" if approved else "rejected"
        bom.approved_by = approved_by
        bom.approved_at = timezone.now()
        bom.approval_comment = approval_comment
        
        await bom.save()
        
        return BOMResponse.model_validate(bom)
    
    @staticmethod
    async def copy_bom(
        tenant_id: int,
        bom_uuid: str,
        new_version: Optional[str] = None
    ) -> BOMResponse:
        """
        复制BOM（创建新版本）
        
        Args:
            tenant_id: 租户ID
            bom_uuid: 源BOM UUID
            new_version: 新版本号（可选，如果不提供则自动递增）
            
        Returns:
            BOMResponse: 新创建的BOM对象
            
        Raises:
            NotFoundError: 当BOM不存在时抛出
        """
        source_bom = await BOM.filter(
            tenant_id=tenant_id,
            uuid=bom_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not source_bom:
            raise NotFoundError(f"BOM {bom_uuid} 不存在")
        
        # 如果没有指定新版本号，自动递增
        if not new_version:
            # 查找同一BOM编码的所有版本
            if source_bom.bom_code:
                existing_versions = await BOM.filter(
                    tenant_id=tenant_id,
                    bom_code=source_bom.bom_code,
                    deleted_at__isnull=True
                ).values_list("version", flat=True)
                
                # 简单的版本递增逻辑（可以后续优化）
                try:
                    current_version = float(source_bom.version)
                    new_version = str(current_version + 0.1)
                except:
                    new_version = f"{source_bom.version}.1"
            else:
                new_version = "1.0"
        
        # 创建新的BOM
        new_bom = await BOM.create(
            tenant_id=tenant_id,
            material_id=source_bom.material_id,
            component_id=source_bom.component_id,
            quantity=source_bom.quantity,
            unit=source_bom.unit,
            version=new_version,
            bom_code=source_bom.bom_code,
            effective_date=source_bom.effective_date,
            expiry_date=source_bom.expiry_date,
            approval_status="draft",  # 新版本默认为草稿
            is_alternative=source_bom.is_alternative,
            alternative_group_id=source_bom.alternative_group_id,
            priority=source_bom.priority,
            description=source_bom.description,
            remark=source_bom.remark,
            is_active=source_bom.is_active,
        )
        
        return BOMResponse.model_validate(new_bom)
    
    @staticmethod
    async def get_bom_by_material(
        tenant_id: int,
        material_id: int,
        version: Optional[str] = None,
        only_active: bool = True
    ) -> List[BOMResponse]:
        """
        根据主物料获取BOM列表（支持版本过滤）
        
        Args:
            tenant_id: 租户ID
            material_id: 主物料ID
            version: 版本号（可选）
            only_active: 是否只返回已审核的BOM
            
        Returns:
            List[BOMResponse]: BOM列表
        """
        query = BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True
        )
        
        if version:
            query = query.filter(version=version)
        
        if only_active:
            query = query.filter(approval_status="approved", is_active=True)
        
        bom_list = await query.order_by("priority", "id").all()
        
        return [BOMResponse.model_validate(b) for b in bom_list]
    
    @staticmethod
    async def get_bom_versions(
        tenant_id: int,
        bom_code: str
    ) -> List[BOMResponse]:
        """
        获取指定BOM编码的所有版本
        
        Args:
            tenant_id: 租户ID
            bom_code: BOM编码
            
        Returns:
            List[BOMResponse]: BOM版本列表
        """
        bom_list = await BOM.filter(
            tenant_id=tenant_id,
            bom_code=bom_code,
            deleted_at__isnull=True
        ).order_by("-version").all()
        
        return [BOMResponse.model_validate(b) for b in bom_list]
    
    # ==================== 级联查询相关方法 ====================
    
    @staticmethod
    async def get_material_group_tree(
        tenant_id: int,
        is_active: Optional[bool] = None
    ) -> List["MaterialGroupTreeResponse"]:
        """
        获取物料分组树形结构（物料分组→物料）
        
        返回完整的物料分组层级结构，支持多级分组，用于级联选择等场景。
        
        Args:
            tenant_id: 租户ID
            is_active: 是否只查询启用的数据（可选）
            
        Returns:
            List[MaterialGroupTreeResponse]: 物料分组树形列表，每个分组包含子分组列表和物料列表
        """
        # 延迟导入避免循环依赖
        from apps.master_data.schemas.material_schemas import (
            MaterialGroupTreeResponse,
            MaterialTreeResponse
        )
        
        # 查询所有物料分组（预加载关联关系，修复500错误）
        group_query = MaterialGroup.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if is_active is not None:
            group_query = group_query.filter(is_active=is_active)
        
        groups = await group_query.prefetch_related("process_route").order_by("code").all()
        
        # 查询所有物料
        material_query = Material.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if is_active is not None:
            material_query = material_query.filter(is_active=is_active)
        
        # 预加载关联关系（优化，修复500错误）
        materials = await material_query.prefetch_related("group", "process_route").order_by("code").all()
        
        # 构建物料映射（按分组ID分组）
        material_map: dict[Optional[int], List[MaterialTreeResponse]] = {}
        for material in materials:
            group_id = material.group_id
            if group_id not in material_map:
                material_map[group_id] = []
            # 构建物料响应数据（包含process_route_id和process_route_name）
            try:
                material_data = MaterialTreeResponse.model_validate(material)
                # 安全地设置process_route字段
                # 优先使用模型的process_route_id字段（如果存在），否则从关联对象获取
                if hasattr(material, 'process_route_id'):
                    material_data.process_route_id = getattr(material, 'process_route_id', None)
                elif hasattr(material, 'process_route') and material.process_route:
                    material_data.process_route_id = getattr(material.process_route, 'id', None)
                else:
                    material_data.process_route_id = None
                
                if hasattr(material, 'process_route') and material.process_route:
                    material_data.process_route_name = getattr(material.process_route, 'name', None)
                else:
                    material_data.process_route_name = None
                material_map[group_id].append(material_data)
            except Exception as e:
                # 如果序列化失败，记录错误并尝试手动构建
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"序列化物料 {material.id if hasattr(material, 'id') else 'unknown'} 失败: {str(e)}")
                # 尝试手动构建响应数据
                try:
                    material_dict = {
                        "id": material.id,
                        "uuid": str(material.uuid),
                        "tenant_id": material.tenant_id,
                        "code": material.code,
                        "name": material.name,
                        "group_id": material.group_id,
                        "specification": getattr(material, 'specification', None),
                        "base_unit": material.base_unit,
                        "units": getattr(material, 'units', None),
                        "batch_managed": getattr(material, 'batch_managed', False),
                        "variant_managed": getattr(material, 'variant_managed', False),
                        "variant_attributes": getattr(material, 'variant_attributes', None),
                        "description": getattr(material, 'description', None),
                        "brand": getattr(material, 'brand', None),
                        "model": getattr(material, 'model', None),
                        "is_active": getattr(material, 'is_active', True),
                        "created_at": material.created_at,
                        "updated_at": material.updated_at,
                        "deleted_at": getattr(material, 'deleted_at', None),
                        "process_route_id": getattr(material.process_route, 'id', None) if hasattr(material, 'process_route') and material.process_route else None,
                        "process_route_name": getattr(material.process_route, 'name', None) if hasattr(material, 'process_route') and material.process_route else None,
                    }
                    material_data = MaterialTreeResponse.model_validate(material_dict)
                    material_map[group_id].append(material_data)
                except Exception as e2:
                    logger.error(f"手动构建物料 {material.id if hasattr(material, 'id') else 'unknown'} 响应数据失败: {str(e2)}")
                    # 跳过该物料，继续处理下一个
                    continue
        
        # 构建分组映射（按父分组ID分组）
        group_map: dict[Optional[int], List[MaterialGroupTreeResponse]] = {}
        for group in groups:
            parent_id = group.parent_id
            if parent_id not in group_map:
                group_map[parent_id] = []
            
            # 获取该分组的物料列表
            group_materials = material_map.get(group.id, [])
            
            # 创建分组响应对象（包含物料列表，子分组稍后添加）
            # 使用 model_validate 创建响应对象，然后手动设置 children 和 materials
            group_dict = {
                "id": group.id,
                "uuid": group.uuid,
                "tenant_id": group.tenant_id,
                "code": group.code,
                "name": group.name,
                "parent_id": group.parent_id,
                "description": group.description,
                "is_active": group.is_active,
                "created_at": group.created_at,
                "updated_at": group.updated_at,
                "deleted_at": group.deleted_at,
                "children": [],  # 先初始化为空，稍后递归填充
                "materials": group_materials,
                # 添加process_route_id和process_route_name（修复500错误）
                # 注意：使用getattr安全访问，避免字段不存在时出错
                "process_route_id": getattr(group, 'process_route_id', None) if hasattr(group, 'process_route_id') else (getattr(group.process_route, 'id', None) if hasattr(group, 'process_route') and group.process_route else None),
                "process_route_name": getattr(group.process_route, 'name', None) if hasattr(group, 'process_route') and group.process_route else None,
            }
            group_response = MaterialGroupTreeResponse.model_validate(group_dict)
            group_map[parent_id].append(group_response)
        
        # 递归构建分组树形结构
        def build_tree(parent_id: Optional[int]) -> List[MaterialGroupTreeResponse]:
            """递归构建分组树"""
            result: List[MaterialGroupTreeResponse] = []
            if parent_id not in group_map:
                return result
            
            for group_response in group_map[parent_id]:
                # 递归获取子分组
                group_response.children = build_tree(group_response.id)
                result.append(group_response)
            
            return result
        
        # 从根分组（parent_id 为 None）开始构建树
        return build_tree(None)


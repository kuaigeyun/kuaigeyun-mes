"""
物料数据服务模块

提供物料数据的业务逻辑处理（物料分组、物料、BOM），支持多组织隔离。
"""

from typing import List, Optional, TYPE_CHECKING
from decimal import Decimal
import json

from tortoise.models import Q
from apps.master_data.models.material import MaterialGroup, Material, BOM
from apps.master_data.models.material_code_alias import MaterialCodeAlias
from apps.master_data.services.material_code_service import MaterialCodeService
from apps.master_data.schemas.material_schemas import (
    MaterialGroupCreate, MaterialGroupUpdate, MaterialGroupResponse,
    MaterialCreate, MaterialUpdate, MaterialResponse,
    BOMCreate, BOMUpdate, BOMResponse, BOMBatchCreate
)
from core.services.business.code_generation_service import CodeGenerationService
from core.config.code_rule_pages import CODE_RULE_PAGES
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger

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
        # 如果指定了分组，检查分组是否存在并获取分组信息
        group = None
        if data.group_id:
            group = await MaterialGroup.filter(
                tenant_id=tenant_id,
                id=data.group_id,
                deleted_at__isnull=True
            ).first()
            
            if not group:
                raise ValidationError(f"物料分组 {data.group_id} 不存在")
        
        # 生成主编码（如果未提供）
        if not data.main_code:
            # 首先尝试使用编码规则生成编码
            material_page_config = next(
                (page for page in CODE_RULE_PAGES if page.get("page_code") == "master-data-material"),
                None
            )
            
            if material_page_config and material_page_config.get("rule_code"):
                try:
                    # 构建上下文变量，包含物料分组编码等字段值
                    context = {}
                    
                    # 如果指定了分组，添加分组信息到上下文
                    if group:
                        context["group_code"] = group.code
                        context["group_name"] = group.name
                    
                    # 添加物料类型
                    context["material_type"] = data.material_type
                    
                    # 添加物料名称（如果需要）
                    context["name"] = data.name
                    
                    # 使用编码规则生成编码
                    data.main_code = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code=material_page_config["rule_code"],
                        context=context
                    )
                    logger.info(f"使用编码规则生成物料主编码: {data.main_code}")
                except Exception as e:
                    # 如果编码规则生成失败，回退到默认生成方式
                    logger.warning(f"使用编码规则生成物料编码失败: {e}，回退到默认生成方式")
                    data.main_code = await MaterialCodeService.generate_main_code(
                        tenant_id=tenant_id,
                        material_type=data.material_type
                    )
            else:
                # 如果没有配置编码规则，使用默认生成方式
                data.main_code = await MaterialCodeService.generate_main_code(
                    tenant_id=tenant_id,
                    material_type=data.material_type
                )
        
        # 变体管理相关验证
        master_material = None
        if data.variant_managed and data.variant_attributes:
            # 如果是变体物料，需要找到主物料
            # 主物料：variant_managed=True, variant_attributes=null
            master_material = await Material.filter(
                tenant_id=tenant_id,
                main_code=data.main_code,
                variant_managed=True,
                variant_attributes__isnull=True,  # 主物料的variant_attributes为null
                deleted_at__isnull=True
            ).first()
            
            if not master_material:
                raise ValidationError(
                    f"变体物料必须关联到已存在的主物料。主编码 {data.main_code} 对应的主物料不存在。"
                    f"请先创建主物料（variant_managed=True, variant_attributes=null）"
                )
            
            # 验证变体属性值
            from core.services.business.material_variant_attribute_service import MaterialVariantAttributeService
            for attr_name, attr_value in data.variant_attributes.items():
                is_valid, error_message = await MaterialVariantAttributeService.validate_variant_attribute_value(
                    tenant_id=tenant_id,
                    attribute_name=attr_name,
                    attribute_value=attr_value,
                )
                if not is_valid:
                    raise ValidationError(f"变体属性验证失败: {error_message}")
            
            # 检查变体组合唯一性（同一主物料下，相同的属性组合必须唯一）
            # 注意：PostgreSQL的JSONB字段比较是精确匹配，需要确保属性顺序一致
            # 使用排序后的JSON字符串进行比较，确保键顺序一致
            variant_attributes_json = json.dumps(data.variant_attributes, sort_keys=True)
            
            # 查询该主物料的所有变体（variant_managed=True, variant_attributes不为null）
            existing_variants = await Material.filter(
                tenant_id=tenant_id,
                main_code=data.main_code,
                variant_managed=True,
                variant_attributes__isnull=False,  # 只查询变体物料，不包括主物料
                deleted_at__isnull=True
            ).all()
            
            # 检查是否有相同的变体属性组合
            for existing in existing_variants:
                if existing.variant_attributes:
                    # 使用排序后的JSON字符串进行比较，确保键顺序一致
                    existing_attrs_json = json.dumps(existing.variant_attributes, sort_keys=True)
                    if existing_attrs_json == variant_attributes_json:
                        raise ValidationError(
                            f"变体属性组合已存在: {data.variant_attributes}，"
                            f"已存在的物料: {existing.name} ({existing.main_code})"
                        )
        else:
            # 如果不是变体物料，检查主编码是否已存在（主编码必须唯一，除非是变体物料）
            existing = await Material.filter(
                tenant_id=tenant_id,
                main_code=data.main_code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                # 如果已存在的物料是主物料（variant_managed=True, variant_attributes=null）
                # 则允许创建变体，但当前逻辑不允许创建非变体物料
                if existing.variant_managed and existing.variant_attributes is None:
                    raise ValidationError(
                        f"主编码 {data.main_code} 已存在主物料。"
                        f"如需创建变体，请设置 variant_managed=True 并提供 variant_attributes"
                    )
                else:
                    raise ValidationError(f"主编码 {data.main_code} 已存在")
        
        # 智能识别重复物料
        duplicates = await MaterialCodeService.find_duplicate_materials(
            tenant_id=tenant_id,
            name=data.name,
            specification=data.specification,
            base_unit=data.base_unit
        )
        
        # 如果有高置信度的重复物料，记录警告（但不阻止创建）
        if duplicates:
            high_confidence_duplicates = [d for d in duplicates if d["confidence"] == "high"]
            if high_confidence_duplicates:
                logger.warning(
                    f"检测到高置信度重复物料: {data.name}，"
                    f"可能重复的物料: {[d['material'].main_code for d in high_confidence_duplicates]}"
                )
        
        # 准备创建数据
        # 使用 model_dump 方法（Pydantic v2）或 dict 方法（Pydantic v1）
        if hasattr(data, 'model_dump'):
            material_data = data.model_dump(exclude={"department_codes", "customer_codes", "supplier_codes", "defaults"})
        else:
            material_data = data.dict(exclude={"department_codes", "customer_codes", "supplier_codes", "defaults"})
        # 兼容处理：如果提供了code但没有main_code，将code作为main_code（向后兼容）
        if not material_data.get("main_code") and material_data.get("code"):
            material_data["main_code"] = material_data["code"]
        
        # 处理变体属性：确保JSON键顺序一致（用于数据库唯一性索引）
        if material_data.get("variant_attributes"):
            # 使用排序后的JSON，确保键顺序一致
            sorted_attrs = dict(sorted(material_data["variant_attributes"].items()))
            material_data["variant_attributes"] = sorted_attrs
        
        # 处理默认值
        if data.defaults:
            material_data["defaults"] = data.defaults
        
        # 创建物料
        material = await Material.create(
            tenant_id=tenant_id,
            **material_data
        )
        
        # 如果是变体物料，自动生成变体编码并作为部门编码（类型：VARIANT）存储
        if data.variant_managed and data.variant_attributes and master_material:
            try:
                # 生成变体标识（简化版本：使用属性值的首字母或缩写）
                # TODO: 后续可以通过变体编码规则配置来生成更复杂的变体标识
                variant_parts = []
                for attr_name, attr_value in sorted(data.variant_attributes.items()):
                    # 简化处理：如果是枚举值，使用前3个字符；如果是文本，使用前3个字符；如果是数字，直接使用
                    if isinstance(attr_value, (int, float)):
                        variant_parts.append(str(attr_value))
                    elif isinstance(attr_value, str):
                        # 如果是中文，取前2个字符；如果是英文，取前3个字符并转大写
                        if any('\u4e00' <= char <= '\u9fff' for char in attr_value):
                            variant_parts.append(attr_value[:2])
                        else:
                            variant_parts.append(attr_value[:3].upper())
                    else:
                        variant_parts.append(str(attr_value)[:3].upper())
                
                variant_suffix = "-".join(variant_parts)
                variant_code = f"{material.main_code}-{variant_suffix}"
                
                # 将变体编码作为部门编码（类型：VARIANT）存储
                await MaterialCodeService.create_code_alias(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    code_type="VARIANT",
                    code=variant_code,
                    description=f"变体编码：{', '.join([f'{k}={v}' for k, v in sorted(data.variant_attributes.items())])}"
                )
                logger.info(f"自动生成变体编码: {variant_code} (material_id={material.id})")
            except Exception as e:
                # 如果变体编码生成失败，记录警告但不阻止创建
                logger.warning(f"生成变体编码失败: {e}")
        
        # 创建部门编码别名（如果提供了部门编码）
        if data.department_codes:
            for alias_data in data.department_codes:
                try:
                    await MaterialCodeService.create_code_alias(
                        tenant_id=tenant_id,
                        material_id=material.id,
                        code_type=alias_data.get("code_type", "CUSTOM"),
                        code=alias_data.get("code"),
                        department=alias_data.get("department"),
                        description=alias_data.get("description"),
                        is_primary=alias_data.get("is_primary", False)
                    )
                except ValidationError as e:
                    # 如果编码已存在，记录警告但不阻止创建
                    logger.warning(f"创建编码别名失败: {e}")
        
        # 创建客户编码别名（如果提供了客户编码）
        if data.customer_codes:
            for customer_code_data in data.customer_codes:
                try:
                    await MaterialCodeService.create_code_alias(
                        tenant_id=tenant_id,
                        material_id=material.id,
                        code_type="CUSTOMER",
                        code=customer_code_data.get("code"),
                        description=customer_code_data.get("description"),
                        external_entity_type="customer",
                        external_entity_id=customer_code_data.get("customer_id")
                    )
                except ValidationError as e:
                    logger.warning(f"创建客户编码别名失败: {e}")
        
        # 创建供应商编码别名（如果提供了供应商编码）
        if data.supplier_codes:
            for supplier_code_data in data.supplier_codes:
                try:
                    await MaterialCodeService.create_code_alias(
                        tenant_id=tenant_id,
                        material_id=material.id,
                        code_type="SUPPLIER",
                        code=supplier_code_data.get("code"),
                        description=supplier_code_data.get("description"),
                        external_entity_type="supplier",
                        external_entity_id=supplier_code_data.get("supplier_id")
                    )
                except ValidationError as e:
                    logger.warning(f"创建供应商编码别名失败: {e}")
        
        # 加载编码别名
        aliases = await MaterialCodeService.get_material_aliases(
            tenant_id=tenant_id,
            material_id=material.id
        )
        
        # 构建响应
        from apps.master_data.schemas.material_schemas import MaterialCodeAliasResponse
        response = MaterialResponse.model_validate(material)
        response.code_aliases = [MaterialCodeAliasResponse.model_validate(alias) for alias in aliases]
        # 确保defaults字段被包含在响应中
        if hasattr(material, 'defaults'):
            response.defaults = material.defaults
        
        # 发送 Inngest 事件，触发 AI 建议工作流（异步处理）
        try:
            from core.inngest.client import inngest_client
            from inngest import Event
            
            await inngest_client.send_event(
                event=Event(
                    name="material/created",
                    data={
                        "tenant_id": tenant_id,
                        "material_id": material.id,
                        "material_uuid": str(material.uuid),
                        "material_name": material.name,
                        "material_type": material.material_type,
                        "specification": material.specification,
                        "base_unit": material.base_unit,
                    }
                )
            )
            logger.info(f"已发送物料创建事件到 Inngest: material_id={material.id}")
        except Exception as e:
            # Inngest 事件发送失败不影响物料创建，仅记录警告
            logger.warning(f"发送物料创建事件到 Inngest 失败: {e}")
        
        return response
    
    @staticmethod
    async def get_material_variants(
        tenant_id: int,
        master_material_id: Optional[int] = None,
        master_material_uuid: Optional[str] = None,
        main_code: Optional[str] = None
    ) -> List[MaterialResponse]:
        """
        获取主物料的所有变体
        
        Args:
            tenant_id: 租户ID
            master_material_id: 主物料ID（可选）
            master_material_uuid: 主物料UUID（可选）
            main_code: 主编码（可选，如果提供，将查询该主编码下的所有变体）
            
        Returns:
            List[MaterialResponse]: 变体物料列表
            
        Raises:
            NotFoundError: 当主物料不存在时抛出
            ValidationError: 当参数不足时抛出
        """
        # 确定主物料
        master_material = None
        
        if master_material_id:
            master_material = await Material.filter(
                tenant_id=tenant_id,
                id=master_material_id,
                deleted_at__isnull=True
            ).first()
        elif master_material_uuid:
            master_material = await Material.filter(
                tenant_id=tenant_id,
                uuid=master_material_uuid,
                deleted_at__isnull=True
            ).first()
        elif main_code:
            # 通过主编码查找主物料（variant_managed=True, variant_attributes=null）
            master_material = await Material.filter(
                tenant_id=tenant_id,
                main_code=main_code,
                variant_managed=True,
                variant_attributes__isnull=True,
                deleted_at__isnull=True
            ).first()
        else:
            raise ValidationError("必须提供 master_material_id、master_material_uuid 或 main_code 之一")
        
        if not master_material:
            identifier = master_material_id or master_material_uuid or main_code
            raise NotFoundError(f"主物料不存在: {identifier}")
        
        # 查询该主物料的所有变体（variant_managed=True, variant_attributes不为null）
        variants = await Material.filter(
            tenant_id=tenant_id,
            main_code=master_material.main_code,
            variant_managed=True,
            variant_attributes__isnull=False,  # 变体物料的variant_attributes不为null
            deleted_at__isnull=True
        ).prefetch_related("group").all()
        
        # 加载编码别名并构建响应
        from apps.master_data.schemas.material_schemas import MaterialCodeAliasResponse
        result = []
        for variant in variants:
            aliases = await MaterialCodeService.get_material_aliases(
                tenant_id=tenant_id,
                material_id=variant.id
            )
            response = MaterialResponse.model_validate(variant)
            response.code_aliases = [MaterialCodeAliasResponse.model_validate(alias) for alias in aliases]
            if hasattr(variant, 'defaults'):
                response.defaults = variant.defaults
            result.append(response)
        
        return result
    
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
        
        # 加载编码别名
        aliases = await MaterialCodeService.get_material_aliases(
            tenant_id=tenant_id,
            material_id=material.id
        )
        
        # 构建响应
        from apps.master_data.schemas.material_schemas import MaterialCodeAliasResponse
        response = MaterialResponse.model_validate(material)
        response.code_aliases = [MaterialCodeAliasResponse.model_validate(alias) for alias in aliases]
        # 确保defaults字段被包含在响应中
        if hasattr(material, 'defaults'):
            response.defaults = material.defaults
        
        return response
    
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

        # 添加搜索条件（支持主编码和部门编码搜索）
        if keyword:
            # 首先尝试通过主编码或名称搜索
            main_code_query = Q(main_code__icontains=keyword) | Q(name__icontains=keyword)
            # 如果有关键词，也尝试通过部门编码搜索
            code_aliases = await MaterialCodeAlias.filter(
                tenant_id=tenant_id,
                code__icontains=keyword,
                deleted_at__isnull=True
            ).values_list("material_id", flat=True)
            
            if code_aliases:
                # 如果找到部门编码匹配，添加到查询条件
                query = query.filter(main_code_query | Q(id__in=code_aliases))
            else:
                query = query.filter(main_code_query)

        if code:
            # 首先尝试通过主编码匹配
            material_by_code = await MaterialCodeService.get_material_by_code(
                tenant_id=tenant_id,
                code=code
            )
            if material_by_code:
                # 如果找到物料，只返回该物料
                query = query.filter(id=material_by_code.id)
            else:
                # 如果未找到，尝试模糊匹配主编码
                query = query.filter(main_code__icontains=code)

        if name:
            # 模糊匹配物料名称
            query = query.filter(name__icontains=name)
        
        # 预加载关联关系（优化，修复500错误）
        materials = await query.prefetch_related("group", "process_route").offset(skip).limit(limit).order_by("main_code").all()
        
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
                        "main_code": getattr(m, 'main_code', getattr(m, 'code', '')),
                        "code": getattr(m, 'code', None),  # 向后兼容
                        "name": m.name,
                        "material_type": getattr(m, 'material_type', 'RAW'),
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
        
        # 如果是变体物料，验证变体组合唯一性和属性值
        if data.variant_managed is not None and data.variant_managed and data.variant_attributes is not None:
            # 验证变体属性值
            from core.services.business.material_variant_attribute_service import MaterialVariantAttributeService
            for attr_name, attr_value in data.variant_attributes.items():
                is_valid, error_message = await MaterialVariantAttributeService.validate_variant_attribute_value(
                    tenant_id=tenant_id,
                    attribute_name=attr_name,
                    attribute_value=attr_value,
                )
                if not is_valid:
                    raise ValidationError(f"变体属性验证失败: {error_message}")
            
            # 检查变体组合唯一性（排除当前物料）
            variant_attributes_json = json.dumps(data.variant_attributes, sort_keys=True)
            existing_variants = await Material.filter(
                tenant_id=tenant_id,
                main_code=material.main_code,
                variant_managed=True,
                variant_attributes__isnull=False,
                deleted_at__isnull=True
            ).exclude(id=material.id).all()  # 排除当前物料
            
            # 检查是否有相同的变体属性组合
            for existing in existing_variants:
                if existing.variant_attributes:
                    existing_attrs_json = json.dumps(existing.variant_attributes, sort_keys=True)
                    if existing_attrs_json == variant_attributes_json:
                        raise ValidationError(
                            f"变体属性组合已存在: {data.variant_attributes}，"
                            f"已存在的物料: {existing.name} ({existing.main_code})"
                        )
        
        # 更新字段（排除编码映射和默认值，单独处理）
        # 使用 model_dump 方法（Pydantic v2）或 dict 方法（Pydantic v1）
        if hasattr(data, 'model_dump'):
            update_data = data.model_dump(exclude_unset=True, exclude={"department_codes", "customer_codes", "supplier_codes", "defaults"})
        else:
            update_data = data.dict(exclude_unset=True, exclude={"department_codes", "customer_codes", "supplier_codes", "defaults"})
        
        # 处理变体属性：确保JSON键顺序一致（用于数据库唯一性索引）
        if "variant_attributes" in update_data and update_data["variant_attributes"]:
            sorted_attrs = dict(sorted(update_data["variant_attributes"].items()))
            update_data["variant_attributes"] = sorted_attrs
        
        for key, value in update_data.items():
            setattr(material, key, value)
        
        # 处理默认值
        if data.defaults is not None:
            material.defaults = data.defaults
        
        await material.save()
        
        # 处理编码映射更新
        # 如果提供了编码映射，先删除旧的编码别名，然后创建新的
        if data.department_codes is not None or data.customer_codes is not None or data.supplier_codes is not None:
            # 删除旧的编码别名（软删除）
            from datetime import datetime
            from tortoise import timezone
            
            # 确定要删除的编码类型
            code_types_to_delete = []
            if data.department_codes is not None:
                # 获取所有部门编码类型
                existing_dept_aliases = await MaterialCodeAlias.filter(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    code_type__in=["SALE", "DES", "PUR", "WH", "PROD"],
                    deleted_at__isnull=True
                ).all()
                for alias in existing_dept_aliases:
                    alias.deleted_at = timezone.now()
                    await alias.save()
            
            if data.customer_codes is not None:
                # 删除旧的客户编码
                existing_customer_aliases = await MaterialCodeAlias.filter(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    code_type="CUSTOMER",
                    deleted_at__isnull=True
                ).all()
                for alias in existing_customer_aliases:
                    alias.deleted_at = timezone.now()
                    await alias.save()
            
            if data.supplier_codes is not None:
                # 删除旧的供应商编码
                existing_supplier_aliases = await MaterialCodeAlias.filter(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    code_type="SUPPLIER",
                    deleted_at__isnull=True
                ).all()
                for alias in existing_supplier_aliases:
                    alias.deleted_at = timezone.now()
                    await alias.save()
            
            # 创建新的编码别名
            if data.department_codes:
                for alias_data in data.department_codes:
                    try:
                        await MaterialCodeService.create_code_alias(
                            tenant_id=tenant_id,
                            material_id=material.id,
                            code_type=alias_data.get("code_type", "CUSTOM"),
                            code=alias_data.get("code"),
                            department=alias_data.get("department"),
                            description=alias_data.get("description"),
                            is_primary=alias_data.get("is_primary", False)
                        )
                    except ValidationError as e:
                        logger.warning(f"创建编码别名失败: {e}")
            
            if data.customer_codes:
                for customer_code_data in data.customer_codes:
                    try:
                        await MaterialCodeService.create_code_alias(
                            tenant_id=tenant_id,
                            material_id=material.id,
                            code_type="CUSTOMER",
                            code=customer_code_data.get("code"),
                            description=customer_code_data.get("description"),
                            external_entity_type="customer",
                            external_entity_id=customer_code_data.get("customer_id")
                        )
                    except ValidationError as e:
                        logger.warning(f"创建客户编码别名失败: {e}")
            
            if data.supplier_codes:
                for supplier_code_data in data.supplier_codes:
                    try:
                        await MaterialCodeService.create_code_alias(
                            tenant_id=tenant_id,
                            material_id=material.id,
                            code_type="SUPPLIER",
                            code=supplier_code_data.get("code"),
                            description=supplier_code_data.get("description"),
                            external_entity_type="supplier",
                            external_entity_id=supplier_code_data.get("supplier_id")
                        )
                    except ValidationError as e:
                        logger.warning(f"创建供应商编码别名失败: {e}")
        
        # 加载编码别名
        aliases = await MaterialCodeService.get_material_aliases(
            tenant_id=tenant_id,
            material_id=material.id
        )
        
        # 构建响应
        from apps.master_data.schemas.material_schemas import MaterialCodeAliasResponse
        response = MaterialResponse.model_validate(material)
        response.code_aliases = [MaterialCodeAliasResponse.model_validate(alias) for alias in aliases]
        
        return response
    
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
                        "main_code": getattr(material, 'main_code', getattr(material, 'code', '')),
                        "code": getattr(material, 'code', None),  # 向后兼容
                        "material_type": getattr(material, 'material_type', 'RAW'),
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


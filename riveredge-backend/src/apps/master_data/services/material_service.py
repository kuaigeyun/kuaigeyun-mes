"""
物料数据服务模块

提供物料数据的业务逻辑处理（物料分组、物料、BOM），支持多组织隔离。
"""

from typing import List, Optional, Dict, Any, TYPE_CHECKING
from decimal import Decimal
import json

from tortoise.models import Q
from apps.master_data.models.material import MaterialGroup, Material, BOM
from apps.master_data.models.material_code_alias import MaterialCodeAlias
from apps.master_data.services.material_code_service import MaterialCodeService
from apps.master_data.schemas.material_schemas import (
    MaterialGroupCreate, MaterialGroupUpdate, MaterialGroupResponse,
    MaterialCreate, MaterialUpdate, MaterialResponse,
    BOMCreate, BOMUpdate, BOMResponse, BOMBatchCreate,
    BOMBatchImport, BOMVersionCreate, BOMVersionCompare
)
from core.services.business.code_generation_service import CodeGenerationService
from core.config.code_rule_pages import CODE_RULE_PAGES
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger


def _material_to_response_data(material) -> Dict[str, Any]:
    """
    从 Material ORM 实例构建 MaterialResponse 所需的字典（不含 code_aliases）。
    model_validate 不支持 exclude，故用字典校验避免 ReverseRelation 传入。
    """
    pr = getattr(material, "process_route", None)
    return {
        "id": material.id,
        "uuid": str(material.uuid),
        "tenant_id": material.tenant_id,
        "main_code": material.main_code or (getattr(material, "code", None) or ""),
        "code": getattr(material, "code", None),
        "name": material.name,
        "material_type": getattr(material, "material_type", None),
        "group_id": getattr(material, "group_id", None),
        "specification": getattr(material, "specification", None),
        "base_unit": material.base_unit,
        "units": getattr(material, "units", None),
        "batch_managed": getattr(material, "batch_managed", False),
        "variant_managed": getattr(material, "variant_managed", False),
        "variant_attributes": getattr(material, "variant_attributes", None),
        "description": getattr(material, "description", None),
        "brand": getattr(material, "brand", None),
        "model": getattr(material, "model", None),
        "is_active": getattr(material, "is_active", True),
        "defaults": getattr(material, "defaults", None),
        "source_type": getattr(material, "source_type", None),
        "source_config": getattr(material, "source_config", None),
        "process_route_id": getattr(material, "process_route_id", None) or (getattr(pr, "id", None) if pr else None),
        "process_route_name": getattr(pr, "name", None) if pr else None,
        "created_at": material.created_at,
        "updated_at": material.updated_at,
        "deleted_at": getattr(material, "deleted_at", None),
    }


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
        
        # 跟踪编码是否由用户手动输入
        is_manual_code = bool(data.main_code and isinstance(data.main_code, str) and data.main_code.strip())
        
        # 生成主编码（如果未提供或为空字符串）
        if not is_manual_code:
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
        else:
            logger.info(f"使用用户手动输入的物料主编码: {data.main_code}")
        
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
                    # 如果是用户手动输入的编码，直接报错，不自动重新生成
                    if is_manual_code:
                        raise ValidationError(
                            f"物料主编码 {data.main_code} 已存在，请使用其他编码。"
                            f"已存在的物料: {existing.name}"
                        )
                    
                    # 如果是自动生成的编码且已存在，循环重新生成直到得到未占用的编码（处理并发、序号未递增等场景）
                    logger.warning(f"主编码 {data.main_code} 已存在，自动重新生成新编码")
                    
                    # 获取物料分组信息（如果之前没有获取）
                    if not group and data.group_id:
                        group = await MaterialGroup.filter(
                            tenant_id=tenant_id,
                            id=data.group_id,
                            deleted_at__isnull=True
                        ).first()
                    
                    material_page_config = next(
                        (page for page in CODE_RULE_PAGES if page.get("page_code") == "master-data-material"),
                        None
                    )
                    
                    context = {}
                    if group:
                        context["group_code"] = group.code
                        context["group_name"] = group.name
                    context["material_type"] = data.material_type
                    context["name"] = data.name
                    
                    max_attempts = 20
                    for attempt in range(max_attempts):
                        if material_page_config and material_page_config.get("rule_code"):
                            try:
                                data.main_code = await CodeGenerationService.generate_code(
                                    tenant_id=tenant_id,
                                    rule_code=material_page_config["rule_code"],
                                    context=context
                                )
                                logger.info(f"自动重新生成物料主编码(尝试 {attempt + 1}/{max_attempts}): {data.main_code}")
                            except Exception as e:
                                logger.warning(f"使用编码规则重新生成物料编码失败: {e}，回退到默认生成方式")
                                data.main_code = await MaterialCodeService.generate_main_code(
                                    tenant_id=tenant_id,
                                    material_type=data.material_type
                                )
                        else:
                            data.main_code = await MaterialCodeService.generate_main_code(
                                tenant_id=tenant_id,
                                material_type=data.material_type
                            )
                        
                        existing_check = await Material.filter(
                            tenant_id=tenant_id,
                            main_code=data.main_code,
                            deleted_at__isnull=True
                        ).first()
                        if not existing_check:
                            break
                        logger.warning(f"生成的编码 {data.main_code} 仍已存在，第 {attempt + 1} 次重试")
                    
                    else:
                        raise ValidationError(
                            f"连续 {max_attempts} 次生成的编码均已存在，"
                            f"请检查编码规则配置或联系系统管理员"
                        )
        
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
        # 使用 by_alias=False 确保使用字段名（下划线命名）而不是别名（驼峰命名）
        if hasattr(data, 'model_dump'):
            material_data = data.model_dump(
                exclude={"department_codes", "customer_codes", "supplier_codes", "defaults"},
                by_alias=False  # 使用字段名而不是别名
            )
        else:
            material_data = data.dict(
                exclude={"department_codes", "customer_codes", "supplier_codes", "defaults"},
                by_alias=False  # 使用字段名而不是别名
            )
        # 兼容处理：如果提供了code但没有main_code，将code作为main_code（向后兼容）
        if (not material_data.get("main_code") or (isinstance(material_data.get("main_code"), str) and not material_data.get("main_code").strip())) and material_data.get("code"):
            material_data["main_code"] = material_data["code"]
        
        # 确保 main_code 必填（生成逻辑已设置 data.main_code，此处兜底）
        main_code_val = material_data.get("main_code") or getattr(data, "main_code", None)
        if not main_code_val or (isinstance(main_code_val, str) and not main_code_val.strip()):
            raise ValidationError("物料主编码不能为空，请检查编码规则或手动填写")
        material_data["main_code"] = main_code_val.strip() if isinstance(main_code_val, str) else main_code_val
        
        # 同步 code = main_code（列表等展示使用 code，需同时落库）
        material_data["code"] = material_data["main_code"]
        
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
        
        # 构建响应（用字典校验，避免 model_validate 传入 ReverseRelation 的 code_aliases）
        from apps.master_data.schemas.material_schemas import MaterialCodeAliasResponse
        resp_data = _material_to_response_data(material)
        resp_data["code_aliases"] = [MaterialCodeAliasResponse.model_validate(a) for a in aliases]
        response = MaterialResponse.model_validate(resp_data)
        
        # 发送 Inngest 事件，触发 AI 建议工作流（异步处理）
        try:
            from core.inngest.client import inngest_client
            from inngest import Event
            
            await inngest_client.send(
                Event(
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
            resp_data = _material_to_response_data(variant)
            resp_data["code_aliases"] = [MaterialCodeAliasResponse.model_validate(a) for a in aliases]
            result.append(MaterialResponse.model_validate(resp_data))
        
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
        ).prefetch_related("group", "process_route").first()
        
        if not material:
            raise NotFoundError(f"物料 {material_uuid} 不存在")
        
        # 加载编码别名
        aliases = await MaterialCodeService.get_material_aliases(
            tenant_id=tenant_id,
            material_id=material.id
        )
        
        # 构建响应
        from apps.master_data.schemas.material_schemas import MaterialCodeAliasResponse
        resp_data = _material_to_response_data(material)
        resp_data["code_aliases"] = [MaterialCodeAliasResponse.model_validate(a) for a in aliases]
        return MaterialResponse.model_validate(resp_data)
    
    @staticmethod
    async def list_materials(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        group_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        material_type: Optional[str] = None,
        specification: Optional[str] = None,
        brand: Optional[str] = None,
        model: Optional[str] = None,
        base_unit: Optional[str] = None
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
            material_type: 物料类型（可选，用于过滤）
            specification: 规格（可选，模糊匹配）
            brand: 品牌（可选，模糊匹配）
            model: 型号（可选，模糊匹配）
            base_unit: 基础单位（可选，精确匹配）

        Returns:
            List[MaterialResponse]: 物料列表
        """
        query = Material.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if group_id is not None:
            # 递归获取所有子分组ID（包括当前分组本身）
            async def get_all_child_group_ids(parent_group_id: int) -> List[int]:
                """递归获取所有子分组ID（包括父分组本身）"""
                group_ids = [parent_group_id]
                # 获取直接子分组
                child_groups = await MaterialGroup.filter(
                    tenant_id=tenant_id,
                    parent_id=parent_group_id,
                    deleted_at__isnull=True
                ).values_list("id", flat=True)
                
                # 递归获取子分组的子分组
                for child_id in child_groups:
                    child_ids = await get_all_child_group_ids(child_id)
                    group_ids.extend(child_ids)
                
                return group_ids
            
            # 获取当前分组及其所有子分组的ID
            all_group_ids = await get_all_child_group_ids(group_id)
            # 使用 in 查询，查询所有相关分组的物料
            query = query.filter(group_id__in=all_group_ids)

        if is_active is not None:
            query = query.filter(is_active=is_active)

        if material_type is not None:
            query = query.filter(material_type=material_type)

        if base_unit is not None:
            query = query.filter(base_unit=base_unit)

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

        if specification:
            # 模糊匹配规格
            query = query.filter(specification__icontains=specification)

        if brand:
            # 模糊匹配品牌
            query = query.filter(brand__icontains=brand)

        if model:
            # 模糊匹配型号
            query = query.filter(model__icontains=model)
        
        # 预加载关联关系（优化，修复500错误）
        materials = await query.prefetch_related("group", "process_route").offset(skip).limit(limit).order_by("main_code").all()
        
        # 构建响应数据（用 _material_to_response_data 避免 ReverseRelation 的 code_aliases；列表不加载别名）
        result = []
        for m in materials:
            try:
                resp_data = _material_to_response_data(m)
                resp_data["code_aliases"] = []
                result.append(MaterialResponse.model_validate(resp_data))
            except Exception as e:
                logger.warning(f"序列化物料 {m.id if hasattr(m, 'id') else 'unknown'} 失败: {str(e)}")
                continue
        
        return result
    
    @staticmethod
    async def update_material(
        tenant_id: int,
        material_uuid: str,
        data: MaterialUpdate,
        updated_by: Optional[int] = None,
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
        
        # 仅当请求体显式包含 process_route_id 时才更新（避免未传时误清空）
        if "process_route_id" in update_data:
            material.process_route_id = data.process_route_id
        
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
        resp_data = _material_to_response_data(material)
        resp_data["code_aliases"] = [MaterialCodeAliasResponse.model_validate(a) for a in aliases]
        response = MaterialResponse.model_validate(resp_data)

        # 发送 Inngest 事件，触发物料变更通知工作流（下游单据提示）
        try:
            from core.inngest.client import inngest_client
            from inngest import Event

            await inngest_client.send(
                Event(
                    name="material/updated",
                    data={
                        "tenant_id": tenant_id,
                        "material_id": material.id,
                        "material_uuid": str(material.uuid),
                        "material_name": material.name,
                        "main_code": material.main_code,
                        "updated_by": updated_by,
                    },
                )
            )
            logger.info(f"已发送物料更新事件到 Inngest: material_id={material.id}")
        except Exception as e:
            logger.warning(f"发送物料更新事件到 Inngest 失败: {e}")

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
        
        # 循环依赖检测（PLM 最佳实践：禁止成环）
        has_cycle = await MaterialService.detect_bom_cycle(
            tenant_id, data.material_id, data.component_id
        )
        if has_cycle:
            raise ValidationError(
                f"添加子物料 {data.component_id} 将导致 BOM 循环依赖，请检查层级关系"
            )
        
        # 显式设置层级：直接子件 level 1，path 父/子
        payload = data.dict()
        payload["level"] = 1
        payload["path"] = f"{data.material_id}/{data.component_id}"
        
        bom = await BOM.create(tenant_id=tenant_id, **payload)
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
        
        # 循环依赖检测（PLM 最佳实践：禁止成环）
        for item in data.items:
            has_cycle = await MaterialService.detect_bom_cycle(
                tenant_id, data.material_id, item.component_id
            )
            if has_cycle:
                raise ValidationError(
                    f"添加子物料 {item.component_id} 将导致 BOM 循环依赖，请检查层级关系"
                )
        
        # 获取主物料信息（用于编码生成上下文）
        material = await Material.filter(
            tenant_id=tenant_id,
            id=data.material_id,
            deleted_at__isnull=True
        ).first()
        if not material:
            raise ValidationError("主物料不存在")
        
        # 自动生成BOM编码（如果未提供）
        if not data.bom_code:
            try:
                # 构建编码规则的上下文
                context: Dict[str, Any] = {
                    "version": data.version or "1.0",
                }
                
                # 添加主物料信息到上下文
                if material.main_code:
                    context["material_code"] = material.main_code
                elif material.code:
                    context["material_code"] = material.code
                if material.name:
                    context["material_name"] = material.name
                
                # 使用编码规则服务生成BOM编码
                data.bom_code = await CodeGenerationService.generate_code(
                    tenant_id=tenant_id,
                    rule_code="ENGINEERING_BOM_CODE",
                    context=context
                )
            except ValidationError as e:
                # 如果编码规则不存在或未启用，使用备用方案
                logger.warning(f"BOM编码规则生成失败，使用备用方案: {e}")
                from datetime import datetime
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                material_code = material.main_code or material.code or "UNKNOWN"
                data.bom_code = f"BOM-{material_code}-{timestamp}"
        
        # 批量创建BOM（PLM 层级：根主料 level 0，直接子件 level 1；path 为 父/子 路径）
        bom_list = []
        for item in data.items:
            bom = await BOM.create(
                tenant_id=tenant_id,
                material_id=data.material_id,
                component_id=item.component_id,
                quantity=item.quantity,
                unit=item.unit,
                waste_rate=item.waste_rate if hasattr(item, 'waste_rate') else Decimal("0.00"),
                is_required=item.is_required if hasattr(item, 'is_required') else True,
                level=1,  # 直接子件深度 1（根主料为 0）
                path=f"{data.material_id}/{item.component_id}",
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
        
        bom_list = await query.offset(skip).limit(limit).order_by(
            "level", "path", "priority", "id"
        ).all()
        
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
            
        # 检查BOM状态：已审核的BOM不可编辑
        if bom.approval_status == 'approved':
            raise ValidationError(f"BOM {bom.bom_code} (版本 {bom.version}) 已审核通过，禁止修改。请先反审核或创建新版本。")
        
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
            
        # 检查BOM状态：已审核的BOM不可删除
        if bom.approval_status == 'approved':
            raise ValidationError(f"BOM {bom.bom_code} (版本 {bom.version}) 已审核通过，禁止删除。请先反审核。")
        
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
    async def batch_approve_bom(
        tenant_id: int,
        bom_uuids: List[str],
        approved_by: int,
        approval_comment: Optional[str] = None,
        approved: bool = True,
        recursive: bool = False,
        is_reverse: bool = False
    ) -> List[BOMResponse]:
        """
        批量审核BOM
        
        Args:
            tenant_id: 租户ID
            bom_uuids: BOM UUID列表
            approved_by: 审核人ID
            approval_comment: 审核意见
            approved: 是否通过（True=通过，False=拒绝）
            recursive: 是否递归处理子BOM
            is_reverse: 是否反审核（True=重置为草稿）
            
        Returns:
            List[BOMResponse]: 审核后的BOM对象列表
        """
        if not bom_uuids:
            return []
            
        from tortoise import timezone
        
        # 查找所有BOM
        boms = await BOM.filter(
            tenant_id=tenant_id,
            uuid__in=bom_uuids,
            deleted_at__isnull=True
        ).all()
        
        target_ids = set(b.id for b in boms)
        
        # 递归查找子BOM
        if recursive:
            ids_to_process = list(target_ids)
            processed_materials = set() # 防止无限循环（虽然有循环检测，但防万一）
            
            while ids_to_process:
                current_batch_ids = ids_to_process
                ids_to_process = []
                
                # 获取当前批次BOM的子物料和版本
                current_boms = await BOM.filter(id__in=current_batch_ids).all()
                
                for b in current_boms:
                    # key = (material_id, version)
                    # 查找以该component为父件的BOM（且版本一致）
                    if b.component_id in processed_materials:
                        continue
                    
                    # 查找子BOM
                    child_boms = await BOM.filter(
                        tenant_id=tenant_id,
                        material_id=b.component_id,
                        version=b.version, # 假设版本同步
                        deleted_at__isnull=True
                    ).all()
                    
                    if child_boms:
                        processed_materials.add(b.component_id)
                        for child in child_boms:
                            if child.id not in target_ids:
                                target_ids.add(child.id)
                                ids_to_process.append(child.id)
        
        # 确定新状态
        new_status = "approved"
        if is_reverse:
            new_status = "draft"
        elif not approved:
            new_status = "rejected"

        if target_ids:
            # Prepare for bulk update
            update_data = {
                "approval_status": new_status,
                "approved_by": approved_by,
                "approved_at": timezone.now(),
            }
            
            if approval_comment is not None:
                 update_data["approval_comment"] = approval_comment
                 
            await BOM.filter(
               id__in=list(target_ids)
            ).update(**update_data)
            
            # Re-fetch updated records to return
            # 只返回最初请求的BOM
            result = await BOM.filter(
               uuid__in=bom_uuids,
               deleted_at__isnull=True
            ).all()
            return [BOMResponse.model_validate(b) for b in result]
        
        return []
    
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
            new_version: 新版本号（可选，如果不提供则自动升版）
            
        Returns:
            BOMResponse: 新创建的BOM（第一个条目）
        """
        bom = await BOM.filter(
            tenant_id=tenant_id,
            uuid=bom_uuid
        ).first()
        
        if not bom:
             raise NotFoundError(f"BOM {bom_uuid} 不存在")
        
        # 1. 自动计算新版本号
        if not new_version:
             # 简单的版本自增逻辑：X.Y -> X.Y+1
             # 这里假设版本号格式为 numeric.numeric
             try:
                major, minor = bom.version.split('.')
                new_version = f"{major}.{int(minor) + 1}"
             except ValueError:
                 # 如果不是标准格式，使用后缀
                 new_version = f"{bom.version}_rev1"
                 
             # 检查新版本号是否已存在
             exists = await BOM.filter(
                 tenant_id=tenant_id,
                 material_id=bom.material_id,
                 version=new_version,
                 deleted_at__isnull=True
             ).exists()
             
             if exists:
                 raise ValidationError(f"新版本 {new_version} 已存在")
        
        # 2. 查找源BOM的所有组成部分（同一 bom_code / 版本）
        # 注意：这里我们通过 material_id 和 version 查找整个结构
        source_boms = await BOM.filter(
            tenant_id=tenant_id,
            material_id=bom.material_id,
            version=bom.version,
            deleted_at__isnull=True
        ).all()
        
        from tortoise import timezone
        
        # 3. 创建新版本BOM列表
        new_boms = []
        for source in source_boms:
             # 创建副本
             new_bom = BOM(
                 tenant_id=tenant_id,
                 material_id=source.material_id,
                 component_id=source.component_id,
                 quantity=source.quantity,
                 unit=source.unit,
                 waste_rate=source.waste_rate,
                 is_required=source.is_required,
                 level=source.level,
                 path=source.path,
                 version=new_version,
                 bom_code=source.bom_code, # 保持相同的 BOM Code
                 effective_date=timezone.now(), # 生效日期更新为当前
                 description=source.description,
                 remark=source.remark,
                 is_active=True,
                 approval_status="draft", # 重置为草稿
                 approved_by=None,
                 approved_at=None,
                 approval_comment=None
             )
             await new_bom.save()
             new_boms.append(new_bom)
             
        return BOMResponse.model_validate(new_boms[0] if new_boms else bom)
        
    @staticmethod
    async def revise_bom(
        tenant_id: int,
        bom_uuid: str,
        new_version: Optional[str] = None
    ) -> BOMResponse:
        """
        BOM升版（Revise）
        
        Args:
            tenant_id: 租户ID
            bom_uuid: 源BOM UUID
            new_version: 新版本号（可选）
        """
        return await MaterialService.copy_bom(tenant_id, bom_uuid, new_version)


    
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
            # 构建物料响应数据（用 _material_to_response_data 避免 ReverseRelation；树形接口不加载 code_aliases）
            try:
                resp_data = _material_to_response_data(material)
                resp_data["code_aliases"] = []
                material_map[group_id].append(MaterialTreeResponse.model_validate(resp_data))
            except Exception as e:
                logger.warning(f"序列化物料 {material.id if hasattr(material, 'id') else 'unknown'} 失败: {str(e)}")
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
    
    # ==================== BOM批量导入和验证相关方法（根据优化设计规范新增） ====================
    
    @staticmethod
    async def batch_import_bom(
        tenant_id: int,
        data: BOMBatchImport
    ) -> List[BOMResponse]:
        """
        批量导入BOM（支持universheet批量导入，支持部门编码自动映射）
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            data: BOM批量导入数据
            
        Returns:
            List[BOMResponse]: 创建的BOM对象列表
            
        Raises:
            ValidationError: 当编码不存在、循环依赖、重复子件等时抛出
        """
        from collections import defaultdict
        
        # 步骤1：编码映射 - 将部门编码映射到物料ID
        code_to_material = {}  # 编码 -> 物料ID的映射
        material_id_to_code = {}  # 物料ID -> 编码的映射（用于错误提示）
        
        # 收集所有需要查询的编码
        all_codes = set()
        for item in data.items:
            all_codes.add(item.parent_code)
            all_codes.add(item.component_code)
        
        # 批量查询物料（通过主编码和部门编码）
        for code in all_codes:
            material = await MaterialCodeService.get_material_by_code(
                tenant_id=tenant_id,
                code=code
            )
            if not material:
                raise ValidationError(f"编码不存在：{code}，请先创建物料")
            code_to_material[code] = material.id
            material_id_to_code[material.id] = code
        
        # 步骤2：数据完整性验证
        # 验证父件编码是否存在（已在步骤1完成）
        # 验证子件编码是否存在（已在步骤1完成）
        # 验证子件数量是否大于0（已在Schema验证）
        # 验证损耗率（已在Schema验证）
        
        # 步骤3：检测重复子件（同一父件下，子件编码不能重复）
        parent_component_map = defaultdict(set)  # 父件ID -> 子件编码集合
        for item in data.items:
            parent_id = code_to_material[item.parent_code]
            component_id = code_to_material[item.component_code]
            if component_id in parent_component_map[parent_id]:
                raise ValidationError(
                    f"父件 {item.parent_code} 下，子件 {item.component_code} 重复"
                )
            parent_component_map[parent_id].add(component_id)
        
        # 步骤4：检测循环依赖
        # 构建物料依赖图
        dependency_graph = defaultdict(set)  # 物料ID -> 依赖的物料ID集合
        for item in data.items:
            parent_id = code_to_material[item.parent_code]
            component_id = code_to_material[item.component_code]
            dependency_graph[parent_id].add(component_id)
        
        # 检测循环依赖（使用DFS）
        def has_cycle(node: int, visited: set, rec_stack: set) -> bool:
            """检测从node开始的路径是否有循环"""
            visited.add(node)
            rec_stack.add(node)
            
            for neighbor in dependency_graph.get(node, set()):
                if neighbor not in visited:
                    if has_cycle(neighbor, visited, rec_stack):
                        return True
                elif neighbor in rec_stack:
                    # 找到循环
                    return True
            
            rec_stack.remove(node)
            return False
        
        # 检查所有节点是否有循环
        all_nodes = set(dependency_graph.keys()) | set(
            component_id for components in dependency_graph.values() for component_id in components
        )
        visited = set()
        for node in all_nodes:
            if node not in visited:
                if has_cycle(node, visited, set()):
                    # 找到循环，构建循环路径用于提示
                    cycle_path = []
                    rec_stack = set()
                    def find_cycle_path(node: int, path: list):
                        if node in rec_stack:
                            # 找到循环起点
                            cycle_start = path.index(node)
                            cycle_path.extend(path[cycle_start:] + [node])
                            return True
                        rec_stack.add(node)
                        path.append(node)
                        for neighbor in dependency_graph.get(node, set()):
                            if find_cycle_path(neighbor, path):
                                return True
                        path.pop()
                        rec_stack.remove(node)
                        return False
                    find_cycle_path(node, [])
                    cycle_codes = [material_id_to_code.get(nid, str(nid)) for nid in cycle_path]
                    raise ValidationError(
                        f"检测到循环依赖：{' -> '.join(cycle_codes)}，请检查BOM配置"
                    )
        
        # 步骤5：生成BOM层级结构
        # 构建父件到子件的映射（用于计算层级）
        parent_to_children = defaultdict(list)
        for item in data.items:
            parent_id = code_to_material[item.parent_code]
            component_id = code_to_material[item.component_code]
            parent_to_children[parent_id].append((component_id, item))
        
        # 计算层级和路径
        def calculate_level_and_path(
            material_id: int,
            current_level: int = 0,
            current_path: str = ""
        ) -> tuple:
            """递归计算层级和路径"""
            if current_path:
                new_path = f"{current_path}/{material_id}"
            else:
                new_path = str(material_id)
            
            return current_level, new_path
        
        # 步骤6：创建BOM数据 (Refactored: Clean Replace & Auto-Numbering)
        from tortoise import timezone
        from datetime import datetime
        
        bom_list = []
        # 按父件ID分组处理
        parent_items_map = defaultdict(list)
        for item in data.items:
            parent_id = code_to_material[item.parent_code]
            parent_items_map[parent_id].append(item)
            
        for parent_id, items in parent_items_map.items():
            # 1. 确定目标版本
            target_version = data.version or "1.0"
            
            # 2. 确定 BOM 编码 (Auto-Numbering)
            # 优先使用现有同版本的编码，或者请求中指定的编码
            bom_code = data.bom_code
            
            # 如果请求未指定，尝试查找该父件该版本的现有编码
            if not bom_code:
                existing_version_bom = await BOM.filter(
                    tenant_id=tenant_id,
                    material_id=parent_id,
                    version=target_version,
                    deleted_at__isnull=True
                ).first()
                if existing_version_bom:
                    bom_code = existing_version_bom.bom_code
            
            # 如果当前版本没有（如新版本），尝试查找该父件的其他版本以继承 BOM 编码
            # 根据模型定义：同一主物料的不同版本使用相同编码
            if not bom_code:
                any_existing_bom = await BOM.filter(
                    tenant_id=tenant_id,
                    material_id=parent_id,
                    deleted_at__isnull=True
                ).first()
                if any_existing_bom:
                    bom_code = any_existing_bom.bom_code

            # 如果仍无编码，生成新编码
            if not bom_code:
                try:
                    parent_material = await Material.get(id=parent_id)
                    context = {
                        "date": datetime.now().strftime("%Y%m%d"),
                        "material_code": parent_material.main_code,
                        "version": target_version
                    }
                    bom_code = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code="ENGINEERING_BOM_CODE",
                        context=context
                    )
                except Exception as e:
                    # 降级方案：使用时间戳
                    logger.warning(f"BOM编码生成失败，使用降级方案: {e}")
                    # 重新获父物料信息（如果上面try块失败）
                    parent_material = await Material.get(id=parent_id)
                    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                    bom_code = f"BOM-{parent_material.main_code}-{timestamp}"

            # 3. 全量替换 (Clean Replace)
            # 软删除当前父件+当前版本的所有现有BOM行
            # 注意：这会删除旧的结构，用新的结构完全替代
            await BOM.filter(
                tenant_id=tenant_id,
                material_id=parent_id,
                version=target_version,
                deleted_at__isnull=True
            ).update(deleted_at=timezone.now())

            # 4. 创建新条目
            for item in items:
                component_id = code_to_material[item.component_code]
                
                # 检查主物料和子物料不能相同
                if parent_id == component_id:
                     # 理论上前面检查过了，这里双重保险或忽略
                    continue

                level = 1
                path = f"{parent_id}/{component_id}"

                bom = await BOM.create(
                    tenant_id=tenant_id,
                    material_id=parent_id,
                    component_id=component_id,
                    quantity=item.quantity,
                    unit=item.unit,
                    waste_rate=item.waste_rate or Decimal("0.00"),
                    is_required=item.is_required if item.is_required is not None else True,
                    level=level,
                    path=path,
                    version=target_version,
                    bom_code=bom_code,
                    effective_date=data.effective_date,
                    description=data.description,
                    remark=item.remark,
                    is_active=True,
                )
                bom_list.append(bom)
        
        logger.info(f"批量导入BOM成功 (Clean Replace)，共创建 {len(bom_list)} 条BOM记录")
        
        return [BOMResponse.model_validate(bom) for bom in bom_list]
    
    @staticmethod
    async def detect_bom_cycle(
        tenant_id: int,
        material_id: int,
        component_id: int
    ) -> bool:
        """
        检测BOM循环依赖
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            material_id: 主物料ID（父件）
            component_id: 子物料ID（子件）
            
        Returns:
            bool: 如果添加该BOM关系会导致循环依赖，返回True
        """
        from collections import defaultdict
        
        # 构建依赖图：component_id -> 它作为父件时的所有子件ID集合
        dependency_graph = defaultdict(set)
        
        # 查询所有BOM关系
        all_boms = await BOM.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).all()
        
        for bom in all_boms:
            dependency_graph[bom.component_id].add(bom.material_id)
        
        # 检查添加 material_id -> component_id 是否会导致循环
        # 即检查从 component_id 开始，是否能到达 material_id
        def can_reach(start: int, target: int, visited: set) -> bool:
            """检查从start是否能到达target"""
            if start == target:
                return True
            
            visited.add(start)
            for neighbor in dependency_graph.get(start, set()):
                if neighbor not in visited:
                    if can_reach(neighbor, target, visited):
                        return True
            return False
        
        # 检查从component_id是否能到达material_id
        # 如果能到达，说明添加 material_id -> component_id 会形成循环
        return can_reach(component_id, material_id, set())
    
    @staticmethod
    async def generate_bom_hierarchy(
        tenant_id: int,
        material_id: int,
        version: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        生成BOM层级结构
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            material_id: 主物料ID
            version: BOM版本（可选，如果不提供则使用最新版本）
            
        Returns:
            Dict[str, Any]: BOM层级结构
        """
        from collections import defaultdict
        
        # 查询BOM数据
        query = BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            is_active=True
        )
        
        if version:
            query = query.filter(version=version)
        else:
            # 使用最新版本
            latest_bom = await query.order_by("-version").first()
            if latest_bom:
                query = query.filter(version=latest_bom.version)
        
        bom_items = await query.prefetch_related("component").all()
        
        if not bom_items:
            return {
                "material_id": material_id,
                "version": version or "1.0",
                "items": []
            }
        
        # 构建层级结构
        async def build_tree(parent_id: int, level: int = 0, path: str = "", use_version: Optional[str] = None) -> List[Dict[str, Any]]:
            """递归构建BOM树"""
            result = []
            
            # 查找所有以parent_id为父件的BOM项
            # 第一层使用预加载的 bom_items，后续层级需要重新查询
            if level == 0:
                # 第一层：使用预加载的 bom_items
                current_bom_items = [b for b in bom_items if b.material_id == parent_id]
            else:
                # 后续层级：查询子物料的BOM
                current_bom_items = await BOM.filter(
                    tenant_id=tenant_id,
                    material_id=parent_id,
                    version=use_version or version,
                    deleted_at__isnull=True,
                    is_active=True
                ).prefetch_related("component").all()
            
            for bom in current_bom_items:
                # 使用预加载的component，避免重复查询
                component = bom.component
                if not component:
                    # 如果预加载失败，则查询
                    component = await Material.get(id=bom.component_id)
                current_path = f"{path}/{bom.component_id}" if path else str(bom.component_id)
                
                item_data = {
                    "component_id": bom.component_id,
                    "component_code": component.main_code,
                    "component_name": component.name,
                    "quantity": float(bom.quantity),
                    "unit": bom.unit,
                    "waste_rate": float(bom.waste_rate),
                    "is_required": bom.is_required,
                    "level": level,
                    "path": current_path,
                    "children": []
                }
                
                # 递归查找子件：查询子物料是否有自己的BOM
                child_bom_items = await BOM.filter(
                    tenant_id=tenant_id,
                    material_id=bom.component_id,
                    version=use_version or version or bom.version,
                    deleted_at__isnull=True,
                    is_active=True
                ).prefetch_related("component").all()
                
                if child_bom_items:
                    # 递归构建子树
                    item_data["children"] = await build_tree(
                        bom.component_id,
                        level + 1,
                        current_path,
                        use_version or version or bom.version
                    )
                
                result.append(item_data)
            
            return result
        
        tree = await build_tree(material_id)
        
        material = await Material.get(id=material_id)
        
        return {
            "material_id": material_id,
            "material_code": material.main_code,
            "material_name": material.name,
            "version": version or bom_items[0].version,
            "approval_status": bom_items[0].approval_status,
            "items": tree
        }

    
    @staticmethod
    async def calculate_bom_quantity(
        tenant_id: int,
        material_id: int,
        parent_quantity: Decimal = Decimal("1.0"),
        version: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        计算BOM用量（考虑多层级和损耗率）
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            material_id: 主物料ID
            parent_quantity: 父物料数量（默认1.0）
            version: BOM版本（可选）
            
        Returns:
            Dict[str, Any]: 计算结果，包含每个子物料的实际用量
        """
        from collections import defaultdict
        
        # 查询BOM数据
        query = BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            is_active=True
        )
        
        if version:
            query = query.filter(version=version)
        else:
            # 使用最新版本
            latest_bom = await query.order_by("-version").first()
            if latest_bom:
                query = query.filter(version=latest_bom.version)
        
        bom_items = await query.prefetch_related("component").all()
        
        result = {
            "material_id": material_id,
            "parent_quantity": float(parent_quantity),
            "components": []
        }
        
        # 递归计算每个子物料的用量
        def calculate_component_quantity(
            comp_id: int,
            comp_quantity: Decimal,
            comp_waste_rate: Decimal,
            parent_qty: Decimal
        ) -> Decimal:
            """计算子物料的实际用量（考虑损耗率）"""
            # 实际需要 = 基础用量 × (1 + 损耗率) × 父物料数量
            actual_quantity = comp_quantity * (Decimal("1") + comp_waste_rate / Decimal("100")) * parent_qty
            return actual_quantity
        
        # 计算直接子物料的用量
        component_quantities = defaultdict(Decimal)
        
        for bom in bom_items:
            if bom.is_required:
                actual_qty = calculate_component_quantity(
                    bom.component_id,
                    bom.quantity,
                    bom.waste_rate or Decimal("0.00"),
                    parent_quantity
                )
                component_quantities[bom.component_id] += actual_qty
                
                component = await Material.get(id=bom.component_id)
                result["components"].append({
                    "component_id": bom.component_id,
                    "component_code": component.main_code,
                    "component_name": component.name,
                    "base_quantity": float(bom.quantity),
                    "waste_rate": float(bom.waste_rate or Decimal("0.00")),
                    "actual_quantity": float(actual_qty),
                    "unit": bom.unit,
                    "level": 0
                })
                
                # 递归计算子物料的子物料用量
                child_boms = await BOM.filter(
                    tenant_id=tenant_id,
                    material_id=bom.component_id,
                    version=version or bom.version,
                    deleted_at__isnull=True,
                    is_active=True
                ).all()
                
                if child_boms:
                    child_result = await MaterialService.calculate_bom_quantity(
                        tenant_id=tenant_id,
                        material_id=bom.component_id,
                        parent_quantity=actual_qty,
                        version=version or bom.version
                    )
                    
                    # 合并子物料的用量
                    for child_comp in child_result["components"]:
                        child_comp_id = child_comp["component_id"]
                        if child_comp_id in component_quantities:
                            component_quantities[child_comp_id] += Decimal(str(child_comp["actual_quantity"]))
                        else:
                            component_quantities[child_comp_id] = Decimal(str(child_comp["actual_quantity"]))
                            child_comp["level"] = 1
                            result["components"].append(child_comp)
        
        return result
    
    @staticmethod
    async def create_bom_version(
        tenant_id: int,
        material_id: int,
        data: BOMVersionCreate
    ) -> List[BOMResponse]:
        """
        创建BOM新版本
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            material_id: 主物料ID
            data: BOM版本创建数据
            
        Returns:
            List[BOMResponse]: 新版本的BOM对象列表
        """
        # 查找当前版本的BOM
        current_boms = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True
        ).order_by("-version").all()
        
        if not current_boms:
            raise NotFoundError(f"物料 {material_id} 的BOM不存在")
        
        # 获取当前版本号
        current_version = current_boms[0].version
        current_bom_code = current_boms[0].bom_code
        
        # 创建新版本的BOM（复制当前版本）
        new_bom_list = []
        for bom in current_boms:
            if bom.version == current_version:
                new_bom = await BOM.create(
                    tenant_id=tenant_id,
                    material_id=bom.material_id,
                    component_id=bom.component_id,
                    quantity=bom.quantity,
                    unit=bom.unit,
                    waste_rate=bom.waste_rate,
                    is_required=bom.is_required,
                    level=bom.level,
                    path=bom.path,
                    version=data.version,
                    bom_code=current_bom_code,  # 使用相同的BOM编码
                    effective_date=data.effective_date or bom.effective_date,
                    expiry_date=bom.expiry_date,
                    approval_status="draft",  # 新版本默认为草稿
                    is_alternative=bom.is_alternative,
                    alternative_group_id=bom.alternative_group_id,
                    priority=bom.priority,
                    description=data.version_description or bom.description,
                    remark=bom.remark,
                    is_active=bom.is_active,
                )
                new_bom_list.append(new_bom)
        
        logger.info(
            f"创建BOM新版本成功：物料 {material_id}，"
            f"从版本 {current_version} 创建版本 {data.version}"
        )
        
        return [BOMResponse.model_validate(bom) for bom in new_bom_list]
    
    @staticmethod
    async def compare_bom_versions(
        tenant_id: int,
        material_id: int,
        data: BOMVersionCompare
    ) -> Dict[str, Any]:
        """
        对比BOM版本
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            material_id: 主物料ID
            data: BOM版本对比数据
            
        Returns:
            Dict[str, Any]: 版本对比结果
        """
        # 查询两个版本的BOM
        version1_boms = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            version=data.version1,
            deleted_at__isnull=True
        ).prefetch_related("component").all()
        
        version2_boms = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            version=data.version2,
            deleted_at__isnull=True
        ).prefetch_related("component").all()
        
        # 构建版本1的映射（component_id -> BOM）
        version1_map = {bom.component_id: bom for bom in version1_boms}
        version2_map = {bom.component_id: bom for bom in version2_boms}
        
        # 找出差异
        added = []  # 新增的子件
        removed = []  # 删除的子件
        modified = []  # 修改的子件
        
        # 检查版本2中新增或修改的子件
        for bom2 in version2_boms:
            component = await Material.get(id=bom2.component_id)
            if bom2.component_id not in version1_map:
                # 新增
                added.append({
                    "component_id": bom2.component_id,
                    "component_code": component.main_code,
                    "component_name": component.name,
                    "quantity": float(bom2.quantity),
                    "unit": bom2.unit,
                    "waste_rate": float(bom2.waste_rate or Decimal("0.00")),
                })
            else:
                # 检查是否修改
                bom1 = version1_map[bom2.component_id]
                if (bom1.quantity != bom2.quantity or
                    bom1.unit != bom2.unit or
                    bom1.waste_rate != bom2.waste_rate or
                    bom1.is_required != bom2.is_required):
                    modified.append({
                        "component_id": bom2.component_id,
                        "component_code": component.main_code,
                        "component_name": component.name,
                        "version1": {
                            "quantity": float(bom1.quantity),
                            "unit": bom1.unit,
                            "waste_rate": float(bom1.waste_rate or Decimal("0.00")),
                            "is_required": bom1.is_required,
                        },
                        "version2": {
                            "quantity": float(bom2.quantity),
                            "unit": bom2.unit,
                            "waste_rate": float(bom2.waste_rate or Decimal("0.00")),
                            "is_required": bom2.is_required,
                        }
                    })
        
        # 检查版本1中删除的子件
        for bom1 in version1_boms:
            if bom1.component_id not in version2_map:
                component = await Material.get(id=bom1.component_id)
                removed.append({
                    "component_id": bom1.component_id,
                    "component_code": component.main_code,
                    "component_name": component.name,
                    "quantity": float(bom1.quantity),
                    "unit": bom1.unit,
                    "waste_rate": float(bom1.waste_rate or Decimal("0.00")),
                })
        
        return {
            "material_id": material_id,
            "version1": data.version1,
            "version2": data.version2,
            "added": added,
            "removed": removed,
            "modified": modified
        }


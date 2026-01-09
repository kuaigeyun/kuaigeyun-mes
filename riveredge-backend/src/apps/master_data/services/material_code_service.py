"""
物料编码服务模块

提供物料编码相关的业务逻辑处理，包括主编码生成、编码映射、重复物料识别等。

Author: Luigi Lu
Date: 2026-01-08
"""

from typing import List, Optional, Dict, Any
from decimal import Decimal
from tortoise.models import Q
from loguru import logger

from apps.master_data.models.material import Material
from apps.master_data.models.material_code_alias import MaterialCodeAlias
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class MaterialCodeService:
    """物料编码服务"""
    
    # 物料类型映射
    MATERIAL_TYPE_MAP = {
        "FIN": "成品",
        "SEMI": "半成品",
        "RAW": "原材料",
        "PACK": "包装材料",
        "AUX": "辅助材料",
    }
    
    @staticmethod
    async def generate_main_code(
        tenant_id: int,
        material_type: str = "RAW",
        rule_id: Optional[int] = None
    ) -> str:
        """
        生成主编码
        
        使用编码规则引擎根据配置的规则生成主编码。
        
        Args:
            tenant_id: 租户ID
            material_type: 物料类型（FIN/SEMI/RAW/PACK/AUX）
            rule_id: 规则ID（可选，如果未提供则使用当前启用的规则）
            
        Returns:
            str: 生成的主编码
            
        Raises:
            NotFoundError: 当找不到规则或类型配置时抛出
            ValidationError: 当规则配置无效时抛出
        """
        # 验证物料类型
        if material_type not in MaterialCodeService.MATERIAL_TYPE_MAP:
            material_type = "RAW"  # 默认使用原材料类型
        
        # 使用规则引擎生成编码
        from core.services.business.material_code_rule_engine import MaterialCodeRuleEngine
        
        try:
            main_code = await MaterialCodeRuleEngine.generate_main_code(
                tenant_id=tenant_id,
                material_type=material_type,
                rule_id=rule_id
            )
            
            # 验证生成的主编码是否已存在
            existing = await Material.filter(
                tenant_id=tenant_id,
                main_code=main_code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                # 如果已存在，尝试重新生成（最多尝试10次）
                logger.warning(f"主编码 {main_code} 已存在，尝试重新生成")
                for i in range(10):
                    main_code = await MaterialCodeRuleEngine.generate_main_code(
                        tenant_id=tenant_id,
                        material_type=material_type,
                        rule_id=rule_id
                    )
                    existing = await Material.filter(
                        tenant_id=tenant_id,
                        main_code=main_code,
                        deleted_at__isnull=True
                    ).first()
                    if not existing:
                        break
                else:
                    raise ValidationError(f"无法生成唯一的主编码，请检查规则配置")
            
            logger.info(f"为租户 {tenant_id} 生成主编码: {main_code} (类型: {material_type})")
            return main_code
            
        except NotFoundError:
            # 如果找不到规则配置，使用默认规则（向后兼容）
            logger.warning(f"未找到主编码规则配置，使用默认规则生成编码")
            return await MaterialCodeService._generate_main_code_fallback(
                tenant_id=tenant_id,
                material_type=material_type
            )
    
    @staticmethod
    async def _generate_main_code_fallback(
        tenant_id: int,
        material_type: str = "RAW"
    ) -> str:
        """
        使用默认规则生成主编码（向后兼容）
        
        当找不到规则配置时，使用硬编码的默认规则。
        
        Args:
            tenant_id: 租户ID
            material_type: 物料类型
            
        Returns:
            str: 生成的主编码
        """
        # 查询该类型下最大的序号
        prefix = f"MAT-{material_type}-"
        existing_materials = await Material.filter(
            tenant_id=tenant_id,
            main_code__startswith=prefix,
            deleted_at__isnull=True
        ).all()
        
        # 提取序号并找到最大值
        max_sequence = 0
        for material in existing_materials:
            try:
                # 提取序号部分（MAT-FIN-0001 -> 0001）
                sequence_str = material.main_code.split("-")[-1]
                sequence = int(sequence_str)
                if sequence > max_sequence:
                    max_sequence = sequence
            except (ValueError, IndexError):
                # 如果格式不正确，跳过
                continue
        
        # 生成新序号（4位数字，从0001开始）
        new_sequence = max_sequence + 1
        main_code = f"{prefix}{new_sequence:04d}"
        
        logger.info(f"使用默认规则为租户 {tenant_id} 生成主编码: {main_code} (类型: {material_type})")
        return main_code
    
    @staticmethod
    async def create_code_alias(
        tenant_id: int,
        material_id: int,
        code_type: str,
        code: str,
        department: Optional[str] = None,
        description: Optional[str] = None,
        is_primary: bool = False,
        external_entity_type: Optional[str] = None,
        external_entity_id: Optional[int] = None
    ) -> MaterialCodeAlias:
        """
        创建编码别名（部门编码）
        
        Args:
            tenant_id: 租户ID
            material_id: 物料ID
            code_type: 编码类型（SALE/DES/SUP/PUR/WH/PROD等）
            code: 部门编码
            department: 部门名称（可选）
            description: 描述（可选）
            is_primary: 是否为主要编码
            
        Returns:
            MaterialCodeAlias: 创建的编码别名对象
            
        Raises:
            ValidationError: 当编码已存在或格式无效时抛出
        """
        # 验证编码格式（如果配置了验证规则）
        from core.services.business.material_code_rule_engine import MaterialCodeRuleEngine
        
        try:
            await MaterialCodeRuleEngine.validate_alias_code(
                tenant_id=tenant_id,
                code_type=code_type,
                code=code
            )
        except NotFoundError:
            # 如果没有配置规则，跳过验证
            pass
        
        # 检查编码是否已存在
        # 对于客户编码和供应商编码，需要同时检查external_entity_id
        query = MaterialCodeAlias.filter(
            tenant_id=tenant_id,
            code_type=code_type,
            code=code,
            deleted_at__isnull=True
        )
        
        # 如果是客户编码或供应商编码，需要检查external_entity_id
        if external_entity_type and external_entity_id:
            query = query.filter(
                external_entity_type=external_entity_type,
                external_entity_id=external_entity_id
            )
        
        existing = await query.first()
        
        if existing:
            # 如果已存在，检查是否映射到同一物料
            if existing.material_id != material_id:
                raise ValidationError(
                    f"编码类型 {code_type} 的编码 {code} 已存在，映射到物料 {existing.material_id}。"
                    f"如需合并物料，请使用物料映射工具。"
                )
            # 如果映射到同一物料，直接返回现有记录
            return existing
        
        # 如果设置为主要编码，取消同类型的其他主要编码
        if is_primary:
            await MaterialCodeAlias.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                code_type=code_type,
                is_primary=True,
                deleted_at__isnull=True
            ).update(is_primary=False)
        
        # 创建编码别名
        code_alias = await MaterialCodeAlias.create(
            tenant_id=tenant_id,
            material_id=material_id,
            code_type=code_type,
            code=code,
            department=department,
            description=description,
            is_primary=is_primary,
            external_entity_type=external_entity_type,
            external_entity_id=external_entity_id
        )
        
        logger.info(f"为物料 {material_id} 创建编码别名: {code_type}:{code}")
        return code_alias
    
    @staticmethod
    async def get_material_by_code(
        tenant_id: int,
        code: str,
        code_type: Optional[str] = None
    ) -> Optional[Material]:
        """
        通过编码查询物料（支持主编码和部门编码）
        
        Args:
            tenant_id: 租户ID
            code: 编码（主编码或部门编码）
            code_type: 编码类型（可选，如果提供则只查询该类型的部门编码）
            
        Returns:
            Optional[Material]: 物料对象，如果不存在则返回None
        """
        # 首先尝试通过主编码查询
        material = await Material.filter(
            tenant_id=tenant_id,
            main_code=code,
            deleted_at__isnull=True
        ).first()
        
        if material:
            return material
        
        # 如果未找到，尝试通过部门编码查询
        query = MaterialCodeAlias.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True
        )
        
        if code_type:
            query = query.filter(code_type=code_type)
        
        code_alias = await query.first()
        
        if code_alias:
            # 通过别名找到物料
            material = await Material.filter(
                tenant_id=tenant_id,
                id=code_alias.material_id,
                deleted_at__isnull=True
            ).first()
            return material
        
        return None
    
    @staticmethod
    async def get_material_aliases(
        tenant_id: int,
        material_id: int
    ) -> List[MaterialCodeAlias]:
        """
        获取物料的所有编码别名
        
        Args:
            tenant_id: 租户ID
            material_id: 物料ID
            
        Returns:
            List[MaterialCodeAlias]: 编码别名列表
        """
        aliases = await MaterialCodeAlias.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True
        ).all()
        
        return aliases
    
    @staticmethod
    async def find_duplicate_materials(
        tenant_id: int,
        name: str,
        specification: Optional[str] = None,
        base_unit: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        智能识别重复物料
        
        识别策略：
        - 高置信度：名称+规格+单位完全一致
        - 中置信度：名称相似+规格相同
        - 低置信度：名称相似但规格不同
        
        Args:
            tenant_id: 租户ID
            name: 物料名称
            specification: 规格（可选）
            base_unit: 基础单位（可选）
            
        Returns:
            List[Dict[str, Any]]: 重复物料列表，包含匹配度和匹配原因
        """
        duplicates = []
        
        # 查询所有未删除的物料
        materials = await Material.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).all()
        
        for material in materials:
            match_score = 0
            match_reasons = []
            
            # 名称匹配（精确匹配）
            if material.name == name:
                match_score += 50
                match_reasons.append("名称完全一致")
            # 名称相似匹配（简单实现，可以后续优化为拼音匹配、模糊匹配等）
            elif name.lower() in material.name.lower() or material.name.lower() in name.lower():
                match_score += 20
                match_reasons.append("名称相似")
            
            # 规格匹配
            if specification and material.specification:
                if material.specification == specification:
                    match_score += 30
                    match_reasons.append("规格完全一致")
                elif specification.lower() in material.specification.lower():
                    match_score += 10
                    match_reasons.append("规格相似")
            
            # 单位匹配
            if base_unit and material.base_unit:
                if material.base_unit == base_unit:
                    match_score += 20
                    match_reasons.append("单位一致")
            
            # 如果匹配度达到阈值，添加到重复列表
            if match_score >= 50:  # 至少名称完全一致或名称相似+规格一致
                confidence = "high" if match_score >= 80 else ("medium" if match_score >= 60 else "low")
                duplicates.append({
                    "material": material,
                    "match_score": match_score,
                    "confidence": confidence,
                    "reasons": match_reasons
                })
        
        # 按匹配度排序
        duplicates.sort(key=lambda x: x["match_score"], reverse=True)
        
        return duplicates
    
    @staticmethod
    async def merge_materials(
        tenant_id: int,
        source_material_id: int,
        target_material_id: int,
        merged_by: int
    ) -> Material:
        """
        合并物料（将源物料合并到目标物料）
        
        合并策略：
        - 保留目标物料
        - 将源物料的所有编码别名映射到目标物料
        - 合并物料属性（取并集）
        - 删除源物料（软删除）
        
        Args:
            tenant_id: 租户ID
            source_material_id: 源物料ID（将被合并的物料）
            target_material_id: 目标物料ID（保留的物料）
            merged_by: 合并人ID
            
        Returns:
            Material: 合并后的物料对象
            
        Raises:
            NotFoundError: 当物料不存在时抛出
            ValidationError: 当源物料和目标物料相同时抛出
        """
        if source_material_id == target_material_id:
            raise ValidationError("不能将物料合并到自己")
        
        # 获取源物料和目标物料
        source_material = await Material.filter(
            tenant_id=tenant_id,
            id=source_material_id,
            deleted_at__isnull=True
        ).first()
        
        target_material = await Material.filter(
            tenant_id=tenant_id,
            id=target_material_id,
            deleted_at__isnull=True
        ).first()
        
        if not source_material:
            raise NotFoundError(f"源物料 {source_material_id} 不存在")
        
        if not target_material:
            raise NotFoundError(f"目标物料 {target_material_id} 不存在")
        
        # 获取源物料的所有编码别名
        source_aliases = await MaterialCodeAlias.filter(
            tenant_id=tenant_id,
            material_id=source_material_id,
            deleted_at__isnull=True
        ).all()
        
        # 将源物料的编码别名映射到目标物料
        for alias in source_aliases:
            try:
                # 尝试创建新的编码别名（如果已存在会抛出异常，忽略即可）
                await MaterialCodeService.create_code_alias(
                    tenant_id=tenant_id,
                    material_id=target_material_id,
                    code_type=alias.code_type,
                    code=alias.code,
                    department=alias.department,
                    description=alias.description,
                    is_primary=alias.is_primary
                )
            except ValidationError:
                # 如果编码已存在，跳过
                logger.warning(f"编码别名 {alias.code_type}:{alias.code} 已存在，跳过")
        
        # 合并物料属性（取并集）
        # 如果目标物料的某个字段为空，使用源物料的值
        if not target_material.specification and source_material.specification:
            target_material.specification = source_material.specification
        
        if not target_material.description and source_material.description:
            target_material.description = source_material.description
        
        if not target_material.brand and source_material.brand:
            target_material.brand = source_material.brand
        
        if not target_material.model and source_material.model:
            target_material.model = source_material.model
        
        # 保存目标物料
        await target_material.save()
        
        # 软删除源物料
        from datetime import datetime
        source_material.deleted_at = datetime.now()
        await source_material.save()
        
        logger.info(f"物料 {source_material_id} 已合并到物料 {target_material_id}")
        return target_material

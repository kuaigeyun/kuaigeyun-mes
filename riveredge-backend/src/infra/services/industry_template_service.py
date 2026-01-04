"""
行业模板服务模块

提供行业模板相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-01-15
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import HTTPException, status
from loguru import logger
from tortoise.exceptions import DoesNotExist, IntegrityError

from infra.models.industry_template import IndustryTemplate
from infra.models.tenant import Tenant
from infra.schemas.industry_template import (
    IndustryTemplateCreate,
    IndustryTemplateUpdate,
    IndustryTemplateResponse,
    IndustryTemplateListResponse,
)


class IndustryTemplateService:
    """
    行业模板服务类
    
    提供行业模板相关的业务逻辑处理。
    """
    
    async def get_template_list(
        self,
        industry: Optional[str] = None,
        is_active: Optional[bool] = True,
    ) -> IndustryTemplateListResponse:
        """
        获取行业模板列表
        
        Args:
            industry: 行业类型筛选（可选）
            is_active: 是否只返回启用的模板（可选，默认True）
            
        Returns:
            IndustryTemplateListResponse: 模板列表响应
        """
        # 构建查询条件（行业模板是平台级的，tenant_id 为 None）
        query = IndustryTemplate.filter(tenant_id__isnull=True)
        
        if industry:
            query = query.filter(industry=industry)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        # 按排序顺序和创建时间排序
        query = query.order_by("sort_order", "created_at")
        
        # 执行查询
        templates = await query.all()
        
        # 转换为响应格式
        items = [
            IndustryTemplateResponse(
                id=template.id,
                uuid=template.uuid,
                name=template.name,
                code=template.code,
                industry=template.industry,
                description=template.description,
                config=template.config,
                is_active=template.is_active,
                is_default=template.is_default,
                sort_order=template.sort_order,
                usage_count=template.usage_count,
                last_used_at=template.last_used_at,
                created_at=template.created_at,
                updated_at=template.updated_at,
            )
            for template in templates
        ]
        
        return IndustryTemplateListResponse(
            items=items,
            total=len(items)
        )
    
    async def get_template_by_id(
        self,
        template_id: int
    ) -> IndustryTemplate:
        """
        根据ID获取行业模板
        
        Args:
            template_id: 模板ID
            
        Returns:
            IndustryTemplate: 模板对象
            
        Raises:
            HTTPException: 模板不存在时抛出
        """
        template = await IndustryTemplate.get_or_none(id=template_id, tenant_id__isnull=True)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"行业模板不存在: {template_id}"
            )
        return template
    
    async def get_template_by_code(
        self,
        code: str
    ) -> IndustryTemplate:
        """
        根据代码获取行业模板
        
        Args:
            code: 模板代码
            
        Returns:
            IndustryTemplate: 模板对象
            
        Raises:
            HTTPException: 模板不存在时抛出
        """
        template = await IndustryTemplate.get_or_none(code=code, tenant_id__isnull=True)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"行业模板不存在: {code}"
            )
        return template
    
    async def create_template(
        self,
        data: IndustryTemplateCreate
    ) -> IndustryTemplate:
        """
        创建行业模板
        
        Args:
            data: 模板创建数据
            
        Returns:
            IndustryTemplate: 创建的模板对象
            
        Raises:
            HTTPException: 模板代码已存在时抛出
        """
        try:
            # 创建模板（行业模板是平台级的，tenant_id 为 None）
            template = await IndustryTemplate.create(
                tenant_id=None,
                name=data.name,
                code=data.code,
                industry=data.industry,
                description=data.description,
                config=data.config,
                is_active=data.is_active,
                is_default=data.is_default,
                sort_order=data.sort_order,
            )
            
            logger.info(f"创建行业模板: {template.code} ({template.name})")
            return template
            
        except IntegrityError as e:
            if "code" in str(e).lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"模板代码已存在: {data.code}"
                )
            raise
    
    async def update_template(
        self,
        template_id: int,
        data: IndustryTemplateUpdate
    ) -> IndustryTemplate:
        """
        更新行业模板
        
        Args:
            template_id: 模板ID
            data: 模板更新数据
            
        Returns:
            IndustryTemplate: 更新后的模板对象
            
        Raises:
            HTTPException: 模板不存在时抛出
        """
        template = await self.get_template_by_id(template_id)
        
        # 构建更新数据（只更新提供的字段）
        update_data = data.model_dump(exclude_unset=True)
        
        if update_data:
            # 如果更新了 code，检查是否冲突
            if "code" in update_data and update_data["code"] != template.code:
                existing = await IndustryTemplate.get_or_none(
                    code=update_data["code"],
                    tenant_id__isnull=True
                )
                if existing and existing.id != template_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"模板代码已存在: {update_data['code']}"
                    )
            
            # 更新字段
            for field, value in update_data.items():
                setattr(template, field, value)
            
            await template.save()
            logger.info(f"更新行业模板: {template.code} ({template.name})")
        
        return template
    
    async def apply_template_to_tenant(
        self,
        template_id: int,
        tenant_id: int
    ) -> Dict[str, Any]:
        """
        应用行业模板到指定组织
        
        将模板配置应用到组织，包括：
        - 编码规则
        - 系统参数
        - 默认角色
        - 默认菜单配置等
        
        Args:
            template_id: 模板ID
            tenant_id: 组织ID
            
        Returns:
            dict: 应用结果
            
        Raises:
            HTTPException: 模板或组织不存在时抛出
        """
        # 获取模板
        template = await self.get_template_by_id(template_id)
        
        # 检查组织是否存在
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"组织不存在: {tenant_id}"
            )
        
        # 实现模板应用逻辑
        config = template.config or {}
        
        # 记录应用日志
        logger.info(f"开始应用行业模板 {template.code} 到组织 {tenant_id}")
        
        # 使用事务确保一致性
        from tortoise.transactions import in_transaction
        
        applied_items = {
            "code_rules": 0,
            "system_params": 0,
            "roles": 0,
            "menus": 0,
        }
        
        try:
            async with in_transaction():
                # 1. 应用编码规则（从模板config中读取code_rules）
                if "code_rules" in config and isinstance(config["code_rules"], list):
                    from core.services.business.code_rule_service import CodeRuleService
                    from core.schemas.code_rule import CodeRuleCreate
                    
                    for rule_data in config["code_rules"]:
                        try:
                            rule_create = CodeRuleCreate(**rule_data)
                            await CodeRuleService.create_rule(tenant_id, rule_create)
                            applied_items["code_rules"] += 1
                        except Exception as e:
                            logger.warning(f"应用编码规则失败（跳过）: {rule_data.get('code', 'unknown')}, 错误: {e}")
                            # 如果规则已存在，跳过（不中断流程）
                            continue
                
                # 2. 应用系统参数（从模板config中读取system_params）
                if "system_params" in config and isinstance(config["system_params"], list):
                    from core.services.system.system_parameter_service import SystemParameterService
                    from core.schemas.system_parameter import SystemParameterCreate
                    
                    for param_data in config["system_params"]:
                        try:
                            param_create = SystemParameterCreate(**param_data)
                            await SystemParameterService.create_parameter(tenant_id, param_create)
                            applied_items["system_params"] += 1
                        except Exception as e:
                            logger.warning(f"应用系统参数失败（跳过）: {param_data.get('key', 'unknown')}, 错误: {e}")
                            # 如果参数已存在，跳过（不中断流程）
                            continue
                
                # 3. 创建默认角色（从模板config中读取roles）
                if "roles" in config and isinstance(config["roles"], list):
                    from core.services.authorization.role_service import RoleService
                    from core.schemas.role import RoleCreate
                    from infra.models.user import User
                    
                    # 获取组织管理员作为当前用户（用于创建角色）
                    admin_user = await User.filter(
                        tenant_id=tenant_id,
                        is_tenant_admin=True
                    ).first()
                    
                    if admin_user:
                        for role_data in config["roles"]:
                            try:
                                role_create = RoleCreate(**role_data)
                                await RoleService.create_role(tenant_id, role_create, admin_user.id)
                                applied_items["roles"] += 1
                            except Exception as e:
                                logger.warning(f"创建角色失败（跳过）: {role_data.get('code', 'unknown')}, 错误: {e}")
                                # 如果角色已存在，跳过（不中断流程）
                                continue
                    else:
                        logger.warning(f"组织 {tenant_id} 没有管理员用户，跳过角色创建")
                
                # 4. 应用菜单配置（从模板config中读取menus）
                # 注意：菜单配置比较复杂，涉及父子关系和顺序，这里简化处理
                # 如果需要应用菜单，建议使用菜单导入功能或手动配置
                if "menus" in config and isinstance(config["menus"], list):
                    from core.services.system.menu_service import MenuService
                    from core.schemas.menu import MenuCreate
                    
                    # 菜单需要按顺序创建（先创建父菜单，再创建子菜单）
                    # 这里简化处理，只创建顶级菜单
                    for menu_data in config["menus"]:
                        try:
                            # 只处理没有父菜单的顶级菜单（parent_uuid为空或None）
                            if not menu_data.get("parent_uuid"):
                                menu_create = MenuCreate(**menu_data)
                                await MenuService.create_menu(tenant_id, menu_create)
                                applied_items["menus"] += 1
                        except Exception as e:
                            logger.warning(f"创建菜单失败（跳过）: {menu_data.get('name', 'unknown')}, 错误: {e}")
                            # 如果菜单已存在，跳过（不中断流程）
                            continue
                
                # 更新模板使用统计
                template.usage_count += 1
                template.last_used_at = datetime.utcnow()
                await template.save()
                
                # 在组织设置中记录应用的模板
                tenant_settings = tenant.settings or {}
                tenant_settings["applied_template_id"] = template_id
                tenant_settings["applied_template_code"] = template.code
                tenant_settings["applied_template_at"] = datetime.utcnow().isoformat()
                await Tenant.filter(id=tenant_id).update(settings=tenant_settings)
                
                logger.info(f"行业模板 {template.code} 应用成功到组织 {tenant_id}，应用项: {applied_items}")
        
        except Exception as e:
            logger.error(f"应用行业模板失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"应用行业模板失败: {str(e)}"
            )
        
        return {
            "success": True,
            "message": f"行业模板 {template.name} 应用成功",
            "template_id": template_id,
            "tenant_id": tenant_id,
            "applied_items": applied_items,
            "applied_config": config,
        }
    
    async def delete_template(
        self,
        template_id: int
    ) -> Dict[str, Any]:
        """
        删除行业模板
        
        Args:
            template_id: 模板ID
            
        Returns:
            dict: 删除结果
            
        Raises:
            HTTPException: 模板不存在时抛出
        """
        template = await self.get_template_by_id(template_id)
        
        # 检查是否被使用（usage_count > 0）
        if template.usage_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"模板已被使用 {template.usage_count} 次，不能删除"
            )
        
        template_name = template.name
        template_code = template.code
        
        await template.delete()
        
        logger.info(f"删除行业模板: {template_code} ({template_name})")
        
        return {
            "success": True,
            "message": f"行业模板 {template_name} 删除成功"
        }


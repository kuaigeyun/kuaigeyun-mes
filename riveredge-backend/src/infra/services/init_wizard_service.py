"""
初始化向导服务模块

提供初始化向导相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-01-15
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import HTTPException, status
from loguru import logger

from infra.models.tenant import Tenant
from infra.services.tenant_service import TenantService
from infra.services.user_service import UserService
from infra.schemas.init_wizard import (
    InitWizardStepResponse,
    InitStepsResponse,
    InitWizardData,
    Step1OrganizationInfo,
    Step2DefaultSettings,
    Step2_5CodeRules,
    Step3AdminInfo,
    Step4Template,
)
from infra.schemas.user import UserUpdate


class InitWizardService:
    """
    初始化向导服务类
    
    提供初始化向导相关的业务逻辑处理。
    """
    
    # 初始化步骤配置
    INIT_STEPS = [
        {
            "step_id": "step1",
            "title": "组织信息完善",
            "description": "补充组织基本信息",
            "order": 1,
            "required": True,
        },
        {
            "step_id": "step2",
            "title": "默认设置",
            "description": "配置时区、货币、语言等默认设置",
            "order": 2,
            "required": True,
        },
        {
            "step_id": "step2_5",
            "title": "编码规则配置",
            "description": "配置各种单据的编码规则（可选，可使用默认规则）",
            "order": 2.5,
            "required": False,
        },
        {
            "step_id": "step3",
            "title": "管理员信息",
            "description": "完善管理员个人信息",
            "order": 3,
            "required": False,
        },
        {
            "step_id": "step4",
            "title": "选择行业模板",
            "description": "选择适合的行业模板快速配置（可选）",
            "order": 4,
            "required": False,
        },
        {
            "step_id": "step5",
            "title": "完成",
            "description": "确认并完成初始化",
            "order": 5,
            "required": True,
        },
    ]
    
    async def get_init_steps(
        self,
        tenant_id: int
    ) -> InitStepsResponse:
        """
        获取初始化步骤列表
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            InitStepsResponse: 初始化步骤列表响应
        """
        # 检查组织是否存在
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="组织不存在"
            )
        
        # 构建步骤响应列表，根据 tenant.settings 细粒度判断各步骤完成状态
        settings = tenant.settings or {}
        init_completed = bool(settings.get("init_completed"))

        # 根据已保存的 init_step* 数据判断各步骤是否完成（有数据即视为完成）
        completed_steps = set()
        if settings.get("init_step1"):
            completed_steps.add("step1")
        if settings.get("init_step2"):
            completed_steps.add("step2")
        if settings.get("init_step2_5"):
            completed_steps.add("step2_5")
        if settings.get("init_step3"):
            completed_steps.add("step3")
        if settings.get("init_step4"):
            completed_steps.add("step4")
        if init_completed:
            completed_steps.add("step5")

        steps = []
        for step_config in self.INIT_STEPS:
            steps.append(InitWizardStepResponse(
                step_id=step_config["step_id"],
                title=step_config["title"],
                description=step_config["description"],
                order=step_config["order"],
                required=step_config["required"],
                completed=step_config["step_id"] in completed_steps,
            ))

        # 计算当前步骤：第一个未完成的步骤
        current_step = None
        for step in steps:
            if not step.completed:
                current_step = step.step_id
                break

        # 进度：已完成步骤数 / 总步骤数 * 100
        total_count = len(self.INIT_STEPS)
        completed_count = len(completed_steps)
        progress = (completed_count / total_count * 100) if total_count > 0 else 0

        return InitStepsResponse(
            steps=steps,
            current_step=current_step,
            progress=progress,
            init_completed=init_completed,
        )
    
    async def complete_step(
        self,
        tenant_id: int,
        step_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        完成初始化步骤
        
        Args:
            tenant_id: 组织ID
            step_id: 步骤ID
            data: 步骤数据
            
        Returns:
            dict: 完成结果
        """
        # 检查组织是否存在
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="组织不存在"
            )
        
        # 根据步骤ID处理数据
        if step_id == "step1":
            # 步骤1：组织信息完善
            step_data = Step1OrganizationInfo(**data)
            # 更新组织设置（这里简化处理，实际应该更新组织相关字段）
            settings = tenant.settings or {}
            settings["init_step1"] = step_data.model_dump()
            await Tenant.filter(id=tenant_id).update(settings=settings)
            
        elif step_id == "step2":
            # 步骤2：默认设置（同步到站点设置，与站点设置格式一致）
            step_data = Step2DefaultSettings(**data)
            settings = tenant.settings or {}
            settings["init_step2"] = step_data.model_dump()
            await Tenant.filter(id=tenant_id).update(settings=settings)
            # 同步到站点设置
            from core.schemas.site_setting import SiteSettingUpdate
            from core.services.system.site_setting_service import SiteSettingService
            site_settings = {
                "timezone": step_data.timezone,
                "default_currency": step_data.default_currency,
                "default_language": step_data.default_language,
                "date_format": step_data.date_format,
            }
            await SiteSettingService.update_settings(tenant_id, SiteSettingUpdate(settings=site_settings))
            
        elif step_id == "step2_5":
            # 步骤2.5：编码规则配置
            step_data = Step2_5CodeRules(**data)
            settings = tenant.settings or {}
            settings["init_step2_5"] = step_data.model_dump()
            await Tenant.filter(id=tenant_id).update(settings=settings)
            
            # 如果使用默认规则，创建默认编码规则
            if step_data.use_default_rules:
                from core.services.default.default_values_service import DefaultValuesService
                default_service = DefaultValuesService()
                await default_service.create_default_code_rules(tenant_id)
                logger.info(f"组织 {tenant_id} 在步骤2.5中创建了默认编码规则")
            
        elif step_id == "step3":
            # 步骤3：管理员信息
            step_data = Step3AdminInfo(**data)
            # 更新管理员信息（需要获取管理员用户）
            user_service = UserService()
            # 查找组织管理员
            from infra.models.user import User
            admin_user = await User.filter(
                tenant_id=tenant_id,
                is_tenant_admin=True
            ).first()
            
            if admin_user:
                update_data = {}
                if step_data.full_name:
                    update_data["full_name"] = step_data.full_name
                if step_data.email:
                    update_data["email"] = step_data.email
                
                if update_data:
                    await User.filter(id=admin_user.id).update(**update_data)
            
        elif step_id == "step4":
            # 步骤4：选择行业模板
            step_data = Step4Template(**data)
            settings = tenant.settings or {}
            settings["init_step4"] = step_data.model_dump()
            await Tenant.filter(id=tenant_id).update(settings=settings)
            
            # 如果选择了模板，应用模板
            if step_data.template_id:
                from infra.services.industry_template_service import IndustryTemplateService
                template_service = IndustryTemplateService()
                try:
                    await template_service.apply_template_to_tenant(step_data.template_id, tenant_id)
                    logger.info(f"组织 {tenant_id} 在步骤4中应用了行业模板 {step_data.template_id}")
                except Exception as e:
                    logger.warning(f"应用行业模板失败（不中断流程）: {e}")
                    # 如果应用失败，不中断流程，只记录警告
        
        return {
            "success": True,
            "message": f"步骤 {step_id} 完成",
            "step_id": step_id
        }
    
    async def complete_init_wizard(
        self,
        tenant_id: int,
        init_data: InitWizardData
    ) -> Dict[str, Any]:
        """
        完成初始化向导
        
        Args:
            tenant_id: 组织ID
            init_data: 初始化数据
            
        Returns:
            dict: 完成结果
        """
        # 检查组织是否存在
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="组织不存在"
            )
        
        # 保存所有步骤数据
        settings = tenant.settings or {}
        
        if init_data.step1_organization_info:
            settings["init_step1"] = init_data.step1_organization_info.model_dump()
        
        if init_data.step2_default_settings:
            settings["init_step2"] = init_data.step2_default_settings.model_dump()
            # 同步到站点设置（与站点设置格式一致）
            from core.schemas.site_setting import SiteSettingUpdate
            from core.services.system.site_setting_service import SiteSettingService
            s2 = init_data.step2_default_settings
            site_settings = {
                "timezone": s2.timezone,
                "default_currency": s2.default_currency,
                "default_language": s2.default_language,
                "date_format": s2.date_format,
            }
            await SiteSettingService.update_settings(tenant_id, SiteSettingUpdate(settings=site_settings))
        
        if init_data.step3_admin_info:
            settings["init_step3"] = init_data.step3_admin_info.model_dump()
            # 更新管理员信息
            from infra.models.user import User
            admin_user = await User.filter(
                tenant_id=tenant_id,
                is_tenant_admin=True
            ).first()
            
            if admin_user:
                update_data = {}
                if init_data.step3_admin_info.full_name:
                    update_data["full_name"] = init_data.step3_admin_info.full_name
                if init_data.step3_admin_info.email:
                    update_data["email"] = init_data.step3_admin_info.email
                
                if update_data:
                    await User.filter(id=admin_user.id).update(**update_data)
        
        if init_data.step4_template:
            settings["init_step4"] = init_data.step4_template.model_dump()
            # 如果选择了模板，应用模板
            if init_data.step4_template.template_id:
                from infra.services.industry_template_service import IndustryTemplateService
                template_service = IndustryTemplateService()
                try:
                    await template_service.apply_template_to_tenant(init_data.step4_template.template_id, tenant_id)
                    logger.info(f"组织 {tenant_id} 在完成向导时应用了行业模板 {init_data.step4_template.template_id}")
                except Exception as e:
                    logger.warning(f"应用行业模板失败（不中断流程）: {e}")
                    # 如果应用失败，不中断流程，只记录警告
        
        # 如果还没有创建默认配置，则创建默认编码规则和系统参数
        if not settings.get("defaults_initialized"):
            from core.services.default.default_values_service import DefaultValuesService
            try:
                await DefaultValuesService.initialize_tenant_defaults(tenant_id)
                settings["defaults_initialized"] = True
                logger.info(f"组织 {tenant_id} 默认配置初始化完成")
            except Exception as e:
                logger.warning(f"组织 {tenant_id} 默认配置初始化失败（不中断流程）: {e}")
        
        # 标记初始化完成
        settings["init_completed"] = True
        settings["init_completed_at"] = datetime.now().isoformat()
        
        await Tenant.filter(id=tenant_id).update(settings=settings)
        
        logger.info(f"组织 {tenant_id} 初始化向导完成")
        
        return {
            "success": True,
            "message": "初始化完成",
            "tenant_id": tenant_id
        }


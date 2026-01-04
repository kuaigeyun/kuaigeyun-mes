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
        
        # 构建步骤响应列表
        steps = []
        completed_steps = set()  # 根据组织设置判断已完成的步骤
        
        # 检查步骤完成情况（简化实现，后续可根据实际情况完善）
        if tenant.settings and tenant.settings.get("init_completed"):
            completed_steps.add("step1")
            completed_steps.add("step2")
            completed_steps.add("step3")
            completed_steps.add("step4")
        
        for step_config in self.INIT_STEPS:
            steps.append(InitWizardStepResponse(
                step_id=step_config["step_id"],
                title=step_config["title"],
                description=step_config["description"],
                order=step_config["order"],
                required=step_config["required"],
                completed=step_config["step_id"] in completed_steps,
            ))
        
        # 计算当前步骤和进度
        current_step = None
        completed_count = len(completed_steps)
        total_count = len([s for s in self.INIT_STEPS if s["required"]])
        
        if completed_count < total_count:
            # 找到第一个未完成的必填步骤
            for step in steps:
                if step.required and not step.completed:
                    current_step = step.step_id
                    break
        
        progress = (completed_count / total_count * 100) if total_count > 0 else 0
        
        return InitStepsResponse(
            steps=steps,
            current_step=current_step,
            progress=progress
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
            # 步骤2：默认设置
            step_data = Step2DefaultSettings(**data)
            settings = tenant.settings or {}
            settings["init_step2"] = step_data.model_dump()
            # 更新时区、货币、语言等（如果有对应字段）
            await Tenant.filter(id=tenant_id).update(settings=settings)
            
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
            
            # 如果选择了模板，应用模板（后续实现）
            if step_data.template_id:
                # TODO: 应用行业模板
                pass
        
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
            # 如果选择了模板，应用模板（后续实现）
            if init_data.step4_template.template_id:
                # TODO: 应用行业模板
                pass
        
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


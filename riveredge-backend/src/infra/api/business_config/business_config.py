"""
业务配置 API 模块

提供业务配置相关的 API 接口，包括运行模式切换、流程模块开关、流程参数配置等。

Author: Luigi Lu
Date: 2026-01-27
"""

from fastapi import APIRouter, HTTPException, Depends, status
from loguru import logger

from infra.schemas.business_config import (
    BusinessConfigResponse,
    RunningModeSwitchRequest,
    ModuleSwitchRequest,
    ProcessParameterUpdateRequest,
    BatchProcessParameterUpdateRequest,
    ConfigTemplateSaveRequest,
    ConfigTemplateApplyRequest,
)
from infra.services.business_config_service import BusinessConfigService
from infra.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError, NotFoundError, BusinessLogicError

# 创建路由
router = APIRouter(prefix="/business-config", tags=["Business Config"])


@router.get("", response_model=BusinessConfigResponse, summary="获取业务配置")
async def get_business_config(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BusinessConfigResponse:
    """
    获取业务配置
    
    返回当前组织的业务配置，包括运行模式、模块开关、流程参数等。
    """
    try:
        config = await BusinessConfigService().get_business_config(tenant_id)
        return BusinessConfigResponse(**config)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"获取业务配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取业务配置失败: {str(e)}")


@router.post("/running-mode/switch", summary="切换运行模式")
async def switch_running_mode(
    request: RunningModeSwitchRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    切换运行模式
    
    支持在极简模式和全流程模式之间切换，切换时自动应用对应模式的默认配置。
    """
    try:
        result = await BusinessConfigService().switch_running_mode(
            tenant_id=tenant_id,
            mode=request.mode,
            apply_defaults=request.apply_defaults
        )
        return result
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"切换运行模式失败: {e}")
        raise HTTPException(status_code=500, detail=f"切换运行模式失败: {str(e)}")


@router.post("/modules/switch", summary="更新模块开关")
async def update_module_switch(
    request: ModuleSwitchRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    更新模块开关
    
    支持独立开启/关闭流程模块。核心模块（生产管理、仓储管理）不可关闭。
    """
    try:
        result = await BusinessConfigService().update_module_switch(
            tenant_id=tenant_id,
            module_code=request.module_code,
            enabled=request.enabled
        )
        return result
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"更新模块开关失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新模块开关失败: {str(e)}")


@router.post("/parameters/update", summary="更新流程参数")
async def update_process_parameter(
    request: ProcessParameterUpdateRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    更新流程参数
    
    更新指定分类的流程参数。
    """
    try:
        result = await BusinessConfigService().update_process_parameter(
            tenant_id=tenant_id,
            category=request.category,
            parameter_key=request.parameter_key,
            value=request.value
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"更新流程参数失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新流程参数失败: {str(e)}")


@router.post("/parameters/batch-update", summary="批量更新流程参数")
async def batch_update_process_parameters(
    request: BatchProcessParameterUpdateRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    批量更新流程参数
    
    支持一次性更新多个分类的流程参数。
    """
    try:
        result = await BusinessConfigService().batch_update_process_parameters(
            tenant_id=tenant_id,
            parameters=request.parameters
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"批量更新流程参数失败: {e}")
        raise HTTPException(status_code=500, detail=f"批量更新流程参数失败: {str(e)}")


@router.get("/pro-features/check", summary="检查PRO版功能访问权限")
async def check_pro_feature_access(
    feature_type: str,
    feature_code: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    检查PRO版功能访问权限
    
    检查指定功能是否为PRO版功能，以及当前组织是否有权限访问。
    """
    try:
        result = await BusinessConfigService().check_pro_feature_access(
            tenant_id=tenant_id,
            feature_type=feature_type,
            feature_code=feature_code
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"检查PRO版功能访问权限失败: {e}")
        raise HTTPException(status_code=500, detail=f"检查PRO版功能访问权限失败: {str(e)}")


@router.get("/pro-features/list", summary="获取PRO版功能列表")
async def get_pro_features_list(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    获取PRO版功能列表
    
    返回所有PRO版功能列表，以及当前组织的套餐信息。
    """
    try:
        result = await BusinessConfigService().get_pro_features_list(tenant_id)
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"获取PRO版功能列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取PRO版功能列表失败: {str(e)}")


@router.post("/templates/save", summary="保存配置模板")
async def save_config_template(
    request: ConfigTemplateSaveRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    保存配置模板
    
    将当前业务配置保存为模板，方便后续复用。
    """
    try:
        result = await BusinessConfigService().save_config_template(
            tenant_id=tenant_id,
            template_name=request.template_name,
            template_description=request.template_description
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"保存配置模板失败: {e}")
        raise HTTPException(status_code=500, detail=f"保存配置模板失败: {str(e)}")


@router.get("/templates", summary="获取配置模板列表")
async def get_config_templates(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> list:
    """
    获取配置模板列表
    
    返回当前组织的所有配置模板。
    """
    try:
        result = await BusinessConfigService().get_config_templates(tenant_id)
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"获取配置模板列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取配置模板列表失败: {str(e)}")


@router.post("/templates/apply", summary="应用配置模板")
async def apply_config_template(
    request: ConfigTemplateApplyRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    应用配置模板
    
    应用指定的配置模板，将模板配置应用到当前组织。
    """
    try:
        result = await BusinessConfigService().apply_config_template(
            tenant_id=tenant_id,
            template_id=request.template_id
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"应用配置模板失败: {e}")
        raise HTTPException(status_code=500, detail=f"应用配置模板失败: {str(e)}")


@router.delete("/templates/{template_id}", summary="删除配置模板")
async def delete_config_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    删除配置模板
    
    删除指定的配置模板。
    """
    try:
        result = await BusinessConfigService().delete_config_template(
            tenant_id=tenant_id,
            template_id=template_id
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"删除配置模板失败: {e}")
        raise HTTPException(status_code=500, detail=f"删除配置模板失败: {str(e)}")

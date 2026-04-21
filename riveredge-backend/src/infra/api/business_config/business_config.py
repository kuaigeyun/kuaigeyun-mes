"""
业务配置 API 模块

提供业务「参数」配置相关的 API 接口（如 BOM 多版本、销售/采购/财务参数等）。

变更说明（2026 重构）：
- 业务蓝图设置已下线；功能是否开启由「菜单管理」决定，是否审核由「流程设置（ApprovalProcess）」决定。
- 本模块不再提供 nodes/modules/running-mode/complexity-presets/templates 等蓝图相关接口，
  仅保留纯参数 (`parameters.*`) 的读取与更新，供系统参数 Tab 使用。
- PRO 功能列表/校验接口仍然保留，与套餐相关。

Author: Luigi Lu
"""

from fastapi import APIRouter, HTTPException, Depends
from loguru import logger

from infra.schemas.business_config import (
    BusinessConfigResponse,
    ProcessParameterUpdateRequest,
    BatchProcessParameterUpdateRequest,
)
from infra.services.business_config_service import BusinessConfigService
from infra.api.deps.deps import get_current_user
from core.api.deps.deps import get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError, NotFoundError, BusinessLogicError

router = APIRouter(prefix="/business-config", tags=["Business Config"])


@router.get("/schema", summary="获取业务配置 schema")
async def get_config_schema(
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    获取业务配置 schema（参数键）

    返回可配置的参数分类及键，供前端动态渲染系统参数表单。
    蓝图相关 (processRegistry / allNodes 等) 已移除。
    """
    from infra.services.business_config_service import (
        _build_parameter_keys_schema,
        _build_process_registry_schema,
        _build_process_registry_meta_schema,
        _build_process_registry_param_meta_schema,
        _build_process_registry_control_meta_schema,
        _build_parameter_registry_schema,
        _build_parameter_registry_meta_schema,
        _build_parameter_registry_param_meta_schema,
        _build_parameter_registry_control_meta_schema,
        _build_parameter_implementation_schema,
    )
    # 说明：processRegistry 与 parameterRegistry 都属于系统「参数」分组，
    # 前端配置中心据此渲染「流程设置」「参数设置」两个参数 Tab；
    # 蓝图节点相关 (allNodes 等) 已在蓝图下线时移除。
    return {
        "processRegistry": _build_process_registry_schema(),
        "processRegistryMeta": _build_process_registry_meta_schema(),
        "processRegistryParamMeta": _build_process_registry_param_meta_schema(),
        "processRegistryControlMeta": _build_process_registry_control_meta_schema(),
        "parameterRegistry": _build_parameter_registry_schema(),
        "parameterRegistryMeta": _build_parameter_registry_meta_schema(),
        "parameterRegistryParamMeta": _build_parameter_registry_param_meta_schema(),
        "parameterRegistryControlMeta": _build_parameter_registry_control_meta_schema(),
        "parameterKeys": _build_parameter_keys_schema(),
        "parameterImplementation": _build_parameter_implementation_schema(),
    }


@router.get("", response_model=BusinessConfigResponse, summary="获取业务配置")
async def get_business_config(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> BusinessConfigResponse:
    """
    获取业务配置（仅 parameters 有效；nodes/modules 字段已废弃，读取时返回空或历史值）。
    """
    try:
        config = await BusinessConfigService().get_business_config(tenant_id)
        return BusinessConfigResponse(**config)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"获取业务配置失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取业务配置失败: {str(e)}")


@router.get("/audit-required", summary="批量获取单据审核开关")
async def get_audit_required_map(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    返回当前组织各单据节点是否需要审核。
    审核真源为 ApprovalProcess(code=node_key, is_active=true)。
    """
    try:
        result = await BusinessConfigService().get_audit_required_map(tenant_id)
        return {"audit_required": result}
    except Exception as e:
        logger.error(f"获取审核开关失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取审核开关失败: {str(e)}")


@router.post("/parameters/update", summary="更新流程参数")
async def update_process_parameter(
    request: ProcessParameterUpdateRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """更新指定分类下的单个参数。"""
    try:
        return await BusinessConfigService().update_process_parameter(
            tenant_id=tenant_id,
            category=request.category,
            parameter_key=request.parameter_key,
            value=request.value,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"更新流程参数失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新流程参数失败: {str(e)}")


@router.post("/parameters/batch-update", summary="批量更新流程参数")
async def batch_update_process_parameters(
    request: BatchProcessParameterUpdateRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """批量更新多个分类的参数。"""
    try:
        return await BusinessConfigService().batch_update_process_parameters(
            tenant_id=tenant_id,
            parameters=request.parameters,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"批量更新流程参数失败: {e}")
        raise HTTPException(status_code=500, detail=f"批量更新流程参数失败: {str(e)}")


@router.get("/pro-features/check", summary="检查 PRO 版功能访问权限")
async def check_pro_feature_access(
    feature_type: str,
    feature_code: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    try:
        return await BusinessConfigService().check_pro_feature_access(
            tenant_id=tenant_id,
            feature_type=feature_type,
            feature_code=feature_code,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"检查 PRO 版功能访问权限失败: {e}")
        raise HTTPException(status_code=500, detail=f"检查 PRO 版功能访问权限失败: {str(e)}")


@router.get("/pro-features/list", summary="获取 PRO 版功能列表")
async def get_pro_features_list(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    try:
        return await BusinessConfigService().get_pro_features_list(tenant_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"获取 PRO 版功能列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取 PRO 版功能列表失败: {str(e)}")

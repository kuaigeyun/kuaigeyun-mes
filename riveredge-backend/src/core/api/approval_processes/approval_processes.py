"""
审批流程管理 API 路由

提供审批流程的 CRUD 操作。
"""

from typing import Optional, List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query
from loguru import logger
from pydantic import ValidationError as PydanticValidationError

from core.schemas.approval_process import (
    ApprovalProcessCreate,
    ApprovalProcessUpdate,
    ApprovalProcessResponse,
)
from core.services.approval.approval_process_service import ApprovalProcessService
from core.api.deps.deps import get_current_tenant
from core.services.system.installed_feature_scope import get_installed_application_codes
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/approval-processes", tags=["Core · Approval Processes"])


def _normalize_json_object(value: Any, field_name: str, process_uuid: Any) -> Dict[str, Any]:
    """
    将历史脏数据归一化为对象，避免响应序列化 ValidationError 直接打断列表接口。
    """
    if isinstance(value, dict):
        return value
    if value is None:
        return {}
    logger.warning(
        "审批流程 {} 字段 {} 非对象类型({})，已降级为空对象返回",
        process_uuid,
        field_name,
        type(value).__name__,
    )
    return {}


def _to_response_model(approval_process: Any) -> ApprovalProcessResponse:
    canonical_name = ApprovalProcessService._resolve_canonical_name(
        getattr(approval_process, "code", None),
        getattr(approval_process, "name", None),
    )
    payload = {
        "uuid": approval_process.uuid,
        "tenant_id": approval_process.tenant_id,
        "name": canonical_name or approval_process.name,
        "code": approval_process.code,
        "description": approval_process.description,
        "nodes": _normalize_json_object(getattr(approval_process, "nodes", None), "nodes", approval_process.uuid),
        "config": _normalize_json_object(getattr(approval_process, "config", None), "config", approval_process.uuid),
        "is_active": approval_process.is_active,
        "version": getattr(approval_process, "version", 1) or 1,
        "published_version": getattr(approval_process, "published_version", 1) or 1,
        "draft_nodes": _normalize_json_object(
            getattr(approval_process, "draft_nodes", None), "draft_nodes", approval_process.uuid
        ) if getattr(approval_process, "draft_nodes", None) else None,
        "created_at": approval_process.created_at,
        "updated_at": approval_process.updated_at,
    }
    return ApprovalProcessResponse.model_validate(payload)


@router.post("", response_model=ApprovalProcessResponse, status_code=status.HTTP_201_CREATED)
async def create_approval_process(
    data: ApprovalProcessCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建审批流程
    
    创建新的审批流程。
    
    Args:
        data: 审批流程创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ApprovalProcessResponse: 创建的审批流程对象
        
    Raises:
        HTTPException: 当流程代码已存在时抛出
    """
    try:
        approval_process = await ApprovalProcessService.create_approval_process(
            tenant_id=tenant_id,
            data=data
        )
        return _to_response_model(approval_process)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[ApprovalProcessResponse])
async def list_approval_processes(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    for_audit_config: bool = Query(False, description="配置中心审核设置：返回全部审核开关流程"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取审批流程列表
    
    获取当前组织的审批流程列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[ApprovalProcessResponse]: 审批流程列表
    """
    try:
        approval_processes = await ApprovalProcessService.list_approval_processes(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            is_active=is_active,
            installed_app_codes=await get_installed_application_codes(tenant_id),
            for_audit_config=for_audit_config,
        )
    except Exception as e:
        logger.exception(
            "查询审批流程列表失败 tenant_id={} skip={} limit={} is_active={} error={}",
            tenant_id,
            skip,
            limit,
            is_active,
            e,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="审批流程列表查询失败，请检查后端日志",
        )

    result: List[ApprovalProcessResponse] = []
    for ap in approval_processes:
        try:
            result.append(_to_response_model(ap))
        except (PydanticValidationError, Exception) as e:
            logger.exception(
                "审批流程序列化失败，uuid={} tenant_id={}，已跳过。错误: {}",
                getattr(ap, "uuid", None),
                tenant_id,
                e,
            )
    return result


@router.get("/auditable")
async def list_auditable_documents(
    tenant_id: int = Depends(get_current_tenant),
):
    """
    可审核单据注册表。

    单据声明来自 manifest.audit；开关与流程绑定来自 AuditDocumentBinding。
    """
    from core.config.audit_registry import entries_grouped_by_app
    from core.services.approval.audit_binding_service import AuditBindingService

    installed = await get_installed_application_codes(tenant_id)
    await AuditBindingService.ensure_binding_rows(tenant_id)
    grouped = entries_grouped_by_app()
    binding_map = await AuditBindingService.get_binding_map(tenant_id)

    result: List[Dict[str, Any]] = []
    for app_code, entries in grouped.items():
        if app_code not in installed:
            continue
        items = []
        for e in entries:
            binding = binding_map.get(e.node_key)
            process = binding.process if binding else None
            enabled = bool(
                binding
                and binding.is_enabled
                and process
                and process.deleted_at is None
            )
            items.append(
                {
                    "node_key": e.node_key,
                    "code": e.node_key,
                    "entity_type": e.entity_type,
                    "resource": e.resource,
                    "name": e.name,
                    "template": e.template,
                    "config_category": e.config_category,
                    "is_active": enabled,
                    "process_uuid": str(process.uuid) if process else None,
                    "process_name": process.name if process else None,
                }
            )
        result.append({"app": app_code, "items": items})
    return {"apps": result}


@router.get("/condition-fields")
async def get_condition_fields(
    entity_type: str = Query(..., description="实体类型"),
    tenant_id: int = Depends(get_current_tenant),
):
    """设计器条件分支：按 entity_type 返回可用字段。"""
    from core.config.audit_condition_fields import condition_fields_for_entity

    _ = tenant_id
    return {"entity_type": entity_type, "fields": condition_fields_for_entity(entity_type)}


@router.get("/editable-fields")
async def get_editable_fields(
    entity_type: str = Query(..., description="实体类型"),
    tenant_id: int = Depends(get_current_tenant),
):
    """审核中改单：按 entity_type 返回默认可编辑字段。"""
    from core.config.audit_editable_fields import editable_fields_for_entity

    _ = tenant_id
    spec = editable_fields_for_entity(entity_type)
    return {"entity_type": entity_type, "fields": spec}


@router.get("/{uuid}", response_model=ApprovalProcessResponse)
async def get_approval_process(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取审批流程详情
    
    根据UUID获取审批流程详情。
    
    Args:
        uuid: 审批流程UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ApprovalProcessResponse: 审批流程对象
        
    Raises:
        HTTPException: 当审批流程不存在时抛出
    """
    try:
        approval_process = await ApprovalProcessService.get_approval_process_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return _to_response_model(approval_process)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=ApprovalProcessResponse)
async def update_approval_process(
    uuid: str,
    data: ApprovalProcessUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新审批流程
    
    更新审批流程信息。
    
    Args:
        uuid: 审批流程UUID
        data: 审批流程更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ApprovalProcessResponse: 更新后的审批流程对象
        
    Raises:
        HTTPException: 当审批流程不存在时抛出
    """
    try:
        approval_process = await ApprovalProcessService.update_approval_process(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return _to_response_model(approval_process)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{uuid}/publish", response_model=ApprovalProcessResponse)
async def publish_approval_process(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """发布审批流程（递增版本；进行中实例仍使用创建时钉扎的版本）。"""
    try:
        approval_process = await ApprovalProcessService.publish_approval_process(
            tenant_id=tenant_id,
            uuid=uuid,
        )
        return _to_response_model(approval_process)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_approval_process(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除审批流程
    
    软删除审批流程。
    
    Args:
        uuid: 审批流程UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当审批流程不存在时抛出
    """
    try:
        await ApprovalProcessService.delete_approval_process(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


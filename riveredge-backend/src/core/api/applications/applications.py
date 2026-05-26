"""
应用管理 API 路由

提供应用的 CRUD 操作和安装/卸载功能。
"""

from typing import Optional, List, Dict, Any, Set
from fastapi import APIRouter, Depends, HTTPException, status, Query
import hashlib
import hmac
import os
from datetime import datetime, timezone

from core.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
    ProActivationRequest,
)
from core.services.application.application_service import ApplicationService
from core.services.application.application_registry_service import ApplicationRegistryService
from core.services.application.application_route_manager import get_route_manager
import json
from pathlib import Path
from core.api.deps.deps import get_current_tenant
from core.api.deps.access import AuthContext, get_auth_context
from core.services.application.application_dedicated_binding_service import ApplicationDedicatedBindingService
from core.schemas.system_parameter import SystemParameterCreate, SystemParameterUpdate
from core.services.system.system_parameter_service import SystemParameterService
from infra.services.license_center_service import LicenseCenterService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.tenant import Tenant
from infra.domain.package_config import can_use_pro_apps
from loguru import logger

router = APIRouter(prefix="/applications", tags=["Core · Applications"])
PRO_ACTIVATION_REGISTRY_KEY = "pro_app_activation_registry"


def _require_tenant_or_platform_admin(auth: AuthContext) -> None:
    if not (auth.is_tenant_admin or auth.is_infra_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅组织管理员或平台管理员可安装、卸载、启停应用或激活专业版授权。",
        )


async def _assert_application_visible_to_viewer(
    tenant_id: int,
    application: Dict[str, Any],
    _auth: AuthContext,
) -> None:
    """专用应用可见性仅取决于当前租户绑定（平台管理员在租户上下文中也不绕过）。"""
    if not ApplicationService.effective_is_dedicated(application):
        return
    bound = await ApplicationDedicatedBindingService.fetch_bound_codes_for_tenant(tenant_id)
    if str(application.get("code") or "") not in bound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="应用不存在")


async def _load_pro_activation_registry(tenant_id: int) -> Dict[str, Any]:
    parameter = await SystemParameterService.get_parameter(
        tenant_id=tenant_id,
        key=PRO_ACTIVATION_REGISTRY_KEY,
        use_cache=True,
    )
    if not parameter:
        return {"version": 1, "apps": {}}
    value = parameter.get_value()
    if isinstance(value, dict):
        apps = value.get("apps")
        if isinstance(apps, dict):
            return {"version": int(value.get("version", 1)), "apps": apps}
    return {"version": 1, "apps": {}}


async def _save_pro_activation_registry(tenant_id: int, registry: Dict[str, Any]) -> None:
    existing = await SystemParameterService.get_parameter(
        tenant_id=tenant_id,
        key=PRO_ACTIVATION_REGISTRY_KEY,
        use_cache=False,
    )
    if existing:
        await SystemParameterService.update_parameter(
            tenant_id=tenant_id,
            uuid=str(existing.uuid),
            data=SystemParameterUpdate(value=registry),
        )
        return
    await SystemParameterService.create_parameter(
        tenant_id=tenant_id,
        data=SystemParameterCreate(
            key=PRO_ACTIVATION_REGISTRY_KEY,
            value=registry,
            type="json",
            description="PRO 应用 Key 激活注册表（仅存摘要）",
            is_system=True,
            is_active=True,
        ),
    )


async def _get_activated_pro_codes(tenant_id: int) -> Set[str]:
    registry = await _load_pro_activation_registry(tenant_id)
    return set((registry.get("apps") or {}).keys())


def _parse_pro_key_map_from_env() -> Dict[str, List[str]]:
    raw = os.getenv("RIVEREDGE_PRO_APP_KEYS", "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            output: Dict[str, List[str]] = {}
            for app_code, keys in parsed.items():
                if isinstance(keys, list):
                    output[str(app_code)] = [str(item).strip() for item in keys if str(item).strip()]
                elif isinstance(keys, str) and keys.strip():
                    output[str(app_code)] = [keys.strip()]
            return output
    except json.JSONDecodeError:
        pass
    wildcard_keys = [item.strip() for item in raw.split(",") if item.strip()]
    return {"*": wildcard_keys}


def _is_valid_pro_key(app_code: str, key: str) -> bool:
    key_map = _parse_pro_key_map_from_env()
    if not key_map:
        return False
    candidates = key_map.get(app_code, []) + key_map.get("*", [])
    cleaned_key = key.strip()
    return any(hmac.compare_digest(cleaned_key, candidate) for candidate in candidates)


async def _is_valid_license_key(app_code: str, license_key: str) -> bool:
    # 优先校验平台级许可证中心，其次兼容环境变量白名单
    if await LicenseCenterService.verify_license_key(app_code=app_code, license_key=license_key):
        return True
    return _is_valid_pro_key(app_code, license_key)


def _build_key_digest(tenant_id: int, app_code: str, key: str) -> str:
    salt = os.getenv("RIVEREDGE_PRO_KEY_DIGEST_SALT", "riveredge-pro-key-salt")
    payload = f"{tenant_id}:{app_code}:{key.strip()}:{salt}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _enrich_app_with_pro_info(app: dict, activated_codes: Set[str]) -> dict:
    """从 manifest 读取 is_pro，并计算 can_access，注入到 app_data。"""
    code = app.get('code')
    manifest = ApplicationService._get_manifest_by_code(code) if code else None
    is_pro = bool(manifest.get('is_pro', False)) if manifest else False
    has_key_access = bool(code and code in activated_codes)
    # 产品规则：PRO 应用必须先完成 License Key 激活；套餐权限不再作为绕过条件
    can_access = not is_pro or has_key_access
    return {'is_pro': is_pro, 'can_access': can_access}


def _application_response_dict(application: Dict[str, Any], pro_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """合并 PRO 字段，并以 manifest 校准 is_dedicated（与列表接口一致）。"""
    payload = {**application, **(pro_info or {})}
    payload["is_dedicated"] = ApplicationService.effective_is_dedicated(application)
    return payload


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    data: ApplicationCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建应用

    创建新应用并保存到数据库。

    Args:
        data: 应用创建数据
        tenant_id: 当前组织ID（依赖注入）

    Returns:
        ApplicationResponse: 创建的应用对象

    Raises:
        HTTPException: 当应用代码已存在时抛出
    """
    try:
        application = await ApplicationService.create_application(
            tenant_id=tenant_id,
            data=data
        )
        return ApplicationResponse.model_validate(_application_response_dict(application))
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[ApplicationResponse])
async def list_applications(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_installed: Optional[bool] = Query(None, description="是否已安装（可选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    获取应用列表

    获取当前组织的应用列表，支持分页和筛选。

    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        is_installed: 是否已安装（可选）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）

    Returns:
        List[ApplicationResponse]: 应用列表
    """
    applications = await ApplicationService.list_applications(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        is_installed=is_installed,
        is_active=is_active,
    )

    # 获取租户套餐是否允许 PRO 应用
    tenant = await Tenant.get_or_none(id=tenant_id)
    allow_pro_apps = can_use_pro_apps(tenant.plan) if tenant else False
    activated_codes = await _get_activated_pro_codes(tenant_id)

    # 安全构造响应对象，避免传递多余字段
    result = []
    for app in applications:
        try:
            # 处理 JSON 字段：如果 menu_config 是字符串，需要解析为字典
            if 'menu_config' in app and isinstance(app['menu_config'], str):
                try:
                    import json
                    app['menu_config'] = json.loads(app['menu_config']) if app['menu_config'] else None
                except (json.JSONDecodeError, TypeError):
                    app['menu_config'] = None

            pro_info = _enrich_app_with_pro_info(app, activated_codes)
            # 只保留 ApplicationResponse 需要的字段，避免传递多余字段
            # is_custom_name/is_custom_sort 使用 .get 兼容数据库未执行迁移 127 的环境
            app_data = {
                'uuid': app.get('uuid'),
                'tenant_id': app.get('tenant_id'),
                'name': app.get('name'),
                'code': app.get('code'),
                'description': app.get('description'),
                'icon': app.get('icon'),
                'version': app.get('version'),
                'changelog': app.get('changelog'),
                'route_path': app.get('route_path'),
                'entry_point': app.get('entry_point'),
                'menu_config': app.get('menu_config'),
                'permission_code': app.get('permission_code'),
                'is_system': app.get('is_system', False),
                'is_dedicated': ApplicationService.effective_is_dedicated(app),
                'is_active': app.get('is_active', True),
                'is_installed': app.get('is_installed', False),
                'is_custom_name': app.get('is_custom_name', False),
                'is_custom_sort': app.get('is_custom_sort', False),
                'sort_order': app.get('sort_order', 0),
                'created_at': app.get('created_at'),
                'updated_at': app.get('updated_at'),
                **pro_info,
            }

            # 构造响应对象
            app_response = ApplicationResponse(**app_data)
            result.append(app_response)

        except Exception as e:
            # 记录错误但不中断整个响应
            logger.error(f"处理应用 {app.get('code', 'unknown')} 时出错: {e}")
            continue

    return result


@router.get("/installed", response_model=List[ApplicationResponse])
async def list_installed_applications(
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    获取已安装的应用列表

    @param is_active: 是否启用（可选）
    @param tenant_id: 当前组织ID（依赖注入）
    @return: 已安装的应用列表
    """
    applications = await ApplicationService.get_installed_applications(
        tenant_id=tenant_id,
        is_active=is_active,
    )

    # 获取租户套餐是否允许 PRO 应用
    tenant = await Tenant.get_or_none(id=tenant_id)
    allow_pro_apps = can_use_pro_apps(tenant.plan) if tenant else False
    activated_codes = await _get_activated_pro_codes(tenant_id)

    # 安全构造响应对象，避免传递多余字段
    result = []
    for app in applications:
        try:
            # 处理 JSON 字段：如果 menu_config 是字符串，需要解析为字典
            if 'menu_config' in app and isinstance(app['menu_config'], str):
                try:
                    import json
                    app['menu_config'] = json.loads(app['menu_config']) if app['menu_config'] else None
                except (json.JSONDecodeError, TypeError):
                    app['menu_config'] = None

            pro_info = _enrich_app_with_pro_info(app, activated_codes)
            # 只保留 ApplicationResponse 需要的字段，避免传递多余字段
            # is_custom_name/is_custom_sort 使用 .get 兼容数据库未执行迁移 127 的环境
            app_data = {
                'uuid': app.get('uuid'),
                'tenant_id': app.get('tenant_id'),
                'name': app.get('name'),
                'code': app.get('code'),
                'description': app.get('description'),
                'icon': app.get('icon'),
                'version': app.get('version'),
                'changelog': app.get('changelog'),
                'route_path': app.get('route_path'),
                'entry_point': app.get('entry_point'),
                'menu_config': app.get('menu_config'),
                'permission_code': app.get('permission_code'),
                'is_system': app.get('is_system', False),
                'is_dedicated': ApplicationService.effective_is_dedicated(app),
                'is_active': app.get('is_active', True),
                'is_installed': app.get('is_installed', False),
                'is_custom_name': app.get('is_custom_name', False),
                'is_custom_sort': app.get('is_custom_sort', False),
                'sort_order': app.get('sort_order', 0),
                'created_at': app.get('created_at'),
                'updated_at': app.get('updated_at'),
                **pro_info,
            }

            # 构造响应对象
            app_response = ApplicationResponse(**app_data)
            result.append(app_response)

        except Exception as e:
            # 记录错误但不中断整个响应
            logger.error(f"处理应用 {app.get('code', 'unknown')} 时出错: {e}")
            continue

    return result


@router.get("/{uuid}", response_model=ApplicationResponse)
async def get_application(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    获取应用详情

    根据UUID获取应用的详细信息。

    Args:
        uuid: 应用UUID
        tenant_id: 当前组织ID（依赖注入）

    Returns:
        ApplicationResponse: 应用对象

    Raises:
        HTTPException: 当应用不存在时抛出
    """
    try:
        application = await ApplicationService.get_application_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        await _assert_application_visible_to_viewer(tenant_id, application, auth)
        tenant = await Tenant.get_or_none(id=tenant_id)
        allow_pro_apps = can_use_pro_apps(tenant.plan) if tenant else False
        activated_codes = await _get_activated_pro_codes(tenant_id)
        pro_info = _enrich_app_with_pro_info(application, activated_codes)
        return ApplicationResponse.model_validate(_application_response_dict(application, pro_info))
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=ApplicationResponse)
async def update_application(
    uuid: str,
    data: ApplicationUpdate,
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    更新应用

    更新应用信息。

    Args:
        uuid: 应用UUID
        data: 应用更新数据
        tenant_id: 当前组织ID（依赖注入）

    Returns:
        ApplicationResponse: 更新后的应用对象

    Raises:
        HTTPException: 当应用不存在时抛出
    """
    try:
        existing = await ApplicationService.get_application_by_uuid(tenant_id=tenant_id, uuid=uuid)
        await _assert_application_visible_to_viewer(tenant_id, existing, auth)
        application = await ApplicationService.update_application(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return ApplicationResponse.model_validate(_application_response_dict(application))
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    删除应用

    删除指定的应用。

    Args:
        uuid: 应用UUID
        tenant_id: 当前组织ID（依赖注入）

    Raises:
        HTTPException: 当应用不存在时抛出
    """
    try:
        existing = await ApplicationService.get_application_by_uuid(tenant_id=tenant_id, uuid=uuid)
        await _assert_application_visible_to_viewer(tenant_id, existing, auth)
        await ApplicationService.delete_application(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{uuid}/install", response_model=ApplicationResponse)
async def install_application(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    安装应用

    安装指定的应用并可选同步菜单配置；安装后应用默认为未启用状态，
    须调用启用接口才会启用（PRO 应用在启用时会校验 License）。

    Args:
        uuid: 应用UUID
        tenant_id: 当前组织ID（依赖注入）

    Returns:
        ApplicationResponse: 安装后的应用对象

    Raises:
        HTTPException: 当应用不存在时抛出
    """
    try:
        _require_tenant_or_platform_admin(auth)
        existing = await ApplicationService.get_application_by_uuid(tenant_id=tenant_id, uuid=uuid)
        await _assert_application_visible_to_viewer(tenant_id, existing, auth)
        application = await ApplicationService.install_application(
            tenant_id=tenant_id,
            uuid=uuid
        )
        # 获取最新的 PRO 信息
        activated_codes = await _get_activated_pro_codes(tenant_id)
        pro_info = _enrich_app_with_pro_info(application, activated_codes)
        
        return ApplicationResponse.model_validate(_application_response_dict(application, pro_info))
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"安装应用失败: {str(e)}"
        )


@router.post("/{uuid}/uninstall", response_model=ApplicationResponse)
async def uninstall_application(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    卸载应用

    卸载指定的应用，并删除关联菜单。

    Args:
        uuid: 应用UUID
        tenant_id: 当前组织ID（依赖注入）

    Returns:
        ApplicationResponse: 卸载后的应用对象

    Raises:
        HTTPException: 当应用不存在时抛出
    """
    try:
        _require_tenant_or_platform_admin(auth)
        existing = await ApplicationService.get_application_by_uuid(tenant_id=tenant_id, uuid=uuid)
        await _assert_application_visible_to_viewer(tenant_id, existing, auth)
        application = await ApplicationService.uninstall_application(
            tenant_id=tenant_id,
            uuid=uuid
        )
        # 获取最新的 PRO 信息
        activated_codes = await _get_activated_pro_codes(tenant_id)
        pro_info = _enrich_app_with_pro_info(application, activated_codes)
        
        return ApplicationResponse.model_validate(_application_response_dict(application, pro_info))
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"卸载应用失败: {str(e)}"
        )


@router.post("/{uuid}/enable", response_model=ApplicationResponse)
async def enable_application(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    启用应用

    启用指定的应用，并同步更新相关菜单状态。

    Args:
        uuid: 应用UUID
        tenant_id: 当前组织ID（依赖注入）

    Returns:
        ApplicationResponse: 启用后的应用对象

    Raises:
        HTTPException: 当应用不存在时抛出
    """
    try:
        _require_tenant_or_platform_admin(auth)
        app_detail = await ApplicationService.get_application_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid,
        )
        await _assert_application_visible_to_viewer(tenant_id, app_detail, auth)
        tenant = await Tenant.get_or_none(id=tenant_id)
        allow_pro_apps = can_use_pro_apps(tenant.plan) if tenant else False
        activated_codes = await _get_activated_pro_codes(tenant_id)
        pro_info = _enrich_app_with_pro_info(app_detail, activated_codes)
        if pro_info.get("is_pro") and not pro_info.get("can_access"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="PRO 应用未激活，请先输入有效 License Key。",
            )

        application = await ApplicationService.enable_application(
            tenant_id=tenant_id,
            uuid=uuid
        )
        
        # ⚠️ 第一阶段改进：动态注册应用路由
        try:
            # 使用应用代码注册路由
            app_code = application.get('code') or application.get('uuid')
            if app_code:
                await ApplicationRegistryService.register_single_app(app_code)
        except Exception as route_error:
            # 路由注册失败不影响应用启用，只记录日志
            import logging
            logging.warning(f"应用路由注册失败（不影响应用启用）: {route_error}")
        
        return ApplicationResponse.model_validate(_application_response_dict(application, pro_info))
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"启用应用失败: {str(e)}"
        )


@router.post("/{uuid}/activate-pro", response_model=ApplicationResponse)
async def activate_pro_application(
    uuid: str,
    payload: ProActivationRequest,
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """激活 PRO 应用访问权限（仅存许可证摘要，不保存明文）。"""
    _require_tenant_or_platform_admin(auth)
    key = (payload.license_key or "").strip()
    if len(key) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="License Key 格式不合法，请检查后重试。",
        )
    app = await ApplicationService.get_application_by_uuid(tenant_id=tenant_id, uuid=uuid)
    await _assert_application_visible_to_viewer(tenant_id, app, auth)
    app_code = app.get("code")
    manifest = ApplicationService._get_manifest_by_code(app_code) if app_code else None
    is_pro = bool(manifest.get("is_pro", False)) if manifest else False
    if not is_pro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="当前应用不是 PRO 应用，无需输入 License Key。",
        )
    # 平台许可证中心：成功时会做激活配额占用，避免一个 Key 被多人重复滥用
    consumed = await LicenseCenterService.consume_license_key(
        app_code=app_code,
        license_key=key,
        tenant_id=tenant_id,
    )
    if not consumed and not _is_valid_pro_key(app_code, key):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="License Key 无效或已超过可激活次数，请联系平台管理员确认授权信息。",
        )

    registry = await _load_pro_activation_registry(tenant_id)
    apps_registry = registry.setdefault("apps", {})
    apps_registry[app_code] = {
        "digest": _build_key_digest(tenant_id, app_code, key),
        "last4": key[-4:],
        "activated_at": datetime.now(timezone.utc).isoformat(),
    }
    await _save_pro_activation_registry(tenant_id, registry)

    tenant = await Tenant.get_or_none(id=tenant_id)
    allow_pro_apps = can_use_pro_apps(tenant.plan) if tenant else False
    activated_codes = await _get_activated_pro_codes(tenant_id)
    pro_info = _enrich_app_with_pro_info(app, activated_codes)
    return ApplicationResponse.model_validate(_application_response_dict(app, pro_info))


@router.post("/{uuid}/disable", response_model=ApplicationResponse)
async def disable_application(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    禁用应用

    禁用指定的应用，并同步更新相关菜单状态。

    Args:
        uuid: 应用UUID
        tenant_id: 当前组织ID（依赖注入）

    Returns:
        ApplicationResponse: 禁用后的应用对象

    Raises:
        HTTPException: 当应用不存在时抛出
    """
    try:
        _require_tenant_or_platform_admin(auth)
        existing = await ApplicationService.get_application_by_uuid(tenant_id=tenant_id, uuid=uuid)
        await _assert_application_visible_to_viewer(tenant_id, existing, auth)
        application = await ApplicationService.disable_application(
            tenant_id=tenant_id,
            uuid=uuid
        )
        
        # ⚠️ 第一阶段改进：动态移除应用路由
        try:
            # 使用应用代码移除路由
            app_code = application.get('code') or application.get('uuid')
            if app_code:
                await ApplicationRegistryService.unregister_single_app(app_code)
        except Exception as route_error:
            # 路由移除失败不影响应用禁用，只记录日志
            import logging
            logging.warning(f"应用路由移除失败（不影响应用禁用）: {route_error}")
        
        return ApplicationResponse.model_validate(_application_response_dict(application))
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"禁用应用失败: {str(e)}"
        )


@router.post("/scan", response_model=List[ApplicationResponse])
async def scan_and_register_plugins(
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    扫描并注册插件应用

    从插件目录扫描并自动注册新的应用。

    Args:
        tenant_id: 当前组织ID（依赖注入）

    Returns:
        List[ApplicationResponse]: 已注册的应用列表
    """
    try:
        applications = await ApplicationService.scan_and_register_plugins(
            tenant_id=tenant_id
        )

        bound = await ApplicationDedicatedBindingService.fetch_bound_codes_for_tenant(tenant_id)
        applications = [
            a
            for a in applications
            if not ApplicationService.effective_is_dedicated(a)
            or str(a.get("code") or "") in bound
        ]

        # 安全构造响应对象，避免传递多余字段
        result = []
        for app in applications:
            try:
                # 处理 JSON 字段：如果 menu_config 是字符串，需要解析为字典
                if 'menu_config' in app and isinstance(app['menu_config'], str):
                    try:
                        import json
                        app['menu_config'] = json.loads(app['menu_config']) if app['menu_config'] else None
                    except (json.JSONDecodeError, TypeError):
                        app['menu_config'] = None

                # 只保留 ApplicationResponse 需要的字段，避免传递多余字段
                # is_custom_name/is_custom_sort 使用 .get 兼容数据库未执行迁移 127 的环境
                app_data = {
                    'uuid': app.get('uuid'),
                    'tenant_id': app.get('tenant_id'),
                    'name': app.get('name'),
                    'code': app.get('code'),
                    'description': app.get('description'),
                    'icon': app.get('icon'),
                    'version': app.get('version'),
                    'changelog': app.get('changelog'),
                    'route_path': app.get('route_path'),
                    'entry_point': app.get('entry_point'),
                    'menu_config': app.get('menu_config'),
                    'permission_code': app.get('permission_code'),
                    'is_system': app.get('is_system', False),
                    'is_dedicated': ApplicationService.effective_is_dedicated(app),
                    'is_active': app.get('is_active', True),
                    'is_installed': app.get('is_installed', False),
                    'is_custom_name': app.get('is_custom_name', False),
                    'is_custom_sort': app.get('is_custom_sort', False),
                    'sort_order': app.get('sort_order', 0),
                    'created_at': app.get('created_at'),
                    'updated_at': app.get('updated_at'),
                }

                # 构造响应对象
                app_response = ApplicationResponse(**app_data)
                result.append(app_response)

            except Exception as e:
                # 记录错误但不中断整个响应
                logger.error(f"处理应用 {app.get('code', 'unknown')} 时出错: {e}")
                continue

        return result
    except Exception as e:
        logger.exception("扫描插件失败")
        plugins_dir = ApplicationService._get_plugins_directory()
        detail = f"扫描插件失败: {str(e)}（manifest 目录: {plugins_dir}）"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail
        )


@router.get("/test-sync")
async def test_sync_endpoint():
    """测试同步端点是否可访问"""
    return {"message": "Sync endpoint is working", "timestamp": "2024-12-01"}

@router.post("/sync-manifest/{app_code}")
async def sync_application_manifest(
    app_code: str,
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    同步应用清单配置

    从后端 src/apps/{app}/manifest.json 同步菜单配置到数据库（单一数据源）。
    解决应用菜单更新后需要重新安装的问题。

    Args:
        app_code: 应用代码
        tenant_id: 当前组织ID（依赖注入）

    Returns:
        dict: 同步结果
    """
    try:
        # 构建manifest.json文件路径（后端 apps 为来源，支持 code 与目录名不一致如 master-data/master_data）
        plugins_dir = ApplicationService._get_plugins_directory()
        for dir_name in (app_code, app_code.replace("-", "_")):
            candidate = plugins_dir / dir_name / "manifest.json"
            if candidate.exists():
                manifest_path = candidate
                break
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"manifest.json文件不存在: {app_code}"
            )

        logger.info(f"Manifest文件路径: {manifest_path}")

        # 读取manifest.json
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)

        # 获取应用信息
        app = await ApplicationService.get_application_by_code(tenant_id, app_code)
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"应用不存在: {app_code}"
            )
        await _assert_application_visible_to_viewer(tenant_id, app, auth)

        # 更新应用配置
        menu_config = manifest.get('menu_config')
        version = manifest.get('version', app.get('version', '1.0.0'))
        
        # 决定是否同步名称和排序
        app_name = app.get('name')
        if not app.get('is_custom_name'):
            app_name = manifest.get('name', app_name)
            
        app_sort_order = app.get('sort_order', 0)
        if not app.get('is_custom_sort'):
            app_sort_order = manifest.get('sort_order', app_sort_order)

        # 更新数据库中的应用配置
        update_data = ApplicationUpdate(
            name=app_name,
            menu_config=menu_config,
            version=version,
            sort_order=app_sort_order
        )

        updated_app = await ApplicationService.update_application(
            tenant_id=tenant_id,
            uuid=str(app['uuid']),
            data=update_data
        )

        logger.info(f"✅ 应用清单同步成功: {app_code} v{version}")

        return {
            "success": True,
            "message": f"应用清单同步成功: {app_code} v{version}",
            "data": {
                "app_code": app_code,
                "version": version,
                "menu_count": len((menu_config or {}).get('children', [])),
                "updated_at": updated_app.get('updated_at')
            }
        }

    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"manifest.json格式错误: {str(e)}"
        )
    except ValidationError as e:
        # 保留业务校验语义，避免统一包装成 500 导致前端误判
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except HTTPException:
        # 透传 403/404 等业务错误，前端可直接展示真实原因
        raise
    except Exception as e:
        logger.error(f"同步应用清单失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"同步失败: {str(e)}"
        )


@router.post("/{app_code}/reload-routes", summary="Reload application routes")
async def reload_app_routes(
    app_code: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    重新加载应用路由（无需重启服务）
    
    当应用代码修改后，可以通过此接口重新加载应用路由，无需重启整个后端服务。
    这对于开发环境特别有用。
    
    Args:
        app_code: 应用代码
        tenant_id: 当前组织ID（依赖注入）
    
    Returns:
        dict: 重新加载结果
    
    Raises:
        HTTPException: 当应用不存在或重新加载失败时抛出
    """
    try:
        logger.info(f"🔄 开始重新加载应用 {app_code} 的路由...")
        
        # 重新注册应用路由（使用 register_single_app 方法）
        success = await ApplicationRegistryService.register_single_app(app_code)
        
        if success:
            logger.info(f"✅ 应用 {app_code} 路由重新加载成功")
            return {
                "success": True,
                "message": f"应用 {app_code} 路由重新加载成功",
                "app_code": app_code
            }
        else:
            logger.error(f"❌ 应用 {app_code} 路由重新加载失败")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"应用 {app_code} 路由重新加载失败，请查看后端日志"
            )
    except Exception as e:
        logger.error(f"重新加载应用 {app_code} 路由失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"重新加载失败: {str(e)}"
        )
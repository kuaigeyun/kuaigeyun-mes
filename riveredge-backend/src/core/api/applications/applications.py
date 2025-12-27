"""
应用管理 API 路由

提供应用的 CRUD 操作和安装/卸载功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.models.application import Application
from core.schemas.application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
)
from core.services.application.application_service import ApplicationService
from core.services.application.application_registry_service import ApplicationRegistryService
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/applications", tags=["Applications"])


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
        return ApplicationResponse.model_validate(application)
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
        is_active=is_active
    )

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
            app_data = {
                'uuid': app.get('uuid'),
                'tenant_id': app.get('tenant_id'),
                'name': app.get('name'),
                'code': app.get('code'),
                'description': app.get('description'),
                'icon': app.get('icon'),
                'version': app.get('version'),
                'route_path': app.get('route_path'),
                'entry_point': app.get('entry_point'),
                'menu_config': app.get('menu_config'),
                'permission_code': app.get('permission_code'),
                'is_system': app.get('is_system', False),
                'is_active': app.get('is_active', True),
                'is_installed': app.get('is_installed', False),
                'sort_order': app.get('sort_order', 0),
                'created_at': app.get('created_at'),
                'updated_at': app.get('updated_at'),
            }

            # 构造响应对象
            app_response = ApplicationResponse(**app_data)
            result.append(app_response)

        except Exception as e:
            # 记录错误但不中断整个响应
            print(f"处理应用 {app.get('code', 'unknown')} 时出错: {e}")
            continue

    return result


@router.get("/installed", response_model=List[ApplicationResponse])
async def list_installed_applications(
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取已安装的应用列表

    @param is_active: 是否启用（可选）
    @param tenant_id: 当前组织ID（依赖注入）
    @return: 已安装的应用列表
    """
    applications = await ApplicationService.get_installed_applications(
        tenant_id=tenant_id,
        is_active=is_active
    )

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
            app_data = {
                'uuid': app.get('uuid'),
                'tenant_id': app.get('tenant_id'),
                'name': app.get('name'),
                'code': app.get('code'),
                'description': app.get('description'),
                'icon': app.get('icon'),
                'version': app.get('version'),
                'route_path': app.get('route_path'),
                'entry_point': app.get('entry_point'),
                'menu_config': app.get('menu_config'),
                'permission_code': app.get('permission_code'),
                'is_system': app.get('is_system', False),
                'is_active': app.get('is_active', True),
                'is_installed': app.get('is_installed', False),
                'sort_order': app.get('sort_order', 0),
                'created_at': app.get('created_at'),
                'updated_at': app.get('updated_at'),
            }

            # 构造响应对象
            app_response = ApplicationResponse(**app_data)
            result.append(app_response)

        except Exception as e:
            # 记录错误但不中断整个响应
            print(f"处理应用 {app.get('code', 'unknown')} 时出错: {e}")
            continue

    return result


@router.get("/{uuid}", response_model=ApplicationResponse)
async def get_application(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
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
        return ApplicationResponse.model_validate(application)
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
        application = await ApplicationService.update_application(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return ApplicationResponse.model_validate(application)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
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
        await ApplicationService.delete_application(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{uuid}/enable", response_model=ApplicationResponse)
async def enable_application(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
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
        
        return ApplicationResponse.model_validate(application)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"启用应用失败: {str(e)}"
        )


@router.post("/{uuid}/disable", response_model=ApplicationResponse)
async def disable_application(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
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
        
        return ApplicationResponse.model_validate(application)
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
                app_data = {
                    'uuid': app.get('uuid'),
                    'tenant_id': app.get('tenant_id'),
                    'name': app.get('name'),
                    'code': app.get('code'),
                    'description': app.get('description'),
                    'icon': app.get('icon'),
                    'version': app.get('version'),
                    'route_path': app.get('route_path'),
                    'entry_point': app.get('entry_point'),
                    'menu_config': app.get('menu_config'),
                    'permission_code': app.get('permission_code'),
                    'is_system': app.get('is_system', False),
                    'is_active': app.get('is_active', True),
                    'is_installed': app.get('is_installed', False),
                    'sort_order': app.get('sort_order', 0),
                    'created_at': app.get('created_at'),
                    'updated_at': app.get('updated_at'),
                }

                # 构造响应对象
                app_response = ApplicationResponse(**app_data)
                result.append(app_response)

            except Exception as e:
                # 记录错误但不中断整个响应
                print(f"处理应用 {app.get('code', 'unknown')} 时出错: {e}")
                continue

        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"扫描插件失败: {str(e)}"
        )
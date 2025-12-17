"""
应用管理服务模块

提供应用的 CRUD 操作和安装/卸载功能。
使用直接的 asyncpg 连接，避免 Tortoise ORM 配置问题。
"""

import json
from pathlib import Path
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
import asyncpg

from core.schemas.application import ApplicationCreate, ApplicationUpdate
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.database.database import get_db_connection

# 由于使用直接 asyncpg 连接，类型注解使用 Dict[str, Any]
ApplicationDict = Dict[str, Any]


class ApplicationService:
    """
    应用管理服务类
    
    提供应用的 CRUD 操作和安装/卸载功能。
    """
    
    @staticmethod
    async def create_application(
        tenant_id: int,
        data: ApplicationCreate
    ) -> ApplicationDict:
        """
        创建应用
        
        Args:
            tenant_id: 组织ID
            data: 应用创建数据
            
        Returns:
            Application: 创建的应用对象
            
        Raises:
            ValidationError: 当应用代码已存在时抛出
        """
        conn = await get_db_connection()
        try:
            # 检查应用代码是否已存在
            existing = await conn.fetchval(
                "SELECT id FROM core_applications WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL",
                tenant_id, data.code
            )
            if existing:
                raise ValidationError(f"应用代码 {data.code} 已存在")

            # 插入新应用
            app_data = data.model_dump()
            app_data['tenant_id'] = tenant_id
            app_data['uuid'] = str(UUID())  # 生成UUID
            app_data['created_at'] = datetime.utcnow()
            app_data['updated_at'] = datetime.utcnow()

            columns = list(app_data.keys())
            placeholders = [f"${i+1}" for i in range(len(columns))]
            values = list(app_data.values())

            query = f"""
                INSERT INTO core_applications ({', '.join(columns)})
                VALUES ({', '.join(placeholders)})
                RETURNING *
            """

            row = await conn.fetchrow(query, *values)
            return dict(row)

        finally:
            await conn.close()
    
    @staticmethod
    async def get_application_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> ApplicationDict:
        """
        根据UUID获取应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            ApplicationDict: 应用字典对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
        """
        conn = await get_db_connection()
        try:
            query = """
                SELECT * FROM core_applications
                WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
                LIMIT 1
            """
            row = await conn.fetchrow(query, tenant_id, uuid)
            
            if not row:
                raise NotFoundError("应用不存在")
            
            app_dict = dict(row)
            # 处理 JSON 字段
            if 'menu_config' in app_dict and app_dict['menu_config']:
                try:
                    app_dict['menu_config'] = json.loads(app_dict['menu_config'])
                except:
                    app_dict['menu_config'] = None
            
            return app_dict
        finally:
            await conn.close()
    
    @staticmethod
    async def get_application_by_code(
        tenant_id: int,
        code: str
    ) -> Optional[ApplicationDict]:
        """
        根据代码获取应用
        
        Args:
            tenant_id: 组织ID
            code: 应用代码
            
        Returns:
            Application: 应用对象，如果不存在返回 None
        """
        return await Application.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True
        ).first()
    
    @staticmethod
    async def list_applications(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_installed: Optional[bool] = None,
        is_active: Optional[bool] = None
    ) -> List[Dict[str, Any]]:
        """
        获取应用列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            is_installed: 是否已安装（可选）
            is_active: 是否启用（可选）

        Returns:
            List[Dict[str, Any]]: 应用列表
        """
        conn = await get_db_connection()
        try:
            # 构建查询条件
            conditions = ["tenant_id = $1", "deleted_at IS NULL"]
            params = [tenant_id]
            param_index = 2

            if is_installed is not None:
                conditions.append(f"is_installed = ${param_index}")
                params.append(is_installed)
                param_index += 1

            if is_active is not None:
                conditions.append(f"is_active = ${param_index}")
                params.append(is_active)
                param_index += 1

            where_clause = " AND ".join(conditions)

            query = f"""
                SELECT * FROM core_applications
                WHERE {where_clause}
                ORDER BY sort_order, id
                OFFSET ${param_index} LIMIT ${param_index + 1}
            """
            params.extend([skip, limit])

            rows = await conn.fetch(query, *params)

            # 转换结果为字典列表
            applications = []
            for row in rows:
                app_dict = dict(row)
                # 处理 JSON 字段
                if 'menu_config' in app_dict and app_dict['menu_config']:
                    try:
                        app_dict['menu_config'] = json.loads(app_dict['menu_config'])
                    except:
                        app_dict['menu_config'] = None
                applications.append(app_dict)

            return applications

        finally:
            await conn.close()
    
    @staticmethod
    async def update_application(
        tenant_id: int,
        uuid: str,
        data: ApplicationUpdate
    ) -> ApplicationDict:
        """
        更新应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            data: 应用更新数据
            
        Returns:
            Application: 更新后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        
        # 记录旧的菜单配置和应用状态
        old_menu_config = application.menu_config
        old_is_active = application.is_active
        
        update_data = data.model_dump(exclude_unset=True)
        
        for key, value in update_data.items():
            setattr(application, key, value)
        
        await application.save()
        
        # 如果菜单配置变更或应用状态变更，自动同步菜单
        menu_config_changed = 'menu_config' in update_data and old_menu_config != application.menu_config
        is_active_changed = 'is_active' in update_data and old_is_active != application.is_active
        
        if menu_config_changed or is_active_changed:
            from core.services.menu_service import MenuService
            
            # 如果菜单配置变更，重新同步所有菜单（同步执行，确保菜单立即可用）
            if menu_config_changed and application.menu_config:
                await MenuService.sync_menus_from_application_config(
                    tenant_id=tenant_id,
                    application_uuid=str(application.uuid),
                    menu_config=application.menu_config,
                    is_active=application.is_active
                )
            elif is_active_changed:
                # 如果只是应用状态变更，只更新菜单的启用状态
                from core.models.menu import Menu
                await Menu.filter(
                    tenant_id=tenant_id,
                    application_uuid=str(application.uuid),
                    deleted_at__isnull=True
                ).update(is_active=application.is_active)
        
        return application
    
    @staticmethod
    async def delete_application(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除应用（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Raises:
            NotFoundError: 当应用不存在时抛出
            ValidationError: 当应用是系统应用时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        
        if application.is_system:
            raise ValidationError("系统应用不可删除")
        
        # 软删除
        from datetime import datetime
        application.deleted_at = datetime.now()
        await application.save()
    
    @staticmethod
    async def install_application(
        tenant_id: int,
        uuid: str
    ) -> ApplicationDict:
        """
        安装应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            ApplicationDict: 安装后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
            ValidationError: 当应用已安装时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        
        if application.get('is_installed'):
            raise ValidationError("应用已安装")
        
        # 更新数据库
        conn = await get_db_connection()
        try:
            update_query = """
                UPDATE core_applications
                SET is_installed = TRUE, updated_at = NOW()
                WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
            """
            await conn.execute(update_query, tenant_id, uuid)
        finally:
            await conn.close()
        
        # 更新本地字典
        application['is_installed'] = True
        
        # 自动同步应用菜单配置到菜单管理（同步执行，确保菜单立即可用）
        if application.get('menu_config'):
            from core.services.menu_service import MenuService
            await MenuService.sync_menus_from_application_config(
                tenant_id=tenant_id,
                application_uuid=str(application['uuid']),
                menu_config=application['menu_config'],
                is_active=application.get('is_active', True)
            )
        
        return application
    
    @staticmethod
    async def uninstall_application(
        tenant_id: int,
        uuid: str
    ) -> ApplicationDict:
        """
        卸载应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            Application: 卸载后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
            ValidationError: 当应用是系统应用时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        
        if application.is_system:
            raise ValidationError("系统应用不可卸载")
        
        application.is_installed = False
        await application.save()
        
        # 自动删除关联菜单（软删除）
        from core.models.menu import Menu
        from datetime import datetime
        await Menu.filter(
            tenant_id=tenant_id,
            application_uuid=str(uuid),
            deleted_at__isnull=True
        ).update(deleted_at=datetime.now())
        
        return application
    
    @staticmethod
    async def enable_application(
        tenant_id: int,
        uuid: str
    ) -> ApplicationDict:
        """
        启用应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            ApplicationDict: 启用后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        
        # 更新数据库
        conn = await get_db_connection()
        try:
            update_query = """
                UPDATE core_applications
                SET is_active = TRUE, updated_at = NOW()
                WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
            """
            await conn.execute(update_query, tenant_id, uuid)
        finally:
            await conn.close()
        
        # 更新本地字典
        application['is_active'] = True
        
        # 如果应用已安装且有菜单配置，确保菜单已同步并启用
        if application.get('is_installed') and application.get('menu_config'):
            from core.services.menu_service import MenuService
            # 重新同步菜单，确保菜单状态与应用状态一致
            await MenuService.sync_menus_from_application_config(
                tenant_id=tenant_id,
                application_uuid=str(uuid),
                menu_config=application['menu_config'],
                is_active=True
            )
        else:
            # 如果应用没有菜单配置，直接更新现有菜单状态
            conn = await get_db_connection()
            try:
                menu_update_query = """
                    UPDATE core_menus
                    SET is_active = TRUE, updated_at = NOW()
                    WHERE tenant_id = $1 AND application_uuid = $2 AND deleted_at IS NULL
                """
                await conn.execute(menu_update_query, tenant_id, str(uuid))
            finally:
                await conn.close()
        
        return application
    
    @staticmethod
    async def disable_application(
        tenant_id: int,
        uuid: str
    ) -> ApplicationDict:
        """
        禁用应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            ApplicationDict: 禁用后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        
        # 更新数据库
        conn = await get_db_connection()
        try:
            update_query = """
                UPDATE core_applications
                SET is_active = FALSE, updated_at = NOW()
                WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
            """
            await conn.execute(update_query, tenant_id, uuid)
        finally:
            await conn.close()
        
        # 更新本地字典
        application['is_active'] = False
        
        # 自动更新关联菜单的状态
        conn = await get_db_connection()
        try:
            menu_update_query = """
                UPDATE core_menus
                SET is_active = FALSE, updated_at = NOW()
                WHERE tenant_id = $1 AND application_uuid = $2 AND deleted_at IS NULL
            """
            await conn.execute(menu_update_query, tenant_id, str(uuid))
        finally:
            await conn.close()
        
        return application
    
    @staticmethod
    async def get_installed_applications(
        tenant_id: int,
        is_active: Optional[bool] = None
    ) -> List[ApplicationDict]:
        """
        获取已安装的应用列表
        
        Args:
            tenant_id: 组织ID
            is_active: 是否启用（可选）
            
        Returns:
            List[ApplicationDict]: 已安装的应用列表
        """
        # 使用直接数据库查询，避免 Tortoise ORM 配置问题
        conn = await get_db_connection()
        try:
            # 构建 SQL 查询
            sql = """
                SELECT * FROM core_applications
                WHERE tenant_id = $1 
                  AND is_installed = TRUE 
                  AND deleted_at IS NULL
            """
            params = [tenant_id]
            
            # 如果指定了 is_active，添加过滤条件
            if is_active is not None:
                sql += " AND is_active = $2"
                params.append(is_active)
            
            # 添加排序
            sql += " ORDER BY sort_order, id"
            
            # 执行查询
            rows = await conn.fetch(sql, *params)
            
            # 转换为字典列表
            result = []
            for row in rows:
                result.append(dict(row))
            
            return result
        finally:
            await conn.close()
    
    @staticmethod
    def _get_plugins_directory() -> Path:
        """
        获取插件目录路径
        
        Returns:
            Path: 插件目录路径（src/apps）
        """
        # 插件现在放在 src/apps/ 目录下
        current_file = Path(__file__).resolve()  # 使用绝对路径
        # riveredge-backend/src/core/services/application_service.py
        # -> riveredge-backend/src/core/services/
        # -> riveredge-backend/src/core/
        # -> riveredge-backend/src/
        # -> riveredge-backend/src/apps
        backend_src_dir = current_file.parent.parent.parent  # riveredge-backend/src
        plugins_dir = backend_src_dir / "apps"
        return plugins_dir
    
    @staticmethod
    def _scan_plugin_manifests() -> List[Dict[str, Any]]:
        """
        扫描插件目录，读取所有插件的 manifest.json 文件
        
        Returns:
            List[Dict[str, Any]]: 插件清单列表，每个元素包含 manifest.json 的内容和插件目录路径
        """
        plugins_dir = ApplicationService._get_plugins_directory()
        plugins = []
        
        if not plugins_dir.exists():
            return plugins
        
        # 遍历 src/apps 目录下的所有子目录
        for plugin_dir in plugins_dir.iterdir():
            if not plugin_dir.is_dir():
                continue
            
            # 查找 manifest.json 文件
            manifest_file = plugin_dir / "manifest.json"
            if not manifest_file.exists():
                continue
            
            try:
                # 读取 manifest.json
                with open(manifest_file, 'r', encoding='utf-8') as f:
                    manifest_data = json.load(f)
                
                # 添加插件目录路径信息
                manifest_data['_plugin_dir'] = str(plugin_dir)
                plugins.append(manifest_data)
            except (json.JSONDecodeError, IOError) as e:
                # 忽略无法读取的 manifest.json
                print(f"警告: 无法读取插件 {plugin_dir.name} 的 manifest.json: {e}")
                continue
        
        return plugins
    
    @staticmethod
    async def scan_and_register_plugins(tenant_id: int) -> List[ApplicationDict]:
        """
        扫描插件目录并自动注册插件应用

        从 src/apps 目录扫描所有插件的 manifest.json 文件，
        自动在数据库中创建或更新应用记录。

        Args:
            tenant_id: 组织ID

        Returns:
            List[Application]: 已注册的应用列表
        """
        plugins = ApplicationService._scan_plugin_manifests()
        print(f"扫描到 {len(plugins)} 个插件清单")
        print(f"插件清单内容: {plugins}")
        registered_apps = []

        for manifest in plugins:
            print(f"处理插件: {manifest.get('name', 'unknown')} (code: {manifest.get('code', 'unknown')})")
            try:
                # 从 manifest.json 提取应用信息
                code = manifest.get('code')
                if not code:
                    print(f"警告: 插件 {manifest.get('name', 'unknown')} 缺少 code 字段，跳过注册")
                    continue
                
                # 检查应用是否已存在
                existing_app = await ApplicationService.get_application_by_code(
                    tenant_id=tenant_id,
                    code=code
                )
                
                # 构建应用数据
                # 如果应用已存在，保持现有的 is_active 状态；否则默认启用
                is_active = existing_app.is_active if existing_app else True
                
                # 系统内置应用（如 master-data）应该自动安装
                # 这些应用在 src/apps 目录下，是系统的一部分
                builtin_apps = ['master-data', 'kuaimes']  # 系统内置应用列表
                should_auto_install = code in builtin_apps
                
                app_data = ApplicationCreate(
                    name=manifest.get('name', code),
                    code=code,
                    description=manifest.get('description'),
                    icon=manifest.get('icon'),
                    version=manifest.get('version', '1.0.0'),
                    route_path=manifest.get('route_path'),
                    entry_point=manifest.get('entry_point'),
                    menu_config=manifest.get('menu_config'),
                    permission_code=manifest.get('permission_code') or f"app:{code}",
                    is_system=False,  # 插件应用不是系统应用
                    is_active=is_active,  # 保持现有状态或默认启用
                    sort_order=manifest.get('sort_order', 0),
                )
                
                if existing_app:
                    # 更新现有应用（保留 is_active 和 is_installed 状态）
                    # 但是，如果是系统内置应用且未安装，自动安装
                    if should_auto_install and not existing_app.is_installed:
                        existing_app.is_installed = True
                        await existing_app.save()
                    
                    # 检查菜单配置是否变更
                    menu_config_changed = existing_app.menu_config != app_data.menu_config
                    
                    update_data = ApplicationUpdate(
                        name=app_data.name,
                        description=app_data.description,
                        icon=app_data.icon,
                        version=app_data.version,
                        route_path=app_data.route_path,
                        entry_point=app_data.entry_point,
                        menu_config=app_data.menu_config,
                        permission_code=app_data.permission_code,
                        sort_order=app_data.sort_order,
                    )
                    application = await ApplicationService.update_application(
                        tenant_id=tenant_id,
                        uuid=str(existing_app.uuid),
                        data=update_data
                    )
                    
                    # 如果应用已安装且有菜单配置，确保菜单已同步
                    # 注意：即使菜单配置没有变化，也要同步，因为可能之前同步失败或菜单被删除
                    if application.menu_config and application.is_installed:
                        from core.services.menu_service import MenuService
                        await MenuService.sync_menus_from_application_config(
                            tenant_id=tenant_id,
                            application_uuid=str(application.uuid),
                            menu_config=application.menu_config,
                            is_active=application.is_active
                        )
                else:
                    # 创建新应用
                    application = await ApplicationService.create_application(
                        tenant_id=tenant_id,
                        data=app_data
                    )
                    
                    # 如果是系统内置应用，自动安装
                    if should_auto_install:
                        application.is_installed = True
                        await application.save()
                        
                        # 自动同步菜单配置
                        if application.menu_config:
                            from core.services.menu_service import MenuService
                            await MenuService.sync_menus_from_application_config(
                                tenant_id=tenant_id,
                                application_uuid=str(application.uuid),
                                menu_config=application.menu_config,
                                is_active=application.is_active
                            )
                
                registered_apps.append(application)
                
            except Exception as e:
                print(f"错误: 注册插件 {manifest.get('name', 'unknown')} 失败: {e}")
                import traceback
                traceback.print_exc()
                # 暂时不跳过，继续处理下一个插件
                print(f"继续处理下一个插件...")
                continue
        
        # 所有应用注册完成后，统一清除菜单缓存，确保菜单一次性刷新
        if registered_apps:
            try:
                from core.services.menu_service import MenuService
                await MenuService._clear_menu_cache(tenant_id)
            except Exception as e:
                print(f"⚠️ 清除菜单缓存失败（不影响应用注册）: {e}")
        
        return registered_apps


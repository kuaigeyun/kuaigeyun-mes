"""
应用管理服务模块

提供应用的 CRUD 操作和安装/卸载功能。
使用直接的 asyncpg 连接，避免 Tortoise ORM 配置问题。
"""

import json
from pathlib import Path
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime
import asyncpg

from core.schemas.application import ApplicationCreate, ApplicationUpdate
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.database.database import get_db_connection
from loguru import logger

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
            app_data['uuid'] = str(uuid4())  # 生成UUID
            app_data['created_at'] = datetime.utcnow()
            app_data['updated_at'] = datetime.utcnow()
            
            # 将 menu_config 字典转换为 JSON 字符串
            if 'menu_config' in app_data and app_data['menu_config'] is not None:
                if isinstance(app_data['menu_config'], dict):
                    app_data['menu_config'] = json.dumps(app_data['menu_config'], ensure_ascii=False)

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
            ApplicationDict: 应用字典对象，如果不存在返回 None
        """
        conn = await get_db_connection()
        try:
            query = """
                SELECT * FROM core_applications
                WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL
                LIMIT 1
            """
            row = await conn.fetchrow(query, tenant_id, code)
            
            if not row:
                return None
            
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
        conn = await get_db_connection()
        try:
            # 获取当前应用信息
            application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)

            # 记录旧的菜单配置和应用状态
            old_menu_config = application.get('menu_config')
            old_is_active = application.get('is_active', False)

            update_data = data.model_dump(exclude_unset=True)

            # 构建更新查询
            if update_data:
                set_clauses = []
                params = [tenant_id, uuid]
                param_index = 3

                for key, value in update_data.items():
                    if key == 'menu_config' and value is not None:
                        # 特殊处理menu_config字段，将JSON对象转换为jsonb
                        if isinstance(value, dict):
                            set_clauses.append(f"{key} = ${param_index}::jsonb")
                            params.append(json.dumps(value, ensure_ascii=False))
                        else:
                            set_clauses.append(f"{key} = ${param_index}")
                            params.append(value)
                    else:
                        set_clauses.append(f"{key} = ${param_index}")
                        params.append(value)
                    param_index += 1

                query = f"""
                    UPDATE core_applications
                    SET {', '.join(set_clauses)}, updated_at = NOW()
                    WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
                """

                result = await conn.execute(query, *params)

                if result != "UPDATE 1":
                    raise NotFoundError(f"应用 {uuid} 更新失败")

            # 如果名称变更、菜单配置变更或应用状态变更，自动同步菜单
            name_changed = 'name' in update_data
            menu_config_changed = 'menu_config' in update_data
            is_active_changed = 'is_active' in update_data

            if name_changed or menu_config_changed or is_active_changed:
                from core.services.system.menu_service import MenuService
                from core.models.menu import Menu

                # 重新获取更新后的应用信息
                updated_app = await ApplicationService.get_application_by_uuid(tenant_id, uuid)

                # 如果名称变更且未提供新的菜单配置，尝试更新根菜单名称
                if name_changed and not menu_config_changed:
                    # 查找该应用的根菜单（parent_id 为空）
                    root_menu = await Menu.filter(
                        tenant_id=tenant_id,
                        application_uuid=uuid,
                        parent_id__isnull=True,
                        deleted_at__isnull=True
                    ).first()
                    
                    if root_menu:
                        root_menu.name = updated_app['name']
                        await root_menu.save()
                        # 清除缓存
                        await MenuService._clear_menu_cache(tenant_id)

                # 如果菜单配置变更，重新同步所有菜单
                if menu_config_changed and updated_app.get('menu_config'):
                    # 同步菜单时，如果应用有自定义名称，同步逻辑应该优先考虑它吗？
                    # 这里的 sync_menus_from_application_config 内部目前使用的是 menu_config 里的 title
                    await MenuService.sync_menus_from_application_config(
                        tenant_id=tenant_id,
                        application_uuid=uuid,
                        menu_config=updated_app['menu_config'],
                        is_active=updated_app.get('is_active', True)
                    )
                elif is_active_changed:
                    # 如果只是应用状态变更，只更新菜单的启用状态
                    await Menu.filter(
                        tenant_id=tenant_id,
                        application_uuid=uuid,
                        deleted_at__isnull=True
                    ).update(is_active=updated_app.get('is_active', True))

            # 返回更新后的应用信息
            return await ApplicationService.get_application_by_uuid(tenant_id, uuid)

        finally:
            await conn.close()
    
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
            from core.services.system.menu_service import MenuService
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
            from core.services.system.menu_service import MenuService
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

        注意：会自动过滤掉快速上线模式中停用的应用。

        Args:
            tenant_id: 组织ID
            is_active: 是否启用（可选）

        Returns:
            List[ApplicationDict]: 已安装的应用列表
        """
        # ⚠️ 关键修复：先创建数据库连接
        conn = await get_db_connection()
        try:
            # 动态获取停用应用列表：查询数据库中 is_active=False 的应用
            disabled_apps_result = await conn.fetch("""
                SELECT code FROM core_applications
                WHERE tenant_id = $1
                  AND is_installed = TRUE
                  AND is_active = FALSE
                  AND deleted_at IS NULL
            """, tenant_id)

            disabled_apps = {row['code'] for row in disabled_apps_result}

            # 构建基础 SQL 查询
            # ⚠️ 关键修复：处理 disabled_apps 为空的情况
            if disabled_apps:
                base_sql = """
                    SELECT * FROM core_applications
                    WHERE tenant_id = $1
                      AND is_installed = TRUE
                      AND deleted_at IS NULL
                      AND code NOT IN ({})
                """.format(','.join(['${}'.format(i + 2) for i in range(len(disabled_apps))]))
                params = [tenant_id] + list(disabled_apps)
            else:
                base_sql = """
                    SELECT * FROM core_applications
                    WHERE tenant_id = $1
                      AND is_installed = TRUE
                      AND deleted_at IS NULL
                """
                params = [tenant_id]

            # 如果指定了 is_active，添加过滤条件
            if is_active is not None:
                base_sql = base_sql.rstrip() + f"\n                  AND is_active = ${len(params) + 1}"
                params.append(is_active)

            # 添加排序
            final_sql = base_sql + "\n                ORDER BY sort_order, id"

            # 执行查询
            rows = await conn.fetch(final_sql, *params)

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
        # riveredge-backend/src/core/services/application/application_service.py
        # -> riveredge-backend/src/core/services/application/
        # -> riveredge-backend/src/core/services/
        # -> riveredge-backend/src/core/
        # -> riveredge-backend/src/
        # -> riveredge-backend/src/apps
        backend_src_dir = current_file.parent.parent.parent.parent  # riveredge-backend/src
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
                logger.warning(f"警告: 无法读取插件 {plugin_dir.name} 的 manifest.json: {e}")
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
        logger.info(f"扫描到 {len(plugins)} 个插件清单")
        registered_apps = []

        for manifest in plugins:
            logger.debug(f"处理插件: {manifest.get('name', 'unknown')} (code: {manifest.get('code', 'unknown')})")
            try:
                # 从 manifest.json 提取应用信息
                code = manifest.get('code')
                if not code:
                    logger.warning(f"警告: 插件 {manifest.get('name', 'unknown')} 缺少 code 字段，跳过注册")
                    continue
                
                # 检查应用是否已存在
                existing_app = await ApplicationService.get_application_by_code(
                    tenant_id=tenant_id,
                    code=code
                )
                
                # 构建应用数据
                # 如果应用已存在，保持现有的 is_active 状态；否则默认启用
                is_active = existing_app.get('is_active', True) if existing_app else True
                is_installed = existing_app.get('is_installed', False) if existing_app else False
                
                # 系统内置应用应该自动安装
                # 通过扫描 apps 目录自动识别系统内置应用，不再硬编码
                # 如果应用在 src/apps 目录下存在 manifest.json，则认为是系统内置应用
                should_auto_install = True  # 所有扫描到的应用都视为系统内置应用，自动安装
                
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
                    if should_auto_install and not is_installed:
                        is_installed = True
                    
                    # 决定是否更新名称：如果用户自定义了名称，扫描不应覆盖它
                    app_name = existing_app.get('name')
                    if not existing_app.get('is_custom_name'):
                        app_name = app_data.name

                    # 决定是否更新排序：如果用户自定义了排序，扫描不应覆盖它
                    app_sort_order = existing_app.get('sort_order', 0)
                    if not existing_app.get('is_custom_sort'):
                        app_sort_order = app_data.sort_order

                    update_data = ApplicationUpdate(
                        name=app_name,
                        description=app_data.description,
                        icon=app_data.icon,
                        version=app_data.version,
                        route_path=app_data.route_path,
                        entry_point=app_data.entry_point,
                        menu_config=app_data.menu_config,
                        permission_code=app_data.permission_code,
                        sort_order=app_sort_order,
                    )
                    application = await ApplicationService.update_application(
                        tenant_id=tenant_id,
                        uuid=existing_app.get('uuid'),
                        data=update_data
                    )
                    
                    # 如果是系统内置应用且未安装，更新安装状态
                    if should_auto_install and not is_installed:
                        await ApplicationService.install_application(
                            tenant_id=tenant_id,
                            uuid=existing_app.get('uuid')
                        )
                        application['is_installed'] = True
                    
                    # 如果应用已安装且有菜单配置，确保菜单已同步
                    # 注意：即使菜单配置没有变化，也要同步，因为可能之前同步失败或菜单被删除
                    if application.get('menu_config') and application.get('is_installed'):
                        from core.services.system.menu_service import MenuService
                        await MenuService.sync_menus_from_application_config(
                            tenant_id=tenant_id,
                            application_uuid=application.get('uuid'),
                            menu_config=application.get('menu_config'),
                            is_active=application.get('is_active', True)
                        )
                else:
                    # 创建新应用
                    application = await ApplicationService.create_application(
                        tenant_id=tenant_id,
                        data=app_data
                    )
                    
                    # 如果是系统内置应用，自动安装
                    if should_auto_install:
                        await ApplicationService.install_application(
                            tenant_id=tenant_id,
                            uuid=application.get('uuid')
                        )
                        application['is_installed'] = True
                        
                        # 自动同步菜单配置
                        if application.get('menu_config'):
                            from core.services.system.menu_service import MenuService
                            await MenuService.sync_menus_from_application_config(
                                tenant_id=tenant_id,
                                application_uuid=application.get('uuid'),
                                menu_config=application.get('menu_config'),
                                is_active=application.get('is_active', True)
                            )
                
                registered_apps.append(application)
                
            except Exception as e:
                logger.error(f"错误: 注册插件 {manifest.get('name', 'unknown')} 失败: {e}")
                import traceback
                traceback.print_exc()
                # 暂时不跳过，继续处理下一个插件
                continue
        
        # 所有应用注册完成后，统一清除菜单缓存，确保菜单一次性刷新
        if registered_apps:
            try:
                from core.services.system.menu_service import MenuService
                await MenuService._clear_menu_cache(tenant_id)
            except Exception as e:
                logger.warning(f"⚠️ 清除菜单缓存失败（不影响应用注册）: {e}")
        
        # 转换为字典列表，与其他方法保持一致
        result = []
        for app in registered_apps:
            # app 已经是字典，直接使用
            if isinstance(app, dict):
                result.append(app)
            else:
                # 如果是对象，转换为字典
                result.append({
                    'id': app.id,
                    'uuid': str(app.uuid),
                    'tenant_id': app.tenant_id,
                    'name': app.name,
                    'code': app.code,
                    'description': app.description,
                    'icon': app.icon,
                    'version': app.version,
                    'route_path': app.route_path,
                    'entry_point': app.entry_point,
                    'menu_config': app.menu_config,
                    'permission_code': app.permission_code,
                'is_system': app.is_system,
                'is_active': app.is_active,
                'is_installed': app.is_installed,
                'sort_order': app.sort_order,
                'created_at': app.created_at,
                'updated_at': app.updated_at,
                'deleted_at': app.deleted_at,
            })

        return result


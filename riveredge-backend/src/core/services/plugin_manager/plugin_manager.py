"""
插件管理器

统一管理插件的发现、注册、启用/停用和动态加载。
"""

from pathlib import Path
from typing import Dict, List, Any, Optional
import asyncpg
import uuid
from datetime import datetime

from .plugin_discovery import PluginDiscoveryService
from .plugin_loader import PluginLoaderService
from infra.infrastructure.database.database import get_db_connection


class PluginManagerService:
    """
    插件管理器服务

    提供插件的完整生命周期管理，包括发现、注册、启用/停用、动态加载等功能。
    """

    def __init__(self, apps_dir: Path):
        """
        初始化插件管理器

        Args:
            apps_dir: 应用目录路径
        """
        self.apps_dir = apps_dir
        self.discovery_service = PluginDiscoveryService(apps_dir)
        self.loader_service = PluginLoaderService(apps_dir)

    async def discover_and_register_plugins(self, tenant_id: int) -> Dict[str, Any]:
        """
        发现并注册所有插件

        Args:
            tenant_id: 租户ID

        Returns:
            Dict[str, Any]: 操作结果
        """
        discovered_plugins = self.discovery_service.discover_plugins()

        registered_count = 0
        updated_count = 0
        errors = []

        conn = await get_db_connection()
        try:
            for plugin in discovered_plugins:
                try:
                    # 检查插件是否已注册
                    existing = await conn.fetchval(
                        """
                        SELECT id FROM core_applications
                        WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL
                        """,
                        tenant_id, plugin.code
                    )

                    if existing:
                        # 更新现有插件信息
                        await self._update_plugin_info(conn, existing, plugin)
                        updated_count += 1
                        print(f"🔄 更新插件: {plugin.code}")
                    else:
                        # 注册新插件
                        await self._register_plugin(conn, tenant_id, plugin)
                        registered_count += 1
                        print(f"📝 注册插件: {plugin.code}")

                except Exception as e:
                    error_msg = f"处理插件 {plugin.code} 失败: {str(e)}"
                    errors.append(error_msg)
                    print(f"❌ {error_msg}")

            return {
                'success': True,
                'registered': registered_count,
                'updated': updated_count,
                'errors': errors,
                'total_discovered': len(discovered_plugins)
            }

        finally:
            await conn.close()

    async def load_enabled_plugins(self, tenant_id: int) -> List[Dict[str, Any]]:
        """
        加载所有启用的插件

        Args:
            tenant_id: 租户ID

        Returns:
            List[Dict[str, Any]]: 加载的插件列表
        """
        # 获取启用的插件列表
        enabled_plugins = await self.get_enabled_plugins(tenant_id)

        # 加载插件
        return self.loader_service.load_enabled_plugins(enabled_plugins)

    async def enable_plugin(self, tenant_id: int, plugin_code: str) -> Dict[str, Any]:
        """
        启用插件

        Args:
            tenant_id: 租户ID
            plugin_code: 插件代码

        Returns:
            Dict[str, Any]: 操作结果
        """
        conn = await get_db_connection()
        try:
            result = await conn.fetchval(
                """
                UPDATE core_applications
                SET is_active = true, updated_at = $1
                WHERE tenant_id = $2 AND code = $3 AND deleted_at IS NULL
                RETURNING id
                """,
                datetime.utcnow(), tenant_id, plugin_code
            )

            if result:
                return {'success': True, 'message': f'插件 {plugin_code} 已启用'}
            else:
                return {'success': False, 'message': f'插件 {plugin_code} 不存在'}

        finally:
            await conn.close()

    async def disable_plugin(self, tenant_id: int, plugin_code: str) -> Dict[str, Any]:
        """
        停用插件

        Args:
            tenant_id: 租户ID
            plugin_code: 插件代码

        Returns:
            Dict[str, Any]: 操作结果
        """
        conn = await get_db_connection()
        try:
            result = await conn.fetchval(
                """
                UPDATE core_applications
                SET is_active = false, updated_at = $1
                WHERE tenant_id = $2 AND code = $3 AND deleted_at IS NULL
                RETURNING id
                """,
                datetime.utcnow(), tenant_id, plugin_code
            )

            if result:
                return {'success': True, 'message': f'插件 {plugin_code} 已停用'}
            else:
                return {'success': False, 'message': f'插件 {plugin_code} 不存在'}

        finally:
            await conn.close()

    async def get_enabled_plugins(self, tenant_id: int) -> List[str]:
        """
        获取启用的插件列表

        Args:
            tenant_id: 租户ID

        Returns:
            List[str]: 启用的插件代码列表
        """
        conn = await get_db_connection()
        try:
            rows = await conn.fetch(
                """
                SELECT code FROM core_applications
                WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL
                ORDER BY sort_order, created_at
                """,
                tenant_id
            )
            return [row['code'] for row in rows]

        finally:
            await conn.close()

    async def get_available_plugins(self, tenant_id: int) -> List[Dict[str, Any]]:
        """
        获取所有可用插件（包括注册状态）

        Args:
            tenant_id: 租户ID

        Returns:
            List[Dict[str, Any]]: 插件列表
        """
        # 获取发现的插件
        discovered_plugins = self.loader_service.get_available_plugins()

        # 获取数据库中的注册信息
        conn = await get_db_connection()
        try:
            registered_plugins = await conn.fetch(
                """
                SELECT code, name, version, is_active, is_installed, sort_order
                FROM core_applications
                WHERE tenant_id = $1 AND deleted_at IS NULL
                """,
                tenant_id
            )

            # 合并信息
            registered_dict = {p['code']: dict(p) for p in registered_plugins}

            for plugin in discovered_plugins:
                code = plugin['code']
                if code in registered_dict:
                    plugin.update({
                        'is_registered': True,
                        'is_active': registered_dict[code]['is_active'],
                        'is_installed': registered_dict[code]['is_installed'],
                        'sort_order': registered_dict[code]['sort_order']
                    })
                else:
                    plugin.update({
                        'is_registered': False,
                        'is_active': False,
                        'is_installed': False,
                        'sort_order': 0
                    })

            return discovered_plugins

        finally:
            await conn.close()

    async def _register_plugin(self, conn: asyncpg.Connection, tenant_id: int, plugin) -> None:
        """注册新插件到数据库"""
        manifest = plugin.manifest

        await conn.execute(
            """
            INSERT INTO core_applications (
                tenant_id, code, name, version, description, icon, author,
                entry_point, route_path, sort_order, menu_config, permissions,
                dependencies, uuid, is_active, is_installed, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            """,
            tenant_id,
            manifest.code,
            manifest.name,
            manifest.version,
            manifest.description,
            manifest.icon,
            manifest.author,
            manifest.entry_point,
            manifest.route_path,
            manifest.sort_order,
            manifest.menu_config,
            manifest.permissions,
            manifest.dependencies,
            str(uuid.uuid4()),  # 需要导入 uuid
            False,  # 默认不启用
            False,  # 默认未安装
            datetime.utcnow(),
            datetime.utcnow()
        )

    async def _update_plugin_info(self, conn: asyncpg.Connection, plugin_id: int, plugin) -> None:
        """更新插件信息"""
        manifest = plugin.manifest

        await conn.execute(
            """
            UPDATE core_applications
            SET name = $1, version = $2, description = $3, icon = $4, author = $5,
                entry_point = $6, route_path = $7, sort_order = $8, menu_config = $9,
                permissions = $10, dependencies = $11, updated_at = $12
            WHERE id = $13
            """,
            manifest.name,
            manifest.version,
            manifest.description,
            manifest.icon,
            manifest.author,
            manifest.entry_point,
            manifest.route_path,
            manifest.sort_order,
            manifest.menu_config,
            manifest.permissions,
            manifest.dependencies,
            datetime.utcnow(),
            plugin_id
        )

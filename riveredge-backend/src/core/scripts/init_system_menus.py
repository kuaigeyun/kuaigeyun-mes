"""
系统菜单初始化脚本

将 BasicLayout getMenuConfig 中的系统菜单结构导入 core_menus。
系统菜单 application_uuid 为空，与应用菜单区分。
name 存储 i18n key（如 menu.dashboard），前端翻译时使用 t(name)。

使用方式（在 riveredge-backend 目录）:
    uv run python -m core.scripts.init_system_menus
或指定租户:
    uv run python -m core.scripts.init_system_menus --tenant-id 1
"""

import asyncio
import argparse
import sys
from typing import Optional
from pathlib import Path

# 确保 src 在 path 中
src = Path(__file__).resolve().parent.parent.parent
if str(src) not in sys.path:
    sys.path.insert(0, str(src))

from tortoise import Tortoise
from loguru import logger

from infra.infrastructure.database.database import TORTOISE_ORM
from core.models.menu import Menu


# 系统菜单配置：与 BasicLayout getMenuConfig 对应，name 存 i18n key
# sort_order: 根菜单 0=仪表盘, 100=系统, 200=个人, 300=运营中心（留 10-99 给应用菜单）
SYSTEM_MENU_CONFIG = [
    # 【第一组】仪表盘
    {
        "name": "menu.dashboard",
        "path": "/system/dashboard",
        "icon": None,  # 前端 getMenuIcon 按 path 解析
        "sort_order": 0,
        "children": [
            {"name": "menu.dashboard.workplace", "path": "/system/dashboard/workplace", "sort_order": 0},
            {"name": "menu.dashboard.analysis", "path": "/system/dashboard/analysis", "sort_order": 1},
        ],
    },
    # 【第二组】系统配置（含多个分组）
    {
        "name": "menu.system",
        "path": "/system",
        "icon": None,
        "sort_order": 100,
        "children": [
            # 核心配置分组
            {
                "name": "menu.group.core-config",
                "path": None,
                "meta": {"type": "group", "className": "riveredge-menu-group-title"},
                "sort_order": 0,
                "children": [
                    {"name": "menu.system.applications", "path": "/system/applications", "sort_order": 0},
                    {"name": "menu.system.menus", "path": "/system/menus", "sort_order": 1},
                    {"name": "menu.system.site-settings", "path": "/system/site-settings", "sort_order": 2},
                    {"name": "menu.system.business-config", "path": "/system/business-config", "sort_order": 3},
                    {"name": "menu.system.data-dictionaries", "path": "/system/data-dictionaries", "sort_order": 4},
                    {"name": "menu.system.languages", "path": "/system/languages", "sort_order": 5},
                    {"name": "menu.system.code-rules", "path": "/system/code-rules", "sort_order": 6},
                    {"name": "menu.system.custom-fields", "path": "/system/custom-fields", "sort_order": 7},
                ],
            },
            # 用户管理分组
            {
                "name": "menu.group.user-management",
                "path": None,
                "meta": {"type": "group", "className": "riveredge-menu-group-title"},
                "sort_order": 1,
                "children": [
                    {"name": "menu.system.departments", "path": "/system/departments", "sort_order": 0},
                    {"name": "menu.system.positions", "path": "/system/positions", "sort_order": 1},
                    {"name": "menu.system.roles-permissions", "path": "/system/roles", "sort_order": 2},
                    {"name": "menu.system.users", "path": "/system/users", "sort_order": 3},
                ],
            },
            # 数据中心分组
            {
                "name": "menu.group.data-center",
                "path": None,
                "meta": {"type": "group", "className": "riveredge-menu-group-title"},
                "sort_order": 2,
                "children": [
                    {"name": "menu.system.files", "path": "/system/files", "sort_order": 0},
                    {"name": "menu.system.apis", "path": "/system/apis", "sort_order": 1},
                    {"name": "menu.system.data-sources", "path": "/system/data-sources", "sort_order": 2},
                    {"name": "menu.system.application-connections", "path": "/system/application-connections", "sort_order": 3},
                    {"name": "menu.system.datasets", "path": "/system/datasets", "sort_order": 4},
                ],
            },
            # 流程管理分组
            {
                "name": "menu.group.process-management",
                "path": None,
                "meta": {"type": "group", "className": "riveredge-menu-group-title"},
                "sort_order": 3,
                "children": [
                    {
                        "name": "menu.system.approval-processes",
                        "path": "/system/approval-processes",
                        "sort_order": 0,
                        "children": [
                            {
                                "name": "path.system.approval-processes.designer",
                                "path": "/system/approval-processes/designer",
                                "meta": {"hideInMenu": True},
                                "sort_order": 0,
                            },
                        ],
                    },
                    {"name": "menu.system.approval-instances", "path": "/system/approval-instances", "sort_order": 1},
                    {"name": "menu.system.messages.template", "path": "/system/messages/template", "sort_order": 2},
                    {"name": "menu.system.messages.config", "path": "/system/messages/config", "sort_order": 3},
                    {"name": "menu.system.scripts", "path": "/system/scripts", "sort_order": 4},
                    {"name": "menu.system.scheduled-tasks", "path": "/system/scheduled-tasks", "sort_order": 5},
                    {"name": "menu.system.print-devices", "path": "/system/print-devices", "sort_order": 6},
                    {
                        "name": "menu.system.print-templates",
                        "path": "/system/print-templates",
                        "sort_order": 7,
                        "children": [
                            {
                                "name": "path.system.print-templates.design",
                                "path": "/system/print-templates/design",
                                "meta": {"hideInMenu": True},
                                "sort_order": 0,
                            },
                        ],
                    },
                ],
            },
            # 监控运维分组
            {
                "name": "menu.group.monitoring-ops",
                "path": None,
                "meta": {"type": "group", "className": "riveredge-menu-group-title"},
                "sort_order": 4,
                "children": [
                    {"name": "menu.system.operation-logs", "path": "/system/operation-logs", "sort_order": 0},
                    {"name": "menu.system.login-logs", "path": "/system/login-logs", "sort_order": 1},
                    {"name": "menu.system.online-users", "path": "/system/online-users", "sort_order": 2},
                    {"name": "menu.system.data-backups", "path": "/system/data-backups", "sort_order": 3},
                ],
            },
        ],
    },
    # 【第三组】个人中心
    {
        "name": "menu.personal",
        "path": "/personal",
        "icon": None,
        "sort_order": 200,
        "children": [
            {"name": "menu.personal.profile", "path": "/personal/profile", "sort_order": 0},
            {"name": "menu.personal.preferences", "path": "/personal/preferences", "sort_order": 1},
            {"name": "menu.personal.messages", "path": "/personal/messages", "sort_order": 2},
            {"name": "menu.personal.tasks", "path": "/personal/tasks", "sort_order": 3},
        ],
    },
    # 【第四组】运营中心（仅平台级管理员）
    {
        "name": "menu.infra",
        "path": None,
        "icon": None,
        "sort_order": 300,
        "children": [
            {"name": "menu.infra.operation", "path": "/infra/operation", "sort_order": 0},
            {"name": "menu.infra.tenants", "path": "/infra/tenants", "sort_order": 1},
            {"name": "menu.infra.packages", "path": "/infra/packages", "sort_order": 2},
            {"name": "menu.infra.monitoring", "path": "/infra/monitoring", "sort_order": 3},
            {"name": "menu.infra.inngest", "path": "/infra/inngest", "sort_order": 4},
            {"name": "menu.infra.admin", "path": "/infra/admin", "sort_order": 5},
        ],
    },
]


async def _create_menu_recursive(
    tenant_id: int,
    item: dict,
    parent_id: Optional[int] = None,
) -> int:
    """递归创建菜单，返回创建数量"""
    created = 0
    name = item.get("name", "")
    path = item.get("path")
    icon = item.get("icon")
    meta = item.get("meta")
    sort_order = item.get("sort_order", 0)
    children = item.get("children", [])

    # 检查是否已存在（系统菜单 application_uuid 为空，通过 path 或 name+parent 判断）
    existing = None
    if path:
        existing = await Menu.filter(
            tenant_id=tenant_id,
            application_uuid__isnull=True,
            path=path,
            parent_id=parent_id,
            deleted_at__isnull=True,
        ).first()
    else:
        existing = await Menu.filter(
            tenant_id=tenant_id,
            application_uuid__isnull=True,
            name=name,
            parent_id=parent_id,
            deleted_at__isnull=True,
        ).first()

    if existing:
        menu_obj = existing
        # 更新 meta 等可能变化的字段
        if meta is not None:
            menu_obj.meta = meta
            await menu_obj.save()
    else:
        menu_obj = await Menu.create(
            tenant_id=tenant_id,
            name=name,
            path=path,
            icon=icon,
            application_uuid=None,
            parent_id=parent_id,
            sort_order=sort_order,
            is_active=True,
            meta=meta,
        )
        created += 1

    for child in children:
        created += await _create_menu_recursive(
            tenant_id=tenant_id,
            item=child,
            parent_id=menu_obj.id,
        )
    return created


async def seed_system_menus(tenant_id: int) -> int:
    """为指定租户初始化系统菜单。返回创建的菜单数量。"""
    total = 0
    for item in SYSTEM_MENU_CONFIG:
        total += await _create_menu_recursive(tenant_id=tenant_id, item=item, parent_id=None)
    return total


async def run_init(tenant_ids: list[int] | None = None) -> int:
    """执行初始化。若 tenant_ids 为空，则对所有租户执行。"""
    await Tortoise.init(config=TORTOISE_ORM)
    try:
        from infra.models.tenant import Tenant
        if tenant_ids:
            tenants = await Tenant.filter(id__in=tenant_ids).all()
        else:
            tenants = await Tenant.all()
        if not tenants:
            logger.warning("未找到任何租户")
            return 0
        total_created = 0
        for t in tenants:
            n = await seed_system_menus(t.id)
            total_created += n
            logger.info(f"租户 {t.id} 系统菜单初始化完成，新增 {n} 条")
        return total_created
    finally:
        await Tortoise.close_connections()


def main():
    parser = argparse.ArgumentParser(description="系统菜单初始化：将 getMenuConfig 结构导入 core_menus")
    parser.add_argument("--tenant-id", type=int, action="append", help="指定租户 ID，可多次传入；不传则对所有租户执行")
    args = parser.parse_args()
    tenant_ids = args.tenant_id
    total = asyncio.run(run_init(tenant_ids))
    print(f"系统菜单初始化完成，共新增 {total} 条菜单")


if __name__ == "__main__":
    main()

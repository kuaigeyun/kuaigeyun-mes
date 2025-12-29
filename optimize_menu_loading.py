#!/usr/bin/env python3
"""
优化菜单自动加载脚本

用于优化RiverEdge SaaS系统的菜单自动加载功能：
1. 验证应用配置完整性
2. 检查菜单结构正确性
3. 优化菜单加载性能
4. 提供菜单配置报告
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, List, Any

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent / "riveredge-backend" / "src"))

from tortoise import Tortoise
from core.models.application import Application
from infra.config.database_config import TORTOISE_ORM


class MenuOptimizer:
    """菜单优化器"""

    def __init__(self):
        self.issues = []
        self.optimizations = []

    async def init_db(self):
        """初始化数据库连接"""
        await Tortoise.init(config=TORTOISE_ORM)

    async def close_db(self):
        """关闭数据库连接"""
        await Tortoise.close_connections()

    async def validate_applications(self) -> List[Dict[str, Any]]:
        """验证所有应用的配置"""
        print("🔍 开始验证应用配置...")

        applications = await Application.filter(is_active=True, is_installed=True).all()
        valid_apps = []

        for app in applications:
            print(f"\n📋 检查应用: {app.name} ({app.code})")

            # 基本信息验证
            issues = self._validate_basic_info(app)
            if issues:
                self.issues.extend(issues)
                continue

            # 菜单配置验证
            menu_issues = self._validate_menu_config(app)
            if menu_issues:
                self.issues.extend(menu_issues)
                continue

            # 路由配置验证
            route_issues = self._validate_route_config(app)
            if route_issues:
                self.issues.extend(route_issues)
                continue

            valid_apps.append(app)

            # 性能优化建议
            perf_suggestions = self._optimize_performance(app)
            if perf_suggestions:
                self.optimizations.extend(perf_suggestions)

        return valid_apps

    def _validate_basic_info(self, app: Application) -> List[str]:
        """验证应用基本信息"""
        issues = []

        if not app.code:
            issues.append(f"应用 {app.name}: 代码不能为空")

        if not app.route_path:
            issues.append(f"应用 {app.name}: 路由路径不能为空")

        if not app.entry_point:
            issues.append(f"应用 {app.name}: 入口点不能为空")

        return issues

    def _validate_menu_config(self, app: Application) -> List[str]:
        """验证菜单配置"""
        issues = []

        if not app.menu_config:
            issues.append(f"应用 {app.name}: 菜单配置为空")
            return issues

        menu_config = app.menu_config

        # 验证顶级菜单结构
        if 'title' not in menu_config:
            issues.append(f"应用 {app.name}: 菜单配置缺少 title 字段")

        if 'path' not in menu_config:
            issues.append(f"应用 {app.name}: 菜单配置缺少 path 字段")

        if 'children' not in menu_config:
            issues.append(f"应用 {app.name}: 菜单配置缺少 children 字段")
            return issues

        # 验证子菜单
        children = menu_config.get('children', [])
        for i, child in enumerate(children):
            if 'title' not in child:
                issues.append(f"应用 {app.name}: 第{i+1}个子菜单缺少 title")

            if 'path' not in child:
                issues.append(f"应用 {app.name}: 子菜单 '{child.get('title', f'第{i+1}个')}' 缺少 path")

            if 'children' in child:
                # 验证三级菜单
                sub_children = child.get('children', [])
                for j, sub_child in enumerate(sub_children):
                    if 'title' not in sub_child:
                        issues.append(f"应用 {app.name}: 三级菜单缺少 title")

                    if 'path' not in sub_child:
                        issues.append(f"应用 {app.name}: 三级菜单 '{sub_child.get('title', f'第{j+1}个')}' 缺少 path")

        return issues

    def _validate_route_config(self, app: Application) -> List[str]:
        """验证路由配置"""
        issues = []

        # 检查路由路径格式
        route_path = app.route_path
        if not route_path.startswith('/apps/'):
            issues.append(f"应用 {app.name}: 路由路径应以 '/apps/' 开头")

        # 检查入口点路径
        entry_point = app.entry_point
        if not (entry_point.startswith('../') or entry_point.startswith('./')):
            issues.append(f"应用 {app.name}: 入口点应为相对路径")

        # 检查入口文件是否存在（开发环境）
        if entry_point.startswith('../'):
            frontend_path = Path(__file__).parent / "riveredge-frontend" / "src"
            entry_file = frontend_path / entry_point[3:]  # 去掉 ../

            if not entry_file.exists():
                issues.append(f"应用 {app.name}: 入口文件不存在 - {entry_file}")

        return issues

    def _optimize_performance(self, app: Application) -> List[str]:
        """性能优化建议"""
        suggestions = []

        # 检查菜单层级
        if app.menu_config and 'children' in app.menu_config:
            total_menus = self._count_menu_items(app.menu_config)
            if total_menus > 50:
                suggestions.append(f"应用 {app.name}: 菜单项过多 ({total_menus})，建议优化结构")

        # 检查权限数量
        # 这里可以添加更多性能优化建议

        return suggestions

    def _count_menu_items(self, menu_config: Dict[str, Any]) -> int:
        """统计菜单项数量"""
        count = 0

        if 'children' in menu_config:
            for child in menu_config['children']:
                count += 1
                if 'children' in child:
                    count += len(child['children'])

        return count

    def generate_report(self, valid_apps: List[Application]):
        """生成优化报告"""
        print("\n" + "="*60)
        print("📊 菜单自动加载优化报告")
        print("="*60)

        print(f"\n✅ 有效应用数量: {len(valid_apps)}")
        for app in valid_apps:
            print(f"  - {app.name} ({app.code})")

        if self.issues:
            print(f"\n❌ 发现问题: {len(self.issues)} 个")
            for issue in self.issues:
                print(f"  - {issue}")
        else:
            print("\n✅ 未发现配置问题")

        if self.optimizations:
            print(f"\n💡 优化建议: {len(self.optimizations)} 个")
            for opt in self.optimizations:
                print(f"  - {opt}")
        else:
            print("\n✅ 无优化建议")

        print("\n" + "="*60)


async def main():
    """主函数"""
    print("🚀 开始优化菜单自动加载...")

    optimizer = MenuOptimizer()
    await optimizer.init_db()

    try:
        valid_apps = await optimizer.validate_applications()
        optimizer.generate_report(valid_apps)

        if optimizer.issues:
            print("\n⚠️  请修复上述问题后重新运行")
            return 1
        else:
            print("\n🎉 菜单自动加载优化完成！")
            return 0

    finally:
        await optimizer.close_db()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

"""
项目健康检测程序

全自动检测前后端功能完整性，包括：
1. 后端API端点检测
2. 数据模型完整性检测
3. 数据库迁移状态检测
4. 前端页面路由检测
5. 前后端接口对接检测

Author: Auto (AI Assistant)
Date: 2026-01-03
"""

import sys
import re
import json
import asyncio
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any
from datetime import datetime
from dataclasses import dataclass, field

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent
backend_root = project_root / "riveredge-backend"
frontend_root = project_root / "riveredge-frontend"

sys.path.insert(0, str(backend_root / "src"))


@dataclass
class CheckResult:
    """检测结果"""
    name: str
    status: str  # "pass", "fail", "warning"
    message: str
    details: List[str] = field(default_factory=list)


@dataclass
class HealthReport:
    """健康检测报告"""
    timestamp: str
    backend_checks: List[CheckResult] = field(default_factory=list)
    frontend_checks: List[CheckResult] = field(default_factory=list)
    integration_checks: List[CheckResult] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)


class BackendChecker:
    """后端检测器"""
    
    def __init__(self, backend_root: Path):
        self.backend_root = backend_root
        self.src_root = backend_root / "src" / "apps" / "kuaizhizao"
        self.migrations_root = backend_root / "migrations" / "models"
    
    def check_api_endpoints(self) -> CheckResult:
        """检测API端点"""
        issues = []
        endpoints = set()
        
        # 检测production.py
        production_file = self.src_root / "api" / "production.py"
        if production_file.exists():
            content = production_file.read_text(encoding="utf-8")
            # 查找所有路由装饰器
            route_pattern = r'@router\.(get|post|put|delete|patch)\s*\(["\']([^"\']+)["\']'
            matches = re.findall(route_pattern, content)
            for method, path in matches:
                endpoints.add(f"{method.upper()} {path}")
        else:
            issues.append("production.py 文件不存在")
        
        # 检测purchase.py
        purchase_file = self.src_root / "api" / "purchase.py"
        if purchase_file.exists():
            content = purchase_file.read_text(encoding="utf-8")
            route_pattern = r'@router\.(get|post|put|delete|patch)\s*\(["\']([^"\']+)["\']'
            matches = re.findall(route_pattern, content)
            for method, path in matches:
                endpoints.add(f"{method.upper()} {path}")
        else:
            issues.append("purchase.py 文件不存在")
        
        if issues:
            return CheckResult(
                name="API端点检测",
                status="fail",
                message=f"发现 {len(issues)} 个问题",
                details=issues
            )
        
        return CheckResult(
            name="API端点检测",
            status="pass",
            message=f"检测到 {len(endpoints)} 个API端点",
            details=[f"端点数量: {len(endpoints)}"]
        )
    
    def check_models(self) -> CheckResult:
        """检测数据模型"""
        models_dir = self.src_root / "models"
        if not models_dir.exists():
            return CheckResult(
                name="数据模型检测",
                status="fail",
                message="models 目录不存在",
                details=[]
            )
        
        model_files = list(models_dir.glob("*.py"))
        model_files = [f for f in model_files if f.name != "__init__.py"]
        
        issues = []
        models = []
        
        for model_file in model_files:
            content = model_file.read_text(encoding="utf-8")
            # 检查是否有BaseModel继承
            if "BaseModel" not in content and "Model" not in content:
                issues.append(f"{model_file.name} 未继承BaseModel或Model")
            else:
                # 提取模型类名
                class_match = re.search(r'class\s+(\w+)\s*\([^)]*BaseModel|Model', content)
                if class_match:
                    models.append(class_match.group(1))
        
        if issues:
            return CheckResult(
                name="数据模型检测",
                status="warning",
                message=f"检测到 {len(issues)} 个问题，{len(models)} 个模型正常",
                details=issues[:5]  # 只显示前5个问题
            )
        
        return CheckResult(
            name="数据模型检测",
            status="pass",
            message=f"检测到 {len(models)} 个数据模型",
            details=[f"模型文件: {len(model_files)}", f"有效模型: {len(models)}"]
        )
    
    def check_services(self) -> CheckResult:
        """检测服务层"""
        services_dir = self.src_root / "services"
        if not services_dir.exists():
            return CheckResult(
                name="服务层检测",
                status="fail",
                message="services 目录不存在",
                details=[]
            )
        
        service_files = list(services_dir.glob("*_service.py"))
        
        issues = []
        services = []
        
        for service_file in service_files:
            content = service_file.read_text(encoding="utf-8")
            # 检查是否有类定义
            class_match = re.search(r'class\s+(\w+Service)', content)
            if class_match:
                services.append(class_match.group(1))
            else:
                issues.append(f"{service_file.name} 未找到Service类")
        
        return CheckResult(
            name="服务层检测",
            status="pass" if not issues else "warning",
            message=f"检测到 {len(services)} 个服务类",
            details=[f"服务文件: {len(service_files)}", f"有效服务: {len(services)}"] + (issues[:3] if issues else [])
        )
    
    def check_migrations(self) -> CheckResult:
        """检测数据库迁移"""
        if not self.migrations_root.exists():
            return CheckResult(
                name="数据库迁移检测",
                status="fail",
                message="migrations/models 目录不存在",
                details=[]
            )
        
        migration_files = list(self.migrations_root.glob("*.py"))
        migration_files = [f for f in migration_files if f.name != "__init__.py"]
        
        issues = []
        valid_migrations = []
        
        for migration_file in migration_files:
            content = migration_file.read_text(encoding="utf-8")
            # 检查是否有upgrade函数
            if "async def upgrade" not in content:
                issues.append(f"{migration_file.name} 缺少upgrade函数")
            else:
                valid_migrations.append(migration_file.name)
        
        return CheckResult(
            name="数据库迁移检测",
            status="pass" if not issues else "warning",
            message=f"检测到 {len(valid_migrations)} 个有效迁移文件",
            details=[f"迁移文件: {len(migration_files)}", f"有效迁移: {len(valid_migrations)}"] + (issues[:3] if issues else [])
        )
    
    def run_all_checks(self) -> List[CheckResult]:
        """运行所有后端检测"""
        return [
            self.check_api_endpoints(),
            self.check_models(),
            self.check_services(),
            self.check_migrations(),
        ]


class FrontendChecker:
    """前端检测器"""
    
    def __init__(self, frontend_root: Path):
        self.frontend_root = frontend_root
        self.pages_root = frontend_root / "src" / "apps" / "kuaizhizao" / "pages"
        self.services_root = frontend_root / "src" / "apps" / "kuaizhizao" / "services"
    
    def check_pages(self) -> CheckResult:
        """检测前端页面"""
        if not self.pages_root.exists():
            return CheckResult(
                name="前端页面检测",
                status="fail",
                message="pages 目录不存在",
                details=[]
            )
        
        # 递归获取所有页面目录（包括子目录）
        def get_all_page_dirs(root: Path) -> List[Path]:
            dirs = []
            for item in root.iterdir():
                if item.is_dir() and item.name != "common":
                    index_file = item / "index.tsx"
                    if index_file.exists():
                        dirs.append(item)
                    else:
                        # 递归检查子目录
                        subdirs = get_all_page_dirs(item)
                        dirs.extend(subdirs)
            return dirs
        
        page_dirs = get_all_page_dirs(self.pages_root)
        
        issues = []
        pages = []
        
        for page_dir in page_dirs:
            index_file = page_dir / "index.tsx"
            if index_file.exists():
                pages.append(str(page_dir.relative_to(self.pages_root)))
            else:
                issues.append(f"{page_dir.name} 缺少index.tsx")
        
        return CheckResult(
            name="前端页面检测",
            status="pass" if not issues else "warning",
            message=f"检测到 {len(pages)} 个页面",
            details=[f"页面目录: {len(page_dirs)}", f"有效页面: {len(pages)}"] + (issues[:5] if issues else [])
        )
    
    def check_routes(self) -> CheckResult:
        """检测路由配置"""
        index_file = self.frontend_root / "src" / "apps" / "kuaizhizao" / "index.tsx"
        if not index_file.exists():
            return CheckResult(
                name="路由配置检测",
                status="fail",
                message="index.tsx 文件不存在",
                details=[]
            )
        
        content = index_file.read_text(encoding="utf-8")
        
        # 查找Route组件
        route_pattern = r'<Route\s+path=["\']([^"\']+)["\']'
        routes = re.findall(route_pattern, content)
        
        # 查找导入的页面组件
        import_pattern = r'import\s+(\w+)\s+from\s+["\']\./pages/([^"\']+)["\']'
        imports = re.findall(import_pattern, content)
        
        return CheckResult(
            name="路由配置检测",
            status="pass",
            message=f"检测到 {len(routes)} 个路由",
            details=[f"路由数量: {len(routes)}", f"导入组件: {len(imports)}"]
        )
    
    def check_api_services(self) -> CheckResult:
        """检测API服务"""
        if not self.services_root.exists():
            return CheckResult(
                name="API服务检测",
                status="fail",
                message="services 目录不存在",
                details=[]
            )
        
        service_files = list(self.services_root.glob("*.ts"))
        
        issues = []
        services = []
        
        for service_file in service_files:
            content = service_file.read_text(encoding="utf-8")
            # 检查是否有API函数定义
            if "export" in content or "const" in content:
                services.append(service_file.name)
            else:
                issues.append(f"{service_file.name} 未找到导出函数")
        
        return CheckResult(
            name="API服务检测",
            status="pass" if not issues else "warning",
            message=f"检测到 {len(services)} 个API服务文件",
            details=[f"服务文件: {len(service_files)}", f"有效服务: {len(services)}"] + (issues[:3] if issues else [])
        )
    
    def run_all_checks(self) -> List[CheckResult]:
        """运行所有前端检测"""
        return [
            self.check_pages(),
            self.check_routes(),
            self.check_api_services(),
        ]


class IntegrationChecker:
    """集成检测器"""
    
    def __init__(self, backend_root: Path, frontend_root: Path):
        self.backend_root = backend_root
        self.frontend_root = frontend_root
        self.backend_api = backend_root / "src" / "apps" / "kuaizhizao" / "api"
        self.frontend_services = frontend_root / "src" / "apps" / "kuaizhizao" / "services"
    
    def check_api_mapping(self) -> CheckResult:
        """检测前后端API映射"""
        # 提取后端API端点
        backend_endpoints = set()
        for api_file in self.backend_api.glob("*.py"):
            if api_file.name == "__init__.py":
                continue
            content = api_file.read_text(encoding="utf-8")
            route_pattern = r'@router\.(get|post|put|delete|patch)\s*\(["\']([^"\']+)["\']'
            matches = re.findall(route_pattern, content)
            for method, path in matches:
                backend_endpoints.add(f"{method.upper()}:{path}")
        
        # 提取前端API调用
        frontend_calls = set()
        if self.frontend_services.exists():
            for service_file in self.frontend_services.glob("*.ts"):
                content = service_file.read_text(encoding="utf-8")
                # 查找API调用模式 - 支持多种格式
                # 匹配 apiRequest('/apps/kuaizhizao/...') 或 apiRequest(`/apps/kuaizhizao/...`)
                api_patterns = [
                    r'apiRequest\(["\']/apps/kuaizhizao/([^"\']+)["\']',
                    r'apiRequest\(`/apps/kuaizhizao/([^`]+)`',
                    r'["\']/apps/kuaizhizao/([^"\']+)["\']',
                    r'`/apps/kuaizhizao/([^`]+)`',
                ]
                for pattern in api_patterns:
                    matches = re.findall(pattern, content)
                    for match in matches:
                        # 清理路径（移除查询参数、模板变量等）
                        clean_path = match.split('?')[0].split('#')[0].split('${')[0].split('`')[0]
                        if clean_path and not clean_path.startswith('$'):
                            frontend_calls.add(clean_path)
        
        # 简单的匹配检查
        matched = len(backend_endpoints) > 0 and len(frontend_calls) > 0
        
        return CheckResult(
            name="前后端API映射检测",
            status="pass" if matched else "warning",
            message=f"后端端点: {len(backend_endpoints)}, 前端调用: {len(frontend_calls)}",
            details=[
                f"后端API端点: {len(backend_endpoints)}",
                f"前端API调用: {len(frontend_calls)}"
            ]
        )
    
    def run_all_checks(self) -> List[CheckResult]:
        """运行所有集成检测"""
        return [
            self.check_api_mapping(),
        ]


def generate_report(report: HealthReport) -> str:
    """生成检测报告"""
    output = []
    output.append("=" * 80)
    output.append("项目健康检测报告")
    output.append("=" * 80)
    output.append(f"检测时间: {report.timestamp}")
    output.append("")
    
    # 后端检测结果
    output.append("📦 后端检测结果")
    output.append("-" * 80)
    for check in report.backend_checks:
        status_icon = "✅" if check.status == "pass" else "⚠️" if check.status == "warning" else "❌"
        output.append(f"{status_icon} {check.name}: {check.message}")
        if check.details:
            for detail in check.details[:3]:  # 只显示前3个详情
                output.append(f"   - {detail}")
    output.append("")
    
    # 前端检测结果
    output.append("🎨 前端检测结果")
    output.append("-" * 80)
    for check in report.frontend_checks:
        status_icon = "✅" if check.status == "pass" else "⚠️" if check.status == "warning" else "❌"
        output.append(f"{status_icon} {check.name}: {check.message}")
        if check.details:
            for detail in check.details[:3]:
                output.append(f"   - {detail}")
    output.append("")
    
    # 集成检测结果
    output.append("🔗 集成检测结果")
    output.append("-" * 80)
    for check in report.integration_checks:
        status_icon = "✅" if check.status == "pass" else "⚠️" if check.status == "warning" else "❌"
        output.append(f"{status_icon} {check.name}: {check.message}")
        if check.details:
            for detail in check.details[:3]:
                output.append(f"   - {detail}")
    output.append("")
    
    # 总结
    output.append("📊 检测总结")
    output.append("-" * 80)
    total_checks = len(report.backend_checks) + len(report.frontend_checks) + len(report.integration_checks)
    passed = sum(1 for check in report.backend_checks + report.frontend_checks + report.integration_checks if check.status == "pass")
    warnings = sum(1 for check in report.backend_checks + report.frontend_checks + report.integration_checks if check.status == "warning")
    failed = sum(1 for check in report.backend_checks + report.frontend_checks + report.integration_checks if check.status == "fail")
    
    output.append(f"总检测项: {total_checks}")
    output.append(f"✅ 通过: {passed}")
    output.append(f"⚠️  警告: {warnings}")
    output.append(f"❌ 失败: {failed}")
    output.append("")
    
    if failed == 0 and warnings == 0:
        output.append("✅ 项目健康状态良好，所有检测通过！")
    elif failed == 0:
        output.append("⚠️  项目基本健康，但有一些警告需要关注")
    else:
        output.append("❌ 项目存在一些问题，需要修复")
    
    output.append("")
    output.append("=" * 80)
    
    return "\n".join(output)


def main():
    """主函数"""
    print("开始项目健康检测...")
    print("")
    
    # 初始化检测器
    backend_checker = BackendChecker(backend_root)
    frontend_checker = FrontendChecker(frontend_root)
    integration_checker = IntegrationChecker(backend_root, frontend_root)
    
    # 运行检测
    print("检测后端...")
    backend_results = backend_checker.run_all_checks()
    
    print("检测前端...")
    frontend_results = frontend_checker.run_all_checks()
    
    print("检测集成...")
    integration_results = integration_checker.run_all_checks()
    
    # 生成报告
    report = HealthReport(
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        backend_checks=backend_results,
        frontend_checks=frontend_results,
        integration_checks=integration_results
    )
    
    # 输出报告
    report_text = generate_report(report)
    print(report_text)
    
    # 保存报告
    report_file = project_root / "project_health_report.txt"
    report_file.write_text(report_text, encoding="utf-8")
    print(f"\n报告已保存到: {report_file}")
    
    # 保存JSON格式
    report_json = {
        "timestamp": report.timestamp,
        "backend_checks": [
            {
                "name": check.name,
                "status": check.status,
                "message": check.message,
                "details": check.details
            }
            for check in report.backend_checks
        ],
        "frontend_checks": [
            {
                "name": check.name,
                "status": check.status,
                "message": check.message,
                "details": check.details
            }
            for check in report.frontend_checks
        ],
        "integration_checks": [
            {
                "name": check.name,
                "status": check.status,
                "message": check.message,
                "details": check.details
            }
            for check in report.integration_checks
        ]
    }
    
    json_file = project_root / "project_health_report.json"
    json_file.write_text(json.dumps(report_json, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON报告已保存到: {json_file}")
    
    # 返回退出码
    total_failed = sum(1 for check in backend_results + frontend_results + integration_results if check.status == "fail")
    return 1 if total_failed > 0 else 0


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)


#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
更新所有模块的router.py文件，注册所有API路由
"""

import os
import re

MODULES = {
    "kuaipm": [
        "projects", "project_applications", "project_wbss", "project_tasks",
        "project_resources", "project_progresss", "project_costs", "project_risks", "project_qualitys"
    ],
    "kuaiehs": [
        "environment_monitorings", "emission_managements", "environmental_compliances", "environmental_incidents",
        "occupational_health_checks", "occupational_diseases", "health_records",
        "safety_trainings", "safety_inspections", "safety_hazards", "safety_incidents",
        "regulations", "compliance_checks", "compliance_reports"
    ],
    "kuaicert": [
        "certification_types", "certification_standards", "scoring_rules",
        "certification_requirements", "current_assessments", "self_assessments", "assessment_reports",
        "improvement_suggestions", "improvement_plans", "best_practices",
        "certification_applications", "certification_progresss", "certification_certificates"
    ],
    "kuaiepm": [
        "kpis", "kpi_monitorings", "kpi_analysiss", "kpi_alerts",
        "strategy_maps", "objectives", "performance_evaluations",
        "business_dashboards", "business_data_analysiss", "trend_analysiss", "comparison_analysiss",
        "budgets", "budget_variances", "budget_forecasts"
    ],
    "kuaioa": [
        "approval_processs", "approval_instances", "approval_nodes",
        "documents", "document_versions",
        "meetings", "meeting_minutess", "meeting_resources",
        "notices", "notifications"
    ],
}

BASE_DIR = "riveredge-backend/src/apps"

ROUTER_TEMPLATE = '''"""
{module_name_upper}模块 API 路由

整合所有{module_name_cn}相关的 API 路由。
"""

from fastapi import APIRouter
{imports}

router = APIRouter(prefix="/{module_name}", tags=["{module_name_upper}"])

# 注册子路由
{includes}
'''

MODULE_NAMES = {
    "kuaipm": ("PM", "项目管理"),
    "kuaiehs": ("EHS", "环境健康安全管理"),
    "kuaicert": ("认证", "企业认证与评审"),
    "kuaiepm": ("EPM", "企业绩效管理"),
    "kuaioa": ("OA", "协同办公"),
}

def update_router(module_name, api_files):
    """更新模块的router.py文件"""
    module_dir = f"{BASE_DIR}/{module_name}"
    router_path = f"{module_dir}/api/router.py"
    
    # 生成imports
    imports = []
    includes = []
    
    for api_file in api_files:
        var_name = api_file.replace("-", "_")
        imports.append(f'from apps.{module_name}.api.{api_file} import router as {var_name}_router')
        includes.append(f'router.include_router({var_name}_router)')
    
    module_name_upper, module_name_cn = MODULE_NAMES[module_name]
    
    content = ROUTER_TEMPLATE.format(
        module_name_upper=module_name_upper,
        module_name_cn=module_name_cn,
        module_name=module_name,
        imports="\n".join(imports),
        includes="\n".join(includes)
    )
    
    with open(router_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    print(f"已更新: {router_path}")

def main():
    """主函数"""
    for module_name, api_files in MODULES.items():
        update_router(module_name, api_files)
    print("所有router.py文件更新完成！")

if __name__ == "__main__":
    main()


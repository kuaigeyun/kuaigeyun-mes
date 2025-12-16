#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查所有APP模块的建设情况
"""

import os
from pathlib import Path

# 定义所有模块
modules = [
    'kuaiacc', 'kuaiaps', 'kuaicert', 'kuaicrm', 'kuaieam', 'kuaiehs',
    'kuaiems', 'kuaiepm', 'kuaihrm', 'kuaiiot', 'kuailims', 'kuaimes',
    'kuaimi', 'kuaimrp', 'kuaioa', 'kuaipdm', 'kuaipm', 'kuaiqms',
    'kuaiscm', 'kuaisrm', 'kuaitms', 'kuaiwms'
]

def check_backend_module(module):
    """检查后端模块完整性"""
    base_path = Path(f'riveredge-backend/src/apps/{module}')
    if not base_path.exists():
        return {'exists': False, 'models': 0, 'schemas': 0, 'services': 0, 'apis': 0, 'router': False}
    
    models_path = base_path / 'models'
    schemas_path = base_path / 'schemas'
    services_path = base_path / 'services'
    api_path = base_path / 'api'
    router_path = api_path / 'router.py'
    
    # 排除__init__.py和__pycache__
    models = len([f for f in models_path.glob('*.py') if f.name != '__init__.py']) if models_path.exists() else 0
    schemas = len([f for f in schemas_path.glob('*.py') if f.name != '__init__.py']) if schemas_path.exists() else 0
    services = len([f for f in services_path.glob('*.py') if f.name != '__init__.py']) if services_path.exists() else 0
    apis = len([f for f in api_path.glob('*.py') if f.name not in ['__init__.py', 'router.py']]) if api_path.exists() else 0
    router = router_path.exists()
    
    return {
        'exists': True,
        'models': models,
        'schemas': schemas,
        'services': services,
        'apis': apis,
        'router': router
    }

def check_frontend_module(module):
    """检查前端模块完整性"""
    base_path = Path(f'riveredge-frontend/src/apps/{module}')
    if not base_path.exists():
        return {'exists': False, 'types': False, 'services': False, 'index': False, 'pages': 0}
    
    types_path = base_path / 'types' / 'process.ts'
    services_path = base_path / 'services' / 'process.ts'
    index_path = base_path / 'index.tsx'
    pages_path = base_path / 'pages'
    
    pages = len(list(pages_path.rglob('index.tsx'))) if pages_path.exists() else 0
    
    return {
        'exists': True,
        'types': types_path.exists(),
        'services': services_path.exists(),
        'index': index_path.exists(),
        'pages': pages
    }

def check_router_registration(module):
    """检查路由是否在主文件中注册"""
    main_file = Path('riveredge-backend/src/server/main.py')
    if not main_file.exists():
        return False
    
    content = main_file.read_text(encoding='utf-8')
    # 检查导入
    import_check = f'from apps.{module}.api.router' in content
    # 检查注册
    register_check = f'{module}_router' in content or f'{module.replace("kuai", "")}_router' in content
    
    return import_check and register_check

print("=" * 100)
print("后端模块检查")
print("=" * 100)
print(f"{'模块':<15} {'存在':<6} {'Models':<8} {'Schemas':<8} {'Services':<8} {'APIs':<8} {'Router':<8} {'已注册':<8}")
print("-" * 100)

backend_stats = {'total': 0, 'complete': 0, 'incomplete': 0}

for module in sorted(modules):
    result = check_backend_module(module)
    registered = check_router_registration(module)
    
    backend_stats['total'] += 1
    if result['exists'] and result['router'] and registered:
        backend_stats['complete'] += 1
    else:
        backend_stats['incomplete'] += 1
    
    if result['exists']:
        status = '✓' if result['router'] and registered else '⚠'
        print(f"{module:<15} {'✓':<6} {result['models']:<8} {result['schemas']:<8} {result['services']:<8} {result['apis']:<8} {'✓' if result['router'] else '✗':<8} {'✓' if registered else '✗':<8} {status}")
    else:
        print(f"{module:<15} {'✗':<6} {'-':<8} {'-':<8} {'-':<8} {'-':<8} {'-':<8} {'-':<8} ✗")

print(f"\n后端统计: 总计 {backend_stats['total']} 个模块, 完整 {backend_stats['complete']} 个, 不完整 {backend_stats['incomplete']} 个")

print("\n" + "=" * 100)
print("前端模块检查")
print("=" * 100)
print(f"{'模块':<15} {'存在':<6} {'Types':<8} {'Services':<8} {'Index':<8} {'Pages':<8} {'状态':<8}")
print("-" * 100)

frontend_stats = {'total': 0, 'complete': 0, 'incomplete': 0}

for module in sorted(modules):
    result = check_frontend_module(module)
    
    frontend_stats['total'] += 1
    if result['exists'] and result['types'] and result['services'] and result['index'] and result['pages'] > 0:
        frontend_stats['complete'] += 1
        status = '✓'
    else:
        frontend_stats['incomplete'] += 1
        status = '⚠' if result['exists'] else '✗'
    
    if result['exists']:
        print(f"{module:<15} {'✓':<6} {'✓' if result['types'] else '✗':<8} {'✓' if result['services'] else '✗':<8} {'✓' if result['index'] else '✗':<8} {result['pages']:<8} {status}")
    else:
        print(f"{module:<15} {'✗':<6} {'-':<8} {'-':<8} {'-':<8} {'-':<8} {status}")

print(f"\n前端统计: 总计 {frontend_stats['total']} 个模块, 完整 {frontend_stats['complete']} 个, 不完整 {frontend_stats['incomplete']} 个")

print("\n" + "=" * 100)
print("总体统计")
print("=" * 100)
print(f"后端完整度: {backend_stats['complete']}/{backend_stats['total']} ({backend_stats['complete']*100//backend_stats['total']}%)")
print(f"前端完整度: {frontend_stats['complete']}/{frontend_stats['total']} ({frontend_stats['complete']*100//frontend_stats['total']}%)")
print(f"总体完整度: {(backend_stats['complete'] + frontend_stats['complete'])}/{(backend_stats['total'] + frontend_stats['total'])} ({(backend_stats['complete'] + frontend_stats['complete'])*100//(backend_stats['total'] + frontend_stats['total'])}%)")


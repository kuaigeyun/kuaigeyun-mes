"""
自动化模块测试工具

逐个测试各个模块的路由注册和API可访问性，自动检测问题并生成报告。

Author: Auto (AI Assistant)
Date: 2026-01-19
"""

import sys
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
import json

# 添加src目录到Python路径
backend_path = Path(__file__).parent.parent / "riveredge-backend"
src_path = backend_path / "src"
sys.path.insert(0, str(src_path))

from fastapi import FastAPI
from httpx import AsyncClient
from server.main import app


def check_route_registration(app: FastAPI) -> Dict[str, Any]:
    """
    检查路由注册情况，按模块分组
    
    Returns:
        Dict: 包含各模块的路由统计和问题列表
    """
    routes = []
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            if route.path.startswith('/static') or 'websocket' in route.path.lower():
                continue
            methods = list(route.methods) if route.methods else ['GET']
            methods = [m for m in methods if m not in ['HEAD', 'OPTIONS']]
            if methods:
                routes.append({
                    'path': route.path,
                    'methods': methods,
                    'name': getattr(route, 'name', ''),
                    'tags': getattr(route, 'tags', []),
                })
    
    # 按模块分组
    modules = {}
    for route in routes:
        path = route['path']
        module_name = 'other'
        
        if '/apps/' in path:
            parts = path.split('/apps/')
            if len(parts) > 1:
                module_name = parts[1].split('/')[0]
        elif path.startswith('/api/v1/infra/'):
            module_name = 'infra'
        elif path.startswith('/api/v1/core/'):
            module_name = 'core'
        
        if module_name not in modules:
            modules[module_name] = []
        modules[module_name].append(route)
    
    return {
        'total_routes': len(routes),
        'modules': modules,
        'module_count': len(modules)
    }


async def test_single_route(
    client: AsyncClient,
    route: Dict[str, Any],
    base_url: str = "http://test",
    token: Optional[str] = None,
    tenant_id: int = 1
) -> Dict[str, Any]:
    """
    测试单个路由
    
    Returns:
        Dict: 测试结果
    """
    path = route['path']
    methods = route['methods']
    
    # 跳过特殊路径
    if any(skip in path for skip in ['/docs', '/openapi.json', '/redoc', '/health']):
        return {
            'path': path,
            'status': 'skipped',
            'reason': '特殊路径'
        }
    
    # 替换路径参数
    test_path = path
    if '{' in test_path:
        param_map = {
            '{id}': '1', '{uuid}': 'test-uuid',
            '{order_id}': '1', '{material_uuid}': 'test-material-uuid',
            '{workshop_uuid}': 'test-workshop-uuid', '{customer_id}': '1',
            '{supplier_id}': '1', '{warehouse_id}': '1', '{item_id}': '1',
        }
        for param, value in param_map.items():
            test_path = test_path.replace(param, value)
        import re
        test_path = re.sub(r'\{[^}]+\}', '1', test_path)
    
    # 选择测试方法
    test_method = 'GET' if 'GET' in methods else methods[0] if methods else 'GET'
    
    # 准备请求
    headers = {'Content-Type': 'application/json', 'x-tenant-id': str(tenant_id)}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    try:
        if test_method == 'GET':
            response = await client.get(test_path, headers=headers, timeout=5.0)
        elif test_method == 'POST':
            response = await client.post(test_path, headers=headers, json={}, timeout=5.0)
        else:
            response = await client.request(test_method, test_path, headers=headers, timeout=5.0)
        
        is_accessible = response.status_code != 404
        return {
            'path': path,
            'test_path': test_path,
            'methods': methods,
            'test_method': test_method,
            'status': 'success' if is_accessible else 'not_found',
            'status_code': response.status_code,
            'is_accessible': is_accessible,
        }
    except Exception as e:
        return {
            'path': path,
            'test_path': test_path,
            'status': 'error',
            'error': str(e),
            'is_accessible': False,
        }


async def test_module(
    app: FastAPI,
    module_name: str,
    routes: List[Dict[str, Any]],
    base_url: str = "http://test",
    token: Optional[str] = None,
    tenant_id: int = 1,
    max_concurrent: int = 5
) -> Dict[str, Any]:
    """
    测试单个模块的所有路由
    
    Returns:
        Dict: 模块测试结果
    """
    print(f"\n📦 测试模块: {module_name} ({len(routes)} 个路由)")
    
    results = []
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def test_with_semaphore(route):
        async with semaphore:
            async with AsyncClient(app=app, base_url=base_url) as client:
                return await test_single_route(client, route, base_url, token, tenant_id)
    
    tasks = [test_with_semaphore(route) for route in routes]
    results = await asyncio.gather(*tasks)
    
    # 统计
    total = len(results)
    accessible = sum(1 for r in results if r.get('is_accessible', False))
    not_found = sum(1 for r in results if r.get('status') == 'not_found')
    errors = sum(1 for r in results if r.get('status') == 'error')
    skipped = sum(1 for r in results if r.get('status') == 'skipped')
    
    print(f"  ✅ 可访问: {accessible}/{total} ({accessible/total*100:.1f}%)")
    print(f"  ❌ 404: {not_found}/{total} ({not_found/total*100:.1f}%)")
    print(f"  ⚠️  错误: {errors}/{total} ({errors/total*100:.1f}%)")
    
    return {
        'module_name': module_name,
        'total': total,
        'accessible': accessible,
        'not_found': not_found,
        'errors': errors,
        'skipped': skipped,
        'results': results
    }


async def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='自动化模块测试工具')
    parser.add_argument('--base-url', type=str, default='http://test', help='基础URL')
    parser.add_argument('--token', type=str, default=None, help='认证Token')
    parser.add_argument('--tenant-id', type=int, default=1, help='租户ID')
    parser.add_argument('--module', type=str, default=None, help='只测试指定模块')
    parser.add_argument('--output', type=str, default='module-test-results.json', help='输出文件')
    
    args = parser.parse_args()
    
    print("=" * 80)
    print("自动化模块测试工具")
    print("=" * 80)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("")
    
    # 检查路由注册
    print("📋 检查路由注册情况...")
    route_info = check_route_registration(app)
    print(f"✅ 发现 {route_info['total_routes']} 个路由，分布在 {route_info['module_count']} 个模块")
    print("")
    
    # 显示模块列表
    print("📊 模块列表:")
    for module_name, routes in sorted(route_info['modules'].items()):
        print(f"  - {module_name}: {len(routes)} 个路由")
    print("")
    
    # 测试模块
    all_results = []
    modules_to_test = [args.module] if args.module else sorted(route_info['modules'].keys())
    
    for module_name in modules_to_test:
        if module_name not in route_info['modules']:
            print(f"⚠️  模块 {module_name} 不存在，跳过")
            continue
        
        routes = route_info['modules'][module_name]
        result = await test_module(
            app, module_name, routes,
            args.base_url, args.token, args.tenant_id
        )
        all_results.append(result)
    
    # 生成报告
    print("\n" + "=" * 80)
    print("测试总结")
    print("=" * 80)
    
    total_routes = sum(r['total'] for r in all_results)
    total_accessible = sum(r['accessible'] for r in all_results)
    total_not_found = sum(r['not_found'] for r in all_results)
    total_errors = sum(r['errors'] for r in all_results)
    
    print(f"总路由数: {total_routes}")
    print(f"✅ 可访问: {total_accessible} ({total_accessible/total_routes*100:.1f}%)")
    print(f"❌ 404: {total_not_found} ({total_not_found/total_routes*100:.1f}%)")
    print(f"⚠️  错误: {total_errors} ({total_errors/total_routes*100:.1f}%)")
    
    # 保存结果
    output_path = Path(args.output)
    save_data = {
        'test_time': datetime.now().isoformat(),
        'summary': {
            'total_routes': total_routes,
            'accessible': total_accessible,
            'not_found': total_not_found,
            'errors': total_errors,
        },
        'modules': all_results
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(save_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n💾 测试结果已保存到: {output_path.absolute()}")
    
    return 0 if total_not_found == 0 and total_errors == 0 else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

"""
API路由测试工具

测试所有已注册的FastAPI路由，检查路由是否可访问（不返回404）。

Author: Auto (AI Assistant)
Date: 2026-01-19
"""

import sys
import asyncio
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
import json

# 添加src目录到Python路径（从backend目录运行）
backend_path = Path(__file__).parent.parent  # scripts的父目录就是backend
src_path = backend_path / "src"
sys.path.insert(0, str(src_path))

from fastapi import FastAPI
from httpx import AsyncClient
from server.main import app


def get_all_routes(app: FastAPI) -> List[Dict[str, Any]]:
    """
    获取所有已注册的路由
    
    Returns:
        List[Dict]: 路由信息列表，包含path、methods、name等
    """
    routes = []
    
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            # 跳过静态文件和WebSocket路由
            if route.path.startswith('/static') or 'websocket' in route.path.lower():
                continue
            
            # 获取HTTP方法
            methods = list(route.methods) if route.methods else ['GET']
            # 移除HEAD和OPTIONS方法（这些是自动添加的）
            methods = [m for m in methods if m not in ['HEAD', 'OPTIONS']]
            
            if methods:
                routes.append({
                    'path': route.path,
                    'methods': methods,
                    'name': getattr(route, 'name', ''),
                    'tags': getattr(route, 'tags', []),
                })
    
    return routes


async def test_route(
    client: AsyncClient,
    route: Dict[str, Any],
    base_url: str = "http://test",
    token: str = None,
    tenant_id: int = 1
) -> Dict[str, Any]:
    """
    测试单个路由
    
    Args:
        client: HTTP客户端
        route: 路由信息
        base_url: 基础URL
        token: 认证Token（可选）
        tenant_id: 租户ID
    
    Returns:
        Dict: 测试结果
    """
    path = route['path']
    methods = route['methods']
    
    # 跳过需要特殊处理的路径
    if any(skip in path for skip in ['/docs', '/openapi.json', '/redoc', '/health', '/api/inngest']):
        return {
            'path': path,
            'methods': methods,
            'status': 'skipped',
            'reason': '特殊路径，跳过测试'
        }
    
    # 替换路径参数为示例值
    test_path = path
    if '{' in test_path:
        # 使用字典统一管理路径参数替换规则
        param_replacements = {
            # 通用ID参数
            '{id}': '1',
            '{uuid}': 'test-uuid',
            # 业务相关参数
            '{workshop_uuid}': 'test-workshop-uuid',
            '{material_uuid}': 'test-material-uuid',
            '{group_uuid}': 'test-group-uuid',
            '{operation_uuid}': 'test-operation-uuid',
            '{process_route_uuid}': 'test-process-route-uuid',
            '{file_uuid}': 'test-file-uuid',
            # 订单相关
            '{order_id}': '1',
            '{sales_order_id}': '1',
            '{purchase_order_id}': '1',
            '{work_order_id}': '1',
            '{item_id}': '1',
            # 单据相关
            '{document_type}': 'work_order',
            '{document_id}': '1',
            '{forecast_id}': '1',
            '{demand_id}': '1',
            '{computation_id}': '1',
            # 物料相关
            '{material_id}': '1',
            '{component_id}': '1',
            '{bom_id}': '1',
            '{batch_id}': '1',
            '{serial_id}': '1',
            # 工艺相关
            '{process_route_id}': '1',
            '{operation_id}': '1',
            '{sop_id}': '1',
            '{defect_type_id}': '1',
            # 库存相关
            '{warehouse_id}': '1',
            '{transfer_id}': '1',
            '{stocktaking_id}': '1',
            '{binding_id}': '1',
            '{packing_id}': '1',
            '{alert_id}': '1',
            '{rule_id}': '1',
            '{registration_id}': '1',
            # 报工相关
            '{reporting_id}': '1',
            '{scrap_id}': '1',
            '{defect_id}': '1',
            '{rework_id}': '1',
            # 委外相关
            '{outsource_id}': '1',
            '{issue_id}': '1',
            '{settlement_id}': '1',
            '{collaboration_id}': '1',
            # 质量相关
            '{inspection_id}': '1',
            '{standard_id}': '1',
            # 财务相关
            '{payable_id}': '1',
            '{receivable_id}': '1',
            '{invoice_id}': '1',
            '{payment_id}': '1',
            # 计划相关
            '{plan_id}': '1',
            '{mrp_result_id}': '1',
            '{lrp_result_id}': '1',
            '{schedule_id}': '1',
            # 设备相关
            '{equipment_id}': '1',
            '{fault_id}': '1',
            '{repair_id}': '1',
            # 客户供应商相关
            '{customer_id}': '1',
            '{supplier_id}': '1',
            # 系统相关
            '{tenant_id}': '1',
            '{user_id}': '1',
            '{role_id}': '1',
            '{permission_id}': '1',
            '{config_id}': '1',
            '{search_id}': '1',
            '{template_id}': '1',
            '{package_id}': '1',
            # 其他
            '{version}': 'v1.0',
            '{version_id}': '1',
            '{code}': 'TEST',
            '{template_code}': 'TEST',
        }
        
        # 应用替换规则
        for param, value in param_replacements.items():
            test_path = test_path.replace(param, value)
        
        # 如果还有未替换的参数，使用通用值
        import re
        test_path = re.sub(r'\{[^}]+\}', '1', test_path)
    
    # 选择第一个HTTP方法进行测试（优先GET）
    test_method = 'GET' if 'GET' in methods else methods[0] if methods else 'GET'
    
    # 准备请求头
    headers = {
        'Content-Type': 'application/json',
        'x-tenant-id': str(tenant_id),
    }
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    # 发送HTTP请求
    try:
        if test_method == 'GET':
            response = await client.get(test_path, headers=headers, timeout=5.0)
        elif test_method == 'POST':
            response = await client.post(test_path, headers=headers, json={}, timeout=5.0)
        elif test_method == 'PUT':
            response = await client.put(test_path, headers=headers, json={}, timeout=5.0)
        elif test_method == 'DELETE':
            response = await client.delete(test_path, headers=headers, timeout=5.0)
        elif test_method == 'PATCH':
            response = await client.patch(test_path, headers=headers, json={}, timeout=5.0)
        else:
            response = await client.request(test_method, test_path, headers=headers, timeout=5.0)
        
        # 判断路由是否可访问（不返回404说明路由存在）
        is_accessible = response.status_code != 404
        
        return {
            'path': path,
            'test_path': test_path,
            'methods': methods,
            'test_method': test_method,
            'status': 'success' if is_accessible else 'not_found',
            'status_code': response.status_code,
            'is_accessible': is_accessible,
            'response_time_ms': response.elapsed.total_seconds() * 1000 if hasattr(response, 'elapsed') else None,
        }
    except Exception as e:
        return {
            'path': path,
            'test_path': test_path,
            'methods': methods,
            'test_method': test_method,
            'status': 'error',
            'error': str(e),
            'is_accessible': False,
        }


async def test_all_routes(
    app: FastAPI,
    base_url: str = "http://test",
    token: str = None,
    tenant_id: int = 1,
    max_concurrent: int = 10
) -> Dict[str, Any]:
    """
    测试所有已注册的路由
    
    Args:
        app: FastAPI应用实例
        base_url: 基础URL
        token: 认证Token（可选）
        tenant_id: 租户ID
        max_concurrent: 最大并发数
    
    Returns:
        Dict: 测试结果统计
    """
    print("=" * 80)
    print("开始测试所有API路由")
    print("=" * 80)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"基础URL: {base_url}")
    print(f"租户ID: {tenant_id}")
    print("")
    
    # 获取所有路由
    print("📋 正在获取所有已注册的路由...")
    routes = get_all_routes(app)
    print(f"✅ 发现 {len(routes)} 个路由")
    print("")
    
    # 按应用分组统计
    app_routes = {}
    for route in routes:
        path = route['path']
        if '/apps/' in path:
            # 提取应用名称
            parts = path.split('/apps/')
            if len(parts) > 1:
                app_name = parts[1].split('/')[0]
                if app_name not in app_routes:
                    app_routes[app_name] = []
                app_routes[app_name].append(route)
        elif path.startswith('/api/v1/infra/'):
            if 'infra' not in app_routes:
                app_routes['infra'] = []
            app_routes['infra'].append(route)
        elif path.startswith('/api/v1/core/'):
            if 'core' not in app_routes:
                app_routes['core'] = []
            app_routes['core'].append(route)
        else:
            if 'other' not in app_routes:
                app_routes['other'] = []
            app_routes['other'].append(route)
    
    print("📊 路由统计（按应用分组）:")
    for app_name, app_route_list in sorted(app_routes.items()):
        print(f"  - {app_name}: {len(app_route_list)} 个路由")
    print("")
    
    # 测试所有路由
    print("🧪 开始测试路由...")
    results = []
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def test_with_semaphore(route):
        async with semaphore:
            async with AsyncClient(app=app, base_url=base_url) as client:
                return await test_route(client, route, base_url, token, tenant_id)
    
    # 并发测试所有路由
    tasks = [test_with_semaphore(route) for route in routes]
    results = await asyncio.gather(*tasks)
    
    # 统计结果
    total = len(results)
    accessible = sum(1 for r in results if r.get('is_accessible', False))
    not_found = sum(1 for r in results if r.get('status') == 'not_found')
    errors = sum(1 for r in results if r.get('status') == 'error')
    skipped = sum(1 for r in results if r.get('status') == 'skipped')
    
    print("")
    print("=" * 80)
    print("测试结果统计")
    print("=" * 80)
    print(f"总路由数: {total}")
    print(f"✅ 可访问: {accessible} ({accessible/total*100:.1f}%)")
    print(f"❌ 404 Not Found: {not_found} ({not_found/total*100:.1f}%)")
    print(f"⚠️  错误: {errors} ({errors/total*100:.1f}%)")
    print(f"⏭️  跳过: {skipped} ({skipped/total*100:.1f}%)")
    print("")
    
    # 按应用分组统计
    print("📊 按应用分组统计:")
    app_stats = {}
    for result in results:
        path = result['path']
        if '/apps/' in path:
            parts = path.split('/apps/')
            if len(parts) > 1:
                app_name = parts[1].split('/')[0]
            else:
                app_name = 'other'
        elif path.startswith('/api/v1/infra/'):
            app_name = 'infra'
        elif path.startswith('/api/v1/core/'):
            app_name = 'core'
        else:
            app_name = 'other'
        
        if app_name not in app_stats:
            app_stats[app_name] = {'total': 0, 'accessible': 0, 'not_found': 0, 'errors': 0, 'skipped': 0}
        
        app_stats[app_name]['total'] += 1
        if result.get('is_accessible'):
            app_stats[app_name]['accessible'] += 1
        elif result.get('status') == 'not_found':
            app_stats[app_name]['not_found'] += 1
        elif result.get('status') == 'error':
            app_stats[app_name]['errors'] += 1
        elif result.get('status') == 'skipped':
            app_stats[app_name]['skipped'] += 1
    
    for app_name, stats in sorted(app_stats.items()):
        total_app = stats['total']
        accessible_app = stats['accessible']
        not_found_app = stats['not_found']
        errors_app = stats['errors']
        skipped_app = stats['skipped']
        print(f"  {app_name}:")
        print(f"    总路由: {total_app}")
        print(f"    ✅ 可访问: {accessible_app} ({accessible_app/total_app*100:.1f}%)")
        print(f"    ❌ 404: {not_found_app} ({not_found_app/total_app*100:.1f}%)")
        print(f"    ⚠️  错误: {errors_app} ({errors_app/total_app*100:.1f}%)")
        print(f"    ⏭️  跳过: {skipped_app} ({skipped_app/total_app*100:.1f}%)")
    print("")
    
    # 显示404的路由
    not_found_routes = [r for r in results if r.get('status') == 'not_found']
    if not_found_routes:
        print("=" * 80)
        print(f"❌ 404 Not Found 的路由 ({len(not_found_routes)} 个):")
        print("=" * 80)
        for result in not_found_routes[:20]:  # 只显示前20个
            print(f"  {result['test_method']} {result['path']}")
        if len(not_found_routes) > 20:
            print(f"  ... 还有 {len(not_found_routes) - 20} 个路由返回404")
        print("")
    
    # 显示错误的路由
    error_routes = [r for r in results if r.get('status') == 'error']
    if error_routes:
        print("=" * 80)
        print(f"⚠️  错误的路由 ({len(error_routes)} 个):")
        print("=" * 80)
        for result in error_routes[:10]:  # 只显示前10个
            print(f"  {result['test_method']} {result['path']}: {result.get('error', 'Unknown error')}")
        if len(error_routes) > 10:
            print(f"  ... 还有 {len(error_routes) - 10} 个路由出现错误")
        print("")
    
    return {
        'total': total,
        'accessible': accessible,
        'not_found': not_found,
        'errors': errors,
        'skipped': skipped,
        'results': results,
        'app_stats': app_stats,
    }


def save_results_to_file(results: Dict[str, Any], output_file: str = "api-routes-test-results.json"):
    """
    保存测试结果到JSON文件
    
    Args:
        results: 测试结果
        output_file: 输出文件路径
    """
    output_path = Path(output_file)
    
    # 准备保存的数据（移除不能序列化的对象）
    save_data = {
        'test_time': datetime.now().isoformat(),
        'summary': {
            'total': results['total'],
            'accessible': results['accessible'],
            'not_found': results['not_found'],
            'errors': results['errors'],
            'skipped': results['skipped'],
        },
        'app_stats': results['app_stats'],
        'results': [
            {
                'path': r['path'],
                'test_path': r.get('test_path', r['path']),
                'methods': r['methods'],
                'test_method': r.get('test_method', 'GET'),
                'status': r.get('status', 'unknown'),
                'status_code': r.get('status_code'),
                'is_accessible': r.get('is_accessible', False),
                'error': r.get('error'),
            }
            for r in results['results']
        ],
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(save_data, f, ensure_ascii=False, indent=2)
    
    print(f"💾 测试结果已保存到: {output_path.absolute()}")


async def main():
    """
    主函数
    """
    import argparse
    
    parser = argparse.ArgumentParser(description='测试所有FastAPI路由')
    parser.add_argument('--base-url', type=str, default='http://test', help='基础URL（默认: http://test）')
    parser.add_argument('--token', type=str, default=None, help='认证Token（可选）')
    parser.add_argument('--tenant-id', type=int, default=1, help='租户ID（默认: 1）')
    parser.add_argument('--max-concurrent', type=int, default=10, help='最大并发数（默认: 10）')
    parser.add_argument('--output', type=str, default='api-routes-test-results.json', help='输出文件路径')
    parser.add_argument('--filter-app', type=str, default=None, help='只测试指定应用的路由（如: kuaizhizao, master-data）')
    
    args = parser.parse_args()
    
    try:
        # 测试所有路由
        results = await test_all_routes(
            app=app,
            base_url=args.base_url,
            token=args.token,
            tenant_id=args.tenant_id,
            max_concurrent=args.max_concurrent
        )
        
        # 保存结果
        save_results_to_file(results, args.output)
        
        # 返回退出码
        if results['not_found'] > 0 or results['errors'] > 0:
            print("")
            print("⚠️  发现一些问题，请检查上面的404和错误信息")
            return 1
        else:
            print("")
            print("✅ 所有路由测试通过！")
            return 0
            
    except KeyboardInterrupt:
        print("\n\n⚠️  测试被用户中断")
        return 130
    except Exception as e:
        print(f"\n\n❌ 测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
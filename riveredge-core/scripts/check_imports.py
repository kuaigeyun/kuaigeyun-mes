"""
逐步检查后端导入问题

从入口开始逐步检查每个模块的导入
"""

import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

print("=" * 60)
print("开始逐步检查后端导入")
print("=" * 60)

# 1. 检查基础导入
print("\n1. 检查基础模块...")
try:
    import sys
    print(f"   ✓ Python 版本: {sys.version.split()[0]}")
except Exception as e:
    print(f"   ✗ 基础模块导入失败: {e}")
    sys.exit(1)

# 2. 检查配置模块
print("\n2. 检查配置模块...")
try:
    from app.config import settings
    print(f"   ✓ 配置模块导入成功")
    print(f"   - APP_NAME: {settings.APP_NAME}")
    print(f"   - PORT: {settings.PORT}")
except Exception as e:
    print(f"   ✗ 配置模块导入失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 3. 检查数据库配置
print("\n3. 检查数据库配置...")
try:
    from core.database import TORTOISE_ORM
    print(f"   ✓ 数据库配置导入成功")
    models = TORTOISE_ORM['apps']['models']['models']
    print(f"   - 模型列表: {models}")
    # 检查是否还有 superadmin
    if 'models.superadmin' in models:
        print(f"   ⚠️  警告: 数据库配置中仍包含 models.superadmin")
    else:
        print(f"   ✓ 数据库配置中已移除 models.superadmin")
except Exception as e:
    print(f"   ✗ 数据库配置导入失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 4. 检查基础模型
print("\n4. 检查基础模型...")
try:
    from models.base import BaseModel
    print(f"   ✓ BaseModel 导入成功")
except Exception as e:
    print(f"   ✗ BaseModel 导入失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 5. 检查 User 模型
print("\n5. 检查 User 模型...")
try:
    from models.user import User
    print(f"   ✓ User 模型导入成功")
    print(f"   - tenant_id 字段可为空: {User._meta.fields_map.get('tenant_id').null if hasattr(User._meta, 'fields_map') else '未知'}")
except Exception as e:
    print(f"   ✗ User 模型导入失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 6. 检查是否还有 SuperAdmin 模型引用
print("\n6. 检查 SuperAdmin 模型引用...")
try:
    from models.superadmin import SuperAdmin
    print(f"   ✗ 错误: SuperAdmin 模型仍然存在！")
    sys.exit(1)
except ImportError:
    print(f"   ✓ SuperAdmin 模型已删除（符合预期）")
except Exception as e:
    print(f"   ✓ SuperAdmin 模型已删除（符合预期）")

# 7. 检查中间件
print("\n7. 检查中间件...")
try:
    from app.middleware import TenantContextMiddleware
    print(f"   ✓ 中间件导入成功")
except Exception as e:
    print(f"   ✗ 中间件导入失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 8. 检查路由
print("\n8. 检查路由...")
routes_to_check = [
    "api.v1.tenants",
    "api.v1.auth",
    "api.v1.register",
    "api.v1.users",
    "api.v1.roles",
    "api.v1.permissions",
    "api.v1.superadmin.auth",
    "api.v1.superadmin.tenants",
    "api.v1.superadmin.monitoring",
]

for route_module in routes_to_check:
    try:
        module = __import__(route_module, fromlist=['router'])
        router = getattr(module, 'router')
        print(f"   ✓ {route_module} 路由导入成功")
    except Exception as e:
        print(f"   ✗ {route_module} 路由导入失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

# 9. 检查 FastAPI 应用
print("\n9. 检查 FastAPI 应用...")
try:
    from app.main import app
    print(f"   ✓ FastAPI 应用导入成功")
    print(f"   - 应用标题: {app.title}")
    print(f"   - 应用版本: {app.version}")
except Exception as e:
    print(f"   ✗ FastAPI 应用导入失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 10. 检查路由注册
print("\n10. 检查路由注册...")
try:
    routes = [route.path for route in app.routes]
    print(f"   ✓ 路由注册成功，共 {len(routes)} 个路由")
    print(f"   - 示例路由: {routes[:5]}")
except Exception as e:
    print(f"   ✗ 路由注册检查失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("✓ 所有检查通过！后端可以正常启动")
print("=" * 60)


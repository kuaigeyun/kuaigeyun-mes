# API缓存使用指南

> **文档说明：**  
> 本文档说明如何使用API缓存装饰器优化API响应时间。

## 概述

API缓存装饰器可以自动缓存API响应，减少数据库查询和计算时间，提升API响应速度。

## 使用方法

### 基本用法

```python
from fastapi import APIRouter, Request, Depends
from core.utils.api_cache import cache_response
from infra.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("")
@cache_response(namespace="users", ttl=600)  # 缓存10分钟
async def get_users(
    request: Request,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    # API逻辑
    users = await user_service.list_users(tenant_id)
    return users
```

### 高级用法

```python
@router.get("/{user_id}")
@cache_response(
    namespace="users",
    ttl=300,  # 缓存5分钟
    vary_on_user=True,  # 根据用户变化缓存
    vary_on_tenant=True,  # 根据租户变化缓存
    vary_on_query=True,  # 根据查询参数变化缓存
)
async def get_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    # API逻辑
    user = await user_service.get_user(tenant_id, user_id)
    return user
```

### 自定义缓存键

```python
def custom_cache_key(request: Request) -> str:
    """自定义缓存键生成函数"""
    # 根据请求路径和查询参数生成缓存键
    path = request.url.path
    query = str(sorted(request.query_params.items()))
    return f"custom:{path}:{hash(query)}"

@router.get("/custom")
@cache_response(
    namespace="custom",
    ttl=600,
    key_func=custom_cache_key,  # 使用自定义缓存键
)
async def get_custom_data(
    request: Request,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    # API逻辑
    return {"data": "custom"}
```

## 缓存策略

### 1. 适合缓存的API

- ✅ **查询类API**：列表查询、详情查询、统计数据等
- ✅ **计算密集型API**：报表生成、数据分析等
- ✅ **变化频率低的API**：配置信息、字典数据等

### 2. 不适合缓存的API

- ❌ **写操作API**：创建、更新、删除等
- ❌ **实时性要求高的API**：实时数据、实时状态等
- ❌ **个性化数据API**：用户个人数据、权限数据等（除非使用vary_on_user）

### 3. TTL设置建议

- **配置数据**：3600秒（1小时）或更长
- **统计数据**：300-600秒（5-10分钟）
- **列表数据**：60-300秒（1-5分钟）
- **详情数据**：300-600秒（5-10分钟）

## 缓存失效

### 手动失效

```python
from core.utils.api_cache import invalidate_api_cache

# 失效特定命名空间的缓存
invalidate_api_cache(namespace="users")

# 失效特定函数的缓存
invalidate_api_cache(namespace="users", func_name="get_users")
```

### 自动失效

在数据更新时，应该自动失效相关缓存：

```python
@router.post("")
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    # 创建用户
    user = await user_service.create_user(tenant_id, user_data, current_user.id)
    
    # 失效相关缓存
    invalidate_api_cache(namespace="users")
    
    return user
```

## 性能监控

使用性能监控中间件可以查看API响应时间和缓存命中率：

```bash
# 获取性能统计
GET /api/v1/core/performance/stats

# 获取慢API列表
GET /api/v1/core/performance/slow-apis

# 重置性能统计
POST /api/v1/core/performance/reset-stats
```

## 注意事项

1. **缓存键唯一性**：确保缓存键能够唯一标识不同的请求
2. **缓存失效**：数据更新时及时失效相关缓存
3. **内存使用**：注意缓存大小，避免内存溢出
4. **序列化**：确保响应数据可以JSON序列化
5. **错误处理**：缓存失败不应该影响API正常功能

---

**文档创建时间：** 2026-01-27  
**文档作者：** Auto (AI Assistant)  
**文档版本：** v1.0
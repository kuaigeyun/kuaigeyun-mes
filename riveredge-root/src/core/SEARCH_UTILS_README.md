# 通用搜索工具使用指南

## 📋 概述

`search_utils` 模块提供了通用的搜索、筛选、排序、分页功能，**大幅减少 Service 层的重复代码**。

### 优势

1. **代码复用**：所有 Service 的列表查询都使用同一套逻辑，减少重复代码
2. **统一接口**：所有列表查询的参数和返回值格式统一，便于维护
3. **安全性**：内置排序字段白名单验证，防止 SQL 注入
4. **灵活性**：支持关键词搜索、精确筛选、排序、分页、组织隔离等功能
5. **易于扩展**：新增功能只需修改 `search_utils`，所有 Service 自动受益

## 🚀 快速开始

### 基础用法

```python
from core.search_utils import list_with_search
from models.user import User

async def list_users(
    page: int = 1,
    page_size: int = 10,
    keyword: Optional[str] = None,
    is_active: Optional[bool] = None,
    tenant_id: Optional[int] = None
) -> Dict[str, Any]:
    """获取用户列表"""
    # 构建精确匹配条件
    exact_filters = {}
    if is_active is not None:
        exact_filters['is_active'] = is_active
    
    # 调用通用搜索函数
    return await list_with_search(
        model=User,
        page=page,
        page_size=page_size,
        keyword=keyword,
        search_fields=['username', 'email', 'full_name'],  # 要搜索的字段
        exact_filters=exact_filters,
        allowed_sort_fields=['username', 'email', 'created_at', 'updated_at'],
        default_sort='-created_at',
        tenant_id=tenant_id,
        skip_tenant_filter=False
    )
```

### 完整示例

#### 示例 1：用户列表（简单场景）

```python
from core.search_utils import list_with_search
from models.user import User

async def list_users(
    page: int = 1,
    page_size: int = 10,
    keyword: Optional[str] = None,
    is_active: Optional[bool] = None,
    tenant_id: Optional[int] = None
) -> Dict[str, Any]:
    """获取用户列表"""
    exact_filters = {}
    if is_active is not None:
        exact_filters['is_active'] = is_active
    
    return await list_with_search(
        model=User,
        page=page,
        page_size=page_size,
        keyword=keyword,
        search_fields=['username', 'email', 'full_name'],
        exact_filters=exact_filters,
        allowed_sort_fields=['username', 'email', 'created_at'],
        tenant_id=tenant_id
    )
```

#### 示例 2：角色列表（更简单）

```python
from core.search_utils import list_with_search
from models.role import Role

async def list_roles(
    page: int = 1,
    page_size: int = 10,
    keyword: Optional[str] = None,
    tenant_id: Optional[int] = None
) -> Dict[str, Any]:
    """获取角色列表"""
    return await list_with_search(
        model=Role,
        page=page,
        page_size=page_size,
        keyword=keyword,
        search_fields=['name', 'code', 'description'],
        allowed_sort_fields=['name', 'code', 'created_at'],
        tenant_id=tenant_id
    )
```

#### 示例 3：组织列表（复杂场景，支持跨组织访问）

```python
from core.search_utils import list_with_search
from models.tenant import Tenant, TenantStatus, TenantPlan

async def list_tenants(
    page: int = 1,
    page_size: int = 10,
    status: Optional[TenantStatus] = None,
    plan: Optional[TenantPlan] = None,
    keyword: Optional[str] = None,
    sort: Optional[str] = None,
    order: Optional[str] = None,
    skip_tenant_filter: bool = True
) -> Dict[str, Any]:
    """获取组织列表（超级管理员）"""
    exact_filters = {}
    if status is not None:
        exact_filters['status'] = status
    if plan is not None:
        exact_filters['plan'] = plan
    
    return await list_with_search(
        model=Tenant,
        page=page,
        page_size=page_size,
        keyword=keyword,
        search_fields=['name', 'domain'],
        exact_filters=exact_filters,
        sort=sort,
        order=order,
        allowed_sort_fields=[
            'id', 'name', 'domain', 'status', 'plan',
            'max_users', 'max_storage', 'created_at', 'updated_at'
        ],
        skip_tenant_filter=skip_tenant_filter
    )
```

## 📖 API 文档

### `list_with_search`

通用列表查询函数，支持搜索、筛选、排序、分页、组织隔离。

#### 参数

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `model` | `Type[T]` | 数据模型类 | **必填** |
| `page` | `int` | 页码 | `1` |
| `page_size` | `int` | 每页数量 | `10` |
| `keyword` | `Optional[str]` | 关键词搜索 | `None` |
| `search_fields` | `Optional[List[str]]` | 要搜索的字段列表 | `None` |
| `exact_filters` | `Optional[Dict[str, Any]]` | 精确匹配条件 | `None` |
| `sort` | `Optional[str]` | 排序字段 | `None` |
| `order` | `Optional[str]` | 排序顺序（'asc' 或 'desc'） | `None` |
| `allowed_sort_fields` | `Optional[List[str]]` | 允许排序的字段列表（白名单） | `['id', 'created_at', 'updated_at']` |
| `default_sort` | `str` | 默认排序字段 | `'-created_at'` |
| `tenant_id` | `Optional[int]` | 组织 ID | `None`（从上下文获取） |
| `skip_tenant_filter` | `bool` | 是否跳过组织过滤 | `False` |

#### 返回值

```python
{
    "items": List[T],      # 查询结果列表
    "total": int,          # 总记录数
    "page": int,           # 当前页码
    "page_size": int       # 每页数量
}
```

## 🔧 高级用法

### 1. 自定义搜索逻辑

如果默认的关键词搜索不满足需求，可以：

1. **继续使用原有逻辑**（对于特殊场景）
2. **扩展 `search_utils`** 支持更多搜索模式
3. **组合使用**：部分使用通用工具，部分自定义

### 2. 处理特殊搜索需求

例如，`TenantService` 需要支持 `name` 和 `domain` 的精确搜索：

```python
# 方案 1：继续使用原有逻辑（推荐，因为逻辑特殊）
# 方案 2：扩展 search_utils 支持字段级别的精确搜索
```

### 3. 多条件组合搜索

```python
exact_filters = {
    'status': 'active',
    'plan': 'basic',
    'is_active': True
}

return await list_with_search(
    model=YourModel,
    exact_filters=exact_filters,
    keyword=keyword,
    search_fields=['name', 'description']
)
```

## 📊 代码对比

### 使用前（~100 行）

```python
async def list_users(...):
    # 获取组织 ID
    if tenant_id is None:
        tenant_id = await require_tenant_context()
    
    # 构建查询
    query = User.filter(tenant_id=tenant_id)
    
    # 关键词搜索
    if keyword:
        from tortoise.expressions import Q
        query = query.filter(
            Q(username__icontains=keyword) |
            Q(email__icontains=keyword) |
            Q(full_name__icontains=keyword)
        )
    
    # 状态筛选
    if is_active is not None:
        query = query.filter(is_active=is_active)
    
    # 获取总数
    total = await query.count()
    
    # 分页查询
    offset = (page - 1) * page_size
    items = await query.offset(offset).limit(page_size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }
```

### 使用后（~20 行）

```python
async def list_users(...):
    exact_filters = {}
    if is_active is not None:
        exact_filters['is_active'] = is_active
    
    return await list_with_search(
        model=User,
        page=page,
        page_size=page_size,
        keyword=keyword,
        search_fields=['username', 'email', 'full_name'],
        exact_filters=exact_filters,
        tenant_id=tenant_id
    )
```

**代码减少约 80%！**

## ⚠️ 注意事项

1. **排序字段白名单**：必须指定 `allowed_sort_fields`，防止 SQL 注入
2. **组织隔离**：默认启用组织过滤，超级管理员使用 `skip_tenant_filter=True`
3. **搜索字段**：`search_fields` 中的字段必须是模型的有效字段
4. **精确匹配**：`exact_filters` 中的字段会进行等值匹配（`field=value`）

## 🔄 迁移指南

### 步骤 1：导入工具

```python
from core.search_utils import list_with_search
```

### 步骤 2：识别搜索字段

找出原代码中用于关键词搜索的字段：

```python
# 原代码
query = query.filter(
    Q(username__icontains=keyword) |
    Q(email__icontains=keyword) |
    Q(full_name__icontains=keyword)
)

# 转换为
search_fields=['username', 'email', 'full_name']
```

### 步骤 3：识别精确筛选条件

找出原代码中的精确匹配条件：

```python
# 原代码
if is_active is not None:
    query = query.filter(is_active=is_active)

# 转换为
exact_filters = {}
if is_active is not None:
    exact_filters['is_active'] = is_active
```

### 步骤 4：识别排序字段

找出原代码中允许排序的字段：

```python
# 原代码
allowed_sort_fields = ['username', 'email', 'created_at']

# 直接使用
allowed_sort_fields=['username', 'email', 'created_at']
```

### 步骤 5：替换原代码

用 `list_with_search` 替换原有的查询逻辑。

## 📚 相关文档

- [query_filter.py](./query_filter.py) - 组织查询集工具
- [search_utils_example.py](./search_utils_example.py) - 使用示例

## 🎯 总结

使用 `search_utils` 可以：

- ✅ **减少 80% 的重复代码**
- ✅ **统一接口，便于维护**
- ✅ **内置安全验证**
- ✅ **支持所有常见搜索场景**

**建议**：新开发的 Service 直接使用 `list_with_search`，现有 Service 逐步迁移。


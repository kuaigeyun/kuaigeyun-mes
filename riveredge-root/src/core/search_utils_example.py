"""
通用搜索工具使用示例

展示如何使用 search_utils 模块简化 Service 层的列表查询代码
"""

from typing import Optional, Dict, Any
from models.tenant import Tenant, TenantStatus, TenantPlan
from core.search_utils import list_with_search


# ========== 示例 1：使用通用搜索工具重构 TenantService.list_tenants ==========

async def list_tenants_example(
    page: int = 1,
    page_size: int = 10,
    status: Optional[TenantStatus] = None,
    plan: Optional[TenantPlan] = None,
    keyword: Optional[str] = None,
    name: Optional[str] = None,
    domain: Optional[str] = None,
    sort: Optional[str] = None,
    order: Optional[str] = None,
    skip_tenant_filter: bool = True
) -> Dict[str, Any]:
    """
    使用通用搜索工具的组织列表查询（示例）
    
    相比原来的实现，代码从 ~100 行减少到 ~30 行。
    """
    # 构建精确匹配条件
    exact_filters = {}
    if status is not None:
        exact_filters['status'] = status
    if plan is not None:
        exact_filters['plan'] = plan
    
    # 处理 name 和 domain 的精确搜索
    # 如果指定了 name 或 domain，将它们作为精确匹配条件
    if name:
        exact_filters['name__icontains'] = name  # 注意：这里使用 icontains，需要特殊处理
    if domain:
        exact_filters['domain__icontains'] = name  # 注意：这里使用 icontains，需要特殊处理
    
    # 确定搜索字段（只有当没有指定 name 或 domain 时才使用 keyword）
    search_fields = None
    if keyword and not name and not domain:
        search_fields = ['name', 'domain']
    
    # 调用通用搜索函数
    return await list_with_search(
        model=Tenant,
        page=page,
        page_size=page_size,
        keyword=keyword if not name and not domain else None,
        search_fields=search_fields,
        exact_filters=exact_filters if not name and not domain else None,  # 简化处理
        sort=sort,
        order=order,
        allowed_sort_fields=[
            'id', 'name', 'domain', 'status', 'plan',
            'max_users', 'max_storage', 'created_at', 'updated_at'
        ],
        default_sort='-created_at',
        skip_tenant_filter=skip_tenant_filter
    )


# ========== 示例 2：使用通用搜索工具重构 UserService.list_users ==========

from models.user import User

async def list_users_example(
    page: int = 1,
    page_size: int = 10,
    keyword: Optional[str] = None,
    is_active: Optional[bool] = None,
    tenant_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    使用通用搜索工具的用户列表查询（示例）
    
    代码从 ~60 行减少到 ~20 行。
    """
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
        search_fields=['username', 'email', 'full_name'],  # 搜索字段
        exact_filters=exact_filters,
        allowed_sort_fields=['username', 'email', 'created_at', 'updated_at'],
        default_sort='-created_at',
        tenant_id=tenant_id,
        skip_tenant_filter=False
    )


# ========== 示例 3：使用通用搜索工具重构 RoleService.list_roles ==========

from models.role import Role

async def list_roles_example(
    page: int = 1,
    page_size: int = 10,
    keyword: Optional[str] = None,
    tenant_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    使用通用搜索工具的角色列表查询（示例）
    
    代码从 ~50 行减少到 ~15 行。
    """
    # 调用通用搜索函数
    return await list_with_search(
        model=Role,
        page=page,
        page_size=page_size,
        keyword=keyword,
        search_fields=['name', 'code', 'description'],  # 搜索字段
        allowed_sort_fields=['name', 'code', 'created_at', 'updated_at'],
        default_sort='-created_at',
        tenant_id=tenant_id,
        skip_tenant_filter=False
    )


# ========== 使用说明 ==========
"""
使用通用搜索工具的优势：

1. **代码复用**：所有 Service 的列表查询都使用同一套逻辑，减少重复代码
2. **统一接口**：所有列表查询的参数和返回值格式统一，便于维护
3. **安全性**：内置排序字段白名单验证，防止 SQL 注入
4. **灵活性**：支持关键词搜索、精确筛选、排序、分页、组织隔离等功能
5. **易于扩展**：新增功能只需修改 search_utils，所有 Service 自动受益

使用步骤：

1. 导入通用搜索工具：
   ```python
   from core.search_utils import list_with_search
   ```

2. 在 Service 方法中调用：
   ```python
   return await list_with_search(
       model=YourModel,
       page=page,
       page_size=page_size,
       keyword=keyword,
       search_fields=['field1', 'field2'],  # 要搜索的字段
       exact_filters={'status': 'active'},  # 精确匹配条件
       sort=sort,
       order=order,
       allowed_sort_fields=['field1', 'field2', 'created_at'],
       tenant_id=tenant_id,
       skip_tenant_filter=False
   )
   ```

3. 对于特殊需求（如 TenantService 的 name/domain 精确搜索），可以：
   - 继续使用原有逻辑
   - 或者扩展 search_utils 支持更多搜索模式
"""


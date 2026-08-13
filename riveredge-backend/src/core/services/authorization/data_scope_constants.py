"""数据权限维度与 scope_custom 解析器名称（框架级常量）。"""

from __future__ import annotations

# scope_custom.payload.resolver 注册名
RESOLVER_PARTNER = "partner"
RESOLVER_OUTSOURCED_UNIT = "outsourced_unit"
RESOLVER_CUSTOMER_SALESMAN_POOL = "customer_salesman_pool"
RESOLVER_CUSTOMER_OWNED_ONLY = "customer_owned_only"
RESOLVER_CUSTOMER_OWNED_VIA_CUSTOMER_ID = "customer_owned_via_customer_id"

# UserDataScopeBinding.dimension
DIMENSION_OUTSOURCED_UNIT = "outsourced_unit"
DIMENSION_SUPPLIER = "supplier"
DIMENSION_CUSTOMER = "customer"
DIMENSION_MANUFACTURER = "manufacturer"

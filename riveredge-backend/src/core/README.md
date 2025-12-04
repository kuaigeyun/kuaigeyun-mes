# 系统级功能模块 (core)

**系统级后端功能和服务** - 面向组织内系统功能

## 🎯 职责范围

**系统级功能** - 组织内系统功能：
- ✅ 角色权限管理
- ✅ 部门管理
- ✅ 职位管理
- ✅ 账户管理
- ⏸️ 菜单管理（暂缓）

## 📁 目录结构

```
src/core/
├── api/                      # 系统级 API 路由
│   ├── roles/                # 角色管理 API
│   ├── permissions/          # 权限管理 API
│   ├── departments/          # 部门管理 API
│   ├── positions/            # 职位管理 API
│   └── users/                # 账户管理 API
│
├── models/                   # 系统级数据模型
│   ├── base.py              # 基础模型（继承自 infra.models.base）
│   ├── role.py              # 角色模型
│   ├── permission.py        # 权限模型
│   ├── role_permission.py   # 角色-权限关联模型
│   ├── user_role.py         # 用户-角色关联模型
│   ├── department.py        # 部门模型
│   └── position.py          # 职位模型
│
├── schemas/                  # 系统级数据验证（Pydantic Schema）
│   ├── role.py
│   ├── permission.py
│   ├── department.py
│   ├── position.py
│   └── user.py
│
├── services/                 # 系统级业务服务
│   ├── role_service.py
│   ├── permission_service.py
│   ├── department_service.py
│   ├── position_service.py
│   └── user_service.py
│
└── core/                     # 系统级核心功能
    ├── permissions/          # 权限验证核心
    │   ├── middleware.py    # 权限验证中间件
    │   ├── decorator.py     # 权限装饰器
    │   └── rbac.py          # RBAC 核心逻辑
    └── utils/                # 工具函数
        └── import_export.py # 导入导出工具
```

## 📋 功能列表

### ✅ 第一阶段：基础权限体系（建设中）

- 🚧 **角色权限管理**
  - 角色 CRUD
  - 权限查询和分配
  - 角色-权限关联
  - 用户-角色关联
  
- ⏳ **部门管理**
  - 部门树形结构管理
  - 部门 CRUD
  - 部门排序
  
- ⏳ **职位管理**
  - 职位 CRUD
  - 职位关联部门
  
- ⏳ **账户管理**
  - 账户 CRUD
  - 账户导入导出
  - 批量操作

## 🚀 使用方式

core 主要作为库被 `app` 导入使用。

在 `app` 中导入 core 的 API：

```python
from core.api import roles, permissions, departments, positions, users
```

## 📝 注意事项

1. **继承关系**：所有模型继承自 `core.models.base.BaseModel`，它继承自 `infra.models.base.BaseModel`
2. **多租户隔离**：所有查询必须自动过滤 `tenant_id`
3. **混合ID方案**：使用 `id`（自增ID）内部关联，`uuid`（UUID）对外暴露

---

**最后更新**：2025-01-XX

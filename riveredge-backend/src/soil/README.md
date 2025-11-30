# RiverEdge 平台后端 (soil)

**平台级后端基础设施和服务** - 面向平台运营和管理

## 🎯 职责范围

**平台级功能** - 平台整体运营和管理：
- ✅ 平台超级管理员管理
- ✅ 组织（租户）生命周期管理（创建、审核、暂停、恢复）
- ✅ 套餐配置和管理
- ✅ 平台整体监控和统计
- ✅ 多租户数据隔离基础设施

## 📁 目录结构

```
src/soil/
├── api/              # 平台级 API 路由
│   ├── auth/         # 平台超管认证 API
│   ├── tenants/      # 组织管理 API
│   ├── packages/     # 套餐管理 API
│   ├── platform_superadmin/  # 平台超管 API
│   ├── monitoring/   # 监控统计 API
│   └── deps/         # 依赖注入
├── services/         # 平台级业务服务
├── models/           # 平台级数据模型
│   ├── platform_superadmin.py  # 平台超管模型
│   ├── tenant.py               # 组织模型
│   ├── package.py              # 套餐模型
│   ├── user.py                 # 用户模型（平台管理 + 租户内用户）
│   └── tenant_activity_log.py  # 组织活动日志
├── schemas/          # 平台级数据验证
├── core/             # 平台级核心功能
│   ├── tenant_context.py       # 租户上下文管理
│   ├── query_filter.py         # 租户数据隔离
│   └── security/               # 平台级安全
├── config/           # 平台级配置管理
├── infrastructure/   # 基础设施（数据库、缓存、日志等）
└── exceptions/       # 异常定义
```

## 📋 功能列表

- ✅ **用户管理系统**
  - 平台管理（PlatformSuperAdmin模型）
  - 租户内用户（User模型，支持普通用户和组织管理员）
  - 用户认证和管理
- ✅ **组织生命周期管理**
  - 组织注册审核
  - 组织状态管理（激活/暂停/恢复）
  - 组织套餐分配
- ✅ **套餐管理系统**
  - 套餐配置管理
  - 套餐权限控制
- ✅ **平台监控统计**
  - 组织数据统计
  - 平台运行状态
  - 系统资源监控
- ✅ **多租户基础设施**
  - 租户上下文管理
  - 自动数据隔离
  - 跨租户权限控制

## 🚧 待添加功能

- ⏳ 系统运行状态监控 API（后续添加）
- ⏳ 系统资源使用监控 API（后续添加）
- ⏳ 插件管理 API（后续添加）

## 🚀 使用方式

soil 主要作为库被 `maintree` 导入使用，不提供独立的入口文件。

在 `maintree` 中导入 soil 的 API：

```python
from src.soil.api import auth, tenants, packages
```

## 📝 注意事项

1. **导入路径**：soil 已迁移到 `src/soil`，导入时使用 `from src.soil.xxx`
2. **内部导入**：soil 内部使用 `from soil.xxx` 的相对导入（需要确保 `src` 在 Python 路径中）
3. **依赖共享**：所有依赖在根目录 `pyproject.toml` 中统一管理

---

**最后更新**：2025-11-29


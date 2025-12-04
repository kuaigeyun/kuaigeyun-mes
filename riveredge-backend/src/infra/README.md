# RiverEdge 平台后端 (infra)

**平台级后端基础设施和服务** - 面向平台运营和管理

> ⚠️ **重要**：本模块已从 `platform` 重命名为 `infra`（infrastructure 的缩写），以避免与 Python 标准库的 `platform` 模块冲突，同时更清晰地表达其作为基础设施层的定位。

## 🎯 职责范围

**平台级功能** - 平台整体运营和管理：
- ✅ 平台超级管理员管理
- ✅ 组织（租户）生命周期管理（创建、审核、暂停、恢复）
- ✅ 套餐配置和管理
- ✅ 平台整体监控和统计
- ✅ 多租户数据隔离基础设施

## 📁 目录结构

```
src/infra/
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
├── domain/           # 平台级领域逻辑
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

infra 主要作为库被 `app` 导入使用，不提供独立的入口文件。

在 `app` 中导入 infra 的 API：

```python
from infra.api import auth, tenants, packages
```

## 📝 注意事项

1. **导入路径**：infra 位于 `src/infra`，导入时使用 `from infra.xxx`
2. **内部导入**：infra 内部使用 `from infra.xxx` 的相对导入（需要确保 `src` 在 Python 路径中）
3. **依赖共享**：所有依赖在根目录 `pyproject.toml` 中统一管理
4. **命名说明**：为避免与 Python 标准库的 `platform` 模块冲突，本模块使用 `infra`（infrastructure 的缩写）作为包名，更清晰地表达其作为基础设施层的定位

---

**最后更新**：2025-12-04（重命名为 infra）


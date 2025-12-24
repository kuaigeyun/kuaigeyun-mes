# 私有化部署与 SaaS 版本同步方案

## 📋 概述

RiverEdge SaaS 多组织框架需要同时支持：
1. **SaaS 化运营**：多租户共享同一套代码和数据库
2. **私有化部署**：客户独立部署，可能需要定制化

**核心挑战**：
- 如何保持私有化部署版本与 SaaS 主版本功能同步？
- 如何处理私有化部署的定制化需求？
- 如何管理代码分支和版本发布？
- 如何同步数据库迁移？

---

## 🎯 设计原则

### 1. 单一代码库（Single Source of Truth）
- ✅ **主代码库**：所有功能在主分支（`main`/`develop`）开发
- ✅ **统一架构**：SaaS 和私有化部署使用相同的代码架构
- ✅ **配置驱动**：通过配置区分 SaaS 和私有化部署模式

### 2. 配置隔离，代码统一
- ✅ **配置分离**：SaaS 和私有化部署通过环境变量/配置文件区分
- ✅ **代码统一**：核心业务逻辑代码完全一致
- ✅ **定制化隔离**：定制化功能通过插件机制或独立模块实现

### 3. 版本同步策略
- ✅ **语义化版本**：使用语义化版本控制（Semantic Versioning）
- ✅ **定期同步**：私有化部署定期从主版本拉取更新
- ✅ **迁移兼容**：数据库迁移向后兼容，支持增量更新

### 4. 定制化支持
- ✅ **插件机制**：定制化功能通过插件实现，不修改核心代码
- ✅ **配置覆盖**：支持通过配置文件覆盖默认行为
- ✅ **扩展点**：提供扩展点支持定制化需求

---

## 🏗️ Git 分支策略

### 分支结构

```
main (生产分支)
├── develop (开发分支)
│   ├── feature/* (功能分支)
│   └── fix/* (修复分支)
├── release/* (发布分支)
│   ├── release/v1.0.0 (SaaS 发布)
│   └── release/v1.0.0-private (私有化发布)
└── private/* (私有化定制分支)
    ├── private/client-a (客户 A 定制)
    └── private/client-b (客户 B 定制)
```

### 分支说明

#### 1. `main` 分支（生产分支）
- **用途**：SaaS 生产环境代码
- **保护**：只能通过 `release/*` 分支合并
- **版本标签**：每个发布打上版本标签（如 `v1.0.0`）

#### 2. `develop` 分支（开发分支）
- **用途**：日常开发分支
- **来源**：从 `main` 分支创建
- **合并**：功能分支合并到 `develop`，测试通过后合并到 `main`

#### 3. `release/*` 分支（发布分支）
- **用途**：准备发布的版本
- **命名**：`release/v1.0.0`（SaaS）或 `release/v1.0.0-private`（私有化）
- **生命周期**：发布完成后删除

#### 4. `private/*` 分支（私有化定制分支）
- **用途**：客户定制化代码
- **命名**：`private/client-a`（客户 A 的定制）
- **策略**：定期从 `main` 分支合并更新
- **隔离**：定制化代码不合并回主分支

---

## 🔄 版本同步流程

### SaaS 版本发布流程

```
1. 开发阶段
   develop → feature/* → develop

2. 测试阶段
   develop → release/v1.0.0 → 测试 → 修复

3. 发布阶段
   release/v1.0.0 → main → 打标签 v1.0.0

4. 部署阶段
   main → SaaS 生产环境
```

### 私有化部署同步流程

```
1. 初始部署
   main (v1.0.0) → private/client-a (初始版本)

2. 定制化开发
   private/client-a → feature/custom-* → private/client-a

3. 主版本更新
   main (v1.1.0) → private/client-a (合并更新)

4. 冲突解决
   - 自动合并：无冲突的更新自动合并
   - 手动解决：定制化代码与主版本冲突时手动解决

5. 测试部署
   private/client-a → 私有化测试环境 → 生产环境
```

### 同步策略

#### 策略 1：定期同步（推荐）
- **频率**：每月或每季度同步一次
- **方式**：从 `main` 分支合并到 `private/*` 分支
- **优势**：保持功能同步，减少冲突
- **适用**：大多数私有化部署

#### 策略 2：按需同步
- **触发**：客户主动请求更新
- **方式**：从指定版本标签合并
- **优势**：客户可控，减少不必要的更新
- **适用**：对稳定性要求高的客户

#### 策略 3：LTS 版本同步
- **定义**：长期支持版本（Long Term Support）
- **方式**：只同步 LTS 版本（如 v1.0.0, v2.0.0）
- **优势**：稳定性高，更新频率低
- **适用**：对稳定性要求极高的客户

---

## 🔧 配置管理策略

### 配置层级

```
1. 平台级配置（platform_config.py）
   - 数据库连接
   - Redis 连接
   - JWT 配置
   - 服务器配置

2. 系统级配置（system_parameters）
   - 站点设置
   - 参数设置
   - 功能开关

3. 租户级配置（tenant_config）
   - 组织设置
   - 组织参数
   - 组织功能开关
```

### SaaS vs 私有化部署配置差异

#### 1. 部署模式标识

```python
# platform_config.py
class PlatformSettings(BaseSettings):
    # 部署模式：'saas' 或 'private'
    DEPLOYMENT_MODE: str = Field(default="saas", description="部署模式")
    
    # SaaS 模式特有配置
    SAAS_MULTI_TENANT: bool = Field(default=True, description="是否多租户模式")
    SAAS_TENANT_REGISTRATION: bool = Field(default=True, description="是否允许租户注册")
    
    # 私有化部署特有配置
    PRIVATE_SINGLE_TENANT: bool = Field(default=False, description="是否单租户模式")
    PRIVATE_TENANT_ID: int = Field(default=1, description="私有化部署的租户ID")
```

#### 2. 功能开关（Feature Flags）

```python
# core/services/feature_flag_service.py
class FeatureFlagService:
    """功能开关服务"""
    
    @staticmethod
    async def is_feature_enabled(
        feature_name: str,
        tenant_id: Optional[int] = None
    ) -> bool:
        """
        检查功能是否启用
        
        Args:
            feature_name: 功能名称
            tenant_id: 租户ID（可选）
        
        Returns:
            bool: 功能是否启用
        """
        # 1. 检查平台级配置
        platform_config = await SystemParameterService.get_parameter(
            f"feature.{feature_name}.enabled"
        )
        if platform_config is not None:
            return platform_config.value == "true"
        
        # 2. 检查租户级配置（SaaS 模式）
        if tenant_id:
            tenant_config = await TenantConfigService.get_config(
                tenant_id, f"feature.{feature_name}.enabled"
            )
            if tenant_config is not None:
                return tenant_config.value == "true"
        
        # 3. 默认值（根据部署模式）
        from infra.config.platform_config import platform_settings
        if platform_settings.DEPLOYMENT_MODE == "private":
            # 私有化部署默认启用所有功能
            return True
        else:
            # SaaS 模式根据功能定义返回默认值
            return self._get_default_feature_value(feature_name)
```

#### 3. 环境变量配置

```bash
# .env.saas (SaaS 部署)
DEPLOYMENT_MODE=saas
SAAS_MULTI_TENANT=true
SAAS_TENANT_REGISTRATION=true

# .env.private (私有化部署)
DEPLOYMENT_MODE=private
PRIVATE_SINGLE_TENANT=true
PRIVATE_TENANT_ID=1
SAAS_TENANT_REGISTRATION=false
```

---

## 📦 数据库迁移同步

### 迁移文件管理

#### 1. 统一迁移文件
- ✅ **所有迁移文件**：存储在 `migrations/models/` 目录
- ✅ **版本控制**：迁移文件通过 Git 版本控制
- ✅ **命名规范**：`{序号}_{时间戳}_{描述}.py`

#### 2. 迁移同步策略

```python
# 迁移文件示例
# migrations/models/33_20251212000000_add_custom_field.py

async def upgrade():
    """
    升级迁移
    
    执行顺序：
    1. 检查迁移是否已执行（通过 aerich_version 表）
    2. 执行 SQL 语句
    3. 记录迁移版本
    """
    # 检查是否已执行
    # 执行迁移 SQL
    # 记录版本
    pass

async def downgrade():
    """
    降级迁移（可选）
    
    用于回滚迁移
    """
    pass
```

#### 3. 迁移执行流程

**SaaS 环境**：
```bash
# 自动执行（通过 CI/CD）
aerich upgrade
```

**私有化部署**：
```bash
# 手动执行（客户执行）
aerich upgrade

# 或通过更新脚本
python scripts/apply_migrations.py --version v1.1.0
```

#### 4. 迁移兼容性

- ✅ **向后兼容**：新迁移不能破坏现有数据
- ✅ **增量更新**：支持从任意版本升级到最新版本
- ✅ **回滚支持**：提供降级迁移（可选）

---

## 🎨 定制化支持

### 1. 插件机制（推荐）

```python
# 定制化功能通过插件实现
# apps/custom/client-a-plugin/
├── __init__.py
├── manifest.json
├── api/
│   └── custom_api.py
├── models/
│   └── custom_model.py
└── services/
    └── custom_service.py
```

**优势**：
- ✅ 不修改核心代码
- ✅ 易于维护和更新
- ✅ 支持热插拔

### 2. 配置覆盖

```python
# 通过配置文件覆盖默认行为
# config/custom/client-a-config.py

CUSTOM_CONFIG = {
    "theme": {
        "primary_color": "#1890ff",
        "logo_url": "/custom/logo.png"
    },
    "features": {
        "custom_report": True,
        "custom_dashboard": True
    }
}
```

### 3. 扩展点（Extension Points）

```python
# core/utils/extension_points.py

class ExtensionPoint:
    """扩展点基类"""
    
    @staticmethod
    async def before_user_create(user_data: dict) -> dict:
        """
        用户创建前的扩展点
        
        Returns:
            dict: 修改后的用户数据
        """
        return user_data
    
    @staticmethod
    async def after_user_create(user: User) -> None:
        """
        用户创建后的扩展点
        """
        pass
```

**使用方式**：
```python
# apps/custom/client-a-plugin/hooks.py
from core.utils.extension_points import ExtensionPoint

class ClientAHooks(ExtensionPoint):
    @staticmethod
    async def before_user_create(user_data: dict) -> dict:
        # 定制化逻辑
        user_data["custom_field"] = "custom_value"
        return user_data
```

---

## 📊 版本管理

### 语义化版本控制

```
主版本号.次版本号.修订号[-预发布标识][+构建元数据]

示例：
- v1.0.0：正式发布
- v1.1.0：新功能
- v1.1.1：Bug 修复
- v1.2.0-beta.1：Beta 版本
- v1.2.0-rc.1：候选版本
```

### 版本发布流程

#### 1. 版本规划
- **主版本**（v1.0.0 → v2.0.0）：不兼容的 API 变更
- **次版本**（v1.0.0 → v1.1.0）：新功能，向后兼容
- **修订版本**（v1.0.0 → v1.0.1）：Bug 修复，向后兼容

#### 2. 发布检查清单

```
□ 代码审查完成
□ 单元测试通过
□ 集成测试通过
□ 数据库迁移测试通过
□ 文档更新完成
□ 版本号更新
□ CHANGELOG 更新
□ 发布分支创建
□ 版本标签创建
```

#### 3. 发布脚本

```bash
# scripts/release.sh
#!/bin/bash

VERSION=$1
BRANCH="release/v${VERSION}"

# 1. 创建发布分支
git checkout -b ${BRANCH}

# 2. 更新版本号
# 更新 pyproject.toml、package.json 等

# 3. 更新 CHANGELOG
# 自动生成或手动更新

# 4. 提交更改
git add .
git commit -m "chore: release v${VERSION}"

# 5. 合并到 main
git checkout main
git merge ${BRANCH}

# 6. 打标签
git tag -a v${VERSION} -m "Release v${VERSION}"

# 7. 推送到远程
git push origin main
git push origin v${VERSION}

# 8. 删除发布分支
git branch -d ${BRANCH}
```

---

## 🔄 同步工具和脚本

### 1. 版本同步脚本

```python
# scripts/sync_private_deployment.py
"""
私有化部署版本同步脚本

功能：
1. 从主版本拉取更新
2. 自动合并到私有化分支
3. 检测冲突
4. 生成同步报告
"""

import subprocess
import sys
from pathlib import Path

def sync_private_deployment(
    private_branch: str,
    main_version: str = "main"
):
    """
    同步私有化部署版本
    
    Args:
        private_branch: 私有化分支名称（如 'private/client-a'）
        main_version: 主版本分支或标签（如 'main' 或 'v1.1.0'）
    """
    # 1. 切换到私有化分支
    subprocess.run(["git", "checkout", private_branch])
    
    # 2. 拉取最新代码
    subprocess.run(["git", "fetch", "origin"])
    
    # 3. 合并主版本
    result = subprocess.run(
        ["git", "merge", f"origin/{main_version}"],
        capture_output=True,
        text=True
    )
    
    # 4. 检查冲突
    if "CONFLICT" in result.stdout:
        print(f"❌ 检测到冲突，需要手动解决")
        print(f"冲突文件：")
        # 解析冲突文件
        return False
    else:
        print(f"✅ 同步成功")
        return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python sync_private_deployment.py <private_branch> [main_version]")
        sys.exit(1)
    
    private_branch = sys.argv[1]
    main_version = sys.argv[2] if len(sys.argv) > 2 else "main"
    
    sync_private_deployment(private_branch, main_version)
```

### 2. 迁移检查脚本

```python
# scripts/check_migration_status.py
"""
检查数据库迁移状态

功能：
1. 检查当前数据库版本
2. 检查可用迁移文件
3. 生成迁移报告
"""

import asyncio
from tortoise import Tortoise
from aerich import Command

async def check_migration_status():
    """检查迁移状态"""
    # 初始化数据库连接
    await Tortoise.init(
        db_url="postgres://...",
        modules={"models": ["infra.models", "core.models"]}
    )
    
    # 获取 Aerich 命令
    command = Command(
        tortoise_config={
            "connections": {...},
            "apps": {...}
        }
    )
    
    # 检查迁移状态
    status = await command.status()
    print(f"当前数据库版本：{status.current_version}")
    print(f"可用迁移：{status.available_migrations}")
    
    # 生成迁移报告
    if status.available_migrations:
        print(f"\n需要执行的迁移：")
        for migration in status.available_migrations:
            print(f"  - {migration}")

if __name__ == "__main__":
    asyncio.run(check_migration_status())
```

### 3. 配置对比脚本

```python
# scripts/compare_configs.py
"""
对比 SaaS 和私有化部署配置差异

功能：
1. 对比配置文件差异
2. 生成配置迁移指南
3. 检查配置兼容性
"""

def compare_configs(saas_config_path: str, private_config_path: str):
    """对比配置差异"""
    # 读取配置文件
    saas_config = load_config(saas_config_path)
    private_config = load_config(private_config_path)
    
    # 对比差异
    differences = find_differences(saas_config, private_config)
    
    # 生成报告
    print("配置差异：")
    for key, (saas_value, private_value) in differences.items():
        print(f"  {key}:")
        print(f"    SaaS: {saas_value}")
        print(f"    私有化: {private_value}")
    
    return differences
```

---

## 📋 实施建议

### 阶段一：基础设置（1-2 周）

1. **Git 分支策略**
   - [ ] 创建 `main` 和 `develop` 分支
   - [ ] 设置分支保护规则
   - [ ] 配置 CI/CD 流程

2. **配置管理**
   - [ ] 添加 `DEPLOYMENT_MODE` 配置
   - [ ] 实现功能开关服务
   - [ ] 创建配置模板（`.env.saas`, `.env.private`）

3. **版本管理**
   - [ ] 设置语义化版本控制
   - [ ] 创建版本发布脚本
   - [ ] 配置版本标签自动化

### 阶段二：同步机制（2-3 周）

1. **同步工具**
   - [ ] 开发版本同步脚本
   - [ ] 开发迁移检查脚本
   - [ ] 开发配置对比脚本

2. **文档和指南**
   - [ ] 编写同步操作指南
   - [ ] 编写冲突解决指南
   - [ ] 编写定制化开发指南

3. **测试验证**
   - [ ] 测试版本同步流程
   - [ ] 测试迁移同步流程
   - [ ] 测试冲突解决流程

### 阶段三：定制化支持（2-3 周）

1. **插件机制**
   - [ ] 完善插件加载机制
   - [ ] 实现扩展点系统
   - [ ] 创建插件开发模板

2. **配置覆盖**
   - [ ] 实现配置覆盖机制
   - [ ] 创建配置模板
   - [ ] 编写配置文档

3. **定制化指南**
   - [ ] 编写定制化开发指南
   - [ ] 创建定制化示例
   - [ ] 提供技术支持流程

---

## 🎯 最佳实践

### 1. 代码管理
- ✅ **单一代码库**：所有代码在主代码库管理
- ✅ **分支隔离**：定制化代码在独立分支
- ✅ **定期同步**：私有化分支定期从主分支合并

### 2. 配置管理
- ✅ **环境变量**：使用环境变量区分部署模式
- ✅ **配置模板**：提供配置模板和示例
- ✅ **配置验证**：启动时验证配置完整性

### 3. 版本发布
- ✅ **语义化版本**：使用语义化版本控制
- ✅ **发布检查**：严格执行发布检查清单
- ✅ **版本文档**：每个版本提供详细的 CHANGELOG

### 4. 定制化开发
- ✅ **插件优先**：优先使用插件机制实现定制化
- ✅ **扩展点**：通过扩展点支持定制化需求
- ✅ **代码隔离**：定制化代码不污染核心代码

### 5. 技术支持
- ✅ **同步指南**：提供详细的同步操作指南
- ✅ **冲突解决**：提供冲突解决最佳实践
- ✅ **技术支持**：建立技术支持流程和渠道

---

## 📚 相关文档

- [Git 工作流规范](../2.rules/8.Git工作流规范.md)
- [数据库命名规范](../2.rules/3.数据库命名规范.md)
- [API 设计规范](../2.rules/6.API设计规范.md)
- [插件加载机制优化方案](../4.features/插件加载机制优化方案.md)

---

## ✅ 总结

本方案通过以下方式解决私有化部署与 SaaS 版本同步问题：

1. **单一代码库**：所有功能在主代码库开发，保持代码统一
2. **配置驱动**：通过配置区分 SaaS 和私有化部署模式
3. **分支策略**：使用 Git 分支管理不同部署版本
4. **定期同步**：私有化部署定期从主版本拉取更新
5. **定制化隔离**：定制化功能通过插件机制实现，不修改核心代码
6. **版本管理**：使用语义化版本控制和发布流程

**核心优势**：
- ✅ 代码统一，易于维护
- ✅ 功能同步，减少重复开发
- ✅ 定制化隔离，不影响核心代码
- ✅ 版本可控，支持灵活更新策略

---

## 🌐 前端版本管理功能

### 功能概述

为私有化部署提供前端 WEB 界面，让用户可以在浏览器中：
- ✅ 查看当前版本信息
- ✅ 检查可用版本更新
- ✅ 查看版本更新内容（CHANGELOG）
- ✅ 一键触发版本升级
- ✅ 查看升级进度和日志
- ✅ 升级前自动备份

### 功能设计

#### 1. 后端 API 设计

```python
# infra/api/version_management/version_management.py
"""
版本管理 API

提供版本检查、版本信息、版本升级等功能
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.domain.security.platform_superadmin_security import require_platform_superadmin

router = APIRouter(prefix="/api/v1/infra/version", tags=["Version Management"])


class VersionInfo(BaseModel):
    """版本信息"""
    version: str = Field(..., description="版本号")
    release_date: datetime = Field(..., description="发布日期")
    changelog: str = Field(..., description="更新日志")
    is_lts: bool = Field(default=False, description="是否为长期支持版本")
    is_prerelease: bool = Field(default=False, description="是否为预发布版本")


class CurrentVersionResponse(BaseModel):
    """当前版本响应"""
    current_version: str = Field(..., description="当前版本号")
    deployment_mode: str = Field(..., description="部署模式（saas/private）")
    last_update_date: Optional[datetime] = Field(None, description="最后更新时间")


class AvailableVersionsResponse(BaseModel):
    """可用版本响应"""
    available_versions: List[VersionInfo] = Field(..., description="可用版本列表")
    latest_version: str = Field(..., description="最新版本号")
    has_update: bool = Field(..., description="是否有更新")


class UpgradeRequest(BaseModel):
    """升级请求"""
    target_version: str = Field(..., description="目标版本号")
    auto_backup: bool = Field(default=True, description="是否自动备份")
    skip_migration: bool = Field(default=False, description="是否跳过数据库迁移")


class UpgradeResponse(BaseModel):
    """升级响应"""
    upgrade_id: str = Field(..., description="升级任务ID")
    status: str = Field(..., description="升级状态（pending/running/completed/failed）")
    message: str = Field(..., description="升级消息")


@router.get("/current", response_model=CurrentVersionResponse)
async def get_current_version(
    current_user: User = Depends(get_current_user),
):
    """
    获取当前版本信息
    
    所有用户都可以查看当前版本
    """
    from infra.config.platform_config import platform_settings
    
    return CurrentVersionResponse(
        current_version=platform_settings.APP_VERSION,
        deployment_mode=platform_settings.DEPLOYMENT_MODE,
        last_update_date=None,  # 从数据库或配置文件读取
    )


@router.get("/available", response_model=AvailableVersionsResponse)
async def get_available_versions(
    current_user: User = Depends(require_platform_superadmin),
):
    """
    获取可用版本列表
    
    需要平台超级管理员权限
    """
    # 从 Git 仓库或版本服务器获取可用版本
    # 这里需要实现版本检查逻辑
    available_versions = await check_available_versions()
    
    from infra.config.platform_config import platform_settings
    current_version = platform_settings.APP_VERSION
    
    latest_version = available_versions[0].version if available_versions else current_version
    has_update = compare_versions(latest_version, current_version) > 0
    
    return AvailableVersionsResponse(
        available_versions=available_versions,
        latest_version=latest_version,
        has_update=has_update,
    )


@router.get("/{version}", response_model=VersionInfo)
async def get_version_info(
    version: str,
    current_user: User = Depends(require_platform_superadmin),
):
    """
    获取指定版本的详细信息
    
    需要平台超级管理员权限
    """
    version_info = await get_version_details(version)
    if not version_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"版本 {version} 不存在"
        )
    return version_info


@router.post("/upgrade", response_model=UpgradeResponse)
async def upgrade_version(
    request: UpgradeRequest,
    current_user: User = Depends(require_platform_superadmin),
):
    """
    执行版本升级
    
    需要平台超级管理员权限
    升级过程：
    1. 检查目标版本是否可用
    2. 自动备份（如果启用）
    3. 下载更新文件
    4. 执行数据库迁移
    5. 更新代码
    6. 重启服务（可选）
    """
    # 检查目标版本
    available_versions = await check_available_versions()
    target_version_info = next(
        (v for v in available_versions if v.version == request.target_version),
        None
    )
    if not target_version_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"版本 {request.target_version} 不可用"
        )
    
    # 创建升级任务
    upgrade_id = await create_upgrade_task(
        target_version=request.target_version,
        auto_backup=request.auto_backup,
        skip_migration=request.skip_migration,
        user_id=current_user.id,
    )
    
    # 异步执行升级（使用 Inngest 或后台任务）
    await trigger_upgrade_task(upgrade_id)
    
    return UpgradeResponse(
        upgrade_id=upgrade_id,
        status="pending",
        message="升级任务已创建，正在执行..."
    )


@router.get("/upgrade/{upgrade_id}", response_model=UpgradeResponse)
async def get_upgrade_status(
    upgrade_id: str,
    current_user: User = Depends(require_platform_superadmin),
):
    """
    获取升级任务状态
    
    需要平台超级管理员权限
    """
    upgrade_status = await get_upgrade_task_status(upgrade_id)
    if not upgrade_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"升级任务 {upgrade_id} 不存在"
        )
    return upgrade_status


@router.post("/upgrade/{upgrade_id}/cancel")
async def cancel_upgrade(
    upgrade_id: str,
    current_user: User = Depends(require_platform_superadmin),
):
    """
    取消升级任务
    
    需要平台超级管理员权限
    只能在升级任务处于 pending 或 running 状态时取消
    """
    success = await cancel_upgrade_task(upgrade_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无法取消升级任务（可能已完成或失败）"
        )
    return {"message": "升级任务已取消"}


# 辅助函数（需要实现）

async def check_available_versions() -> List[VersionInfo]:
    """
    检查可用版本
    
    从 Git 仓库或版本服务器获取可用版本列表
    """
    # 实现版本检查逻辑
    # 可以从 Git 标签、版本服务器 API、或配置文件读取
    pass


async def get_version_details(version: str) -> Optional[VersionInfo]:
    """
    获取版本详细信息
    
    包括 CHANGELOG、发布日期等
    """
    # 实现版本详情获取逻辑
    # 可以从 CHANGELOG.md、Git 标签信息、或版本服务器获取
    pass


def compare_versions(version1: str, version2: str) -> int:
    """
    比较两个版本号
    
    Returns:
        int: 1 if version1 > version2, -1 if version1 < version2, 0 if equal
    """
    # 实现版本号比较逻辑
    pass


async def create_upgrade_task(
    target_version: str,
    auto_backup: bool,
    skip_migration: bool,
    user_id: int,
) -> str:
    """
    创建升级任务
    
    Returns:
        str: 升级任务ID
    """
    # 实现升级任务创建逻辑
    pass


async def trigger_upgrade_task(upgrade_id: str) -> None:
    """
    触发升级任务执行
    
    使用 Inngest 或后台任务异步执行
    """
    # 实现升级任务触发逻辑
    pass


async def get_upgrade_task_status(upgrade_id: str) -> Optional[UpgradeResponse]:
    """
    获取升级任务状态
    """
    # 实现升级任务状态查询逻辑
    pass


async def cancel_upgrade_task(upgrade_id: str) -> bool:
    """
    取消升级任务
    """
    # 实现升级任务取消逻辑
    pass
```

#### 2. 前端页面设计

```typescript
// riveredge-frontend/src/pages/system/version-management/index.tsx
/**
 * 版本管理页面
 * 
 * 功能：
 * 1. 显示当前版本信息
 * 2. 检查可用版本更新
 * 3. 查看版本更新内容（CHANGELOG）
 * 4. 一键触发版本升级
 * 5. 查看升级进度和日志
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Space,
  Button,
  Tag,
  Alert,
  Descriptions,
  List,
  Modal,
  Progress,
  Steps,
  message,
  Divider,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { VersionInfo, CurrentVersionResponse, AvailableVersionsResponse } from '@/services/versionManagement';

const { Title, Text, Paragraph } = Typography;

const VersionManagementPage: React.FC = () => {
  const [selectedVersion, setSelectedVersion] = useState<VersionInfo | null>(null);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [upgradeProgress, setUpgradeProgress] = useState(0);
  const queryClient = useQueryClient();

  // 获取当前版本
  const { data: currentVersion, isLoading: currentVersionLoading } = useQuery({
    queryKey: ['version', 'current'],
    queryFn: async () => {
      const response = await fetch('/api/v1/infra/version/current', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('获取当前版本失败');
      return response.json() as Promise<CurrentVersionResponse>;
    },
  });

  // 获取可用版本
  const { data: availableVersions, isLoading: availableVersionsLoading } = useQuery({
    queryKey: ['version', 'available'],
    queryFn: async () => {
      const response = await fetch('/api/v1/infra/version/available', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('获取可用版本失败');
      return response.json() as Promise<AvailableVersionsResponse>;
    },
    enabled: !!currentVersion, // 只有在获取到当前版本后才获取可用版本
  });

  // 升级版本
  const upgradeMutation = useMutation({
    mutationFn: async (targetVersion: string) => {
      const response = await fetch('/api/v1/infra/version/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          target_version: targetVersion,
          auto_backup: true,
          skip_migration: false,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || '升级失败');
      }
      return response.json();
    },
    onSuccess: (data) => {
      message.success('升级任务已创建，正在执行...');
      setUpgradeModalVisible(true);
      // 开始轮询升级状态
      pollUpgradeStatus(data.upgrade_id);
    },
    onError: (error: Error) => {
      message.error(error.message || '升级失败');
    },
  });

  // 轮询升级状态
  const pollUpgradeStatus = async (upgradeId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/infra/version/upgrade/${upgradeId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!response.ok) throw new Error('获取升级状态失败');
        const data = await response.json();
        
        // 更新进度（根据升级状态估算）
        if (data.status === 'running') {
          setUpgradeProgress((prev) => Math.min(prev + 10, 90));
        } else if (data.status === 'completed') {
          setUpgradeProgress(100);
          clearInterval(interval);
          message.success('升级完成！');
          queryClient.invalidateQueries({ queryKey: ['version'] });
          setTimeout(() => {
            setUpgradeModalVisible(false);
            message.info('系统将在 5 秒后刷新页面');
            setTimeout(() => window.location.reload(), 5000);
          }, 2000);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          message.error(`升级失败：${data.message}`);
        }
      } catch (error) {
        console.error('获取升级状态失败:', error);
      }
    }, 2000); // 每 2 秒轮询一次
  };

  // 处理升级确认
  const handleUpgrade = () => {
    if (!selectedVersion) return;
    upgradeMutation.mutate(selectedVersion.version);
  };

  // 查看版本详情
  const handleViewVersionDetails = async (version: string) => {
    try {
      const response = await fetch(`/api/v1/infra/version/${version}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('获取版本详情失败');
      const versionInfo = await response.json() as VersionInfo;
      setSelectedVersion(versionInfo);
      setUpgradeModalVisible(true);
    } catch (error) {
      message.error('获取版本详情失败');
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>版本管理</Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 当前版本信息 */}
        <ProCard title="当前版本" loading={currentVersionLoading}>
          {currentVersion && (
            <Descriptions column={2}>
              <Descriptions.Item label="版本号">
                <Tag color="blue" style={{ fontSize: '16px', padding: '4px 12px' }}>
                  {currentVersion.current_version}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="部署模式">
                <Tag color={currentVersion.deployment_mode === 'private' ? 'green' : 'orange'}>
                  {currentVersion.deployment_mode === 'private' ? '私有化部署' : 'SaaS 部署'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="最后更新时间">
                {currentVersion.last_update_date
                  ? new Date(currentVersion.last_update_date).toLocaleString('zh-CN')
                  : '未知'}
              </Descriptions.Item>
            </Descriptions>
          )}
        </ProCard>

        {/* 可用版本更新 */}
        <ProCard
          title="可用版本"
          loading={availableVersionsLoading}
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['version', 'available'] })}
            >
              刷新
            </Button>
          }
        >
          {availableVersions && (
            <>
              {availableVersions.has_update ? (
                <Alert
                  message="发现新版本"
                  description={`最新版本：${availableVersions.latest_version}，当前版本：${currentVersion?.current_version}`}
                  type="info"
                  showIcon
                  icon={<InfoCircleOutlined />}
                  style={{ marginBottom: 16 }}
                />
              ) : (
                <Alert
                  message="已是最新版本"
                  description="当前版本已是最新版本，无需更新"
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  style={{ marginBottom: 16 }}
                />
              )}

              <List
                dataSource={availableVersions.available_versions}
                renderItem={(version) => (
                  <List.Item
                    actions={[
                      <Button
                        key="view"
                        type="link"
                        onClick={() => handleViewVersionDetails(version.version)}
                      >
                        查看详情
                      </Button>,
                      <Button
                        key="upgrade"
                        type="primary"
                        icon={<DownloadOutlined />}
                        disabled={
                          !availableVersions.has_update ||
                          version.version === currentVersion?.current_version
                        }
                        onClick={() => handleViewVersionDetails(version.version)}
                      >
                        升级到此版本
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color="blue">{version.version}</Tag>
                          {version.is_lts && <Tag color="green">LTS</Tag>}
                          {version.is_prerelease && <Tag color="orange">预发布</Tag>}
                          {version.version === availableVersions.latest_version && (
                            <Tag color="red">最新</Tag>
                          )}
                        </Space>
                      }
                      description={
                        <div>
                          <Text type="secondary">
                            发布日期：{new Date(version.release_date).toLocaleDateString('zh-CN')}
                          </Text>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </>
          )}
        </ProCard>
      </Space>

      {/* 升级确认对话框 */}
      <Modal
        title="版本升级确认"
        open={upgradeModalVisible}
        onCancel={() => {
          if (upgradeProgress < 100) {
            Modal.confirm({
              title: '确认取消升级？',
              content: '升级正在进行中，取消可能导致系统不稳定',
              onOk: () => {
                setUpgradeModalVisible(false);
                setUpgradeProgress(0);
              },
            });
          } else {
            setUpgradeModalVisible(false);
            setUpgradeProgress(0);
          }
        }}
        footer={null}
        width={800}
      >
        {selectedVersion && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 版本信息 */}
            <Descriptions column={2} bordered>
              <Descriptions.Item label="当前版本">
                <Tag color="blue">{currentVersion?.current_version}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="目标版本">
                <Tag color="green">{selectedVersion.version}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="发布日期" span={2}>
                {new Date(selectedVersion.release_date).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="版本类型" span={2}>
                <Space>
                  {selectedVersion.is_lts && <Tag color="green">长期支持版本 (LTS)</Tag>}
                  {selectedVersion.is_prerelease && <Tag color="orange">预发布版本</Tag>}
                </Space>
              </Descriptions.Item>
            </Descriptions>

            {/* 更新日志 */}
            <div>
              <Title level={5}>更新内容</Title>
              <div
                style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  padding: '12px',
                  background: '#f5f5f5',
                  borderRadius: '4px',
                }}
              >
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                  {selectedVersion.changelog}
                </pre>
              </div>
            </div>

            {/* 升级进度 */}
            {upgradeProgress > 0 && (
              <div>
                <Divider />
                <Title level={5}>升级进度</Title>
                <Progress percent={upgradeProgress} status="active" />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  升级正在进行中，请勿关闭此窗口...
                </Text>
              </div>
            )}

            {/* 升级提示 */}
            <Alert
              message="升级提示"
              description={
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>升级前系统将自动备份数据库和配置文件</li>
                  <li>升级过程中系统可能会短暂不可用</li>
                  <li>升级完成后系统将自动重启</li>
                  <li>建议在业务低峰期进行升级</li>
                </ul>
              }
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
            />

            {/* 操作按钮 */}
            {upgradeProgress === 0 && (
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <Space>
                  <Button onClick={() => setUpgradeModalVisible(false)}>取消</Button>
                  <Button
                    type="primary"
                    loading={upgradeMutation.isPending}
                    onClick={handleUpgrade}
                  >
                    确认升级
                  </Button>
                </Space>
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default VersionManagementPage;
```

#### 3. 路由配置

```typescript
// riveredge-frontend/src/routes/index.tsx
// 在系统管理路由中添加版本管理页面

import VersionManagementPage from '../pages/system/version-management';

// 在路由配置中添加
<Route
  path="/system/version-management"
  element={
    <LayoutWrapper>
      <VersionManagementPage />
    </LayoutWrapper>
  }
/>
```

#### 4. 菜单配置

```typescript
// 在系统管理菜单中添加版本管理菜单项
{
  key: 'version-management',
  label: '版本管理',
  path: '/system/version-management',
  icon: <DownloadOutlined />,
  permission: 'infra:version:manage', // 需要平台超级管理员权限
}
```

### 安全考虑

1. **权限控制**
   - ✅ 只有平台超级管理员可以查看可用版本和升级
   - ✅ 普通用户可以查看当前版本信息

2. **升级前检查**
   - ✅ 检查目标版本是否可用
   - ✅ 检查当前系统状态（是否有正在运行的任务）
   - ✅ 检查磁盘空间和数据库连接

3. **升级过程**
   - ✅ 自动备份数据库和配置文件
   - ✅ 升级过程可中断（在安全点）
   - ✅ 升级失败自动回滚

4. **升级后验证**
   - ✅ 验证升级是否成功
   - ✅ 检查系统功能是否正常
   - ✅ 提供回滚选项

### 实施建议

1. **阶段一：基础功能（1-2 周）**
   - [ ] 实现版本检查 API
   - [ ] 实现版本信息获取 API
   - [ ] 创建前端版本管理页面
   - [ ] 添加菜单和路由

2. **阶段二：升级功能（2-3 周）**
   - [ ] 实现升级任务创建和执行
   - [ ] 实现升级进度跟踪
   - [ ] 实现自动备份功能
   - [ ] 实现升级日志记录

3. **阶段三：优化和完善（1-2 周）**
   - [ ] 优化升级流程
   - [ ] 添加升级前检查
   - [ ] 实现升级回滚功能
   - [ ] 完善错误处理和提示

---

**最后更新**：2025-01-11


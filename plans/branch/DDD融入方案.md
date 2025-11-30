# RiverEdge SaaS 多组织框架 - DDD 融入方案

## 📋 概述

本文档提供将 **领域驱动设计（Domain-Driven Design, DDD）** 思想融入 **RiverEdge SaaS 多组织框架** 的渐进式方案。

**创建日期**：2025-01-XX

## 🎯 DDD 核心概念

### 1. 领域（Domain）
业务领域，包含业务规则和逻辑。

### 2. 实体（Entity）
有唯一标识的对象，如 `User`、`Tenant`、`Role`。

### 3. 值对象（Value Object）
没有唯一标识的对象，如 `Email`、`Password`、`Address`。

### 4. 聚合（Aggregate）
一组相关对象的集合，有明确的边界。

### 5. 聚合根（Aggregate Root）
聚合的入口，负责维护聚合的一致性。

### 6. 领域服务（Domain Service）
跨实体的业务逻辑，不适合放在单个实体中。

### 7. 仓储（Repository）
数据访问抽象，隔离领域模型和持久化技术。

### 8. 应用服务（Application Service）
协调领域对象，处理用例流程。

### 9. 领域事件（Domain Event）
领域内发生的重要事件，用于解耦和通知。

## 🔍 当前架构分析

### 当前结构

```
riveredge-root/src/
├── models/          # 数据模型（Tortoise ORM）
├── services/        # 业务逻辑层（类似应用服务）
├── schemas/         # 数据验证（Pydantic）
└── api/             # API 路由层
```

### 当前问题

1. **模型层职责过重**：`models/` 既包含领域逻辑，又包含持久化逻辑
2. **服务层混合**：`services/` 混合了应用服务和领域服务
3. **缺乏领域边界**：没有明确的领域划分
4. **缺乏聚合概念**：没有明确的聚合和聚合根
5. **缺乏领域事件**：没有领域事件机制

## 🚀 DDD 融入方案

### 方案 A：渐进式融入（推荐）⭐

**特点**：不破坏现有架构，逐步引入 DDD 概念。

#### 阶段 1：引入领域层（最小改动）

**目标**：将业务逻辑从模型层提取到领域层。

**目录结构**：

```
riveredge-root/src/
├── app/                    # FastAPI 应用配置（保持不变）
├── api/                    # API 路由层（保持不变）
│   └── v1/
├── domains/                # 领域层（新增）⭐
│   ├── __init__.py
│   ├── user/               # 用户领域
│   │   ├── __init__.py
│   │   ├── entities/       # 实体
│   │   │   ├── __init__.py
│   │   │   └── user.py     # User 实体（从 models 迁移）
│   │   ├── value_objects/  # 值对象
│   │   │   ├── __init__.py
│   │   │   ├── email.py    # Email 值对象
│   │   │   └── password.py # Password 值对象
│   │   ├── services/       # 领域服务
│   │   │   ├── __init__.py
│   │   │   └── user_domain_service.py  # 用户领域服务
│   │   ├── repositories/   # 仓储接口
│   │   │   ├── __init__.py
│   │   │   └── user_repository.py      # 用户仓储接口
│   │   └── events/          # 领域事件
│   │       ├── __init__.py
│   │       └── user_events.py
│   ├── tenant/              # 租户领域
│   │   ├── entities/
│   │   ├── value_objects/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── events/
│   └── auth/                # 认证领域
│       ├── entities/
│       ├── value_objects/
│       ├── services/
│       ├── repositories/
│       └── events/
├── infrastructure/          # 基础设施层（新增）⭐
│   ├── __init__.py
│   ├── persistence/         # 持久化实现
│   │   ├── __init__.py
│   │   ├── tortoise/        # Tortoise ORM 实现
│   │   │   ├── models/      # ORM 模型（从 models 迁移）
│   │   │   │   ├── user_orm.py
│   │   │   │   └── tenant_orm.py
│   │   │   └── repositories/ # 仓储实现
│   │   │       ├── user_repository_impl.py
│   │   │       └── tenant_repository_impl.py
│   │   └── event_bus/       # 事件总线实现
│   │       └── in_memory_event_bus.py
│   └── external/            # 外部服务
│       ├── cache/           # 缓存服务
│       └── notification/    # 通知服务
├── application/             # 应用层（重构 services）⭐
│   ├── __init__.py
│   ├── services/            # 应用服务（从 services 迁移）
│   │   ├── user_application_service.py
│   │   └── tenant_application_service.py
│   └── use_cases/           # 用例（可选）
│       ├── create_user_use_case.py
│       └── create_tenant_use_case.py
├── models/                  # 保留（向后兼容，逐步迁移）
├── services/                # 保留（向后兼容，逐步迁移）
└── schemas/                 # 数据验证（保持不变）
```

#### 阶段 2：定义聚合和聚合根

**目标**：识别聚合边界，定义聚合根。

**示例：用户聚合**

```python
# domains/user/entities/user.py
from dataclasses import dataclass
from typing import List, Optional
from datetime import datetime

from domains.user.value_objects.email import Email
from domains.user.value_objects.password import Password
from domains.user.events.user_events import UserCreatedEvent, UserActivatedEvent


@dataclass
class User:
    """
    用户实体（聚合根）
    
    用户聚合包含：
    - User（聚合根）
    - UserProfile（值对象，可选）
    - UserRoles（值对象，角色列表）
    """
    id: Optional[int]
    tenant_id: Optional[int]
    username: str
    email: Email  # 值对象
    password_hash: str
    full_name: Optional[str]
    is_active: bool
    is_platform_admin: bool
    is_tenant_admin: bool
    source: Optional[str]
    last_login: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    # 领域事件列表
    _domain_events: List = None
    
    def __post_init__(self):
        if self._domain_events is None:
            self._domain_events = []
    
    def create(self) -> None:
        """
        创建用户（领域逻辑）
        
        触发领域事件：UserCreatedEvent
        """
        # 业务规则验证
        if not self.username:
            raise ValueError("用户名不能为空")
        
        # 触发领域事件
        self._domain_events.append(
            UserCreatedEvent(
                user_id=self.id,
                tenant_id=self.tenant_id,
                username=self.username
            )
        )
    
    def activate(self) -> None:
        """
        激活用户（领域逻辑）
        
        触发领域事件：UserActivatedEvent
        """
        if self.is_active:
            return
        
        self.is_active = True
        self._domain_events.append(
            UserActivatedEvent(
                user_id=self.id,
                tenant_id=self.tenant_id
            )
        )
    
    def change_password(self, old_password: str, new_password: Password) -> None:
        """
        修改密码（领域逻辑）
        """
        # 验证旧密码
        if not self.verify_password(old_password):
            raise ValueError("旧密码不正确")
        
        # 设置新密码
        self.password_hash = new_password.hash()
    
    def verify_password(self, password: str) -> bool:
        """
        验证密码（领域逻辑）
        """
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return pwd_context.verify(password, self.password_hash)
    
    def get_domain_events(self) -> List:
        """
        获取领域事件
        """
        return self._domain_events.copy()
    
    def clear_domain_events(self) -> None:
        """
        清除领域事件
        """
        self._domain_events.clear()
```

**值对象示例**：

```python
# domains/user/value_objects/email.py
from dataclasses import dataclass
import re


@dataclass(frozen=True)
class Email:
    """
    邮箱值对象
    
    值对象特点：
    - 不可变（frozen=True）
    - 没有唯一标识
    - 通过值相等性比较
    """
    value: str
    
    def __post_init__(self):
        if not self.is_valid(self.value):
            raise ValueError(f"无效的邮箱地址: {self.value}")
    
    @staticmethod
    def is_valid(email: str) -> bool:
        """
        验证邮箱格式
        """
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))
    
    def __str__(self) -> str:
        return self.value
```

#### 阶段 3：引入仓储模式

**目标**：抽象数据访问，隔离领域模型和持久化技术。

**仓储接口**：

```python
# domains/user/repositories/user_repository.py
from abc import ABC, abstractmethod
from typing import Optional, List

from domains.user.entities.user import User


class UserRepository(ABC):
    """
    用户仓储接口
    
    定义数据访问契约，不依赖具体持久化技术。
    """
    
    @abstractmethod
    async def save(self, user: User) -> User:
        """
        保存用户（新增或更新）
        """
        pass
    
    @abstractmethod
    async def find_by_id(self, user_id: int) -> Optional[User]:
        """
        根据 ID 查找用户
        """
        pass
    
    @abstractmethod
    async def find_by_username(self, tenant_id: Optional[int], username: str) -> Optional[User]:
        """
        根据用户名查找用户
        """
        pass
    
    @abstractmethod
    async def find_by_email(self, tenant_id: Optional[int], email: str) -> Optional[User]:
        """
        根据邮箱查找用户
        """
        pass
    
    @abstractmethod
    async def find_by_tenant(self, tenant_id: int) -> List[User]:
        """
        查找组织下的所有用户
        """
        pass
    
    @abstractmethod
    async def delete(self, user_id: int) -> None:
        """
        删除用户
        """
        pass
```

**仓储实现**：

```python
# infrastructure/persistence/tortoise/repositories/user_repository_impl.py
from typing import Optional, List

from domains.user.entities.user import User
from domains.user.repositories.user_repository import UserRepository
from infrastructure.persistence.tortoise.models.user_orm import UserORM
from domains.user.value_objects.email import Email


class UserRepositoryImpl(UserRepository):
    """
    用户仓储实现（Tortoise ORM）
    
    负责领域模型和 ORM 模型之间的转换。
    """
    
    async def save(self, user: User) -> User:
        """
        保存用户
        """
        # 转换为 ORM 模型
        user_orm, created = await UserORM.get_or_create(
            id=user.id,
            defaults={
                'tenant_id': user.tenant_id,
                'username': user.username,
                'email': user.email.value,
                'password_hash': user.password_hash,
                'full_name': user.full_name,
                'is_active': user.is_active,
                'is_platform_admin': user.is_platform_admin,
                'is_tenant_admin': user.is_tenant_admin,
                'source': user.source,
                'last_login': user.last_login,
            }
        )
        
        if not created:
            # 更新
            user_orm.tenant_id = user.tenant_id
            user_orm.username = user.username
            user_orm.email = user.email.value
            user_orm.password_hash = user.password_hash
            user_orm.full_name = user.full_name
            user_orm.is_active = user.is_active
            user_orm.is_platform_admin = user.is_platform_admin
            user_orm.is_tenant_admin = user.is_tenant_admin
            user_orm.source = user.source
            user_orm.last_login = user.last_login
            await user_orm.save()
        
        # 转换回领域模型
        return self._to_domain(user_orm)
    
    async def find_by_id(self, user_id: int) -> Optional[User]:
        """
        根据 ID 查找用户
        """
        user_orm = await UserORM.get_or_none(id=user_id)
        if not user_orm:
            return None
        return self._to_domain(user_orm)
    
    async def find_by_username(self, tenant_id: Optional[int], username: str) -> Optional[User]:
        """
        根据用户名查找用户
        """
        user_orm = await UserORM.get_or_none(
            tenant_id=tenant_id,
            username=username
        )
        if not user_orm:
            return None
        return self._to_domain(user_orm)
    
    async def find_by_email(self, tenant_id: Optional[int], email: str) -> Optional[User]:
        """
        根据邮箱查找用户
        """
        user_orm = await UserORM.get_or_none(
            tenant_id=tenant_id,
            email=email
        )
        if not user_orm:
            return None
        return self._to_domain(user_orm)
    
    async def find_by_tenant(self, tenant_id: int) -> List[User]:
        """
        查找组织下的所有用户
        """
        users_orm = await UserORM.filter(tenant_id=tenant_id).all()
        return [self._to_domain(user_orm) for user_orm in users_orm]
    
    async def delete(self, user_id: int) -> None:
        """
        删除用户
        """
        await UserORM.filter(id=user_id).delete()
    
    def _to_domain(self, user_orm: UserORM) -> User:
        """
        将 ORM 模型转换为领域模型
        """
        return User(
            id=user_orm.id,
            tenant_id=user_orm.tenant_id,
            username=user_orm.username,
            email=Email(user_orm.email),
            password_hash=user_orm.password_hash,
            full_name=user_orm.full_name,
            is_active=user_orm.is_active,
            is_platform_admin=user_orm.is_platform_admin,
            is_tenant_admin=user_orm.is_tenant_admin,
            source=user_orm.source,
            last_login=user_orm.last_login,
            created_at=user_orm.created_at,
            updated_at=user_orm.updated_at,
        )
```

#### 阶段 4：重构应用服务

**目标**：应用服务只负责协调，业务逻辑在领域层。

**应用服务示例**：

```python
# application/services/user_application_service.py
from typing import Optional

from domains.user.entities.user import User
from domains.user.repositories.user_repository import UserRepository
from domains.user.value_objects.email import Email
from domains.user.value_objects.password import Password
from infrastructure.persistence.event_bus.in_memory_event_bus import EventBus
from schemas.user import UserCreate, UserUpdate


class UserApplicationService:
    """
    用户应用服务
    
    职责：
    - 协调领域对象
    - 处理用例流程
    - 发布领域事件
    - 不包含业务逻辑（业务逻辑在领域层）
    """
    
    def __init__(
        self,
        user_repository: UserRepository,
        event_bus: EventBus
    ):
        self.user_repository = user_repository
        self.event_bus = event_bus
    
    async def create_user(
        self,
        data: UserCreate,
        tenant_id: Optional[int] = None
    ) -> User:
        """
        创建用户（用例）
        
        流程：
        1. 检查用户名是否已存在
        2. 创建用户实体
        3. 保存用户
        4. 发布领域事件
        """
        # 检查用户名是否已存在
        existing_user = await self.user_repository.find_by_username(
            tenant_id=tenant_id,
            username=data.username
        )
        if existing_user:
            raise ValueError("用户名已存在")
        
        # 创建用户实体（领域逻辑）
        user = User(
            id=None,
            tenant_id=tenant_id,
            username=data.username,
            email=Email(data.email),
            password_hash=Password(data.password).hash(),
            full_name=data.full_name,
            is_active=True,
            is_platform_admin=False,
            is_tenant_admin=False,
            source=data.source,
            last_login=None,
            created_at=None,
            updated_at=None,
        )
        
        # 调用领域方法（触发领域事件）
        user.create()
        
        # 保存用户
        saved_user = await self.user_repository.save(user)
        
        # 发布领域事件
        for event in user.get_domain_events():
            await self.event_bus.publish(event)
        user.clear_domain_events()
        
        return saved_user
    
    async def activate_user(self, user_id: int) -> User:
        """
        激活用户（用例）
        """
        # 查找用户
        user = await self.user_repository.find_by_id(user_id)
        if not user:
            raise ValueError("用户不存在")
        
        # 调用领域方法（触发领域事件）
        user.activate()
        
        # 保存用户
        saved_user = await self.user_repository.save(user)
        
        # 发布领域事件
        for event in user.get_domain_events():
            await self.event_bus.publish(event)
        user.clear_domain_events()
        
        return saved_user
```

#### 阶段 5：引入领域事件

**目标**：通过领域事件实现解耦和通知。

**领域事件定义**：

```python
# domains/user/events/user_events.py
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class UserCreatedEvent:
    """
    用户创建事件
    """
    user_id: Optional[int]
    tenant_id: Optional[int]
    username: str
    occurred_at: datetime = None
    
    def __post_init__(self):
        if self.occurred_at is None:
            self.occurred_at = datetime.now()


@dataclass
class UserActivatedEvent:
    """
    用户激活事件
    """
    user_id: int
    tenant_id: Optional[int]
    occurred_at: datetime = None
    
    def __post_init__(self):
        if self.occurred_at is None:
            self.occurred_at = datetime.now()
```

**事件总线实现**：

```python
# infrastructure/persistence/event_bus/in_memory_event_bus.py
from typing import List, Callable, Any
from collections import defaultdict


class EventBus:
    """
    事件总线（内存实现）
    
    负责发布和订阅领域事件。
    """
    
    def __init__(self):
        self._handlers: defaultdict = defaultdict(list)
    
    def subscribe(self, event_type: type, handler: Callable) -> None:
        """
        订阅事件
        """
        self._handlers[event_type].append(handler)
    
    async def publish(self, event: Any) -> None:
        """
        发布事件
        """
        event_type = type(event)
        handlers = self._handlers.get(event_type, [])
        
        for handler in handlers:
            await handler(event)
```

**事件处理器示例**：

```python
# application/event_handlers/user_event_handlers.py
from domains.user.events.user_events import UserCreatedEvent, UserActivatedEvent
from infrastructure.persistence.event_bus.in_memory_event_bus import EventBus


async def handle_user_created(event: UserCreatedEvent) -> None:
    """
    处理用户创建事件
    
    可以用于：
    - 发送欢迎邮件
    - 创建用户配置
    - 记录审计日志
    """
    print(f"用户创建事件: {event.username}")


async def handle_user_activated(event: UserActivatedEvent) -> None:
    """
    处理用户激活事件
    """
    print(f"用户激活事件: {event.user_id}")


# 注册事件处理器
def register_user_event_handlers(event_bus: EventBus) -> None:
    """
    注册用户事件处理器
    """
    event_bus.subscribe(UserCreatedEvent, handle_user_created)
    event_bus.subscribe(UserActivatedEvent, handle_user_activated)
```

### 方案 B：完全重构（不推荐）

**特点**：完全按照 DDD 重构，破坏现有架构。

**适用场景**：
- 新项目
- 愿意承担重构成本
- 团队熟悉 DDD

## 📊 方案对比

| 维度 | 方案 A（渐进式） | 方案 B（完全重构） |
|------|----------------|-------------------|
| **实施难度** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **破坏性** | ⭐ | ⭐⭐⭐⭐⭐ |
| **学习曲线** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **适用性** | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **推荐度** | ✅ **推荐** | ❌ 不推荐 |

## 🎯 实施建议

### 1. 渐进式实施

**阶段 1**：选择一个简单领域（如 `user`）进行试点
- 创建 `domains/user/` 目录
- 将 `User` 模型迁移为领域实体
- 引入值对象（`Email`、`Password`）
- 保持 `models/` 和 `services/` 向后兼容

**阶段 2**：引入仓储模式
- 定义仓储接口
- 实现 Tortoise ORM 仓储
- 重构应用服务使用仓储

**阶段 3**：引入领域事件
- 定义领域事件
- 实现事件总线
- 注册事件处理器

**阶段 4**：扩展到其他领域
- 逐步迁移 `tenant`、`role`、`auth` 等领域

### 2. 保持向后兼容

- 保留 `models/` 和 `services/` 目录
- 新旧代码可以共存
- 逐步迁移，不强制一次性完成

### 3. 团队培训

- DDD 概念培训
- 代码审查和重构指导
- 最佳实践分享

## ✅ 优势总结

### DDD 融入后的优势

1. **业务逻辑集中**：业务规则在领域层，易于理解和维护
2. **技术解耦**：领域层不依赖持久化技术，易于测试
3. **领域边界清晰**：每个领域独立，职责明确
4. **可扩展性强**：通过领域事件实现解耦，易于扩展
5. **测试友好**：领域逻辑可以独立测试，不依赖数据库

### 与现有架构的兼容性

- ✅ 不破坏现有 API
- ✅ 可以渐进式迁移
- ✅ 新旧代码可以共存
- ✅ 团队可以逐步学习

## 📚 相关文档

- [2.架构设计文档.md](../1.plan/2.架构设计文档.md) - 当前架构设计
- [5.项目结构规范.md](../2.rules/5.项目结构规范.md) - 项目结构规范
- [领域驱动设计（DDD）最佳实践](https://martinfowler.com/bliki/DomainDrivenDesign.html)

---

**最后更新**：2025-01-XX


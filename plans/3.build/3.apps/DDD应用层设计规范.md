# DDD 应用层（Application Layer）设计规范

## 📋 概述

应用层（Application Layer）是 DDD 架构中的协调层，负责协调领域对象完成业务用例。它不包含业务逻辑，而是将业务逻辑委托给领域层处理。

## 🎯 应用层职责

### 核心职责

1. **用例编排**：协调领域对象完成业务用例
2. **事务管理**：管理用例的事务边界
3. **权限验证**：验证用户权限（委托给基础设施层）
4. **数据转换**：在领域模型和 DTO 之间转换
5. **外部服务调用**：调用外部服务（委托给基础设施层）

### 不包含的职责

- ❌ **业务逻辑**：业务逻辑属于领域层
- ❌ **数据持久化**：数据持久化属于基础设施层
- ❌ **领域规则**：领域规则属于领域层

## 🏗️ 应用层架构

### 目录结构

```
seed-插件名/
└── backend/
    └── src/
        ├── application/              # 应用层
        │   ├── __init__.py
        │   ├── services/            # 应用服务
        │   │   ├── __init__.py
        │   │   ├── order_service.py      # 订单应用服务
        │   │   ├── material_service.py   # 物料应用服务
        │   │   └── production_service.py # 生产应用服务
        │   ├── dto/                 # 数据传输对象（DTO）
        │   │   ├── __init__.py
        │   │   ├── order_dto.py
        │   │   └── material_dto.py
        │   ├── commands/            # 命令对象（Command）
        │   │   ├── __init__.py
        │   │   ├── create_order_command.py
        │   │   └── update_order_command.py
        │   ├── queries/            # 查询对象（Query）
        │   │   ├── __init__.py
        │   │   ├── get_order_query.py
        │   │   └── list_orders_query.py
        │   └── handlers/           # 命令/查询处理器（可选，CQRS 模式）
        │       ├── __init__.py
        │       ├── command_handlers.py
        │       └── query_handlers.py
        ├── domain/                  # 领域层
        └── infrastructure/          # 基础设施层
```

## 📦 应用层组件

### 1. 应用服务（Application Service）

应用服务是应用层的核心组件，负责协调领域对象完成业务用例。

#### 设计原则

1. **无状态**：应用服务应该是无状态的
2. **事务边界**：每个应用服务方法是一个事务边界
3. **用例对应**：一个应用服务方法对应一个业务用例
4. **委托领域**：将业务逻辑委托给领域对象处理

#### 代码示例

```python
# application/services/order_service.py
from typing import List, Optional
from uuid import UUID
from domain.entities.order import Order
from domain.repositories.order_repository import IOrderRepository
from domain.services.order_domain_service import OrderDomainService
from application.dto.order_dto import OrderDTO, CreateOrderDTO, UpdateOrderDTO
from infrastructure.exceptions.exceptions import NotFoundError, BusinessRuleViolationError

class OrderService:
    """订单应用服务"""
    
    def __init__(
        self,
        order_repository: IOrderRepository,
        order_domain_service: OrderDomainService,
    ):
        """
        初始化订单应用服务
        
        Args:
            order_repository: 订单仓储接口
            order_domain_service: 订单领域服务
        """
        self._order_repository = order_repository
        self._order_domain_service = order_domain_service
    
    async def create_order(
        self,
        tenant_id: int,
        command: CreateOrderDTO,
        user_id: UUID,
    ) -> OrderDTO:
        """
        创建订单（应用服务方法）
        
        职责：
        1. 验证输入参数
        2. 创建领域对象
        3. 调用领域服务验证业务规则
        4. 保存领域对象
        5. 返回 DTO
        
        Args:
            tenant_id: 租户ID
            command: 创建订单命令
            user_id: 用户ID
            
        Returns:
            OrderDTO: 订单DTO
            
        Raises:
            BusinessRuleViolationError: 业务规则违反
        """
        # 1. 验证输入参数（应用层职责）
        if not command.order_no:
            raise ValueError("订单号不能为空")
        
        # 2. 创建领域对象（委托给领域层）
        order = Order.create(
            tenant_id=tenant_id,
            order_no=command.order_no,
            order_type=command.order_type,
            customer_id=command.customer_id,
            total_amount=command.total_amount,
            created_by=user_id,
        )
        
        # 3. 调用领域服务验证业务规则（委托给领域层）
        await self._order_domain_service.validate_order_creation(order)
        
        # 4. 保存领域对象（委托给基础设施层）
        saved_order = await self._order_repository.save(order)
        
        # 5. 转换为 DTO 返回（应用层职责）
        return OrderDTO.from_entity(saved_order)
    
    async def update_order(
        self,
        tenant_id: int,
        order_id: UUID,
        command: UpdateOrderDTO,
        user_id: UUID,
    ) -> OrderDTO:
        """
        更新订单（应用服务方法）
        
        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            command: 更新订单命令
            user_id: 用户ID
            
        Returns:
            OrderDTO: 订单DTO
            
        Raises:
            NotFoundError: 订单不存在
            BusinessRuleViolationError: 业务规则违反
        """
        # 1. 获取领域对象（委托给基础设施层）
        order = await self._order_repository.get_by_id(tenant_id, order_id)
        if not order:
            raise NotFoundError(f"订单 {order_id} 不存在")
        
        # 2. 更新领域对象（委托给领域层）
        order.update(
            customer_id=command.customer_id,
            total_amount=command.total_amount,
            updated_by=user_id,
        )
        
        # 3. 调用领域服务验证业务规则（委托给领域层）
        await self._order_domain_service.validate_order_update(order)
        
        # 4. 保存领域对象（委托给基础设施层）
        saved_order = await self._order_repository.save(order)
        
        # 5. 转换为 DTO 返回（应用层职责）
        return OrderDTO.from_entity(saved_order)
    
    async def get_order(
        self,
        tenant_id: int,
        order_id: UUID,
    ) -> Optional[OrderDTO]:
        """
        获取订单（应用服务方法）
        
        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            
        Returns:
            Optional[OrderDTO]: 订单DTO，如果不存在则返回 None
        """
        # 1. 获取领域对象（委托给基础设施层）
        order = await self._order_repository.get_by_id(tenant_id, order_id)
        
        # 2. 转换为 DTO 返回（应用层职责）
        if order:
            return OrderDTO.from_entity(order)
        return None
    
    async def list_orders(
        self,
        tenant_id: int,
        query: dict,
    ) -> List[OrderDTO]:
        """
        查询订单列表（应用服务方法）
        
        Args:
            tenant_id: 租户ID
            query: 查询条件
            
        Returns:
            List[OrderDTO]: 订单DTO列表
        """
        # 1. 查询领域对象（委托给基础设施层）
        orders = await self._order_repository.list(tenant_id, query)
        
        # 2. 转换为 DTO 列表返回（应用层职责）
        return [OrderDTO.from_entity(order) for order in orders]
    
    async def cancel_order(
        self,
        tenant_id: int,
        order_id: UUID,
        user_id: UUID,
    ) -> OrderDTO:
        """
        取消订单（应用服务方法）
        
        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            user_id: 用户ID
            
        Returns:
            OrderDTO: 订单DTO
            
        Raises:
            NotFoundError: 订单不存在
            BusinessRuleViolationError: 业务规则违反
        """
        # 1. 获取领域对象（委托给基础设施层）
        order = await self._order_repository.get_by_id(tenant_id, order_id)
        if not order:
            raise NotFoundError(f"订单 {order_id} 不存在")
        
        # 2. 调用领域对象方法执行业务操作（委托给领域层）
        order.cancel(user_id)
        
        # 3. 调用领域服务验证业务规则（委托给领域层）
        await self._order_domain_service.validate_order_cancellation(order)
        
        # 4. 保存领域对象（委托给基础设施层）
        saved_order = await self._order_repository.save(order)
        
        # 5. 转换为 DTO 返回（应用层职责）
        return OrderDTO.from_entity(saved_order)
```

### 2. 数据传输对象（DTO）

DTO 用于在应用层和外部（API 层）之间传输数据，不包含业务逻辑。

#### 设计原则

1. **纯数据对象**：只包含数据，不包含业务逻辑
2. **序列化支持**：支持序列化和反序列化
3. **验证支持**：使用 Pydantic 进行数据验证
4. **转换方法**：提供与领域对象的转换方法

#### 代码示例

```python
# application/dto/order_dto.py
from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, validator
from domain.entities.order import Order

class OrderDTO(BaseModel):
    """订单DTO"""
    
    uuid: UUID
    tenant_id: int
    order_no: str = Field(..., description="订单号")
    order_type: str = Field(..., description="订单类型")
    customer_id: Optional[UUID] = Field(None, description="客户ID")
    status: str = Field(..., description="订单状态")
    total_amount: float = Field(..., description="订单总额")
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    
    @classmethod
    def from_entity(cls, order: Order) -> "OrderDTO":
        """
        从领域实体转换为DTO
        
        Args:
            order: 订单领域实体
            
        Returns:
            OrderDTO: 订单DTO
        """
        return cls(
            uuid=order.uuid,
            tenant_id=order.tenant_id,
            order_no=order.order_no,
            order_type=order.order_type,
            customer_id=order.customer_id,
            status=order.status,
            total_amount=float(order.total_amount),
            created_at=order.created_at,
            updated_at=order.updated_at,
            created_by=order.created_by,
            updated_by=order.updated_by,
        )
    
    class Config:
        """Pydantic 配置"""
        from_attributes = True
        json_encoders = {
            UUID: str,
            datetime: lambda v: v.isoformat(),
        }

class CreateOrderDTO(BaseModel):
    """创建订单DTO"""
    
    order_no: str = Field(..., description="订单号", min_length=1, max_length=100)
    order_type: str = Field(..., description="订单类型", min_length=1, max_length=50)
    customer_id: Optional[UUID] = Field(None, description="客户ID")
    total_amount: float = Field(..., description="订单总额", gt=0)
    
    @validator('order_no')
    def validate_order_no(cls, v):
        """验证订单号"""
        if not v or not v.strip():
            raise ValueError("订单号不能为空")
        return v.strip()
    
    @validator('order_type')
    def validate_order_type(cls, v):
        """验证订单类型"""
        allowed_types = ['sales', 'production', 'purchase']
        if v not in allowed_types:
            raise ValueError(f"订单类型必须是 {allowed_types} 之一")
        return v

class UpdateOrderDTO(BaseModel):
    """更新订单DTO"""
    
    customer_id: Optional[UUID] = Field(None, description="客户ID")
    total_amount: Optional[float] = Field(None, description="订单总额", gt=0)
    
    class Config:
        """Pydantic 配置"""
        from_attributes = True
```

### 3. 命令对象（Command）

命令对象用于封装修改操作（写操作）的输入参数。

#### 设计原则

1. **不可变**：命令对象应该是不可变的
2. **验证支持**：使用 Pydantic 进行数据验证
3. **意图明确**：命令名称应该明确表达业务意图

#### 代码示例

```python
# application/commands/create_order_command.py
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, validator

class CreateOrderCommand(BaseModel):
    """创建订单命令"""
    
    order_no: str = Field(..., description="订单号")
    order_type: str = Field(..., description="订单类型")
    customer_id: Optional[UUID] = Field(None, description="客户ID")
    total_amount: float = Field(..., description="订单总额")
    
    @validator('order_no')
    def validate_order_no(cls, v):
        """验证订单号"""
        if not v or not v.strip():
            raise ValueError("订单号不能为空")
        return v.strip()
    
    class Config:
        """Pydantic 配置"""
        frozen = True  # 不可变
```

### 4. 查询对象（Query）

查询对象用于封装查询操作（读操作）的输入参数。

#### 设计原则

1. **不可变**：查询对象应该是不可变的
2. **验证支持**：使用 Pydantic 进行数据验证
3. **分页支持**：支持分页查询

#### 代码示例

```python
# application/queries/list_orders_query.py
from typing import Optional, List
from pydantic import BaseModel, Field

class ListOrdersQuery(BaseModel):
    """查询订单列表查询对象"""
    
    order_type: Optional[str] = Field(None, description="订单类型")
    status: Optional[str] = Field(None, description="订单状态")
    customer_id: Optional[str] = Field(None, description="客户ID")
    page: int = Field(1, description="页码", ge=1)
    page_size: int = Field(20, description="每页数量", ge=1, le=100)
    order_by: Optional[str] = Field(None, description="排序字段")
    order_direction: Optional[str] = Field("desc", description="排序方向")
    
    class Config:
        """Pydantic 配置"""
        frozen = True  # 不可变
```

## 🔄 应用层与各层的关系

### 1. 应用层 → 领域层

**关系**：应用层依赖领域层

**职责**：
- 调用领域实体方法执行业务操作
- 调用领域服务验证业务规则
- 调用仓储接口查询和保存领域对象

**示例**：
```python
# 应用服务调用领域实体
order.cancel(user_id)  # 调用领域实体方法

# 应用服务调用领域服务
await self._order_domain_service.validate_order_creation(order)  # 调用领域服务

# 应用服务调用仓储接口
order = await self._order_repository.get_by_id(tenant_id, order_id)  # 调用仓储接口
```

### 2. 应用层 → 基础设施层

**关系**：应用层依赖基础设施层

**职责**：
- 通过依赖注入获取仓储实现
- 调用外部服务（如消息队列、文件存储等）
- 管理事务

**示例**：
```python
# 通过依赖注入获取仓储实现
def __init__(self, order_repository: IOrderRepository):
    self._order_repository = order_repository  # 基础设施层实现

# 调用外部服务
await self._message_service.send_notification(...)  # 调用外部服务
```

### 3. API 层 → 应用层

**关系**：API 层依赖应用层

**职责**：
- 接收 HTTP 请求
- 将请求参数转换为 DTO/Command/Query
- 调用应用服务
- 将应用服务返回的 DTO 转换为 HTTP 响应

**示例**：
```python
# API 层调用应用服务
@router.post("/orders", response_model=OrderDTO)
async def create_order(
    command: CreateOrderDTO,
    current_user: User = Depends(get_current_user),
    current_tenant: int = Depends(get_current_tenant),
):
    """创建订单API"""
    # 调用应用服务
    order_dto = await order_service.create_order(
        tenant_id=current_tenant,
        command=command,
        user_id=current_user.uuid,
    )
    return order_dto
```

## 📝 最佳实践

### 1. 应用服务设计

**✅ 好的实践**：
- 一个应用服务方法对应一个业务用例
- 方法名应该明确表达业务意图
- 使用 DTO/Command/Query 作为参数
- 返回 DTO 而不是领域对象

**❌ 不好的实践**：
- 在应用服务中包含业务逻辑
- 直接操作数据库
- 返回领域对象给 API 层

### 2. DTO 设计

**✅ 好的实践**：
- 使用 Pydantic 进行数据验证
- 提供与领域对象的转换方法
- 支持序列化和反序列化

**❌ 不好的实践**：
- 在 DTO 中包含业务逻辑
- 直接暴露领域对象给 API 层

### 3. 事务管理

**✅ 好的实践**：
- 每个应用服务方法是一个事务边界
- 使用依赖注入管理事务
- 在应用服务方法开始时开始事务，结束时提交事务

**示例**：
```python
# 使用依赖注入管理事务
from infrastructure.persistence.unit_of_work import IUnitOfWork

class OrderService:
    def __init__(
        self,
        order_repository: IOrderRepository,
        unit_of_work: IUnitOfWork,
    ):
        self._order_repository = order_repository
        self._unit_of_work = unit_of_work
    
    async def create_order(self, ...):
        """创建订单"""
        async with self._unit_of_work:
            # 业务操作
            order = Order.create(...)
            await self._order_repository.save(order)
            # 事务自动提交
```

### 4. 异常处理

**✅ 好的实践**：
- 在应用服务中捕获领域异常
- 将领域异常转换为应用层异常
- 在 API 层处理应用层异常

**示例**：
```python
# 应用服务中处理异常
async def create_order(self, ...):
    try:
        order = Order.create(...)
        await self._order_domain_service.validate_order_creation(order)
        await self._order_repository.save(order)
    except DomainException as e:
        raise ApplicationException(str(e)) from e
```

## 🎯 总结

应用层（Application Layer）是 DDD 架构中的协调层，负责：

1. **用例编排**：协调领域对象完成业务用例
2. **事务管理**：管理用例的事务边界
3. **数据转换**：在领域模型和 DTO 之间转换
4. **权限验证**：验证用户权限
5. **外部服务调用**：调用外部服务

**关键原则**：
- ✅ 应用层不包含业务逻辑
- ✅ 业务逻辑属于领域层
- ✅ 数据持久化属于基础设施层
- ✅ 一个应用服务方法对应一个业务用例

通过遵循以上设计规范，可以构建清晰、可维护、可测试的应用层。


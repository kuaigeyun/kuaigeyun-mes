# Apps 共享部分设计规范

## 📋 概述

在前后端各自的 `apps` 文件夹下建立共享部分，用于存放跨应用（APP）共享的代码、模型、服务和组件。

## 🎯 设计目标

1. **代码复用**：避免在多个应用中重复实现相同的功能
2. **统一管理**：集中管理跨应用共享的资源
3. **易于维护**：共享代码的修改可以影响所有使用它的应用
4. **清晰边界**：明确区分应用特有代码和共享代码

## 🏗️ 目录结构

### 后端 Apps 共享部分

```
riveredge-backend/src/apps/
├── __init__.py
├── shared/                      # 共享部分
│   ├── __init__.py
│   ├── domain/                  # 共享领域层
│   │   ├── __init__.py
│   │   ├── entities/            # 共享实体
│   │   │   ├── __init__.py
│   │   │   ├── order.py         # 订单实体（核心）
│   │   │   ├── material.py      # 物料实体（核心）
│   │   │   ├── customer.py      # 客户实体（核心）
│   │   │   └── supplier.py      # 供应商实体（核心）
│   │   ├── value_objects/       # 共享值对象
│   │   │   ├── __init__.py
│   │   │   ├── money.py         # 金额值对象
│   │   │   └── address.py       # 地址值对象
│   │   ├── aggregates/          # 共享聚合
│   │   │   ├── __init__.py
│   │   │   └── order_aggregate.py  # 订单聚合
│   │   ├── domain_services/     # 共享领域服务
│   │   │   ├── __init__.py
│   │   │   ├── order_domain_service.py
│   │   │   └── material_domain_service.py
│   │   └── repositories/        # 共享仓储接口
│   │       ├── __init__.py
│   │       ├── order_repository.py
│   │       └── material_repository.py
│   ├── application/             # 共享应用层
│   │   ├── __init__.py
│   │   ├── services/            # 共享应用服务
│   │   │   ├── __init__.py
│   │   │   ├── order_service.py
│   │   │   └── material_service.py
│   │   ├── dto/                 # 共享 DTO
│   │   │   ├── __init__.py
│   │   │   ├── order_dto.py
│   │   │   └── material_dto.py
│   │   ├── commands/           # 共享命令对象
│   │   │   ├── __init__.py
│   │   │   └── order_commands.py
│   │   └── queries/            # 共享查询对象
│   │       ├── __init__.py
│   │       └── order_queries.py
│   ├── infrastructure/          # 共享基础设施层
│   │   ├── __init__.py
│   │   ├── repositories/        # 共享仓储实现
│   │   │   ├── __init__.py
│   │   │   ├── order_repository_impl.py
│   │   │   └── material_repository_impl.py
│   │   └── models/              # 共享数据模型（ORM）
│   │       ├── __init__.py
│   │       ├── order_model.py   # 核心订单表
│   │       └── material_model.py # 核心物料表
│   ├── schemas/                # 共享数据验证（Pydantic）
│   │   ├── __init__.py
│   │   ├── order_schemas.py
│   │   └── material_schemas.py
│   └── utils/                  # 共享工具函数
│       ├── __init__.py
│       ├── order_utils.py
│       └── material_utils.py
│
├── kuaimes/                    # 快麦应用（示例）
│   ├── __init__.py
│   ├── domain/                  # 快麦特有领域层
│   ├── application/             # 快麦特有应用层
│   └── infrastructure/          # 快麦特有基础设施层
│
├── mes/                        # MES 应用（示例）
│   ├── __init__.py
│   ├── domain/                  # MES 特有领域层
│   │   └── entities/
│   │       └── production_order_extension.py  # MES 订单扩展
│   ├── application/             # MES 特有应用层
│   └── infrastructure/          # MES 特有基础设施层
│
└── erp/                        # ERP 应用（示例）
    ├── __init__.py
    ├── domain/                  # ERP 特有领域层
    │   └── entities/
    │       └── sales_order_extension.py  # ERP 订单扩展
    ├── application/             # ERP 特有应用层
    └── infrastructure/          # ERP 特有基础设施层
```

### 前端 Apps 共享部分

```
riveredge-frontend/src/apps/
├── shared/                      # 共享部分
│   ├── components/              # 共享组件
│   │   ├── OrderList.tsx        # 订单列表组件
│   │   ├── MaterialSelector.tsx # 物料选择器组件
│   │   └── CustomerSelector.tsx # 客户选择器组件
│   ├── services/                # 共享服务
│   │   ├── order.ts             # 订单 API 服务
│   │   ├── material.ts          # 物料 API 服务
│   │   └── customer.ts          # 客户 API 服务
│   ├── hooks/                   # 共享 Hooks
│   │   ├── useOrder.ts          # 订单相关 Hooks
│   │   └── useMaterial.ts       # 物料相关 Hooks
│   ├── types/                   # 共享类型定义
│   │   ├── order.ts             # 订单类型
│   │   ├── material.ts          # 物料类型
│   │   └── customer.ts          # 客户类型
│   ├── utils/                   # 共享工具函数
│   │   ├── orderUtils.ts        # 订单工具函数
│   │   └── materialUtils.ts     # 物料工具函数
│   └── constants/               # 共享常量
│       ├── orderConstants.ts    # 订单常量
│       └── materialConstants.ts  # 物料常量
│
├── kuaimes/                    # 快麦应用（示例）
│   ├── index.tsx
│   ├── pages/                   # 快麦特有页面
│   └── components/              # 快麦特有组件
│
├── mes/                        # MES 应用（示例）
│   ├── index.tsx
│   ├── pages/                   # MES 特有页面
│   │   └── production/         # 生产相关页面
│   └── components/              # MES 特有组件
│
└── erp/                        # ERP 应用（示例）
    ├── index.tsx
    ├── pages/                   # ERP 特有页面
    │   └── sales/              # 销售相关页面
    └── components/              # ERP 特有组件
```

## 📦 共享部分内容

### 1. 后端共享部分

#### 共享领域层（domain/）

**职责**：
- 定义跨应用共享的领域实体
- 定义跨应用共享的值对象
- 定义跨应用共享的聚合
- 定义跨应用共享的领域服务接口
- 定义跨应用共享的仓储接口

**示例**：
```python
# apps/shared/domain/entities/order.py
from uuid import UUID
from datetime import datetime
from decimal import Decimal

class Order:
    """订单实体（核心，所有应用共享）"""
    
    def __init__(
        self,
        uuid: UUID,
        tenant_id: int,
        order_no: str,
        order_type: str,
        customer_id: UUID | None,
        total_amount: Decimal,
        status: str,
        created_at: datetime,
        updated_at: datetime,
    ):
        self.uuid = uuid
        self.tenant_id = tenant_id
        self.order_no = order_no
        self.order_type = order_type
        self.customer_id = customer_id
        self.total_amount = total_amount
        self.status = status
        self.created_at = created_at
        self.updated_at = updated_at
    
    def cancel(self, user_id: UUID):
        """取消订单（领域逻辑）"""
        if self.status == 'completed':
            raise ValueError("已完成订单不能取消")
        self.status = 'cancelled'
        self.updated_at = datetime.now()
```

#### 共享应用层（application/）

**职责**：
- 提供跨应用共享的应用服务
- 提供跨应用共享的 DTO
- 提供跨应用共享的命令和查询对象

**示例**：
```python
# apps/shared/application/services/order_service.py
from typing import List, Optional
from uuid import UUID
from apps.shared.domain.entities.order import Order
from apps.shared.domain.repositories.order_repository import IOrderRepository
from apps.shared.application.dto.order_dto import OrderDTO, CreateOrderDTO

class OrderService:
    """订单应用服务（共享）"""
    
    def __init__(self, order_repository: IOrderRepository):
        self._order_repository = order_repository
    
    async def create_order(
        self,
        tenant_id: int,
        command: CreateOrderDTO,
    ) -> OrderDTO:
        """创建订单（共享逻辑）"""
        order = Order.create(
            tenant_id=tenant_id,
            order_no=command.order_no,
            order_type=command.order_type,
            customer_id=command.customer_id,
            total_amount=command.total_amount,
        )
        saved_order = await self._order_repository.save(order)
        return OrderDTO.from_entity(saved_order)
```

#### 共享基础设施层（infrastructure/）

**职责**：
- 实现跨应用共享的仓储接口
- 定义跨应用共享的数据模型（ORM）
- 提供跨应用共享的外部服务集成

**示例**：
```python
# apps/shared/infrastructure/models/order_model.py
from tortoise.models import Model
from tortoise import fields

class OrderModel(Model):
    """订单数据模型（核心表）"""
    
    uuid = fields.UUIDField(pk=True)
    tenant_id = fields.IntField()
    order_no = fields.CharField(max_length=100)
    order_type = fields.CharField(max_length=50)
    customer_id = fields.UUIDField(null=True)
    status = fields.CharField(max_length=50)
    total_amount = fields.DecimalField(max_digits=10, decimal_places=2)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)
    
    class Meta:
        table = "apps_shared_orders"  # 共享表使用 apps_shared_ 前缀
        indexes = [
            Index(fields=["tenant_id", "order_no"]),
        ]
```

### 2. 前端共享部分

#### 共享组件（components/）

**职责**：
- 提供跨应用共享的 React 组件
- 提供跨应用共享的 UI 组件

**示例**：
```typescript
// apps/shared/components/OrderList.tsx
import React from 'react';
import { Table } from 'antd';
import { useOrderList } from '../hooks/useOrder';
import type { Order } from '../types/order';

interface OrderListProps {
  orderType?: string;
  onSelect?: (order: Order) => void;
}

export const OrderList: React.FC<OrderListProps> = ({ orderType, onSelect }) => {
  const { data, loading } = useOrderList({ orderType });
  
  return (
    <Table
      dataSource={data}
      loading={loading}
      columns={[
        { title: '订单号', dataIndex: 'order_no' },
        { title: '客户', dataIndex: 'customer_name' },
        { title: '金额', dataIndex: 'total_amount' },
        { title: '状态', dataIndex: 'status' },
      ]}
      onRow={(record) => ({
        onClick: () => onSelect?.(record),
      })}
    />
  );
};
```

#### 共享服务（services/）

**职责**：
- 提供跨应用共享的 API 服务
- 封装跨应用共享的 HTTP 请求

**示例**：
```typescript
// apps/shared/services/order.ts
import { apiRequest } from '../../../services/api';
import type { Order, CreateOrderDTO, UpdateOrderDTO } from '../types/order';

export async function getOrderList(params: {
  orderType?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: Order[]; total: number }> {
  return apiRequest('/api/v1/apps/shared/orders', {
    method: 'GET',
    params,
  });
}

export async function createOrder(data: CreateOrderDTO): Promise<Order> {
  return apiRequest('/api/v1/apps/shared/orders', {
    method: 'POST',
    data,
  });
}
```

#### 共享 Hooks（hooks/）

**职责**：
- 提供跨应用共享的 React Hooks
- 封装跨应用共享的状态管理逻辑

**示例**：
```typescript
// apps/shared/hooks/useOrder.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrderList, createOrder, updateOrder } from '../services/order';
import type { Order, CreateOrderDTO } from '../types/order';

export function useOrderList(params: {
  orderType?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['apps', 'shared', 'orders', params],
    queryFn: () => getOrderList(params),
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateOrderDTO) => createOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps', 'shared', 'orders'] });
    },
  });
}
```

## 🔗 应用如何使用共享部分

### 后端应用使用共享部分

```python
# apps/mes/application/services/production_order_service.py
from apps.shared.application.services.order_service import OrderService
from apps.shared.domain.entities.order import Order
from apps.mes.domain.entities.production_order_extension import ProductionOrderExtension

class ProductionOrderService(OrderService):
    """生产订单服务（继承共享订单服务）"""
    
    async def create_production_order(
        self,
        tenant_id: int,
        command: CreateProductionOrderDTO,
    ) -> ProductionOrderDTO:
        """创建生产订单（扩展共享逻辑）"""
        # 1. 调用共享服务创建订单
        order_dto = await super().create_order(
            tenant_id=tenant_id,
            command=command.to_order_command(),
        )
        
        # 2. 创建 MES 扩展数据
        extension = ProductionOrderExtension.create(
            order_id=order_dto.uuid,
            production_line_id=command.production_line_id,
            planned_start_time=command.planned_start_time,
        )
        await self._extension_repository.save(extension)
        
        # 3. 返回完整订单信息
        return ProductionOrderDTO(
            **order_dto.dict(),
            production_line_id=extension.production_line_id,
            planned_start_time=extension.planned_start_time,
        )
```

### 前端应用使用共享部分

```typescript
// apps/mes/pages/production/orders/index.tsx
import React from 'react';
import { OrderList } from '../../../shared/components/OrderList';
import { useProductionOrderList } from '../../hooks/useProductionOrder';

export const ProductionOrderListPage: React.FC = () => {
  const { data, loading } = useProductionOrderList({ orderType: 'production' });
  
  return (
    <div>
      <h1>生产订单列表</h1>
      <OrderList
        orderType="production"
        onSelect={(order) => {
          // 处理订单选择
        }}
      />
    </div>
  );
};
```

## 📝 命名规范

### 后端命名规范

**共享部分**：
- 表名：`apps_shared_orders`（使用 `apps_shared_` 前缀）
- 模块名：`apps.shared.domain.entities.order`
- 类名：`Order`（领域实体）、`OrderService`（应用服务）

**应用特有部分**：
- 表名：`apps_mes_production_order_extensions`（使用 `apps_应用名_` 前缀）
- 模块名：`apps.mes.domain.entities.production_order_extension`
- 类名：`ProductionOrderExtension`（扩展实体）

### 前端命名规范

**共享部分**：
- 文件路径：`apps/shared/components/OrderList.tsx`
- 组件名：`OrderList`
- Hook 名：`useOrderList`
- 服务名：`getOrderList`

**应用特有部分**：
- 文件路径：`apps/mes/pages/production/orders/index.tsx`
- 组件名：`ProductionOrderListPage`
- Hook 名：`useProductionOrderList`

## 🎯 最佳实践

### 1. 共享部分设计原则

**✅ 好的实践**：
- 只包含所有应用共享的代码
- 保持共享部分的稳定性和向后兼容性
- 使用接口和抽象类定义契约
- 提供清晰的文档和示例

**❌ 不好的实践**：
- 在共享部分中包含应用特有的逻辑
- 频繁修改共享部分的接口
- 在共享部分中硬编码业务规则

### 2. 应用扩展共享部分

**✅ 好的实践**：
- 通过继承扩展共享服务
- 通过组合使用共享组件
- 通过外键关联共享数据

**❌ 不好的实践**：
- 直接修改共享部分的代码
- 在应用层重复实现共享功能
- 绕过共享部分直接访问数据

### 3. 版本管理

**共享部分版本管理**：
- 使用语义化版本（Semantic Versioning）
- 保持向后兼容性
- 提供迁移指南

**应用依赖管理**：
- 在应用的 `requirements.txt` 或 `package.json` 中声明对共享部分的依赖
- 明确版本要求

## 🎯 总结

通过在前后端各自的 `apps` 文件夹下建立共享部分，可以实现：

1. **代码复用**：避免在多个应用中重复实现相同的功能
2. **统一管理**：集中管理跨应用共享的资源
3. **易于维护**：共享代码的修改可以影响所有使用它的应用
4. **清晰边界**：明确区分应用特有代码和共享代码

**关键原则**：
- ✅ 共享部分只包含所有应用共享的代码
- ✅ 应用通过继承、组合、关联等方式扩展共享部分
- ✅ 保持共享部分的稳定性和向后兼容性
- ✅ 使用清晰的命名规范区分共享部分和应用特有部分


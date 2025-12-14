# 主数据管理 APP 架构设计分析

## 📋 概述

分析将基础数据管理单独做成一个 APP（主数据管理），应用 APP 只负责业务单据的架构设计是否合理。

---

## 🎯 设计方案

### 方案描述

```
主数据管理 APP（Master Data Management, MDM）
├── 物料管理
├── 客户管理
├── 供应商管理
├── 产品管理
├── BOM 管理
└── 其他基础数据

业务应用 APP（Business Applications）
├── MES APP
│   ├── 工单管理（引用物料）
│   ├── 生产报工（引用物料、产品）
│   └── 质检管理（引用产品、标准）
├── ERP APP
│   ├── 销售订单（引用客户、产品）
│   ├── 采购订单（引用供应商、物料）
│   └── 库存管理（引用物料）
└── WMS APP
    ├── 入库单（引用物料、供应商）
    ├── 出库单（引用物料、客户）
    └── 库存查询（引用物料）
```

---

## ✅ 优点分析

### 1. 数据统一管理

**优势**：
- ✅ **单一数据源**：所有基础数据在一个地方管理，避免数据重复和不一致
- ✅ **数据标准化**：统一的数据标准和规范，确保数据质量
- ✅ **数据治理**：集中管理数据，便于数据治理和审计

**示例**：
```python
# 主数据管理 APP
# apps/master-data/
├── domain/
│   └── entities/
│       ├── material.py      # 物料实体（统一管理）
│       ├── customer.py      # 客户实体（统一管理）
│       └── supplier.py      # 供应商实体（统一管理）
└── application/
    └── services/
        ├── material_service.py
        ├── customer_service.py
        └── supplier_service.py

# 业务应用 APP（MES）
# apps/mes/
├── domain/
│   └── entities/
│       └── work_order.py    # 工单实体（引用物料）
└── application/
    └── services/
        └── work_order_service.py  # 通过引用使用物料
```

### 2. 职责清晰分离

**优势**：
- ✅ **基础数据管理**：主数据管理 APP 专注于基础数据的 CRUD 和标准化
- ✅ **业务逻辑处理**：业务应用 APP 专注于业务流程和业务规则
- ✅ **降低耦合度**：业务应用不直接管理基础数据，只引用

**示例**：
```python
# 主数据管理 APP：负责物料管理
class MaterialService:
    """物料管理服务"""
    async def create_material(self, data: CreateMaterialDTO):
        # 物料创建逻辑
        # 数据验证、标准化、唯一性检查
        pass
    
    async def update_material(self, material_id: str, data: UpdateMaterialDTO):
        # 物料更新逻辑
        # 版本管理、变更历史
        pass

# MES APP：只引用物料，不管理物料
class WorkOrderService:
    """工单管理服务"""
    async def create_work_order(self, data: CreateWorkOrderDTO):
        # 通过主数据管理 APP 的 API 获取物料信息
        material = await master_data_client.get_material(data.material_id)
        
        # 创建工单（引用物料）
        work_order = WorkOrder(
            material_id=material.uuid,  # 引用物料
            quantity=data.quantity,
            # ... 其他字段
        )
        pass
```

### 3. 数据共享和复用

**优势**：
- ✅ **跨应用共享**：多个业务应用可以共享同一套基础数据
- ✅ **避免重复**：不需要在每个应用中重复定义基础数据模型
- ✅ **统一接口**：通过统一的 API 访问基础数据

**示例**：
```python
# 多个应用共享物料数据
# MES APP：工单使用物料
work_order.material_id = material.uuid

# ERP APP：销售订单使用物料
sales_order.material_id = material.uuid

# WMS APP：入库单使用物料
stock_in.material_id = material.uuid
```

### 4. 符合 DDD 设计原则

**优势**：
- ✅ **有界上下文**：主数据管理是一个独立的有界上下文
- ✅ **领域模型清晰**：基础数据领域和业务领域分离
- ✅ **聚合根明确**：物料、客户等作为独立的聚合根

---

## ⚠️ 缺点和挑战

### 1. 跨应用调用复杂度

**挑战**：
- ⚠️ **API 调用开销**：业务应用需要调用主数据管理 APP 的 API
- ⚠️ **网络延迟**：跨应用调用可能增加延迟
- ⚠️ **错误处理**：需要处理跨应用调用的错误情况

**解决方案**：
```python
# 使用缓存减少 API 调用
from infra.infrastructure.cache.cache_manager import cache_manager

class MaterialService:
    @cache_manager.cached(ttl=300)  # 缓存5分钟
    async def get_material(self, material_id: str):
        # 从主数据管理 APP 获取物料
        return await master_data_client.get_material(material_id)
```

### 2. 数据一致性

**挑战**：
- ⚠️ **分布式事务**：跨应用的数据操作需要分布式事务支持
- ⚠️ **数据同步**：基础数据变更需要通知所有使用它的应用
- ⚠️ **版本管理**：基础数据版本变更可能影响业务单据

**解决方案**：
```python
# 使用事件驱动架构
# 主数据管理 APP 发布事件
await inngest_client.send_event(
    event=Event(
        name="master-data/material-updated",
        data={
            "material_id": material.uuid,
            "tenant_id": tenant_id,
            "changes": {...}
        }
    )
)

# 业务应用 APP 监听事件
@inngest_client.create_function(
    fn_id="material-update-handler",
    trigger=TriggerEvent(event="master-data/material-updated")
)
async def handle_material_update(event: Event):
    # 处理物料更新事件
    # 更新本地缓存、通知相关业务等
    pass
```

### 3. 开发复杂度

**挑战**：
- ⚠️ **依赖管理**：业务应用依赖主数据管理 APP
- ⚠️ **部署复杂度**：需要管理多个应用的部署
- ⚠️ **测试复杂度**：需要测试跨应用的集成

**解决方案**：
- ✅ 使用共享库（`apps/shared`）减少重复代码
- ✅ 使用 API 网关统一管理跨应用调用
- ✅ 使用契约测试确保 API 兼容性

---

## 🎯 推荐方案

### 方案一：独立主数据管理 APP（推荐）

**架构设计**：

```
apps/
├── master-data/              # 主数据管理 APP
│   ├── domain/
│   │   └── entities/
│   │       ├── material.py      # 物料
│   │       ├── customer.py      # 客户
│   │       ├── supplier.py      # 供应商
│   │       ├── product.py       # 产品
│   │       └── bom.py            # BOM
│   ├── application/
│   │   └── services/
│   │       ├── material_service.py
│   │       ├── customer_service.py
│   │       └── supplier_service.py
│   └── infrastructure/
│       └── api/
│           └── master_data_api.py  # 提供统一 API
│
├── mes/                      # MES 应用
│   ├── domain/
│   │   └── entities/
│   │       └── work_order.py  # 引用物料（material_id）
│   └── application/
│       └── services/
│           └── work_order_service.py
│
└── erp/                      # ERP 应用
    ├── domain/
    │   └── entities/
    │       └── sales_order.py  # 引用客户、产品
    └── application/
        └── services/
            └── sales_order_service.py
```

**优点**：
- ✅ 职责清晰，符合单一职责原则
- ✅ 数据统一管理，避免重复和不一致
- ✅ 易于扩展和维护
- ✅ 符合 DDD 有界上下文设计

**缺点**：
- ⚠️ 需要跨应用调用（可通过缓存优化）
- ⚠️ 需要处理分布式事务（可通过事件驱动优化）

### 方案二：共享基础数据（备选）

**架构设计**：

```
apps/
├── shared/                   # 共享部分
│   ├── domain/
│   │   └── entities/
│   │       ├── material.py      # 共享物料实体
│   │       ├── customer.py      # 共享客户实体
│   │       └── supplier.py      # 共享供应商实体
│   └── application/
│       └── services/
│           ├── material_service.py
│           └── customer_service.py
│
├── mes/                      # MES 应用
│   ├── domain/
│   │   └── entities/
│   │       └── work_order.py  # 使用共享物料
│   └── application/
│       └── services/
│           └── work_order_service.py
│
└── erp/                      # ERP 应用
    ├── domain/
    │   └── entities/
    │       └── sales_order.py  # 使用共享客户
    └── application/
        └── services/
            └── sales_order_service.py
```

**优点**：
- ✅ 代码共享，减少重复
- ✅ 直接调用，无网络开销
- ✅ 部署简单，单一应用

**缺点**：
- ⚠️ 耦合度较高
- ⚠️ 职责不够清晰
- ⚠️ 难以独立扩展

---

## 🔧 实施建议

### 推荐方案：独立主数据管理 APP

**理由**：
1. ✅ **符合 DDD 设计原则**：主数据管理是一个独立的有界上下文
2. ✅ **职责清晰**：基础数据管理和业务逻辑分离
3. ✅ **易于扩展**：可以独立扩展和维护
4. ✅ **数据统一**：单一数据源，避免数据不一致

### 实施步骤

#### 阶段一：创建主数据管理 APP（1-2 周）

1. **创建 APP 结构**
   ```bash
   apps/master-data/
   ├── manifest.json
   ├── domain/
   │   └── entities/
   │       ├── material.py
   │       ├── customer.py
   │       ├── supplier.py
   │       └── product.py
   ├── application/
   │   └── services/
   │       ├── material_service.py
   │       ├── customer_service.py
   │       └── supplier_service.py
   ├── infrastructure/
   │   ├── api/
   │   │   └── master_data_api.py
   │   └── repositories/
   │       └── material_repository.py
   └── schemas/
       └── material_schemas.py
   ```

2. **实现基础数据管理功能**
   - [ ] 物料管理（CRUD、导入导出、批量操作）
   - [ ] 客户管理（CRUD、分类管理）
   - [ ] 供应商管理（CRUD、评估管理）
   - [ ] 产品管理（CRUD、BOM 管理）

3. **提供统一 API**
   - [ ] RESTful API 接口
   - [ ] 数据查询接口（支持筛选、分页、排序）
   - [ ] 批量查询接口（减少网络调用）

#### 阶段二：业务应用集成（2-3 周）

1. **创建共享客户端**
   ```python
   # apps/shared/infrastructure/clients/
   # master_data_client.py
   
   class MasterDataClient:
       """主数据管理客户端"""
       
       async def get_material(self, material_id: str) -> MaterialDTO:
           """获取物料信息"""
           pass
       
       async def get_materials(self, material_ids: List[str]) -> List[MaterialDTO]:
           """批量获取物料信息"""
           pass
   ```

2. **业务应用使用主数据**
   - [ ] MES APP 引用物料
   - [ ] ERP APP 引用客户、供应商、产品
   - [ ] WMS APP 引用物料

3. **实现缓存机制**
   - [ ] 物料信息缓存（减少 API 调用）
   - [ ] 缓存失效策略（物料更新时清除缓存）

#### 阶段三：优化和完善（1-2 周）

1. **性能优化**
   - [ ] 批量查询接口
   - [ ] 缓存策略优化
   - [ ] 数据预加载

2. **数据一致性**
   - [ ] 事件驱动架构（物料更新通知）
   - [ ] 版本管理（物料版本变更）
   - [ ] 数据同步机制

---

## 📊 架构对比

### 方案对比表

| 特性 | 独立主数据管理 APP | 共享基础数据 |
|------|------------------|------------|
| **职责分离** | ✅ 清晰 | ⚠️ 模糊 |
| **数据统一** | ✅ 单一数据源 | ✅ 单一数据源 |
| **耦合度** | ✅ 低（API 调用） | ⚠️ 高（直接依赖） |
| **扩展性** | ✅ 易于独立扩展 | ⚠️ 需要修改共享代码 |
| **性能** | ⚠️ 有网络开销（可缓存优化） | ✅ 无网络开销 |
| **部署复杂度** | ⚠️ 需要管理多个应用 | ✅ 单一应用 |
| **符合 DDD** | ✅ 有界上下文清晰 | ⚠️ 有界上下文模糊 |
| **维护成本** | ✅ 低（职责清晰） | ⚠️ 高（耦合度高） |

---

## 🎯 最佳实践

### 1. 主数据管理 APP 设计

**核心原则**：
- ✅ **单一职责**：只负责基础数据的 CRUD 和标准化
- ✅ **统一接口**：提供统一的 API 接口
- ✅ **数据治理**：数据验证、标准化、版本管理

**功能范围**：
```python
# 主数据管理 APP 负责：
- 物料管理（物料编码、名称、规格、单位等）
- 客户管理（客户编码、名称、联系方式等）
- 供应商管理（供应商编码、名称、联系方式等）
- 产品管理（产品编码、名称、BOM 等）
- 数据字典管理（物料分类、客户分类等）
- 数据导入导出
- 数据标准化和验证
```

### 2. 业务应用 APP 设计

**核心原则**：
- ✅ **引用而非拥有**：业务应用只引用基础数据，不直接管理
- ✅ **业务逻辑优先**：专注于业务流程和业务规则
- ✅ **缓存优化**：使用缓存减少跨应用调用

**功能范围**：
```python
# 业务应用 APP 负责：
- 业务单据管理（工单、订单、出入库单等）
- 业务流程处理（审批、流转、状态管理）
- 业务规则验证（业务层面的验证）
- 业务数据统计和分析
```

### 3. 数据访问模式

**推荐模式**：API + 缓存

```python
# 1. 直接 API 调用（实时数据）
material = await master_data_client.get_material(material_id)

# 2. 缓存 + API（性能优化）
@cache_manager.cached(ttl=300, key_prefix="material")
async def get_material_cached(material_id: str):
    return await master_data_client.get_material(material_id)

# 3. 批量查询（减少网络调用）
materials = await master_data_client.get_materials(material_ids)

# 4. 事件驱动（数据变更通知）
# 主数据管理 APP 发布事件
# 业务应用 APP 监听事件，更新缓存
```

### 4. 数据一致性保证

**策略**：
- ✅ **最终一致性**：通过事件驱动实现最终一致性
- ✅ **版本管理**：基础数据版本变更时通知业务应用
- ✅ **缓存失效**：基础数据更新时自动清除相关缓存

---

## 📋 实施检查清单

### 主数据管理 APP

- [ ] 创建 APP 结构（manifest.json、目录结构）
- [ ] 实现物料管理（CRUD、导入导出）
- [ ] 实现客户管理（CRUD、分类管理）
- [ ] 实现供应商管理（CRUD、评估管理）
- [ ] 实现产品管理（CRUD、BOM 管理）
- [ ] 提供统一 API 接口
- [ ] 实现数据验证和标准化
- [ ] 实现版本管理
- [ ] 实现事件发布（数据变更通知）

### 业务应用集成

- [ ] 创建主数据客户端（MasterDataClient）
- [ ] 实现缓存机制（减少 API 调用）
- [ ] 业务应用引用基础数据（material_id、customer_id 等）
- [ ] 实现事件监听（基础数据变更通知）
- [ ] 实现缓存失效策略

### 测试和验证

- [ ] 单元测试（主数据管理 APP）
- [ ] 集成测试（跨应用调用）
- [ ] 性能测试（缓存效果）
- [ ] 数据一致性测试

---

## 📚 相关文档

- [Apps 共享部分设计规范](./Apps共享部分设计规范.md)
- [DDD 应用层设计规范](./DDD应用层设计规范.md)
- [插件化应用全局化规划](./插件化应用全局化规划.md)

---

## ✅ 总结

### 推荐方案：独立主数据管理 APP

**理由**：
1. ✅ **符合 DDD 设计原则**：主数据管理是一个独立的有界上下文
2. ✅ **职责清晰**：基础数据管理和业务逻辑分离
3. ✅ **数据统一**：单一数据源，避免数据不一致
4. ✅ **易于扩展**：可以独立扩展和维护
5. ✅ **符合框架设计**：与现有的 APP 架构一致

**关键实施点**：
- ✅ 使用 API + 缓存模式减少网络开销
- ✅ 使用事件驱动架构保证数据一致性
- ✅ 提供批量查询接口减少网络调用
- ✅ 实现缓存失效策略保证数据准确性

**这种设计是合理的，符合 DDD 和微服务架构的最佳实践。**

---

**最后更新**：2025-01-11


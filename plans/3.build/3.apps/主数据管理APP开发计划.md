# 主数据管理 APP 开发计划

## 📋 概述

本文档详细说明主数据管理 APP 的开发计划，采用传统分层架构（API → Service → Model → Schema）。

**开发周期**：预计 8-12 周（分阶段实施，后续会逐步补充）

---

## 🎯 项目目标

### 核心功能

1. **工厂建模**：车间、产线、工位的层级管理
2. **仓库管理**：仓库、库区、库位的层级管理
3. **物料管理**：物料分组、物料信息（含多单位、批号、变体）、物料清单（BOM含替代料）
4. **工艺管理**：不良品信息、工序信息、工艺路线、标准作业程序（eSOP）
5. **供应链**：客户信息、供应商信息
6. **绩效管理**：假期管理、技能管理

> **注意**：以上为初步功能规划，后续会逐步补充完善。

### 技术目标

1. **统一 API**：提供统一的 RESTful API 接口
2. **高性能**：支持批量查询，减少网络调用
3. **数据验证**：完善的数据验证和标准化
4. **缓存机制**：实现缓存机制，提高性能

---

## 🏗️ 项目结构

### 后端结构

```
riveredge-backend/src/apps/master-data/
├── __init__.py
├── manifest.json                    # APP 配置文件
│
├── api/                             # API 层（FastAPI Routes）
│   ├── __init__.py
│   ├── factory.py                   # 工厂建模 API（车间、产线、工位）
│   ├── warehouse.py                  # 仓库管理 API（仓库、库区、库位）
│   ├── material.py                   # 物料管理 API（分组、信息、BOM）
│   ├── process.py                    # 工艺管理 API（不良品、工序、工艺路线、eSOP）
│   ├── supply_chain.py               # 供应链 API（客户、供应商）
│   └── performance.py                # 绩效管理 API（假期、技能）
│
├── services/                        # 服务层（Business Logic）
│   ├── __init__.py
│   ├── factory_service.py           # 工厂建模服务
│   ├── warehouse_service.py         # 仓库管理服务
│   ├── material_service.py           # 物料管理服务
│   ├── process_service.py            # 工艺管理服务
│   ├── supply_chain_service.py       # 供应链服务
│   └── performance_service.py       # 绩效管理服务
│
├── models/                          # 模型层（ORM Models）
│   ├── __init__.py
│   ├── factory.py                   # 工厂建模模型（车间、产线、工位）
│   ├── warehouse.py                 # 仓库管理模型（仓库、库区、库位）
│   ├── material.py                  # 物料管理模型（分组、信息、BOM）
│   ├── process.py                   # 工艺管理模型（不良品、工序、工艺路线、eSOP）
│   ├── supply_chain.py              # 供应链模型（客户、供应商）
│   └── performance.py              # 绩效管理模型（假期、技能）
│
├── schemas/                         # 数据验证层（Pydantic Schemas）
│   ├── __init__.py
│   ├── factory_schemas.py           # 工厂建模 Schema
│   ├── warehouse_schemas.py        # 仓库管理 Schema
│   ├── material_schemas.py          # 物料管理 Schema
│   ├── process_schemas.py           # 工艺管理 Schema
│   ├── supply_chain_schemas.py      # 供应链 Schema
│   └── performance_schemas.py      # 绩效管理 Schema
│
└── utils/                           # 工具层（Utilities）
    ├── __init__.py
    ├── data_validator.py          # 数据验证工具
    ├── data_standardizer.py      # 数据标准化工具
    └── cache_helper.py           # 缓存辅助工具
```

### 前端结构

```
riveredge-frontend/src/apps/master-data/
├── index.tsx                       # APP 入口文件
├── routes.tsx                      # 路由配置
│
├── pages/                          # 页面组件
│   ├── factory/                    # 工厂建模页面
│   │   ├── workshops/              # 车间管理
│   │   ├── production-lines/      # 产线管理
│   │   └── workstations/          # 工位管理
│   ├── warehouse/                  # 仓库管理页面
│   │   ├── warehouses/            # 仓库信息
│   │   ├── storage-areas/         # 库区管理
│   │   └── storage-locations/     # 库位管理
│   ├── materials/                  # 物料管理页面
│   │   ├── groups/                # 物料分组
│   │   ├── materials/             # 物料信息
│   │   └── bom/                   # 物料清单（BOM）
│   ├── process/                    # 工艺管理页面
│   │   ├── defect-types/          # 不良品信息
│   │   ├── operations/            # 工序信息
│   │   ├── routes/                # 工艺路线
│   │   └── sop/                   # 标准作业程序（eSOP）
│   ├── supply-chain/               # 供应链页面
│   │   ├── customers/             # 客户信息
│   │   └── suppliers/             # 供应商信息
│   └── performance/                # 绩效管理页面
│       ├── holidays/              # 假期管理
│       └── skills/                # 技能管理
│
├── components/                     # 组件
│   ├── factory/                    # 工厂建模组件
│   ├── warehouse/                  # 仓库管理组件
│   ├── material/                   # 物料管理组件
│   ├── process/                    # 工艺管理组件
│   ├── supply-chain/               # 供应链组件
│   └── performance/                # 绩效管理组件
│
├── services/                       # API 服务
│   ├── factory.ts                  # 工厂建模 API 服务
│   ├── warehouse.ts                # 仓库管理 API 服务
│   ├── material.ts                 # 物料管理 API 服务
│   ├── process.ts                  # 工艺管理 API 服务
│   ├── supply-chain.ts             # 供应链 API 服务
│   └── performance.ts              # 绩效管理 API 服务
│
└── types/                          # 类型定义
    ├── factory.ts
    ├── warehouse.ts
    ├── material.ts
    ├── process.ts
    ├── supply-chain.ts
    └── performance.ts
```

---

## 📅 开发阶段

### 阶段一：项目初始化（第 1 周）

#### 任务清单

- [x] **1.1 创建项目结构**
  - [x] 创建后端目录结构
  - [x] 创建前端目录结构
  - [x] 创建 `__init__.py` 文件

- [x] **1.2 创建 manifest.json**
  - [x] 配置 APP 基本信息
  - [x] 配置菜单结构
  - [x] 配置权限列表

- [x] **1.3 数据库设计**
  - [x] 设计工厂建模表结构（车间、产线、工位）✅
  - [x] 设计仓库管理表结构（仓库、库区、库位）✅
  - [x] 设计物料管理表结构（分组、信息、BOM）✅
  - [x] 设计工艺管理表结构（不良品、工序、工艺路线、eSOP）✅
  - [x] 设计供应链表结构（客户、供应商）✅（已在迁移文件33中创建）
  - [x] 设计绩效管理表结构（假期、技能）✅
  - [x] 创建数据库迁移文件（工厂数据、仓库数据、物料数据、工艺数据、供应链数据、绩效数据）✅

- [x] **1.4 注册 APP 路由**
  - [x] 在 `server/main.py` 中注册 APP 路由
  - [x] 测试 APP 注册功能

#### 交付物

- ✅ 完整的项目结构
- ✅ manifest.json 配置文件
- ⏳ 数据库迁移文件（待完善）

---

### 阶段二：工厂建模（第 2 周）✅ **已完成**

#### 任务清单

- [x] **2.1 后端开发**
  - [x] 创建工厂建模模型（车间、产线、工位）
  - [x] 创建工厂建模 Schema
  - [x] 创建工厂建模服务
  - [x] 创建工厂建模 API

- [x] **2.2 前端开发**
  - [x] 创建工厂建模类型定义
  - [x] 创建工厂建模 API 服务
  - [x] 创建车间管理页面（占位页面）
  - [x] 创建产线管理页面（占位页面）
  - [x] 创建工位管理页面（占位页面）

- [x] **2.3 功能实现**
  - [x] 车间 CRUD 功能
  - [x] 产线 CRUD 功能（关联车间）
  - [x] 工位 CRUD 功能（关联产线）
  - [x] 层级关系管理
  - [x] 批量查询接口

- [ ] **2.4 测试**
  - [ ] 单元测试
  - [ ] 集成测试
  - [ ] 前端功能测试

#### 交付物

- ✅ 完整的工厂建模功能（后端）
- ✅ 工厂建模 API 接口文档
- ⏳ 前端页面（基础结构已完成，待完善 UI 和交互）
- ⏳ 测试报告（待补充）

---

### 阶段三：仓库管理（第 3 周）✅ **已完成**

#### 任务清单

- [x] **3.1 后端开发**
  - [x] 创建仓库管理模型（仓库、库区、库位）
  - [x] 创建仓库管理 Schema
  - [x] 创建仓库管理服务
  - [x] 创建仓库管理 API

- [x] **3.2 前端开发**
  - [x] 创建仓库管理类型定义
  - [x] 创建仓库管理 API 服务
  - [x] 创建仓库信息页面（占位页面）
  - [x] 创建库区管理页面（占位页面）
  - [x] 创建库位管理页面（占位页面）

- [x] **3.3 功能实现**
  - [x] 仓库 CRUD 功能
  - [x] 库区 CRUD 功能（关联仓库）
  - [x] 库位 CRUD 功能（关联库区）
  - [x] 层级关系管理
  - [x] 批量查询接口

- [ ] **3.4 测试**
  - [ ] 单元测试
  - [ ] 集成测试
  - [ ] 前端功能测试

#### 交付物

- ✅ 完整的仓库管理功能（后端）
- ✅ 仓库管理 API 接口文档
- ⏳ 前端页面（基础结构已完成，待完善 UI 和交互）
- ⏳ 测试报告（待补充）

---

### 阶段四：物料管理（第 4-5 周）✅ **已完成**

#### 任务清单

- [x] **4.1 后端开发**
  - [x] 创建物料分组模型（支持层级结构）
  - [x] 创建物料信息模型（含多单位、批号、变体）
  - [x] 创建物料清单（BOM）模型（含替代料）
  - [x] 创建物料管理 Schema
  - [x] 创建物料管理服务
  - [x] 创建物料管理 API

- [x] **4.2 前端开发**
  - [x] 创建物料管理类型定义
  - [x] 创建物料管理 API 服务
  - [x] 创建物料分组页面（占位页面）
  - [x] 创建物料信息页面（占位页面）
  - [x] 创建物料清单（BOM）页面（占位页面）

- [x] **4.3 功能实现**
  - [x] 物料分组 CRUD 功能（支持层级结构）
  - [x] 物料信息 CRUD 功能
  - [x] 多单位管理功能（JSON格式存储）
  - [x] 批号管理功能（标志位）
  - [x] 变体管理功能（JSON格式存储）
  - [x] BOM 管理功能
  - [x] 替代料管理功能（替代料组和优先级）
  - [x] 批量查询接口

- [ ] **4.4 测试**
  - [ ] 单元测试
  - [ ] 集成测试
  - [ ] 前端功能测试

#### 交付物

- ✅ 完整的物料管理功能（后端）
- ✅ 物料管理 API 接口文档
- ⏳ 前端页面（基础结构已完成，待完善 UI 和交互）
- ⏳ 测试报告（待补充）

---

### 阶段五：工艺管理（第 6-7 周）✅ **已完成**

#### 任务清单

- [x] **5.1 后端开发**
  - [x] 创建不良品信息模型
  - [x] 创建工序信息模型
  - [x] 创建工艺路线模型（支持工序序列JSON格式）
  - [x] 创建标准作业程序（eSOP）模型（支持富文本和附件）
  - [x] 创建工艺管理 Schema
  - [x] 创建工艺管理服务
  - [x] 创建工艺管理 API

- [x] **5.2 前端开发**
  - [x] 创建工艺管理类型定义
  - [x] 创建工艺管理 API 服务
  - [x] 创建不良品信息页面（占位页面）
  - [x] 创建工序信息页面（占位页面）
  - [x] 创建工艺路线页面（占位页面）
  - [x] 创建标准作业程序（eSOP）页面（占位页面）

- [x] **5.3 功能实现**
  - [x] 不良品信息 CRUD 功能
  - [x] 工序信息 CRUD 功能
  - [x] 工艺路线 CRUD 功能（支持工序序列JSON格式）
  - [x] 标准作业程序（eSOP） CRUD 功能（支持富文本和附件）
  - [x] 批量查询接口

- [ ] **5.4 测试**
  - [ ] 单元测试
  - [ ] 集成测试
  - [ ] 前端功能测试

#### 交付物

- ✅ 完整的工艺管理功能（后端）
- ✅ 工艺管理 API 接口文档
- ⏳ 前端页面（基础结构已完成，待完善 UI 和交互）
- ⏳ 测试报告（待补充）

---

### 阶段六：供应链（第 8 周）✅ **已完成**

#### 任务清单

- [x] **6.1 后端开发**
  - [x] 创建客户信息模型（已存在，已更新）
  - [x] 创建供应商信息模型（已存在，已更新）
  - [x] 创建供应链 Schema
  - [x] 创建供应链服务
  - [x] 创建供应链 API

- [x] **6.2 前端开发**
  - [x] 创建供应链类型定义
  - [x] 创建供应链 API 服务
  - [x] 创建客户信息页面（占位页面）
  - [x] 创建供应商信息页面（占位页面）

- [x] **6.3 功能实现**
  - [x] 客户信息 CRUD 功能
  - [x] 供应商信息 CRUD 功能
  - [x] 批量查询接口

- [ ] **6.4 测试**
  - [ ] 单元测试
  - [ ] 集成测试
  - [ ] 前端功能测试

#### 交付物

- ✅ 完整的供应链功能（后端）
- ✅ 供应链 API 接口文档
- ⏳ 前端页面（基础结构已完成，待完善 UI 和交互）
- ⏳ 测试报告（待补充）

---

### 阶段七：绩效管理（第 9 周）✅ **已完成**

#### 任务清单

- [x] **7.1 后端开发**
  - [x] 创建假期管理模型（支持日期范围查询）
  - [x] 创建技能管理模型
  - [x] 创建绩效管理 Schema
  - [x] 创建绩效管理服务
  - [x] 创建绩效管理 API

- [x] **7.2 前端开发**
  - [x] 创建绩效管理类型定义
  - [x] 创建绩效管理 API 服务
  - [x] 创建假期管理页面（占位页面）
  - [x] 创建技能管理页面（占位页面）

- [x] **7.3 功能实现**
  - [x] 假期管理 CRUD 功能（支持日期范围查询）
  - [x] 技能管理 CRUD 功能
  - [x] 批量查询接口

- [ ] **7.4 测试**
  - [ ] 单元测试
  - [ ] 集成测试
  - [ ] 前端功能测试

#### 交付物

- ✅ 完整的绩效管理功能（后端）
- ✅ 绩效管理 API 接口文档
- ⏳ 前端页面（基础结构已完成，待完善 UI 和交互）
- ⏳ 测试报告（待补充）

---

### 阶段八：优化和完善（第 10-12 周）

#### 任务清单

- [ ] **6.1 性能优化**
  - [ ] 实现缓存机制（`utils/cache_helper.py`）
  - [ ] 优化批量查询接口
  - [ ] 优化数据库查询（索引优化）

- [ ] **6.2 功能完善**
  - [ ] 实现数据导入导出功能
  - [ ] 实现数据批量操作
  - [ ] 实现数据搜索和筛选
  - [ ] 实现数据权限控制

- [ ] **6.3 文档完善**
  - [ ] API 接口文档
  - [ ] 前端组件文档
  - [ ] 使用手册

- [ ] **6.4 测试和修复**
  - [ ] 完整功能测试
  - [ ] 性能测试
  - [ ] Bug 修复
  - [ ] 代码审查

#### 交付物

- ✅ 优化后的完整功能
- ✅ 完整的文档
- ✅ 测试报告
- ✅ 上线准备

---

## 🗄️ 数据库设计

> **注意**：以下为初步数据库设计，后续会根据实际需求逐步完善。

### 工厂建模表

#### 车间表（seed_master_data_workshops）

```sql
CREATE TABLE seed_master_data_workshops (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- 车间编码（唯一）
    name VARCHAR(200) NOT NULL,              -- 车间名称
    description TEXT,                        -- 描述
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,         -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid)
);
```

#### 产线表（seed_master_data_production_lines）

```sql
CREATE TABLE seed_master_data_production_lines (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- 产线编码（唯一）
    name VARCHAR(200) NOT NULL,             -- 产线名称
    workshop_id INTEGER NOT NULL,           -- 所属车间ID（外键）
    description TEXT,                       -- 描述
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,         -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid),
    INDEX idx_workshop_id (workshop_id)
);
```

#### 工位表（seed_master_data_workstations）

```sql
CREATE TABLE seed_master_data_workstations (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- 工位编码（唯一）
    name VARCHAR(200) NOT NULL,            -- 工位名称
    production_line_id INTEGER NOT NULL,    -- 所属产线ID（外键）
    description TEXT,                      -- 描述
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,        -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid),
    INDEX idx_production_line_id (production_line_id)
);
```

### 仓库管理表

#### 仓库表（seed_master_data_warehouses）

```sql
CREATE TABLE seed_master_data_warehouses (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- 仓库编码（唯一）
    name VARCHAR(200) NOT NULL,            -- 仓库名称
    description TEXT,                      -- 描述
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,        -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid)
);
```

#### 库区表（seed_master_data_storage_areas）

```sql
CREATE TABLE seed_master_data_storage_areas (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- 库区编码（唯一）
    name VARCHAR(200) NOT NULL,             -- 库区名称
    warehouse_id INTEGER NOT NULL,          -- 所属仓库ID（外键）
    description TEXT,                      -- 描述
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,        -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid),
    INDEX idx_warehouse_id (warehouse_id)
);
```

#### 库位表（seed_master_data_storage_locations）

```sql
CREATE TABLE seed_master_data_storage_locations (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- 库位编码（唯一）
    name VARCHAR(200) NOT NULL,            -- 库位名称
    storage_area_id INTEGER NOT NULL,      -- 所属库区ID（外键）
    description TEXT,                      -- 描述
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,        -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid),
    INDEX idx_storage_area_id (storage_area_id)
);
```

### 物料管理表

#### 物料分组表（seed_master_data_material_groups）

```sql
CREATE TABLE seed_master_data_material_groups (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- 分组编码（唯一）
    name VARCHAR(200) NOT NULL,            -- 分组名称
    parent_id INTEGER,                      -- 父分组ID（支持层级）
    description TEXT,                      -- 描述
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,        -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid),
    INDEX idx_parent_id (parent_id)
);
```

### 物料表（seed_master_data_materials）

```sql
CREATE TABLE seed_master_data_materials (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- 物料编码（唯一）
    name VARCHAR(200) NOT NULL,            -- 物料名称
    group_id INTEGER,                       -- 物料分组ID（外键）
    specification VARCHAR(500),             -- 规格
    base_unit VARCHAR(20) NOT NULL,         -- 基础单位
    
    -- 多单位管理（JSON格式存储）
    units JSONB,                            -- 单位列表及换算关系
    
    -- 批号管理
    batch_managed BOOLEAN DEFAULT FALSE,     -- 是否启用批号管理
    
    -- 变体管理
    variant_managed BOOLEAN DEFAULT FALSE,   -- 是否启用变体管理
    variant_attributes JSONB,              -- 变体属性（如颜色、尺寸等）
    
    -- 扩展信息
    description TEXT,                       -- 描述
    brand VARCHAR(100),                     -- 品牌
    model VARCHAR(100),                     -- 型号
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,        -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid),
    INDEX idx_group_id (group_id)
);
```

#### 物料清单表（BOM）（seed_master_data_bom）

```sql
CREATE TABLE seed_master_data_bom (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    material_id INTEGER NOT NULL,          -- 主物料ID（外键）
    component_id INTEGER NOT NULL,          -- 子物料ID（外键）
    quantity DECIMAL(18, 4) NOT NULL,      -- 用量
    unit VARCHAR(20) NOT NULL,              -- 单位
    
    -- 替代料管理
    is_alternative BOOLEAN DEFAULT FALSE,   -- 是否为替代料
    alternative_group_id INTEGER,           -- 替代料组ID（同一组的替代料互斥）
    priority INTEGER DEFAULT 0,             -- 优先级（数字越小优先级越高）
    
    -- 扩展信息
    description TEXT,                      -- 描述
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,        -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_material_id (material_id),
    INDEX idx_component_id (component_id),
    INDEX idx_uuid (uuid),
    INDEX idx_alternative_group_id (alternative_group_id)
);
```

### 工艺管理表

#### 不良品信息表（seed_master_data_defect_types）

```sql
CREATE TABLE seed_master_data_defect_types (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- 不良品编码（唯一）
    name VARCHAR(200) NOT NULL,            -- 不良品名称
    category VARCHAR(50),                  -- 分类
    description TEXT,                      -- 描述
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,        -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid),
    INDEX idx_category (category)
);
```

#### 工序信息表（seed_master_data_operations）

```sql
CREATE TABLE seed_master_data_operations (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- 工序编码（唯一）
    name VARCHAR(200) NOT NULL,            -- 工序名称
    description TEXT,                      -- 描述
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,        -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid)
);
```

#### 工艺路线表（seed_master_data_process_routes）

```sql
CREATE TABLE seed_master_data_process_routes (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- 工艺路线编码（唯一）
    name VARCHAR(200) NOT NULL,            -- 工艺路线名称
    description TEXT,                      -- 描述
    
    -- 工序序列（JSON格式存储）
    operation_sequence JSONB,              -- 工序序列及顺序
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,        -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid)
);
```

#### 标准作业程序表（eSOP）（seed_master_data_sop）

```sql
CREATE TABLE seed_master_data_sop (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- SOP编码（唯一）
    name VARCHAR(200) NOT NULL,            -- SOP名称
    operation_id INTEGER,                    -- 关联工序ID（外键）
    version VARCHAR(20),                    -- 版本号
    
    -- 内容信息
    content TEXT,                           -- SOP内容（支持富文本）
    attachments JSONB,                      -- 附件列表（JSON格式）
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,        -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid),
    INDEX idx_operation_id (operation_id)
);
```

### 供应链表

#### 客户信息表（seed_master_data_customers）

```sql
CREATE TABLE seed_master_data_customers (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- 客户编码（唯一）
    name VARCHAR(200) NOT NULL,            -- 客户名称
    short_name VARCHAR(100),                -- 简称
    
    -- 联系信息
    contact_person VARCHAR(100),           -- 联系人
    phone VARCHAR(20),                     -- 电话
    email VARCHAR(100),                    -- 邮箱
    address TEXT,                          -- 地址
    
    -- 分类信息
    category VARCHAR(50),                  -- 客户分类
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,       -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid),
    INDEX idx_category (category)
);
```

#### 供应商信息表（seed_master_data_suppliers）

```sql
CREATE TABLE seed_master_data_suppliers (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- 供应商编码（唯一）
    name VARCHAR(200) NOT NULL,            -- 供应商名称
    short_name VARCHAR(100),                -- 简称
    
    -- 联系信息
    contact_person VARCHAR(100),           -- 联系人
    phone VARCHAR(20),                     -- 电话
    email VARCHAR(100),                    -- 邮箱
    address TEXT,                          -- 地址
    
    -- 分类信息
    category VARCHAR(50),                  -- 供应商分类
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,       -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid),
    INDEX idx_category (category)
);
```

### 绩效管理表

#### 假期管理表（seed_master_data_holidays）

```sql
CREATE TABLE seed_master_data_holidays (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    name VARCHAR(200) NOT NULL,            -- 假期名称
    holiday_date DATE NOT NULL,            -- 假期日期
    holiday_type VARCHAR(50),               -- 假期类型（法定节假日、公司假期等）
    description TEXT,                      -- 描述
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,       -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_uuid (uuid),
    INDEX idx_holiday_date (holiday_date),
    INDEX idx_holiday_type (holiday_type)
);
```

#### 技能管理表（seed_master_data_skills）

```sql
CREATE TABLE seed_master_data_skills (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    
    -- 基本信息
    code VARCHAR(50) NOT NULL,              -- 技能编码（唯一）
    name VARCHAR(200) NOT NULL,            -- 技能名称
    category VARCHAR(50),                  -- 技能分类
    description TEXT,                      -- 描述
    
    -- 状态信息
    is_active BOOLEAN DEFAULT TRUE,       -- 是否启用
    
    -- 标准字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- 索引
    UNIQUE(tenant_id, code),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_code (code),
    INDEX idx_uuid (uuid),
    INDEX idx_category (category)
);
```

---

## 🔌 API 设计

### 工厂建模 API

```
# 车间管理
POST   /api/v1/apps/master-data/factory/workshops          # 创建车间
GET    /api/v1/apps/master-data/factory/workshops          # 获取车间列表
GET    /api/v1/apps/master-data/factory/workshops/{uuid}   # 获取车间详情
PUT    /api/v1/apps/master-data/factory/workshops/{uuid}   # 更新车间
DELETE /api/v1/apps/master-data/factory/workshops/{uuid}   # 删除车间

# 产线管理
POST   /api/v1/apps/master-data/factory/production-lines   # 创建产线
GET    /api/v1/apps/master-data/factory/production-lines   # 获取产线列表
GET    /api/v1/apps/master-data/factory/production-lines/{uuid}  # 获取产线详情
PUT    /api/v1/apps/master-data/factory/production-lines/{uuid}  # 更新产线
DELETE /api/v1/apps/master-data/factory/production-lines/{uuid}  # 删除产线

# 工位管理
POST   /api/v1/apps/master-data/factory/workstations       # 创建工位
GET    /api/v1/apps/master-data/factory/workstations       # 获取工位列表
GET    /api/v1/apps/master-data/factory/workstations/{uuid} # 获取工位详情
PUT    /api/v1/apps/master-data/factory/workstations/{uuid} # 更新工位
DELETE /api/v1/apps/master-data/factory/workstations/{uuid} # 删除工位
```

### 仓库管理 API

```
# 仓库信息
POST   /api/v1/apps/master-data/warehouse/warehouses       # 创建仓库
GET    /api/v1/apps/master-data/warehouse/warehouses       # 获取仓库列表
GET    /api/v1/apps/master-data/warehouse/warehouses/{uuid} # 获取仓库详情
PUT    /api/v1/apps/master-data/warehouse/warehouses/{uuid} # 更新仓库
DELETE /api/v1/apps/master-data/warehouse/warehouses/{uuid} # 删除仓库

# 库区管理
POST   /api/v1/apps/master-data/warehouse/storage-areas    # 创建库区
GET    /api/v1/apps/master-data/warehouse/storage-areas   # 获取库区列表
GET    /api/v1/apps/master-data/warehouse/storage-areas/{uuid} # 获取库区详情
PUT    /api/v1/apps/master-data/warehouse/storage-areas/{uuid} # 更新库区
DELETE /api/v1/apps/master-data/warehouse/storage-areas/{uuid} # 删除库区

# 库位管理
POST   /api/v1/apps/master-data/warehouse/storage-locations # 创建库位
GET    /api/v1/apps/master-data/warehouse/storage-locations # 获取库位列表
GET    /api/v1/apps/master-data/warehouse/storage-locations/{uuid} # 获取库位详情
PUT    /api/v1/apps/master-data/warehouse/storage-locations/{uuid} # 更新库位
DELETE /api/v1/apps/master-data/warehouse/storage-locations/{uuid} # 删除库位
```

### 物料管理 API

```
# 物料分组
POST   /api/v1/apps/master-data/materials/groups           # 创建物料分组
GET    /api/v1/apps/master-data/materials/groups           # 获取物料分组列表
GET    /api/v1/apps/master-data/materials/groups/{uuid}    # 获取物料分组详情
PUT    /api/v1/apps/master-data/materials/groups/{uuid}    # 更新物料分组
DELETE /api/v1/apps/master-data/materials/groups/{uuid}    # 删除物料分组

# 物料信息
POST   /api/v1/apps/master-data/materials                  # 创建物料
GET    /api/v1/apps/master-data/materials                  # 获取物料列表
GET    /api/v1/apps/master-data/materials/{uuid}           # 获取物料详情
PUT    /api/v1/apps/master-data/materials/{uuid}           # 更新物料
DELETE /api/v1/apps/master-data/materials/{uuid}           # 删除物料
POST   /api/v1/apps/master-data/materials/batch            # 批量获取物料

# 物料清单（BOM）
POST   /api/v1/apps/master-data/materials/bom               # 创建BOM
GET    /api/v1/apps/master-data/materials/{uuid}/bom       # 获取物料BOM
PUT    /api/v1/apps/master-data/materials/{uuid}/bom       # 更新物料BOM
DELETE /api/v1/apps/master-data/materials/bom/{uuid}       # 删除BOM项
POST   /api/v1/apps/master-data/materials/bom/alternatives  # 添加替代料
```

### 工艺管理 API

```
# 不良品信息
POST   /api/v1/apps/master-data/process/defect-types       # 创建不良品信息
GET    /api/v1/apps/master-data/process/defect-types       # 获取不良品信息列表
GET    /api/v1/apps/master-data/process/defect-types/{uuid} # 获取不良品信息详情
PUT    /api/v1/apps/master-data/process/defect-types/{uuid} # 更新不良品信息
DELETE /api/v1/apps/master-data/process/defect-types/{uuid} # 删除不良品信息

# 工序信息
POST   /api/v1/apps/master-data/process/operations         # 创建工序
GET    /api/v1/apps/master-data/process/operations         # 获取工序列表
GET    /api/v1/apps/master-data/process/operations/{uuid}  # 获取工序详情
PUT    /api/v1/apps/master-data/process/operations/{uuid}  # 更新工序
DELETE /api/v1/apps/master-data/process/operations/{uuid}  # 删除工序

# 工艺路线
POST   /api/v1/apps/master-data/process/routes             # 创建工艺路线
GET    /api/v1/apps/master-data/process/routes              # 获取工艺路线列表
GET    /api/v1/apps/master-data/process/routes/{uuid}       # 获取工艺路线详情
PUT    /api/v1/apps/master-data/process/routes/{uuid}       # 更新工艺路线
DELETE /api/v1/apps/master-data/process/routes/{uuid}       # 删除工艺路线

# 标准作业程序（eSOP）
POST   /api/v1/apps/master-data/process/sop                 # 创建eSOP
GET    /api/v1/apps/master-data/process/sop                 # 获取eSOP列表
GET    /api/v1/apps/master-data/process/sop/{uuid}          # 获取eSOP详情
PUT    /api/v1/apps/master-data/process/sop/{uuid}          # 更新eSOP
DELETE /api/v1/apps/master-data/process/sop/{uuid}          # 删除eSOP
```

### 供应链 API

```
# 客户信息
POST   /api/v1/apps/master-data/supply-chain/customers      # 创建客户
GET    /api/v1/apps/master-data/supply-chain/customers     # 获取客户列表
GET    /api/v1/apps/master-data/supply-chain/customers/{uuid} # 获取客户详情
PUT    /api/v1/apps/master-data/supply-chain/customers/{uuid} # 更新客户
DELETE /api/v1/apps/master-data/supply-chain/customers/{uuid} # 删除客户
POST   /api/v1/apps/master-data/supply-chain/customers/batch  # 批量获取客户

# 供应商信息
POST   /api/v1/apps/master-data/supply-chain/suppliers     # 创建供应商
GET    /api/v1/apps/master-data/supply-chain/suppliers     # 获取供应商列表
GET    /api/v1/apps/master-data/supply-chain/suppliers/{uuid} # 获取供应商详情
PUT    /api/v1/apps/master-data/supply-chain/suppliers/{uuid} # 更新供应商
DELETE /api/v1/apps/master-data/supply-chain/suppliers/{uuid} # 删除供应商
POST   /api/v1/apps/master-data/supply-chain/suppliers/batch  # 批量获取供应商
```

### 绩效管理 API

```
# 假期管理
POST   /api/v1/apps/master-data/performance/holidays       # 创建假期
GET    /api/v1/apps/master-data/performance/holidays        # 获取假期列表
GET    /api/v1/apps/master-data/performance/holidays/{uuid} # 获取假期详情
PUT    /api/v1/apps/master-data/performance/holidays/{uuid} # 更新假期
DELETE /api/v1/apps/master-data/performance/holidays/{uuid} # 删除假期

# 技能管理
POST   /api/v1/apps/master-data/performance/skills          # 创建技能
GET    /api/v1/apps/master-data/performance/skills          # 获取技能列表
GET    /api/v1/apps/master-data/performance/skills/{uuid}   # 获取技能详情
PUT    /api/v1/apps/master-data/performance/skills/{uuid}   # 更新技能
DELETE /api/v1/apps/master-data/performance/skills/{uuid}   # 删除技能
```

---

## 📝 manifest.json 配置

```json
{
  "name": "主数据管理",
  "code": "master-data",
  "version": "1.0.0",
  "description": "统一管理工厂建模、仓库管理、物料管理、工艺管理、供应链、绩效管理等基础数据",
  "icon": "database",
  "author": "RiverEdge Team",
  "entry_point": "../apps/master-data/index.tsx",
  "route_path": "/apps/master-data",
  "menu_config": {
    "title": "主数据管理",
    "icon": "database",
    "path": "/apps/master-data",
    "children": [
      {
        "title": "工厂建模",
        "path": "/apps/master-data/factory",
        "icon": "factory",
        "children": [
          {
            "title": "车间管理",
            "path": "/apps/master-data/factory/workshops",
            "permission": "master-data:factory:workshop:view"
          },
          {
            "title": "产线管理",
            "path": "/apps/master-data/factory/production-lines",
            "permission": "master-data:factory:production-line:view"
          },
          {
            "title": "工位管理",
            "path": "/apps/master-data/factory/workstations",
            "permission": "master-data:factory:workstation:view"
          }
        ]
      },
      {
        "title": "仓库管理",
        "path": "/apps/master-data/warehouse",
        "icon": "warehouse",
        "children": [
          {
            "title": "仓库信息",
            "path": "/apps/master-data/warehouse/warehouses",
            "permission": "master-data:warehouse:warehouse:view"
          },
          {
            "title": "库区管理",
            "path": "/apps/master-data/warehouse/storage-areas",
            "permission": "master-data:warehouse:storage-area:view"
          },
          {
            "title": "库位管理",
            "path": "/apps/master-data/warehouse/storage-locations",
            "permission": "master-data:warehouse:storage-location:view"
          }
        ]
      },
      {
        "title": "物料管理",
        "path": "/apps/master-data/materials",
        "icon": "warehouse",
        "children": [
          {
            "title": "物料分组",
            "path": "/apps/master-data/materials/groups",
            "permission": "master-data:material:group:view"
          },
          {
            "title": "物料信息",
            "path": "/apps/master-data/materials/materials",
            "permission": "master-data:material:view"
          },
          {
            "title": "物料清单（BOM）",
            "path": "/apps/master-data/materials/bom",
            "permission": "master-data:material:bom:view"
          }
        ]
      },
      {
        "title": "工艺管理",
        "path": "/apps/master-data/process",
        "icon": "production",
        "children": [
          {
            "title": "不良品信息",
            "path": "/apps/master-data/process/defect-types",
            "permission": "master-data:process:defect-type:view"
          },
          {
            "title": "工序信息",
            "path": "/apps/master-data/process/operations",
            "permission": "master-data:process:operation:view"
          },
          {
            "title": "工艺路线",
            "path": "/apps/master-data/process/routes",
            "permission": "master-data:process:route:view"
          },
          {
            "title": "标准作业程序（eSOP）",
            "path": "/apps/master-data/process/sop",
            "permission": "master-data:process:sop:view"
          }
        ]
      },
      {
        "title": "供应链",
        "path": "/apps/master-data/supply-chain",
        "icon": "truck",
        "children": [
          {
            "title": "客户信息",
            "path": "/apps/master-data/supply-chain/customers",
            "permission": "master-data:supply-chain:customer:view"
          },
          {
            "title": "供应商信息",
            "path": "/apps/master-data/supply-chain/suppliers",
            "permission": "master-data:supply-chain:supplier:view"
          }
        ]
      },
      {
        "title": "绩效管理",
        "path": "/apps/master-data/performance",
        "icon": "analytics",
        "children": [
          {
            "title": "假期管理",
            "path": "/apps/master-data/performance/holidays",
            "permission": "master-data:performance:holiday:view"
          },
          {
            "title": "技能管理",
            "path": "/apps/master-data/performance/skills",
            "permission": "master-data:performance:skill:view"
          }
        ]
      }
    ]
  },
  "permissions": [
    "master-data:factory:workshop:view",
    "master-data:factory:workshop:create",
    "master-data:factory:workshop:update",
    "master-data:factory:workshop:delete",
    "master-data:factory:production-line:view",
    "master-data:factory:production-line:create",
    "master-data:factory:production-line:update",
    "master-data:factory:production-line:delete",
    "master-data:factory:workstation:view",
    "master-data:factory:workstation:create",
    "master-data:factory:workstation:update",
    "master-data:factory:workstation:delete",
    "master-data:warehouse:warehouse:view",
    "master-data:warehouse:warehouse:create",
    "master-data:warehouse:warehouse:update",
    "master-data:warehouse:warehouse:delete",
    "master-data:warehouse:storage-area:view",
    "master-data:warehouse:storage-area:create",
    "master-data:warehouse:storage-area:update",
    "master-data:warehouse:storage-area:delete",
    "master-data:warehouse:storage-location:view",
    "master-data:warehouse:storage-location:create",
    "master-data:warehouse:storage-location:update",
    "master-data:warehouse:storage-location:delete",
    "master-data:material:group:view",
    "master-data:material:group:create",
    "master-data:material:group:update",
    "master-data:material:group:delete",
    "master-data:material:view",
    "master-data:material:create",
    "master-data:material:update",
    "master-data:material:delete",
    "master-data:material:bom:view",
    "master-data:material:bom:create",
    "master-data:material:bom:update",
    "master-data:material:bom:delete",
    "master-data:process:defect-type:view",
    "master-data:process:defect-type:create",
    "master-data:process:defect-type:update",
    "master-data:process:defect-type:delete",
    "master-data:process:operation:view",
    "master-data:process:operation:create",
    "master-data:process:operation:update",
    "master-data:process:operation:delete",
    "master-data:process:route:view",
    "master-data:process:route:create",
    "master-data:process:route:update",
    "master-data:process:route:delete",
    "master-data:process:sop:view",
    "master-data:process:sop:create",
    "master-data:process:sop:update",
    "master-data:process:sop:delete",
    "master-data:supply-chain:customer:view",
    "master-data:supply-chain:customer:create",
    "master-data:supply-chain:customer:update",
    "master-data:supply-chain:customer:delete",
    "master-data:supply-chain:supplier:view",
    "master-data:supply-chain:supplier:create",
    "master-data:supply-chain:supplier:update",
    "master-data:supply-chain:supplier:delete",
    "master-data:performance:holiday:view",
    "master-data:performance:holiday:create",
    "master-data:performance:holiday:update",
    "master-data:performance:holiday:delete",
    "master-data:performance:skill:view",
    "master-data:performance:skill:create",
    "master-data:performance:skill:update",
    "master-data:performance:skill:delete"
  ],
  "dependencies": {
    "riveredge-backend": ">=1.0.0",
    "riveredge-frontend": ">=1.0.0"
  }
}
```

---

## 🧪 测试计划

### 单元测试

- [ ] 工厂建模服务测试
- [ ] 仓库管理服务测试
- [ ] 物料管理服务测试
- [ ] 工艺管理服务测试
- [ ] 供应链服务测试
- [ ] 绩效管理服务测试
- [ ] 数据验证工具测试
- [ ] 数据标准化工具测试

### 集成测试

- [ ] 工厂建模 API 测试
- [ ] 仓库管理 API 测试
- [ ] 物料管理 API 测试
- [ ] 工艺管理 API 测试
- [ ] 供应链 API 测试
- [ ] 绩效管理 API 测试
- [ ] 批量查询接口测试
- [ ] 缓存机制测试

### 前端测试

- [ ] 工厂建模页面测试
- [ ] 仓库管理页面测试
- [ ] 物料管理页面测试
- [ ] 工艺管理页面测试
- [ ] 供应链页面测试
- [ ] 绩效管理页面测试
- [ ] 表单验证测试
- [ ] 数据展示测试

### 性能测试

- [ ] 批量查询性能测试
- [ ] 缓存命中率测试
- [ ] 数据库查询性能测试

---

## 📚 相关文档

- [主数据管理APP架构设计分析](./主数据管理APP架构设计分析.md)
- [主数据管理架构选择分析](./主数据管理架构选择分析.md)
- [Apps共享部分设计规范](./Apps共享部分设计规范.md)

---

## ✅ 检查清单

### 开发前准备

- [ ] 确认项目结构
- [ ] 确认数据库设计
- [ ] 确认 API 设计
- [ ] 确认前端设计

### 开发中

- [ ] 遵循代码规范
- [ ] 编写单元测试
- [ ] 编写 API 文档
- [ ] 代码审查

### 开发后

- [ ] 完整功能测试
- [ ] 性能测试
- [ ] 文档完善
- [ ] 上线准备

---

**最后更新**：2025-01-11


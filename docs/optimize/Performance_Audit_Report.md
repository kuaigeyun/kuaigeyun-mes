# 系统性能瓶颈审计与提升计划报告 (Performance Audit Report)

**审计目标**：由于中小制造企业数据量增长迅速，且业务涉及复杂的 BOM 展开与 MRP 计算，本次审计旨在识别核心链路的瓦解点，输出基于证据的优化方案。

---

## 一、 前端性能审计 (Frontend Performance)

### 1.1 资源加载与 Bundle 体积 (Evidence & Findings)
- **证据 1**：`vite.config.ts` 显示基础库（UniverJS, Pro-Flow, Gantt）体积极大，虽使用了 `manualChunks` 手动分包，但在 `SaaS` 模式下仍可能导致初次进入时的 JS 执行阻塞。
- **证据 2**：`chunkSizeWarningLimit` 被上调至 800KB（标准为 500KB），暗示部分 Vendor 包体依然沉重。
- **瓶颈点**：**“未按路由完全解耦的巨石包”。** 核心组件（如 3D 拓扑、甘特图）未全量采用 `React.lazy` 异步动态加载，导致不使用该模块的用户也需下载相关资源。

### 1.2 渲染性能 (Rendering Lag)
- **证据**：`bom/designer.tsx` 中大量使用 `memoize`，反映出复杂 BOM 树（10层以上）在拖拽与编辑时面临强烈的重回压力。
- **瓶颈点**：**长列表与深层树节点缺失虚拟化。** 当物料数量破万或 BOM 深且广时，DOM 节点数过载将导致明显的输入延迟。

---

## 二、 后端逻辑与架构审计 (Backend Performance)

### 1.1 计算密集型任务阻塞 (Computational Bottlenecks)
- **证据 1**：`material_source_helper.py` 中的 `expand_bom_with_source_control` 函数。该函数采用深度优先递归（DFR），且在每一层递归中都执行了多次数据库查询：
    - `Material.get_or_none` (Line 321)
    - `BOM.filter(...).prefetch_related(...).all()` (Line 371)
    - `child_bom_query.count()` (Line 510)
- **证据 2**：当 BOM 深度为 5 层且每层平均 5 个子件时，单次展开将触发超过 100 次数据库 I/O 往返。
- **瓶颈点**：**“递归中的 N+1 查询”。** 这种 CPU 与 I/O 双重密集的同步操作直接跑在 FastAPI Worker 中，高并发下会迅速耗尽工作线程，导致 API 响应集体超时。

### 1.2 数据库交互优化 (DB Interaction)
- **证据**：`query_optimizer.py` 显示当 `offset > 10000` 时记录警告，这表明系统目前依赖传统的 SQL 分页，在大数据翻页时存在严重耗时。
- **瓶颈点**：**大表统计计数 (Count) 缓慢。** Tortoise ORM 的 `.count()` 在 PostgreSQL 大表上是全表扫描，缺乏近似计数或 Redis 计数缓存。

---

## 三、 数据库索引与查询审计 (Database Performance)

### 1.1 索引覆盖情况 (Indexing Evidence)
- **证据**：`BOM` 模型已建立 `tenant_id`, `material_id`, `path` 等索引，整体覆盖较佳。
- **发现**：`deleted_at` 虽在 Meta 声明有部分唯一索引，但在常用的 `filter(deleted_at__isnull=True)` 组合查询中，部分复合索引未将 `deleted_at` 放在末尾，导致在大规模数据删除后索引效率衰减。

### 1.2 架构扩展性
- **瓶颈点**：**缺少物料统计字段的物化视图。** 目前报表展示（如库存余额、采购在途）均依赖实时对明细表的聚合计算（SUM/GROUP BY），随明细数破百万，报表刷新将不可接受。

---

## 四、 性能提升计划 (Improvement Roadmap)

### 4.1 前端提升项 (Frontend)
- [ ] **全组件 Lazy Load**：将 `Gantt`, `Univer`, `ThreeJS` 模块强制重构为 `React.lazy(() => import(...))`。
- [ ] **虚拟滚动集成**：在 `UniTable` 与 `BOM Designer` 中强制引入虚拟滚动方案（如 `react-window`），支持万级数据秒开。

### 4.2 后端提升项 (Backend)
- [ ] **批量递归预加载**：重构 `expand_bom_with_source_control`，一次性获取整棵 BOM 树的所有节点或按层级批量获取（In-memory expansion），消除递归中的 I/O 往返。
- [ ] **计算异步化 (Offloading)**：引入 Celery 或 Inngest 作为任务队列。将 MRP 需求展开从主 API 剥离，通过 WebSocket 推送计算结果。
- [ ] **二级缓存机制**：使用 Redis 缓存静态 BOM 结构与基础物料信息，设置 5 分钟失效期。

### 4.3 数据库提升项 (Database)
- [ ] **索引重调**：优化 `(tenant_id, deleted_at, key_field)` 复合索引顺序，提升软删除过滤性能。
- [ ] **近似计数优化**：对非财务核心的列表页（如操作日志、物料列表）使用 `tablesample` 或 `reltuples` 进行近似总数统计。

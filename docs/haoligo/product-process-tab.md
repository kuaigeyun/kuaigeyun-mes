# 产品工艺（独立页）

路径：`/apps/master-data/process/product-process`（页面代码在主数据应用内）

**菜单归属（导航）**

- 未启用 **快研发（kuaiplm）**：侧栏在 **主数据 → 工艺 → 产品工艺**
- 已启用快研发：主数据下 `/process/*` 由 `menu_takeover` 隐藏，入口在 **快研发 → 工程数据**（与工序、工艺路线等同组，路径仍指向主数据）

计件单价仅在**产品工艺**页维护（物料×工序）；绩效管理菜单已移除「计件单价」入口。保存时仍同步 `piece_rates` 表供报工结算使用。

## 三页分工

| 页面 | 路径 | 职责 |
|------|------|------|
| 工艺路线 | `/process/routes` | 路线模板 CRUD（编号、名称、工序序列结构） |
| **产品工艺** | `/process/product-process` | 自制件 × 路线：指派、序列/工时、资源查看、计件单价 |
| 物料 | `/materials` | 物料主数据；来源区可选「默认工艺路线」（仅模板指派）+ 跳转产品工艺页 |
| 物料分组 | `/materials` 左侧树编辑分组 | 可选「默认工艺路线」（组内兜底） |

## 数据流

- 存储：**单表** `apps_master_data_material_product_process`（每物料一行，`lines` JSON 含工序序列、工时、车间/人员/设备、计件单价）
- API：`GET/PUT /apps/master-data/process/materials/{uuid}/product-process`
- 保存时同步：
  - 物料 `process_route_id` / `defaults`（仅指派「用哪条路线模板」，不改模板工序序列）
  - `apps_master_data_piece_rates` 中该物料的计件行（绩效计算兼容）
- **不回写**工艺路线主数据的 `operation_sequence`：A/B 共用一路线模板时，各自 10% 差异只存在各自 `lines`，互不影响
- 工单自动生成工序：优先读该物料 `material_product_process.lines`，无记录时再读路线模板
- 工艺路线解析优先级见 [process-route-resolution.md](./process-route-resolution.md)
- 右栏 **一张工序明细表** + 顶部 **保存**；从路线模板带入工序后，在此补序列/工时/资源/计件
- 物料/物料组页的路线选择 **不维护工序序列**，只作模板与默认资源来源；完整维护在本页

## 深链

- 物料表单：`?materialUuid=<uuid>`
- 工艺路线列表「适用物料」：`?routeUuid=<uuid>`（筛选已指派该路线的自制件）

## 已移除

- 物料表单内「产品工艺」Tab（避免与物料主数据混排）
- 工艺路线列表「适用物料」操作（已移除；指派统一在产品工艺页）

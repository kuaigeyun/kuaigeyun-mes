# 可视排产

## 定位

「可视排产」面向中小企业的**人工排产**场景：在甘特图上查看、拖拽调整工单与工序的计划时间，通过冲突与负荷诊断辅助决策。**不提供**智能排产、优化求解或自动重排。

与「需求计算 / MRP」的边界：

- 需求计算：物料与计划数量运算
- 可视排产：在已有工单上安排**时间**与**资源占用**

## 操作 SOP

1. 打开 **计划管理 → 可视排产**（或从生产协调中心、异常处理深链 `?work_order_ids=` 进入）。
2. 默认 **工位资源** 视角：主数据工位为资源行，工序为子任务；可切换 **设备资源**、**工单视角** 与日/周/月时间尺度。
3. **拖拽**甘特条调整计划；冻结窗（紫色背景带）内及已冻结工单不可拖（前后端 `scheduling_freeze` / `freezeUtils` 一致）。
4. 工位视角支持**垂直拖入另一工位行**改派 `assigned_station_id`（保存前 `validate-adjustments`）。
5. 查看 **排产诊断**：冲突、未排日期、工作中心负荷、**工位负荷**、缺料影响（`consider_material`）；点击冲突可定位甘特工序。
6. 存在冲突时保存会提示确认；可批量 **平移 / 冻结 / 解冻** 选中工单；批量保存返回 `updated` / `skipped_frozen` / `failed`。
7. 可选 **暂存模式**：拖拽仅改本地，点「应用更改」再校验落库；「撤销」恢复上一步（刷新页面清空）。
8. **排产设置** 需 `plan-management-scheduling:update`；配置冻结窗、每日产能、4M 检测、瓶颈工作中心。

## API（节选）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/apps/kuaizhizao/scheduling/board-scan` | 板面扫描；支持 `work_order_ids`、`work_center_id` |
| POST | `/apps/kuaizhizao/scheduling/validate-adjustments` | 拖拽/改派前校验（含冻结窗、模具/工装重叠） |
| PUT | `/apps/kuaizhizao/work-orders/batch-update-dates` | 工单日期；结构化结果 |
| PUT | `/apps/kuaizhizao/work-orders/batch-update-operation-dates` | 工序日期；结构化结果 |
| PUT | `/apps/kuaizhizao/work-orders/batch-update-operation-stations` | 工序工位改派 |
| GET/PUT | `/apps/kuaizhizao/scheduling-configs/default` | 默认排产约束（`:read` / `:update`） |

权限：`kuaizhizao:plan-management-scheduling:read` / `:update`（矩阵仅注册已实现动作）。

`board-scan` 响应扩展：`load_by_station`、`material_issues`；冲突项含 `operation_id`、`task_id`、`station_id`。

## 分阶段验收

### P0 — 可信与规则一致

- [x] 冻结窗 / 冻结工单：`validate` + `batch_update_*` 与前端 `freezeUtils` 一致
- [x] 批量保存返回 `skipped_frozen` / `failed`，前端 `reportBatchUpdateResult`
- [x] `board-scan` 随深链 `work_order_ids`、甘特加载集、表格 `work_center_id` 筛选
- [x] `validate` 含模具/工装重叠与冻结窗
- [x] 排产配置 API 与页面 `useResourcePermissions('plan-management-scheduling')`
- [x] 甘特保存失败 `refreshGantt` 回滚

### P1 — 排产员体验

- [x] 诊断「工位负荷」Tab（`load_by_station`）
- [x] 冲突项定位甘特（`focusTaskId` + `select-task`）
- [x] 拖拽中同工位重叠标红（`gantt-drag-conflict`）
- [x] 甘特选中 ↔ 工单池 `rowSelection` 同步

### P2 — APS 深度（人工决策边界内）

- [x] 跨工位垂直拖拽改派 + `batch-update-operation-stations`
- [x] 设备资源视角（`equipmentResourceUtils`）
- [x] `consider_material` 缺料诊断与工序角标；瓶颈 WC 高亮
- [x] 暂存/撤销（可选开关）；单测；≥500 条工单提示横幅

### 全局

- [x] 无智能排产 / 优化 / 场景沙盘入口
- [x] `python scripts/scan_permission_bypass.py --fail-on high` 通过

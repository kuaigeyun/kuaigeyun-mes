# 工艺路线解析与工单开单策略

## 设计原则（与主流 MES/ERP 一致）

| 层级 | 职责 | 是否回写路线模板 |
|------|------|------------------|
| 工艺路线主数据 | 共用工序骨架模板 | — |
| 物料 / 物料组 | 指派默认路线（资源继承来源） | 否 |
| 产品工艺 | 每物料工序序列、工时、资源、计件 | 否（仅存 `material_product_process.lines`） |
| 工单 | 开单快照，可增删改序 | 否 |

## 读取优先级（唯一实现）

后端：`MaterialProductProcessService.resolve_process_route_for_material`

1. 产品工艺表 `material_product_process.process_route_id`
2. 物料 `process_route_id`
3. 物料 `defaults.defaultProcessRoute*`（历史兼容）
4. 物料分组 `process_route_id`
5. `source_config.process_route_id`（历史兜底）

工序序列：`resolve_sequence_for_material`

1. 产品工艺 `lines`（有则必用）
2. 否则上述已解析路线的模板 `operation_sequence`

消费方：

- `GET .../materials/{uuid}/product-process`（聚合展示）
- `GET .../materials/{uuid}/process-route`
- 工单创建自动生成工序

## 工单开单

- 有绑定：预填路线与工序，**仍可**改路线、删序、排序、添加工序（提交 `operations` 即工单快照）
- 无绑定：路线下拉手工选择；工序可手工维护
- 不传 `operations` 时后端按优先级自动生成（仅草稿创建场景）

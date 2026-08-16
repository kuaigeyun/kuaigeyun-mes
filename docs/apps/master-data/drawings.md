# 工程图纸受控

落点：主数据 → 工艺 → 图纸管理；快研发 → 设计数据 → 同一路径。

## 状态机

```
Draft --checkout--> Editing --checkin / undo-checkout--> Draft
Draft --submit--> Pending
Pending --approve--> Released
Pending --reject / revoke--> Draft
Released --obsolete--> Obsolete
Released --revision--> Draft（新修订）
```

- **Draft**：可检出、可提交签审、可删除。未检出不可改文件/元数据。
- **Editing**：仅检出人可编辑、检入、撤销检出。STP 导入 BOM 须处于此状态且为检出人。
- **Pending**：不可编辑。`approve` 发布；`reject` / `revoke` 回草稿。`release` 仅允许从此状态发布。
- **Released**：可升版、可作废。同图号仅一版 Released（新发布自动作废旧版）。
- **Obsolete**：可删除。

## 权限

资源 `master-data:process:drawing`：

| 动作 | 权限码 |
|------|--------|
| 检出 / 检入 / 撤销检出 / 编辑 / 移入仓库 | `update` |
| 新建图纸 / 升版 / 新建文件夹 | `create` |
| 删除图纸 / 删除空文件夹 | `delete` |
| 提交 | `submit` |
| 审核通过 | `approve` |
| 驳回 | `reject` |
| 撤回待审 | `revoke` |
| 发布（仅 Pending） | `release` |
| 作废 | `obsolete` |

资源 `master-data:process:drawing-where-used`：`read` / `export`。

## 第 2 波：仓库树 + 图档反查

- 图纸页左树默认 **仓库**（文件夹树），可切到 **筛选**（类型/状态/物料/工艺）。
- 文件夹表 `apps_master_data_drawing_folders`；图纸 `folder_id`。分类（移入仓库）不要求检出。
- 新页 **图档反查** `/apps/master-data/process/drawing-where-used`：物料/工艺/工序/工单查图，或从图纸反查引用方。详情抽屉保留关联摘要，完整反查走该页。

## 第 3 波：工程变更 + 图档发放

- **图纸工程变更**不新开页，并进快研发变更台。已发布图纸可发起升版 / 换文件 / 作废等变更；创建走 `kuaiplm:change:create`，签审走 `drawing_change` 审核节点。执行后升版或作废。图纸页「工程变更」跳转变更台弹窗。
- **图档发放**新页 `/apps/master-data/process/drawing-distributions`，资源 `master-data:process:drawing-distribution`。
- 发放状态：`Draft → Pending → Issued → Recalled`。`approve` 发放；`recall` 收回。
- **车间只读已发放版**：发放页开关写入 `DrawingDistributionPolicy`。`list_by_context` 仅此一门：启用则只返回已发放未收回图纸；关闭则仍为当前 Released。失败不回落另一套。

## 第 4 波：密级 + 图档借阅 + 打印水印

- 图纸字段 `security_level`：`public` / `internal` / `secret` / `confidential`。新建默认 **内部**。升版复制源密级。
- 用户授权表 `DrawingUserClearance`。无授权行按 **公开**。管理员（`is_admin_bypass`）可见全部密级。
- 列表 / 详情 / 反查 / `list_by_context`（含工位）按授权过滤。无权详情返回 403，不泄露 `file_uuid`。
- **图档借阅** `/apps/master-data/process/drawing-loans`，资源 `master-data:process:drawing-loan`。`complete` = 归还。
- 借阅状态：`Draft → Pending → Borrowed → Returned`。借阅不提升密级，只能借已能看见的已发布图纸。
- 密级授权：`GET/PUT/DELETE /process/drawing-clearances`，写操作走 `drawing-loan:update` / `delete`。
- 打印：`GET /process/drawings/{uuid}/print-data`（`drawing:print`）。水印为「姓名 站点时刻 图号-修订 密级」。秘密/机密须另有进行中的借阅单。

升级后现有图纸为内部。未授权用户只能看到公开图纸；需在借阅页授予内部及以上密级。

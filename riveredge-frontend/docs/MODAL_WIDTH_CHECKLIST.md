# FormModalTemplate 宽度规范清单

新建/编辑类 Modal 必须显式传 `width`，且仅使用 `MODAL_CONFIG.SMALL_WIDTH` | `STANDARD_WIDTH` | `LARGE_WIDTH`。

| 宽度 | 值 | 适用 |
|------|-----|------|
| SMALL_WIDTH | 600 | 单栏（无 grid 或仅 span:24） |
| STANDARD_WIDTH | 800 | 双栏（grid + colProps span:12 等） |
| LARGE_WIDTH | 1000 | 复杂（多块 Row/Col、多步骤） |

## 全量清单（Code Review / grep 对照）

| 文件 | Modal 用途 | 应有宽度 |
|------|------------|----------|
| system/custom-fields/list/index.tsx | 新建/编辑字段 | STANDARD |
| system/apis/list/index.tsx | 新建/编辑 API | STANDARD |
| system/data-sources/list/index.tsx | 新建/编辑数据源 | STANDARD |
| system/application-connections/list/index.tsx | 新建/编辑应用连接 | STANDARD |
| system/working-hours-configs/index.tsx | 新建/编辑工时配置 | STANDARD |
| system/datasets/list/index.tsx | 新建/编辑数据集 | STANDARD |
| system/scheduled-tasks/list/index.tsx | 新建/编辑定时任务 | LARGE |
| system/users/list/index.tsx | 新建/编辑用户 | STANDARD |
| system/menus/index.tsx | 新建/编辑菜单 | STANDARD |
| system/approval-processes/list/index.tsx | 新建/编辑审批流程 | STANDARD |
| system/messages/config/index.tsx | 新建/编辑消息配置 | STANDARD |
| system/messages/template/index.tsx | 新建/编辑消息模板 | STANDARD |
| system/roles/components/RoleFormModal.tsx | 新建/编辑角色 | SMALL |
| system/departments/components/DepartmentFormModal.tsx | 新建/编辑部门 | SMALL |
| system/positions/components/PositionFormModal.tsx | 新建/编辑岗位 | SMALL |
| system/data-dictionaries/components/DataDictionaryFormModal.tsx | 新建/编辑数据字典 | SMALL |
| system/invitation-codes/components/InvitationCodeFormModal.tsx | 新建/编辑邀请码 | SMALL |
| system/equipment/list/index.tsx | 新建/编辑设备 | SMALL |
| system/molds/list/index.tsx | 新建/编辑模具 | SMALL |
| system/equipment-faults/list/index.tsx | 新建/编辑设备故障 | SMALL |
| system/maintenance-plans/list/index.tsx | 新建/编辑保养计划 | SMALL |
| system/integration-configs/list/index.tsx | 新建/编辑集成配置 | SMALL |
| system/print-devices/list/index.tsx | 新建/编辑打印设备 | SMALL |
| system/print-templates/list/index.tsx | 新建/编辑打印模板 | SMALL |
| system/print-templates/card-view.tsx | 新建模板（卡片视图） | SMALL |
| system/files/list/index.tsx | 上传文件 / 新建文件夹 | SMALL |
| system/applications/list/index.tsx | 应用设置 / 应用升版 | SMALL |
| system/languages/list/index.tsx | 新建/编辑语言 | SMALL |
| system/system-parameters/list/index.tsx | 新建/编辑系统参数 | SMALL |
| system/approval-processes/instances/index.tsx | 审批实例（两个 modal） | SMALL |
| system/data-backups/index.tsx | 创建备份 | SMALL |
| system/report-templates/index.tsx | 新建/编辑报表模板 | SMALL |
| infra/tenants/list/index.tsx | 新建/编辑租户 | STANDARD |
| infra/packages/index.tsx | 创建/编辑套餐（两个 modal） | SMALL |
| personal/tasks/index.tsx | 审批/驳回任务 | SMALL |

新增 FormModalTemplate 时请同步更新本清单并确保传入对应 width。

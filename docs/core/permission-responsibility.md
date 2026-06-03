# 权限职责分工（谁管什么）

与 [permission-contract.md](./permission-contract.md) 配套。目标：**单一职责、严禁混用、自动扫旁路**。

---

## 1. 四层职责

| 层级 | 负责方 | 职责 | 禁止 |
|------|--------|------|------|
| **声明** | 应用 `manifest.json` + 核心注册表 | 定义 `app:module:action`；角色树展示与同步 | 业务代码临时发明 action 字符串 |
| **授予** | 权限同步 + 角色配置 | 租户 `permissions` 表、角色勾选、用户会话 | 未同步就指望 API 通过 |
| **RBAC 门控** | `require_permission_codes` / `require_module_access`（显式码） | 能否调用接口 | URL 猜新业务语义；`workspace` 冒充单据模块 |
| **数据范围** | `DataScopeService` / `assert_*_row_visible` | 同一权限下可见哪些行（供应商、外协等） | 用 ABAC 替代未授予的 RBAC 码 |

---

## 2. 标准 action 归属（严禁混用）

| 用户操作 | manifest action | 后端 | 前端 |
|----------|-----------------|------|------|
| 列表/详情 | `read` | GET → read | `canRead` |
| 新建 | `create` | POST 创建 | `canCreate` |
| 编辑 | `update` | PATCH/PUT | `canUpdate` |
| 删除 | `delete` | DELETE | `canDelete` |
| 打印 | `print` | `require_permission_codes(..., print)` | `canPrint` / `hasModulePermission(..., 'print')` |
| 审核/驳回/撤销审核 | `audit`（合并 approve/reject） | `review_permission_codes` | `hasReviewPermission` |
| 试模发出 | `dispatch` | POST `.../dispatch` | `hasModulePermission(..., 'dispatch')` |
| 确认调整完成 | `confirm_adjustment` | POST `.../mark-adjustment-complete` | `hasModulePermission(..., 'confirm_adjustment')` |
| 确认收回 | `recall` | POST `.../recall`（含 recall-and-retrial） | `hasModulePermission(..., 'recall')` |

**禁止：**

- 用 `update` 显示「审核」「打印」「发出」「调整完成」「确认收回」
- 用 `isExternalPartner` 代替未授予的 `dispatch` / `recall` / `confirm_adjustment`
- 用 viewer-context 布尔代替 manifest action（`is_external_partner` 仅用于文案与隐藏编辑/审核等 CRUD）

---

## 3. 代码归属（应改哪里）

| 需求 | 改 manifest | 改后端依赖 | 改前端门控 |
|------|-------------|------------|------------|
| 新按钮能力 | ✅ | ✅ 显式码 | ✅ `useResourcePermissions` |
| 审核相关 | ✅ audit 等 | ✅ `review_permission_codes` | ✅ `hasReviewPermission` |
| 外协只见部分行 | — | ✅ `_data_scope.py` | —（列表由 API 过滤） |
| 试模发出/调整/收回 | ✅ 三个 action | ✅ 路由 RBAC | ✅ `hasModulePermission` |
| 外协列表数据范围 | — | ✅ `_data_scope.py` | `is_external_partner` 仅 UI，非操作权 |

---

## 4. 展示顺序与文案（禁止双轨）

| 项 | 唯一真源 | 禁止 |
|----|----------|------|
| 矩阵勾选左右顺序 | `manifest.permissions` 数组先后 → `manifest_index` | 前端排序、`permission_action_spec` 内建 sort |
| 勾选旁文字 | `permission_action_spec.ACTION_DISPLAY_LABELS` → 权限同步 → API `label` | 前端 i18n 表冒充未同步 action |

## 5. 自动扫描（CI）

```bash
cd riveredge-backend
python scripts/scan_permission_bypass.py
python scripts/scan_permission_bypass.py --fail-on high
python -m pytest tests/test_permission_bypass_scan.py tests/test_permission_contract.py -q
```

| rule_id | 级别 | 含义 |
|---------|------|------|
| `frontend_review_update_mix` | high | 审核数组含 update |
| `frontend_read_without_update_bypass` | high | read 且 !update 冒充其它能力 |
| `frontend_print_update_same_line` | high | 打印与 update 混用 |
| `backend_workspace_module_guard` | high | workspace 保护业务 API |
| `backend_duplicate_module_assert` | medium | 应用内 assert_*_module_access |
| `backend_local_permission_builder` | medium | 本地拼权限码 |
| `backend_url_action_inference_special` | info | `_resolve_action_by_request` 特例 |
| `backend_duplicate_action_label_dict` | high | 同步服务内联 action 文案表 |
| `backend_hardcoded_action_sort` | high | 非 manifest 的 action 排序 |
| `frontend_grant_label_patch` | high | 角色矩阵文案兜底 |
| `frontend_grant_action_sort` | high | 前端重排 grant actions |

临时豁免：编辑 `tests/fixtures/permission_bypass_allowlist.json`（须 `reason` + `expires`）。

---

## 6. 业务图片/附件（不需「文件管理」权限）

| 能力 | 真源 | 所需权限 |
|------|------|----------|
| 单据内上传图片 | 上传 API `category` → `business_upload_access.BUSINESS_FILE_UPLOAD_PERMISSIONS` | 对应单据模块 `create` / `update`（或完修 `complete`） |
| 表单内预览/缩略图 | `/core/files/{uuid}/preview` + `/download?token=…` | 登录 + 租户上下文，**不要** `system:file:read` |
| 系统「文件管理」页 | `/system/files` | `system:file:read` 等（与业务附件分离） |

好力 GO 全部 `uploadFile(..., { category: 'haoligo_*' })` 已登记；未传 `category` 时才会回落到 `system:file:create`（仅文件管理员场景）。

## 7. 发布检查清单

1. manifest 已声明权限码  
2. 应用中心权限同步  
3. 角色重新勾选  
4. 后端显式依赖（非仅靠 URL 推断）  
5. 前端 `useResourcePermissions` / `permissionContract.ts`  
6. `scan_permission_bypass.py --fail-on high` 通过  

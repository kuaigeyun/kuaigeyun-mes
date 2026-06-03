# 系统权限契约（RBAC + 数据范围）

全平台（好力 GO、快制造、主数据、系统设置等）共用同一套规则。  
目标：**角色里勾什么，API 就验什么，按钮就显示什么**——禁止旁路。

---

## 1. 权限码格式（唯一真源）

```
{app}:{module}:{action}
```

| 段 | 来源 | 示例 |
|----|------|------|
| app | 应用 code | `haoligo`、`kuaizhizao`、`system` |
| module | manifest 模块 / 菜单 `permission_code` 去掉 app 与 action | `molds-documents-trial` |
| action | `STANDARD_ACTIONS`（`core/config/permission_action_spec.py`） | `read`、`update`、`audit`、`print` |

**声明位置（按优先级）：**

1. 应用 `riveredge-backend/src/apps/*/manifest.json` → `permissions` 数组  
2. 核心 `PermissionRegistryService.CORE_PERMISSION_CODES`  
3. 权限同步写入租户 `permissions` 表 → 角色授予 → 用户 JWT/会话中的 `permissions`

**角色矩阵展示顺序**：同一模块下勾选项的左右顺序 = 该应用在 `manifest.json` 的 `permissions` 数组中的先后（`manifest_index`）。调整顺序只改 manifest（标准 CRUD 在前、业务动作在后），勿在前端或 `permission_action_spec` 硬编码排序。

**角色矩阵展示文案**：`permission_action_spec.ACTION_DISPLAY_LABELS` → `permission_contract.display_label_for_permission_code(code)`（禁止拼接 `resource`）→ 权限同步写入 `core_permissions.name` → grant API 的 `action.label`。前端只展示 API 的 `label`。

**禁止：**

- 在业务代码里「临时」用 `update` 代替 `audit` / `print` / `complete`
- 在前端用 `hasUpdate || isExternalPartner` 等组合冒充某一 action
- 仅靠 URL 路径猜 action 表达**新业务**语义（见下文遗留推断）

---

## 2. 标准 action 与角色 UI

| action | 角色树常见文案 | 用途 |
|--------|----------------|------|
| read | 查看 | 列表、详情 GET |
| create | 新建 | POST 创建 |
| update | 编辑 | PATCH/PUT |
| delete | 删除 | DELETE |
| import / export | 导入 / 导出 | |
| print | 打印 | 打印预览、导出 PDF |
| audit / approve / reject | **审核**（合并勾选） | 通过、驳回、撤销审核 |
| submit | 提交 | 提交流程 |
| complete | 完修 | 维保单→完修单等 |
| execute | 执行 | 通用执行类 |
| dispatch | 发出 | 试模单发出至供应商仓等 |
| recall | 确认收回 | 试模单调整完成后收回等 |
| confirm_adjustment | 确认调整 | 试模单「调整完成」等 |
| assign | 分配 | 派工 |
| revoke | 撤销 | 仅当 manifest **显式** 声明时使用；单据撤销审核映射为 **audit** |

「审核」在角色矩阵中合并为 `audit`，`merged_codes` = `approve` + `audit` + `reject`（见 `REVIEW_ACTIONS`）。

---

## 3. 后端鉴权（怎么做才对）

### 3.1 推荐：显式权限码

```python
from core.api.deps.access import require_permission_codes
from core.config.permission_contract import review_permission_codes, build_permission_code

# 单码
Depends(require_permission_codes("haoligo:molds-documents-trial:print"))

# 审核（与角色「审核」一致）
Depends(require_permission_codes(*review_permission_codes("haoligo", "molds-documents-trial"), require_all=False))
```

实现：`core/api/deps/access.py` → `require_permission_codes`  
默认 `check_abac=False`，避免用 `resource=haoligo, action=print` 被策略误伤。

### 3.2 标准 REST 列表/CRUD：`require_module_access`

```python
Depends(require_module_access("haoligo", "molds-documents-trial"))
```

仍会根据 HTTP 方法 + URL **推断** action（遗留）。  
子路径若语义不是 CRUD（`approve`、`print`、`load-presets`），必须：

- 使用 `require_permission_codes`，或  
- `require_module_access(..., route_permission_codes=["haoligo:...:print"])` 覆盖推断

### 3.3 禁止旁路清单

| 禁止 | 应改为 |
|------|--------|
| 应用内 `assert_xxx_access` 自建一套 permission 字符串 | 调用 `require_permission_codes` 或复用 `core/config/permission_contract.py` |
| `require_module_access("haoligo", "workspace")` 保护业务单据 API | 使用**该单据 module** 的权限码 |
| `_resolve_action_by_request` 新增 if 分支而不改 manifest | manifest 增加 action + 显式依赖 |
| RBAC 通过后再用另一套规则挡一次（除非 ABAC **数据范围**） | 数据范围只用 `DataScopeService`，不替换 action |

### 3.4 ABAC（数据范围）

- **RBAC**：能不能调用接口 / 看到按钮。  
- **ABAC / DataScope**：同一权限下能看到哪些行（供应商、部门等）。  
- 不得用 ABAC 的 `target_resource=haoligo` + 泛化 `action` 替代未授予的 RBAC 码。

---

## 4. 前端鉴权（怎么做才对）

### 4.1 标准模块门控

```typescript
import { useResourcePermissions } from '@/hooks/useResourcePermissions';

const gates = useResourcePermissions('haoligo:molds-documents-trial');
// gates.canRead / canUpdate / canPrint / …
```

资源前缀须与菜单 `permission_code` 一致（`utils/permissionResource.ts`）。

### 4.2 审核

```typescript
import { hasReviewPermission } from '@/utils/permissionContract';

hasReviewPermission(currentUser, 'haoligo:molds-documents-trial');
```

**禁止** `update` 混入审核（`moldSheetReviewPermissionCodes` 已修正，全应用应统一用 `permissionContract`）。

### 4.3 行内按钮

`uni-action/filterByPermission` 已支持 `print`；须传入 `permissionGates`（来自 `useResourcePermissions`）。

### 4.4 禁止

- 页面内 `hasPermission(..., 'update')` 控制「审核」「打印」  
- 用角色类型、外协标记等**替代** manifest 中已声明的 action（特殊能力须后端 `viewer-context` 返回明确布尔字段，且与 manifest 同步文档化）

---

## 5. 发布与运维

1. 修改 `manifest.json` 的 `permissions`  
2. 应用中心对该应用执行 **权限同步 / 升版**  
3. 角色重新勾选新 action（或使用管理员默认模板）  
4. 用户重新登录或刷新权限缓存  

未同步时：角色树可能无勾选项，或勾选后 API 仍 403。

---

## 6. 校验（CI）

```bash
cd riveredge-backend
python scripts/scan_permission_bypass.py --fail-on high
python -m pytest tests/test_permission_bypass_scan.py tests/test_permission_contract.py -q
```

- manifest：所有 `permissions` 符合 `app:module:action` 且 action ∈ `STANDARD_ACTIONS`。
- 旁路扫描：禁止审核/打印混用 `update`、`read && !update` 冒充能力等（见 [permission-responsibility.md](./permission-responsibility.md)）。

---

## 7. 迁移路线

| 阶段 | 内容 |
|------|------|
| **现已具备** | 契约文档、Cursor 规则、`require_permission_codes`、`permission_contract` 模块、前端 `permissionContract.ts`、manifest 测试 |
| **进行中** | 新接口只用显式码；修复已知旁路（审核/打印等） |
| **逐步** | 子路径 API 从 `require_module_access` 推断改为 `route_permission_codes` 或独立路由依赖 |
| **长期** | 淘汰 `_resolve_action_by_request` 中的业务特例，推断仅保留标准 REST |

新功能 **Checklist：**

- [ ] manifest 已声明权限码  
- [ ] 已权限同步  
- [ ] 后端 `require_permission_codes` 或带 `route_permission_codes` 的模块依赖  
- [ ] 前端 `useResourcePermissions` / `hasReviewPermission` / `canPrint`  
- [ ] 未使用 update 冒充其他 action  

---

## 8. 相关代码索引

| 用途 | 路径 |
|------|------|
| 标准 action 枚举 | `riveredge-backend/src/core/config/permission_action_spec.py` |
| 契约 helper | `riveredge-backend/src/core/config/permission_contract.py` |
| FastAPI 依赖 | `riveredge-backend/src/core/api/deps/access.py` |
| 审核合并 | `riveredge-backend/src/core/services/authorization/menu_resource_resolver.py` |
| 角色树 | `riveredge-backend/src/core/services/authorization/role_permission_matrix_service.py` |
| 前端契约 | `riveredge-frontend/src/utils/permissionContract.ts` |
| 前端门控 Hook | `riveredge-frontend/src/hooks/useResourcePermissions.ts` |

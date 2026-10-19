---
title: 总账非末级科目残留期初（科目余额表有数期初页看不见）
slug: gl-nonleaf-opening-residual
status: delivered
domain: kuaicaiwu
when: 客户反馈科目余额表有期初、期初录入页下级为0且一级不显示；或增加二级/三级科目后父科目余额异常
keywords:
  - 期初余额
  - 应交税费
  - 2221
  - 科目余额表
  - 非末级
  - rollup_hierarchy
  - opening-balances
  - AccountBalance
standard: 期初仅录末级；余额表轧卷含父科目自身余额行；父变非末级须清/迁残留期初
---

# 总账非末级科目残留期初

## 目标

记录一次生产环境核实与数据修复过程：科目余额表一级科目有期初，期初录入页看不到一级且下级为 0，数字来源可查。

## 何时读 / 禁止另起

- 何时读：轻财务总账「期初对不上」「一级没了但余额表有数」、凭证只要末级/要完整科目路径。
- 禁止：在读侧/报表层补丁猜数；禁止在期初页「展示出父科目余额」却仍不可改却不修真源。

## 标准入口

| 层 | 标准 |
|----|------|
| 期初写入 | `balance_service.set_opening_balances`：仅 `is_leaf` |
| 期初页 | `opening-balances/index.tsx`：只列末级；科目页签不含辅助行 |
| 科目余额表 | `GET /books/balance-sheet`：`merge_aux` + `rollup_hierarchy` |
| 建下级 | `coa_service.create_account`：父 `is_leaf=false`，**当前不清父科目余额行** |
| 凭证制单 | 仅末级；下拉为 `编码 + 本级名称`（无祖先路径） |

## 关键文件

| 角色 | 路径 |
|------|------|
| 轧卷 | `riveredge-backend/src/apps/kuaicaiwu/services/gl/balance_aggregate.py` |
| 余额/期初 | `riveredge-backend/src/apps/kuaicaiwu/services/gl/balance_service.py` |
| 科目 | `riveredge-backend/src/apps/kuaicaiwu/services/gl/coa_service.py` |
| 账簿 API | `riveredge-backend/src/apps/kuaicaiwu/api/gl.py`（`book_balance_sheet`） |
| 期初页 | `riveredge-frontend/src/apps/kuaicaiwu/pages/gl-management/opening-balances/index.tsx` |
| 凭证科目 | `riveredge-frontend/src/apps/kuaicaiwu/pages/gl-management/vouchers/index.tsx` |

---

## 一、客户反馈（原文要点）

1. 账从 **5 月**启用；科目余额表里 **应交税费** 有期初，但期初录入里未录一级，二级/三级均为 0，数字反查不到。
2. 增加二级、三级科目后，凭证录入只显示末级；希望会计凭证展示完整科目路径。

截图现象：

- 期初页：2221 一级不显示；22210101 等末级期初均为 `0.00`。
- 科目余额表：`2221 应交税费` 期初贷 **90,775.74**（本期借贷约 198,796.46，期末贷仍 90,775.74）。

## 二、环境

| 项 | 值 |
|----|-----|
| 服务器 | `154.8.214.25`（本机 SSH：`Host 154.8.214.25` / `kuaigeyun-154`，用户 `ubuntu`，密钥 `~/.ssh/kuaigeyun_154`） |
| 部署目录 | `/home/ubuntu/kuaigeyun` |
| 租户 | `tenant_id=10`（辽宁森源化工股份有限公司） |
| 科目 | `2221 应交税费`，`account_id=123`，已为非末级 |
| 相关期间 | 2026-05 ～ 2026-08 |

## 三、代码侧核实结论

### 3.1 为何期初页没有一级科目

**产品设计，不是坏了。**

- 后端：`仅末级科目可录入期初`
- 前端：`listAccounts` 后 `filter((a) => a.is_leaf)`

有下级后一级不再出现在可编辑列表。

### 3.2 为何余额表仍有期初

科目余额表在「账簿视图」下开启：

- `merge_aux=True`（合并辅助核算）
- `rollup_hierarchy=True`（下级余额轧到上级）

父科目展示金额 = **父科目自身 `AccountBalance` 行** + **所有下级轧上来的金额**。

因此：下级期初全 0 时，父科目仍可因 **自身残留期初行** 显示非零。

### 3.3 凭证只显示末级 / 完整路径

- 制单仅末级：正确（后端 `仅末级科目可制单`，前端非末级 `disabled`）。
- 下拉目前只有 `编码 + 本级名称`，**无祖先完整路径**：展示能力缺口，与期初残留是两件事。

## 四、生产库核实（2026-10-19）

### 4.1 数字定位

按金额 `90775.74` 检索 `apps_kuaicaiwu_account_balances`，命中租户 10、科目编码 `2221`、期间 5～8 月：

| 期间 | account_code | is_leaf | opening_credit | period | ending_credit |
|------|--------------|---------|----------------|--------|---------------|
| 2026-05～08 | **2221** | **false** | **90775.74** | 0 | 90775.74 |

同租户 5 月其它 `2221%`：

| account_code | opening | period_debit / period_credit |
|--------------|---------|------------------------------|
| 2221 | 贷 90775.74 | 0 / 0 |
| 222102 | 0 | 198796.46 / 198796.46 |

- `2221` 上 **凭证分录数为 0**（无业务凭证记到一级）。
- 余额行创建/更新时间约 **2026-09-04**（当时一级仍可录期初）。
- 下级科目更晚才建：`222101`/`222102` 约 **09-20**；更多三级约 **10-19**。
- `coa_service` 在父科目加下级时只把 `is_leaf=false`，**未清理父科目余额行** → 期初页再也看不到/改不到，余额表轧卷仍带上。

### 4.2 根因一句话

**在 2221 仍为末级时录入了期初贷 90,775.74；之后增加下级变成非末级，残留余额行未迁移/清零，被科目余额表轧卷展示出来。**

不是轧卷把本期发生「变成」期初；也不是下级隐藏了非零期初（下级 opening 均为 0）。

## 五、处理过程（数据修复）

### 5.1 处置原则

按客户口径：「启用时一级应交税费正常应无余额、未打算保留该期初」→ **清零父科目残留期初**（非拆到末级）。本期发生额（222102）不动。

### 5.2 操作步骤

1. SSH 登录 `154.8.214.25`。
2. 用后端 `.env` 连库，先查出待改行（备份打印）：

   - `id=22` 2026-05  
   - `id=51` 2026-06  
   - `id=115` 2026-07  
   - `id=146` 2026-08  

3. 事务内对上述行：

   - `opening_debit/credit = 0`
   - `year_debit/credit = 本期发生`（本批均为 0）
   - 按「期初 + 本期」重算 `ending_*`
   - `updated_at = NOW()`

4. 回读核对。

### 5.3 修复后核对

- 2221 四个月：期初 / 期末 / 年累计均为 **0**
- `2221%` 非零期初剩余：**0 行**
- 5 月 222102 本期借/贷 **198,796.46** 未改动

请客户刷新科目余额表（5 月）：应交税费期初不应再出现 90,775.74；轧卷后仍可见下级本期发生。

## 六、产品后续（未做，可选）

| 项 | 建议 |
|----|------|
| 防再发 | 父科目从末级降为非末级时：若存在非零余额 → 禁止建下级，或强制迁移/清零并提示 |
| 可观测 | 期初页增加「非末级残留余额」告警区，避免「查不到」 |
| 凭证展示 | 科目下拉/凭证行展示完整路径（祖先名称链），制单规则仍仅末级 |

## 七、现场排查 SQL（只读）

```sql
-- 按金额找期初
SELECT tenant_id, period_year, period_month, account_code,
       opening_debit, opening_credit, ending_debit, ending_credit
FROM apps_kuaicaiwu_account_balances
WHERE deleted_at IS NULL
  AND (opening_credit BETWEEN 90775 AND 90776
       OR ending_credit BETWEEN 90775 AND 90776);

-- 某租户 2221 树 + 是否末级 + 非零期初
SELECT ab.period_year, ab.period_month, ab.account_code,
       ab.opening_debit, ab.opening_credit, coa.is_leaf
FROM apps_kuaicaiwu_account_balances ab
JOIN apps_kuaicaiwu_chart_of_accounts coa
  ON coa.id = ab.account_id AND coa.tenant_id = ab.tenant_id
WHERE ab.tenant_id = 10
  AND ab.deleted_at IS NULL
  AND ab.account_code LIKE '2221%'
  AND (ab.opening_debit <> 0 OR ab.opening_credit <> 0)
ORDER BY 1, 2, 3;
```

## 踩坑

- 期初页与科目余额表 **不是同一套展示口径**：前者只末级可编，后者轧卷含父行 → 「页上全 0、表上有数」优先查 **非末级自身余额行**。
- `GET /opening-balances` 走 `account_balance_sheet` 默认 **不轧卷**；即便 API 返回父行，前端也会按末级过滤掉，仍看不见。
- 结转会把父科目期末带到后续月 opening，残留会跨月复制（本案 5～8 月同金额）。

# 销售模块按钮文案偏差台账

更新时间：2026-06-20

## 已完成修正

- 统一 `approve` 行为文案为「审核」：
  - `components/uni-action/actionCatalog.ts`
  - `locales/zh-CN.ts` 的 `components.uniAction.approve`
- 统一 `withdraw` 行为文案为「撤回提交」：
  - `components/uni-audit/index.tsx`
  - `components/uni-audit/UniAuditModal.tsx`
  - `locales/zh-CN.ts` 的 `components.uniBatch.audit.withdraw`
- 销售模块批量审核类文案修正：
  - `salesOrderChange.batchApprove`：批量审核通过 -> 批量审核
  - `salesContract.batchApprove`：批量审核通过 -> 批量审核
  - `quotation.batchApprove`：批量审核通过 -> 批量审核
  - `salesContract.batchRevokeSuccess/Partial`：反审核 -> 撤销审核
- 客户池页面行内「编辑」文案从非标准 key 统一到 `common.edit`。
- 打印入口治理（销售合同/销售订单/销售预测）：
  - 行内打印移除，保留功能区与详情抽屉；
  - 详情抽屉顶部打印统一放到最后一个。

## 待治理项（下一批）

- 销售模块业务提示语中的历史状态文案（如「审核通过后可...」）按“状态语义”分类校对，不纳入按钮词契约，但需统一风格。
- 注释中的旧术语（如“反审核/撤回审核”）做一次非功能性清理，避免后续误用。
- 销售子页面继续补齐单选/多选文案切换一致性巡检（按逐页面清单执行）。

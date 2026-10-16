/**
 * 付款申请列表「新建」旁下拉：多来源上拉创建（应付/采购订单/入库/对账单/其他费用支出）
 */
import React, { useCallback, useMemo, useRef } from 'react';
import { App } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import {
  UniPullQueryModal,
  filterByPullScope,
  paginatePullRows,
  UNI_PULL_QUERY_MAX_FETCH_LIMIT,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { formatCurrencyAmount } from '../../../../../utils/format';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import {
  buildKuaizhizaoPullCreateMenuItems,
  resolveKuaizhizaoDocumentAction,
} from '../../../constants/documentActionRegistry';
import { listPurchaseOrders } from '../../../services/purchase';
import { warehouseApi } from '../../../services/warehouse-execution';
import { partnerStatementService } from '../../../services/finance/partnerStatement';
import { otherExpenseService, type OtherExpenseVoucher } from '../../../services/finance/other-expense';
import {
  createPaymentApplication,
  listPayablesForPaymentApplication,
  pullPaymentApplicationFromPurchaseOrder,
  pullPaymentApplicationFromPurchaseReceipt,
  pullPaymentApplicationFromReconciliation,
  previewPullPaymentApplicationFromPurchaseOrder,
} from '../../../services/payment-application';

type PullRow = {
  id: number;
  code: string;
  partnerName?: string;
  amount?: number;
  status?: string;
  pullable?: boolean;
};

type ExpenseWithFinance = OtherExpenseVoucher & {
  payable_id?: number;
  payable_code?: string;
};

type Props = {
  onCreated: () => void;
  onOpenPayablePull: () => void;
};

function isPurchaseReceiptPosted(status: string): boolean {
  const s = String(status || '').trim();
  const sl = s.toLowerCase();
  return (
    s === '已入库'
    || s === '已完成'
    || s === '已确认'
    || sl === 'completed'
    || sl === 'posted'
  );
}

export function usePaymentApplicationPullMenus({ onCreated, onOpenPayablePull }: Props) {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const closePoRef = useRef<(() => void) | null>(null);
  const closeReceiptRef = useRef<(() => void) | null>(null);
  const closeStatementRef = useRef<(() => void) | null>(null);
  const closeExpenseRef = useRef<(() => void) | null>(null);

  const pullFromPoAction = resolveKuaizhizaoDocumentAction(t, 'payment_application.pull_from_purchase_order');
  const pullFromReceiptAction = resolveKuaizhizaoDocumentAction(
    t,
    'payment_application.pull_from_purchase_receipt',
  );
  const pullFromStatementAction = resolveKuaizhizaoDocumentAction(
    t,
    'payment_application.pull_from_partner_statement',
  );
  const pullFromExpenseAction = resolveKuaizhizaoDocumentAction(
    t,
    'payment_application.pull_from_other_expense',
  );

  const scopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const columns: ColumnsType<PullRow> = useMemo(
    () => [
      { title: t('common.code'), dataIndex: 'code', width: 160, ellipsis: true },
      { title: t('app.kuaicaiwu.common.supplier'), dataIndex: 'partnerName', ellipsis: true },
      {
        title: t('app.kuaizhizao.paymentApplication.requestAmount'),
        dataIndex: 'amount',
        width: 120,
        align: 'right',
        render: (v?: number) => (v != null ? formatCurrencyAmount(v) : '—'),
      },
      { title: t('common.status'), dataIndex: 'status', width: 100 },
    ],
    [t],
  );

  const isPullable = useCallback((row: PullRow) => row.pullable === true, []);

  const pullFromPoQuery = useUniPullQuery<PullRow>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (row) => !isPullable(row),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await listPurchaseOrders({
          skip: 0,
          limit: UNI_PULL_QUERY_MAX_FETCH_LIMIT,
          keyword: keyword.trim() || undefined,
        });
        const items = res.data ?? [];
        const rows: PullRow[] = items.map((o) => ({
          id: Number(o.id),
          code: String(o.order_code ?? o.id),
          partnerName: String(o.supplier_name ?? ''),
          amount: Number(o.prepayment_amount ?? o.total_amount ?? 0),
          status: String(o.status ?? o.review_status ?? ''),
          pullable: o.capabilities?.push_payment_application?.allowed === true,
        }));
        return paginatePullRows(filterByPullScope(rows, scope, isPullable), page, pageSize);
      } catch (e) {
        messageApi.error(getApiErrorMessage(e, t('common.loadFailed')));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selected = rows.find((r) => String(r.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t('common.required'));
        return;
      }
      try {
        const preview = await previewPullPaymentApplicationFromPurchaseOrder(selected.id);
        if (preview.has_blocking_issues) {
          messageApi.warning(
            String(preview.blocking_reason || preview.summary || t('common.operationFailed')),
          );
          return;
        }
        const amount = Number(preview.max_push_quantity ?? 0);
        if (!(amount > 0)) {
          messageApi.warning(t('app.kuaizhizao.paymentApplication.noPrepayAmount'));
          return;
        }
        const app = await pullPaymentApplicationFromPurchaseOrder({
          purchaseOrderId: selected.id,
          amount,
        });
        messageApi.success(
          t('app.kuaizhizao.paymentApplication.createFromSourceSuccess', {
            code: app.applicationCode,
            source: pullFromPoAction.sourceLabel,
          }),
        );
        closePoRef.current?.();
        onCreated();
      } catch (e) {
        messageApi.error(getApiErrorMessage(e, t('app.kuaizhizao.paymentApplication.createFailed')));
      }
    },
  });
  closePoRef.current = pullFromPoQuery.closeModal;

  const pullFromReceiptQuery = useUniPullQuery<PullRow>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (row) => !isPullable(row),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await warehouseApi.purchaseReceipt.list({
          skip: 0,
          limit: UNI_PULL_QUERY_MAX_FETCH_LIMIT,
          keyword: keyword.trim() || undefined,
          receipt_type: 'purchase',
        });
        const items = Array.isArray(res)
          ? res
          : ((res as { data?: unknown[]; items?: unknown[] }).data
            ?? (res as { items?: unknown[] }).items
            ?? []);
        const rows: PullRow[] = (items as Array<Record<string, unknown>>).map((o) => {
          const caps = (o.capabilities || {}) as Record<string, { allowed?: boolean }>;
          const status = String(o.status ?? '');
          return {
            id: Number(o.id),
            code: String(o.receipt_code ?? o.receiptCode ?? o.id),
            partnerName: String(o.supplier_name ?? o.supplierName ?? ''),
            amount: Number(o.total_amount ?? o.totalAmount ?? 0),
            status,
            pullable:
              isPurchaseReceiptPosted(status)
              && caps.push_payment_application?.allowed === true,
          };
        });
        return paginatePullRows(filterByPullScope(rows, scope, isPullable), page, pageSize);
      } catch (e) {
        messageApi.error(getApiErrorMessage(e, t('common.loadFailed')));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selected = rows.find((r) => String(r.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t('common.required'));
        return;
      }
      try {
        const app = await pullPaymentApplicationFromPurchaseReceipt({
          purchaseReceiptId: selected.id,
        });
        messageApi.success(
          t('app.kuaizhizao.paymentApplication.createFromReceiptSuccess', {
            code: app.applicationCode,
          }),
        );
        closeReceiptRef.current?.();
        onCreated();
      } catch (e) {
        messageApi.error(getApiErrorMessage(e, t('app.kuaizhizao.paymentApplication.createFailed')));
      }
    },
  });
  closeReceiptRef.current = pullFromReceiptQuery.closeModal;

  const pullFromStatementQuery = useUniPullQuery<PullRow>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (row) => !isPullable(row),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await partnerStatementService.list({
          limit: UNI_PULL_QUERY_MAX_FETCH_LIMIT,
          partner_type: 'Supplier',
          keyword: keyword.trim() || undefined,
        });
        const items = res.items || [];
        const rows: PullRow[] = items.map((s) => {
          const ok = s.status === 'Confirmed' || s.status === 'Sent';
          return {
            id: s.id,
            code: s.statement_code,
            partnerName: s.partner_name,
            amount: Number(s.closing_balance ?? s.debit_total ?? 0),
            status: s.status,
            pullable: ok,
          };
        });
        return paginatePullRows(filterByPullScope(rows, scope, isPullable), page, pageSize);
      } catch (e) {
        messageApi.error(getApiErrorMessage(e, t('common.loadFailed')));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selected = rows.find((r) => String(r.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t('common.required'));
        return;
      }
      try {
        const stmt = await partnerStatementService.get(selected.id);
        if (stmt.partner_type !== 'Supplier') {
          messageApi.warning(t('app.kuaicaiwu.partnerStatement.detail.pushSupplierOnly'));
          return;
        }
        const lines = stmt.transaction_details?.lines || [];
        const payableItems = lines
          .filter(
            (ln) =>
              String(ln.doc_type || '').trim() === '应付单'
              && ln.doc_id != null
              && Number(ln.tree_level ?? 0) === 0
              && Number(ln.statement_amount ?? ln.debit ?? 0) > 0,
          )
          .map((ln) => ({
            doc_type: 'payable',
            doc_id: Number(ln.doc_id),
            amount: Number(
              ln.statement_amount ?? ln.remaining_amount ?? ln.doc_amount ?? ln.debit ?? 0,
            ),
          }))
          .filter((it) => it.amount > 0);
        if (!payableItems.length) {
          messageApi.warning(t('app.kuaicaiwu.partnerStatement.detail.pushSelectPayable'));
          return;
        }
        const app = await pullPaymentApplicationFromReconciliation({
          supplierId: stmt.partner_id,
          items: payableItems,
        });
        messageApi.success(
          t('app.kuaizhizao.paymentApplication.createFromSourceSuccess', {
            code: app.applicationCode,
            source: pullFromStatementAction.sourceLabel,
          }),
        );
        closeStatementRef.current?.();
        onCreated();
      } catch (e) {
        messageApi.error(getApiErrorMessage(e, t('app.kuaizhizao.paymentApplication.createFailed')));
      }
    },
  });
  closeStatementRef.current = pullFromStatementQuery.closeModal;

  const pullFromExpenseQuery = useUniPullQuery<PullRow>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (row) => !isPullable(row),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await otherExpenseService.list({
          skip: 0,
          limit: UNI_PULL_QUERY_MAX_FETCH_LIMIT,
          keyword: keyword.trim() || undefined,
        });
        const items = (res.items || []) as ExpenseWithFinance[];
        const rows: PullRow[] = items
          .filter((e) => String(e.counterparty_kind || '') === 'supplier' && e.counterparty_id)
          .map((e) => ({
            id: e.id,
            code: e.expense_code,
            partnerName: e.counterparty_name,
            amount: Number(e.total_amount || 0),
            status: e.status,
            pullable: Number(e.payable_id || 0) > 0,
          }));
        return paginatePullRows(filterByPullScope(rows, scope, isPullable), page, pageSize);
      } catch (e) {
        messageApi.error(getApiErrorMessage(e, t('common.loadFailed')));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selected = rows.find((r) => String(r.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t('common.required'));
        return;
      }
      try {
        const detail = (await otherExpenseService.get(selected.id)) as ExpenseWithFinance;
        const payableId = Number(detail.payable_id || 0);
        const supplierId = Number(detail.counterparty_id || 0);
        if (!payableId || !supplierId) {
          messageApi.warning(t('app.kuaizhizao.paymentApplication.otherExpenseNoPayable'));
          return;
        }
        const payables = await listPayablesForPaymentApplication(supplierId, { limit: 200 });
        const match = (payables.data ?? []).find((row) => Number(row.payable_id) === payableId);
        const amount = Number(match?.max_request_amount ?? detail.total_amount ?? 0);
        if (!(amount > 0)) {
          messageApi.warning(t('app.kuaizhizao.paymentApplication.otherExpenseNoOpenAmount'));
          return;
        }
        const app = await createPaymentApplication({
          supplierId,
          supplierName: String(detail.counterparty_name ?? selected.partnerName ?? ''),
          items: [
            {
              sourceType: 'other_expense',
              sourceId: selected.id,
              sourceCode: selected.code,
              payableId,
              payableCode: String(detail.payable_code ?? match?.payable_code ?? ''),
              lineKind: 'goods',
              requestAmount: amount,
              lineNo: 1,
            },
          ],
        });
        messageApi.success(
          t('app.kuaizhizao.paymentApplication.createFromSourceSuccess', {
            code: app.applicationCode,
            source: pullFromExpenseAction.sourceLabel,
          }),
        );
        closeExpenseRef.current?.();
        onCreated();
      } catch (e) {
        messageApi.error(getApiErrorMessage(e, t('app.kuaizhizao.paymentApplication.createFailed')));
      }
    },
  });
  closeExpenseRef.current = pullFromExpenseQuery.closeModal;

  const menuItems = useMemo(
    () =>
      buildKuaizhizaoPullCreateMenuItems(t, [
        {
          key: 'pull-from-payable',
          actionKey: 'payment_application.pull_from_payable',
          onClick: onOpenPayablePull,
        },
        {
          key: 'pull-from-po',
          actionKey: 'payment_application.pull_from_purchase_order',
          onClick: pullFromPoQuery.openModal,
        },
        {
          key: 'pull-from-receipt',
          actionKey: 'payment_application.pull_from_purchase_receipt',
          onClick: pullFromReceiptQuery.openModal,
        },
        {
          key: 'pull-from-statement',
          actionKey: 'payment_application.pull_from_partner_statement',
          onClick: pullFromStatementQuery.openModal,
        },
        {
          key: 'pull-from-other-expense',
          actionKey: 'payment_application.pull_from_other_expense',
          onClick: pullFromExpenseQuery.openModal,
        },
      ]),
    [
      onOpenPayablePull,
      pullFromExpenseQuery.openModal,
      pullFromPoQuery.openModal,
      pullFromReceiptQuery.openModal,
      pullFromStatementQuery.openModal,
      t,
    ],
  );

  const renderPullModals = () => (
    <>
      <UniPullQueryModal<PullRow>
        open={pullFromPoQuery.open}
        title={pullFromPoAction.label}
        onCancel={pullFromPoQuery.closeModal}
        onOk={() => void pullFromPoQuery.handleConfirm()}
        rowKey="id"
        columns={columns}
        dataSource={pullFromPoQuery.dataSource}
        loading={pullFromPoQuery.loading}
        confirmLoading={pullFromPoQuery.confirmLoading}
        selectionType={pullFromPoQuery.selectionType}
        selectedRowKeys={pullFromPoQuery.selectedRowKeys}
        selectedRows={pullFromPoQuery.selectedRows}
        onSelectedRowKeysChange={pullFromPoQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromPoQuery.isRowDisabled}
        searchDraft={pullFromPoQuery.searchDraft}
        onSearchDraftChange={pullFromPoQuery.setSearchDraft}
        onSearchApply={pullFromPoQuery.handleSearchApply}
        onSearchClear={pullFromPoQuery.handleSearchClear}
        appliedKeyword={pullFromPoQuery.appliedKeyword}
        page={pullFromPoQuery.page}
        pageSize={pullFromPoQuery.pageSize}
        total={pullFromPoQuery.total}
        onPageChange={pullFromPoQuery.handlePageChange}
        scopeOptions={pullFromPoQuery.scopeOptions}
        scope={pullFromPoQuery.scope}
        onScopeChange={pullFromPoQuery.handleScopeChange}
      />
      <UniPullQueryModal<PullRow>
        open={pullFromReceiptQuery.open}
        title={pullFromReceiptAction.label}
        onCancel={pullFromReceiptQuery.closeModal}
        onOk={() => void pullFromReceiptQuery.handleConfirm()}
        rowKey="id"
        columns={columns}
        dataSource={pullFromReceiptQuery.dataSource}
        loading={pullFromReceiptQuery.loading}
        confirmLoading={pullFromReceiptQuery.confirmLoading}
        selectionType={pullFromReceiptQuery.selectionType}
        selectedRowKeys={pullFromReceiptQuery.selectedRowKeys}
        selectedRows={pullFromReceiptQuery.selectedRows}
        onSelectedRowKeysChange={pullFromReceiptQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromReceiptQuery.isRowDisabled}
        searchDraft={pullFromReceiptQuery.searchDraft}
        onSearchDraftChange={pullFromReceiptQuery.setSearchDraft}
        onSearchApply={pullFromReceiptQuery.handleSearchApply}
        onSearchClear={pullFromReceiptQuery.handleSearchClear}
        appliedKeyword={pullFromReceiptQuery.appliedKeyword}
        page={pullFromReceiptQuery.page}
        pageSize={pullFromReceiptQuery.pageSize}
        total={pullFromReceiptQuery.total}
        onPageChange={pullFromReceiptQuery.handlePageChange}
        scopeOptions={pullFromReceiptQuery.scopeOptions}
        scope={pullFromReceiptQuery.scope}
        onScopeChange={pullFromReceiptQuery.handleScopeChange}
      />
      <UniPullQueryModal<PullRow>
        open={pullFromStatementQuery.open}
        title={pullFromStatementAction.label}
        onCancel={pullFromStatementQuery.closeModal}
        onOk={() => void pullFromStatementQuery.handleConfirm()}
        rowKey="id"
        columns={columns}
        dataSource={pullFromStatementQuery.dataSource}
        loading={pullFromStatementQuery.loading}
        confirmLoading={pullFromStatementQuery.confirmLoading}
        selectionType={pullFromStatementQuery.selectionType}
        selectedRowKeys={pullFromStatementQuery.selectedRowKeys}
        selectedRows={pullFromStatementQuery.selectedRows}
        onSelectedRowKeysChange={pullFromStatementQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromStatementQuery.isRowDisabled}
        searchDraft={pullFromStatementQuery.searchDraft}
        onSearchDraftChange={pullFromStatementQuery.setSearchDraft}
        onSearchApply={pullFromStatementQuery.handleSearchApply}
        onSearchClear={pullFromStatementQuery.handleSearchClear}
        appliedKeyword={pullFromStatementQuery.appliedKeyword}
        page={pullFromStatementQuery.page}
        pageSize={pullFromStatementQuery.pageSize}
        total={pullFromStatementQuery.total}
        onPageChange={pullFromStatementQuery.handlePageChange}
        scopeOptions={pullFromStatementQuery.scopeOptions}
        scope={pullFromStatementQuery.scope}
        onScopeChange={pullFromStatementQuery.handleScopeChange}
      />
      <UniPullQueryModal<PullRow>
        open={pullFromExpenseQuery.open}
        title={pullFromExpenseAction.label}
        onCancel={pullFromExpenseQuery.closeModal}
        onOk={() => void pullFromExpenseQuery.handleConfirm()}
        rowKey="id"
        columns={columns}
        dataSource={pullFromExpenseQuery.dataSource}
        loading={pullFromExpenseQuery.loading}
        confirmLoading={pullFromExpenseQuery.confirmLoading}
        selectionType={pullFromExpenseQuery.selectionType}
        selectedRowKeys={pullFromExpenseQuery.selectedRowKeys}
        selectedRows={pullFromExpenseQuery.selectedRows}
        onSelectedRowKeysChange={pullFromExpenseQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromExpenseQuery.isRowDisabled}
        searchDraft={pullFromExpenseQuery.searchDraft}
        onSearchDraftChange={pullFromExpenseQuery.setSearchDraft}
        onSearchApply={pullFromExpenseQuery.handleSearchApply}
        onSearchClear={pullFromExpenseQuery.handleSearchClear}
        appliedKeyword={pullFromExpenseQuery.appliedKeyword}
        page={pullFromExpenseQuery.page}
        pageSize={pullFromExpenseQuery.pageSize}
        total={pullFromExpenseQuery.total}
        onPageChange={pullFromExpenseQuery.handlePageChange}
        scopeOptions={pullFromExpenseQuery.scopeOptions}
        scope={pullFromExpenseQuery.scope}
        onScopeChange={pullFromExpenseQuery.handleScopeChange}
      />
    </>
  );

  return { menuItems, renderPullModals };
}

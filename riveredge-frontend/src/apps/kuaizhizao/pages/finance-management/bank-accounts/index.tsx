import { rowActionKind, rowActionViewBankFlow } from '../../../../../components/uni-action';
import React, { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import {
  ProFormDependency,
  ProFormMoney,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  App,
  Alert,
  Button,
  DatePicker,
  Form as AntForm,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { bankAccountService, type BankAccount } from '../../../services/finance/bank-account';
import { getCurrencySelectOptions, formatBankDirection, formatCurrency } from '../../../utils/financeUiLabels';
import {
  bankAccountSearchColumns,
  FINANCE_CRUD_PINNED_ACTIVE_FIELD,
  financeDocCreatedUpdatedColumns,
  resolveBankAccountListParams,
  resolveBankTransactionListParams,
} from '../../../utils/financeListCore';
import {
  renderFinanceActiveTag,
  renderFinanceDirectionTag,
  renderFinanceTypeMarker,
} from '../../../utils/financeListPresentation';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import { formatDateTime } from '../../../../../utils/format';
import { normalizeFormListItems } from '../../../../../utils/formListItems';

type BankTx = Record<string, unknown>;

type StatementLine = {
  transaction_date?: Dayjs | string | null;
  direction?: 'in' | 'out' | string;
  amount?: number | null;
  summary?: string;
};

const BA = 'app.kuaicaiwu.bankAccount';

const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function normalizeStatementDirection(raw: string): 'in' | 'out' | null {
  const val = String(raw || '').trim().toLowerCase();
  if (['in', '收入', '收', 'credit', 'cr', '+'].includes(val)) return 'in';
  if (['out', '支出', '付', 'debit', 'dr', '-'].includes(val)) return 'out';
  return null;
}

function createEmptyStatementLine(): StatementLine {
  return {
    transaction_date: dayjs(),
    direction: 'in',
    amount: undefined,
    summary: '',
  };
}

const BankAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const txRef = useRef<ActionType>();
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [txDrawerOpen, setTxDrawerOpen] = useState(false);
  const [txAccount, setTxAccount] = useState<BankAccount | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [importFormOpen, setImportFormOpen] = useState(false);
  const [uniImportOpen, setUniImportOpen] = useState(false);
  const [importAccount, setImportAccount] = useState<BankAccount | null>(null);
  const importFormRef = useRef<ProFormInstance>();

  const directionInLabel = t('app.kuaicaiwu.financeUi.bankDirection.in');
  const directionOutLabel = t('app.kuaicaiwu.financeUi.bankDirection.out');

  const statementImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          {
            field: 'transactionDate',
            required: true,
            labelKey: `${BA}.import.transactionDate`,
            aliases: ['交易日期', 'transaction_date', 'date', 'Date'],
          },
          {
            field: 'direction',
            required: true,
            labelKey: `${BA}.import.direction`,
            aliases: ['收支方向', '方向', 'direction', 'Direction'],
            options: [directionInLabel, directionOutLabel],
          },
          {
            field: 'amount',
            required: true,
            labelKey: `${BA}.import.amount`,
            aliases: ['金额', 'amount', 'Amount'],
          },
          {
            field: 'summary',
            labelKey: `${BA}.col.summary`,
            aliases: ['摘要', '备注', 'summary', 'Summary'],
          },
        ],
        [
          t(`${BA}.importExample.transactionDate`),
          directionInLabel,
          t(`${BA}.importExample.amount`),
          t(`${BA}.importExample.summary`),
        ],
      ),
    [t, directionInLabel, directionOutLabel],
  );

  const statementLineColumns = useMemo<ColumnsType<StatementLine>>(
    () => [
      {
        title: t(`${BA}.import.transactionDate`),
        dataIndex: 'transaction_date',
        width: 160,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item
            name={[index, 'transaction_date']}
            rules={[{ required: true, message: t('common.required') }]}
            style={{ marginBottom: 0 }}
          >
            <DatePicker style={{ width: '100%' }} />
          </AntForm.Item>
        ),
      },
      {
        title: t(`${BA}.import.direction`),
        dataIndex: 'direction',
        width: 120,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item
            name={[index, 'direction']}
            rules={[{ required: true, message: t('common.required') }]}
            style={{ marginBottom: 0 }}
          >
            <Select
              options={[
                { value: 'in', label: directionInLabel },
                { value: 'out', label: directionOutLabel },
              ]}
            />
          </AntForm.Item>
        ),
      },
      {
        title: t(`${BA}.import.amount`),
        dataIndex: 'amount',
        width: 140,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item
            name={[index, 'amount']}
            rules={[{ required: true, message: t('common.required') }]}
            style={{ marginBottom: 0 }}
          >
            <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
          </AntForm.Item>
        ),
      },
      {
        title: t(`${BA}.col.summary`),
        dataIndex: 'summary',
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'summary']} style={{ marginBottom: 0 }}>
            <Input maxLength={200} />
          </AntForm.Item>
        ),
      },
    ],
    [directionInLabel, directionOutLabel, t],
  );

  /** UniImport：灌入表单明细，不直接提交 */
  const handleUniImportFillLines = useCallback(
    (data: unknown[][]) => {
      const headers = (data[0] || []).map((h) => String(h ?? '').trim());
      const headerIndexMap = resolveFactoryImportHeaderIndexMap(
        headers,
        statementImportTemplate.importHeaderMap,
      );
      if (
        headerIndexMap.transactionDate === undefined
        || headerIndexMap.direction === undefined
        || headerIndexMap.amount === undefined
      ) {
        messageApi.error(t(`${BA}.importHeaderError`));
        return false;
      }
      const importRows = data.slice(2).filter((row) =>
        Array.isArray(row) && row.some((c) => c != null && String(c).trim() !== ''),
      );
      const newLines: StatementLine[] = [];
      for (const row of importRows) {
        const dateRaw = row[headerIndexMap.transactionDate];
        const direction = normalizeStatementDirection(String(row[headerIndexMap.direction] ?? ''));
        const amountRaw = String(row[headerIndexMap.amount] ?? '').trim().replace(/,/g, '');
        const amount = Number(amountRaw);
        const summary =
          headerIndexMap.summary !== undefined
            ? String(row[headerIndexMap.summary] ?? '').trim()
            : '';
        if (!dateRaw || !direction || !(amount > 0)) continue;
        const dateStr = formatDateTime(dateRaw as string | Date | number, 'YYYY-MM-DD');
        if (!dateStr || dateStr === '-') continue;
        newLines.push({
          transaction_date: dayjs(dateStr),
          direction,
          amount,
          summary,
        });
      }
      if (newLines.length === 0) {
        messageApi.warning(t('app.kuaicaiwu.common.importNoValidRows'));
        return false;
      }
      const current = normalizeFormListItems<StatementLine>(
        importFormRef.current?.getFieldValue('lines'),
      );
      const keep = current.filter(
        (row) => Number(row?.amount) > 0 || String(row?.summary || '').trim().length > 0,
      );
      importFormRef.current?.setFieldsValue({
        lines: [...keep, ...newLines],
      });
      messageApi.success(t(`${BA}.importFilledLines`, { count: newLines.length }));
      setUniImportOpen(false);
      return true;
    },
    [messageApi, statementImportTemplate.importHeaderMap, t],
  );

  const handleImportFormFinish = useCallback(
    async (values: { lines?: StatementLine[] }) => {
      if (!importAccount) return;
      const lines = normalizeFormListItems<StatementLine>(values.lines).filter((row) => {
        const amount = Number(row.amount);
        return row.transaction_date && row.direction && amount > 0;
      });
      if (lines.length === 0) {
        messageApi.warning(t('app.kuaicaiwu.common.importNoValidRows'));
        throw new Error('no valid statement lines');
      }
      const csvLines = ['transaction_date,direction,amount,summary'];
      for (const row of lines) {
        const dateStr = formatDateTime(
          row.transaction_date as string | Date | number,
          'YYYY-MM-DD',
        );
        const direction = normalizeStatementDirection(String(row.direction || ''));
        const amount = Number(row.amount);
        if (!dateStr || dateStr === '-' || !direction || !(amount > 0)) continue;
        csvLines.push(
          [
            escapeCsvCell(dateStr),
            escapeCsvCell(direction),
            escapeCsvCell(String(amount)),
            escapeCsvCell(String(row.summary || '').trim()),
          ].join(','),
        );
      }
      if (csvLines.length <= 1) {
        messageApi.warning(t('app.kuaicaiwu.common.importNoValidRows'));
        throw new Error('no valid statement lines');
      }
      const result = await bankAccountService.importStatement(
        importAccount.id,
        csvLines.join('\n'),
      );
      messageApi.success(
        t(`${BA}.importSuccess`, {
          count: result.imported_count,
          balance: result.current_balance,
        }),
      );
      setImportFormOpen(false);
      setImportAccount(null);
      actionRef.current?.reload();
    },
    [importAccount, messageApi, t],
  );

  const activeValueEnum = useMemo(
    () => ({
      true: { text: t('common.enabled') },
      false: { text: t(`${BA}.status.disabled`) },
    }),
    [t],
  );

  const columns: ProColumns<BankAccount>[] = useMemo(() => [
    ...bankAccountSearchColumns({
      accountCode: t(`${BA}.col.accountCode`),
      accountName: t(`${BA}.col.accountName`),
      bankName: t(`${BA}.col.bankName`),
      accountNumber: t(`${BA}.col.accountNumber`),
    }),
    {
      title: t(`${BA}.col.accountCode`),
      key: 'finance_bank_account_code',
      dataIndex: 'account_code',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${BA}.col.accountName`),
      key: 'finance_bank_account_name',
      dataIndex: 'account_name',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${BA}.col.accountType`),
      key: 'finance_bank_account_type',
      dataIndex: 'account_type',
      ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
      hideInSearch: true,
      sorter: true,
      render: (_, r) =>
        renderFinanceTypeMarker(
          String(r.account_type || 'bank') === 'cash'
            ? t(`${BA}.accountType.cash`)
            : t(`${BA}.accountType.bank`),
          String(r.account_type || 'bank') === 'cash' ? 'warning' : 'processing',
        ),
    },
    {
      // 开户行长短不一：唯一 RemainderFlex（列表无备注列）
      title: t(`${BA}.col.bankName`),
      key: 'finance_bank_name',
      dataIndex: 'bank_name',
      minWidth: 140,
      uniTableRemainderFlex: true,
      uniTablePrimaryFlex: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
      render: (_, r) => r.bank_name || '—',
    },
    {
      title: t(`${BA}.col.accountNumber`),
      key: 'finance_bank_account_number',
      dataIndex: 'account_number',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
      render: (_, r) => r.account_number || '—',
    },
    {
      title: t(`${BA}.col.currency`),
      key: 'finance_bank_currency',
      dataIndex: 'currency',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
      render: (_, r) => formatCurrency(String(r.currency ?? ''), t),
    },
    {
      title: t(`${BA}.col.balance`),
      key: 'finance_bank_balance',
      dataIndex: 'current_balance',
      valueType: 'money',
      align: 'right',
      width: 130,
      minWidth: 130,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
      hideInSearch: true,
      sorter: true,
      valueType: 'select',
      valueEnum: activeValueEnum,
      render: (_, r) => renderFinanceActiveTag(t, r.is_active, 'common.enabled', `${BA}.status.disabled`),
    },
    ...financeDocCreatedUpdatedColumns<BankAccount>(t),
    {
      title: t('common.actions'),
      key: 'action',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const isCash = String(record.account_type || 'bank') === 'cash';
        return [
          <Button
            key="tx"
            type="link"
            size="small"
            {...rowActionViewBankFlow('read')}
            onClick={() => {
              setTxAccount(record);
              setTxDrawerOpen(true);
            }}
          />,
          isCash ? null : (
            <Button
              key="import"
              type="link"
              size="small"
              {...rowActionKind('import')}
              onClick={() => {
                setImportAccount(record);
                setImportFormOpen(true);
              }}
            />
          ),
          <Button
            key="edit"
            type="link"
            size="small"
            {...rowActionKind('update')}
            onClick={() => {
              setEditing(record);
              setModalVisible(true);
            }}
          />,
          <Popconfirm
            key="del"
            title={t(`${BA}.confirmDelete`)}
            onConfirm={async () => {
              await bankAccountService.delete(record.id);
              messageApi.success(t('common.deleteSuccess'));
    actionRef.current?.reload();
            }}
          >
            <Button type="link" size="small" {...rowActionKind('delete')} />
          </Popconfirm>,
        ];
      },
    },
  ], [t, messageApi, activeValueEnum]);

  const txColumns: ProColumns<BankTx>[] = useMemo(() => [
    {
      title: t(`${BA}.col.sourceCode`),
      dataIndex: 'source_doc_code',
      hideInTable: true,
      order: 10,
      fieldProps: { allowClear: true },
    },
    {
      title: t(`${BA}.col.direction`),
      dataIndex: 'direction',
      hideInTable: true,
      order: 11,
      valueType: 'select',
      fieldProps: { allowClear: true },
      valueEnum: {
        in: { text: formatBankDirection('in', t) },
        out: { text: formatBankDirection('out', t) },
      },
    },
    {
      title: t(`${BA}.col.date`),
      dataIndex: 'transaction_date',
      valueType: 'date',
      width: 132,
      minWidth: 132,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t(`${BA}.col.date`),
      dataIndex: 'transaction_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      order: 12,
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t(`${BA}.col.direction`),
      dataIndex: 'direction',
      ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
      hideInSearch: true,
      sorter: true,
      render: (_, r) => renderFinanceDirectionTag(t, String(r.direction ?? '')),
    },
    {
      title: t('app.kuaicaiwu.invoice.line.amount'),
      dataIndex: 'amount',
      valueType: 'money',
      align: 'right',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${BA}.col.balance`),
      dataIndex: 'balance_after',
      valueType: 'money',
      align: 'right',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${BA}.col.sourceCode`),
      dataIndex: 'source_doc_code',
      width: 140,
      minWidth: 140,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
    },
    {
      // 摘要长短不一：流水表唯一 RemainderFlex
      title: t(`${BA}.col.summary`),
      key: 'finance_bank_tx_summary',
      dataIndex: 'summary',
      minWidth: 160,
      uniTableRemainderFlex: true,
      uniTablePrimaryFlex: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
    },
    ...financeDocCreatedUpdatedColumns<BankTx>(t),
  ], [t]);

  const handleBatchDelete = async (keys: React.Key[]) => {
    for (const key of keys) {
      await bankAccountService.delete(Number(key));
    }
    messageApi.success(t(`${BA}.batchDeleted`, { count: keys.length }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const handleBatchSetActive = async (keys: React.Key[], isActive: boolean) => {
    for (const key of keys) {
      await bankAccountService.update(Number(key), { is_active: isActive });
    }
    messageApi.success(t(isActive ? `${BA}.batchEnabled` : `${BA}.batchDisabled`, { count: keys.length }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  return (
    <ListPageTemplate>
      <UniTable<BankAccount>
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="id"
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.bankAccount)}
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.bank-accounts.list-v2"
        columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={FINANCE_CRUD_PINNED_ACTIVE_FIELD}
        request={async (params, sort, _filter, searchFormValues) => {
          const { current, pageSize } = params;
          const listParams = resolveBankAccountListParams(searchFormValues, sort);
          lastListParamsRef.current = listParams;
          try {
            const res = await bankAccountService.list({
              skip: ((current || 1) - 1) * (pageSize || 20),
              limit: pageSize || 20,
              ...listParams,
            });
            return { data: res.data, total: res.total, success: true };
          } catch (error: unknown) {
            const err = error as { message?: string };
            messageApi.error(err?.message || t('app.kuaicaiwu.common.loadListFailed'));
            return { data: [], total: 0, success: false };
          }
        }}
        showCreateButton
        createButtonText={t(`${BA}.createButton`)}
        onCreate={() => { setEditing(null); setModalVisible(true); }}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('app.kuaicaiwu.common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t(`${BA}.batchDeleteConfirm`, { count })}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="bank-account-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('components.uniBatch.batchActions')}
            menuItems={[
              {
                key: 'batch-enable',
                label: t(`${BA}.batchEnable`),
                onClick: (keys) => handleBatchSetActive(keys, true),
              },
              {
                key: 'batch-disable',
                label: t(`${BA}.batchDisable`),
                onClick: (keys) => handleBatchSetActive(keys, false),
              },
            ]}
          />,
        ]}
      />

      <DetailDrawerTemplate
        title={txAccount
          ? t(`${BA}.transactionsTitleWithAccount`, { name: txAccount.account_name })
          : t(`${BA}.transactionsTitle`)}
        open={txDrawerOpen}
        onClose={() => setTxDrawerOpen(false)}
        size={DRAWER_CONFIG.HALF_WIDTH}
        plainBody={
          <UniTable<BankTx>
            // 抽屉 destroyOnHidden=false：切账户必须把 accountId 打进 params/queryKey，
            // 否则同一 persistenceId 会复用上一账户流水缓存，表现为「一笔入账出现在两个账户」。
            key={txAccount ? `bank-tx-${txAccount.id}` : 'bank-tx-none'}
            actionRef={txRef}
            enableRowSelection
            rowKey="id"
            columnPersistenceId="apps.kuaicaiwu.pages.finance-management.bank-accounts.transactions.list-v3"
            params={{ bankAccountId: txAccount?.id }}
            tanstackQuery={{
              queryKeyPrefix: [
                'apps.kuaicaiwu.pages.finance-management.bank-accounts.transactions.list-v3',
                txAccount?.id ?? 0,
              ],
            }}
            columns={alignProColumns(txColumns, SALES_DOC_LIST_FIELD_RANK)}
            showAdvancedSearch
            skipFuzzyPinyinClientFilter
            request={async (params, sort, _filter, searchFormValues) => {
              const accountId = Number(params.bankAccountId ?? txAccount?.id);
              if (!Number.isFinite(accountId) || accountId <= 0) {
                return { data: [], success: true, total: 0 };
              }
              const { current, pageSize } = params;
              const listParams = resolveBankTransactionListParams(searchFormValues, sort);
              try {
                const res = await bankAccountService.listTransactions(accountId, {
                  skip: ((current || 1) - 1) * (pageSize || 20),
                  limit: pageSize || 20,
                  ...listParams,
                });
                return { data: res.data, total: res.total, success: true };
              } catch (error: unknown) {
                const err = error as { message?: string };
                messageApi.error(err?.message || t('app.kuaicaiwu.common.loadListFailed'));
                return { data: [], total: 0, success: false };
              }
            }}
            pagination={{ pageSize: 20 }}
            toolBarRender={false}
          />
        }
      />

      <FormModalTemplate
        key={importAccount ? `import-statement-${importAccount.id}` : 'import-statement'}
        title={
          importAccount
            ? t(`${BA}.importTitleWithAccount`, { name: importAccount.account_name })
            : t(`${BA}.importStatementTitle`)
        }
        open={importFormOpen}
        onClose={() => {
          setImportFormOpen(false);
          setUniImportOpen(false);
          setImportAccount(null);
        }}
        formRef={importFormRef}
        grid={false}
        width={MODAL_CONFIG.LARGE_WIDTH}
        submitText={t('common.save')}
        initialValues={{ lines: [createEmptyStatementLine()] }}
        onFinish={handleImportFormFinish}
      >
        <Alert
          type="info"
          showIcon
          title={t(`${BA}.importHint`)}
          style={{ marginBottom: 12 }}
        />
        <UniTableDetail
          name="lines"
          title={t(`${BA}.import.linesTitle`)}
          required
          requiredMessage={t(`${BA}.import.linesRequired`)}
          columns={statementLineColumns}
          initialValue={createEmptyStatementLine}
          minRows={1}
          onImport={() => setUniImportOpen(true)}
          importText={t('common.importDetail')}
        />
      </FormModalTemplate>

      <Suspense fallback={null}>
        <LazyUniImport
          open={uniImportOpen}
          onCancel={() => setUniImportOpen(false)}
          onConfirm={handleUniImportFillLines}
          title={t(`${BA}.importUniImportTitle`)}
          headers={statementImportTemplate.importHeaders}
          exampleRow={statementImportTemplate.importExampleRow}
          columnOptions={statementImportTemplate.importColumnOptions}
        />
      </Suspense>

      <FormModalTemplate
        title={editing ? t(`${BA}.editTitle`) : t(`${BA}.createTitle`)}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        isEdit={!!editing}
        onFinish={async (values) => {
          const isCash = values.account_type === 'cash';
          const payload = {
            ...values,
            bank_name: isCash ? null : values.bank_name,
            account_number: isCash ? null : values.account_number,
            attachments: normalizeDocumentAttachments(values.attachments),
          };
          if (editing) {
            await bankAccountService.update(editing.id, payload);
            messageApi.success(t('common.updateSuccess'));
          } else {
            await bankAccountService.create(payload);
            messageApi.success(t('common.createSuccess'));
          }
          setModalVisible(false);
    actionRef.current?.reload();
        }}
        initialValues={
          editing
            ? {
                ...editing,
                account_type: editing.account_type || 'bank',
                attachments: mapAttachmentsToUploadList(editing.attachments),
              }
            : { currency: 'CNY', is_active: true, account_type: 'bank' }
        }
      >
        <ProFormText name="account_code" label={t(`${BA}.col.accountCode`)} rules={[{ required: true }]} disabled={!!editing} />
        <ProFormText name="account_name" label={t(`${BA}.col.accountName`)} rules={[{ required: true }]} />
        <ProFormSelect
          name="account_type"
          label={t(`${BA}.col.accountType`)}
          rules={[{ required: true }]}
          disabled={!!editing}
          options={[
            { label: t(`${BA}.accountType.bank`), value: 'bank' },
            { label: t(`${BA}.accountType.cash`), value: 'cash' },
          ]}
        />
        <ProFormDependency name={['account_type']}>
          {({ account_type }) => {
            const isCash = account_type === 'cash';
            return (
              <>
                {isCash ? (
                  <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
                    {t(`${BA}.cashHint`)}
                  </Typography.Paragraph>
                ) : null}
                <ProFormText
                  name="bank_name"
                  label={t(`${BA}.col.bankName`)}
                  rules={isCash ? [] : [{ required: true }]}
                  hidden={isCash}
                />
                <ProFormText
                  name="account_number"
                  label={t(`${BA}.form.accountNumber`)}
                  rules={isCash ? [] : [{ required: true }]}
                  hidden={isCash}
                />
              </>
            );
          }}
        </ProFormDependency>
        <ProFormSelect name="currency" label={t(`${BA}.col.currency`)} options={getCurrencySelectOptions(t)} />
        {!editing && <ProFormMoney name="opening_balance" label={t(`${BA}.col.openingBalance`)} min={0} />}
        {editing && (
          <ProFormSelect
            name="is_active"
            label={t('common.status')}
            options={[
              { label: t('common.enabled'), value: true },
              { label: t(`${BA}.status.disabled`), value: false },
            ]}
          />
        )}
        <ProFormTextArea name="notes" label={t('common.remark')} />
        <DocumentAttachmentsField category="bank_account_attachments" />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default BankAccountsPage;

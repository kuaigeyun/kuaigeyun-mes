import { rowActionKind } from '../../../../../components/uni-action';
import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ProFormDependency,
  ProFormMoney,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Popconfirm, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
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
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';

type BankTx = Record<string, unknown>;

const BA = 'app.kuaicaiwu.bankAccount';

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
  const [importOpen, setImportOpen] = useState(false);
  const [importAccount, setImportAccount] = useState<BankAccount | null>(null);

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
      title: t(`${BA}.col.accountName`),
      key: 'finance_doc_partner_stacked',
      dataIndex: 'account_name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      hideInSearch: true,
      sorter: true,
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.account_name ?? '')}
          secondary={String(r.account_code ?? '')}
        />
      ),
    },
    { title: t(`${BA}.col.accountCode`), dataIndex: 'account_code', hideInTable: true },
    {
      title: t(`${BA}.col.accountType`),
      dataIndex: 'account_type',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
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
      title: t(`${BA}.col.bankName`),
      dataIndex: 'bank_name',
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
      render: (_, r) => r.bank_name || '—',
    },
    {
      title: t(`${BA}.col.accountNumber`),
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
      dataIndex: 'currency',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
      render: (_, r) => formatCurrency(String(r.currency ?? ''), t),
    },
    { title: t(`${BA}.col.balance`), dataIndex: 'current_balance', valueType: 'money', align: 'right', hideInSearch: true, sorter: true },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      width: 80,
      minWidth: 80,
      uniTableKeepWidth: true,
      resizable: false,
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
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const isCash = String(record.account_type || 'bank') === 'cash';
        return [
          <a key="tx" onClick={() => { setTxAccount(record); setTxDrawerOpen(true); }}>{t(`${BA}.action.transactions`)}</a>,
          isCash ? null : (
            <a key="import" onClick={() => { setImportAccount(record); setImportOpen(true); }}>{t('common.import')}</a>
          ),
          <a key="edit" onClick={() => { setEditing(record); setModalVisible(true); }}>{t('common.edit')}</a>,
          <Popconfirm {...rowActionKind('delete')}
            key="del"
            title={t(`${BA}.confirmDelete`)}
            onConfirm={async () => {
              await bankAccountService.delete(record.id);
              messageApi.success(t('common.deleteSuccess'));
              actionRef.current?.reload();
            }}
          >
            <a>{t('common.delete')}</a>
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
      width: 80,
      minWidth: 80,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
      render: (_, r) => renderFinanceDirectionTag(t, String(r.direction ?? '')),
    },
    { title: t('app.kuaicaiwu.invoice.line.amount'), dataIndex: 'amount', valueType: 'money', align: 'right', hideInSearch: true, sorter: true },
    { title: t(`${BA}.col.balance`), dataIndex: 'balance_after', valueType: 'money', align: 'right', hideInSearch: true, sorter: true },
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
    { title: t(`${BA}.col.summary`), dataIndex: 'summary', ellipsis: true, hideInSearch: true, sorter: true },
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
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.bank-accounts.list-v1"
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
        width={DRAWER_CONFIG.HALF_WIDTH}
        plainBody={
          <UniTable<BankTx>
            actionRef={txRef}
            enableRowSelection
            rowKey="id"
            columnPersistenceId="apps.kuaicaiwu.pages.finance-management.bank-accounts.transactions.list-v1"
            columns={alignProColumns(txColumns, SALES_DOC_LIST_FIELD_RANK)}
            showAdvancedSearch
            skipFuzzyPinyinClientFilter
            request={async (params, sort, _filter, searchFormValues) => {
              if (!txAccount) return { data: [], success: true, total: 0 };
              const { current, pageSize } = params;
              const listParams = resolveBankTransactionListParams(searchFormValues, sort);
              try {
                const res = await bankAccountService.listTransactions(txAccount.id, {
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
        title={importAccount
          ? t(`${BA}.importTitleWithAccount`, { name: importAccount.account_name })
          : t(`${BA}.importStatementTitle`)}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        width={MODAL_CONFIG.LARGE_WIDTH}
        onFinish={async (values) => {
          if (!importAccount) return;
          const result = await bankAccountService.importStatement(importAccount.id, values.csv_content);
          messageApi.success(t(`${BA}.importSuccess`, {
            count: result.imported_count,
            balance: result.current_balance,
          }));
          setImportOpen(false);
          actionRef.current?.reload();
        }}
      >
        <p style={{ color: 'var(--ant-color-text-secondary)', marginBottom: 8 }}>
          {t(`${BA}.importHint`)}
        </p>
        <ProFormTextArea
          name="csv_content"
          label={t(`${BA}.importContent`)}
          rules={[{ required: true, message: t(`${BA}.importContentRequired`) }]}
          fieldProps={{
            rows: 10,
            placeholder: t(`${BA}.importPlaceholder`),
          }}
        />
      </FormModalTemplate>

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

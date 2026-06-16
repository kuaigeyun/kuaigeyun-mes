import { rowActionKind } from '../../../../../components/uni-action';
import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProFormMoney, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Popconfirm, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { bankAccountService, type BankAccount } from '../../../services/finance/bank-account';
import { getCurrencySelectOptions, formatBankDirection, formatCurrency } from '../../../utils/financeUiLabels';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';

type BankTx = Record<string, unknown>;

const BA = 'app.kuaicaiwu.bankAccount';

const BankAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const txRef = useRef<ActionType>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [txDrawerOpen, setTxDrawerOpen] = useState(false);
  const [txAccount, setTxAccount] = useState<BankAccount | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importAccount, setImportAccount] = useState<BankAccount | null>(null);

  const columns: ProColumns<BankAccount>[] = useMemo(() => [
    { title: t(`${BA}.col.accountCode`), dataIndex: 'account_code', width: 120 },
    { title: t(`${BA}.col.accountName`), dataIndex: 'account_name', ellipsis: true },
    { title: t(`${BA}.col.bankName`), dataIndex: 'bank_name', ellipsis: true },
    { title: t(`${BA}.col.accountNumber`), dataIndex: 'account_number', width: 180, ellipsis: true },
    { title: t(`${BA}.col.currency`), dataIndex: 'currency', width: 100, render: (_, r) => formatCurrency(String(r.currency ?? ''), t) },
    { title: t(`${BA}.col.balance`), dataIndex: 'current_balance', valueType: 'money', align: 'right' },
    {
      title: t(`${BA}.col.status`),
      dataIndex: 'is_active',
      width: 80,
      render: (_, r) => (r.is_active
        ? <Tag color="success">{t(`${BA}.status.enabled`)}</Tag>
        : <Tag>{t(`${BA}.status.disabled`)}</Tag>),
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 180,
      render: (_, record) => [
        <a key="tx" onClick={() => { setTxAccount(record); setTxDrawerOpen(true); }}>{t(`${BA}.action.transactions`)}</a>,
        <a key="import" onClick={() => { setImportAccount(record); setImportOpen(true); }}>{t(`${BA}.action.import`)}</a>,
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
      ],
    },
  ], [t, messageApi]);

  const txColumns: ProColumns<BankTx>[] = useMemo(() => [
    { title: t(`${BA}.col.date`), dataIndex: 'transaction_date', valueType: 'date', width: 120 },
    {
      title: t(`${BA}.col.direction`),
      dataIndex: 'direction',
      width: 80,
      render: (_, r) => {
        const direction = String(r.direction ?? '');
        const label = formatBankDirection(direction, t);
        if (direction === 'in') return <Tag color="green">{label}</Tag>;
        if (direction === 'out') return <Tag color="red">{label}</Tag>;
        return <Tag>{label}</Tag>;
      },
    },
    { title: t('app.kuaicaiwu.invoice.line.amount'), dataIndex: 'amount', valueType: 'money', align: 'right' },
    { title: t(`${BA}.col.balance`), dataIndex: 'balance_after', valueType: 'money', align: 'right' },
    { title: t(`${BA}.col.sourceCode`), dataIndex: 'source_doc_code', width: 140, ellipsis: true },
    { title: t(`${BA}.col.summary`), dataIndex: 'summary', ellipsis: true },
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
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.bank-accounts"
        columns={columns}
        request={async () => {
          const list = await bankAccountService.list({ limit: 200 });
          return { data: list, success: true, total: list.length };
        }}
        search={false}
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
            columnPersistenceId="apps.kuaicaiwu.pages.finance-management.bank-accounts.transactions"
            columns={txColumns}
            request={async () => {
              if (!txAccount) return { data: [], success: true, total: 0 };
              const list = await bankAccountService.listTransactions(txAccount.id, { limit: 200 });
              return { data: list, success: true, total: list.length };
            }}
            search={false}
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
          const payload = {
            ...values,
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
            ? { ...editing, attachments: mapAttachmentsToUploadList(editing.attachments) }
            : { currency: 'CNY', is_active: true }
        }
      >
        <ProFormText name="account_code" label={t(`${BA}.col.accountCode`)} rules={[{ required: true }]} disabled={!!editing} />
        <ProFormText name="account_name" label={t(`${BA}.col.accountName`)} rules={[{ required: true }]} />
        <ProFormText name="bank_name" label={t(`${BA}.col.bankName`)} rules={[{ required: true }]} />
        <ProFormText name="account_number" label={t(`${BA}.form.accountNumber`)} rules={[{ required: true }]} />
        <ProFormSelect name="currency" label={t(`${BA}.col.currency`)} options={getCurrencySelectOptions(t)} />
        {!editing && <ProFormMoney name="opening_balance" label={t(`${BA}.col.openingBalance`)} min={0} />}
        {editing && (
          <ProFormSelect
            name="is_active"
            label={t(`${BA}.col.status`)}
            options={[
              { label: t(`${BA}.status.enabled`), value: true },
              { label: t(`${BA}.status.disabled`), value: false },
            ]}
          />
        )}
        <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} />
        <DocumentAttachmentsField category="bank_account_attachments" />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default BankAccountsPage;

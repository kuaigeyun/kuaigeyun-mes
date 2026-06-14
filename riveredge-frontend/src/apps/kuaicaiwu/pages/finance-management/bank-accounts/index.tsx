import { rowActionKind } from '../../../../../components/uni-action';
import React, { useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProFormMoney, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Popconfirm, Tag } from 'antd';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { bankAccountService, type BankAccount } from '../../../services/finance/bank-account';
import { CURRENCY_SELECT_OPTIONS, formatBankDirection, formatCurrency } from '../../../utils/financeUiLabels';

type BankTx = Record<string, unknown>;

const BankAccountsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const txRef = useRef<ActionType>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [txDrawerOpen, setTxDrawerOpen] = useState(false);
  const [txAccount, setTxAccount] = useState<BankAccount | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importAccount, setImportAccount] = useState<BankAccount | null>(null);

  const columns: ProColumns<BankAccount>[] = [
    { title: '账户编码', dataIndex: 'account_code', width: 120 },
    { title: '账户名称', dataIndex: 'account_name', ellipsis: true },
    { title: '开户行', dataIndex: 'bank_name', ellipsis: true },
    { title: '账号', dataIndex: 'account_number', width: 180, ellipsis: true },
    { title: '币种', dataIndex: 'currency', width: 100, render: (_, r) => formatCurrency(String(r.currency ?? '')) },
    { title: '当前余额', dataIndex: 'current_balance', valueType: 'money', align: 'right' },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (_, r) => (r.is_active ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      render: (_, record) => [
        <a key="tx" onClick={() => { setTxAccount(record); setTxDrawerOpen(true); }}>流水</a>,
        <a key="import" onClick={() => { setImportAccount(record); setImportOpen(true); }}>导入</a>,
        <a key="edit" onClick={() => { setEditing(record); setModalVisible(true); }}>编辑</a>,
        <Popconfirm {...rowActionKind('delete')}
          key="del"
          title="确认删除该银行账户？"
          onConfirm={async () => {
            await bankAccountService.delete(record.id);
            messageApi.success('已删除');
            actionRef.current?.reload();
          }}
        >
          <a>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  const txColumns: ProColumns<BankTx>[] = [
    { title: '日期', dataIndex: 'transaction_date', valueType: 'date', width: 120 },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 80,
      render: (_, r) => {
        const label = formatBankDirection(String(r.direction ?? ''));
        return label === '收入' ? <Tag color="green">收入</Tag> : label === '支出' ? <Tag color="red">支出</Tag> : <Tag>{label}</Tag>;
      },
    },
    { title: '金额', dataIndex: 'amount', valueType: 'money', align: 'right' },
    { title: '余额', dataIndex: 'balance_after', valueType: 'money', align: 'right' },
    { title: '来源单号', dataIndex: 'source_doc_code', width: 140, ellipsis: true },
    { title: '摘要', dataIndex: 'summary', ellipsis: true },
  ];

  return (
    <ListPageTemplate>
      <UniTable<BankAccount>
        actionRef={actionRef}
        enableRowSelection
        rowKey="id"
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.bank-accounts"
        columns={columns}
        request={async () => {
          const list = await bankAccountService.list({ limit: 200 });
          return { data: list, success: true, total: list.length };
        }}
        search={false}
        showCreateButton
        createButtonText="新建账户"
        onCreate={() => { setEditing(null); setModalVisible(true); }}
      />

      <DetailDrawerTemplate
        title={txAccount ? `${txAccount.account_name} · 银行流水` : '银行流水'}
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
        title={importAccount ? `导入对账单 · ${importAccount.account_name}` : '导入对账单'}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        width={MODAL_CONFIG.LARGE_WIDTH}
        onFinish={async (values) => {
          if (!importAccount) return;
          const result = await bankAccountService.importStatement(importAccount.id, values.csv_content);
          messageApi.success(`已导入 ${result.imported_count} 条，当前余额 ¥${result.current_balance}`);
          setImportOpen(false);
          actionRef.current?.reload();
        }}
      >
        <p style={{ color: 'var(--ant-color-text-secondary)', marginBottom: 8 }}>
          将网银或柜台导出的对账单粘贴到下方（暂不支持银企直联）。首行表头示例：交易日期,收支方向,金额,摘要；收支方向填「收入」或「支出」。
        </p>
        <ProFormTextArea
          name="csv_content"
          label="对账单内容"
          rules={[{ required: true, message: '请粘贴对账单内容' }]}
          fieldProps={{
            rows: 10,
            placeholder: '交易日期,收支方向,金额,摘要\n2026-05-01,收入,10000.00,期初调账',
          }}
        />
      </FormModalTemplate>

      <FormModalTemplate
        title={editing ? '编辑银行账户' : '新建银行账户'}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        isEdit={!!editing}
        onFinish={async (values) => {
          if (editing) {
            await bankAccountService.update(editing.id, values);
            messageApi.success('更新成功');
          } else {
            await bankAccountService.create(values);
            messageApi.success('创建成功');
          }
          setModalVisible(false);
          actionRef.current?.reload();
        }}
        initialValues={editing ?? { currency: 'CNY', is_active: true }}
      >
        <ProFormText name="account_code" label="账户编码" rules={[{ required: true }]} disabled={!!editing} />
        <ProFormText name="account_name" label="账户名称" rules={[{ required: true }]} />
        <ProFormText name="bank_name" label="开户行" rules={[{ required: true }]} />
        <ProFormText name="account_number" label="银行账号" rules={[{ required: true }]} />
        <ProFormSelect name="currency" label="币种" options={CURRENCY_SELECT_OPTIONS} />
        {!editing && <ProFormMoney name="opening_balance" label="期初余额" min={0} />}
        {editing && (
          <ProFormSelect
            name="is_active"
            label="状态"
            options={[{ label: '启用', value: true }, { label: '停用', value: false }]}
          />
        )}
        <ProFormTextArea name="notes" label="备注" />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default BankAccountsPage;

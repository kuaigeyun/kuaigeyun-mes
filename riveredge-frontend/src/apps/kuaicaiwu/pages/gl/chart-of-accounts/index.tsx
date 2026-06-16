import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Tag } from 'antd';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { glService, type ChartOfAccount } from '../../../services/gl';

const ChartOfAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const [modalVisible, setModalVisible] = useState(false);

  const accountTypeOptions = useMemo(
    () => [
      { label: t('app.kuaicaiwu.glChartOfAccounts.accountType.asset'), value: 'asset' },
      { label: t('app.kuaicaiwu.glChartOfAccounts.accountType.liability'), value: 'liability' },
      { label: t('app.kuaicaiwu.glChartOfAccounts.accountType.equity'), value: 'equity' },
      { label: t('app.kuaicaiwu.glChartOfAccounts.accountType.cost'), value: 'cost' },
      { label: t('app.kuaicaiwu.glChartOfAccounts.accountType.profitLoss'), value: 'profit_loss' },
    ],
    [t],
  );

  const balanceDirectionOptions = useMemo(
    () => [
      { label: t('app.kuaicaiwu.glChartOfAccounts.direction.debit'), value: 'debit' },
      { label: t('app.kuaicaiwu.glChartOfAccounts.direction.credit'), value: 'credit' },
    ],
    [t],
  );

  const columns: ProColumns<ChartOfAccount>[] = useMemo(
    () => [
      { title: t('app.kuaicaiwu.glChartOfAccounts.col.accountCode'), dataIndex: 'account_code', width: 120 },
      { title: t('app.kuaicaiwu.glChartOfAccounts.col.accountName'), dataIndex: 'account_name', ellipsis: true },
      { title: t('app.kuaicaiwu.glChartOfAccounts.col.accountType'), dataIndex: 'account_type', width: 100 },
      { title: t('app.kuaicaiwu.glChartOfAccounts.col.balanceDirection'), dataIndex: 'balance_direction', width: 90 },
      { title: t('app.kuaicaiwu.glChartOfAccounts.col.level'), dataIndex: 'level', width: 60 },
      {
        title: t('app.kuaicaiwu.glChartOfAccounts.col.isLeaf'),
        dataIndex: 'is_leaf',
        width: 60,
        render: (_, r) => (r.is_leaf ? t('app.kuaicaiwu.glChartOfAccounts.yes') : t('app.kuaicaiwu.glChartOfAccounts.no')),
      },
      {
        title: t('app.kuaicaiwu.glChartOfAccounts.col.status'),
        dataIndex: 'is_active',
        width: 80,
        render: (_, r) =>
          r.is_active ? (
            <Tag color="success">{t('app.kuaicaiwu.glChartOfAccounts.status.active')}</Tag>
          ) : (
            <Tag>{t('app.kuaicaiwu.glChartOfAccounts.status.inactive')}</Tag>
          ),
      },
    ],
    [t],
  );

  return (
    <ListPageTemplate title={t('app.kuaicaiwu.glChartOfAccounts.pageTitle')}>
      <UniTable<ChartOfAccount>
        actionRef={actionRef}
        enableRowSelection
        rowKey="id"
        columns={columns}
        request={async () => {
          const list = await glService.listAccounts();
          return { data: list, success: true, total: list.length };
        }}
        search={false}
        showCreateButton
        createButtonText={t('app.kuaicaiwu.glChartOfAccounts.createButton')}
        onCreate={() => setModalVisible(true)}
      />

      <FormModalTemplate
        title={t('app.kuaicaiwu.glChartOfAccounts.modalTitle')}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        onFinish={async (values) => {
          await glService.createAccount(values);
          messageApi.success(t('app.kuaicaiwu.glChartOfAccounts.createSuccess'));
          setModalVisible(false);
          actionRef.current?.reload();
        }}
        initialValues={{ balance_direction: 'debit' }}
      >
        <ProFormText name="account_code" label={t('app.kuaicaiwu.glChartOfAccounts.form.accountCode')} rules={[{ required: true }]} />
        <ProFormText name="account_name" label={t('app.kuaicaiwu.glChartOfAccounts.form.accountName')} rules={[{ required: true }]} />
        <ProFormSelect
          name="account_type"
          label={t('app.kuaicaiwu.glChartOfAccounts.form.accountType')}
          rules={[{ required: true }]}
          options={accountTypeOptions}
        />
        <ProFormSelect
          name="balance_direction"
          label={t('app.kuaicaiwu.glChartOfAccounts.form.balanceDirection')}
          options={balanceDirectionOptions}
        />
        <ProFormTextArea name="notes" label={t('app.kuaicaiwu.glChartOfAccounts.form.notes')} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ChartOfAccountsPage;

import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Drawer, Table, Tag } from 'antd';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { glService, type Voucher, type VoucherLine } from '../../../services/gl';

const statusColor: Record<string, string> = {
  draft: 'default',
  posted: 'success',
  草稿: 'default',
  已过账: 'success',
};

const VouchersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lines, setLines] = useState<VoucherLine[]>([]);
  const [current, setCurrent] = useState<Voucher | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const openLines = async (record: Voucher) => {
    setCurrent(record);
    const data = await glService.listVoucherLines(record.id);
    setLines(data);
    setDrawerOpen(true);
  };

  const handleBatchPost = async (keys: React.Key[]) => {
    try {
      for (const key of keys) {
        await glService.postVoucher(Number(key));
      }
      messageApi.success(t('app.kuaicaiwu.glVoucher.batchPosted', { count: keys.length }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaicaiwu.glVoucher.batchPostFailed'));
    }
  };

  const columns: ProColumns<Voucher>[] = useMemo(
    () => [
      { title: t('app.kuaicaiwu.glVoucher.col.voucherCode'), dataIndex: 'voucher_code', width: 160 },
      { title: t('app.kuaicaiwu.glVoucher.col.voucherDate'), dataIndex: 'voucher_date', valueType: 'date', width: 120 },
      {
        title: t('app.kuaicaiwu.glVoucher.col.period'),
        dataIndex: 'period_year',
        width: 100,
        render: (_, r) => `${r.period_year}-${String(r.period_month).padStart(2, '0')}`,
      },
      { title: t('app.kuaicaiwu.glVoucher.col.summary'), dataIndex: 'summary', ellipsis: true },
      { title: t('app.kuaicaiwu.glVoucher.col.totalDebit'), dataIndex: 'total_debit', valueType: 'money', align: 'right' },
      { title: t('app.kuaicaiwu.glVoucher.col.totalCredit'), dataIndex: 'total_credit', valueType: 'money', align: 'right' },
      {
        title: t('app.kuaicaiwu.glVoucher.col.status'),
        dataIndex: 'status',
        width: 90,
        render: (_, r) => <Tag color={statusColor[r.status] ?? 'default'}>{r.status}</Tag>,
      },
      {
        title: t('app.kuaicaiwu.glVoucher.col.actions'),
        valueType: 'option',
        width: 140,
        render: (_, record) => [
          <a key="lines" onClick={() => openLines(record)}>{t('app.kuaicaiwu.glVoucher.action.lines')}</a>,
          record.status !== 'posted' && record.status !== '已过账' ? (
            <a
              key="post"
              onClick={async () => {
                try {
                  await glService.postVoucher(record.id);
                  messageApi.success(t('app.kuaicaiwu.glVoucher.postSuccess'));
                  actionRef.current?.reload();
                } catch (error: any) {
                  messageApi.error(error.message || t('app.kuaicaiwu.glVoucher.postFailed'));
                }
              }}
            >
              {t('app.kuaicaiwu.glVoucher.action.post')}
            </a>
          ) : null,
        ],
      },
    ],
    [messageApi, t],
  );

  const lineColumns = useMemo(
    () => [
      { title: t('app.kuaicaiwu.glVoucher.line.lineNo'), dataIndex: 'line_no', width: 60 },
      { title: t('app.kuaicaiwu.glVoucher.line.accountCode'), dataIndex: 'account_code', width: 120 },
      { title: t('app.kuaicaiwu.glVoucher.line.accountName'), dataIndex: 'account_name', ellipsis: true },
      { title: t('app.kuaicaiwu.glVoucher.line.summary'), dataIndex: 'summary', ellipsis: true },
      { title: t('app.kuaicaiwu.glVoucher.line.debit'), dataIndex: 'debit_amount', align: 'right' as const, render: (v: unknown) => Number(v).toFixed(2) },
      { title: t('app.kuaicaiwu.glVoucher.line.credit'), dataIndex: 'credit_amount', align: 'right' as const, render: (v: unknown) => Number(v).toFixed(2) },
    ],
    [t],
  );

  return (
    <ListPageTemplate title={t('app.kuaicaiwu.glVoucher.pageTitle')}>
      <UniTable<Voucher>
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          const list = await glService.listVouchers({
            skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
            limit: params.pageSize ?? 20,
          });
          return { data: list, success: true, total: list.length };
        }}
        search={false}
        toolBarActionsAfterBatch={[
          <UniBatchMenuButton
            key="voucher-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('app.kuaicaiwu.glVoucher.batchActions')}
            menuItems={[
              {
                key: 'batch-post',
                label: t('app.kuaicaiwu.glVoucher.batchPost'),
                requireConfirm: true,
                confirmTitle: (count) => t('app.kuaicaiwu.glVoucher.confirmBatchPost', { count }),
                confirmDescription: t('app.kuaicaiwu.glVoucher.confirmBatchPostDesc'),
                onClick: handleBatchPost,
              },
            ]}
          />,
        ]}
      />

      <Drawer
        title={
          current
            ? t('app.kuaicaiwu.glVoucher.drawerTitle', { code: current.voucher_code })
            : t('app.kuaicaiwu.glVoucher.drawerTitleDefault')
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size={720}
      >
        <Table<VoucherLine>
          rowKey="line_no"
          size="small"
          pagination={false}
          dataSource={lines}
          columns={lineColumns}
        />
      </Drawer>
    </ListPageTemplate>
  );
};

export default VouchersPage;

import React, { useRef, useState } from 'react';
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
      messageApi.success(`已过账 ${keys.length} 张凭证`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '批量过账失败');
    }
  };

  const columns: ProColumns<Voucher>[] = [
    { title: '凭证号', dataIndex: 'voucher_code', width: 160 },
    { title: '凭证日期', dataIndex: 'voucher_date', valueType: 'date', width: 120 },
    { title: '会计期间', dataIndex: 'period_year', width: 100, render: (_, r) => `${r.period_year}-${String(r.period_month).padStart(2, '0')}` },
    { title: '摘要', dataIndex: 'summary', ellipsis: true },
    { title: '借方合计', dataIndex: 'total_debit', valueType: 'money', align: 'right' },
    { title: '贷方合计', dataIndex: 'total_credit', valueType: 'money', align: 'right' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, r) => <Tag color={statusColor[r.status] ?? 'default'}>{r.status}</Tag>,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 140,
      render: (_, record) => [
        <a key="lines" onClick={() => openLines(record)}>分录</a>,
        record.status !== 'posted' && record.status !== '已过账' ? (
          <a
            key="post"
            onClick={async () => {
              try {
                await glService.postVoucher(record.id);
                messageApi.success('过账成功');
                actionRef.current?.reload();
              } catch (error: any) {
                messageApi.error(error.message || '过账失败');
              }
            }}
          >
            过账
          </a>
        ) : null,
      ],
    },
  ];

  return (
    <ListPageTemplate title="会计凭证">
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
            buttonText="批量操作"
            menuItems={[
              {
                key: 'batch-post',
                label: '批量过账',
                requireConfirm: true,
                confirmTitle: (count) => `确认过账 ${count} 张凭证`,
                confirmDescription: '仅未过账凭证会执行成功，已过账或不满足条件的记录会由后端拒绝。',
                onClick: handleBatchPost,
              },
            ]}
          />,
        ]}
      />

      <Drawer
        title={current ? `凭证分录 · ${current.voucher_code}` : '凭证分录'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size={720}
      >
        <Table<VoucherLine>
          rowKey="line_no"
          size="small"
          pagination={false}
          dataSource={lines}
          columns={[
            { title: '行号', dataIndex: 'line_no', width: 60 },
            { title: '科目编码', dataIndex: 'account_code', width: 120 },
            { title: '科目名称', dataIndex: 'account_name', ellipsis: true },
            { title: '摘要', dataIndex: 'summary', ellipsis: true },
            { title: '借方', dataIndex: 'debit_amount', align: 'right', render: (v) => Number(v).toFixed(2) },
            { title: '贷方', dataIndex: 'credit_amount', align: 'right', render: (v) => Number(v).toFixed(2) },
          ]}
        />
      </Drawer>
    </ListPageTemplate>
  );
};

export default VouchersPage;

/**
 * 好力 GO — 供应商应付款报表
 */

import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Tag } from 'antd';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import { getFinancePayableReport, type FinancePayableReportRow } from '../../../../services/haoligo';

function balanceTag(balance: number, overdue: number) {
  if (balance <= 0) return <Tag color="success">已结清</Tag>;
  if (overdue > 0) return <Tag color="error">有逾期</Tag>;
  return <Tag color="warning">未结清</Tag>;
}

const FinancePayableReportPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const columns: ProColumns<FinancePayableReportRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '供应商名称' },
    },
    {
      title: '状态',
      dataIndex: 'balance_status',
      hideInTable: true,
      valueType: 'select',
      valueEnum: {
        all: { text: '全部' },
        open: { text: '未结清' },
        overdue: { text: '有逾期' },
        cleared: { text: '已结清' },
      },
      initialValue: 'all',
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      width: 220,
      ellipsis: true,
      fixed: 'left',
      hideInSearch: true,
    },
    {
      title: '账期（天）',
      dataIndex: 'payment_terms_days',
      width: 90,
      hideInSearch: true,
    },
    {
      title: '应付累计',
      dataIndex: 'total_payable',
      width: 110,
      hideInSearch: true,
      render: (_, r) => Number(r.total_payable).toFixed(2),
    },
    {
      title: '已付累计',
      dataIndex: 'total_paid',
      width: 110,
      hideInSearch: true,
      render: (_, r) => Number(r.total_paid).toFixed(2),
    },
    {
      title: '应付余额',
      dataIndex: 'balance',
      width: 110,
      hideInSearch: true,
      render: (_, r) => Number(r.balance).toFixed(2),
    },
    {
      title: '逾期金额',
      dataIndex: 'overdue_amount',
      width: 110,
      hideInSearch: true,
      render: (_, r) => Number(r.overdue_amount).toFixed(2),
    },
    {
      title: '本月到期',
      dataIndex: 'due_this_month_amount',
      width: 110,
      hideInSearch: true,
      render: (_, r) => Number(r.due_this_month_amount).toFixed(2),
    },
    {
      title: '最早到期日',
      dataIndex: 'oldest_unpaid_due_date',
      width: 120,
      hideInSearch: true,
      render: (_, r) => r.oldest_unpaid_due_date || '—',
    },
    {
      title: '状态',
      dataIndex: 'balance',
      width: 90,
      hideInSearch: true,
      render: (_, r) => balanceTag(Number(r.balance), Number(r.overdue_amount)),
    },
    {
      title: '发票数',
      dataIndex: 'invoice_count',
      width: 90,
      hideInSearch: true,
    },
    {
      title: '付款笔数',
      dataIndex: 'payment_count',
      width: 90,
      hideInSearch: true,
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<FinancePayableReportRow>
        actionRef={actionRef}
        rowKey="supplier_id"
        columns={columns}
        showAdvancedSearch
        search={{ labelWidth: 100 }}
        request={async (params) => {
          try {
            let rows = await getFinancePayableReport({
              keyword: String(params.keyword ?? '').trim() || undefined,
            });
            const status = String(params.balance_status ?? 'all');
            if (status === 'open') rows = rows.filter((r) => Number(r.balance) > 0);
            if (status === 'overdue') rows = rows.filter((r) => Number(r.overdue_amount) > 0);
            if (status === 'cleared') rows = rows.filter((r) => Number(r.balance) <= 0);
            return { data: rows, success: true, total: rows.length };
          } catch (e) {
            messageApi.error((e as Error).message || '加载报表失败');
            return { data: [], success: false, total: 0 };
          }
        }}
      />
    </ListPageTemplate>
  );
};

export default FinancePayableReportPage;

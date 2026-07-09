/**
 * 好力 GO — 本月付款明细
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import {
  getFinanceMonthlyPaymentReport,
  type FinanceMonthlyPaymentDetailRow,
} from '../../../../services/haoligo';

const FinanceMonthlyPaymentReportPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [summaryTotal, setSummaryTotal] = useState(0);

  const columns: ProColumns<FinanceMonthlyPaymentDetailRow>[] = [
    {
      title: '年月',
      dataIndex: 'year_month',
      hideInTable: true,
      valueType: 'dateMonth',
      initialValue: dayjs(),
      fieldProps: { allowClear: false },
    },
    {
      title: '发票号码',
      dataIndex: 'invoice_no',
      width: 180,
      fixed: 'left',
      hideInSearch: true,
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      width: 180,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '开票日期',
      dataIndex: 'invoice_date',
      width: 110,
      hideInSearch: true,
    },
    {
      title: '到期日',
      dataIndex: 'due_date',
      width: 110,
      hideInSearch: true,
    },
    {
      title: '账期（天）',
      dataIndex: 'payment_terms_days',
      width: 90,
      hideInSearch: true,
    },
    {
      title: '应付金额',
      dataIndex: 'original_amount',
      width: 110,
      hideInSearch: true,
      render: (_, r) => Number(r.original_amount).toFixed(2),
    },
    {
      title: '已付',
      dataIndex: 'paid_amount',
      width: 100,
      hideInSearch: true,
      render: (_, r) => Number(r.paid_amount).toFixed(2),
    },
    {
      title: '剩余应付',
      dataIndex: 'remaining_amount',
      width: 110,
      hideInSearch: true,
      render: (_, r) => {
        const rem = Number(r.remaining_amount);
        return rem > 0 ? <Tag color="warning">{rem.toFixed(2)}</Tag> : <Tag color="success">0.00</Tag>;
      },
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<FinanceMonthlyPaymentDetailRow>
        actionRef={actionRef}
        rowKey="invoice_id"
        columns={columns}
        showAdvancedSearch
        toolBarActionsBeforeCreate={[
          <Typography.Text key="monthly-remaining-total">
            本月到期剩余应付合计{' '}
            <Typography.Text strong style={{ color: 'var(--ant-color-primary)' }}>
              ¥{summaryTotal.toFixed(2)}
            </Typography.Text>
          </Typography.Text>,
        ]}
        request={async (params) => {
          try {
            const ym = params.year_month ? dayjs(params.year_month as string) : dayjs();
            const res = await getFinanceMonthlyPaymentReport({
              year: ym.year(),
              month: ym.month() + 1,
            });
            setSummaryTotal(Number(res.total_remaining));
            return { data: res.rows, success: true, total: res.row_count };
          } catch (e) {
            messageApi.error((e as Error).message || '加载报表失败');
            setSummaryTotal(0);
            return { data: [], success: false, total: 0 };
          }
        }}
      />
    </ListPageTemplate>
  );
};

export default FinanceMonthlyPaymentReportPage;

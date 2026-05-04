/**
 * 报价单综合查询报表
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';
import SalesBaseReport from './BaseReport';
import { getSalesReport, parseSalesReportDateRange, salesReportPageParams } from '../../../services/reports';

const QuotationQuery: React.FC = () => {
  const columns: ProColumns[] = [
    {
      title: '报价日期',
      dataIndex: 'quotation_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      search: { order: 10 } as any,
    },
    {
      title: '报价单号',
      dataIndex: 'quotation_code',
      copyable: true,
      fixed: 'left',
      width: 150,
    },
    {
      title: '报价日期',
      dataIndex: 'quotation_date',
      valueType: 'date',
      sorter: true,
      width: 120,
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      ellipsis: true,
      width: 150,
    },
    {
      title: '报价总额',
      dataIndex: 'total_amount',
      valueType: 'money',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        DRAFT: { text: '草稿', status: 'Default' },
        SENT: { text: '已发送', status: 'Processing' },
        ACCEPTED: { text: '已接受', status: 'Success' },
        REJECTED: { text: '已拒绝', status: 'Error' },
        EXPIRED: { text: '已过期', status: 'Warning' },
      },
    },
    {
      title: '销售人',
      dataIndex: 'salesman_name',
      width: 100,
    },
    {
      title: '备注',
      dataIndex: 'notes',
      ellipsis: true,
    },
  ];

  return (
    <SalesBaseReport
      title="报价单综合查询"
      reportType="quotation"
      columns={columns}
      request={async (params, _s, _f, searchFormValues) => {
        const { date_start, date_end } = parseSalesReportDateRange(searchFormValues, [
          'quotation_date_range',
          'date_range',
          'dateRange',
        ]);
        const { skip, limit } = salesReportPageParams(params);
        const res = await getSalesReport({
          report_type: 'quotation',
          date_start,
          date_end,
          customer_keyword: searchFormValues?.customer_name,
          skip,
          limit,
        });
        return {
          data: res.data,
          success: res.success,
          total: res.total ?? res.data?.length ?? 0,
        };
      }}
    />
  );
};

export default QuotationQuery;

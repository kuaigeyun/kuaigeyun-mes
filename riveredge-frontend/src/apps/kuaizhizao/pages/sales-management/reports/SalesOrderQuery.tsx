/**
 * 销售订单综合查询报表
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';
import SalesBaseReport from './BaseReport';
import { getSalesReport, parseSalesReportDateRange, salesReportPageParams } from '../../../services/reports';

const SalesOrderQuery: React.FC = () => {
  const columns: ProColumns[] = [
    {
      title: '订单日期',
      dataIndex: 'order_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      search: { order: 10 } as any,
    },
    {
      title: '订单编号',
      dataIndex: 'order_code',
      copyable: true,
      fixed: 'left',
      width: 150,
    },
    {
      title: '订单日期',
      dataIndex: 'order_date',
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
      title: '交货日期',
      dataIndex: 'delivery_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      valueType: 'money',
      width: 120,
    },
    {
      title: '订单状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        DRAFT: { text: '草稿', status: 'Default' },
        CONFIRMED: { text: '已确认', status: 'Processing' },
        AUDITED: { text: '已审核', status: 'Success' },
        COMPLETED: { text: '已完成', status: 'Success' },
        CANCELLED: { text: '已取消', status: 'Error' },
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      width: 100,
      render: (_, record) => {
        const status = record.review_status;
        if (status === 'APPROVED' || status === '审核通过') return <Tag color="success">通过</Tag>;
        if (status === 'REJECTED' || status === '驳回') return <Tag color="error">驳回</Tag>;
        if (status === 'PENDING' || status === '待审核') return <Tag color="warning">待审核</Tag>;
        return <Tag>{status}</Tag>;
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
      title="销售订单综合查询"
      reportType="summary"
      columns={columns}
      request={async (params, _s, _f, searchFormValues) => {
        const { date_start, date_end } = parseSalesReportDateRange(searchFormValues, [
          'order_date_range',
          'date_range',
          'dateRange',
        ]);
        const { skip, limit } = salesReportPageParams(params);
        const res = await getSalesReport({
          report_type: 'summary',
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

export default SalesOrderQuery;

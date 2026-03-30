/**
 * 报价单综合查询报表
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';
import SalesBaseReport from './BaseReport';
import { getSalesReport } from '../../../services/reports';

const QuotationQuery: React.FC = () => {
  const columns: ProColumns[] = [
    {
      title: '报价单号',
      dataIndex: 'quote_code',
      copyable: true,
      fixed: 'left',
      width: 150,
    },
    {
      title: '报价日期',
      dataIndex: 'quote_date',
      valueType: 'date',
      sorter: true,
      width: 120,
    },
    {
      title: '有效截止日',
      dataIndex: 'expiry_date',
      valueType: 'date',
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
      title: '胜率',
      dataIndex: 'win_probability',
      render: (text) => <Tag color="blue">{text}%</Tag>,
      width: 80,
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
      request={async (params) => {
        const res = await getSalesReport({
          ...params,
          report_type: 'quotation',
        });
        return {
          data: res.data,
          success: res.success,
          total: res.data?.length || 0,
        };
      }}
    />
  );
};

export default QuotationQuery;

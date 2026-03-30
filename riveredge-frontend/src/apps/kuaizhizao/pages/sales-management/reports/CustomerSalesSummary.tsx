/**
 * 客户销售业绩汇总报表
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import SalesBaseReport from './BaseReport';
import { getSalesReport } from '../../../services/reports';

const CustomerSalesSummary: React.FC = () => {
  const columns: ProColumns[] = [
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      copyable: true,
      fixed: 'left',
      width: 200,
    },
    {
      title: '客户编号',
      dataIndex: 'customer_code',
      width: 150,
    },
    {
      title: '订单总数',
      dataIndex: 'order_count',
      valueType: 'digit',
      sorter: true,
      width: 120,
    },
    {
      title: '订单总额',
      dataIndex: 'total_amount',
      valueType: 'money',
      sorter: true,
      width: 150,
    },
    {
      title: '已完成金额',
      dataIndex: 'completed_amount',
      valueType: 'money',
      width: 150,
    },
    {
      title: '回款总额',
      dataIndex: 'received_amount',
      valueType: 'money',
      width: 150,
    },
    {
      title: '最近交易日',
      dataIndex: 'last_order_date',
      valueType: 'date',
      width: 150,
    },
    {
      title: '客户负责人',
      dataIndex: 'salesman_name',
      width: 150,
    },
  ];

  return (
    <SalesBaseReport
      title="客户销售业绩汇总"
      reportType="customer_summary"
      columns={columns}
      request={async (params) => {
        const res = await getSalesReport({
          ...params,
          report_type: 'customer_summary',
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

export default CustomerSalesSummary;

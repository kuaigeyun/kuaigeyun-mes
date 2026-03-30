/**
 * 客户销售明细对账报表
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import SalesBaseReport from './BaseReport';
import { getSalesReport } from '../../../services/reports';

const CustomerSalesReconciliation: React.FC = () => {
  const columns: ProColumns[] = [
    {
      title: '交易日期',
      dataIndex: 'transaction_date',
      valueType: 'date',
      fixed: 'left',
      width: 120,
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      ellipsis: true,
      width: 150,
    },
    {
      title: '单据类型',
      dataIndex: 'bill_type',
      width: 100,
      valueEnum: {
        SALES_ORDER: { text: '销售订单', status: 'Processing' },
        SALES_DELIVERY: { text: '销售出库', status: 'Success' },
        SALES_RETURN: { text: '销售退货', status: 'Error' },
        RECEIVABLE: { text: '应收账单', status: 'Default' },
      },
    },
    {
      title: '单据编号',
      dataIndex: 'bill_code',
      width: 150,
    },
    {
      title: '物料信息',
      dataIndex: 'material_name',
      ellipsis: true,
      width: 200,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      valueType: 'digit',
      width: 120,
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      valueType: 'money',
      width: 120,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      valueType: 'money',
      width: 120,
    },
    {
      title: '已开发票',
      dataIndex: 'invoiced_amount',
      valueType: 'money',
      width: 120,
    },
    {
      title: '待收金额',
      dataIndex: 'pending_amount',
      valueType: 'money',
      width: 120,
    },
    {
      title: '备注',
      dataIndex: 'notes',
      ellipsis: true,
    },
  ];

  return (
    <SalesBaseReport
      title="客户销售明细对账"
      reportType="customer_reconciliation"
      columns={columns}
      request={async (params) => {
        const res = await getSalesReport({
          ...params,
          report_type: 'customer_reconciliation',
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

export default CustomerSalesReconciliation;

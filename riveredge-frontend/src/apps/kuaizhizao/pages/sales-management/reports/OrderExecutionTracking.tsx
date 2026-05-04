/**
 * 销售订单执行跟踪报表
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Progress, Tag } from 'antd';
import SalesBaseReport from './BaseReport';
import { getSalesReport, parseSalesReportDateRange, salesReportPageParams } from '../../../services/reports';

const OrderExecutionTracking: React.FC = () => {
  const columns: ProColumns[] = [
    {
      title: '计划交期',
      dataIndex: 'delivery_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      search: { order: 9 } as any,
    },
    {
      title: '订单编号',
      dataIndex: 'order_code',
      copyable: true,
      fixed: 'left',
      width: 150,
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      ellipsis: true,
      width: 150,
    },
    {
      title: '物料编码',
      dataIndex: 'material_code',
      width: 150,
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      ellipsis: true,
      width: 200,
    },
    {
      title: '规格型号',
      dataIndex: 'material_spec',
      ellipsis: true,
      width: 150,
    },
    {
      title: '订单数量',
      dataIndex: 'order_quantity',
      valueType: 'digit',
      width: 120,
    },
    {
      title: '已交数量',
      dataIndex: 'delivered_quantity',
      valueType: 'digit',
      width: 120,
    },
    {
      title: '未交数量',
      dataIndex: 'remaining_quantity',
      valueType: 'digit',
      width: 120,
    },
    {
      title: '交货进度',
      dataIndex: 'delivery_progress',
      width: 180,
      render: (_, record) => (
        <Progress
          percent={Math.round((record.delivered_quantity / record.order_quantity) * 100) || 0}
          size="small"
          status={record.remaining_quantity === 0 ? 'success' : 'active'}
        />
      ),
    },
    {
      title: '计划交期',
      dataIndex: 'delivery_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '是否逾期',
      dataIndex: 'is_overdue',
      width: 100,
      render: (_, record) => {
        const isOverdue = new Date(record.delivery_date) < new Date() && record.remaining_quantity > 0;
        return isOverdue ? <Tag color="error">已逾期</Tag> : <Tag color="success">正常</Tag>;
      },
    },
    {
      title: '单位',
      dataIndex: 'material_unit',
      width: 80,
    },
  ];

  return (
    <SalesBaseReport
      title="销售订单执行跟踪"
      reportType="execution"
      columns={columns}
      request={async (params, _s, _f, searchFormValues) => {
        const { date_start, date_end } = parseSalesReportDateRange(searchFormValues, [
          'delivery_date_range',
          'date_range',
          'dateRange',
        ]);
        const { skip, limit } = salesReportPageParams(params);
        const res = await getSalesReport({
          report_type: 'execution',
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

export default OrderExecutionTracking;

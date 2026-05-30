/**
 * 销售合同执行报表
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Progress, Tag } from 'antd';
import SalesBaseReport from '../BaseReport';
import { getSalesReport, parseSalesReportDateRange, salesReportPageParams } from '../../../../services/reports';

const ContractExecutionReport: React.FC = () => {
  const columns: ProColumns[] = [
    {
      title: '签订日期',
      dataIndex: 'date_range',
      valueType: 'dateRange',
      hideInTable: true,
      search: { order: 9 } as any,
    },
    {
      title: '合同编号',
      dataIndex: 'contract_code',
      copyable: true,
      fixed: 'left',
      width: 150,
    },
    {
      title: '合同类型',
      dataIndex: 'contract_type',
      width: 100,
      render: (_, r) => (r.contract_type === 'framework' ? '框架合同' : '单次合同'),
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      ellipsis: true,
      width: 160,
    },
    {
      title: '签订日期',
      dataIndex: 'contract_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '有效期至',
      dataIndex: 'valid_to',
      valueType: 'date',
      width: 120,
    },
    {
      title: '合同金额',
      dataIndex: 'total_amount',
      valueType: 'money',
      width: 120,
      align: 'right',
    },
    {
      title: '已释放金额',
      dataIndex: 'released_amount',
      valueType: 'money',
      width: 120,
      align: 'right',
    },
    {
      title: '剩余金额',
      dataIndex: 'remaining_amount',
      valueType: 'money',
      width: 120,
      align: 'right',
    },
    {
      title: '执行率',
      dataIndex: 'execution_rate',
      width: 160,
      render: (_, record) => (
        <Progress
          percent={Math.round(Number(record.execution_rate) || 0)}
          size="small"
          status={Number(record.execution_rate) >= 100 ? 'success' : 'active'}
        />
      ),
    },
    {
      title: '收款执行率',
      dataIndex: 'payment_collection_rate',
      width: 160,
      render: (_, record) => (
        <Progress
          percent={Math.round(Number(record.payment_collection_rate) || 0)}
          size="small"
          status={Number(record.payment_collection_rate) >= 100 ? 'success' : 'active'}
        />
      ),
    },
    {
      title: '释放订单数',
      dataIndex: 'release_order_count',
      width: 100,
      align: 'right',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, r) => <Tag>{r.status}</Tag>,
    },
  ];

  return (
    <SalesBaseReport
      title="销售合同执行报表"
      reportType="contract-execution"
      columns={columns}
      request={async (params, _s, _f, searchFormValues) => {
        const { date_start, date_end } = parseSalesReportDateRange(searchFormValues, [
          'date_range',
          'contract_date_range',
        ]);
        const { skip, limit } = salesReportPageParams(params);
        const res = await getSalesReport({
          report_type: 'contract-execution',
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

export default ContractExecutionReport;

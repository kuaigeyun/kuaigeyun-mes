/**
 * 样品试用单综合查询报表
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';
import SalesBaseReport from './BaseReport';
import { getSalesReport } from '../../../services/reports';

const SampleTrialQuery: React.FC = () => {
  const columns: ProColumns[] = [
    {
      title: '试用单号',
      dataIndex: 'sample_code',
      copyable: true,
      fixed: 'left',
      width: 150,
    },
    {
      title: '申请日期',
      dataIndex: 'apply_date',
      valueType: 'date',
      sorter: true,
      width: 120,
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
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
      title: '样品名称',
      dataIndex: 'sample_name',
      ellipsis: true,
      width: 200,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      valueType: 'digit',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        DRAFT: { text: '草稿', status: 'Default' },
        IN_TRIAL: { text: '试用中', status: 'Processing' },
        COMPLETED: { text: '试用完成', status: 'Success' },
        CONVERTED: { text: '已转订单', status: 'Success' },
        FAILED: { text: '样品失败', status: 'Error' },
      },
    },
    {
      title: '反馈结果',
      dataIndex: 'feedback_result',
      width: 120,
      render: (text) => {
        if (text === 'SUCCESS') return <Tag color="success">成功</Tag>;
        if (text === 'FAIL') return <Tag color="error">失败</Tag>;
        return <Tag>{text}</Tag>;
      },
    },
    {
      title: '改进意见',
      dataIndex: 'suggestions',
      ellipsis: true,
    },
  ];

  return (
    <SalesBaseReport
      title="样品试用单综合查询"
      reportType="sample_trial"
      columns={columns}
      request={async (params) => {
        const res = await getSalesReport({
          ...params,
          report_type: 'sample_trial',
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

export default SampleTrialQuery;

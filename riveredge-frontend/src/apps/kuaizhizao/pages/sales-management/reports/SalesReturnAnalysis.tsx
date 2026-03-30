/**
 * 销售退货分析报表
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Card, Row, Col, Statistic } from 'antd';
import { Pie } from '@ant-design/charts';
import SalesBaseReport from './BaseReport';
import { getSalesReport } from '../../../services/reports';

const SalesReturnAnalysis: React.FC = () => {
  const [summary, setSummary] = React.useState<any>({});

  const columns: ProColumns[] = [
    {
      title: '退货单号',
      dataIndex: 'return_code',
      copyable: true,
      width: 150,
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      ellipsis: true,
      width: 150,
    },
    {
      title: '退货原因',
      dataIndex: 'return_reason',
      width: 120,
    },
    {
      title: '退货类型',
      dataIndex: 'return_type',
      width: 100,
    },
    {
      title: '退货金额',
      dataIndex: 'total_amount',
      valueType: 'money',
      width: 120,
    },
    {
      title: '退货时间',
      dataIndex: 'return_time',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
    },
  ];

  return (
    <SalesBaseReport
      title="销售退货分析"
      reportType="return_analysis"
      columns={columns}
      request={async (params) => {
        const res = await getSalesReport({
          ...params,
          report_type: 'return_analysis',
        });
        if (res.success) {
          setSummary(res.summary || {});
        }
        return {
          data: res.data,
          success: res.success,
          total: res.data?.length || 0,
        };
      }}
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="退货总单数" value={summary.total_returns || 0} />
          </Card>
          <Card size="small" style={{ marginTop: 16 }}>
            <Statistic title="退货总金额" value={summary.total_amount || 0} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col span={9}>
          <Card title="退货原因分布" size="small">
            <Pie
              appendPadding={10}
              data={summary.reason_distribution || []}
              angleField="count"
              colorField="return_reason"
              radius={0.8}
              label={{
                type: 'outer',
                content: '{name}: {percentage}',
              }}
            />
          </Card>
        </Col>
        <Col span={9}>
          <Card title="退货类型构成" size="small">
            <Pie
              appendPadding={10}
              data={summary.type_distribution || []}
              angleField="count"
              colorField="return_type"
              radius={0.8}
              innerRadius={0.6}
              label={{
                type: 'inner',
                offset: '-50%',
                content: '{value}',
                style: {
                  textAlign: 'center',
                  fontSize: 14,
                },
              }}
            />
          </Card>
        </Col>
      </Row>
    </SalesBaseReport>
  );
};

export default SalesReturnAnalysis;

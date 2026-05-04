/**
 * 销售预测与实际对比报表
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Progress, Tag } from 'antd';
import SalesBaseReport from './BaseReport';
import { getSalesReport, parseSalesReportDateRange, salesReportPageParams } from '../../../services/reports';

const ForecastVsActual: React.FC = () => {
  const columns: ProColumns[] = [
    {
      title: '预测/交货期间',
      dataIndex: 'forecast_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      search: { order: 10 } as any,
    },
    {
      title: '预测编号',
      dataIndex: 'forecast_code',
      copyable: true,
      fixed: 'left',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '预测周期',
      dataIndex: 'forecast_period',
      width: 120,
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      ellipsis: true,
      width: 200,
    },
    {
      title: '预测数量',
      dataIndex: 'forecast_quantity',
      valueType: 'digit',
      width: 120,
    },
    {
      title: '实际订单数',
      dataIndex: 'actual_quantity',
      valueType: 'digit',
      width: 120,
    },
    {
      title: '偏差比例',
      dataIndex: 'variance_rate',
      width: 100,
      render: (_, record) => {
        const rate = ((record.actual_quantity - record.forecast_quantity) / record.forecast_quantity) * 100;
        const color = Math.abs(rate) > 20 ? 'error' : 'success';
        return <Tag color={color}>{rate.toFixed(1)}%</Tag>;
      },
    },
    {
      title: '预测达成率',
      dataIndex: 'achievement_rate',
      width: 180,
      render: (_, record) => {
        const rate = (record.actual_quantity / record.forecast_quantity) * 100;
        return (
          <Progress
            percent={Math.round(rate)}
            size="small"
            strokeColor={rate < 80 ? '#ff4d4f' : '#52c41a'}
          />
        );
      },
    },
    {
      title: '开始日期',
      dataIndex: 'start_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '物料编码',
      dataIndex: 'material_code',
      width: 150,
    },
  ];

  return (
    <SalesBaseReport
      title="销售预测与实际对比"
      reportType="forecast_actual"
      columns={columns}
      request={async (params, _s, _f, searchFormValues) => {
        const { date_start, date_end } = parseSalesReportDateRange(searchFormValues, [
          'forecast_date_range',
          'date_range',
          'dateRange',
        ]);
        const { skip, limit } = salesReportPageParams(params);
        const res = await getSalesReport({
          report_type: 'forecast_actual',
          date_start,
          date_end,
          skip,
          limit,
        });
        const rows = (res.data || []).map((row: any, idx: number) => ({
          ...row,
          forecast_code: row.forecast_code ?? row.material_code ?? `F-${skip + idx + 1}`,
          forecast_period: row.forecast_period ?? '-',
          product_name: row.product_name ?? row.material_name ?? '-',
          start_date: row.start_date ?? date_start,
          end_date: row.end_date ?? date_end,
        }));
        return {
          data: rows,
          success: res.success,
          total: res.total ?? rows.length ?? 0,
        };
      }}
    />
  );
};

export default ForecastVsActual;

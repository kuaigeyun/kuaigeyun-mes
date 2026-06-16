/**
 * 报工统计分析页面
 *
 * 提供报工数据统计分析功能，包括效率分析、工时统计、异常分析等。
 *
 * @author Luigi Lu
 * @date 2025-01-04
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Button, Space, Table, Tag } from 'antd';
import { Line, Bar, Column } from '@ant-design/charts';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { reportingApi } from '../../../../services/production';
import type { ReportingDetailedStatistics } from '../../../../services/reporting';
import dayjs, { Dayjs } from 'dayjs';
import type { NoUndefinedRangeValueType } from 'rc-picker/lib/PickerInput/RangePicker';
import { useTranslation } from 'react-i18next';

const { RangePicker } = DatePicker;

const ReportingStatisticsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);
  const [statistics, setStatistics] = useState<ReportingDetailedStatistics | null>(null);

  /**
   * 加载统计数据
   */
  const loadStatistics = async () => {
    try {
      setLoading(true);
      const [startDate, endDate] = dateRange;
      const result = await reportingApi.getStatistics({
        date_start: startDate.format('YYYY-MM-DD'),
        date_end: endDate.format('YYYY-MM-DD'),
      });
      setStatistics(result);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.workReporting.statistics.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  /**
   * 处理日期范围变化
   */
  const handleDateRangeChange = (
    dates: NoUndefinedRangeValueType<Dayjs> | null,
    _dateStrings: [string, string]
  ) => {
    if (dates?.[0] && dates[1]) {
      setDateRange([dates[0], dates[1]]);
    }
  };

  /**
   * 处理刷新
   */
  const handleRefresh = () => {
    loadStatistics();
  };

  /**
   * 处理导出
   */
  const handleExport = () => {
    if (!statistics) {
      messageApi.warning(t('app.kuaizhizao.workReporting.statistics.noDataExport'));
      return;
    }
    try {
      const blob = new Blob([JSON.stringify(statistics, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporting-statistics-${dateRange[0].format('YYYY-MM-DD')}-${dateRange[1].format('YYYY-MM-DD')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      messageApi.success(t('app.kuaizhizao.workReporting.statistics.exportSuccess'));
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.workReporting.statistics.exportFailed'));
    }
  };

  const operationColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.workReporting.statistics.colOperationName'),
        dataIndex: 'operation_name',
        key: 'operation_name',
      },
      {
        title: t('app.kuaizhizao.workReporting.statistics.colReportCount'),
        dataIndex: 'count',
        key: 'count',
        align: 'right' as const,
      },
      {
        title: t('app.kuaizhizao.workReporting.statistics.colReportedQty'),
        dataIndex: 'reported_quantity',
        key: 'reported_quantity',
        align: 'right' as const,
        render: (value: number) => value.toFixed(2),
      },
      {
        title: t('app.kuaizhizao.workReporting.statistics.colQualifiedQty'),
        dataIndex: 'qualified_quantity',
        key: 'qualified_quantity',
        align: 'right' as const,
        render: (value: number) => value.toFixed(2),
      },
      {
        title: t('app.kuaizhizao.workReporting.statistics.colWorkHours'),
        dataIndex: 'work_hours',
        key: 'work_hours',
        align: 'right' as const,
        render: (value: number) => value.toFixed(2),
      },
      {
        title: t('app.kuaizhizao.workReporting.statistics.colQualificationRate'),
        dataIndex: 'qualification_rate',
        key: 'qualification_rate',
        align: 'right' as const,
        render: (value: number) => (
          <Tag color={value >= 95 ? 'green' : value >= 90 ? 'orange' : 'red'}>
            {value.toFixed(2)}%
          </Tag>
        ),
      },
    ],
    [t],
  );

  const workerColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.workReporting.statistics.colWorkerName'),
        dataIndex: 'worker_name',
        key: 'worker_name',
      },
      {
        title: t('app.kuaizhizao.workReporting.statistics.colReportCount'),
        dataIndex: 'count',
        key: 'count',
        align: 'right' as const,
      },
      {
        title: t('app.kuaizhizao.workReporting.statistics.colReportedQty'),
        dataIndex: 'reported_quantity',
        key: 'reported_quantity',
        align: 'right' as const,
        render: (value: number) => value.toFixed(2),
      },
      {
        title: t('app.kuaizhizao.workReporting.statistics.colQualifiedQty'),
        dataIndex: 'qualified_quantity',
        key: 'qualified_quantity',
        align: 'right' as const,
        render: (value: number) => value.toFixed(2),
      },
      {
        title: t('app.kuaizhizao.workReporting.statistics.colWorkHours'),
        dataIndex: 'work_hours',
        key: 'work_hours',
        align: 'right' as const,
        render: (value: number) => value.toFixed(2),
      },
      {
        title: t('app.kuaizhizao.workReporting.statistics.colQualificationRate'),
        dataIndex: 'qualification_rate',
        key: 'qualification_rate',
        align: 'right' as const,
        render: (value: number) => (
          <Tag color={value >= 95 ? 'green' : value >= 90 ? 'orange' : 'red'}>
            {value.toFixed(2)}%
          </Tag>
        ),
      },
    ],
    [t],
  );

  return (
    <div>
      <Card style={{ marginBottom: 12 }}>
        <Space>
          <span>{t('app.kuaizhizao.workReporting.statistics.dateRange')}</span>
          <RangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            format="YYYY-MM-DD"
          />
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            {t('app.kuaizhizao.workReporting.statistics.query')}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            {t('app.kuaizhizao.workReporting.statistics.export')}
          </Button>
        </Space>
      </Card>

      {statistics && (
        <>
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('app.kuaizhizao.workReporting.statistics.statTotalCount')}
                  value={statistics.total_count}
                  styles={{ content: {color: '#1890ff' } }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('app.kuaizhizao.workReporting.statistics.statTotalReportedQty')}
                  value={statistics.total_reported_quantity}
                  precision={2}
                  styles={{ content: {color: '#52c41a' } }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('app.kuaizhizao.workReporting.statistics.statQualificationRate')}
                  value={statistics.qualification_rate}
                  precision={2}
                  suffix="%"
                  styles={{ content: {color: statistics.qualification_rate >= 95 ? '#52c41a' : statistics.qualification_rate >= 90 ? '#faad14' : '#ff4d4f', } }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('app.kuaizhizao.workReporting.statistics.statTotalWorkHours')}
                  value={statistics.total_work_hours}
                  precision={2}
                  styles={{ content: {color: '#722ed1' } }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('app.kuaizhizao.workReporting.statistics.statPending')}
                  value={statistics.pending_count}
                  styles={{ content: {color: '#faad14' } }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('app.kuaizhizao.workReporting.statistics.statApproved')}
                  value={statistics.approved_count}
                  styles={{ content: {color: '#52c41a' } }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('app.kuaizhizao.workReporting.statistics.statAvgEfficiency')}
                  value={statistics.avg_quantity_per_hour}
                  precision={2}
                  styles={{ content: {color: '#1890ff' } }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('app.kuaizhizao.workReporting.statistics.statUnqualifiedRate')}
                  value={statistics.unqualified_rate}
                  precision={2}
                  suffix="%"
                  styles={{ content: {color: statistics.unqualified_rate <= 5 ? '#52c41a' : statistics.unqualified_rate <= 10 ? '#faad14' : '#ff4d4f', } }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Card title={t('app.kuaizhizao.workReporting.statistics.chartByOperation')}>
                <Bar
                  data={statistics.operation_stats}
                  xField="operation_name"
                  yField="reported_quantity"
                  height={300}
                  label={{
                    style: { fill: '#FFFFFF', opacity: 0.6 },
                  }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title={t('app.kuaizhizao.workReporting.statistics.chartByWorker')}>
                <Bar
                  data={statistics.worker_stats}
                  xField="worker_name"
                  yField="reported_quantity"
                  height={300}
                  label={{
                    style: { fill: '#FFFFFF', opacity: 0.6 },
                  }}
                />
              </Card>
            </Col>
          </Row>

          <Card title={t('app.kuaizhizao.workReporting.statistics.tableByOperation')} style={{ marginBottom: 12 }}>
            <Table
              columns={operationColumns}
              dataSource={statistics.operation_stats}
              rowKey="operation_name"
              pagination={false}
              size="small"
            />
          </Card>

          <Card title={t('app.kuaizhizao.workReporting.statistics.tableByWorker')}>
            <Table
              columns={workerColumns}
              dataSource={statistics.worker_stats}
              rowKey="worker_name"
              pagination={false}
              size="small"
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default ReportingStatisticsPage;

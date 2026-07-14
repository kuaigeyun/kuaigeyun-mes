/**
 * 报工统计分析页面
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Button, Space, Table, Tag, Spin, Empty } from 'antd';
import { Bar } from '@ant-design/charts';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { reportingApi } from '../../../../services/production';
import type { ReportingDetailedStatistics } from '../../../../services/reporting';
import dayjs, { Dayjs } from 'dayjs';
import type { NoUndefinedRangeValueType } from 'rc-picker/lib/PickerInput/RangePicker';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import { formatQuantity } from '../../../../../../utils/format';

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

  const loadStatistics = useCallback(async () => {
    try {
      setLoading(true);
      const [startDate, endDate] = dateRange;
      const result = await reportingApi.getStatistics({
        date_start: startDate.format('YYYY-MM-DD'),
        date_end: endDate.format('YYYY-MM-DD'),
      });
      setStatistics(result);
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : t('app.kuaizhizao.workReporting.statistics.loadFailed');
      messageApi.error(msg);
    } finally {
      setLoading(false);
    }
  }, [dateRange, messageApi, t]);

  useEffect(() => {
    void loadStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDateRangeChange = (
    dates: NoUndefinedRangeValueType<Dayjs> | null,
    _dateStrings: [string, string],
  ) => {
    if (dates?.[0] && dates[1]) {
      setDateRange([dates[0], dates[1]]);
    }
  };

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
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : t('app.kuaizhizao.workReporting.statistics.exportFailed');
      messageApi.error(msg);
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
        render: (value: number) => formatQuantity(value),
      },
      {
        title: t('app.kuaizhizao.workReporting.statistics.colQualifiedQty'),
        dataIndex: 'qualified_quantity',
        key: 'qualified_quantity',
        align: 'right' as const,
        render: (value: number) => formatQuantity(value),
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
        render: (value: number) => formatQuantity(value),
      },
      {
        title: t('app.kuaizhizao.workReporting.statistics.colQualifiedQty'),
        dataIndex: 'qualified_quantity',
        key: 'qualified_quantity',
        align: 'right' as const,
        render: (value: number) => formatQuantity(value),
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
    <ListPageTemplate>
      <Spin spinning={loading}>
        <Card style={{ marginBottom: 12 }}>
          <Space wrap>
            <span>{t('app.kuaizhizao.workReporting.statistics.dateRange')}</span>
            <RangePicker value={dateRange} onChange={handleDateRangeChange} format="YYYY-MM-DD" />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => void loadStatistics()}
              loading={loading}
            >
              {t('app.kuaizhizao.workReporting.statistics.query')}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadStatistics()} loading={loading}>
              {t('common.refresh')}
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!statistics}>
              {t('app.kuaizhizao.workReporting.statistics.export')}
            </Button>
          </Space>
        </Card>

        {!statistics && !loading ? (
          <Card>
            <Empty description={t('app.kuaizhizao.workReporting.statistics.noDataExport')} />
          </Card>
        ) : null}

        {statistics ? (
          <>
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title={t('app.kuaizhizao.workReporting.statistics.statTotalCount')}
                    value={statistics.total_count}
                    styles={{ content: { color: '#1890ff' } }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title={t('app.kuaizhizao.workReporting.statistics.statTotalReportedQty')}
                    value={statistics.total_reported_quantity}
                    precision={2}
                    styles={{ content: { color: '#52c41a' } }}
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
                    styles={{
                      content: {
                        color:
                          statistics.qualification_rate >= 95
                            ? '#52c41a'
                            : statistics.qualification_rate >= 90
                              ? '#faad14'
                              : '#ff4d4f',
                      },
                    }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title={t('app.kuaizhizao.workReporting.statistics.statTotalWorkHours')}
                    value={statistics.total_work_hours}
                    precision={2}
                    styles={{ content: { color: '#722ed1' } }}
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
                    styles={{ content: { color: '#faad14' } }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title={t('app.kuaizhizao.workReporting.statistics.statApproved')}
                    value={statistics.approved_count}
                    styles={{ content: { color: '#52c41a' } }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title={t('app.kuaizhizao.workReporting.statistics.statAvgEfficiency')}
                    value={statistics.avg_quantity_per_hour}
                    precision={2}
                    styles={{ content: { color: '#1890ff' } }}
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
                    styles={{
                      content: {
                        color:
                          statistics.unqualified_rate <= 5
                            ? '#52c41a'
                            : statistics.unqualified_rate <= 10
                              ? '#faad14'
                              : '#ff4d4f',
                      },
                    }}
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
        ) : null}
      </Spin>
    </ListPageTemplate>
  );
};

export default ReportingStatisticsPage;

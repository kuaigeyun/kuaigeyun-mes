/**
 * 异常统计分析页面
 *
 * 提供异常统计分析功能，包括缺料异常、延期异常、质量异常的统计信息。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Card, Statistic, Row, Col, DatePicker, Space, Button } from 'antd';
import { WarningOutlined, ClockCircleOutlined, BugOutlined, CheckCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { apiRequest } from '../../../../../services/api';
import { Column, Pie } from '@ant-design/charts';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const P = 'app.kuaizhizao.productionException';

/**
 * 异常统计接口定义
 */
interface ExceptionStatistics {
  summary?: {
    total_exceptions?: number;
    total_pending?: number;
    total_resolved?: number;
    resolution_rate?: number;
  };
  material_shortage?: {
    total?: number;
    pending?: number;
    resolved?: number;
    by_level?: Record<string, number>;
  };
  delivery_delay?: {
    total?: number;
    pending?: number;
    resolved?: number;
    by_level?: Record<string, number>;
  };
  quality?: {
    total?: number;
    pending?: number;
    closed?: number;
    by_severity?: Record<string, number>;
  };
}

/**
 * 异常统计分析页面组件
 */
const ExceptionStatisticsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [statistics, setStatistics] = useState<ExceptionStatistics>({});
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const alertLevelLabel = useCallback(
    (level: string) => {
      const map: Record<string, string> = {
        critical: t(`${P}.alertLevel.critical`),
        high: t(`${P}.alertLevel.high`),
        medium: t(`${P}.alertLevel.medium`),
        low: t(`${P}.alertLevel.low`),
      };
      return map[level] ?? level;
    },
    [t],
  );

  const severityLabel = useCallback(
    (severity: string) => {
      const map: Record<string, string> = {
        critical: t(`${P}.quality.severity.critical`),
        major: t(`${P}.quality.severity.major`),
        minor: t(`${P}.quality.severity.minor`),
      };
      return map[severity] ?? severity;
    },
    [t],
  );

  /**
   * 加载统计数据
   */
  const loadStatistics = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.date_start = dateRange[0].format('YYYY-MM-DD');
        params.date_end = dateRange[1].format('YYYY-MM-DD');
      }
      const result = await apiRequest('/apps/kuaizhizao/exceptions/statistics', {
        method: 'GET',
        params,
      });
      setStatistics(result || {});
    } catch {
      messageApi.error(t(`${P}.statistics.message.fetchFailed`));
    } finally {
      setLoading(false);
    }
  }, [dateRange, messageApi, t]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  /**
   * 处理刷新
   */
  const handleRefresh = () => {
    loadStatistics();
  };

  /**
   * 处理手动触发异常检测
   */
  const handleTriggerDetection = async () => {
    try {
      setLoading(true);
      await apiRequest('/apps/kuaizhizao/exceptions/detect', {
        method: 'POST',
      });
      messageApi.success(t(`${P}.statistics.message.triggerSuccess`));
      setTimeout(() => {
        loadStatistics();
      }, 2000);
    } catch (error: any) {
      messageApi.error(error.message || t(`${P}.statistics.message.triggerFailed`));
    } finally {
      setLoading(false);
    }
  };

  const typeDistributionData = useMemo(
    () =>
      [
        {
          type: t(`${P}.statistics.chart.typeMaterialShortage`),
          value: statistics.material_shortage?.total || 0,
        },
        {
          type: t(`${P}.statistics.chart.typeDeliveryDelay`),
          value: statistics.delivery_delay?.total || 0,
        },
        {
          type: t(`${P}.statistics.chart.typeQuality`),
          value: statistics.quality?.total || 0,
        },
      ].filter((item) => item.value > 0),
    [statistics, t],
  );

  const statusDistributionData = useMemo(
    () =>
      [
        {
          type: t(`${P}.status.pending`),
          value: statistics.summary?.total_pending || 0,
        },
        {
          type: t(`${P}.status.resolved`),
          value: statistics.summary?.total_resolved || 0,
        },
      ].filter((item) => item.value > 0),
    [statistics, t],
  );

  return (
    <ListPageTemplate>
      <div>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Card>
            <Space>
              <span>{t(`${P}.statistics.dateRange`)}</span>
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                format="YYYY-MM-DD"
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
              >
                {t('common.refresh')}
              </Button>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleTriggerDetection}
                loading={loading}
              >
                {t(`${P}.statistics.triggerDetection`)}
              </Button>
            </Space>
          </Card>

          <Card title={t(`${P}.statistics.overallTitle`)}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.statistics.totalExceptions`)}
                  value={statistics.summary?.total_exceptions || 0}
                  prefix={<WarningOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.status.pending`)}
                  value={statistics.summary?.total_pending || 0}
                  styles={{ content: { color: '#ff4d4f' } }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.status.resolved`)}
                  value={statistics.summary?.total_resolved || 0}
                  styles={{ content: { color: '#52c41a' } }}
                  prefix={<CheckCircleOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.statistics.resolutionRate`)}
                  value={statistics.summary?.resolution_rate || 0}
                  suffix="%"
                  precision={2}
                />
              </Col>
            </Row>
          </Card>

          <Card title={t(`${P}.statistics.materialShortageTitle`)} loading={loading}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.statistics.materialShortageTotal`)}
                  value={statistics.material_shortage?.total || 0}
                  prefix={<WarningOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.status.pending`)}
                  value={statistics.material_shortage?.pending || 0}
                  styles={{ content: { color: '#ff4d4f' } }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.status.resolved`)}
                  value={statistics.material_shortage?.resolved || 0}
                  styles={{ content: { color: '#52c41a' } }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.statistics.byLevelDistribution`)}
                  value={Object.keys(statistics.material_shortage?.by_level || {}).length}
                />
              </Col>
            </Row>
            {statistics.material_shortage?.by_level && Object.keys(statistics.material_shortage.by_level).length > 0 && (
              <>
                <Row gutter={16} style={{ marginTop: 12 }}>
                  {Object.entries(statistics.material_shortage.by_level).map(([level, count]) => (
                    <Col span={6} key={level}>
                      <Statistic
                        title={t(`${P}.label.levelSuffix`, { level: alertLevelLabel(level) })}
                        value={count}
                      />
                    </Col>
                  ))}
                </Row>
                <div style={{ marginTop: 16 }}>
                  <Column
                    data={Object.entries(statistics.material_shortage.by_level).map(([level, count]) => ({
                      level: alertLevelLabel(level),
                      count,
                    }))}
                    xField="level"
                    yField="count"
                    label={{
                      position: 'top',
                    }}
                    height={300}
                  />
                </div>
              </>
            )}
          </Card>

          <Card title={t(`${P}.statistics.deliveryDelayTitle`)} loading={loading}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.statistics.deliveryDelayTotal`)}
                  value={statistics.delivery_delay?.total || 0}
                  prefix={<ClockCircleOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.status.pending`)}
                  value={statistics.delivery_delay?.pending || 0}
                  styles={{ content: { color: '#ff4d4f' } }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.status.resolved`)}
                  value={statistics.delivery_delay?.resolved || 0}
                  styles={{ content: { color: '#52c41a' } }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.statistics.byLevelDistribution`)}
                  value={Object.keys(statistics.delivery_delay?.by_level || {}).length}
                />
              </Col>
            </Row>
            {statistics.delivery_delay?.by_level && Object.keys(statistics.delivery_delay.by_level).length > 0 && (
              <>
                <Row gutter={16} style={{ marginTop: 12 }}>
                  {Object.entries(statistics.delivery_delay.by_level).map(([level, count]) => (
                    <Col span={6} key={level}>
                      <Statistic
                        title={t(`${P}.label.levelSuffix`, { level: alertLevelLabel(level) })}
                        value={count}
                      />
                    </Col>
                  ))}
                </Row>
                <div style={{ marginTop: 16 }}>
                  <Column
                    data={Object.entries(statistics.delivery_delay.by_level).map(([level, count]) => ({
                      level: alertLevelLabel(level),
                      count,
                    }))}
                    xField="level"
                    yField="count"
                    label={{
                      position: 'top',
                    }}
                    height={300}
                  />
                </div>
              </>
            )}
          </Card>

          <Card title={t(`${P}.statistics.qualityTitle`)} loading={loading}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.statistics.qualityTotal`)}
                  value={statistics.quality?.total || 0}
                  prefix={<BugOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.status.pending`)}
                  value={statistics.quality?.pending || 0}
                  styles={{ content: { color: '#ff4d4f' } }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.status.closed`)}
                  value={statistics.quality?.closed || 0}
                  styles={{ content: { color: '#52c41a' } }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t(`${P}.statistics.bySeverityDistribution`)}
                  value={Object.keys(statistics.quality?.by_severity || {}).length}
                />
              </Col>
            </Row>
            {statistics.quality?.by_severity && Object.keys(statistics.quality.by_severity).length > 0 && (
              <>
                <Row gutter={16} style={{ marginTop: 12 }}>
                  {Object.entries(statistics.quality.by_severity).map(([severity, count]) => (
                    <Col span={6} key={severity}>
                      <Statistic
                        title={severityLabel(severity)}
                        value={count}
                      />
                    </Col>
                  ))}
                </Row>
                <div style={{ marginTop: 16 }}>
                  <Column
                    data={Object.entries(statistics.quality.by_severity).map(([severity, count]) => ({
                      severity: severityLabel(severity),
                      count,
                    }))}
                    xField="severity"
                    yField="count"
                    label={{
                      position: 'top',
                    }}
                    height={300}
                  />
                </div>
              </>
            )}
          </Card>

          <Card title={t(`${P}.statistics.typeDistributionTitle`)} loading={loading}>
            <Row gutter={16}>
              <Col span={12}>
                <Pie
                  data={typeDistributionData}
                  angleField="value"
                  colorField="type"
                  radius={0.8}
                  label={{
                    type: 'outer',
                    content: '{name}: {value} ({percentage})',
                  }}
                  height={300}
                />
              </Col>
              <Col span={12}>
                <Pie
                  data={statusDistributionData}
                  angleField="value"
                  colorField="type"
                  radius={0.8}
                  label={{
                    type: 'outer',
                    content: '{name}: {value} ({percentage})',
                  }}
                  height={300}
                />
              </Col>
            </Row>
          </Card>
        </Space>
      </div>
    </ListPageTemplate>
  );
};

export default ExceptionStatisticsPage;

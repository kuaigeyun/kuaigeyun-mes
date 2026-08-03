/**
 * 单据执行效率分析页面（处理效率）
 */

import React, { useState, useEffect } from 'react';
import {
  App,
  Row,
  Col,
  Statistic,
  Table,
  Select,
  DatePicker,
  Space,
  Alert,
  List,
  Spin,
  Descriptions,
  Typography,
  Divider,
  Timeline,
  Button,
  Empty,
} from 'antd';
import { WarningOutlined, CheckCircleOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate, DetailDrawerSection } from '../../../../../components/layout-templates';
import { Column } from '@ant-design/charts';
import { apiRequest } from '../../../../../services/api';
import dayjs, { Dayjs } from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { downloadFile } from '../../../../../utils/fileDownload';

interface EfficiencyData {
  average_duration_hours?: number;
  bottleneck_nodes?: Array<{
    node_code: string;
    node_name: string;
    count: number;
    avg_hours: number;
    max_hours: number;
    min_hours: number;
  }>;
  optimization_suggestions?: Array<{
    type: string;
    node_name: string;
    suggestion: string;
    current_avg_hours?: number;
    max_hours?: number;
    avg_hours?: number;
  }>;
  node_statistics?: Array<{
    node_code: string;
    node_name: string;
    count: number;
    avg_hours: number;
    max_hours: number;
    min_hours: number;
  }>;
}

const EFFICIENCY_RESOURCE = 'kuaizhizao:document-efficiency';

const DocumentEfficiencyPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(EFFICIENCY_RESOURCE);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [efficiencyData, setEfficiencyData] = useState<EfficiencyData | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string>('');

  const [documentType, setDocumentType] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()]);

  const docTypeLabel = (type?: string) => {
    if (type === 'work_order') return t('app.kuaireport.analysis.docType.workOrder', { defaultValue: '工单' });
    if (type === 'purchase_order') return t('app.kuaireport.analysis.docType.purchaseOrder', { defaultValue: '采购订单' });
    if (type === 'sales_order') return t('app.kuaireport.analysis.docType.salesOrder', { defaultValue: '销售订单' });
    return t('common.all', { defaultValue: '全部' });
  };

  const loadEfficiencyData = async () => {
    try {
      setLoading(true);
      const result = await apiRequest('/apps/kuaizhizao/documents/efficiency', {
        method: 'GET',
        params: {
          document_type: documentType,
          date_start: dateRange[0].format('YYYY-MM-DD'),
          date_end: dateRange[1].format('YYYY-MM-DD'),
        },
      });
      setEfficiencyData(result);
      setLastLoadedAt(formatDateTime(new Date(), 'YYYY-MM-DD HH:mm:ss'));
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaireport.analysis.efficiency.loadFailed', { defaultValue: '加载效率分析数据失败' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEfficiencyData();
  }, [documentType, dateRange]);

  const handleExport = () => {
    const nodes = efficiencyData?.node_statistics || [];
    const bottlenecks = efficiencyData?.bottleneck_nodes || [];
    if (!nodes.length && !bottlenecks.length) {
      messageApi.warning(t('app.kuaireport.analysis.exportEmpty', { defaultValue: '暂无数据可导出' }));
      return;
    }
    setExporting(true);
    try {
      const headers = ['分区', '节点名称', '节点编码', '执行次数', '平均耗时(小时)', '最长耗时', '最短耗时'];
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const row = (section: string, n: { node_name: string; node_code: string; count: number; avg_hours: number; max_hours: number; min_hours: number }) =>
        [section, n.node_name, n.node_code, n.count, n.avg_hours, n.max_hours, n.min_hours].map(esc).join(',');
      const lines = [
        headers.join(','),
        ...bottlenecks.map((n) => row('瓶颈节点', n)),
        ...nodes.map((n) => row('节点统计', n)),
      ];
      const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      downloadFile(blob, `document-efficiency_${new Date().toISOString().slice(0, 10)}.csv`);
      messageApi.success(t('app.kuaireport.analysis.exportSuccess', { defaultValue: '导出成功' }));
    } finally {
      setExporting(false);
    }
  };

  const hasNodes = Boolean(efficiencyData?.node_statistics?.length);
  const nodeStatsConfig = hasNodes
    ? {
        data: (efficiencyData!.node_statistics || []).map((node) => ({
          node: node.node_name,
          avg_hours: node.avg_hours,
        })),
        xField: 'node',
        yField: 'avg_hours',
        label: {
          position: 'top' as const,
          formatter: (data: any) => `${Number(data.avg_hours).toFixed(2)}h`,
        },
        tooltip: {
          formatter: (data: any) => ({
            name: t('app.kuaireport.analysis.col.avgHours', { defaultValue: '平均耗时' }),
            value: `${Number(data.avg_hours).toFixed(2)}${t('app.kuaireport.analysis.unit.hours', { defaultValue: '小时' })}`,
          }),
        },
      }
    : null;

  const bottleneckColumns = [
    { title: t('app.kuaireport.analysis.col.nodeName', { defaultValue: '节点名称' }), dataIndex: 'node_name', width: 150 },
    { title: t('app.kuaireport.analysis.col.execCount', { defaultValue: '执行次数' }), dataIndex: 'count', width: 100, align: 'right' as const },
    {
      title: t('app.kuaireport.analysis.col.avgHours', { defaultValue: '平均耗时' }),
      dataIndex: 'avg_hours',
      width: 120,
      align: 'right' as const,
      render: (value: number) => `${value.toFixed(2)}${t('app.kuaireport.analysis.unit.hours', { defaultValue: '小时' })}`,
    },
    {
      title: t('app.kuaireport.analysis.col.maxHours', { defaultValue: '最长耗时' }),
      dataIndex: 'max_hours',
      width: 120,
      align: 'right' as const,
      render: (value: number) => `${value.toFixed(2)}${t('app.kuaireport.analysis.unit.hours', { defaultValue: '小时' })}`,
    },
    {
      title: t('app.kuaireport.analysis.col.minHours', { defaultValue: '最短耗时' }),
      dataIndex: 'min_hours',
      width: 120,
      align: 'right' as const,
      render: (value: number) => `${value.toFixed(2)}${t('app.kuaireport.analysis.unit.hours', { defaultValue: '小时' })}`,
    },
  ];

  return (
    <ListPageTemplate>
      <Spin spinning={loading}>
        <DetailDrawerSection title={t('app.kuaireport.analysis.filters', { defaultValue: '查询条件' })}>
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space wrap>
              <span>{t('app.kuaireport.analysis.col.documentType', { defaultValue: '单据类型' })}：</span>
              <Select
                value={documentType}
                onChange={setDocumentType}
                style={{ width: 150 }}
                allowClear
                placeholder={t('common.all', { defaultValue: '全部' })}
              >
                <Select.Option value="work_order">{docTypeLabel('work_order')}</Select.Option>
                <Select.Option value="purchase_order">{docTypeLabel('purchase_order')}</Select.Option>
                <Select.Option value="sales_order">{docTypeLabel('sales_order')}</Select.Option>
              </Select>
              <span>{t('app.kuaireport.analysis.col.dateRange', { defaultValue: '时间范围' })}：</span>
              <DatePicker.RangePicker
                value={dateRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([dates[0], dates[1]]);
                  } else {
                    setDateRange([dayjs().subtract(30, 'day'), dayjs()]);
                  }
                }}
              />
            </Space>
            <Space>
              {perms.canExport ? (
                <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
                  {t('common.export', { defaultValue: '导出' })}
                </Button>
              ) : null}
              {perms.canPrint ? (
                <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                  {t('common.print', { defaultValue: '打印' })}
                </Button>
              ) : null}
            </Space>
          </Space>
        </DetailDrawerSection>

        {efficiencyData && (
          <>
            <DetailDrawerSection title={t('common.basicInfo', { defaultValue: '基本信息' })}>
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label={t('app.kuaireport.analysis.col.documentType', { defaultValue: '单据类型' })}>
                  {docTypeLabel(documentType)}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaireport.analysis.col.dateRange', { defaultValue: '时间范围' })}>
                  {dateRange[0].format('YYYY-MM-DD')} ~ {dateRange[1].format('YYYY-MM-DD')}
                </Descriptions.Item>
              </Descriptions>
              <Divider style={{ margin: '16px 0' }} />
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Statistic
                    title={t('app.kuaireport.analysis.col.avgHours', { defaultValue: '平均耗时' })}
                    value={efficiencyData.average_duration_hours || 0}
                    suffix={t('app.kuaireport.analysis.unit.hours', { defaultValue: '小时' })}
                    styles={{ content: { color: 'var(--ant-color-primary)' } }}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title={t('app.kuaireport.analysis.efficiency.bottleneckCount', { defaultValue: '瓶颈节点数' })}
                    value={efficiencyData.bottleneck_nodes?.length || 0}
                    suffix={t('app.kuaireport.analysis.unit.count', { defaultValue: '个' })}
                    styles={{ content: { color: 'var(--ant-color-error)' } }}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title={t('app.kuaireport.analysis.efficiency.suggestionCount', { defaultValue: '优化建议数' })}
                    value={efficiencyData.optimization_suggestions?.length || 0}
                    suffix={t('app.kuaireport.analysis.unit.items', { defaultValue: '条' })}
                    styles={{ content: { color: 'var(--ant-color-warning)' } }}
                  />
                </Col>
              </Row>
            </DetailDrawerSection>

            <DetailDrawerSection title={t('app.kuaireport.analysis.efficiency.detail', { defaultValue: '明细信息' })}>
              {!hasNodes && !(efficiencyData.bottleneck_nodes?.length) ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('app.kuaireport.analysis.efficiency.empty', {
                    defaultValue: '所选范围内暂无节点耗时数据（目前主要来自工单生命周期）',
                  })}
                />
              ) : null}

              {efficiencyData.bottleneck_nodes && efficiencyData.bottleneck_nodes.length > 0 && (
                <>
                  <Typography.Title level={5} style={{ marginTop: 0 }}>
                    {t('app.kuaireport.analysis.efficiency.bottleneckTitle', { defaultValue: '瓶颈节点分析' })}
                  </Typography.Title>
                  <div style={{ overflowX: 'auto', overflowY: 'hidden', marginBottom: 16 }}>
                    <Table
                      size="small"
                      columns={bottleneckColumns}
                      dataSource={efficiencyData.bottleneck_nodes}
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                      rowKey={(r) => r.node_code || r.node_name}
                    />
                  </div>
                </>
              )}

              {efficiencyData.optimization_suggestions && efficiencyData.optimization_suggestions.length > 0 && (
                <>
                  <Typography.Title level={5}>
                    {t('app.kuaireport.analysis.efficiency.suggestions', { defaultValue: '优化建议' })}
                  </Typography.Title>
                  <List
                    dataSource={efficiencyData.optimization_suggestions}
                    renderItem={(item) => (
                      <List.Item>
                        <Alert
                          title={item.node_name}
                          description={item.suggestion}
                          type={item.type === 'bottleneck' ? 'warning' : 'info'}
                          icon={item.type === 'bottleneck' ? <WarningOutlined /> : <CheckCircleOutlined />}
                          showIcon
                        />
                      </List.Item>
                    )}
                  />
                </>
              )}

              {nodeStatsConfig && (
                <>
                  <Typography.Title level={5}>
                    {t('app.kuaireport.analysis.efficiency.nodeChart', { defaultValue: '节点耗时统计' })}
                  </Typography.Title>
                  <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                    <Column {...nodeStatsConfig} height={300} />
                  </div>
                </>
              )}

              {hasNodes && (
                <>
                  <Typography.Title level={5} style={{ marginTop: nodeStatsConfig ? 16 : 0 }}>
                    {t('app.kuaireport.analysis.efficiency.nodeTable', { defaultValue: '节点详细统计' })}
                  </Typography.Title>
                  <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                    <Table
                      size="small"
                      columns={bottleneckColumns}
                      dataSource={efficiencyData.node_statistics}
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                      rowKey={(r) => r.node_code || r.node_name}
                    />
                  </div>
                </>
              )}
            </DetailDrawerSection>

            <DetailDrawerSection title={t('app.kuaireport.analysis.efficiency.refreshLog', { defaultValue: '操作记录' })} marginBottom={0}>
              <Timeline
                items={[
                  {
                    color: 'blue',
                    children: (
                      <>
                        {t('app.kuaireport.analysis.efficiency.dataRefresh', { defaultValue: '数据刷新' })} - {lastLoadedAt || '-'}
                      </>
                    ),
                  },
                ]}
              />
            </DetailDrawerSection>
          </>
        )}
      </Spin>
    </ListPageTemplate>
  );
};

export default DocumentEfficiencyPage;

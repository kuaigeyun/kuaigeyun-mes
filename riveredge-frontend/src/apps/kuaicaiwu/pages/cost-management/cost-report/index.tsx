/**
 * 成本报表分析页面
 */

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ProForm,
  ProFormSelect,
  ProFormDatePicker,
  ProFormRadio,
  ProDescriptions,
} from '@ant-design/pro-components';
import type { TabsProps } from 'antd';
import { App, Tag, Divider, Row, Col, Statistic, Space, Tabs, Empty, Descriptions, Typography, Timeline, theme } from 'antd';
import { BarChartOutlined, LineChartOutlined, FileTextOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { MultiTabListPageTemplate, DetailDrawerSection } from '../../../../../components/layout-templates';
import { costReportApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';
import { normalizeCostListRows } from '../costSelectData';
import { getSourceTypeSelectOptions, getSourceTypeTag } from '../../../utils/costUiLabels';
import { formatDateTime } from '../../../../../utils/format';

type ReportSection = 'comprehensive' | 'trend' | 'structure';

interface TrendData {
  period: string;
  total_cost: number;
  material_cost: number;
  labor_cost: number;
  manufacturing_cost: number;
  count: number;
  by_source_type: Record<string, any>;
}

interface StructureData {
  total_cost: number;
  cost_composition: {
    material_cost: number;
    labor_cost: number;
    manufacturing_cost: number;
  };
  cost_rates: {
    material_cost_rate: number;
    labor_cost_rate: number;
    manufacturing_cost_rate: number;
  };
  by_source_type: Record<string, any>;
  summary: any;
}

interface CostReportResult {
  report_type: string;
  start_date: string;
  end_date: string;
  generated_at: string;
  trend_analysis?: {
    start_date: string;
    end_date: string;
    group_by: string;
    trend_data: TrendData[];
    summary: any;
  };
  structure_analysis?: StructureData;
}

function parseReportSection(sp: URLSearchParams): ReportSection {
  const s = sp.get('section');
  if (s === 'trend' || s === 'structure' || s === 'comprehensive') return s;
  if (s === 'reports') return 'comprehensive';
  return 'comprehensive';
}

const defaultFormValues = {
  start_date: dayjs().subtract(30, 'day'),
  end_date: dayjs(),
  group_by: 'month',
};

const CostReportPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { message: messageApi } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const reportSection = parseReportSection(searchParams);

  const comprehensiveFormRef = useRef<any>(null);
  const trendFormRef = useRef<any>(null);
  const structureFormRef = useRef<any>(null);

  const [resultBySection, setResultBySection] = useState<Partial<Record<ReportSection, CostReportResult>>>({});
  const [loadingSection, setLoadingSection] = useState<ReportSection | null>(null);
  const [materials, setMaterials] = useState<any[]>([]);

  const reportTypeLabel = useMemo(
    () => ({
      comprehensive: t('app.kuaicaiwu.costReport.tab.comprehensive'),
      trend: t('app.kuaicaiwu.costReport.tab.trend'),
      structure: t('app.kuaicaiwu.costReport.tab.structure'),
    }),
    [t],
  );

  useEffect(() => {
    if (searchParams.get('section') === 'optimization') {
      const path = location.pathname.replace(/\/cost-report\/?$/, '/cost-calculations');
      navigate(`${path}?cat=optimization`, { replace: true });
    }
  }, [searchParams, navigate, location.pathname]);

  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const list = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(normalizeCostListRows(list));
      } catch (error: any) {
        console.error('load materials failed:', error);
      }
    };
    loadMaterials();
  }, []);

  const handleGenerateReport = useCallback(
    async (section: ReportSection, values: any) => {
      try {
        setLoadingSection(section);
        const data = {
          report_type: section,
          start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
          end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : undefined,
          material_id: values.material_id,
          source_type: values.source_type,
          group_by: values.group_by || 'month',
        };
        const result = await costReportApi.generate(data);
        setResultBySection((prev) => ({ ...prev, [section]: result }));
        messageApi.success(t('app.kuaicaiwu.costReport.generateSuccess'));
      } catch (error: any) {
        messageApi.error(error.message || t('app.kuaicaiwu.costReport.generateFailed'));
      } finally {
        setLoadingSection(null);
      }
    },
    [messageApi, t],
  );

  const structureBySourceColumns = useMemo(
    () => [
      { title: t('app.kuaicaiwu.costCommon.col.totalCost'), dataIndex: 'total_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.materialCost'), dataIndex: 'material_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.laborCost'), dataIndex: 'labor_cost' },
      { title: t('app.kuaicaiwu.costCommon.col.manufacturingCost'), dataIndex: 'manufacturing_cost' },
      { title: t('app.kuaicaiwu.costReport.col.recordCount'), dataIndex: 'count' },
    ],
    [t],
  );

  const renderReportResult = (result: CostReportResult) => {
    const tabItems: NonNullable<TabsProps['items']> = [];
    if (result.trend_analysis) {
      tabItems.push({
        key: 'trend',
        label: t('app.kuaicaiwu.costReport.innerTab.trend'),
        children: (
          <>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={8}>
                <Statistic title={t('app.kuaicaiwu.costReport.col.totalPeriods')} value={result.trend_analysis!.summary.total_periods} />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic title={t('app.kuaicaiwu.costCommon.col.totalCost')} value={result.trend_analysis!.summary.total_cost} prefix="¥" precision={2} />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic title={t('app.kuaicaiwu.costReport.col.avgCostPerPeriod')} value={result.trend_analysis!.summary.avg_cost_per_period} prefix="¥" precision={2} />
              </Col>
            </Row>
            <Typography.Text type="secondary">{t('app.kuaicaiwu.costReport.trendDataJson')}</Typography.Text>
            <div style={{ overflowX: 'auto', overflowY: 'hidden', marginTop: 8 }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflow: 'auto' }}>
                {JSON.stringify(result.trend_analysis.trend_data, null, 2)}
              </pre>
            </div>
          </>
        ),
      });
    }
    if (result.structure_analysis) {
      tabItems.push({
        key: 'structure',
        label: t('app.kuaicaiwu.costReport.innerTab.structure'),
        children: (
          <>
            <Typography.Text strong>{t('app.kuaicaiwu.costCommon.col.totalCost')}</Typography.Text>
            <Statistic
              value={result.structure_analysis.total_cost}
              prefix="¥"
              precision={2}
              styles={{ content: { fontSize: 22, fontWeight: 600, color: token.colorPrimary } }}
            />
            <Divider style={{ margin: '16px 0' }} />
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Statistic title={t('app.kuaicaiwu.costCommon.col.materialCost')} value={result.structure_analysis.cost_composition.material_cost} prefix="¥" precision={2} />
                <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextSecondary }}>
                  {t('app.kuaicaiwu.costReport.shareRate', { rate: result.structure_analysis.cost_rates.material_cost_rate.toFixed(2) })}
                </div>
              </Col>
              <Col xs={24} md={8}>
                <Statistic title={t('app.kuaicaiwu.costCommon.col.laborCost')} value={result.structure_analysis.cost_composition.labor_cost} prefix="¥" precision={2} />
                <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextSecondary }}>
                  {t('app.kuaicaiwu.costReport.shareRate', { rate: result.structure_analysis.cost_rates.labor_cost_rate.toFixed(2) })}
                </div>
              </Col>
              <Col xs={24} md={8}>
                <Statistic title={t('app.kuaicaiwu.costCommon.col.manufacturingCost')} value={result.structure_analysis.cost_composition.manufacturing_cost} prefix="¥" precision={2} />
                <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextSecondary }}>
                  {t('app.kuaicaiwu.costReport.shareRate', { rate: result.structure_analysis.cost_rates.manufacturing_cost_rate.toFixed(2) })}
                </div>
              </Col>
            </Row>
            {result.structure_analysis.by_source_type && Object.keys(result.structure_analysis.by_source_type).length > 0 && (
              <>
                <Divider>{t('app.kuaicaiwu.costReport.bySourceType')}</Divider>
                <Row gutter={[16, 16]}>
                  {Object.entries(result.structure_analysis.by_source_type).map(([sourceType, data]: [string, any]) => (
                    <Col xs={24} lg={12} key={sourceType}>
                      <div style={{ padding: 12, border: `1px solid ${token.colorBorder}`, borderRadius: token.borderRadius, background: token.colorFillAlter }}>
                        <div style={{ marginBottom: 8 }}>{getSourceTypeTag(sourceType, t)}</div>
                        <ProDescriptions
                          column={1}
                          size="small"
                          dataSource={{
                            total_cost: `¥${data.total_cost.toFixed(2)}`,
                            material_cost: `¥${data.material_cost.toFixed(2)}`,
                            labor_cost: `¥${data.labor_cost.toFixed(2)}`,
                            manufacturing_cost: `¥${data.manufacturing_cost.toFixed(2)}`,
                            count: data.count,
                          }}
                          columns={structureBySourceColumns}
                        />
                      </div>
                    </Col>
                  ))}
                </Row>
              </>
            )}
          </>
        ),
      });
    }

    return (
      <div style={{ marginTop: 16 }}>
        <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.basicInfo')}>
          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small">
            <Descriptions.Item label={t('app.kuaicaiwu.costReport.col.reportType')}>
              {reportTypeLabel[result.report_type as ReportSection] ?? result.report_type}
            </Descriptions.Item>
            <Descriptions.Item label={t('app.kuaicaiwu.costReport.col.generatedAt')}>
              {formatDateTime(result.generated_at, 'YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label={t('app.kuaicaiwu.costCommon.col.startDate')}>{formatDateTime(result.start_date, 'YYYY-MM-DD')}</Descriptions.Item>
            <Descriptions.Item label={t('app.kuaicaiwu.costCommon.col.endDate')}>{formatDateTime(result.end_date, 'YYYY-MM-DD')}</Descriptions.Item>
          </Descriptions>
        </DetailDrawerSection>

        <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.lifecycle')}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('app.kuaicaiwu.costReport.lifecycleHint')}
          </Typography.Paragraph>
        </DetailDrawerSection>

        <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.details')}>
          {tabItems.length > 0 ? (
            <Tabs defaultActiveKey={tabItems[0].key} items={tabItems} />
          ) : (
            <Empty description={t('app.kuaicaiwu.costReport.noTrendOrStructure')} />
          )}
        </DetailDrawerSection>

        <DetailDrawerSection title={t('app.kuaicaiwu.costCommon.section.operationLog')} marginBottom={0}>
          <Timeline
            items={[
              {
                color: 'blue',
                children: (
                  <>
                    {t('app.kuaicaiwu.costReport.reportGenerated')} · {formatDateTime(result.generated_at, 'YYYY-MM-DD HH:mm:ss')}
                  </>
                ),
              },
            ]}
          />
        </DetailDrawerSection>
      </div>
    );
  };

  const materialSelectField = (
    <ProFormSelect
      name="material_id"
      label={t('app.kuaicaiwu.costReport.field.materialOptional')}
      placeholder={t('app.kuaicaiwu.costReport.field.materialOptionalPlaceholder')}
      options={materials.map((m) => ({
        label: `${m.mainCode || m.code} - ${m.name}`,
        value: m.id,
      }))}
      fieldProps={{
        showSearch: true,
        filterOption: (input: string, option: any) => option?.label?.toLowerCase().includes(input.toLowerCase()),
      }}
    />
  );

  const sourceTypeField = (
    <ProFormSelect
      name="source_type"
      label={t('app.kuaicaiwu.costReport.field.sourceTypeOptional')}
      placeholder={t('app.kuaicaiwu.costReport.field.sourceTypeOptionalPlaceholder')}
      options={getSourceTypeSelectOptions(t)}
    />
  );

  const groupByField = (
    <ProFormRadio.Group
      name="group_by"
      label={t('app.kuaicaiwu.costReport.field.groupBy')}
      options={[
        { label: t('app.kuaicaiwu.costReport.groupBy.month'), value: 'month' },
        { label: t('app.kuaicaiwu.costReport.groupBy.week'), value: 'week' },
        { label: t('app.kuaicaiwu.costReport.groupBy.day'), value: 'day' },
      ]}
    />
  );

  const dateFields = (
    <>
      <ProFormDatePicker
        name="start_date"
        label={t('app.kuaicaiwu.costCommon.col.startDate')}
        placeholder={t('app.kuaicaiwu.costReport.field.startDatePlaceholder')}
        rules={[{ required: true, message: t('app.kuaicaiwu.costReport.field.startDateRequired') }]}
        fieldProps={{ style: { width: '100%' } }}
      />
      <ProFormDatePicker
        name="end_date"
        label={t('app.kuaicaiwu.costCommon.col.endDate')}
        placeholder={t('app.kuaicaiwu.costReport.field.endDatePlaceholder')}
        rules={[{ required: true, message: t('app.kuaicaiwu.costReport.field.endDateRequired') }]}
        fieldProps={{ style: { width: '100%' } }}
      />
    </>
  );

  const comprehensivePanel = (
    <div>
      <ProForm
        formRef={comprehensiveFormRef}
        layout="vertical"
        initialValues={defaultFormValues}
        onFinish={(v) => handleGenerateReport('comprehensive', v)}
        submitter={{
          searchConfig: { submitText: t('app.kuaicaiwu.costReport.submit.comprehensive') },
          resetButtonProps: { style: { display: 'none' } },
          submitButtonProps: { loading: loadingSection === 'comprehensive' },
        }}
      >
        {dateFields}
        {materialSelectField}
        {sourceTypeField}
        {groupByField}
      </ProForm>
      {!resultBySection.comprehensive && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaicaiwu.costReport.empty.comprehensive')} style={{ margin: '32px 0' }} />
      )}
      {resultBySection.comprehensive && renderReportResult(resultBySection.comprehensive)}
    </div>
  );

  const trendPanel = (
    <div>
      <ProForm
        formRef={trendFormRef}
        layout="vertical"
        initialValues={defaultFormValues}
        onFinish={(v) => handleGenerateReport('trend', v)}
        submitter={{
          searchConfig: { submitText: t('app.kuaicaiwu.costReport.submit.trend') },
          resetButtonProps: { style: { display: 'none' } },
          submitButtonProps: { loading: loadingSection === 'trend' },
        }}
      >
        {dateFields}
        {materialSelectField}
        {sourceTypeField}
        {groupByField}
      </ProForm>
      {!resultBySection.trend && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaicaiwu.costReport.empty.trend')} style={{ margin: '32px 0' }} />
      )}
      {resultBySection.trend && renderReportResult(resultBySection.trend)}
    </div>
  );

  const structurePanel = (
    <div>
      <ProForm
        formRef={structureFormRef}
        layout="vertical"
        initialValues={{ start_date: defaultFormValues.start_date, end_date: defaultFormValues.end_date }}
        onFinish={(v) => handleGenerateReport('structure', v)}
        submitter={{
          searchConfig: { submitText: t('app.kuaicaiwu.costReport.submit.structure') },
          resetButtonProps: { style: { display: 'none' } },
          submitButtonProps: { loading: loadingSection === 'structure' },
        }}
      >
        {dateFields}
        {materialSelectField}
        {sourceTypeField}
      </ProForm>
      {!resultBySection.structure && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaicaiwu.costReport.empty.structure')} style={{ margin: '32px 0' }} />
      )}
      {resultBySection.structure && renderReportResult(resultBySection.structure)}
    </div>
  );

  const handleReportTabChange = (key: string) => {
    setSearchParams({ section: key }, { replace: true });
  };

  return (
    <MultiTabListPageTemplate
      activeTabKey={reportSection}
      onTabChange={handleReportTabChange}
      padding={16}
      preserveMounted
      tabs={[
        {
          key: 'comprehensive',
          label: (
            <Space>
              <FileTextOutlined />
              {t('app.kuaicaiwu.costReport.tab.comprehensive')}
            </Space>
          ),
          children: comprehensivePanel,
        },
        {
          key: 'trend',
          label: (
            <Space>
              <LineChartOutlined />
              {t('app.kuaicaiwu.costReport.tab.trend')}
            </Space>
          ),
          children: trendPanel,
        },
        {
          key: 'structure',
          label: (
            <Space>
              <BarChartOutlined />
              {t('app.kuaicaiwu.costReport.tab.structure')}
            </Space>
          ),
          children: structurePanel,
        },
      ]}
    />
  );
};

export default CostReportPage;

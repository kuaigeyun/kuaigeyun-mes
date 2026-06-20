/**
 * 成本报表分析页面
 *
 * 三个一级 Tab：综合报表、成本趋势分析、成本结构分析（综合报表为首）。
 * 物料来源类「优化建议」已并入成本核算页。
 *
 * @author Luigi Lu
 * @date 2026-01-16
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ProForm,
  ProFormSelect,
  ProFormDatePicker,
  ProFormRadio,
  ProDescriptions,
} from '@ant-design/pro-components';
import { App, Card, Tag, Divider, Row, Col, Statistic, Space, Tabs, Empty } from 'antd';
import { BarChartOutlined, LineChartOutlined, FileTextOutlined } from '@ant-design/icons';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { costReportApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';
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

  useEffect(() => {
    if (searchParams.get('section') === 'optimization') {
      const path = location.pathname.replace(/\/cost-report\/?$/, '/cost-calculations');
      navigate(`${path}?cat=optimization`, { replace: true });
    }
  }, [searchParams, navigate, location.pathname]);

  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(result);
      } catch (error: any) {
        console.error('加载物料列表失败:', error);
      }
    };
    loadMaterials();
  }, []);

  const handleGenerateReport = useCallback(
    async (section: ReportSection, values: any) => {
      const report_type = section;
      try {
        setLoadingSection(section);
        const data = {
          report_type,
          start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
          end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : undefined,
          material_id: values.material_id,
          source_type: values.source_type,
          group_by: values.group_by || 'month',
        };
        const result = await costReportApi.generate(data);
        setResultBySection((prev) => ({ ...prev, [section]: result }));
        messageApi.success('成本报表生成成功');
      } catch (error: any) {
        messageApi.error(error.message || '成本报表生成失败');
      } finally {
        setLoadingSection(null);
      }
    },
    [messageApi]
  );

  const getSourceTypeTag = (sourceType: string) => {
    const normalized = sourceType === 'Configure' ? 'Buy' : sourceType;
    const typeMap: Record<string, { color: string; text: string }> = {
      Make: { color: 'blue', text: '自制件' },
      Buy: { color: 'green', text: '采购件' },
      Outsource: { color: 'orange', text: '委外件' },
      Phantom: { color: 'purple', text: '虚拟件' },
      Service: { color: 'cyan', text: '服务' },
    };
    const type = typeMap[normalized] || { color: 'default', text: normalized || sourceType };
    return <Tag color={type.color}>{type.text}</Tag>;
  };

  const renderReportResult = (result: CostReportResult) => (
    <Card title="成本报表" style={{ marginTop: 16 }}>
      <ProDescriptions
        bordered
        column={2}
        style={{ marginBottom: 24 }}
        dataSource={{
          report_type: result.report_type,
          generated_at: formatDateTime(result.generated_at, 'YYYY-MM-DD HH:mm:ss'),
          start_date: formatDateTime(result.start_date, 'YYYY-MM-DD'),
          end_date: formatDateTime(result.end_date, 'YYYY-MM-DD'),
        }}
        columns={[
          { title: '报表类型', dataIndex: 'report_type' },
          { title: '生成时间', dataIndex: 'generated_at' },
          { title: '开始日期', dataIndex: 'start_date' },
          { title: '结束日期', dataIndex: 'end_date' },
        ]}
      />

      <Tabs defaultActiveKey={result.trend_analysis ? '1' : '2'}>
        {result.trend_analysis && (
          <Tabs.TabPane tab="成本趋势" key="1">
            <Card title="成本趋势分析" size="small">
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={8}>
                  <Statistic title="总期间数" value={result.trend_analysis.summary.total_periods} />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="总成本"
                    value={result.trend_analysis.summary.total_cost}
                    prefix="¥"
                    precision={2}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="平均成本/期间"
                    value={result.trend_analysis.summary.avg_cost_per_period}
                    prefix="¥"
                    precision={2}
                  />
                </Col>
              </Row>

              <div style={{ marginTop: 24 }}>
                <h4>趋势数据</h4>
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: '16px',
                    borderRadius: '4px',
                    maxHeight: '400px',
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(result.trend_analysis.trend_data, null, 2)}
                </pre>
              </div>
            </Card>
          </Tabs.TabPane>
        )}

        {result.structure_analysis && (
          <Tabs.TabPane tab="成本结构" key="2">
            <Card title="成本结构分析" size="small">
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="材料成本"
                      value={result.structure_analysis.cost_composition.material_cost}
                      prefix="¥"
                      precision={2}
                    />
                    <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                      占比：{result.structure_analysis.cost_rates.material_cost_rate.toFixed(2)}%
                    </div>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="人工成本"
                      value={result.structure_analysis.cost_composition.labor_cost}
                      prefix="¥"
                      precision={2}
                    />
                    <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                      占比：{result.structure_analysis.cost_rates.labor_cost_rate.toFixed(2)}%
                    </div>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="制造费用"
                      value={result.structure_analysis.cost_composition.manufacturing_cost}
                      prefix="¥"
                      precision={2}
                    />
                    <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                      占比：{result.structure_analysis.cost_rates.manufacturing_cost_rate.toFixed(2)}%
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card title="总成本" style={{ marginBottom: 16 }}>
                <Statistic
                  value={result.structure_analysis.total_cost}
                  prefix="¥"
                  precision={2}
                  styles={{ content: {fontSize: '24px', fontWeight: 'bold', color: '#1890ff' } }}
                />
              </Card>

              {result.structure_analysis.by_source_type &&
                Object.keys(result.structure_analysis.by_source_type).length > 0 && (
                  <>
                    <Divider>按物料来源类型统计</Divider>
                    <Row gutter={16}>
                      {Object.entries(result.structure_analysis.by_source_type).map(([sourceType, data]: [string, any]) => (
                        <Col span={12} key={sourceType} style={{ marginBottom: 16 }}>
                          <Card title={getSourceTypeTag(sourceType)} size="small">
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
                              columns={[
                                { title: '总成本', dataIndex: 'total_cost' },
                                { title: '材料成本', dataIndex: 'material_cost' },
                                { title: '人工成本', dataIndex: 'labor_cost' },
                                { title: '制造费用', dataIndex: 'manufacturing_cost' },
                                { title: '记录数', dataIndex: 'count' },
                              ]}
                            />
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </>
                )}
            </Card>
          </Tabs.TabPane>
        )}
      </Tabs>
    </Card>
  );

  const materialSelectField = (
    <ProFormSelect
      name="material_id"
      label="物料（可选）"
      placeholder="请选择物料（可选，用于分析特定物料）"
      options={materials.map((m) => ({
        label: `${m.mainCode || m.code} - ${m.name}`,
        value: m.id,
      }))}
      fieldProps={{
        showSearch: true,
        filterOption: (input: string, option: any) =>
          option?.label?.toLowerCase().includes(input.toLowerCase()),
      }}
    />
  );

  const sourceTypeField = (
    <ProFormSelect
      name="source_type"
      label="物料来源类型（可选）"
      placeholder="请选择物料来源类型（可选）"
      options={[
        { label: '自制件', value: 'Make' },
        { label: '采购件', value: 'Buy' },
        { label: '委外件', value: 'Outsource' },
        { label: '虚拟件', value: 'Phantom' },
        { label: '服务', value: 'Service' },
      ]}
    />
  );

  const groupByField = (
    <ProFormRadio.Group
      name="group_by"
      label="分组方式"
      options={[
        { label: '按月', value: 'month' },
        { label: '按周', value: 'week' },
        { label: '按日', value: 'day' },
      ]}
    />
  );

  const dateFields = (
    <>
      <ProFormDatePicker
        name="start_date"
        label="开始日期"
        placeholder="请选择开始日期"
        rules={[{ required: true, message: '请选择开始日期' }]}
        fieldProps={{ style: { width: '100%' } }}
      />
      <ProFormDatePicker
        name="end_date"
        label="结束日期"
        placeholder="请选择结束日期"
        rules={[{ required: true, message: '请选择结束日期' }]}
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
          searchConfig: { submitText: '生成综合报表' },
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
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="填写条件后点击「生成综合报表」查看趋势与结构汇总。"
          style={{ margin: '32px 0' }}
        />
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
          searchConfig: { submitText: '生成趋势分析' },
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
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="填写条件后点击「生成趋势分析」查看成本趋势。"
          style={{ margin: '32px 0' }}
        />
      )}
      {resultBySection.trend && renderReportResult(resultBySection.trend)}
    </div>
  );

  const structurePanel = (
    <div>
      <ProForm
        formRef={structureFormRef}
        layout="vertical"
        initialValues={{
          start_date: defaultFormValues.start_date,
          end_date: defaultFormValues.end_date,
        }}
        onFinish={(v) => handleGenerateReport('structure', v)}
        submitter={{
          searchConfig: { submitText: '生成结构分析' },
          resetButtonProps: { style: { display: 'none' } },
          submitButtonProps: { loading: loadingSection === 'structure' },
        }}
      >
        {dateFields}
        {materialSelectField}
        {sourceTypeField}
      </ProForm>
      {!resultBySection.structure && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="填写条件后点击「生成结构分析」查看成本结构。"
          style={{ margin: '32px 0' }}
        />
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
              综合报表
            </Space>
          ),
          children: comprehensivePanel,
        },
        {
          key: 'trend',
          label: (
            <Space>
              <LineChartOutlined />
              成本趋势分析
            </Space>
          ),
          children: trendPanel,
        },
        {
          key: 'structure',
          label: (
            <Space>
              <BarChartOutlined />
              成本结构分析
            </Space>
          ),
          children: structurePanel,
        },
      ]}
    />
  );
};

export default CostReportPage;

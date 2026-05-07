/**
 * 成本对比页面
 *
 * 提供标准成本和实际成本对比功能，基于物料来源类型进行成本对比分析。
 *
 * @author Luigi Lu
 * @date 2026-01-16
 */

import React, { useRef, useState } from 'react';
import { ProFormSelect, ProFormDigit, ProFormDatePicker, PageContainer } from '@ant-design/pro-components';
import { App, Button, Tag, Divider, Row, Col, Statistic, Alert, Descriptions, Typography, Empty, Timeline } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { ListPageTemplate, FormModalTemplate, DetailDrawerSection, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { costComparisonApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';
import {
  loadWorkOrderSelectOptions,
  loadOutsourceWorkOrderSelectOptions,
  loadPurchaseOrderSelectOptions,
  loadPurchaseOrderItemSelectOptions,
  normalizeCostListRows,
  type CostSelectOption,
} from '../costSelectData';

interface CostComparisonResult {
  material_id: number;
  material_code: string;
  material_name: string;
  source_type: string;
  quantity: number;
  standard_cost: {
    total_cost: number;
    unit_cost: number;
    cost_details: any;
    calculation_type: string;
  };
  actual_cost: {
    total_cost: number;
    unit_cost: number;
    cost_details: any;
    calculation_type: string;
  };
  cost_variance: {
    total_cost_variance: number;
    total_cost_variance_rate: number;
    unit_cost_variance: number;
    unit_cost_variance_rate: number;
    variance_type: string;
  };
  calculation_date: string;
}

const CostComparisonPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState<CostComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [costReferenceOptions, setCostReferenceOptions] = useState<{
    workOrders: CostSelectOption[];
    outsourceWorkOrders: CostSelectOption[];
    purchaseOrders: CostSelectOption[];
    purchaseOrderItems: CostSelectOption[];
  }>({ workOrders: [], outsourceWorkOrders: [], purchaseOrders: [], purchaseOrderItems: [] });

  /**
   * 加载物料列表
   */
  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(normalizeCostListRows(result));
      } catch (error: any) {
        console.error('加载物料列表失败:', error);
      }
    };
    loadMaterials();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [wo, owo, po, poi] = await Promise.all([
          loadWorkOrderSelectOptions(400),
          loadOutsourceWorkOrderSelectOptions(400),
          loadPurchaseOrderSelectOptions(200),
          loadPurchaseOrderItemSelectOptions(32),
        ]);
        if (!cancelled) {
          setCostReferenceOptions({
            workOrders: wo,
            outsourceWorkOrders: owo,
            purchaseOrders: po,
            purchaseOrderItems: poi,
          });
        }
      } catch (e) {
        console.error('加载工单/采购/委外下拉失败:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 处理对比
   */
  const handleCompare = async (values: any) => {
    try {
      setLoading(true);
      const data = {
        material_id: values.material_id,
        quantity: values.quantity,
        work_order_id: values.work_order_id,
        purchase_order_id: values.purchase_order_id,
        purchase_order_item_id: values.purchase_order_item_id,
        outsource_work_order_id: values.outsource_work_order_id,
        calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
      };
      const result = await costComparisonApi.compare(data);
      setResult(result);
      messageApi.success('成本对比成功');
    } catch (error: any) {
      messageApi.error(error.message || '成本对比失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 打开对比弹窗
   */
  const handleOpenModal = () => {
    setModalVisible(true);
    setResult(null);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      calculation_date: dayjs(),
      quantity: 1,
    });
  };

  /**
   * 获取物料来源类型标签
   */
  const getSourceTypeTag = (sourceType: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      Make: { color: 'blue', text: '自制件' },
      Buy: { color: 'green', text: '采购件' },
      Outsource: { color: 'orange', text: '委外件' },
      Phantom: { color: 'purple', text: '虚拟件' },
      Configure: { color: 'cyan', text: '配置件' },
    };
    const type = typeMap[sourceType] || { color: 'default', text: sourceType };
    return <Tag color={type.color}>{type.text}</Tag>;
  };

  /**
   * 获取差异类型标签
   */
  const getVarianceTypeTag = (varianceType: string) => {
    if (varianceType === '超支') {
      return <Tag color="red">超支</Tag>;
    } else if (varianceType === '节约') {
      return <Tag color="green">节约</Tag>;
    } else {
      return <Tag color="default">无差异</Tag>;
    }
  };

  return (
    <PageContainer
      title="成本对比"
      extra={[
        <Button
          key="compare"
          type="primary"
          icon={<BarChartOutlined />}
          onClick={handleOpenModal}
        >
          对比标准成本和实际成本
        </Button>,
      ]}
    >
      <ListPageTemplate>
        {!result ? (
          <Empty description="暂无对比结果，请点击「对比标准成本和实际成本」发起对比" />
        ) : (
          <>
            <DetailDrawerSection title="基本信息">
              <Descriptions column={3} size="small" bordered>
                <Descriptions.Item label="物料编号">
                  <Typography.Text copyable={{ text: String(result.material_code ?? '') }}>
                    {result.material_code ?? '-'}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="物料名称">{result.material_name ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="物料来源类型">{getSourceTypeTag(result.source_type)}</Descriptions.Item>
                <Descriptions.Item label="数量">{result.quantity}</Descriptions.Item>
                <Descriptions.Item label="核算日期">
                  {result.calculation_date ? dayjs(result.calculation_date).format('YYYY-MM-DD') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="差异类型">
                  {getVarianceTypeTag(result.cost_variance.variance_type)}
                </Descriptions.Item>
              </Descriptions>
            </DetailDrawerSection>

            <DetailDrawerSection title="生命周期">
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                本页为分析型对比结果，无单据生命周期；差异类型已在基本信息中展示。
              </Typography.Paragraph>
            </DetailDrawerSection>

            <DetailDrawerSection title="明细信息">
              <Typography.Text strong>标准成本与实际成本</Typography.Text>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col xs={24} md={12}>
                  <Typography.Text type="secondary">标准成本</Typography.Text>
                  <Divider style={{ margin: '8px 0' }} />
                  <Statistic
                    title="总成本"
                    value={result.standard_cost.total_cost}
                    prefix="¥"
                    precision={2}
                  />
                  <Statistic
                    style={{ marginTop: 12 }}
                    title="单位成本"
                    value={result.standard_cost.unit_cost}
                    prefix="¥"
                    precision={2}
                  />
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                    核算类型：{result.standard_cost.calculation_type}
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <Typography.Text type="secondary">实际成本</Typography.Text>
                  <Divider style={{ margin: '8px 0' }} />
                  <Statistic
                    title="总成本"
                    value={result.actual_cost.total_cost}
                    prefix="¥"
                    precision={2}
                  />
                  <Statistic
                    style={{ marginTop: 12 }}
                    title="单位成本"
                    value={result.actual_cost.unit_cost}
                    prefix="¥"
                    precision={2}
                  />
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                    核算类型：{result.actual_cost.calculation_type}
                  </div>
                </Col>
              </Row>
              <Divider style={{ margin: '16px 0' }} />
              <Alert
                message={result.cost_variance.variance_type}
                description={
                  <div>
                    <p>总成本差异：¥{result.cost_variance.total_cost_variance.toFixed(2)}</p>
                    <p>总成本差异率：{result.cost_variance.total_cost_variance_rate.toFixed(2)}%</p>
                    <p>单位成本差异：¥{result.cost_variance.unit_cost_variance.toFixed(2)}</p>
                    <p>单位成本差异率：{result.cost_variance.unit_cost_variance_rate.toFixed(2)}%</p>
                  </div>
                }
                type={
                  result.cost_variance.variance_type === '超支'
                    ? 'error'
                    : result.cost_variance.variance_type === '节约'
                      ? 'success'
                      : 'info'
                }
                showIcon
              />
              <Divider style={{ margin: '16px 0' }} />
              <Typography.Text strong>结构化明细（JSON）</Typography.Text>
              <div style={{ overflowX: 'auto', overflowY: 'hidden', marginTop: 8 }}>
                <Row gutter={16}>
                  <Col xs={24} lg={12}>
                    <Typography.Text type="secondary">标准成本明细</Typography.Text>
                    <pre
                      style={{
                        marginTop: 8,
                        marginBottom: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: 320,
                        overflow: 'auto',
                      }}
                    >
                      {JSON.stringify(result.standard_cost.cost_details, null, 2)}
                    </pre>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Typography.Text type="secondary">实际成本明细</Typography.Text>
                    <pre
                      style={{
                        marginTop: 8,
                        marginBottom: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: 320,
                        overflow: 'auto',
                      }}
                    >
                      {JSON.stringify(result.actual_cost.cost_details, null, 2)}
                    </pre>
                  </Col>
                </Row>
              </div>
            </DetailDrawerSection>

            <DetailDrawerSection title="操作记录">
              <Timeline
                items={[
                  {
                    color: 'blue',
                    children: (
                      <>
                        对比完成 ·{' '}
                        {result.calculation_date
                          ? dayjs(result.calculation_date).format('YYYY-MM-DD')
                          : dayjs().format('YYYY-MM-DD HH:mm:ss')}
                      </>
                    ),
                  },
                ]}
              />
            </DetailDrawerSection>
          </>
        )}
      </ListPageTemplate>

      {/* 对比弹窗 */}
      <FormModalTemplate
        title="对比标准成本和实际成本"
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setResult(null);
        }}
        formRef={formRef}
        onFinish={handleCompare}
        loading={loading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormSelect
          name="material_id"
          label="物料"
          placeholder="请选择物料"
          rules={[{ required: true, message: '请选择物料' }]}
          options={materials.map(m => ({
            label: `${m.mainCode || m.code} - ${m.name} (${m.sourceType || m.source_type || 'Make'})`,
            value: m.id,
          }))}
          fieldProps={{
            showSearch: true,
            filterOption: (input: string, option: any) =>
              option?.label?.toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormDigit
          name="quantity"
          label="数量"
          placeholder="请输入数量（用于计算标准成本）"
          rules={[{ required: true, message: '请输入数量' }, { type: 'number', min: 0.0001, message: '数量必须大于0' }]}
          fieldProps={{
            precision: 4,
            style: { width: '100%' },
          }}
        />
        <ProFormSelect
          name="work_order_id"
          label="工单（自制件/配置件实际成本）"
          placeholder="可选"
          allowClear
          options={costReferenceOptions.workOrders}
          showSearch
          fieldProps={{
            optionFilterProp: 'label',
            filterOption: (input: string, option: any) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormSelect
          name="purchase_order_id"
          label="采购订单（采购件实际成本-整单）"
          placeholder="可选"
          allowClear
          options={costReferenceOptions.purchaseOrders}
          showSearch
          fieldProps={{
            optionFilterProp: 'label',
            filterOption: (input: string, option: any) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormSelect
          name="purchase_order_item_id"
          label="采购订单明细（采购件实际成本-明细）"
          placeholder="可选"
          allowClear
          options={costReferenceOptions.purchaseOrderItems}
          showSearch
          fieldProps={{
            optionFilterProp: 'label',
            filterOption: (input: string, option: any) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormSelect
          name="outsource_work_order_id"
          label="委外工单（委外件实际成本）"
          placeholder="可选"
          allowClear
          options={costReferenceOptions.outsourceWorkOrders}
          showSearch
          fieldProps={{
            optionFilterProp: 'label',
            filterOption: (input: string, option: any) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormDatePicker
          name="calculation_date"
          label="核算日期"
          placeholder="请选择核算日期"
          fieldProps={{
            style: { width: '100%' },
          }}
        />
      </FormModalTemplate>
    </PageContainer>
  );
};

export default CostComparisonPage;

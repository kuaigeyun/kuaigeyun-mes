/**
 * 成本对比页面
 *
 * 提供标准成本和实际成本对比功能，基于物料来源类型进行成本对比分析。
 *
 * @author Luigi Lu
 * @date 2026-01-16
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProFormSelect, ProFormDigit, ProFormDatePicker, PageContainer, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Card, Tag, message, Modal, Divider, Row, Col, Statistic, Alert } from 'antd';
import { CalculatorOutlined, BarChartOutlined } from '@ant-design/icons';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import { costComparisonApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';

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

  /**
   * 加载物料列表
   */
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
  const getVarianceTypeTag = (varianceType: string, variance: number) => {
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
      {/* 对比结果展示 */}
      {result && (
        <Card title="对比结果" style={{ marginBottom: 16 }}>
          <ProDescriptions
            bordered
            column={2}
            style={{ marginBottom: 24 }}
            dataSource={{
              material_code: result.material_code,
              material_name: result.material_name,
              source_type: getSourceTypeTag(result.source_type),
              quantity: result.quantity,
            }}
            columns={[
              { title: '物料编码', dataIndex: 'material_code' },
              { title: '物料名称', dataIndex: 'material_name' },
              { title: '物料来源类型', dataIndex: 'source_type' },
              { title: '数量', dataIndex: 'quantity' },
            ]}
          />

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card title="标准成本" size="small">
                <Statistic
                  title="总成本"
                  value={result.standard_cost.total_cost}
                  prefix="¥"
                  precision={2}
                />
                <Divider style={{ margin: '12px 0' }} />
                <Statistic
                  title="单位成本"
                  value={result.standard_cost.unit_cost}
                  prefix="¥"
                  precision={2}
                />
                <div style={{ marginTop: 12, fontSize: '12px', color: '#666' }}>
                  核算类型：{result.standard_cost.calculation_type}
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="实际成本" size="small">
                <Statistic
                  title="总成本"
                  value={result.actual_cost.total_cost}
                  prefix="¥"
                  precision={2}
                />
                <Divider style={{ margin: '12px 0' }} />
                <Statistic
                  title="单位成本"
                  value={result.actual_cost.unit_cost}
                  prefix="¥"
                  precision={2}
                />
                <div style={{ marginTop: 12, fontSize: '12px', color: '#666' }}>
                  核算类型：{result.actual_cost.calculation_type}
                </div>
              </Card>
            </Col>
          </Row>

          <Card title="成本差异" style={{ marginBottom: 16 }}>
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
              type={result.cost_variance.variance_type === '超支' ? 'error' : result.cost_variance.variance_type === '节约' ? 'success' : 'info'}
              showIcon
            />
          </Card>

          <Divider>成本明细</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Card title="标准成本明细" size="small">
                <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', maxHeight: '300px', overflow: 'auto', fontSize: '12px' }}>
                  {JSON.stringify(result.standard_cost.cost_details, null, 2)}
                </pre>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="实际成本明细" size="small">
                <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', maxHeight: '300px', overflow: 'auto', fontSize: '12px' }}>
                  {JSON.stringify(result.actual_cost.cost_details, null, 2)}
                </pre>
              </Card>
            </Col>
          </Row>
        </Card>
      )}

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
        width={700}
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
        <ProFormDigit
          name="work_order_id"
          label="工单ID（自制件/配置件实际成本）"
          placeholder="请输入工单ID（可选，用于计算实际成本）"
          fieldProps={{
            style: { width: '100%' },
          }}
        />
        <ProFormDigit
          name="purchase_order_id"
          label="采购订单ID（采购件实际成本-整单）"
          placeholder="请输入采购订单ID（可选）"
          fieldProps={{
            style: { width: '100%' },
          }}
        />
        <ProFormDigit
          name="purchase_order_item_id"
          label="采购订单明细ID（采购件实际成本-明细）"
          placeholder="请输入采购订单明细ID（可选）"
          fieldProps={{
            style: { width: '100%' },
          }}
        />
        <ProFormDigit
          name="outsource_work_order_id"
          label="委外工单ID（委外件实际成本）"
          placeholder="请输入委外工单ID（可选）"
          fieldProps={{
            style: { width: '100%' },
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

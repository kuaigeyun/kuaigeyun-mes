/**
 * 生产成本核算页面
 *
 * 提供基于物料来源类型的生产成本核算功能，支持自制件、虚拟件、配置件的成本核算。
 *
 * @author Luigi Lu
 * @date 2026-01-16
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormDigit, ProFormDatePicker, ProFormTextArea, PageContainer } from '@ant-design/pro-components';
import { App, Button, Card, Descriptions, Tag, Space, message, Modal, Divider } from 'antd';
import { CalculatorOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import { productionCostApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';

interface ProductionCostResult {
  material_id: number;
  material_code: string;
  material_name: string;
  source_type: string;
  quantity: number;
  material_cost: number;
  labor_cost: number;
  manufacturing_cost: number;
  total_cost: number;
  unit_cost: number;
  cost_details: any;
  calculation_type: string;
  calculation_date: string;
}

const ProductionCostPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState<ProductionCostResult | null>(null);
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
   * 处理核算
   */
  const handleCalculate = async (values: any) => {
    try {
      setLoading(true);
      const data = {
        material_id: values.material_id,
        quantity: values.quantity,
        calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
        variant_attributes: values.variant_attributes ? JSON.parse(values.variant_attributes) : undefined,
      };
      const result = await productionCostApi.calculate(data);
      setResult(result);
      messageApi.success('生产成本核算成功');
    } catch (error: any) {
      messageApi.error(error.message || '生产成本核算失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 打开核算弹窗
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

  return (
    <PageContainer
      title="生产成本核算"
      extra={[
        <Button
          key="calculate"
          type="primary"
          icon={<CalculatorOutlined />}
          onClick={handleOpenModal}
        >
          核算生产成本
        </Button>,
      ]}
    >
      {/* 核算结果展示 */}
      {result && (
        <Card title="核算结果" style={{ marginBottom: 16 }}>
          <Descriptions bordered column={2}>
            <Descriptions.Item label="物料编码">{result.material_code}</Descriptions.Item>
            <Descriptions.Item label="物料名称">{result.material_name}</Descriptions.Item>
            <Descriptions.Item label="物料来源类型">
              {getSourceTypeTag(result.source_type)}
            </Descriptions.Item>
            <Descriptions.Item label="数量">{result.quantity}</Descriptions.Item>
            <Descriptions.Item label="材料成本">¥{result.material_cost?.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="加工成本">¥{result.labor_cost?.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="制造费用">¥{result.manufacturing_cost?.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="总成本">
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}>
                ¥{result.total_cost?.toFixed(2)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="单位成本">¥{result.unit_cost?.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="核算类型">{result.calculation_type}</Descriptions.Item>
            <Descriptions.Item label="核算日期">
              {result.calculation_date ? dayjs(result.calculation_date).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
          </Descriptions>

          {result.cost_details && (
            <>
              <Divider>成本明细</Divider>
              <pre style={{ background: '#f5f5f5', padding: '16px', borderRadius: '4px', maxHeight: '400px', overflow: 'auto' }}>
                {JSON.stringify(result.cost_details, null, 2)}
              </pre>
            </>
          )}
        </Card>
      )}

      {/* 核算弹窗 */}
      <FormModalTemplate
        title="核算生产成本"
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setResult(null);
        }}
        formRef={formRef}
        onFinish={handleCalculate}
        loading={loading}
        width={600}
      >
        <ProFormSelect
          name="material_id"
          label="物料"
          placeholder="请选择物料"
          rules={[{ required: true, message: '请选择物料' }]}
          options={materials
            .filter(m => ['Make', 'Phantom', 'Configure'].includes(m.sourceType || m.source_type))
            .map(m => ({
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
          placeholder="请输入数量"
          rules={[{ required: true, message: '请输入数量' }, { type: 'number', min: 0.0001, message: '数量必须大于0' }]}
          fieldProps={{
            precision: 4,
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
        <ProFormTextArea
          name="variant_attributes"
          label="变体属性（配置件需要）"
          placeholder='请输入变体属性JSON，例如：{"颜色":"红色","尺寸":"大"}'
          fieldProps={{
            rows: 3,
          }}
        />
      </FormModalTemplate>
    </PageContainer>
  );
};

export default ProductionCostPage;

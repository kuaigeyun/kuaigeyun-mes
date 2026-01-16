/**
 * 委外成本核算页面
 *
 * 提供基于物料来源类型的委外成本核算功能。
 *
 * @author Luigi Lu
 * @date 2026-01-16
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProFormSelect, ProFormDigit, ProFormDatePicker, PageContainer } from '@ant-design/pro-components';
import { App, Button, Card, Descriptions, Tag, message, Modal, Divider } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import { outsourceCostApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';

interface OutsourceCostResult {
  material_id?: number;
  material_code?: string;
  material_name?: string;
  outsource_work_order_id?: number;
  outsource_work_order_code?: string;
  source_type: string;
  quantity: number;
  material_cost: number;
  processing_cost: number;
  total_cost: number;
  unit_cost: number;
  cost_details: any;
  calculation_type: string;
  calculation_date: string;
  supplier_id?: number;
  supplier_code?: string;
  supplier_name?: string;
}

const OutsourceCostPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState<OutsourceCostResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [calculationMode, setCalculationMode] = useState<'standard' | 'actual'>('standard');

  /**
   * 加载物料列表
   */
  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(result.filter(m => (m.sourceType || m.source_type) === 'Outsource'));
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
      const data: any = {
        calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
      };

      if (calculationMode === 'standard') {
        data.material_id = values.material_id;
        data.quantity = values.quantity;
      } else {
        data.outsource_work_order_id = values.outsource_work_order_id;
      }

      const result = await outsourceCostApi.calculate(data);
      setResult(result);
      messageApi.success('委外成本核算成功');
    } catch (error: any) {
      messageApi.error(error.message || '委外成本核算失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 打开核算弹窗
   */
  const handleOpenModal = (mode: 'standard' | 'actual') => {
    setCalculationMode(mode);
    setModalVisible(true);
    setResult(null);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      calculation_date: dayjs(),
      quantity: 1,
    });
  };

  return (
    <PageContainer
      title="委外成本核算"
      extra={[
        <Button
          key="calculate-standard"
          type="primary"
          icon={<CalculatorOutlined />}
          onClick={() => handleOpenModal('standard')}
        >
          核算标准委外成本
        </Button>,
        <Button
          key="calculate-actual"
          icon={<CalculatorOutlined />}
          onClick={() => handleOpenModal('actual')}
        >
          核算实际委外成本
        </Button>,
      ]}
    >
      {/* 核算结果展示 */}
      {result && (
        <Card title="核算结果" style={{ marginBottom: 16 }}>
          <Descriptions bordered column={2}>
            {result.material_code && (
              <>
                <Descriptions.Item label="物料编码">{result.material_code}</Descriptions.Item>
                <Descriptions.Item label="物料名称">{result.material_name}</Descriptions.Item>
              </>
            )}
            {result.outsource_work_order_code && (
              <>
                <Descriptions.Item label="委外工单编码">{result.outsource_work_order_code}</Descriptions.Item>
                {result.supplier_name && (
                  <Descriptions.Item label="供应商">{result.supplier_name}</Descriptions.Item>
                )}
              </>
            )}
            <Descriptions.Item label="物料来源类型">
              <Tag color="orange">委外件</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="数量">{result.quantity}</Descriptions.Item>
            <Descriptions.Item label="材料成本">¥{result.material_cost?.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="委外加工费用">¥{result.processing_cost?.toFixed(2)}</Descriptions.Item>
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
        title={calculationMode === 'standard' ? '核算标准委外成本' : '核算实际委外成本'}
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
        {calculationMode === 'standard' ? (
          <>
            <ProFormSelect
              name="material_id"
              label="物料"
              placeholder="请选择委外件物料"
              rules={[{ required: true, message: '请选择物料' }]}
              options={materials.map(m => ({
                label: `${m.mainCode || m.code} - ${m.name}`,
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
          </>
        ) : (
          <ProFormDigit
            name="outsource_work_order_id"
            label="委外工单ID"
            placeholder="请输入委外工单ID"
            rules={[{ required: true, message: '请输入委外工单ID' }]}
            fieldProps={{
              style: { width: '100%' },
            }}
          />
        )}
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

export default OutsourceCostPage;

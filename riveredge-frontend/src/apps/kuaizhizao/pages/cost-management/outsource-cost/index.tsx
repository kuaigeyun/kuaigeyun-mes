/**
 * 委外成本核算页面
 *
 * 提供基于物料来源类型的委外成本核算功能。
 *
 * @author Luigi Lu
 * @date 2026-01-16
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProFormSelect, ProFormDigit, ProFormDatePicker, PageContainer, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Card, Tag, message, Modal, Divider } from 'antd';
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
          <ProDescriptions
            bordered
            column={2}
            dataSource={{
              material_code: result.material_code,
              material_name: result.material_name,
              outsource_work_order_code: result.outsource_work_order_code,
              supplier_name: result.supplier_name,
              source_type: <Tag color="orange">委外件</Tag>,
              quantity: result.quantity,
              material_cost: `¥${result.material_cost?.toFixed(2)}`,
              processing_cost: `¥${result.processing_cost?.toFixed(2)}`,
              total_cost: (
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}>
                  ¥{result.total_cost?.toFixed(2)}
                </span>
              ),
              unit_cost: `¥${result.unit_cost?.toFixed(2)}`,
              calculation_type: result.calculation_type,
              calculation_date: result.calculation_date ? dayjs(result.calculation_date).format('YYYY-MM-DD') : '-',
            }}
            columns={[
              { title: '物料编码', dataIndex: 'material_code', hide: !result.material_code },
              { title: '物料名称', dataIndex: 'material_name', hide: !result.material_name },
              { title: '委外工单编码', dataIndex: 'outsource_work_order_code', hide: !result.outsource_work_order_code },
              { title: '供应商', dataIndex: 'supplier_name', hide: !result.supplier_name },
              { title: '物料来源类型', dataIndex: 'source_type' },
              { title: '数量', dataIndex: 'quantity' },
              { title: '材料成本', dataIndex: 'material_cost' },
              { title: '委外加工费用', dataIndex: 'processing_cost' },
              { title: '总成本', dataIndex: 'total_cost' },
              { title: '单位成本', dataIndex: 'unit_cost' },
              { title: '核算类型', dataIndex: 'calculation_type' },
              { title: '核算日期', dataIndex: 'calculation_date' },
            ]}
          />

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

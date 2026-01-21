/**
 * 采购件成本核算页面
 *
 * 提供基于物料来源类型的采购成本核算功能。
 *
 * @author Luigi Lu
 * @date 2026-01-16
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProFormSelect, ProFormDigit, ProFormDatePicker, PageContainer, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Card, Tag, message, Modal, Divider } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import { purchaseCostApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';

interface PurchaseCostResult {
  material_id: number;
  material_code: string;
  material_name: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  purchase_order_item_id?: number;
  source_type: string;
  quantity: number;
  purchase_price: number;
  purchase_fee: number;
  total_cost: number;
  unit_cost: number;
  cost_details: any;
  calculation_type: string;
  calculation_date: string;
  supplier_id?: number;
  supplier_name?: string;
}

const PurchaseCostPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState<PurchaseCostResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [calculationMode, setCalculationMode] = useState<'standard' | 'actual-item' | 'actual-order'>('standard');

  /**
   * 加载物料列表
   */
  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(result.filter(m => (m.sourceType || m.source_type) === 'Buy'));
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
      } else if (calculationMode === 'actual-item') {
        data.purchase_order_item_id = values.purchase_order_item_id;
      } else {
        data.purchase_order_id = values.purchase_order_id;
      }

      const result = await purchaseCostApi.calculate(data);
      setResult(result);
      messageApi.success('采购成本核算成功');
    } catch (error: any) {
      messageApi.error(error.message || '采购成本核算失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 打开核算弹窗
   */
  const handleOpenModal = (mode: 'standard' | 'actual-item' | 'actual-order') => {
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
      title="采购件成本核算"
      extra={[
        <Button
          key="calculate-standard"
          type="primary"
          icon={<CalculatorOutlined />}
          onClick={() => handleOpenModal('standard')}
        >
          核算标准采购成本
        </Button>,
        <Button
          key="calculate-actual-item"
          icon={<CalculatorOutlined />}
          onClick={() => handleOpenModal('actual-item')}
        >
          核算实际成本（明细）
        </Button>,
        <Button
          key="calculate-actual-order"
          icon={<CalculatorOutlined />}
          onClick={() => handleOpenModal('actual-order')}
        >
          核算实际成本（整单）
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
              purchase_order_code: result.purchase_order_code,
              supplier_name: result.supplier_name,
              source_type: <Tag color="green">采购件</Tag>,
              quantity: result.quantity,
              purchase_price: `¥${result.purchase_price?.toFixed(2)}`,
              purchase_fee: `¥${result.purchase_fee?.toFixed(2)}`,
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
              { title: '物料编码', dataIndex: 'material_code' },
              { title: '物料名称', dataIndex: 'material_name' },
              { title: '采购订单编码', dataIndex: 'purchase_order_code', hide: !result.purchase_order_code },
              { title: '供应商', dataIndex: 'supplier_name', hide: !result.supplier_name },
              { title: '物料来源类型', dataIndex: 'source_type' },
              { title: '数量', dataIndex: 'quantity' },
              { title: '采购价格', dataIndex: 'purchase_price' },
              { title: '采购费用', dataIndex: 'purchase_fee' },
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
        title={
          calculationMode === 'standard'
            ? '核算标准采购成本'
            : calculationMode === 'actual-item'
            ? '核算实际采购成本（明细）'
            : '核算实际采购成本（整单）'
        }
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
              placeholder="请选择采购件物料"
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
        ) : calculationMode === 'actual-item' ? (
          <ProFormDigit
            name="purchase_order_item_id"
            label="采购订单明细ID"
            placeholder="请输入采购订单明细ID"
            rules={[{ required: true, message: '请输入采购订单明细ID' }]}
            fieldProps={{
              style: { width: '100%' },
            }}
          />
        ) : (
          <ProFormDigit
            name="purchase_order_id"
            label="采购订单ID"
            placeholder="请输入采购订单ID"
            rules={[{ required: true, message: '请输入采购订单ID' }]}
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

export default PurchaseCostPage;

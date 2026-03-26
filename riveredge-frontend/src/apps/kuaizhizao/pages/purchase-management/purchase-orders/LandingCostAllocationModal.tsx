import React, { useState } from 'react';
import { Modal, Form, Input, Button, Space, Select, InputNumber, Divider, message } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { allocatePurchaseCosts } from '../../../services/purchase';

interface LandingCostAllocationModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  orderId: number;
  orderCode: string;
}

/**
 * 采购杂费分摊弹窗 (V2 增强)
 * 支持多项杂费录入，并支持按金额、数量、重量、体积等维度进行自动分摊。
 */
const LandingCostAllocationModal: React.FC<LandingCostAllocationModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  orderId,
  orderCode,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await allocatePurchaseCosts(orderId, {
        fee_items: values.fee_items,
        method: values.method,
      });
      message.success('费用分摊成功，已更新明细落地成本');
      onSuccess();
    } catch (error) {
      console.error('Allocation failed:', error);
      message.error('费用分摊失败，请检查网络或后端日志');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`采购杂费分摊 - ${orderCode}`}
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={600}
      okText="确认分摊"
      cancelText="取消"
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          method: 'by_value',
          fee_items: [{ name: '运费', amount: 0 }],
        }}
      >
        <Form.Item
          name="method"
          label="分摊算法/维度"
          tooltip="系统将根据所选维度，按比例将总杂费分配到各明细行"
          rules={[{ required: true }]}
        >
          <Select>
            <Select.Option value="by_value">按金额比例 (Value Weighted)</Select.Option>
            <Select.Option value="by_quantity">按数量比例 (Quantity Weighted)</Select.Option>
            <Select.Option value="by_weight">按重量比例 (Weight Weighted - 需维护物料重量)</Select.Option>
            <Select.Option value="by_volume">按体积比例 (Volume Weighted - 需维护物料体积)</Select.Option>
          </Select>
        </Form.Item>

        <Divider>待分摊费用清单</Divider>
        
        <Form.List name="fee_items">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                  <Form.Item
                    {...restField}
                    name={[name, 'name']}
                    rules={[{ required: true, message: '请输入费用名称' }]}
                  >
                    <Input placeholder="费用名称 (如: 报关费, 包装费)" style={{ width: 320 }} />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'amount']}
                    rules={[{ required: true, message: '请输入金额' }]}
                  >
                    <InputNumber
                      placeholder="金额"
                      min={0}
                      precision={2}
                      style={{ width: 140 }}
                      addonAfter="￥"
                    />
                  </Form.Item>
                  {fields.length > 1 && (
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                  )}
                </Space>
              ))}
              <Form.Item>
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  继续添加费用项
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          backgroundColor: '#f5f5f5', 
          borderRadius: 4,
          fontSize: '12px',
          color: '#8c8c8c',
          lineHeight: '1.6'
        }}>
          <strong>说明：</strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>分摊后的杂费将记录在明细行的 landing_cost 字段中。</li>
            <li>系统会自动重新计算该订单的实际综合成本 (Actual Total Cost)。</li>
            <li>如果选择重量/体积分摊但物料资料未维护相关数据，将自动降级为按行等额分摊。</li>
          </ul>
        </div>
      </Form>
    </Modal>
  );
};

export default LandingCostAllocationModal;

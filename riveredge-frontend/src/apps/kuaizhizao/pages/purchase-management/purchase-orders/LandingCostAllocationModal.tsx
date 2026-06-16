import React, { useState } from 'react';
import { Modal, Form, Input, Button, Space, Select, InputNumber, Divider, message } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await allocatePurchaseCosts(orderId, {
        fee_items: values.fee_items,
        method: values.method,
      });
      message.success(t('app.kuaizhizao.purchaseOrder.landingCost.success'));
      onSuccess();
    } catch (error) {
      console.error('Allocation failed:', error);
      message.error(t('app.kuaizhizao.purchaseOrder.landingCost.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('app.kuaizhizao.purchaseOrder.landingCost.title', { code: orderCode })}
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={600}
      okText={t('app.kuaizhizao.purchaseOrder.landingCost.confirm')}
      cancelText={t('common.cancel')}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          method: 'by_value',
          fee_items: [{ name: t('app.kuaizhizao.purchaseOrder.landingCost.defaultFeeName'), amount: 0 }],
        }}
      >
        <Form.Item
          name="method"
          label={t('app.kuaizhizao.purchaseOrder.landingCost.method')}
          tooltip={t('app.kuaizhizao.purchaseOrder.landingCost.methodTooltip')}
          rules={[{ required: true }]}
        >
          <Select>
            <Select.Option value="by_value">{t('app.kuaizhizao.purchaseOrder.landingCost.methodByValue')}</Select.Option>
            <Select.Option value="by_quantity">{t('app.kuaizhizao.purchaseOrder.landingCost.methodByQuantity')}</Select.Option>
            <Select.Option value="by_weight">{t('app.kuaizhizao.purchaseOrder.landingCost.methodByWeight')}</Select.Option>
            <Select.Option value="by_volume">{t('app.kuaizhizao.purchaseOrder.landingCost.methodByVolume')}</Select.Option>
          </Select>
        </Form.Item>

        <Divider>{t('app.kuaizhizao.purchaseOrder.landingCost.feeListDivider')}</Divider>

        <Form.List name="fee_items">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                  <Form.Item
                    {...restField}
                    name={[name, 'name']}
                    rules={[{ required: true, message: t('app.kuaizhizao.purchaseOrder.landingCost.feeNameRequired') }]}
                  >
                    <Input placeholder={t('app.kuaizhizao.purchaseOrder.landingCost.feeNamePlaceholder')} style={{ width: 320 }} />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'amount']}
                    rules={[{ required: true, message: t('app.kuaizhizao.purchaseOrder.landingCost.feeAmountRequired') }]}
                  >
                    <InputNumber
                      placeholder={t('app.kuaizhizao.purchaseOrder.landingCost.feeAmount')}
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
                  {t('app.kuaizhizao.purchaseOrder.landingCost.addFee')}
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: '#f5f5f5',
            borderRadius: 4,
            fontSize: '12px',
            color: '#8c8c8c',
            lineHeight: '1.6',
          }}
        >
          <strong>{t('app.kuaizhizao.purchaseOrder.landingCost.notesTitle')}</strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>{t('app.kuaizhizao.purchaseOrder.landingCost.note1')}</li>
            <li>{t('app.kuaizhizao.purchaseOrder.landingCost.note2')}</li>
            <li>{t('app.kuaizhizao.purchaseOrder.landingCost.note3')}</li>
          </ul>
        </div>
      </Form>
    </Modal>
  );
};

export default LandingCostAllocationModal;

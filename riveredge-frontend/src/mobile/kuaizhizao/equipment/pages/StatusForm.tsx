import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Button, Card, Form, Select, Space, Spin, Switch, Typography } from 'antd';
import { MobileEquipmentLayout } from '../MobileEquipmentLayout';
import { buildMobileEquipmentHubPath } from '../paths';
import { equipmentApi } from '../../../../apps/kuaizhizao/services/equipment';
import { touchButtonProps } from '../../../../components/touch-terminal';

const STATUS_OPTIONS = ['正常', '维修中', '停用', '报废'];

const MobileEquipmentStatusPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadEquipment = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const detail = await equipmentApi.get(uuid);
      form.setFieldsValue({
        status: detail.status ?? '正常',
        is_active: detail.is_active ?? true,
      });
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('app.kuaizhizao.equipment.getDetailFailed'));
    } finally {
      setLoading(false);
    }
  }, [uuid, form, messageApi, t]);

  useEffect(() => {
    void loadEquipment();
  }, [loadEquipment]);

  const handleSubmit = async () => {
    if (!uuid) return;
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await equipmentApi.update(uuid, {
        status: values.status,
        is_active: values.is_active,
      });
      messageApi.success(t('app.kuaizhizao.mobileEquipment.statusUpdateSuccess'));
      navigate(buildMobileEquipmentHubPath(uuid));
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('common.operationFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MobileEquipmentLayout title={t('app.kuaizhizao.mobileEquipment.statusTitle')}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small">
            <Typography.Paragraph type="secondary">
              {t('app.kuaizhizao.mobileEquipment.statusHint')}
            </Typography.Paragraph>
            <Form form={form} layout="vertical">
              <Form.Item
                name="status"
                label={t('app.kuaizhizao.equipment.fieldStatus')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Select
                  options={STATUS_OPTIONS.map((value) => ({ value, label: value }))}
                />
              </Form.Item>
              <Form.Item
                name="is_active"
                label={t('app.kuaizhizao.equipment.fieldIsActive')}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Form>
          </Card>
          <Button
            {...touchButtonProps}
            type="primary"
            block
            size="large"
            loading={submitting}
            onClick={() => void handleSubmit()}
          >
            {t('common.save')}
          </Button>
        </Space>
      )}
    </MobileEquipmentLayout>
  );
};

export default MobileEquipmentStatusPage;

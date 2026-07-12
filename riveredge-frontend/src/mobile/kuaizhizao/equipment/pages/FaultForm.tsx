import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Button, Card, DatePicker, Form, Input, Select, Space, Spin } from 'antd';
import dayjs from 'dayjs';
import { MobileEquipmentLayout } from '../MobileEquipmentLayout';
import { buildMobileEquipmentHubPath } from '../paths';
import { equipmentApi, equipmentFaultApi } from '../../../../apps/kuaizhizao/services/equipment';
import { touchButtonProps } from '../../../../components/touch-terminal';
import { useGlobalStore } from '../../../../stores/globalStore';

const FAULT_TYPES = ['机械故障', '电气故障', '软件故障', '其他'];
const FAULT_LEVELS = ['轻微', '一般', '严重', '紧急'];

const MobileEquipmentFaultPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const userInfo = useGlobalStore((s) => s.currentUser);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [equipmentName, setEquipmentName] = useState('');

  const loadEquipment = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const detail = await equipmentApi.get(uuid);
      setEquipmentName(detail.name ?? detail.code ?? '');
      form.setFieldsValue({
        fault_date: dayjs(),
        fault_type: '机械故障',
        fault_level: '一般',
        reporter_name: userInfo?.full_name || userInfo?.username,
      });
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('app.kuaizhizao.equipment.getDetailFailed'));
    } finally {
      setLoading(false);
    }
  }, [uuid, form, userInfo, messageApi, t]);

  useEffect(() => {
    void loadEquipment();
  }, [loadEquipment]);

  const handleSubmit = async () => {
    if (!uuid) return;
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await equipmentFaultApi.create({
        equipment_uuid: uuid,
        fault_date: dayjs(values.fault_date).toISOString(),
        fault_type: values.fault_type,
        fault_level: values.fault_level,
        fault_description: values.fault_description,
        reporter_name: values.reporter_name,
        status: '待处理',
        repair_required: true,
        remark: values.remark,
        source_type: 'mobile_h5',
      });
      messageApi.success(t('app.kuaizhizao.mobileEquipment.faultReportSuccess'));
      navigate(buildMobileEquipmentHubPath(uuid));
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('common.operationFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MobileEquipmentLayout title={t('app.kuaizhizao.mobileEquipment.faultTitle')}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small">
            <Form form={form} layout="vertical">
              <Form.Item label={t('app.kuaizhizao.equipment.colName')}>
                <Input value={equipmentName} disabled />
              </Form.Item>
              <Form.Item
                name="fault_date"
                label={t('app.kuaizhizao.equipmentFault.col.faultDate')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="fault_type"
                label={t('app.kuaizhizao.equipmentFault.col.faultType')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Select options={FAULT_TYPES.map((v) => ({ label: v, value: v }))} />
              </Form.Item>
              <Form.Item
                name="fault_level"
                label={t('app.kuaizhizao.equipmentFault.col.faultLevel')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Select options={FAULT_LEVELS.map((v) => ({ label: v, value: v }))} />
              </Form.Item>
              <Form.Item
                name="fault_description"
                label={t('app.kuaizhizao.equipmentFault.form.faultDescription')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Input.TextArea rows={4} placeholder={t('app.kuaizhizao.mobileEquipment.faultDescPlaceholder')} />
              </Form.Item>
              <Form.Item name="reporter_name" label={t('app.kuaizhizao.equipmentFault.form.reporter')}>
                <Input />
              </Form.Item>
              <Form.Item name="remark" label={t('common.remark')}>
                <Input.TextArea rows={2} />
              </Form.Item>
            </Form>
          </Card>
          <Button
            {...touchButtonProps}
            type="primary"
            block
            size="large"
            danger
            loading={submitting}
            onClick={() => void handleSubmit()}
          >
            {t('app.kuaizhizao.mobileEquipment.submitFault')}
          </Button>
        </Space>
      )}
    </MobileEquipmentLayout>
  );
};

export default MobileEquipmentFaultPage;

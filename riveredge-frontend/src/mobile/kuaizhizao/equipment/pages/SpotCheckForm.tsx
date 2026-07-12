import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { MobileEquipmentLayout } from '../MobileEquipmentLayout';
import { buildMobileEquipmentHubPath } from '../paths';
import { equipmentApi } from '../../../../apps/kuaizhizao/services/equipment';
import { inspectionSchemesApi, schemeBindingsApi, spotChecksApi } from '../../../../apps/kuaizhizao/services/equipmentOps';
import { touchButtonProps } from '../../../../components/touch-terminal';
import { useGlobalStore } from '../../../../stores/globalStore';

interface SpotCheckLine {
  line_no?: number;
  item_id?: number;
  item_code?: string;
  item_name?: string;
  requirement?: string;
  value_type?: string;
  unit?: string;
  measured_value?: string;
  is_pass?: boolean;
  remark?: string;
}

const MobileEquipmentSpotCheckPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const userInfo = useGlobalStore((s) => s.currentUser);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [equipmentId, setEquipmentId] = useState<number | null>(null);
  const [schemeOptions, setSchemeOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [previewLines, setPreviewLines] = useState<SpotCheckLine[]>([]);

  const handlePreview = useCallback(
    async (eqId?: number, schemeId?: number) => {
      const equipment_id = eqId ?? equipmentId;
      const scheme_id = schemeId ?? form.getFieldValue('scheme_id');
      if (!equipment_id || !scheme_id) {
        setPreviewLines([]);
        return;
      }
      try {
        const res = await spotChecksApi.previewLines({ equipment_id, scheme_id });
        setPreviewLines(res.lines ?? []);
      } catch (error: unknown) {
        messageApi.error((error as Error)?.message || t('app.kuaizhizao.equipmentOps.spotCheck.previewFailed'));
        setPreviewLines([]);
      }
    },
    [equipmentId, form, messageApi, t],
  );

  const loadEquipment = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const detail = await equipmentApi.get(uuid);
      if (detail.id == null) {
        throw new Error(t('app.kuaizhizao.equipment.uuidNotFound'));
      }
      setEquipmentId(detail.id);
      form.setFieldsValue({
        check_date: dayjs(),
        inspector_name: userInfo?.full_name || userInfo?.username,
      });

      const bindings = await schemeBindingsApi.list({ equipment_id: detail.id, scheme_type: 'spot_check' });
      const boundIds = new Set((bindings ?? []).map((b: { scheme_id: number }) => b.scheme_id));
      const schemesRes = await inspectionSchemesApi.list({ limit: 500, is_active: true });
      const options = (schemesRes.items ?? [])
        .filter((s: { id: number }) => boundIds.size === 0 || boundIds.has(s.id))
        .map((s: { id: number; code: string; name: string }) => ({
          label: `${s.code} - ${s.name}`,
          value: s.id,
        }));
      setSchemeOptions(options);
      if (options.length === 1) {
        form.setFieldsValue({ scheme_id: options[0].value });
        void handlePreview(detail.id, options[0].value);
      }
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('app.kuaizhizao.equipment.getDetailFailed'));
    } finally {
      setLoading(false);
    }
  }, [uuid, form, userInfo, messageApi, t, handlePreview]);

  useEffect(() => {
    void loadEquipment();
  }, [loadEquipment]);

  const updateLine = (index: number, patch: Partial<SpotCheckLine>) => {
    setPreviewLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const handleSubmit = async () => {
    if (!equipmentId) return;
    if (previewLines.length === 0) {
      messageApi.warning(t('app.kuaizhizao.equipmentOps.spotCheck.noPreviewLines'));
      return;
    }
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await spotChecksApi.create({
        equipment_id: equipmentId,
        scheme_id: values.scheme_id,
        check_date: dayjs(values.check_date).format('YYYY-MM-DD'),
        inspector_name: values.inspector_name,
        remark: values.remark,
        lines: previewLines.map((l) => ({
          line_no: l.line_no,
          item_id: l.item_id,
          item_code: l.item_code,
          item_name: l.item_name,
          requirement: l.requirement,
          value_type: l.value_type,
          unit: l.unit,
          measured_value: l.measured_value,
          is_pass: l.is_pass ?? true,
          remark: l.remark,
        })),
      });
      messageApi.success(t('app.kuaizhizao.mobileEquipment.spotCheckSuccess'));
      navigate(buildMobileEquipmentHubPath(uuid!));
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('common.operationFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MobileEquipmentLayout title={t('app.kuaizhizao.mobileEquipment.spotCheckTitle')}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small">
            <Form form={form} layout="vertical">
              <Form.Item
                name="scheme_id"
                label={t('app.kuaizhizao.equipmentOps.spotCheck.form.scheme')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Select
                  options={schemeOptions}
                  placeholder={t('common.select')}
                  onChange={(schemeId) => void handlePreview(undefined, schemeId)}
                />
              </Form.Item>
              <Form.Item
                name="check_date"
                label={t('app.kuaizhizao.equipment.traceColCheckDate')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="inspector_name" label={t('app.kuaizhizao.equipment.traceColInspector')}>
                <Input />
              </Form.Item>
              <Form.Item name="remark" label={t('common.remark')}>
                <Input.TextArea rows={2} />
              </Form.Item>
            </Form>
          </Card>

          {previewLines.length > 0 ? (
            <Card title={t('app.kuaizhizao.mobileEquipment.spotCheckItems')} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                {previewLines.map((line, index) => (
                  <Card key={`${line.item_id}-${index}`} size="small" type="inner">
                    <Typography.Text strong>
                      {line.line_no}. {line.item_name}
                    </Typography.Text>
                    {line.requirement ? (
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                        {line.requirement}
                      </Typography.Paragraph>
                    ) : null}
                    <Input
                      placeholder={t('app.kuaizhizao.mobileEquipment.measuredValue')}
                      value={line.measured_value}
                      onChange={(e) => updateLine(index, { measured_value: e.target.value })}
                      style={{ marginBottom: 8 }}
                    />
                    <Space>
                      <Typography.Text>{t('app.kuaizhizao.mobileEquipment.pass')}</Typography.Text>
                      <Switch
                        checked={line.is_pass ?? true}
                        onChange={(checked) => updateLine(index, { is_pass: checked })}
                      />
                    </Space>
                  </Card>
                ))}
              </Space>
            </Card>
          ) : (
            <Typography.Text type="secondary">
              {t('app.kuaizhizao.equipmentOps.spotCheck.noPreviewLines')}
            </Typography.Text>
          )}

          <Button
            {...touchButtonProps}
            type="primary"
            block
            size="large"
            loading={submitting}
            onClick={() => void handleSubmit()}
          >
            {t('common.submit')}
          </Button>
        </Space>
      )}
    </MobileEquipmentLayout>
  );
};

export default MobileEquipmentSpotCheckPage;

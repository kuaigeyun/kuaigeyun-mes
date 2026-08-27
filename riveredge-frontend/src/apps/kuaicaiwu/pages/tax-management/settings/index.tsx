/**
 * 税务设置
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ProForm,
  ProFormRadio,
  ProFormDigit,
  ProFormSwitch,
  ProFormSelect,
} from '@ant-design/pro-components';
import { App, Button, Card, Col, Row, Space, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { glService, type GlAccount } from '../../../services/gl';
import { taxService, type TaxSettings } from '../../../services/tax';

const NS = 'app.kuaicaiwu.tax.settings';

const BINDING_KEYS = [
  'output_vat',
  'input_vat',
  'input_transfer_out',
  'paid_vat',
  'transfer_unpaid_vat',
  'urban_construction',
  'education',
  'local_education',
  'tax_surcharge_expense',
] as const;

const percentFieldProps = {
  addonAfter: '%',
  style: { width: '100%', maxWidth: 160 },
};

const TaxSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { canUpdate } = useResourcePermissions('kuaicaiwu:tax');
  const [form] = ProForm.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [settings, setSettings] = useState<TaxSettings | null>(null);
  const [accounts, setAccounts] = useState<GlAccount[]>([]);

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.is_leaf)
        .map((a) => ({ label: `${a.account_code} ${a.account_name}`, value: a.id })),
    [accounts],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, accRes] = await Promise.all([taxService.getSettings(), glService.listAccounts({ is_active: true })]);
      setSettings(s);
      const list = Array.isArray(accRes) ? accRes : (accRes as { data?: GlAccount[] })?.data ?? [];
      setAccounts(list as GlAccount[]);
      form.setFieldsValue({
        taxpayer_type: s.taxpayer_type,
        urban_construction: s.surcharge_rates?.urban_construction ?? 7,
        education: s.surcharge_rates?.education ?? 3,
        local_education: s.surcharge_rates?.local_education ?? 2,
        account_bindings: s.account_bindings ?? {},
        tax_rates: s.tax_rates ?? [],
      });
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.loadFailed', { defaultValue: '加载失败' })));
    } finally {
      setLoading(false);
    }
  }, [form, messageApi, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const taxRates = (values.tax_rates as TaxSettings['tax_rates']) ?? settings?.tax_rates ?? [];
      const res = await taxService.updateSettings({
        taxpayer_type: values.taxpayer_type as TaxSettings['taxpayer_type'],
        tax_rates: taxRates,
        surcharge_rates: {
          urban_construction: Number(values.urban_construction ?? 7),
          education: Number(values.education ?? 3),
          local_education: Number(values.local_education ?? 2),
        },
        account_bindings: (values.account_bindings as Record<string, number>) ?? {},
      });
      setSettings(res);
      messageApi.success(t(`${NS}.saved`, { defaultValue: '税务设置已保存' }));
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.saveFailed', { defaultValue: '保存失败' })));
    } finally {
      setSaving(false);
    }
  };

  const onSupplementCoa = async () => {
    setSeeding(true);
    try {
      const res = await taxService.supplementCoa();
      messageApi.success(
        t(`${NS}.coaSeeded`, {
          defaultValue: '已补种税务明细科目',
          count: res.created_codes?.length ?? 0,
        }),
      );
      await load();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t(`${NS}.coaSeedFailed`, { defaultValue: '补种科目失败' })));
    } finally {
      setSeeding(false);
    }
  };

  const rateColumns = [
    { title: t(`${NS}.rate`, { defaultValue: '税率' }), dataIndex: 'label', width: 120 },
    {
      title: t('common.enabled', { defaultValue: '启用' }),
      dataIndex: 'is_active',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, row: { is_active: boolean }, index: number) => (
        <ProFormSwitch
          noStyle
          name={['tax_rates', index, 'is_active']}
          disabled={!canUpdate}
          fieldProps={{
            checked: row.is_active,
            onChange: (checked) => {
              const rates = [...(form.getFieldValue('tax_rates') || [])];
              rates[index] = { ...rates[index], is_active: checked };
              form.setFieldValue('tax_rates', rates);
            },
          }}
        />
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <ProForm
        form={form}
        layout="vertical"
        submitter={
          canUpdate
            ? {
                searchConfig: { submitText: t('common.save', { defaultValue: '保存' }) },
                resetButtonProps: false,
                submitButtonProps: { loading: saving },
                render: (_, dom) => <div style={{ marginTop: 16 }}>{dom}</div>,
              }
            : false
        }
        onFinish={onSave}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Card
            loading={loading}
            title={t(`${NS}.taxpayerType`, { defaultValue: '纳税人类型' })}
            style={{ width: '100%' }}
          >
            <ProFormRadio.Group
              name="taxpayer_type"
              disabled={!canUpdate}
              options={[
                { label: t(`${NS}.general`, { defaultValue: '一般纳税人' }), value: 'general' },
                { label: t(`${NS}.smallScale`, { defaultValue: '小规模纳税人' }), value: 'small_scale' },
              ]}
            />
          </Card>

          <Card title={t(`${NS}.surchargeRates`, { defaultValue: '附加税税率' })} style={{ width: '100%' }}>
            <Row gutter={[24, 0]}>
              <Col xs={24} sm={12} lg={8}>
                <ProFormDigit
                  name="urban_construction"
                  label={t(`${NS}.urban`, { defaultValue: '城建税' })}
                  min={0}
                  max={100}
                  disabled={!canUpdate}
                  fieldProps={percentFieldProps}
                />
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <ProFormDigit
                  name="education"
                  label={t(`${NS}.education`, { defaultValue: '教育费附加' })}
                  min={0}
                  max={100}
                  disabled={!canUpdate}
                  fieldProps={percentFieldProps}
                />
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <ProFormDigit
                  name="local_education"
                  label={t(`${NS}.localEducation`, { defaultValue: '地方教育附加' })}
                  min={0}
                  max={100}
                  disabled={!canUpdate}
                  fieldProps={percentFieldProps}
                />
              </Col>
            </Row>
          </Card>

          <Card title={t(`${NS}.rateCatalog`, { defaultValue: '税率目录' })} style={{ width: '100%' }}>
            <ProForm.Item name="tax_rates" trigger="onValuesChange" style={{ marginBottom: 0 }}>
              <Table
                size="small"
                rowKey="rate"
                pagination={false}
                columns={rateColumns}
                dataSource={settings?.tax_rates ?? []}
                style={{ maxWidth: 320 }}
              />
            </ProForm.Item>
          </Card>

          <Card
            title={t(`${NS}.accountBindings`, { defaultValue: '科目绑定' })}
            style={{ width: '100%' }}
            extra={
              canUpdate ? (
                <Button loading={seeding} onClick={() => void onSupplementCoa()}>
                  {t(`${NS}.supplementCoa`, { defaultValue: '补种税务明细科目' })}
                </Button>
              ) : null
            }
          >
            <Row gutter={[24, 0]}>
              {BINDING_KEYS.map((key) => (
                <Col xs={24} lg={12} key={key}>
                  <ProFormSelect
                    name={['account_bindings', key]}
                    label={t(`${NS}.binding.${key}`)}
                    disabled={!canUpdate}
                    options={accountOptions}
                    showSearch
                    allowClear
                    fieldProps={{ optionFilterProp: 'label' }}
                  />
                </Col>
              ))}
            </Row>
          </Card>
        </Space>
      </ProForm>
    </ListPageTemplate>
  );
};

export default TaxSettingsPage;

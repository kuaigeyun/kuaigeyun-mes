/**
 * KU-AI / DeepSeek / OCR 集成设置（原站点设置「集成设置」Tab）
 * 数据仍写入 site-settings.integrations，供 AI 运行时读取。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { getSiteSetting, updateSiteSetting } from '../../../services/siteSetting';
import { useConfigStore } from '../../../stores/configStore';
import {
  DEEPSEEK_OCR_EXAMPLE_BASE_URL,
  DEEPSEEK_OCR_EXAMPLE_MODEL,
  DEEPSEEK_V4_MODEL_OPTIONS,
} from '../../../utils/integrationSettings';
import {
  buildKuAiIntegrationFormValues,
  buildKuAiIntegrationSettingsPayload,
  KU_AI_INTEGRATION_FORM_FIELDS,
} from './kuAiIntegrationForm';

type KuAiIntegrationSettingsPanelProps = {
  className?: string;
  style?: React.CSSProperties;
  /** 嵌入连接器市场 Modal 时使用，收紧布局并限高滚动 */
  embedded?: boolean;
};

const KuAiIntegrationSettingsPanel: React.FC<KuAiIntegrationSettingsPanelProps> = ({
  className,
  style,
  embedded = false,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const fetchConfigs = useConfigStore((s) => s.fetchConfigs);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deepseekApiKeyConfigured, setDeepseekApiKeyConfigured] = useState(false);
  const [deepseekOcrApiKeyConfigured, setDeepseekOcrApiKeyConfigured] = useState(false);

  const applySettingsToForm = useCallback((settings: Record<string, any> | undefined) => {
    form.setFieldsValue(buildKuAiIntegrationFormValues(settings?.integrations));
    setDeepseekApiKeyConfigured(settings?.integrations?.deepseek?.api_key_configured === true);
    setDeepseekOcrApiKeyConfigured(
      settings?.integrations?.deepseek?.ocr_api_key_configured === true,
    );
  }, [form]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const setting = await getSiteSetting();
      applySettingsToForm(setting.settings);
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.siteSettings.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [applySettingsToForm, messageApi, t]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields([...KU_AI_INTEGRATION_FORM_FIELDS]);
      await updateSiteSetting({
        settings: {
          integrations: buildKuAiIntegrationSettingsPayload(values),
        },
      });
      messageApi.success(t('pages.system.siteSettings.saveSuccess'));
      await fetchConfigs(true);
      await loadSettings();
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error?.message || t('pages.system.siteSettings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={className}
      style={
        embedded
          ? { maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: 4, ...style }
          : style
      }
    >
      <Form form={form} layout="vertical" disabled={loading}>
        <Row gutter={[0, 16]}>
          <Col span={24}>
            <Card title={t('pages.system.siteSettings.integrationsDeepseekTitle')} size="small">
              <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                {t('pages.system.siteSettings.integrationsDeepseekHint')}
              </Typography.Paragraph>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="integrations.deepseek.enabled"
                    label={t('pages.system.siteSettings.integrationsDeepseekEnabled')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="integrations.deepseek.model"
                    label={t('pages.system.siteSettings.integrationsDeepseekModel')}
                    tooltip={t('pages.system.siteSettings.integrationsDeepseekModelTooltip')}
                  >
                    <Select
                      options={DEEPSEEK_V4_MODEL_OPTIONS.map((value) => ({
                        value,
                        label: t(`pages.system.siteSettings.integrationsDeepseekModel_${value}`),
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="integrations.deepseek.base_url"
                    label={t('pages.system.siteSettings.integrationsDeepseekBaseUrl')}
                  >
                    <Input placeholder={t('pages.system.siteSettings.integrationsDeepseekBaseUrlPlaceholder')} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="integrations.deepseek.api_key"
                    label={t('pages.system.siteSettings.integrationsDeepseekApiKey')}
                    extra={
                      deepseekApiKeyConfigured
                        ? t('pages.system.siteSettings.integrationsDeepseekApiKeyConfigured')
                        : undefined
                    }
                  >
                    <Input.Password
                      placeholder={
                        deepseekApiKeyConfigured
                          ? t('pages.system.siteSettings.integrationsDeepseekApiKeyPlaceholderConfigured')
                          : t('pages.system.siteSettings.integrationsDeepseekApiKeyPlaceholder')
                      }
                      autoComplete="new-password"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col span={24}>
            <Card title={t('pages.system.siteSettings.integrationsDeepseekOcrTitle')} size="small">
              <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                {t('pages.system.siteSettings.integrationsDeepseekOcrHint')}
              </Typography.Paragraph>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="integrations.deepseek.ocr_base_url"
                    label={t('pages.system.siteSettings.integrationsDeepseekOcrBaseUrl')}
                  >
                    <Input placeholder={DEEPSEEK_OCR_EXAMPLE_BASE_URL} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="integrations.deepseek.ocr_model"
                    label={t('pages.system.siteSettings.integrationsDeepseekOcrModel')}
                  >
                    <Input placeholder={DEEPSEEK_OCR_EXAMPLE_MODEL} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="integrations.deepseek.ocr_api_key"
                    label={t('pages.system.siteSettings.integrationsDeepseekOcrApiKey')}
                    tooltip={t('pages.system.siteSettings.integrationsDeepseekOcrApiKeyTooltip')}
                    extra={
                      deepseekOcrApiKeyConfigured
                        ? t('pages.system.siteSettings.integrationsDeepseekApiKeyConfigured')
                        : undefined
                    }
                  >
                    <Input.Password
                      placeholder={
                        deepseekOcrApiKeyConfigured
                          ? t('pages.system.siteSettings.integrationsDeepseekApiKeyPlaceholderConfigured')
                          : t('pages.system.siteSettings.integrationsDeepseekOcrApiKeyPlaceholder')
                      }
                      autoComplete="new-password"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col span={24}>
            <Card title={t('pages.system.siteSettings.integrationsDeepseekAiTitle')} size="small">
              <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                {t('pages.system.siteSettings.integrationsDeepseekAiHint')}
              </Typography.Paragraph>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="integrations.deepseek.tools_enabled"
                    label={t('pages.system.siteSettings.integrationsDeepseekToolsEnabled')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="integrations.deepseek.rag_enabled"
                    label={t('pages.system.siteSettings.integrationsDeepseekRagEnabled')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="integrations.deepseek.rag_use_embedding"
                    label={t('pages.system.siteSettings.integrationsDeepseekRagEmbedding')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="integrations.deepseek.rag_top_k"
                    label={t('pages.system.siteSettings.integrationsDeepseekRagTopK')}
                  >
                    <InputNumber min={1} max={20} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, cur) =>
                      prev['integrations.deepseek.rag_enabled'] !== cur['integrations.deepseek.rag_enabled']
                    }
                  >
                    {({ getFieldValue }) =>
                      getFieldValue('integrations.deepseek.rag_enabled') !== false ? (
                        <Form.Item
                          name="integrations.deepseek.rag_backend"
                          label={t('pages.system.siteSettings.integrationsDeepseekRagBackend')}
                        >
                          <Select
                            options={[
                              {
                                value: 'native',
                                label: t('pages.system.siteSettings.integrationsDeepseekRagBackendNative'),
                              },
                              {
                                value: 'llamaindex',
                                label: t('pages.system.siteSettings.integrationsDeepseekRagBackendLlamaIndex'),
                              },
                            ]}
                          />
                        </Form.Item>
                      ) : null
                    }
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Form.Item
                    name="integrations.deepseek.custom_system_prompt"
                    label={t('pages.system.siteSettings.integrationsDeepseekCustomPrompt')}
                  >
                    <Input.TextArea
                      rows={5}
                      placeholder={t('pages.system.siteSettings.integrationsDeepseekCustomPromptPlaceholder')}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Form>
      <Space style={{ marginTop: 16 }}>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          {t('common.save')}
        </Button>
        <Button icon={<ReloadOutlined />} disabled={loading || saving} onClick={() => void loadSettings()}>
          {t('common.reset')}
        </Button>
      </Space>
    </div>
  );
};

export default KuAiIntegrationSettingsPanel;

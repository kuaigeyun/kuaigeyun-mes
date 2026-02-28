/**
 * 业务配置
 *
 * 整合蓝图设置、流程设置、参数设置，按功能分类，每个参数卡片化，拟物化开关。
 * 配置模板在蓝图设置页内通过「另存为模板」「自定义模板」管理。
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Form, Card, Button, Space, Layout, Menu, InputNumber, ColorPicker, Typography, Spin, Modal, Input, theme } from 'antd';
import { SaveOutlined, ReloadOutlined, SettingOutlined, ControlOutlined, ApartmentOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { MultiTabListPageTemplate } from '../../../components/layout-templates';
import {
  getBusinessConfig,
  batchUpdateProcessParameters,
  getConfigTemplates,
  saveConfigTemplate,
  applyConfigTemplate,
} from '../../../services/businessConfig';
import SkeuomorphicSwitch from '../../../components/SkeuomorphicSwitch';
import BusinessFlowConfig from '../business-config/BusinessFlowConfig';
import { PARAMETER_CATEGORIES, PROCESS_CATEGORIES } from './configTree';
import type { Color } from 'antd/es/color-picker';

const { Sider, Content } = Layout;
const { Text, Paragraph } = Typography;
const { useToken } = theme;

/** 从 business_config 提取 parameters 下的值到扁平 key */
function flattenBusinessParams(parameters: Record<string, Record<string, any>>): Record<string, any> {
  const flat: Record<string, any> = {};
  if (!parameters) return flat;
  for (const [cat, params] of Object.entries(parameters)) {
    if (!params || typeof params !== 'object') continue;
    for (const [key, value] of Object.entries(params)) {
      flat[`${cat}.${key}`] = value;
    }
  }
  return flat;
}

/** 将扁平 form 值转回 business_config parameters 结构 */
function toBusinessParams(flat: Record<string, any>, bizParamKeys: string[]): Record<string, Record<string, any>> {
  const params: Record<string, Record<string, any>> = {};
  for (const key of bizParamKeys) {
    if (flat[key] === undefined) continue;
    const dot = key.indexOf('.');
    const cat = dot > 0 ? key.slice(0, dot) : key;
    const paramKey = dot > 0 ? key.slice(dot + 1) : key;
    if (!params[cat]) params[cat] = {};
    params[cat][paramKey] = flat[key];
  }
  return params;
}

const ConfigCenterPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['blueprint', 'process', 'parameters'];
  const initialTab = validTabs.includes(tabFromUrl || '') ? tabFromUrl! : (tabFromUrl === 'graph' ? 'blueprint' : 'blueprint');
  const [activeMainTab, setActiveMainTab] = useState<string>(initialTab);
  const [form] = Form.useForm();
  const [processForm] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processSaving, setProcessSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(PARAMETER_CATEGORIES[0]?.id ?? 'production');
  const [selectedProcessCategory, setSelectedProcessCategory] = useState<string>(PROCESS_CATEGORIES[0]?.id ?? 'process_sales');
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [templateForm] = Form.useForm();

  const category = PARAMETER_CATEGORIES.find((c) => c.id === selectedCategory);
  const processCategory = PROCESS_CATEGORIES.find((c) => c.id === selectedProcessCategory);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'graph' && activeMainTab !== 'blueprint') setActiveMainTab('blueprint');
    else if (t && validTabs.includes(t) && activeMainTab !== t) setActiveMainTab(t);
  }, [searchParams]);

  useEffect(() => {
    if (activeMainTab === 'blueprint') {
      getConfigTemplates().then(setTemplates).catch(() => setTemplates([]));
    }
  }, [activeMainTab]);

  const handleSaveTemplate = async () => {
    try {
      const values = await templateForm.validateFields();
      await saveConfigTemplate({
        template_name: values.template_name,
        template_description: values.template_description,
      });
      messageApi.success(t('pages.system.configCenter.templateSaveSuccess'));
      setTemplateModalVisible(false);
      templateForm.resetFields();
      const list = await getConfigTemplates();
      setTemplates(list);
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || t('pages.system.configCenter.saveFailed'));
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const bizRes = await getBusinessConfig();

      const initialValues: Record<string, any> = {};

      // business_config: 参数设置 + 流程设置
      const bizParams = flattenBusinessParams(bizRes?.parameters || {});
      for (const [k, v] of Object.entries(bizParams)) {
        initialValues[k] = v;
      }
      // 补全缺失的 business 参数默认值
      const bizDefaults: Record<string, any> = {
        'procurement.require_purchase_requisition': false,
        'planning.require_production_plan': false,
        'purchase.auto_approval': true,
        'reporting.auto_approve': false,
        'warehouse.location_management': false,
        'warehouse.auto_outbound': true,
      };
      for (const [k, v] of Object.entries(bizDefaults)) {
        if (initialValues[k] === undefined) initialValues[k] = v;
      }

      form.setFieldsValue(initialValues);
      processForm.setFieldsValue(initialValues);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.configCenter.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveParameters = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue(true) as Record<string, any>;
      setSaving(true);

      const bizKeys: string[] = [];
      for (const cat of PARAMETER_CATEGORIES) {
        for (const param of cat.params) {
          if (param.source === 'business_config') bizKeys.push(param.key);
        }
      }

      const bizParams = toBusinessParams(values, bizKeys);
      if (Object.keys(bizParams).length > 0) {
        await batchUpdateProcessParameters({ parameters: bizParams });
      }

      messageApi.success(t('pages.system.configCenter.saveSuccess'));
      await loadData();
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error.message || t('pages.system.configCenter.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProcess = async () => {
    try {
      await processForm.validateFields();
      const values = processForm.getFieldsValue(true) as Record<string, any>;
      setProcessSaving(true);

      const bizKeys: string[] = [];
      for (const cat of PROCESS_CATEGORIES) {
        for (const param of cat.params) {
          bizKeys.push(param.key);
        }
      }

      const bizParams = toBusinessParams(values, bizKeys);
      if (Object.keys(bizParams).length > 0) {
        await batchUpdateProcessParameters({ parameters: bizParams });
      }

      messageApi.success(t('pages.system.configCenter.saveSuccess'));
      await loadData();
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error.message || t('pages.system.configCenter.saveFailed'));
    } finally {
      setProcessSaving(false);
    }
  };

  const parametersTabContent = (
    <>
      <Layout style={{ minHeight: 400, background: 'transparent' }}>
      <Sider
        width={200}
        style={{
          background: '#fafafa',
          borderRadius: 8,
          padding: '16px 0',
        }}
      >
        <div style={{ padding: '0 16px 16px', borderBottom: `1px solid ${token.colorBorder}`, marginBottom: 8 }}>
          <Space>
            <SettingOutlined style={{ fontSize: 18 }} />
            <Text strong>{t('pages.system.configCenter.categoryTitle')}</Text>
          </Space>
        </div>
        <Menu
          selectedKeys={[selectedCategory]}
          mode="inline"
          style={{ border: 'none', background: 'transparent' }}
          items={PARAMETER_CATEGORIES.map((c) => ({
            key: c.id,
            label: t(c.nameKey),
          }))}
          onClick={({ key }) => setSelectedCategory(key)}
        />
      </Sider>
      <Content style={{ padding: '0 0 0 24px', overflow: 'visible' }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>{category ? t(category.nameKey) : ''}</Text>
          {category?.descriptionKey && (
            <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
              {t(category.descriptionKey)}
            </Paragraph>
          )}
        </div>

        <Spin spinning={loading}>
          <Form form={form} layout="vertical">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {category?.params.map((param) => (
                <Card key={param.key} size="small" style={{ marginBottom: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 16,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong>{t(param.nameKey)}</Text>
                      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                        {t(param.descriptionKey)}
                      </Paragraph>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <Form.Item
                        name={[param.key]}
                        noStyle
                        valuePropName={param.type === 'boolean' ? 'checked' : undefined}
                        getValueFromEvent={
                          param.type === 'color'
                            ? (c: Color) => (typeof c?.toHexString === 'function' ? c.toHexString() : c)
                            : undefined
                        }
                      >
                        {param.type === 'boolean' ? (
                          <SkeuomorphicSwitch />
                        ) : param.type === 'number' ? (
                          <InputNumber min={param.min} max={param.max} precision={0} style={{ width: 140 }} />
                        ) : param.type === 'color' ? (
                          <ColorPicker showText />
                        ) : null}
                      </Form.Item>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Form>
        </Spin>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-start' }}>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              {t('pages.system.configCenter.refresh')}
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveParameters} loading={saving}>
              {t('pages.system.configCenter.save')}
            </Button>
          </Space>
        </div>
      </Content>
    </Layout>
    </>
  );

  const blueprintTabContent = (
    <>
      <BusinessFlowConfig
      onSaveAsTemplate={() => setTemplateModalVisible(true)}
      templates={templates}
      onRefreshTemplates={() => getConfigTemplates().then(setTemplates)}
    />
    </>
  );

  const processTabContent = (
    <>
      <Layout style={{ minHeight: 400, background: 'transparent' }}>
      <Sider
        width={200}
        style={{
          background: '#fafafa',
          borderRadius: 8,
          padding: '16px 0',
        }}
      >
        <div style={{ padding: '0 16px 16px', borderBottom: `1px solid ${token.colorBorder}`, marginBottom: 8 }}>
          <Space>
            <NodeIndexOutlined style={{ fontSize: 18 }} />
            <Text strong>{t('pages.system.configCenter.categoryTitle')}</Text>
          </Space>
        </div>
        <Menu
          selectedKeys={[selectedProcessCategory]}
          mode="inline"
          style={{ border: 'none', background: 'transparent' }}
          items={PROCESS_CATEGORIES.map((c) => ({
            key: c.id,
            label: t(c.nameKey),
          }))}
          onClick={({ key }) => setSelectedProcessCategory(key)}
        />
      </Sider>
      <Content style={{ padding: '0 0 0 24px', overflow: 'visible' }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>{processCategory ? t(processCategory.nameKey) : ''}</Text>
          {processCategory?.descriptionKey && (
            <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
              {t(processCategory.descriptionKey)}
            </Paragraph>
          )}
        </div>

        <Spin spinning={loading}>
          <Form form={processForm} layout="vertical">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {processCategory?.params.map((param) => (
                <Card key={param.key} size="small" style={{ marginBottom: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 16,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong>{t(param.nameKey)}</Text>
                      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                        {t(param.descriptionKey)}
                      </Paragraph>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <Form.Item
                        name={[param.key]}
                        noStyle
                        valuePropName="checked"
                      >
                        <SkeuomorphicSwitch />
                      </Form.Item>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Form>
        </Spin>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-start' }}>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              {t('pages.system.configCenter.refresh')}
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveProcess} loading={processSaving}>
              {t('pages.system.configCenter.save')}
            </Button>
          </Space>
        </div>
      </Content>
    </Layout>
    </>
  );

  return (
    <div className="config-center-page">
      <style>{`
        /* 修正 ant-card-body 多出的 16px 高度：将 padding 从默认 24px 调整为 16px */
        .config-center-page .ant-card .ant-card-body {
          padding: 16px !important;
        }
      `}</style>
      <MultiTabListPageTemplate
        activeTabKey={activeMainTab}
        onTabChange={setActiveMainTab}
        tabs={[
          {
            key: 'blueprint',
            label: (
              <Space>
                <ApartmentOutlined />
                <span>{t('pages.system.configCenter.tabBlueprint')}</span>
              </Space>
            ),
            children: blueprintTabContent,
          },
          {
            key: 'process',
            label: (
              <Space>
                <NodeIndexOutlined />
                <span>{t('pages.system.configCenter.tabProcess')}</span>
              </Space>
            ),
            children: processTabContent,
          },
          {
            key: 'parameters',
            label: (
              <Space>
                <ControlOutlined />
                <span>{t('pages.system.configCenter.tabParameters')}</span>
              </Space>
            ),
            children: parametersTabContent,
          },
        ]}
        padding={24}
      />

      <Modal
        title={t('pages.system.configCenter.templateModalTitle')}
        open={templateModalVisible}
        onOk={handleSaveTemplate}
        onCancel={() => {
          setTemplateModalVisible(false);
          templateForm.resetFields();
        }}
        okText={t('pages.system.configCenter.save')}
        cancelText={t('common.cancel')}
      >
        <Form form={templateForm} layout="vertical">
          <Form.Item
            name="template_name"
            label={t('pages.system.configCenter.templateName')}
            rules={[{ required: true, message: t('pages.system.configCenter.templateNameRequired') }]}
          >
            <Input placeholder={t('pages.system.configCenter.templateNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="template_description" label={t('pages.system.configCenter.templateDescription')}>
            <Input.TextArea placeholder={t('pages.system.configCenter.templateDescriptionPlaceholder')} rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ConfigCenterPage;

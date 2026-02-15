/**
 * 统一配置中心
 *
 * 整合系统参数、业务配置，按功能分类，每个参数卡片化，拟物化开关
 */

import React, { useState, useEffect } from 'react';
import { App, Form, Card, Button, Space, Layout, Menu, InputNumber, ColorPicker, Typography, Spin, Modal, Input } from 'antd';
import { SaveOutlined, ReloadOutlined, SettingOutlined, CodeSandboxOutlined, ControlOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { MultiTabListPageTemplate } from '../../../components/layout-templates';
import { getSiteSetting, updateSiteSetting } from '../../../services/siteSetting';
import {
  getBusinessConfig,
  batchUpdateProcessParameters,
  getConfigTemplates,
  saveConfigTemplate,
} from '../../../services/businessConfig';
import SkeuomorphicSwitch from '../../../components/SkeuomorphicSwitch';
import BusinessFlowConfig from '../business-config/BusinessFlowConfig';
import { CONFIG_CATEGORIES, type ParamMeta } from './configTree';
import type { Color } from 'antd/es/color-picker';

const { Sider, Content } = Layout;
const { Text, Paragraph } = Typography;

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

/** 提取 site_setting 需要的 settings（兼容嵌套与扁平） */
function toSiteSettings(flat: Record<string, any>, siteParamKeys: string[]): Record<string, any> {
  const settings: Record<string, any> = {};
  for (const key of siteParamKeys) {
    if (flat[key] === undefined) continue;
    if (key === 'theme_config.colorPrimary') {
      settings.theme_config = { ...(settings.theme_config || {}), colorPrimary: flat[key] };
    } else {
      (settings as Record<string, any>)[key] = flat[key];
    }
  }
  return settings;
}

const ConfigCenterPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeMainTab, setActiveMainTab] = useState<string>(tabFromUrl === 'graph' ? 'graph' : 'parameters');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(CONFIG_CATEGORIES[0]?.id ?? 'production');
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [templateForm] = Form.useForm();

  const category = CONFIG_CATEGORIES.find((c) => c.id === selectedCategory);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'graph' && activeMainTab !== 'graph') setActiveMainTab('graph');
  }, [searchParams]);

  useEffect(() => {
    if (activeMainTab === 'graph') {
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
      messageApi.success('配置模板已保存');
      setTemplateModalVisible(false);
      templateForm.resetFields();
      const list = await getConfigTemplates();
      setTemplates(list);
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || '保存失败');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [siteRes, bizRes] = await Promise.all([getSiteSetting(), getBusinessConfig()]);

      const initialValues: Record<string, any> = {};

      // site_setting: 支持扁平与嵌套
      const settings = siteRes?.settings || {};
      for (const cat of CONFIG_CATEGORIES) {
        for (const param of cat.params) {
          if (param.source !== 'site_setting') continue;
          const path = param.sourcePath;
          let val: any;
          if (path.includes('.')) {
            const parts = path.split('.');
            val = parts.reduce((o: any, p) => o?.[p], settings);
            if (val === undefined) val = (settings as any)[path];
          } else {
            val = (settings as any)[path];
          }
          if (val !== undefined) initialValues[param.key] = val;
        }
      }
      // theme_config.colorPrimary 特殊处理
      const themeColor = settings?.theme_config?.colorPrimary ?? (settings as any)['theme_config.colorPrimary'];
      if (themeColor !== undefined) initialValues['theme_config.colorPrimary'] = themeColor;

      // site_setting 默认值补全
      const siteDefaults: Record<string, any> = {
        'security.token_check_interval': 60,
        'security.inactivity_timeout': 1800,
        'security.user_cache_time': 300,
        'ui.max_tabs': 20,
        'ui.default_page_size': 20,
        'ui.table_loading_delay': 800,
        'theme_config.colorPrimary': '#1890ff',
        'network.timeout': 10000,
        'system.max_retries': 3,
      };
      for (const [k, v] of Object.entries(siteDefaults)) {
        if (initialValues[k] === undefined) initialValues[k] = v;
      }

      // business_config
      const bizParams = flattenBusinessParams(bizRes?.parameters || {});
      for (const [k, v] of Object.entries(bizParams)) {
        initialValues[k] = v;
      }
      // 补全缺失的 business 参数默认值
      const bizDefaults: Record<string, any> = {
        'procurement.require_purchase_requisition': false,
        'planning.require_production_plan': false,
        'warehouse.location_management': false,
        'warehouse.auto_outbound': true,
      };
      for (const [k, v] of Object.entries(bizDefaults)) {
        if (initialValues[k] === undefined) initialValues[k] = v;
      }

      form.setFieldsValue(initialValues);
    } catch (error: any) {
      messageApi.error(error.message || '加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue(true) as Record<string, any>;
      setSaving(true);

      const siteKeys: string[] = [];
      const bizKeys: string[] = [];
      for (const cat of CONFIG_CATEGORIES) {
        for (const param of cat.params) {
          if (param.source === 'site_setting') siteKeys.push(param.key);
          else if (param.source === 'business_config') bizKeys.push(param.key);
        }
      }

      const siteSettings = toSiteSettings(values, siteKeys);
      if (Object.keys(siteSettings).length > 0) {
        await updateSiteSetting({ settings: siteSettings });
      }

      const bizParams = toBusinessParams(values, bizKeys);
      if (Object.keys(bizParams).length > 0) {
        await batchUpdateProcessParameters({ parameters: bizParams });
      }

      messageApi.success('保存成功');
      window.dispatchEvent(new Event('siteThemeUpdated'));
      messageApi.info('部分设置（如主题色）可能需要刷新页面后生效');
      await loadData();
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const parametersTabContent = (
    <Layout style={{ minHeight: 400, background: 'transparent' }}>
      <Sider
        width={200}
        style={{
          background: '#fafafa',
          borderRadius: 8,
          padding: '16px 0',
        }}
      >
        <div style={{ padding: '0 16px 16px', borderBottom: '1px solid #f0f0f0', marginBottom: 8 }}>
          <Space>
            <SettingOutlined style={{ fontSize: 18 }} />
            <Text strong>参数分类</Text>
          </Space>
        </div>
        <Menu
          selectedKeys={[selectedCategory]}
          mode="inline"
          style={{ border: 'none', background: 'transparent' }}
          items={CONFIG_CATEGORIES.map((c) => ({
            key: c.id,
            label: c.name,
          }))}
          onClick={({ key }) => setSelectedCategory(key)}
        />
      </Sider>
      <Content style={{ padding: '0 0 0 24px', overflow: 'visible' }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>{category?.name}</Text>
          {category?.description && (
            <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
              {category.description}
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
                      <Text strong>{param.name}</Text>
                      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                        {param.description}
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
              刷新
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
              保存
            </Button>
          </Space>
        </div>
      </Content>
    </Layout>
  );

  const graphTabContent = (
    <BusinessFlowConfig
      onSaveAsTemplate={() => setTemplateModalVisible(true)}
      templates={templates}
      onRefreshTemplates={() => getConfigTemplates().then(setTemplates)}
    />
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
            key: 'parameters',
            label: (
              <Space>
                <ControlOutlined />
                <span>参数配置</span>
              </Space>
            ),
            children: parametersTabContent,
          },
          {
            key: 'graph',
            label: (
              <Space>
                <CodeSandboxOutlined />
                <span>业务蓝图</span>
              </Space>
            ),
            children: graphTabContent,
          },
        ]}
        padding={24}
      />

      <Modal
        title="保存配置模板"
        open={templateModalVisible}
        onOk={handleSaveTemplate}
        onCancel={() => {
          setTemplateModalVisible(false);
          templateForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={templateForm} layout="vertical">
          <Form.Item
            name="template_name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="请输入模板名称" />
          </Form.Item>
          <Form.Item name="template_description" label="模板描述">
            <Input.TextArea placeholder="请输入模板描述（可选）" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ConfigCenterPage;

/**
 * 业务配置页面
 *
 * 提供业务配置功能，包括运行模式切换、流程模块开关、流程参数配置等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Card, Form, Switch, Button, Space, Typography, Modal, Input, List, Popconfirm } from 'antd';
import { SaveOutlined, ControlOutlined, FileTextOutlined, DeleteOutlined, CheckOutlined, CodeSandboxOutlined } from '@ant-design/icons';
import { MultiTabListPageTemplate } from '../../../components/layout-templates';
import BusinessFlowConfig from './BusinessFlowConfig';
import {
  getBusinessConfig,
  batchUpdateProcessParameters,
  getConfigTemplates,
  saveConfigTemplate,
  applyConfigTemplate,
  deleteConfigTemplate,
  type ConfigTemplate,
} from '../../../services/businessConfig';

const { Title, Text, Paragraph } = Typography;



/** 流程参数配置：仅保留 category 与 param key，文案通过 t() 获取 */
const PARAMETER_KEYS: Record<string, string[]> = {
  work_order: ['auto_generate', 'priority', 'split', 'merge', 'allow_production_without_material'],
  reporting: ['quick_reporting', 'parameter_reporting', 'auto_fill', 'data_correction', 'auto_approve'],
  warehouse: ['batch_management', 'serial_management', 'multi_unit', 'fifo', 'lifo'],
  quality: ['incoming_inspection', 'process_inspection', 'finished_inspection', 'defect_handling'],
  sales: ['audit_enabled'],
  bom: ['bom_multi_version_allowed'],
};

/**
 * 业务配置页面组件
 */
const BusinessConfigPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<ConfigTemplate[]>([]);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [templateForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('graphical');


  /**
   * 加载业务配置
   */
  const loadConfig = async () => {
    try {
      const data = await getBusinessConfig();
      form.setFieldsValue({
        running_mode: data.running_mode,
        modules: data.modules,
        parameters: data.parameters,
      });

      // 加载配置模板列表
      const templatesData = await getConfigTemplates();
      setTemplates(templatesData);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.businessConfig.loadFailed'));
    } finally {
      // setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  /**
   * 保存配置模板
   */
  const handleSaveTemplate = async () => {
    try {
      const values = await templateForm.validateFields();
      await saveConfigTemplate({
        template_name: values.template_name,
        template_description: values.template_description,
      });
      messageApi.success(t('pages.system.businessConfig.templateSaved'));
      setTemplateModalVisible(false);
      templateForm.resetFields();
      await loadConfig();
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      messageApi.error(error.message || t('pages.system.businessConfig.templateSaveFailed'));
    }
  };

  /**
   * 应用配置模板
   */
  const handleApplyTemplate = async (templateId: number) => {
    try {
      await applyConfigTemplate({ template_id: templateId });
      messageApi.success(t('pages.system.businessConfig.templateApplied'));
      await loadConfig();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.businessConfig.templateApplyFailed'));
    }
  };

  /**
   * 删除配置模板
   */
  const handleDeleteTemplate = async (templateId: number) => {
    try {
      await deleteConfigTemplate(templateId);
      messageApi.success(t('pages.system.businessConfig.templateDeleted'));
      await loadConfig();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.businessConfig.templateDeleteFailed'));
    }
  };

  /**
   * 导出配置模板（JSON格式）
   */
  const handleExportTemplate = (template: ConfigTemplate) => {
    const dataStr = JSON.stringify(template.config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
    messageApi.success(t('pages.system.businessConfig.templateExported'));
  };

  /**
   * 导入配置模板
   */
  const handleImportTemplate = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importedConfig = JSON.parse(text);

        await batchUpdateProcessParameters({ parameters: importedConfig.parameters || {} });
        messageApi.success(t('pages.system.businessConfig.templateImportedApplied'));
        await loadConfig();
      } catch (error: any) {
        messageApi.error(t('pages.system.businessConfig.templateImportFailed', { reason: error.message || '文件格式错误' }));
      }
    };
    input.click();
  };

  /**
   * 渲染配置模板管理
   */
  const renderTemplateConfig = () => {
    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <div>
              <Title level={4}>{t('pages.system.businessConfig.templateManagementTitle')}</Title>
              <Paragraph type="secondary">
                {t('pages.system.businessConfig.templateManagementDesc')}
              </Paragraph>
            </div>
            <Space>
              <Button icon={<FileTextOutlined />} onClick={handleImportTemplate}>
                {t('pages.system.businessConfig.importTemplate')}
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => setTemplateModalVisible(true)}
              >
                {t('pages.system.businessConfig.saveCurrentConfig')}
              </Button>
            </Space>
          </Space>
        </div>

        <List
          dataSource={templates}
          locale={{ emptyText: t('pages.system.businessConfig.noTemplates') }}
          renderItem={(template) => (
            <List.Item
              actions={[
                <Button
                  key="export"
                  type="link"
                  icon={<FileTextOutlined />}
                  onClick={() => handleExportTemplate(template)}
                >
                  {t('pages.system.businessConfig.export')}
                </Button>,
                <Button
                  key="apply"
                  type="link"
                  icon={<CheckOutlined />}
                  onClick={() => handleApplyTemplate(template.id)}
                >
                  {t('pages.system.businessConfig.apply')}
                </Button>,
                <Popconfirm
                  key="delete"
                  title={t('pages.system.businessConfig.confirmDeleteTemplate')}
                  onConfirm={() => handleDeleteTemplate(template.id)}
                >
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                  >
                    {t('pages.system.businessConfig.delete')}
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={template.name}
                description={
                  <Space direction="vertical" size={0}>
                    {template.description && <Text type="secondary">{template.description}</Text>}
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {t('pages.system.businessConfig.createdAt')}{new Date(template.created_at).toLocaleString()}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Space>
    );
  };

  /**
   * 保存流程参数配置
   */
  const handleSaveParameters = async () => {
    try {
      const values = form.getFieldsValue();
      const parameters = values.parameters || {};

      setSaving(true);
      await batchUpdateProcessParameters({ parameters });
      messageApi.success(t('pages.system.businessConfig.parametersSaveSuccess'));
      await loadConfig();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.businessConfig.parametersSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 渲染流程参数配置
   */
  const renderParameterConfig = () => {
    return (
      <Form form={form} layout="vertical">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={4}>{t('pages.system.businessConfig.flowParamsTitle')}</Title>
            <Paragraph type="secondary">
              {t('pages.system.businessConfig.flowParamsDesc')}
            </Paragraph>
          </div>

          {Object.entries(PARAMETER_KEYS).map(([category, keys]) => (
            <Card key={category} title={t(`pages.system.businessConfig.paramCategory.${category}`)} size="small">
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {keys.map((key) => (
                  <Form.Item
                    key={key}
                    name={['parameters', category, key]}
                    label={
                      <Space direction="vertical" size={0}>
                        <Text strong>{t(`pages.system.businessConfig.param.${category}.${key}.name`)}</Text>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {t(`pages.system.businessConfig.param.${category}.${key}.description`)}
                        </Text>
                      </Space>
                    }
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                ))}
              </Space>
            </Card>
          ))}

          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSaveParameters}
            block
          >
            {t('pages.system.businessConfig.saveFlowParams')}
          </Button>
        </Space>
      </Form>
    );
  };

  const tabItems = [
    {
      key: 'graphical',
      label: (
        <Space>
          <CodeSandboxOutlined />
          <span>{t('pages.system.businessConfig.tabBlueprint')}</span>
        </Space>
      ),
      children: <BusinessFlowConfig onSaveAsTemplate={() => setTemplateModalVisible(true)} templates={templates} onRefreshTemplates={loadConfig} />,
    },
    {
      key: 'parameters',
      label: (
        <Space>
          <ControlOutlined />
          <span>{t('pages.system.businessConfig.tabParameters')}</span>
        </Space>
      ),
      children: renderParameterConfig(),
    },
    {
      key: 'templates',
      label: (
        <Space>
          <FileTextOutlined />
          <span>{t('pages.system.businessConfig.tabTemplates')}</span>
        </Space>
      ),
      children: renderTemplateConfig(),
    },
  ];

  return (
    <>
      <MultiTabListPageTemplate
        activeTabKey={activeTab}
        onTabChange={setActiveTab}
        tabs={tabItems}
      />

      {/* 保存配置模板Modal */}
      <Modal
        title={t('pages.system.businessConfig.saveTemplateModalTitle')}
        open={templateModalVisible}
        onOk={handleSaveTemplate}
        onCancel={() => {
          setTemplateModalVisible(false);
          templateForm.resetFields();
        }}
        okText={t('pages.system.businessConfig.save')}
        cancelText={t('common.cancel')}
      >
        <Form form={templateForm} layout="vertical">
          <Form.Item
            name="template_name"
            label={t('pages.system.businessConfig.templateName')}
            rules={[{ required: true, message: t('pages.system.businessConfig.templateNameRequired') }]}
          >
            <Input placeholder={t('pages.system.businessConfig.templateNamePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="template_description"
            label={t('pages.system.businessConfig.templateDesc')}
          >
            <Input.TextArea
              placeholder={t('pages.system.businessConfig.templateDescPlaceholder')}
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default BusinessConfigPage;

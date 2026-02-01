/**
 * 业务配置页面
 *
 * 提供业务配置功能，包括运行模式切换、流程模块开关、流程参数配置等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { useState, useEffect } from 'react';
import { App, Card, Form, Switch, Button, message, Space, Tabs, Typography, Tag, Alert, Divider, Modal, Input, List, Popconfirm } from 'antd';
import { SaveOutlined, ReloadOutlined, SettingOutlined, AppstoreOutlined, ControlOutlined, CrownOutlined, FileTextOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { ListPageTemplate } from '../../../components/layout-templates';
import {
  getBusinessConfig,
  switchRunningMode,
  updateModuleSwitch,
  batchUpdateProcessParameters,
  getProFeaturesList,
  checkProFeatureAccess,
  getConfigTemplates,
  saveConfigTemplate,
  applyConfigTemplate,
  deleteConfigTemplate,
  type BusinessConfig,
  type ProFeaturesList,
  type ConfigTemplate,
} from '../../../services/businessConfig';

const { Title, Text, Paragraph } = Typography;

/**
 * 模块配置映射
 */
const MODULE_CONFIG = {
  production: { name: '生产管理', core: true, description: '工单管理、报工管理、生产领料、成品入库等' },
  warehouse: { name: '仓储管理', core: true, description: '入库管理、出库管理、库存盘点、库存调拨等' },
  demand: { name: '需求管理', core: false, description: '销售预测、需求计算、销售订单、需求追溯等' },
  purchase: { name: '采购管理', core: false, description: '采购订单、采购入库、采购审批、供应商管理等' },
  sales: { name: '销售管理', core: false, description: '销售订单、销售出库、客户管理等' },
  quality: { name: '质量管理', core: false, description: '来料检验、过程检验、成品检验、不合格品处理等' },
  finance: { name: '财务管理', core: false, description: '应付管理、应收管理等' },
};

/**
 * 流程参数配置映射
 */
const PARAMETER_CONFIG = {
  work_order: {
    name: '工单管理参数',
    params: {
      auto_generate: { name: '自动生成工单', description: '是否自动根据需求生成工单' },
      priority: { name: '工单优先级', description: '是否启用工单优先级管理' },
      split: { name: '工单拆分', description: '是否支持工单拆分' },
      merge: { name: '工单合并', description: '是否支持工单合并' },
    },
  },
  reporting: {
    name: '报工管理参数',
    params: {
      quick_reporting: { name: '快速报工', description: '是否启用快速报工功能' },
      parameter_reporting: { name: '带参数报工', description: '是否支持带参数报工' },
      auto_fill: { name: '自动填充', description: '是否自动填充报工数据' },
      data_correction: { name: '报工数据修正', description: '是否允许修正已提交的报工数据' },
    },
  },
  warehouse: {
    name: '仓储管理参数',
    params: {
      batch_management: { name: '批号管理', description: '是否启用批号管理' },
      serial_management: { name: '序列号管理', description: '是否启用序列号管理' },
      multi_unit: { name: '多单位管理', description: '是否启用多单位管理' },
      fifo: { name: '先进先出（FIFO）', description: '是否启用先进先出规则' },
      lifo: { name: '后进先出（LIFO）', description: '是否启用后进先出规则' },
    },
  },
  quality: {
    name: '质量管理参数',
    params: {
      incoming_inspection: { name: '来料检验', description: '是否启用来料检验' },
      process_inspection: { name: '过程检验', description: '是否启用过程检验' },
      finished_inspection: { name: '成品检验', description: '是否启用成品检验' },
      defect_handling: { name: '不合格品处理', description: '是否启用不合格品处理' },
    },
  },
  sales: {
    name: '销售管理参数',
    params: {
      audit_enabled: { name: '销售订单审核', description: '是否启用销售订单审核流程。若关闭，订单提交后将自动通过/生效。' },
    },
  },
};

/**
 * 业务配置页面组件
 */
const BusinessConfigPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<BusinessConfig | null>(null);
  const [activeTab, setActiveTab] = useState('mode');
  const [proFeatures, setProFeatures] = useState<ProFeaturesList | null>(null);
  const [templates, setTemplates] = useState<ConfigTemplate[]>([]);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [templateForm] = Form.useForm();

  /**
   * 加载业务配置
   */
  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await getBusinessConfig();
      setConfig(data);
      form.setFieldsValue({
        running_mode: data.running_mode,
        modules: data.modules,
        parameters: data.parameters,
      });

      // 加载PRO版功能列表
      const proFeaturesData = await getProFeaturesList();
      setProFeatures(proFeaturesData);

      // 加载配置模板列表
      const templatesData = await getConfigTemplates();
      setTemplates(templatesData);
    } catch (error: any) {
      messageApi.error(error.message || '加载业务配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  /**
   * 处理PRO版功能点击
   */
  const handleProFeatureClick = async (featureType: string, featureCode: string) => {
    try {
      const accessCheck = await checkProFeatureAccess(featureType, featureCode);
      if (!accessCheck.has_access) {
        Modal.info({
          title: 'PRO版功能',
          content: (
            <div>
              <p>{accessCheck.upgrade_message}</p>
              <p>当前套餐：{accessCheck.current_plan}</p>
              <p>请联系管理员升级套餐以使用此功能。</p>
            </div>
          ),
          okText: '知道了',
        });
        return false;
      }
      return true;
    } catch (error: any) {
      messageApi.error(error.message || '检查功能权限失败');
      return false;
    }
  };

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
      messageApi.success('配置模板已保存');
      setTemplateModalVisible(false);
      templateForm.resetFields();
      await loadConfig();
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      messageApi.error(error.message || '保存配置模板失败');
    }
  };

  /**
   * 应用配置模板
   */
  const handleApplyTemplate = async (templateId: number) => {
    try {
      await applyConfigTemplate({ template_id: templateId });
      messageApi.success('配置模板已应用');
      await loadConfig();
    } catch (error: any) {
      messageApi.error(error.message || '应用配置模板失败');
    }
  };

  /**
   * 删除配置模板
   */
  const handleDeleteTemplate = async (templateId: number) => {
    try {
      await deleteConfigTemplate(templateId);
      messageApi.success('配置模板已删除');
      await loadConfig();
    } catch (error: any) {
      messageApi.error(error.message || '删除配置模板失败');
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
    messageApi.success('配置模板已导出');
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

        // 应用导入的配置
        await batchUpdateProcessParameters({ parameters: importedConfig.parameters || {} });
        messageApi.success('配置模板已导入并应用');
        await loadConfig();
      } catch (error: any) {
        messageApi.error('导入配置模板失败：' + (error.message || '文件格式错误'));
      }
    };
    input.click();
  };

  /**
   * 渲染配置模板管理
   */
  const renderTemplateConfig = () => {
    return (
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <div>
                <Title level={4}>配置模板管理</Title>
                <Paragraph type="secondary">
                  保存当前配置为模板，方便后续复用。支持导入、导出配置模板。
                </Paragraph>
              </div>
              <Space>
                <Button icon={<FileTextOutlined />} onClick={handleImportTemplate}>
                  导入模板
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={() => setTemplateModalVisible(true)}
                >
                  保存当前配置
                </Button>
              </Space>
            </Space>
          </div>

          <List
            dataSource={templates}
            locale={{ emptyText: '暂无配置模板' }}
            renderItem={(template) => (
              <List.Item
                actions={[
                  <Button
                    key="export"
                    type="link"
                    icon={<FileTextOutlined />}
                    onClick={() => handleExportTemplate(template)}
                  >
                    导出
                  </Button>,
                  <Button
                    key="apply"
                    type="link"
                    icon={<CheckOutlined />}
                    onClick={() => handleApplyTemplate(template.id)}
                  >
                    应用
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title="确定要删除此配置模板吗？"
                    onConfirm={() => handleDeleteTemplate(template.id)}
                  >
                    <Button
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                    >
                      删除
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
                        创建时间：{new Date(template.created_at).toLocaleString()}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Space>
      </Card>
    );
  };

  /**
   * 切换运行模式
   */
  const handleModeSwitch = async (mode: 'simple' | 'full') => {
    try {
      setSaving(true);
      const result = await switchRunningMode({
        mode,
        apply_defaults: true,
      });
      messageApi.success(result.message || '运行模式切换成功');
      await loadConfig();
    } catch (error: any) {
      messageApi.error(error.message || '切换运行模式失败');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 更新模块开关
   */
  const handleModuleSwitch = async (moduleCode: string, enabled: boolean) => {
    // 如果是PRO版功能，先检查权限
    if (enabled && proFeatures?.pro_modules.includes(moduleCode)) {
      const hasAccess = await handleProFeatureClick('modules', moduleCode);
      if (!hasAccess) {
        return;
      }
    }

    try {
      await updateModuleSwitch({
        module_code: moduleCode,
        enabled,
      });
      messageApi.success(`模块${enabled ? '已启用' : '已关闭'}`);
      await loadConfig();
    } catch (error: any) {
      messageApi.error(error.message || '更新模块开关失败');
    }
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
      messageApi.success('流程参数配置已保存');
      await loadConfig();
    } catch (error: any) {
      messageApi.error(error.message || '保存流程参数配置失败');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 渲染运行模式配置
   */
  const renderModeConfig = () => {
    const currentMode = config?.running_mode || 'simple';

    return (
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={4}>运行模式</Title>
            <Paragraph type="secondary">
              选择适合您业务的运行模式。切换模式时，系统会自动应用对应的默认配置。
            </Paragraph>
          </div>

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Card
              hoverable
              style={{
                border: currentMode === 'simple' ? '2px solid #1890ff' : '1px solid #d9d9d9',
                cursor: 'pointer',
              }}
              onClick={() => handleModeSwitch('simple')}
            >
              <Space direction="vertical" size="small">
                <Space>
                  <Title level={5}>极简模式</Title>
                  {currentMode === 'simple' && <Tag color="blue">当前模式</Tag>}
                </Space>
                <Text type="secondary">
                  适合小型企业或简单业务流程。仅启用核心模块（生产管理、仓储管理），其他模块可手动开启。
                </Text>
              </Space>
            </Card>

            <Card
              hoverable
              style={{
                border: currentMode === 'full' ? '2px solid #1890ff' : '1px solid #d9d9d9',
                cursor: 'pointer',
              }}
              onClick={() => handleModeSwitch('full')}
            >
              <Space direction="vertical" size="small">
                <Space>
                  <Title level={5}>全流程模式</Title>
                  {currentMode === 'full' && <Tag color="blue">当前模式</Tag>}
                </Space>
                <Text type="secondary">
                  适合中大型企业或完整业务流程。启用所有模块，支持完整的生产、采购、销售、质量、财务管理流程。
                </Text>
              </Space>
            </Card>
          </Space>
        </Space>
      </Card>
    );
  };

  /**
   * 渲染模块开关配置
   */
  const renderModuleConfig = () => {
    const modules = config?.modules || {};

    return (
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={4}>流程模块开关</Title>
            <Paragraph type="secondary">
              独立开启/关闭每个流程模块。关闭的模块将自动隐藏菜单和功能入口。核心模块（生产管理、仓储管理）不可关闭。
            </Paragraph>
          </div>

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {Object.entries(MODULE_CONFIG).map(([code, module]) => {
              const enabled = modules[code] ?? false;
              const isCore = module.core;
              const isProFeature = proFeatures?.pro_modules.includes(code) ?? false;

              return (
                <Card key={code} size="small">
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space direction="vertical" size="small" style={{ flex: 1 }}>
                      <Space>
                        <Text strong>{module.name}</Text>
                        {isCore && <Tag color="red">核心模块</Tag>}
                        {isProFeature && <Tag color="gold" icon={<CrownOutlined />}>PRO</Tag>}
                        {enabled && <Tag color="green">已启用</Tag>}
                        {!enabled && !isCore && <Tag color="default">已关闭</Tag>}
                      </Space>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {module.description}
                      </Text>
                    </Space>
                    <Switch
                      checked={enabled}
                      disabled={isCore}
                      onChange={(checked) => handleModuleSwitch(code, checked)}
                    />
                  </Space>
                </Card>
              );
            })}
          </Space>
        </Space>
      </Card>
    );
  };

  /**
   * 渲染流程参数配置
   */
  const renderParameterConfig = () => {
    return (
      <Form form={form} layout="vertical">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={4}>流程参数配置</Title>
            <Paragraph type="secondary">
              配置各流程模块的参数，控制功能的启用和关闭。
            </Paragraph>
          </div>

          {Object.entries(PARAMETER_CONFIG).map(([category, categoryConfig]) => (
            <Card key={category} title={categoryConfig.name} size="small">
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {Object.entries(categoryConfig.params).map(([key, param]) => (
                  <Form.Item
                    key={key}
                    name={['parameters', category, key]}
                    label={
                      <Space direction="vertical" size={0}>
                        <Text strong>{param.name}</Text>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {param.description}
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
            保存流程参数配置
          </Button>
        </Space>
      </Form>
    );
  };

  const tabItems = [
    {
      key: 'mode',
      label: (
        <Space>
          <SettingOutlined />
          <span>运行模式</span>
        </Space>
      ),
      children: renderModeConfig(),
    },
    {
      key: 'modules',
      label: (
        <Space>
          <AppstoreOutlined />
          <span>模块开关</span>
        </Space>
      ),
      children: renderModuleConfig(),
    },
    {
      key: 'parameters',
      label: (
        <Space>
          <ControlOutlined />
          <span>流程参数</span>
        </Space>
      ),
      children: renderParameterConfig(),
    },
    {
      key: 'templates',
      label: (
        <Space>
          <FileTextOutlined />
          <span>配置模板</span>
        </Space>
      ),
      children: renderTemplateConfig(),
    },
  ];

  return (
    <ListPageTemplate
      title="业务配置"
      extra={
        <Button icon={<ReloadOutlined />} onClick={loadConfig} loading={loading}>
          刷新
        </Button>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />

      {/* 保存配置模板Modal */}
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
          <Form.Item
            name="template_description"
            label="模板描述"
          >
            <Input.TextArea
              placeholder="请输入模板描述（可选）"
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
    </ListPageTemplate>
  );
};

export default BusinessConfigPage;

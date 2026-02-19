import React, { useEffect, useState } from 'react';
import { App, Form, InputNumber, Button, Space, Row, Col, ColorPicker, Tooltip } from 'antd';
import { SaveOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../../stores/configStore';
import { useThemeStore } from '../../../stores/themeStore';
import { MultiTabListPageTemplate } from '../../../components/layout-templates';
import type { Color } from 'antd/es/color-picker';

const SystemParametersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const { configs, fetchConfigs, updateConfigs } = useConfigStore();
  const [activeTabKey, setActiveTabKey] = useState('security');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 初始化加载配置
  useEffect(() => {
    loadData();
  }, [fetchConfigs]);

  // 更新表单值
  useEffect(() => {
    if (configs) {
      form.setFieldsValue(configs);
    }
  }, [configs, form]);

  const loadData = async () => {
    setLoading(true);
    try {
      await fetchConfigs();
    } catch (error) {
      console.error('Failed to load configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      await updateConfigs(values);
      message.success(t('pages.system.parameters.saveSuccess', '保存成功'));
      useThemeStore.getState().initFromApi();
      
      // 提示用户某些设置可能需要刷新页面才能生效
      message.info(t('pages.system.parameters.saveInfo', '部分设置（如主题色、页面大小）可能需要刷新页面才能完全生效'));
    } catch (error) {
      console.error('保存配置失败:', error);
      message.error(t('pages.system.parameters.saveFailed', '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const headerContent = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h2 style={{ margin: 0 }}>{t('pages.system.parameters.title', '系统参数配置')}</h2>
      <Space>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadData}
          loading={loading}
        >
          {t('common.refresh', '刷新')}
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
        >
          {t('common.save', '保存')}
        </Button>
      </Space>
    </div>
  );

  const securityContent = (
    <Row gutter={[24, 16]}>
      <Col xs={24} sm={24} md={12} lg={8}>
        <Form.Item
          name={['security.token_check_interval']}
          label={
            <Space>
              {t('pages.system.parameters.security.tokenCheckInterval', 'Token 检查间隔 (秒)')}
              <Tooltip title={t('pages.system.parameters.security.tokenCheckIntervalTooltip', '前端检查 Token 是否过期的频率')}>
                <InfoCircleOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </Space>
          }
          rules={[{ required: true, message: '请输入检查间隔' }]}
        >
          <InputNumber min={10} max={300} precision={0} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={8}>
        <Form.Item
          name={['security.inactivity_timeout']}
          label={
            <Space>
              {t('pages.system.parameters.security.inactivityTimeout', '用户不活动超时 (秒)')}
              <Tooltip title={t('pages.system.parameters.security.inactivityTimeoutTooltip', '用户无操作多长时间后自动登出，0表示禁用')}>
                <InfoCircleOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </Space>
          }
          rules={[{ required: true, message: '请输入超时时间' }]}
        >
          <InputNumber min={0} precision={0} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={8}>
        <Form.Item
          name={['security.user_cache_time']}
          label={
            <Space>
              {t('pages.system.parameters.security.userCacheTime', '用户信息缓存时间 (秒)')}
              <Tooltip title={t('pages.system.parameters.security.userCacheTimeTooltip', '用户信息在前端缓存的时间，过期后会重新获取')}>
                <InfoCircleOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </Space>
          }
          rules={[{ required: true, message: '请输入缓存时间' }]}
        >
          <InputNumber min={0} precision={0} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
    </Row>
  );

  const uiContent = (
    <Row gutter={[24, 16]}>
      <Col xs={24} sm={24} md={12} lg={8}>
        <Form.Item
          name={['ui.max_tabs']}
          label={
            <Space>
              {t('pages.system.parameters.ui.maxTabs', '最大打开标签页数')}
              <Tooltip title={t('pages.system.parameters.ui.maxTabsTooltip', '超过限制数量时，最旧的未固定标签将被自动关闭')}>
                <InfoCircleOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </Space>
          }
           rules={[{ required: true, message: '请输入最大标签数' }]}
        >
          <InputNumber min={5} max={50} precision={0} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={8}>
        <Form.Item
          name={['ui.default_page_size']}
          label={
            <Space>
              {t('pages.system.parameters.ui.defaultPageSize', '表格默认每页条数')}
              <Tooltip title={t('pages.system.parameters.ui.defaultPageSizeTooltip', '所有表格默认的分页大小')}>
                <InfoCircleOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </Space>
          }
          rules={[{ required: true, message: '请输入每页条数' }]}
        >
          <InputNumber min={5} max={100} precision={0} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={8}>
        <Form.Item
          name={['ui.table_loading_delay']}
          label={
            <Space>
              {t('pages.system.parameters.ui.tableLoadingDelay', '表格加载延迟 (毫秒)')}
              <Tooltip title={t('pages.system.parameters.ui.tableLoadingDelayTooltip', '设置加载状态显示的延迟时间，避免快速请求时的闪烁')}>
                <InfoCircleOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </Space>
          }
          rules={[{ required: true, message: '请输入加载延迟' }]}
        >
          <InputNumber min={0} max={1000} precision={0} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={8}>
        <Form.Item
          name={['theme_config', 'colorPrimary']}
          label={
             <Space>
              {t('pages.system.parameters.ui.primaryColor', '默认主题色')}
              <Tooltip title={t('pages.system.parameters.ui.primaryColorTooltip', '系统的默认主色调')}>
                <InfoCircleOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </Space>
          }
          rules={[{ required: true, message: '请选择主题色' }]}
          getValueFromEvent={(color: Color) => color.toHexString()}
        >
          <ColorPicker showText />
        </Form.Item>
      </Col>
    </Row>
  );

  const systemContent = (
    <Row gutter={[24, 16]}>
      <Col xs={24} sm={24} md={12} lg={8}>
        <Form.Item
          name={['network.timeout']}
          label={
            <Space>
              {t('pages.system.parameters.network.timeout', '请求超时时间 (毫秒)')}
              <Tooltip title={t('pages.system.parameters.network.timeoutTooltip', 'API 请求的默认超时时间')}>
                <InfoCircleOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </Space>
          }
          rules={[{ required: true, message: '请输入超时时间' }]}
        >
          <InputNumber min={1000} precision={0} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={24} md={12} lg={8}>
         <Form.Item
            name={['system.max_retries']}
            label={
              <Space>
                {t('pages.system.parameters.system.maxRetries', '最大重试次数')}
                <Tooltip title={t('pages.system.parameters.system.maxRetriesTooltip', '请求失败时的最大自动重试次数')}>
                  <InfoCircleOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
                </Tooltip>
              </Space>
            }
            rules={[{ required: true, message: '请输入重试次数' }]}
          >
            <InputNumber min={0} max={5} precision={0} style={{ width: '100%' }} />
          </Form.Item>
      </Col>
    </Row>
  );

  return (
    <Form
      form={form}
      layout="vertical"
    >
      <MultiTabListPageTemplate
        header={headerContent}
        activeTabKey={activeTabKey}
        onTabChange={setActiveTabKey}
        tabs={[
          { key: 'security', label: t('pages.system.parameters.security', '安全与会话'), children: securityContent },
          { key: 'ui', label: t('pages.system.parameters.ui', '界面与交互'), children: uiContent },
          { key: 'system', label: t('pages.system.parameters.network', '网络与系统'), children: systemContent },
        ]}
      />
    </Form>
  );
};

export default SystemParametersPage;

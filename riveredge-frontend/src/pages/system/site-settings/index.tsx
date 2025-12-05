/**
 * 站点设置页面
 * 
 * 用于系统管理员配置组织内的站点设置。
 * 支持站点基本信息、Logo、主题色、邀请注册开关等配置。
 */

import React, { useState, useEffect } from 'react';
import { App, Card, Form, Input, Switch, Button, ColorPicker, Upload, message, Space, Divider, InputNumber, Select } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { theme } from 'antd';
import {
  getSiteSetting,
  updateSiteSetting,
  SiteSetting,
  UpdateSiteSettingData,
} from '../../../services/siteSetting';

/**
 * 站点设置页面组件
 */
const SiteSettingsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [siteSetting, setSiteSetting] = useState<SiteSetting | null>(null);

  /**
   * 加载站点设置
   */
  useEffect(() => {
    loadSiteSetting();
  }, []);

  const loadSiteSetting = async () => {
    try {
      setLoading(true);
      const setting = await getSiteSetting();
      setSiteSetting(setting);
      
      // 设置表单初始值
      // 兼容旧版本：如果存在 theme_color，优先使用；否则使用 theme_config
      const themeConfig = setting.settings?.theme_config || {};
      const legacyThemeColor = setting.settings?.theme_color;
      form.setFieldsValue({
        site_name: setting.settings?.site_name || '',
        site_logo: setting.settings?.site_logo || '',
        theme_color: legacyThemeColor || themeConfig.colorPrimary || '#1890ff',
        theme_borderRadius: themeConfig.borderRadius || 6,
        theme_fontSize: themeConfig.fontSize || 14,
        theme_compact: themeConfig.compact || false,
        enable_invitation: setting.settings?.enable_invitation !== false,
        enable_register: setting.settings?.enable_register !== false,
        copyright: setting.settings?.copyright || '',
        description: setting.settings?.description || '',
      });
    } catch (error: any) {
      messageApi.error(error?.message || '加载站点设置失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理保存
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      
      // 构建主题配置对象（使用 Ant Design 原生配置格式）
      const themeConfig = {
        colorPrimary: values.theme_color || '#1890ff',
        borderRadius: values.theme_borderRadius || 6,
        fontSize: values.theme_fontSize || 14,
        compact: values.theme_compact || false,
      };
      
      const settings: Record<string, any> = {
        site_name: values.site_name,
        site_logo: values.site_logo,
        theme_config: themeConfig,
        enable_invitation: values.enable_invitation,
        enable_register: values.enable_register,
        copyright: values.copyright,
        description: values.description,
      };
      
      await updateSiteSetting({ settings });
      messageApi.success('保存成功');
      
      // 触发主题更新事件，通知应用重新加载主题配置
      window.dispatchEvent(new CustomEvent('siteThemeUpdated', {
        detail: { themeConfig }
      }));
      
      // 重新加载设置
      await loadSiteSetting();
    } catch (error: any) {
      messageApi.error(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer
      title="站点设置"
      extra={[
        <Button
          key="reload"
          icon={<ReloadOutlined />}
          onClick={loadSiteSetting}
          loading={loading}
        >
          刷新
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
        >
          保存
        </Button>,
      ]}
    >
      <Card loading={loading}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            theme_color: '#1890ff',
            enable_invitation: true,
            enable_register: true,
          }}
        >
          <Card type="inner" title="基本信息" style={{ marginBottom: 16 }}>
            <Form.Item
              name="site_name"
              label="站点名称"
              rules={[{ required: true, message: '请输入站点名称' }]}
            >
              <Input placeholder="请输入站点名称" />
            </Form.Item>
            
            <Form.Item
              name="site_logo"
              label="站点 Logo URL"
            >
              <Input placeholder="请输入 Logo URL" />
            </Form.Item>
            
            <Form.Item
              name="description"
              label="站点描述"
            >
              <Input.TextArea
                rows={3}
                placeholder="请输入站点描述"
              />
            </Form.Item>
          </Card>

          <Card type="inner" title="主题设置" style={{ marginBottom: 16 }}>
            <Form.Item
              name="theme_color"
              label="主题色（colorPrimary）"
              tooltip="Ant Design 原生配置：主要品牌颜色"
            >
              <ColorPicker showText format="hex" />
            </Form.Item>
            
            <Form.Item
              name="theme_borderRadius"
              label="圆角大小（borderRadius）"
              tooltip="Ant Design 原生配置：组件圆角大小（单位：px）"
            >
              <InputNumber min={0} max={16} style={{ width: '100%' }} />
            </Form.Item>
            
            <Form.Item
              name="theme_fontSize"
              label="字体大小（fontSize）"
              tooltip="Ant Design 原生配置：基础字体大小（单位：px）"
            >
              <InputNumber min={12} max={20} style={{ width: '100%' }} />
            </Form.Item>
            
            <Form.Item
              name="theme_compact"
              label="紧凑模式（compact）"
              tooltip="Ant Design 原生配置：是否启用紧凑模式"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Card>

          <Card type="inner" title="功能设置" style={{ marginBottom: 16 }}>
            <Form.Item
              name="enable_invitation"
              label="启用邀请注册"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            
            <Form.Item
              name="enable_register"
              label="启用公开注册"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Card>

          <Card type="inner" title="其他设置">
            <Form.Item
              name="copyright"
              label="版权信息"
            >
              <Input placeholder="请输入版权信息" />
            </Form.Item>
          </Card>
        </Form>
      </Card>
    </PageContainer>
  );
};

export default SiteSettingsPage;


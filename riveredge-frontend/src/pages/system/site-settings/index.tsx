/**
 * 站点设置页面
 * 
 * 用于系统管理员配置组织内的站点设置。
 * 支持站点基本信息、Logo、主题色、邀请注册开关等配置。
 */

import React, { useState, useEffect } from 'react';
import { App, Card, Form, Input, Switch, Button, ColorPicker, Upload, message, Space, Divider } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
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
      form.setFieldsValue({
        site_name: setting.settings?.site_name || '',
        site_logo: setting.settings?.site_logo || '',
        theme_color: setting.settings?.theme_color || '#1890ff',
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
      
      const settings: Record<string, any> = {
        site_name: values.site_name,
        site_logo: values.site_logo,
        theme_color: values.theme_color,
        enable_invitation: values.enable_invitation,
        enable_register: values.enable_register,
        copyright: values.copyright,
        description: values.description,
      };
      
      await updateSiteSetting({ settings });
      messageApi.success('保存成功');
      
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
              label="主题色"
            >
              <ColorPicker showText />
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


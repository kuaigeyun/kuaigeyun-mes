/**
 * 站点设置页面
 * 
 * 用于系统管理员配置组织内的站点设置。
 * 支持站点基本信息、Logo、主题色、邀请注册开关等配置。
 */

import React, { useState, useEffect } from 'react';
import { App, Card, Form, Input, Switch, Button, ColorPicker, Upload, message, Space, Divider, InputNumber, Select } from 'antd';
import { SaveOutlined, ReloadOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { theme } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import {
  getSiteSetting,
  updateSiteSetting,
  SiteSetting,
  UpdateSiteSettingData,
} from '../../../services/siteSetting';
import { uploadFile, getFilePreview, FileUploadResponse } from '../../../services/file';

/**
 * 站点设置页面组件
 */
const SiteSettingsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [siteSetting, setSiteSetting] = useState<SiteSetting | null>(null);
  const [logoFileList, setLogoFileList] = useState<UploadFile[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);

  /**
   * 判断字符串是否是UUID格式
   */
  const isUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  /**
   * 加载LOGO预览URL
   */
  const loadLogoPreview = async (logoValue: string | undefined) => {
    if (!logoValue || !logoValue.trim()) {
      setLogoUrl(undefined);
      setLogoFileList([]);
      return;
    }

    // 如果是UUID格式，获取文件预览URL
    if (isUUID(logoValue.trim())) {
      try {
        const previewInfo = await getFilePreview(logoValue.trim());
        setLogoUrl(previewInfo.preview_url);
        setLogoFileList([{
          uid: logoValue.trim(),
          name: '站点Logo',
          status: 'done',
          url: previewInfo.preview_url,
        }]);
      } catch (error) {
        console.error('获取LOGO预览URL失败:', error);
        setLogoUrl(undefined);
        setLogoFileList([]);
      }
    } else {
      // 如果是URL格式，直接使用
      setLogoUrl(logoValue.trim());
      setLogoFileList([{
        uid: logoValue.trim(),
        name: '站点Logo',
        status: 'done',
        url: logoValue.trim(),
      }]);
    }
  };

  /**
   * 加载站点设置
   */
  useEffect(() => {
    loadSiteSetting();
  }, []);

  /**
   * 规范化颜色值为字符串格式（用于表单初始化）
   */
  const normalizeColorValue = (color: any, defaultValue: string = '#1890ff'): string => {
    if (!color) return defaultValue;
    if (typeof color === 'string') return color;

    // 处理颜色对象：优先使用 toHexString 方法
    if (color && typeof color.toHexString === 'function') {
      try {
        return color.toHexString();
      } catch (e) {
        console.warn('Color toHexString failed:', e);
      }
    }

    // 处理包含 metaColor 的颜色对象
    if (color && color.metaColor) {
      if (typeof color.metaColor.toHexString === 'function') {
        try {
          return color.metaColor.toHexString();
        } catch (e) {
          console.warn('Color metaColor toHexString failed:', e);
        }
      }
      // 如果 metaColor 有 r, g, b 属性，手动转换为 hex
      if (typeof color.metaColor.r === 'number' && typeof color.metaColor.g === 'number' && typeof color.metaColor.b === 'number') {
        const r = Math.round(color.metaColor.r).toString(16).padStart(2, '0');
        const g = Math.round(color.metaColor.g).toString(16).padStart(2, '0');
        const b = Math.round(color.metaColor.b).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }

    // 如果 color 有 r, g, b 属性，手动转换为 hex
    if (color && typeof color.r === 'number' && typeof color.g === 'number' && typeof color.b === 'number') {
      const r = Math.round(color.r).toString(16).padStart(2, '0');
      const g = Math.round(color.g).toString(16).padStart(2, '0');
      const b = Math.round(color.b).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }

    return defaultValue;
  };

  const loadSiteSetting = async () => {
    try {
      setLoading(true);
      const setting = await getSiteSetting();
      setSiteSetting(setting);

      // 设置表单初始值
      // 兼容旧版本：如果存在 theme_color，优先使用；否则使用 theme_config
      const themeConfig = setting.settings?.theme_config || {};
      const legacyThemeColor = setting.settings?.theme_color;

      // 规范化颜色值为字符串，确保 ColorPicker 接收到正确的格式
      const normalizedThemeColor = normalizeColorValue(
        legacyThemeColor || themeConfig.colorPrimary,
        '#1890ff'
      );

      const siteLogoValue = setting.settings?.site_logo || '';
      
      form.setFieldsValue({
        site_name: setting.settings?.site_name || '',
        site_logo: siteLogoValue,
        theme_color: normalizedThemeColor,
        theme_borderRadius: themeConfig.borderRadius || 6,
        theme_fontSize: themeConfig.fontSize || 14,
        theme_compact: themeConfig.compact || false,
        enable_invitation: setting.settings?.enable_invitation !== false,
        enable_register: setting.settings?.enable_register !== false,
        copyright: setting.settings?.copyright || '',
        description: setting.settings?.description || '',
      });

      // 加载LOGO预览
      await loadLogoPreview(siteLogoValue);
    } catch (error: any) {
      messageApi.error(error?.message || '加载站点设置失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理LOGO上传
   */
  const handleLogoUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    
    try {
      // 先使用本地文件创建预览URL（立即显示）
      const localPreviewUrl = URL.createObjectURL(file as File);
      setLogoUrl(localPreviewUrl);
      
      // 上传文件（使用category标记为站点logo，便于管理，自动租户隔离）
      const response: FileUploadResponse = await uploadFile(file as File, {
        category: 'site-logo',
        description: '站点Logo',
      });
      
      if (response.uuid) {
        // 更新表单中的site_logo字段（保存UUID）
        form.setFieldsValue({
          site_logo: response.uuid,
        });
        
        // 获取服务器预览URL
        let previewUrl: string | undefined = undefined;
        const fileType = response.file_type || (file as File).type;
        
        if (fileType?.startsWith('image/')) {
          try {
            const previewInfo = await getFilePreview(response.uuid);
            previewUrl = previewInfo.preview_url;
            // 释放本地预览URL
            URL.revokeObjectURL(localPreviewUrl);
            // 使用服务器预览URL
            setLogoUrl(previewUrl);
          } catch (error) {
            // 如果获取预览URL失败，继续使用本地预览URL
            console.error('获取LOGO预览URL失败:', error);
          }
        }
        
        // 更新LOGO文件列表
        setLogoFileList([{
          uid: response.uuid,
          name: response.original_name,
          status: 'done',
          url: previewUrl || localPreviewUrl,
        }]);
        
        onSuccess?.(response);
        messageApi.success('LOGO上传成功');
      } else {
        // 上传失败，释放本地预览URL
        URL.revokeObjectURL(localPreviewUrl);
        setLogoUrl(undefined);
        throw new Error('上传失败');
      }
    } catch (error: any) {
      onError?.(error);
      messageApi.error(error.message || 'LOGO上传失败');
    }
  };

  /**
   * 处理清除LOGO
   */
  const handleClearLogo = () => {
    setLogoUrl(undefined);
    setLogoFileList([]);
    form.setFieldsValue({
      site_logo: '',
    });
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
              tooltip="未配置时将使用框架名称（RiverEdge SaaS）"
            >
              <Input placeholder="请输入站点名称（可选，未配置时使用框架名称）" />
            </Form.Item>
            
            <Form.Item
              name="site_logo"
              label="站点 Logo"
              tooltip="上传图片作为站点Logo，未配置时将使用默认Logo（支持租户隔离）"
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {logoUrl && (
                  <div style={{ marginBottom: 8 }}>
                    <img
                      src={logoUrl}
                      alt="站点Logo"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '100px',
                        objectFit: 'contain',
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                        padding: '8px',
                      }}
                    />
                  </div>
                )}
                <Space>
                  <Upload
                    customRequest={handleLogoUpload}
                    fileList={logoFileList}
                    onChange={({ fileList }) => setLogoFileList(fileList)}
                    maxCount={1}
                    accept="image/*"
                    showUploadList={false}
                  >
                    <Button icon={<UploadOutlined />}>上传Logo</Button>
                  </Upload>
                  {logoUrl && (
                    <Button
                      icon={<DeleteOutlined />}
                      danger
                      onClick={handleClearLogo}
                    >
                      清除Logo
                    </Button>
                  )}
                </Space>
              </Space>
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
              getValueFromEvent={(color) => {
                // 处理 ColorPicker 返回的颜色对象，转换为 hex 字符串
                if (typeof color === 'string') {
                  return color;
                }
                // 处理颜色对象
                if (color && typeof color.toHexString === 'function') {
                  try {
                    return color.toHexString();
                  } catch (e) {
                    console.warn('Color toHexString failed:', e);
                  }
                }
                // 处理包含 metaColor 的颜色对象
                if (color && color.metaColor) {
                  if (typeof color.metaColor.toHexString === 'function') {
                    try {
                      return color.metaColor.toHexString();
                    } catch (e) {
                      console.warn('Color metaColor toHexString failed:', e);
                    }
                  }
                  // 如果 metaColor 有 r, g, b 属性，手动转换为 hex
                  if (typeof color.metaColor.r === 'number' && typeof color.metaColor.g === 'number' && typeof color.metaColor.b === 'number') {
                    const r = Math.round(color.metaColor.r).toString(16).padStart(2, '0');
                    const g = Math.round(color.metaColor.g).toString(16).padStart(2, '0');
                    const b = Math.round(color.metaColor.b).toString(16).padStart(2, '0');
                    return `#${r}${g}${b}`;
                  }
                }
                // 如果 color 有 r, g, b 属性，手动转换为 hex
                if (color && typeof color.r === 'number' && typeof color.g === 'number' && typeof color.b === 'number') {
                  const r = Math.round(color.r).toString(16).padStart(2, '0');
                  const g = Math.round(color.g).toString(16).padStart(2, '0');
                  const b = Math.round(color.b).toString(16).padStart(2, '0');
                  return `#${r}${g}${b}`;
                }
                // 默认返回
                return '#1890ff';
              }}
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


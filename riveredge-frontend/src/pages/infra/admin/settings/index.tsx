/**
 * 平台设置页面
 *
 * 用于管理平台设置信息（平台名称、Logo、联系方式等）
 * 支持LOGO上传和登录页配置
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-06
 */

import { useTranslation } from 'react-i18next';
import { ProForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Card, Button, Space, Upload, Form, ColorPicker, Row, Col, Input, Switch, Typography } from 'antd';
import { UploadOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UploadFile, UploadProps } from 'antd';
import { ListPageTemplate } from '../../../../components/layout-templates';
import { ThemedSegmented } from '../../../../components/themed-segmented';
import {
  getPlatformSettings,
  updatePlatformSettings,
  type PlatformSettings,
  type PlatformSettingsUpdateRequest,
} from '../../../../services/platformSettings';
import { uploadFile, getFilePreview, getSiteLogoPreview, FileUploadResponse } from '../../../../services/file';
import ImageCropper from '../../../../components/image-cropper';
import { applyFavicon } from '../../../../utils/favicon';
import {
  LoginLeftColumnPreview,
  LoginPageEditorSplitPanel,
  LoginLocaleSettingsFields,
  LoginDecorationSettingsBlock,
  LoginBackgroundSettingsBlock,
  LoginFeatureSwitchesBlock,
} from '../../../../components/login-page-editor';
import { isLoginVisualLayerEnabled, validateLoginVisualLayers } from '../../../../utils/loginVisualLayers';

/**
 * 平台设置页面组件
 */
type PlatformSettingsPageMode = 'basic' | 'login';

interface PlatformSettingsPageProps {
  mode?: PlatformSettingsPageMode;
}

export default function PlatformSettingsPage({ mode = 'basic' }: PlatformSettingsPageProps) {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = ProForm.useForm<PlatformSettingsUpdateRequest>();
  
  // LOGO上传相关状态
  const [logoFileList, setLogoFileList] = useState<UploadFile[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  // Favicon 上传相关状态
  const [faviconFileList, setFaviconFileList] = useState<UploadFile[]>([]);
  const [faviconUrl, setFaviconUrl] = useState<string | undefined>(undefined);
  const [faviconCropModalVisible, setFaviconCropModalVisible] = useState(false);
  const [selectedFaviconFile, setSelectedFaviconFile] = useState<File | null>(null);
  const [decorationFileList, setDecorationFileList] = useState<UploadFile[]>([]);
  const [decorationUrl, setDecorationUrl] = useState<string | undefined>(undefined);
  const [backgroundFileList, setBackgroundFileList] = useState<UploadFile[]>([]);
  const [backgroundUrl, setBackgroundUrl] = useState<string | undefined>(undefined);
  const [loginPreviewLocale, setLoginPreviewLocale] = useState<'zh-CN' | 'en-US'>('zh-CN');
  const platformNameValue = Form.useWatch('platform_name', form);
  const platformNameEnValue = Form.useWatch('platform_name_en', form);
  const loginTitleValue = Form.useWatch('login_title', form);
  const loginTitleEnValue = Form.useWatch('login_title_en', form);
  const loginContentValue = Form.useWatch('login_content', form);
  const loginContentEnValue = Form.useWatch('login_content_en', form);
  const themeColorValue = Form.useWatch('theme_color', form);
  const loginDecorationValue = Form.useWatch('login_decoration_image', form);
  const loginBackgroundValue = Form.useWatch('login_background_image', form);
  const loginDecorationEnabledValue = Form.useWatch('login_decoration_enabled', form);
  const loginBackgroundEnabledValue = Form.useWatch('login_background_enabled', form);
  const decorationLayerEnabled = isLoginVisualLayerEnabled(loginDecorationEnabledValue);
  const backgroundLayerEnabled = isLoginVisualLayerEnabled(loginBackgroundEnabledValue);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['platformSettings'],
    queryFn: getPlatformSettings,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  // 更新平台设置
  const updateMutation = useMutation({
    mutationFn: (data: PlatformSettingsUpdateRequest) => updatePlatformSettings(data),
    onSuccess: (data) => {
      messageApi.success(t('pages.infra.platform.updateSuccess'));
      // 立即同步本地表单与缓存，避免 UI 仍短暂显示旧值造成“没保存”的错觉
      form.setFieldsValue({
        platform_name: data.platform_name,
        platform_name_en: data.platform_name_en,
        platform_logo: data.platform_logo,
        favicon: data.favicon,
        login_title: data.login_title,
        login_title_en: data.login_title_en,
        login_content: data.login_content,
        login_content_en: data.login_content_en,
        login_decoration_image: data.login_decoration_image,
        login_background_image: data.login_background_image,
        login_decoration_enabled: data.login_decoration_enabled ?? true,
        login_background_enabled: data.login_background_enabled ?? true,
        icp_license: data.icp_license,
        icp_license_en: data.icp_license_en,
        theme_color: data.theme_color || '#1890ff',
        tenant_auto_approve: data.tenant_auto_approve ?? false,
        float_button_enabled: data.float_button_enabled ?? true,
        login_guest_enabled: data.login_guest_enabled ?? true,
        login_client_win_enabled: data.login_client_win_enabled ?? true,
        login_client_android_enabled: data.login_client_android_enabled ?? true,
        login_quick_enabled: data.login_quick_enabled ?? true,
        enable_register: data.enable_register ?? true,
      });
      queryClient.setQueryData(['platformSettings'], data);
      queryClient.invalidateQueries({ queryKey: ['platformSettings'] });
      queryClient.invalidateQueries({ queryKey: ['platformSettingsPublic'] });
      applyFavicon(data.favicon).catch(() => applyFavicon(undefined));
    },
    onError: (error: any) => {
      messageApi.error(error?.message || t('pages.infra.platform.updateFailed'));
    },
  });

  /**
   * 判断字符串是否是UUID格式
   */
  const isUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  /**
   * 加载 Favicon 预览 URL
   */
  const loadFaviconPreview = async (faviconValue: string | undefined) => {
    if (!faviconValue || !faviconValue.trim()) {
      setFaviconUrl(undefined);
      setFaviconFileList([]);
      return;
    }
    if (isUUID(faviconValue.trim())) {
      try {
        const previewInfo = await getFilePreview(faviconValue.trim());
        setFaviconUrl(previewInfo.preview_url);
        setFaviconFileList([{
          uid: faviconValue.trim(),
          name: 'Favicon',
          status: 'done',
          url: previewInfo.preview_url,
        }]);
      } catch (error) {
        console.error('获取 Favicon 预览 URL 失败:', error);
        setFaviconUrl(undefined);
        setFaviconFileList([]);
      }
    } else {
      setFaviconUrl(faviconValue.trim());
      setFaviconFileList([{
        uid: faviconValue.trim(),
        name: 'Favicon',
        status: 'done',
        url: faviconValue.trim(),
      }]);
    }
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
      const previewInfo = await getSiteLogoPreview(logoValue.trim());
      if (!previewInfo?.preview_url) {
        setLogoUrl(undefined);
        setLogoFileList([]);
        return;
      }
      setLogoUrl(previewInfo.preview_url);
      setLogoFileList([{
        uid: logoValue.trim(),
        name: t('pages.infra.platform.platformLogo'),
        status: 'done',
        url: previewInfo.preview_url,
      }]);
    } else {
      // 如果是URL格式，直接使用
      setLogoUrl(logoValue.trim());
      setLogoFileList([{
        uid: logoValue.trim(),
        name: t('pages.infra.platform.platformLogo'),
        status: 'done',
        url: logoValue.trim(),
      }]);
    }
  };

  const loadDecorationPreview = async (imageValue: string | undefined) => {
    if (!imageValue || !imageValue.trim()) {
      setDecorationUrl(undefined);
      setDecorationFileList([]);
      return;
    }
    if (isUUID(imageValue.trim())) {
      try {
        const previewInfo = await getSiteLogoPreview(imageValue.trim());
        if (!previewInfo?.preview_url) {
          setDecorationUrl(undefined);
          setDecorationFileList([]);
          return;
        }
        setDecorationUrl(previewInfo.preview_url);
        setDecorationFileList([{
          uid: imageValue.trim(),
          name: t('pages.infra.platform.loginDecorationImage'),
          status: 'done',
          url: previewInfo.preview_url,
        }]);
      } catch {
        setDecorationUrl(undefined);
        setDecorationFileList([]);
      }
      return;
    }
    setDecorationUrl(imageValue.trim());
    setDecorationFileList([{
      uid: imageValue.trim(),
      name: t('pages.infra.platform.loginDecorationImage'),
      status: 'done',
      url: imageValue.trim(),
    }]);
  };

  const loadBackgroundPreview = async (imageValue: string | undefined) => {
    if (!imageValue || !imageValue.trim()) {
      setBackgroundUrl(undefined);
      setBackgroundFileList([]);
      return;
    }
    if (isUUID(imageValue.trim())) {
      try {
        const previewInfo = await getSiteLogoPreview(imageValue.trim());
        if (!previewInfo?.preview_url) {
          setBackgroundUrl(undefined);
          setBackgroundFileList([]);
          return;
        }
        setBackgroundUrl(previewInfo.preview_url);
        setBackgroundFileList([{
          uid: imageValue.trim(),
          name: t('pages.infra.platform.loginBackgroundImage'),
          status: 'done',
          url: previewInfo.preview_url,
        }]);
      } catch {
        setBackgroundUrl(undefined);
        setBackgroundFileList([]);
      }
      return;
    }
    setBackgroundUrl(imageValue.trim());
    setBackgroundFileList([{
      uid: imageValue.trim(),
      name: t('pages.infra.platform.loginBackgroundImage'),
      status: 'done',
      url: imageValue.trim(),
    }]);
  };

  const warnLoginVisualLayerAtLeastOne = () => {
    messageApi.warning(t('pages.system.siteSettings.loginVisualLayerAtLeastOne'));
  };

  // 当设置数据加载完成时，填充表单
  useEffect(() => {
    if (settings) {
      form.setFieldsValue({
        platform_name: settings.platform_name,
        platform_name_en: settings.platform_name_en,
        platform_logo: settings.platform_logo,
        favicon: settings.favicon,
        login_title: settings.login_title,
        login_title_en: settings.login_title_en,
        login_content: settings.login_content,
        login_content_en: settings.login_content_en,
        login_decoration_image: settings.login_decoration_image,
        login_background_image: settings.login_background_image,
        login_decoration_enabled: settings.login_decoration_enabled !== false,
        login_background_enabled: settings.login_background_enabled !== false,
        icp_license: settings.icp_license,
        icp_license_en: settings.icp_license_en,
        theme_color: settings.theme_color || '#1890ff',
        tenant_auto_approve: settings.tenant_auto_approve ?? false,
        float_button_enabled: settings.float_button_enabled ?? true,
        login_guest_enabled: settings.login_guest_enabled ?? true,
        login_client_win_enabled: settings.login_client_win_enabled ?? true,
        login_client_android_enabled: settings.login_client_android_enabled ?? true,
        login_quick_enabled: settings.login_quick_enabled ?? true,
        enable_register: settings.enable_register !== false,
      });
      
      // 加载LOGO预览
      loadLogoPreview(settings.platform_logo);
      // 加载 Favicon 预览
      loadFaviconPreview(settings.favicon);
      loadDecorationPreview(settings.login_decoration_image);
      loadBackgroundPreview(settings.login_background_image);
    }
  }, [settings, form]);

  /**
   * 处理LOGO文件选择（在剪裁之前）
   */
  const handleLogoFileSelect: UploadProps['beforeUpload'] = (file) => {
    if (!file.type.startsWith('image/')) {
      messageApi.error(t('pages.infra.platform.selectImage'));
      return false;
    }
    
    // 保存选中的文件，显示剪裁弹窗
    setSelectedImageFile(file);
    setCropModalVisible(true);
    
    // 阻止默认上传行为
    return false;
  };

  /**
   * 处理剪裁确认
   */
  const handleCropConfirm = async (croppedImageBlob: Blob) => {
    try {
      // 将Blob转换为File对象
      const croppedFile = new File([croppedImageBlob], selectedImageFile?.name || 'logo.png', {
        type: 'image/png',
        lastModified: Date.now(),
      });

      // 先使用本地文件创建预览URL（立即显示）
      const localPreviewUrl = URL.createObjectURL(croppedFile);
      setLogoUrl(localPreviewUrl);
      
      // 关闭剪裁弹窗
      setCropModalVisible(false);
      setSelectedImageFile(null);
      
      // 上传剪裁后的文件（使用category标记为平台logo）
      const response: FileUploadResponse = await uploadFile(croppedFile, {
        category: 'platform-logo',
        description: t('pages.infra.platform.platformLogo'),
      });
      
      if (response.uuid) {
        // 更新表单中的platform_logo字段（保存UUID）
        form.setFieldsValue({
          platform_logo: response.uuid,
        });
        
        // 获取服务器预览URL
        let previewUrl: string | undefined = undefined;
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
        
        // 更新LOGO文件列表
        setLogoFileList([{
          uid: response.uuid,
          name: response.original_name,
          status: 'done',
          url: previewUrl || localPreviewUrl,
        }]);
        
        messageApi.success(t('pages.infra.platform.logoUploadSuccess'));
      } else {
        URL.revokeObjectURL(localPreviewUrl);
        setLogoUrl(undefined);
        messageApi.error(t('pages.infra.platform.logoUploadFailed'));
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.infra.platform.logoUploadFailed'));
      setLogoUrl(undefined);
    }
  };

  /**
   * 处理剪裁取消
   */
  const handleCropCancel = () => {
    setCropModalVisible(false);
    setSelectedImageFile(null);
  };

  /**
   * 清除LOGO
   */
  const handleClearLogo = () => {
    form.setFieldsValue({
      platform_logo: undefined,
    });
    setLogoUrl(undefined);
    setLogoFileList([]);
    messageApi.success(t('pages.infra.platform.logoCleared'));
  };

  /**
   * 处理 Favicon 文件选择
   */
  const handleFaviconFileSelect: UploadProps['beforeUpload'] = (file) => {
    if (!file.type.startsWith('image/')) {
      messageApi.error(t('pages.infra.platform.selectImage'));
      return false;
    }
    setSelectedFaviconFile(file);
    setFaviconCropModalVisible(true);
    return false;
  };

  /**
   * 处理 Favicon 剪裁确认
   */
  const handleFaviconCropConfirm = async (croppedImageBlob: Blob) => {
    try {
      const croppedFile = new File([croppedImageBlob], selectedFaviconFile?.name || 'favicon.png', {
        type: 'image/png',
        lastModified: Date.now(),
      });
      const localPreviewUrl = URL.createObjectURL(croppedFile);
      setFaviconUrl(localPreviewUrl);
      setFaviconCropModalVisible(false);
      setSelectedFaviconFile(null);
      const response: FileUploadResponse = await uploadFile(croppedFile, {
        category: 'platform-favicon',
        description: t('pages.infra.platform.favicon'),
      });
      if (response.uuid) {
        form.setFieldsValue({ favicon: response.uuid });
        let previewUrl: string | undefined;
        try {
          const previewInfo = await getFilePreview(response.uuid);
          URL.revokeObjectURL(localPreviewUrl);
          previewUrl = previewInfo.preview_url;
        } catch {
          console.error('获取 Favicon 预览 URL 失败');
          previewUrl = localPreviewUrl;
        }
        setFaviconUrl(previewUrl);
        setFaviconFileList([{
          uid: response.uuid,
          name: response.original_name,
          status: 'done',
          url: previewUrl,
        }]);
        messageApi.success(t('pages.infra.platform.faviconUploadSuccess'));
      } else {
        URL.revokeObjectURL(localPreviewUrl);
        setFaviconUrl(undefined);
        messageApi.error(t('pages.infra.platform.faviconUploadFailed'));
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.infra.platform.faviconUploadFailed'));
      setFaviconUrl(undefined);
    }
  };

  /**
   * 处理 Favicon 剪裁取消
   */
  const handleFaviconCropCancel = () => {
    setFaviconCropModalVisible(false);
    setSelectedFaviconFile(null);
  };

  /**
   * 清除 Favicon
   */
  const handleClearFavicon = () => {
    form.setFieldsValue({ favicon: undefined });
    setFaviconUrl(undefined);
    setFaviconFileList([]);
    messageApi.success(t('pages.infra.platform.faviconCleared'));
  };

  const handleDecorationUpload: UploadProps['beforeUpload'] = async (file) => {
    try {
      if (!file.type.startsWith('image/')) {
        messageApi.error(t('pages.infra.platform.selectImage'));
        return Upload.LIST_IGNORE;
      }
      const response: FileUploadResponse = await uploadFile(file as File, {
        category: 'platform-logo',
        description: t('pages.infra.platform.loginDecorationImage'),
      });
      if (response.uuid) {
        form.setFieldsValue({ login_decoration_image: response.uuid });
        await loadDecorationPreview(response.uuid);
        messageApi.success(t('pages.infra.platform.loginDecorationUploadSuccess'));
      } else {
        messageApi.error(t('pages.infra.platform.loginDecorationUploadFailed'));
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.infra.platform.loginDecorationUploadFailed'));
    }
    return Upload.LIST_IGNORE;
  };

  const handleClearDecoration = () => {
    form.setFieldsValue({ login_decoration_image: undefined });
    setDecorationUrl(undefined);
    setDecorationFileList([]);
    messageApi.success(t('pages.infra.platform.loginDecorationCleared'));
  };

  const handleBackgroundUpload: UploadProps['beforeUpload'] = async (file) => {
    try {
      if (!file.type.startsWith('image/')) {
        messageApi.error(t('pages.infra.platform.selectImage'));
        return Upload.LIST_IGNORE;
      }
      const response: FileUploadResponse = await uploadFile(file as File, {
        category: 'platform-logo',
        description: t('pages.infra.platform.loginBackgroundImage'),
      });
      if (response.uuid) {
        form.setFieldsValue({ login_background_image: response.uuid });
        await loadBackgroundPreview(response.uuid);
        messageApi.success(t('pages.infra.platform.loginBackgroundUploadSuccess'));
      } else {
        messageApi.error(t('pages.infra.platform.loginBackgroundUploadFailed'));
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.infra.platform.loginBackgroundUploadFailed'));
    }
    return Upload.LIST_IGNORE;
  };

  const handleClearBackground = () => {
    form.setFieldsValue({ login_background_image: undefined });
    setBackgroundUrl(undefined);
    setBackgroundFileList([]);
    messageApi.success(t('pages.infra.platform.loginBackgroundCleared'));
  };

  const handleResetLoginPageSettings = async () => {
    try {
      await updateMutation.mutateAsync({
        login_title: '',
        login_title_en: '',
        login_content: '',
        login_content_en: '',
        login_decoration_image: '',
        login_background_image: '',
        login_decoration_enabled: true,
        login_background_enabled: true,
        icp_license: '',
        icp_license_en: '',
        theme_color: '#1890ff',
        login_guest_enabled: true,
        login_client_win_enabled: true,
        login_client_android_enabled: true,
        login_quick_enabled: true,
        enable_register: true,
      });
      setDecorationUrl(undefined);
      setDecorationFileList([]);
      setBackgroundUrl(undefined);
      setBackgroundFileList([]);
      messageApi.success(t('pages.infra.platform.loginPageResetSuccess'));
    } catch {
      messageApi.error(t('pages.infra.platform.loginPageResetFailed'));
    }
  };

  /**
   * 处理保存
   */
  const handleSave = async (values: PlatformSettingsUpdateRequest) => {
    const mergedValues = { ...form.getFieldsValue(true), ...values };
    try {
      validateLoginVisualLayers(
        isLoginVisualLayerEnabled(mergedValues.login_decoration_enabled),
        isLoginVisualLayerEnabled(mergedValues.login_background_enabled),
      );
    } catch {
      messageApi.error(t('pages.system.siteSettings.loginVisualLayerAtLeastOne'));
      return;
    }
    await updateMutation.mutateAsync({
      ...mergedValues,
      platform_name: mergedValues.platform_name?.trim(),
    });
  };

  return (
    <ListPageTemplate>
      <Card loading={isLoading}>
        <ProForm<PlatformSettingsUpdateRequest>
          form={form}
          layout="vertical"
          onFinish={handleSave}
          submitter={
            mode === 'login'
              ? {
                  searchConfig: {
                    submitText: t('pages.infra.platform.saveButton'),
                  },
                  resetButtonProps: {
                    style: { display: 'none' },
                  },
                  render: (_props, dom) => (
                    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-start' }}>
                      <Space>
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => queryClient.invalidateQueries({ queryKey: ['platformSettings'] })}
                          loading={isLoading}
                        >
                          {t('pages.system.siteSettings.refresh')}
                        </Button>
                        <Button onClick={handleResetLoginPageSettings} loading={updateMutation.isPending}>
                          {t('components.uniQuery.reset')}
                        </Button>
                        {dom}
                      </Space>
                    </div>
                  ),
                }
              : {
                  searchConfig: {
                    submitText: t('pages.infra.platform.saveButton'),
                  },
                  resetButtonProps: {
                    style: { display: 'none' },
                  },
                }
          }
        >
          {mode === 'basic' ? (
            <>
              <Row gutter={[16, 0]}>
                <Col xs={24} sm={12}>
                  <ProFormText
                    name="platform_name"
                    label={t('pages.infra.platform.platformName')}
                    placeholder={t('pages.infra.platform.platformNamePlaceholder')}
                    rules={[
                      { required: true, message: t('pages.infra.platform.platformNameRequired') },
                      { max: 200, message: t('pages.infra.platform.platformNameMax') },
                    ]}
                    fieldProps={{ maxLength: 200 }}
                  />
                </Col>
                <Col xs={24} sm={12}>
                  <ProFormText
                    name="platform_name_en"
                    label={t('pages.infra.platform.platformNameEn')}
                    placeholder={t('pages.infra.platform.platformNameEnPlaceholder')}
                    rules={[{ max: 200, message: t('pages.infra.platform.platformNameMax') }]}
                    fieldProps={{ maxLength: 200 }}
                  />
                </Col>
              </Row>
              <ProForm.Item
                name="platform_logo"
                label={t('pages.infra.platform.platformLogo')}
                tooltip={t('pages.infra.platform.platformLogoTooltip')}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {logoUrl && (
                    <div style={{ marginBottom: 8 }}>
                      <img
                        src={logoUrl}
                        alt={t('pages.infra.platform.platformLogo')}
                        style={{
                          maxWidth: '200px',
                          maxHeight: '100px',
                          objectFit: 'contain',
                          border: '1px solid var(--river-border-color)',
                          borderRadius: '4px',
                          padding: '8px',
                        }}
                      />
                    </div>
                  )}
                  <Space>
                    <Upload
                      beforeUpload={handleLogoFileSelect}
                      fileList={logoFileList}
                      maxCount={1}
                      accept="image/*"
                      showUploadList={false}
                    >
                      <Button icon={<UploadOutlined />}>{t('pages.infra.platform.uploadLogo')}</Button>
                    </Upload>
                    {logoUrl && (
                      <Button icon={<DeleteOutlined />} danger onClick={handleClearLogo}>
                        {t('pages.infra.platform.clearLogo')}
                      </Button>
                    )}
                  </Space>
                  <ProFormText
                    name="platform_logo"
                    placeholder={t('pages.infra.platform.logoUrlPlaceholder')}
                    fieldProps={{ maxLength: 500 }}
                    style={{ marginTop: 8 }}
                  />
                </Space>
              </ProForm.Item>
              <ProForm.Item
                name="favicon"
                label={t('pages.infra.platform.favicon')}
                tooltip={t('pages.infra.platform.faviconTooltip')}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {faviconUrl && (
                    <div style={{ marginBottom: 8 }}>
                      <img
                        src={faviconUrl}
                        alt={t('pages.infra.platform.favicon')}
                        style={{
                          width: 32,
                          height: 32,
                          objectFit: 'contain',
                          border: '1px solid var(--river-border-color)',
                          borderRadius: '4px',
                          padding: '4px',
                        }}
                      />
                    </div>
                  )}
                  <Space>
                    <Upload
                      beforeUpload={handleFaviconFileSelect}
                      fileList={faviconFileList}
                      maxCount={1}
                      accept="image/*"
                      showUploadList={false}
                    >
                      <Button icon={<UploadOutlined />}>{t('pages.infra.platform.uploadFavicon')}</Button>
                    </Upload>
                    {faviconUrl && (
                      <Button icon={<DeleteOutlined />} danger onClick={handleClearFavicon}>
                        {t('pages.infra.platform.clearFavicon')}
                      </Button>
                    )}
                  </Space>
                  <ProFormText
                    name="favicon"
                    placeholder={t('pages.infra.platform.faviconUrlPlaceholder')}
                    fieldProps={{ maxLength: 500 }}
                    style={{ marginTop: 8 }}
                  />
                </Space>
              </ProForm.Item>
              <Row gutter={[16, 0]} style={{ marginTop: 4 }}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="tenant_auto_approve"
                    label={t('pages.infra.platform.tenantAutoApprove')}
                    tooltip={t('pages.infra.platform.tenantAutoApproveTooltip')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="float_button_enabled"
                    label={t('pages.infra.platform.floatButtonEnabled')}
                    tooltip={t('pages.infra.platform.floatButtonEnabledTooltip')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
            </>
          ) : (
            <Row gutter={[0, 16]}>
              <Col span={24}>
                <Card title={t('pages.infra.platform.loginConfig')} size="small">
                  <Row gutter={[16, 16]}>
                    <Col span={24}>
                      <LoginPageEditorSplitPanel
                        preview={
                          <>
                            <div className="login-page-editor-split-preview-header">
                              <Typography.Text strong>{t('pages.system.siteSettings.loginLeftPreview')}</Typography.Text>
                              <ThemedSegmented
                                size="small"
                                value={loginPreviewLocale}
                                onChange={(value) => setLoginPreviewLocale(value as 'zh-CN' | 'en-US')}
                                options={[
                                  { label: t('common.languages.zhCN'), value: 'zh-CN' },
                                  { label: t('common.languages.enUS'), value: 'en-US' },
                                ]}
                              />
                            </div>
                            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                              {t('pages.system.siteSettings.loginLeftPreviewHint')}
                            </Typography.Text>
                            <div className="login-page-editor-split-preview-body">
                              <LoginLeftColumnPreview
                                variant="editor-fill"
                                themeColor={themeColorValue || '#1890ff'}
                                locale={loginPreviewLocale}
                                platformName={
                                  loginPreviewLocale === 'en-US' ? platformNameEnValue : platformNameValue
                                }
                                loginTitle={
                                  loginPreviewLocale === 'en-US' ? loginTitleEnValue : loginTitleValue
                                }
                                loginContent={
                                  loginPreviewLocale === 'en-US' ? loginContentEnValue : loginContentValue
                                }
                                logoUrl={logoUrl}
                                decorationUrl={decorationLayerEnabled ? decorationUrl : undefined}
                                backgroundUrl={backgroundLayerEnabled ? backgroundUrl : undefined}
                                decorationEnabled={decorationLayerEnabled}
                                backgroundEnabled={backgroundLayerEnabled}
                              />
                            </div>
                          </>
                        }
                        settings={
                          <div className="login-page-editor-split-settings-stack">
                            <LoginLocaleSettingsFields
                              key={loginPreviewLocale}
                              locale={loginPreviewLocale}
                              variant="platform"
                            />
                            <LoginDecorationSettingsBlock
                              variant="platform"
                              onAtLeastOneRequired={warnLoginVisualLayerAtLeastOne}
                              decorationUrl={decorationUrl}
                              decorationFileList={decorationFileList}
                              onDecorationUpload={handleDecorationUpload}
                              onClearDecoration={handleClearDecoration}
                              hasDecorationValue={
                                Boolean(decorationUrl || String(loginDecorationValue || '').trim())
                              }
                            />
                            <LoginBackgroundSettingsBlock
                              variant="platform"
                              onAtLeastOneRequired={warnLoginVisualLayerAtLeastOne}
                              backgroundUrl={backgroundUrl}
                              backgroundFileList={backgroundFileList}
                              onBackgroundUpload={handleBackgroundUpload}
                              onClearBackground={handleClearBackground}
                              hasBackgroundValue={
                                Boolean(backgroundUrl || String(loginBackgroundValue || '').trim())
                              }
                            />
                            <Form.Item
                              name="theme_color"
                              label={t('pages.system.siteSettings.loginPageThemeColor')}
                              tooltip={t('pages.infra.platform.themeColorTooltip')}
                              getValueFromEvent={(c: any) => (typeof c?.toHexString === 'function' ? c.toHexString() : c)}
                            >
                              <ColorPicker showText />
                            </Form.Item>
                          </div>
                        }
                      />
                    </Col>
                    <Col span={24}>
                      <LoginFeatureSwitchesBlock />
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>
          )}
        </ProForm>
      </Card>

      <ImageCropper
        open={cropModalVisible}
        title={t('pages.infra.platform.cropLogoTitle')}
        image={selectedImageFile}
        defaultShape="rect"
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
      <ImageCropper
        open={faviconCropModalVisible}
        title={t('pages.infra.platform.cropFaviconTitle')}
        image={selectedFaviconFile}
        defaultShape="rect"
        onCancel={handleFaviconCropCancel}
        onConfirm={handleFaviconCropConfirm}
      />
    </ListPageTemplate>
  );
}

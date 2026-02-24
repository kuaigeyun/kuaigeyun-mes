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
import { App, Card, Button, Space, Upload, message, Form, ColorPicker } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UploadFile, UploadProps } from 'antd';
import { ListPageTemplate } from '../../../../components/layout-templates';
import {
  getPlatformSettings,
  updatePlatformSettings,
  type PlatformSettings,
  type PlatformSettingsUpdateRequest,
} from '../../../../services/platformSettings';
import { uploadFile, getFilePreview, FileUploadResponse } from '../../../../services/file';
import ImageCropper from '../../../../components/image-cropper';
import { applyFavicon } from '../../../../utils/favicon';

/**
 * 平台设置页面组件
 */
export default function PlatformSettingsPage() {
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

  // 获取平台设置信息
  const { data: settings, isLoading } = useQuery({
    queryKey: ['platformSettings'],
    queryFn: getPlatformSettings,
  });

  // 更新平台设置
  const updateMutation = useMutation({
    mutationFn: (data: PlatformSettingsUpdateRequest) => updatePlatformSettings(data),
    onSuccess: (data) => {
      messageApi.success(t('pages.infra.platform.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['platformSettings'] });
      queryClient.invalidateQueries({ queryKey: ['platformSettingsPublic'] });
      applyFavicon(data.favicon).catch(() => {});
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
      try {
        const previewInfo = await getFilePreview(logoValue.trim());
        setLogoUrl(previewInfo.preview_url);
        setLogoFileList([{
          uid: logoValue.trim(),
          name: t('pages.infra.platform.platformLogo'),
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
        name: t('pages.infra.platform.platformLogo'),
        status: 'done',
        url: logoValue.trim(),
      }]);
    }
  };

  // 当设置数据加载完成时，填充表单
  useEffect(() => {
    if (settings) {
      form.setFieldsValue({
        platform_name: settings.platform_name,
        platform_logo: settings.platform_logo,
        favicon: settings.favicon,
        platform_description: settings.platform_description,
        platform_contact_email: settings.platform_contact_email,
        platform_contact_phone: settings.platform_contact_phone,
        platform_website: settings.platform_website,
        login_title: settings.login_title,
        login_content: settings.login_content,
        icp_license: settings.icp_license,
        theme_color: settings.theme_color || '#1890ff',
      });
      
      // 加载LOGO预览
      loadLogoPreview(settings.platform_logo);
      // 加载 Favicon 预览
      loadFaviconPreview(settings.favicon);
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

  /**
   * 处理保存
   */
  const handleSave = async (values: PlatformSettingsUpdateRequest) => {
    await updateMutation.mutateAsync(values);
  };

  return (
    <ListPageTemplate>
      <Card title={t('pages.infra.platform.title')} loading={isLoading}>
        <ProForm<PlatformSettingsUpdateRequest>
          form={form}
          layout="vertical"
          onFinish={handleSave}
          submitter={{
            searchConfig: {
              submitText: t('pages.infra.platform.saveButton'),
            },
            resetButtonProps: {
              style: { display: 'none' },
            },
          }}
        >
          <ProFormText
            name="platform_name"
            label={t('pages.infra.platform.platformName')}
            placeholder={t('pages.infra.platform.platformNamePlaceholder')}
            rules={[
              { required: true, message: t('pages.infra.platform.platformNameRequired') },
              { max: 200, message: t('pages.infra.platform.platformNameMax') },
            ]}
            fieldProps={{
              maxLength: 200,
            }}
          />

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
                      border: '1px solid #d9d9d9',
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
                  <Button
                    icon={<DeleteOutlined />}
                    danger
                    onClick={handleClearLogo}
                  >
                    {t('pages.infra.platform.clearLogo')}
                  </Button>
                )}
              </Space>
              <ProFormText
                name="platform_logo"
                placeholder={t('pages.infra.platform.logoUrlPlaceholder')}
                fieldProps={{
                  maxLength: 500,
                }}
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
                      border: '1px solid #d9d9d9',
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
                  <Button
                    icon={<DeleteOutlined />}
                    danger
                    onClick={handleClearFavicon}
                  >
                    {t('pages.infra.platform.clearFavicon')}
                  </Button>
                )}
              </Space>
              <ProFormText
                name="favicon"
                placeholder={t('pages.infra.platform.faviconUrlPlaceholder')}
                fieldProps={{
                  maxLength: 500,
                }}
                style={{ marginTop: 8 }}
              />
            </Space>
          </ProForm.Item>

          <ProFormTextArea
            name="platform_description"
            label={t('pages.infra.platform.platformDescription')}
            placeholder={t('pages.infra.platform.platformDescriptionPlaceholder')}
            fieldProps={{
              rows: 4,
              maxLength: 1000,
            }}
          />

          <ProFormText
            name="platform_contact_email"
            label={t('pages.infra.platform.contactEmail')}
            placeholder={t('pages.infra.platform.contactEmailPlaceholder')}
            rules={[
              { type: 'email', message: t('pages.infra.platform.contactEmailInvalid') },
              { max: 255, message: t('pages.infra.platform.contactEmailMax') },
            ]}
            fieldProps={{
              maxLength: 255,
            }}
          />

          <ProFormText
            name="platform_contact_phone"
            label={t('pages.infra.platform.contactPhone')}
            placeholder={t('pages.infra.platform.contactPhonePlaceholder')}
            rules={[
              { max: 50, message: t('pages.infra.platform.contactPhoneMax') },
            ]}
            fieldProps={{
              maxLength: 50,
            }}
          />

          <ProFormText
            name="platform_website"
            label={t('pages.infra.platform.website')}
            placeholder={t('pages.infra.platform.websitePlaceholder')}
            rules={[
              { max: 500, message: t('pages.infra.platform.websiteMax') },
            ]}
            fieldProps={{
              maxLength: 500,
            }}
          />

          <Card type="inner" title={t('pages.infra.platform.loginConfig')} style={{ marginTop: 16, marginBottom: 16 }}>
            <ProFormText
              name="login_title"
              label={t('pages.infra.platform.loginTitle')}
              placeholder={t('pages.infra.platform.loginTitlePlaceholder')}
              rules={[
                { max: 200, message: t('pages.infra.platform.loginTitleMax') },
              ]}
              fieldProps={{
                maxLength: 200,
              }}
            />

            <ProFormTextArea
              name="login_content"
              label={t('pages.infra.platform.loginContent')}
              placeholder={t('pages.infra.platform.loginContentPlaceholder')}
              fieldProps={{
                rows: 4,
                maxLength: 1000,
              }}
            />

            <Form.Item
              name="theme_color"
              label={t('pages.infra.platform.themeColor')}
              tooltip={t('pages.infra.platform.themeColorTooltip')}
            >
              <ColorPicker
                showText
                format="hex"
                presets={[
                  {
                    label: t('pages.infra.platform.recommendedColors'),
                    colors: [
                      '#1890ff', // 科技蓝（默认）
                      '#F5222D', // 薄暮
                      '#FA541C', // 火山
                      '#FAAD14', // 金盏花
                      '#13C2C2', // 明青
                      '#52C41A', // 极光绿
                      '#2F54EB', // 极客蓝
                      '#722ED1', // 酱紫
                    ],
                  },
                ]}
                onChange={(value) => {
                  const hexColor = value.toHexString();
                  form.setFieldValue('theme_color', hexColor);
                }}
              />
            </Form.Item>
          </Card>

          <ProFormText
            name="icp_license"
            label={t('pages.infra.platform.icpLicense')}
            placeholder={t('pages.infra.platform.icpLicensePlaceholder')}
            rules={[
              { max: 100, message: t('pages.infra.platform.icpLicenseMax') },
            ]}
            fieldProps={{
              maxLength: 100,
            }}
          />
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

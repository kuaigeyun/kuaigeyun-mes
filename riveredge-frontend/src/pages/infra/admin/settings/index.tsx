/**
 * 平台设置页面
 *
 * 用于管理平台设置信息（平台名称、Logo、联系方式等）
 * 支持LOGO上传和登录页配置
 *
 * @author Auto (AI Assistant)
 * @date 2026-01-06
 */

import { ProForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Card, Button, Space, Upload, message } from 'antd';
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

/**
 * 平台设置页面组件
 */
export default function PlatformSettingsPage() {
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = ProForm.useForm<PlatformSettingsUpdateRequest>();
  
  // LOGO上传相关状态
  const [logoFileList, setLogoFileList] = useState<UploadFile[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  // 获取平台设置信息
  const { data: settings, isLoading } = useQuery({
    queryKey: ['platformSettings'],
    queryFn: getPlatformSettings,
  });

  // 更新平台设置
  const updateMutation = useMutation({
    mutationFn: (data: PlatformSettingsUpdateRequest) => updatePlatformSettings(data),
    onSuccess: () => {
      messageApi.success('平台设置更新成功');
      queryClient.invalidateQueries({ queryKey: ['platformSettings'] });
      queryClient.invalidateQueries({ queryKey: ['platformSettingsPublic'] });
    },
    onError: (error: any) => {
      messageApi.error(error?.message || '平台设置更新失败');
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
          name: '平台Logo',
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
        name: '平台Logo',
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
        platform_description: settings.platform_description,
        platform_contact_email: settings.platform_contact_email,
        platform_contact_phone: settings.platform_contact_phone,
        platform_website: settings.platform_website,
        login_title: settings.login_title,
        login_content: settings.login_content,
        icp_license: settings.icp_license,
      });
      
      // 加载LOGO预览
      loadLogoPreview(settings.platform_logo);
    }
  }, [settings, form]);

  /**
   * 处理LOGO文件选择（在剪裁之前）
   */
  const handleLogoFileSelect: UploadProps['beforeUpload'] = (file) => {
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      messageApi.error('请选择图片文件');
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
        description: '平台Logo',
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
        
        messageApi.success('LOGO上传成功');
      } else {
        // 上传失败，释放本地预览URL
        URL.revokeObjectURL(localPreviewUrl);
        setLogoUrl(undefined);
        messageApi.error('LOGO上传失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || 'LOGO上传失败');
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
    messageApi.success('LOGO已清除');
  };

  /**
   * 处理保存
   */
  const handleSave = async (values: PlatformSettingsUpdateRequest) => {
    await updateMutation.mutateAsync(values);
  };

  return (
    <ListPageTemplate>
      <Card title="平台设置" loading={isLoading}>
        <ProForm<PlatformSettingsUpdateRequest>
          form={form}
          layout="vertical"
          onFinish={handleSave}
          submitter={{
            searchConfig: {
              submitText: '保存设置',
            },
            resetButtonProps: {
              style: { display: 'none' },
            },
          }}
        >
          <ProFormText
            name="platform_name"
            label="平台名称"
            placeholder="请输入平台名称"
            rules={[
              { required: true, message: '请输入平台名称' },
              { max: 200, message: '平台名称不能超过200个字符' },
            ]}
            fieldProps={{
              maxLength: 200,
            }}
          />

          <ProForm.Item
            name="platform_logo"
            label="平台Logo"
            tooltip="上传图片作为平台Logo，支持UUID和URL两种格式"
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {logoUrl && (
                <div style={{ marginBottom: 8 }}>
                  <img
                    src={logoUrl}
                    alt="平台Logo"
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
              <ProFormText
                name="platform_logo"
                placeholder="或直接输入Logo URL"
                fieldProps={{
                  maxLength: 500,
                }}
                style={{ marginTop: 8 }}
              />
            </Space>
          </ProForm.Item>

          <ProFormTextArea
            name="platform_description"
            label="平台描述"
            placeholder="请输入平台描述"
            fieldProps={{
              rows: 4,
              maxLength: 1000,
            }}
          />

          <ProFormText
            name="platform_contact_email"
            label="平台联系邮箱"
            placeholder="请输入平台联系邮箱"
            rules={[
              { type: 'email', message: '请输入有效的邮箱地址' },
              { max: 255, message: '邮箱地址不能超过255个字符' },
            ]}
            fieldProps={{
              maxLength: 255,
            }}
          />

          <ProFormText
            name="platform_contact_phone"
            label="平台联系电话"
            placeholder="请输入平台联系电话"
            rules={[
              { max: 50, message: '联系电话不能超过50个字符' },
            ]}
            fieldProps={{
              maxLength: 50,
            }}
          />

          <ProFormText
            name="platform_website"
            label="平台网站"
            placeholder="请输入平台网站URL"
            rules={[
              { max: 500, message: '网站URL不能超过500个字符' },
            ]}
            fieldProps={{
              maxLength: 500,
            }}
          />

          <Card type="inner" title="登录页配置" style={{ marginTop: 16, marginBottom: 16 }}>
            <ProFormText
              name="login_title"
              label="登录页标题"
              placeholder="请输入登录页标题（将显示在登录页左侧）"
              rules={[
                { max: 200, message: '标题不能超过200个字符' },
              ]}
              fieldProps={{
                maxLength: 200,
              }}
            />

            <ProFormTextArea
              name="login_content"
              label="登录页内容"
              placeholder="请输入登录页内容描述（将显示在登录页左侧标题下方）"
              fieldProps={{
                rows: 4,
                maxLength: 1000,
              }}
            />
          </Card>

          <ProFormText
            name="icp_license"
            label="ICP备案信息"
            placeholder="请输入ICP备案信息（如：京ICP备12345678号）"
            rules={[
              { max: 100, message: 'ICP备案信息不能超过100个字符' },
            ]}
            fieldProps={{
              maxLength: 100,
            }}
          />
        </ProForm>
      </Card>

      {/* 图片剪裁弹窗 */}
      <ImageCropper
        open={cropModalVisible}
        title="剪裁平台Logo"
        image={selectedImageFile}
        defaultShape="rect"
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
    </ListPageTemplate>
  );
}

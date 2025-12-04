/**
 * 个人资料页面
 * 
 * 用于用户查看和编辑个人资料。
 * 支持头像上传、个人简介编辑、联系方式编辑。
 */

import React, { useState, useEffect } from 'react';
import { ProForm, ProFormText, ProFormTextArea, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Card, message, Upload, Avatar, Space, Button, Input } from 'antd';
import { UserOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';

const { TextArea } = Input;
import {
  getUserProfile,
  updateUserProfile,
  UserProfile,
  UpdateUserProfileData,
} from '../../../services/userProfile';
import { uploadFile, getFileByUuid, getFilePreview, getFileDownloadUrl, FileUploadResponse, File } from '../../../services/file';

/**
 * 个人资料页面组件
 */
const UserProfilePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const formRef = React.useRef<ProFormInstance>();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [avatarFileList, setAvatarFileList] = useState<UploadFile[]>([]);
  const [contactInfoJson, setContactInfoJson] = useState<string>('{}');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  /**
   * 加载个人资料
   */
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await getUserProfile();
      setProfileData(data);
      
      // 设置表单值
      formRef.current?.setFieldsValue({
        username: data.username,
        email: data.email,
        full_name: data.full_name,
        phone: data.phone,
        bio: data.bio,
      });
      
      // 设置联系方式 JSON
      if (data.contact_info) {
        setContactInfoJson(JSON.stringify(data.contact_info, null, 2));
      } else {
        setContactInfoJson('{}');
      }
      
      // 设置头像文件列表和预览 URL
      if (data.avatar) {
        try {
          // 获取文件信息
          const fileInfo = await getFileByUuid(data.avatar);
          
          // 如果是图片，获取预览 URL
          let previewUrl: string | undefined = undefined;
          if (fileInfo.file_type?.startsWith('image/')) {
            const previewInfo = await getFilePreview(data.avatar);
            previewUrl = previewInfo.preview_url;
            setAvatarUrl(previewUrl);
          } else {
            // 非图片文件，使用下载 URL
            previewUrl = getFileDownloadUrl(data.avatar);
            setAvatarUrl(previewUrl);
          }
          
          // 设置文件列表
          setAvatarFileList([{
            uid: fileInfo.uuid,
            name: fileInfo.name,
            status: 'done',
            url: previewUrl,
          }]);
        } catch (error) {
          console.warn('Failed to load avatar file:', error);
          // 如果加载失败，清空头像 URL
          setAvatarUrl(undefined);
          setAvatarFileList([]);
        }
      } else {
        setAvatarUrl(undefined);
        setAvatarFileList([]);
      }
    } catch (error: any) {
      messageApi.error(error.message || '加载个人资料失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理头像上传
   */
  const handleAvatarUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    
    try {
      const response: FileUploadResponse = await uploadFile(file as File, {
        category: 'avatar',
      });
      
      if (response.uuid) {
        // 更新表单中的 avatar 字段
        formRef.current?.setFieldsValue({
          avatar: response.uuid,
        });
        
        // 获取预览 URL（如果是图片）
        let previewUrl: string | undefined = undefined;
        if (response.file_type?.startsWith('image/')) {
          try {
            const previewInfo = await getFilePreview(response.uuid);
            previewUrl = previewInfo.preview_url;
            setAvatarUrl(previewUrl);
          } catch (error) {
            console.warn('Failed to get preview URL:', error);
          }
        }
        
        // 更新头像文件列表
        setAvatarFileList([{
          uid: response.uuid,
          name: response.original_name,
          status: 'done',
          url: previewUrl,
        }]);
        
        onSuccess?.(response);
        messageApi.success('头像上传成功');
      } else {
        throw new Error('上传失败');
      }
    } catch (error: any) {
      onError?.(error);
      messageApi.error(error.message || '头像上传失败');
    }
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      // 解析联系方式 JSON
      let contact_info: Record<string, any> | undefined;
      if (contactInfoJson) {
        try {
          contact_info = JSON.parse(contactInfoJson);
        } catch (e) {
          messageApi.error('联系方式 JSON 格式错误');
          return;
        }
      }
      
      const data: UpdateUserProfileData = {
        ...values,
        contact_info,
      };
      
      await updateUserProfile(data);
      messageApi.success('个人资料更新成功');
      
      // 重新加载个人资料
      await loadProfile();
    } catch (error: any) {
      messageApi.error(error.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card title="个人资料" loading={loading}>
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: '保存',
            },
          }}
          layout="vertical"
        >
          <ProForm.Item label="头像">
            <Space direction="vertical" align="center">
              <Avatar
                size={100}
                src={avatarUrl}
                icon={<UserOutlined />}
              />
              <Upload
                customRequest={handleAvatarUpload}
                fileList={avatarFileList}
                onChange={({ fileList }) => setAvatarFileList(fileList)}
                maxCount={1}
                accept="image/*"
                showUploadList={false}
              >
                <Button icon={<UploadOutlined />}>上传头像</Button>
              </Upload>
            </Space>
          </ProForm.Item>
          
          <ProFormText
            name="username"
            label="用户名"
            disabled
            tooltip="用户名不可修改"
          />
          
          <ProFormText
            name="email"
            label="邮箱"
            disabled
            tooltip="邮箱不可修改"
          />
          
          <ProFormText
            name="full_name"
            label="姓名"
            disabled
            tooltip="姓名不可在此修改"
          />
          
          <ProFormText
            name="phone"
            label="手机号"
            disabled
            tooltip="手机号不可在此修改"
          />
          
          <ProFormTextArea
            name="bio"
            label="个人简介"
            fieldProps={{
              rows: 4,
              placeholder: '请输入个人简介',
            }}
          />
          
          <ProForm.Item
            name="contact_info"
            label="联系方式（JSON）"
            tooltip='联系方式，JSON 格式，如：{"phone": "13800138000", "wechat": "wechat_id"}'
          >
            <TextArea
              rows={6}
              value={contactInfoJson}
              onChange={(e) => setContactInfoJson(e.target.value)}
              style={{ fontFamily: 'monospace' }}
              placeholder={'{"phone": "13800138000", "wechat": "wechat_id", "qq": "123456789"}'}
            />
          </ProForm.Item>
        </ProForm>
      </Card>
    </div>
  );
};

export default UserProfilePage;

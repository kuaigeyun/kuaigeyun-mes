/**
 * 个人资料页面
 * 
 * 用于用户查看和编辑个人资料。
 * 支持头像上传、个人简介编辑、联系方式编辑。
 */

import React, { useState, useEffect } from 'react';
import { ProForm, ProFormTextArea, ProFormText, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Card, message, Upload, Avatar, Space, Button, Row, Col, Divider, Typography, Segmented, theme, Form, Tabs } from 'antd';
import { UserOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';

const { Title, Text } = Typography;
import {
  getUserProfile,
  updateUserProfile,
  UserProfile,
  UpdateUserProfileData,
} from '../../../services/userProfile';
import { uploadFile, getFileByUuid, getFilePreview, getFileDownloadUrl, FileUploadResponse, File } from '../../../services/file';
import { getAvatarUrl, getAvatarText, getAvatarFontSize } from '../../../utils/avatar';
import { getUserInfo, getTenantId, setTenantId } from '../../../utils/auth';
import { apiRequest } from '../../../services/api';

/**
 * 个人资料页面组件
 */
const UserProfilePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const formRef = React.useRef<ProFormInstance>();
  const passwordFormRef = React.useRef<ProFormInstance>();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [avatarFileList, setAvatarFileList] = useState<UploadFile[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>('basic');

  /**
   * 加载个人资料
   */
  useEffect(() => {
    const initializeProfile = async () => {
      // 确保 tenant_id 已设置（从 user_info 中恢复）
      let tenantId = getTenantId();
      if (!tenantId) {
        const userInfo = getUserInfo();
        if (userInfo?.tenant_id) {
          setTenantId(userInfo.tenant_id);
          tenantId = userInfo.tenant_id; // 立即更新本地变量
          console.log('✅ 个人资料页面：从 user_info 中恢复 tenant_id:', userInfo.tenant_id);
        } else {
          console.warn('⚠️ 个人资料页面：无法获取 tenant_id，可能导致头像加载失败');
        }
      }

      // 只有在 tenant_id 存在的情况下才加载个人资料
      if (tenantId) {
        await loadProfile();
      } else {
        console.error('❌ 个人资料页面：tenant_id 为空，无法加载个人资料');
        messageApi.error('组织信息未设置，请重新登录');
      }
    };

    initializeProfile();
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
        gender: data.gender,
        // 联系方式字段（已移除 contact_phone，因为上面已有手机号字段）
        contact_wechat: data.contact_info?.wechat || '',
        contact_qq: data.contact_info?.qq || '',
        contact_address: data.contact_info?.address || '',
      });
      
      // 设置头像预览 URL（简化逻辑）
      console.log('🔍 加载个人资料 - avatar 字段:', data.avatar);
      console.log('🔍 avatar 字段类型:', typeof data.avatar);
      console.log('🔍 avatar 字段是否为空字符串:', data.avatar === '');
      if (data.avatar && data.avatar.trim() !== '') {
        console.log('✅ 检测到头像 UUID:', data.avatar);
        try {
          const previewUrl = await getAvatarUrl(data.avatar);
          console.log('🔍 getAvatarUrl 返回结果:', previewUrl);
          // 只有当成功获取到预览 URL 时才设置，否则保留当前头像（如果有）
          if (previewUrl) {
            console.log('✅ 设置头像预览 URL:', previewUrl);
            setAvatarUrl(previewUrl);
            
            // 设置文件列表 - 添加重试逻辑
            try {
              const fileInfo = await getFileByUuid(data.avatar);
              setAvatarFileList([{
                uid: fileInfo.uuid,
                name: fileInfo.name,
                status: 'done',
                url: previewUrl,
              }]);
            } catch (error) {
              // 如果获取文件信息失败，可能是组织上下文问题，记录但不影响头像显示
              console.warn('⚠️ 获取头像文件信息失败（可能需要重新登录以刷新组织上下文）:', error);
              // 仍然设置文件列表，但使用基本信息
              setAvatarFileList([{
                uid: data.avatar,
                name: '头像',
                status: 'done',
                url: previewUrl,
              }]);
            }
          } else {
            console.warn('⚠️ 加载头像 URL 返回 undefined，保留当前头像（如果有）');
            // 如果获取失败，不清空头像，保留当前显示
          }
        } catch (error) {
          console.error('❌ 加载头像 URL 失败:', error);
          // 如果是组织上下文错误，提示用户重新登录
          if (error instanceof Error && error.message.includes('组织上下文')) {
            console.warn('⚠️ 头像加载失败：组织上下文未设置，建议重新登录');
          }
          // 如果加载失败，不清空头像，保留当前显示（如果有）
          // 只有在确实没有头像时才清空
          if (!avatarUrl) {
            setAvatarUrl(undefined);
            setAvatarFileList([]);
          }
        }
      } else {
        console.log('⚠️ 个人资料中没有 avatar 字段');
        // 只有在确实没有头像时才清空
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
      // 先使用本地文件创建预览 URL（立即显示）
      const localPreviewUrl = URL.createObjectURL(file as File);
      setAvatarUrl(localPreviewUrl);
      console.log('✅ 使用本地预览 URL（临时）:', localPreviewUrl);
      
      const response: FileUploadResponse = await uploadFile(file as File, {
        category: 'avatar',
      });
      
      if (response.uuid) {
        // 更新表单中的 avatar 字段
        formRef.current?.setFieldsValue({
          avatar: response.uuid,
        });
        
        // 获取服务器预览 URL（如果是图片）
        let previewUrl: string | undefined = undefined;
        const fileType = response.file_type || (file as File).type;
        
        if (fileType?.startsWith('image/')) {
          try {
            const previewInfo = await getFilePreview(response.uuid);
            previewUrl = previewInfo.preview_url;
            // 释放本地预览 URL
            URL.revokeObjectURL(localPreviewUrl);
            // 使用服务器预览 URL
            setAvatarUrl(previewUrl);
            console.log('✅ 头像预览 URL 获取成功:', previewUrl);
          } catch (error) {
            console.warn('⚠️ 获取预览 URL 失败，继续使用本地预览:', error);
            // 如果是组织上下文错误，记录详细信息
            if (error instanceof Error && error.message.includes('组织上下文')) {
              console.warn('⚠️ 头像预览失败：组织上下文未设置，但不影响上传');
            }
            // 如果获取预览 URL 失败，继续使用本地预览 URL
            // 不释放本地 URL，保持显示
          }
        } else {
          // 非图片文件，继续使用本地预览
          console.warn('⚠️ 上传的文件不是图片类型:', fileType);
        }
        
        // 更新头像文件列表
        setAvatarFileList([{
          uid: response.uuid,
          name: response.original_name,
          status: 'done',
          url: previewUrl || localPreviewUrl,
        }]);
        
        // 立即保存头像到后端
        try {
          await updateUserProfile({ avatar: response.uuid });
          console.log('✅ 头像已保存到后端');
        } catch (error: any) {
          console.error('⚠️ 保存头像到后端失败:', error);
          messageApi.warning('头像上传成功，但保存到后端失败，请稍后重试');
        }
        
        onSuccess?.(response);
        messageApi.success('头像上传并保存成功');
      } else {
        // 上传失败，释放本地预览 URL
        URL.revokeObjectURL(localPreviewUrl);
        setAvatarUrl(undefined);
        throw new Error('上传失败');
      }
    } catch (error: any) {
      onError?.(error);
      messageApi.error(error.message || '头像上传失败');
    }
  };

  /**
   * 处理清除头像
   */
  const handleClearAvatar = async () => {
    try {
      setLoading(true);
      
      // 清除头像：将 avatar 设置为 null
      await updateUserProfile({ avatar: null });
      
      // 清除本地状态
      setAvatarUrl(undefined);
      setAvatarFileList([]);
      
      // 更新表单字段
      formRef.current?.setFieldsValue({
        avatar: null,
      });
      
      // 重新加载个人资料
      await loadProfile();
      
      messageApi.success('头像已清除');
    } catch (error: any) {
      console.error('❌ 清除头像失败:', error);
      messageApi.error(error.message || '清除头像失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理密码修改
   */
  const handlePasswordChange = async (values: any) => {
    try {
      setPasswordLoading(true);
      
      const { old_password, new_password, confirm_password } = values;
      
      // 验证新密码和确认密码是否一致
      if (new_password !== confirm_password) {
        messageApi.error('新密码和确认密码不一致');
        return;
      }
      
      // 调用修改密码 API
      await apiRequest('/personal/change-password', {
        method: 'POST',
        data: {
          old_password,
          new_password,
        },
      });
      
      messageApi.success('密码修改成功');
      
      // 清空表单
      passwordFormRef.current?.resetFields();
    } catch (error: any) {
      console.error('❌ 修改密码失败:', error);
      messageApi.error(error.message || '修改密码失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      console.log('📝 表单提交值:', values);
      console.log('📝 性别字段值:', values.gender);
      console.log('📝 性别字段类型:', typeof values.gender);
      
      // 组装联系方式对象（只包含有值的字段）
      // 注意：对于空字符串，也需要包含在对象中，以便清空字段
      const contact_info: Record<string, any> = {};
      if (values.contact_wechat !== undefined && values.contact_wechat !== null) {
        contact_info.wechat = values.contact_wechat.trim() || null;
      }
      if (values.contact_qq !== undefined && values.contact_qq !== null) {
        contact_info.qq = values.contact_qq.trim() || null;
      }
      if (values.contact_address !== undefined && values.contact_address !== null) {
        contact_info.address = values.contact_address.trim() || null;
      }
      
      // 只发送可编辑的字段：username、email、full_name、phone、bio、gender、contact_info
      // 注意：avatar 已经在上传时自动保存，这里不再发送
      // 注意：对于空字符串，需要转换为 null 或保留空字符串，不能转换为 undefined
      // 因为 undefined 会被 Pydantic 的 exclude_unset=True 忽略，导致字段不会被更新
      const data: UpdateUserProfileData = {
        username: values.username !== undefined && values.username !== null ? values.username.trim() : undefined,
        email: values.email !== undefined && values.email !== null ? (values.email.trim() || null) : undefined,
        full_name: values.full_name !== undefined && values.full_name !== null ? (values.full_name.trim() || null) : undefined,
        phone: values.phone !== undefined && values.phone !== null ? (values.phone.trim() || null) : undefined,
        bio: values.bio !== undefined && values.bio !== null ? (values.bio.trim() || null) : undefined,
        gender: values.gender !== undefined && values.gender !== null ? values.gender : undefined,
        contact_info: Object.keys(contact_info).length > 0 ? contact_info : null,
      };
      
      console.log('📤 准备发送的数据:', data);
      
      // 移除 undefined 字段（但保留 null 值，因为 null 表示清空字段）
      Object.keys(data).forEach(key => {
        if (data[key as keyof UpdateUserProfileData] === undefined) {
          delete data[key as keyof UpdateUserProfileData];
        }
      });
      
      await updateUserProfile(data);
      messageApi.success('个人资料更新成功');
      
      // 头像已经在上传时自动保存，这里不需要再处理头像
      
      // 重新加载个人资料（但不覆盖头像，如果加载失败）
      const savedAvatarUrl = avatarUrl; // 保存当前头像 URL
      try {
        const updatedData = await getUserProfile();
        setProfileData(updatedData);
        
        // 更新表单值
        formRef.current?.setFieldsValue({
          username: updatedData.username,
          email: updatedData.email,
          full_name: updatedData.full_name,
          phone: updatedData.phone,
          bio: updatedData.bio,
          gender: updatedData.gender,
          avatar: updatedData.avatar,
          // 联系方式字段（已移除 contact_phone，因为上面已有手机号字段）
          contact_wechat: updatedData.contact_info?.wechat || '',
          contact_qq: updatedData.contact_info?.qq || '',
          contact_address: updatedData.contact_info?.address || '',
        });
        
        // 如果后端有头像，尝试加载；如果加载失败，保留当前预览
        if (updatedData.avatar) {
          try {
            const previewUrl = await getAvatarUrl(updatedData.avatar);
            // 只有当成功获取到预览 URL 时才更新，否则保留当前预览
            if (previewUrl) {
              setAvatarUrl(previewUrl);
            } else {
              console.warn('⚠️ 获取头像预览 URL 返回 undefined，保留当前预览');
              // 如果获取失败，保留之前保存的头像 URL
              if (savedAvatarUrl) {
                setAvatarUrl(savedAvatarUrl);
              }
            }
          } catch (error) {
            console.warn('⚠️ 重新加载头像失败，保留当前预览:', error);
            // 如果加载失败，保留之前保存的头像 URL
            if (savedAvatarUrl) {
              setAvatarUrl(savedAvatarUrl);
            }
          }
        } else if (savedAvatarUrl) {
          // 如果后端没有头像，但之前有预览，保留预览
          setAvatarUrl(savedAvatarUrl);
        }
      } catch (error: any) {
        console.warn('⚠️ 重新加载个人资料失败:', error);
        // 如果加载失败，至少保留当前的头像预览
        if (savedAvatarUrl) {
          setAvatarUrl(savedAvatarUrl);
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: '16px',
        margin: 0,
        boxSizing: 'border-box',
      }}
    >
      <Row gutter={16}>
        {/* 左侧：显示用户信息 */}
        <Col xs={24} md={8}>
          <Card title="用户信息" loading={loading} style={{ marginBottom: 16 }}>
            <Space orientation="vertical" align="center" style={{ width: '100%' }}>
              {avatarUrl ? (
                <Avatar
                  size={120}
                  src={avatarUrl}
                />
              ) : (
                <Avatar
                  size={120}
                  style={{
                    backgroundColor: token.colorPrimary,
                    fontSize: getAvatarFontSize(120),
                    fontWeight: 500,
                  }}
                >
                  {/* 显示首字母（优先全名，否则用户名） */}
                  {getAvatarText(profileData?.full_name, profileData?.username)}
                </Avatar>
              )}
              <div style={{ textAlign: 'center', width: '100%' }}>
                <Title level={4} style={{ margin: '16px 0 8px 0' }}>
                  {profileData?.full_name || profileData?.username || '未设置姓名'}
                </Title>
                <Text type="secondary">{profileData?.username}</Text>
              </div>
            </Space>
            
            <Divider />
            
            {/* 
              ⚠️ 注意：ProDescriptions 组件会触发 Ant Design 的 contentStyle 弃用警告
              这是 ProComponents 库内部的问题，无法直接修复，需要等待库更新
              警告信息：[antd: Descriptions] `contentStyle` is deprecated. Please use `styles.content` instead.
            */}
            <ProDescriptions
              column={1}
              dataSource={profileData || {}}
              loading={loading}
              styles={{
                content: {},
              }}
            >
              <ProDescriptions.Item
                label="用户名"
                dataIndex="username"
              />
              <ProDescriptions.Item
                label="邮箱"
                dataIndex="email"
                valueType="text"
              >
                {profileData?.email && profileData.email.trim() ? profileData.email : <Text type="secondary">未设置</Text>}
              </ProDescriptions.Item>
              <ProDescriptions.Item
                label="姓名"
                dataIndex="full_name"
              >
                {profileData?.full_name && profileData.full_name.trim() ? profileData.full_name : <Text type="secondary">未设置</Text>}
              </ProDescriptions.Item>
              <ProDescriptions.Item
                label="手机号"
                dataIndex="phone"
              >
                {profileData?.phone && profileData.phone.trim() ? profileData.phone : <Text type="secondary">未设置</Text>}
              </ProDescriptions.Item>
              <ProDescriptions.Item
                label="性别"
              >
                {profileData?.gender === 'male' ? (
                  <Text>男</Text>
                ) : profileData?.gender === 'female' ? (
                  <Text>女</Text>
                ) : (
                  <Text type="secondary">未设置</Text>
                )}
              </ProDescriptions.Item>
              {profileData?.bio && (
                <ProDescriptions.Item
                  label="个人简介"
                  dataIndex="bio"
                  valueType="text"
                />
              )}
              {profileData?.contact_info && Object.keys(profileData.contact_info).length > 0 && (
                <ProDescriptions.Item
                  label="联系方式"
                  valueType="text"
                >
                  <div>
                    {profileData.contact_info.wechat && (
                      <div>微信：{profileData.contact_info.wechat}</div>
                    )}
                    {profileData.contact_info.qq && (
                      <div>QQ：{profileData.contact_info.qq}</div>
                    )}
                    {profileData.contact_info.address && (
                      <div>地址：{profileData.contact_info.address}</div>
                    )}
                  </div>
                </ProDescriptions.Item>
              )}
            </ProDescriptions>
          </Card>
        </Col>

        {/* 右侧：编辑用户信息 */}
        <Col xs={24} md={16}>
          <Card title="编辑资料" loading={loading}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'basic',
                  label: '基本信息',
                  children: (
                    <ProForm
                      formRef={formRef}
                      onFinish={handleSubmit}
                      initialValues={{
                        username: profileData?.username,
                        email: profileData?.email,
                        full_name: profileData?.full_name,
                        phone: profileData?.phone,
                        bio: profileData?.bio,
                        gender: profileData?.gender,
                        contact_wechat: profileData?.contact_info?.wechat || '',
                        contact_qq: profileData?.contact_info?.qq || '',
                        contact_address: profileData?.contact_info?.address || '',
                      }}
                      submitter={{
                        searchConfig: {
                          submitText: '保存',
                        },
                        resetButtonProps: {
                          style: { display: 'none' },
                        },
                      }}
                      layout="vertical"
                    >
              <ProForm.Item name="avatar" label="头像">
                <Space orientation="vertical" align="center">
                  {avatarUrl ? (
                    <Avatar
                      size={100}
                      src={avatarUrl}
                    />
                  ) : (
                    <Avatar
                      size={100}
                      style={{
                        backgroundColor: token.colorPrimary,
                        fontSize: getAvatarFontSize(100),
                        fontWeight: 500,
                      }}
                    >
                      {/* 显示首字母（优先全名，否则用户名） */}
                      {getAvatarText(profileData?.full_name, profileData?.username)}
                    </Avatar>
                  )}
                  <Space>
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
                    {avatarUrl && (
                      <Button
                        icon={<DeleteOutlined />}
                        danger
                        onClick={handleClearAvatar}
                        loading={loading}
                      >
                        清除头像
                      </Button>
                    )}
                  </Space>
                </Space>
              </ProForm.Item>
              
              <ProFormText
                name="username"
                label="用户名"
                fieldProps={{
                  placeholder: '请输入用户名',
                  maxLength: 50,
                  style: { width: 280 },
                }}
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 1, message: '用户名不能为空' },
                  { max: 50, message: '用户名不能超过50个字符' },
                ]}
              />
              
              <ProFormText
                name="full_name"
                label="姓名"
                fieldProps={{
                  placeholder: '请输入姓名',
                  maxLength: 100,
                  style: { width: 280 },
                }}
              />
              
              <ProForm.Item
                name="gender"
                label="性别"
              >
                <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.gender !== currentValues.gender}>
                  {({ getFieldValue, setFieldValue }) => {
                    const genderValue = getFieldValue('gender');
                    console.log('🔍 当前性别值:', genderValue);
                    return (
                      <div className="gender-segmented-wrapper">
                        <Segmented
                          value={genderValue}
                          onChange={(newValue) => {
                            console.log('🔍 Segmented onChange 新值:', newValue);
                            setFieldValue('gender', newValue);
                          }}
                          options={[
                            { label: '男', value: 'male' },
                            { label: '女', value: 'female' },
                          ]}
                          size="large"
                        />
                        <style>{`
                          .gender-segmented-wrapper .ant-segmented {
                            background-color: ${token.colorFillSecondary || '#f5f5f5'};
                          }
                          .gender-segmented-wrapper .ant-segmented-item {
                            transition: all 0.3s;
                          }
                          .gender-segmented-wrapper .ant-segmented-item-selected {
                            background-color: ${token.colorPrimary} !important;
                            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                          }
                          .gender-segmented-wrapper .ant-segmented-item-selected .ant-segmented-item-label {
                            color: #fff !important;
                            font-weight: 600;
                          }
                          .gender-segmented-wrapper .ant-segmented-item:hover:not(.ant-segmented-item-selected) {
                            background-color: ${token.colorFill || '#f0f0f0'};
                          }
                        `}</style>
                      </div>
                    );
                  }}
                </Form.Item>
              </ProForm.Item>
              
              <ProFormText
                name="phone"
                label="手机号"
                fieldProps={{
                  placeholder: '请输入手机号',
                  maxLength: 20,
                  style: { width: 280 },
                }}
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value || value.trim() === '') {
                        return Promise.resolve();
                      }
                      const phoneRegex = /^1[3-9]\d{9}$/;
                      if (phoneRegex.test(value.trim())) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('请输入有效的手机号（11位数字，以1开头）'));
                    },
                  },
                ]}
              />
              
              <ProFormText
                name="email"
                label="邮箱"
                fieldProps={{
                  placeholder: '请输入邮箱',
                  type: 'email',
                  maxLength: 255,
                  style: { width: 360 },
                }}
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value || value.trim() === '') {
                        return Promise.resolve();
                      }
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                      if (emailRegex.test(value.trim())) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('请输入有效的邮箱地址'));
                    },
                  },
                ]}
              />
              
              <ProFormTextArea
                name="bio"
                label="个人简介"
                fieldProps={{
                  rows: 4,
                  placeholder: '请输入个人简介',
                  style: { width: '100%' },
                }}
              />
              
              <Divider titlePlacement="left">联系方式</Divider>
              
              <ProFormText
                name="contact_wechat"
                label="微信"
                placeholder="请输入微信号"
                fieldProps={{
                  maxLength: 50,
                  style: { width: 280 },
                }}
              />
              
              <ProFormText
                name="contact_qq"
                label="QQ"
                placeholder="请输入QQ号"
                fieldProps={{
                  maxLength: 20,
                  style: { width: 280 },
                }}
              />
              
              <ProFormText
                name="contact_address"
                label="地址"
                placeholder="请输入地址"
                fieldProps={{
                  maxLength: 200,
                  style: { width: '100%' },
                }}
              />
                    </ProForm>
                  ),
                },
                {
                  key: 'security',
                  label: '安全设置',
                  children: (
                    <ProForm
                      formRef={passwordFormRef}
                      onFinish={handlePasswordChange}
                      submitter={{
                        searchConfig: {
                          submitText: '修改密码',
                        },
                        resetButtonProps: {
                          style: { display: 'none' },
                        },
                        submitButtonProps: {
                          loading: passwordLoading,
                        },
                      }}
                      layout="vertical"
                    >
                      <ProFormText.Password
                        name="old_password"
                        label="当前密码"
                        fieldProps={{
                          placeholder: '请输入当前密码',
                          style: { width: 360 },
                        }}
                        rules={[
                          { required: true, message: '请输入当前密码' },
                          { min: 6, message: '密码至少6位' },
                        ]}
                      />
                      
                      <ProFormText.Password
                        name="new_password"
                        label="新密码"
                        fieldProps={{
                          placeholder: '请输入新密码（至少6位）',
                          style: { width: 360 },
                        }}
                        rules={[
                          { required: true, message: '请输入新密码' },
                          { min: 6, message: '密码至少6位' },
                        ]}
                      />
                      
                      <ProFormText.Password
                        name="confirm_password"
                        label="确认新密码"
                        fieldProps={{
                          placeholder: '请再次输入新密码',
                          style: { width: 360 },
                        }}
                        rules={[
                          { required: true, message: '请再次输入新密码' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('new_password') === value) {
                                return Promise.resolve();
                              }
                              return Promise.reject(new Error('两次输入的密码不一致'));
                            },
                          }),
                        ]}
                      />
                    </ProForm>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default UserProfilePage;

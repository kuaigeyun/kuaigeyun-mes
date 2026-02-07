/**
 * 平台超级管理员管理页面
 *
 * 用于管理平台超级管理员信息（查看、编辑）
 * 平台超级管理员是平台唯一的，只能有一个
 */

import { ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Space, Modal, Tabs } from 'antd';
import { LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MultiTabListPageTemplate } from '../../../components/layout-templates';
import { 
  getInfraSuperAdmin, 
  updateInfraSuperAdmin,
  type InfraSuperAdmin,
  type InfraSuperAdminUpdateRequest
} from '../../../services/infraAdmin';
import { clearAuth } from '../../../utils/auth';
import { useNavigate } from 'react-router-dom';
import { useGlobalStore } from '../../../stores';
import PlatformSettingsPage from './settings';
// import InfraSuperAdminForm from './form'; // 暂时注释掉，等待后续实现

/**
 * 平台超级管理员管理页面组件
 */
export default function InfraSuperAdminPage() {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setCurrentUser } = useGlobalStore();
  const [activeTabKey, setActiveTabKey] = useState('admin');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFormData, setEditFormData] = useState<InfraSuperAdminUpdateRequest | null>(null);

  // 获取平台超级管理员信息
  const { data: admin, isLoading } = useQuery({
    queryKey: ['infraSuperAdmin'],
    queryFn: getInfraSuperAdmin,
  });

  // 更新平台超级管理员信息
  const updateMutation = useMutation({
    mutationFn: (data: InfraSuperAdminUpdateRequest) => updateInfraSuperAdmin(data),
    onSuccess: () => {
      messageApi.success('更新成功');
      // setEditModalVisible(false);
      // setEditFormData(null);
      queryClient.invalidateQueries({ queryKey: ['infraSuperAdmin'] });
    },
    onError: (error: any) => {
      messageApi.error(error?.message || '更新失败');
    },
  });

  /**
   * 处理编辑 - 暂时注释掉，等待后续实现
   */
  // const handleEdit = () => {
  //   if (admin) {
  //     setEditFormData({
  //       email: admin.email,
  //       full_name: admin.full_name,
  //       is_active: admin.is_active,
  //     });
  //     setEditModalVisible(true);
  //   }
  // };

  /**
   * 处理保存
   */
  const handleSave = async (values: InfraSuperAdminUpdateRequest) => {
    await updateMutation.mutateAsync(values);
  };

  /**
   * 处理退出登录
   */
  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出',
      content: '确定要退出登录吗？',
      onOk: () => {
        // 清除认证信息
        clearAuth();
        // 清除全局状态中的用户信息
        setCurrentUser(undefined);
        // 清除查询缓存
        queryClient.clear();
        messageApi.success('已退出登录');
        // ⚠️ 关键修复：使用 navigate 跳转，避免页面刷新
        navigate('/infra/login', { replace: true });
      },
    });
  };

  const tabItems = [
    {
      key: 'admin',
      label: (
        <span>
          <UserOutlined />
          管理员信息
        </span>
      ),
      children: (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ margin: 0 }}>平台管理员信息</h2>
            <Button
              icon={<LogoutOutlined />}
              onClick={handleLogout}
            >
              退出登录
            </Button>
          </div>
          {admin && (
            <ProDescriptions<InfraSuperAdmin>
              column={2}
              dataSource={admin}
              loading={isLoading}
              columns={[
                {
                  title: 'ID',
                  dataIndex: 'id',
                },
                {
                  title: '用户名',
                  dataIndex: 'username',
                },
                {
                  title: '邮箱',
                  dataIndex: 'email',
                },
                {
                  title: '全名',
                  dataIndex: 'full_name',
                },
                {
                  title: '状态',
                  dataIndex: 'is_active',
                  valueType: 'switch',
                  valueEnum: {
                    true: { text: '激活', status: 'Success' },
                    false: { text: '未激活', status: 'Error' },
                  },
                },
                {
                  title: '最后登录时间',
                  dataIndex: 'last_login',
                  valueType: 'dateTime',
                },
                {
                  title: '创建时间',
                  dataIndex: 'created_at',
                  valueType: 'dateTime',
                },
                {
                  title: '更新时间',
                  dataIndex: 'updated_at',
                  valueType: 'dateTime',
                },
              ]}
            />
          )}
        </>
      ),
    },
    {
      key: 'settings',
      label: (
        <span>
          <SettingOutlined />
          平台设置
        </span>
      ),
      children: <PlatformSettingsPage />,
    },
  ];

  return (
    <MultiTabListPageTemplate
      activeTabKey={activeTabKey}
      onTabChange={setActiveTabKey}
      tabs={tabItems}
    />
  );
}


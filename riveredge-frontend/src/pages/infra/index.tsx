/**
 * 平台超级管理员管理页面
 *
 * 用于管理平台超级管理员信息（查看、编辑）
 * 平台超级管理员是平台唯一的，只能有一个
 */

import { ProCard, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Space, Modal, message } from 'antd';
import { EditOutlined, LogoutOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getInfraSuperAdmin, 
  updateInfraSuperAdmin,
  type InfraSuperAdmin,
  type InfraSuperAdminUpdateRequest
} from '../../services/infraAdmin';
import { clearAuth } from '../../utils/auth';
import { useNavigate } from 'react-router-dom';
import { useGlobalStore } from '../../stores';
import { useTranslation } from 'react-i18next';
// import InfraSuperAdminForm from './form'; // 暂时注释掉，等待后续实现

/**
 * 平台超级管理员管理页面组件
 */
export default function InfraSuperAdminPage() {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setCurrentUser = useGlobalStore((s) => s.setCurrentUser);
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
      messageApi.success(t('pages.infra.admin.updateSuccess'));
      // setEditModalVisible(false);
      // setEditFormData(null);
      queryClient.invalidateQueries({ queryKey: ['infraSuperAdmin'] });
    },
    onError: (error: any) => {
      messageApi.error(error?.message || t('pages.infra.admin.updateFailed'));
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
      title: t('pages.infra.admin.logoutConfirmTitle'),
      content: t('pages.infra.admin.logoutConfirmContent'),
      onOk: () => {
        // 清除认证信息
        clearAuth();
        // 清除全局状态中的用户信息
        setCurrentUser(undefined);
        // 清除查询缓存
        queryClient.clear();
        messageApi.success(t('pages.infra.admin.logoutSuccess'));
        // ⚠️ 关键修复：使用 navigate 跳转，避免页面刷新
        navigate('/infra/login', { replace: true });
      },
    });
  };

  return (
    <div style={{ padding: '16px' }}>
      <ProCard
        title={t('pages.infra.admin.cardTitle')}
        extra={
          <Space>
            {/* <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={handleEdit}
              loading={isLoading}
            >
              {t('pages.infra.admin.edit')}
            </Button> */}
            <Button
              icon={<LogoutOutlined />}
              onClick={handleLogout}
            >
              {t('pages.infra.admin.logout')}
            </Button>
          </Space>
        }
        loading={isLoading}
      >
        {admin && (
          <ProDescriptions<InfraSuperAdmin>
            column={2}
            dataSource={admin}
            columns={[
              {
                title: t('pages.infra.admin.id'),
                dataIndex: 'id',
              },
              {
                title: t('pages.infra.admin.username'),
                dataIndex: 'username',
              },
              {
                title: t('pages.infra.admin.email'),
                dataIndex: 'email',
              },
              {
                title: t('pages.infra.admin.fullName'),
                dataIndex: 'full_name',
              },
              {
                title: t('pages.infra.admin.status'),
                dataIndex: 'is_active',
                valueType: 'switch',
                valueEnum: {
                  true: { text: t('pages.infra.admin.statusActive'), status: 'Success' },
                  false: { text: t('pages.infra.admin.statusInactive'), status: 'Error' },
                },
              },
              {
                title: t('pages.infra.admin.lastLogin'),
                dataIndex: 'last_login',
                valueType: 'dateTime',
              },
              {
                title: t('pages.infra.admin.createdAt'),
                dataIndex: 'created_at',
                valueType: 'dateTime',
              },
              {
                title: t('pages.infra.admin.updatedAt'),
                dataIndex: 'updated_at',
                valueType: 'dateTime',
              },
            ]}
          />
        )}
      </ProCard>

      {/* 编辑弹窗 - 暂时注释掉，等待后续实现 */}
      {/* <Modal
        title={t('pages.infra.admin.editModalTitle')}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditFormData(null);
        }}
        footer={null}
        size={600}
      >
        {editFormData && (
          <InfraSuperAdminForm
            initialValues={editFormData}
            onSubmit={handleSave}
            onCancel={() => {
              setEditModalVisible(false);
              setEditFormData(null);
            }}
            loading={updateMutation.isPending}
          />
        )}
      </Modal> */}
    </div>
  );
}


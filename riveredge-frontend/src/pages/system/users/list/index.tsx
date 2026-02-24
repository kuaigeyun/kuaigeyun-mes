/**
 * 账户管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的用户账户。
 * 支持用户的 CRUD 操作、导入导出和批量操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormSelect, ProFormSwitch, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Card, List, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined, QrcodeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getUserList,
  getUserByUuid,
  createUser,
  updateUser,
  deleteUser,
  importUsers,
  exportUsers,
  resetUserPassword,
  batchDeleteUsers,
  User,
  CreateUserData,
  UpdateUserData,
} from '../../../../services/user';
import { QRCodeGenerator } from '../../../../components/qrcode';
import { qrcodeApi } from '../../../../services/qrcode';
import { getDepartmentTree, DepartmentTreeItem } from '../../../../services/department';
import { getPositionList } from '../../../../services/position';
import { getRoleList } from '../../../../services/role';

/**
 * 账户管理列表页面组件
 */
const UserListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [positionOptions, setPositionOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [roleOptions, setRoleOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const [roleUuidsDraft, setRoleUuidsDraft] = useState<string[]>([]);
  const formRef = useRef<ProFormInstance>();


  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentUserUuid, setCurrentUserUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<User | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理URL参数（从二维码扫描跳转过来时自动打开详情）
   */
  useEffect(() => {
    const userUuid = searchParams.get('uuid');
    const action = searchParams.get('action');
    
    if (userUuid && action === 'detail') {
      // 自动打开用户详情
      handleView({ uuid: userUuid } as User);
      // 清除URL参数
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  /**
   * 处理批量生成二维码
   */
  const handleBatchGenerateQRCode = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('field.user.selectUsersForQrcode'));
      return;
    }

    try {
      // 通过API获取选中的用户数据
      const users = await Promise.all(
        selectedRowKeys.map(async (key) => {
          try {
            return await getUserByUuid(key as string);
          } catch (error) {
            console.error(`获取用户失败: ${key}`, error);
            return null;
          }
        })
      );
      
      const validUsers = users.filter((user) => user !== null) as User[];

      if (validUsers.length === 0) {
        messageApi.error(t('field.user.cannotGetSelectedUsers'));
        return;
      }

      // 生成二维码
      const qrcodePromises = validUsers.map((user) =>
        qrcodeApi.generateEmployee({
          employee_uuid: user.uuid,
          employee_code: user.username,
          employee_name: user.full_name || user.username,
        })
      );

      const qrcodes = await Promise.all(qrcodePromises);
      messageApi.success(t('field.user.qrcodeGenerateSuccess', { count: qrcodes.length }));
    } catch (error: any) {
      messageApi.error(t('field.user.qrcodeGenerateFailed') + (error.message ? `: ${error.message}` : ''));
    }
  };

  /**
   * 加载选项数据
   */
  useEffect(() => {
    const loadOptions = async () => {
      try {
        // 加载部门选项
        const deptResponse = await getDepartmentTree();
        const buildDeptOptions = (items: DepartmentTreeItem[], level = 0): Array<{ label: string; value: string }> => {
          const options: Array<{ label: string; value: string }> = [];
          items.forEach(item => {
            const prefix = '  '.repeat(level);
            options.push({
              label: `${prefix}${item.name}`,
              value: item.uuid,
            });
            if (item.children && item.children.length > 0) {
              options.push(...buildDeptOptions(item.children, level + 1));
            }
          });
          return options;
        };
        setDepartmentOptions(buildDeptOptions(deptResponse.items));

        // 加载职位选项
        const posResponse = await getPositionList({ page_size: 100 });
        setPositionOptions(posResponse.items.map(pos => ({
          label: pos.name,
          value: pos.uuid,
        })));

        // 加载角色选项
        const roleResponse = await getRoleList({ page_size: 100 });
        setRoleOptions(roleResponse.items.map(role => ({
          label: role.name,
          value: role.uuid,
        })));
      } catch (error) {
        console.error('加载选项数据失败:', error);
      }
    };
    loadOptions();
  }, []);

  /**
   * 处理新建用户
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentUserUuid(null);
    setRoleUuidsDraft([]);
    setFormInitialValues({
      is_active: true,
      is_tenant_admin: false,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑用户
   */
  const handleEdit = async (record: User) => {
    try {
      setIsEdit(true);
      setCurrentUserUuid(record.uuid);
      
      const detail = await getUserByUuid(record.uuid);
      const editRoleUuids = detail.roles?.map(r => r.uuid) || [];
      setRoleUuidsDraft(editRoleUuids);
      setFormInitialValues({
        username: detail.username,
        email: detail.email,
        full_name: detail.full_name,
        phone: detail.phone,
        department_uuid: detail.department_uuid,
        position_uuid: detail.position_uuid,
        role_uuids: editRoleUuids,
        is_active: detail.is_active,
        is_tenant_admin: detail.is_tenant_admin,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('field.user.fetchDetailFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: User) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getUserByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('field.user.fetchDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除用户
   */
  const handleDelete = async (record: User) => {
    try {
      await deleteUser(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  };

  /**
   * 处理批量删除用户
   */
  const handleBatchDelete = async (uuids: React.Key[]) => {
    Modal.confirm({
      title: t('field.user.batchDeleteTitle'),
      content: t('field.user.batchDeleteConfirm', { count: uuids.length }),
      okText: t('common.confirm'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          const result = await batchDeleteUsers(uuids as string[]);
          if (result.failure_count > 0) {
            messageApi.warning(t('field.user.batchDeletePartial', { success: result.success_count, fail: result.failure_count }));
          } else {
            messageApi.success(t('field.user.batchDeleteSuccess', { count: result.success_count }));
          }
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('pages.system.deleteFailed'));
        }
      },
    });
  };

  /**
   * 处理重置密码
   */
  const handleResetPassword = async (record: User) => {
    Modal.confirm({
      title: t('field.user.resetPasswordTitle'),
      content: t('field.user.resetPasswordConfirm', { username: record.username }),
      onOk: async () => {
        try {
          await resetUserPassword(record.uuid);
          messageApi.success(t('field.user.resetPasswordSuccess'));
        } catch (error: any) {
          messageApi.error(error.message || t('field.user.resetPasswordFailed'));
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);

      // 移除确认密码字段，后端不需要这个字段
      const submitData = { ...values };
      delete submitData.confirmPassword;
      if (!submitData.password) {
        delete submitData.password;
      }

      // 规范化角色字段：编辑模式下必须显式携带 role_uuids，否则后端会跳过角色更新
      const latestRoleValue = formRef.current?.getFieldValue?.('role_uuids');
      const draftRoleValue = roleUuidsDraft;
      const rawRoleValue =
        (Array.isArray(draftRoleValue) ? draftRoleValue : undefined) ??
        submitData.role_uuids ??
        latestRoleValue ??
        (isEdit ? formInitialValues?.role_uuids : undefined);
      const normalizedRoleUuids = (Array.isArray(rawRoleValue) ? rawRoleValue : rawRoleValue != null ? [rawRoleValue] : [])
        .map((v: any) => (typeof v === 'string' ? v : v?.value || v?.uuid || ''))
        .filter(Boolean);
      // 编辑时始终携带 role_uuids；新建时仅在有选择时携带
      if (isEdit || normalizedRoleUuids.length > 0 || rawRoleValue !== undefined) {
        submitData.role_uuids = normalizedRoleUuids;
      }

      if (isEdit && currentUserUuid) {
        await updateUser(currentUserUuid, submitData as UpdateUserData);
        messageApi.success(t('pages.system.updateSuccess'));
      } else {
        if (!submitData.password) {
          messageApi.error(t('field.user.passwordRequired'));
          return;
        }
        await createUser(submitData as CreateUserData);
        messageApi.success(t('pages.system.createSuccess'));
      }

      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      // 解析具体的错误信息，提供更友好的提示
      const errorMessage = parseErrorMessage(error);
      messageApi.error(errorMessage);
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 解析错误信息，提供具体的字段级提示
   */
  const parseErrorMessage = (error: any): string => {
    const message = error.message || error.detail || t('pages.system.deleteFailed');

    if (message.includes('用户名') && message.includes('已存在')) {
      return t('field.user.errorUsernameExists');
    }
    if (message.includes('部门不存在') || message.includes('部门')) {
      return t('field.user.errorDepartmentInvalid');
    }
    if (message.includes('职位不存在') || message.includes('职位')) {
      return t('field.user.errorPositionInvalid');
    }
    if (message.includes('角色') && (message.includes('不存在') || message.includes('无效'))) {
      return t('field.user.errorRoleInvalid');
    }
    if (message.includes('手机号') || message.includes('phone')) {
      return t('field.user.errorPhoneInvalid');
    }
    if (message.includes('邮箱') || message.includes('email')) {
      return t('field.user.errorEmailInvalid');
    }
    if (message.includes('权限') || message.includes('permission')) {
      return t('field.user.errorNoPermission');
    }
    return message;
  };

  /**
   * 处理导入数据
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('field.user.importEmpty'));
      return;
    }

    const rows = data.slice(2);
    const nonEmptyRows = rows.filter(row =>
      row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
    );

    if (nonEmptyRows.length === 0) {
      messageApi.warning(t('field.user.importNoRows'));
      return;
    }

    try {
      const result = await importUsers(data);
      
      Modal.info({
        title: t('field.user.importComplete'),
        width: 600,
        content: (
          <div>
            <p>{t('field.user.importSuccessCount', { count: result.success_count })}</p>
            <p>{t('field.user.importFailCount', { count: result.failure_count })}</p>
            {result.errors.length > 0 && (
              <List
                size="small"
                dataSource={result.errors}
                renderItem={(item) => (
                  <List.Item>
                    <Typography.Text type="danger">
                      {t('field.user.importErrorRow', { row: item.row, message: item.message })}
                    </Typography.Text>
                  </List.Item>
                )}
              />
            )}
          </div>
        ),
      });

      if (result.success_count > 0) {
        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error.message || t('field.user.importFailed'));
    }
  };

  /**
   * 处理导出数据
   */
  const handleExport = async (params: any) => {
    try {
      const blob = await exportUsers(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_${new Date().getTime()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      messageApi.success(t('field.user.exportSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('field.user.exportFailed'));
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<User>[] = [
    {
      title: t('field.user.username'),
      dataIndex: 'username',
      width: 150,
      fixed: 'left',
      sorter: true,
    },
    {
      title: t('field.user.fullName'),
      dataIndex: 'full_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: t('field.user.department'),
      dataIndex: 'department_uuid',
      width: 150,
      ellipsis: true,
      valueType: 'select',
      fieldProps: {
        options: departmentOptions,
        showSearch: true,
      },
      render: (_, record) => record.department?.name || '-',
    },
    {
      title: t('field.user.position'),
      dataIndex: 'position_uuid',
      width: 120,
      ellipsis: true,
      valueType: 'select',
      fieldProps: {
        options: positionOptions,
      },
      render: (_, record) => record.position?.name || '-',
    },
    {
      title: t('field.user.roles'),
      dataIndex: 'roles',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => (
        <Space size={4} wrap>
          {record.roles?.map(role => (
            <Tag key={role.uuid} color="blue">{role.name}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('field.user.phone'),
      dataIndex: 'phone',
      width: 130,
      ellipsis: true,
    },
    {
      title: t('field.user.email'),
      dataIndex: 'email',
      width: 180,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.user.isTenantAdmin'),
      dataIndex: 'is_tenant_admin',
      width: 120,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.customField.yes'), status: 'Warning' },
        false: { text: t('field.customField.no'), status: 'Default' },
      },
      hideInTable: true,
      render: (_, record) => (
        <Tag color={record.is_tenant_admin ? 'gold' : 'default'}>
          {record.is_tenant_admin ? t('field.customField.yes') : t('field.customField.no')}
        </Tag>
      ),
    },
    {
      title: t('field.user.status'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.systemParameter.enabled'), status: 'Success' },
        false: { text: t('field.systemParameter.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('field.systemParameter.enabled') : t('field.systemParameter.disabled')}
        </Tag>
      ),
    },
    {
      title: t('field.user.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('field.user.updatedAt'),
      dataIndex: 'updated_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('field.user.lastLogin'),
      dataIndex: 'last_login',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            {t('field.user.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('field.user.edit')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => handleResetPassword(record)}
          >
            {t('field.user.reset')}
          </Button>
          <Popconfirm
            title={t('field.user.deleteConfirm')}
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              {t('field.user.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemProps<User>[] = [
    { title: t('field.user.username'), dataIndex: 'username' },
    { title: t('field.user.email'), dataIndex: 'email' },
    { title: t('field.user.fullName'), dataIndex: 'full_name' },
    { title: t('field.user.phone'), dataIndex: 'phone' },
    {
      title: t('field.user.department'),
      dataIndex: ['department', 'name'],
      render: (_: any, record: User) => record?.department?.name || '-'
    },
    {
      title: t('field.user.position'),
      dataIndex: ['position', 'name'],
      render: (_: any, record: User) => record?.position?.name || '-'
    },
    {
      title: t('field.user.roles'),
      dataIndex: 'roles',
      span: 2,
      render: (_: any, record: User) => (
        <Space>
          {record?.roles?.map(role => (
            <Tag key={role.uuid}>{role.name}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('field.user.status'),
      dataIndex: 'is_active',
      render: (_: any, record: User) => (record?.is_active ? t('field.systemParameter.enabled') : t('field.systemParameter.disabled')),
    },
    {
      title: t('field.user.isTenantAdmin'),
      dataIndex: 'is_tenant_admin',
      render: (_: any, record: User) => (record?.is_tenant_admin ? t('field.customField.yes') : t('field.customField.no')),
    },
    { title: t('field.user.lastLogin'), dataIndex: 'last_login', valueType: 'dateTime' },
    { title: t('field.user.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    { title: t('field.user.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<User>
        viewTypes={['table', 'help']}
        actionRef={actionRef}
        columns={columns}
        request={async (params, _, __, searchFormValues) => {
            const response = await getUserList({
              page: params.current || 1,
              page_size: params.pageSize || 20,
              keyword: searchFormValues?.keyword,
              username: searchFormValues?.username,
              email: searchFormValues?.email,
              full_name: searchFormValues?.full_name,
              phone: searchFormValues?.phone,
              department_uuid: searchFormValues?.department_uuid,
              position_uuid: searchFormValues?.position_uuid,
              is_active: searchFormValues?.is_active,
              is_tenant_admin: searchFormValues?.is_tenant_admin,
            });
          return {
            data: response.items,
            success: true,
            total: response.total,
          };
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        toolBarRender={() => [
          <Button
            key="batch-qrcode"
            icon={<QrcodeOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchGenerateQRCode}
          >
            {t('field.user.batchQrcode')}
          </Button>,
        ]}
        showImportButton={true}
        onImport={handleImport}
        showExportButton={true}
        onExport={handleExport}
        showCreateButton
        createButtonText={t('field.user.createButton')}
        onCreate={handleCreate}
        showDeleteButton={true}
        deleteButtonText={t('field.user.batchDeleteButton')}
        onDelete={handleBatchDelete}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? t('field.user.editTitle') : t('field.user.createTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
          setRoleUuidsDraft([]);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        formRef={formRef}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <ProFormText
          name="username"
          label={t('field.user.username')}
          rules={[
            { required: true, message: t('field.user.usernameRequired') },
            { min: 3, message: t('field.user.usernameMin') },
            { max: 50, message: t('field.user.usernameMax') },
            { pattern: /^[a-zA-Z0-9_-]+$/, message: t('field.user.usernamePattern') }
          ]}
          placeholder={t('field.user.usernamePlaceholder')}
          disabled={isEdit}
          fieldProps={{
            autoComplete: 'off'
          }}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="full_name"
          label={t('field.user.fullName')}
          rules={[
            { max: 100, message: t('field.user.fullNameMax') }
          ]}
          placeholder={t('field.user.fullNamePlaceholder')}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="phone"
          label={t('field.user.phone')}
          rules={[
            { required: true, message: t('field.user.phoneRequired') },
            { pattern: /^1[3-9]\d{9}$/, message: t('field.user.phonePattern') }
          ]}
          placeholder={t('field.user.phonePlaceholder')}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="email"
          label={t('field.user.email')}
          rules={[
            { type: 'email', message: t('field.user.emailInvalid') }
          ]}
          placeholder={t('field.user.emailPlaceholder')}
          fieldProps={{ autoComplete: 'email' }}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="password"
          label={t('field.user.password')}
          rules={isEdit ? [] : [
            { required: true, message: t('field.user.passwordRequiredPlaceholder') },
            { min: 8, message: t('field.user.passwordMin') },
            { max: 128, message: t('field.user.passwordMax') }
          ]}
          placeholder={isEdit ? t('field.user.passwordPlaceholderEdit') : t('field.user.passwordPlaceholder')}
          fieldProps={{
            type: 'password',
            autoComplete: 'new-password'
          }}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="confirmPassword"
          label={t('field.user.confirmPassword')}
          rules={isEdit ? [] : [
            { required: true, message: t('field.user.confirmPasswordRequired') },
            { min: 8, message: t('field.user.passwordMin') },
            { max: 128, message: t('field.user.passwordMax') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t('field.user.passwordMismatch')));
              },
            }),
          ]}
          placeholder={isEdit ? t('field.user.passwordPlaceholderEdit') : t('field.user.confirmPasswordPlaceholder')}
          fieldProps={{
            type: 'password',
            autoComplete: 'new-password'
          }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="department_uuid"
          label={t('field.user.department')}
          placeholder={t('field.user.departmentPlaceholder')}
          allowClear
          options={departmentOptions}
          fieldProps={{ showSearch: true }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="position_uuid"
          label={t('field.user.position')}
          placeholder={t('field.user.positionPlaceholder')}
          options={positionOptions}
          fieldProps={{
            showSearch: true,
          }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="role_uuids"
          label={t('field.user.roles')}
          placeholder={t('field.user.rolesPlaceholder')}
          options={roleOptions}
          fieldProps={{
            mode: 'multiple',
            showSearch: true,
            onChange: (value: any) => {
              const next = (Array.isArray(value) ? value : [value])
                .map((v: any) => (typeof v === 'string' ? v : v?.value || v?.uuid || ''))
                .filter(Boolean);
              setRoleUuidsDraft(next);
            },
          }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch
          name="is_active"
          label={t('field.user.isActiveLabel')}
          colProps={{ span: 12 }}
        />
        <ProFormSwitch
          name="is_tenant_admin"
          label={t('field.user.isTenantAdminLabel')}
          colProps={{ span: 12 }}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<User>
        title={t('field.user.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData || undefined}
        columns={detailColumns}
      >
        {detailData && (
          <div style={{ marginTop: 24 }}>
            <Card title={t('field.user.qrcodeCardTitle')}>
              <QRCodeGenerator
                qrcodeType="EMP"
                data={{
                  employee_uuid: detailData.uuid,
                  employee_code: detailData.username,
                  employee_name: detailData.full_name || detailData.username,
                }}
                autoGenerate={true}
              />
            </Card>
          </div>
        )}
      </DetailDrawerTemplate>
    </>
  );
};

export default UserListPage;

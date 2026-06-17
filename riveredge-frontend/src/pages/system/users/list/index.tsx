/**
 * 账户管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的用户账户。
 * 支持用户的 CRUD 操作、导入导出和批量操作。
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Descriptions, List, Modal, Popconfirm, Space, Tag, Typography, theme } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined, QrcodeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { flushDrawerOpen, DRAWER_CONFIG, ListPageTemplate } from '../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../components/uni-detail';
import {
  getUserList,
  getUserByUuid,
  deleteUser,
  importUsers,
  previewUserImport,
  UserImportPreviewResult,
  exportUsers,
  resetUserPassword,
  batchDeleteUsers,
  User,
} from '../../../../services/user';
import { QRCodeGenerator } from '../../../../components/qrcode';
import { qrcodeApi } from '../../../../services/qrcode';
import { getUserFormCoreReferenceOptions } from '../userFormReferenceOptions';
import { rowActionKind, rowActionResetPassword, rowActionToneDestructive } from '../../../../components/uni-action';
import { UserFormModal } from '../components/UserFormModal';
import {
  resolvePresetDepartmentName,
  resolvePresetPositionName,
  resolvePresetRoleName,
} from '../../../../utils/presetEntityI18n';
import { downloadFile } from '../../../../utils';

/**
 * 账户管理列表页面组件
 */
const UserListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [positionOptions, setPositionOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [roleOptions, setRoleOptions] = useState<Array<{ label: string; value: string }>>([]);
  const userDetailReqRef = useRef(0);

  const [userFormOpen, setUserFormOpen] = useState(false);
  const [userEditUuid, setUserEditUuid] = useState<string | null>(null);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<User | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleOpenRoleEdit = useCallback((roleUuid: string) => {
    navigate(`/system/roles?uuid=${encodeURIComponent(roleUuid)}&action=edit`);
  }, [navigate]);

  /**
   * 处理查看详情
   */
  const handleView = useCallback(async (record: User) => {
    const req = ++userDetailReqRef.current;
    flushDrawerOpen(() => {
      setDrawerVisible(true);
      setDetailData(null);
      setDetailLoading(true);
    });
    try {
      const detail = await getUserByUuid(record.uuid);
      if (userDetailReqRef.current !== req) return;
      setDetailData(detail);
    } catch (error: any) {
      if (userDetailReqRef.current === req) {
        messageApi.error(error.message || t('field.user.fetchDetailFailed'));
      }
    } finally {
      if (userDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  }, [messageApi, t]);

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
            if (typeof window !== 'undefined') {
              window.console.error(`获取用户失败: ${key}`, error);
            }
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

  const loadReferenceOptions = useCallback(async () => {
    try {
      const core = await getUserFormCoreReferenceOptions(t);
      setDepartmentOptions(core.departmentOptions);
      setPositionOptions(core.positionOptions);
      setRoleOptions(core.roleOptions);
    } catch (error) {
      if (typeof window !== 'undefined') {
        window.console.error('加载选项数据失败:', error);
      }
    }
  }, [t]);

  useEffect(() => {
    loadReferenceOptions();
  }, [loadReferenceOptions]);

  useEffect(() => {
    const refresh = () => {
      void loadReferenceOptions();
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [loadReferenceOptions]);

  const handleCreate = () => {
    setUserEditUuid(null);
    setUserFormOpen(true);
  };

  const handleEdit = useCallback((record: User) => {
    setUserEditUuid(record.uuid);
    setUserFormOpen(true);
  }, []);

  /**
   * 处理URL参数（从二维码扫描跳转过来时自动打开详情；从外部链接跳转时打开编辑）
   */
  useEffect(() => {
    const userUuid = searchParams.get('uuid');
    const action = searchParams.get('action');

    if (!userUuid) return;

    if (action === 'detail') {
      window.setTimeout(() => {
        handleView({ uuid: userUuid } as User);
      }, 0);
      setSearchParams({}, { replace: true });
      return;
    }

    if (action === 'edit') {
      window.setTimeout(() => {
        setUserEditUuid(userUuid);
        setUserFormOpen(true);
      }, 0);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, handleView]);

  /**
   * 处理删除用户
   */
  const handleDelete = useCallback(async (record: User) => {
    try {
      await deleteUser(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  }, [messageApi, t]);

  /**
   * 处理批量删除用户
   */
  const handleBatchDelete = async (uuids: React.Key[]) => {
    if (!uuids.length) return;
    try {
      const result = await batchDeleteUsers(uuids as string[]);
      if (result.failure_count > 0) {
        const reasonHint =
          result.errors?.length > 0
            ? `：${result.errors
                .slice(0, 3)
                .map((e) => e.message)
                .join('；')}${result.errors.length > 3 ? '…' : ''}`
            : '';
        messageApi.warning(
          t('field.user.batchDeletePartial', {
            success: result.success_count,
            fail: result.failure_count,
          }) + reasonHint,
        );
      } else {
        messageApi.success(t('field.user.batchDeleteSuccess', { count: result.success_count }));
      }
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.deleteFailed'));
    }
  };

  /**
   * 处理重置密码
   */
  const handleResetPassword = useCallback(async (record: User) => {
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
  }, [messageApi, t]);

  const showImportResult = (result: Awaited<ReturnType<typeof importUsers>>) => {
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
  };

  const renderMissingRefsContent = (preview: UserImportPreviewResult) => (
    <div>
      <p>{t('field.user.importMissingRefsHint')}</p>
      {preview.missing_departments.length > 0 && (
        <p>{t('field.user.importMissingDepartments', { names: preview.missing_departments.join('、') })}</p>
      )}
      {preview.missing_positions.length > 0 && (
        <p>{t('field.user.importMissingPositions', { names: preview.missing_positions.join('、') })}</p>
      )}
      {preview.missing_roles.length > 0 && (
        <p>{t('field.user.importMissingRoles', { names: preview.missing_roles.join('、') })}</p>
      )}
    </div>
  );

  const handleImportPrecheck = useCallback(async (data: any[][]) => {
    const preview = await previewUserImport(data);
    const warnings: string[] = [];
    if (preview.has_missing) {
      warnings.push(t('field.user.importMissingRefsHint'));
    }
    if (preview.missing_departments.length > 0) {
      warnings.push(
        t('field.user.importMissingDepartments', { names: preview.missing_departments.join('、') }),
      );
    }
    if (preview.missing_positions.length > 0) {
      warnings.push(
        t('field.user.importMissingPositions', { names: preview.missing_positions.join('、') }),
      );
    }
    if (preview.missing_roles.length > 0) {
      warnings.push(t('field.user.importMissingRoles', { names: preview.missing_roles.join('、') }));
    }
    return { canImport: true, warnings: warnings.length ? warnings : undefined };
  }, [t]);

  const runUserImport = async (data: any[][], autoCreateReferences: boolean) => {
    const result = await importUsers(data, { autoCreateReferences });
    showImportResult(result);
    if (result.success_count > 0) {
      actionRef.current?.reload();
      if (autoCreateReferences) {
        await loadReferenceOptions();
      }
    }
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
      const preview = await previewUserImport(data);
      if (preview.has_missing) {
        Modal.confirm({
          title: t('field.user.importMissingRefsTitle'),
          width: 560,
          content: renderMissingRefsContent(preview),
          cancelText: t('field.user.importFixTemplate'),
          okText: t('field.user.importAutoCreate'),
          onOk: () => runUserImport(data, true),
        });
        return;
      }
      await runUserImport(data, false);
    } catch (error: any) {
      messageApi.error(error.message || t('field.user.importFailed'));
    }
  };

  /**
   * 处理导出数据
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: User[],
  ) => {
    const escapeCsvCell = (value: unknown) => {
      const s = String(value ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const exportUsersToCsv = (users: User[]) => {
      const headers = [
        t('field.user.username'),
        t('field.user.email'),
        t('field.user.fullName'),
        t('field.user.phone'),
        t('field.user.department'),
        t('field.user.position'),
        t('field.user.roles'),
        t('field.role.status'),
        t('field.user.isTenantAdmin'),
        t('field.user.lastLogin'),
        t('field.user.createdAt'),
      ];
      const csvRows = [headers.join(',')];
      users.forEach((user) => {
        const row = [
          user.username || '',
          user.email || '',
          user.full_name || '',
          user.phone || '',
          user.department ? resolvePresetDepartmentName(user.department, t) : '',
          user.position ? resolvePresetPositionName(user.position, t) : '',
          user.roles?.map((role) => resolvePresetRoleName(role, t)).join(', ') || '',
          user.is_active ? t('field.role.enabled') : t('field.role.disabled'),
          user.is_tenant_admin ? t('field.customField.yes') : t('field.customField.no'),
          user.last_login ? new Date(user.last_login).toLocaleString() : '',
          user.created_at ? new Date(user.created_at).toLocaleString() : '',
        ];
        csvRows.push(row.map(escapeCsvCell).join(','));
      });
      const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
      downloadFile(blob, `users_${new Date().toISOString().slice(0, 10)}.csv`);
    };

    try {
      if (type === 'all') {
        const blob = await exportUsers();
        downloadFile(blob, `users_${new Date().toISOString().slice(0, 10)}.csv`);
      } else {
        let toExport: User[] = [];
        if (type === 'selected' && selectedRowKeys?.length && currentPageData) {
          toExport = currentPageData.filter((user) => selectedRowKeys.includes(user.uuid));
        } else if (type === 'currentPage' && currentPageData?.length) {
          toExport = currentPageData;
        }
        if (toExport.length === 0) {
          messageApi.warning(t('app.master-data.noExportData'));
          return;
        }
        exportUsersToCsv(toExport);
      }
      messageApi.success(t('field.user.exportSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('field.user.exportFailed'));
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<User>[] = React.useMemo(() => [
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
      render: (_, record) =>
        record.department ? resolvePresetDepartmentName(record.department, t) : '-',
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
      render: (_, record) =>
        record.position ? resolvePresetPositionName(record.position, t) : '-',
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
            <Tag
              key={role.uuid}
              color="blue"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenRoleEdit(role.uuid);
              }}
            >
              {resolvePresetRoleName(role, t)}
            </Tag>
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
      fixed: 'right',
      render: (_, record) => [
            <Button
              key="view"
              {...rowActionKind('read')}
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              {t('field.user.view')}
            </Button>,
            <Button
              key="edit"
              {...rowActionKind('update')}
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              {t('field.user.edit')}
            </Button>,
            <Popconfirm key="delete" {...rowActionKind('delete')} title={t('field.user.deleteConfirm')} onConfirm={() => handleDelete(record)}>
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                {t('field.user.delete')}
              </Button>
            </Popconfirm>,
            <Button
              key="reset"
              {...rowActionResetPassword('update')}
              {...rowActionToneDestructive()}
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleResetPassword(record)}
            >
              {t('field.user.reset')}
            </Button>,
          ],
    },
  ], [t, departmentOptions, positionOptions, handleView, handleEdit, handleResetPassword, handleDelete, handleOpenRoleEdit]);

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemProps<User>[] = React.useMemo(() => [
    { title: t('field.user.username'), dataIndex: 'username' },
    { title: t('field.user.email'), dataIndex: 'email' },
    { title: t('field.user.fullName'), dataIndex: 'full_name' },
    { title: t('field.user.phone'), dataIndex: 'phone' },
    {
      title: t('field.user.department'),
      dataIndex: ['department', 'name'],
      render: (_: unknown, record: User) =>
        record?.department ? resolvePresetDepartmentName(record.department, t) : '-',
    },
    {
      title: t('field.user.position'),
      dataIndex: ['position', 'name'],
      render: (_: unknown, record: User) =>
        record?.position ? resolvePresetPositionName(record.position, t) : '-',
    },
    {
      title: t('field.user.roles'),
      dataIndex: 'roles',
      span: 2,
      render: (_: unknown, record: User) => (
        <Space>
          {record?.roles?.map(role => (
            <Tag
              key={role.uuid}
              color="blue"
              style={{ cursor: 'pointer' }}
              onClick={() => handleOpenRoleEdit(role.uuid)}
            >
              {resolvePresetRoleName(role, t)}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('field.user.status'),
      dataIndex: 'is_active',
      render: (_: any, record: User) => (
        <Tag color={record?.is_active ? 'success' : 'default'}>
          {record?.is_active ? t('field.systemParameter.enabled') : t('field.systemParameter.disabled')}
        </Tag>
      ),
    },
    {
      title: t('field.user.isTenantAdmin'),
      dataIndex: 'is_tenant_admin',
      render: (_: any, record: User) => (
        <Tag color={record?.is_tenant_admin ? 'blue' : 'default'}>
          {record?.is_tenant_admin ? t('field.customField.yes') : t('field.customField.no')}
        </Tag>
      ),
    },
    { title: t('field.user.lastLogin'), dataIndex: 'last_login', valueType: 'dateTime' },
    { title: t('field.user.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    { title: t('field.user.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
  ], [t, handleOpenRoleEdit]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<User>
        columnPersistenceId="pages.system.users.list"
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
        showCreateButton
        createButtonText={t('field.user.createButton')}
        onCreate={handleCreate}
        enableRowSelection
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton={true}
        deleteButtonText={t('field.user.batchDeleteButton')}
        deleteConfirmTitle={t('field.user.batchDeleteConfirmTitle')}
        deleteConfirmDescription={(c) => t('field.user.batchDeleteConfirmDescription', { count: c })}
        onDelete={handleBatchDelete}
        showImportButton={true}
        onImport={handleImport}
        onImportPrecheck={handleImportPrecheck}
        importHeaders={[
          `*${t('field.user.username')}`,
          `*${t('field.user.password')}`,
          t('field.user.fullName'),
          t('field.user.department'),
          t('field.user.position'),
          t('field.user.roles'),
          t('field.user.phone'),
          t('field.user.email'),
        ]}
        importExampleRow={[
          'user001',
          'Password123',
          t('components.uniTable.exampleField', { title: t('field.user.fullName') }),
          t('components.uniTable.exampleValue'),
          t('components.uniTable.exampleValue'),
          t('components.uniTable.exampleValue'),
          '13800138000',
          'user@example.com',
        ]}
        importFieldMap={{
          [t('field.user.username')]: 'username',
          [`*${t('field.user.username')}`]: 'username',
          'username': 'username',
          '*username': 'username',
          [t('field.user.password')]: 'password',
          [`*${t('field.user.password')}`]: 'password',
          'password': 'password',
          '*password': 'password',
          '密码': 'password',
          '*密码': 'password',
          [t('field.user.fullName')]: 'full_name',
          'full_name': 'full_name',
          '姓名': 'full_name',
          [t('field.user.department')]: 'department',
          'department': 'department',
          '部门': 'department',
          [t('field.user.position')]: 'position',
          'position': 'position',
          '职位': 'position',
          [t('field.user.roles')]: 'roles',
          'roles': 'roles',
          '角色': 'roles',
          [t('field.user.phone')]: 'phone',
          'phone': 'phone',
          '手机号': 'phone',
          [t('field.user.email')]: 'email',
          'email': 'email',
          '邮箱': 'email',
        }}
        importFieldRules={{
          username: { required: true },
          password: {
            required: true,
            validator: (value: any) => {
              const str = value ? String(value).trim() : '';
              if (!str) return t('field.user.passwordRequiredPlaceholder');
              if (str.length < 8) return t('field.user.passwordMin');
              if (str.length > 128) return t('field.user.passwordMax');
              return true;
            },
          },
        }}
        showExportButton={true}
        onExport={handleExport}
        toolBarActionsAfterBatch={[
          <Button {...rowActionKind('read')}
            key="batch-qrcode"
            icon={<QrcodeOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchGenerateQRCode}
          >
            {t('field.user.batchQrcode')}
          </Button>,
        ]}
        />
      </ListPageTemplate>

      <UserFormModal
        open={userFormOpen}
        editUuid={userEditUuid}
        onClose={() => {
          setUserFormOpen(false);
          setUserEditUuid(null);
        }}
        onSuccess={() => {
          actionRef.current?.reload();
          void loadReferenceOptions();
        }}
      />

      {/* 详情 Drawer */}
      <UniDetail
        title={t('field.user.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        styles={{ body: { position: 'relative' } }}
        basic={
          detailData ? (
            <div style={{ position: 'relative', paddingRight: 8 }}>
              <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns, detailData)} />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 152,
                  zIndex: 10,
                  background: '#fff',
                  padding: '12px',
                  borderRadius: token.borderRadiusLG,
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <QRCodeGenerator
                  qrcodeType="EMP"
                  data={{
                    employee_uuid: detailData.uuid,
                    employee_code: detailData.username,
                    employee_name: detailData.full_name || detailData.username,
                  }}
                  autoGenerate={true}
                  showCardTitle={false}
                  size={6}
                  noCard={true}
                />
              </div>
            </div>
          ) : null
        }
      />
    </>
  );
};

export default UserListPage;

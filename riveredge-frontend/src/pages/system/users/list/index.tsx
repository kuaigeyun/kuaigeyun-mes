/**
 * 账户管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的用户账户。
 * 支持用户的 CRUD 操作、导入导出和批量操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProFormText, ProFormSelect, ProFormSwitch, ProFormTreeSelect, ProDescriptionsItemProps } from '@ant-design/pro-components';
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
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [deptTreeData, setDeptTreeData] = useState<DepartmentTreeItem[]>([]);
  const [positionOptions, setPositionOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [roleOptions, setRoleOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);


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
      messageApi.warning('请先选择要生成二维码的用户');
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
        messageApi.error('无法获取选中的用户数据');
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
      messageApi.success(`成功生成 ${qrcodes.length} 个人员二维码`);
      
      // TODO: 可以打开一个Modal显示所有二维码，或者提供下载功能
    } catch (error: any) {
      messageApi.error(`批量生成二维码失败: ${error.message || '未知错误'}`);
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
        // 缓存树数据用于选择
        setDeptTreeData(deptResponse.items);
        
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
        // setDepartmentOptions(buildDeptOptions(deptResponse.items));

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
      setFormInitialValues({
        username: detail.username,
        email: detail.email,
        full_name: detail.full_name,
        phone: detail.phone,
        department_uuid: detail.department_uuid,
        position_uuid: detail.position_uuid,
        role_uuids: detail.roles?.map(r => r.uuid) || [],
        is_active: detail.is_active,
        is_tenant_admin: detail.is_tenant_admin,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取用户详情失败');
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
      messageApi.error(error.message || '获取用户详情失败');
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
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除用户
   */
  const handleBatchDelete = async (uuids: React.Key[]) => {
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${uuids.length} 个用户吗？`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await batchDeleteUsers(uuids as string[]);
          if (result.failure_count > 0) {
            messageApi.warning(`删除完成：成功 ${result.success_count} 条，失败 ${result.failure_count} 条`);
          } else {
            messageApi.success(`成功删除 ${result.success_count} 条记录`);
          }
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败');
        }
      },
    });
  };

  /**
   * 处理重置密码
   */
  const handleResetPassword = async (record: User) => {
    Modal.confirm({
      title: '重置密码',
      content: `确定要重置用户 "${record.username}" 的密码吗？`,
      onOk: async () => {
        try {
          await resetUserPassword(record.uuid);
          messageApi.success('密码重置成功');
        } catch (error: any) {
          messageApi.error(error.message || '密码重置失败');
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

      if (isEdit && currentUserUuid) {
        await updateUser(currentUserUuid, submitData as UpdateUserData);
        messageApi.success('更新成功');
      } else {
        if (!submitData.password) {
          messageApi.error('新建用户必须设置密码');
          return;
        }
        await createUser(submitData as CreateUserData);
        messageApi.success('创建成功');
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
    const message = error.message || error.detail || '操作失败';

    // 解析用户名相关错误
    if (message.includes('用户名') && message.includes('已存在')) {
      return '用户名已被使用，请更换其他用户名';
    }

    // 解析部门相关错误
    if (message.includes('部门不存在') || message.includes('部门')) {
      return '选择的部门不存在或不属于当前组织，请重新选择';
    }

    // 解析职位相关错误
    if (message.includes('职位不存在') || message.includes('职位')) {
      return '选择的职位不存在或不属于当前组织，请重新选择';
    }

    // 解析角色相关错误
    if (message.includes('角色') && (message.includes('不存在') || message.includes('无效'))) {
      return '选择的角色不存在或无效，请重新选择';
    }

    // 解析手机号相关错误
    if (message.includes('手机号') || message.includes('phone')) {
      return '手机号格式不正确或已被使用，请检查后重新输入';
    }

    // 解析邮箱相关错误
    if (message.includes('邮箱') || message.includes('email')) {
      return '邮箱格式不正确或已被使用，请检查后重新输入';
    }

    // 解析权限相关错误
    if (message.includes('权限') || message.includes('permission')) {
      return '您没有权限执行此操作，请联系管理员';
    }

    // 其他情况返回原始错误信息
    return message;
  };

  /**
   * 处理导入数据
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning('导入数据为空');
      return;
    }

    // 跳过表头和示例数据行，从第3行开始
    const rows = data.slice(2);
    const nonEmptyRows = rows.filter(row => 
      row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
    );

    if (nonEmptyRows.length === 0) {
      messageApi.warning('没有可导入的数据行');
      return;
    }

    try {
      const result = await importUsers(data);
      
      Modal.info({
        title: '导入完成',
        width: 600,
        content: (
          <div>
            <p>成功：{result.success_count} 条</p>
            <p>失败：{result.failure_count} 条</p>
            {result.errors.length > 0 && (
              <List
                size="small"
                dataSource={result.errors}
                renderItem={(item) => (
                  <List.Item>
                    <Typography.Text type="danger">
                      第 {item.row} 行：{item.message}
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
      messageApi.error(error.message || '导入失败');
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
      messageApi.success('导出成功');
    } catch (error: any) {
      messageApi.error(error.message || '导出失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<User>[] = [
    {
      title: '用户名',
      dataIndex: 'username',
      width: 150,
      fixed: 'left',
      sorter: true,
    },
    {
      title: '姓名',
      dataIndex: 'full_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '部门',
      dataIndex: 'department_uuid',
      width: 150,
      ellipsis: true,
      valueType: 'treeSelect',
      fieldProps: {
        treeData: deptTreeData,
        fieldNames: { label: 'name', value: 'uuid' },
      },
      render: (_, record) => record.department?.name || '-',
    },
    {
      title: '职位',
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
      title: '角色',
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
      title: '手机号',
      dataIndex: 'phone',
      width: 130,
      ellipsis: true,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 180,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '组织管理员',
      dataIndex: 'is_tenant_admin',
      width: 120,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Warning' },
        false: { text: '否', status: 'Default' },
      },
      hideInTable: true,
      render: (_, record) => (
        <Tag color={record.is_tenant_admin ? 'gold' : 'default'}>
          {record.is_tenant_admin ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '最后登录',
      dataIndex: 'last_login',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '操作',
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
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => handleResetPassword(record)}
          >
            重置
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              删除
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
    { title: '用户名', dataIndex: 'username' },
    { title: '邮箱', dataIndex: 'email' },
    { title: '姓名', dataIndex: 'full_name' },
    { title: '手机号', dataIndex: 'phone' },
    { 
      title: '部门', 
      dataIndex: ['department', 'name'], 
      render: (_: any, record: User) => record?.department?.name || '-' 
    },
    { 
      title: '职位', 
      dataIndex: ['position', 'name'], 
      render: (_: any, record: User) => record?.position?.name || '-' 
    },
    {
      title: '角色',
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
      title: '状态',
      dataIndex: 'is_active',
      render: (_: any, record: User) => (record?.is_active ? '启用' : '禁用'),
    },
    {
      title: '组织管理员',
      dataIndex: 'is_tenant_admin',
      render: (_: any, record: User) => (record?.is_tenant_admin ? '是' : '否'),
    },
    { title: '最后登录', dataIndex: 'last_login', valueType: 'dateTime' },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
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
            批量生成二维码
          </Button>,
        ]}
        showImportButton={true}
        onImport={handleImport}
        showExportButton={true}
        onExport={handleExport}
        showCreateButton
        createButtonText="新建用户"
        onCreate={handleCreate}
        showDeleteButton={true}
        deleteButtonText="批量删除"
        onDelete={handleBatchDelete}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑用户' : '新建用户'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <ProFormText
          name="username"
          label="用户名"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, message: '用户名长度不能少于3个字符' },
            { max: 50, message: '用户名长度不能超过50个字符' },
            { pattern: /^[a-zA-Z0-9_-]+$/, message: '用户名只能包含字母、数字、下划线和连字符' }
          ]}
          placeholder="请输入用户名（3-50个字符）"
          disabled={isEdit}
          fieldProps={{
            autoComplete: 'off'
          }}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="full_name"
          label="姓名"
          rules={[
            { max: 100, message: '姓名长度不能超过100个字符' }
          ]}
          placeholder="请输入姓名"
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="phone"
          label="手机号"
          rules={[
            { required: true, message: '请输入手机号' },
            { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的11位中国大陆手机号（以1开头）' }
          ]}
          placeholder="请输入手机号"
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="email"
          label="邮箱"
          rules={[
            { type: 'email', message: '请输入正确的邮箱地址' }
          ]}
          placeholder="请输入邮箱（可选）"
          fieldProps={{ autoComplete: 'email' }}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="password"
          label="密码"
          rules={isEdit ? [] : [
            { required: true, message: '请输入密码' },
            { min: 8, message: '密码长度不能少于8个字符' },
            { max: 128, message: '密码长度不能超过128个字符' }
          ]}
          placeholder={isEdit ? '留空则不修改密码' : '请输入密码（8-128个字符）'}
          fieldProps={{
            type: 'password',
            autoComplete: 'new-password'
          }}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="confirmPassword"
          label="确认密码"
          rules={isEdit ? [] : [
            { required: true, message: '请再次输入密码' },
            { min: 8, message: '密码长度不能少于8个字符' },
            { max: 128, message: '密码长度不能超过128个字符' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
          placeholder={isEdit ? '留空则不修改密码' : '请再次输入密码（8-128个字符）'}
          fieldProps={{
            type: 'password',
            autoComplete: 'new-password'
          }}
          colProps={{ span: 12 }}
        />
        <ProFormTreeSelect
          name="department_uuid"
          label="部门"
          placeholder="请选择部门"
          allowClear
          fieldProps={{
            showSearch: true,
            filterTreeNode: true,
            treeNodeFilterProp: 'name',
            fieldNames: {
              label: 'name',
              value: 'uuid',
              children: 'children',
            },
            treeData: deptTreeData,
            // treeDefaultExpandAll: true,
          }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="position_uuid"
          label="职位"
          placeholder="请选择职位"
          options={positionOptions}
          fieldProps={{
            showSearch: true,
          }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="role_uuids"
          label="角色"
          placeholder="请选择角色"
          options={roleOptions}
          fieldProps={{
            mode: 'multiple',
            showSearch: true,
          }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch
          name="is_active"
          label="是否启用"
          colProps={{ span: 12 }}
        />
        <ProFormSwitch
          name="is_tenant_admin"
          label="是否组织管理员"
          colProps={{ span: 12 }}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<User>
        title="用户详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData || undefined}
        columns={detailColumns}
      >
        {detailData && (
          <div style={{ marginTop: 24 }}>
            <Card title="人员二维码">
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


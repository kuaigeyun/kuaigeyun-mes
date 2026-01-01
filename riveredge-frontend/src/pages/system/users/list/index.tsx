/**
 * 账户管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的用户账户。
 * 支持用户的 CRUD 操作、导入导出和批量操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormSelect, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, Progress, List, Typography, AutoComplete, Select } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
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
  batchUpdateUsersStatus,
  batchDeleteUsers,
  User,
  CreateUserData,
  UpdateUserData,
} from '../../../../services/user';
import { getDepartmentTree, DepartmentTreeItem } from '../../../../services/department';
import { getPositionList } from '../../../../services/position';
import { getRoleList } from '../../../../services/role';

/**
 * 账户管理列表页面组件
 */
const UserListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [positionOptions, setPositionOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [roleOptions, setRoleOptions] = useState<Array<{ label: string; value: string }>>([]);

  // 自定义AutoComplete选择器组件（单选）
  const AutoCompleteSelect: React.FC<{
    value?: string;
    onChange?: (value: string) => void;
    options: Array<{ label: string; value: string; key?: string }>;
    placeholder?: string;
    disabled?: boolean;
    style?: React.CSSProperties;
  }> = ({ value, onChange, options, placeholder, disabled, style }) => {
    const [inputValue, setInputValue] = useState('');

    // 过滤选项
    const filteredOptions = options.filter(option =>
      option.label.toLowerCase().includes(inputValue.toLowerCase())
    );

    // 处理选择
    const handleSelect = (selectedValue: string) => {
      const selectedOption = options.find(opt => opt.value === selectedValue);
      if (selectedOption) {
        setInputValue(selectedOption.label);
        onChange?.(selectedValue);
      }
    };

    // 处理输入变化
    const handleInputChange = (input: string) => {
      setInputValue(input);
    };

    // 当value变化时，更新显示的文本
    useEffect(() => {
      if (value) {
        const selectedOption = options.find(opt => opt.value === value);
        if (selectedOption) {
          setInputValue(selectedOption.label);
        }
      } else {
        setInputValue('');
      }
    }, [value, options]);

    return (
      <AutoComplete
        value={inputValue}
        onChange={handleInputChange}
        onSelect={handleSelect}
        placeholder={placeholder}
        disabled={disabled}
        style={style}
        options={filteredOptions.map(option => ({
          value: option.value,
          label: option.label,
        }))}
        filterOption={false} // 禁用默认过滤，我们使用自定义过滤
      />
    );
  };

  // 自定义多选AutoComplete组件
  const AutoCompleteMultiSelect: React.FC<{
    value?: string[];
    onChange?: (value: string[]) => void;
    options: Array<{ label: string; value: string; key?: string }>;
    placeholder?: string;
    disabled?: boolean;
    style?: React.CSSProperties;
  }> = ({ value = [], onChange, options, placeholder, disabled, style }) => {
    const [inputValue, setInputValue] = useState('');

    // 获取已选中的选项标签
    const selectedLabels = value.map(val => {
      const option = options.find(opt => opt.value === val);
      return option?.label || val;
    }).join(', ');

    // 显示值（已选中的标签或输入的值）
    const displayValue = selectedLabels || inputValue;

    // 过滤选项（排除已选中的）
    const filteredOptions = options.filter(option =>
      !value.includes(option.value) &&
      option.label.toLowerCase().includes(inputValue.toLowerCase())
    );

    // 处理选择
    const handleSelect = (selectedValue: string) => {
      const newValue = [...value, selectedValue];
      onChange?.(newValue);
      setInputValue(''); // 清空输入
    };

    // 处理输入变化
    const handleInputChange = (input: string) => {
      setInputValue(input);
    };

    // 处理删除标签
    const handleTagClose = (removedValue: string) => {
      const newValue = value.filter(val => val !== removedValue);
      onChange?.(newValue);
    };

    return (
      <div style={{ position: 'relative', ...style }}>
        {/* 显示已选中的标签 */}
        {value.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <Space size={[0, 8]} wrap>
              {value.map(val => {
                const option = options.find(opt => opt.value === val);
                return (
                  <Tag
                    key={val}
                    closable
                    onClose={() => handleTagClose(val)}
                    style={{ margin: 0 }}
                  >
                    {option?.label || val}
                  </Tag>
                );
              })}
            </Space>
          </div>
        )}

        {/* AutoComplete输入框 */}
        <AutoComplete
          value={inputValue}
          onChange={handleInputChange}
          onSelect={handleSelect}
          placeholder={value.length === 0 ? placeholder : '继续添加...'}
          disabled={disabled}
          style={{ width: '100%' }}
          options={filteredOptions.map(option => ({
            value: option.value,
            label: option.label,
          }))}
          filterOption={false}
        />
      </div>
    );
  };

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
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      is_active: true,
      is_tenant_admin: false,
    });
  };

  /**
   * 处理编辑用户
   */
  const handleEdit = async (record: User) => {
    try {
      setIsEdit(true);
      setCurrentUserUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await getUserByUuid(record.uuid);
      formRef.current?.setFieldsValue({
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
  const handleSubmit = async () => {
    try {
      setFormLoading(true);
      const values = await formRef.current?.validateFields();

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
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 180,
      ellipsis: true,
    },
    {
      title: '姓名',
      dataIndex: 'full_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      width: 130,
      hideInSearch: true,
      ellipsis: true,
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 120,
      ellipsis: true,
      render: (_, record) => record.department?.name || '-',
    },
    {
      title: '职位',
      dataIndex: 'position',
      width: 120,
      ellipsis: true,
      render: (_, record) => record.position?.name || '-',
    },
    {
      title: '角色',
      dataIndex: 'roles',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => (
        <Space>
          {record.roles?.map(role => (
            <Tag key={role.uuid}>{role.name}</Tag>
          ))}
        </Space>
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
      title: '组织管理员',
      dataIndex: 'is_tenant_admin',
      width: 120,
      hideInTable: true, // 默认不显示
      render: (_, record) => (
        <Tag color={record.is_tenant_admin ? 'gold' : 'default'}>
          {record.is_tenant_admin ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'last_login',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
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
      title: '操作',
      valueType: 'option',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
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
            重置密码
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
  const detailColumns = [
    { title: '用户名', dataIndex: 'username' },
    { title: '邮箱', dataIndex: 'email' },
    { title: '姓名', dataIndex: 'full_name' },
    { title: '手机号', dataIndex: 'phone' },
    { 
      title: '部门', 
      dataIndex: ['department', 'name'], 
      render: (_: any, record: User) => record.department?.name || '-' 
    },
    { 
      title: '职位', 
      dataIndex: ['position', 'name'], 
      render: (_: any, record: User) => record.position?.name || '-' 
    },
    {
      title: '角色',
      dataIndex: 'roles',
      span: 2,
      render: (_: any, record: User) => (
        <Space>
          {record.roles?.map(role => (
            <Tag key={role.uuid}>{role.name}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      render: (value: boolean) => (value ? '启用' : '禁用'),
    },
    {
      title: '组织管理员',
      dataIndex: 'is_tenant_admin',
      render: (value: boolean) => (value ? '是' : '否'),
    },
    { title: '最后登录', dataIndex: 'last_login', valueType: 'dateTime' },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<User>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, filter, searchFormValues) => {
          const response = await getUserList({
            page: params.current || 1,
            page_size: params.pageSize || 20,
            keyword: searchFormValues?.keyword,
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
        showImportButton={true}
        onImport={handleImport}
        showExportButton={true}
        onExport={handleExport}
        showCreateButton
        onCreate={handleCreate}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑用户' : '新建用户'}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <ProForm
          formRef={formRef}
          submitter={false}
          layout="vertical"
        >
          {/* 第一行：基本信息 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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
            />
            <ProFormText
              name="full_name"
              label="姓名"
              rules={[
                { max: 100, message: '姓名长度不能超过100个字符' }
              ]}
              placeholder="请输入姓名"
            />
          </div>

          {/* 第二行：联系方式 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <ProFormText
              name="phone"
              label="手机号"
              rules={[
                { required: true, message: '请输入手机号' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的11位中国大陆手机号（以1开头）' }
              ]}
              placeholder="请输入手机号"
            />
            <ProFormText
              name="email"
              label="邮箱"
              rules={[
                { type: 'email', message: '请输入正确的邮箱地址' }
              ]}
              placeholder="请输入邮箱（可选）"
            />
          </div>

          {/* 第三行：密码 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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
            />
          </div>

          {/* 第四行：组织架构 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <ProForm.Item
              name="department_uuid"
              label="部门"
              rules={[]}
            >
              <AutoCompleteSelect
                placeholder="请输入部门名称搜索"
                options={departmentOptions}
                style={{ width: '100%' }}
              />
            </ProForm.Item>
            <ProForm.Item
              name="position_uuid"
              label="职位"
              rules={[]}
            >
              <AutoCompleteSelect
                placeholder="请输入职位名称搜索"
                options={positionOptions}
                style={{ width: '100%' }}
              />
            </ProForm.Item>
          </div>

          {/* 第五行：角色和权限 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
            <ProForm.Item
              name="role_uuids"
              label="角色"
              rules={[]}
            >
              <AutoCompleteMultiSelect
                placeholder="请输入角色名称搜索并选择"
                options={roleOptions}
                style={{ width: '100%' }}
              />
            </ProForm.Item>
          </div>

          {/* 第六行：状态设置 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <ProFormSwitch
              name="is_active"
              label="是否启用"
              initialValue={true}
            />
            <ProFormSwitch
              name="is_tenant_admin"
              label="是否组织管理员"
              initialValue={false}
            />
          </div>
        </ProForm>
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<User>
        title="用户详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData || {}}
        columns={detailColumns}
      />
    </>
  );
};

export default UserListPage;


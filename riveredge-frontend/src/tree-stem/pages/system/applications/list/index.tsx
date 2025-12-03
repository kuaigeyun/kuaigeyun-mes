/**
 * 应用中心列表页面
 * 
 * 用于系统管理员查看和管理组织内的应用。
 * 支持应用的 CRUD 操作、安装/卸载、启用/禁用功能。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormDigit, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Switch, Card, Dropdown } from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined, 
  PlusOutlined, 
  DownloadOutlined, 
  StopOutlined, 
  CheckCircleOutlined, 
  MoreOutlined, 
  AppstoreOutlined,
  UserOutlined,
  ShopOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  TeamOutlined,
  BarChartOutlined,
  ApiOutlined,
  CloudOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../components/uni_table';
import {
  getApplicationList,
  getApplicationByUuid,
  createApplication,
  updateApplication,
  deleteApplication,
  installApplication,
  uninstallApplication,
  enableApplication,
  disableApplication,
  Application,
  ApplicationCreate,
  ApplicationUpdate,
} from '../../../../services/application';

/**
 * 根据应用代码获取图标组件
 */
const getApplicationIcon = (code: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    crm: <UserOutlined />,
    erp: <ShopOutlined />,
    mes: <DatabaseOutlined />,
    wms: <DatabaseOutlined />,
    oa: <FileTextOutlined />,
    scm: <ApiOutlined />,
    bi: <BarChartOutlined />,
    hr: <TeamOutlined />,
  };
  return iconMap[code] || <AppstoreOutlined />;
};

/**
 * 模拟应用数据（用于开发阶段展示）
 */
const mockApplications: Application[] = [
  {
    uuid: 'mock-001',
    tenant_id: 1,
    name: 'CRM 客户关系管理',
    code: 'crm',
    description: '全面的客户关系管理系统，帮助企业管理客户信息、销售机会、合同管理等业务。',
    icon: null, // 使用图标组件，不存储URL
    version: '1.0.0',
    route_path: '/apps/crm',
    entry_point: '/apps/crm/index',
    menu_config: {},
    permission_code: 'app:crm',
    is_system: false,
    is_active: true,
    is_installed: true,
    sort_order: 1,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-20T15:30:00Z',
  },
  {
    uuid: 'mock-002',
    tenant_id: 1,
    name: 'ERP 企业资源规划',
    code: 'erp',
    description: '企业资源规划系统，集成采购、库存、生产、财务等核心业务流程。',
    icon: null, // 使用图标组件，不存储URL
    version: '2.1.0',
    route_path: '/apps/erp',
    entry_point: '/apps/erp/index',
    menu_config: {},
    permission_code: 'app:erp',
    is_system: false,
    is_active: true,
    is_installed: true,
    sort_order: 2,
    created_at: '2024-01-10T09:00:00Z',
    updated_at: '2024-01-25T11:20:00Z',
  },
  {
    uuid: 'mock-003',
    tenant_id: 1,
    name: 'MES 制造执行系统',
    code: 'mes',
    description: '制造执行系统，管理生产计划、工单、工艺路线、质量检验等制造环节。',
    icon: null, // 使用图标组件，不存储URL
    version: '1.5.2',
    route_path: '/apps/mes',
    entry_point: '/apps/mes/index',
    menu_config: {},
    permission_code: 'app:mes',
    is_system: true,
    is_active: true,
    is_installed: true,
    sort_order: 3,
    created_at: '2024-01-05T08:00:00Z',
    updated_at: '2024-01-22T14:10:00Z',
  },
  {
    uuid: 'mock-004',
    tenant_id: 1,
    name: 'WMS 仓库管理系统',
    code: 'wms',
    description: '智能仓库管理系统，支持多仓库、多货位、批次管理、库存盘点等功能。',
    icon: null, // 使用图标组件，不存储URL
    version: '1.2.0',
    route_path: '/apps/wms',
    entry_point: '/apps/wms/index',
    menu_config: {},
    permission_code: 'app:wms',
    is_system: false,
    is_active: false,
    is_installed: true,
    sort_order: 4,
    created_at: '2024-01-12T11:00:00Z',
    updated_at: '2024-01-18T16:45:00Z',
  },
  {
    uuid: 'mock-005',
    tenant_id: 1,
    name: 'OA 办公自动化',
    code: 'oa',
    description: '办公自动化系统，提供审批流程、文档管理、日程安排、通讯录等功能。',
    icon: null, // 使用图标组件，不存储URL
    version: '1.8.5',
    route_path: '/apps/oa',
    entry_point: '/apps/oa/index',
    menu_config: {},
    permission_code: 'app:oa',
    is_system: false,
    is_active: true,
    is_installed: false,
    sort_order: 5,
    created_at: '2024-01-08T10:30:00Z',
    updated_at: '2024-01-08T10:30:00Z',
  },
  {
    uuid: 'mock-006',
    tenant_id: 1,
    name: 'SCM 供应链管理',
    code: 'scm',
    description: '供应链管理系统，涵盖供应商管理、采购管理、合同管理、物流跟踪等。',
    icon: null, // 使用图标组件，不存储URL
    version: '1.3.1',
    route_path: '/apps/scm',
    entry_point: '/apps/scm/index',
    menu_config: {},
    permission_code: 'app:scm',
    is_system: false,
    is_active: true,
    is_installed: false,
    sort_order: 6,
    created_at: '2024-01-20T14:00:00Z',
    updated_at: '2024-01-20T14:00:00Z',
  },
  {
    uuid: 'mock-007',
    tenant_id: 1,
    name: 'BI 商业智能',
    code: 'bi',
    description: '商业智能分析平台，提供数据可视化、报表分析、数据挖掘等功能。',
    icon: null, // 使用图标组件，不存储URL
    version: '2.0.0',
    route_path: '/apps/bi',
    entry_point: '/apps/bi/index',
    menu_config: {},
    permission_code: 'app:bi',
    is_system: false,
    is_active: true,
    is_installed: true,
    sort_order: 7,
    created_at: '2024-01-15T09:15:00Z',
    updated_at: '2024-01-23T13:25:00Z',
  },
  {
    uuid: 'mock-008',
    tenant_id: 1,
    name: 'HR 人力资源',
    code: 'hr',
    description: '人力资源管理系统，包括员工信息、考勤管理、薪资管理、绩效评估等模块。',
    icon: null, // 使用图标组件，不存储URL
    version: '1.6.0',
    route_path: '/apps/hr',
    entry_point: '/apps/hr/index',
    menu_config: {},
    permission_code: 'app:hr',
    is_system: false,
    is_active: false,
    is_installed: false,
    sort_order: 8,
    created_at: '2024-01-18T11:30:00Z',
    updated_at: '2024-01-18T11:30:00Z',
  },
];

/**
 * 应用中心列表页面组件
 */
const ApplicationListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑应用）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentApplicationUuid, setCurrentApplicationUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Application | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建应用
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentApplicationUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      is_system: false,
      is_active: true,
      sort_order: 0,
    });
  };

  /**
   * 处理编辑应用
   */
  const handleEdit = async (record: Application) => {
    try {
      setIsEdit(true);
      setCurrentApplicationUuid(record.uuid);
      setModalVisible(true);
      
      // 获取应用详情
      const detail = await getApplicationByUuid(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        description: detail.description,
        icon: detail.icon,
        version: detail.version,
        route_path: detail.route_path,
        entry_point: detail.entry_point,
        permission_code: detail.permission_code,
        is_active: detail.is_active,
        sort_order: detail.sort_order,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取应用详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: Application) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getApplicationByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取应用详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除应用
   */
  const handleDelete = async (record: Application) => {
    // TODO: 后续对接真实API时，移除模拟逻辑
    const USE_MOCK_DATA = true;
    
    if (USE_MOCK_DATA) {
      // 模拟删除：从模拟数据中移除
      const index = mockApplications.findIndex(app => app.uuid === record.uuid);
      if (index !== -1) {
        mockApplications.splice(index, 1);
      }
      messageApi.success('删除成功');
      actionRef.current?.reload();
      return;
    }
    
    try {
      await deleteApplication(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理安装应用
   */
  const handleInstall = async (record: Application) => {
    // TODO: 后续对接真实API时，移除模拟逻辑
    const USE_MOCK_DATA = true;
    
    if (USE_MOCK_DATA) {
      // 模拟安装：更新模拟数据
      const index = mockApplications.findIndex(app => app.uuid === record.uuid);
      if (index !== -1) {
        mockApplications[index].is_installed = true;
        mockApplications[index].is_active = true;
      }
      messageApi.success('安装成功');
      actionRef.current?.reload();
      return;
    }
    
    try {
      await installApplication(record.uuid);
      messageApi.success('安装成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '安装失败');
    }
  };

  /**
   * 处理卸载应用
   */
  const handleUninstall = async (record: Application) => {
    // TODO: 后续对接真实API时，移除模拟逻辑
    const USE_MOCK_DATA = true;
    
    if (USE_MOCK_DATA) {
      // 模拟卸载：更新模拟数据
      const index = mockApplications.findIndex(app => app.uuid === record.uuid);
      if (index !== -1) {
        mockApplications[index].is_installed = false;
        mockApplications[index].is_active = false;
      }
      messageApi.success('卸载成功');
      actionRef.current?.reload();
      return;
    }
    
    try {
      await uninstallApplication(record.uuid);
      messageApi.success('卸载成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '卸载失败');
    }
  };

  /**
   * 处理启用/禁用应用
   */
  const handleToggleActive = async (record: Application, checked: boolean) => {
    // TODO: 后续对接真实API时，移除模拟逻辑
    const USE_MOCK_DATA = true;
    
    if (USE_MOCK_DATA) {
      // 模拟启用/禁用：更新模拟数据
      const index = mockApplications.findIndex(app => app.uuid === record.uuid);
      if (index !== -1) {
        mockApplications[index].is_active = checked;
      }
      messageApi.success(checked ? '启用成功' : '禁用成功');
      actionRef.current?.reload();
      return;
    }
    
    try {
      if (checked) {
        await enableApplication(record.uuid);
        messageApi.success('启用成功');
      } else {
        await disableApplication(record.uuid);
        messageApi.success('禁用成功');
      }
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    }
  };

  /**
   * 处理提交表单（创建/更新应用）
   */
  const handleSubmit = async () => {
    try {
      setFormLoading(true);
      const values = await formRef.current?.validateFields();
      
      if (isEdit && currentApplicationUuid) {
        await updateApplication(currentApplicationUuid, {
          name: values.name,
          description: values.description,
          icon: values.icon,
          version: values.version,
          route_path: values.route_path,
          entry_point: values.entry_point,
          permission_code: values.permission_code,
          is_active: values.is_active,
          sort_order: values.sort_order,
        } as ApplicationUpdate);
        messageApi.success('更新成功');
      } else {
        await createApplication({
          name: values.name,
          code: values.code,
          description: values.description,
          icon: values.icon,
          version: values.version,
          route_path: values.route_path,
          entry_point: values.entry_point,
          permission_code: values.permission_code,
          is_system: values.is_system || false,
          is_active: values.is_active,
          sort_order: values.sort_order,
        } as ApplicationCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Application>[] = [
    {
      title: '应用名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: '应用代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '路由路径',
      dataIndex: 'route_path',
      width: 200,
      hideInSearch: true,
    },
    {
      title: '系统应用',
      dataIndex: 'is_system',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Default' },
        false: { text: '否', status: 'Processing' },
      },
      render: (_, record) => (
        <Tag color={record.is_system ? 'default' : 'blue'}>
          {record.is_system ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '安装状态',
      dataIndex: 'is_installed',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '已安装', status: 'Success' },
        false: { text: '未安装', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_installed ? 'success' : 'default'}>
          {record.is_installed ? '已安装' : '未安装'}
        </Tag>
      ),
    },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Switch
          checked={record.is_active}
          onChange={(checked) => handleToggleActive(record, checked)}
          disabled={!record.is_installed}
        />
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 80,
      hideInSearch: true,
      sorter: true,
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
      width: 300,
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
          {!record.is_installed ? (
            <Popconfirm
              title="确定要安装这个应用吗？"
              onConfirm={() => handleInstall(record)}
            >
              <Button
                type="link"
                size="small"
                icon={<DownloadOutlined />}
              >
                安装
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="确定要卸载这个应用吗？"
              onConfirm={() => handleUninstall(record)}
              disabled={record.is_system}
            >
              <Button
                type="link"
                size="small"
                icon={<StopOutlined />}
                disabled={record.is_system}
              >
                卸载
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title="确定要删除这个应用吗？"
            onConfirm={() => handleDelete(record)}
            disabled={record.is_system}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={record.is_system}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /**
   * 渲染应用卡片
   */
  const renderApplicationCard = (application: Application, index: number) => {
    const menuItems = [
      {
        key: 'view',
        label: '查看详情',
        icon: <EyeOutlined />,
        onClick: () => handleView(application),
      },
      {
        key: 'edit',
        label: '编辑',
        icon: <EditOutlined />,
        onClick: () => handleEdit(application),
      },
      {
        type: 'divider' as const,
      },
      !application.is_installed
        ? {
            key: 'install',
            label: '安装',
            icon: <DownloadOutlined />,
            onClick: () => {
              Modal.confirm({
                title: '确定要安装这个应用吗？',
                onOk: () => handleInstall(application),
              });
            },
          }
        : {
            key: 'uninstall',
            label: '卸载',
            icon: <StopOutlined />,
            disabled: application.is_system,
            onClick: () => {
              if (application.is_system) return;
              Modal.confirm({
                title: '确定要卸载这个应用吗？',
                onOk: () => handleUninstall(application),
              });
            },
          },
      {
        type: 'divider' as const,
      },
      {
        key: 'delete',
        label: '删除',
        icon: <DeleteOutlined />,
        danger: true,
        disabled: application.is_system,
        onClick: () => {
          if (application.is_system) return;
          Modal.confirm({
            title: '确定要删除这个应用吗？',
            onOk: () => handleDelete(application),
          });
        },
      },
    ];

    return (
      <Card
        key={application.uuid}
        hoverable
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        cover={
          <div
            style={{
              height: 180,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: application.is_active && application.is_installed ? '#f0f9ff' : '#fafafa',
              padding: '24px',
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            {React.cloneElement(getApplicationIcon(application.code) as React.ReactElement, {
              style: {
                fontSize: 72,
                color: application.is_active && application.is_installed ? '#1890ff' : '#d9d9d9',
              },
            })}
          </div>
        }
        actions={[
          <div key="active" style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#666' }}>启用状态</span>
            <Switch
              checked={application.is_active}
              onChange={(checked) => handleToggleActive(application, checked)}
              disabled={!application.is_installed}
              checkedChildren="启用"
              unCheckedChildren="禁用"
            />
          </div>,
          <Dropdown
            key="more"
            menu={{ items: menuItems }}
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} style={{ width: '100%' }}>
              更多操作
            </Button>
          </Dropdown>,
        ]}
      >
        <Card.Meta
          title={
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 16, color: '#262626' }}>
                  {application.name}
                </span>
                <Space size={4}>
                  {application.is_system && (
                    <Tag color="default" style={{ margin: 0 }}>系统</Tag>
                  )}
                  {application.is_installed ? (
                    <Tag color="success" style={{ margin: 0 }}>已安装</Tag>
                  ) : (
                    <Tag style={{ margin: 0 }}>未安装</Tag>
                  )}
                </Space>
              </div>
            </div>
          }
          description={
            <div>
              <div
                style={{
                  marginBottom: 12,
                  color: '#595959',
                  fontSize: 13,
                  lineHeight: '20px',
                  minHeight: 40,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {application.description || '暂无描述'}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  color: '#8c8c8c',
                  paddingTop: 8,
                  borderTop: '1px solid #f0f0f0',
                }}
              >
                <span>代码: {application.code}</span>
                {application.version && (
                  <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                    v{application.version}
                  </Tag>
                )}
              </div>
            </div>
          }
        />
      </Card>
    );
  };

  return (
    <div>
      <UniTable<Application>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // TODO: 后续对接真实API时，移除模拟数据逻辑
          const USE_MOCK_DATA = true; // 开发阶段使用模拟数据
          
          if (USE_MOCK_DATA) {
            // 使用模拟数据
            let filteredData = [...mockApplications];
            
            // 状态筛选
            if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
              filteredData = filteredData.filter(item => item.is_active === searchFormValues.is_active);
            }
            
            // 安装状态筛选
            if (searchFormValues?.is_installed !== undefined && searchFormValues.is_installed !== '' && searchFormValues.is_installed !== null) {
              filteredData = filteredData.filter(item => item.is_installed === searchFormValues.is_installed);
            }
            
            // 系统应用筛选
            if (searchFormValues?.is_system !== undefined && searchFormValues.is_system !== '' && searchFormValues.is_system !== null) {
              filteredData = filteredData.filter(item => item.is_system === searchFormValues.is_system);
            }
            
            // 前端进行分页处理
            const page = params.current || 1;
            const pageSize = params.pageSize || 12;
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedData = filteredData.slice(startIndex, endIndex);
            
            return {
              data: paginatedData,
              success: true,
              total: filteredData.length,
            };
          }
          
          // 真实API调用（后续启用）
          const apiParams: any = {};
          
          // 状态筛选
          if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
            apiParams.is_active = searchFormValues.is_active;
          }
          
          // 安装状态筛选
          if (searchFormValues?.is_installed !== undefined && searchFormValues.is_installed !== '' && searchFormValues.is_installed !== null) {
            apiParams.is_installed = searchFormValues.is_installed;
          }
          
          try {
            // 获取所有数据（应用数量通常不会太多）
            const allData = await getApplicationList(apiParams);
            
            // 前端进行分页处理
            const page = params.current || 1;
            const pageSize = params.pageSize || 12;
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedData = allData.slice(startIndex, endIndex);
            
            return {
              data: paginatedData,
              success: true,
              total: allData.length,
            };
          } catch (error: any) {
            console.error('获取应用列表失败:', error);
            messageApi.error(error?.message || '获取应用列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 12,
          showSizeChanger: true,
          pageSizeOptions: ['12', '24', '48', '96'],
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建应用
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        viewTypes={['card', 'table']}
        defaultViewType="card" // 默认显示卡片视图
        cardViewConfig={{
          renderCard: renderApplicationCard,
        }}
      />

      {/* 创建/编辑应用 Modal */}
      <Modal
        title={isEdit ? '编辑应用' : '新建应用'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={formLoading}
        width={700}
      >
        <ProForm
          formRef={formRef}
          submitter={false}
          layout="vertical"
        >
          <ProFormText
            name="name"
            label="应用名称"
            rules={[{ required: true, message: '请输入应用名称' }]}
            placeholder="请输入应用名称"
          />
          <ProFormText
            name="code"
            label="应用代码"
            rules={[
              { required: true, message: '请输入应用代码' },
              { pattern: /^[a-z0-9_]+$/, message: '应用代码只能包含小写字母、数字和下划线' },
            ]}
            placeholder="请输入应用代码（唯一标识，如：crm_app）"
            disabled={isEdit}
          />
          <ProFormTextArea
            name="description"
            label="应用描述"
            placeholder="请输入应用描述"
          />
          <ProFormText
            name="icon"
            label="应用图标"
            placeholder="请输入图标URL或路径"
          />
          <ProFormText
            name="version"
            label="应用版本"
            placeholder="请输入应用版本（如：1.0.0）"
          />
          <ProFormText
            name="route_path"
            label="路由路径"
            placeholder="请输入应用路由路径（如：/apps/crm）"
          />
          <ProFormText
            name="entry_point"
            label="入口点"
            placeholder="请输入应用入口点（前端组件路径或URL）"
          />
          <ProFormText
            name="permission_code"
            label="权限代码"
            placeholder="请输入权限代码（关联权限）"
          />
          {!isEdit && (
            <ProFormSwitch
              name="is_system"
              label="是否系统应用"
            />
          )}
          <ProFormSwitch
            name="is_active"
            label="是否启用"
          />
          <ProFormDigit
            name="sort_order"
            label="排序顺序"
            placeholder="请输入排序顺序（数字越小越靠前）"
            min={0}
          />
        </ProForm>
      </Modal>

      {/* 查看详情 Drawer */}
      <Drawer
        title="应用详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={700}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions<Application>
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '应用名称',
                dataIndex: 'name',
              },
              {
                title: '应用代码',
                dataIndex: 'code',
              },
              {
                title: '应用描述',
                dataIndex: 'description',
              },
              {
                title: '应用图标',
                dataIndex: 'icon',
                render: (value) => value ? <img src={value} alt="图标" style={{ maxWidth: 100, maxHeight: 100 }} /> : '-',
              },
              {
                title: '应用版本',
                dataIndex: 'version',
              },
              {
                title: '路由路径',
                dataIndex: 'route_path',
              },
              {
                title: '入口点',
                dataIndex: 'entry_point',
              },
              {
                title: '权限代码',
                dataIndex: 'permission_code',
              },
              {
                title: '系统应用',
                dataIndex: 'is_system',
                render: (value) => (value ? '是' : '否'),
              },
              {
                title: '安装状态',
                dataIndex: 'is_installed',
                render: (value) => (
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? '已安装' : '未安装'}
                  </Tag>
                ),
              },
              {
                title: '启用状态',
                dataIndex: 'is_active',
                render: (value) => (
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? '启用' : '禁用'}
                  </Tag>
                ),
              },
              {
                title: '排序顺序',
                dataIndex: 'sort_order',
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
      </Drawer>
    </div>
  );
};

export default ApplicationListPage;


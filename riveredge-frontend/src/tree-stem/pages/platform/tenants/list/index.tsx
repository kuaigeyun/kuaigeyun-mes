/**
 * 超级管理员组织列表页面
 * 
 * 用于超级管理员查看和管理所有组织。
 * 支持组织注册审核、启用/禁用等功能。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormSelect, ProFormDigit, ProFormDateTimePicker, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal } from 'antd';
import { CheckOutlined, CloseOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni_table';
import {
  getTenantList,
  getPackageConfig,
  getPackageConfigs,
  Tenant,
  TenantStatus,
  TenantPlan,
  CreateTenantData,
  UpdateTenantData,
  PackageConfig,
  activateTenant,
  deactivateTenant,
} from '../../../../services/tenant';
// 使用 apiRequest 统一处理 HTTP 请求

// @ts-ignore
import { apiRequest } from '../../../../services/api';

/**
 * 组织状态标签映射
 */
const statusTagMap: Record<TenantStatus, { color: string; text: string }> = {
  [TenantStatus.ACTIVE]: { color: 'success', text: '激活' },
  [TenantStatus.INACTIVE]: { color: 'default', text: '未激活' },
  [TenantStatus.EXPIRED]: { color: 'warning', text: '已过期' },
  [TenantStatus.SUSPENDED]: { color: 'error', text: '已暂停' },
};

/**
 * 组织套餐标签映射
 */
const planTagMap: Record<TenantPlan, { color: string; text: string }> = {
  [TenantPlan.TRIAL]: { color: 'default', text: '体验套餐' },
  [TenantPlan.BASIC]: { color: 'blue', text: '基础版' },
  [TenantPlan.PROFESSIONAL]: { color: 'purple', text: '专业版' },
  [TenantPlan.ENTERPRISE]: { color: 'gold', text: '企业版' },
};


/**
 * 超级管理员组织列表页面组件
 */
const SuperAdminTenantList: React.FC = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentTenantId, setCurrentTenantId] = useState<number | null>(null);
  const [tenantDetail, setTenantDetail] = useState<Tenant | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [packageConfigs, setPackageConfigs] = useState<Record<string, PackageConfig>>({});
  const [selectedPlan, setSelectedPlan] = useState<TenantPlan>(TenantPlan.TRIAL);
  
  /**
   * 审核通过组织注册
   * 
   * @param tenantId - 组织 ID
   */
  const approveTenant = async (tenantId: number) => {
    try {
      await apiRequest(`/platform/tenants/${tenantId}/approve`, {
        method: 'POST',
      });
      message.success('审核通过成功');
      return true;
    } catch (error: any) {
      message.error(error.message || '审核通过失败');
      return false;
    }
  };

  /**
   * 审核拒绝组织注册
   * 
   * @param tenantId - 组织 ID
   * @param reason - 拒绝原因
   */
  const rejectTenant = async (tenantId: number, reason?: string) => {
    try {
      await apiRequest(`/platform/tenants/${tenantId}/reject`, {
        method: 'POST',
        data: { reason },
      });
      message.success('审核拒绝成功');
      return true;
    } catch (error: any) {
      message.error(error.message || '审核拒绝失败');
      return false;
    }
  };

  /**
   * 处理导入数据
   */
  const handleImport = (data: any[][]) => {
    message.info(`导入功能开发中，共 ${data.length} 行数据`);
    // TODO: 实现导入功能
    // 例如：调用后端 API 批量创建组织
    // await batchCreateTenants(data);
  };

  /**
   * 加载组织详情
   */
  const loadTenantDetail = async (tenantId: number) => {
    setDetailLoading(true);
    try {
      // 使用平台超级管理员接口获取组织详情
      const data = await apiRequest<Tenant>(`/platform/tenants/${tenantId}`, {
        method: 'GET',
      });
      setTenantDetail(data);
    } catch (error: any) {
      message.error(error.message || '加载组织信息失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 打开详情 Drawer
   */
  const handleOpenDetail = (tenantId: number) => {
    setCurrentTenantId(tenantId);
    setDrawerVisible(true);
    loadTenantDetail(tenantId);
  };

  /**
   * 关闭详情 Drawer
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentTenantId(null);
    setTenantDetail(null);
  };

  /**
   * 处理导出数据
   */
  const handleExport = (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Tenant[]
  ) => {
    let exportInfo = '';
    switch (type) {
      case 'selected':
        exportInfo = `选中的 ${selectedRowKeys?.length || 0} 条数据`;
        break;
      case 'currentPage':
        exportInfo = `当前页的 ${currentPageData?.length || 0} 条数据`;
        break;
      case 'all':
        exportInfo = '全部数据';
        break;
    }
    message.info(`导出功能开发中，将导出：${exportInfo}`);
    // TODO: 实现导出功能
    // 根据 type 调用不同的导出逻辑
    // - selected: 导出 selectedRowKeys 对应的数据
    // - currentPage: 导出 currentPageData
    // - all: 调用 API 获取全部数据并导出
  };

  /**
   * 加载套餐配置
   */
  useEffect(() => {
    // 加载所有套餐配置（用于显示套餐信息）
    getPackageConfigs()
      .then((configs) => {
        // 将后端返回的套餐配置转换为前端需要的格式
        const formattedConfigs: Record<string, PackageConfig> = {};
        Object.keys(configs).forEach((planKey) => {
          const config = configs[planKey];
          formattedConfigs[planKey] = {
            name: config.name,
            max_users: config.max_users,
            max_storage_mb: config.max_storage_mb,
            allow_pro_apps: config.allow_pro_apps || false,
            description: config.description || '',
          };
        });
        setPackageConfigs(formattedConfigs);
      })
      .catch((error: any) => {
        // 静默处理错误，避免 401 错误导致页面刷新
        // 如果套餐配置加载失败，不影响页面正常使用
        console.warn('⚠️ 加载套餐配置失败（将使用默认配置）:', error);
        // 设置默认套餐配置，确保页面可以正常使用
        setPackageConfigs({
          trial: {
            name: '体验套餐',
            max_users: 10,
            max_storage_mb: 1024,
            allow_pro_apps: false,
            description: '适合快速体验系统功能，限制用户数和存储空间',
          },
          basic: {
            name: '基础版',
            max_users: 50,
            max_storage_mb: 5120,
            allow_pro_apps: false,
            description: '适合小型团队使用，提供基础功能',
          },
          professional: {
            name: '专业版',
            max_users: 200,
            max_storage_mb: 20480,
            allow_pro_apps: true,
            description: '适合中型企业使用，提供完整功能和 PRO 应用支持',
          },
          enterprise: {
            name: '企业版',
            max_users: 1000,
            max_storage_mb: 102400,
            allow_pro_apps: true,
            description: '适合大型企业使用，提供最高配置和完整功能',
          },
        });
      });
  }, []);

  /**
   * 处理套餐选择变化
   * 根据选择的套餐自动设置 max_users 和 max_storage
   */
  const handlePlanChange = async (plan: TenantPlan) => {
    setSelectedPlan(plan);
    try {
      // 优先使用已加载的套餐配置
      const planKey = plan.toLowerCase();
      if (packageConfigs[planKey]) {
        // 使用已加载的配置
        formRef.current?.setFieldsValue({
          max_users: packageConfigs[planKey].max_users,
          max_storage: packageConfigs[planKey].max_storage_mb,
        });
      } else {
        // 如果配置未加载，尝试从 API 获取
        const config = await getPackageConfig(plan);
        formRef.current?.setFieldsValue({
          max_users: config.max_users,
          max_storage: config.max_storage_mb,
        });
      }
    } catch (error: any) {
      // 如果获取失败，使用默认值
      console.warn('⚠️ 获取套餐配置失败，使用默认值:', error);
      const defaultConfigs: Record<string, { max_users: number; max_storage_mb: number }> = {
        trial: { max_users: 10, max_storage_mb: 1024 },
        basic: { max_users: 50, max_storage_mb: 5120 },
        professional: { max_users: 200, max_storage_mb: 20480 },
        enterprise: { max_users: 1000, max_storage_mb: 102400 },
      };
      const planKey = plan.toLowerCase();
      if (defaultConfigs[planKey]) {
        formRef.current?.setFieldsValue({
          max_users: defaultConfigs[planKey].max_users,
          max_storage: defaultConfigs[planKey].max_storage_mb,
        });
      }
    }
  };

  /**
   * 打开新建 Modal
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentTenantId(null);
    setSelectedPlan(TenantPlan.TRIAL);
    setModalVisible(true);
    // 重置表单
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        status: TenantStatus.INACTIVE,
        plan: TenantPlan.TRIAL,
      });
    }, 0);
  };

  /**
   * 打开编辑 Modal
   */
  const handleEdit = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const tenantId = Number(keys[0]);
      setIsEdit(true);
      setCurrentTenantId(tenantId);
      setModalVisible(true);
      setFormLoading(true);
      
      try {
        // 使用平台超级管理员接口获取组织详情
        const data = await apiRequest<Tenant>(`/platform/tenants/${tenantId}`, {
          method: 'GET',
        });
        setSelectedPlan(data.plan);
        // 设置表单初始值
        setTimeout(() => {
          formRef.current?.setFieldsValue({
            name: data.name,
            domain: data.domain,
            status: data.status,
            plan: data.plan,
            max_users: data.max_users,
            max_storage: data.max_storage,
            expires_at: data.expires_at,
          });
        }, 0);
      } catch (error: any) {
        message.error(error.message || '加载组织信息失败');
        setModalVisible(false);
      } finally {
        setFormLoading(false);
      }
    }
  };

  /**
   * 关闭 Modal
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    setIsEdit(false);
    setCurrentTenantId(null);
    setFormLoading(false);
    formRef.current?.resetFields();
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentTenantId) {
        // 更新组织
        const updateData: UpdateTenantData = {
          name: values.name,
          domain: values.domain,
          status: values.status,
          plan: values.plan,
          settings: values.settings || {},
          max_users: values.max_users,
          max_storage: values.max_storage,
          expires_at: values.expires_at,
        };
        // 使用平台超级管理员接口更新组织
        await apiRequest<Tenant>(`/platform/tenants/${currentTenantId}`, {
          method: 'PUT',
          data: updateData,
        });
        message.success('更新成功');
      } else {
        // 创建组织
        const createData: CreateTenantData = {
          name: values.name,
          domain: values.domain,
          status: values.status || TenantStatus.INACTIVE,
          plan: values.plan || TenantPlan.TRIAL,
          settings: values.settings || {},
          expires_at: values.expires_at,
        };
        // 使用平台超级管理员接口创建组织
        await apiRequest<Tenant>('/platform/tenants', {
          method: 'POST',
          data: createData,
        });
        message.success('创建成功');
      }
      
      // 关闭 Modal 并刷新列表
      handleCloseModal();
      actionRef.current?.reload();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      message.warning('请先选择要删除的组织');
      return;
    }
    message.info(`删除功能开发中，将删除 ${keys.length} 个组织`);
    // TODO: 实现删除功能
    // await batchDeleteTenants(keys);
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Tenant>[] = [
    {
      title: '组织名称',
      dataIndex: 'name',
      ellipsis: true,
      sorter: true,
      responsive: ['md'],
      fieldProps: {
        // 自动完成功能：从后端获取组织名称选项（暂时移除，先完成基础功能）
        // autoCompleteApi: async (keyword: string) => {
        //   if (!keyword || keyword.length < 1) {
        //     return [];
        //   }
        //   try {
        //     const result = await getTenantList(
        //       {
        //         page: 1,
        //         page_size: 20,
        //         name: keyword,
        //       },
        //       true // 超级管理员接口
        //     );
        //     return result.items.map((tenant) => ({
        //       label: `${tenant.name} (${tenant.domain})`,
        //       value: tenant.name,
        //     }));
        //   } catch (error) {
        //     return [];
        //   }
        // },
      },
    },
    {
      title: '域名',
      dataIndex: 'domain',
      ellipsis: true,
      sorter: true,
      responsive: ['md'],
      fieldProps: {
        // 自动完成功能：从后端获取域名选项（暂时移除，先完成基础功能）
        // autoCompleteApi: async (keyword: string) => {
        //   if (!keyword || keyword.length < 1) {
        //     return [];
        //   }
        //   try {
        //     const result = await getTenantList(
        //       {
        //         page: 1,
        //         page_size: 20,
        //         domain: keyword,
        //       },
        //       true // 超级管理员接口
        //     );
        //     return result.items.map((tenant) => ({
        //       label: `${tenant.domain} (${tenant.name})`,
        //       value: tenant.domain,
        //     }));
        //   } catch (error) {
        //     return [];
        //   }
        // },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      sorter: true,
      valueEnum: {
        [TenantStatus.ACTIVE]: { text: '激活' },
        [TenantStatus.INACTIVE]: { text: '未激活' },
        [TenantStatus.EXPIRED]: { text: '已过期' },
        [TenantStatus.SUSPENDED]: { text: '已暂停' },
      },
      render: (_, record) => {
        const statusInfo = statusTagMap[record.status];
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '套餐',
      dataIndex: 'plan',
      valueType: 'select',
      sorter: true,
      valueEnum: {
        [TenantPlan.TRIAL]: { text: '体验套餐' },
        [TenantPlan.BASIC]: { text: '基础版' },
        [TenantPlan.PROFESSIONAL]: { text: '专业版' },
        [TenantPlan.ENTERPRISE]: { text: '企业版' },
      },
      render: (_, record) => {
        const planInfo = planTagMap[record.plan];
        return <Tag color={planInfo.color}>{planInfo.text}</Tag>;
      },
    },
    {
      title: '最大用户数',
      dataIndex: 'max_users',
      width: 120,
      hideInSearch: true,
      sorter: true,
      responsive: ['lg'],
    },
    {
      title: '存储空间 (MB)',
      dataIndex: 'max_storage',
      width: 150,
      hideInSearch: true,
      sorter: true,
      responsive: ['lg'],
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      hideInSearch: true,
      width: 180,
      sorter: true,
      responsive: ['xl'],
    },
    {
      title: '操作',
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_, record) => {
        const isInactive = record.status === TenantStatus.INACTIVE;
        const isActive = record.status === TenantStatus.ACTIVE;
        const isSuspended = record.status === TenantStatus.SUSPENDED;

        return (
          <Space>
            <Button
              type="link"
              size="small"
              onClick={() => handleOpenDetail(record.id)}
            >
              详情
            </Button>
            {isInactive && (
              <Popconfirm
                title="确定要审核通过此组织吗？"
                onConfirm={async () => {
                  const success = await approveTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" icon={<CheckOutlined />}>
                  审核通过
                </Button>
              </Popconfirm>
            )}
            {isInactive && (
              <Popconfirm
                title="确定要拒绝此组织注册吗？"
                onConfirm={async () => {
                  const success = await rejectTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" danger icon={<CloseOutlined />}>
                  审核拒绝
                </Button>
              </Popconfirm>
            )}
            {isSuspended && (
              <Popconfirm
                title="确定要激活此组织吗？"
                onConfirm={async () => {
                  const success = await activateTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" icon={<PlayCircleOutlined />}>
                  激活
                </Button>
              </Popconfirm>
            )}
            {isActive && (
              <Popconfirm
                title="确定要停用此组织吗？"
                onConfirm={async () => {
                  const success = await deactivateTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" danger icon={<PauseCircleOutlined />}>
                  停用
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <>
    <UniTable<Tenant>
      actionRef={actionRef}
      columns={columns}
      rowKey="id"
      enableRowSelection={true}
      onRowSelectionChange={(keys) => {
        setSelectedRowKeys(keys);
      }}
      showCreateButton={true}
      onCreate={handleCreate}
      showEditButton={true}
      onEdit={handleEdit}
      showDeleteButton={true}
      onDelete={handleDelete}
      showImportButton={true}
      onImport={handleImport}
      showExportButton={true}
      onExport={handleExport}
      viewTypes={['table', 'card', 'kanban', 'stats']}
      defaultViewType="table"
      request={async (params, sort, _filter, searchFormValues) => {
        // 处理排序参数
        let sortField: string | undefined;
        let sortOrder: 'asc' | 'desc' | undefined;
        
        if (sort && Object.keys(sort).length > 0) {
          // 获取第一个排序字段
          const firstSortKey = Object.keys(sort)[0];
          const firstSortValue = sort[firstSortKey];
          sortField = firstSortKey;
          sortOrder = firstSortValue === 'ascend' ? 'asc' : 'desc';
        }

        // 处理搜索参数
        const apiParams: any = {
          page: params.current || 1,
          page_size: params.pageSize || 10,
          sort: sortField,
          order: sortOrder,
        };
        
        // 状态和套餐筛选
        // ⭐ 修复：确保只有明确选择的状态才会被传递，避免意外过滤
        if (searchFormValues?.status && searchFormValues.status !== '' && searchFormValues.status !== undefined && searchFormValues.status !== null) {
          apiParams.status = searchFormValues.status as TenantStatus;
        }
        if (searchFormValues?.plan && searchFormValues.plan !== '' && searchFormValues.plan !== undefined && searchFormValues.plan !== null) {
          apiParams.plan = searchFormValues.plan as TenantPlan;
        }
        
        // 搜索条件处理：name 和 domain 使用模糊搜索
        if (searchFormValues?.name) {
          apiParams.name = searchFormValues.name as string;
        }
        if (searchFormValues?.domain) {
          apiParams.domain = searchFormValues.domain as string;
        }

        try {
          const result = await getTenantList(
            apiParams,
            true  // 平台超级管理员接口
          );

          return {
            data: result.items,
            success: true,
            total: result.total,
          };
        } catch (error: any) {
          // 如果获取数据失败，返回空列表而不是抛出错误
          // 避免错误导致页面跳转
          console.error('获取组织列表失败:', error);
          message.error(error?.message || '获取组织列表失败');
          return {
            data: [],
            success: false,
            total: 0,
          };
        }
      }}
      scroll={{ x: 1200 }}
    />
    
    {/* 组织详情 Drawer */}
    <Drawer
      title="组织详情"
      width={720}
      open={drawerVisible}
      onClose={handleCloseDetail}
      extra={
        tenantDetail && (
          <Space>
            {tenantDetail.status === TenantStatus.INACTIVE && (
              <>
                <Popconfirm
                  title="确定要审核通过此组织吗？"
                  onConfirm={async () => {
                    try {
                      await apiRequest(`/platform/tenants/${currentTenantId}/approve`, {
                        method: 'POST',
                      });
                      message.success('审核通过成功');
                      loadTenantDetail(currentTenantId!);
                      actionRef.current?.reload();
                    } catch (error: any) {
                      message.error(error.message || '审核通过失败');
                    }
                  }}
                >
                  <Button type="primary">审核通过</Button>
                </Popconfirm>
                <Popconfirm
                  title="确定要拒绝此组织注册吗？"
                  onConfirm={async () => {
                    try {
                      await apiRequest(`/platform/tenants/${currentTenantId}/reject`, {
                        method: 'POST',
                      });
                      message.success('审核拒绝成功');
                      loadTenantDetail(currentTenantId!);
                      actionRef.current?.reload();
                    } catch (error: any) {
                      message.error(error.message || '审核拒绝失败');
                    }
                  }}
                >
                  <Button danger>审核拒绝</Button>
                </Popconfirm>
              </>
            )}
            {tenantDetail.status === TenantStatus.SUSPENDED && (
              <Popconfirm
                title="确定要激活此组织吗？"
                onConfirm={async () => {
                  try {
                    await activateTenant(currentTenantId!);
                    message.success('激活成功');
                    loadTenantDetail(currentTenantId!);
                    actionRef.current?.reload();
                  } catch (error: any) {
                    message.error(error.message || '激活失败');
                  }
                }}
              >
                <Button type="primary">激活</Button>
              </Popconfirm>
            )}
            {tenantDetail.status === TenantStatus.ACTIVE && (
              <Popconfirm
                title="确定要停用此组织吗？"
                onConfirm={async () => {
                  try {
                    await deactivateTenant(currentTenantId!);
                    message.success('停用成功');
                    loadTenantDetail(currentTenantId!);
                    actionRef.current?.reload();
                  } catch (error: any) {
                    message.error(error.message || '停用失败');
                  }
                }}
              >
                <Button danger>停用</Button>
              </Popconfirm>
            )}
          </Space>
        )
      }
    >
      {tenantDetail ? (
        <ProDescriptions<Tenant>
          dataSource={tenantDetail}
          loading={detailLoading}
          column={2}
          columns={[
            {
              title: '组织名称',
              dataIndex: 'name',
            },
            {
              title: '域名',
              dataIndex: 'domain',
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (_, record) => {
                const statusInfo = statusTagMap[record.status];
                return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
              },
            },
            {
              title: '套餐',
              dataIndex: 'plan',
              render: (_, record) => {
                const planInfo = planTagMap[record.plan];
                return <Tag color={planInfo.color}>{planInfo.text}</Tag>;
              },
            },
            {
              title: '最大用户数',
              dataIndex: 'max_users',
            },
            {
              title: '存储空间 (MB)',
              dataIndex: 'max_storage',
            },
            {
              title: '过期时间',
              dataIndex: 'expires_at',
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
            {
              title: '配置',
              dataIndex: 'settings',
              span: 2,
              render: (value) => {
                // ⭐ 修复：确保 settings 对象被正确序列化为 JSON 字符串显示
                if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
                  return '-';
                }
                try {
                  const jsonStr = typeof value === 'string' 
                    ? value 
                    : JSON.stringify(value, null, 2);
                  return (
                    <pre style={{ 
                      margin: 0, 
                      whiteSpace: 'pre-wrap',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      backgroundColor: '#f5f5f5',
                      padding: '8px',
                      borderRadius: '4px',
                      maxHeight: '200px',
                      overflow: 'auto'
                    }}>
                      {jsonStr}
                    </pre>
                  );
                } catch (error) {
                  return <span style={{ color: '#ff4d4f' }}>配置格式错误</span>;
                }
              },
            },
          ]}
        />
      ) : (
        <div>加载中...</div>
      )}
    </Drawer>
    
    {/* 新建/编辑组织 Modal */}
    <Modal
      title={isEdit ? '编辑组织' : '新建组织'}
      open={modalVisible}
      onCancel={handleCloseModal}
      footer={null}
      width={800}
      destroyOnClose
    >
      <ProForm
        formRef={formRef}
        loading={formLoading}
        onFinish={handleSubmit}
        submitter={{
          searchConfig: {
            submitText: isEdit ? '更新' : '创建',
            resetText: '取消',
          },
          resetButtonProps: {
            onClick: handleCloseModal,
          },
        }}
        initialValues={{
          status: TenantStatus.INACTIVE,
          plan: TenantPlan.TRIAL,
        }}
        layout="vertical"
        grid={true}
        rowProps={{
          gutter: 16,
        }}
      >
        <ProFormText
          name="name"
          label="组织名称"
          placeholder="请输入组织名称"
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: '请输入组织名称' },
            { min: 1, max: 100, message: '组织名称长度为 1-100 字符' },
          ]}
        />
        <ProFormText
          name="domain"
          label="组织域名"
          placeholder="请输入组织域名（用于子域名访问）"
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: '请输入组织域名' },
            { min: 1, max: 100, message: '组织域名长度为 1-100 字符' },
            { pattern: /^[a-z0-9-]+$/, message: '域名只能包含小写字母、数字和连字符' },
          ]}
        />
        <ProFormSelect
          name="status"
          label="组织状态"
          placeholder="请选择组织状态"
          colProps={{ span: 12 }}
          options={[
            { label: '激活', value: TenantStatus.ACTIVE },
            { label: '未激活', value: TenantStatus.INACTIVE },
            { label: '已过期', value: TenantStatus.EXPIRED },
            { label: '已暂停', value: TenantStatus.SUSPENDED },
          ]}
        />
        <ProFormSelect
          name="plan"
          label="组织套餐"
          placeholder="请选择组织套餐"
          colProps={{ span: 12 }}
          options={[
            { label: '体验套餐', value: TenantPlan.TRIAL },
            { label: '基础版', value: TenantPlan.BASIC },
            { label: '专业版', value: TenantPlan.PROFESSIONAL },
            { label: '企业版', value: TenantPlan.ENTERPRISE },
          ]}
          fieldProps={{
            onChange: (value: TenantPlan) => {
              handlePlanChange(value);
            },
          }}
          extra={
            selectedPlan && packageConfigs[selectedPlan]
              ? `套餐说明：${packageConfigs[selectedPlan].description}（最大用户数：${packageConfigs[selectedPlan].max_users}，最大存储：${packageConfigs[selectedPlan].max_storage_mb} MB）`
              : undefined
          }
        />
        <ProFormDigit
          name="max_users"
          label="最大用户数"
          placeholder="将根据套餐自动设置"
          colProps={{ span: 12 }}
          min={1}
          rules={[{ required: true, message: '请输入最大用户数' }]}
          extra="选择套餐后将自动设置，也可手动调整"
        />
        <ProFormDigit
          name="max_storage"
          label="最大存储空间（MB）"
          placeholder="将根据套餐自动设置"
          colProps={{ span: 12 }}
          min={0}
          rules={[{ required: true, message: '请输入最大存储空间' }]}
          extra="选择套餐后将自动设置，也可手动调整"
        />
        <ProFormDateTimePicker
          name="expires_at"
          label="过期时间（可选）"
          placeholder="请选择过期时间（留空则永不过期）"
          colProps={{ span: 12 }}
        />
      </ProForm>
    </Modal>
    </>
  );
};

export default SuperAdminTenantList;


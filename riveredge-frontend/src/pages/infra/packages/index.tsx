/**
 * 套餐管理页面
 *
 * 用于管理平台套餐信息（查看、编辑、创建、删除）
 */

import { App, Button, Popconfirm } from 'antd';
import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rowActionKind } from '../../../components/uni-action';
import { createPackage, getPackageList, deletePackage, updatePackage, type Package, type PackageCreate, type PackageUpdate, TenantPlan, TENANT_PLAN_MARKER_COLORS } from '../../../services/tenant';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import { MarkerTag, StatusTag } from '../../../constants/statusBadges';
import { useTranslation } from 'react-i18next';
import PackageForm from './form';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { buildListPageHelpViewConfig } from '../../../components/page-help-wiki';

/**
 * 套餐管理页面组件
 */
export default function PackageManagementPage() {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFormData, setEditFormData] = useState<Package | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const createMutation = useMutation({
    mutationFn: (data: PackageCreate) => createPackage(data),
    onSuccess: () => {
      messageApi.success(t('common.createSuccess'));
      handleSave();
    },
    onError: (error: any) => {
      messageApi.error(error?.message || t('common.createFailed'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PackageUpdate }) => updatePackage(id, data),
    onSuccess: () => {
      messageApi.success(t('common.updateSuccess'));
      handleSave();
    },
    onError: (error: any) => {
      messageApi.error(error?.message || t('common.updateFailed'));
    },
  });

  // UniTable的request函数
  const handleRequest = async (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    filter: Record<string, React.ReactText[] | null>
  ) => {
    try {
      // 获取搜索参数（从 searchParamsRef 或 formRef 获取）
      const searchParams = params.searchFormValues || {};
      
      // 处理排序参数
      let sortField: string | undefined;
      let sortOrder: string | undefined;
      if (sort && Object.keys(sort).length > 0) {
        const sortKey = Object.keys(sort)[0];
        const sortValue = sort[sortKey];
        if (sortValue) {
          sortField = sortKey;
          sortOrder = sortValue === 'ascend' ? 'asc' : 'desc';
        }
      }
      
      // 构建请求参数
      const requestParams: any = {
        page: params.current || 1,
        pageSize: params.pageSize || 10,
      };
      
      // 添加搜索参数
      if (searchParams.name) {
        requestParams.name = searchParams.name;
      }
      if (searchParams.plan) {
        requestParams.plan = searchParams.plan;
      }
      if (searchParams.is_active !== undefined && searchParams.is_active !== null) {
        requestParams.is_active = searchParams.is_active;
      }
      if (searchParams.allow_pro_apps !== undefined && searchParams.allow_pro_apps !== null) {
        requestParams.allow_pro_apps = searchParams.allow_pro_apps;
      }
      
      // 添加排序参数
      if (sortField) {
        requestParams.sort = sortField;
      }
      if (sortOrder) {
        requestParams.order = sortOrder;
      }

      const result = await getPackageList(requestParams);

      // 后端返回的是 items 字段，不是 data
      return {
        data: result.items || [],
        success: true,
        total: result.total || 0,
      };
    } catch (error: any) {
      console.error('❌ 套餐列表查询失败:', error);
      messageApi.error(error?.message || t('pages.infra.package.fetchFailed'));
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  // 删除套餐（支持单个和批量删除）
  const deleteMutation = useMutation({
    mutationFn: (packageIds: number[]) => {
      // 如果是单个删除，packageIds只有一个元素
      return Promise.all(packageIds.map(id => deletePackage(id)));
    },
    onSuccess: (_, packageIds) => {
      messageApi.success(t('pages.infra.package.deleteSuccessCount', { count: packageIds.length }));
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      setSelectedRowKeys([]); // 清空选中状态
      // 手动刷新表格
      actionRef.current?.reload();
    },
    onError: (error: any) => {
      messageApi.error(error?.message || t('common.deleteFailed'));
    },
  });

  /**
   * 处理编辑
   */
  const handleEdit = (record: Package) => {
    setEditFormData(record);
    setEditModalVisible(true);
  };

  /**
   * 处理创建
   */
  const handleCreate = () => {
    setCreateModalVisible(true);
  };

  const normalizePackageValues = (values: any) => {
    const processedValues = { ...values };
    if (typeof processedValues.features === 'string') {
      processedValues.features = processedValues.features
        .split('\n')
        .map((feature: string) => feature.trim())
        .filter((feature: string) => feature.length > 0);
    } else if (!Array.isArray(processedValues.features)) {
      processedValues.features = [];
    }

    if (!Array.isArray(processedValues.allowed_app_codes)) {
      processedValues.allowed_app_codes = [];
    }

    if (processedValues.max_branch_organizations === '' || processedValues.max_branch_organizations === undefined) {
      processedValues.max_branch_organizations = null;
    }
    return processedValues;
  };

  /**
   * 处理保存
   */
  const handleSave = async () => {
    setEditModalVisible(false);
    setEditFormData(null);
    setCreateModalVisible(false);
    queryClient.invalidateQueries({ queryKey: ['packages'] });
    // 手动刷新表格
    actionRef.current?.reload();
  };

  const handleModalFinish = async (values: any) => {
    const processedValues = normalizePackageValues(values);
    if (editModalVisible && editFormData) {
      await updateMutation.mutateAsync({
        id: editFormData.id,
        data: processedValues,
      });
      return;
    }
    await createMutation.mutateAsync(processedValues);
  };

  /**
   * 处理单个删除（保留原有逻辑，用于行内删除按钮）
   */
  const handleSingleDelete = async (packageId: number) => {
    await deleteMutation.mutateAsync([packageId]);
  };

  /**
   * 处理行选择变化
   */
  const handleRowSelectionChange = (keys: React.Key[]) => {
    setSelectedRowKeys(keys);
  };

  /**
   * 处理批量删除（用于UniTable的删除按钮）
   */
  const handleBatchDelete = async (selectedRowKeys: React.Key[]) => {
    const packageIds = selectedRowKeys.map(key => parseInt(key.toString()));
    await deleteMutation.mutateAsync(packageIds);
  };


  // 套餐类型映射
  const planMap: Record<string, { text: string; color: string }> = {
    [TenantPlan.TRIAL]: { text: t('pages.infra.package.planTrial'), color: TENANT_PLAN_MARKER_COLORS[TenantPlan.TRIAL] },
    [TenantPlan.BASIC]: { text: t('pages.infra.package.planBasic'), color: TENANT_PLAN_MARKER_COLORS[TenantPlan.BASIC] },
    [TenantPlan.PROFESSIONAL]: { text: t('pages.infra.package.planProfessional'), color: TENANT_PLAN_MARKER_COLORS[TenantPlan.PROFESSIONAL] },
    [TenantPlan.ENTERPRISE]: { text: t('pages.infra.package.planEnterprise'), color: TENANT_PLAN_MARKER_COLORS[TenantPlan.ENTERPRISE] },
  };

  const columns: ProColumns<Package>[] = [
    {
      title: t('pages.infra.package.name'),
      dataIndex: 'name',
      key: 'name',
      minWidth: 160,
      uniTableRemainderFlex: true,
      uniTablePrimaryFlex: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
    },
    {
      title: t('pages.infra.package.plan'),
      dataIndex: 'plan',
      key: 'plan',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      render: (_: any, record: Package) => {
        const planInfo = planMap[record.plan] || { text: record.plan, color: 'default' };
        return <MarkerTag color={planInfo.color}>{planInfo.text}</MarkerTag>;
      },
    },
    {
      title: t('pages.infra.package.maxUsers'),
      dataIndex: 'max_users',
      key: 'max_users',
      width: 110,
      minWidth: 110,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      render: (_, record) => record.max_users?.toLocaleString() || '-',
    },
    {
      title: t('pages.infra.package.maxStorage'),
      dataIndex: 'max_storage_mb',
      key: 'max_storage_mb',
      width: 150,
      minWidth: 150,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      render: (_, record) => record.max_storage_mb?.toLocaleString() || '-',
    },
    {
      title: t('pages.infra.package.maxBranchOrganizations'),
      dataIndex: 'max_branch_organizations',
      key: 'max_branch_organizations',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      render: (_, record) =>
        record.max_branch_organizations === null || record.max_branch_organizations === undefined
          ? t('pages.infra.package.unlimited')
          : record.max_branch_organizations,
    },
    {
      title: t('pages.infra.package.allowProApps'),
      dataIndex: 'allow_pro_apps',
      key: 'allow_pro_apps',
      width: 140,
      minWidth: 140,
      uniTableKeepWidth: true,
      resizable: false,
      render: (_, record) => (
        <MarkerTag color={record.allow_pro_apps ? 'success' : 'default'}>
          {record.allow_pro_apps ? t('common.yes') : t('common.no')}
        </MarkerTag>
      ),
    },
    {
      title: t('pages.infra.package.allowedApps'),
      dataIndex: 'allowed_app_codes',
      key: 'allowed_app_codes',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      render: (_, record) => {
        const codes = record.allowed_app_codes || [];
        if (!codes.length) {
          return <MarkerTag>{t('pages.infra.package.unlimited')}</MarkerTag>;
        }
        return (
          <MarkerTag color="processing">
            {t('pages.infra.package.allowedAppsCount', { count: codes.length })}
          </MarkerTag>
        );
      },
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'dateTime',
      sorter: true,
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      key: 'lifecycle',
      fixed: 'right',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      render: (_, record) => (
        <StatusTag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.infra.package.statusActive') : t('pages.infra.package.statusInactive')}
        </StatusTag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'action',
      fixed: 'right',
      hideInSearch: true,
      render: (_: any, record: Package) => [
        <Button
          key="edit"
          {...rowActionKind('update')}
          onClick={() => handleEdit(record)}
        />,
        <Popconfirm
          key="delete"
          title={t('pages.infra.package.deleteConfirmTitle')}
          description={t('pages.infra.package.deleteConfirmContent', { name: record.name })}
          onConfirm={() => handleSingleDelete(record.id)}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
        >
          <Button {...rowActionKind('delete')} loading={deleteMutation.isPending} />
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Package>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('infra.packages')}
          columnPersistenceId="pages.infra.packages-lifecycle-v4"
          actionRef={actionRef}
          columns={columns}
          request={handleRequest}
          rowKey="id"
          showAdvancedSearch={true}
          enableRowSelection={true}
          onRowSelectionChange={handleRowSelectionChange}
          showCreateButton={true}
          onCreate={handleCreate}
          showDeleteButton={true}
          onDelete={handleBatchDelete}
          defaultPageSize={10}
          showQuickJumper={true}
        />
      </ListPageTemplate>

      {/* 编辑弹窗 */}
      <FormModalTemplate
        title={t('pages.infra.package.editTitle')}
        open={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setEditFormData(null);
        }}
        onFinish={handleModalFinish}
        isEdit
        loading={updateMutation.isPending}
        initialValues={
          editFormData
            ? {
                ...editFormData,
                features: Array.isArray(editFormData.features) ? editFormData.features.join('\n') : editFormData.features,
              }
            : undefined
        }
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <PackageForm isEdit />
      </FormModalTemplate>

      {/* 创建弹窗 */}
      <FormModalTemplate
        title={t('pages.infra.package.createTitle')}
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onFinish={handleModalFinish}
        loading={createMutation.isPending}
        initialValues={{ is_active: true }}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <PackageForm />
      </FormModalTemplate>
    </>
  );
}

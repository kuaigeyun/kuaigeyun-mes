import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Tag } from 'antd';
import {
  PlusOutlined,
  UserAddOutlined,
  UserSwitchOutlined,
  RollbackOutlined,
  SyncOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useCustomerPoolPermissions } from '../../../hooks/useCustomerPoolPermissions';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import dayjs from 'dayjs';

import { UniTable } from '../../../../../components/uni-table';
import { UniDetail } from '../../../../../components/uni-detail';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { rowActionKind } from '../../../../../components/uni-action';
import { customerApi, getUserOptions } from '../../../../master-data/services/supply-chain';
import { CustomerFormModal } from '../../../../master-data/components/CustomerFormModal';
import { CustomerDetailDrawer } from '../../../../master-data/components/CustomerDetailDrawer';
import { CustomerFollowUpFormModal } from '../../../components/CustomerFollowUpFormModal';
import { customerPoolApi, type CustomerPoolItem, type CustomerPoolRule } from '../../../services/customer-pool';
import { batchImport } from '../../../../../utils/batchOperations';
import { downloadFile } from '../../../../../utils';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../master-data/utils/factoryImportTemplate';
import type { CustomerCreate } from '../../../../master-data/types/supply-chain';

const CustomerPoolPage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>(null);
  const [scope, setScope] = useState<'pool' | 'mine' | 'all'>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const tableRowsRef = useRef<CustomerPoolItem[]>([]);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const handleScopeChange = useCallback((next: 'pool' | 'mine' | 'all') => {
    if (next === scopeRef.current) return;
    scopeRef.current = next;
    setScope(next);
    actionRef.current?.reload();
  }, []);
  const {
    canClaim,
    canAssign,
    canRelease,
    canRecycle,
    canUpdateRules,
  } = useCustomerPoolPermissions();
  const { canCreate: canCreateCustomer, canUpdate: canUpdateCustomer, canDelete: canDeleteCustomer } =
    useResourcePermissions('master-data:supply-chain:customer');
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUuid, setDetailUuid] = useState<string | null>(null);
  const [followUpCustomerId, setFollowUpCustomerId] = useState<number | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTargets, setAssignTargets] = useState<CustomerPoolItem[]>([]);
  const [assignUsers, setAssignUsers] = useState<Array<{ label: string; value: string | number }>>([]);
  const [salesmanOptions, setSalesmanOptions] = useState<Array<{ label: string; value: string | number }>>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rules, setRules] = useState<CustomerPoolRule | null>(null);
  const [assignForm] = Form.useForm<{ salesman_id: number; reason?: string }>();
  const [rulesForm] = Form.useForm<CustomerPoolRule>();
  const customerImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'field.customer.code' },
          { field: 'name', required: true, labelKey: 'field.customer.name' },
          { field: 'shortName', labelKey: 'field.customer.shortName' },
          { field: 'contactPerson', labelKey: 'field.customer.contactPerson' },
          { field: 'phone', labelKey: 'field.customer.phone' },
          { field: 'email', labelKey: 'field.customer.email' },
          { field: 'address', labelKey: 'field.customer.address' },
          { field: 'category', labelKey: 'field.customer.category' },
        ],
        [
          t('app.master-data.customers.importExample.code'),
          t('app.master-data.customers.importExample.name'),
          t('app.master-data.customers.importExample.shortName'),
          t('app.master-data.customers.importExample.contactPerson'),
          t('app.master-data.customers.importExample.phone'),
          t('app.master-data.customers.importExample.email'),
          t('app.master-data.customers.importExample.address'),
          t('app.master-data.customers.importExample.category'),
        ],
      ),
    [t],
  );

  const loadRules = async () => {
    const data = await customerPoolApi.getRules();
    setRules(data);
    rulesForm.setFieldsValue(data);
  };

  const openRules = async () => {
    try {
      await loadRules();
      setRulesOpen(true);
    } catch {
      message.error('加载客户池规则失败');
    }
  };

  const openAssignModal = async (rows: CustomerPoolItem[]) => {
    setAssignTargets(rows);
    setAssignOpen(true);
    assignForm.resetFields();
    try {
      const options = await getUserOptions();
      setAssignUsers(options || []);
    } catch {
      setAssignUsers([]);
    }
  };

  const openFollowUp = (customerId: number) => {
    setFollowUpCustomerId(customerId);
    setFollowUpOpen(true);
  };

  const openEditCustomer = (uuid: string) => {
    setEditUuid(uuid);
    setEditOpen(true);
  };

  const openCreateCustomer = useCallback(() => {
    setEditUuid(null);
    setEditOpen(true);
  }, []);

  useNewShortcut(canCreateCustomer ? openCreateCustomer : undefined);

  const openDetailCustomer = (uuid: string) => {
    setDetailUuid(uuid);
    setDetailOpen(true);
  };

  const toQuotation = (customerId: number) => {
    navigate(`/apps/kuaizhizao/sales-management/quotations/new?customerId=${customerId}`);
  };

  const confirmReleaseCustomer = useCallback(
    (row: CustomerPoolItem) => {
      modal.confirm({
        title: '确认释放客户',
        content: `确定将「${row.name}」释放回公共客户池吗？释放后将不再归属当前业务员。`,
        okText: '确认释放',
        cancelText: '取消',
        onOk: async () => {
          try {
            await customerPoolApi.release(row.id);
            message.success('已释放回公海');
            actionRef.current?.reload();
          } catch (error: any) {
            message.error(error?.message || '释放失败');
            throw error;
          }
        },
      });
    },
    [message, modal],
  );

  const claimCustomers = async (rows: CustomerPoolItem[]) => {
    if (!rows.length) {
      message.warning('请选择公共客户池客户');
      return;
    }
    try {
      const results = await Promise.allSettled(rows.map((row) => customerPoolApi.claim(row.id)));
      const success = results.filter((item) => item.status === 'fulfilled').length;
      const failed = rows.length - success;
      if (success > 0) {
        message.success(success === 1 ? '领取成功' : `已领取 ${success} 个客户`);
      }
      if (failed > 0) {
        message.warning(`${failed} 个客户领取失败`);
      }
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      message.error(error?.message || '领取失败');
    }
  };

  useEffect(() => {
    const customerId = searchParams.get('customerId');
    if (!customerId) return;
    handleScopeChange('all');
    const next = new URLSearchParams(searchParams);
    next.delete('customerId');
    setSearchParams(next, { replace: true });
  }, [handleScopeChange, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const options = await getUserOptions();
        if (!cancelled) setSalesmanOptions(options || []);
      } catch {
        if (!cancelled) setSalesmanOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const salesmanValueEnum = useMemo(
    () =>
      Object.fromEntries(
        salesmanOptions.map((option) => [String(option.value), { text: option.label }]),
      ),
    [salesmanOptions],
  );

  const poolStatusValueEnum = useMemo(
    () => ({
      pool: { text: t('app.kuaizhizao.customerPool.scopePublic') },
      owned: { text: t('app.kuaizhizao.customerPool.scopePrivate') },
    }),
    [t],
  );

  const handleDeleteCustomer = useCallback(async (row: CustomerPoolItem) => {
    if (!row.uuid) {
      message.warning('当前客户缺少唯一标识，无法删除');
      return;
    }
    try {
      await customerApi.delete(row.uuid);
      message.success('删除成功');
      setSelectedRowKeys((prev) => prev.filter((key) => String(key) !== String(row.id)));
      actionRef.current?.reload();
    } catch (error: any) {
      message.error(error?.message || '删除失败');
    }
  }, [message]);

  const columns: ProColumns<CustomerPoolItem>[] = useMemo(
    () => [
      {
        title: '关键词',
        dataIndex: 'keyword',
        hideInTable: true,
        valueType: 'text',
        fieldProps: {
          allowClear: true,
          placeholder: t('app.kuaizhizao.customerFollowUp.keywordPlaceholder'),
        },
      },
      {
        title: t('field.customer.nameCode', '客户名称/编号'),
        dataIndex: 'nameCode',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        minWidth: 260,
        hideInSearch: true,
        render: (_, row) => (
          <UniTableStackedPrimaryCell
            primary={String(row.name ?? '')}
            secondary={String(row.code ?? '')}
          />
        ),
      },
      { title: t('field.customer.code'), dataIndex: 'code', hideInTable: true, hideInSearch: true },
      { title: t('field.customer.name'), dataIndex: 'name', hideInTable: true, hideInSearch: true },
      { title: t('field.customer.contactPerson'), dataIndex: 'contact_person', width: 120, hideInSearch: true },
      { title: t('field.customer.phone'), dataIndex: 'phone', width: 140, hideInSearch: true },
      {
        title: t('field.customer.salesman'),
        dataIndex: 'salesman_name',
        width: 120,
        hideInSearch: true,
        render: (_, row) => row.salesman_name || '—',
      },
      {
        title: t('field.customer.salesman'),
        dataIndex: 'salesmanId',
        hideInTable: true,
        valueType: 'select',
        valueEnum: salesmanValueEnum,
        fieldProps: {
          options: salesmanOptions,
          showSearch: true,
          optionFilterProp: 'label',
          filterOption: (input: string, option?: { label?: React.ReactNode }) =>
            String(option?.label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase()),
          allowClear: true,
          placeholder: t('field.customer.salesmanPlaceholder'),
        },
      },
      {
        title: t('field.customer.poolStatus'),
        dataIndex: 'poolStatus',
        hideInTable: true,
        valueType: 'select',
        valueEnum: poolStatusValueEnum,
        hideInSearch: scope !== 'all',
        fieldProps: { allowClear: true },
      },
      {
        title: t('field.customer.poolStatus'),
        dataIndex: 'pool_status',
        width: 100,
        hideInSearch: true,
        render: (_, row) => (
          row.pool_status === 'pool' ? (
            <Tag color="blue">{t('app.kuaizhizao.customerPool.scopePublic')}</Tag>
          ) : (
            <Tag color="green">{t('app.kuaizhizao.customerPool.scopePrivate')}</Tag>
          )
        ),
      },
      {
        title: '最近跟进',
        dataIndex: 'last_follow_up_at',
        width: 165,
        hideInSearch: true,
        render: (_, row) => (row.last_follow_up_at ? dayjs(row.last_follow_up_at).format('YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: '预计回收',
        dataIndex: 'recycle_at',
        width: 165,
        hideInSearch: true,
        render: (_, row) => (row.recycle_at ? dayjs(row.recycle_at).format('YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: '操作',
        dataIndex: 'option',
        fixed: 'right',
        minWidth: 260,
        hideInSearch: true,
        render: (_, row) => {
          const actions: React.ReactNode[] = [];
          if (row.uuid) {
            actions.push(
              <Button {...rowActionKind('read')}
                key="detail"
                type="link"
                size="small"
                onClick={() => openDetailCustomer(row.uuid)}
              >
                {t('common.detail')}
              </Button>
            );
            if (canUpdateCustomer) {
              actions.push(
                <Button {...rowActionKind('update')}
                  key="edit"
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEditCustomer(row.uuid)}
                >
                  {t('field.customField.edit')}
                </Button>
              );
            }
            if (canDeleteCustomer) {
              actions.push(
                <Popconfirm
                  {...rowActionKind('delete')}
                  key="delete"
                  title="确认删除客户？"
                  description={`删除后不可恢复：${row.name || row.code || '该客户'}`}
                  onConfirm={() => handleDeleteCustomer(row)}
                >
                  <Button type="link" size="small" danger>
                    删除
                  </Button>
                </Popconfirm>,
              );
            }
          }
          if (row.pool_status === 'pool') {
          } else {
            actions.push(
              <Button {...rowActionKind('create')} key="follow-up" onClick={() => openFollowUp(row.id)}>
                新建跟进
              </Button>
            );
            actions.push(
              <Button {...rowActionKind('create')} key="quote" onClick={() => toQuotation(row.id)}>
                去报价
              </Button>
            );
            if (canRelease) {
              actions.push(
                <Button {...rowActionKind('release')}
                  key="release"
                  type="link"
                  size="small"
                  icon={<RollbackOutlined />}
                  onClick={() => {
                    confirmReleaseCustomer(row);
                  }}
                >
                  释放
                </Button>
              );
            }
            if (canRecycle) {
              actions.push(
                <Button {...rowActionKind('recycle')}
                  key="recycle"
                  type="link"
                  size="small"
                  icon={<SyncOutlined />}
                  onClick={async () => {
                    try {
                      await customerPoolApi.recycle(row.id);
                      message.success('已强制回收到公海');
                      actionRef.current?.reload();
                    } catch (error: any) {
                      message.error(error?.message || '回收失败');
                    }
                  }}
                >
                  强制回收
                </Button>
              );
            }
          }
          return actions;
        },
      },
    ],
    [canAssign, canClaim, canDeleteCustomer, canRecycle, canRelease, canUpdateCustomer, confirmReleaseCustomer, handleDeleteCustomer, navigate, poolStatusValueEnum, salesmanOptions, salesmanValueEnum, scope, t],
  );

  const handleBatchDelete = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning('请先选择需要删除的客户');
      return;
    }
    const rowMap = new Map(tableRowsRef.current.map((row) => [String(row.id), row]));
    let success = 0;
    let failed = 0;
    for (const key of keys) {
      const row = rowMap.get(String(key));
      if (!row?.uuid) {
        failed += 1;
        continue;
      }
      try {
        await customerApi.delete(row.uuid);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(`已删除 ${success} 个客户`);
    if (failed > 0) message.warning(`${failed} 个客户删除失败`);
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, [message]);

  const selectedPoolRows = useMemo(() => {
    const selectedSet = new Set(selectedRowKeys.map((key) => String(key)));
    return tableRowsRef.current.filter((row) => selectedSet.has(String(row.id)) && row.pool_status === 'pool');
  }, [selectedRowKeys]);

  const handleImport = useCallback(async (data: any[][]) => {
    if (!data || data.length === 0) {
      message.warning(t('app.master-data.importEmpty'));
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2);
    const nonEmptyRows = rows.filter((row: any[]) =>
      Array.isArray(row) && row.some((cell: any) => String(cell ?? '').trim() !== ''),
    );
    if (nonEmptyRows.length === 0) {
      message.warning(t('app.master-data.importNoRows'));
      return;
    }

    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      customerImportTemplate.importHeaderMap,
    );
    const codeIndex = headerIndexMap.code;
    const nameIndex = headerIndexMap.name;
    if (codeIndex === undefined || nameIndex === undefined) {
      message.error(t('app.master-data.importMissingRequiredHeaders'));
      return;
    }

    const importData: CustomerCreate[] = [];
    for (const row of nonEmptyRows) {
      const code = String(row[codeIndex] ?? '').trim();
      const name = String(row[nameIndex] ?? '').trim();
      if (!code || !name) continue;
      importData.push({
        code: code.toUpperCase(),
        name,
        shortName: headerIndexMap.shortName !== undefined ? String(row[headerIndexMap.shortName] ?? '').trim() || undefined : undefined,
        contactPerson: headerIndexMap.contactPerson !== undefined ? String(row[headerIndexMap.contactPerson] ?? '').trim() || undefined : undefined,
        phone: headerIndexMap.phone !== undefined ? String(row[headerIndexMap.phone] ?? '').trim() || undefined : undefined,
        email: headerIndexMap.email !== undefined ? String(row[headerIndexMap.email] ?? '').trim() || undefined : undefined,
        address: headerIndexMap.address !== undefined ? String(row[headerIndexMap.address] ?? '').trim() || undefined : undefined,
        category: headerIndexMap.category !== undefined ? String(row[headerIndexMap.category] ?? '').trim() || undefined : undefined,
        isActive: true,
      });
    }

    if (importData.length === 0) {
      message.warning(t('app.master-data.importNoRows'));
      return;
    }

    const result = await batchImport({
      items: importData,
      importFn: async (item: CustomerCreate) => customerApi.create(item),
      title: t('app.master-data.customers.importTitle'),
      concurrency: 5,
    });
    if (result.successCount > 0) {
      message.success(t('common.importSuccess', { count: result.successCount }));
      actionRef.current?.reload();
    }
    if (result.failureCount > 0) {
      message.warning(t('common.importPartialSuccess', { success: result.successCount, failed: result.failureCount }));
    }
  }, [customerImportTemplate.importHeaderMap, message, t]);

  const handleExport = useCallback(async (
    type: 'selected' | 'currentPage' | 'all',
    selectedKeys?: React.Key[],
    currentPageData?: CustomerPoolItem[],
  ) => {
    let exportData: CustomerPoolItem[] = [];
    if (type === 'selected' && selectedKeys?.length) {
      const selectedSet = new Set(selectedKeys.map((key) => String(key)));
      exportData = (currentPageData || []).filter((item) => selectedSet.has(String(item.id)));
    } else if (type === 'currentPage') {
      exportData = currentPageData || [];
    } else {
      const rows: CustomerPoolItem[] = [];
      const pageSize = 200;
      let skip = 0;
      let total = 0;
      do {
        const res = await customerPoolApi.list({
          scope: scopeRef.current,
          skip,
          limit: pageSize,
        });
        rows.push(...(res.items || []));
        total = res.total || 0;
        skip += pageSize;
      } while (skip < total);
      exportData = rows;
    }

    if (exportData.length === 0) {
      message.warning(t('app.master-data.noExportData'));
      return;
    }

    const headers = ['客户编号', '客户名称', '联系人', '电话', '归属业务员', '池状态', '最近跟进', '预计回收'];
    const csvRows = [headers.join(',')];
    for (const row of exportData) {
      const status = row.pool_status === 'pool' ? t('app.kuaizhizao.customerPool.scopePublic') : t('app.kuaizhizao.customerPool.scopePrivate');
      const cells = [
        row.code ?? '',
        row.name ?? '',
        row.contact_person ?? '',
        row.phone ?? '',
        row.salesman_name ?? '',
        status,
        row.last_follow_up_at ? dayjs(row.last_follow_up_at).format('YYYY-MM-DD HH:mm:ss') : '',
        row.recycle_at ? dayjs(row.recycle_at).format('YYYY-MM-DD HH:mm:ss') : '',
      ];
      csvRows.push(cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    }
    const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, `客户池_${dayjs().format('YYYY-MM-DD')}.csv`);
    message.success(t('common.exportSuccess', { count: exportData.length }));
  }, [message, t]);

  return (
    <>
      <ListPageTemplate style={{ padding: 0 }}>
        <UniTable<CustomerPoolItem>
          actionRef={actionRef}
          rowKey="id"
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          columns={columns}
          headerTitle="客户池"
          columnPersistenceId="apps.kuaizhizao.pages.sales-management.customer-pool"
          tanstackQuery={{ queryKeyPrefix: ['apps.kuaizhizao.pages.sales-management.customer-pool', scope] }}
          onTableDataChange={(data) => {
            tableRowsRef.current = data || [];
          }}
          beforeSearchButtons={
            <ThemedSegmented
              surfaceBackground
              value={scope}
              onChange={(v) => handleScopeChange(v as 'pool' | 'mine' | 'all')}
              options={[
                { label: t('app.kuaizhizao.customerPool.scopeAll'), value: 'all' },
                { label: t('app.kuaizhizao.customerPool.scopePrivate'), value: 'mine' },
                { label: t('app.kuaizhizao.customerPool.scopePublic'), value: 'pool' },
              ]}
            />
          }
          showCreateButton={canCreateCustomer}
          createButtonText={t('app.master-data.customers.create')}
          onCreate={openCreateCustomer}
          showImportButton
          onImport={handleImport}
          importHeaders={customerImportTemplate.importHeaders}
          importExampleRow={customerImportTemplate.importExampleRow}
          importFieldMap={customerImportTemplate.importHeaderMap}
          importFieldRules={{
            code: { required: true },
            name: { required: true },
          }}
          showExportButton
          onExport={handleExport}
          request={async (params, _sort, _filter, searchValues) => {
            try {
              const salesmanRaw = searchValues?.salesmanId;
              const salesmanId =
                salesmanRaw != null && salesmanRaw !== ''
                  ? Number(salesmanRaw)
                  : undefined;
              const poolStatusRaw = searchValues?.poolStatus;
              const poolStatus =
                poolStatusRaw === 'pool' || poolStatusRaw === 'owned' ? poolStatusRaw : undefined;
              const res = await customerPoolApi.list({
                scope: scopeRef.current,
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                keyword: typeof searchValues?.keyword === 'string' ? searchValues.keyword.trim() || undefined : undefined,
                salesmanId: Number.isFinite(salesmanId) && salesmanId! > 0 ? salesmanId : undefined,
                poolStatus,
              });
              return { data: res.items || [], total: res.total || 0, success: true };
            } catch {
              message.error('加载客户池失败');
              tableRowsRef.current = [];
              return { data: [], total: 0, success: false };
            }
          }}
          showDeleteButton={canDeleteCustomer}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => `确认删除选中的 ${count} 个客户？`}
          toolBarActionsAfterDelete={[
            ...(canClaim
              ? [
                  <Button
                    {...rowActionKind('claim')}
                    key="claim"
                    disabled={selectedPoolRows.length === 0}
                    onClick={() => {
                      if (selectedPoolRows.length === 0) {
                        message.warning('仅公共客户池客户支持领取');
                        return;
                      }
                      void claimCustomers(selectedPoolRows);
                    }}
                  >
                    {selectedPoolRows.length > 1 ? '批量领取' : '领取'}
                  </Button>,
                ]
              : []),
            ...(canAssign
              ? [
                  <Button
                    {...rowActionKind('assign')}
                    key="assign"
                    disabled={selectedPoolRows.length === 0}
                    onClick={async () => {
                      if (selectedPoolRows.length === 0) {
                        message.warning('仅公共客户池客户支持分配');
                        return;
                      }
                      await openAssignModal(selectedPoolRows);
                    }}
                  >
                    {selectedPoolRows.length > 1 ? '批量分配' : '分配'}
                  </Button>,
                ]
              : []),
          ]}
          toolBarActionsAfterBatch={
            canUpdateRules
              ? [
                  <Button {...rowActionKind('update')} key="rules" onClick={openRules}>
                    回收规则
                  </Button>,
                ]
              : undefined
          }
        />
      </ListPageTemplate>

      <Modal
        title={assignTargets.length > 1 ? '批量分配客户' : '分配客户'}
        open={assignOpen}
        onCancel={() => {
          setAssignOpen(false);
          setAssignTargets([]);
        }}
        onOk={async () => {
          try {
            const values = await assignForm.validateFields();
            if (!assignTargets.length) return;
            const results = await Promise.allSettled(
              assignTargets.map((target) =>
                customerPoolApi.assign(target.id, values.salesman_id, values.reason),
              ),
            );
            const success = results.filter((item) => item.status === 'fulfilled').length;
            const failed = assignTargets.length - success;
            if (success > 0) {
              message.success(success === 1 ? '分配成功' : `已分配 ${success} 个客户`);
            }
            if (failed > 0) {
              message.warning(`${failed} 个客户分配失败`);
            }
            setAssignOpen(false);
            setAssignTargets([]);
            setSelectedRowKeys([]);
            actionRef.current?.reload();
          } catch (error: any) {
            if (!error?.errorFields) message.error(error?.message || '分配失败');
          }
        }}
      >
        <Form form={assignForm} layout="vertical">
          <Form.Item name="salesman_id" label="分配给业务员" rules={[{ required: true, message: '请选择业务员' }]}>
            <Select showSearch options={assignUsers} optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="reason" label="原因">
            <Input placeholder="可选，记录分配原因" />
          </Form.Item>
        </Form>
      </Modal>

      <UniDetail
        title="客户池规则"
        open={rulesOpen}
        width={420}
        onClose={() => setRulesOpen(false)}
        extra={
          <Button
            type="primary"
            loading={rulesSaving}
            onClick={async () => {
              try {
                const values = await rulesForm.validateFields();
                setRulesSaving(true);
                const saved = await customerPoolApi.updateRules(values);
                setRules(saved);
                message.success('规则保存成功');
                setRulesOpen(false);
              } catch (error: any) {
                if (!error?.errorFields) message.error(error?.message || '规则保存失败');
              } finally {
                setRulesSaving(false);
              }
            }}
          >
            保存
          </Button>
        }
        basic={
          <Form form={rulesForm} layout="vertical" initialValues={rules || undefined}>
            <Form.Item name="recycle_enabled" label="启用自动回收" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="recycle_after_days" label="未跟进回收天数" rules={[{ required: true, message: '请输入天数' }]}>
              <InputNumber min={1} max={365} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="max_owned_customers" label="个人持有上限（0=不限制）" rules={[{ required: true, message: '请输入上限' }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="allow_claim_others" label="允许领取他人名下客户" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        }
        basicTitle="回收规则"
      >
      </UniDetail>

      <CustomerFollowUpFormModal
        open={followUpOpen}
        editing={null}
        preset={followUpCustomerId ? { customer_id: followUpCustomerId } : null}
        onClose={() => {
          setFollowUpOpen(false);
          setFollowUpCustomerId(null);
        }}
        onSuccess={() => {
          actionRef.current?.reload();
        }}
      />

      <CustomerFormModal
        open={editOpen}
        editUuid={editUuid}
        onClose={() => {
          setEditOpen(false);
          setEditUuid(null);
        }}
        onSuccess={() => {
          actionRef.current?.reload();
        }}
      />

      <CustomerDetailDrawer
        open={detailOpen}
        customerUuid={detailUuid}
        onClose={() => {
          setDetailOpen(false);
          setDetailUuid(null);
        }}
      />
    </>
  );
};

export default CustomerPoolPage;


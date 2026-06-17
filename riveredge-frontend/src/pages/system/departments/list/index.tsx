/**
 * 部门管理列表页面
 *
 * 用于系统管理员查看和管理组织内的部门。
 * 使用树形表格展示，支持统计、创建、编辑、删除等功能。
 * Schema 驱动 + 国际化
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  App,
  Alert,
  AutoComplete,
  Button,
  Col,
  Descriptions,
  Form,
  List,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { flushDrawerOpen, ListPageTemplate, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../components/uni-detail';
import { UniTable } from '../../../../components/uni-table';
import { DepartmentFormModal } from '../components/DepartmentFormModal';
import {
  getDepartmentTree,
  getDepartmentByUuid,
  deleteDepartment,
  importDepartments,
  loadPresetDepartments,
  getDepartmentPresetPreview,
  getDepartmentDatasetBinding,
  putDepartmentDatasetBinding,
  syncDepartmentsFromDataset,
  type DepartmentDatasetBindingPayload,
  type PresetDepartmentItem,
  Department,
  DepartmentTreeItem,
} from '../../../../services/department';
import { executeDatasetQuery, getDatasetList } from '../../../../services/dataset';
import { downloadFile } from '../../../../utils';
import { useTrialRunMode } from '../../../../hooks/useTrialRunMode';
import { resolvePresetDepartmentName } from '../../../../utils/presetEntityI18n';

const DepartmentListPage: React.FC = () => {
  const { t } = useTranslation();
  const trialRunMode = useTrialRunMode();
  const { message: messageApi, modal } = App.useApp();
  const actionRef = useRef<any>();
  const departmentDetailReqRef = useRef(0);

  const departmentDetailDescColumns = useMemo<ProDescriptionsItemProps<Department>[]>(
    () => [
      {
        title: t('field.department.name'),
        dataIndex: 'name',
        render: (_: unknown, entity: Department) => resolvePresetDepartmentName(entity, t),
      },
      { title: t('field.department.code'), dataIndex: 'code' },
      {
        title: t('field.department.parentName'),
        dataIndex: ['parent', 'name'],
        render: (_: unknown, record: Department) => (record as any)?.parent_name || '-',
      },
      {
        title: t('field.department.managerName'),
        dataIndex: 'manager_name',
        render: (_: unknown, entity: Department) => entity.manager_name || '-',
      },
      {
        title: t('field.role.status'),
        dataIndex: 'is_active',
        render: (_: unknown, entity: Department) => (
          <Tag color={entity?.is_active ? 'success' : 'default'}>
            {entity?.is_active ? t('field.role.enabled') : t('field.role.disabled')}
          </Tag>
        ),
      },
      { title: t('field.department.userCount'), dataIndex: 'user_count' },
      { title: t('field.department.sortOrder'), dataIndex: 'sort_order' },
      { title: t('field.department.queryCode'), dataIndex: 'query_code' },
      { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
      { title: t('field.department.remark'), dataIndex: 'description' },
    ],
    [t]
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [currentDepartmentUuid, setCurrentDepartmentUuid] = useState<string | null>(null);
  const [initialParentUuid, setInitialParentUuid] = useState<string | null>(null);

  const [deptTreeData, setDeptTreeData] = useState<DepartmentTreeItem[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [allDepts, setAllDepts] = useState<Department[]>([]);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Department | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadPresetLoading, setLoadPresetLoading] = useState(false);
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [presetList, setPresetList] = useState<PresetDepartmentItem[]>([]);
  const [selectedPresetCodes, setSelectedPresetCodes] = useState<string[]>([]);
  const [presetConfirmLoading, setPresetConfirmLoading] = useState(false);

  const [datasetBinding, setDatasetBinding] = useState<DepartmentDatasetBindingPayload | null>(null);
  const [bindingModalOpen, setBindingModalOpen] = useState(false);
  const [bindingCfgForm] = Form.useForm<DepartmentDatasetBindingPayload>();
  const bindingDatasetUuidWatched = Form.useWatch('dataset_uuid', bindingCfgForm);
  const [datasetSelectOptions, setDatasetSelectOptions] = useState<{ label: string; value: string }[]>([]);
  const [bindingModalBusy, setBindingModalBusy] = useState(false);
  const [bindingColumnOptions, setBindingColumnOptions] = useState<{ value: string; label: string }[]>([]);
  const [bindingColumnsLoading, setBindingColumnsLoading] = useState(false);
  const [syncIntroModalOpen, setSyncIntroModalOpen] = useState(false);

  useEffect(() => {
    const refresh = () => actionRef.current?.reload();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const getAllKeys = (data: DepartmentTreeItem[]): string[] => {
    let keys: string[] = [];
    data.forEach((item) => {
      keys.push(item.uuid);
      if (item.children && item.children.length > 0) {
        keys.push(...getAllKeys(item.children));
      }
    });
    return keys;
  };

  const loadBindingDatasetColumns = useCallback(
    async (datasetUuid: string | undefined, opts?: { silent?: boolean }) => {
      const uuid = (datasetUuid ?? '').trim();
      if (!uuid) {
        setBindingColumnOptions([]);
        return;
      }
      setBindingColumnsLoading(true);
      try {
        const res = await executeDatasetQuery(uuid, {
          parameters: {},
          fill_missing_sql_parameters: true,
          limit: 5,
          offset: 0,
        });
        const raw = res.columns?.length
          ? res.columns
          : res.data?.[0]
            ? Object.keys(res.data[0] as object)
            : [];
        if (!raw.length) {
          if (!opts?.silent) {
            messageApi.warning(res.error || t('common.loadFailed'));
          }
          setBindingColumnOptions([]);
          return;
        }
        const unique = [...new Set(raw.map((c) => String(c).trim()).filter(Boolean))];
        setBindingColumnOptions(unique.map((c) => ({ value: c, label: c })));
        if (!opts?.silent && unique.length) {
          messageApi.success(t('field.department.bindingColumnsLoaded', { count: unique.length }));
        }
      } catch (e) {
        if (!opts?.silent) messageApi.error((e as Error).message || t('common.operationFailed'));
        setBindingColumnOptions([]);
      } finally {
        setBindingColumnsLoading(false);
      }
    },
    [messageApi, t],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await getDepartmentDatasetBinding();
        if (cancelled) return;
        setDatasetBinding(b.dataset_uuid ? b : null);
      } catch {
        if (!cancelled) setDatasetBinding(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bindingModalOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const options: { label: string; value: string }[] = [];
        let page = 1;
        const pageSize = 100;
        for (;;) {
          const res = await getDatasetList({ page, page_size: pageSize, is_active: true });
          const items = res.items ?? [];
          for (const d of items) {
            options.push({ label: `${d.name} (${d.code})`, value: d.uuid });
          }
          if (items.length < pageSize) break;
          page += 1;
        }
        if (!cancelled) setDatasetSelectOptions(options);
      } catch (e) {
        if (!cancelled) {
          setDatasetSelectOptions([]);
          messageApi.error((e as Error).message || t('common.operationFailed'));
        }
      }
    })();
    bindingCfgForm.resetFields();
    const d = datasetBinding;
    bindingCfgForm.setFieldsValue({
      dataset_uuid: d?.dataset_uuid ?? undefined,
      department_name_column: d?.department_name_column ?? undefined,
      department_code_column: d?.department_code_column ?? undefined,
      parent_ref_column: d?.parent_ref_column ?? undefined,
      description_column: d?.description_column ?? undefined,
    });
    setBindingColumnOptions([]);
    return () => {
      cancelled = true;
    };
  }, [bindingModalOpen, datasetBinding, bindingCfgForm, messageApi, t]);

  const handleDatasetConfig = useCallback(() => {
    setBindingModalOpen(true);
  }, []);

  const canSyncFromDataset = useMemo(() => {
    const b = datasetBinding;
    return Boolean(b?.dataset_uuid?.trim() && b.department_name_column?.trim());
  }, [datasetBinding]);

  const handleBindingSave = async () => {
    const ds = String(bindingCfgForm.getFieldValue('dataset_uuid') ?? '').trim();
    if (!ds) {
      setBindingModalBusy(true);
      try {
        const saved = await putDepartmentDatasetBinding({ dataset_uuid: '' });
        setDatasetBinding(saved.dataset_uuid ? saved : null);
        messageApi.success(t('common.operationSuccess'));
        setBindingModalOpen(false);
      } catch (e) {
        messageApi.error((e as Error).message || t('common.operationFailed'));
      } finally {
        setBindingModalBusy(false);
      }
      return;
    }
    let v: Record<string, unknown>;
    try {
      v = await bindingCfgForm.validateFields();
    } catch {
      return;
    }
    setBindingModalBusy(true);
    try {
      const saved = await putDepartmentDatasetBinding({
        dataset_uuid: ds,
        department_name_column: String(v.department_name_column ?? '').trim(),
        department_code_column: String(v.department_code_column ?? '').trim() || undefined,
        parent_ref_column: String(v.parent_ref_column ?? '').trim() || undefined,
        description_column: String(v.description_column ?? '').trim() || undefined,
      });
      setDatasetBinding(saved);
      messageApi.success(t('common.operationSuccess'));
      setBindingModalOpen(false);
    } catch (e) {
      messageApi.error((e as Error).message || t('common.operationFailed'));
    } finally {
      setBindingModalBusy(false);
    }
  };

  const handleStartDatasetSync = useCallback(() => {
    setSyncIntroModalOpen(false);
    const hideLoading = messageApi.loading(t('field.department.syncIntroWarning'), 0);
    void syncDepartmentsFromDataset()
      .then((r) => {
        hideLoading();
        messageApi.success(
          t('field.department.syncComplete', { created: r.created, updated: r.updated, skipped: r.skipped }),
        );
        actionRef.current?.reload();
      })
      .catch((e) => {
        hideLoading();
        messageApi.error((e as Error).message || t('common.operationFailed'));
      });
  }, [messageApi, t]);

  const flattenTree = (nodes: DepartmentTreeItem[]): Department[] => {
    const result: Department[] = [];
    const traverse = (items: DepartmentTreeItem[]) => {
      items.forEach((node) => {
        const { children, ...rest } = node;
        result.push(rest as Department);
        if (children?.length) traverse(children);
      });
    };
    traverse(nodes);
    return result;
  };

  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: DepartmentTreeItem[]
  ) => {
    try {
      let toExport: Department[] = [];
      if (type === 'all') {
        const res = await getDepartmentTree();
        toExport = flattenTree(res.items);
      } else if (type === 'selected' && selectedRowKeys?.length) {
        const flat = flattenTree(deptTreeData);
        toExport = flat.filter((d) => selectedRowKeys.includes(d.uuid));
      } else if (type === 'currentPage' && currentPageData?.length) {
        toExport = flattenTree(currentPageData);
      } else {
        const flat = flattenTree(deptTreeData);
        toExport = flat;
      }
      if (toExport.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }
      const headers = [
        t('field.department.code'),
        t('field.department.name'),
        t('field.department.parentName'),
        t('field.role.status'),
        t('field.department.sortOrder'),
        t('common.createdAt'),
      ];
      const csvRows = [headers.join(',')];
      toExport.forEach((d) => {
        const row = [
          d.code || '',
          d.name || '',
          (d as any).parent_name || '-',
          d.is_active ? t('field.role.enabled') : t('field.role.disabled'),
          String(d.sort_order ?? ''),
          d.created_at ? new Date(d.created_at).toLocaleString() : '',
        ];
        csvRows.push(
          row.map((c) => {
            const s = String(c ?? '');
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
          }).join(',')
        );
      });
      const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
      downloadFile(blob, `departments_${new Date().toISOString().slice(0, 10)}.csv`);
      messageApi.success(t('common.exportSuccess', { count: toExport.length }));
    } catch (error: any) {
      messageApi.error(error?.message || t('common.exportFailed'));
    }
  };

  const loadData = async (params: any, _sort: any, _filter: any, searchFormValues?: any) => {
    try {
      const keyword = searchFormValues?.keyword || searchFormValues?.name || searchFormValues?.code;
      const is_active =
        searchFormValues?.is_active !== undefined && searchFormValues?.is_active !== ''
          ? searchFormValues.is_active === 'true' || searchFormValues.is_active === true
          : undefined;

      const response = await getDepartmentTree({ keyword, is_active });

      const allKeys: string[] = [];
      const traverse = (nodes: DepartmentTreeItem[]) => {
        nodes.forEach((node) => {
          allKeys.push(node.uuid);
          if (node.children) traverse(node.children);
        });
      };
      traverse(response.items);



      const flatDepts: Department[] = [];
      const flatten = (nodes: DepartmentTreeItem[]) => {
        nodes.forEach((node) => {
          const { children, ...rest } = node;
          flatDepts.push(rest as Department);
          if (children) flatten(children);
        });
      };
      flatten(response.items);
      setAllDepts(flatDepts);
      setDeptTreeData(response.items);

      if (expandedRowKeys.length === 0) {
        setExpandedRowKeys(allKeys);
      }

      return { data: response.items, success: true, total: response.total };
    } catch (error: any) {
      messageApi.error(error.message || t('common.loadFailed'));
      return { data: [], success: false, total: 0 };
    }
  };

  const handleCreate = (parentUuid?: string) => {
    setCurrentDepartmentUuid(null);
    setInitialParentUuid(parentUuid ?? null);
    setModalVisible(true);
  };

  const handleEdit = async (record: Department) => {
    setCurrentDepartmentUuid(record.uuid);
    setInitialParentUuid(null);
    setModalVisible(true);
  };

  const handleView = async (record: Department) => {
    const req = ++departmentDetailReqRef.current;
    flushDrawerOpen(() => {
      setDrawerVisible(true);
      setDetailData(null);
      setDetailLoading(true);
    });
    try {
      const detail = await getDepartmentByUuid(record.uuid);
      if (departmentDetailReqRef.current !== req) return;
      setDetailData(detail);
    } catch (error: any) {
      if (departmentDetailReqRef.current === req) {
        messageApi.error(error.message || t('common.loadFailed'));
      }
    } finally {
      if (departmentDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  const isDepartmentNotFoundError = (error: unknown): boolean => {
    const msg = String((error as { message?: string })?.message ?? '');
    const status = (error as { status?: number })?.status;
    return status === 404 || msg.includes('不存在');
  };

  const handleDelete = async (record: Department) => {
    try {
      await deleteDepartment(record.uuid);
      messageApi.success(t('pages.system.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: unknown) {
      if (isDepartmentNotFoundError(error)) {
        messageApi.warning(t('field.department.alreadyDeletedRefresh'));
        actionRef.current?.reload();
        return;
      }
      messageApi.error((error as Error).message || t('pages.system.deleteFailed'));
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;

    try {
      await Promise.all(keys.map((key) => deleteDepartment(String(key))));
      messageApi.success(t('pages.system.deleteSuccess'));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: unknown) {
      if (isDepartmentNotFoundError(error)) {
        messageApi.warning(t('field.department.alreadyDeletedRefresh'));
      } else {
        messageApi.error((error as Error).message || t('pages.system.deleteFailed'));
      }
      actionRef.current?.reload();
    }
  };

  const handleImport = async (data: any[][]) => {
    try {
      const result = await importDepartments(data);
      if (result.success_count > 0) {
        messageApi.success(t('field.department.importSuccess', { count: result.success_count }));
        actionRef.current?.reload();
      }
      if (result.failure_count > 0) {
        modal.error({
          title: t('field.department.importPartialFail'),
          content: (
            <List
              size="small"
              dataSource={result.errors}
              renderItem={(item) => (
                <List.Item>
                  {t('common.row')} {item.row}: {item.error}
                </List.Item>
              )}
            />
          ),
        });
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('field.department.importFail'));
    }
  };

  const columns: ProColumns<Department>[] = [
    {
      title: t('field.department.name'),
      dataIndex: 'name',
      width: 250,
      fixed: 'left',
      render: (_, record) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{resolvePresetDepartmentName(record, t)}</span>
          {(record.children_count || 0) > 0 && (
            <Tag color="blue" style={{ marginLeft: 4 }}>
              {t('field.department.childrenCount', { count: record.children_count })}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('field.department.code'),
      dataIndex: 'code',
      width: 150,
      copyable: true,
    },
    {
      title: t('field.department.managerName'),
      dataIndex: 'manager_name',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => record.manager_name || '-',
    },
    {
      title: t('field.department.remark'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.department.userCount'),
      dataIndex: 'user_count',
      width: 100,
      align: 'center',
      hideInSearch: true,
      render: (_, record) =>
        record.user_count ? (
          <Tag color="blue">{t('field.department.userCountTag', { count: record.user_count })}</Tag>
        ) : (
          '-'
        ),
    },
    {
      title: t('field.department.sortOrder'),
      dataIndex: 'sort_order',
      width: 80,
      valueType: 'digit',
      hideInSearch: true,
      sorter: (a, b) => a.sort_order - b.sort_order,
    },
    {
      title: t('field.role.status'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.role.enabled'), status: 'Success' },
        false: { text: t('field.role.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('field.role.enabled') : t('field.role.disabled')}
        </Tag>
      ),
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_, record) => {
        const actions: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="view" onClick={() => handleView(record)}>
            {t('field.department.view')}
          </Button>,
          <Button {...rowActionKind('update')} key="edit" onClick={() => handleEdit(record)}>
            {t('field.department.edit')}
          </Button>,
          <Button {...rowActionKind('create')}
            key="addChild"
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => handleCreate(record.uuid)}
          >
            {t('field.department.addChild')}
          </Button>,
          <Popconfirm {...rowActionKind('delete')}
            key="delete"
            title={t('field.department.deleteConfirm', { name: record.name })}
            description={t('field.department.deleteConfirmDesc')}
            onConfirm={() => handleDelete(record)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              {t('field.department.delete')}
            </Button>
          </Popconfirm>,
        ];
        return actions;
      },
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<Department>
        columnPersistenceId="pages.system.departments.list"
        permissionResource="system:department"
        viewTypes={['table', 'help']}
        actionRef={actionRef}
        headerTitle={t('field.department.listTitle')}
        rowKey="uuid"
        columns={columns}
        request={loadData}
        showCreateButton
        createButtonText={t('field.department.createTitle')}
        onCreate={() => handleCreate()}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteButtonText={t('pages.system.batchDelete')}
        deleteConfirmTitle={t('field.department.batchDeleteTitle')}
        deleteConfirmDescription={(c) => t('field.department.batchDeleteDescription', { count: c })}
        toolBarRender={() => [
          trialRunMode && (
          <Button {...rowActionKind('import')}
            key="loadPreset"
            loading={loadPresetLoading}
            onClick={async () => {
              try {
                setLoadPresetLoading(true);
                const list = await getDepartmentPresetPreview();
                setPresetList(list);
                setSelectedPresetCodes(list.map((x) => x.code));
                setPresetModalVisible(true);
              } catch (e: any) {
                messageApi.error(e?.message || t('common.operationFailed'));
              } finally {
                setLoadPresetLoading(false);
              }
            }}
          >
            {t('field.department.loadPreset')}
          </Button>
          ),
          <Button {...rowActionKind('skip')}
            key="toggleExpand"
            onClick={() => {
              if (expandedRowKeys.length > 0) {
                setExpandedRowKeys([]);
              } else {
                setExpandedRowKeys(getAllKeys(deptTreeData));
              }
            }}
          >
            {expandedRowKeys.length > 0 ? t('field.department.collapseAll') : t('field.department.expandAll')}
          </Button>,
        ]}
        showImportButton={true}
        onImport={handleImport}
        showExportButton={true}
        onExport={handleExport}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
        showAdvancedSearch={true}
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as React.Key[]),
        }}
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
        search={{ labelWidth: 'auto' }}
        showQuickJumper={false}
        showDatasetConfigButton
        onDatasetConfig={handleDatasetConfig}
        showSyncButton
        onSync={() => {
          if (!canSyncFromDataset) {
            messageApi.warning(t('field.department.syncNeedBinding'));
            return;
          }
          setSyncIntroModalOpen(true);
        }}
      />

      <Modal
        title={t('field.department.loadPreset')}
        open={presetModalVisible}
        onCancel={() => setPresetModalVisible(false)}
        width={560}
        destroyOnHidden
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => setPresetModalVisible(false)}>
            {t('common.cancel')}
          </Button>,
          <Button {...rowActionKind('audit')}
            key="confirm"
            type="primary"
            loading={presetConfirmLoading}
            disabled={selectedPresetCodes.length === 0}
            onClick={async () => {
              try {
                setPresetConfirmLoading(true);
                const res = await loadPresetDepartments(selectedPresetCodes);
                messageApi.success(res.message);
                setPresetModalVisible(false);
                actionRef.current?.reload();
              } catch (e: any) {
                messageApi.error(e?.message || t('common.operationFailed'));
              } finally {
                setPresetConfirmLoading(false);
              }
            }}
          >
            {t('common.confirm')}
          </Button>,
        ]}
      >
        <p style={{ marginBottom: 12, color: 'var(--ant-color-text-secondary)' }}>
          {t('app.master-data.presetModalDesc')}
        </p>
        <Table<PresetDepartmentItem>
          size="small"
          rowKey="code"
          dataSource={presetList}
          pagination={false}
          scroll={{ y: 280 }}
          rowSelection={{
            selectedRowKeys: selectedPresetCodes,
            onChange: (keys) => setSelectedPresetCodes(keys as string[]),
          }}
          columns={[
            {
              title: t('field.department.name'),
              dataIndex: 'name',
              width: 140,
              render: (_: unknown, row: PresetDepartmentItem) => resolvePresetDepartmentName(row, t),
            },
            { title: t('field.department.code'), dataIndex: 'code', width: 100 },
            { title: t('field.department.sortOrder'), dataIndex: 'sort_order', width: 88 },
          ]}
        />
      </Modal>

      <DepartmentFormModal
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentDepartmentUuid(null);
          setInitialParentUuid(null);
        }}
        editUuid={currentDepartmentUuid}
        initialParentUuid={initialParentUuid}
        onSuccess={() => actionRef.current?.reload()}
        deptTreeItems={deptTreeData}
      />

      <UniDetail
        title={t('field.department.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={
          detailData ? (
            <Descriptions
              column={1}
              items={detailDrawerDescriptionItems(departmentDetailDescColumns, detailData)}
            />
          ) : null
        }
      />

      <Modal
        title={t('field.department.syncIntroTitle')}
        open={syncIntroModalOpen}
        onCancel={() => setSyncIntroModalOpen(false)}
        width={560}
        destroyOnHidden
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => setSyncIntroModalOpen(false)}>
            {t('common.cancel')}
          </Button>,
          <Button {...rowActionKind('update')} key="sync" type="primary" onClick={handleStartDatasetSync}>
            {t('common.confirm')}
          </Button>,
        ]}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <div>{t('field.department.syncIntroBody')}</div>
          <Alert type="warning" showIcon title={t('field.department.syncIntroWarning')} />
        </Space>
      </Modal>

      <Modal
        title={t('field.department.datasetBindingModalTitle')}
        open={bindingModalOpen}
        onCancel={() => setBindingModalOpen(false)}
        width={640}
        destroyOnHidden
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => setBindingModalOpen(false)}>
            {t('common.cancel')}
          </Button>,
          <Button {...rowActionKind('skip')} key="save" type="primary" loading={bindingModalBusy} onClick={() => void handleBindingSave()}>
            {t('common.save')}
          </Button>,
        ]}
      >
        <Form<DepartmentDatasetBindingPayload> form={bindingCfgForm} layout="vertical">
          <Form.Item name="dataset_uuid" label={t('field.department.datasetBindingDataset')}>
            <Select
              allowClear
              showSearch
              placeholder={t('field.department.datasetBindingDatasetPlaceholder')}
              optionFilterProp="label"
              options={datasetSelectOptions}
              onChange={() => {
                bindingCfgForm.setFieldsValue({
                  department_name_column: undefined,
                  department_code_column: undefined,
                  parent_ref_column: undefined,
                  description_column: undefined,
                });
                setBindingColumnOptions([]);
              }}
            />
          </Form.Item>
          <div style={{ marginBottom: 16 }}>
            <Button
              type="link"
              size="small"
              style={{ padding: 0 }}
              loading={bindingColumnsLoading}
              disabled={!bindingDatasetUuidWatched}
              onClick={() => {
                const u = bindingDatasetUuidWatched as string | undefined;
                void loadBindingDatasetColumns(typeof u === 'string' ? u : undefined, { silent: false });
              }}
            >
              {t('field.department.datasetBindingLoadColumns')}
            </Button>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="department_name_column"
                label={t('field.department.colDepartmentName')}
                rules={[{ required: true, message: t('field.department.nameRequired') }]}
              >
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  placeholder={t('field.department.namePlaceholder')}
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department_code_column" label={t('field.department.colDepartmentCode')}>
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  placeholder={t('field.department.codePlaceholder')}
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="parent_ref_column" label={t('field.department.colParentRef')}>
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="description_column" label={t('field.department.colDescription')}>
                <AutoComplete
                  allowClear
                  options={bindingColumnOptions}
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(String(input).trim().toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          <Alert type="info" showIcon title={t('field.department.datasetBindingInfo')} />
        </Form>
      </Modal>

    </ListPageTemplate>
  );
};

export default DepartmentListPage;

/**
 * 工艺路线管理页面
 * 
 * 提供工艺路线的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space } from 'antd';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { downloadFile } from '../../../../../utils';
import { importInChunksViaPerItemCreate } from '../../../../../utils/chunkedBulkImport';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { ProcessMasterDetailDrawer } from '../shared/processMasterDetailDrawer';
import { RouteFormModal } from '../../../components/RouteFormModal';

import { processRouteApi } from '../../../services/process';
import { createProcessRouteChange, listProcessRouteChanges } from '../../../services/process-route-change';
import type { ProcessRoute } from '../../../types/process';
import {
  MASTER_DATA_LIST_FIELD_RANK,
  buildMasterCrudActiveValueEnum,
  masterCrudCodeNameSearchColumns,
  masterCrudCreatedUpdatedSnakeColumns,
  PROCESS_ROUTE_PINNED_ACTIVE_FIELD,
  processRouteActiveSearchColumn,
  resolveProcessListParams,
} from '../../../utils/processListCore';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../utils/factoryImportTemplate';
import { IMPORT_YES_NO_OPTIONS } from '../../../../../utils/loadImportDictionaryValues';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  MasterDataBatchActiveMenuButton,
  useMasterDataBatchSetActive,
} from '../../../hooks/useMasterDataBatchSetActive';
import { alignProColumns } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { renderMasterActiveTag } from '../../../utils/masterListPresentation';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { formatDateTimeBySiteSetting, todaySiteDateString } from '../../../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
/**
 * 工艺路线管理列表页面组件
 */
const ProcessRoutesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const routeActiveValueEnum = useMemo(
    () => buildMasterCrudActiveValueEnum(t, 'common.enabled', 'common.disabled'),
    [t],
  );

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [processRouteDetail, setProcessRouteDetail] = useState<ProcessRoute | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [changeRoute, setChangeRoute] = useState<ProcessRoute | null>(null);
  const [changeSubmitting, setChangeSubmitting] = useState(false);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<ProcessRoute>({ tableName: 'master_data_process_routes' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: processRouteApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });
  const routeImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'field.route.code' },
          { field: 'name', required: true, labelKey: 'field.route.name' },
          { field: 'description', labelKey: 'common.remark', aliases: ['备注', '描述'] },
          {
            field: 'isActive',
            labelKey: 'common.enabled',
            aliases: ['是否启用', '启用'],
            options: [...IMPORT_YES_NO_OPTIONS],
          },
        ],
        [
          t('app.master-data.routes.importExample.code'),
          t('app.master-data.routes.importExample.name'),
          t('app.master-data.routes.importExample.description'),
          '是',
        ],
      ),
    [t, i18n.language],
  );

  const processRouteDetailColumns: ProDescriptionsItemProps<ProcessRoute>[] = useMemo(
    () => [
      { title: t('field.route.code'), dataIndex: 'code' },
      { title: t('field.route.name'), dataIndex: 'name' },
      { title: t('common.remark'), dataIndex: 'description' },
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        render: (_: unknown, record: ProcessRoute) =>
          renderMasterActiveTag(
            t,
            record?.is_active ?? (record as any)?.isActive,
            'common.enabled',
            'common.disabled',
          ),
      },
      { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
      {
        title: t('app.master-data.routes.operationSequence'),
        dataIndex: 'operation_sequence',
        span: 2,
        render: (_: unknown, record: ProcessRoute) => {
          const seq = record?.operation_sequence ?? (record as any)?.operationSequence;
          if (!seq) {
            return <span style={{ color: '#999' }}>{t('app.master-data.routes.noOperations')}</span>;
          }

          try {
            let operations: any[] = [];

            if (Array.isArray(seq)) {
              operations = seq;
            } else if (typeof seq === 'object' && seq !== null) {
              const seqObj = seq as Record<string, unknown>;
              if (seqObj.operations && Array.isArray(seqObj.operations)) {
                operations = seqObj.operations as any[];
              } else if (seqObj.sequence && Array.isArray(seqObj.sequence)) {
                operations = (seqObj.sequence as string[]).map((uuid: string) => ({
                  uuid,
                  code: uuid.substring(0, 8),
                  name: t('app.master-data.routes.operation'),
                }));
              } else {
                const entries = Object.entries(seqObj);
                for (const [, value] of entries) {
                  if (Array.isArray(value)) {
                    operations = value as any[];
                    break;
                  }
                }

                if (operations.length === 0) {
                  const allValues = Object.values(seqObj).filter((v) => v != null);
                  if (allValues.length > 0 && Array.isArray(allValues[0])) {
                    operations = allValues[0] as any[];
                  } else if (allValues.length > 0) {
                    operations = allValues as any[];
                  }
                }
              }
            }

            if (!operations || operations.length === 0) {
              return <span style={{ color: '#999' }}>{t('app.master-data.routes.noOperations')}</span>;
            }

            const getOpLabel = (op: any, index: number) => {
              if (op?.code != null) return `${op.code} - ${op?.name ?? t('app.master-data.routes.unknownOperation')}`;
              if (op?.name != null) return op.name;
              if (op?.operation_uuid) return `${t('app.master-data.routes.operation')} ${index + 1} (${String(op.operation_uuid).slice(0, 8)}...)`;
              if (op?.operation_id) return `${t('app.master-data.routes.operation')} ${index + 1} (ID: ${op.operation_id})`;
              return `${t('app.master-data.routes.operation')} ${index + 1}`;
            };
            return (
              <div>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  {t('app.master-data.routes.operationSequenceCount', {
                    count: operations.length,
                  })}
                </div>
                <Space wrap>
                  {operations.map((op: any, index: number) => (
                    <Tag key={op?.uuid ?? op?.operation_uuid ?? index} color="blue">
                      {getOpLabel(op, index)}
                    </Tag>
                  ))}
                </Space>
              </div>
            );
          } catch (error: any) {
            console.error('解析工序序列失败:', error, seq);
            return (
              <span style={{ color: '#ff4d4f' }}>
                {t('app.master-data.routes.operationSequenceParseFailed', {
                  message: error.message,
                })}
              </span>
            );
          }
        },
      },
    ],
    [t]
  );

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = (record: ProcessRoute) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  const handleOpenRouteChange = (record: ProcessRoute) => {
    setChangeRoute(record);
  };

  const handleSubmitRouteChange = async (values: Record<string, unknown>) => {
    if (!changeRoute?.uuid) return;
    const reason = String(values.change_reason ?? '').trim();
    if (!reason) {
      messageApi.warning(t('app.master-data.route.changeReasonRequired'));
      return;
    }
    try {
      setChangeSubmitting(true);
      const pending = await listProcessRouteChanges({
        process_route_uuid: changeRoute.uuid,
        page: 1,
        page_size: 20,
      });
      const blocking = pending.items.filter((item) =>
        ['draft', 'pending', 'approved'].includes(String(item.status ?? '').toLowerCase()),
      );
      if (blocking.length > 0) {
        messageApi.warning(t('app.master-data.bom.ecnPendingExists'));
        return;
      }
      await createProcessRouteChange({
        process_route_uuid: changeRoute.uuid,
        change_type: String(values.change_type ?? 'other'),
        change_reason: reason,
        change_content: values.change_content
          ? { summary: String(values.change_content) }
          : undefined,
        status: 'draft',
      });
      messageApi.success(t('app.master-data.route.changeSubmitSuccess'));
      setChangeRoute(null);
    } catch (error: unknown) {
      messageApi.error(error instanceof Error ? error.message : t('common.saveFailed'));
    } finally {
      setChangeSubmitting(false);
    }
  };

  /**
   * 处理删除工艺路线
   */
  const handleDelete = async (record: ProcessRoute) => {
    try {
      await processRouteApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除工艺路线
   */
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const key of targetKeys) {
        try {
          await processRouteApi.delete(key.toString());
          successCount++;
        } catch (error: any) {
          failCount++;
          errors.push(error.message || t('common.deleteFailed'));
        }
      }

      if (successCount > 0) {
        messageApi.success(t('common.batchDeleteSuccess', { count: successCount }));
      }
      if (failCount > 0) {
        messageApi.error(
          t('common.batchDeletePartial', {
            count: failCount,
            errors: errors.length > 0 ? '：' + errors.join('; ') : '',
          }),
        );
      }

      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.batchDeleteFailed'));
    }
  };

  const handleImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''));
    if (rows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'));
      return;
    }
    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      routeImportTemplate.importHeaderMap,
    );
    if (headerIndexMap['code'] === undefined || headerIndexMap['name'] === undefined) {
      messageApi.error(
        t('app.master-data.importMissingField', {
          field: `${t('field.route.code')}/${t('field.route.name')}`,
          headers: headers.join(', '),
        }),
      );
      return;
    }
    const items: { code: string; name: string; description?: string; isActive?: boolean }[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    rows.forEach((row: any[], i: number) => {
      const code = (row[headerIndexMap['code']] ?? '').toString().trim();
      const name = (row[headerIndexMap['name']] ?? '').toString().trim();
      const desc =
        headerIndexMap['description'] !== undefined
          ? (row[headerIndexMap['description']] ?? '').toString().trim()
          : undefined;
      if (!code) {
        errors.push({ row: i + 3, message: t('app.master-data.routes.codeRequired') });
        return;
      }
      if (!name) {
        errors.push({ row: i + 3, message: t('app.master-data.routes.nameRequired') });
        return;
      }
      const isActiveRaw =
        headerIndexMap.isActive !== undefined ? String(row[headerIndexMap.isActive] ?? '').trim() : '';
      const isActive =
        !isActiveRaw ||
        !['0', 'false', 'no', 'n', '否', '停用', 'inactive'].includes(isActiveRaw.toLowerCase());
      items.push({ code, name, description: desc || undefined, isActive });
    });
    if (errors.length > 0) {
      getAntdModal().warning({
        title: t('app.master-data.dataValidationFailed'),
        width: 600,
        content: (
          <div>
            <p>{t('app.master-data.validationFailedIntro')}</p>
            <List size="small" dataSource={errors} renderItem={(e) => (
              <List.Item><Typography.Text type="danger">{t('app.master-data.rowError', { row: e.row, message: e.message })}</Typography.Text></List.Item>
            )} />
          </div>
        ),
      });
      return;
    }
    try {
      const result = await importInChunksViaPerItemCreate({
        items,
        createOne: async (item, _index) => processRouteApi.create(item),
        title: t('app.master-data.routes.importTitle'),
        chunkSize: 100,
        concurrency: 4,
      });
      if (result.failureCount > 0) {
        getAntdModal().warning({
          title: t('app.master-data.importPartialResultTitle'),
          width: 600,
          content: (
            <div>
              <p><strong>{t('app.master-data.importPartialResultIntro', { success: result.successCount, failure: result.failureCount })}</strong></p>
              {result.errors.length > 0 && (
                <List size="small" dataSource={result.errors} renderItem={(e) => (
                  <List.Item><Typography.Text type="danger">{t('app.master-data.rowError', { row: e.row, message: e.error })}</Typography.Text></List.Item>
                )} />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(t('app.master-data.importSuccess', { count: result.successCount }));
      }
      if (result.successCount > 0) actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.importFailed'));
    }
  };

  const handleExport = async (type: 'selected' | 'currentPage' | 'all', selectedRowKeys?: React.Key[], currentPageData?: ProcessRoute[]) => {
    try {
      let toExport: ProcessRoute[] = [];
      if (type === 'all') {
        toExport = await fetchAllListItems((p) => processRouteApi.list({ ...p, ...lastListParamsRef.current }));
      } else if (type === 'selected' && selectedRowKeys?.length && currentPageData) {
        toExport = currentPageData.filter((r) => selectedRowKeys.includes(r.uuid));
      } else if (type === 'currentPage' && currentPageData) {
        toExport = currentPageData;
      } else {
        toExport = await fetchAllListItems((p) => processRouteApi.list({ ...p, ...lastListParamsRef.current }));
      }
      if (toExport.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }
      const enabledLabel = t('common.enabled');
      const disabledLabel = t('common.disabled');
      const headers = [
        t('field.route.code'),
        t('field.route.name'),
        t('common.remark'),
        t('app.master-data.routes.status'),
        t('common.createdAt'),
      ];
      const csvRows = [headers.join(',')];
      toExport.forEach((r) => {
        const isActive = r?.is_active ?? (r as any)?.isActive;
        csvRows.push([
          r.code || '',
          r.name || '',
          (r as any).description || '',
          isActive ? enabledLabel : disabledLabel,
          r.created_at ? formatDateTimeBySiteSetting(r.created_at) : '',
        ].map((c) => {
          const s = String(c ?? '');
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(','));
      });
      const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
      downloadFile(blob, `${t('app.master-data.routes.exportFilename', { date: todaySiteDateString() })}.csv`);
      messageApi.success(t('common.exportSuccess', { count: toExport.length }));
    } catch (error: any) {
      messageApi.error(error?.message || t('common.exportFailed'));
    }
  };

  /**
   * 处理打开详情
   */
  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await processRouteApi.get(uuid);
      setProcessRouteDetail(detail);
      if (detail.id != null) {
        await loadFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      setProcessRouteDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.master-data.routes.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (record: ProcessRoute) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setProcessRouteDetail(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setProcessRouteDetail(null);
    setDetailError(null);
    resetDetailFieldValues();
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ProcessRoute>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
    ...masterCrudCodeNameSearchColumns({
      code: t('field.route.code'),
      name: t('field.route.name'),
    }),
    {
      // 稀疏：编号 → 名称 → 备注；启用 Marker；审计叠列保留
      title: t('field.route.code'),
      dataIndex: 'code',
      copyable: true,
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      fixed: 'left',
      sorter: true,
      hideInSearch: true,
      ellipsis: true,
    },
    {
      // 名称长短不一：唯一 RemainderFlex
      title: t('field.route.name'),
      dataIndex: 'name',
      minWidth: 160,
      uniTableRemainderFlex: true,
      uniTablePrimaryFlex: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
      ellipsis: true,
    },
    {
      title: t('common.remark'),
      dataIndex: 'description',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
    },
    processRouteActiveSearchColumn(t('app.master-data.routes.status'), routeActiveValueEnum),
    {
      title: t('app.master-data.routes.status'),
      dataIndex: 'is_active',
      ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
      hideInSearch: true,
      valueEnum: routeActiveValueEnum,
      render: (_: any, record: ProcessRoute) =>
        renderMasterActiveTag(t, record?.is_active ?? (record as any)?.isActive),
      sorter: true,
    },
    ...customFieldColumns,
    ...masterCrudCreatedUpdatedSnakeColumns<ProcessRoute>(t),
    {
      title: t('common.actions'),
      key: 'action',
      fixed: 'right',
      hideInSearch: true,
      render: (_: any, record: ProcessRoute) => [
        <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)} />,
        <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)} />,
        <Button
          key="change"
          {...rowActionKind('skip')}
          {...rowActionLabelKeep()}
          onClick={() => handleOpenRouteChange(record)}
        >
          {t('app.master-data.route.submitChange')}
        </Button>,
        <Popconfirm
          key="delete"
          title={t('app.master-data.routes.deleteConfirm')}
          description={t('app.master-data.routes.deleteDescription')}
          onConfirm={() => handleDelete(record)}
        >
          <Button {...rowActionKind('delete')} />
        </Popconfirm>,
      ],
    },
    ];
  }, [customFields, t, routeActiveValueEnum]);

  return (
    <ListPageTemplate>
      <UniTable<ProcessRoute>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('masterData.routes')}
        columnPersistenceId="apps.master-data.pages.process.routes.list-v3"
        actionRef={actionRef}
        columns={alignProColumns(columns, MASTER_DATA_LIST_FIELD_RANK)}
        request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
          const listParams = resolveProcessListParams(searchFormValues, sort, {
            activeField: PROCESS_ROUTE_PINNED_ACTIVE_FIELD,
          });
          lastListParamsRef.current = listParams;
          const apiParams = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            isActive: listParams.isActive as boolean | undefined,
            keyword: listParams.keyword as string | undefined,
            code: listParams.code as string | undefined,
            name: listParams.name as string | undefined,
            created_start_date: listParams.created_start_date as string | undefined,
            created_end_date: listParams.created_end_date as string | undefined,
            updated_start_date: listParams.updated_start_date as string | undefined,
            updated_end_date: listParams.updated_end_date as string | undefined,
            sortBy: listParams.sortBy as string | undefined,
            sortOrder: listParams.sortOrder as 'asc' | 'desc' | undefined,
          };

          try {
            const result = await processRouteApi.list(apiParams);
            const listData = Array.isArray(result) ? result : result?.data ?? [];
            const enrichedData = meta?.purpose === 'prefetch'
              ? listData
              : await enrichRecordsWithCustomFields(listData);
            return {
              data: enrichedData,
              success: true,
              total: typeof result?.total === 'number' ? result.total : listData.length,
            };
          } catch (error: any) {
            console.error('获取工艺路线列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.routes.listFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={PROCESS_ROUTE_PINNED_ACTIVE_FIELD}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        showCreateButton
        createButtonText={t('field.route.createTitle') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t('common.confirmBatchDeleteContent', { count })}
        toolBarActionsAfterDelete={[
          <MasterDataBatchActiveMenuButton
            menuKey="process-routes-batch-active"
            selectedRowKeys={selectedRowKeys}
            menuItems={batchActiveMenuItems}
          />,
        ]}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={routeImportTemplate.importHeaders}
        importExampleRow={routeImportTemplate.importExampleRow}
        importColumnOptions={routeImportTemplate.importColumnOptions}
        importFieldMap={routeImportTemplate.importHeaderMap}
        showExportButton={true}
        onExport={handleExport}
      />

      <ProcessMasterDetailDrawer
        title={t('app.master-data.routes.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
        detail={processRouteDetail}
        detailColumns={processRouteDetailColumns}
        customFields={customFields}
        customFieldValues={customFieldValues}
        extra={buildDetailDrawerEditExtra(t, Boolean(processRouteDetail), () => {
          if (!processRouteDetail) return;
          setEditUuid(processRouteDetail.uuid);
          setModalVisible(true);
        })}
      />

      <RouteFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />

      <FormModalTemplate
        title={t('app.master-data.route.submitChangeTitle')}
        open={!!changeRoute}
        loading={changeSubmitting}
        onClose={() => setChangeRoute(null)}
        initialValues={{ change_type: 'operation_change' }}
        onFinish={handleSubmitRouteChange}
      >
        <ProFormSelect
          name="change_type"
          label={t('app.kuaiplm.common.columns.changeType')}
          options={[
            { value: 'operation_change', label: t('app.kuaiplm.change.type.operationChange') },
            { value: 'time_change', label: t('app.kuaiplm.change.type.timeChange') },
            { value: 'sop_change', label: t('app.kuaiplm.change.type.sopChange') },
            { value: 'other', label: t('app.kuaiplm.change.type.other') },
          ]}
          rules={[{ required: true }]}
        />
        <ProFormTextArea
          name="change_reason"
          label={t('app.kuaiplm.common.columns.changeReason')}
          rules={[{ required: true }]}
        />
        <ProFormTextArea name="change_content" label={t('app.kuaiplm.change.detailContent')} />
      </FormModalTemplate>

    </ListPageTemplate>
  );
};

export default ProcessRoutesPage;

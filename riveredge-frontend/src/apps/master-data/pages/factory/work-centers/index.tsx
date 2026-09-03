import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 工作中心页面
 *
 * 提供工作中心的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { Alert, App, Button, List, Modal, Popconfirm, Typography } from 'antd';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { MasterDataDetailDrawer } from '../../shared/masterDataDetailDrawer';

import {
  workCenterApi,
  workstationApi,
  factoryListItems,
} from '../../../services/factory';
import {
  buildMasterCrudActiveValueEnum,
  buildMasterCrudActiveStatusColumn,
  MASTER_CRUD_PINNED_ACTIVE_FIELD,
  MASTER_DATA_LIST_FIELD_RANK,
  masterCrudCodeNameSearchColumns,
  masterCrudCreatedUpdatedColumns,
  normalizeMasterListResponse,
  resolveMasterCrudListParams,
} from '../../../utils/masterListCore';
import {
  renderMasterActiveTag,
} from '../../../utils/masterListPresentation';
import { WorkCenterFormModal } from '../../../components/WorkCenterFormModal';
import type { WorkCenter, WorkCenterCreate, Workstation } from '../../../types/factory';
import { downloadFile } from '../../../../../utils';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../utils/factoryImportTemplate';
import { IMPORT_YES_NO_OPTIONS } from '../../../../../utils/loadImportDictionaryValues';
import { alignProColumns } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  MasterDataBatchActiveMenuButton,
  useMasterDataBatchSetActive,
} from '../../../hooks/useMasterDataBatchSetActive';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { importInChunksViaPerItemCreate } from '../../../../../utils/chunkedBulkImport';
import { formatDateTimeBySiteSetting, todaySiteDateString } from '../../../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
/**
 * 工作中心列表页面组件
 */
const WorkCentersPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();

  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
  const [workCenterDetail, setWorkCenterDetail] = useState<WorkCenter | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [workstationMap, setWorkstationMap] = useState<Record<number, Workstation>>({});

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<WorkCenter>({ tableName: 'master_data_factory_work_centers' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: workCenterApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  useEffect(() => {
    const loadWorkstations = async () => {
      try {
        const listRes = await workstationApi.list({ limit: 1000, is_active: true });
        const list = factoryListItems(listRes);
        const map: Record<number, Workstation> = {};
        list.forEach((ws) => { map[ws.id] = ws; });
        setWorkstationMap(map);
      } catch (error) {
        console.error('加载工位列表失败:', error);
      }
    };
    loadWorkstations();
  }, []);

  /**
   * 当自定义字段加载完成后，刷新表格以显示自定义字段列
   */
  const workCenterImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'field.workCenter.code' },
          { field: 'name', required: true, labelKey: 'field.workCenter.name' },
          { field: 'description', labelKey: 'common.remark' },
          { field: 'isActive', labelKey: 'common.enabled', aliases: ['是否启用', '启用'], options: [...IMPORT_YES_NO_OPTIONS] },
        ],
        [
          t('app.master-data.workCenters.importExample.code'),
          t('app.master-data.workCenters.importExample.name'),
          t('app.master-data.workCenters.importExample.description'),
          '是',
        ],
      ),
    [t, i18n.language],
  );

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = (record: WorkCenter) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await workCenterApi.get(uuid);
      setWorkCenterDetail(detail);
      await loadFieldValuesForDetail(detail.id);
    } catch (error) {
      setWorkCenterDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.master-data.workCenters.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (record: WorkCenter) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setWorkCenterDetail(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setWorkCenterDetail(null);
    setDetailError(null);
    resetDetailFieldValues();
  };

  const handleDelete = async (record: WorkCenter) => {
    try {
      await workCenterApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'));
      return;
    }

    try {
      const uuids = targetKeys.map(key => String(key));
      const result = await workCenterApi.batchDelete(uuids);

      if (result.success) {
        messageApi.success(result.message || t('app.master-data.batchDeleteSuccess'));
      } else {
        messageApi.warning(result.message || t('app.master-data.batchDeletePartial'));
      }

      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.batchDeleteFailed'));
    }
  };

  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }

    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2);

    const nonEmptyRows = rows.filter((row: any[]) => {
      if (!row || row.length === 0) return false;
      return row.some((cell: any) => {
        const value = cell !== null && cell !== undefined ? String(cell).trim() : '';
        return value !== '';
      });
    });

    if (nonEmptyRows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'));
      return;
    }

    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      workCenterImportTemplate.importHeaderMap,
    );

    if (headerIndexMap['code'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: 'code', headers: headers.join(', ') }));
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: 'name', headers: headers.join(', ') }));
      return;
    }

    const importData: WorkCenterCreate[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    nonEmptyRows.forEach((row: any[], rowIndex: number) => {
      const isEmptyRow = !row || row.length === 0 || row.every((cell: any) => {
        const value = cell !== null && cell !== undefined ? String(cell).trim() : '';
        return value === '';
      });

      if (isEmptyRow) return;

      let actualRowIndex = rowIndex + 3;
      for (let i = 2; i < data.length; i++) {
        if (data[i] === row) {
          actualRowIndex = i + 1;
          break;
        }
      }

      try {
        const codeIndex = headerIndexMap['code'];
        const nameIndex = headerIndexMap['name'];
        const descriptionIndex = headerIndexMap['description'];

        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.headerMappingError') });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;

        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';

        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: t('field.workCenter.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('field.workCenter.nameRequired') });
          return;
        }

        const isActiveRaw =
          headerIndexMap.isActive !== undefined ? String(row[headerIndexMap.isActive] ?? '').trim() : '';
        const isActive =
          !isActiveRaw ||
          !['0', 'false', 'no', 'n', '否', '停用', 'inactive'].includes(isActiveRaw.toLowerCase());
        const workCenterData: WorkCenterCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          description: description ? String(description).trim() : undefined,
          isActive,
        };

        importData.push(workCenterData);
      } catch (error: any) {
        errors.push({
          row: actualRowIndex,
          message: error.message || t('app.master-data.dataParseFailed'),
        });
      }
    });

    if (errors.length > 0) {
      getAntdModal().warning({
        title: t('app.master-data.dataValidationFailed'),
        width: 600,
        content: (
          <div>
            <p>{t('app.master-data.validationFailedIntro')}</p>
            <List
              size="small"
              dataSource={errors}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text type="danger">
                    {t('app.master-data.rowError', { row: item.row, message: item.message })}
                  </Typography.Text>
                </List.Item>
              )}
            />
          </div>
        ),
      });
      return;
    }

    if (importData.length === 0) {
      messageApi.warning(t('app.master-data.importAllEmpty'));
      return;
    }

    try {
      const result = await importInChunksViaPerItemCreate({
        items: importData,
        createOne: async (item: WorkCenterCreate, _index) => {
          return await workCenterApi.create(item);
        },
        title: t('app.master-data.workCenters.importTitle'),
        chunkSize: 100,
        concurrency: 4,
      });

      if (result.failureCount > 0) {
        getAntdModal().warning({
          title: t('app.master-data.importPartialResultTitle'),
          width: 600,
          content: (
            <div>
              <p>
                <strong>{t('app.master-data.importPartialResultIntro', { success: result.successCount, failure: result.failureCount })}</strong>
              </p>
              {result.errors.length > 0 && (
                <List
                  size="small"
                  dataSource={result.errors}
                  renderItem={(item) => (
                    <List.Item>
                      <Typography.Text type="danger">
                        {t('app.master-data.rowError', { row: item.row, message: item.error })}
                      </Typography.Text>
                    </List.Item>
                  )}
                />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(t('app.master-data.workCenters.importSuccess', { count: result.successCount }));
      }

      if (result.successCount > 0) {
    actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.importFailed'));
    }
  };

  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: WorkCenter[]
  ) => {
    try {
      let exportData: WorkCenter[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = `${t('app.master-data.workCenters.exportFilenameSelected', { date: todaySiteDateString() })}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        exportData = currentPageData;
        filename = `${t('app.master-data.workCenters.exportFilenameCurrentPage', { date: todaySiteDateString() })}.csv`;
      } else {
        exportData = await fetchAllListItems((p) => workCenterApi.list({ ...p, ...lastListParamsRef.current }));
        filename = `${t('app.master-data.workCenters.exportFilenameAll', { date: todaySiteDateString() })}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      const headers = [t('field.workCenter.code'), t('field.workCenter.name'), t('common.remark'), t('common.status'), t('common.createdAt')];
      const csvRows: string[] = [headers.join(',')];

      exportData.forEach((item) => {
        const row = [
          item.code || '',
          item.name || '',
          item.description || '',
          item.isActive ? t('common.enabled') : t('common.disabled'),
          item.createdAt ? formatDateTimeBySiteSetting(item.createdAt) : '',
        ];
        csvRows.push(row.map(cell => {
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });

      downloadFile(blob, filename);
      messageApi.success(t('common.exportSuccess', { count: exportData.length }));
    } catch (error: any) {
      messageApi.error(error.message || t('common.exportFailed'));
    }
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  const workCenterActiveValueEnum = useMemo(
    () => buildMasterCrudActiveValueEnum(t, 'common.enabled', 'common.disabled'),
    [t],
  );

  const columns: ProColumns<WorkCenter>[] = React.useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
      ...masterCrudCodeNameSearchColumns({
        code: t('field.workCenter.code'),
        name: t('field.workCenter.name'),
      }),
    {
      title: t('field.workCenter.code'),
      dataIndex: 'code',
      width: 140,
      minWidth: 140,
      uniTableKeepWidth: true,
      resizable: false,
      fixed: 'left',
      ellipsis: true,
      copyable: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('field.workCenter.name'),
      dataIndex: 'name',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      // 备注长短不一：唯一 RemainderFlex（稀疏不叠）
      title: t('common.remark'),
      dataIndex: 'description',
      minWidth: 160,
      uniTableRemainderFlex: true,
      uniTablePrimaryFlex: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => r.description || '—',
    },
    ...customFieldColumns,
    ...buildMasterCrudActiveStatusColumn<WorkCenter>(t, {
      activeValueEnum: workCenterActiveValueEnum,
      statusTitleKey: 'common.enabled',
    }),
    ...masterCrudCreatedUpdatedColumns<WorkCenter>(t),
    {
      title: t('common.actions'),
      key: 'action',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => [
        <Button
          key="view"
          type="link"
          size="small"
          {...rowActionKind('read')}
          onClick={() => handleOpenDetail(record)}
        />,
        <Button
          key="edit"
          type="link"
          size="small"
          {...rowActionKind('update')}
          onClick={() => handleEdit(record)}
        />,
        <Popconfirm
          key="delete"
          title={t('app.master-data.workCenters.deleteConfirm')}
          description={t('app.master-data.workCenters.deleteDescription')}
          onConfirm={() => handleDelete(record)}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
        >
          <Button type="link" size="small" {...rowActionKind('delete')} />
        </Popconfirm>,
      ],
    },
    ];
  }, [customFields, t, workCenterActiveValueEnum]);

  const detailColumns: ProDescriptionsItemProps<WorkCenter>[] = [
    { title: t('field.workCenter.code'), dataIndex: 'code' },
    { title: t('field.workCenter.name'), dataIndex: 'name' },
    { title: t('common.remark'), dataIndex: 'description' },
    {
      title: t('field.workCenter.workstationIds'),
      dataIndex: 'workstationIds',
      render: (_: React.ReactNode, record: WorkCenter) => {
        const ids = record?.workstationIds ?? [];
        if (ids.length === 0) return '-';
        const labels = ids
          .map((id) => workstationMap[id])
          .filter(Boolean)
          .map((ws) => `${ws.code} - ${ws.name}`);
        return labels.join(t('common.listSeparator')) || '-';
      },
    },
    {
      title: t('common.enabled'),
      dataIndex: 'isActive',
      render: (_: React.ReactNode, record: WorkCenter) => renderMasterActiveTag(t, record?.isActive, 'common.enabled', 'common.disabled'),
    },
    { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
    { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <Alert
          type="info"
          showIcon
          closable
          style={{ marginBottom: 12 }}
          title={t('app.master-data.workCenters.dimensionHint')}
        />
        <UniTable<WorkCenter>
          columnPersistenceId="apps.master-data.pages.factory.work-centers.list-v3"
          actionRef={actionRef}
          columns={alignProColumns(columns, MASTER_DATA_LIST_FIELD_RANK)}
          viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('masterData.workCenters')}
          defaultViewType="table"
          loadingDelay={200}
          request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const listParams = resolveMasterCrudListParams(searchFormValues, sort);
            lastListParamsRef.current = listParams;

            try {
              const result = await workCenterApi.list({
                skip,
                limit: pageSize,
                ...listParams,
              });
              const { data, total } = normalizeMasterListResponse(result);
              const enrichedData = meta?.purpose === 'prefetch'
                ? data
                : await enrichRecordsWithCustomFields(data);

              return {
                data: enrichedData,
                success: true,
                total,
              };
            } catch (error: any) {
              console.error('获取工作中心列表失败:', error);
              messageApi.error(error?.message || t('app.master-data.workCenters.listFetchFailed'));
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
          pinnedTabsField={MASTER_CRUD_PINNED_ACTIVE_FIELD}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
          }}
          showCreateButton
          createButtonText={t('field.workCenter.createTitle') + NEW_SHORTCUT_HINT}
          onCreate={handleCreate}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={t('app.master-data.workCenters.batchDeleteConfirm')}
          deleteConfirmDescription={(count) =>
            t('app.master-data.workCenters.batchDeleteDescription', { count })
          }
          toolBarActionsAfterDelete={[
            <MasterDataBatchActiveMenuButton
              menuKey="work-centers-batch-active"
              selectedRowKeys={selectedRowKeys}
              menuItems={batchActiveMenuItems}
            />,
          ]}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showImportButton={true}
          onImport={handleImport}
          importHeaders={workCenterImportTemplate.importHeaders}
          importExampleRow={workCenterImportTemplate.importExampleRow}
          importColumnOptions={workCenterImportTemplate.importColumnOptions}
          importFieldMap={workCenterImportTemplate.importHeaderMap}
          showExportButton={true}
          onExport={handleExport}
        />
      </ListPageTemplate>

      <MasterDataDetailDrawer
        title={t('field.workCenter.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        detail={workCenterDetail}
        detailColumns={detailColumns}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
        customFields={customFields}
        customFieldValues={customFieldValues}
        extra={buildDetailDrawerEditExtra(t, Boolean(workCenterDetail), () => {
          if (!workCenterDetail) return;
          handleEdit(workCenterDetail);
        })}
      />

      <WorkCenterFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </>
  );
};

export default WorkCentersPage;

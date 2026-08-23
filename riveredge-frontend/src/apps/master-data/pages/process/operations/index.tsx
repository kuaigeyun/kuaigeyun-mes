/**
 * 工序信息管理页面
 * 
 * 提供工序信息的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space, Modal, Table, Select, Typography } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { EditOutlined, DeleteOutlined, PlusOutlined, QrcodeOutlined } from '@ant-design/icons';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { useTrialRunMode } from '../../../../../hooks/useTrialRunMode';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { ProcessMasterDetailDrawer } from '../shared/processMasterDetailDrawer';
import { OperationFormModal } from '../../../components/OperationFormModal';
import {
  operationApi,
  defectTypeApi,
  unwrapProcessPagedList,
  type OperationPresetCatalog,
  type OperationPresetRow,
} from '../../../services/process';
import { QRCodeGenerator } from '../../../../../components/qrcode';
import { importInChunksViaPerItemCreate } from '../../../../../utils/chunkedBulkImport';
import { qrcodeApi } from '../../../../../services/qrcode';
import type { Operation, DefectTypeMinimal } from '../../../types/process';
import {
  buildMasterCrudActiveValueEnum,
  MASTER_CRUD_PINNED_ACTIVE_FIELD,
  MASTER_DATA_LIST_FIELD_RANK,
  masterCrudCodeNameSearchColumns,
  masterCrudCreatedUpdatedColumns,
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
import {
  resolvePresetOperationIndustryName,
  resolvePresetOperationNameByKey,
  resolvePresetOperationNameByName,
  resolvePresetOperationDefectName,
} from '../../../../../utils/presetEntityI18n';
import { alignProColumns } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { todaySiteDateString } from '../../../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
import {
  buildOperationReportingTypeValueEnum,
  renderOperationActiveStatusTag,
  renderOperationDefectTypeMarkers,
  renderOperationOverReportModeMarker,
  renderOperationPersonnelMarkers,
  renderOperationReportingTypeMarker,
  resolveOperationDefaultPersonnelLabels,
} from '../../../utils/operationMeta';

/**
 * 工序信息管理列表页面组件
 */
const OperationsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const trialRunMode = useTrialRunMode();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  const operationReportingTypeValueEnum = useMemo(
    () => buildOperationReportingTypeValueEnum(t),
    [t],
  );

  const operationActiveValueEnum = useMemo(
    () => buildMasterCrudActiveValueEnum(t, 'common.enabled', 'common.disabled'),
    [t],
  );
  
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [operationDetail, setOperationDetail] = useState<Operation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [loadPresetLoading, setLoadPresetLoading] = useState(false);
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [presetCatalog, setPresetCatalog] = useState<OperationPresetCatalog | null>(null);
  const [presetIndustryId, setPresetIndustryId] = useState<string>('');
  const [selectedPresetKeys, setSelectedPresetKeys] = useState<string[]>([]);
  const [presetConfirmLoading, setPresetConfirmLoading] = useState(false);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<Operation>({ tableName: 'master_data_operations' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: operationApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  const [defectTypeImportOptions, setDefectTypeImportOptions] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await defectTypeApi.list({ limit: 2000, isActive: true });
        const list = unwrapProcessPagedList(res as any);
        if (!cancelled) {
          setDefectTypeImportOptions(
            list.map((d: any) => String(d.code || '').trim()).filter(Boolean),
          );
        }
      } catch {
        if (!cancelled) setDefectTypeImportOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [i18n.language]);
  const operationImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'field.operation.code' },
          { field: 'name', required: true, labelKey: 'field.operation.name' },
          {
            field: 'description',
            labelKey: 'common.remark',
            aliases: ['备注', '描述'],
          },
          {
            field: 'isActive',
            labelKey: 'app.master-data.operations.isActive',
            aliases: ['启用状态'],
            options: [...IMPORT_YES_NO_OPTIONS],
          },
          {
            field: 'reportingType',
            labelKey: 'field.operation.reportingType',
            aliases: ['报工类型', 'reporting_type'],
            options: ['quantity', 'status'],
          },
          {
            field: 'inspectionMode',
            labelKey: 'field.operation.inspectionMode',
            aliases: ['质检模式', 'inspection_mode'],
            options: ['none', 'simple', 'plan'],
          },
          {
            field: 'defectTypes',
            labelKey: 'app.master-data.operations.defectTypes',
            aliases: ['不良品项'],
            options: defectTypeImportOptions,
          },
        ],
        [
          t('app.master-data.operations.importExample.code'),
          t('app.master-data.operations.importExample.name'),
          t('app.master-data.operations.importExample.description'),
          t('common.enabled'),
          'quantity',
          'simple',
          t('app.master-data.operations.importExample.defectTypes'),
        ],
      ),
    [t, i18n.language, defectTypeImportOptions],
  );

  const presetOperations = useMemo(() => {
    if (!presetCatalog?.industries?.length || !presetIndustryId) return [];
    return presetCatalog.industries.find((i) => i.id === presetIndustryId)?.operations ?? [];
  }, [presetCatalog, presetIndustryId]);

  const operationDetailColumns: ProDescriptionsItemProps<Operation>[] = useMemo(
    () => [
      { title: t('field.operation.code'), dataIndex: 'code' },
      {
        title: t('field.operation.name'),
        dataIndex: 'name',
        render: (_: unknown, record: Operation) => resolvePresetOperationNameByName(record.name, t),
      },
      { title: t('common.remark'), dataIndex: 'description', span: 2 },
      {
        title: t('common.enabled'),
        dataIndex: 'isActive',
        render: (_: unknown, record: Operation) => renderOperationActiveStatusTag(t, record.isActive),
      },
      {
        title: t('field.operation.defectTypeUuids'),
        dataIndex: 'defectTypes',
        span: 2,
        render: (_: unknown, record: Operation) => {
          const dts = record.defectTypes ?? record.defect_types ?? [];
          return renderOperationDefectTypeMarkers(Array.isArray(dts) ? dts : [], 99);
        },
      },
      {
        title: t('field.operation.defaultPersonnelConfigs'),
        dataIndex: 'defaultOperatorNames',
        span: 2,
        render: (_: unknown, record: Operation) =>
          renderOperationPersonnelMarkers(resolveOperationDefaultPersonnelLabels(record), 99),
      },
      { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
    ],
    [t]
  );

  /**
   * 处理打开详情
   */
  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await operationApi.get(uuid);
      setOperationDetail(detail);
      if (detail.id != null) {
        await loadFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      setOperationDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.master-data.operations.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (record: Operation) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setOperationDetail(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  useEffect(() => {
    const operationUuid = searchParams.get('operationUuid');
    const action = searchParams.get('action');
    if (operationUuid && action === 'detail') {
      handleOpenDetail({ uuid: operationUuid } as Operation);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = (record: Operation) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理删除工序
   */
  const handleDelete = async (record: Operation) => {
    try {
      await operationApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除工序
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
          await operationApi.delete(key.toString());
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
    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      operationImportTemplate.importHeaderMap,
    );
    if (headerIndexMap['code'] === undefined || headerIndexMap['name'] === undefined) {
      messageApi.error(
        t('app.master-data.importMissingField', {
          field: `${t('field.operation.code')}、${t('field.operation.name')}`,
          headers: headers.join(', '),
        }),
      );
      return;
    }

    const parseIsActive = (cell: unknown) => {
      if (cell === true) return true;
      const s = String(cell ?? '').trim().toLowerCase();
      return s === '是' || s === '1' || s === 'true' || s === 'enabled' || s === '启用';
    };

    const allDefectInputs = new Set<string>();
    for (const row of rows) {
      if (!row?.length) continue;
      const code = String(row[headerIndexMap['code']] ?? '').trim();
      const name = String(row[headerIndexMap['name']] ?? '').trim();
      if (!code || !name) continue;
      const defectIdx = headerIndexMap['defectTypes'];
      if (defectIdx !== undefined && row[defectIdx] != null) {
        const val = String(row[defectIdx]).trim();
        if (val) {
          val.split(/[,，;；]/).forEach((part: string) => {
            const trimmed = part.trim();
            if (trimmed) allDefectInputs.add(trimmed);
          });
        }
      }
    }

    let defectMap: Record<string, string> = {};
    if (allDefectInputs.size > 0) {
      try {
        defectMap = await defectTypeApi.batchResolveOrCreate(Array.from(allDefectInputs));
      } catch (e: any) {
        messageApi.error(e?.message || t('common.exportFailed'));
        return;
      }
    }

    const items: {
      code: string;
      name: string;
      description?: string;
      isActive?: boolean;
      reportingType?: 'quantity' | 'status';
      inspectionMode?: 'none' | 'simple' | 'plan';
      defectTypeUuids?: string[];
    }[] = [];
    for (const row of rows) {
      if (!row?.length) continue;
      const code = String(row[headerIndexMap['code']] ?? '').trim();
      const name = String(row[headerIndexMap['name']] ?? '').trim();
      if (!code || !name) continue;
      let defectTypeUuids: string[] = [];
      const defectIdx = headerIndexMap['defectTypes'];
      if (defectIdx !== undefined && row[defectIdx] != null) {
        const val = String(row[defectIdx]).trim();
        if (val) {
          defectTypeUuids = val
            .split(/[,，;；]/)
            .map((s: string) => s.trim())
            .filter(Boolean)
            .map((s: string) => defectMap[s])
            .filter(Boolean);
        }
      }
      const descIdx = headerIndexMap['description'];
      const activeIdx = headerIndexMap['isActive'];
      const reportingRaw =
        headerIndexMap.reportingType !== undefined
          ? String(row[headerIndexMap.reportingType] ?? '').trim().toLowerCase()
          : '';
      const reportingType: 'quantity' | 'status' =
        reportingRaw === 'status' ? 'status' : 'quantity';
      const inspectionRaw =
        headerIndexMap.inspectionMode !== undefined
          ? String(row[headerIndexMap.inspectionMode] ?? '').trim().toLowerCase()
          : '';
      const inspectionMode: 'none' | 'simple' | 'plan' =
        inspectionRaw === 'none' || inspectionRaw === 'plan' ? inspectionRaw : 'simple';
      items.push({
        code,
        name,
        description:
          descIdx !== undefined && row[descIdx] != null ? String(row[descIdx]).trim() : undefined,
        isActive: activeIdx !== undefined ? parseIsActive(row[activeIdx]) : true,
        reportingType,
        inspectionMode,
        defectTypeUuids: defectTypeUuids.length > 0 ? defectTypeUuids : undefined,
      });
    }
    if (items.length === 0) {
      messageApi.warning(t('app.master-data.importAllEmpty'));
      return;
    }
    const result = await importInChunksViaPerItemCreate({
      items,
      createOne: async (item, _index) => operationApi.create(item),
      title: t('app.master-data.operations.importTitle'),
      chunkSize: 100,
      concurrency: 4,
    });
    if (result.successCount > 0) {
      messageApi.success(t('app.master-data.importSuccess', { count: result.successCount }));
      actionRef.current?.reload();
    }
    if (result.failureCount > 0) {
      messageApi.warning(t('app.master-data.importPartialResultIntro', { success: result.successCount, failure: result.failureCount }));
    }
  };

  const handleExport = async (type: 'selected' | 'currentPage' | 'all', selectedKeys?: React.Key[], pageData?: Operation[]) => {
    try {
      let list: Operation[] = [];
      if (type === 'selected' && selectedKeys?.length && pageData?.length) {
        list = pageData.filter((r) => selectedKeys.includes(r.uuid));
      } else if (type === 'currentPage' && pageData?.length) {
        list = pageData;
      } else {
        list = await fetchAllListItems((p) => operationApi.list({ ...p, ...lastListParamsRef.current }));
      }
      if (list.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }
      const enabledLabel = t('common.enabled');
      const disabledLabel = t('common.disabled');
      const csv = [
        [
          t('field.operation.code'),
          t('field.operation.name'),
          t('common.remark'),
          t('app.master-data.operations.isActive'),
          t('app.master-data.operations.defectTypes'),
        ].join(','),
        ...list.map((r) => {
          const dts = r.defectTypes ?? r.defect_types ?? [];
          const defectStr = Array.isArray(dts) ? dts.map((d: DefectTypeMinimal) => d.name ?? d.code).filter(Boolean).join(',') : '';
          return [r.code, r.name, r.description ?? '', r.isActive ? enabledLabel : disabledLabel, defectStr].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
        }),
      ].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t('app.master-data.operations.exportFilename', { date: todaySiteDateString() })}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      messageApi.success(t('common.exportSuccess', { count: list.length }));
    } catch (error: any) {
      messageApi.error(error?.message || t('common.exportFailed'));
    }
  };

  /**
   * 处理批量生成二维码
   */
  const handleBatchGenerateQRCode = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.master-data.operations.selectForQRCode'));
      return;
    }

    try {
      // 通过API获取选中的工序数据
      const operations = await Promise.all(
        selectedRowKeys.map(async (key) => {
          try {
            return await operationApi.get(key as string);
          } catch (error) {
            console.error(`获取工序失败: ${key}`, error);
            return null;
          }
        })
      );
      
      const validOperations = operations.filter((op) => op !== null) as Operation[];

      if (validOperations.length === 0) {
        messageApi.error(t('app.master-data.operations.getSelectedFailed'));
        return;
      }

      // 生成二维码
      const qrcodePromises = validOperations.map((operation) =>
        qrcodeApi.generateOperation({
          operation_uuid: operation.uuid,
          operation_code: operation.code || '',
          operation_name: operation.name || '',
        })
      );

      const qrcodes = await Promise.all(qrcodePromises);
      messageApi.success(t('app.master-data.operations.qrCodeGenerated', { count: qrcodes.length }));
      
      // TODO: 可以打开一个Modal显示所有二维码，或者提供下载功能
    } catch (error: any) {
      messageApi.error(`${t('app.master-data.operations.batchGenerateQrCodeFailed')}: ${error.message || t('common.unknownError')}`);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setOperationDetail(null);
    setDetailError(null);
    resetDetailFieldValues();
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Operation>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
    ...masterCrudCodeNameSearchColumns({
      code: t('field.operation.code'),
      name: t('field.operation.name'),
    }),
    {
      title: t('field.operation.code'),
      dataIndex: 'code',
      copyable: true,width: 150,
      fixed: 'left',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('field.operation.name'),
      dataIndex: 'name',
      width: 200,
      sorter: true,
      hideInSearch: true,
      render: (_: unknown, record: Operation) => resolvePresetOperationNameByName(record.name, t),
    },
    {
      title: t('common.remark'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('field.operation.reportingType'),
      dataIndex: 'reportingType',
      width: 120,
      valueType: 'select',
      valueEnum: operationReportingTypeValueEnum,
      render: (_: any, record: Operation) =>
        renderOperationReportingTypeMarker(
          t,
          record.reportingType ?? (record as { reporting_type?: string }).reporting_type,
        ),
      sorter: true,
    },
    {
      title: t('field.operation.overReportMode'),
      dataIndex: 'overReportMode',
      width: 120,
      hideInSearch: true,
      render: (_: any, record: any) =>
        renderOperationOverReportModeMarker(
          t,
          record.overReportMode ?? record.over_report_mode,
          record.overReportValue ?? record.over_report_value,
        ),
    },
    {
      title: t('field.operation.defectTypeUuids'),
      dataIndex: ['defect_types', 'defectTypes'],
      width: 180,
      hideInSearch: true,
      ellipsis: true,
      render: (_: any, record: Operation) => {
        const dts = record.defectTypes ?? record.defect_types ?? [];
        return renderOperationDefectTypeMarkers(Array.isArray(dts) ? dts : []);
      },
    },
    {
      title: t('field.operation.defaultPersonnelConfigs'),
      dataIndex: ['default_operator_names', 'defaultOperatorNames'],
      width: 180,
      hideInSearch: true,
      ellipsis: true,
      render: (_: any, record: Operation) =>
        renderOperationPersonnelMarkers(resolveOperationDefaultPersonnelLabels(record)),
    },
    {
      title: t('app.master-data.operations.isActive'),
      dataIndex: 'isActive',
      hideInTable: true,
      order: 20,
      valueType: 'select',
      valueEnum: operationActiveValueEnum,
      fieldProps: { allowClear: true },
    },
    {
      title: t('app.master-data.operations.isActive'),
      dataIndex: 'isActive',
      width: 100,
      hideInSearch: true,
      valueEnum: operationActiveValueEnum,
      render: (_: any, record: Operation) => renderOperationActiveStatusTag(t, record.isActive),
      sorter: true,
    },
    ...customFieldColumns,
    ...masterCrudCreatedUpdatedColumns<Operation>(t),
    {
      title: t('common.actions'),
      valueType: 'option',
      fixed: 'right',
      render: (_: any, record: Operation) => (
        <Space>
          <Button key="view" {...rowActionKind('read')}
            size="small"
            onClick={() => handleOpenDetail(record)}
          >
            {t('common.view')}
          </Button>
          <Button key="edit" {...rowActionKind('update')}
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('common.edit')}
          </Button>
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('common.confirmDelete')}
            description={t('app.master-data.operations.deleteConfirmDesc')}
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
    ];
  }, [customFields, t, operationActiveValueEnum, operationReportingTypeValueEnum]);

  return (
    <ListPageTemplate>
      <UniTable<Operation>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('masterData.operations')}
        columnPersistenceId="apps.master-data.pages.process.operations.status-v2"
        actionRef={actionRef}
        columns={alignProColumns(columns, MASTER_DATA_LIST_FIELD_RANK)}
        request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
          const listParams = resolveProcessListParams(searchFormValues, sort);
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
            const result = await operationApi.list(apiParams);
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
            console.error('获取工序列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.operations.listFailed'));
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
        createButtonText={t('field.operation.createTitle') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        toolBarActionsAfterCreate={[
          trialRunMode ? (
            <Button {...rowActionKind('import')}
              key="loadPreset"
              loading={loadPresetLoading}
              onClick={async () => {
                try {
                  setLoadPresetLoading(true);
                  const catalog = await operationApi.getPresetPreview();
                  setPresetCatalog(catalog);
                  const first = catalog.industries?.[0];
                  const iid = first?.id ?? '';
                  setPresetIndustryId(iid);
                  setSelectedPresetKeys((first?.operations ?? []).map((o) => o.presetKey));
                  setPresetModalVisible(true);
                } catch (e: any) {
                  messageApi.error(e?.message || t('common.operationFailed'));
                } finally {
                  setLoadPresetLoading(false);
                }
              }}
            >
              {t('field.operation.loadPreset')}
            </Button>
          ) : null,
        ].filter(Boolean)}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('common.confirmBatchDelete')}
        deleteConfirmDescription={(count) =>
          t('app.master-data.operations.confirmBatchDeleteContent', { count })
        }
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="operation-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('app.kuaiplm.phase2.common.batchActions')}
            menuItems={[
              ...batchActiveMenuItems,
              {
                key: 'batch-generate-qrcode',
                label: t('app.kuaizhizao.workOrder.batchGenerateQrcode'),
                onClick: handleBatchGenerateQRCode,
              },
            ]}
          />,
        ]}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showImportButton
        onImport={handleImport}
        importHeaders={operationImportTemplate.importHeaders}
        importExampleRow={operationImportTemplate.importExampleRow}
        importColumnOptions={operationImportTemplate.importColumnOptions}
        importFieldMap={operationImportTemplate.importHeaderMap}
        showExportButton
        onExport={handleExport}
      />

      <ProcessMasterDetailDrawer
        title={t('app.master-data.operations.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
        detail={operationDetail}
        detailColumns={operationDetailColumns}
        customFields={customFields}
        customFieldValues={customFieldValues}
        basicExtra={
          operationDetail ? (
            <QRCodeGenerator
              qrcodeType="OP"
              data={{
                operation_uuid: operationDetail.uuid,
                operation_code: operationDetail.code || '',
                operation_name: operationDetail.name || '',
              }}
              autoGenerate={true}
              showCardTitle={false}
              size={6}
              noCard={true}
            />
          ) : undefined
        }
        extra={buildDetailDrawerEditExtra(t, Boolean(operationDetail), () => {
          if (!operationDetail) return;
          setEditUuid(operationDetail.uuid);
          setModalVisible(true);
        })}
      />

      <OperationFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />

      <Modal
        title={t('field.operation.loadPreset')}
        open={presetModalVisible}
        onCancel={() => setPresetModalVisible(false)}
        width={760}
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => setPresetModalVisible(false)}>{t('common.cancel')}</Button>,
          <Button {...rowActionKind('audit')}
            key="confirm"
            type="primary"
            loading={presetConfirmLoading}
            disabled={!presetIndustryId || selectedPresetKeys.length === 0}
            onClick={async () => {
              try {
                setPresetConfirmLoading(true);
                const res = await operationApi.loadPreset(presetIndustryId, selectedPresetKeys);
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
          {t('app.master-data.operations.presetModalHint')}
        </p>
        <div style={{ marginBottom: 12 }}>
          <Typography.Text type="secondary" style={{ marginRight: 8 }}>
            {t('app.master-data.operations.presetIndustryLabel')}
          </Typography.Text>
          <Select
            style={{ minWidth: 260 }}
            placeholder={t('app.master-data.operations.presetIndustryPlaceholder')}
            value={presetIndustryId || undefined}
            options={(presetCatalog?.industries ?? []).map((ind) => ({
              value: ind.id,
              label: resolvePresetOperationIndustryName(ind.id, ind.name, t),
            }))}
            onChange={(v: string) => {
              setPresetIndustryId(v);
              const ind = presetCatalog?.industries?.find((i) => i.id === v);
              setSelectedPresetKeys((ind?.operations ?? []).map((o) => o.presetKey));
            }}
          />
        </div>
        <Table<OperationPresetRow>
          size="small"
          rowKey="presetKey"
          dataSource={presetOperations}
          locale={{
            emptyText: t('app.master-data.operations.presetEmptyIndustry'),
          }}
          pagination={false}
          scroll={{ y: 280 }}
          rowSelection={{
            selectedRowKeys: selectedPresetKeys,
            onChange: (keys) => setSelectedPresetKeys(keys as string[]),
          }}
          columns={[
            {
              title: t('field.operation.name'),
              dataIndex: 'name',
              width: 140,
              ellipsis: true,
              render: (_: unknown, row: OperationPresetRow) =>
                resolvePresetOperationNameByKey(row.presetKey, row.name, t),
            },
            {
              title: t('field.department.sortOrder'),
              dataIndex: 'sortOrder',
              width: 72,
            },
            {
              title: t('app.master-data.operations.presetDefectsColumn'),
              key: 'defects',
              ellipsis: true,
              render: (_: unknown, row) => {
                const parts = (row.defectPresets ?? [])
                  .map((d) => resolvePresetOperationDefectName(d.code, d.name, t))
                  .filter(Boolean);
                const separator = i18n.language?.startsWith('zh') ? '、' : ', ';
                const text = parts.length ? parts.join(separator) : '—';
                return (
                  <Typography.Text type="secondary" ellipsis={{ tooltip: text }}>
                    {text}
                  </Typography.Text>
                );
              },
            },
          ]}
        />
      </Modal>
    </ListPageTemplate>
  );
};

export default OperationsPage;

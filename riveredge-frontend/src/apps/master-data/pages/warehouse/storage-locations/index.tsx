/**
 * 库位管理页面
 * 
 * 提供库位的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, List, Modal, Popconfirm, Space, Typography } from 'antd';
import { downloadFile } from '../../../../../utils';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { MasterDataDetailDrawer } from '../../shared/masterDataDetailDrawer';
import { storageLocationApi, storageAreaApi } from '../../../services/warehouse';
import {
  buildMasterCrudActiveValueEnum,
  buildMasterCrudActiveStatusColumn,
  MASTER_CRUD_PINNED_ACTIVE_FIELD,
  MASTER_DATA_LIST_FIELD_RANK,
  masterCrudCodeNameSearchColumns,
  masterCrudCreatedUpdatedColumns,
  normalizeMasterListResponse,
  pickOptionalId,
  resolveMasterCrudListParams,
} from '../../../utils/masterListCore';
import {
  renderMasterActiveTag,
} from '../../../utils/masterListPresentation';
import { StorageLocationFormModal } from '../../../components/StorageLocationFormModal';
import { BatchCreateStorageLocationModal } from '../../../components/BatchCreateStorageLocationModal';
import { QRCodeGenerator } from '../../../../../components/qrcode';
import type { StorageLocation, StorageLocationCreate, StorageArea } from '../../../types/warehouse';
import { importInChunksViaPerItemCreate } from '../../../../../utils/chunkedBulkImport';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  MasterDataBatchActiveMenuButton,
  useMasterDataBatchSetActive,
} from '../../../hooks/useMasterDataBatchSetActive';
import { alignProColumns } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../utils/factoryImportTemplate';
import { IMPORT_YES_NO_OPTIONS } from '../../../../../utils/loadImportDictionaryValues';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { formatDateTimeBySiteSetting, todaySiteDateString } from '../../../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
/**
 * 库位管理列表页面组件
 */
const StorageLocationsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
  const [currentStorageLocationUuid, setCurrentStorageLocationUuid] = useState<string | null>(null);
  const [storageLocationDetail, setStorageLocationDetail] = useState<StorageLocation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑库位）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [batchCreateModalVisible, setBatchCreateModalVisible] = useState(false);
  
  // 库区列表（用于导入等）
  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<StorageLocation>({ tableName: 'master_data_warehouse_storage_locations' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: storageLocationApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  /**
   * 当自定义字段加载完成后，刷新表格以显示自定义字段列
   */
  useEffect(() => {
    const loadStorageAreas = async () => {
      try {
        const result = await storageAreaApi.list({ limit: 1000, is_active: true });
        setStorageAreas(result.items);
      } catch (error: any) {
        console.error('加载库区列表失败:', error);
      }
    };
    loadStorageAreas();
  }, []);

  const storageLocationImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'app.master-data.storageLocations.code' },
          { field: 'name', required: true, labelKey: 'app.master-data.storageLocations.name' },
          {
            field: 'storageAreaCode',
            required: true,
            labelKey: 'app.master-data.storageLocations.storageAreaCode',
          },
          { field: 'description', labelKey: 'common.remark' },
          { field: 'isActive', labelKey: 'common.enabled', aliases: ['是否启用', '启用'], options: [...IMPORT_YES_NO_OPTIONS] },
        ],
        [
          t('app.master-data.storageLocations.importExample.code'),
          t('app.master-data.storageLocations.importExample.name'),
          storageAreas.length > 0
            ? storageAreas[0].code
            : t('app.master-data.storageAreas.importExample.code'),
          t('app.master-data.storageLocations.importExample.description'),
          '是',
        ],
      ),
    [t, i18n.language, storageAreas],
  );

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  const handleEdit = (record: StorageLocation) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理删除库位
   */
  const handleDelete = async (record: StorageLocation) => {
    try {
      await storageLocationApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除库位
   */
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const toDelete = keys ?? selectedRowKeys;
    if (toDelete.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'));
      return;
    }

    try {
      const uuids = toDelete.map(key => String(key));
      const result = await storageLocationApi.batchDelete(uuids);
      
      if (result.success) {
        messageApi.success(result.message || t('app.master-data.batchDeleteSuccess'));
        setSelectedRowKeys([]);
      } else {
        messageApi.warning(result.message || t('app.master-data.batchDeletePartial'));
      }
      
      // 清空选择
      setSelectedRowKeys([]);
      // 刷新列表
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.batchDeleteFailed'));
    }
  };

  /**
   * 处理导入数据
   * 
   * 支持从 Excel 导入库位数据，批量创建库位
   * 数据格式：第一行为表头，第二行为示例数据，从第三行开始为实际数据
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }

    // 如果库区列表为空，提示用户先创建库区
    if (storageAreas.length === 0) {
      getAntdModal().warning({
        title: t('app.master-data.importDisabled'),
        content: t('app.master-data.importNoStorageArea'),
      });
      return;
    }

    // 解析表头和数据
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2); // 跳过表头和示例数据行

    // 过滤空行
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
      storageLocationImportTemplate.importHeaderMap,
    );

    // 验证必需字段
    if (headerIndexMap['code'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: 'code', headers: headers.join(', ') }));
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: 'name', headers: headers.join(', ') }));
      return;
    }
    if (headerIndexMap['storageAreaCode'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: 'storageAreaCode', headers: headers.join(', ') }));
      return;
    }

    // 解析数据行
    const importData: StorageLocationCreate[] = [];
    const errors: Array<{ row: number; message: string; kind?: 'storageArea' }> = [];

    nonEmptyRows.forEach((row: any[], rowIndex: number) => {
      const isEmptyRow = !row || row.length === 0 || row.every((cell: any) => {
        const value = cell !== null && cell !== undefined ? String(cell).trim() : '';
        return value === '';
      });

      if (isEmptyRow) {
        return;
      }

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
        const storageAreaCodeIndex = headerIndexMap['storageAreaCode'];

        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.warehouses.headerMapError') });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;
        const storageAreaCode = storageAreaCodeIndex !== undefined && row[storageAreaCodeIndex] !== undefined
          ? row[storageAreaCodeIndex]
          : undefined;
        
        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';
        
        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.storageLocations.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.storageLocations.nameRequired') });
          return;
        }

        // 处理所属库区（仅支持通过库区编号查找 storageAreaId）
        const storageAreaCodeValue = storageAreaCode ? String(storageAreaCode).trim().toUpperCase() : '';
        if (!storageAreaCodeValue) {
          errors.push({
            row: actualRowIndex,
            message: t('app.master-data.storageLocations.storageAreaRequired'),
            kind: 'storageArea',
          });
          return;
        }
        const foundStorageArea = storageAreas.find(s => s.code.toUpperCase() === storageAreaCodeValue);
        if (!foundStorageArea) {
          errors.push({
            row: actualRowIndex,
            message: t('app.master-data.storageLocations.storageAreaCodeNotExist', { value: storageAreaCodeValue }),
            kind: 'storageArea',
          });
          return;
        }

        // 构建导入数据
        const isActiveRaw =
          headerIndexMap.isActive !== undefined ? String(row[headerIndexMap.isActive] ?? '').trim() : '';
        const isActive =
          !isActiveRaw ||
          !['0', 'false', 'no', 'n', '否', '停用', 'inactive'].includes(isActiveRaw.toLowerCase());
        const storageLocationData: StorageLocationCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          storageAreaId: foundStorageArea.id,
          description: description ? String(description).trim() : undefined,
          isActive,
        };

        importData.push(storageLocationData);
      } catch (error: any) {
        errors.push({
          row: actualRowIndex,
          message: error.message || t('app.master-data.warehouses.dataParseFailed'),
        });
      }
    });

    // 如果有验证错误，显示错误信息
    if (errors.length > 0) {
      const hasStorageAreaError = errors.some(e => e.kind === 'storageArea');
      
      getAntdModal().warning({
        title: t('app.master-data.warehouses.importValidationFailed'),
        width: 700,
        content: (
          <div>
            <p>{t('app.master-data.warehouses.importValidationIntro')}</p>
            <List
              size="small"
              dataSource={errors}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text type="danger">
                    {t('app.master-data.warehouses.rowError', { row: item.row, message: item.message })}
                  </Typography.Text>
                </List.Item>
              )}
            />
            {hasStorageAreaError && storageAreas.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('app.master-data.storageLocations.availableStorageAreaList')}
                </Typography.Text>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {storageAreas.map(storageArea => (
                    <li key={storageArea.id} style={{ marginBottom: 4 }}>
                      <Typography.Text strong>{storageArea.code}</Typography.Text>
                      <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                        - {storageArea.name}
                      </Typography.Text>
                    </li>
                  ))}
                </ul>
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: '12px' }}>
                  {t('app.master-data.storageLocations.importTip', { code: storageAreas[0]?.code || '' })}
                </Typography.Text>
              </div>
            )}
          </div>
        ),
      });
      return;
    }

    if (importData.length === 0) {
      messageApi.warning(t('app.master-data.importAllEmpty'));
      return;
    }

    // 批量导入
    try {
      const result = await importInChunksViaPerItemCreate({
        items: importData,
        createOne: async (item: StorageLocationCreate, _index) => {
          return await storageLocationApi.create(item);
        },
        title: t('app.master-data.storageLocations.importTitle'),
        chunkSize: 100,
        concurrency: 4,
      });

      // 显示导入结果
      if (result.failureCount > 0) {
        getAntdModal().warning({
          title: t('app.master-data.warehouses.importPartialFailure'),
          width: 600,
          content: (
            <div>
              <p>
                <strong>{t('app.master-data.warehouses.importResult', { success: result.successCount, failure: result.failureCount })}</strong>
              </p>
              {result.errors.length > 0 && (
                <List
                  size="small"
                  dataSource={result.errors}
                  renderItem={(item) => (
                    <List.Item>
                      <Typography.Text type="danger">
                        {t('app.master-data.warehouses.rowError', { row: item.row, message: item.error })}
                      </Typography.Text>
                    </List.Item>
                  )}
                />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(t('app.master-data.importSuccess', { count: result.successCount }));
      }

      // 刷新列表
      if (result.successCount > 0) {
        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.importFailed'));
    }
  };

  /**
   * 处理批量导出库位
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: StorageLocation[]
  ) => {
    try {
      let exportData: StorageLocation[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        // 导出选中的数据
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = t('app.master-data.storageLocations.exportFilenameSelected', { date: todaySiteDateString() });
      } else if (type === 'currentPage' && currentPageData) {
        // 导出当前页数据
        exportData = currentPageData;
        filename = t('app.master-data.storageLocations.exportFilenameCurrentPage', { date: todaySiteDateString() });
      } else {
        // 导出全部数据
        exportData = await fetchAllListItems((p) => storageLocationApi.list({ ...p, ...lastListParamsRef.current }));
        filename = t('app.master-data.storageLocations.exportFilenameAll', { date: todaySiteDateString() });
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      // 构建 CSV 内容
      const headers = [t('app.master-data.storageLocations.code'), t('app.master-data.storageLocations.name'), t('app.master-data.storageLocations.storageArea'), t('common.remark'), t('common.status'), t('common.createdAt')];
      const rows = exportData.map(item => {
        const storageArea = storageAreas.find(s => s.id === item.storageAreaId);
        return [
          item.code || '',
          item.name || '',
          storageArea ? `${storageArea.code}(${storageArea.name})` : '',
          item.description || '',
          (item.isActive ?? (item as any).is_active) ? t('common.enabled') : t('common.disabled'),
          item.createdAt ? formatDateTimeBySiteSetting(item.createdAt) : '',
        ];
      });

      // 生成 CSV 内容
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // 下载文件
      downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
      messageApi.success(t('app.master-data.exportSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('common.exportFailed'));
    }
  };

  /**
   * 处理打开详情
   */
  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await storageLocationApi.get(uuid);
      setStorageLocationDetail(detail);
      await loadFieldValuesForDetail(detail.id);
    } catch (error) {
      setStorageLocationDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.master-data.storageLocations.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (record: StorageLocation) => {
    detailRetryUuidRef.current = record.uuid;
    setCurrentStorageLocationUuid(record.uuid);
    setDrawerVisible(true);
    setStorageLocationDetail(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentStorageLocationUuid(null);
    setStorageLocationDetail(null);
    setDetailError(null);
    resetDetailFieldValues();
  };

  /**
   * 获取库区名称
   */
  const getStorageAreaName = (storageAreaId: number): string => {
    const storageArea = storageAreas.find(s => s.id === storageAreaId);
    return storageArea ? `${storageArea.code} - ${storageArea.name}` : `${t('app.master-data.storageLocations.storageAreaIdPrefix')}: ${storageAreaId}`;
  };

  const formatStorageAreaDisplay = (record: StorageLocation): string => {
    const code = record.storageAreaCode ?? (record as any).storage_area_code;
    const name = record.storageAreaName ?? (record as any).storage_area_name;
    if (code != null && String(code) !== '' && name != null && String(name) !== '') {
      return `${code} - ${name}`;
    }
    return getStorageAreaName(record?.storageAreaId);
  };

  /**
   * 表格列定义
   */
  const storageLocationActiveValueEnum = useMemo(
    () => buildMasterCrudActiveValueEnum(t, 'common.enabled', 'common.disabled'),
    [t],
  );

  const columns: ProColumns<StorageLocation>[] = React.useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
      ...masterCrudCodeNameSearchColumns({
        code: t('app.master-data.storageLocations.code'),
        name: t('app.master-data.storageLocations.name'),
      }),
    {
      title: t('app.master-data.storageLocations.code'),
      dataIndex: 'code',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      fixed: 'left',
      ellipsis: true,
      copyable: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.master-data.storageLocations.name'),
      dataIndex: 'name',
      width: 168,
      minWidth: 168,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.master-data.storageLocations.storageArea'),
      dataIndex: 'storageAreaId',
      width: 200,
      order: 15,
      valueType: 'select',
      valueEnum: storageAreas.reduce(
        (acc, s) => {
          acc[s.id] = { text: `${s.code} - ${s.name}` };
          return acc;
        },
        {} as Record<number, { text: string }>
      ),
      sorter: true,
      render: (_, record) => formatStorageAreaDisplay(record),
    },
    {
      title: t('common.remark'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    // 插入自定义字段列
    ...customFieldColumns,
    ...buildMasterCrudActiveStatusColumn<StorageLocation>(t, {
      activeValueEnum: storageLocationActiveValueEnum,
    }),
    ...masterCrudCreatedUpdatedColumns<StorageLocation>(t),
    {
      title: t('common.actions'),
      key: 'action',
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => (
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
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.master-data.storageLocations.deleteConfirm')}
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
  }, [customFields, t, storageAreas, storageLocationActiveValueEnum]);

  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemProps<StorageLocation>[] = [
    {
      title: t('app.master-data.storageLocations.code'),
      dataIndex: 'code',
    copyable: true,},
    {
      title: t('app.master-data.storageLocations.name'),
      dataIndex: 'name',
    },
    {
      title: t('app.master-data.storageLocations.storageArea'),
      dataIndex: 'storageAreaId',
      key: 'storageAreaName',
      render: (_, record) => formatStorageAreaDisplay(record),
    },
    {
      title: t('common.remark'),
      dataIndex: 'description',
    },
    {
      title: t('common.status'),
      dataIndex: 'isActive',
      render: (_, record) => {
        return renderMasterActiveTag(t, record?.isActive, 'common.enabled', 'common.disabled');
      },
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<StorageLocation>
        columnPersistenceId="apps.master-data.pages.warehouse.storage-locations.list-v2"
        actionRef={actionRef}
        columns={alignProColumns(columns, MASTER_DATA_LIST_FIELD_RANK)}
        request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
          const pageSize = params.pageSize || 20;
          const skip = ((params.current || 1) - 1) * pageSize;
          const listParams = resolveMasterCrudListParams(searchFormValues, sort, {
            extra: (search) => {
              const storage_area_id = pickOptionalId(search, 'storageAreaId');
              return storage_area_id != null ? { storage_area_id } : {};
            },
          });
          lastListParamsRef.current = listParams;

          try {
            const result = await storageLocationApi.list({
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
            console.error('获取库位列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.storageLocations.getListFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        viewTypes={['table', 'help']}
        helpViewConfig={buildListPageHelpViewConfig('masterData.storageLocations')}
        defaultViewType="table"
        showImportButton={true}
        onImport={handleImport}
        importHeaders={storageLocationImportTemplate.importHeaders}
        importExampleRow={storageLocationImportTemplate.importExampleRow}
        importColumnOptions={storageLocationImportTemplate.importColumnOptions}
        importFieldMap={storageLocationImportTemplate.importHeaderMap}
        showExportButton={true}
        onExport={handleExport}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={MASTER_CRUD_PINNED_ACTIVE_FIELD}
        showCreateButton
        createButtonText={t('app.master-data.storageLocations.create')}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('app.master-data.storageLocations.batchDeleteTitle')}
        deleteConfirmDescription={(count) =>
          t('app.master-data.storageLocations.batchDeleteDescription', { count })
        }
        toolBarActionsAfterDelete={[
          <MasterDataBatchActiveMenuButton
            menuKey="storage-locations-batch-active"
            selectedRowKeys={selectedRowKeys}
            menuItems={batchActiveMenuItems}
          />,
        ]}
        toolBarActionsAfterBatch={[
          <Button {...rowActionKind('create')}
            key="batchCreate"
            icon={<PlusOutlined />}
            onClick={() => setBatchCreateModalVisible(true)}
          >
            {t('app.master-data.storageLocations.batchCreate')}
          </Button>,
        ]}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
      />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <MasterDataDetailDrawer
        title={t('app.master-data.storageLocations.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        detail={storageLocationDetail}
        detailColumns={detailColumns}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
        customFields={customFields}
        customFieldValues={customFieldValues}
        basicExtra={
          storageLocationDetail ? (
            <QRCodeGenerator
              data={{
                location_uuid: storageLocationDetail.uuid,
                location_code: storageLocationDetail.code,
                location_name: storageLocationDetail.name,
              }}
              qrcodeType="TRACE"
              size={6}
              noCard={true}
            />
          ) : undefined
        }
        extra={buildDetailDrawerEditExtra(t, Boolean(storageLocationDetail), () => {
          if (!storageLocationDetail) return;
          handleEdit(storageLocationDetail);
        })}
      />

      {/* 创建/编辑库位 Modal */}
      <StorageLocationFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />

      {/* 批量建位 Modal */}
      <BatchCreateStorageLocationModal
        open={batchCreateModalVisible}
        onClose={() => setBatchCreateModalVisible(false)}
        onSuccess={() => handleModalSuccess()}
      />
    </>
  );
};

export default StorageLocationsPage;

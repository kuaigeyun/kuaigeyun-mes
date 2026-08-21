/**
 * 库区管理页面
 * 
 * 提供库区的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, List, Modal, Popconfirm, Space, Typography } from 'antd';
import { downloadFile } from '../../../../../utils';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { MasterDataDetailDrawer } from '../../shared/masterDataDetailDrawer';
import { storageAreaApi, warehouseApi } from '../../../services/warehouse';
import {
  buildMasterCrudActiveValueEnum,
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
import { StorageAreaFormModal } from '../../../components/StorageAreaFormModal';
import { QRCodeGenerator } from '../../../../../components/qrcode';
import type { StorageArea, StorageAreaCreate, Warehouse } from '../../../types/warehouse';
import { importInChunksViaPerItemCreate } from '../../../../../utils/chunkedBulkImport';
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
import { formatDateTimeBySiteSetting, todaySiteDateString } from '../../../../../utils/format';
/**
 * 库区管理列表页面组件
 */
const StorageAreasPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
  const [currentStorageAreaUuid, setCurrentStorageAreaUuid] = useState<string | null>(null);
  const [storageAreaDetail, setStorageAreaDetail] = useState<StorageArea | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑库区）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  
  // 仓库列表（用于导入等）
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<StorageArea>({ tableName: 'master_data_warehouse_storage_areas' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: storageAreaApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  /**
   * 当自定义字段加载完成后，刷新表格以显示自定义字段列
   */
  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const result = await warehouseApi.list({ limit: 1000, is_active: true });
        setWarehouses(result.items);
      } catch (error: any) {
        console.error('加载仓库列表失败:', error);
      }
    };
    loadWarehouses();
  }, []);

  const storageAreaImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'app.master-data.storageAreas.code' },
          { field: 'name', required: true, labelKey: 'app.master-data.storageAreas.name' },
          { field: 'warehouseCode', required: true, labelKey: 'app.master-data.storageAreas.warehouseCode' },
          { field: 'description', labelKey: 'app.master-data.storageAreas.description' },
          { field: 'isActive', labelKey: 'common.enabled', aliases: ['是否启用', '启用'], options: [...IMPORT_YES_NO_OPTIONS] },
        ],
        [
          t('app.master-data.storageAreas.importExample.code'),
          t('app.master-data.storageAreas.importExample.name'),
          warehouses.length > 0
            ? warehouses[0].code
            : t('app.master-data.warehouses.importExample.code'),
          t('app.master-data.storageAreas.importExample.description'),
          '是',
        ],
      ),
    [t, i18n.language, warehouses],
  );

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = (record: StorageArea) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理删除库区
   */
  const handleDelete = async (record: StorageArea) => {
    try {
      await storageAreaApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除库区
   */
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'));
      return;
    }

    try {
      const uuids = targetKeys.map(key => String(key));
      const result = await storageAreaApi.batchDelete(uuids);
      
      if (result.success) {
        messageApi.success(result.message || t('app.master-data.batchDeleteSuccess'));
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
   * 支持从 Excel 导入库区数据，批量创建库区
   * 数据格式：第一行为表头，第二行为示例数据，从第三行开始为实际数据
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }

    // 如果仓库列表为空，提示用户先创建仓库
    if (warehouses.length === 0) {
      getAntdModal().warning({
        title: t('app.master-data.importDisabled'),
        content: t('app.master-data.importNoWarehouse'),
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
      storageAreaImportTemplate.importHeaderMap,
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
    if (headerIndexMap['warehouseCode'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: 'warehouseCode', headers: headers.join(', ') }));
      return;
    }

    // 解析数据行
    const importData: StorageAreaCreate[] = [];
    const errors: Array<{ row: number; message: string; kind?: 'warehouse' }> = [];

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
        const warehouseCodeIndex = headerIndexMap['warehouseCode'];

        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.warehouses.headerMapError') });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;
        const warehouseCode = warehouseCodeIndex !== undefined && row[warehouseCodeIndex] !== undefined
          ? row[warehouseCodeIndex]
          : undefined;
        
        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';
        
        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.storageAreas.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.storageAreas.nameRequired') });
          return;
        }

        // 处理所属仓库（仅支持通过仓库编号查找 warehouseId）
        const warehouseCodeValue = warehouseCode ? String(warehouseCode).trim().toUpperCase() : '';
        if (!warehouseCodeValue) {
          errors.push({
            row: actualRowIndex,
            message: t('app.master-data.storageAreas.warehouseRequired'),
            kind: 'warehouse',
          });
          return;
        }
        const foundWarehouse = warehouses.find(w => w.code.toUpperCase() === warehouseCodeValue);
        if (!foundWarehouse) {
          errors.push({
            row: actualRowIndex,
            message: t('app.master-data.storageAreas.warehouseCodeNotExist', { value: warehouseCodeValue }),
            kind: 'warehouse',
          });
          return;
        }

        // 构建导入数据
        const isActiveRaw =
          headerIndexMap.isActive !== undefined ? String(row[headerIndexMap.isActive] ?? '').trim() : '';
        const isActive =
          !isActiveRaw ||
          !['0', 'false', 'no', 'n', '否', '停用', 'inactive'].includes(isActiveRaw.toLowerCase());
        const storageAreaData: StorageAreaCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          warehouseId: foundWarehouse.id,
          description: description ? String(description).trim() : undefined,
          isActive,
        };

        importData.push(storageAreaData);
      } catch (error: any) {
        errors.push({
          row: actualRowIndex,
          message: error.message || t('app.master-data.warehouses.dataParseFailed'),
        });
      }
    });

    // 如果有验证错误，显示错误信息
    if (errors.length > 0) {
      const hasWarehouseError = errors.some(e => e.kind === 'warehouse');
      
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
            {hasWarehouseError && warehouses.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('app.master-data.storageAreas.availableWarehouseList')}
                </Typography.Text>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {warehouses.map(warehouse => (
                    <li key={warehouse.id} style={{ marginBottom: 4 }}>
                      <Typography.Text strong>{warehouse.code}</Typography.Text>
                      <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                        - {warehouse.name}
                      </Typography.Text>
                    </li>
                  ))}
                </ul>
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: '12px' }}>
                  {t('app.master-data.storageAreas.importTip', { code: warehouses[0]?.code || '' })}
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
        createOne: async (item: StorageAreaCreate, _index) => {
          return await storageAreaApi.create(item);
        },
        title: t('app.master-data.storageAreas.importTitle'),
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
   * 处理批量导出库区
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: StorageArea[]
  ) => {
    try {
      let exportData: StorageArea[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        // 导出选中的数据
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = t('app.master-data.storageAreas.exportFilenameSelected', { date: todaySiteDateString() });
      } else if (type === 'currentPage' && currentPageData) {
        // 导出当前页数据
        exportData = currentPageData;
        filename = t('app.master-data.storageAreas.exportFilenameCurrentPage', { date: todaySiteDateString() });
      } else {
        // 导出全部数据
        exportData = await fetchAllListItems((p) => storageAreaApi.list({ ...p, ...lastListParamsRef.current }));
        filename = t('app.master-data.storageAreas.exportFilenameAll', { date: todaySiteDateString() });
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      // 构建 CSV 内容
      const headers = [t('app.master-data.storageAreas.code'), t('app.master-data.storageAreas.name'), t('app.master-data.storageAreas.warehouse'), t('common.remark'), t('common.status'), t('common.createdAt')];
      const rows = exportData.map(item => {
        const warehouse = warehouses.find(w => w.id === item.warehouseId);
        return [
          item.code || '',
          item.name || '',
          warehouse ? `${warehouse.code}(${warehouse.name})` : '',
          item.description || '',
          item.isActive ? t('common.enabled') : t('common.disabled'),
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
      const detail = await storageAreaApi.get(uuid);
      setStorageAreaDetail(detail);
      await loadFieldValuesForDetail(detail.id);
    } catch (error) {
      setStorageAreaDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.master-data.storageAreas.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (record: StorageArea) => {
    detailRetryUuidRef.current = record.uuid;
    setCurrentStorageAreaUuid(record.uuid);
    setDrawerVisible(true);
    setStorageAreaDetail(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentStorageAreaUuid(null);
    setStorageAreaDetail(null);
    setDetailError(null);
    resetDetailFieldValues();
  };

  /**
   * 获取仓库名称
   */
  const getWarehouseName = (warehouseId: number): string => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse ? `${warehouse.code} - ${warehouse.name}` : `${t('app.master-data.storageAreas.warehouseIdPrefix')}: ${warehouseId}`;
  };

  const formatWarehouseDisplay = (record: StorageArea): string => {
    const code = record.warehouseCode ?? (record as any).warehouse_code;
    const name = record.warehouseName ?? (record as any).warehouse_name;
    if (code != null && String(code) !== '' && name != null && String(name) !== '') {
      return `${code} - ${name}`;
    }
    return getWarehouseName(record?.warehouseId);
  };

  /**
   * 表格列定义
   */
  const storageAreaActiveValueEnum = useMemo(
    () => buildMasterCrudActiveValueEnum(t, 'common.enabled', 'common.disabled'),
    [t],
  );

  const columns: ProColumns<StorageArea>[] = React.useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
      ...masterCrudCodeNameSearchColumns({
        code: t('app.master-data.storageAreas.code'),
        name: t('app.master-data.storageAreas.name'),
      }),
    {
      title: t('app.master-data.storageAreas.code'),
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
      title: t('app.master-data.storageAreas.name'),
      dataIndex: 'name',
      width: 168,
      minWidth: 168,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.master-data.storageAreas.warehouse'),
      dataIndex: 'warehouseId',
      width: 200,
      order: 15,
      valueType: 'select',
      valueEnum: warehouses.reduce(
        (acc, w) => {
          acc[w.id] = { text: `${w.code} - ${w.name}` };
          return acc;
        },
        {} as Record<number, { text: string }>
      ),
      sorter: true,
      render: (_, record) => formatWarehouseDisplay(record),
    },
    {
      title: t('common.remark'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    // 插入自定义字段列
    ...customFieldColumns,
    {
      title: t('common.status'),
      dataIndex: 'isActive',
      hideInTable: true,
      order: 20,
      valueType: 'select',
      valueEnum: storageAreaActiveValueEnum,
      fieldProps: { allowClear: true },
    },
    {
      title: t('common.status'),
      dataIndex: 'isActive',
      width: 88,
      minWidth: 88,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
      valueEnum: storageAreaActiveValueEnum,
      render: (_, record) => {
        return renderMasterActiveTag(t, record?.isActive, 'common.enabled', 'common.disabled');
      },
    },
    ...masterCrudCreatedUpdatedColumns<StorageArea>(t),
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
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.master-data.storageAreas.deleteConfirm')}
            description={t('app.master-data.storageAreas.deleteDescription')}
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
  }, [customFields, t, warehouses, storageAreaActiveValueEnum]);

  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemProps<StorageArea>[] = [
    {
      title: t('app.master-data.storageAreas.code'),
      dataIndex: 'code',
    copyable: true,},
    {
      title: t('app.master-data.storageAreas.name'),
      dataIndex: 'name',
    },
    {
      title: t('app.master-data.storageAreas.warehouse'),
      dataIndex: 'warehouseId',
      key: 'warehouseName',
      render: (_, record) => formatWarehouseDisplay(record),
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
        <UniTable<StorageArea>
        columnPersistenceId="apps.master-data.pages.warehouse.storage-areas.list-v1"
        actionRef={actionRef}
        columns={alignProColumns(columns, MASTER_DATA_LIST_FIELD_RANK)}
        request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
          const pageSize = params.pageSize || 20;
          const skip = ((params.current || 1) - 1) * pageSize;
          const listParams = resolveMasterCrudListParams(searchFormValues, sort, {
            extra: (search) => {
              const warehouse_id = pickOptionalId(search, 'warehouseId');
              return warehouse_id != null ? { warehouse_id } : {};
            },
          });
          lastListParamsRef.current = listParams;

          try {
            const result = await storageAreaApi.list({
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
            console.error('获取库区列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.storageAreas.getListFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        viewTypes={['table', 'help']}
        defaultViewType="table"
        showImportButton={true}
        onImport={handleImport}
        importHeaders={storageAreaImportTemplate.importHeaders}
        importExampleRow={storageAreaImportTemplate.importExampleRow}
        importColumnOptions={storageAreaImportTemplate.importColumnOptions}
        importFieldMap={storageAreaImportTemplate.importHeaderMap}
        showExportButton={true}
        onExport={handleExport}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={MASTER_CRUD_PINNED_ACTIVE_FIELD}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        showCreateButton
        createButtonText={t('app.master-data.storageAreas.create') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('app.master-data.storageAreas.batchDeleteTitle')}
        deleteConfirmDescription={(count) =>
          t('app.master-data.storageAreas.batchDeleteDescription', { count })
        }
        toolBarActionsAfterDelete={[
          <MasterDataBatchActiveMenuButton
            menuKey="storage-areas-batch-active"
            selectedRowKeys={selectedRowKeys}
            menuItems={batchActiveMenuItems}
          />,
        ]}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
      />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <MasterDataDetailDrawer
        title={t('app.master-data.storageAreas.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        detail={storageAreaDetail}
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
          storageAreaDetail ? (
            <QRCodeGenerator
              data={{
                area_uuid: storageAreaDetail.uuid,
                area_code: storageAreaDetail.code,
                area_name: storageAreaDetail.name,
              }}
              qrcodeType="TRACE"
              size={6}
              noCard={true}
            />
          ) : undefined
        }
        extra={buildDetailDrawerEditExtra(t, Boolean(storageAreaDetail), () => {
          if (!storageAreaDetail) return;
          handleEdit(storageAreaDetail);
        })}
      />

      {/* 创建/编辑库区 Modal */}
      <StorageAreaFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </>
  );
};

export default StorageAreasPage;

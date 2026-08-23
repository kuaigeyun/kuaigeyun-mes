import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 厂区管理页面
 * 
 * 提供厂区的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, List, Modal, Popconfirm, Space, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { MasterDataDetailDrawer } from '../../shared/masterDataDetailDrawer';

import { plantApi } from '../../../services/factory';
import {
  buildMasterCrudActiveValueEnum,
  masterCrudCreatedUpdatedColumns,
  MASTER_CRUD_PINNED_ACTIVE_FIELD,
  MASTER_DATA_LIST_FIELD_RANK,
  normalizeMasterListResponse,
  resolveMasterCrudListParams,
} from '../../../utils/masterListCore';
import {
  renderMasterActiveTag,
} from '../../../utils/masterListPresentation';
import { PlantFormModal } from '../../../components/PlantFormModal';
import type { Plant, PlantCreate } from '../../../types/factory';
import { importInChunksViaPerItemCreate } from '../../../../../utils/chunkedBulkImport';
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
import { formatDateTimeBySiteSetting, todaySiteDateString } from '../../../../../utils/format';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
/**
 * 厂区管理列表页面组件
 */
const PlantsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();

  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});

  // Modal 相关状态（创建/编辑厂区）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [plantDetail, setPlantDetail] = useState<Plant | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<Plant>({ tableName: 'master_data_factory_plants' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: plantApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });
  const plantImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'app.master-data.plants.code' },
          { field: 'name', required: true, labelKey: 'app.master-data.plants.name' },
          { field: 'address', labelKey: 'app.master-data.plants.address' },
          { field: 'description', labelKey: 'common.remark' },
          { field: 'isActive', labelKey: 'common.enabled', aliases: ['是否启用', '启用'] , options: [...IMPORT_YES_NO_OPTIONS] },
        ],
        [
          t('app.master-data.plants.importExample.code'),
          t('app.master-data.plants.importExample.name'),
          t('app.master-data.plants.importExample.address'),
          t('app.master-data.plants.importExample.description'),
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

  /**
   * 处理编辑厂区
   */
  const handleEdit = (record: Plant) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  /**
   * 处理打开详情
   */
  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await plantApi.get(uuid);
      setPlantDetail(detail);
      await loadFieldValuesForDetail(detail.id);
    } catch (error) {
      setPlantDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.master-data.plants.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (record: Plant) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setPlantDetail(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setPlantDetail(null);
    setDetailError(null);
    resetDetailFieldValues();
  };

  /**
   * 处理删除厂区
   */
  const handleDelete = async (record: Plant) => {
    try {
      await plantApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除厂区
   */
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'));
      return;
    }

    try {
      const uuids = targetKeys.map(key => String(key));
      const result = await plantApi.batchDelete(uuids);
      
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
   * 处理批量导入厂区
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }

    // 解析表头和数据
    // 第1行（索引0）：表头
    // 第2行（索引1）：示例数据（跳过）
    // 从第3行开始（索引2）：实际数据行
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2); // 跳过表头和示例数据行，从第3行开始

    // 过滤空行（所有单元格都为空或只包含空白字符的行）
    const nonEmptyRows = rows.filter((row: any[]) => {
      if (!row || row.length === 0) return false;
      // 检查行中是否有任何非空单元格
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
      plantImportTemplate.importHeaderMap,
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

    // 解析数据行（使用已过滤的非空行）
    const importData: PlantCreate[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    nonEmptyRows.forEach((row: any[], rowIndex: number) => {
      // 再次检查是否为空行（双重保险）
      const isEmptyRow = !row || row.length === 0 || row.every((cell: any) => {
        const value = cell !== null && cell !== undefined ? String(cell).trim() : '';
        return value === '';
      });

      if (isEmptyRow) {
        return; // 跳过空行
      }

      // 计算实际 Excel 行号（需要考虑原始数据中的行号）
      // 由于我们已经过滤了空行，需要找到这一行在原始数据中的位置
      let actualRowIndex = rowIndex + 3; // 默认行号（表头+示例+数据起始）
      // 尝试从原始数据中找到对应的行号
      for (let i = 2; i < data.length; i++) {
        if (data[i] === row) {
          actualRowIndex = i + 1; // Excel 行号从1开始
          break;
        }
      }

      try {
        // 提取字段值（确保数组索引有效）
        const codeIndex = headerIndexMap['code'];
        const nameIndex = headerIndexMap['name'];
        const addressIndex = headerIndexMap['address'];
        const descriptionIndex = headerIndexMap['description'];

        // 确保数组有足够的长度
        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.headerMappingError') });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const address = addressIndex !== undefined && row[addressIndex] !== undefined
          ? row[addressIndex]
          : undefined;
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;
        
        // 验证必需字段（去除空白字符后检查）
        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';
        
        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.plants.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.plants.nameRequired') });
          return;
        }

        const isActiveRaw =
          headerIndexMap.isActive !== undefined ? String(row[headerIndexMap.isActive] ?? '').trim() : '';
        const isActive =
          !isActiveRaw ||
          !['0', 'false', 'no', 'n', '否', '停用', 'inactive'].includes(isActiveRaw.toLowerCase());

        const plantData: PlantCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          address: address ? String(address).trim() : undefined,
          description: description ? String(description).trim() : undefined,
          isActive,
        };

        importData.push(plantData);
      } catch (error: any) {
        errors.push({
          row: actualRowIndex,
          message: error.message || t('app.master-data.dataParseFailed'),
        });
      }
    });

    // 如果有验证错误，显示错误信息
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

    // 批量导入
    try {
      const result = await importInChunksViaPerItemCreate({
        items: importData,
        createOne: async (item: PlantCreate, _index) => {
          return await plantApi.create(item);
        },
        title: t('app.master-data.plants.importTitle'),
        chunkSize: 100,
        concurrency: 4,
      });

      // 显示导入结果
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
        messageApi.success(t('app.master-data.plants.importSuccess', { count: result.successCount }));
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
   * 处理批量导出厂区
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Plant[]
  ) => {
    try {
      let exportData: Plant[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        // 导出选中的数据
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = `${t('app.master-data.plants.exportFilenameSelected', { date: todaySiteDateString() })}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        // 导出当前页数据
        exportData = currentPageData;
        filename = `${t('app.master-data.plants.exportFilenameCurrentPage', { date: todaySiteDateString() })}.csv`;
      } else {
        // 导出全部数据
        exportData = await fetchAllListItems((p) => plantApi.list({ ...p, ...lastListParamsRef.current }));
        filename = `${t('app.master-data.plants.exportFilenameAll', { date: todaySiteDateString() })}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      // 构建 CSV 内容
      const headers = [t('app.master-data.plants.code'), t('app.master-data.plants.name'), t('app.master-data.plants.address'), t('common.remark'), t('common.status'), t('common.createdAt')];
      const csvRows: string[] = [headers.join(',')];

      exportData.forEach((item) => {
        const row = [
          item.code || '',
          item.name || '',
          item.address || '',
          item.description || '',
          item.isActive ? t('common.enabled') : t('common.disabled'),
          item.createdAt ? formatDateTimeBySiteSetting(item.createdAt) : '',
        ];
        // 处理包含逗号、引号或换行符的字段
        csvRows.push(row.map(cell => {
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // 添加 BOM 以支持 Excel 正确显示中文
      
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

  /**
   * 表格列定义
   */
  const plantActiveValueEnum = useMemo(
    () =>
      buildMasterCrudActiveValueEnum(
        t,
        'common.enabled',
        'common.disabled',
      ),
    [t],
  );

  const columns: ProColumns<Plant>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
      {
        title: t('app.master-data.plants.code'),
        dataIndex: 'code',
        hideInTable: true,
        order: 10,
        fieldProps: { allowClear: true },
      },
      {
        title: t('app.master-data.plants.name'),
        dataIndex: 'name',
        hideInTable: true,
        order: 11,
        fieldProps: { allowClear: true },
      },
      {
        title: t('app.master-data.plants.code'),
        dataIndex: 'code',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        fixed: 'left' as const,
        ellipsis: true,
        copyable: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.master-data.plants.name'),
        dataIndex: 'name',
        width: 168,
        minWidth: 168,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.master-data.plants.address'),
        dataIndex: 'address',
        width: 200,
        minWidth: 200,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('common.remark'),
        dataIndex: 'description',
        width: 168,
        minWidth: 168,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('common.status'),
        dataIndex: 'isActive',
        hideInTable: true,
        order: 20,
        valueType: 'select',
        valueEnum: plantActiveValueEnum,
        fieldProps: { allowClear: true },
      },
      {
        title: t('common.status'),
        dataIndex: 'isActive',
        width: 88,
        minWidth: 88,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        valueEnum: plantActiveValueEnum,
        render: (_, record) =>
          renderMasterActiveTag(
            t,
            record?.isActive,
            'common.enabled',
            'common.disabled',
          ),
      },
      ...customFieldColumns,
      ...masterCrudCreatedUpdatedColumns<Plant>(t),
      {
        title: t('common.actions'),
        key: 'action',
        valueType: 'option',
        fixed: 'right' as const,
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
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.master-data.plants.deleteConfirm')}
            description={t('app.master-data.plants.deleteDescription')}
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
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
    ];
  }, [customFields, plantActiveValueEnum, t]);

  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemProps<Plant>[] = [
    { title: t('app.master-data.plants.code'), dataIndex: 'code' },
    { title: t('app.master-data.plants.name'), dataIndex: 'name' },
    { title: t('app.master-data.plants.address'), dataIndex: 'address' },
    { title: t('common.remark'), dataIndex: 'description' },
    {
      title: t('common.status'),
      dataIndex: 'isActive',
      render: (_: React.ReactNode, record: Plant) => renderMasterActiveTag(t, record?.isActive, 'common.enabled', 'common.disabled'),
    },
    { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
    { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Plant>
          columnPersistenceId="apps.master-data.pages.factory.plants.list-v1"
          actionRef={actionRef}
          columns={alignProColumns(columns, MASTER_DATA_LIST_FIELD_RANK)}
          viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('masterData.plants')}
          defaultViewType="table"
          loadingDelay={200}
          request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const listParams = resolveMasterCrudListParams(searchFormValues, sort);
            lastListParamsRef.current = listParams;

            try {
              const result = await plantApi.list({
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
              console.error('Failed to fetch plant list:', error);
              messageApi.error(error?.message || t('app.master-data.plants.listFetchFailed'));
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
          createButtonText={t('app.master-data.plants.create') + NEW_SHORTCUT_HINT}
          onCreate={handleCreate}
          showDeleteButton
          deleteButtonText={t('common.batchDelete')}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={t('app.master-data.plants.batchDeleteTitle')}
          deleteConfirmDescription={(count) =>
            t('app.master-data.plants.batchDeleteDescription', { count })
          }
          toolBarActionsAfterDelete={[
            <MasterDataBatchActiveMenuButton
              menuKey="plants-batch-active"
              selectedRowKeys={selectedRowKeys}
              menuItems={batchActiveMenuItems}
            />,
          ]}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showImportButton={true}
          onImport={handleImport}
          importHeaders={plantImportTemplate.importHeaders}
          importExampleRow={plantImportTemplate.importExampleRow}
          importColumnOptions={plantImportTemplate.importColumnOptions}
          importFieldMap={plantImportTemplate.importHeaderMap}
          showExportButton={true}
          onExport={handleExport}
        />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <MasterDataDetailDrawer
        title={t('app.master-data.plants.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        detail={plantDetail}
        detailColumns={detailColumns}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
        customFields={customFields}
        customFieldValues={customFieldValues}
        extra={buildDetailDrawerEditExtra(t, Boolean(plantDetail), () => {
          if (!plantDetail) return;
          handleEdit(plantDetail);
        })}
      />

      {/* 创建/编辑厂区 Modal */}
      <PlantFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </>
  );
};

export default PlantsPage;

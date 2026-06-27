import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 车间管理页面
 * 
 * 提供车间的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Descriptions, List, Modal, Popconfirm, Space, Tag, Typography } from 'antd';
import { downloadFile } from '../../../../../utils';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { detailDrawerDescriptionItems, DetailDrawerTemplate, DRAWER_CONFIG, ListPageTemplate } from '../../../../../components/layout-templates';

const WorkshopFormModal = lazy(() =>
  import('../../../components/WorkshopFormModal').then((m) => ({ default: m.WorkshopFormModal })),
);
import {
  workshopApi,
  plantApi,
  factoryListItems,
  applyFactoryKeyword,
  applyFactoryTableSort,
} from '../../../services/factory';
import type { Workshop, WorkshopCreate, Plant } from '../../../types/factory';
import { batchImport } from '../../../../../utils/batchOperations';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../utils/factoryImportTemplate';
import {
  MasterDataBatchActiveMenuButton,
  useMasterDataBatchSetActive,
} from '../../../hooks/useMasterDataBatchSetActive';

/**
 * 车间管理列表页面组件
 */
const WorkshopsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();

    const actionRef = useRef<ActionType>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const [drawerVisible, setDrawerVisible] = useState(false);
    const [workshopDetail, setWorkshopDetail] = useState<Workshop | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [editUuid, setEditUuid] = useState<string | null>(null);

    const [plants, setPlants] = useState<Plant[]>([]);

  const {
    customFields,
    customFieldsLoaded,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<Workshop>({ tableName: 'master_data_factory_workshops' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: workshopApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  /**
   * 加载厂区列表
   */
  useEffect(() => {
    const loadPlants = async () => {
      try {
        const plantList = await plantApi.list({ limit: 1000, is_active: true });
        setPlants(factoryListItems(plantList));
      } catch (error) {
        console.error('加载厂区列表失败:', error);
      }
    };
    loadPlants();
  }, []);

  const workshopImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'app.master-data.workshops.code' },
          { field: 'name', required: true, labelKey: 'app.master-data.workshops.name' },
          { field: 'plantCode', required: true, labelKey: 'app.master-data.workshops.plantCode' },
          { field: 'description', labelKey: 'app.master-data.workshops.description' },
        ],
        [
          t('app.master-data.workshops.importExample.code'),
          t('app.master-data.workshops.importExample.name'),
          plants.length > 0 ? plants[0].code : t('app.master-data.plants.importExample.code'),
          t('app.master-data.workshops.importExample.description'),
        ],
      ),
    [t, i18n.language, plants],
  );

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = (record: Workshop) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Workshop) => {
    try {
      setDrawerVisible(true);
      setDetailLoading(true);
      const detail = await workshopApi.get(record.uuid);
      setWorkshopDetail(detail);
      await loadFieldValuesForDetail(detail.id);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.workshops.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setWorkshopDetail(null);
    resetDetailFieldValues();
  };

  /**
   * 处理删除车间
   */
  const handleDelete = async (record: Workshop) => {
    try {
      await workshopApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除车间
   */
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'));
      return;
    }

    try {
      const uuids = targetKeys.map(key => String(key));
      const result = await workshopApi.batchDelete(uuids);
      
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
   * 支持从 Excel 导入车间数据，批量创建车间
   * 数据格式：第一行为表头，第二行为示例数据，从第三行开始为实际数据
   * 
   * 所属厂区字段说明：
   * - 可以填写厂区编号（如：PLANT001）或厂区名称（如：无锡生产基地）
   * - 系统会根据编号或名称自动匹配对应的厂区
   * - 如果厂区不存在，导入会失败并提示错误
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }

    // 如果厂区列表为空，提示用户先创建厂区
    if (plants.length === 0) {
      Modal.warning({
        title: t('app.master-data.importDisabled'),
        content: t('app.master-data.workshops.importNoPlant'),
      });
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
      workshopImportTemplate.importHeaderMap,
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
    if (headerIndexMap['plantCode'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: 'plantCode', headers: headers.join(', ') }));
      return;
    }

    // 解析数据行（使用已过滤的非空行）
    const importData: WorkshopCreate[] = [];
    const errors: Array<{ row: number; message: string; kind?: 'plant' }> = [];

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
        const descriptionIndex = headerIndexMap['description'];
        const plantCodeIndex = headerIndexMap['plantCode'];

        // 确保数组有足够的长度
        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.headerMappingError') });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;
        const plantCode = plantCodeIndex !== undefined && row[plantCodeIndex] !== undefined
          ? row[plantCodeIndex]
          : undefined;
        
        // 验证必需字段（去除空白字符后检查）
        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';
        
        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.workshops.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.workshops.nameRequired') });
          return;
        }

        // 处理所属厂区（仅支持通过厂区编号查找 plantId）
        const plantCodeValue = plantCode ? String(plantCode).trim().toUpperCase() : '';
        if (!plantCodeValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.workshops.plantRequired'), kind: 'plant' });
          return;
        }
        const foundPlant = plants.find(p => p.code.toUpperCase() === plantCodeValue);
        if (!foundPlant) {
          errors.push({
            row: actualRowIndex,
            message: t('app.master-data.plantCodeNotFound', { code: plantCodeValue }),
            kind: 'plant',
          });
          return;
        }

        // 构建导入数据（isActive 使用默认值 true，不导入）
        const workshopData: WorkshopCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          plantId: foundPlant.id,
          description: description ? String(description).trim() : undefined,
          isActive: true, // 默认启用
        };

        importData.push(workshopData);
      } catch (error: any) {
        errors.push({
          row: actualRowIndex,
          message: error.message || t('app.master-data.dataParseFailed'),
        });
      }
    });

    // 如果有验证错误，显示错误信息
    if (errors.length > 0) {
      const hasPlantError = errors.some(e => e.kind === 'plant');
      
      Modal.warning({
        title: t('app.master-data.dataValidationFailed'),
        width: 700,
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
            {hasPlantError && plants.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('app.master-data.availablePlantsList')}
                </Typography.Text>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {plants.map(plant => (
                    <li key={plant.id} style={{ marginBottom: 4 }}>
                      <Typography.Text strong>{plant.code}</Typography.Text>
                      <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                        - {plant.name}
                      </Typography.Text>
                    </li>
                  ))}
                </ul>
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: '12px' }}>
                  {t('app.master-data.plantImportHint', { code: plants[0]?.code || '' })}
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
      const result = await batchImport({
        items: importData,
        importFn: async (item: WorkshopCreate) => {
          return await workshopApi.create(item);
        },
        title: t('app.master-data.workshops.importTitle'),
        concurrency: 5,
      });

      // 显示导入结果
      if (result.failureCount > 0) {
        Modal.warning({
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
        messageApi.success(t('app.master-data.workshops.importSuccess', { count: result.successCount }));
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
   * 处理批量导出车间
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Workshop[]
  ) => {
    try {
      let exportData: Workshop[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        // 导出选中的数据
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = `${t('app.master-data.workshops.exportFilenameSelected', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        // 导出当前页数据
        exportData = currentPageData;
        filename = `${t('app.master-data.workshops.exportFilenameCurrentPage', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      } else {
        // 导出全部数据
        const allData = await workshopApi.list({ skip: 0, limit: 10000 });
        exportData = allData.items;
        filename = `${t('app.master-data.workshops.exportFilenameAll', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      // 构建 CSV 内容
      const headers = [t('app.master-data.workshops.code'), t('app.master-data.workshops.name'), t('app.master-data.workshops.plantName'), t('app.master-data.workshops.description'), t('app.master-data.workshops.status'), t('common.createdAt')];
      const csvRows: string[] = [headers.join(',')];

      exportData.forEach((item) => {
        const plant = plants.find(p => p.id === item.plantId);
        const row = [
          item.code || '',
          item.name || '',
          plant ? plant.name : '',
          item.description || '',
          (item.isActive ?? (item as any).is_active) ? t('common.enabled') : t('common.disabled'),
          item.createdAt ? new Date(item.createdAt).toLocaleString(i18n.language) : '',
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
      messageApi.error(error.message || t('app.master-data.exportFailed'));
    }
  };

  /** 优先使用接口带出的 plantCode/plantName，避免厂区字典尚未加载时闪烁 */
  const formatPlantDisplay = useCallback((record: Workshop): React.ReactNode => {
    const code = record.plantCode ?? (record as any).plant_code;
    const name = record.plantName ?? (record as any).plant_name;
    if (code != null && String(code) !== '' && name != null && String(name) !== '') {
      return `${code} - ${name}`;
    }
    const plant = plants.find(p => p.id === (record?.plantId ?? (record as any)?.plant_id));
    return plant ? `${plant.code} - ${plant.name}` : <Typography.Text type="secondary">-</Typography.Text>;
  }, [plants]);

  /**
   * 表格列定义（使用 useMemo 确保 customFields 和 plants 变化时重新计算）
   */
  const columns: ProColumns<Workshop>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    const fixedColumns = [
      {
        title: t('app.master-data.workshops.code'),
        dataIndex: 'code',
        width: 150,
        fixed: 'left' as const,
        ellipsis: true,
        copyable: true,
        sorter: true,
      },
      {
        title: t('app.master-data.workshops.name'),
        dataIndex: 'name',
        width: 200,
        sorter: true,
      },
      {
        title: t('app.master-data.workshops.plantName'),
        dataIndex: 'plantId',
        width: 150,
        valueType: 'select' as any,
        valueEnum: plants.reduce((acc, plant) => {
          acc[plant.id] = { text: plant.name };
          return acc;
        }, {} as Record<number, { text: string }>),
        render: (_text: any, record: Workshop) => formatPlantDisplay(record),
      },
      {
        title: t('app.master-data.workshops.description'),
        dataIndex: 'description',
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.master-data.workshops.statusLabel'),
        dataIndex: 'isActive',
        width: 100,
        valueType: 'select' as any,
        valueEnum: {
          true: { text: t('common.enabled'), status: 'Success' },
          false: { text: t('common.disabled'), status: 'Default' },
        },
        render: (_text: any, record: Workshop) => {
          const isActive = record?.isActive ?? (record as any)?.is_active;
          return (
            <Tag color={isActive ? 'success' : 'default'}>
              {isActive ? t('common.enabled') : t('common.disabled')}
            </Tag>
          );
        },
      },
      // 插入自定义字段列
      ...customFieldColumns,
      {
        title: t('common.createdAt'),
        dataIndex: 'createdAt',
        width: 180,
        valueType: 'dateTime' as any,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 150,
        fixed: 'right' as const,
        render: (_text: any, record: Workshop) => (
          <Space>
            <Button key="view" {...rowActionKind('read')}
              size="small"
              onClick={() => handleOpenDetail(record)}
            >
              {t('field.customField.view')}
            </Button>
            <Button key="edit" {...rowActionKind('update')}
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              {t('field.customField.edit')}
            </Button>
            <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.master-data.workshops.deleteConfirm')}
              description={t('app.master-data.workshops.deleteDescription')}
              onConfirm={() => handleDelete(record)}
            >
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
              >
                {t('field.customField.delete')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];

    return fixedColumns as ProColumns<Workshop>[];
  }, [customFields, plants, t, formatPlantDisplay]);

  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemProps<Workshop>[] = [
    {
      title: t('app.master-data.workshops.code'),
      dataIndex: 'code',
    copyable: true,},
    {
      title: t('app.master-data.workshops.name'),
      dataIndex: 'name',
    },
    {
      title: t('app.master-data.workshops.plantName'),
      dataIndex: 'plantId',
      render: (_, record) => formatPlantDisplay(record),
    },
    {
      title: t('app.master-data.workshops.description'),
      dataIndex: 'description',
    },
    {
      title: t('app.master-data.workshops.statusLabel'),
      dataIndex: 'isActive',
      render: (_, record) => {
        const isActive = record?.isActive ?? (record as any)?.is_active;
        return (
          <Tag color={isActive ? 'success' : 'default'}>
            {isActive ? t('common.enabled') : t('common.disabled')}
          </Tag>
        );
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
        {customFieldsLoaded ? (
        <UniTable<Workshop>
        columnPersistenceId="apps.master-data.pages.factory.workshops"
        actionRef={actionRef}
        columns={columns}
        viewTypes={['table', 'help']}
        defaultViewType="table"
        onImport={handleImport}
        importHeaders={workshopImportTemplate.importHeaders}
        importExampleRow={workshopImportTemplate.importExampleRow}
        importFieldMap={workshopImportTemplate.importHeaderMap}
        importFieldRules={{
          code: { required: true },
          name: { required: true },
          plantCode: { required: true },
        }}
        showExportButton={true}
        onExport={handleExport}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };

          // 启用状态筛选
          if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
            apiParams.is_active = searchFormValues.isActive;
          }

          if (searchFormValues?.plantId !== undefined && searchFormValues.plantId !== '' && searchFormValues.plantId !== null) {
            apiParams.plant_id = searchFormValues.plantId;
          }

          applyFactoryKeyword(apiParams, searchFormValues);
          applyFactoryTableSort(apiParams, sort);

          try {
            const result = await workshopApi.list(apiParams);
            const enrichedData = await enrichRecordsWithCustomFields(result.items);
            return {
              data: enrichedData,
              success: true,
              total: result.total,
            };
          } catch (error: any) {
            console.error('获取车间列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.workshops.listFetchFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        showCreateButton
        createButtonText={t('app.master-data.workshops.create') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('app.master-data.workshops.batchDeleteTitle')}
        deleteConfirmDescription={(count) =>
          t('app.master-data.workshops.batchDeleteDescription', { count })
        }
        toolBarActionsAfterDelete={[
          <MasterDataBatchActiveMenuButton
            menuKey="workshops-batch-active"
            selectedRowKeys={selectedRowKeys}
            menuItems={batchActiveMenuItems}
          />,
        ]}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
      />
        ) : null}
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={t('app.master-data.workshops.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={
          workshopDetail ? (
            <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns, workshopDetail)} />
          ) : null
        }
        linesTitle={t('app.master-data.customFields')}
        lines={
          hasCustomFieldsDetailContent(customFields, customFieldValues) ? (
            <CustomFieldsDetailSection customFields={customFields} customFieldValues={customFieldValues} />
          ) : null
        }
      />

      {modalVisible ? (
        <Suspense fallback={null}>
          <WorkshopFormModal
            open={modalVisible}
            onClose={() => { setModalVisible(false); setEditUuid(null); }}
            editUuid={editUuid}
            onSuccess={handleModalSuccess}
          />
        </Suspense>
      ) : null}
    </>
    );
};

export default WorkshopsPage;

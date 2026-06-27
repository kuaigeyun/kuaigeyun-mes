import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 仓库管理页面
 * 
 * 提供仓库的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Descriptions, List, Modal, Popconfirm, Space, Table, Tag, Typography, theme } from 'antd';
import { downloadFile } from '../../../../../utils';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { detailDrawerDescriptionItems, DetailDrawerTemplate, DRAWER_CONFIG, ListPageTemplate } from '../../../../../components/layout-templates';
import { warehouseApi, type PresetWarehouseItem } from '../../../services/warehouse';
import {
  workshopApi,
  workCenterApi,
  factoryListItems,
  applyFactoryKeyword,
  applyFactoryTableSort,
} from '../../../services/factory';
import { WarehouseFormModal } from '../../../components/WarehouseFormModal';
import { QRCodeGenerator } from '../../../../../components/qrcode';
import type { Warehouse, WarehouseCreate } from '../../../types/warehouse';
import { batchImport } from '../../../../../utils/batchOperations';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import { useTrialRunMode } from '../../../../../hooks/useTrialRunMode';
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
 * 仓库管理列表页面组件
 */
const WarehousesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const trialRunMode = useTrialRunMode();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [warehouseDetail, setWarehouseDetail] = useState<Warehouse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑仓库）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [loadPresetLoading, setLoadPresetLoading] = useState(false);
  const [syncLineSideLoading, setSyncLineSideLoading] = useState(false);
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [presetList, setPresetList] = useState<PresetWarehouseItem[]>([]);
  const [selectedPresetNames, setSelectedPresetNames] = useState<string[]>([]);
  const [presetConfirmLoading, setPresetConfirmLoading] = useState(false);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<Warehouse>({ tableName: 'master_data_warehouse_warehouses' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: warehouseApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  /**
   * 当自定义字段加载完成后，刷新表格以显示自定义字段列
   */
  useEffect(() => {
    if (customFields.length > 0 && actionRef.current) {
      setTimeout(() => {
        actionRef.current?.reload();
      }, 200);
    }
  }, [customFields.length]);

  const warehouseImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'app.master-data.warehouses.code' },
          { field: 'name', required: true, labelKey: 'app.master-data.warehouses.name' },
          { field: 'warehouseType', labelKey: 'field.warehouse.warehouseType' },
          { field: 'workshopCode', labelKey: 'app.master-data.warehouses.workshopCode' },
          { field: 'workCenterCode', labelKey: 'app.master-data.warehouses.workCenterCode' },
          { field: 'description', labelKey: 'app.master-data.warehouses.description' },
        ],
        [
          t('app.master-data.warehouses.importExample.code'),
          t('app.master-data.warehouses.importExample.name'),
          t('app.master-data.warehouses.importExample.warehouseType'),
          '',
          '',
          t('app.master-data.warehouses.importExample.description'),
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
   * 处理编辑仓库
   */
  const handleEdit = (record: Warehouse) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  /**
   * 处理删除仓库
   */
  const handleDelete = async (record: Warehouse) => {
    try {
      await warehouseApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除仓库
   */
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'));
      return;
    }

    try {
      const uuids = targetKeys.map(key => String(key));
      const result = await warehouseApi.batchDelete(uuids);
      
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
   * 支持从 Excel 导入仓库数据，批量创建仓库
   * 数据格式：第一行为表头，第二行为示例数据，从第三行开始为实际数据
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
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
      warehouseImportTemplate.importHeaderMap,
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

    // 加载车间和工作中心（用于解析 workshopCode/workCenterCode）
    let workshops: Array<{ id: number; code: string; name: string }> = [];
    let workCenters: Array<{ id: number; code: string; name: string }> = [];
    try {
      const [wsList, wcList] = await Promise.all([
        workshopApi.list({ limit: 10000, is_active: true }),
        workCenterApi.list({ limit: 10000, is_active: true }),
      ]);
      workshops = factoryListItems(wsList);
      workCenters = factoryListItems(wcList);
    } catch (e) {
      console.warn('加载车间/工作中心失败，线边仓关联将跳过', e);
    }

    // 解析数据行
    const importData: WarehouseCreate[] = [];
    const errors: Array<{ row: number; message: string }> = [];

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
        const warehouseTypeIndex = headerIndexMap['warehouseType'];
        const workshopCodeIndex = headerIndexMap['workshopCode'];
        const workCenterCodeIndex = headerIndexMap['workCenterCode'];

        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.warehouses.headerMapError') });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;
        const warehouseTypeVal = warehouseTypeIndex !== undefined && row[warehouseTypeIndex] !== undefined
          ? String(row[warehouseTypeIndex]).trim()
          : 'normal';
        const workshopCodeVal = workshopCodeIndex !== undefined && row[workshopCodeIndex] !== undefined
          ? String(row[workshopCodeIndex]).trim()
          : '';
        const workCenterCodeVal = workCenterCodeIndex !== undefined && row[workCenterCodeIndex] !== undefined
          ? String(row[workCenterCodeIndex]).trim()
          : '';

        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';

        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.warehouses.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.warehouses.nameRequired') });
          return;
        }

        // 解析仓库类型（支持中文或英文值）
        const typeMap: Record<string, string> = {
          normal: 'normal', '普通仓': 'normal', '普通': 'normal',
          line_side: 'line_side', '线边仓': 'line_side', '线边': 'line_side',
          wip: 'wip', '在制品仓': 'wip', '在制品': 'wip',
          outsourcing: 'outsourcing', '委外仓': 'outsourcing', '委外': 'outsourcing',
          consignment: 'consignment', '寄售仓': 'consignment', '寄售': 'consignment',
          vmi: 'vmi', 'VMI仓': 'vmi', 'VMI': 'vmi',
          defect: 'defect', '不良品仓': 'defect', '不良品': 'defect',
          quarantine: 'quarantine', '待检仓': 'quarantine', '待检': 'quarantine',
        };
        const warehouseType = typeMap[warehouseTypeVal] || 'normal';

        // 线边仓时解析车间
        let workshopId: number | undefined;
        if (workshopCodeVal) {
          const found = workshops.find((w) => w.code.toUpperCase() === workshopCodeVal.toUpperCase());
          if (found) {
            workshopId = found.id;
          } else {
            errors.push({
              row: actualRowIndex,
              message: t('app.master-data.warehouses.workshopCodeNotExist', { value: workshopCodeVal }),
            });
            return;
          }
        }
        if (warehouseType === 'line_side' && !workshopId) {
          errors.push({ row: actualRowIndex, message: t('field.warehouse.workshopIdRequired') });
          return;
        }

        // 解析工作中心
        let workCenterId: number | undefined;
        if (workCenterCodeVal) {
          const found = workCenters.find((w) => w.code.toUpperCase() === workCenterCodeVal.toUpperCase());
          if (found) {
            workCenterId = found.id;
          }
        }

        // 构建导入数据
        const warehouseData: WarehouseCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          description: description ? String(description).trim() : undefined,
          isActive: true,
          warehouseType,
          workshopId,
          workCenterId,
        };

        importData.push(warehouseData);
      } catch (error: any) {
        errors.push({
          row: actualRowIndex,
          message: error.message || t('app.master-data.warehouses.dataParseFailed'),
        });
      }
    });

    // 如果有验证错误，显示错误信息
    if (errors.length > 0) {
      Modal.warning({
        title: t('app.master-data.warehouses.importValidationFailed'),
        width: 600,
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
        importFn: async (item: WarehouseCreate) => {
          return await warehouseApi.create(item);
        },
        title: t('app.master-data.warehouses.importTitle'),
        concurrency: 5,
      });

      // 显示导入结果
      if (result.failureCount > 0) {
        Modal.warning({
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
   * 处理批量导出仓库
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Warehouse[]
  ) => {
    try {
      let exportData: Warehouse[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        // 导出选中的数据
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = t('app.master-data.warehouses.exportFilenameSelected', { date: new Date().toISOString().slice(0, 10) });
      } else if (type === 'currentPage' && currentPageData) {
        // 导出当前页数据
        exportData = currentPageData;
        filename = t('app.master-data.warehouses.exportFilenameCurrentPage', { date: new Date().toISOString().slice(0, 10) });
      } else {
        // 导出全部数据
        const allData = await warehouseApi.list({ skip: 0, limit: 10000 });
        exportData = allData.items;
        filename = t('app.master-data.warehouses.exportFilenameAll', { date: new Date().toISOString().slice(0, 10) });
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      // 构建 CSV 内容
      const headers = [
        t('app.master-data.warehouses.code'),
        t('app.master-data.warehouses.name'),
        t('field.warehouse.warehouseType'),
        t('field.warehouse.workshopName'),
        t('field.warehouse.workCenterName'),
        t('app.master-data.warehouses.description'),
        t('app.master-data.warehouses.status'),
        t('app.master-data.warehouses.createTime'),
      ];
      const warehouseTypeLabels: Record<string, string> = {
        normal: t('warehouse.type.normal'),
        line_side: t('warehouse.type.line_side'),
        wip: t('warehouse.type.wip'),
        outsourcing: t('warehouse.type.outsourcing'),
        consignment: t('warehouse.type.consignment'),
        vmi: t('warehouse.type.vmi'),
        defect: t('warehouse.type.defect'),
        quarantine: t('warehouse.type.quarantine'),
      };
      const rows = exportData.map((item) => [
        item.code || '',
        item.name || '',
        warehouseTypeLabels[item.warehouseType || 'normal'] || item.warehouseType || '',
        item.workshopName || '',
        item.workCenterName || '',
        item.description || '',
        item.isActive ? t('common.enabled') : t('common.disabled'),
        item.createdAt ? new Date(item.createdAt).toLocaleString(i18n.language) : '',
      ]);

      // 生成 CSV 内容
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // 下载文件
      downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
      messageApi.success(t('app.master-data.exportSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.exportFailed'));
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Warehouse) => {
    try {
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await warehouseApi.get(record.uuid);
      setWarehouseDetail(detail);
      await loadFieldValuesForDetail(detail.id);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.warehouses.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setWarehouseDetail(null);
    resetDetailFieldValues();
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 表格列定义
   */
  const warehouseTypeEnum: Record<string, { text: string }> = {
    normal: { text: t('warehouse.type.normal') },
    line_side: { text: t('warehouse.type.line_side') },
    wip: { text: t('warehouse.type.wip') },
    outsourcing: { text: t('warehouse.type.outsourcing') },
    consignment: { text: t('warehouse.type.consignment') },
    vmi: { text: t('warehouse.type.vmi') },
    defect: { text: t('warehouse.type.defect') },
    quarantine: { text: t('warehouse.type.quarantine') },
  };

  const columns: ProColumns<Warehouse>[] = React.useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
    {
      title: t('app.master-data.warehouses.code'),
      dataIndex: 'code',
      copyable: true,
      width: 150,
      fixed: 'left',
      ellipsis: true,
    },
    {
      title: t('app.master-data.warehouses.name'),
      dataIndex: 'name',
      width: 200,
    },
    {
      title: t('field.warehouse.warehouseType'),
      dataIndex: 'warehouseType',
      width: 100,
      valueType: 'select',
      valueEnum: warehouseTypeEnum,
      render: (_, record) => warehouseTypeEnum[record.warehouseType || 'normal']?.text || record.warehouseType || '-',
    },
    {
      title: t('field.warehouse.workshopName'),
      dataIndex: 'workshopName',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => record.workshopName || '-',
    },
    {
      title: t('field.warehouse.workCenterName'),
      dataIndex: 'workCenterName',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => record.workCenterName || '-',
    },
    {
      title: t('app.master-data.warehouses.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    // 插入自定义字段列
    ...customFieldColumns,
    {
      title: t('app.master-data.warehouses.status'),
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('common.enabled'), status: 'Success' },
        false: { text: t('common.disabled'), status: 'Default' },
      },
      render: (_: any, record: Warehouse) => (
        <Tag color={record?.isActive ? 'success' : 'default'}>
          {record?.isActive ? t('common.enabled') : t('common.disabled')}
        </Tag>
      ),
      sorter: true,
    },
    {
      title: t('app.master-data.warehouses.createTime'),
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('app.master-data.warehouses.action'),
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
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
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.master-data.warehouses.deleteConfirm')}
            description={t('app.master-data.warehouses.deleteDescription')}
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
  }, [customFields, t]);

  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemProps<Warehouse>[] = [
    {
      title: t('app.master-data.warehouses.code'),
      dataIndex: 'code',
    copyable: true,},
    {
      title: t('app.master-data.warehouses.name'),
      dataIndex: 'name',
    },
    {
      title: t('field.warehouse.warehouseType'),
      dataIndex: 'warehouseType',
      render: (_, record) => warehouseTypeEnum[record.warehouseType || 'normal']?.text || record.warehouseType || '-',
    },
    {
      title: t('field.warehouse.workshopName'),
      dataIndex: 'workshopName',
      render: (_, record) => record.workshopName || '-',
    },
    {
      title: t('field.warehouse.workCenterName'),
      dataIndex: 'workCenterName',
      render: (_, record) => record.workCenterName || '-',
    },
    {
      title: t('app.master-data.warehouses.description'),
      dataIndex: 'description',
    },
    {
      title: t('app.master-data.warehouses.status'),
      dataIndex: 'isActive',
      render: (_, record) => (
        <Tag color={record?.isActive ? 'success' : 'default'}>
          {record?.isActive ? t('common.enabled') : t('common.disabled')}
        </Tag>
      ),
    },
    {
      title: t('app.master-data.warehouses.createTime'),
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: t('app.master-data.warehouses.updateTime'),
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Warehouse>
        columnPersistenceId="apps.master-data.pages.warehouse.warehouses"
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          const apiParams: Record<string, unknown> = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };

          if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
            apiParams.is_active = searchFormValues.isActive;
          }
          if (searchFormValues?.warehouseType) {
            apiParams.warehouse_type = searchFormValues.warehouseType;
          }

          applyFactoryKeyword(apiParams, searchFormValues);
          applyFactoryTableSort(apiParams, sort);

          try {
            const result = await warehouseApi.list(apiParams as any);
            const enrichedData = await enrichRecordsWithCustomFields(result.items);
            return {
              data: enrichedData,
              success: true,
              total: result.total,
            };
          } catch (error: any) {
            console.error('获取仓库列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.warehouses.getListFailed'));
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
        importHeaders={warehouseImportTemplate.importHeaders}
        importExampleRow={warehouseImportTemplate.importExampleRow}
        importFieldMap={warehouseImportTemplate.importHeaderMap}
        importFieldRules={{
          code: { required: true },
          name: { required: true },
        }}
        showExportButton={true}
        onExport={handleExport}
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        showCreateButton
        createButtonText={t('app.master-data.warehouses.create') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('app.master-data.warehouses.batchDeleteTitle')}
        deleteConfirmDescription={(count) =>
          t('app.master-data.warehouses.batchDeleteDescription', { count })
        }
        toolBarActionsAfterDelete={[
          <MasterDataBatchActiveMenuButton
            menuKey="warehouses-batch-active"
            selectedRowKeys={selectedRowKeys}
            menuItems={batchActiveMenuItems}
          />,
        ]}
        toolBarActionsAfterCreate={[
          trialRunMode ? (
            <Button {...rowActionKind('import')}
              key="loadPreset"
              loading={loadPresetLoading}
              onClick={async () => {
                try {
                  setLoadPresetLoading(true);
                  const list = await warehouseApi.getPresetPreview();
                  setPresetList(list);
                  setSelectedPresetNames(list.map((x) => x.name));
                  setPresetModalVisible(true);
                } catch (e: any) {
                  messageApi.error(e?.message || t('common.operationFailed'));
                } finally {
                  setLoadPresetLoading(false);
                }
              }}
            >
              {t('field.warehouse.loadPreset')}
            </Button>
          ) : null,
        ].filter(Boolean)}
        toolBarActionsAfterBatch={[
          <Button {...rowActionKind('update')}
            key="syncLineSide"
            loading={syncLineSideLoading}
            onClick={async () => {
              try {
                setSyncLineSideLoading(true);
                const res = await warehouseApi.syncLineSide();
                messageApi.success(res.message);
                actionRef.current?.reload();
              } catch (e: any) {
                messageApi.error(e?.message || t('common.operationFailed'));
              } finally {
                setSyncLineSideLoading(false);
              }
            }}
          >
            {t('field.warehouse.syncLineSide')}
          </Button>,
        ]}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
      />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={t('app.master-data.warehouses.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        styles={{ body: { position: 'relative' } }}
        basic={
          warehouseDetail ? (
            <div style={{ position: 'relative', paddingRight: 8 }}>
              <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns, warehouseDetail)} />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 152,
                  padding: 12,
                  background: '#fff',
                  borderRadius: token.borderRadiusLG,
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 10,
                }}
              >
                <QRCodeGenerator
                  data={{
                    warehouse_uuid: warehouseDetail.uuid,
                    warehouse_code: warehouseDetail.code,
                    warehouse_name: warehouseDetail.name,
                  }}
                  qrcodeType="TRACE"
                  size={6}
                  noCard={true}
                />
              </div>
            </div>
          ) : undefined}
        linesTitle={t('app.master-data.customFields')}
        lines={
          hasCustomFieldsDetailContent(customFields, customFieldValues) ? (
            <CustomFieldsDetailSection customFields={customFields} customFieldValues={customFieldValues} />
          ) : null
        }
      />

      {/* 创建/编辑仓库 Modal */}
      <WarehouseFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />

      {/* 加载预设预览 Modal：可勾选子项后确认 */}
      <Modal
        title={t('field.warehouse.loadPreset')}
        open={presetModalVisible}
        onCancel={() => setPresetModalVisible(false)}
        width={560}
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => setPresetModalVisible(false)}>{t('common.cancel')}</Button>,
          <Button {...rowActionKind('audit')}
            key="confirm"
            type="primary"
            loading={presetConfirmLoading}
            disabled={selectedPresetNames.length === 0}
            onClick={async () => {
              try {
                setPresetConfirmLoading(true);
                const res = await warehouseApi.loadPreset(selectedPresetNames);
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
        <Table<PresetWarehouseItem>
          size="small"
          rowKey="name"
          dataSource={presetList}
          pagination={false}
          scroll={{ y: 280 }}
          rowSelection={{
            selectedRowKeys: selectedPresetNames,
            onChange: (keys) => setSelectedPresetNames(keys as string[]),
          }}
          columns={[
            { title: t('app.master-data.warehouses.name'), dataIndex: 'name', width: 120 },
            { title: t('app.master-data.warehouses.description'), dataIndex: 'description', ellipsis: true },
            {
              title: t('field.warehouse.warehouseType'),
              dataIndex: 'warehouse_type',
              width: 120,
              render: (v: string) => (v ? t(`warehouse.type.${v}` as any) : '–'),
            },
          ]}
        />
      </Modal>
    </>
  );
};

export default WarehousesPage;

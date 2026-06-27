import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 产线管理页面
 * 
 * 提供产线的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Descriptions, List, Modal, Popconfirm, Space, Tag, Typography } from 'antd';
import { downloadFile } from '../../../../../utils';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { detailDrawerDescriptionItems, DetailDrawerTemplate, DRAWER_CONFIG, ListPageTemplate } from '../../../../../components/layout-templates';
import {
  productionLineApi,
  workshopApi,
  factoryListItems,
  applyFactoryKeyword,
  applyFactoryTableSort,
} from '../../../services/factory';
import { ProductionLineFormModal } from '../../../components/ProductionLineFormModal';
import type { ProductionLine, ProductionLineCreate, Workshop } from '../../../types/factory';
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
 * 产线管理列表页面组件
 */
const ProductionLinesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [, setCurrentProductionLineUuid] = useState<string | null>(null);
  const [productionLineDetail, setProductionLineDetail] = useState<ProductionLine | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑产线）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  
  // 车间列表（用于导入等）
  const [workshops, setWorkshops] = useState<Workshop[]>([]);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<ProductionLine>({ tableName: 'master_data_factory_production_lines' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: productionLineApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  useEffect(() => {
    const loadWorkshops = async () => {
      try {
        const result = await workshopApi.list({ limit: 1000, is_active: true });
        setWorkshops(factoryListItems(result));
      } catch (error: any) {
        console.error('加载车间列表失败:', error);
      }
    };
    loadWorkshops();
  }, []);

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

  const productionLineImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'app.master-data.productionLines.code' },
          { field: 'name', required: true, labelKey: 'app.master-data.productionLines.name' },
          { field: 'workshopCode', required: true, labelKey: 'app.master-data.productionLines.workshopCode' },
          { field: 'description', labelKey: 'app.master-data.productionLines.description' },
        ],
        [
          t('app.master-data.productionLines.importExample.code'),
          t('app.master-data.productionLines.importExample.name'),
          workshops.length > 0
            ? workshops[0].code
            : t('app.master-data.workshops.importExample.code'),
          t('app.master-data.productionLines.importExample.description'),
        ],
      ),
    [t, i18n.language, workshops],
  );

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = (record: ProductionLine) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理删除产线
   */
  const handleDelete = async (record: ProductionLine) => {
    try {
      await productionLineApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除产线
   */
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'));
      return;
    }

    try {
      // 去重，避免重复 key 导致后端出现“首个删除成功、后续同 key 报不存在”的误判。
      const uuids = Array.from(new Set(targetKeys.map((key) => String(key))));
      const result = await productionLineApi.batchDelete(uuids);
      
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
   * 支持从 Excel 导入产线数据，批量创建产线
   * 数据格式：第一行为表头，第二行为示例数据，从第三行开始为实际数据
   * 
   * 所属车间字段说明：
   * - 可以填写车间编号（如：WS001）或车间名称（如：装配车间）
   * - 系统会根据编号或名称自动匹配对应的车间
   * - 如果车间不存在，导入会失败并提示错误
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }

    // 如果车间列表为空，提示用户先创建车间
    if (workshops.length === 0) {
      Modal.warning({
        title: t('app.master-data.importDisabled'),
        content: t('app.master-data.importNoWorkshop'),
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
      productionLineImportTemplate.importHeaderMap,
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
    if (headerIndexMap['workshopCode'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: 'workshopCode', headers: headers.join(', ') }));
      return;
    }

    // 解析数据行
    const importData: ProductionLineCreate[] = [];
    const errors: Array<{ row: number; message: string; kind?: 'workshop' }> = [];

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
        const workshopCodeIndex = headerIndexMap['workshopCode'];

        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.headerMappingError') });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;
        const workshopCode = workshopCodeIndex !== undefined && row[workshopCodeIndex] !== undefined
          ? row[workshopCodeIndex]
          : undefined;
        
        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';
        
        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.productionLines.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.productionLines.nameRequired') });
          return;
        }

        // 处理所属车间（仅支持通过车间编号查找 workshopId）
        const workshopCodeValue = workshopCode ? String(workshopCode).trim().toUpperCase() : '';
        if (!workshopCodeValue) {
          errors.push({
            row: actualRowIndex,
            message: t('app.master-data.productionLines.workshopRequired'),
            kind: 'workshop',
          });
          return;
        }
        const foundWorkshop = workshops.find(w => w.code.toUpperCase() === workshopCodeValue);
        if (!foundWorkshop) {
          errors.push({
            row: actualRowIndex,
            message: t('app.master-data.productionLines.workshopCodeNotExist', { value: workshopCodeValue }),
            kind: 'workshop',
          });
          return;
        }

        // 构建导入数据
        const productionLineData: ProductionLineCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          workshopId: foundWorkshop.id,
          description: description ? String(description).trim() : undefined,
          isActive: true, // 默认启用
        };

        importData.push(productionLineData);
      } catch (error: any) {
        errors.push({
          row: actualRowIndex,
          message: error.message || t('app.master-data.productionLines.dataParseFailed'),
        });
      }
    });

    // 如果有验证错误，显示错误信息
    if (errors.length > 0) {
      const hasWorkshopError = errors.some(e => e.kind === 'workshop');
      
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
            {hasWorkshopError && workshops.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('app.master-data.availableWorkshopsList')}
                </Typography.Text>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {workshops.map(workshop => (
                    <li key={workshop.id} style={{ marginBottom: 4 }}>
                      <Typography.Text strong>{workshop.code}</Typography.Text>
                      <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                        - {workshop.name}
                      </Typography.Text>
                    </li>
                  ))}
                </ul>
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: '12px' }}>
                  {t('app.master-data.workshopImportHint', { code: workshops[0]?.code || '' })}
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
        importFn: async (item: ProductionLineCreate) => {
          return await productionLineApi.create(item);
        },
        title: t('app.master-data.productionLines.importTitle'),
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
        messageApi.success(t('app.master-data.productionLines.importSuccess', { count: result.successCount }));
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
   * 处理批量导出产线
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: ProductionLine[]
  ) => {
    try {
      let exportData: ProductionLine[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        // 导出选中的数据
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = `${t('app.master-data.productionLines.exportFilenameSelected', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        // 导出当前页数据
        exportData = currentPageData;
        filename = `${t('app.master-data.productionLines.exportFilenameCurrentPage', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      } else {
        // 导出全部数据
        const allData = await productionLineApi.list({ skip: 0, limit: 10000 });
        exportData = allData.items;
        filename = `${t('app.master-data.productionLines.exportFilenameAll', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      // 构建 CSV 内容
      const headers = [t('app.master-data.productionLines.code'), t('app.master-data.productionLines.name'), t('app.master-data.productionLines.workshopName'), t('app.master-data.productionLines.description'), t('app.master-data.productionLines.status'), t('common.createdAt')];
      const rows = exportData.map(item => {
        const workshop = workshops.find(w => w.id === item.workshopId);
        const wsLabel =
          item.workshopCode != null && item.workshopName != null
            ? `${item.workshopCode}(${item.workshopName})`
            : workshop
              ? `${workshop.code}(${workshop.name})`
              : '';
        return [
          item.code || '',
          item.name || '',
          wsLabel,
          item.description || '',
          item.isActive ? t('common.enabled') : t('common.disabled'),
          item.createdAt ? new Date(item.createdAt).toLocaleString(i18n.language) : '',
        ];
      });

      // 生成 CSV 内容
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // 下载文件
      downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
      messageApi.success(t('common.exportSuccess', { count: exportData.length }));
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.exportFailed'));
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ProductionLine) => {
    try {
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await productionLineApi.get(record.uuid);
      setProductionLineDetail(detail);
      await loadFieldValuesForDetail(detail.id);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.productionLines.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setProductionLineDetail(null);
    resetDetailFieldValues();
  };

  /** 优先使用接口带出的 workshopCode/workshopName，避免车间字典尚未加载时闪烁 */
  const formatWorkshopDisplay = (record: ProductionLine): string => {
    const c = record.workshopCode;
    const n = record.workshopName;
    if (c != null && String(c) !== '' && n != null && String(n) !== '') {
      return `${c} - ${n}`;
    }
    const workshopId = record.workshopId ?? (record as any)?.workshop_id;
    if (!workshopId) return '-';
    const workshop = workshops.find(w => w.id === workshopId);
    return workshop ? `${workshop.code} - ${workshop.name}` : '-';
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ProductionLine>[] = React.useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
    {
      title: t('app.master-data.productionLines.code'),
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
      ellipsis: true,
      copyable: true,
      sorter: true,
    },
    {
      title: t('app.master-data.productionLines.name'),
      dataIndex: 'name',
      width: 200,
      sorter: true,
    },
    {
      title: t('app.master-data.productionLines.workshopName'),
      dataIndex: 'workshopId',
      width: 200,
      hideInSearch: true,
      sorter: true,
      render: (_, record) => formatWorkshopDisplay(record),
    },
    {
      title: t('app.master-data.productionLines.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    // 插入自定义字段列
    ...customFieldColumns,
    {
      title: t('app.master-data.productionLines.statusLabel'),
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('common.enabled'), status: 'Success' },
        false: { text: t('common.disabled'), status: 'Default' },
      },
      render: (_, record) => {
        const isActive = record?.isActive;
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
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.actions'),
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
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.master-data.productionLines.deleteConfirm')}
            description={t('app.master-data.productionLines.deleteDescription')}
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
  }, [customFields, t, workshops]);

  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemProps<ProductionLine>[] = [
    {
      title: t('app.master-data.productionLines.code'),
      dataIndex: 'code',
    copyable: true,},
    {
      title: t('app.master-data.productionLines.name'),
      dataIndex: 'name',
    },
    {
      title: t('app.master-data.productionLines.workshopName'),
      dataIndex: 'workshopId',
      render: (_, record) => formatWorkshopDisplay(record),
    },
    {
      title: t('app.master-data.productionLines.description'),
      dataIndex: 'description',
    },
    {
      title: t('app.master-data.productionLines.statusLabel'),
      dataIndex: 'isActive',
      render: (_, record) => {
        const isActive = record?.isActive;
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
        <UniTable<ProductionLine>
        columnPersistenceId="apps.master-data.pages.factory.production-lines"
        actionRef={actionRef}
        columns={columns}
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
          
          // 车间筛选
          if (searchFormValues?.workshopId !== undefined && searchFormValues.workshopId !== '' && searchFormValues.workshopId !== null) {
            apiParams.workshop_id = searchFormValues.workshopId;
          }

          applyFactoryKeyword(apiParams, searchFormValues);
          applyFactoryTableSort(apiParams, sort);
          
          try {
            const result = await productionLineApi.list(apiParams);
            const enrichedData = await enrichRecordsWithCustomFields(result.items);
            return {
              data: enrichedData,
              success: true,
              total: result.total,
            };
          } catch (error: any) {
            console.error('获取产线列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.productionLines.getListFailed'));
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
        importHeaders={productionLineImportTemplate.importHeaders}
        importExampleRow={productionLineImportTemplate.importExampleRow}
        importFieldMap={productionLineImportTemplate.importHeaderMap}
        importFieldRules={{
          code: { required: true },
          name: { required: true },
          workshopCode: { required: true },
        }}
        showExportButton={true}
        onExport={handleExport}
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        showCreateButton
        createButtonText={t('app.master-data.productionLines.create') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('app.master-data.productionLines.batchDeleteTitle')}
        deleteConfirmDescription={(count) =>
          t('app.master-data.productionLines.batchDeleteDescription', { count })
        }
        toolBarActionsAfterDelete={[
          <MasterDataBatchActiveMenuButton
            menuKey="production-lines-batch-active"
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
      <DetailDrawerTemplate
        title={t('app.master-data.productionLines.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={productionLineDetail ? (
            <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns, productionLineDetail)} />
          ) : undefined}
        linesTitle={t('app.master-data.customFields')}
        lines={
          hasCustomFieldsDetailContent(customFields, customFieldValues) ? (
            <CustomFieldsDetailSection customFields={customFields} customFieldValues={customFieldValues} />
          ) : null
        }
      />

      {/* 创建/编辑产线 Modal */}
      <ProductionLineFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </>
  );
};

export default ProductionLinesPage;

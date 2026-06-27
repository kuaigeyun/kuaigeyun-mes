import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 工位管理页面
 * 
 * 提供工位的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Descriptions, List, Modal, Popconfirm, Space, Tag, Typography, theme } from 'antd';
import { downloadFile } from '../../../../../utils';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { detailDrawerDescriptionItems, DetailDrawerTemplate, DRAWER_CONFIG, ListPageTemplate } from '../../../../../components/layout-templates';
import {
  workstationApi,
  productionLineApi,
  factoryListItems,
  applyFactoryKeyword,
  applyFactoryTableSort,
} from '../../../services/factory';
import { WorkstationFormModal } from '../../../components/WorkstationFormModal';
import { QRCodeGenerator } from '../../../../../components/qrcode';
import type { Workstation, WorkstationCreate, ProductionLine } from '../../../types/factory';
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
 * 工位管理列表页面组件
 */
const WorkstationsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [, setCurrentWorkstationUuid] = useState<string | null>(null);
  const [workstationDetail, setWorkstationDetail] = useState<Workstation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑工位）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  
  // 产线列表（用于导入等）
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<Workstation>({ tableName: 'master_data_factory_workstations' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: workstationApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  useEffect(() => {
    const loadProductionLines = async () => {
      try {
        const result = await productionLineApi.list({ limit: 1000, is_active: true });
        setProductionLines(factoryListItems(result));
      } catch (error: any) {
        console.error('加载产线列表失败:', error);
      }
    };
    loadProductionLines();
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

  const workstationImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'app.master-data.workstations.code' },
          { field: 'name', required: true, labelKey: 'app.master-data.workstations.name' },
          {
            field: 'productionLineCode',
            required: true,
            labelKey: 'app.master-data.workstations.productionLineCode',
          },
          { field: 'description', labelKey: 'app.master-data.workstations.description' },
        ],
        [
          t('app.master-data.workstations.importExample.code'),
          t('app.master-data.workstations.importExample.name'),
          productionLines.length > 0
            ? productionLines[0].code
            : t('app.master-data.productionLines.importExample.code'),
          t('app.master-data.workstations.importExample.description'),
        ],
      ),
    [t, i18n.language, productionLines],
  );

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = (record: Workstation) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理删除工位
   */
  const handleDelete = async (record: Workstation) => {
    try {
      await workstationApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除工位
   */
  const handleBatchDelete = async (keys?: React.Key[]) => {
    const targetKeys = keys ?? selectedRowKeys;
    if (targetKeys.length === 0) {
      messageApi.warning(t('common.selectAtLeastOne'));
      return;
    }

    try {
      const uuids = targetKeys.map(key => String(key));
      const result = await workstationApi.batchDelete(uuids);
      
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
   * 支持从 Excel 导入工位数据，批量创建工位
   * 数据格式：第一行为表头，第二行为示例数据，从第三行开始为实际数据
   * 
   * 所属产线字段说明：
   * - 可以填写产线编号（如：PL001）或产线名称（如：产线1）
   * - 系统会根据编号或名称自动匹配对应的产线
   * - 如果产线不存在，导入会失败并提示错误
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }

    // 如果产线列表为空，提示用户先创建产线
    if (productionLines.length === 0) {
      Modal.warning({
        title: t('app.master-data.importDisabled'),
        content: t('app.master-data.importNoProductionLine'),
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
      workstationImportTemplate.importHeaderMap,
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
    if (headerIndexMap['productionLineCode'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: 'productionLineCode', headers: headers.join(', ') }));
      return;
    }

    // 解析数据行
    const importData: WorkstationCreate[] = [];
    const errors: Array<{ row: number; message: string; kind?: 'productionLine' }> = [];

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
        const productionLineCodeIndex = headerIndexMap['productionLineCode'];

        if (codeIndex === undefined || nameIndex === undefined) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.headerMappingError') });
          return;
        }

        const code = row[codeIndex];
        const name = row[nameIndex];
        const description = descriptionIndex !== undefined && row[descriptionIndex] !== undefined
          ? row[descriptionIndex]
          : undefined;
        const productionLineCode = productionLineCodeIndex !== undefined && row[productionLineCodeIndex] !== undefined
          ? row[productionLineCodeIndex]
          : undefined;
        
        const codeValue = code !== null && code !== undefined ? String(code).trim() : '';
        const nameValue = name !== null && name !== undefined ? String(name).trim() : '';
        
        if (!codeValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.workstations.codeRequired') });
          return;
        }
        if (!nameValue) {
          errors.push({ row: actualRowIndex, message: t('app.master-data.workstations.nameRequired') });
          return;
        }

        // 处理所属产线（仅支持通过产线编号查找 productionLineId）
        const productionLineCodeValue = productionLineCode ? String(productionLineCode).trim().toUpperCase() : '';
        if (!productionLineCodeValue) {
          errors.push({
            row: actualRowIndex,
            message: t('app.master-data.workstations.productionLineRequired'),
            kind: 'productionLine',
          });
          return;
        }
        const foundProductionLine = productionLines.find(p => p.code.toUpperCase() === productionLineCodeValue);
        if (!foundProductionLine) {
          errors.push({
            row: actualRowIndex,
            message: t('app.master-data.workstations.productionLineCodeNotExist', { value: productionLineCodeValue }),
            kind: 'productionLine',
          });
          return;
        }

        // 构建导入数据
        const workstationData: WorkstationCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          productionLineId: foundProductionLine.id,
          description: description ? String(description).trim() : undefined,
          isActive: true, // 默认启用
        };

        importData.push(workstationData);
      } catch (error: any) {
        errors.push({
          row: actualRowIndex,
          message: error.message || t('app.master-data.workstations.dataParseFailed'),
        });
      }
    });

    // 如果有验证错误，显示错误信息
    if (errors.length > 0) {
      const hasProductionLineError = errors.some(e => e.kind === 'productionLine');
      
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
            {hasProductionLineError && productionLines.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {t('app.master-data.availableProductionLinesList')}
                </Typography.Text>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {productionLines.map(productionLine => (
                    <li key={productionLine.id} style={{ marginBottom: 4 }}>
                      <Typography.Text strong>{productionLine.code}</Typography.Text>
                      <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                        - {productionLine.name}
                      </Typography.Text>
                    </li>
                  ))}
                </ul>
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: '12px' }}>
                  {t('app.master-data.productionLineImportHint', { code: productionLines[0]?.code || '' })}
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
        importFn: async (item: WorkstationCreate) => {
          return await workstationApi.create(item);
        },
        title: t('app.master-data.workstations.importTitle'),
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
        messageApi.success(t('app.master-data.workstations.importSuccess', { count: result.successCount }));
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
   * 处理批量导出工位
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Workstation[]
  ) => {
    try {
      let exportData: Workstation[] = [];
      let filename = '';

      if (type === 'selected' && selectedRowKeys && selectedRowKeys.length > 0) {
        // 导出选中的数据
        if (!currentPageData) {
          messageApi.warning(t('app.master-data.getSelectedFailed'));
          return;
        }
        exportData = currentPageData.filter(item => selectedRowKeys.includes(item.uuid));
        filename = `${t('app.master-data.workstations.exportFilenameSelected', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        // 导出当前页数据
        exportData = currentPageData;
        filename = `${t('app.master-data.workstations.exportFilenameCurrentPage', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      } else {
        // 导出全部数据
        const allData = await workstationApi.list({ skip: 0, limit: 10000 });
        exportData = allData.items;
        filename = `${t('app.master-data.workstations.exportFilenameAll', { date: new Date().toISOString().slice(0, 10) })}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      // 构建 CSV 内容
      const headers = [t('app.master-data.workstations.code'), t('app.master-data.workstations.name'), t('app.master-data.workstations.productionLineName'), t('app.master-data.workstations.description'), t('app.master-data.workstations.status'), t('common.createdAt')];
      const rows = exportData.map(item => {
        const productionLine = productionLines.find(p => p.id === item.productionLineId);
        const plLabel =
          item.productionLineCode != null && item.productionLineName != null
            ? `${item.productionLineCode}(${item.productionLineName})`
            : productionLine
              ? `${productionLine.code}(${productionLine.name})`
              : '';
        return [
          item.code || '',
          item.name || '',
          plLabel,
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
  const handleOpenDetail = async (record: Workstation) => {
    try {
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await workstationApi.get(record.uuid);
      setWorkstationDetail(detail);
      await loadFieldValuesForDetail(detail.id);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.workstations.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setWorkstationDetail(null);
    resetDetailFieldValues();
  };

  /**
   * 获取产线名称（字典异步加载后的兜底；列表接口已带 productionLineCode/Name 时应优先用 formatProductionLineDisplay）
   */
  const getProductionLineName = (productionLineId: number): string => {
    const productionLine = productionLines.find(p => p.id === productionLineId);
    return productionLine ? `${productionLine.code} - ${productionLine.name}` : '-';
  };

  const formatProductionLineDisplay = (record: Workstation): string => {
    const code = record.productionLineCode ?? (record as any).production_line_code;
    const name = record.productionLineName ?? (record as any).production_line_name;
    if (code != null && String(code) !== '' && name != null && String(name) !== '') {
      return `${code} - ${name}`;
    }
    const pid = record?.productionLineId ?? (record as any)?.production_line_id;
    return getProductionLineName(typeof pid === 'number' ? pid : Number(pid));
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Workstation>[] = React.useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
    {
      title: t('app.master-data.workstations.code'),
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
      ellipsis: true,
      copyable: true,
      sorter: true,
    },
    {
      title: t('app.master-data.workstations.name'),
      dataIndex: 'name',
      width: 200,
      sorter: true,
    },
    {
      title: t('app.master-data.workstations.productionLineName'),
      dataIndex: 'productionLineId',
      width: 200,
      hideInSearch: true,
      sorter: true,
      render: (_, record) => formatProductionLineDisplay(record),
    },
    {
      title: t('app.master-data.workstations.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    // 插入自定义字段列
    ...customFieldColumns,
    {
      title: t('app.master-data.workstations.statusLabel'),
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('common.enabled'), status: 'Success' },
        false: { text: t('common.disabled'), status: 'Default' },
      },
      render: (_, record) => {
        return (
          <Tag color={record?.isActive ? 'success' : 'default'}>
            {record?.isActive ? t('common.enabled') : t('common.disabled')}
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
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.master-data.workstations.deleteConfirm')}
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
  }, [customFields, t, productionLines]);

  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemProps<Workstation>[] = [
    {
      title: t('app.master-data.workstations.code'),
      dataIndex: 'code',
    copyable: true,},
    {
      title: t('app.master-data.workstations.name'),
      dataIndex: 'name',
    },
    {
      title: t('app.master-data.workstations.productionLineName'),
      dataIndex: 'productionLineId',
      render: (_, record) => formatProductionLineDisplay(record),
    },
    {
      title: t('app.master-data.workstations.description'),
      dataIndex: 'description',
    },
    {
      title: t('app.master-data.workstations.status'),
      dataIndex: 'isActive',
      render: (_, record) => {
        return (
          <Tag color={record?.isActive ? 'success' : 'default'}>
            {record?.isActive ? t('common.enabled') : t('common.disabled')}
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
        <UniTable<Workstation>
        columnPersistenceId="apps.master-data.pages.factory.workstations"
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
          
          // 产线筛选
          if (searchFormValues?.productionLineId !== undefined && searchFormValues.productionLineId !== '' && searchFormValues.productionLineId !== null) {
            apiParams.production_line_id = searchFormValues.productionLineId;
          }

          applyFactoryKeyword(apiParams, searchFormValues);
          applyFactoryTableSort(apiParams, sort);
          
          try {
            const result = await workstationApi.list(apiParams);
            const enrichedData = await enrichRecordsWithCustomFields(result.items);
            return {
              data: enrichedData,
              success: true,
              total: result.total,
            };
          } catch (error: any) {
            console.error('获取工位列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.workstations.getListFailed'));
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
        importHeaders={workstationImportTemplate.importHeaders}
        importExampleRow={workstationImportTemplate.importExampleRow}
        importFieldMap={workstationImportTemplate.importHeaderMap}
        importFieldRules={{
          code: { required: true },
          name: { required: true },
          productionLineCode: { required: true },
        }}
        showExportButton={true}
        onExport={handleExport}
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        showCreateButton
        createButtonText={t('app.master-data.workstations.create') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('app.master-data.workstations.batchDeleteTitle')}
        deleteConfirmDescription={(count) =>
          t('app.master-data.workstations.batchDeleteDescription', { count })
        }
        toolBarActionsAfterDelete={[
          <MasterDataBatchActiveMenuButton
            menuKey="workstations-batch-active"
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
        title={t('app.master-data.workstations.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        styles={{ body: { position: 'relative' } }}
        basic={
          workstationDetail ? (
            <div style={{ position: 'relative', paddingRight: 8 }}>
              <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns, workstationDetail)} />
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
                    equipment_uuid: workstationDetail.uuid,
                    equipment_code: workstationDetail.code,
                    equipment_name: workstationDetail.name,
                  }}
                  qrcodeType="EQ"
                  size={6}
                  noCard={true}
                />
              </div>
            </div>
          ) : null
        }
        linesTitle={t('app.master-data.customFields')}
        lines={
          hasCustomFieldsDetailContent(customFields, customFieldValues) ? (
            <CustomFieldsDetailSection customFields={customFields} customFieldValues={customFieldValues} />
          ) : null
        }
      />

      {/* 创建/编辑工位 Modal */}
      <WorkstationFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />
    </>
  );
};

export default WorkstationsPage;

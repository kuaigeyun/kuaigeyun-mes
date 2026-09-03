import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 工位管理页面
 * 
 * 提供工位的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, List, Modal, Popconfirm, Typography } from 'antd';
import { downloadFile } from '../../../../../utils';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../../../kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import { MasterDataDetailDrawer } from '../../shared/masterDataDetailDrawer';
import {
  workstationApi,
  productionLineApi,
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
  pickOptionalId,
  resolveMasterCrudListParams,
} from '../../../utils/masterListCore';
import {
  renderMasterActiveTag,
} from '../../../utils/masterListPresentation';
import { WorkstationFormModal } from '../../../components/WorkstationFormModal';
import { QRCodeGenerator } from '../../../../../components/qrcode';
import type { Workstation, WorkstationCreate, ProductionLine } from '../../../types/factory';
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
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
/**
 * 工位管理列表页面组件
 */
const WorkstationsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
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
          { field: 'description', labelKey: 'common.remark' },
          { field: 'isActive', labelKey: 'common.enabled', aliases: ['是否启用', '启用'], options: [...IMPORT_YES_NO_OPTIONS] },
        ],
        [
          t('app.master-data.workstations.importExample.code'),
          t('app.master-data.workstations.importExample.name'),
          productionLines.length > 0
            ? productionLines[0].code
            : t('app.master-data.productionLines.importExample.code'),
          t('app.master-data.workstations.importExample.description'),
          '是',
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
      getAntdModal().warning({
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
        const isActiveRaw =
          headerIndexMap.isActive !== undefined ? String(row[headerIndexMap.isActive] ?? '').trim() : '';
        const isActive =
          !isActiveRaw ||
          !['0', 'false', 'no', 'n', '否', '停用', 'inactive'].includes(isActiveRaw.toLowerCase());
        const workstationData: WorkstationCreate = {
          code: codeValue.toUpperCase(),
          name: nameValue,
          productionLineId: foundProductionLine.id,
          description: description ? String(description).trim() : undefined,
          isActive,
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
      
      getAntdModal().warning({
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
      const result = await importInChunksViaPerItemCreate({
        items: importData,
        createOne: async (item: WorkstationCreate, _index) => {
          return await workstationApi.create(item);
        },
        title: t('app.master-data.workstations.importTitle'),
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
        filename = `${t('app.master-data.workstations.exportFilenameSelected', { date: todaySiteDateString() })}.csv`;
      } else if (type === 'currentPage' && currentPageData) {
        // 导出当前页数据
        exportData = currentPageData;
        filename = `${t('app.master-data.workstations.exportFilenameCurrentPage', { date: todaySiteDateString() })}.csv`;
      } else {
        // 导出全部数据
        exportData = await fetchAllListItems((p) => workstationApi.list({ ...p, ...lastListParamsRef.current }));
        filename = `${t('app.master-data.workstations.exportFilenameAll', { date: todaySiteDateString() })}.csv`;
      }

      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }

      // 构建 CSV 内容
      const headers = [t('app.master-data.workstations.code'), t('app.master-data.workstations.name'), t('app.master-data.workstations.productionLineName'), t('common.remark'), t('common.status'), t('common.createdAt')];
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
      messageApi.success(t('common.exportSuccess', { count: exportData.length }));
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
      const detail = await workstationApi.get(uuid);
      setWorkstationDetail(detail);
      await loadFieldValuesForDetail(detail.id);
    } catch (error) {
      setWorkstationDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.master-data.workstations.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (record: Workstation) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setWorkstationDetail(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setWorkstationDetail(null);
    setDetailError(null);
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
  const workstationActiveValueEnum = useMemo(
    () => buildMasterCrudActiveValueEnum(t, 'common.enabled', 'common.disabled'),
    [t],
  );

  const columns: ProColumns<Workstation>[] = React.useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
      ...masterCrudCodeNameSearchColumns({
        code: t('app.master-data.workstations.code'),
        name: t('app.master-data.workstations.name'),
      }),
    {
      title: t('app.master-data.workstations.code'),
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
      title: t('app.master-data.workstations.name'),
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
      title: t('app.master-data.workstations.productionLineName'),
      key: 'master_ref_production_line',
      dataIndex: 'productionLineId',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      order: 15,
      valueType: 'select',
      valueEnum: productionLines.reduce((acc, line) => {
        acc[line.id] = { text: line.name };
        return acc;
      }, {} as Record<number, { text: string }>),
      sorter: true,
      render: (_, record) => formatProductionLineDisplay(record),
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
    ...buildMasterCrudActiveStatusColumn<Workstation>(t, {
      activeValueEnum: workstationActiveValueEnum,
      statusTitleKey: 'app.master-data.workstations.statusLabel',
    }),
    ...masterCrudCreatedUpdatedColumns<Workstation>(t),
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
          title={t('app.master-data.workstations.deleteConfirm')}
          onConfirm={() => handleDelete(record)}
        >
          <Button type="link" size="small" {...rowActionKind('delete')} />
        </Popconfirm>,
      ],
    },
    ];
  }, [customFields, t, productionLines, workstationActiveValueEnum, formatProductionLineDisplay]);

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
      key: 'productionLineName',
      render: (_, record) => formatProductionLineDisplay(record),
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
        <UniTable<Workstation>
        columnPersistenceId="apps.master-data.pages.factory.workstations.list-v3"
        actionRef={actionRef}
        columns={alignProColumns(columns, MASTER_DATA_LIST_FIELD_RANK)}
        request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
          const pageSize = params.pageSize || 20;
          const skip = ((params.current || 1) - 1) * pageSize;
          const listParams = resolveMasterCrudListParams(searchFormValues, sort, {
            extra: (search) => {
              const production_line_id = pickOptionalId(search, 'productionLineId');
              return production_line_id != null ? { production_line_id } : {};
            },
          });
          lastListParamsRef.current = listParams;

          try {
            const result = await workstationApi.list({
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
        helpViewConfig={buildListPageHelpViewConfig('masterData.workstations')}
        defaultViewType="table"
        showImportButton={true}
        onImport={handleImport}
        importHeaders={workstationImportTemplate.importHeaders}
        importExampleRow={workstationImportTemplate.importExampleRow}
        importColumnOptions={workstationImportTemplate.importColumnOptions}
        importFieldMap={workstationImportTemplate.importHeaderMap}
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
      <MasterDataDetailDrawer
        title={t('app.master-data.workstations.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        detail={workstationDetail}
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
          workstationDetail ? (
            <QRCodeGenerator
              data={{
                station_uuid: workstationDetail.uuid,
                station_code: workstationDetail.code,
                station_name: workstationDetail.name,
              }}
              qrcodeType="STATION"
              size={6}
              noCard={true}
            />
          ) : undefined
        }
        extra={buildDetailDrawerEditExtra(t, Boolean(workstationDetail), () => {
          if (!workstationDetail) return;
          handleEdit(workstationDetail);
        })}
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

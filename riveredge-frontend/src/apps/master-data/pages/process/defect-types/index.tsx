/**
 * 不良品信息管理页面
 * 
 * 提供不良品信息的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, List, Typography, Descriptions } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, flushDrawerOpen } from '../../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../../components/uni-detail';
import { DefectTypeFormModal } from '../../../components/DefectTypeFormModal';

import { defectTypeApi } from '../../../services/process';
import type { DefectType, DefectTypeCreate } from '../../../types/process';
import { DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';
import { generateCode } from '../../../../../services/codeRule';
import { downloadFile } from '../../../../../utils';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { batchImportParsedRows } from '../../../../../utils/import';
import { extractProTableSort, mapProcessListSortField } from '../../../../../utils/tableQueryKey';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../utils/factoryImportTemplate';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  MasterDataBatchActiveMenuButton,
  useMasterDataBatchSetActive,
} from '../../../hooks/useMasterDataBatchSetActive';
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';

/**
 * 不良品信息管理列表页面组件
 */
const DefectTypesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const defectTypeImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'app.master-data.defectTypes.code' },
          { field: 'name', required: true, labelKey: 'app.master-data.defectTypes.name' },
          {
            field: 'description',
            labelKey: 'field.defectType.description',
            aliases: ['描述'],
          },
        ],
        [
          t('app.master-data.defectTypes.importExample.code'),
          t('app.master-data.defectTypes.importExample.name'),
          t('app.master-data.defectTypes.importExample.description'),
        ],
      ),
    [t, i18n.language],
  );
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [defectTypeDetail, setDefectTypeDetail] = useState<DefectType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑不良品）
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const defectDetailReqRef = useRef(0);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<DefectType>({ tableName: 'master_data_defect_types' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: defectTypeApi.update,
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  useEffect(() => {
    if (customFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [customFields.length]);

  const defectTypeDetailColumns: ProDescriptionsItemProps<DefectType>[] = useMemo(
    () => [
      { title: t('app.master-data.defectTypes.code'), dataIndex: 'code' },
      { title: t('app.master-data.defectTypes.name'), dataIndex: 'name' },
      { title: t('field.defectType.description'), dataIndex: 'description' },
      {
        title: t('field.defectType.isActive'),
        dataIndex: 'isActive',
        render: (_: unknown, record: DefectType) => {
          const isActive = record?.isActive ?? false;
          return (
            <Tag color={isActive ? 'success' : 'default'}>
              {isActive ? t('app.master-data.plants.enabled') : t('app.master-data.plants.disabled')}
            </Tag>
          );
        },
      },
      { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
    ],
    [t]
  );

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = (record: DefectType) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理删除不良品
   */
  const handleDelete = async (record: DefectType) => {
    try {
      await defectTypeApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除不良品
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
          await defectTypeApi.delete(key.toString());
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

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: DefectType) => {
    const req = ++defectDetailReqRef.current;
    flushDrawerOpen(() => {
      setDefectTypeDetail(record);
      setDrawerVisible(true);
      setDetailLoading(true);
    });
    try {
      const detail = await defectTypeApi.get(record.uuid);
      if (defectDetailReqRef.current !== req) return;
      setDefectTypeDetail(detail);
      if (detail.id != null) {
        await loadFieldValuesForDetail(detail.id);
      }
    } catch (error: any) {
      if (defectDetailReqRef.current === req) {
        messageApi.error(error.message || t('app.master-data.defectTypes.getDetailFailed'));
      }
    } finally {
      if (defectDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setDefectTypeDetail(null);
    resetDetailFieldValues();
  };

  /**
   * 处理批量导入不良品
   * 启用状态默认启用，创建时间由后端自动生成，导入模板不包含该列
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.master-data.importEmpty'));
      return;
    }

    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    // 第1行表头、第2行示例，从第3行开始为数据行（导入组件已保留所有行，不过滤空行）
    const rows = data.slice(2);

    const nonEmptyRows = rows.filter((row: any[]) => {
      if (!row || row.length === 0) return false;
      return row.some((cell: any) => {
        const value = cell != null ? String(cell).trim() : '';
        return value !== '';
      });
    });

    if (nonEmptyRows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'));
      return;
    }

    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      defectTypeImportTemplate.importHeaderMap,
    );

    const autoCodeEnabled = isAutoGenerateEnabled('master-data-defect-type');
    if (!autoCodeEnabled && headerIndexMap['code'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: t('app.master-data.defectTypes.code'), headers: headers.join(', ') }));
      return;
    }
    if (headerIndexMap['name'] === undefined) {
      messageApi.error(t('app.master-data.importMissingField', { field: t('app.master-data.defectTypes.name'), headers: headers.join(', ') }));
      return;
    }

    const importData: DefectTypeCreate[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    nonEmptyRows.forEach((row: any[], rowIndex: number) => {
      const isEmpty = !row?.length || row.every((c: any) => (c != null ? String(c).trim() : '') === '');
      if (isEmpty) return;
      const actualRowIndex = rowIndex + 3; // 第1行表头、第2行示例，第3行起为数据

      const code = headerIndexMap['code'] !== undefined ? row[headerIndexMap['code']] : undefined;
      const name = row[headerIndexMap['name']];
      const category = headerIndexMap['category'] !== undefined ? row[headerIndexMap['category']] : undefined;
      const description = headerIndexMap['description'] !== undefined ? row[headerIndexMap['description']] : undefined;

      const codeValue = code != null ? String(code).trim() : '';
      const nameValue = name != null ? String(name).trim() : '';
      if (!autoCodeEnabled && !codeValue) {
        errors.push({ row: actualRowIndex, message: t('app.master-data.defectTypes.codeRequired') });
        return;
      }
      if (!nameValue) {
        errors.push({ row: actualRowIndex, message: t('app.master-data.defectTypes.nameRequired') });
        return;
      }

      importData.push({
        code: codeValue ? codeValue.toUpperCase() : '', // 为空且启用自动编号时，导入时再生成
        name: nameValue,
        category: category != null && String(category).trim() !== '' ? String(category).trim() : undefined,
        description: description != null && String(description).trim() !== '' ? String(description).trim() : undefined,
        isActive: true, // 启用状态默认启用，创建时间由后端自动获取
      });
    });

    if (errors.length > 0) {
      Modal.warning({
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
                  <Typography.Text type="danger">{t('app.master-data.rowError', { row: item.row, message: item.message })}</Typography.Text>
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

    const ruleCode = getPageRuleCode('master-data-defect-type');
    try {
      const result = await batchImportParsedRows<DefectTypeCreate>(
        importData.map((item, i) => ({ data: item, rowIndex: i + 3, rawRow: [] })),
        async (item) => {
          let data = { ...item };
          if (!data.code && autoCodeEnabled && ruleCode) {
            const res = await generateCode({ rule_code: ruleCode });
            data = { ...data, code: res.code };
          }
          if (!data.code) {
            throw new Error(t('app.master-data.defectTypes.codeRequiredAuto'));
          }
          return defectTypeApi.create(data);
        },
        { title: t('app.master-data.defectTypes.importTitle') }
      );

      const successCount = result.filter((r) => r.success).length;
      const failureCount = result.filter((r) => !r.success).length;

      if (failureCount > 0) {
        Modal.warning({
          title: t('app.master-data.importPartialResultTitle'),
          width: 600,
          content: (
            <div>
              <p><strong>{t('app.master-data.importPartialResultIntro', { success: successCount, failure: failureCount })}</strong></p>
              <List
                size="small"
                dataSource={result.filter((r) => !r.success)}
                renderItem={(item) => (
                  <List.Item>
                    <Typography.Text type="danger">{t('app.master-data.rowError', { row: item.rowIndex, message: item.error?.message ?? item.message })}</Typography.Text>
                  </List.Item>
                )}
              />
            </div>
          ),
        });
      } else {
        messageApi.success(t('app.master-data.defectTypes.importSuccess', { count: successCount }));
      }
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.importFailed'));
    }
  };

  /**
   * 处理批量导出
   */
  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: DefectType[]
  ) => {
    try {
      let exportData: DefectType[] = [];
      if (type === 'selected' && selectedRowKeys?.length && currentPageData) {
        exportData = currentPageData.filter((item) => selectedRowKeys.includes(item.uuid));
      } else if (type === 'currentPage' && currentPageData) {
        exportData = currentPageData;
      } else {
        const result = await defectTypeApi.list({ skip: 0, limit: 10000 });
        const list = result?.data ?? result;
        exportData = Array.isArray(list) ? list : [];
      }
      if (exportData.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }
      const blob = new Blob(['\ufeff' + JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
      const filename = `${t('app.master-data.defectTypes.exportFilename', { date: new Date().toISOString().slice(0, 10) })}.json`;
      downloadFile(blob, filename);
      messageApi.success(t('common.exportSuccess', { count: exportData.length }));
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.exportFailed'));
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<DefectType>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
    {
      title: t('app.master-data.defectTypes.code'),
      dataIndex: 'code',
      copyable: true,width: 150,
      fixed: 'left',
      sorter: true,
    },
    {
      title: t('app.master-data.defectTypes.name'),
      dataIndex: 'name',
      width: 200,
      sorter: true,
    },
    {
      title: t('field.defectType.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.master-data.defectTypes.status'),
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('app.master-data.plants.enabled'), status: 'Success' },
        false: { text: t('app.master-data.plants.disabled'), status: 'Default' },
      },
      render: (_: any, record: DefectType) => {
        const isActive = record?.isActive ?? false;
        return (
          <Tag color={isActive ? 'success' : 'default'}>
            {isActive ? t('app.master-data.plants.enabled') : t('app.master-data.plants.disabled')}
          </Tag>
        );
      },
      sorter: true,
    },
    ...customFieldColumns,
    {
      title: t('common.createdAt'),
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
      render: (_: any, record: DefectType) => {
        const val = record.createdAt;
        return val ? (typeof val === 'string' ? new Date(val).toLocaleString() : val) : '-';
      },
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_: any, record: DefectType) => (
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
          <Popconfirm
            key="delete"
            {...rowActionKind('delete')}
            title={t('app.master-data.defectTypes.deleteConfirm')}
            description={t('app.master-data.defectTypes.deleteDescription')}
            onConfirm={() => handleDelete(record)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
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
  }, [customFields, generateCustomFieldColumns, t]);

  return (
    <ListPageTemplate>
      <UniTable<DefectType>
        columnPersistenceId="apps.master-data.pages.process.defect-types"
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
            apiParams.isActive = searchFormValues.isActive;
          }

          const fuzzyKw = String(searchFormValues?.keyword ?? '').trim();
          const fallbackKw =
            fuzzyKw ||
            String(searchFormValues?.code ?? '').trim() ||
            String(searchFormValues?.name ?? '').trim();
          if (fallbackKw) apiParams.keyword = fallbackKw;

          const { sortBy: rawSortBy, sortOrder } = extractProTableSort(sort);
          const sortField = mapProcessListSortField(rawSortBy);
          if (sortField) {
            apiParams.sortBy = sortField;
            apiParams.sortOrder = sortOrder;
          }
          
          try {
            const result = await defectTypeApi.list(apiParams);
            const list = result?.data ?? result;
            const data = Array.isArray(list) ? list : [];
            const total = typeof result?.total === 'number' ? result.total : data.length;
            const enrichedData = await enrichRecordsWithCustomFields(data);
            return {
              data: enrichedData,
              success: true,
              total,
            };
          } catch (error: any) {
            console.error('获取不良品列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.defectTypes.listFailed'));
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
        createButtonText={t('field.defectType.createTitle') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t('common.confirmBatchDeleteContent', { count })}
        toolBarActionsAfterDelete={[
          <MasterDataBatchActiveMenuButton
            menuKey="defect-types-batch-active"
            selectedRowKeys={selectedRowKeys}
            menuItems={batchActiveMenuItems}
          />,
        ]}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={defectTypeImportTemplate.importHeaders}
        importExampleRow={defectTypeImportTemplate.importExampleRow}
        importFieldMap={defectTypeImportTemplate.importHeaderMap}
        showExportButton={true}
        onExport={handleExport}
      />

      <UniDetail
        title={t('app.master-data.defectTypes.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={
          defectTypeDetail ? (
            <Descriptions
              column={1}
              items={detailDrawerDescriptionItems(defectTypeDetailColumns, defectTypeDetail)}
            />
          ) : null
        }
        linesTitle={t('app.master-data.customFields')}
        lines={
          hasCustomFieldsDetailContent(customFields, customFieldValues) ? (
            <CustomFieldsDetailSection customFields={customFields} customFieldValues={customFieldValues} />
          ) : null
        }
      />

      <DefectTypeFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />

    </ListPageTemplate>
  );
};

export default DefectTypesPage;

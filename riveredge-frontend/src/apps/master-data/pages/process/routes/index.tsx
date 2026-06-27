/**
 * 工艺路线管理页面
 * 
 * 提供工艺路线的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Descriptions } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { downloadFile } from '../../../../../utils';
import { batchImport } from '../../../../../utils/batchOperations';
import { ListPageTemplate, flushDrawerOpen } from '../../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../../components/uni-detail';
import { RouteFormModal } from '../../../components/RouteFormModal';

import { processRouteApi } from '../../../services/process';
import type { ProcessRoute } from '../../../types/process';
import { DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';
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
 * 工艺路线管理列表页面组件
 */
const ProcessRoutesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [processRouteDetail, setProcessRouteDetail] = useState<ProcessRoute | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const routeDetailReqRef = useRef(0);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<ProcessRoute>({ tableName: 'master_data_process_routes' });

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: processRouteApi.update,
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

  const routeImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'field.route.code' },
          { field: 'name', required: true, labelKey: 'field.route.name' },
          { field: 'description', labelKey: 'field.route.description', aliases: ['描述'] },
        ],
        [
          t('app.master-data.routes.importExample.code'),
          t('app.master-data.routes.importExample.name'),
          t('app.master-data.routes.importExample.description'),
        ],
      ),
    [t, i18n.language],
  );

  const processRouteDetailColumns: ProDescriptionsItemProps<ProcessRoute>[] = useMemo(
    () => [
      { title: t('field.route.code'), dataIndex: 'code' },
      { title: t('field.route.name'), dataIndex: 'name' },
      { title: t('field.route.description'), dataIndex: 'description' },
      {
        title: t('field.route.isActive'),
        dataIndex: 'is_active',
        render: (_: unknown, record: ProcessRoute) => {
          const isActive = record?.is_active ?? (record as any)?.isActive;
          return (
            <Tag color={isActive ? 'success' : 'default'}>
              {isActive ? t('app.master-data.plants.enabled') : t('app.master-data.plants.disabled')}
            </Tag>
          );
        },
      },
      { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
      {
        title: t('app.master-data.routes.operationSequence'),
        dataIndex: 'operation_sequence',
        span: 2,
        render: (_: unknown, record: ProcessRoute) => {
          const seq = record?.operation_sequence ?? (record as any)?.operationSequence;
          if (!seq) {
            return <span style={{ color: '#999' }}>{t('app.master-data.routes.noOperations')}</span>;
          }

          try {
            let operations: any[] = [];

            if (Array.isArray(seq)) {
              operations = seq;
            } else if (typeof seq === 'object' && seq !== null) {
              const seqObj = seq as Record<string, unknown>;
              if (seqObj.operations && Array.isArray(seqObj.operations)) {
                operations = seqObj.operations as any[];
              } else if (seqObj.sequence && Array.isArray(seqObj.sequence)) {
                operations = (seqObj.sequence as string[]).map((uuid: string) => ({
                  uuid,
                  code: uuid.substring(0, 8),
                  name: t('app.master-data.routes.operation'),
                }));
              } else {
                const entries = Object.entries(seqObj);
                for (const [, value] of entries) {
                  if (Array.isArray(value)) {
                    operations = value as any[];
                    break;
                  }
                }

                if (operations.length === 0) {
                  const allValues = Object.values(seqObj).filter((v) => v != null);
                  if (allValues.length > 0 && Array.isArray(allValues[0])) {
                    operations = allValues[0] as any[];
                  } else if (allValues.length > 0) {
                    operations = allValues as any[];
                  }
                }
              }
            }

            if (!operations || operations.length === 0) {
              return <span style={{ color: '#999' }}>{t('app.master-data.routes.noOperations')}</span>;
            }

            const getOpLabel = (op: any, index: number) => {
              if (op?.code != null) return `${op.code} - ${op?.name ?? t('app.master-data.routes.unknownOperation')}`;
              if (op?.name != null) return op.name;
              if (op?.operation_uuid) return `${t('app.master-data.routes.operation')} ${index + 1} (${String(op.operation_uuid).slice(0, 8)}...)`;
              if (op?.operation_id) return `${t('app.master-data.routes.operation')} ${index + 1} (ID: ${op.operation_id})`;
              return `${t('app.master-data.routes.operation')} ${index + 1}`;
            };
            return (
              <div>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  {t('app.master-data.routes.operationSequenceCount', {
                    count: operations.length,
                  })}
                </div>
                <Space wrap>
                  {operations.map((op: any, index: number) => (
                    <Tag key={op?.uuid ?? op?.operation_uuid ?? index} color="blue">
                      {getOpLabel(op, index)}
                    </Tag>
                  ))}
                </Space>
              </div>
            );
          } catch (error: any) {
            console.error('解析工序序列失败:', error, seq);
            return (
              <span style={{ color: '#ff4d4f' }}>
                {t('app.master-data.routes.operationSequenceParseFailed', {
                  message: error.message,
                })}
              </span>
            );
          }
        },
      },
    ],
    [t]
  );

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = (record: ProcessRoute) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理删除工艺路线
   */
  const handleDelete = async (record: ProcessRoute) => {
    try {
      await processRouteApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除工艺路线
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
          await processRouteApi.delete(key.toString());
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
    if (rows.length === 0) {
      messageApi.warning(t('app.master-data.importNoRows'));
      return;
    }
    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      routeImportTemplate.importHeaderMap,
    );
    if (headerIndexMap['code'] === undefined || headerIndexMap['name'] === undefined) {
      messageApi.error(
        t('app.master-data.importMissingField', {
          field: `${t('field.route.code')}/${t('field.route.name')}`,
          headers: headers.join(', '),
        }),
      );
      return;
    }
    const items: { code: string; name: string; description?: string }[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    rows.forEach((row: any[], i: number) => {
      const code = (row[headerIndexMap['code']] ?? '').toString().trim();
      const name = (row[headerIndexMap['name']] ?? '').toString().trim();
      const desc =
        headerIndexMap['description'] !== undefined
          ? (row[headerIndexMap['description']] ?? '').toString().trim()
          : undefined;
      if (!code) {
        errors.push({ row: i + 3, message: t('app.master-data.routes.codeRequired') });
        return;
      }
      if (!name) {
        errors.push({ row: i + 3, message: t('app.master-data.routes.nameRequired') });
        return;
      }
      items.push({ code, name, description: desc || undefined });
    });
    if (errors.length > 0) {
      Modal.warning({
        title: t('app.master-data.dataValidationFailed'),
        width: 600,
        content: (
          <div>
            <p>{t('app.master-data.validationFailedIntro')}</p>
            <List size="small" dataSource={errors} renderItem={(e) => (
              <List.Item><Typography.Text type="danger">{t('app.master-data.rowError', { row: e.row, message: e.message })}</Typography.Text></List.Item>
            )} />
          </div>
        ),
      });
      return;
    }
    try {
      const result = await batchImport({
        items,
        importFn: async (item) => processRouteApi.create(item),
        title: t('app.master-data.routes.importTitle'),
        concurrency: 5,
      });
      if (result.failureCount > 0) {
        Modal.warning({
          title: t('app.master-data.importPartialResultTitle'),
          width: 600,
          content: (
            <div>
              <p><strong>{t('app.master-data.importPartialResultIntro', { success: result.successCount, failure: result.failureCount })}</strong></p>
              {result.errors.length > 0 && (
                <List size="small" dataSource={result.errors} renderItem={(e) => (
                  <List.Item><Typography.Text type="danger">{t('app.master-data.rowError', { row: e.row, message: e.error })}</Typography.Text></List.Item>
                )} />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(t('app.master-data.importSuccess', { count: result.successCount }));
      }
      if (result.successCount > 0) actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.importFailed'));
    }
  };

  const handleExport = async (type: 'selected' | 'currentPage' | 'all', selectedRowKeys?: React.Key[], currentPageData?: ProcessRoute[]) => {
    try {
      let toExport: ProcessRoute[] = [];
      if (type === 'all') {
        const res = await processRouteApi.list({ skip: 0, limit: 10000 });
        toExport = Array.isArray(res) ? res : res?.data ?? [];
      } else if (type === 'selected' && selectedRowKeys?.length && currentPageData) {
        toExport = currentPageData.filter((r) => selectedRowKeys.includes(r.uuid));
      } else if (type === 'currentPage' && currentPageData) {
        toExport = currentPageData;
      } else {
        const res = await processRouteApi.list({ skip: 0, limit: 10000 });
        toExport = Array.isArray(res) ? res : res?.data ?? [];
      }
      if (toExport.length === 0) {
        messageApi.warning(t('app.master-data.noExportData'));
        return;
      }
      const enabledLabel = t('app.master-data.plants.enabled');
      const disabledLabel = t('app.master-data.plants.disabled');
      const headers = [
        t('field.route.code'),
        t('field.route.name'),
        t('field.route.description'),
        t('app.master-data.routes.status'),
        t('common.createdAt'),
      ];
      const csvRows = [headers.join(',')];
      toExport.forEach((r) => {
        const isActive = r?.is_active ?? (r as any)?.isActive;
        csvRows.push([
          r.code || '',
          r.name || '',
          (r as any).description || '',
          isActive ? enabledLabel : disabledLabel,
          r.created_at ? new Date(r.created_at).toLocaleString() : '',
        ].map((c) => {
          const s = String(c ?? '');
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(','));
      });
      const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
      downloadFile(blob, `${t('app.master-data.routes.exportFilename', { date: new Date().toISOString().slice(0, 10) })}.csv`);
      messageApi.success(t('common.exportSuccess', { count: toExport.length }));
    } catch (error: any) {
      messageApi.error(error?.message || t('common.exportFailed'));
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ProcessRoute) => {
    const req = ++routeDetailReqRef.current;
    flushDrawerOpen(() => {
      setProcessRouteDetail(record);
      setDrawerVisible(true);
      setDetailLoading(true);
    });
    try {
      const detail = await processRouteApi.get(record.uuid);
      if (routeDetailReqRef.current !== req) return;
      setProcessRouteDetail(detail);
      if (detail.id != null) {
        await loadFieldValuesForDetail(detail.id);
      }
    } catch (error: any) {
      if (routeDetailReqRef.current === req) {
        messageApi.error(error.message || t('app.master-data.routes.getDetailFailed'));
      }
    } finally {
      if (routeDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setProcessRouteDetail(null);
    resetDetailFieldValues();
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ProcessRoute>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
    {
      title: t('field.route.code'),
      dataIndex: 'code',
      copyable: true,width: 150,
      fixed: 'left',
      sorter: true,
    },
    {
      title: t('field.route.name'),
      dataIndex: 'name',
      width: 200,
      sorter: true,
    },
    {
      title: t('field.route.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.master-data.routes.status'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('app.master-data.plants.enabled'), status: 'Success' },
        false: { text: t('app.master-data.plants.disabled'), status: 'Default' },
      },
      render: (_: any, record: ProcessRoute) => {
        const isActive = record?.is_active ?? (record as any)?.isActive;
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
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_: any, record: ProcessRoute) => (
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
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.master-data.routes.deleteConfirm')}
            description={t('app.master-data.routes.deleteDescription')}
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

  return (
    <ListPageTemplate>
      <UniTable<ProcessRoute>
        columnPersistenceId="apps.master-data.pages.process.routes"
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
            const result = await processRouteApi.list(apiParams);
            const listData = Array.isArray(result) ? result : result?.data ?? [];
            const enrichedData = await enrichRecordsWithCustomFields(listData);
            return {
              data: enrichedData,
              success: true,
              total: typeof result?.total === 'number' ? result.total : listData.length,
            };
          } catch (error: any) {
            console.error('获取工艺路线列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.routes.listFailed'));
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
        createButtonText={t('field.route.createTitle') + NEW_SHORTCUT_HINT}
        onCreate={handleCreate}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t('common.confirmBatchDeleteContent', { count })}
        toolBarActionsAfterDelete={[
          <MasterDataBatchActiveMenuButton
            menuKey="process-routes-batch-active"
            selectedRowKeys={selectedRowKeys}
            menuItems={batchActiveMenuItems}
          />,
        ]}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={routeImportTemplate.importHeaders}
        importExampleRow={routeImportTemplate.importExampleRow}
        importFieldMap={routeImportTemplate.importHeaderMap}
        importFieldRules={{ code: { required: true }, name: { required: true } }}
        showExportButton={true}
        onExport={handleExport}
      />

      <UniDetail
        title={t('app.master-data.routes.detailTitle')}
        open={drawerVisible}
        onClose={handleCloseDetail}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={
          processRouteDetail ? (
            <Descriptions
              column={1}
              items={detailDrawerDescriptionItems(processRouteDetailColumns, processRouteDetail)}
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

      <RouteFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />

    </ListPageTemplate>
  );
};

export default ProcessRoutesPage;

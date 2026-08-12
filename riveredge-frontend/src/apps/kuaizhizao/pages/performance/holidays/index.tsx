import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 假期管理页面
 *
 * 提供假期的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space, theme as AntdTheme } from 'antd';
import { DeleteOutlined, CalendarOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { PerformanceConfigDetailDrawer } from '../shared/performanceConfigDetailDrawer';
import { holidayApi } from '../../../services/performance';
import { HolidayFormModal } from '../../../components/HolidayFormModal';
import { HolidayCnImportModal } from '../../../components/HolidayCnImportModal';
import type { Holiday } from '../../../types/performance';
import { getPerformanceConfigActiveLifecycle } from '../../../utils/performanceLifecycle';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import {
  getPerformanceActiveValueEnum,
  renderActiveTag,
  renderPerformanceTypeMarker,
} from '../components/performanceMeta';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  normalizePerformanceListResponse,
  PERFORMANCE_PINNED_ACTIVE_FIELD,
  resolveHolidayListParams,
} from '../../../utils/performanceListCore';

const HOLIDAY_RESOURCE = 'kuaizhizao:performance-holidays';

const HolidaysPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = AntdTheme.useToken();
  const holidayDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const holidayPerms = useResourcePermissions(HOLIDAY_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [holidayDetail, setHolidayDetail] = useState<Holiday | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [holidayTrackingRefreshKey, setHolidayTrackingRefreshKey] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<Holiday>({ tableName: 'master_data_holidays' });

  useEffect(() => {
    if (customFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [customFields.length]);

  const holidayTracking = useDocumentTracking(
    drawerVisible && holidayDetail?.id != null ? 'performance_holiday' : undefined,
    holidayDetail?.id,
    holidayTrackingRefreshKey,
  );

  const holidayDetailColumns: ProDescriptionsItemProps<Holiday>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.performance.holidays.columns.holidayName'), dataIndex: 'name' },
      { title: t('app.kuaizhizao.performance.holidays.columns.holidayDate'), dataIndex: 'holidayDate', valueType: 'date' },
      { title: t('app.kuaizhizao.performance.holidays.columns.holidayType'), dataIndex: 'holidayType' },
      { title: t('app.kuaizhizao.performance.common.columns.description'), dataIndex: 'description', span: 3 },
      {
        title: t('app.kuaizhizao.performance.holidays.columns.activeStatus'),
        dataIndex: 'isActive',
        render: (_, record) => renderActiveTag(t, record?.isActive),
      },
      { title: t('app.kuaizhizao.performance.common.columns.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: t('app.kuaizhizao.performance.common.columns.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
    ],
    [t],
  );

  const handleCreate = () => { setEditUuid(null); setModalVisible(true); };
  const handleEdit = (record: Holiday) => { setEditUuid(record.uuid); setModalVisible(true); };
  const handleDelete = async (record: Holiday) => {
    try {
      await holidayApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }
    try {
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];
      for (const key of keys) {
        try {
          await holidayApi.delete(key.toString());
          successCount++;
        } catch (error: any) {
          failCount++;
          errors.push(error.message || t('common.deleteFailed'));
        }
      }
      if (successCount > 0) messageApi.success(t('common.batchDeleteSuccess', { count: successCount }));
      if (failCount > 0) messageApi.error(t('common.batchDeletePartial', { count: failCount, errors: errors.length > 0 ? '：' + errors.join('; ') : '' }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.batchDeleteFailed'));
    }
  };

  const handleOpenDetail = async (record: Holiday) => {
    try {
      setDrawerVisible(true);
      setHolidayDetail(null);
      setDetailLoading(true);
      const detail = await holidayApi.get(record.uuid);
      setHolidayDetail(detail);
      if (detail.id != null) {
        await loadFieldValuesForDetail(detail.id);
      }
      setHolidayTrackingRefreshKey((k) => k + 1);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.holidays.getDetailFailed'));
      setDrawerVisible(false);
      setHolidayDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleModalSuccess = () => { setModalVisible(false); setEditUuid(null); actionRef.current?.reload(); };
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setHolidayDetail(null);
    resetDetailFieldValues();
  };

  const columns: ProColumns<Holiday>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return alignProColumns<Holiday>([
    {
      title: t('app.kuaizhizao.performance.holidays.columns.holidayName'),
      key: 'performance_holiday_stacked',
      dataIndex: 'name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      sorter: true,
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.name ?? '').trim() || '-'}
          secondary={r.holidayDate ? String(r.holidayDate) : '-'}
          secondaryCopyable={false}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.performance.holidays.columns.holidayDate'),
      dataIndex: 'holidayDate',
      width: 132,
      minWidth: 132,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'date',
      sorter: true,
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.performance.holidays.columns.holidayType'),
      dataIndex: 'holidayType',
      width: 110,
      minWidth: 110,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      render: (_, r) => renderPerformanceTypeMarker(r.holidayType),
    },
    {
      title: t('app.kuaizhizao.performance.common.columns.description'),
      dataIndex: 'description',
      width: 200,
      minWidth: 200,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
    },
    ...customFieldColumns,
    {
      title: t('app.kuaizhizao.performance.common.active.enabled'),
      dataIndex: 'isActive',
      hideInTable: true,
      valueType: 'select',
      valueEnum: getPerformanceActiveValueEnum(t),
    },
    ...buildDocumentAuditColumns<Holiday>(t),
    {
      title: t('app.kuaizhizao.performance.common.columns.status'),
      dataIndex: 'isActive',
      width: 88,
      minWidth: 88,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      render: (_, r) => renderActiveTag(t, r.isActive),
    },
    {
      title: t('app.kuaizhizao.performance.common.columns.actions'),
      key: 'action',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => (
        <Space>
          <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)}>
            {t('app.kuaizhizao.performance.common.actions.detail')}
          </Button>
          <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)}>
            {t('app.kuaizhizao.performance.common.actions.edit')}
          </Button>
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.kuaizhizao.performance.holidays.messages.deleteConfirm')} onConfirm={() => handleDelete(record)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              {t('app.kuaizhizao.performance.common.actions.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
    ], SALES_DOC_LIST_FIELD_RANK);
  }, [t, customFields]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<Holiday>
          headerTitle={t('app.kuaizhizao.performance.holidays.pageTitle')}
          actionRef={actionRef}
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.holidays.v1"
          request={async (params, sort, _filter, searchFormValues) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const listParams = resolveHolidayListParams(searchFormValues, sort);
            try {
              const result = await holidayApi.list({ skip, limit: pageSize, ...listParams });
              const { data: raw, total } = normalizePerformanceListResponse(result);
              const enrichedRows = await enrichRecordsWithCustomFields(raw as Holiday[]);
              return { data: enrichedRows, success: true, total };
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.performance.holidays.messages.loadListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          skipFuzzyPinyinClientFilter
          pinnedTabsField={PERFORMANCE_PINNED_ACTIVE_FIELD}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          showCreateButton
          createButtonText={t('app.kuaizhizao.performance.holidays.createButton')}
          onCreate={handleCreate}
          toolBarRender={() =>
            holidayPerms.canCreate
              ? [
                  <Button
                    key="import-cn"
                    icon={<CalendarOutlined />}
                    onClick={() => setImportModalVisible(true)}
                  >
                    {t('app.kuaizhizao.performance.holidays.importCn.button')}
                  </Button>,
                ]
              : []
          }
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('common.confirmBatchDeleteContent', { count })}
          deleteButtonText={t('app.kuaizhizao.performance.holidays.messages.deleteBatchButton')}
        />
      </ListPageTemplate>
      <PerformanceConfigDetailDrawer
        title={t('app.kuaizhizao.performance.holidays.detailTitle')}
        open={drawerVisible}
        zIndex={holidayDetailDrawerZIndex}
        onClose={handleCloseDetail}
        loading={detailLoading}
        detail={holidayDetail}
        detailColumns={holidayDetailColumns}
        basicColumn={3}
        documentType="performance_holiday"
        detailId={holidayDetail?.id ?? null}
        lifecycleResolver={(row, tr) => getPerformanceConfigActiveLifecycle(row as Record<string, unknown>, tr)}
        tracking={holidayTracking}
        customFields={customFields}
        customFieldValues={customFieldValues}
        showEmptyDetailPlaceholder
        t={t}
        navigate={navigate}
      />
      <HolidayFormModal open={modalVisible} onClose={() => { setModalVisible(false); setEditUuid(null); }} editUuid={editUuid} onSuccess={handleModalSuccess} />
      <HolidayCnImportModal
        open={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onSuccess={() => actionRef.current?.reload()}
      />
    </>
  );
};

export default HolidaysPage;

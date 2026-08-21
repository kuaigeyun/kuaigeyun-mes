import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 假期管理页面
 *
 * 提供假期的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space, theme as AntdTheme } from 'antd';
import { DeleteOutlined, CalendarOutlined } from '@ant-design/icons';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../equipment-management/shared/equipmentMasterDataDetail';
import { PerformanceConfigDetailDrawer } from '../shared/performanceConfigDetailDrawer';
import { holidayApi } from '../../../services/performance';
import { HolidayFormModal } from '../../../components/HolidayFormModal';
import { HolidayCnImportModal } from '../../../components/HolidayCnImportModal';
import type { Holiday } from '../../../types/performance';
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
  const { token } = AntdTheme.useToken();
  const holidayDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const holidayPerms = useResourcePermissions(HOLIDAY_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [holidayDetail, setHolidayDetail] = useState<Holiday | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
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
  const holidayDetailColumns: ProDescriptionsItemProps<Holiday>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.performance.holidays.columns.holidayName'), dataIndex: 'name' },
      { title: t('app.kuaizhizao.performance.holidays.columns.holidayDate'), dataIndex: 'holidayDate', valueType: 'date' },
      {
        title: t('app.kuaizhizao.performance.holidays.columns.holidayType'),
        dataIndex: 'holidayType',
        render: (_, record) => renderPerformanceTypeMarker(record?.holidayType),
      },
      { title: t('common.remark'), dataIndex: 'description', span: 2 },
      {
        title: t('app.kuaizhizao.performance.holidays.columns.activeStatus'),
        dataIndex: 'isActive',
        render: (_, record) => renderActiveTag(t, record?.isActive),
      },
      { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
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

  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await holidayApi.get(uuid);
      setHolidayDetail(detail);
      if (detail.id != null) {
        await loadFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      setHolidayDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.master-data.holidays.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (record: Holiday) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setHolidayDetail(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  const handleModalSuccess = () => { setModalVisible(false); setEditUuid(null); actionRef.current?.reload(); };
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setHolidayDetail(null);
    setDetailError(null);
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
        render: (_, record) => renderPerformanceTypeMarker(record?.holidayType),
      width: 110,
      minWidth: 110,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      render: (_, r) => renderPerformanceTypeMarker(r.holidayType),
    },
    {
      title: t('common.remark'),
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
      title: t('common.enabled'),
      dataIndex: 'isActive',
      hideInTable: true,
      valueType: 'select',
      valueEnum: getPerformanceActiveValueEnum(t),
    },
    ...buildDocumentAuditColumns<Holiday>(t),
    {
      title: t('common.status'),
      dataIndex: 'isActive',
      width: 88,
      minWidth: 88,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      render: (_, r) => renderActiveTag(t, r.isActive),
    },
    {
      title: t('common.actions'),
      key: 'action',
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => (
        <Space>
          {holidayPerms.canRead ? (
            <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)}>
              {t('common.detail')}
            </Button>
          ) : null}
          {holidayPerms.canUpdate ? (
            <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)}>
              {t('common.edit')}
            </Button>
          ) : null}
          {holidayPerms.canDelete ? (
            <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.kuaizhizao.performance.holidays.messages.deleteConfirm')} onConfirm={() => handleDelete(record)}>
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                {t('common.delete')}
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
    ], SALES_DOC_LIST_FIELD_RANK);
  }, [t, customFields, holidayPerms]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<Holiday>
          headerTitle={t('app.kuaizhizao.performance.holidays.pageTitle')}
          actionRef={actionRef}
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.holidays.v1"
          request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const listParams = resolveHolidayListParams(searchFormValues, sort);
            try {
              const result = await holidayApi.list({ skip, limit: pageSize, ...listParams });
              const { data: raw, total } = normalizePerformanceListResponse(result);
              const enrichedRows = meta?.purpose === 'prefetch'
                ? raw as Holiday[]
                : await enrichRecordsWithCustomFields(raw as Holiday[]);
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
          showCreateButton={holidayPerms.canCreate}
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
          enableRowSelection={holidayPerms.canDelete}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={holidayPerms.canDelete}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('common.confirmBatchDeleteContent', { count })}
          deleteButtonText={t('common.batchDelete')}
        />
      </ListPageTemplate>
      <PerformanceConfigDetailDrawer
        title={t('app.kuaizhizao.performance.holidays.detailTitle')}
        open={drawerVisible}
        zIndex={holidayDetailDrawerZIndex}
        onClose={handleCloseDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
        detail={holidayDetail}
        detailColumns={holidayDetailColumns}
        customFields={customFields}
        customFieldValues={customFieldValues}
        extra={buildDetailDrawerEditExtra(t, Boolean(holidayDetail && holidayPerms.canUpdate), () => {
          if (!holidayDetail) return;
          handleEdit(holidayDetail);
        })}
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

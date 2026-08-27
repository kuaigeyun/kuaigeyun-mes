/**
 * 班次定义页面
 */

import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Popconfirm, theme as AntdTheme } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../equipment-management/shared/equipmentMasterDataDetail';
import { PerformanceConfigDetailDrawer } from '../shared/performanceConfigDetailDrawer';
import { shiftApi } from '../../../services/performance';
import type { Shift } from '../../../types/performance';
import { ShiftFormModal } from '../../../components/ShiftFormModal';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import {
  getPerformanceInactiveActiveValueEnum,
  renderActiveTag,
  renderYesNoTag,
} from '../components/performanceMeta';
import {
  normalizePerformanceListResponse,
  PERFORMANCE_PINNED_ACTIVE_FIELD,
  resolveShiftListParams,
} from '../../../utils/performanceListCore';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';

const SHIFT_RESOURCE = 'kuaizhizao:performance-shifts';

const ShiftsPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = AntdTheme.useToken();
  const detailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const shiftPerms = useResourcePermissions(SHIFT_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [shiftDetail, setShiftDetail] = useState<Shift | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);

  const detailColumns: ProDescriptionsItemProps<Shift>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.performance.shifts.columns.shiftCode'), dataIndex: 'code' },
      { title: t('app.kuaizhizao.performance.shifts.columns.shiftName'), dataIndex: 'name' },
      {
        title: t('app.kuaizhizao.performance.shifts.columns.timeRange'),
        dataIndex: 'startTime',
        render: (_, r) => `${r?.startTime?.slice(0, 5) ?? '-'} ~ ${r?.endTime?.slice(0, 5) ?? '-'}`,
      },
      {
        title: t('app.kuaizhizao.performance.shifts.columns.crossesMidnight'),
        dataIndex: 'crossesMidnight',
        render: (_, r) => renderYesNoTag(t, r?.crossesMidnight),
      },
      { title: t('app.kuaizhizao.performance.shifts.columns.standardHours'), dataIndex: 'standardHours' },
      {
        title: t('common.status'),
        dataIndex: 'isActive',
        render: (_, r) => renderActiveTag(t, r?.isActive, 'inactive'),
      },
      { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
    ],
    [t],
  );

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.performance.shifts.messages.selectFirst'));
      return;
    }
    try {
      for (const key of keys) {
        await shiftApi.delete(String(key));
      }
      messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteBatchSuccess', { count: keys.length }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('common.deleteFailed'));
    }
  };

  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setShiftDetail(await shiftApi.get(uuid));
    } catch (error) {
      setShiftDetail(null);
      setDetailError(getApiErrorMessage(error, t('common.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (record: Shift) => {
    detailRetryUuidRef.current = record.uuid;
    setDrawerVisible(true);
    setShiftDetail(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setShiftDetail(null);
    setDetailError(null);
  };

  const columns: ProColumns<Shift>[] = useMemo(
    () => alignProColumns<Shift>([
      {
        // 列稀疏：业务列不堆叠（表单序：编码 → 名称）；审计叠列仍走 buildDocumentAuditColumns
        title: t('app.kuaizhizao.performance.shifts.columns.shiftCode'),
        dataIndex: 'code',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        fixed: 'left',
        sorter: true,
        copyable: true,
      },
      {
        // 班次名称长短不一：唯一 RemainderFlex
        title: t('app.kuaizhizao.performance.shifts.columns.shiftName'),
        dataIndex: 'name',
        minWidth: 140,
        uniTableRemainderFlex: true,
        uniTablePrimaryFlex: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.shifts.columns.timeRange'),
        key: 'timeRange',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) => `${r.startTime?.slice(0, 5) ?? '-'} ~ ${r.endTime?.slice(0, 5) ?? '-'}`,
      },
      {
        title: t('app.kuaizhizao.performance.shifts.columns.standardHours'),
        dataIndex: 'standardHours',
        // 稀疏：表头「标准工时」+ 排序钮
        width: 132,
        minWidth: 132,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.shifts.columns.crossesMidnight'),
        dataIndex: 'crossesMidnight',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        hideInSearch: true,
        render: (_, r) => renderYesNoTag(t, r.crossesMidnight),
      },
      {
        title: t('common.enabled'),
        dataIndex: 'isActive',
        hideInTable: true,
        valueType: 'select',
        valueEnum: getPerformanceInactiveActiveValueEnum(t),
      },
      {
        title: t('common.enabled'),
        dataIndex: 'isActive',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        hideInSearch: true,
        sorter: true,
        render: (_, r) => renderActiveTag(t, r.isActive, 'inactive'),
      },
      ...buildDocumentAuditColumns<Shift>(t),
      {
        title: t('common.actions'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const parts: React.ReactNode[] = [];
          if (shiftPerms.canRead) {
            parts.push(
              <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)} />,
            );
          }
          if (shiftPerms.canUpdate) {
            parts.push(
              <Button
                key="edit"
                {...rowActionKind('update')}
                onClick={() => {
                  setEditUuid(record.uuid);
                  setModalVisible(true);
                }}
              />,
            );
          }
          if (shiftPerms.canDelete) {
            parts.push(
              <Popconfirm
                key="delete"
                title={t('app.kuaizhizao.performance.shifts.messages.deleteConfirm')}
                onConfirm={async () => {
                  try {
                    await shiftApi.delete(record.uuid);
                    messageApi.success(t('common.deleteSuccess'));
                    actionRef.current?.reload();
                  } catch (e: any) {
                    messageApi.error(e?.message || t('common.deleteFailed'));
                  }
                }}
              >
                <Button {...rowActionKind('delete')} />
              </Popconfirm>,
            );
          }
          return parts;
        },
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, messageApi, shiftPerms],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<Shift>
          headerTitle={t('app.kuaizhizao.performance.shifts.pageTitle')}
          columnPersistenceId="apps.kuaizhizao.pages.performance.shifts.v4"
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.shifts')}
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showCreateButton={shiftPerms.canCreate}
          createButtonText={t('app.kuaizhizao.performance.shifts.createButton')}
          onCreate={() => {
            setEditUuid(null);
            setModalVisible(true);
          }}
          enableRowSelection={shiftPerms.canDelete}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={shiftPerms.canDelete}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.performance.shifts.messages.deleteBatchConfirm', { count })}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          pinnedTabsField={PERFORMANCE_PINNED_ACTIVE_FIELD}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const pageSize = params.pageSize || 20;
              const skip = ((params.current || 1) - 1) * pageSize;
              const listParams = resolveShiftListParams(searchFormValues, sort);
              const response = await shiftApi.list({ skip, limit: pageSize, ...listParams });
              const { data, total } = normalizePerformanceListResponse(response);
              return { data: data as Shift[], success: true, total };
            } catch (e: any) {
              messageApi.error(e?.message || t('common.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        />
        <ShiftFormModal
          open={modalVisible}
          onClose={() => {
            setModalVisible(false);
            setEditUuid(null);
          }}
          editUuid={editUuid}
          onSuccess={() => actionRef.current?.reload()}
        />
      </ListPageTemplate>

      <PerformanceConfigDetailDrawer
        title={t('app.kuaizhizao.performance.shifts.detailTitle')}
        open={drawerVisible}
        zIndex={detailDrawerZIndex}
        onClose={handleCloseDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
        detail={shiftDetail}
        detailColumns={detailColumns}
        extra={buildDetailDrawerEditExtra(t, Boolean(shiftDetail && shiftPerms.canUpdate), () => {
          if (!shiftDetail) return;
          setEditUuid(shiftDetail.uuid);
          setModalVisible(true);
        })}
      />
    </>
  );
};

export default ShiftsPage;

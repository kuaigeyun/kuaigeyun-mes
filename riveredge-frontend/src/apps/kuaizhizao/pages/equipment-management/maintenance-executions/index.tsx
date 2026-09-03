import React, { useRef, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Descriptions, Modal, Typography } from 'antd';
import { MarkerTag, StatusTag } from '../../../../../constants/statusBadges';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { rowActionKind } from '../../../../../components/uni-action';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { maintenancePlanApi } from '../../../services/equipment';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  buildMaintenanceExecutionResultValueEnum,
  buildMaintenanceExecutionStatusValueEnum,
  MAINTENANCE_EXECUTION_PINNED_STATUS_FIELD,
  normalizeEquipmentListResponse,
  resolveMaintenanceExecutionListParams,
} from '../../../utils/equipmentListCore';
import { ROUTES } from '../../../constants/routes';
import LineAttachmentsUpload from '../../../components/LineAttachmentsUpload';
import { useEquipmentDetailDrawer } from '../shared/equipmentMasterDataDetail';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
const P = 'app.kuaizhizao.maintenanceExecution';
const RESOURCE = 'kuaizhizao:maintenance-plan';

interface MaintenanceExecution {
  uuid?: string;
  execution_no?: string;
  equipment_uuid?: string;
  equipment_name?: string;
  execution_date?: string;
  executor_name?: string;
  execution_result?: string;
  execution_content?: string;
  status?: string;
  maintenance_cost?: number;
  spare_parts_used?: { items?: Array<{ spare_part_id?: number; quantity?: number }> };
  source_type?: string;
  source_uuid?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  executed_items?: Array<{
    item_id?: number;
    item_name?: string;
    done?: boolean;
    attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  }>;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string;
  updated_by_name?: string;
}

const RESULT_COLORS: Record<string, string> = {
  正常: 'success',
  异常: 'error',
  待处理: 'warning',
};

const MaintenanceExecutionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { open: drawerVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<MaintenanceExecution>();

  const handleDetail = (record: MaintenanceExecution) => {
    if (!record.uuid) return;
    void openDetail(() => maintenancePlanApi.getExecution(record.uuid!) as Promise<MaintenanceExecution>);
  };

  const handleDelete = async (keys: React.Key[]) => {
    for (const key of keys) {
      await maintenancePlanApi.deleteExecution(String(key));
        }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    actionRef.current?.reload();
  };

  const executionStatusValueEnum = useMemo(() => buildMaintenanceExecutionStatusValueEnum(), []);
  const executionResultValueEnum = useMemo(() => buildMaintenanceExecutionResultValueEnum(t), [t]);

  const detailColumns: ProDescriptionsItemProps<MaintenanceExecution>[] = useMemo(
    () => [
      { title: t(`${P}.col.executionNo`), dataIndex: 'execution_no' },
      { title: t(`${P}.col.equipmentName`), dataIndex: 'equipment_name' },
      {
        title: t(`${P}.col.executionDate`),
        dataIndex: 'execution_date',
        render: (_, r) => (r.execution_date ? formatDateTime(r.execution_date) : '-'),
      },
      { title: t(`${P}.col.executorName`), dataIndex: 'executor_name' },
      {
        title: t(`${P}.col.executionResult`),
        dataIndex: 'execution_result',
        render: (_, r) => (
          <MarkerTag color={RESULT_COLORS[r.execution_result ?? ''] ?? 'default'}>
            {r.execution_result ?? '-'}
          </MarkerTag>
        ),
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => <StatusTag>{r.status ?? '-'}</StatusTag>,
      },
      { title: t(`${P}.col.executionContent`), dataIndex: 'execution_content', span: 2 },
      {
        title: t(`${P}.col.source`),
        key: 'source',
        render: (_, r) =>
          r.source_type === 'equipment_fault' && r.source_uuid ? (
            <Typography.Link
              onClick={() =>
                navigate(
                  `${ROUTES.EQUIPMENT_FAULTS}?uuid=${encodeURIComponent(r.source_uuid!)}`,
                )
              }
            >
              {t(`${P}.viewFault`)}
            </Typography.Link>
          ) : (
            '-'
          ),
      },
      {
        title: t(`${P}.col.sparePartsUsed`),
        key: 'spare_parts_used',
        span: 2,
        render: (_, r) =>
          r.spare_parts_used?.items?.length
            ? r.spare_parts_used.items.map((i) => `#${i.spare_part_id}×${i.quantity}`).join(', ')
            : '-',
      },
    ],
    [t, navigate],
  );

  const columns: ProColumns<MaintenanceExecution>[] = useMemo(
    () => [
      {
        title: t(`${P}.col.executionDate`),
        dataIndex: 'execution_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 11 } as ProColumns['search'],
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: executionStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.executionResult`),
        dataIndex: 'execution_result',
        valueType: 'select',
        valueEnum: executionResultValueEnum,
        hideInTable: true,
        search: { order: 21 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.executionNo`),
        dataIndex: 'execution_no',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.execution_no ?? '') }} ellipsis>
            {r.execution_no ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t(`${P}.col.equipmentName`),
        dataIndex: 'equipment_name',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) =>
          r.equipment_name != null && r.equipment_name !== '' ? String(r.equipment_name) : '-',
      },
      {
        title: t(`${P}.col.executionDate`),
        dataIndex: 'execution_date',
        valueType: 'dateTime',
        width: 132,
        minWidth: 132,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.execution_date ? formatDateTime(r.execution_date) : '-'),
      },
      {
        title: t(`${P}.col.executorName`),
        dataIndex: 'executor_name',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) =>
          r.executor_name != null && r.executor_name !== '' ? String(r.executor_name) : '-',
      },
      {
        title: t(`${P}.col.executionResult`),
        dataIndex: 'execution_result',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (
          <MarkerTag color={RESULT_COLORS[r.execution_result ?? ''] ?? 'default'}>
            {r.execution_result ?? '-'}
          </MarkerTag>
        ),
      },
      {
        title: t(`${P}.col.source`),
        dataIndex: 'source_type',
        width: 110,
        minWidth: 110,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) =>
          r.source_type === 'equipment_fault' && r.source_uuid ? (
            <Typography.Link
              onClick={(e) => {
                e.stopPropagation();
                navigate(
                  `${ROUTES.EQUIPMENT_FAULTS}?uuid=${encodeURIComponent(r.source_uuid!)}`,
                );
              }}
            >
              {t(`${P}.source.fault`)}
            </Typography.Link>
          ) : (
            '-'
          ),
      },
      ...buildDocumentAuditColumns<MaintenanceExecution>(t),
      {
        title: t('common.status'),
        key: 'lifecycle',
        dataIndex: 'status',
        hideInSearch: true,
        fixed: 'right',
        render: (_, r) => <StatusTag>{r.status ?? '-'}</StatusTag>,
      },
      {
        title: t('common.actions'),
        key: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) =>
          perms.canRead
            ? [<Button key="detail" {...rowActionKind('read')} onClick={() => handleDetail(record)} />]
            : null,
      },
    ],
    [t, perms.canRead, executionStatusValueEnum, executionResultValueEnum, navigate],
  );

  if (!perms.canRead) return null;

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailColumns, detail,
    'maintenance_execution',
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<MaintenanceExecution>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.maintenanceExecutions)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.maintenance-executions-width-v2"
          actionRef={actionRef}
          rowKey="uuid"
          enableRowSelection={perms.canDelete}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={perms.canDelete}
          deleteConfirmTitle={t('common.batchDeleteTitle')}
          deleteConfirmDescription={(count) => t('common.batchDeleteContent', { count: count })}
          
          onDelete={handleDelete}
          columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
          showAdvancedSearch={true}
          pinnedTabsField={MAINTENANCE_EXECUTION_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          onRow={(record) => ({ onClick: () => handleDetail(record), style: { cursor: 'pointer' } })}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveMaintenanceExecutionListParams(searchFormValues, sort);
              const res = await maintenancePlanApi.listExecutions({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as MaintenanceExecution[], success: true, total };
            } catch {
              messageApi.error(t('common.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          search={{ labelWidth: 'auto' }}
          pagination={{ defaultPageSize: 20 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`${t(`${P}.detailTitle`)}${detail?.execution_no ? ` - ${detail.execution_no}` : ''}`}
        open={drawerVisible}
        loading={detailLoading}
        onClose={closeDetail}
        size={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={
          detail ? (
            <Descriptions
              column={2}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : undefined
        }
        supplementary={
          detail?.attachments?.length ? (
            <LineAttachmentsUpload
              category="maintenance_execution_attachments"
              value={detail.attachments}
              readOnly
            />
          ) : undefined
        }
        supplementaryTitle={t(`${P}.col.attachments`, { defaultValue: '照片' })}
        lines={
          detail?.executed_items?.length ? (
            <>
              {detail.executed_items.map((item, index) => (
                <div key={String(item.item_id ?? index)} style={{ marginBottom: 16 }}>
                  <Typography.Text strong>{item.item_name ?? `#${item.item_id ?? index + 1}`}</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    <LineAttachmentsUpload
                      category="maintenance_execution_item"
                      value={item.attachments}
                      readOnly
                    />
                  </div>
                </div>
              ))}
            </>
          ) : undefined
        }
        linesTitle={t(`${P}.section.executedItems`, { defaultValue: '保养项' })}
      />
    </>
  );
};

export default MaintenanceExecutionsPage;

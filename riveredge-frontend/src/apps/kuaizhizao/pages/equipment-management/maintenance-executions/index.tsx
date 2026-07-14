import React, { useRef, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Tag, Typography } from 'antd';
import { DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerSection, DRAWER_CONFIG } from '../../../../../components/layout-templates';
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
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detail, setDetail] = useState<MaintenanceExecution | null>(null);

  const handleDetail = async (record: MaintenanceExecution) => {
    if (!record.uuid) return;
    const res = await maintenancePlanApi.getExecution(record.uuid);
    setDetail(res);
    setDrawerVisible(true);
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const key of keys) {
          await maintenancePlanApi.deleteExecution(String(key));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const executionStatusValueEnum = useMemo(() => buildMaintenanceExecutionStatusValueEnum(), []);
  const executionResultValueEnum = useMemo(() => buildMaintenanceExecutionResultValueEnum(t), [t]);

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
        title: t(`${P}.col.status`),
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
        width: 140,
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
        width: 180,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.executionDate`),
        dataIndex: 'execution_date',
        valueType: 'dateTime',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.execution_date ? formatDateTime(r.execution_date) : '-'),
      },
      {
        title: t(`${P}.col.executorName`),
        dataIndex: 'executor_name',
        width: 120,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.executionResult`),
        dataIndex: 'execution_result',
        width: 100,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (
          <Tag color={RESULT_COLORS[r.execution_result ?? ''] ?? 'default'}>
            {r.execution_result ?? '-'}
          </Tag>
        ),
      },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<MaintenanceExecution>(t),
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 120,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => [
          perms.canRead ? (
            <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => void handleDetail(record)}>
              {t('common.view')}
            </Button>
          ) : null,
        ],
      },
    ],
    [t, perms.canRead, executionStatusValueEnum, executionResultValueEnum],
  );

  if (!perms.canRead) return null;

  return (
    <>
      <ListPageTemplate>
        <UniTable<MaintenanceExecution>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.maintenance-executions"
          actionRef={actionRef}
          rowKey="uuid"
          enableRowSelection={perms.canDelete}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={perms.canDelete}
          onDelete={handleDelete}
          columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
          showAdvancedSearch={true}
          pinnedTabsField={MAINTENANCE_EXECUTION_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          onRow={(record) => ({ onClick: () => void handleDetail(record), style: { cursor: 'pointer' } })}
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
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={t(`${P}.detailTitle`)}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setDetail(null);
        }}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
      >
        {detail ? (
          <DetailDrawerSection title={t(`${P}.section.basic`)}>
            <p>{t(`${P}.col.executionNo`)}: {detail.execution_no ?? '-'}</p>
            <p>{t(`${P}.col.equipmentName`)}: {detail.equipment_name ?? '-'}</p>
            <p>{t(`${P}.col.executionDate`)}: {detail.execution_date ? formatDateTime(detail.execution_date) : '-'}</p>
            <p>{t(`${P}.col.executorName`)}: {detail.executor_name ?? '-'}</p>
            <p>{t(`${P}.col.executionResult`)}: {detail.execution_result ?? '-'}</p>
            <p>{t(`${P}.col.status`)}: {detail.status ?? '-'}</p>
            <p>{t(`${P}.col.executionContent`)}: {detail.execution_content ?? '-'}</p>
            {detail.spare_parts_used?.items?.length ? (
              <p>
                {t(`${P}.col.sparePartsUsed`)}:{' '}
                {detail.spare_parts_used.items.map((i) => `#${i.spare_part_id}×${i.quantity}`).join(', ')}
              </p>
            ) : null}
          </DetailDrawerSection>
        ) : null}
      </DetailDrawerTemplate>
    </>
  );
};

export default MaintenanceExecutionsPage;

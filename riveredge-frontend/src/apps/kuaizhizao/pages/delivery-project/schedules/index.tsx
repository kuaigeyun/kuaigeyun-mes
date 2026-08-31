import { App, Button } from 'antd';

import React, { useCallback, useRef, useState } from 'react';

import type { ActionType, ProColumns } from '@ant-design/pro-components';

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { UniTable } from '../../../../../components/uni-table';

import { ListPageTemplate } from '../../../../../components/layout-templates';

import { rowActionOpenWorkbench } from '../../../../../components/uni-action';

import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';

import {

  deliveryProjectApi,

  DELIVERY_PROJECT_STATUS,

  type DeliveryScheduleRow,

} from '../../../services/delivery-project';

import { formatBusinessDateOnly } from '../../../../../utils/format';

import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';

import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';

import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';

import { createDeliveryListExporter } from '../shared/deliveryListExport';
import { renderDeliveryMarkerTag, renderDeliveryStatusTag } from '../shared/deliveryListPresentation';
import { DELIVERY_CUSTOMER_COLUMN_DEFAULTS, DELIVERY_PROJECT_NAME_REMAINDER_COLUMN_DEFAULTS } from '../shared/deliveryTableColumns';



const SchedulesPage: React.FC = () => {

  const { t } = useTranslation();

  const { message } = App.useApp();

  const navigate = useNavigate();

  const actionRef = useRef<ActionType>(null);

  const tableRowsRef = useRef<DeliveryScheduleRow[]>([]);

  const lastListParamsRef = useRef<Record<string, unknown>>({});

  const perms = useResourcePermissions('kuaizhizao:delivery-project');

  const followUpPerms = useResourcePermissions('kuaizhizao:delivery-follow-up');

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const openWorkbench = useCallback(
    (projectId: number) => {
      navigate(`/apps/kuaizhizao/delivery-project/projects/${projectId}`);
    },
    [navigate],
  );

  const handleExport = useCallback(
    createDeliveryListExporter<DeliveryScheduleRow>({
      filename: 'delivery-schedules',
      columns: [
        { title: t('app.kuaizhizao.deliveryProject.fields.projectCode'), key: 'project_code' },
        { title: t('app.kuaizhizao.deliveryProject.fields.projectName'), key: 'project_name' },
        { title: t('app.kuaizhizao.deliveryProject.fields.customerName'), key: 'customer_name' },
        { title: t('app.kuaizhizao.deliveryProject.fields.deliveryDate'), key: 'delivery_date' },
        { title: t('app.kuaizhizao.deliveryProject.fields.ownerName'), key: 'owner_name' },
        { title: t('app.kuaizhizao.deliveryProject.fields.status'), key: 'status', getValue: (r) => DELIVERY_PROJECT_STATUS[r.status] ?? r.status },
      ],
      fetchPage: ({ skip, limit, ...params }) =>
        deliveryProjectApi.schedules({ skip, limit, ...params }).then((res) => res),
      getListParams: () => lastListParamsRef.current,
      tableRowsRef,
      onEmpty: () => message.warning(t('common.exportNoData')),
    }),
    [message, t],
  );



  const columns: ProColumns<DeliveryScheduleRow>[] = alignProColumns(

    [

      {

        title: t('app.kuaizhizao.deliveryProject.fields.projectCode'),

        dataIndex: 'project_code',

        key: 'project_code',

        width: 130,

        uniTableKeepWidth: true,

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.projectName'),

        dataIndex: 'project_name',

        key: 'project_name',

        ...DELIVERY_PROJECT_NAME_REMAINDER_COLUMN_DEFAULTS,

        ellipsis: true,

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.customerName'),

        dataIndex: 'customer_name',

        key: 'customer_name',

        ...DELIVERY_CUSTOMER_COLUMN_DEFAULTS,

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.deliveryDate'),

        dataIndex: 'delivery_date',

        key: 'delivery_date',

        width: 110,

        uniTableKeepWidth: true,

        render: (_, r) => formatBusinessDateOnly(r.delivery_date),

      },

      {

        title: t('app.kuaizhizao.deliveryProject.schedule.currentNode'),

        dataIndex: 'schedule_node_name',

        key: 'schedule_node_name',

        width: 110,

        uniTableKeepWidth: true,

        hideInSearch: true,

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.ownerName'),

        dataIndex: 'schedule_node_owner_name',

        key: 'schedule_node_owner_name',

        width: 100,

        uniTableKeepWidth: true,

        hideInSearch: true,

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.plannedStartDate'),

        dataIndex: 'planned_start_date',

        key: 'planned_start_date',

        width: 110,

        uniTableKeepWidth: true,

        hideInSearch: true,

        render: (_, r) => formatBusinessDateOnly(r.planned_start_date),

      },

      {

        title: t('app.kuaizhizao.deliveryProject.fields.plannedEndDate'),

        dataIndex: 'planned_end_date',

        key: 'planned_end_date',

        width: 110,

        uniTableKeepWidth: true,

        hideInSearch: true,

        render: (_, r) => formatBusinessDateOnly(r.planned_end_date),

      },

      {

        title: t('app.kuaizhizao.deliveryProject.schedule.reportOverdue'),

        dataIndex: 'report_overdue',

        key: 'report_overdue',

        hideInSearch: true,

        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,

        render: (_, r) =>
          r.report_overdue
            ? renderDeliveryMarkerTag(t('app.kuaizhizao.deliveryProject.schedule.overdue'), 'error')
            : '-',

      },

      ...buildDocumentAuditColumns<DeliveryScheduleRow>(t),

      {

        title: t('app.kuaizhizao.deliveryProject.fields.status'),

        dataIndex: 'status',

        key: 'lifecycle',

        fixed: 'right',

        valueType: 'select',

        valueEnum: Object.fromEntries(Object.entries(DELIVERY_PROJECT_STATUS).map(([k, v]) => [k, { text: v }])),

        render: (_, r) => renderDeliveryStatusTag(r.status, DELIVERY_PROJECT_STATUS),

      },

      {

        title: t('common.actions'),

        key: 'action',

        fixed: 'right',

        hideInSearch: true,

        render: (_, r) => (

          <Button
            {...rowActionOpenWorkbench()}
            onClick={(e) => {
              e.stopPropagation();
              openWorkbench(r.project_id);
            }}
          />

        ),

      },

    ],

    GLOBAL_DOC_LIST_FIELD_RANK,

  );



  return (

    <>

      <ListPageTemplate>

        <UniTable<DeliveryScheduleRow>

          actionRef={actionRef}

          rowKey="project_id"

          permissionResource="kuaizhizao:delivery-follow-up"

          columns={columns}

          columnPersistenceId="kuaizhizao-delivery-schedules-v7"

          enableRowSelection

          selectedRowKeys={selectedRowKeys}

          onRowSelectionChange={setSelectedRowKeys}

          showExportButton={followUpPerms.canExport}

          onExport={handleExport}

          onTableDataChange={(rows) => {

            tableRowsRef.current = rows;

          }}

          request={async (params) => {

            const listParams = {
              keyword: params.keyword,
              status: params.lifecycle as string | undefined,
            };
            lastListParamsRef.current = listParams;

            const res = await deliveryProjectApi.schedules({

              skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),

              limit: params.pageSize ?? 20,

              ...listParams,

            });

            return { data: res.items, success: true, total: res.total };

          }}

        />

      </ListPageTemplate>
    </>
  );
};



export default SchedulesPage;



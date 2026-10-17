import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { Button, Image, Table, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind, rowActionLabelKeep } from '../../../../components/uni-action';
import { ListPageTemplate } from '../../../../components/layout-templates';
import { UniTable } from '../../../../components/uni-table';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { formatDateTimeBySiteSetting } from '../../../../utils/format';
import {
  alignProColumns,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { MasterDataDetailDrawer } from '../../../master-data/pages/shared/masterDataDetailDrawer';
import { VISION_LIST_COL, renderJudgmentMarker } from '../../utils/visionListPresentation';
import {
  getInspection,
  listInspections,
  promoteInspectionSample,
  type InspectionDetail,
  type InspectionListItem,
} from '../../services/kuaivision';

const InspectionsPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaivision:inspection');
  const samplePerms = useResourcePermissions('kuaivision:sample');
  const actionRef = useRef<ActionType>();
  const tableRowsRef = useRef<InspectionListItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<InspectionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (row: InspectionListItem) => {
    setDrawerOpen(true);
    setDetailLoading(true);
    try {
      setDetail(await getInspection(row.uuid));
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ProColumns<InspectionListItem>[] = alignProColumns(
    [
      {
        title: t('app.kuaivision.field.eventId'),
        dataIndex: 'event_id',
        ...VISION_LIST_COL.eventId,
        copyable: true,
      },
      {
        title: t('app.kuaivision.field.occurredAt'),
        dataIndex: 'occurred_at',
        ...VISION_LIST_COL.datetime,
        valueType: 'dateTime',
        render: (_, row) => formatDateTimeBySiteSetting(row.occurred_at),
      },
      {
        title: t('app.kuaivision.field.judgment'),
        dataIndex: 'judgment',
        ...VISION_LIST_COL.marker,
        render: (_, row) => renderJudgmentMarker(row.judgment, t),
      },
      {
        title: t('app.kuaivision.field.confidence'),
        dataIndex: 'confidence',
        ...VISION_LIST_COL.number,
        search: false,
      },
      {
        title: t('app.kuaivision.field.recipe'),
        dataIndex: 'recipe_code',
        ...VISION_LIST_COL.recipe,
        render: (_, row) =>
          row.recipe_code ? `${row.recipe_code}${row.recipe_version ? `@${row.recipe_version}` : ''}` : '-',
      },
      {
        title: t('app.kuaivision.field.station'),
        dataIndex: 'station_code',
        ...VISION_LIST_COL.station,
      },
      {
        title: t('app.kuaivision.field.agent'),
        dataIndex: 'agent_code',
        ...VISION_LIST_COL.station,
        search: false,
      },
      {
        title: t('app.kuaivision.field.durationMs'),
        dataIndex: 'duration_ms',
        ...VISION_LIST_COL.number,
        search: false,
      },
      {
        title: t('app.kuaivision.field.thickness'),
        dataIndex: 'thickness_mm',
        ...VISION_LIST_COL.number,
        search: false,
      },
      {
        title: t('common.action'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, row) => {
          const nodes: React.ReactNode[] = [];
          if (perms.canRead) {
            nodes.push(
              <Button key="detail" {...rowActionKind('read')} onClick={() => void openDetail(row)} />,
            );
          }
          if (samplePerms.canCreate) {
            nodes.push(
              <Button
                key="promote"
                {...rowActionKind('skip')}
                {...rowActionLabelKeep()}
                onClick={async () => {
                  await promoteInspectionSample(row.uuid, {
                    label: row.judgment,
                    recipe_code: row.recipe_code || undefined,
                  });
                  message.success(t('app.kuaivision.message.promotedToSample'));
                }}
              >
                {t('app.kuaivision.action.promoteSample')}
              </Button>,
            );
          }
          return nodes;
        },
      },
    ],
    GLOBAL_DOC_LIST_FIELD_RANK,
  );

  const detailColumns = useMemo<ProDescriptionsItemProps<InspectionDetail>[]>(
    () => [
      { title: t('app.kuaivision.field.eventId'), dataIndex: 'event_id', copyable: true },
      {
        title: t('app.kuaivision.field.occurredAt'),
        dataIndex: 'occurred_at',
        render: (_, row) => formatDateTimeBySiteSetting(row.occurred_at),
      },
      {
        title: t('app.kuaivision.field.judgment'),
        dataIndex: 'judgment',
        render: (_, row) => renderJudgmentMarker(row.judgment, t),
      },
      { title: t('app.kuaivision.field.confidence'), dataIndex: 'confidence' },
      { title: t('app.kuaivision.field.recipe'), dataIndex: 'recipe_code' },
      { title: t('app.kuaivision.field.station'), dataIndex: 'station_code' },
      { title: t('app.kuaivision.field.camera'), dataIndex: 'camera_code' },
      { title: t('app.kuaivision.field.agent'), dataIndex: 'agent_code' },
      { title: t('app.kuaivision.field.durationMs'), dataIndex: 'duration_ms' },
      { title: t('app.kuaivision.field.workOrder'), dataIndex: 'work_order_code' },
      { title: t('app.kuaivision.field.batchNo'), dataIndex: 'batch_no' },
      { title: t('common.remark'), dataIndex: 'remark' },
    ],
    [t],
  );

  const measurementsTable =
    detail?.measurements?.length ? (
      <Table
        size="small"
        pagination={false}
        rowKey={(r) => r.name}
        columns={[
          { title: t('app.kuaivision.field.measureName'), dataIndex: 'name' },
          { title: t('app.kuaivision.field.measureValue'), dataIndex: 'value' },
          { title: t('app.kuaivision.field.measureUnit'), dataIndex: 'unit' },
        ]}
        dataSource={detail.measurements}
      />
    ) : null;

  const imagesBlock =
    detail?.images?.length ? (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {detail.images.map((img) => (
          <Image key={img.object_key} width={120} src={img.object_key} alt={img.label || img.object_key} />
        ))}
      </div>
    ) : null;

  return (
    <ListPageTemplate>
      <UniTable<InspectionListItem>
        actionRef={actionRef}
        columns={columns}
        rowKey="uuid"
        columnPersistenceId="apps.kuaivision.pages.inspections.list-v3"
        permissionResource="kuaivision:inspection"
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        request={async (params) => {
          const res = await listInspections({
            page: params.current,
            page_size: params.pageSize,
            q: params.keyword as string | undefined,
            judgment: params.judgment as string | undefined,
            station_code: params.station_code as string | undefined,
            recipe_code: params.recipe_code as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <MasterDataDetailDrawer
        title={t('app.kuaivision.menu.inspections')}
        open={drawerOpen}
        loading={detailLoading}
        onClose={() => {
          setDrawerOpen(false);
          setDetail(null);
        }}
        detail={detail}
        detailColumns={detailColumns}
        linesTitle={t('app.kuaivision.section.measurements')}
        lines={measurementsTable}
        afterBasicTitle={imagesBlock ? t('app.kuaivision.section.images') : undefined}
        afterBasic={imagesBlock}
      />
    </ListPageTemplate>
  );
};

export default InspectionsPage;

/**
 * 车辆管理（物流主数据）。
 * 与驾驶员/承运商同构：一列 RemainderFlex 吃余量，禁止全 KeepWidth（否则 filler 在右固定前留巨空白）。
 */

import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { buildDetailDrawerEditExtra } from '../../equipment-management/shared/equipmentMasterDataDetail';
import {
  alignDescriptionColumns,
  alignProColumns,
  MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
} from '../../sales-management/shared/documentFieldAlignment';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { formatQuantity } from '../../../../../utils/format';
import { LogisticsMasterDetailDrawer } from '../shared/LogisticsMasterDetailDrawer';
import {
  logisticsVehicleTypeLabel,
  renderLogisticsEnabledTag,
  renderLogisticsOwnershipTag,
  renderVehicleStatusTag,
} from '../shared/logisticsListPresentation';
import { deleteVehicle, listVehicles, type Vehicle } from '../../../services/logistics';
import { VehicleFormModal } from '../shared/VehicleFormModal';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';

const VehiclesPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaizhizao:vehicle');
  const actionRef = useRef<ActionType>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Vehicle | null>(null);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (row: Vehicle) => {
    setEditing(row);
    setOpen(true);
  };

  const openDetail = (row: Vehicle) => {
    setDetail(row);
    setDetailOpen(true);
  };

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns<Vehicle>(
        [
          { title: t('app.kuaizhizao.logistics.field.plateNumber'), dataIndex: 'plate_number' },
          {
            title: t('app.kuaizhizao.logistics.field.vehicleType'),
            dataIndex: 'vehicle_type',
            render: (_, record) => logisticsVehicleTypeLabel(t, record.vehicle_type),
          },
          {
            title: t('app.kuaizhizao.logistics.field.ownership'),
            dataIndex: 'ownership',
            render: (_, record) => renderLogisticsOwnershipTag(t, record.ownership),
          },
          { title: t('app.kuaizhizao.logistics.field.loadCapacity'), dataIndex: 'load_capacity' },
          {
            title: t('common.status'),
            dataIndex: 'status',
            render: (_, record) => renderVehicleStatusTag(t, record.status),
          },
          {
            title: t('common.enabled'),
            dataIndex: 'is_enabled',
            render: (_, record) => renderLogisticsEnabledTag(t, record.is_enabled),
          },
          { title: t('common.remark'), dataIndex: 'remark', span: 2 },
        ] as ProDescriptionsItemProps<Vehicle>[],
        MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
      ),
    [t],
  );

  const columns: ProColumns<Vehicle>[] = useMemo(
    () =>
      alignProColumns<Vehicle>([
        {
          title: t('app.kuaizhizao.logistics.field.plateNumber'),
          dataIndex: 'plate_number',
          width: 140,
          minWidth: 140,
          uniTableKeepWidth: true,
          resizable: false,
          ellipsis: true,
          fixed: 'left',
        },
        {
          // 余量列：车型长短不一；禁止全表 KeepWidth（右固定前会留巨空白）
          title: t('app.kuaizhizao.logistics.field.vehicleType'),
          dataIndex: 'vehicle_type',
          minWidth: 120,
          uniTableRemainderFlex: true,
          uniTablePrimaryFlex: true,
          resizable: false,
          ellipsis: true,
          render: (_, row) => {
            const label = logisticsVehicleTypeLabel(t, row.vehicle_type);
            return label === '-' ? '-' : <MarkerTag color="processing">{label}</MarkerTag>;
          },
        },
        {
          title: t('app.kuaizhizao.logistics.field.ownership'),
          dataIndex: 'ownership',
          ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
          render: (_, row) => renderLogisticsOwnershipTag(t, row.ownership),
        },
        {
          title: t('app.kuaizhizao.logistics.field.loadCapacity'),
          dataIndex: 'load_capacity',
          width: 100,
          minWidth: 100,
          uniTableKeepWidth: true,
          resizable: false,
          align: 'right',
          hideInSearch: true,
          render: (_, row) =>
            row.load_capacity != null ? formatQuantity(row.load_capacity) : '-',
        },
        {
          title: t('common.enabled'),
          dataIndex: 'is_enabled',
          ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
          hideInSearch: true,
          render: (_, row) => renderLogisticsEnabledTag(t, row.is_enabled),
        },
        {
          title: t('common.status'),
          key: 'lifecycle',
          dataIndex: 'status',
          fixed: 'right',
          hideInSearch: true,
          render: (_, row) => renderVehicleStatusTag(t, row.status),
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
                <Button key="detail" {...rowActionKind('read')} onClick={() => openDetail(row)} />,
              );
            }
            if (perms.canUpdate) {
              nodes.push(
                <Button key="edit" {...rowActionKind('update')} onClick={() => openEdit(row)} />,
              );
            }
            if (perms.canDelete) {
              nodes.push(
                <Button
                  key="delete"
                  {...rowActionKind('delete')}
                  onClick={async () => {
                    await deleteVehicle(row.id);
                    message.success(t('common.deleteSuccess'));
                    actionRef.current?.reload();
                  }}
                />,
              );
            }
            return nodes;
          },
        },
      ]),
    [perms.canDelete, perms.canRead, perms.canUpdate, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<Vehicle>
        viewTypes={['table', 'help']}
        helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.vehicles')}
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.logistics-management.vehicles.v7"
        rowKey="id"
        request={async (params) => {
          const res = await listVehicles({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize,
            keyword: params.keyword as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaizhizao.logistics.action.createVehicle')}
        onCreate={openCreate}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => deleteVehicle(Number(key))));
          message.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
        fuzzySearchPlaceholder={t('app.kuaizhizao.logistics.placeholder.searchVehicle')}
      />
      <LogisticsMasterDetailDrawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
        record={detail}
        title={`${t('app.kuaizhizao.logistics.detail.vehicleTitle')}${
          detail?.plate_number ? ` - ${detail.plate_number}` : ''
        }`}
        extra={buildDetailDrawerEditExtra(t, Boolean(detail && perms.canUpdate), () => {
          if (detail) openEdit(detail);
        })}
        basicColumns={basicColumns}
      />
      <VehicleFormModal
        open={open}
        editing={editing}
        onClose={() => setOpen(false)}
        onSuccess={(record) => {
          if (detail?.id === record.id) {
            setDetail(record);
          }
          actionRef.current?.reload();
        }}
      />
    </ListPageTemplate>
  );
};

export default VehiclesPage;

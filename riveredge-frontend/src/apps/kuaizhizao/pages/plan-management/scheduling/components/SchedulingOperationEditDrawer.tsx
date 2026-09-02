import React, { useEffect, useMemo, useState } from 'react';
import { Alert, App, Modal, Select, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MODAL_CONFIG } from '../../../../../../components/layout-templates/constants';
import type { WorkOrderForGantt, WorkstationResource } from '../../../../components/GanttSchedulingChart/types';
import { visualSchedulingApi } from '../../../../services/production';
import { workOrderApi } from '../../../../services/work-order';

interface ResourceOption {
  id: number;
  name: string;
  code?: string;
}

export interface SchedulingOperationEditContext {
  workOrder: WorkOrderForGantt;
  /** 双击的工序：明细表中高亮该行 */
  operationId?: number;
}

interface SchedulingOperationEditDrawerProps {
  open: boolean;
  context: SchedulingOperationEditContext | null;
  workstations: WorkstationResource[];
  workers: ResourceOption[];
  equipments: ResourceOption[];
  molds: ResourceOption[];
  canUpdate: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type OpRow = NonNullable<WorkOrderForGantt['operations']>[number] & {
  id: number;
  assigned_worker_id?: number | null;
  assigned_mold_id?: number | null;
};

interface EditRow {
  id: number;
  sequence?: number;
  operation_name?: string | null;
  assigned_station_id?: number | null;
  assigned_worker_id?: number | null;
  assigned_equipment_id?: number | null;
  assigned_mold_id?: number | null;
  outsource_kind?: string | null;
  is_outsourced?: boolean;
  default_outsource_supplier_name?: string | null;
}

function isOutsourceEditRow(row: EditRow): boolean {
  const kind = String(row.outsource_kind || 'none').toLowerCase();
  return kind === 'planned' || kind === 'ad_hoc' || Boolean(row.is_outsourced);
}

function toPositiveId(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const SchedulingOperationEditDrawer: React.FC<SchedulingOperationEditDrawerProps> = ({
  open,
  context,
  workstations,
  workers,
  equipments,
  molds,
  canUpdate,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [rateWarnings, setRateWarnings] = useState<string[]>([]);

  const operations = useMemo(() => {
    const ops = (context?.workOrder.operations ?? []).filter(
      (op): op is OpRow => op.id != null && Number(op.id) > 0
    );
    return [...ops].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  }, [context]);

  useEffect(() => {
    if (!open || !context) return;
    setRows(
      operations.map((op) => ({
        id: op.id,
        sequence: op.sequence,
        operation_name: op.operation_name,
        assigned_station_id: toPositiveId(op.assigned_station_id),
        assigned_worker_id: toPositiveId(op.assigned_worker_id),
        assigned_equipment_id: toPositiveId(op.assigned_equipment_id),
        assigned_mold_id: toPositiveId(op.assigned_mold_id),
        outsource_kind: op.outsource_kind,
        is_outsourced: op.is_outsourced,
        default_outsource_supplier_name: op.default_outsource_supplier_name,
      }))
    );
    setRateWarnings([]);
  }, [open, context, operations]);

  const stationOptions = useMemo(
    () =>
      workstations.map((s) => ({
        value: s.id,
        label: s.code ? `${s.code} ${s.name}` : s.name,
      })),
    [workstations]
  );

  const mapOptions = (items: ResourceOption[]) =>
    items.map((item) => ({
      value: item.id,
      label: item.code ? `${item.code} ${item.name}` : item.name,
    }));

  const workerOptions = useMemo(() => mapOptions(workers), [workers]);
  const equipmentOptions = useMemo(() => mapOptions(equipments), [equipments]);
  const moldOptions = useMemo(() => mapOptions(molds), [molds]);

  const patchRow = (operationId: number, patch: Partial<EditRow>) => {
    setRows((prev) => prev.map((row) => (row.id === operationId ? { ...row, ...patch } : row)));
  };

  const checkRateCoverage = async (operationId: number, workerId: number | null) => {
    if (!context || !workerId) {
      setRateWarnings([]);
      return;
    }
    try {
      const res = await visualSchedulingApi.rateCoverage([
        {
          worker_id: workerId,
          operation_id: operationId,
          material_id: context.workOrder.product_id ?? null,
        },
      ]);
      const missing = new Set<string>();
      for (const item of res.items ?? []) {
        for (const key of item.missing ?? []) missing.add(key);
      }
      if (missing.size === 0) {
        setRateWarnings([]);
        return;
      }
      setRateWarnings(
        [...missing].map((key) =>
          key === 'piece_rate'
            ? t('app.kuaizhizao.scheduling.prep.missingPieceRate')
            : t('app.kuaizhizao.scheduling.prep.missingHourlyRate')
        )
      );
    } catch {
      setRateWarnings([]);
    }
  };

  const handleSubmit = async () => {
    if (!context || rows.length === 0 || !canUpdate) return;
    setSaving(true);
    try {
      const factoryRows = rows.filter((row) => !isOutsourceEditRow(row));
      const stationUpdates = factoryRows
        .map((row) => {
          const stationId = toPositiveId(row.assigned_station_id);
          if (!stationId) return null;
          return { operation_id: row.id, assigned_station_id: stationId };
        })
        .filter((item): item is { operation_id: number; assigned_station_id: number } => item != null);

      const assignmentUpdates = factoryRows.map((row) => ({
        operation_id: row.id,
        assigned_worker_id: toPositiveId(row.assigned_worker_id),
        assigned_equipment_id: toPositiveId(row.assigned_equipment_id),
        assigned_mold_id: toPositiveId(row.assigned_mold_id),
      }));

      if (stationUpdates.length) {
        const validation = await visualSchedulingApi.validateAdjustments({
          operation_station_updates: stationUpdates,
        });
        if (!validation.valid) {
          throw new Error((validation.conflicts || []).slice(0, 2).map((c) => c.message).join('\n'));
        }
        await workOrderApi.batchUpdateOperationStations(stationUpdates);
      }
      await workOrderApi.batchUpdateOperationAssignments(assignmentUpdates);
      message.success(t('app.kuaizhizao.scheduling.operationEdit.savedWhole'));
      onSaved();
      onClose();
    } catch (e: any) {
      message.error(e?.message || t('app.kuaizhizao.scheduling.operationEdit.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const woCode = context?.workOrder.code || context?.workOrder.id;
  const focusId = context?.operationId;

  const columns: ColumnsType<EditRow> = [
    {
      title: t('app.kuaizhizao.scheduling.prep.colOperation'),
      key: 'operation',
      width: 160,
      ellipsis: true,
      render: (_, row) => {
        const name = row.operation_name || String(row.id);
        const label = row.sequence != null && row.sequence > 0 ? `${row.sequence}. ${name}` : name;
        const kind = String(row.outsource_kind || '').toLowerCase();
        const badge =
          kind === 'planned'
            ? t('app.kuaizhizao.scheduling.operationEdit.badgePlanned')
            : kind === 'ad_hoc' || row.is_outsourced
              ? t('app.kuaizhizao.scheduling.operationEdit.badgeAdHoc')
              : null;
        return (
          <span title={label}>
            {label}
            {badge ? ` (${badge})` : ''}
          </span>
        );
      },
    },
    {
      title: t('app.kuaizhizao.scheduling.prep.colStation'),
      dataIndex: 'assigned_station_id',
      key: 'station',
      width: 180,
      render: (value, row) =>
        isOutsourceEditRow(row) ? (
          <Typography.Text type="secondary">
            {row.default_outsource_supplier_name ||
              t('app.kuaizhizao.scheduling.operationEdit.outsourceNoStation')}
          </Typography.Text>
        ) : (
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            size="small"
            style={{ width: '100%' }}
            disabled={!canUpdate}
            options={stationOptions}
            value={value ?? undefined}
            onChange={(v) => patchRow(row.id, { assigned_station_id: toPositiveId(v) })}
          />
        ),
    },
    {
      title: t('app.kuaizhizao.scheduling.prep.colWorker'),
      dataIndex: 'assigned_worker_id',
      key: 'worker',
      width: 160,
      render: (value, row) => (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          size="small"
          style={{ width: '100%' }}
          disabled={!canUpdate || isOutsourceEditRow(row)}
          options={workerOptions}
          value={isOutsourceEditRow(row) ? undefined : value ?? undefined}
          onChange={(v) => {
            const workerId = toPositiveId(v);
            patchRow(row.id, { assigned_worker_id: workerId });
            void checkRateCoverage(row.id, workerId);
          }}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.scheduling.prep.colEquipment'),
      dataIndex: 'assigned_equipment_id',
      key: 'equipment',
      width: 160,
      render: (value, row) => (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          size="small"
          style={{ width: '100%' }}
          disabled={!canUpdate || isOutsourceEditRow(row)}
          options={equipmentOptions}
          value={isOutsourceEditRow(row) ? undefined : value ?? undefined}
          onChange={(v) => patchRow(row.id, { assigned_equipment_id: toPositiveId(v) })}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.scheduling.prep.colMold'),
      dataIndex: 'assigned_mold_id',
      key: 'mold',
      width: 160,
      render: (value, row) => (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          size="small"
          style={{ width: '100%' }}
          disabled={!canUpdate || isOutsourceEditRow(row)}
          options={moldOptions}
          value={isOutsourceEditRow(row) ? undefined : value ?? undefined}
          onChange={(v) => patchRow(row.id, { assigned_mold_id: toPositiveId(v) })}
        />
      ),
    },
  ];

  return (
    <Modal
      title={t('app.kuaizhizao.scheduling.operationEdit.titleWhole', { code: woCode })}
      open={open}
      width={MODAL_CONFIG.LARGE_WIDTH}
      onCancel={onClose}
      destroyOnHidden
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      onOk={() => void handleSubmit()}
      okButtonProps={{ disabled: !canUpdate || rows.length === 0, loading: saving }}
      confirmLoading={saving}
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        {t('app.kuaizhizao.scheduling.operationEdit.wholeHint', { count: rows.length })}
      </Typography.Paragraph>
      {rateWarnings.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={t('app.kuaizhizao.scheduling.prep.rateWarningTitle', { items: rateWarnings.join('、') })}
          description={
            <Link to="/apps/kuaizhizao/performance/employee-configs">
              {t('app.kuaizhizao.scheduling.prep.gotoPerformanceConfig')}
            </Link>
          }
        />
      ) : null}
      <Table<EditRow>
        size="small"
        rowKey="id"
        pagination={false}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 820 }}
        rowClassName={(row) => (focusId != null && row.id === focusId ? 'ant-table-row-selected' : '')}
      />
    </Modal>
  );
};

export default SchedulingOperationEditDrawer;

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Drawer, Form, Select, DatePicker, Space } from 'antd';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  operationId: number;
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
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [rateWarnings, setRateWarnings] = useState<string[]>([]);

  const operation = useMemo(() => {
    if (!context) return null;
    return (context.workOrder.operations ?? []).find((op) => op.id === context.operationId) ?? null;
  }, [context]);

  useEffect(() => {
    if (!open || !operation) return;
    form.setFieldsValue({
      assigned_station_id: operation.assigned_station_id ?? undefined,
      assigned_worker_id: operation.assigned_worker_id ?? undefined,
      assigned_equipment_id: operation.assigned_equipment_id ?? undefined,
      assigned_mold_id: operation.assigned_mold_id ?? undefined,
      planned_start_date: operation.planned_start_date ? dayjs(operation.planned_start_date) : undefined,
      planned_end_date: operation.planned_end_date ? dayjs(operation.planned_end_date) : undefined,
    });
    setRateWarnings([]);
  }, [form, open, operation]);

  const mapOptions = (items: ResourceOption[]) =>
    items.map((item) => ({
      value: item.id,
      label: item.code ? `${item.code} ${item.name}` : item.name,
    }));

  const checkRateCoverage = async (workerId?: number) => {
    if (!context || !operation || !workerId || workerId <= 0) {
      setRateWarnings([]);
      return;
    }
    try {
      const res = await visualSchedulingApi.rateCoverage([
        {
          worker_id: workerId,
          operation_id: operation.id!,
          material_id: context.workOrder.product_id ?? null,
        },
      ]);
      const item = res.items?.[0];
      if (!item?.missing?.length) {
        setRateWarnings([]);
        return;
      }
      setRateWarnings(
        item.missing.map((key) =>
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
    if (!context || !operation?.id || !canUpdate) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      const dateUpdates = [];
      if (values.planned_start_date && values.planned_end_date) {
        dateUpdates.push({
          operation_id: operation.id,
          planned_start_date: values.planned_start_date.toISOString(),
          planned_end_date: values.planned_end_date.toISOString(),
        });
      }
      const stationUpdates = [];
      if (values.assigned_station_id) {
        stationUpdates.push({
          operation_id: operation.id,
          assigned_station_id: Number(values.assigned_station_id),
        });
      }
      const assignmentUpdates = [
        {
          operation_id: operation.id,
          assigned_worker_id: values.assigned_worker_id ?? null,
          assigned_equipment_id: values.assigned_equipment_id ?? null,
          assigned_mold_id: values.assigned_mold_id ?? null,
        },
      ];

      if (stationUpdates.length || dateUpdates.length) {
        const validation = await visualSchedulingApi.validateAdjustments({
          operation_station_updates: stationUpdates,
          operation_updates: dateUpdates,
        });
        if (!validation.valid) {
          throw new Error((validation.conflicts || []).slice(0, 2).map((c) => c.message).join('\n'));
        }
      }
      if (stationUpdates.length) {
        await workOrderApi.batchUpdateOperationStations(stationUpdates);
      }
      if (dateUpdates.length) {
        await workOrderApi.batchUpdateOperationDates(dateUpdates);
      }
      await workOrderApi.batchUpdateOperationAssignments(assignmentUpdates);
      message.success(t('app.kuaizhizao.scheduling.operationEdit.saved'));
      onSaved();
      onClose();
    } catch (e: any) {
      message.error(e?.message || t('app.kuaizhizao.scheduling.operationEdit.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={t('app.kuaizhizao.scheduling.operationEdit.title', {
        name: operation?.operation_name || operation?.id,
      })}
      open={open}
      width={420}
      onClose={onClose}
      destroyOnClose
      extra={
        canUpdate ? (
          <Button type="primary" loading={saving} onClick={() => void handleSubmit()}>
            {t('app.kuaizhizao.scheduling.common.save')}
          </Button>
        ) : null
      }
    >
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
      <Form form={form} layout="vertical" disabled={!canUpdate}>
        <Form.Item name="assigned_station_id" label={t('app.kuaizhizao.scheduling.prep.colStation')}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            options={workstations.map((s) => ({
              value: s.id,
              label: s.code ? `${s.code} ${s.name}` : s.name,
            }))}
          />
        </Form.Item>
        <Form.Item name="assigned_worker_id" label={t('app.kuaizhizao.scheduling.prep.colWorker')}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            options={mapOptions(workers)}
            onChange={(value) => void checkRateCoverage(Number(value))}
          />
        </Form.Item>
        <Form.Item name="assigned_equipment_id" label={t('app.kuaizhizao.scheduling.prep.colEquipment')}>
          <Select allowClear showSearch optionFilterProp="label" options={mapOptions(equipments)} />
        </Form.Item>
        <Form.Item name="assigned_mold_id" label={t('app.kuaizhizao.scheduling.prep.colMold')}>
          <Select allowClear showSearch optionFilterProp="label" options={mapOptions(molds)} />
        </Form.Item>
        <Space style={{ width: '100%' }} size={12}>
          <Form.Item
            name="planned_start_date"
            label={t('app.kuaizhizao.scheduling.prep.colStart')}
            style={{ flex: 1 }}
          >
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="planned_end_date"
            label={t('app.kuaizhizao.scheduling.prep.colEnd')}
            style={{ flex: 1 }}
          >
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
        </Space>
      </Form>
    </Drawer>
  );
};

export default SchedulingOperationEditDrawer;

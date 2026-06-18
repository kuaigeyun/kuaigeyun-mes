import React, { useMemo, useRef } from 'react';
import { App, Typography } from 'antd';
import { ProFormDateTimePicker, ProFormSelect } from '@ant-design/pro-components';
import type { ProFormInstance } from '@ant-design/pro-components';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate } from '../../../../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../../../../components/layout-templates/constants';
import type { WorkOrderForGantt, WorkstationResource } from '../../../../components/GanttSchedulingChart/types';
import type {
  OperationNeedingStation,
  WorkOrderSchedulingMissingField,
} from '../schedulingDropUtils';
import {
  cascadeOperationPrepScheduleFromIndex,
  operationPrepEndFieldName,
  operationPrepScheduleDatesToFormValues,
  operationPrepStartFieldName,
  resolveOperationPrepScheduleDates,
} from '../schedulingDropUtils';
import '../scheduling-prep-modal.less';
import { buildFutureDateShortcutFieldProps } from '../../../../../../utils/futureDatePickerShortcuts';

export interface SchedulingWorkOrderPrepValues {
  planned_start_date?: string;
  planned_end_date?: string;
  operationStations: Array<{ operation_id: number; assigned_station_id: number }>;
  operationDates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }>;
}

interface SchedulingWorkCenterOption {
  id: number;
  name: string;
  code?: string;
  workstationIds?: number[];
}

interface SchedulingWorkOrderPrepModalProps {
  open: boolean;
  workOrder: WorkOrderForGantt | null;
  missingFields: WorkOrderSchedulingMissingField[];
  operationsNeedingStation: OperationNeedingStation[];
  workstations: WorkstationResource[];
  workCenters: SchedulingWorkCenterOption[];
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (values: SchedulingWorkOrderPrepValues) => Promise<void>;
}

function defaultStart(): Dayjs {
  return dayjs().startOf('hour').add(1, 'hour');
}

function stationOptionsForOperation(
  op: OperationNeedingStation,
  workstations: WorkstationResource[],
  workCenters: SchedulingWorkCenterOption[]
) {
  const wcId = op.workCenterId != null && Number(op.workCenterId) > 0 ? Number(op.workCenterId) : null;
  let candidates = workstations;
  if (wcId != null) {
    const wc = workCenters.find((item) => item.id === wcId);
    const allowedIds = new Set((wc?.workstationIds ?? []).filter((id) => id > 0));
    if (allowedIds.size > 0) {
      candidates = workstations.filter((station) => allowedIds.has(station.id));
    }
  }
  return candidates.map((station) => ({
    value: station.id,
    label: station.code ? `${station.code} ${station.name}` : station.name,
  }));
}

function operationFieldName(operationId: number): string {
  return `station_${operationId}`;
}

const SchedulingWorkOrderPrepModal: React.FC<SchedulingWorkOrderPrepModalProps> = ({
  open,
  workOrder,
  missingFields,
  operationsNeedingStation,
  workstations,
  workCenters,
  loading = false,
  onCancel,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const cascadingRef = useRef(false);
  const sortedOperations = useMemo(
    () => [...operationsNeedingStation].sort((a, b) => a.sequence - b.sequence),
    [operationsNeedingStation]
  );

  const initialValues = useMemo(() => {
    if (!workOrder) return undefined;
    const start = workOrder.planned_start_date ? dayjs(workOrder.planned_start_date) : defaultStart();
    const end = workOrder.planned_end_date
      ? dayjs(workOrder.planned_end_date)
      : start.add(7, 'day');
    const stationValues = Object.fromEntries(
      operationsNeedingStation.map((op) => [
        operationFieldName(op.operationId),
        op.assignedStationId && op.assignedStationId > 0 ? op.assignedStationId : undefined,
      ])
    );
    const rawDateValues = Object.fromEntries(
      operationsNeedingStation.flatMap((op) => {
        const entries: Array<[string, Dayjs]> = [];
        if (op.plannedStartDate) {
          entries.push([operationPrepStartFieldName(op.operationId), dayjs(op.plannedStartDate)]);
        }
        if (op.plannedEndDate) {
          entries.push([operationPrepEndFieldName(op.operationId), dayjs(op.plannedEndDate)]);
        }
        return entries;
      })
    );
    const normalizedDates = operationPrepScheduleDatesToFormValues(
      resolveOperationPrepScheduleDates(operationsNeedingStation, rawDateValues, {
        workOrderStart: workOrder.planned_start_date,
      })
    );
    return {
      planned_start_date: start,
      planned_end_date: end,
      ...stationValues,
      ...normalizedDates,
    };
  }, [operationsNeedingStation, workOrder]);

  const scheduleCascadeOptions = useMemo(
    () => ({
      workOrderStart: workOrder?.planned_start_date ?? undefined,
    }),
    [workOrder?.planned_start_date]
  );

  const handleScheduleValuesChange = (changedValues: Record<string, unknown>, allValues: Record<string, unknown>) => {
    if (cascadingRef.current) return;
    const changedKey = Object.keys(changedValues)[0];
    if (!changedKey?.startsWith('op_start_') && !changedKey?.startsWith('op_end_')) return;

    const opId = Number(changedKey.replace(/^op_(start|end)_/, ''));
    const fromIndex = sortedOperations.findIndex((op) => op.operationId === opId);
    if (fromIndex < 0) return;

    const patches = cascadeOperationPrepScheduleFromIndex(
      sortedOperations,
      allValues,
      fromIndex,
      scheduleCascadeOptions
    );
    const changedPatches = Object.fromEntries(
      Object.entries(patches).filter(([key, value]) => {
        const current = allValues[key];
        if (current == null || current === '') return true;
        return !dayjs.isDayjs(current) || !current.isSame(value);
      })
    );
    if (Object.keys(changedPatches).length === 0) return;

    cascadingRef.current = true;
    formRef.current?.setFieldsValue(changedPatches);
    cascadingRef.current = false;
  };

  const needsStart = missingFields.includes('planned_start_date');
  const needsEnd = missingFields.includes('planned_end_date');
  const needsStations = operationsNeedingStation.length > 0;

  const submitPrepForm = async (rawValues: Record<string, unknown>) => {
    if (!workOrder) return;
    if (operationsNeedingStation.length === 0) {
      messageApi.error(t('app.kuaizhizao.scheduling.prep.noOperations'));
      return;
    }

    const values = {
      ...rawValues,
      ...(formRef.current?.getFieldsValue(true) ?? {}),
    };

    const startRaw = values.planned_start_date as Dayjs | undefined;
    const anchorStart = needsStart
      ? startRaw
      : workOrder.planned_start_date
        ? dayjs(workOrder.planned_start_date)
        : startRaw;
    if (needsStart && !anchorStart) {
      messageApi.error(t('app.kuaizhizao.scheduling.prep.selectStartRequired'));
      return;
    }

    const scheduleResult = resolveOperationPrepScheduleDates(operationsNeedingStation, values, {
      workOrderStart: anchorStart ? anchorStart.toISOString() : workOrder.planned_start_date,
    });
    if (scheduleResult.adjustedOperationNames.length > 0) {
      formRef.current?.setFieldsValue(operationPrepScheduleDatesToFormValues(scheduleResult));
      messageApi.info(
        t('app.kuaizhizao.scheduling.prep.scheduleAdjusted', {
          names: scheduleResult.adjustedOperationNames.join('、'),
        })
      );
    }

    const operationStations: SchedulingWorkOrderPrepValues['operationStations'] = [];
    for (const op of operationsNeedingStation) {
      const stationId = Number(values[operationFieldName(op.operationId)]);
      if (!Number.isInteger(stationId) || stationId <= 0) {
        messageApi.error(t('app.kuaizhizao.scheduling.prep.selectStationForOp', { name: op.operationName }));
        return;
      }
      operationStations.push({
        operation_id: op.operationId,
        assigned_station_id: stationId,
      });
    }

    let planned_start_date: string | undefined;
    let planned_end_date: string | undefined;
    if (scheduleResult.dates.length > 0) {
      const starts = scheduleResult.dates.map((d) => d.planned_start_date).sort();
      const ends = scheduleResult.dates.map((d) => d.planned_end_date).sort();
      planned_start_date = starts[0];
      planned_end_date = ends[ends.length - 1];
    } else {
      const endRaw = values.planned_end_date as Dayjs | undefined;
      planned_start_date = anchorStart?.toISOString() ?? workOrder.planned_start_date ?? undefined;
      planned_end_date = (
        needsEnd ? endRaw : workOrder.planned_end_date ? dayjs(workOrder.planned_end_date) : endRaw
      )?.toISOString();
    }

    if (!planned_start_date || !planned_end_date) {
      messageApi.error(t('app.kuaizhizao.scheduling.prep.fillDatesRequired'));
      return;
    }

    await onSubmit({
      planned_start_date,
      planned_end_date,
      operationStations,
      operationDates: scheduleResult.dates,
    });
  };

  return (
    <FormModalTemplate
      title={t('app.kuaizhizao.scheduling.prep.title')}
      open={open}
      onClose={onCancel}
      loading={loading}
      isEdit
      width={MODAL_CONFIG.LARGE_WIDTH}
      initialValues={initialValues}
      formRef={formRef}
      onValuesChange={handleScheduleValuesChange}
      onFinish={submitPrepForm}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {t('app.kuaizhizao.scheduling.prep.description', {
          code: workOrder?.code || workOrder?.id,
        })}
      </Typography.Paragraph>
      {needsStations ? (
        <>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            {t('app.kuaizhizao.scheduling.prep.operationScheduling')}
          </Typography.Text>
          <div className="scheduling-prep-station-grid">
            <div className="scheduling-prep-station-grid__head">
              <span>{t('app.kuaizhizao.scheduling.prep.colOperation')}</span>
              <span>{t('app.kuaizhizao.scheduling.prep.colStation')}</span>
              <span>{t('app.kuaizhizao.scheduling.prep.colStart')}</span>
              <span>{t('app.kuaizhizao.scheduling.prep.colEnd')}</span>
            </div>
            {sortedOperations.map((op, index) => {
              const stationOptions = stationOptionsForOperation(op, workstations, workCenters);
              return (
                <div key={op.operationId} className="scheduling-prep-station-grid__row">
                  <div className="scheduling-prep-station-grid__op" title={op.operationName}>
                    {op.sequence > 0 ? `${op.sequence}. ${op.operationName}` : op.operationName}
                  </div>
                  <ProFormSelect
                    name={operationFieldName(op.operationId)}
                    rules={[{ required: true, message: t('app.kuaizhizao.scheduling.prep.selectStationRequired') }]}
                    formItemProps={{ style: { marginBottom: 0 } }}
                    options={stationOptions}
                    fieldProps={{
                      size: 'small',
                      showSearch: true,
                      optionFilterProp: 'label',
                      placeholder:
                        stationOptions.length > 0
                          ? t('app.kuaizhizao.scheduling.prep.selectStation')
                          : t('app.kuaizhizao.scheduling.prep.noStationsAvailable'),
                      disabled: stationOptions.length === 0 || loading,
                      style: { width: '100%' },
                    }}
                  />
                  <ProFormDateTimePicker
                    name={operationPrepStartFieldName(op.operationId)}
                    formItemProps={{ style: { marginBottom: 0 } }}
                    fieldProps={{
                      size: 'small',
                      showTime: { format: 'HH:mm' },
                      format: 'YYYY-MM-DD HH:mm',
                      allowClear: true,
                      style: { width: '100%' },
                      placeholder:
                        index > 0
                          ? t('app.kuaizhizao.scheduling.prep.placeholderAfterPrevOp')
                          : t('app.kuaizhizao.scheduling.prep.placeholderCurrentTime'),
                    }}
                  />
                  <ProFormDateTimePicker
                    name={operationPrepEndFieldName(op.operationId)}
                    formItemProps={{ style: { marginBottom: 0 } }}
                    fieldProps={{
                      size: 'small',
                      showTime: { format: 'HH:mm' },
                      format: 'YYYY-MM-DD HH:mm',
                      allowClear: true,
                      style: { width: '100%' },
                      placeholder: t('app.kuaizhizao.scheduling.prep.placeholderStartPlus8h'),
                    }}
                  />
                </div>
              );
            })}
          </div>
        </>
      ) : workOrder && !loading ? (
        <Typography.Paragraph type="warning" style={{ marginBottom: 16 }}>
          {t('app.kuaizhizao.scheduling.prep.noRouteWarning')}
        </Typography.Paragraph>
      ) : null}
      {needsStart ? (
        <ProFormDateTimePicker
          name="planned_start_date"
          label={t('app.kuaizhizao.scheduling.prep.plannedStart')}
          rules={[{ required: true, message: t('app.kuaizhizao.scheduling.prep.selectStartRequired') }]}
          fieldProps={{ style: { width: '100%' } }}
        />
      ) : null}
      {needsEnd ? (
        <ProFormDateTimePicker
          name="planned_end_date"
          label={t('app.kuaizhizao.scheduling.prep.plannedEnd')}
          rules={[{ required: true, message: t('app.kuaizhizao.scheduling.prep.selectEndRequired') }]}
          fieldProps={buildFutureDateShortcutFieldProps({
            getForm: () => formRef.current,
            fieldName: 'planned_end_date',
            baseFieldName: 'planned_start_date',
            t,
            fieldProps: { style: { width: '100%' } },
          })}
        />
      ) : null}
    </FormModalTemplate>
  );
};

export default SchedulingWorkOrderPrepModal;

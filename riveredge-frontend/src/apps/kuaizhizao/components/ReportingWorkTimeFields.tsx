/**
 * 报工工时：开始 / 结束 / 工时 两项推第三项。
 * 规则见 deriveReportingWorkTimeUpdates（起止时刻优先，开始为锚点）。
 */
import React, { useCallback, useRef } from 'react';
import { Form } from 'antd';
import { ProFormDateTimePicker, ProFormDigit } from '@ant-design/pro-components';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  REPORTING_WORK_END_FIELD,
  REPORTING_WORK_HOURS_FIELD,
  REPORTING_WORK_START_FIELD,
  deriveReportingWorkTimeUpdates,
  toReportingDayjs,
  type ReportingWorkTimeField,
} from '../utils/reportingWorkTime';

export type ReportingWorkTimeFieldsProps = {
  colProps?: { span?: number; xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
};

export const ReportingWorkTimeFields: React.FC<ReportingWorkTimeFieldsProps> = ({
  colProps = { span: 12 },
}) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const syncingRef = useRef(false);

  const syncDerived = useCallback(
    (source: ReportingWorkTimeField) => {
      if (syncingRef.current || !form) return;
      const current = form.getFieldsValue([
        REPORTING_WORK_START_FIELD,
        REPORTING_WORK_END_FIELD,
        REPORTING_WORK_HOURS_FIELD,
      ]);
      const updates = deriveReportingWorkTimeUpdates(source, current);
      if (Object.keys(updates).length === 0) return;
      syncingRef.current = true;
      form.setFieldsValue(updates);
      syncingRef.current = false;
    },
    [form],
  );

  const handleStartChange = useCallback(
    (value: Dayjs | null) => {
      if (syncingRef.current || !form) return;
      form.setFieldValue(REPORTING_WORK_START_FIELD, value);
      syncDerived(REPORTING_WORK_START_FIELD);
    },
    [form, syncDerived],
  );

  const handleEndChange = useCallback(
    (value: Dayjs | null) => {
      if (syncingRef.current || !form) return;
      form.setFieldValue(REPORTING_WORK_END_FIELD, value);
      syncDerived(REPORTING_WORK_END_FIELD);
    },
    [form, syncDerived],
  );

  const handleHoursChange = useCallback(
    (value: number | null) => {
      if (syncingRef.current || !form) return;
      form.setFieldValue(REPORTING_WORK_HOURS_FIELD, value);
      syncDerived(REPORTING_WORK_HOURS_FIELD);
    },
    [form, syncDerived],
  );

  return (
    <>
      <ProFormDateTimePicker
        name={REPORTING_WORK_START_FIELD}
        label={t('app.kuaizhizao.workReporting.formWorkStartTime')}
        placeholder={t('app.kuaizhizao.workReporting.formWorkStartTimePlaceholder')}
        fieldProps={{
          format: 'YYYY-MM-DD HH:mm',
          style: { width: '100%' },
          onChange: handleStartChange,
        }}
        colProps={colProps}
      />
      <ProFormDateTimePicker
        name={REPORTING_WORK_END_FIELD}
        label={t('app.kuaizhizao.workReporting.formWorkEndTime')}
        placeholder={t('app.kuaizhizao.workReporting.formWorkEndTimePlaceholder')}
        rules={[
          ({ getFieldValue }) => ({
            validator: (_rule, value) => {
              const start = toReportingDayjs(getFieldValue(REPORTING_WORK_START_FIELD));
              const end = toReportingDayjs(value);
              if (start && end && end.isBefore(start)) {
                return Promise.reject(
                  new Error(t('app.kuaizhizao.workReporting.formWorkEndBeforeStart')),
                );
              }
              return Promise.resolve();
            },
          }),
        ]}
        fieldProps={{
          format: 'YYYY-MM-DD HH:mm',
          style: { width: '100%' },
          onChange: handleEndChange,
        }}
        colProps={colProps}
      />
      <ProFormDigit
        name={REPORTING_WORK_HOURS_FIELD}
        label={t('app.kuaizhizao.workReporting.colWorkHours')}
        placeholder={t('app.kuaizhizao.workReporting.formWorkHoursPlaceholder')}
        min={0}
        fieldProps={{ step: 0.1, onChange: handleHoursChange }}
        colProps={colProps}
      />
    </>
  );
};

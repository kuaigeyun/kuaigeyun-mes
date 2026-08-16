import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DatePicker, Select, theme } from 'antd';
import type { ActionType } from '@ant-design/pro-components';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { getUniToolbarControlShellStyle } from '../uni-search/toolbarChrome';
import { formDateRangeFormItemProps } from '../../utils/formDate';
import {
  defaultReportPeriodRange,
  detectReportPeriodPreset,
  reportPeriodRangeToSearchValue,
  resolveReportPeriodPreset,
  type ReportPeriodPreset,
} from './reportPeriodUtils';

const { RangePicker } = DatePicker;

export type ReportPeriodFilterProps = {
  searchParamsRef: React.MutableRefObject<Record<string, unknown> | undefined>;
  actionRef: React.MutableRefObject<ActionType | undefined>;
  onApplied?: () => void;
  revision?: number;
};

function readRangeFromRef(
  searchParamsRef: React.MutableRefObject<Record<string, unknown> | undefined>,
): [Dayjs, Dayjs] | null {
  const raw = searchParamsRef.current?.date_range;
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const normalized = formDateRangeFormItemProps.normalize?.(raw) as [Dayjs, Dayjs] | undefined;
  if (!normalized?.[0]?.isValid?.() || !normalized?.[1]?.isValid?.()) return null;
  return normalized;
}

export function buildReportPeriodSearchSeed(): Record<string, unknown> {
  const [start, end] = defaultReportPeriodRange();
  return { date_range: reportPeriodRangeToSearchValue([start, end]) };
}

export const ReportPeriodFilter: React.FC<ReportPeriodFilterProps> = ({
  searchParamsRef,
  actionRef,
  onApplied,
  revision = 0,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const shellStyle = getUniToolbarControlShellStyle(token);

  const presetOptions = useMemo(
    () =>
      (
        [
          'today',
          'this_week',
          'this_month',
          'last_month',
          'this_quarter',
          'this_year',
          'custom',
        ] as ReportPeriodPreset[]
      ).map((value) => ({
        value,
        label: t(`components.uniReport.period.preset.${value}`),
      })),
    [t],
  );

  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => defaultReportPeriodRange());
  const [preset, setPreset] = useState<ReportPeriodPreset>('this_month');

  const applyRange = useCallback(
    (nextRange: [Dayjs, Dayjs], nextPreset: ReportPeriodPreset) => {
      const normalized = reportPeriodRangeToSearchValue(nextRange);
      setRange([normalized[0], normalized[1]]);
      setPreset(nextPreset);
      const next: Record<string, unknown> = { ...(searchParamsRef.current || {}) };
      next.date_range = normalized;
      searchParamsRef.current = next;
      onApplied?.();
      actionRef.current?.reload?.();
    },
    [actionRef, onApplied, searchParamsRef],
  );

  useEffect(() => {
    const existing = readRangeFromRef(searchParamsRef);
    if (existing) {
      setRange(existing);
      setPreset(detectReportPeriodPreset(existing));
      return;
    }
    if (revision === 0) {
      const seed = defaultReportPeriodRange();
      const normalized = reportPeriodRangeToSearchValue(seed);
      searchParamsRef.current = { ...(searchParamsRef.current || {}), date_range: normalized };
      setRange([normalized[0], normalized[1]]);
      setPreset('this_month');
    }
  }, [revision, searchParamsRef]);

  return (
    <div
      className="uni-report-period-filter"
      style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
    >
      <Select<ReportPeriodPreset>
        size="small"
        value={preset}
        options={presetOptions}
        popupMatchSelectWidth={false}
        style={{ ...shellStyle, width: 96, flex: '0 0 96px' }}
        onChange={(value) => {
          if (value === 'custom') {
            setPreset('custom');
            return;
          }
          applyRange(resolveReportPeriodPreset(value), value);
        }}
      />
      <RangePicker
        size="small"
        allowClear={false}
        value={[range[0], range[1]]}
        format="MM-DD"
        placeholder={[t('components.uniReport.period.start'), t('components.uniReport.period.end')]}
        style={{ ...shellStyle, width: 148, flex: '0 0 148px' }}
        onChange={(values) => {
          if (!values?.[0] || !values?.[1]) return;
          const next: [Dayjs, Dayjs] = [values[0], values[1]];
          applyRange(next, detectReportPeriodPreset(next));
        }}
      />
    </div>
  );
};

export default ReportPeriodFilter;

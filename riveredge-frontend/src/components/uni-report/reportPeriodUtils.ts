import dayjs, { type Dayjs } from 'dayjs';
import { getTimezoneFromSiteSetting } from '../../utils/format';

export type ReportPeriodPreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'custom';

export function siteNow(): Dayjs {
  return dayjs().tz(getTimezoneFromSiteSetting());
}

export function resolveReportPeriodPreset(preset: ReportPeriodPreset): [Dayjs, Dayjs] {
  const now = siteNow();
  switch (preset) {
    case 'today': {
      const d = now.startOf('day');
      return [d, d];
    }
    case 'this_week': {
      const start = now.startOf('week');
      const end = now.endOf('week');
      return [start, end];
    }
    case 'this_month': {
      return [now.startOf('month'), now.endOf('month')];
    }
    case 'last_month': {
      const prev = now.subtract(1, 'month');
      return [prev.startOf('month'), prev.endOf('month')];
    }
    case 'this_quarter': {
      const month = now.month();
      const qStartMonth = Math.floor(month / 3) * 3;
      const start = now.month(qStartMonth).startOf('month');
      const end = start.add(2, 'month').endOf('month');
      return [start, end];
    }
    case 'this_year': {
      return [now.startOf('year'), now.endOf('year')];
    }
    default:
      return [now.startOf('month'), now.endOf('month')];
  }
}

export function defaultReportPeriodRange(): [Dayjs, Dayjs] {
  return resolveReportPeriodPreset('this_month');
}

export function reportPeriodRangeToSearchValue(range: [Dayjs, Dayjs]): [Dayjs, Dayjs] {
  return [range[0].startOf('day'), range[1].startOf('day')];
}

export function detectReportPeriodPreset(range: [Dayjs, Dayjs] | null | undefined): ReportPeriodPreset {
  if (!range?.[0]?.isValid?.() || !range?.[1]?.isValid?.()) return 'this_month';
  const start = range[0].format('YYYY-MM-DD');
  const end = range[1].format('YYYY-MM-DD');
  const presets: ReportPeriodPreset[] = [
    'today',
    'this_week',
    'this_month',
    'last_month',
    'this_quarter',
    'this_year',
  ];
  for (const p of presets) {
    const [ps, pe] = resolveReportPeriodPreset(p);
    if (ps.format('YYYY-MM-DD') === start && pe.format('YYYY-MM-DD') === end) {
      return p;
    }
  }
  return 'custom';
}

export function formatReportPeriodCompact(range: [Dayjs, Dayjs]): string {
  const [start, end] = range;
  if (start.format('YYYY-MM-DD') === end.format('YYYY-MM-DD')) {
    return start.format('MM-DD');
  }
  if (start.year() === end.year()) {
    return `${start.format('MM-DD')} ~ ${end.format('MM-DD')}`;
  }
  return `${start.format('YYYY-MM-DD')} ~ ${end.format('YYYY-MM-DD')}`;
}

/**
 * 休息 / 夜班登记：选车间与日期，定位或新建草稿考勤单后批量标记。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Button, DatePicker, Input, Select, Space, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { listEmployees } from '../../../services/employees';
import {
  batchMarkAttendance,
  createAttendanceSheet,
  listAttendanceSheets,
  refreshAttendanceRoster,
} from '../../../services/attendance';

type Mode = 'rest' | 'night';

const AttendanceDayRegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [params] = useSearchParams();
  const mode: Mode = params.get('mode') === 'night' ? 'night' : 'rest';
  const perms = useResourcePermissions('kuaioa:attendance');

  const [yearMonth, setYearMonth] = useState(dayjs().format('YYYY-MM'));
  const [workshop, setWorkshop] = useState('');
  const [productionLine, setProductionLine] = useState('');
  const [workDate, setWorkDate] = useState<Dayjs | null>(dayjs());
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ label: string; value: number }>>(
    [],
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await listEmployees({ status: 'active' });
      setEmployeeOptions(
        res.items.map((e) => ({
          label: `${e.employee_code || ''} ${e.full_name}`.trim(),
          value: Number(e.id),
        })),
      );
    })();
  }, []);

  const title = useMemo(
    () =>
      mode === 'night'
        ? t('app.kuaioa.attendance.nightRegister')
        : t('app.kuaioa.attendance.restRegister'),
    [mode, t],
  );

  const submit = useCallback(async () => {
    if (!perms.canUpdate) {
      message.error(t('common.noPermission'));
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(yearMonth.trim())) {
      message.error(t('app.kuaioa.payroll.yearMonthInvalid'));
      return;
    }
    if (!workshop.trim()) {
      message.error(t('app.kuaioa.attendance.workshopRequired'));
      return;
    }
    if (!workDate) {
      message.error(t('app.kuaioa.attendance.workDateRequired'));
      return;
    }
    const dateStr = workDate.format('YYYY-MM-DD');
    if (!dateStr.startsWith(yearMonth.trim())) {
      message.error(t('app.kuaioa.attendance.workDateMonthMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      const list = await listAttendanceSheets({
        year_month: yearMonth.trim(),
        workshop_name: workshop.trim(),
        status: 'draft',
      });
      let sheet =
        list.items.find((s) => {
          const line = String(s.production_line_name || '');
          const lineMatch = productionLine.trim()
            ? line === productionLine.trim()
            : !line;
          if (!lineMatch) return false;
          if (mode === 'night') return Boolean(s.has_night);
          return true;
        }) ||
        (mode === 'night'
          ? list.items.find((s) => Boolean(s.has_night))
          : list.items[0]);

      if (!sheet) {
        sheet = await createAttendanceSheet({
          year_month: yearMonth.trim(),
          workshop_name: workshop.trim(),
          production_line_name: productionLine.trim() || null,
          has_night: mode === 'night',
          standard_hours: mode === 'night' ? 8 : 8,
        });
      } else if (mode === 'night' && !sheet.has_night) {
        message.error(t('app.kuaioa.attendance.nightTemplateRequired'));
        return;
      }

      const sheetId = Number(sheet.id);
      await refreshAttendanceRoster(sheetId);
      await batchMarkAttendance(sheetId, {
        work_date: dateStr,
        mark: mode === 'rest' ? 'rest' : undefined,
        is_night: mode === 'night' ? true : undefined,
        employee_ids: employeeIds.length > 0 ? employeeIds : undefined,
      });
      message.success(t('common.success'));
    } catch (error) {
      message.error(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }, [
    employeeIds,
    message,
    mode,
    perms.canUpdate,
    productionLine,
    t,
    workDate,
    workshop,
    yearMonth,
  ]);

  return (
    <ListPageTemplate title={title}>
      <Typography.Paragraph type="secondary">
        {mode === 'night'
          ? t('app.kuaioa.attendance.nightRegisterHint')
          : t('app.kuaioa.attendance.restRegisterHint')}
      </Typography.Paragraph>
      <Space orientation="vertical" size="middle" style={{ width: '100%', maxWidth: 520 }}>
        <Input
          addonBefore={t('app.kuaioa.attendance.yearMonth')}
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          placeholder="YYYY-MM"
        />
        <Input
          addonBefore={t('app.kuaioa.attendance.workshop')}
          value={workshop}
          onChange={(e) => setWorkshop(e.target.value)}
        />
        <Input
          addonBefore={t('app.kuaioa.attendance.productionLine')}
          value={productionLine}
          onChange={(e) => setProductionLine(e.target.value)}
          placeholder={t('app.kuaioa.attendance.productionLineOptional')}
        />
        <DatePicker
          value={workDate}
          onChange={setWorkDate}
          style={{ width: '100%' }}
          placeholder={t('app.kuaioa.attendance.workDate')}
        />
        <Select
          mode="multiple"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t('app.kuaioa.attendance.employeeOptional')}
          options={employeeOptions}
          value={employeeIds}
          onChange={setEmployeeIds}
          style={{ width: '100%' }}
        />
        <Button type="primary" loading={submitting} onClick={() => void submit()}>
          {t('common.confirm')}
        </Button>
      </Space>
    </ListPageTemplate>
  );
};

export default AttendanceDayRegisterPage;

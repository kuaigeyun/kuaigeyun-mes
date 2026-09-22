import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import { listEmployees } from '../../../services/employees';
import {
  createLeaveRequest,
  deleteLeaveRequest,
  getLeaveRequest,
  listLeaveRequests,
  updateLeaveRequest,
} from '../../../services/leave';
import { buildLeaveTypeOptions, buildOaApprovalStatusEnum } from '../../../utils/oaFormEnums';
import { computeInclusiveCalendarDays } from '../../../utils/oaFormDateUtils';
import { loadOaWorkshopNameOptions } from '../../../utils/oaWorkshopOptions';
import dayjs from 'dayjs';

function computeSameDayLeaveHours(startAt: unknown, endAt: unknown): number | null {
  if (!startAt || !endAt) return null;
  const start = dayjs(startAt as string | Date);
  const end = dayjs(endAt as string | Date);
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) return null;
  if (!start.isSame(end, 'day')) return null;
  const hours = end.diff(start, 'minute') / 60;
  if (hours <= 0 || hours >= 8) return null;
  return Math.round(hours * 100) / 100;
}

const LeavePage: React.FC = () => {
  const { t } = useTranslation();
  const statusEnum = useMemo(() => buildOaApprovalStatusEnum(t), [t]);
  const leaveTypeOptions = useMemo(() => buildLeaveTypeOptions(t), [t]);
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ label: string; value: number }>>(
    [],
  );
  const [workshopOptions, setWorkshopOptions] = useState<Array<{ label: string; value: string }>>(
    [],
  );
  const [employeeWorkshop, setEmployeeWorkshop] = useState<
    Record<number, { workshop?: string; line?: string }>
  >({});

  useEffect(() => {
    void (async () => {
      const [emps, workshops] = await Promise.all([
        listEmployees({ status: 'active' }),
        loadOaWorkshopNameOptions(),
      ]);
      setWorkshopOptions(workshops);
      setEmployeeOptions(
        emps.items.map((e) => ({
          label: `${e.employee_code || ''} ${e.full_name}`.trim(),
          value: Number(e.id),
        })),
      );
      const map: Record<number, { workshop?: string; line?: string }> = {};
      for (const e of emps.items) {
        map[Number(e.id)] = {
          workshop: e.workshop_name || undefined,
          line: e.production_line_name || undefined,
        };
      }
      setEmployeeWorkshop(map);
    })();
  }, []);

  const fields = useMemo(
    () => [
      { name: 'request_code', labelKey: 'app.kuaioa.leave.code', width: 150 },
      {
        name: 'workshop_name',
        labelKey: 'app.kuaioa.attendance.workshop',
        type: 'select' as const,
        options: workshopOptions,
        required: true,
        width: 120,
      },
      {
        name: 'production_line_name',
        labelKey: 'app.kuaioa.attendance.productionLine',
        width: 120,
      },
      {
        name: 'employee_id',
        labelKey: 'app.kuaioa.employee.fullName',
        type: 'select' as const,
        options: employeeOptions,
        required: true,
        hideInTable: true,
      },
      {
        name: 'employee_name',
        labelKey: 'app.kuaioa.employee.fullName',
        width: 100,
        hideInForm: true,
      },
      {
        name: 'leave_type',
        labelKey: 'app.kuaioa.leave.type',
        width: 100,
        required: true,
        type: 'select' as const,
        options: leaveTypeOptions,
      },
      { name: 'title', labelKey: 'app.kuaioa.leave.title', required: true, width: 200 },
      {
        name: 'start_at',
        labelKey: 'app.kuaioa.leave.startAt',
        type: 'datetime' as const,
        width: 160,
        required: true,
      },
      {
        name: 'end_at',
        labelKey: 'app.kuaioa.leave.endAt',
        type: 'datetime' as const,
        width: 160,
        required: true,
      },
      { name: 'days', labelKey: 'app.kuaioa.leave.days', width: 80, type: 'number' as const },
      {
        name: 'leave_hours',
        labelKey: 'app.kuaioa.leave.leaveHours',
        width: 100,
        type: 'number' as const,
        hideInTable: true,
      },
      {
        name: 'deduct_enabled',
        labelKey: 'app.kuaioa.leave.deductEnabled',
        type: 'switch' as const,
        hideInTable: true,
      },
      {
        name: 'deduct_amount',
        labelKey: 'app.kuaioa.leave.deductAmount',
        type: 'number' as const,
        hideInTable: true,
      },
      { name: 'applicant_name', labelKey: 'app.kuaioa.common.applicant', width: 100, hideInForm: true },
      { name: 'department_name', labelKey: 'app.kuaioa.common.department', hideInTable: true },
      { name: 'destination', labelKey: 'app.kuaioa.leave.destination', hideInTable: true },
      { name: 'reason', labelKey: 'app.kuaioa.leave.reason', hideInTable: true, type: 'textarea' as const },
      { name: 'status', labelKey: 'common.status', width: 100 },
      { name: 'notes', labelKey: 'common.remark', hideInTable: true, type: 'textarea' as const },
    ],
    [employeeOptions, leaveTypeOptions, workshopOptions],
  );

  return (
    <KuaioaCrudListPage
      createButtonKey="app.kuaioa.leave.createButton"
      resource="kuaioa:leave"
      codeField="request_code"
      nameField="title"
      autoGenerateCode
      statusEnum={statusEnum}
      statusPresentation="lifecycle"
      detailVariant="approval"
      getDetailFn={getLeaveRequest}
      columnPersistenceId="apps.kuaioa.leave.list-v2"
      auditWorkflow={{
        entityType: 'kuaioa_leave',
        resourcePrefix: 'kuaioa:leave',
        auditNodeKey: 'kuaioa_leave',
        entityNameKey: 'app.kuaioa.leave.entityName',
      }}
      onFormValuesChange={(changed, allValues, form) => {
        if ('start_at' in changed || 'end_at' in changed) {
          const days = computeInclusiveCalendarDays(allValues.start_at, allValues.end_at);
          if (days != null && days > 0) {
            form.setFieldValue('days', days);
          }
          const hours = computeSameDayLeaveHours(allValues.start_at, allValues.end_at);
          if (hours != null) {
            form.setFieldValue('leave_hours', hours);
            form.setFieldValue('days', Math.round((hours / 8) * 100) / 100);
          }
        }
        if ('deduct_enabled' in changed && !allValues.deduct_enabled) {
          form.setFieldValue('deduct_amount', undefined);
        }
        if ('employee_id' in changed) {
          const snap = employeeWorkshop[Number(changed.employee_id)];
          if (snap?.workshop) form.setFieldValue('workshop_name', snap.workshop);
          if (snap?.line) form.setFieldValue('production_line_name', snap.line);
        }
      }}
      mapFormValuesToPayload={(values) => {
        const { employee_name: _n, applicant_name: _a, ...rest } = values;
        return rest;
      }}
      fields={fields}
      listFn={listLeaveRequests}
      createFn={createLeaveRequest}
      updateFn={updateLeaveRequest}
      deleteFn={deleteLeaveRequest}
    />
  );
};

export default LeavePage;

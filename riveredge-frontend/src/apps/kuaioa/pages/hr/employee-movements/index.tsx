import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, DatePicker, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { listEmployeeMovements, listEmployees } from '../../../services/employees';

type Row = Record<string, unknown>;

const EmployeeMovementsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const perms = useResourcePermissions('kuaioa:employee');
  const [yearMonth, setYearMonth] = useState<Dayjs>(() => dayjs());
  const [workshop, setWorkshop] = useState<string | undefined>();
  const [movementType, setMovementType] = useState<string | undefined>();
  const [workshopOptions, setWorkshopOptions] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const typeOptions = useMemo(
    () => [
      { label: t('app.kuaioa.movement.type.hire'), value: 'hire' },
      { label: t('app.kuaioa.movement.type.leave'), value: 'leave' },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await listEmployees();
        if (cancelled) return;
        const names = Array.from(
          new Set(
            res.items
              .map((e) => String(e.workshop_name ?? '').trim())
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b, 'zh-CN'));
        setWorkshopOptions(names.map((name) => ({ label: name, value: name })));
      } catch {
        if (!cancelled) setWorkshopOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!yearMonth?.isValid()) {
      message.error(t('app.kuaioa.payroll.yearMonthInvalid'));
      return;
    }
    const ym = yearMonth.format('YYYY-MM');
    setLoading(true);
    try {
      const res = await listEmployeeMovements({
        year_month: ym,
        workshop_name: workshop || undefined,
        movement_type: movementType,
      });
      setRows(res.items);
    } catch (error) {
      message.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [message, movementType, t, workshop, yearMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportColumns = useMemo(
    () => [
      { key: 'movement_type', title: t('app.kuaioa.movement.typeLabel') },
      { key: 'employee_name', title: t('app.kuaioa.employee.fullName') },
      { key: 'employee_code', title: t('app.kuaioa.employee.code') },
      { key: 'workshop_name', title: t('app.kuaioa.attendance.workshop') },
      { key: 'movement_date', title: t('app.kuaioa.movement.date') },
      { key: 'employment_type', title: t('app.kuaioa.employee.employmentTypeLabel') },
    ],
    [t],
  );

  const columns: ColumnsType<Row> = [
    {
      title: t('app.kuaioa.movement.typeLabel'),
      dataIndex: 'movement_type',
      width: 100,
      render: (v) =>
        v === 'hire' ? t('app.kuaioa.movement.type.hire') : t('app.kuaioa.movement.type.leave'),
    },
    { title: t('app.kuaioa.employee.fullName'), dataIndex: 'employee_name', width: 120 },
    { title: t('app.kuaioa.employee.code'), dataIndex: 'employee_code', width: 120 },
    { title: t('app.kuaioa.attendance.workshop'), dataIndex: 'workshop_name', width: 140 },
    { title: t('app.kuaioa.movement.date'), dataIndex: 'movement_date', width: 120 },
    {
      title: t('app.kuaioa.employee.employmentTypeLabel'),
      dataIndex: 'employment_type',
      width: 100,
      render: (v) =>
        v === 'temp'
          ? t('app.kuaioa.employee.employmentType.temp')
          : t('app.kuaioa.employee.employmentType.formal'),
    },
  ];

  return (
    <ListPageTemplate
      toolbarExtra={
        <Space wrap>
          <DatePicker
            picker="month"
            allowClear={false}
            value={yearMonth}
            onChange={(v) => {
              if (v) setYearMonth(v);
            }}
            style={{ width: 140 }}
            placeholder={t('app.kuaioa.payroll.yearMonth')}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('app.kuaioa.attendance.workshop')}
            options={workshopOptions}
            value={workshop}
            onChange={setWorkshop}
            style={{ width: 160 }}
          />
          <Select
            allowClear
            placeholder={t('app.kuaioa.movement.typeLabel')}
            options={typeOptions}
            value={movementType}
            onChange={setMovementType}
            style={{ width: 120 }}
          />
          <Button type="primary" loading={loading} onClick={() => void load()}>
            {t('common.search')}
          </Button>
          {perms.canExport ? (
            <Button
              disabled={rows.length === 0}
              onClick={() =>
                void downloadRecordsAsXlsx(
                  rows,
                  exportColumns,
                  t('app.kuaioa.movement.exportFileName'),
                )
              }
            >
              {t('common.export')}
            </Button>
          ) : null}
        </Space>
      }
    >
      <Typography.Paragraph type="secondary">{t('app.kuaioa.movement.hint')}</Typography.Paragraph>
      <Table<Row>
        size="small"
        loading={loading}
        rowKey={(r, i) => `${String(r.employee_id)}-${String(r.movement_type)}-${i}`}
        columns={columns}
        dataSource={rows}
        pagination={false}
        bordered
      />
    </ListPageTemplate>
  );
};

export default EmployeeMovementsPage;

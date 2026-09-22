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
import { listEmployees } from '../../../services/employees';
import { getPersonalPayrollStats } from '../../../services/payroll';

type MonthRow = {
  month: number;
  wage: number;
  expense: number;
  balance: number;
};

const PersonalPayrollPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const perms = useResourcePermissions('kuaioa:payroll');
  const [year, setYear] = useState<Dayjs>(() => dayjs());
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ label: string; value: number }>>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [monthRows, setMonthRows] = useState<MonthRow[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await listEmployees();
      setEmployeeOptions(
        res.items.map((e) => ({
          label: `${e.employee_code || ''} ${e.full_name}`.trim(),
          value: Number(e.id),
        })),
      );
    })();
  }, []);

  const load = useCallback(async () => {
    if (!year?.isValid() || !employeeId) {
      message.error(t('app.kuaioa.personalPayroll.needEmployee'));
      return;
    }
    const y = year.year();
    if (y < 2000) {
      message.error(t('app.kuaioa.personalPayroll.needEmployee'));
      return;
    }
    setLoading(true);
    try {
      const data = await getPersonalPayrollStats({ employee_id: employeeId, year: y });
      setStats(data);
      const rows: MonthRow[] = [];
      for (let m = 1; m <= 12; m += 1) {
        const pad = String(m).padStart(2, '0');
        rows.push({
          month: m,
          wage: Number(data[`wage_m${pad}`] || 0),
          expense: Number(data[`deduct_m${pad}`] || 0),
          balance: Number(data[`balance_m${pad}`] || 0),
        });
      }
      setMonthRows(rows);
    } catch (error) {
      message.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [employeeId, message, t, year]);

  const exportRows = useMemo(
    () =>
      monthRows.map((r) => ({
        month: r.month,
        wage: r.wage.toFixed(2),
        expense: r.expense.toFixed(2),
        balance: r.balance.toFixed(2),
      })),
    [monthRows],
  );

  const columns: ColumnsType<MonthRow> = [
    {
      title: t('app.kuaioa.personalPayroll.month'),
      dataIndex: 'month',
      width: 80,
      render: (m) => t('app.kuaioa.annualStats.monthWage', { month: m }),
    },
    {
      title: t('app.kuaioa.personalPayroll.wage'),
      dataIndex: 'wage',
      width: 120,
      render: (v) => Number(v).toFixed(2),
    },
    {
      title: t('app.kuaioa.personalPayroll.expense'),
      dataIndex: 'expense',
      width: 120,
      render: (v) => Number(v).toFixed(2),
    },
    {
      title: t('app.kuaioa.personalPayroll.balance'),
      dataIndex: 'balance',
      width: 120,
      render: (v) => Number(v).toFixed(2),
    },
  ];

  return (
    <ListPageTemplate
      title={t('app.kuaioa.personalPayroll.title')}
      toolbarExtra={
        <Space wrap className="no-print">
          <DatePicker
            picker="year"
            allowClear={false}
            value={year}
            onChange={(v) => {
              if (v) setYear(v);
            }}
            style={{ width: 120 }}
            placeholder={t('app.kuaioa.welfare.year')}
          />
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={t('app.kuaioa.employee.fullName')}
            options={employeeOptions}
            value={employeeId ?? undefined}
            onChange={setEmployeeId}
            style={{ width: 220 }}
          />
          <Button type="primary" loading={loading} onClick={() => void load()}>
            {t('common.search')}
          </Button>
          {perms.canExport && monthRows.length > 0 ? (
            <Button
              onClick={() =>
                void downloadRecordsAsXlsx(
                  exportRows,
                  [
                    { key: 'month', title: t('app.kuaioa.personalPayroll.month') },
                    { key: 'wage', title: t('app.kuaioa.personalPayroll.wage') },
                    { key: 'expense', title: t('app.kuaioa.personalPayroll.expense') },
                    { key: 'balance', title: t('app.kuaioa.personalPayroll.balance') },
                  ],
                  t('app.kuaioa.personalPayroll.exportFileName'),
                )
              }
            >
              {t('common.export')}
            </Button>
          ) : null}
          {monthRows.length > 0 ? (
            <Button onClick={() => window.print()}>{t('app.kuaioa.payroll.exportPdf')}</Button>
          ) : null}
        </Space>
      }
    >
      <Typography.Paragraph type="secondary">{t('app.kuaioa.personalPayroll.hint')}</Typography.Paragraph>
      {stats ? (
        <Typography.Paragraph>
          {String(stats.employee_name || '')} {year.year()}{' '}
          {t('app.kuaioa.annualStats.annualWage')}: {Number(stats.annual_wage || 0).toFixed(2)}；
          {t('app.kuaioa.annualStats.balanceTotal')}: {Number(stats.balance_total || 0).toFixed(2)}
        </Typography.Paragraph>
      ) : null}
      <Table<MonthRow>
        size="small"
        loading={loading}
        rowKey="month"
        columns={columns}
        dataSource={monthRows}
        pagination={false}
        bordered
      />
    </ListPageTemplate>
  );
};

export default PersonalPayrollPage;

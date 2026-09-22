import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, DatePicker, Input, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { loadOaWorkshopNameOptions } from '../../../utils/oaWorkshopOptions';
import { listAnnualPayrollStats } from '../../../services/payroll';

type Row = Record<string, unknown>;

const AnnualPayrollStatsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const perms = useResourcePermissions('kuaioa:payroll');
  const [year, setYear] = useState<Dayjs>(() => dayjs());
  const [workshop, setWorkshop] = useState<string | undefined>();
  const [workshopOptions, setWorkshopOptions] = useState<Array<{ label: string; value: string }>>(
    [],
  );
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    void (async () => {
      setWorkshopOptions(await loadOaWorkshopNameOptions());
    })();
  }, []);

  const load = useCallback(async () => {
    if (!year?.isValid()) {
      message.error(t('app.kuaioa.annualStats.yearInvalid'));
      return;
    }
    const y = year.year();
    if (y < 2000 || y > 2100) {
      message.error(t('app.kuaioa.annualStats.yearInvalid'));
      return;
    }
    setLoading(true);
    try {
      const res = await listAnnualPayrollStats({
        year: y,
        workshop_name: workshop || undefined,
        keyword: keyword.trim() || undefined,
      });
      setRows(res.items);
    } catch (error) {
      message.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [keyword, message, t, workshop, year]);

  const money = (v: unknown) => Number(v || 0).toFixed(2);

  const columns: ColumnsType<Row> = useMemo(() => {
    const monthCols: ColumnsType<Row> = [];
    for (let m = 1; m <= 12; m += 1) {
      const key = `wage_m${String(m).padStart(2, '0')}`;
      monthCols.push({
        title: t('app.kuaioa.annualStats.monthWage', { month: m }),
        dataIndex: key,
        width: 96,
        render: money,
      });
    }
    const livingCols: ColumnsType<Row> = [];
    for (let m = 1; m <= 12; m += 1) {
      const key = `living_m${String(m).padStart(2, '0')}`;
      livingCols.push({
        title: t('app.kuaioa.annualStats.monthLiving', { month: m }),
        dataIndex: key,
        width: 96,
        render: money,
      });
    }
    const insuranceCols: ColumnsType<Row> = [];
    for (let m = 1; m <= 12; m += 1) {
      const key = `insurance_m${String(m).padStart(2, '0')}`;
      insuranceCols.push({
        title: t('app.kuaioa.annualStats.monthInsurance', { month: m }),
        dataIndex: key,
        width: 96,
        render: money,
      });
    }
    return [
      {
        title: t('app.kuaioa.annualStats.seq'),
        key: 'seq',
        width: 64,
        fixed: 'left',
        render: (_v, _r, index) => index + 1,
      },
      {
        title: t('app.kuaioa.employee.fullName'),
        dataIndex: 'employee_name',
        width: 110,
        fixed: 'left',
      },
      {
        title: t('app.kuaioa.annualStats.unit'),
        dataIndex: 'workshop_name',
        width: 120,
        fixed: 'left',
      },
      ...monthCols,
      {
        title: t('app.kuaioa.annualStats.annualWage'),
        dataIndex: 'annual_wage',
        width: 110,
        render: money,
      },
      {
        title: t('app.kuaioa.payroll.taxDeduct'),
        dataIndex: 'tax_total',
        width: 90,
        render: money,
      },
      ...livingCols,
      {
        title: t('app.kuaioa.annualStats.rentUtility'),
        dataIndex: 'rent_utility',
        width: 110,
        render: money,
      },
      {
        title: t('app.kuaioa.annualStats.livingTotal'),
        dataIndex: 'living_total',
        width: 120,
        render: money,
      },
      ...insuranceCols,
      {
        title: t('app.kuaioa.annualStats.insuranceTotal'),
        dataIndex: 'insurance_total',
        width: 110,
        render: money,
      },
      {
        title: t('app.kuaioa.annualStats.balanceTotal'),
        dataIndex: 'balance_total',
        width: 110,
        render: money,
      },
    ];
  }, [t]);

  return (
    <ListPageTemplate
      title={t('app.kuaioa.annualStats.title')}
      toolbarExtra={
        <Space wrap>
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
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('app.kuaioa.attendance.workshop')}
            options={workshopOptions}
            value={workshop}
            onChange={setWorkshop}
            style={{ width: 160 }}
          />
          <Input
            placeholder={t('app.kuaioa.employee.fullName')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 140 }}
          />
          <Button type="primary" loading={loading} onClick={() => void load()}>
            {t('common.search')}
          </Button>
          {perms.canExport && rows.length > 0 ? (
            <Button
              onClick={() => {
                const exportCols = [
                  { key: 'workshop_name', title: t('app.kuaioa.attendance.workshop') },
                  { key: 'employee_name', title: t('app.kuaioa.employee.fullName') },
                  ...Array.from({ length: 12 }, (_, i) => {
                    const m = i + 1;
                    const key = `wage_m${String(m).padStart(2, '0')}`;
                    return { key, title: t('app.kuaioa.annualStats.monthWage', { month: m }) };
                  }),
                  { key: 'annual_wage', title: t('app.kuaioa.annualStats.annualWage') },
                ];
                void downloadRecordsAsXlsx(rows, exportCols, t('app.kuaioa.annualStats.exportFileName'));
              }}
            >
              {t('common.export')}
            </Button>
          ) : null}
        </Space>
      }
    >
      <Typography.Paragraph type="secondary">
        {t('app.kuaioa.annualStats.hint')}
      </Typography.Paragraph>
      <Table<Row>
        size="small"
        loading={loading}
        rowKey={(r) => String(r.employee_id)}
        columns={columns}
        dataSource={rows}
        pagination={false}
        bordered
        scroll={{ x: 2800 }}
      />
    </ListPageTemplate>
  );
};

export default AnnualPayrollStatsPage;

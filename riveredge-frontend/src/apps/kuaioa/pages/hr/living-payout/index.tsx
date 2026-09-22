import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, DatePicker, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { loadOaWorkshopNameOptions } from '../../../utils/oaWorkshopOptions';
import { exportLivingPayoutXlsx } from '../../../utils/exportLivingPayoutXlsx';
import { listLivingPayout } from '../../../services/payroll';

type Row = Record<string, unknown>;

/** 生活费发放登记表（按银行分块，Excel 发放表版式） */
const LivingPayoutPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const perms = useResourcePermissions('kuaioa:living-advance');
  const [yearMonth, setYearMonth] = useState<Dayjs>(() => dayjs());
  const [workshop, setWorkshop] = useState<string | undefined>();
  const [workshopOptions, setWorkshopOptions] = useState<Array<{ label: string; value: string }>>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    void (async () => {
      setWorkshopOptions(await loadOaWorkshopNameOptions());
    })();
  }, []);

  const load = useCallback(async () => {
    if (!yearMonth?.isValid()) {
      message.error(t('app.kuaioa.payroll.yearMonthInvalid'));
      return;
    }
    setLoading(true);
    try {
      const res = await listLivingPayout({
        year_month: yearMonth.format('YYYY-MM'),
        workshop_name: workshop || undefined,
      });
      setRows(res.items);
    } catch (error) {
      message.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [message, t, workshop, yearMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const sheetTitle = useMemo(
    () =>
      t('app.kuaioa.livingPayout.sheetTitle', {
        year: yearMonth.year(),
        month: yearMonth.month() + 1,
      }),
    [t, yearMonth],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const bank = String(row.bank_name ?? '');
      const list = map.get(bank) || [];
      list.push(row);
      map.set(bank, list);
    }
    return Array.from(map.entries());
  }, [rows]);

  const buildColumns = (bank: string): ColumnsType<Row> => [
    { title: t('app.kuaioa.livingPayout.bank'), width: 80, render: () => bank },
    {
      title: t('app.kuaioa.livingPayout.seq'),
      width: 64,
      render: (_v, _r, index) => index + 1,
    },
    { title: t('app.kuaioa.employee.fullName'), dataIndex: 'employee_name', width: 100 },
    { title: t('app.kuaioa.employee.bankAccount'), dataIndex: 'bank_account', width: 160 },
    {
      title: t('app.kuaioa.livingPayout.fixedAmount'),
      dataIndex: 'base_living',
      width: 100,
      render: (v) => Number(v || 0).toFixed(2),
    },
    {
      title: t('app.kuaioa.livingPayout.advanceAmount'),
      dataIndex: 'advance_amount',
      width: 100,
      render: (v) => Number(v || 0).toFixed(2),
    },
    {
      title: t('app.kuaioa.livingPayout.payout'),
      dataIndex: 'payout_amount',
      width: 100,
      render: (v) => Number(v || 0).toFixed(2),
    },
    { title: t('app.kuaioa.livingPayout.sign'), key: 'sign', width: 100, render: () => '' },
    { title: t('app.kuaioa.attendance.workshop'), dataIndex: 'workshop_name', width: 120 },
  ];

  return (
    <ListPageTemplate
      title={t('app.kuaioa.livingPayout.title')}
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
          <Button type="primary" loading={loading} onClick={() => void load()}>
            {t('common.search')}
          </Button>
          {perms.canExport && rows.length > 0 ? (
            <Button
              onClick={() =>
                void exportLivingPayoutXlsx(rows as never, {
                  yearMonth: yearMonth.format('YYYY-MM'),
                  title: sheetTitle,
                  unitLabel: t('app.kuaioa.livingPayout.unitYuan'),
                  headers: {
                    bank: t('app.kuaioa.livingPayout.bank'),
                    seq: t('app.kuaioa.livingPayout.seq'),
                    name: t('app.kuaioa.employee.fullName'),
                    account: t('app.kuaioa.employee.bankAccount'),
                    fixed: t('app.kuaioa.livingPayout.fixedAmount'),
                    advance: t('app.kuaioa.livingPayout.advanceAmount'),
                    payout: t('app.kuaioa.livingPayout.payout'),
                    sign: t('app.kuaioa.livingPayout.sign'),
                    workshop: t('app.kuaioa.attendance.workshop'),
                  },
                  totalLabel: t('app.kuaioa.livingPayout.total'),
                  fileName: `${t('app.kuaioa.livingPayout.exportFileName')}_${yearMonth.format('YYYY-MM')}`,
                }).catch((error) => message.error(getApiErrorMessage(error)))
              }
            >
              {t('common.export')}
            </Button>
          ) : null}
        </Space>
      }
    >
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        {sheetTitle}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ textAlign: 'right', marginBottom: 8 }}>
        {t('app.kuaioa.livingPayout.unitYuan')}
      </Typography.Paragraph>
      {groups.length === 0 && !loading ? (
        <Typography.Paragraph type="secondary">{t('app.kuaioa.livingPayout.hint')}</Typography.Paragraph>
      ) : null}
      {groups.map(([bank, list]) => {
        const payoutSum = list.reduce((s, r) => s + Number(r.payout_amount || 0), 0);
        return (
          <div key={bank || '__empty__'} style={{ marginBottom: 24 }}>
            <Table<Row>
              size="small"
              loading={loading}
              rowKey={(r) => String(r.employee_id)}
              columns={buildColumns(bank)}
              dataSource={list}
              pagination={false}
              bordered
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={6}>
                    {t('app.kuaioa.livingPayout.total')}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6}>{payoutSum.toFixed(2)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={7} colSpan={2} />
                </Table.Summary.Row>
              )}
            />
          </div>
        );
      })}
    </ListPageTemplate>
  );
};

export default LivingPayoutPage;

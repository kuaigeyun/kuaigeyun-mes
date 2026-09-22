import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Alert, Button, InputNumber, Modal, Select, Space, Table, Typography, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  confirmPayrollSettlement,
  getPayrollSettlement,
  importPayrollLines,
  rebuildPayrollSettlement,
  reopenPayrollSettlement,
  updatePayrollLine,
  updatePayrollSettlement,
} from '../../../services/payroll';

type LineRow = Record<string, unknown> & { id: number; employee_name: string };

const PayrollSettlementDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const settlementId = Number(id);
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const perms = useResourcePermissions('kuaioa:payroll');
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState<Record<string, unknown> | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<'basic_wage' | 'piece_wage'>('basic_wage');

  const load = useCallback(async () => {
    if (!Number.isFinite(settlementId) || settlementId <= 0) return;
    setLoading(true);
    try {
      setSheet(await getPayrollSettlement(settlementId));
    } catch (error) {
      message.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [message, settlementId]);

  useEffect(() => {
    void load();
  }, [load]);

  const locked = sheet?.status === 'confirmed';
  const lines = (sheet?.lines as LineRow[] | undefined) || [];
  const belowIds = new Set((sheet?.below_minimum_lines as number[] | undefined) || []);

  const patchLine = async (lineId: number, field: string, value: number | null) => {
    if (locked || !perms.canUpdate || value === null) return;
    try {
      await updatePayrollLine(settlementId, lineId, { [field]: value });
      await load();
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const patchHeader = async (field: string, value: number | null) => {
    if (locked || !perms.canUpdate || value === null) return;
    try {
      await updatePayrollSettlement(settlementId, { [field]: value });
      await load();
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const moneyCol = (field: string, titleKey: string, editable = true): ColumnsType<LineRow>[number] => ({
    title: t(titleKey),
    dataIndex: field,
    width: 96,
    render: (v: unknown, row) =>
      editable && !locked && perms.canUpdate ? (
        <InputNumber
          size="small"
          min={0}
          changeOnBlur
          value={Number(v || 0)}
          onChange={(next) => {
            if (next === null || next === undefined) return;
            if (Number(next) === Number(v || 0)) return;
            void patchLine(Number(row.id), field, Number(next));
          }}
          style={{ width: 84 }}
        />
      ) : (
        Number(v || 0).toFixed(2)
      ),
  });

  const columns: ColumnsType<LineRow> = [
    {
      title: t('app.kuaioa.payroll.seq'),
      key: 'seq',
      fixed: 'left',
      width: 64,
      render: (_v, _row, index) => index + 1,
    },
    {
      title: t('app.kuaioa.payroll.lineSeq'),
      key: 'line_seq',
      width: 72,
      render: (_v, _row, index) => index + 1,
    },
    {
      title: t('app.kuaioa.employee.fullName'),
      dataIndex: 'employee_name',
      fixed: 'left',
      width: 100,
    },
    moneyCol('basic_wage', 'app.kuaioa.payroll.basicWage'),
    moneyCol('post_wage', 'app.kuaioa.employee.postWage'),
    moneyCol('piece_wage', 'app.kuaioa.payroll.pieceWage'),
    moneyCol('night_subsidy', 'app.kuaioa.payroll.nightSubsidy'),
    moneyCol('heat_subsidy', 'app.kuaioa.payroll.heatSubsidy'),
    moneyCol('post_allowance', 'app.kuaioa.payroll.postAllowance'),
    moneyCol('earning_subtotal', 'app.kuaioa.payroll.earningSubtotal', false),
    moneyCol('living_deduct', 'app.kuaioa.payroll.livingDeduct'),
    moneyCol('insurance_deduct', 'app.kuaioa.payroll.insuranceDeduct'),
    moneyCol('leave_deduct', 'app.kuaioa.payroll.leaveDeduct'),
    moneyCol('tax_deduct', 'app.kuaioa.payroll.taxDeduct'),
    moneyCol('deduct_subtotal', 'app.kuaioa.payroll.deductSubtotal', false),
    moneyCol('card_pay', 'app.kuaioa.payroll.cardPay'),
    moneyCol('balance', 'app.kuaioa.payroll.balance', false),
    {
      title: t('app.kuaioa.payroll.sign'),
      key: 'sign',
      width: 80,
      render: () => '',
    },
    moneyCol('time_wage', 'app.kuaioa.payroll.timeWage'),
    moneyCol('allowance', 'app.kuaioa.payroll.allowance'),
    moneyCol('rent_utility_deduct', 'app.kuaioa.payroll.rentUtilityDeduct'),
    moneyCol('compensation', 'app.kuaioa.payroll.compensation'),
  ];

  const handleImportFile = async (file: File) => {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    const rows = raw
      .map((r) => ({
        employee_name: String(r.姓名 || r.employee_name || r.name || '').trim(),
        amount: Number(r.金额 || r.amount || 0),
        target_field: importTarget,
      }))
      .filter((r) => r.employee_name && r.amount > 0);
    if (rows.length === 0) {
      message.error(t('app.kuaioa.payroll.importEmpty'));
      return false;
    }
    try {
      await importPayrollLines(settlementId, { rows });
      message.success(t('app.kuaioa.payroll.importSuccess'));
      setImportOpen(false);
      await load();
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
    return false;
  };

  return (
    <ListPageTemplate
      title={`${t('app.kuaioa.payroll.detailTitle')} ${sheet?.year_month || ''} ${sheet?.workshop_name || ''}`}
      toolbarExtra={
        <Space wrap className="no-print">
          <Button onClick={() => navigate('/apps/kuaioa/hr/payroll-settlements')}>
            {t('common.back')}
          </Button>
          {!locked && perms.canUpdate ? (
            <>
              <Button onClick={() => setImportOpen(true)}>{t('app.kuaioa.payroll.import')}</Button>
              <Button
                loading={loading}
                onClick={async () => {
                  try {
                    await rebuildPayrollSettlement(settlementId);
                    message.success(t('app.kuaioa.payroll.rebuilt'));
                    await load();
                  } catch (error) {
                    message.error(getApiErrorMessage(error));
                  }
                }}
              >
                {t('app.kuaioa.payroll.rebuild')}
              </Button>
            </>
          ) : null}
          {sheet?.status === 'draft' && perms.canAction?.('submit') ? (
            <Button
              type="primary"
              onClick={async () => {
                try {
                  await confirmPayrollSettlement(settlementId);
                  message.success(t('common.success'));
                  await load();
                } catch (error) {
                  message.error(getApiErrorMessage(error));
                }
              }}
            >
              {t('app.kuaioa.payroll.confirm')}
            </Button>
          ) : null}
          {sheet?.status === 'confirmed' && perms.canUpdate ? (
            <Button
              onClick={async () => {
                try {
                  await reopenPayrollSettlement(settlementId);
                  message.success(t('common.success'));
                  await load();
                } catch (error) {
                  message.error(getApiErrorMessage(error));
                }
              }}
            >
              {t('app.kuaioa.payroll.reopen')}
            </Button>
          ) : null}
          <Button onClick={() => window.print()}>{t('app.kuaioa.payroll.exportPdf')}</Button>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary">
        {t('app.kuaioa.payroll.detailHint')}
      </Typography.Paragraph>
      {!locked && perms.canUpdate ? (
        <Space wrap style={{ marginBottom: 12 }} className="no-print">
          <Typography.Text>{t('app.kuaioa.payroll.lineTotalOutput')}:</Typography.Text>
          <InputNumber
            min={0}
            changeOnBlur
            value={Number(sheet?.line_total_output || 0) || undefined}
            onChange={(v) => {
              if (v !== null && v !== undefined) void patchHeader('line_total_output', Number(v));
            }}
          />
          <Typography.Text>{t('app.kuaioa.payroll.lineTotalHours')}:</Typography.Text>
          <InputNumber
            min={0}
            changeOnBlur
            value={Number(sheet?.line_total_hours || 0) || undefined}
            onChange={(v) => {
              if (v !== null && v !== undefined) void patchHeader('line_total_hours', Number(v));
            }}
          />
          <Typography.Text>{t('app.kuaioa.payroll.lineTotalWage')}:</Typography.Text>
          <InputNumber
            min={0}
            changeOnBlur
            value={Number(sheet?.line_total_wage || 0) || undefined}
            onChange={(v) => {
              if (v !== null && v !== undefined) void patchHeader('line_total_wage', Number(v));
            }}
          />
        </Space>
      ) : null}
      {sheet?.minimum_wage != null && belowIds.size > 0 ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={t('app.kuaioa.payroll.belowMinimumHint', {
            amount: Number(sheet.minimum_wage).toFixed(2),
          })}
        />
      ) : null}
      <Space size="large" style={{ marginBottom: 12 }}>
        <Typography.Text>
          {t('app.kuaioa.payroll.earningTotal')}: {Number(sheet?.earning_total || 0).toFixed(2)}
        </Typography.Text>
        <Typography.Text>
          {t('app.kuaioa.payroll.deductTotal')}: {Number(sheet?.deduct_total || 0).toFixed(2)}
        </Typography.Text>
        <Typography.Text>
          {t('app.kuaioa.payroll.balanceTotal')}: {Number(sheet?.balance_total || 0).toFixed(2)}
        </Typography.Text>
      </Space>
      <Table<LineRow>
        size="small"
        loading={loading}
        rowKey="id"
        columns={columns}
        dataSource={lines}
        scroll={{ x: 2200 }}
        pagination={false}
        bordered
        rowClassName={(row) => (belowIds.has(Number(row.id)) ? 'uni-table-row-warning' : '')}
      />
      <Modal
        open={importOpen}
        title={t('app.kuaioa.payroll.import')}
        onCancel={() => setImportOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Select
            value={importTarget}
            onChange={setImportTarget}
            options={[
              { label: t('app.kuaioa.payroll.basicWage'), value: 'basic_wage' },
              { label: t('app.kuaioa.payroll.pieceWage'), value: 'piece_wage' },
            ]}
            style={{ width: '100%' }}
          />
          <Typography.Paragraph type="secondary">
            {t('app.kuaioa.payroll.importHint')}
          </Typography.Paragraph>
          <Upload beforeUpload={(file) => void handleImportFile(file)} maxCount={1} accept=".xlsx,.xls">
            <Button>{t('app.kuaioa.payroll.importSelect')}</Button>
          </Upload>
        </Space>
      </Modal>
    </ListPageTemplate>
  );
};

export default PayrollSettlementDetailPage;

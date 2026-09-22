import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { runKuaioaListExport } from '../../../utils/kuaioaListExport';
import { loadOaWorkshopNameOptions } from '../../../utils/oaWorkshopOptions';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  confirmPayrollSettlement,
  createPayrollSettlement,
  deletePayrollSettlement,
  getPayrollSettlement,
  listPayrollSettlements,
  reopenPayrollSettlement,
  updatePayrollSettlement,
} from '../../../services/payroll';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';

const PayrollSettlementsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const perms = useResourcePermissions('kuaioa:payroll');
  const [workshopOptions, setWorkshopOptions] = useState<Array<{ label: string; value: string }>>(
    [],
  );

  useEffect(() => {
    void (async () => {
      setWorkshopOptions(await loadOaWorkshopNameOptions());
    })();
  }, []);

  const statusOptions = useMemo(
    () => [
      { label: t('app.kuaioa.payroll.status.draft'), value: 'draft' },
      { label: t('app.kuaioa.payroll.status.confirmed'), value: 'confirmed' },
    ],
    [t],
  );

  const fields = useMemo(
    () => [
      { name: 'settlement_code', labelKey: 'app.kuaioa.payroll.code', width: 140 },
      {
        name: 'year_month',
        labelKey: 'app.kuaioa.payroll.yearMonth',
        type: 'month' as const,
        required: true,
        width: 100,
      },
      {
        name: 'workshop_name',
        labelKey: 'app.kuaioa.attendance.workshop',
        type: 'select' as const,
        options: workshopOptions,
        required: true,
        width: 140,
      },
      {
        name: 'ot_multiplier',
        labelKey: 'app.kuaioa.payroll.otMultiplier',
        type: 'number' as const,
        width: 100,
      },
      {
        name: 'status',
        labelKey: 'common.status',
        type: 'select' as const,
        options: statusOptions,
        width: 100,
        hideInForm: true,
      },
      { name: 'notes', labelKey: 'common.remark', type: 'textarea' as const, hideInTable: true },
    ],
    [statusOptions, workshopOptions],
  );

  return (
    <KuaioaCrudListPage
      createButtonKey="app.kuaioa.payroll.createButton"
      resource="kuaioa:payroll"
      codeField="settlement_code"
      nameField="workshop_name"
      autoGenerateCode
      statusPresentation="marker"
      detailVariant="master"
      getDetailFn={getPayrollSettlement}
      columnPersistenceId="apps.kuaioa.payroll.list-v1"
      fields={fields}
      listFn={listPayrollSettlements}
      createFn={createPayrollSettlement}
      updateFn={updatePayrollSettlement}
      deleteFn={deletePayrollSettlement}
      showExportButton
      onExport={async (type, keys, pageData) => {
        await runKuaioaListExport({
          type,
          keys,
          pageData,
          listFn: listPayrollSettlements,
          columns: [
            { key: 'settlement_code', title: t('app.kuaioa.payroll.code') },
            { key: 'year_month', title: t('app.kuaioa.payroll.yearMonth') },
            { key: 'workshop_name', title: t('app.kuaioa.attendance.workshop') },
            { key: 'status', title: t('common.status') },
          ],
          filename: t('app.kuaioa.payroll.exportFileName'),
          messageApi,
          noDataText: t('common.exportNoData'),
        });
      }}
      extraActions={[
        {
          key: 'detail',
          labelKey: 'app.kuaioa.payroll.openLines',
          deferSuccess: true,
          onClick: (r) => navigate(`/apps/kuaioa/hr/payroll-settlements/${r.id}`),
        },
        {
          key: 'confirm',
          labelKey: 'app.kuaioa.payroll.confirm',
          visible: (r) => r.status === 'draft' && !!perms.canAction?.('submit'),
          onClick: async (r) => {
            await confirmPayrollSettlement(Number(r.id));
          },
        },
        {
          key: 'reopen',
          labelKey: 'app.kuaioa.payroll.reopen',
          requireUpdate: true,
          visible: (r) => r.status === 'confirmed',
          onClick: async (r) => {
            await reopenPayrollSettlement(Number(r.id));
          },
        },
      ]}
    />
  );
};

export default PayrollSettlementsPage;

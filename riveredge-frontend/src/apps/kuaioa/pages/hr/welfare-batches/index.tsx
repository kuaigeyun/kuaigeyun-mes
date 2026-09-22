import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { runKuaioaListExport } from '../../../utils/kuaioaListExport';
import { loadOaWorkshopNameOptions } from '../../../utils/oaWorkshopOptions';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  confirmWelfareBatch,
  createWelfareBatch,
  deleteWelfareBatch,
  getWelfareBatch,
  listWelfareBatches,
  reopenWelfareBatch,
  updateWelfareBatch,
} from '../../../services/welfare';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';

const WelfareBatchesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const perms = useResourcePermissions('kuaioa:welfare');
  const [workshopOptions, setWorkshopOptions] = useState<Array<{ label: string; value: string }>>(
    [],
  );

  useEffect(() => {
    void (async () => {
      setWorkshopOptions(await loadOaWorkshopNameOptions());
    })();
  }, []);

  const festivalOptions = useMemo(
    () => [
      { label: t('app.kuaioa.welfare.festival.dragon_boat'), value: 'dragon_boat' },
      { label: t('app.kuaioa.welfare.festival.mid_autumn'), value: 'mid_autumn' },
      { label: t('app.kuaioa.welfare.festival.spring_festival'), value: 'spring_festival' },
    ],
    [t],
  );

  const statusOptions = useMemo(
    () => [
      { label: t('app.kuaioa.payroll.status.draft'), value: 'draft' },
      { label: t('app.kuaioa.payroll.status.confirmed'), value: 'confirmed' },
    ],
    [t],
  );

  const fields = useMemo(
    () => [
      { name: 'batch_code', labelKey: 'app.kuaioa.welfare.code', width: 140 },
      {
        name: 'year',
        labelKey: 'app.kuaioa.welfare.year',
        type: 'year' as const,
        required: true,
        width: 90,
      },
      {
        name: 'festival_type',
        labelKey: 'app.kuaioa.welfare.festivalType',
        type: 'select' as const,
        options: festivalOptions,
        required: true,
        width: 120,
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
        name: 'status',
        labelKey: 'common.status',
        type: 'select' as const,
        options: statusOptions,
        width: 100,
        hideInForm: true,
      },
      { name: 'notes', labelKey: 'common.remark', type: 'textarea' as const, hideInTable: true },
    ],
    [festivalOptions, statusOptions, workshopOptions],
  );

  return (
    <KuaioaCrudListPage
      createButtonKey="app.kuaioa.welfare.createButton"
      resource="kuaioa:welfare"
      codeField="batch_code"
      nameField="workshop_name"
      autoGenerateCode
      statusPresentation="marker"
      detailVariant="master"
      getDetailFn={getWelfareBatch}
      columnPersistenceId="apps.kuaioa.welfare.list-v1"
      fields={fields}
      listFn={listWelfareBatches}
      createFn={createWelfareBatch}
      updateFn={updateWelfareBatch}
      deleteFn={deleteWelfareBatch}
      showExportButton
      onExport={async (type, keys, pageData) => {
        await runKuaioaListExport({
          type,
          keys,
          pageData,
          listFn: listWelfareBatches,
          columns: [
            { key: 'batch_code', title: t('app.kuaioa.welfare.code') },
            { key: 'year', title: t('app.kuaioa.welfare.year') },
            { key: 'festival_type', title: t('app.kuaioa.welfare.festivalType') },
            { key: 'workshop_name', title: t('app.kuaioa.attendance.workshop') },
            { key: 'status', title: t('common.status') },
          ],
          filename: t('app.kuaioa.welfare.exportFileName'),
          messageApi,
          noDataText: t('common.exportNoData'),
        });
      }}
      extraActions={[
        {
          key: 'detail',
          labelKey: 'app.kuaioa.welfare.openLines',
          deferSuccess: true,
          onClick: (r) => navigate(`/apps/kuaioa/hr/welfare-batches/${r.id}`),
        },
        {
          key: 'confirm',
          labelKey: 'app.kuaioa.welfare.confirm',
          visible: (r) => r.status === 'draft' && !!perms.canAction?.('submit'),
          onClick: async (r) => {
            await confirmWelfareBatch(Number(r.id));
          },
        },
        {
          key: 'reopen',
          labelKey: 'app.kuaioa.welfare.reopen',
          requireUpdate: true,
          visible: (r) => r.status === 'confirmed',
          onClick: async (r) => {
            await reopenWelfareBatch(Number(r.id));
          },
        },
      ]}
    />
  );
};

export default WelfareBatchesPage;

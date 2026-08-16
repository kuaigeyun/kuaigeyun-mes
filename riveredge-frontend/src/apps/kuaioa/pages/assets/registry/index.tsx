import React, { useMemo, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import AssetAssignModal from '../../../components/AssetAssignModal';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  assignFixedAsset,
  createFixedAsset,
  deleteFixedAsset,
  getFixedAsset,
  listFixedAssets,
  returnFixedAsset,
  scrapFixedAsset,
  updateFixedAsset,
} from '../../../services/assets';
import { buildOaAssetStatusEnum } from '../../../utils/oaFormEnums';

const AssetsRegistryPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const statusEnum = useMemo(() => buildOaAssetStatusEnum(t), [t]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignRecord, setAssignRecord] = useState<Record<string, unknown> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const triggerReload = () => setReloadKey((value) => value + 1);

  return (
    <>
      <KuaioaCrudListPage
        key={reloadKey}
        createButtonKey="app.kuaioa.asset.createButton"
        resource="kuaioa:asset"
        codeField="asset_code"
        nameField="asset_name"
        autoGenerateCode
        statusEnum={statusEnum}
        statusPresentation="marker"
        detailVariant="master"
        getDetailFn={getFixedAsset}
        columnPersistenceId="apps.kuaioa.asset.registry.list-v3"
        fields={[
          { name: 'asset_code', labelKey: 'app.kuaioa.asset.code', width: 140 },
          { name: 'asset_name', labelKey: 'app.kuaioa.asset.name', required: true, width: 200 },
          { name: 'asset_category', labelKey: 'app.kuaioa.asset.category', width: 120 },
          { name: 'custodian_name', labelKey: 'app.kuaioa.asset.custodian', width: 120 },
          { name: 'location', labelKey: 'app.kuaioa.asset.location', width: 140 },
          { name: 'department_name', labelKey: 'app.kuaioa.common.department', hideInTable: true },
          { name: 'purchase_date', labelKey: 'app.kuaioa.asset.purchaseDate', hideInTable: true, type: 'date' },
          { name: 'status', labelKey: 'app.kuaioa.common.status', width: 100 },
          { name: 'notes', labelKey: 'app.kuaioa.common.notes', hideInTable: true, type: 'textarea' },
        ]}
        listFn={listFixedAssets}
        createFn={createFixedAsset}
        updateFn={updateFixedAsset}
        deleteFn={deleteFixedAsset}
        extraActions={[
          {
            key: 'assign',
            labelKey: 'app.kuaioa.asset.assign',
            visible: (r) => r.status === 'in_stock',
            deferSuccess: true,
            onClick: (r) => {
              setAssignRecord(r);
              setAssignOpen(true);
            },
          },
          {
            key: 'return',
            labelKey: 'app.kuaioa.asset.return',
            visible: (r) => r.status === 'in_use',
            onClick: async (r) => {
              await returnFixedAsset(Number(r.id));
            },
          },
          {
            key: 'scrap',
            labelKey: 'app.kuaioa.asset.scrap',
            visible: (r) => r.status !== 'scrapped',
            onClick: async (r) => {
              await scrapFixedAsset(Number(r.id));
            },
          },
        ]}
      />
      <AssetAssignModal
        open={assignOpen}
        assetName={assignRecord ? String(assignRecord.asset_name ?? '') : undefined}
        onCancel={() => {
          setAssignOpen(false);
          setAssignRecord(null);
        }}
        onSubmit={async (custodianId, custodianName) => {
          if (!assignRecord?.id) return;
          await assignFixedAsset(Number(assignRecord.id), {
            custodian_id: custodianId,
            custodian_name: custodianName,
          });
          messageApi.success(t('app.kuaioa.common.operationSuccess'));
          setAssignOpen(false);
          setAssignRecord(null);
          triggerReload();
        }}
      />
    </>
  );
};

export default AssetsRegistryPage;

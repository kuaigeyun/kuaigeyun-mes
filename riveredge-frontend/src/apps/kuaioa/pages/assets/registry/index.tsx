import React from 'react';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  assignFixedAsset,
  createFixedAsset,
  deleteFixedAsset,
  listFixedAssets,
  returnFixedAsset,
  scrapFixedAsset,
  updateFixedAsset,
} from '../../../services/assets';

const ASSET_STATUS = {
  in_stock: { text: '在库', status: 'Default' },
  in_use: { text: '在用', status: 'Processing' },
  scrapped: { text: '已报废', status: 'Error' },
};

const AssetsRegistryPage: React.FC = () => (
  <KuaioaCrudListPage
    createButtonKey="app.kuaioa.asset.createButton"
    resource="kuaioa:asset"
    codeField="asset_code"
    nameField="asset_name"
    autoGenerateCode
    statusEnum={ASSET_STATUS}
    fields={[
      { name: 'asset_code', labelKey: 'app.kuaioa.asset.code', width: 140 },
      { name: 'asset_name', labelKey: 'app.kuaioa.asset.name', required: true, width: 200 },
      { name: 'asset_category', labelKey: 'app.kuaioa.asset.category', width: 120 },
      { name: 'custodian_name', labelKey: 'app.kuaioa.asset.custodian', width: 120 },
      { name: 'status', labelKey: 'app.kuaioa.common.status', width: 100 },
      { name: 'location', labelKey: 'app.kuaioa.asset.location', hideInTable: true },
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
        onClick: async (r) => {
          const custodianName = window.prompt('保管人姓名');
          if (!custodianName) return;
          await assignFixedAsset(Number(r.id), { custodian_id: 0, custodian_name: custodianName });
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
);

export default AssetsRegistryPage;

import React from 'react';
import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';
import {
  createAssetPurchase,
  deleteAssetPurchase,
  listAssetPurchases,
  registerAssetFromPurchase,
  revokeAssetPurchase,
  submitAssetPurchase,
  updateAssetPurchase,
} from '../../../services/assets';

const STATUS_ENUM = {
  draft: { text: '草稿', status: 'Default' },
  pending: { text: '待审批', status: 'Processing' },
  approved: { text: '已通过', status: 'Success' },
  rejected: { text: '已驳回', status: 'Error' },
  cancelled: { text: '已撤销', status: 'Warning' },
};

const AssetPurchasesPage: React.FC = () => (
  <KuaioaCrudListPage
    createButtonKey="app.kuaioa.assetPurchase.createButton"
    resource="kuaioa:asset-purchase"
    codeField="purchase_code"
    nameField="title"
    autoGenerateCode
    statusEnum={STATUS_ENUM}
    fields={[
      { name: 'purchase_code', labelKey: 'app.kuaioa.assetPurchase.code', width: 140 },
      { name: 'title', labelKey: 'app.kuaioa.assetPurchase.title', required: true, width: 200 },
      { name: 'asset_category', labelKey: 'app.kuaioa.asset.category', width: 120 },
      { name: 'estimated_amount', labelKey: 'app.kuaioa.assetPurchase.amount', width: 120 },
      { name: 'applicant_name', labelKey: 'app.kuaioa.common.applicant', width: 100 },
      { name: 'status', labelKey: 'app.kuaioa.common.status', width: 100 },
      { name: 'purpose', labelKey: 'app.kuaioa.common.purpose', hideInTable: true, type: 'textarea' },
    ]}
    listFn={listAssetPurchases}
    createFn={createAssetPurchase}
    updateFn={updateAssetPurchase}
    deleteFn={deleteAssetPurchase}
    extraActions={[
      {
        key: 'submit',
        labelKey: 'app.kuaioa.common.submit',
        visible: (r) => r.status === 'draft' || r.status === 'rejected',
        onClick: async (r) => {
          await submitAssetPurchase(Number(r.id));
        },
      },
      {
        key: 'revoke',
        labelKey: 'app.kuaioa.common.revoke',
        visible: (r) => r.status === 'pending',
        onClick: async (r) => {
          await revokeAssetPurchase(Number(r.id));
        },
      },
      {
        key: 'register',
        labelKey: 'app.kuaioa.asset.register',
        visible: (r) => r.status === 'approved',
        onClick: async (r) => {
          await registerAssetFromPurchase(Number(r.id));
        },
      },
    ]}
  />
);

export default AssetPurchasesPage;

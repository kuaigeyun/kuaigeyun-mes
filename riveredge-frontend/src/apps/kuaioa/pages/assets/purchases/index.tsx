import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';

import {

  createAssetPurchase,

  deleteAssetPurchase,

  getAssetPurchase,

  listAssetPurchases,

  registerAssetFromPurchase,

  updateAssetPurchase,

} from '../../../services/assets';

import { buildOaApprovalStatusEnum } from '../../../utils/oaFormEnums';



const AssetPurchasesPage: React.FC = () => {

  const { t } = useTranslation();

  const statusEnum = useMemo(() => buildOaApprovalStatusEnum(t), [t]);



  return (

    <KuaioaCrudListPage

      createButtonKey="app.kuaioa.assetPurchase.createButton"

      resource="kuaioa:asset-purchase"

      codeField="purchase_code"

      nameField="title"

      autoGenerateCode

      statusEnum={statusEnum}

      statusPresentation="lifecycle"

      detailVariant="approval"

      getDetailFn={getAssetPurchase}

      auditWorkflow={{

        entityType: 'kuaioa_asset_purchase',

        resourcePrefix: 'kuaioa:asset-purchase',

        auditNodeKey: 'kuaioa_asset_purchase',

        entityNameKey: 'app.kuaioa.assetPurchase.entityName',

      }}

      fields={[

        { name: 'purchase_code', labelKey: 'app.kuaioa.assetPurchase.code', width: 140 },

        { name: 'title', labelKey: 'app.kuaioa.assetPurchase.title', required: true, width: 200 },

        { name: 'asset_category', labelKey: 'app.kuaioa.asset.category', width: 120 },

        { name: 'quantity', labelKey: 'app.kuaioa.assetPurchase.quantity', width: 80, type: 'number' },

        { name: 'estimated_amount', labelKey: 'app.kuaioa.assetPurchase.amount', width: 120, type: 'number' },

        { name: 'currency', labelKey: 'app.kuaioa.assetPurchase.currency', width: 80, hideInTable: true },

        { name: 'department_name', labelKey: 'app.kuaioa.common.department', hideInTable: true },

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

};



export default AssetPurchasesPage;


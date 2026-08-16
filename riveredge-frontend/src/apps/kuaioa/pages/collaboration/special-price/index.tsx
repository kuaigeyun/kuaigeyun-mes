import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';

import {

  createSpecialPriceRequest,

  deleteSpecialPriceRequest,

  getSpecialPriceRequest,

  listSpecialPriceRequests,

  updateSpecialPriceRequest,

} from '../../../services/collaboration';

import { buildOaApprovalStatusEnum } from '../../../utils/oaFormEnums';



const SpecialPricePage: React.FC = () => {

  const { t } = useTranslation();

  const statusEnum = useMemo(() => buildOaApprovalStatusEnum(t), [t]);



  return (

    <KuaioaCrudListPage

      createButtonKey="app.kuaioa.specialPrice.createButton"

      resource="kuaioa:special-price"

      codeField="request_code"

      nameField="title"

      autoGenerateCode

      statusEnum={statusEnum}

      statusPresentation="lifecycle"

      detailVariant="approval"

      getDetailFn={getSpecialPriceRequest}

      auditWorkflow={{

        entityType: 'kuaioa_special_price',

        resourcePrefix: 'kuaioa:special-price',

        auditNodeKey: 'kuaioa_special_price',

        entityNameKey: 'app.kuaioa.specialPrice.entityName',

      }}

      fields={[

        { name: 'request_code', labelKey: 'app.kuaioa.specialPrice.code', width: 150 },

        { name: 'title', labelKey: 'app.kuaioa.specialPrice.title', required: true, width: 200 },

        { name: 'customer_name', labelKey: 'app.kuaioa.specialPrice.customer', width: 140 },

        { name: 'material_code', labelKey: 'app.kuaioa.specialPrice.materialCode', width: 120 },

        { name: 'material_name', labelKey: 'app.kuaioa.specialPrice.materialName', width: 160 },

        { name: 'requested_price', labelKey: 'app.kuaioa.specialPrice.requestedPrice', width: 120, type: 'number' },

        { name: 'current_price', labelKey: 'app.kuaioa.specialPrice.currentPrice', width: 120, type: 'number', hideInTable: true },

        { name: 'quantity', labelKey: 'app.kuaioa.specialPrice.quantity', width: 100, type: 'number', hideInTable: true },

        { name: 'valid_until', labelKey: 'app.kuaioa.specialPrice.validUntil', width: 120, type: 'date', hideInTable: true },

        { name: 'applicant_name', labelKey: 'app.kuaioa.common.applicant', width: 100 },

        { name: 'source_doc_no', labelKey: 'app.kuaioa.common.sourceDocNo', hideInTable: true },

        { name: 'reason', labelKey: 'app.kuaioa.specialPrice.reason', hideInTable: true, type: 'textarea' },

        { name: 'status', labelKey: 'app.kuaioa.common.status', width: 100 },

        { name: 'notes', labelKey: 'app.kuaioa.common.notes', hideInTable: true, type: 'textarea' },

      ]}

      listFn={listSpecialPriceRequests}

      createFn={createSpecialPriceRequest}

      updateFn={updateSpecialPriceRequest}

      deleteFn={deleteSpecialPriceRequest}

    />

  );

};



export default SpecialPricePage;


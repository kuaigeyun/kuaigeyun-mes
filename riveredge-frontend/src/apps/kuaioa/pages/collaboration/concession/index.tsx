import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';

import {

  createConcessionRequest,

  deleteConcessionRequest,

  getConcessionRequest,

  listConcessionRequests,

  updateConcessionRequest,

} from '../../../services/collaboration';

import { buildOaApprovalStatusEnum } from '../../../utils/oaFormEnums';



const ConcessionPage: React.FC = () => {

  const { t } = useTranslation();

  const statusEnum = useMemo(() => buildOaApprovalStatusEnum(t), [t]);



  return (

    <KuaioaCrudListPage

      createButtonKey="app.kuaioa.concession.createButton"

      resource="kuaioa:concession"

      codeField="request_code"

      nameField="title"

      autoGenerateCode

      statusEnum={statusEnum}

      statusPresentation="lifecycle"

      detailVariant="approval"

      getDetailFn={getConcessionRequest}

      auditWorkflow={{

        entityType: 'kuaioa_concession',

        resourcePrefix: 'kuaioa:concession',

        auditNodeKey: 'kuaioa_concession',

        entityNameKey: 'app.kuaioa.concession.entityName',

      }}

      fields={[

        { name: 'request_code', labelKey: 'app.kuaioa.concession.code', width: 150 },

        { name: 'title', labelKey: 'app.kuaioa.concession.title', required: true, width: 200 },

        { name: 'material_code', labelKey: 'app.kuaioa.concession.materialCode', width: 120 },

        { name: 'material_name', labelKey: 'app.kuaioa.concession.materialName', width: 160 },

        { name: 'concession_qty', labelKey: 'app.kuaioa.concession.qty', width: 100, type: 'number' },

        { name: 'source_doc_no', labelKey: 'app.kuaioa.common.sourceDocNo', width: 140 },

        { name: 'notify_customer', labelKey: 'app.kuaioa.concession.notifyCustomer', hideInTable: true, type: 'switch' },

        { name: 'defect_description', labelKey: 'app.kuaioa.concession.defect', hideInTable: true, type: 'textarea' },

        { name: 'applicant_name', labelKey: 'app.kuaioa.common.applicant', width: 100 },

        { name: 'status', labelKey: 'common.status', width: 100 },

        { name: 'notes', labelKey: 'common.remark', hideInTable: true, type: 'textarea' },

      ]}

      listFn={listConcessionRequests}

      createFn={createConcessionRequest}

      updateFn={updateConcessionRequest}

      deleteFn={deleteConcessionRequest}

    />

  );

};



export default ConcessionPage;


import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';

import {

  createSealRequest,

  deleteSealRequest,

  getSealRequest,

  listSealRequests,

  updateSealRequest,

} from '../../../services/seal';

import { buildOaApprovalStatusEnum, buildSealTypeOptions } from '../../../utils/oaFormEnums';



const SealPage: React.FC = () => {

  const { t } = useTranslation();

  const statusEnum = useMemo(() => buildOaApprovalStatusEnum(t), [t]);

  const sealTypeOptions = useMemo(() => buildSealTypeOptions(t), [t]);



  return (

    <KuaioaCrudListPage

      createButtonKey="app.kuaioa.seal.createButton"

      resource="kuaioa:seal"

      codeField="request_code"

      nameField="title"

      autoGenerateCode

      statusEnum={statusEnum}

      statusPresentation="lifecycle"

      detailVariant="approval"

      getDetailFn={getSealRequest}

      auditWorkflow={{

        entityType: 'kuaioa_seal',

        resourcePrefix: 'kuaioa:seal',

        auditNodeKey: 'kuaioa_seal',

        entityNameKey: 'app.kuaioa.seal.entityName',

      }}

      fields={[

        { name: 'request_code', labelKey: 'app.kuaioa.seal.code', width: 150 },

        { name: 'title', labelKey: 'app.kuaioa.seal.title', required: true, width: 200 },

        {

          name: 'seal_type',

          labelKey: 'app.kuaioa.seal.type',

          width: 100,

          required: true,

          type: 'select',

          options: sealTypeOptions,

        },

        { name: 'document_name', labelKey: 'app.kuaioa.seal.documentName', required: true, width: 180 },

        { name: 'copies', labelKey: 'app.kuaioa.seal.copies', width: 80, type: 'number' },

        { name: 'take_out', labelKey: 'app.kuaioa.seal.takeOut', width: 80, type: 'switch' },

        { name: 'department_name', labelKey: 'app.kuaioa.common.department', width: 120 },

        { name: 'applicant_name', labelKey: 'app.kuaioa.common.applicant', width: 100 },

        { name: 'source_doc_no', labelKey: 'app.kuaioa.common.sourceDocNo', width: 140, hideInTable: true },

        { name: 'status', labelKey: 'app.kuaioa.common.status', width: 100 },

        { name: 'notes', labelKey: 'app.kuaioa.common.notes', hideInTable: true, type: 'textarea' },

      ]}

      listFn={listSealRequests}

      createFn={createSealRequest}

      updateFn={updateSealRequest}

      deleteFn={deleteSealRequest}

    />

  );

};



export default SealPage;


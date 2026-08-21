import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';

import {

  createProcessDeviationRequest,

  deleteProcessDeviationRequest,

  getProcessDeviationRequest,

  listProcessDeviationRequests,

  updateProcessDeviationRequest,

} from '../../../services/collaboration';

import { buildOaApprovalStatusEnum } from '../../../utils/oaFormEnums';



const ProcessDeviationPage: React.FC = () => {

  const { t } = useTranslation();

  const statusEnum = useMemo(() => buildOaApprovalStatusEnum(t), [t]);



  return (

    <KuaioaCrudListPage

      createButtonKey="app.kuaioa.processDeviation.createButton"

      resource="kuaioa:process-deviation"

      codeField="request_code"

      nameField="title"

      autoGenerateCode

      statusEnum={statusEnum}

      statusPresentation="lifecycle"

      detailVariant="approval"

      getDetailFn={getProcessDeviationRequest}

      auditWorkflow={{

        entityType: 'kuaioa_process_deviation',

        resourcePrefix: 'kuaioa:process-deviation',

        auditNodeKey: 'kuaioa_process_deviation',

        entityNameKey: 'app.kuaioa.processDeviation.entityName',

      }}

      fields={[

        { name: 'request_code', labelKey: 'app.kuaioa.processDeviation.code', width: 150 },

        { name: 'title', labelKey: 'app.kuaioa.processDeviation.title', required: true, width: 200 },

        { name: 'operation_name', labelKey: 'app.kuaioa.processDeviation.operation', width: 140 },

        { name: 'source_doc_no', labelKey: 'app.kuaioa.common.sourceDocNo', width: 140 },

        { name: 'start_at', labelKey: 'app.kuaioa.processDeviation.startAt', width: 160, type: 'datetime' },

        { name: 'end_at', labelKey: 'app.kuaioa.processDeviation.endAt', width: 160, type: 'datetime' },

        { name: 'temporary_measure', labelKey: 'app.kuaioa.processDeviation.temporaryMeasure', hideInTable: true, type: 'textarea' },

        { name: 'deviation_description', labelKey: 'app.kuaioa.processDeviation.description', hideInTable: true, type: 'textarea' },

        { name: 'risk_assessment', labelKey: 'app.kuaioa.processDeviation.risk', hideInTable: true, type: 'textarea' },

        { name: 'applicant_name', labelKey: 'app.kuaioa.common.applicant', width: 100 },

        { name: 'status', labelKey: 'common.status', width: 100 },

        { name: 'notes', labelKey: 'common.remark', hideInTable: true, type: 'textarea' },

      ]}

      listFn={listProcessDeviationRequests}

      createFn={createProcessDeviationRequest}

      updateFn={updateProcessDeviationRequest}

      deleteFn={deleteProcessDeviationRequest}

    />

  );

};



export default ProcessDeviationPage;


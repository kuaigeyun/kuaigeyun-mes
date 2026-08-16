import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import KuaioaCrudListPage from '../../../components/KuaioaCrudListPage';

import {

  createLeaveRequest,

  deleteLeaveRequest,

  getLeaveRequest,

  listLeaveRequests,

  updateLeaveRequest,

} from '../../../services/leave';

import { buildLeaveTypeOptions, buildOaApprovalStatusEnum } from '../../../utils/oaFormEnums';

import { computeInclusiveCalendarDays } from '../../../utils/oaFormDateUtils';



const LeavePage: React.FC = () => {

  const { t } = useTranslation();

  const statusEnum = useMemo(() => buildOaApprovalStatusEnum(t), [t]);

  const leaveTypeOptions = useMemo(() => buildLeaveTypeOptions(t), [t]);



  return (

    <KuaioaCrudListPage

      createButtonKey="app.kuaioa.leave.createButton"

      resource="kuaioa:leave"

      codeField="request_code"

      nameField="title"

      autoGenerateCode

      statusEnum={statusEnum}

      statusPresentation="lifecycle"

      detailVariant="approval"

      getDetailFn={getLeaveRequest}

      auditWorkflow={{

        entityType: 'kuaioa_leave',

        resourcePrefix: 'kuaioa:leave',

        auditNodeKey: 'kuaioa_leave',

        entityNameKey: 'app.kuaioa.leave.entityName',

      }}

      onFormValuesChange={(changed, allValues, form) => {

        if (!('start_at' in changed) && !('end_at' in changed)) return;

        const days = computeInclusiveCalendarDays(allValues.start_at, allValues.end_at);

        if (days != null && days > 0) {

          form.setFieldValue('days', days);

        }

      }}

      fields={[

        { name: 'request_code', labelKey: 'app.kuaioa.leave.code', width: 150 },

        {

          name: 'leave_type',

          labelKey: 'app.kuaioa.leave.type',

          width: 100,

          required: true,

          type: 'select',

          options: leaveTypeOptions,

        },

        { name: 'title', labelKey: 'app.kuaioa.leave.title', required: true, width: 200 },

        { name: 'start_at', labelKey: 'app.kuaioa.leave.startAt', type: 'datetime', width: 160, required: true },

        { name: 'end_at', labelKey: 'app.kuaioa.leave.endAt', type: 'datetime', width: 160, required: true },

        { name: 'days', labelKey: 'app.kuaioa.leave.days', width: 80, type: 'number' },

        { name: 'applicant_name', labelKey: 'app.kuaioa.common.applicant', width: 100 },

        { name: 'department_name', labelKey: 'app.kuaioa.common.department', hideInTable: true },

        { name: 'destination', labelKey: 'app.kuaioa.leave.destination', hideInTable: true },

        { name: 'reason', labelKey: 'app.kuaioa.leave.reason', hideInTable: true, type: 'textarea' },

        { name: 'status', labelKey: 'app.kuaioa.common.status', width: 100 },

        { name: 'notes', labelKey: 'app.kuaioa.common.notes', hideInTable: true, type: 'textarea' },

      ]}

      listFn={listLeaveRequests}

      createFn={createLeaveRequest}

      updateFn={updateLeaveRequest}

      deleteFn={deleteLeaveRequest}

    />

  );

};



export default LeavePage;


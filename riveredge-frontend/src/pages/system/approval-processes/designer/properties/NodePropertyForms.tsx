import React from 'react';
import {
  ProFormSelect,
  ProFormSwitch,
  ProFormDependency,
  ProFormDigit,
  ProFormList,
  ProFormText,
} from '@ant-design/pro-components';
import { theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { searchUserDisplay } from '../../../../../services/user';
import { formatUserDisplayLabel } from '../../../../../utils/userDisplay';
import { getRoleList } from '../../../../../services/role';
import type { ConditionItem } from '../../../../../types/approvalFlowSchema';

const APPROVER_OPTIONS = (t: (k: string) => string) => [
  { label: t('pages.approval.designer.approverTypeUser'), value: 'user' },
  { label: t('pages.approval.designer.approverTypeRole'), value: 'role' },
  { label: t('pages.approval.designer.approverTypeDept'), value: 'department' },
  { label: t('pages.approval.designer.approverTypeManager'), value: 'manager' },
];

interface ApprovalNodeFormProps {
  conditionFieldOptions?: { label: string; value: string }[];
}

export const ApprovalNodeForm: React.FC<ApprovalNodeFormProps> = () => {
  const { t } = useTranslation();
  return (
    <>
      <ProFormSelect
        name="approvalType"
        label={t('pages.approval.designer.approvalType')}
        options={[
          { label: t('pages.approval.designer.approvalTypeAnd'), value: 'AND' },
          { label: t('pages.approval.designer.approvalTypeOr'), value: 'OR' },
        ]}
        initialValue="OR"
      />
      <ProFormSelect
        name="approverType"
        label={t('pages.approval.designer.approverType')}
        options={APPROVER_OPTIONS(t)}
        initialValue="user"
      />
      <ProFormDependency name={['approverType']}>
        {({ approverType }) => {
          if (approverType === 'user') {
            return (
              <ProFormSelect
                name="approvers"
                label={t('pages.approval.designer.selectUser')}
                request={async () => {
                  const res = await searchUserDisplay({ page: 1, page_size: 200, is_active: true });
                  return (res.items || []).map((u) => ({
                    label: formatUserDisplayLabel(u),
                    value: u.uuid,
                  }));
                }}
                mode="multiple"
              />
            );
          }
          if (approverType === 'role') {
            return (
              <ProFormSelect
                name="roles"
                label={t('pages.approval.designer.selectRole')}
                request={async () => (await getRoleList({})).items.map((r) => ({ label: r.name, value: r.uuid }))}
                mode="multiple"
              />
            );
          }
          return null;
        }}
      </ProFormDependency>
      <ProFormSwitch name="allowEditDuringApproval" label={t('pages.approval.designer.allowEditDuringApproval')} />
      <ProFormDependency name={['allowEditDuringApproval']}>
        {({ allowEditDuringApproval }) =>
          allowEditDuringApproval ? (
            <ProFormSwitch
              name="refreshContextOnEdit"
              label={t('pages.approval.designer.refreshContextOnEdit')}
              initialValue
            />
          ) : null
        }
      </ProFormDependency>
      <ProFormSwitch name="allowTransfer" label={t('pages.approval.designer.allowTransfer')} />
      <ProFormSwitch name="allowAddSign" label={t('pages.approval.designer.allowAddSign')} />
      <ProFormDigit
        name="timeoutHours"
        label={t('pages.approval.designer.timeoutHours')}
        min={0}
        fieldProps={{ precision: 0, style: { width: '100%' } }}
        tooltip={t('pages.approval.designer.timeoutHoursTip')}
      />
    </>
  );
};

export const CcNodeForm: React.FC = () => {
  const { t } = useTranslation();
  return (
    <>
      <ProFormSelect
        name="approverType"
        label={t('pages.approval.designer.ccTargetType')}
        options={[
          { label: t('pages.approval.designer.approverTypeUser'), value: 'user' },
          { label: t('pages.approval.designer.approverTypeRole'), value: 'role' },
        ]}
        initialValue="user"
      />
      <ProFormDependency name={['approverType']}>
        {({ approverType }) => {
          if (approverType === 'user') {
            return (
              <ProFormSelect
                name="approvers"
                label={t('pages.approval.designer.selectUser')}
                request={async () => {
                  const res = await searchUserDisplay({ page: 1, page_size: 200, is_active: true });
                  return (res.items || []).map((u) => ({
                    label: formatUserDisplayLabel(u),
                    value: u.uuid,
                  }));
                }}
                mode="multiple"
              />
            );
          }
          return (
            <ProFormSelect
              name="roles"
              label={t('pages.approval.designer.selectRole')}
              request={async () => (await getRoleList({})).items.map((r) => ({ label: r.name, value: r.uuid }))}
              mode="multiple"
            />
          );
        }}
      </ProFormDependency>
    </>
  );
};

interface ConditionNodeFormProps {
  branchCount: number;
  fieldOptions: { label: string; value: string }[];
}

export const ConditionNodeForm: React.FC<ConditionNodeFormProps> = ({ branchCount, fieldOptions }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const opOptions = [
    { label: t('pages.approval.designer.opEqual'), value: '==' },
    { label: t('pages.approval.designer.opNotEqual'), value: '!=' },
    { label: t('pages.approval.designer.opGreater'), value: '>=' },
    { label: t('pages.approval.designer.opLess'), value: '<' },
    { label: t('pages.approval.designer.opContains'), value: 'contains' },
  ];
  return (
    <>
      <style>{`
        .approval-condition-rule-card .ant-form-item {
          margin-bottom: 12px;
        }
        .approval-condition-rule-card .ant-form-item:last-child {
          margin-bottom: 0;
        }
        .approval-condition-rule-card .ant-pro-form-list-action {
          margin: 0;
        }
      `}</style>
      <ProFormList
        name="conditions"
        label={t('pages.approval.designer.conditions')}
        creatorButtonProps={{ creatorButtonText: t('pages.approval.designer.addConditionRule') }}
        copyIconProps={false}
        min={branchCount > 1 ? branchCount : 0}
        max={Math.max(branchCount, 1)}
        initialValue={Array.from({ length: Math.max(branchCount, 1) }, (_, i) => ({
          label: t('pages.approval.designer.branchLabel', { index: i + 1 }),
          operator: '>=',
        }))}
        itemRender={({ listDom, action }, { index }) => (
          <div
            className="approval-condition-rule-card"
            key={index}
            style={{
              position: 'relative',
              padding: token.paddingSM,
              marginBottom: token.marginSM,
              backgroundColor: token.colorFillQuaternary,
              borderRadius: token.borderRadiusLG,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            {action ? (
              <div style={{ position: 'absolute', top: token.paddingXS, right: token.paddingXS, zIndex: 1 }}>
                {action}
              </div>
            ) : null}
            <div style={{ paddingRight: action ? 28 : 0 }}>{listDom}</div>
          </div>
        )}
      >
        {() => (
          <>
            <ProFormText name="label" label={t('pages.approval.designer.branchName')} />
            <ProFormSelect name="field" label={t('pages.approval.designer.field')} options={fieldOptions} />
            <ProFormSelect name="operator" label={t('pages.approval.designer.operator')} options={opOptions} />
            <ProFormDigit
              name="value"
              label={t('pages.approval.designer.value')}
              fieldProps={{ style: { width: '100%' } }}
            />
          </>
        )}
      </ProFormList>
    </>
  );
};

export function mergeFormToNodeData(
  nodeType: string,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const v = { ...values };
  if (nodeType === 'approval' || nodeType === 'cc') {
    const approverType = v.approverType as string;
    if (approverType === 'user' && v.approvers) v.approverIds = v.approvers;
    if (approverType === 'role' && v.roles) v.approverIds = v.roles;
    delete v.approvers;
    delete v.roles;
  }
  return v;
}

export type { ConditionItem };

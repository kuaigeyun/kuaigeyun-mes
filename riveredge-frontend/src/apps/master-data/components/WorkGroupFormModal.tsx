/**
 * 工作小组新建/编辑弹窗
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProFormInstance, ProFormList, ProFormSelect, ProFormDigit, ProFormGroup } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { workGroupApi } from '../services/factory';
import { getUserList } from '../../../services/user';
import { testGenerateCode, generateCode, getCodeRulePageConfig } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { WorkGroup, WorkGroupCreate, WorkGroupUpdate, WorkGroupMemberItem } from '../types/factory';
import { SchemaFormRenderer } from '../../../components/schema-form';
import { workGroupFormSchemaBasic, workGroupFormSchemaRest } from '../schemas/workGroup';

const PAGE_CODE = 'master-data-factory-work-group';

export interface WorkGroupFormModalProps {
  open: boolean;
  onClose: () => void;
  editUuid: string | null;
  onSuccess: (workGroup: WorkGroup) => void;
}

export const WorkGroupFormModal: React.FC<WorkGroupFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [employees, setEmployees] = useState<{ id: number; full_name: string }[]>([]);

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    getUserList({ page: 1, page_size: 1000, is_active: true })
      .then((r) => {
        setEmployees(
          r.items.map((e: { id: number; full_name?: string; username?: string }) => ({
            id: e.id,
            full_name: e.full_name || e.username || '',
          })),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ isActive: true, members: [] });
    if (!editUuid) {
      (async () => {
        let ruleCode = getPageRuleCode(PAGE_CODE);
        let autoGenerate = isAutoGenerateEnabled(PAGE_CODE);
        try {
          const pageConfig = await getCodeRulePageConfig(PAGE_CODE);
          if (pageConfig?.ruleCode) {
            ruleCode = pageConfig.ruleCode;
            autoGenerate = !!pageConfig.autoGenerate;
          }
        } catch {}
        if (autoGenerate && ruleCode) {
          setEffectiveRuleCode(ruleCode);
          testGenerateCode({ rule_code: ruleCode })
            .then((res) => {
              setPreviewCode(res.code);
              formRef.current?.setFieldsValue({ code: res.code, isActive: true, members: [] });
            })
            .catch(() => {
              setPreviewCode(null);
              formRef.current?.setFieldsValue({ isActive: true, members: [] });
            });
        } else {
          setPreviewCode(null);
          setEffectiveRuleCode(null);
          formRef.current?.setFieldsValue({ isActive: true, members: [] });
        }
      })();
      return;
    }
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    workGroupApi
      .get(editUuid)
      .then((detail) => {
        const members = (detail.members ?? []).map((m: any) => ({
          employeeId: m.employeeId ?? m.employee_id,
          employeeName: m.employeeName ?? m.employee_name,
          performanceWeight: m.performanceWeight ?? m.performance_weight ?? 1,
          sortOrder: m.sortOrder ?? m.sort_order ?? 0,
        }));
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          description: detail.description,
          members,
          isActive: detail.isActive ?? true,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || t('app.master-data.workGroups.getDetailFailed'));
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      const members: WorkGroupMemberItem[] = (values.members ?? []).map((m: any, i: number) => ({
        employeeId: m.employeeId ?? m.employee_id,
        employeeName: employees.find((e) => e.id === (m.employeeId ?? m.employee_id))?.full_name,
        performanceWeight: Number(m.performanceWeight ?? m.performance_weight ?? 1),
        sortOrder: i,
      })).filter((m: WorkGroupMemberItem) => m.employeeId);

      const payload = {
        code: values.code,
        name: values.name,
        description: values.description,
        isActive: values.isActive ?? true,
        members,
      };

      if (isEdit && editUuid) {
        await workGroupApi.update(editUuid, payload as WorkGroupUpdate);
        messageApi.success(t('common.updateSuccess'));
        const updated = await workGroupApi.get(editUuid);
        onSuccess(updated);
      } else {
        const ruleCodeToUse = effectiveRuleCode || getPageRuleCode(PAGE_CODE);
        if (
          ruleCodeToUse &&
          (isAutoGenerateEnabled(PAGE_CODE) || effectiveRuleCode) &&
          (values.code === previewCode || !values.code)
        ) {
          try {
            const codeResponse = await generateCode({ rule_code: ruleCodeToUse });
            payload.code = codeResponse.code;
          } catch {
            // keep form code
          }
        }
        const created = await workGroupApi.create(payload as WorkGroupCreate);
        messageApi.success(t('common.createSuccess'));
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
      setPreviewCode(null);
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
    } finally {
      setFormLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    formRef.current?.resetFields();
    setPreviewCode(null);
  };

  return (
    <FormModalTemplate
      title={isEdit ? t('field.workGroup.editTitle') : t('field.workGroup.createTitle')}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      formRef={formRef as React.RefObject<ProFormInstance>}
      initialValues={{ isActive: true, members: [] }}
      layout="vertical"
      grid
    >
      <SchemaFormRenderer
        schema={workGroupFormSchemaBasic}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.workGroup.codeAutoGenerated"
        isEdit={isEdit}
      />
      <div
        style={{
          width: '100%',
          gridColumn: '1 / -1',
          marginBottom: 24,
          marginLeft: 8,
          marginRight: 8,
          padding: '16px',
          background: 'rgba(0, 0, 0, 0.02)',
          borderRadius: 6,
          border: '1px solid rgba(0, 0, 0, 0.06)',
        }}
      >
        <ProFormList
          name="members"
          label={t('field.workGroup.members')}
          creatorButtonProps={{ creatorButtonText: t('field.workGroup.addMember') }}
          copyIconProps={false}
          deleteIconProps={{ tooltipText: t('common.delete') }}
          itemRender={({ listDom, action }) => (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>{listDom}</div>
              {action}
            </div>
          )}
        >
          <ProFormGroup grid colProps={{ span: 24 }}>
            <ProFormSelect
              name="employeeId"
              label={t('field.workGroup.memberEmployee')}
              placeholder={t('field.workGroup.memberEmployeePlaceholder')}
              options={employees.map((e) => ({ label: e.full_name, value: e.id }))}
              rules={[{ required: true, message: t('field.workGroup.memberEmployeeRequired') }]}
              colProps={{ span: 12 }}
            />
            <ProFormDigit
              name="performanceWeight"
              label={t('field.workGroup.performanceWeight')}
              placeholder={t('field.workGroup.performanceWeightPlaceholder')}
              min={0}
              max={10}
              step={0.1}
              fieldProps={{ precision: 2 }}
              initialValue={1}
              colProps={{ span: 12 }}
            />
          </ProFormGroup>
        </ProFormList>
      </div>
      <SchemaFormRenderer
        schema={workGroupFormSchemaRest}
        codeField="code"
        codeAutoGenerated={isAutoGenerateEnabled(PAGE_CODE)}
        codeAutoGeneratedKey="field.workGroup.codeAutoGenerated"
        isEdit={isEdit}
      />
    </FormModalTemplate>
  );
};

/**
 * 从工单创建返工单（工单页 / 返工单页共用）
 *
 * 字段须作为 FormModalTemplate 的直接子节点参与 grid；不可外包 Fragment 或单层包装组件。
 * 全宽工序表对齐方式同 master-data RouteFormModal（operation-sequence-form-item）。
 */
import React, { useMemo } from 'react';
import { Form, theme } from 'antd';
import {
  ProForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormGroup,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { FormModalTemplate } from '../../../components/layout-templates';
import { FORM_LAYOUT, MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { formDateFormItemProps } from '../../../utils/formDate';
import { buildFutureDateShortcutFieldProps } from '../../../utils/futureDatePickerShortcuts';
import ReworkPredefinedRouteEditor, { type ReworkRouteOperationRow } from './ReworkPredefinedRouteEditor';

export type ReworkTypeOption = { label: string; value: string };

export type ReworkOrderCreateModalProps = {
  open: boolean;
  title: string;
  loading?: boolean;
  initialValues?: Record<string, unknown>;
  workOrderCode?: string;
  productName?: string;
  reworkableQuantity?: number;
  operations: ReworkRouteOperationRow[];
  reworkTypeOptions?: ReworkTypeOption[];
  reworkTypeLoading?: boolean;
  formatOperationOption?: (op: ReworkRouteOperationRow) => { label: string; value: number };
  onClose: () => void;
  onFinish: (values: Record<string, unknown>) => Promise<void>;
  /** 动态路线起始工序变化时刷新可返工数量（由父组件调 preview API） */
  onStartOperationChange?: (startWorkOrderOperationId?: number) => void;
};

const defaultReworkTypeOptions = (t: TFunction): ReworkTypeOption[] => [
  { label: t('app.kuaizhizao.reworkOrder.typeRework'), value: '返工' },
  { label: t('app.kuaizhizao.reworkOrder.typeRepair'), value: '返修' },
  { label: t('app.kuaizhizao.reworkOrder.typeScrap'), value: '报废' },
];

const defaultFormatOperationOption = (op: ReworkRouteOperationRow) => ({
  label: `${op.operation_code || ''} ${op.operation_name || ''}`.trim() || String(op.id),
  value: op.id,
});

const ReworkOrderCreateModal: React.FC<ReworkOrderCreateModalProps> = ({
  open,
  title,
  loading,
  initialValues,
  workOrderCode,
  productName,
  reworkableQuantity = 0,
  operations,
  reworkTypeOptions,
  reworkTypeLoading,
  formatOperationOption = defaultFormatOperationOption,
  onClose,
  onFinish,
  onStartOperationChange,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const routingMode = Form.useWatch('routing_mode', form);
  const startOperationId = Form.useWatch('start_work_order_operation_id', form);
  const typeOptions = reworkTypeOptions ?? defaultReworkTypeOptions(t);

  React.useEffect(() => {
    if (!open || routingMode !== 'DYNAMIC') return;
    onStartOperationChange?.(
      startOperationId != null && startOperationId !== ''
        ? Number(startOperationId)
        : undefined,
    );
  }, [open, routingMode, startOperationId, onStartOperationChange]);

  const operationSelectOptions = useMemo(
    () => operations.map((op) => formatOperationOption(op)),
    [formatOperationOption, operations],
  );

  const mergedInitialValues = useMemo(() => initialValues, [initialValues]);

  return (
    <FormModalTemplate
      title={title}
      open={open}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      grid
      loading={loading}
      form={form}
      initialValues={mergedInitialValues}
      onClose={onClose}
      onFinish={onFinish}
      className="rework-order-create-modal"
    >
      <style>{`
        .rework-order-create-modal .rework-route-operation-form-item .ant-form-item-control-input {
          padding-left: 8px;
          padding-right: 8px;
          width: 100%;
          min-width: 0;
        }
        .rework-order-create-modal .rework-route-operation-form-item .ant-form-item-control-input-content {
          width: 100%;
          min-width: 0;
        }
        .rework-order-create-modal .rework-route-operation-form-item .ant-form-item-label {
          padding-left: 8px;
        }
        .rework-order-create-modal .rework-order-summary-group.ant-pro-form-group {
          width: 100%;
          max-width: 100%;
        }
        .rework-order-create-modal .rework-order-summary-panel__grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          column-gap: 16px;
          width: 100%;
        }
        .rework-order-create-modal .rework-order-summary-panel__label {
          font-weight: 600;
          margin-bottom: 4px;
        }
        .rework-order-create-modal .rework-order-summary-panel__value {
          word-break: break-word;
        }
      `}</style>
      <ProFormGroup
        colProps={{
          span: 24,
          style: { marginBottom: FORM_LAYOUT.ITEM_MARGIN_BOTTOM },
        }}
        className="rework-order-summary-group"
        style={{
          background: token.colorFillAlter,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          padding: '12px 12px',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div className="rework-order-summary-panel__grid">
          <div className="rework-order-summary-panel__cell">
            <div className="rework-order-summary-panel__label">
              {t('app.kuaizhizao.reworkOrder.colOriginalWorkOrderId')}
            </div>
            <div className="rework-order-summary-panel__value">{workOrderCode || '-'}</div>
          </div>
          <div className="rework-order-summary-panel__cell">
            <div className="rework-order-summary-panel__label">
              {t('app.kuaizhizao.reworkOrder.colProductName')}
            </div>
            <div className="rework-order-summary-panel__value">{productName || '-'}</div>
          </div>
          <div className="rework-order-summary-panel__cell">
            <div className="rework-order-summary-panel__label">
              {t('app.kuaizhizao.reworkOrder.formReworkableQuantity')}
            </div>
            <div className="rework-order-summary-panel__value">{reworkableQuantity}</div>
          </div>
        </div>
      </ProFormGroup>
      <ProFormSelect
        name="rework_type"
        label={t('app.kuaizhizao.reworkOrder.colReworkType')}
        placeholder={t('app.kuaizhizao.reworkOrder.formReworkTypePlaceholder')}
        rules={[{ required: true, message: t('app.kuaizhizao.reworkOrder.formReworkTypeRequired') }]}
        options={typeOptions}
        fieldProps={{ loading: reworkTypeLoading }}
        colProps={{ span: 12 }}
      />
      <ProFormDigit
        name="quantity"
        label={t('app.kuaizhizao.reworkOrder.colQuantity')}
        placeholder={t('app.kuaizhizao.reworkOrder.formQuantityRequired')}
        rules={[
          { required: true, message: t('app.kuaizhizao.reworkOrder.formQuantityRequired') },
          {
            validator: async (_, value) => {
              const qty = Number(value);
              if (!Number.isFinite(qty) || qty <= 0) {
                throw new Error(t('app.kuaizhizao.reworkOrder.formQuantityRequired'));
              }
              if (reworkableQuantity > 0 && qty > reworkableQuantity) {
                throw new Error(
                  t('app.kuaizhizao.reworkOrder.formQuantityExceedsReworkable', {
                    quantity: reworkableQuantity,
                  }),
                );
              }
            },
          },
        ]}
        min={0.01}
        max={reworkableQuantity > 0 ? reworkableQuantity : undefined}
        fieldProps={{ precision: 2 }}
        colProps={{ span: 12 }}
      />
      <ProFormSelect
        name="routing_mode"
        label={t('app.kuaizhizao.reworkOrder.routingMode')}
        rules={[{ required: true, message: t('app.kuaizhizao.reworkOrder.routingMode') }]}
        options={[
          { label: t('app.kuaizhizao.reworkOrder.routingModeDynamic'), value: 'DYNAMIC' },
          { label: t('app.kuaizhizao.reworkOrder.routingModePredefined'), value: 'PREDEFINED' },
        ]}
        colProps={{ span: 12 }}
      />
      <ProFormSelect
        name="verification_required"
        label={t('app.kuaizhizao.reworkOrder.verificationRequired')}
        options={[
          { label: t('app.kuaizhizao.reworkOrder.verificationRequiredNo'), value: false },
          { label: t('app.kuaizhizao.reworkOrder.verificationRequiredYes'), value: true },
        ]}
        colProps={{ span: 12 }}
      />
      {routingMode === 'PREDEFINED' ? (
        <ProForm.Item
          name="predefined_operation_ids"
          label={t('app.kuaizhizao.reworkOrder.predefinedOperations')}
          colProps={{ span: 24 }}
          style={{ width: '100%', minWidth: 0 }}
          className="rework-route-operation-form-item"
          rules={[
            {
              validator: async (_, ids: number[] | undefined) => {
                if (!ids || ids.length < 1) {
                  throw new Error(t('app.kuaizhizao.reworkOrder.predefinedRouteRequired'));
                }
              },
            },
          ]}
        >
          <div style={{ width: '100%', minWidth: 0 }}>
            <ReworkPredefinedRouteEditor operations={operations} />
          </div>
        </ProForm.Item>
      ) : (
        <ProFormSelect
          name="start_work_order_operation_id"
          label={t('app.kuaizhizao.reworkOrder.formStartOperation')}
          placeholder={t('app.kuaizhizao.reworkOrder.formStartOperationPlaceholder')}
          allowClear
          colProps={{ span: 24 }}
          options={operationSelectOptions}
          fieldProps={{
            showSearch: true,
            optionFilterProp: 'label',
          }}
        />
      )}
      <ProFormTextArea
        name="rework_reason"
        label={t('app.kuaizhizao.reworkOrder.formReworkReason')}
        placeholder={t('app.kuaizhizao.reworkOrder.formReworkReasonRequired')}
        rules={[{ required: true, message: t('app.kuaizhizao.reworkOrder.formReworkReasonRequired') }]}
        fieldProps={{ rows: 2 }}
        colProps={{ span: 24 }}
      />
      <ProFormDatePicker
        name="planned_start_date"
        label={t('app.kuaizhizao.reworkOrder.formPlannedStart')}
        placeholder={t('app.kuaizhizao.reworkOrder.formPlannedStartPlaceholder')}
        {...formDateFormItemProps}
        fieldProps={{ showTime: true, style: { width: '100%' } }}
        colProps={{ span: 12 }}
      />
      <ProFormDatePicker
        name="planned_end_date"
        label={t('app.kuaizhizao.reworkOrder.formPlannedEnd')}
        placeholder={t('app.kuaizhizao.reworkOrder.formPlannedEndPlaceholder')}
        {...formDateFormItemProps}
        fieldProps={buildFutureDateShortcutFieldProps({
          getForm: () => form,
          fieldName: 'planned_end_date',
          baseFieldName: 'planned_start_date',
          t,
          fieldProps: { showTime: true, style: { width: '100%' } },
        })}
        colProps={{ span: 12 }}
      />
      <ProFormTextArea
        name="remarks"
        label={t('app.kuaizhizao.reworkOrder.formRemarks')}
        placeholder={t('app.kuaizhizao.reworkOrder.formRemarksPlaceholder')}
        fieldProps={{ rows: 2 }}
        colProps={{ span: 24 }}
      />
    </FormModalTemplate>
  );
};

export default ReworkOrderCreateModal;

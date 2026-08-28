/**
 * 销售订单：收款计划 / 合同条款（分模块；条款目录与框架合同共用）
 * 预收整合进收款计划：预收节点金额/银行账户回写订单预收字段，审单自动收款逻辑不断。
 */
import React from 'react';
import type { ProFormInstance } from '@ant-design/pro-components';
import {
  ProFormSelect,
  ProFormText,
  ProFormDatePicker,
  ProFormDigit,
} from '@ant-design/pro-components';
import { App, Button, Col, Dropdown, Form as AntForm, Row, Table, Card, Typography, Input, Space, Select } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { TFunction } from 'i18next';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import { DOCUMENT_SUBLINE_TABLE_PROPS, DOCUMENT_SUBLINE_ADD_BUTTON_CLASS } from '../../../../../components/document-subline-table';
import { ContractTermPreviewContent } from '../sales-contracts/ContractTermPreviewContent';
import type { SalesContractTermSnapshot } from '../../../services/sales-contract-term';

export type SalesOrderPaymentMilestonesFieldsProps = {
  formRef: React.RefObject<ProFormInstance | undefined>;
  t: TFunction;
  amountDecimals: number;
  baseDateField?: string;
  bankAccountOptions?: Array<{ label: string; value: number }>;
};

/** 收款计划（里程碑）：无数据时仅显示添加；预收节点带银行账户 */
export function SalesOrderPaymentMilestonesFields({
  formRef,
  t,
  amountDecimals,
  baseDateField = 'order_date',
  bankAccountOptions = [],
}: SalesOrderPaymentMilestonesFieldsProps) {
  const { message } = App.useApp();
  const form = AntForm.useFormInstance();
  const milestoneRows = (AntForm.useWatch('payment_milestones', form) as Array<{
    is_prepayment?: boolean;
  }> | undefined) ?? [];
  const hasPrepayment = milestoneRows.some((row) => Boolean(row?.is_prepayment));

  return (
    <AntForm.List name="payment_milestones">
      {(fields, { add, remove }) => {
        const addPlan = () => add({ billing_trigger: 'milestone', is_prepayment: false });
        const addPrepayment = () => {
          if (hasPrepayment) {
            message.warning(t('app.kuaizhizao.salesOrder.prepaymentOnlyOne'));
            return;
          }
          add({
            milestone_name: t('app.kuaizhizao.salesOrder.prepaymentNameDefault'),
            billing_trigger: 'milestone',
            is_prepayment: true,
          });
        };

        const columns = [
          {
            title: t('app.kuaizhizao.salesOrder.milestoneType'),
            width: 120,
            render: (_: unknown, __: unknown, index: number) => (
              <AntForm.Item
                name={[index, 'is_prepayment']}
                style={{ margin: 0 }}
                getValueProps={(v) => ({ value: v ? 1 : 0 })}
                getValueFromEvent={(v) => Boolean(v)}
              >
                <Select
                  allowClear={false}
                  style={{ width: '100%' }}
                  options={[
                    { label: t('app.kuaizhizao.salesOrder.milestoneTypePlan'), value: 0 },
                    { label: t('app.kuaizhizao.salesOrder.milestoneTypePrepayment'), value: 1 },
                  ]}
                  onChange={(val: number) => {
                    const asPrepay = Boolean(val);
                    if (asPrepay) {
                      const rows =
                        (form.getFieldValue('payment_milestones') as Array<{
                          is_prepayment?: boolean;
                        }>) ?? [];
                      const otherPrepay = rows.some(
                        (row, i) => i !== index && Boolean(row?.is_prepayment),
                      );
                      if (otherPrepay) {
                        message.warning(t('app.kuaizhizao.salesOrder.prepaymentOnlyOne'));
                        // getValueFromEvent already set true; revert next tick
                        queueMicrotask(() => {
                          form.setFieldValue(
                            ['payment_milestones', index, 'is_prepayment'],
                            false,
                          );
                        });
                        return;
                      }
                      const name = form.getFieldValue([
                        'payment_milestones',
                        index,
                        'milestone_name',
                      ]);
                      if (!name) {
                        form.setFieldValue(
                          ['payment_milestones', index, 'milestone_name'],
                          t('app.kuaizhizao.salesOrder.prepaymentNameDefault'),
                        );
                      }
                    } else {
                      form.setFieldValue(
                        ['payment_milestones', index, 'bank_account_id'],
                        undefined,
                      );
                    }
                  }}
                />
              </AntForm.Item>
            ),
          },
          {
            title: t('app.kuaizhizao.salesContract.milestoneName'),
            width: 140,
            render: (_: unknown, __: unknown, index: number) => (
              <ProFormText
                name={[index, 'milestone_name']}
                placeholder={t('app.kuaizhizao.salesContract.milestoneNamePlaceholder')}
                formItemProps={{ style: { margin: 0 } }}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.salesContract.plannedDate'),
            width: 140,
            render: (_: unknown, __: unknown, index: number) => (
              <ProFormDatePicker
                name={[index, 'planned_date']}
                fieldProps={buildFutureDateShortcutFieldProps({
                  getForm: () => formRef.current,
                  fieldName: 'planned_date',
                  baseFieldName: baseDateField,
                  t,
                  onApply: (date) =>
                    formRef.current?.setFieldValue?.(
                      ['payment_milestones', index, 'planned_date'],
                      date,
                    ),
                })}
                formItemProps={{ style: { margin: 0 } }}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.salesContract.plannedAmount'),
            width: 120,
            render: (_: unknown, __: unknown, index: number) => (
              <ProFormDigit
                name={[index, 'planned_amount']}
                min={0}
                fieldProps={{ precision: amountDecimals, style: { width: '100%' } }}
                formItemProps={{ style: { margin: 0 } }}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.salesContract.ratioPercent'),
            width: 100,
            render: (_: unknown, __: unknown, index: number) => (
              <ProFormDigit
                name={[index, 'planned_ratio']}
                min={0}
                max={100}
                fieldProps={{ style: { width: '100%' } }}
                formItemProps={{ style: { margin: 0 } }}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.salesOrder.prepaymentBankAccount'),
            width: 200,
            render: (_: unknown, __: unknown, index: number) => {
              const isPrepay = Boolean(milestoneRows[index]?.is_prepayment);
              if (!isPrepay) {
                return <Typography.Text type="secondary">—</Typography.Text>;
              }
              return (
                <ProFormSelect
                  name={[index, 'bank_account_id']}
                  options={bankAccountOptions}
                  showSearch
                  allowClear
                  placeholder={t('app.kuaizhizao.salesOrder.prepaymentBankAccountPlaceholder')}
                  formItemProps={{ style: { margin: 0 } }}
                />
              );
            },
          },
          {
            title: t('app.kuaizhizao.salesContract.billingTrigger'),
            width: 120,
            render: (_: unknown, __: unknown, index: number) => {
              const isPrepay = Boolean(milestoneRows[index]?.is_prepayment);
              if (isPrepay) {
                return (
                  <Typography.Text type="secondary">
                    {t('app.kuaizhizao.salesOrder.milestoneTypePrepayment')}
                  </Typography.Text>
                );
              }
              return (
                <ProFormSelect
                  name={[index, 'billing_trigger']}
                  options={[
                    {
                      label: t('app.kuaizhizao.salesContract.billingTriggerMilestone'),
                      value: 'milestone',
                    },
                    {
                      label: t('app.kuaizhizao.salesContract.billingTriggerDelivery'),
                      value: 'delivery',
                    },
                  ]}
                  formItemProps={{ style: { margin: 0 } }}
                />
              );
            },
          },
          {
            title: t('common.action'),
            width: 48,
            align: 'center' as const,
            render: (_: unknown, __: unknown, index: number) => (
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => remove(index)}
              />
            ),
          },
        ];

        const addMenu = {
          items: [
            {
              key: 'plan',
              label: t('app.kuaizhizao.salesOrder.addPaymentMilestone'),
            },
            {
              key: 'prepayment',
              label: t('app.kuaizhizao.salesOrder.addPrepaymentMilestone'),
              disabled: hasPrepayment,
            },
          ],
          onClick: ({ key }: { key: string }) => {
            if (key === 'prepayment') addPrepayment();
            else addPlan();
          },
        };

        return (
          <>
            {fields.length > 0 ? (
              <Table
                {...DOCUMENT_SUBLINE_TABLE_PROPS}
                rowKey="key"
                dataSource={fields}
                columns={columns}
                scroll={{ x: 'max-content' }}
              />
            ) : null}
            <Dropdown menu={addMenu} trigger={['click']}>
              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                className={DOCUMENT_SUBLINE_ADD_BUTTON_CLASS}
                style={{ marginTop: fields.length > 0 ? 8 : 0 }}
              >
                {t('app.kuaizhizao.salesOrder.addPaymentMilestone')}
              </Button>
            </Dropdown>
          </>
        );
      }}
    </AntForm.List>
  );
}

export type SalesOrderContractTermsFieldsProps = {
  termGroupOptions: Array<{ label: string; value: number }>;
  termsPreview: SalesContractTermSnapshot[];
  onTermGroupChange: (groupId?: number) => void;
  t: TFunction;
  termPlaceholderKeys?: string[];
  termPlaceholderValues?: Record<string, string>;
  onTermPlaceholderChange?: (key: string, value: string) => void;
};

/** 合同条款（条款组 + 占位填写 + 预览）；无数据时虚线「添加」与收款计划一致 */
export function SalesOrderContractTermsFields({
  termGroupOptions,
  termsPreview,
  onTermGroupChange,
  t,
  termPlaceholderKeys = [],
  termPlaceholderValues = {},
  onTermPlaceholderChange,
}: SalesOrderContractTermsFieldsProps) {
  const form = AntForm.useFormInstance();
  const termGroupId = AntForm.useWatch('term_group_id', form) as number | undefined;
  const selectedLabel = termGroupOptions.find((o) => o.value === termGroupId)?.label;
  const hasTermGroups = termGroupOptions.length > 0;

  const applyTermGroup = (groupId?: number) => {
    form.setFieldValue('term_group_id', groupId);
    onTermGroupChange(groupId);
  };

  const termGroupMenu = {
    items: termGroupOptions.map((opt) => ({
      key: String(opt.value),
      label: opt.label,
    })),
    onClick: ({ key }: { key: string }) => {
      applyTermGroup(Number(key));
    },
  };

  return (
    <>
      <ProFormSelect name="term_group_id" hidden options={termGroupOptions} />

      {!termGroupId ? (
        <Dropdown menu={termGroupMenu} trigger={['click']} disabled={!hasTermGroups}>
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            className={DOCUMENT_SUBLINE_ADD_BUTTON_CLASS}
            disabled={!hasTermGroups}
            title={!hasTermGroups ? t('app.kuaizhizao.salesOrder.terms.noTermGroup') : undefined}
          >
            {t('app.kuaizhizao.salesOrder.terms.addTerms')}
          </Button>
        </Dropdown>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <Typography.Text strong>{selectedLabel}</Typography.Text>
            <Space>
              <Dropdown menu={termGroupMenu} trigger={['click']}>
                <Button type="link" size="small">
                  {t('app.kuaizhizao.salesOrder.terms.changeTerms')}
                </Button>
              </Dropdown>
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => applyTermGroup(undefined)}
              />
            </Space>
          </div>

          {termPlaceholderKeys.length > 0 ? (
            <Card
              size="small"
              title={t('app.kuaizhizao.salesContract.terms.placeholderFillTitle')}
              style={{ marginBottom: 16 }}
            >
              <Row gutter={[16, 12]}>
                {termPlaceholderKeys.map((key) => (
                  <Col key={key} span={6}>
                    <div style={{ marginBottom: 4 }}>
                      <Typography.Text>{key}</Typography.Text>
                    </div>
                    <Input
                      value={termPlaceholderValues[key] ?? ''}
                      placeholder={t('app.kuaizhizao.salesContract.terms.placeholderInputHint', {
                        name: key,
                      })}
                      onChange={(e) => onTermPlaceholderChange?.(key, e.target.value)}
                    />
                  </Col>
                ))}
              </Row>
            </Card>
          ) : null}

          {termsPreview.length > 0 ? (
            <Card size="small" title={t('app.kuaizhizao.salesOrder.terms.previewTitle')}>
              {termsPreview.map((term, idx) => (
                <div key={`${term.term_item_id ?? idx}-${term.term_name}`} style={{ marginBottom: 12 }}>
                  <Typography.Text strong>
                    {idx + 1}. {term.term_name}
                  </Typography.Text>
                  <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                    <ContractTermPreviewContent
                      content={term.content ?? ''}
                      template={term.template_content}
                      values={term.placeholder_values}
                    />
                  </Typography.Paragraph>
                </div>
              ))}
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}

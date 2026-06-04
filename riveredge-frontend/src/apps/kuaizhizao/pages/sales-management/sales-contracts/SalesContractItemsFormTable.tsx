/**
 * 销售合同新建/编辑 — 合同明细表（与报价单物料明细表一致）
 */
import React from 'react';
import type { ProFormInstance } from '@ant-design/pro-components';
import { ProForm } from '@ant-design/pro-components';
import { AppstoreAddOutlined, ImportOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, DatePicker, Form, Input, InputNumber, Space, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import { OrderLineVariantAttributesCell } from '../../../../master-data/components/OrderLineVariantAttributesCell';
import { AmountDisplay } from '../../../../../components/permission';
import { KUAIZHIZAO_SALES_CONTRACT_FIELD_RESOURCE as SC } from '../../../constants/fieldPermissionResources';
import type { Material } from '../../../../master-data/types/material';
import {
  calcContractLineAmounts,
  ContractAmountCell,
  ContractFormSummary,
  ContractMaterialSelectCell,
  defaultContractItem,
} from './contract-line-items-shared';

export type ContractItemsFormTableProps = {
  formRef: React.RefObject<ProFormInstance | undefined>;
  materialList: Material[];
  onOpenMaterialPicker: () => void;
  onOpenImport: () => void;
  onPriceTypeToggle: (checked: boolean) => void;
  onRefreshLinePriceByVariant: (index: number, attrs?: Record<string, unknown>) => void | Promise<void>;
  editingIncl: { index: number; value: number | null } | null;
  setEditingIncl: React.Dispatch<React.SetStateAction<{ index: number; value: number | null } | null>>;
  editingInclValueRef: React.MutableRefObject<number | null>;
};

export const SalesContractItemsFormTable: React.FC<ContractItemsFormTableProps> = ({
  formRef,
  materialList,
  onOpenMaterialPicker,
  onOpenImport,
  onPriceTypeToggle,
  onRefreshLinePriceByVariant,
  editingIncl,
  setEditingIncl,
  editingInclValueRef,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.price_type !== curr?.price_type}>
        {({ getFieldValue }) => {
          const priceType = getFieldValue('price_type') ?? 'tax_exclusive';
          const showTaxColumns = priceType === 'tax_inclusive';
          const detailColumns = [
                    {
                      title: '物料',
                      dataIndex: 'material_id',
                      width: 260,
                      render: (_: unknown, __: unknown, index: number) => (
                        <ContractMaterialSelectCell index={index} />
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.variantAttributes'),
                      dataIndex: 'variant_attributes',
                      width: 220,
                      render: (_: unknown, __: unknown, index: number) =>
                        formRef.current ? (
                          <OrderLineVariantAttributesCell
                            form={formRef.current}
                            rowIndex={index}
                            materials={materialList}
                            onAttributesChange={(attrs) => onRefreshLinePriceByVariant(index, attrs)}
                          />
                        ) : null,
                    },
                    {
                      title: '规格',
                      dataIndex: 'material_spec',
                      width: 120,
                      render: (_: unknown, __: unknown, index: number) => (
                        <Form.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                          <Input placeholder="规格" size="small" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: '单位',
                      dataIndex: 'material_unit',
                      width: 100,
                      render: (_: unknown, __: unknown, index: number) => (
                        <Form.Item
                          noStyle
                          shouldUpdate={(prev: any, curr: any) =>
                            prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id
                          }
                        >
                          {({ getFieldValue: gf }) => {
                            const materialId = gf(['items', index, 'material_id']);
                            return (
                              <Form.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                                <MaterialUnitSelect materialId={materialId} size="small" noStyle />
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                      ),
                    },
                    {
                      title: '数量',
                      dataIndex: 'contract_quantity',
                      width: 100,
                      align: 'right' as const,
                      render: (_: unknown, __: unknown, index: number) => (
                        <Form.Item
                          name={[index, 'contract_quantity']}
                          rules={[{ required: true, message: '必填' }]}
                          style={{ margin: 0 }}
                        >
                          <InputNumber
                            placeholder="数量"
                            min={0.01}
                            precision={2}
                            style={{ width: '100%' }}
                            size="small"
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title:
                        priceType === 'tax_inclusive'
                          ? t('app.kuaizhizao.salesOrder.unitPriceColumnTaxInclusive')
                          : t('app.kuaizhizao.salesOrder.unitPriceColumnTaxExclusive'),
                      dataIndex: 'unit_price',
                      width: 100,
                      align: 'right' as const,
                      render: (_: unknown, __: unknown, index: number) => (
                        <Form.Item
                          name={[index, 'unit_price']}
                          style={{ margin: 0 }}
                          rules={[
                            { required: true, message: t('app.kuaizhizao.salesOrder.unitPriceRequired') },
                            {
                              validator: (_: unknown, value: unknown) => {
                                const n = Number(value);
                                if (value == null || value === '') return Promise.resolve();
                                if (Number.isNaN(n) || n <= 0) {
                                  return Promise.reject(new Error(t('app.kuaizhizao.salesOrder.unitPricePositive')));
                                }
                                return Promise.resolve();
                              },
                            },
                          ]}
                        >
                          <InputNumber
                            placeholder={
                              priceType === 'tax_inclusive'
                                ? t('app.kuaizhizao.salesOrder.unitPricePlaceholderTaxInclusive')
                                : t('app.kuaizhizao.salesOrder.unitPricePlaceholder')
                            }
                            min={0}
                            precision={2}
                            prefix="¥"
                            style={{ width: '100%' }}
                            size="small"
                          />
                        </Form.Item>
                      ),
                    },
                    ...(showTaxColumns
                      ? [
                          {
                            title: t('app.kuaizhizao.salesOrder.exclAmount'),
                            width: 110,
                            align: 'right' as const,
                            render: (_: unknown, __: unknown, index: number) => (
                              <Form.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                                {({ getFieldValue: gf2 }: any) => {
                                  const itemsVal = gf2('items') ?? [];
                                  const row = itemsVal[index];
                                  const line = calcContractLineAmounts(
                                    row?.contract_quantity,
                                    row?.unit_price,
                                    row?.tax_rate,
                                    priceType,
                                  );
                                  return <AmountDisplay resource={SC} fieldName="amount_without_tax" value={line.excl} />;
                                }}
                              </Form.Item>
                            ),
                          },
                        ]
                      : []),
                    ...(showTaxColumns
                      ? [
                          {
                            title: (
                              <span>
                                {t('app.kuaizhizao.salesOrder.taxRate')}
                                <Button
                                  type="link"
                                  size="small"
                                  style={{ padding: '0 4px', height: 'auto' }}
                                  onClick={() => {
                                    const itemsVal = formRef.current?.getFieldValue('items') ?? [];
                                    if (itemsVal.length === 0) return;
                                    const rate = prompt(t('app.kuaizhizao.salesOrder.taxRateBatch'), '13');
                                    if (rate != null && rate !== '') {
                                      const num = parseFloat(rate);
                                      if (!Number.isNaN(num) && num >= 0 && num <= 100) {
                                        const next = itemsVal.map((it: any) => ({ ...it, tax_rate: num }));
                                        formRef.current?.setFieldsValue({ items: next });
                                      }
                                    }
                                  }}
                                >
                                  {t('app.kuaizhizao.salesOrder.batch')}
                                </Button>
                              </span>
                            ),
                            dataIndex: 'tax_rate',
                            width: 120,
                            align: 'right' as const,
                            render: (_: unknown, __: unknown, index: number) => (
                              <Form.Item name={[index, 'tax_rate']} initialValue={0} style={{ margin: 0 }}>
                                <InputNumber
                                  placeholder="0"
                                  min={0}
                                  max={100}
                                  precision={2}
                                  addonAfter="%"
                                  style={{ width: '100%' }}
                                  size="small"
                                />
                              </Form.Item>
                            ),
                          },
                          {
                            title: t('app.kuaizhizao.salesOrder.taxAmount'),
                            width: 100,
                            align: 'right' as const,
                            render: (_: unknown, __: unknown, index: number) => (
                              <Form.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                                {({ getFieldValue: gf2 }: any) => {
                                  const itemsVal = gf2('items') ?? [];
                                  const row = itemsVal[index];
                                  const line = calcContractLineAmounts(
                                    row?.contract_quantity,
                                    row?.unit_price,
                                    row?.tax_rate,
                                    priceType,
                                  );
                                  return <AmountDisplay resource={SC} fieldName="tax_amount" value={line.tax} />;
                                }}
                              </Form.Item>
                            ),
                          },
                        ]
                      : []),
                    {
                      title: showTaxColumns
                        ? t('app.kuaizhizao.salesOrder.inclAmount')
                        : t('app.kuaizhizao.salesOrder.exclAmount'),
                      width: 120,
                      align: 'right' as const,
                      render: (_: unknown, __: unknown, index: number) =>
                        showTaxColumns ? (
                          <Form.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                            {({ getFieldValue: gf2 }: any) => {
                              const itemsVal = gf2('items') ?? [];
                              const row = itemsVal[index];
                              const qty = Number(row?.contract_quantity) || 0;
                              const taxRate = Number(row?.tax_rate) || 0;
                              const line = calcContractLineAmounts(
                                row?.contract_quantity,
                                row?.unit_price,
                                row?.tax_rate,
                                priceType,
                              );
                              const totalIncl = line.incl;
                              const isEditing = editingIncl?.index === index;
                              const displayValue = isEditing ? editingIncl.value : totalIncl;
                              return (
                                <InputNumber
                                  placeholder={t('app.kuaizhizao.salesOrder.inclAmountPlaceholder')}
                                  min={0}
                                  precision={2}
                                  prefix="¥"
                                  style={{ width: '100%' }}
                                  size="small"
                                  value={displayValue}
                                  onChange={(val) => {
                                    const v = val ?? null;
                                    editingInclValueRef.current = v;
                                    setEditingIncl({ index, value: v });
                                  }}
                                  onFocus={() => {
                                    setEditingIncl((prev) =>
                                      prev?.index === index ? prev : { index, value: totalIncl },
                                    );
                                    editingInclValueRef.current = totalIncl;
                                  }}
                                  onBlur={() => {
                                    const incl = editingInclValueRef.current;
                                    if (editingIncl?.index === index && incl != null && qty > 0) {
                                      const factor = 1 + taxRate / 100;
                                      const newPrice =
                                        priceType === 'tax_inclusive'
                                          ? incl / qty
                                          : (factor > 0 ? incl / factor : incl) / qty;
                                      const next = [...itemsVal];
                                      next[index] = { ...row, unit_price: newPrice };
                                      formRef.current?.setFieldsValue({ items: next });
                                    }
                                    setEditingIncl(null);
                                  }}
                                />
                              );
                            }}
                          </Form.Item>
                        ) : (
                          <ContractAmountCell index={index} />
                        ),
                    },
                    {
                      title: '交货日期',
                      dataIndex: 'delivery_date',
                      width: 130,
                      render: (_: unknown, __: unknown, index: number) => (
                        <Form.Item name={[index, 'delivery_date']} style={{ margin: 0 }}>
                          <DatePicker size="small" style={{ width: '100%' }} format="YYYY-MM-DD" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: '备注',
                      dataIndex: 'notes',
                      width: 120,
                      render: (_: unknown, __: unknown, index: number) => (
                        <Form.Item name={[index, 'notes']} style={{ margin: 0 }}>
                          <Input placeholder="备注" size="small" />
                        </Form.Item>
                      ),
                    },
                    ];
          return (
            <>
              <style>{`
                    .quotation-detail-table .quotation-material-cell .ant-form-item,
                    .quotation-detail-table .quotation-material-cell .ant-form-item-control,
                    .quotation-detail-table .quotation-material-cell .ant-form-item-control-input,
                    .quotation-detail-table .quotation-material-cell .ant-select {
                      width: 100% !important;
                      min-width: 0;
                    }
                    .quotation-detail-table .ant-input-number-input::selection,
                    .quotation-detail-table .ant-input::selection {
                      background-color: var(--ant-color-primary, #1677ff);
                      color: #fff;
                      border-radius: 0;
                    }
                  `}</style>
              <UniTableDetail
                name="items"
                title="物料明细"
                required
                requiredMessage="请至少添加一条合同明细"
                leftExtra={(
                  <ProForm.Item
                    name="price_type"
                    initialValue="tax_exclusive"
                    noStyle
                    valuePropName="checked"
                    getValueProps={(v: string) => ({ checked: v === 'tax_inclusive' })}
                    getValueFromEvent={(checked: boolean) => (checked ? 'tax_inclusive' : 'tax_exclusive')}
                  >
                    <Switch
                      checkedChildren={t('app.kuaizhizao.salesOrder.taxInclusive')}
                      unCheckedChildren={t('app.kuaizhizao.salesOrder.taxExclusive')}
                      onChange={onPriceTypeToggle}
                    />
                  </ProForm.Item>
                )}
                headerExtra={(
                  <Space size={8}>
                    <Button
                      type="default"
                      icon={<ImportOutlined />}
                      onClick={onOpenImport}
                    >
                      导入明细
                    </Button>
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const items = [...(formRef.current?.getFieldValue('items') ?? [])];
                        items.push({ ...defaultContractItem });
                        formRef.current?.setFieldsValue({ items });
                      }}
                    >
                      添加明细
                    </Button>
                    <Button
                      type="default"
                      icon={<AppstoreAddOutlined />}
                      onClick={onOpenMaterialPicker}
                    >
                      {t('app.kuaizhizao.common.materialBatchSelect')}
                    </Button>
                  </Space>
                )}
                columns={detailColumns}
                disabledAdd
                initialValue={{ ...defaultContractItem }}
                tableProps={{
                  className: 'quotation-detail-table',
                  size: 'small',
                  style: { width: '100%', margin: 0 },
                }}
              />
            </>
          );
        }}
      </Form.Item>
      <ContractFormSummary />
    </>
  );
};

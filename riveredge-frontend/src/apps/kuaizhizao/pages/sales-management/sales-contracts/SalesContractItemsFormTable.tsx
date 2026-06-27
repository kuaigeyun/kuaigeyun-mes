/**
 * 销售合同新建/编辑 — 合同明细表（与报价单产品明细表一致）
 */
import React from 'react';
import type { ProFormInstance } from '@ant-design/pro-components';
import { ProForm } from '@ant-design/pro-components';
import { AppstoreAddOutlined, ImportOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, DatePicker, Form, Input, InputNumber, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import PriceTypeSwitch from '../../../../../components/price-type-switch/PriceTypeSwitch';
import { DEFAULT_SALES_PRICE_TYPE, salesFormPriceType } from '../shared/salesPriceType';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import {
  DOCUMENT_DETAIL_AMOUNT_STYLE,
  DOCUMENT_DETAIL_COL_WIDTH,
  DOCUMENT_DETAIL_DATE_PICKER_STYLE,
  DOCUMENT_DETAIL_NUM_COL,
  DOCUMENT_DETAIL_CONTROL_SIZE,
  DOCUMENT_DETAIL_TABLE_PROPS,
  DOCUMENT_DETAIL_TEXT_COL,
  DocumentDetailTableStyles,
  TaxRateBatchColumnTitle,
  TaxRateDetailCell,
} from '../../../components/document-detail-table/documentDetailTable';
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
import { normalizeFormListItems } from '../../../../../utils/formListItems';
import { buildFutureDateShortcutFieldProps, FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';

export type ContractItemsFormTableProps = {
  formRef: React.RefObject<ProFormInstance | undefined>;
  materialList: Material[];
  onOpenMaterialPicker: () => void;
  onOpenImport: () => void;
  showImportButton?: boolean;
  onPriceTypeChange: (checked: boolean) => void;
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
  showImportButton = true,
  onPriceTypeChange,
  onRefreshLinePriceByVariant,
  editingIncl,
  setEditingIncl,
  editingInclValueRef,
}) => {
  const { t } = useTranslation();
  const [productScope, setProductScope] = React.useState<'make' | 'all'>('make');
  const materialSourceType = productScope === 'make' ? 'Make' : undefined;
  const productColumnTitle = (
    <Space size={8} align="center">
      <span>{t('app.kuaizhizao.salesOrder.material')}</span>
      <ThemedSegmented
        size="small"
        value={productScope}
        options={[
          { label: t('app.kuaizhizao.sales.common.productScopeMake'), value: 'make' },
          { label: t('app.kuaizhizao.sales.common.productScopeAll'), value: 'all' },
        ]}
        onChange={(val) => setProductScope((val as 'make' | 'all') ?? 'make')}
      />
    </Space>
  );

  return (
    <>
      <Form.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.price_type !== curr?.price_type}>
        {({ getFieldValue }) => {
          const priceType = salesFormPriceType(getFieldValue('price_type'));
          const showTaxColumns = priceType === 'tax_inclusive';
          const detailColumns = [
                    {
                      title: productColumnTitle,
                      dataIndex: 'material_id',
                      width: DOCUMENT_DETAIL_COL_WIDTH.material,
                      ...DOCUMENT_DETAIL_TEXT_COL,
                      render: (_: unknown, __: unknown, index: number) => (
                        <ContractMaterialSelectCell
                          index={index}
                          materialList={materialList}
                          sourceType={materialSourceType}
                        />
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.variantAttributes'),
                      dataIndex: 'variant_attributes',
                      width: DOCUMENT_DETAIL_COL_WIDTH.variantAttributes,
                      ...DOCUMENT_DETAIL_TEXT_COL,
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
                      title: t('app.kuaizhizao.salesOrder.spec'),
                      dataIndex: 'material_spec',
                      width: DOCUMENT_DETAIL_COL_WIDTH.spec,
                      ...DOCUMENT_DETAIL_TEXT_COL,
                      render: (_: unknown, __: unknown, index: number) => (
                        <Form.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                          <Input placeholder={t('app.kuaizhizao.salesOrder.spec')} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
                        </Form.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.unit'),
                      dataIndex: 'material_unit',
                      width: DOCUMENT_DETAIL_COL_WIDTH.unit,
                      ...DOCUMENT_DETAIL_TEXT_COL,
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
                                <MaterialUnitSelect materialId={materialId} size={DOCUMENT_DETAIL_CONTROL_SIZE} noStyle />
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.quantity'),
                      dataIndex: 'contract_quantity',
                      width: DOCUMENT_DETAIL_COL_WIDTH.quantity,
                      ...DOCUMENT_DETAIL_NUM_COL,
                      render: (_: unknown, __: unknown, index: number) => (
                        <Form.Item
                          name={[index, 'contract_quantity']}
                          rules={[{ required: true, message: t('common.required') }]}
                          style={{ margin: 0 }}
                        >
                          <InputNumber
                            placeholder={t('app.kuaizhizao.salesOrder.quantity')}
                            min={0.01}
                            precision={2}
                            style={{ width: '100%' }}
                            size={DOCUMENT_DETAIL_CONTROL_SIZE}
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
                      width: DOCUMENT_DETAIL_COL_WIDTH.unitPrice,
                      ...DOCUMENT_DETAIL_NUM_COL,
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
                            size={DOCUMENT_DETAIL_CONTROL_SIZE}
                          />
                        </Form.Item>
                      ),
                    },
                    ...(showTaxColumns
                      ? [
                          {
                            title: t('app.kuaizhizao.salesOrder.exclAmount'),
                            width: DOCUMENT_DETAIL_COL_WIDTH.exclAmount,
                            ...DOCUMENT_DETAIL_NUM_COL,
                            render: (_: unknown, __: unknown, index: number) => (
                              <Form.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                                {({ getFieldValue: gf2 }: any) => {
                                  const itemsVal = normalizeFormListItems<any>(gf2('items'));
                                  const row = itemsVal[index];
                                  const line = calcContractLineAmounts(
                                    row?.contract_quantity,
                                    row?.unit_price,
                                    row?.tax_rate,
                                    priceType,
                                  );
                                  return (
                                    <AmountDisplay
                                      resource={SC}
                                      fieldName="amount_without_tax"
                                      value={line.excl}
                                      style={DOCUMENT_DETAIL_AMOUNT_STYLE}
                                    />
                                  );
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
                              <TaxRateBatchColumnTitle
                                onBatch={() => {
                                  const itemsVal = normalizeFormListItems<any>(formRef.current?.getFieldValue('items'));
                                  if (itemsVal.length === 0) return;
                                  const rate = prompt(t('app.kuaizhizao.salesOrder.taxRateBatch'), '13');
                                  if (rate != null && rate !== '') {
                                    const num = Math.round(parseFloat(rate));
                                    if (!Number.isNaN(num) && num >= 0 && num <= 100) {
                                      const next = itemsVal.map((it: any) => ({ ...it, tax_rate: num }));
                                      formRef.current?.setFieldsValue({ items: next });
                                    }
                                  }
                                }}
                              />
                            ),
                            dataIndex: 'tax_rate',
                            width: DOCUMENT_DETAIL_COL_WIDTH.taxRate,
                            ...DOCUMENT_DETAIL_NUM_COL,
                            onCell: () => ({ className: 'quotation-tax-rate-col' }),
                            render: (_: unknown, __: unknown, index: number) => <TaxRateDetailCell index={index} />,
                          },
                          {
                            title: t('app.kuaizhizao.salesOrder.taxAmount'),
                            width: DOCUMENT_DETAIL_COL_WIDTH.taxAmount,
                            ...DOCUMENT_DETAIL_NUM_COL,
                            render: (_: unknown, __: unknown, index: number) => (
                              <Form.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                                {({ getFieldValue: gf2 }: any) => {
                                  const itemsVal = normalizeFormListItems<any>(gf2('items'));
                                  const row = itemsVal[index];
                                  const line = calcContractLineAmounts(
                                    row?.contract_quantity,
                                    row?.unit_price,
                                    row?.tax_rate,
                                    priceType,
                                  );
                                  return (
                                    <AmountDisplay
                                      resource={SC}
                                      fieldName="tax_amount"
                                      value={line.tax}
                                      style={DOCUMENT_DETAIL_AMOUNT_STYLE}
                                    />
                                  );
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
                      width: DOCUMENT_DETAIL_COL_WIDTH.lineAmount,
                      ...DOCUMENT_DETAIL_NUM_COL,
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
                                  size={DOCUMENT_DETAIL_CONTROL_SIZE}
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
                      title: t('app.kuaizhizao.salesOrder.deliveryDate'),
                      dataIndex: 'delivery_date',
                      width: DOCUMENT_DETAIL_COL_WIDTH.deliveryDate,
                      ...DOCUMENT_DETAIL_TEXT_COL,
                      render: (_: unknown, __: unknown, index: number) => (
                        <Form.Item name={[index, 'delivery_date']} style={{ margin: 0 }}>
                          <FutureDatePicker
                            size={DOCUMENT_DETAIL_CONTROL_SIZE}
                            style={DOCUMENT_DETAIL_DATE_PICKER_STYLE}
                            format="YYYY-MM-DD"
                            getForm={() => formRef.current}
                            baseFieldName="contract_date"
                            t={t}
                            onApply={(date) =>
                              formRef.current?.setFieldValue?.(['items', index, 'delivery_date'], date)
                            }
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.notes'),
                      dataIndex: 'notes',
                      width: DOCUMENT_DETAIL_COL_WIDTH.notes,
                      ...DOCUMENT_DETAIL_TEXT_COL,
                      render: (_: unknown, __: unknown, index: number) => (
                        <Form.Item name={[index, 'notes']} style={{ margin: 0 }}>
                          <Input placeholder={t('app.kuaizhizao.salesOrder.notes')} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
                        </Form.Item>
                      ),
                    },
                    ];
          return (
            <>
              <DocumentDetailTableStyles />
              <UniTableDetail
                name="items"
                title={t('app.kuaizhizao.salesContract.contractItems')}
                required
                requiredMessage={t('app.kuaizhizao.salesContract.itemsRequired')}
                leftExtra={(
                  <PriceTypeSwitch
                    checked={priceType === 'tax_inclusive'}
                    onChange={onPriceTypeChange}
                  />
                )}
                headerExtra={(
                  <Space size={8}>
                    {showImportButton ? (
                      <Button
                        type="default"
                        icon={<ImportOutlined />}
                        onClick={onOpenImport}
                      >
                        {t('app.kuaizhizao.salesOrder.importItems')}
                      </Button>
                    ) : null}
                    <Button
                      type="default"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const items = [...normalizeFormListItems<any>(formRef.current?.getFieldValue('items'))];
                        items.push({ ...defaultContractItem });
                        formRef.current?.setFieldsValue({ items });
                      }}
                    >
                      {t('app.kuaizhizao.salesOrder.addItem')}
                    </Button>
                    <Button
                      type="default"
                      icon={<AppstoreAddOutlined />}
                      onClick={onOpenMaterialPicker}
                    >
                      {t('app.kuaizhizao.sales.common.productBatchSelect')}
                    </Button>
                  </Space>
                )}
                columns={detailColumns}
                disabledAdd
                initialValue={{ ...defaultContractItem }}
                tableProps={DOCUMENT_DETAIL_TABLE_PROPS}
              />
            </>
          );
        }}
      </Form.Item>
      <ContractFormSummary />
    </>
  );
};

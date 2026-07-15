/**
 * 好力 GO — 发票登记
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProFormDatePicker,
  ProFormDigit,
  ProFormInstance,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { UploadProps } from 'antd';
import { FormListDetailTable } from '../../../../../components/form-list-detail-table';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FilePdfOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import HaoligoDocumentPrintModal from '../../../components/HaoligoDocumentPrintModal';
import FinanceSupplierSelect, {
  HAOLIGO_RESOURCE_FINANCE_SUPPLIERS,
  type FinanceSupplierSelectRef,
} from '../../../components/FinanceSupplierSelect';
import { haoligoDocumentCreatorColumn, resolveHaoligoDocumentCreatorName } from '../../../utils/documentTableColumns';
import {
  createFinanceInvoice,
  deleteFinanceInvoice,
  getFinanceInvoice,
  getOrCreateFinanceAcceptanceFromInvoice,
  listFinanceInvoices,
  listFinanceSupplierPriceLedger,
  listFinanceSuppliers,
  parseFinanceInvoicePdf,
  registerFinanceInvoiceSupplierPrice,
  rejectFinanceInvoice,
  updateFinanceInvoice,
  updateFinanceSupplierPriceLedger,
  type FinanceInvoiceRow,
  type FinanceSupplierPriceLedgerRow,
  type FinanceSupplierRow,
} from '../../../services/haoligo';
import {
  formatFinanceUnitPrice,
  normalizeFinanceUnitPriceInput,
  parseFinanceUnitPriceCell,
} from '../../../utils/financeDecimal';
import {
  buildSupplierPriceSpecIndex,
  compareInvoiceLineToSupplierPrice,
} from '../../../utils/financeInvoiceCompare';

const HAOLIGO_FINANCE_INVOICE_VERIFY_RESOURCE = 'haoligo:finance-invoice-verify';

function resolveLineMaterialCode(ln: Record<string, unknown>): string {
  return String(ln.spec ?? ln.material_code ?? ln.material_name ?? '').trim();
}

function inferDecimalPlaces(value: unknown): number {
  if (value == null || value === '') return 0;
  const s = String(value).trim();
  if (!s.includes('.')) return 0;
  return s.length - s.indexOf('.') - 1;
}

function lineNumberScale(line: Record<string, unknown> | undefined, field: string, fallback: number): number {
  const scale = line?.[field];
  return typeof scale === 'number' && scale >= 0 ? scale : fallback;
}

/** 发票金额按行四舍五入到分，再合计（与票面一致） */
function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function parseLineUnitPrice(value: unknown): number {
  const raw = parseFinanceUnitPriceCell(value);
  if (raw == null) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function lineAmountValue(ln: Record<string, unknown>): number {
  const qty = Number(ln.quantity ?? 0);
  const price = parseLineUnitPrice(ln.invoice_unit_price);
  return roundMoney(qty * price);
}

function ocrLineAmountValue(ln: Record<string, unknown>): number | null {
  if (ln.line_amount == null || ln.line_amount === '') return null;
  const parsed = Number(ln.line_amount);
  return Number.isFinite(parsed) ? roundMoney(parsed) : null;
}

function formatLineNumber(value: number, scale: number): string {
  if (!Number.isFinite(value)) return '—';
  return roundMoney(value).toFixed(Math.max(0, scale));
}

function resolveSupplierIdFromParsed(
  parsed: Record<string, unknown>,
  suppliers: FinanceSupplierRow[],
): number | undefined {
  const parsedId = parsed.supplier_id;
  if (parsedId != null && Number(parsedId) > 0) {
    return Number(parsedId);
  }
  const name = String(parsed.supplier_name ?? '').trim();
  if (!name) return undefined;
  const exact = suppliers.find((s) => s.supplier_name.trim() === name);
  if (exact) return exact.id;
  const forward = suppliers.filter((s) => s.supplier_name.trim().includes(name));
  if (forward.length === 1) return forward[0].id;
  const reverse = suppliers.filter((s) => name.includes(s.supplier_name.trim()));
  if (reverse.length === 1) return reverse[0].id;
  if (reverse.length > 1) {
    reverse.sort((a, b) => b.supplier_name.length - a.supplier_name.length);
    return reverse[0].id;
  }
  return undefined;
}

function mapParsedInvoiceLine(ln: Record<string, unknown>, idx: number) {
  const priceLiteral =
    ln.invoice_unit_price_literal != null && String(ln.invoice_unit_price_literal).trim() !== ''
      ? String(ln.invoice_unit_price_literal).trim()
      : parseFinanceUnitPriceCell(ln.invoice_unit_price);
  const quantity = Number(ln.quantity ?? 0);
  const ocrLineAmount =
    ln.line_amount != null && ln.line_amount !== '' ? roundMoney(Number(ln.line_amount)) : undefined;
  return {
    line_no: Number(ln.line_no ?? idx + 1),
    material_name: ln.material_name,
    spec: ln.spec ?? ln.material_code,
    unit: ln.unit,
    quantity,
    invoice_unit_price: priceLiteral ?? '',
    line_amount: ocrLineAmount,
    tax_amount: ln.tax_amount != null ? roundMoney(Number(ln.tax_amount)) : undefined,
    quantity_decimals: Number(ln.quantity_decimals ?? inferDecimalPlaces(ln.quantity)),
    invoice_unit_price_decimals: inferDecimalPlaces(priceLiteral),
    line_amount_decimals: Number(ln.line_amount_decimals ?? inferDecimalPlaces(ln.line_amount ?? ocrLineAmount)),
    tax_amount_decimals: Number(ln.tax_amount_decimals ?? inferDecimalPlaces(ln.tax_amount)),
  };
}

const InvoiceLineUnitPriceInput: React.FC<{
  rowIndex: number;
}> = ({ rowIndex }) => (
  <ProFormText
    name={[rowIndex, 'invoice_unit_price']}
    rules={[{ required: true, message: '必填' }]}
    formItemProps={{ noStyle: true }}
    fieldProps={{
      style: { width: '100%', fontVariantNumeric: 'tabular-nums' },
      styles: { input: { textOverflow: 'clip' } },
    }}
  />
);

/** 录入弹窗：存在未一致明细时显示整票拒收（全部一致时隐藏） */
function invoiceEntryHasUnresolvedCompare(
  lines: Record<string, unknown>[] | undefined,
  priceIndex: Map<string, FinanceSupplierPriceLedgerRow>,
): boolean {
  if (!lines?.length) return false;
  return lines.some((ln) => compareInvoiceLineToSupplierPrice(ln, priceIndex).status !== '一致');
}

const InvoiceLineCompareCell: React.FC<{
  rowIndex: number;
  priceIndex: Map<string, FinanceSupplierPriceLedgerRow>;
  onReloadPrices: () => Promise<void>;
  canUpdate: boolean;
}> = ({ rowIndex, priceIndex, onReloadPrices, canUpdate }) => {
  const { message: messageApi, modal } = App.useApp();
  const form = Form.useFormInstance();
  const line = Form.useWatch(['lines', rowIndex], form) as Record<string, unknown> | undefined;
  const supplierId = Form.useWatch('supplier_id', form);
  const compare = useMemo(
    () => compareInvoiceLineToSupplierPrice(line, priceIndex),
    [line, priceIndex],
  );
  const invoicePriceText = parseFinanceUnitPriceCell(line?.invoice_unit_price);
  const [updating, setUpdating] = useState(false);

  const resolveRegisterContext = () => {
    const sid = Number(supplierId ?? 0);
    if (!sid) {
      messageApi.warning('请先选择材料供应商');
      return null;
    }
    const spec = String(line?.spec ?? line?.material_code ?? line?.material_name ?? '').trim();
    if (!spec) {
      messageApi.warning('规格不能为空，无法登记');
      return null;
    }
    let unitPrice: string;
    try {
      unitPrice = normalizeFinanceUnitPriceInput(line?.invoice_unit_price);
    } catch {
      messageApi.warning('发票单价无效，无法登记');
      return null;
    }
    return {
      sid,
      spec,
      unitPrice,
      materialCode: String(line?.material_code ?? '').trim() || spec,
      materialName: String(line?.material_name ?? '').trim() || spec,
      unit: String(line?.unit ?? '').trim() || null,
    };
  };

  const registerCurrentPrice = (ctx: NonNullable<ReturnType<typeof resolveRegisterContext>>) => {
    setUpdating(true);
    void (async () => {
      try {
        await registerFinanceInvoiceSupplierPrice({
          supplier_id: ctx.sid,
          spec: ctx.spec,
          unit_price: ctx.unitPrice,
          material_code: ctx.materialCode,
          material_name: ctx.materialName,
          unit: ctx.unit,
          price_type: '不含税',
        });
        messageApi.success('已按当前发票单价登记到供应商价格明细');
        await onReloadPrices();
      } catch (e) {
        messageApi.error((e as Error).message || '登记失败');
      } finally {
        setUpdating(false);
      }
    })();
  };

  const updateLedgerPrice = (supplierPriceId: number, newPrice: string) => {
    setUpdating(true);
    void (async () => {
      try {
        await updateFinanceSupplierPriceLedger(supplierPriceId, {
          unit_price: newPrice,
          change_source: '验票改价',
          remark: '发票录入改价',
        });
        messageApi.success('已更改单价并写入清单（历史价格已保留）');
        await onReloadPrices();
      } catch (e) {
        messageApi.error((e as Error).message || '改价失败');
      } finally {
        setUpdating(false);
      }
    })();
  };

  if (compare.status === '一致') {
    return <Tag color="success">一致</Tag>;
  }
  if (compare.status === '未登记') {
    return (
      <Space size={4} wrap={false} style={{ width: '100%' }}>
        <Tag style={{ marginInlineEnd: 0 }}>未登记</Tag>
        {canUpdate ? (
          <Button
            type="link"
            size="small"
            loading={updating}
            style={{ paddingInline: 0, height: 'auto' }}
            onClick={() => {
              const ctx = resolveRegisterContext();
              if (!ctx) return;
              modal.confirm({
                title: '登记供应商单价',
                content: (
                  <Typography.Paragraph style={{ marginBottom: 0 }}>
                    规格「{ctx.spec}」尚未登记单价。确认按发票单价{' '}
                    <Typography.Text strong>{formatFinanceUnitPrice(ctx.unitPrice)}</Typography.Text>{' '}
                    写入供应商价格明细？
                  </Typography.Paragraph>
                ),
                okText: '确认登记',
                onOk: () => registerCurrentPrice(ctx),
              });
            }}
          >
            以当前价格登记
          </Button>
        ) : null}
      </Space>
    );
  }

  return (
    <Space align="start" size={8} style={{ width: '100%' }}>
      <Tag color="warning" style={{ marginInlineEnd: 0 }}>
        差异
      </Tag>
      <Space direction="vertical" size={0} style={{ flex: 1, minWidth: 0 }}>
        <Typography.Text type="warning" style={{ fontSize: 12, display: 'block', whiteSpace: 'nowrap' }}>
          {`发票 ${formatFinanceUnitPrice(invoicePriceText)}`}
        </Typography.Text>
        <Typography.Text type="warning" style={{ fontSize: 12, display: 'block', whiteSpace: 'nowrap' }}>
          {`清单 ${formatFinanceUnitPrice(compare.systemUnitPrice)}`}
        </Typography.Text>
        {canUpdate && compare.supplierPriceId ? (
          <Button
            type="link"
            size="small"
            loading={updating}
            style={{ paddingInline: 0, height: 'auto' }}
            onClick={() => {
              let newPrice: string;
              try {
                newPrice = normalizeFinanceUnitPriceInput(line?.invoice_unit_price);
              } catch {
                messageApi.warning('发票单价无效，无法改价');
                return;
              }
              const spec = String(line?.spec ?? line?.material_code ?? line?.material_name ?? '').trim() || '—';
              modal.confirm({
                title: '更改供应商单价',
                content: (
                  <Typography.Paragraph style={{ marginBottom: 0 }}>
                    规格「{spec}」单价与发票不一致。确认将清单单价从{' '}
                    <Typography.Text strong>{formatFinanceUnitPrice(compare.systemUnitPrice)}</Typography.Text>{' '}
                    改为发票单价{' '}
                    <Typography.Text strong>{formatFinanceUnitPrice(newPrice)}</Typography.Text>？历史价格将保留。
                  </Typography.Paragraph>
                ),
                okText: '确认改价',
                onOk: () => updateLedgerPrice(compare.supplierPriceId!, newPrice),
              });
            }}
          >
            更改单价
          </Button>
        ) : null}
      </Space>
    </Space>
  );
};

const InvoiceLineScaleDigit: React.FC<{
  rowIndex: number;
  fieldName: 'quantity' | 'invoice_unit_price' | 'tax_amount';
  scaleField: 'quantity_decimals' | 'invoice_unit_price_decimals' | 'tax_amount_decimals';
  defaultScale: number;
  rules?: Array<{ required?: boolean; message?: string }>;
  min?: number;
}> = ({ rowIndex, fieldName, scaleField, defaultScale, rules, min = 0 }) => {
  const form = Form.useFormInstance();
  const scale = Form.useWatch(['lines', rowIndex, scaleField], form);
  return (
    <ProFormDigit
      name={[rowIndex, fieldName]}
      min={min}
      rules={rules}
      formItemProps={{ noStyle: true }}
      fieldProps={{
        style: { width: '100%' },
        precision: typeof scale === 'number' ? scale : defaultScale,
      }}
    />
  );
};

const InvoiceLineAmountCell: React.FC<{ rowIndex: number }> = ({ rowIndex }) => {
  const form = Form.useFormInstance();
  const row = Form.useWatch(['lines', rowIndex], form) as Record<string, unknown> | undefined;
  const scale = lineNumberScale(row, 'line_amount_decimals', 2);
  const display = lineAmountValue(row ?? {});
  const ocrAmount = ocrLineAmountValue(row ?? {});
  const mismatch = ocrAmount != null && Math.abs(ocrAmount - display) >= 0.01;
  return (
    <Typography.Text
      type={mismatch ? 'warning' : undefined}
      style={{ display: 'block', textAlign: 'right' }}
      title={
        mismatch ? `发票金额 ${ocrAmount.toFixed(2)}，按行四舍五入为 ${display.toFixed(2)}` : undefined
      }
    >
      {formatLineNumber(display, scale)}
    </Typography.Text>
  );
};

function computeInvoiceLineTotals(lines: Record<string, unknown>[] | undefined) {
  const rows = lines ?? [];
  let amountSumCents = 0;
  let taxSumCents = 0;
  for (const ln of rows) {
    amountSumCents += Math.round(lineAmountValue(ln) * 100);
    const tax = ln.tax_amount;
    if (tax != null && tax !== '' && Number.isFinite(Number(tax))) {
      taxSumCents += Math.round(roundMoney(Number(tax)) * 100);
    }
  }
  const amountSum = amountSumCents / 100;
  const taxSum = taxSumCents / 100;
  const totalSum = roundMoney(amountSum + taxSum);
  return { lineCount: rows.length, amountSum, taxSum, totalSum };
}

function renderInvoiceLinesSummary(lines: Record<string, unknown>[]) {
  const { lineCount, amountSum, taxSum, totalSum } = computeInvoiceLineTotals(lines);
  const amountScale = Math.max(
    2,
    ...lines.map((ln) => lineNumberScale(ln, 'line_amount_decimals', 2)),
  );
  const taxScale = Math.max(2, ...lines.map((ln) => lineNumberScale(ln, 'tax_amount_decimals', 2)));
  return (
    <Table.Summary>
      <Table.Summary.Row>
        <Table.Summary.Cell index={0} colSpan={4} align="right">
          <Typography.Text strong>合计（{lineCount} 行）</Typography.Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={4} align="right">
          <Typography.Text type="secondary">—</Typography.Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={5} align="right">
          <Typography.Text type="secondary">—</Typography.Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={6} align="right">
          <Typography.Text strong>{formatLineNumber(amountSum, amountScale)}</Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            金额合计
          </Typography.Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={7} align="right">
          <Typography.Text strong>{formatLineNumber(taxSum, taxScale)}</Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            税额合计
          </Typography.Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={8} />
      </Table.Summary.Row>
      <Table.Summary.Row>
        <Table.Summary.Cell index={0} colSpan={7} align="right">
          <Typography.Text strong>价税合计（明细计算）</Typography.Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={7} align="right" colSpan={2}>
          <Typography.Text strong style={{ fontSize: 15 }}>
            {formatLineNumber(totalSum, 2)}
          </Typography.Text>
        </Table.Summary.Cell>
      </Table.Summary.Row>
    </Table.Summary>
  );
}

function invoiceStatusTag(status: string) {
  if (status === '已登记' || status === '待核对') return <Tag color="processing">{status === '待核对' ? '已登记' : status}</Tag>;
  if (status === '已验收') return <Tag color="success">{status}</Tag>;
  if (status === '已拒收') return <Tag color="error">{status}</Tag>;
  return <Tag>{status}</Tag>;
}

function lineStatusTag(status: string) {
  if (status === '一致') return <Tag color="success">{status}</Tag>;
  if (status === '差异' || status === '需改价') return <Tag color="warning">差异</Tag>;
  if (status === '未登记' || status === '缺失单价') return <Tag color="error">未登记</Tag>;
  if (status === '已拒收') return <Tag>{status}</Tag>;
  return <Tag>{status}</Tag>;
}

const FinanceInvoiceVerifyPage: React.FC = () => {
  const { message: messageApi, modal } = App.useApp();
  const perms = useResourcePermissions(HAOLIGO_FINANCE_INVOICE_VERIFY_RESOURCE);
  const supplierPerms = useResourcePermissions(HAOLIGO_RESOURCE_FINANCE_SUPPLIERS);
  const invoiceActionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const supplierSelectRef = useRef<FinanceSupplierSelectRef>(null);

  const [suppliers, setSuppliers] = useState<FinanceSupplierRow[]>([]);
  const [extraSupplierOption, setExtraSupplierOption] = useState<{ label: string; value: number } | null>(
    null,
  );
  const [unmatchedParsedSupplierName, setUnmatchedParsedSupplierName] = useState('');
  const [supplierPriceList, setSupplierPriceList] = useState<FinanceSupplierPriceLedgerRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [createFormLines, setCreateFormLines] = useState<Record<string, unknown>[]>([]);
  const [pendingCreateFormValues, setPendingCreateFormValues] = useState<Record<string, unknown> | null>(
    null,
  );
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<FinanceInvoiceRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [printAcceptanceOpen, setPrintAcceptanceOpen] = useState(false);
  const [printAcceptanceId, setPrintAcceptanceId] = useState<number | null>(null);
  const [printAcceptanceTitle, setPrintAcceptanceTitle] = useState('材料验收单打印');
  const [printAcceptanceLoadingId, setPrintAcceptanceLoadingId] = useState<number | null>(null);

  const reloadSupplierPrices = useCallback(async (supplierId?: number) => {
    const sid =
      supplierId ??
      Number(formRef.current?.getFieldValue('supplier_id') ?? 0);
    if (!sid) {
      setSupplierPriceList([]);
      return;
    }
    try {
      const rows = await listFinanceSupplierPriceLedger({ supplier_id: sid });
      setSupplierPriceList(rows);
    } catch {
      setSupplierPriceList([]);
    }
  }, []);

  const supplierPriceIndex = useMemo(
    () => buildSupplierPriceSpecIndex(supplierPriceList),
    [supplierPriceList],
  );

  const showCreateReject = useMemo(
    () =>
      perms.canUpdate &&
      createOpen &&
      invoiceEntryHasUnresolvedCompare(createFormLines, supplierPriceIndex),
    [perms.canUpdate, createOpen, createFormLines, supplierPriceIndex],
  );

  const closeCreateModal = () => {
    setCreateOpen(false);
    setCreateFormLines([]);
    setPendingCreateFormValues(null);
    setEditingInvoiceId(null);
    setUnmatchedParsedSupplierName('');
  };

  const openCreate = () => {
    setExtraSupplierOption(null);
    setUnmatchedParsedSupplierName('');
    setSupplierPriceList([]);
    setEditingInvoiceId(null);
    const initialLines = [{ line_no: 1, quantity: 1 }];
    setPendingCreateFormValues({ lines: initialLines });
    setCreateFormLines(initialLines);
    setCreateOpen(true);
  };

  const openEditInvoice = async (record: FinanceInvoiceRow) => {
    if (record.status !== '已登记' && record.status !== '待核对') {
      messageApi.warning('仅已登记发票可编辑');
      return;
    }
    setCreateLoading(true);
    try {
      const full = await getFinanceInvoice(record.id);
      const mappedLines = (full.lines ?? []).map((ln, idx) =>
        mapParsedInvoiceLine(
          {
            line_no: ln.line_no ?? idx + 1,
            material_name: ln.material_name,
            material_code: ln.material_code,
            spec: ln.spec,
            unit: ln.unit,
            quantity: ln.quantity,
            invoice_unit_price: ln.invoice_unit_price,
            tax_amount: ln.tax_amount,
          },
          idx,
        ),
      );
      const lines =
        mappedLines.length > 0
          ? mappedLines
          : [{ line_no: 1, quantity: 1, quantity_decimals: 0, line_amount_decimals: 2, tax_amount_decimals: 2 }];
      setEditingInvoiceId(full.id);
      setExtraSupplierOption(
        full.supplier_id && full.supplier_name
          ? { value: full.supplier_id, label: full.supplier_name }
          : null,
      );
      await reloadSupplierPrices(full.supplier_id);
      const formValues = {
        supplier_id: full.supplier_id,
        invoice_no: full.invoice_no,
        invoice_code: full.invoice_code,
        invoice_date: full.invoice_date ? dayjs(full.invoice_date) : undefined,
        qr_raw_text: full.qr_raw_text?.trim() || undefined,
        remark: full.remark,
        lines,
      };
      setPendingCreateFormValues(formValues);
      setCreateFormLines(lines);
      setCreateOpen(true);
    } catch (e) {
      messageApi.error((e as Error).message || '加载发票失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const applyParsedInvoice = async (parsed: Record<string, unknown>) => {
    let supplierList = suppliers;
    if (supplierList.length === 0) {
      try {
        supplierList = await listFinanceSuppliers({ is_active: true });
        setSuppliers(supplierList);
      } catch {
        supplierList = [];
      }
    }
    const lines = parsed.lines as Array<Record<string, unknown>> | undefined;
    const rawQrText = String(parsed.qr_raw_text ?? '').trim();
    const supplierId = resolveSupplierIdFromParsed(parsed, supplierList);
    const supplierName = String(parsed.supplier_name ?? '').trim();
    if (supplierId && supplierName && !supplierList.some((s) => s.id === supplierId)) {
      setExtraSupplierOption({ value: supplierId, label: supplierName });
    }
    if (supplierId) {
      setUnmatchedParsedSupplierName('');
      await reloadSupplierPrices(supplierId);
    } else if (supplierName) {
      setUnmatchedParsedSupplierName(supplierName);
    } else {
      setUnmatchedParsedSupplierName('');
    }
    const mappedLines =
      lines && lines.length > 0
        ? lines.map((ln, idx) => mapParsedInvoiceLine(ln, idx))
        : [{ line_no: 1, quantity: 1, quantity_decimals: 0, line_amount_decimals: 2, tax_amount_decimals: 2 }];
    formRef.current?.setFieldsValue({
      supplier_id: supplierId,
      invoice_no: parsed.invoice_no,
      invoice_code: parsed.invoice_code,
      invoice_date: parsed.invoice_date ? dayjs(String(parsed.invoice_date)) : undefined,
      qr_raw_text: rawQrText || undefined,
      lines: mappedLines,
    });
    setCreateFormLines(mappedLines);

    if (parsed.already_registered === true) {
      modal.warning({
        title: '此发票已经登记过',
        content: `发票号码 ${String(parsed.invoice_no ?? '').trim() || '—'} 已在系统中登记，请勿重复录入。`,
        okText: '知道了',
      });
      return;
    }

    const needsLines = parsed.needs_lines === true || !lines?.length;
    const lineCount = lines?.length ?? 0;
    const supplierHint = String(parsed.supplier_match_hint ?? '').trim();
    if (supplierId) {
      messageApi.success(
        needsLines
          ? `已识别供应商，${String(parsed.line_parse_hint ?? '请补录明细行')}`
          : `解析成功，已识别供应商与 ${lineCount} 行明细`,
      );
    } else if (supplierName) {
      messageApi.warning(
        supplierHint || `已识别销售方「${supplierName}」，但未匹配到台账供应商，请手工选择`,
      );
    } else {
      messageApi.success(
        needsLines
          ? String(parsed.line_parse_hint ?? '已识别发票头信息，请选择供应商并补录明细行')
          : `解析成功，已识别 ${lineCount} 行明细，请确认供应商与明细`,
      );
    }
  };

  const handleParsePdf: UploadProps['beforeUpload'] = (file) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      messageApi.warning('请上传 PDF 格式的数电发票');
      return Upload.LIST_IGNORE;
    }
    void (async () => {
      setParseLoading(true);
      try {
        const parsed = await parseFinanceInvoicePdf(file, { excludeInvoiceId: editingInvoiceId });
        await applyParsedInvoice(parsed);
      } catch (e) {
        messageApi.error((e as Error).message || 'PDF 解析失败，请改用手工录入');
      } finally {
        setParseLoading(false);
      }
    })();
    return Upload.LIST_IGNORE;
  };

  const buildInvoiceCreatePayload = (values: Record<string, unknown>, rejectReason?: string) => {
    const linesRaw = (values.lines as Array<Record<string, unknown>>) ?? [];
    if (linesRaw.length === 0) {
      throw new Error('至少录入一条明细行');
    }
    const priceIndex = buildSupplierPriceSpecIndex(supplierPriceList);
    if (!rejectReason) {
      for (let i = 0; i < linesRaw.length; i += 1) {
        const ln = linesRaw[i];
        const cmp = compareInvoiceLineToSupplierPrice(ln, priceIndex);
        if (cmp.status === '差异') {
          throw new Error(
            `第 ${i + 1} 行规格「${String(ln.spec ?? '').trim()}」单价与价格清单不一致，请更改单价或整票拒收`,
          );
        }
      }
    }
    const { totalSum } = computeInvoiceLineTotals(linesRaw);
    return {
      supplier_id: Number(values.supplier_id),
      invoice_no: String(values.invoice_no ?? '').trim(),
      invoice_code: String(values.invoice_code ?? '').trim() || null,
      invoice_date: values.invoice_date
        ? dayjs(values.invoice_date as string | dayjs.Dayjs).format('YYYY-MM-DD')
        : null,
      total_amount: totalSum > 0 ? totalSum : null,
      qr_raw_text: String(values.qr_raw_text ?? '').trim() || null,
      remark: String(values.remark ?? '').trim() || null,
      reject_reason: rejectReason?.trim() || null,
      lines: linesRaw.map((ln, idx) => {
        const materialCode = resolveLineMaterialCode(ln);
        if (!materialCode) {
          throw new Error(`明细第 ${idx + 1} 行缺少规格或物料名称，无法匹配供应商单价`);
        }
        return {
          line_no: Number(ln.line_no ?? idx + 1),
          material_code: materialCode,
          material_name: String(ln.material_name ?? '').trim(),
          spec: String(ln.spec ?? '').trim() || null,
          unit: String(ln.unit ?? '').trim() || null,
          quantity: Number(ln.quantity ?? 0),
          invoice_unit_price: normalizeFinanceUnitPriceInput(ln.invoice_unit_price),
          tax_amount: ln.tax_amount != null && ln.tax_amount !== '' ? Number(ln.tax_amount) : null,
        };
      }),
    };
  };

  const submitInvoice = async (values: Record<string, unknown>) => {
    setCreateLoading(true);
    try {
      const payload = buildInvoiceCreatePayload(values);
      if (editingInvoiceId != null) {
        await updateFinanceInvoice(editingInvoiceId, payload);
        messageApi.success('发票已更新');
      } else {
        await createFinanceInvoice(payload);
        messageApi.success('发票已登记');
      }
      closeCreateModal();
      invoiceActionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '保存失败');
      throw e;
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRejectWholeInvoiceOnCreate = () => {
    const form = formRef.current;
    if (!form) return;
    modal.confirm({
      title: '拒收整张发票',
      content: (
        <Input.TextArea
          id="finance-invoice-create-reject-reason"
          rows={3}
          placeholder="请输入拒收原因（发票将保存为已拒收，须供应商重开）"
        />
      ),
      okText: '确认拒收',
      okButtonProps: { danger: true },
      onOk: async () => {
        const el = document.getElementById(
          'finance-invoice-create-reject-reason',
        ) as HTMLTextAreaElement | null;
        const reason = el?.value?.trim() ?? '';
        if (!reason) {
          messageApi.warning('请填写拒收原因');
          throw new Error('empty');
        }
        setCreateLoading(true);
        try {
          const values = form.getFieldsValue(true) as Record<string, unknown>;
          await form.validateFields();
          const payload = buildInvoiceCreatePayload(values, reason);
          if (editingInvoiceId != null) {
            await updateFinanceInvoice(editingInvoiceId, payload);
          } else {
            await createFinanceInvoice(payload);
          }
          messageApi.success('发票已保存为已拒收');
          closeCreateModal();
          invoiceActionRef.current?.reload();
        } catch (e) {
          if ((e as Error).message === 'empty') throw e;
          messageApi.error((e as Error).message || '拒收保存失败');
          throw e;
        } finally {
          setCreateLoading(false);
        }
      },
    });
  };

  const openInvoiceDetail = async (record: FinanceInvoiceRow) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const full = await getFinanceInvoice(record.id);
      setDetailInvoice(full);
    } catch (e) {
      messageApi.error((e as Error).message || '加载失败');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const detailCanReject =
    Boolean(detailInvoice) &&
    (detailInvoice!.status === '已登记' || detailInvoice!.status === '待核对') &&
    perms.canUpdate;

  const handleRejectInvoice = () => {
    if (!detailInvoice) return;
    modal.confirm({
      title: '拒收发票',
      content: (
        <Input.TextArea
          id="finance-invoice-reject-reason"
          rows={3}
          placeholder="请输入拒收原因"
        />
      ),
      onOk: async () => {
        const el = document.getElementById('finance-invoice-reject-reason') as HTMLTextAreaElement | null;
        const reason = el?.value?.trim() ?? '';
        if (!reason) {
          messageApi.warning('请填写拒收原因');
          throw new Error('empty');
        }
        await rejectFinanceInvoice(detailInvoice.id, { reject_reason: reason });
        messageApi.success('已拒收');
        setDetailOpen(false);
        invoiceActionRef.current?.reload();
      },
    });
  };

  const handlePrintAcceptanceFromInvoice = async (record: FinanceInvoiceRow) => {
    if (record.status === '已拒收') {
      messageApi.warning('已拒收发票不可打印验收单');
      return;
    }
    setPrintAcceptanceLoadingId(record.id);
    try {
      const acc = await getOrCreateFinanceAcceptanceFromInvoice(record.id);
      setPrintAcceptanceId(acc.id);
      setPrintAcceptanceTitle(`材料验收单 · ${acc.sheet_no}`);
      setPrintAcceptanceOpen(true);
      invoiceActionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || '生成验收单失败');
    } finally {
      setPrintAcceptanceLoadingId(null);
    }
  };

  const invoiceColumns: ProColumns<FinanceInvoiceRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '发票号码 / 代码' },
    },
    {
      title: '状态',
      dataIndex: 'status',
      hideInTable: true,
      valueType: 'select',
      valueEnum: {
        已登记: { text: '已登记' },
        已验收: { text: '已验收' },
        已拒收: { text: '已拒收' },
      },
    },
    {
      title: '发票号码',
      dataIndex: 'invoice_no',
      width: 140,
      fixed: 'left',
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '明细条数',
      dataIndex: 'line_count',
      width: 90,
      hideInSearch: true,
      align: 'right',
      render: (_, r) => r.line_count ?? r.lines?.length ?? 0,
    },
    {
      title: '开票日期',
      dataIndex: 'invoice_date',
      width: 110,
      hideInSearch: true,
    },
    {
      title: '价税合计',
      dataIndex: 'total_amount',
      width: 110,
      hideInSearch: true,
      render: (_, r) => Number(r.total_amount).toFixed(2),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      hideInSearch: true,
      render: (_, r) => invoiceStatusTag(r.status),
    },
    haoligoDocumentCreatorColumn<FinanceInvoiceRow>(),
    {
      title: '操作',
      valueType: 'option',
      width: 240,
      fixed: 'right',
      render: (_, record) => {
        const editable = record.status === '已登记' || record.status === '待核对';
        const printable = record.status !== '已拒收';
        return [
          <Button
            key="view"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => void openInvoiceDetail(record)}
          >
            详情
          </Button>,
          editable && perms.canUpdate ? (
            <Button
              key="edit"
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => void openEditInvoice(record)}
            >
              编辑
            </Button>
          ) : null,
          printable && perms.canPrint ? (
            <Button
              key="print-acc"
              type="link"
              size="small"
              icon={<PrinterOutlined />}
              loading={printAcceptanceLoadingId === record.id}
              onClick={() => void handlePrintAcceptanceFromInvoice(record)}
            >
              打印验收单
            </Button>
          ) : null,
          editable && perms.canDelete ? (
            <Button
              key="del"
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '删除发票',
                  content: `确定删除发票 ${record.invoice_no}？`,
                  okType: 'danger',
                  onOk: async () => {
                    await deleteFinanceInvoice(record.id);
                    messageApi.success('已删除');
                    invoiceActionRef.current?.reload();
                  },
                });
              }}
            >
              删除
            </Button>
          ) : null,
        ].filter(Boolean);
      },
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<FinanceInvoiceRow>
          actionRef={invoiceActionRef}
          rowKey="id"
          columns={invoiceColumns}
          showAdvancedSearch
          showCreateButton
          createButtonText="录入发票"
          onCreate={openCreate}
          request={async (params) => {
            const rows = await listFinanceInvoices({
              keyword: String(params.keyword ?? '').trim() || undefined,
              status: String(params.status ?? '').trim() || undefined,
            });
            return { data: rows, success: true, total: rows.length };
          }}
          rowActionKind={rowActionKind.link}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editingInvoiceId != null ? '编辑发票' : '录入发票'}
        open={createOpen}
        onClose={closeCreateModal}
        afterOpenChange={(open) => {
          if (open && pendingCreateFormValues) {
            formRef.current?.setFieldsValue(pendingCreateFormValues);
            return;
          }
          if (!open) {
            setPendingCreateFormValues(null);
            formRef.current?.resetFields?.();
          }
        }}
        formRef={formRef}
        loading={createLoading}
        isEdit={editingInvoiceId != null}
        onFinish={submitInvoice}
        onValuesChange={(_, allValues) => {
          setCreateFormLines((allValues.lines as Record<string, unknown>[]) ?? []);
        }}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        extraFooterAfter={
          showCreateReject ? (
            <Button danger onClick={handleRejectWholeInvoiceOnCreate}>
              拒收
            </Button>
          ) : null
        }
      >
        <Typography.Paragraph type="secondary">
          上传数电发票 PDF，自动识别发票头与明细行。
        </Typography.Paragraph>
        <Space style={{ marginBottom: 16 }}>
          <Upload accept=".pdf,application/pdf" showUploadList={false} beforeUpload={handleParsePdf}>
            <Button icon={<FilePdfOutlined />} loading={parseLoading}>
              上传 PDF 解析
            </Button>
          </Upload>
        </Space>
        {unmatchedParsedSupplierName ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={`未在台账找到供应商「${unmatchedParsedSupplierName}」`}
            description={
              supplierPerms.canCreate
                ? '可在下方材料供应商下拉中选择「快速新建」当场维护，或点击右侧按钮直接创建。'
                : '请手工选择已有供应商，或联系管理员先在供应商台账维护。'
            }
            action={
              supplierPerms.canCreate ? (
                <Button
                  size="small"
                  type="primary"
                  onClick={() => supplierSelectRef.current?.openQuickCreate(unmatchedParsedSupplierName)}
                >
                  快速新建
                </Button>
              ) : undefined
            }
          />
        ) : null}
        <Row gutter={16}>
          <FinanceSupplierSelect
            ref={supplierSelectRef}
            colProps={{ span: 6 }}
            formRef={formRef}
            name="supplier_id"
            label="材料供应商"
            rules={[{ required: true, message: '请选择供应商' }]}
            extraOption={extraSupplierOption}
            quickCreateDefaultName={unmatchedParsedSupplierName}
            quickCreatePopoverZIndex={2100}
            onOptionsLoaded={setSuppliers}
            onChange={(value) => {
              if (value) {
                setUnmatchedParsedSupplierName('');
              }
              void reloadSupplierPrices(Number(value));
            }}
            onSupplierCreated={(row) => {
              setUnmatchedParsedSupplierName('');
              setExtraSupplierOption(null);
              void reloadSupplierPrices(row.id);
            }}
          />
          <Col span={6}>
            <ProFormText name="invoice_no" label="发票号码" rules={[{ required: true }]} />
          </Col>
          <Col span={6}>
            <ProFormText name="invoice_code" label="发票代码" />
          </Col>
          <Col span={6}>
            <ProFormDatePicker name="invoice_date" label="开票日期" width="100%" />
          </Col>
        </Row>
        <ProFormText name="qr_raw_text" hidden />
        <FormListDetailTable
          name="lines"
          label="发票明细"
          addButtonText="添加明细行"
          minRows={1}
          copyEnabled={false}
          tableScroll={false}
          defaultRow={() => {
            const list = (formRef.current?.getFieldValue('lines') as unknown[] | undefined) ?? [];
            return { line_no: list.length + 1, quantity: 1, quantity_decimals: 0, line_amount_decimals: 2, tax_amount_decimals: 2 };
          }}
          columns={[
            {
              title: '物料名称',
              key: 'material_name',
              width: '16%',
              render: (field) => (
                <ProFormText
                  name={[field.name, 'material_name']}
                  rules={[{ required: true, message: '必填' }]}
                  formItemProps={{ noStyle: true }}
                  fieldProps={{ style: { width: '100%' } }}
                />
              ),
            },
            {
              title: '规格',
              key: 'spec',
              width: '18%',
              render: (field) => (
                <ProFormText
                  name={[field.name, 'spec']}
                  rules={[{ required: true, message: '必填' }]}
                  formItemProps={{ noStyle: true }}
                  fieldProps={{ style: { width: '100%' } }}
                />
              ),
            },
            {
              title: '单位',
              key: 'unit',
              width: '7%',
              render: (field) => (
                <ProFormText
                  name={[field.name, 'unit']}
                  formItemProps={{ noStyle: true }}
                  fieldProps={{ style: { width: '100%' } }}
                />
              ),
            },
            {
              title: '数量',
              key: 'quantity',
              width: '10%',
              align: 'right',
              render: (field) => (
                <InvoiceLineScaleDigit
                  rowIndex={field.name}
                  fieldName="quantity"
                  scaleField="quantity_decimals"
                  defaultScale={0}
                  min={0}
                />
              ),
            },
            {
              title: '发票单价',
              key: 'invoice_unit_price',
              width: 200,
              align: 'right',
              render: (field) => <InvoiceLineUnitPriceInput rowIndex={field.name} />,
            },
            {
              title: '金额',
              key: 'line_amount',
              width: '12%',
              align: 'right',
              render: (field) => (
                <>
                  <ProFormDigit name={[field.name, 'line_amount']} hidden formItemProps={{ hidden: true }} />
                  <InvoiceLineAmountCell rowIndex={field.name} />
                </>
              ),
            },
            {
              title: '税额',
              key: 'tax_amount',
              width: '10%',
              align: 'right',
              render: (field) => (
                <InvoiceLineScaleDigit
                  rowIndex={field.name}
                  fieldName="tax_amount"
                  scaleField="tax_amount_decimals"
                  defaultScale={2}
                  min={0}
                />
              ),
            },
            {
              title: '比对结果',
              key: 'compare_result',
              width: '16%',
              render: (field) => (
                <InvoiceLineCompareCell
                  rowIndex={field.name}
                  priceIndex={supplierPriceIndex}
                  onReloadPrices={reloadSupplierPrices}
                  canUpdate={perms.canUpdate}
                />
              ),
            },
          ]}
          renderSummary={renderInvoiceLinesSummary}
        />
        <ProFormTextArea name="remark" label="备注" />
      </FormModalTemplate>

      <Modal
        title={detailInvoice ? `发票详情 · ${detailInvoice.invoice_no}` : '发票详情'}
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setDetailInvoice(null);
        }}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        styles={{ body: { overflowX: 'auto' } }}
        footer={
          <Space>
            {detailCanReject ? (
              <Button danger onClick={handleRejectInvoice}>
                拒收
              </Button>
            ) : null}
            <Button
              onClick={() => {
                setDetailOpen(false);
                setDetailInvoice(null);
              }}
            >
              关闭
            </Button>
          </Space>
        }
      >
        {detailInvoice ? (
          <>
            <Space style={{ marginBottom: 12 }} wrap size={[16, 8]}>
              {invoiceStatusTag(detailInvoice.status)}
              <Typography.Text type="secondary">销售方</Typography.Text>
              <Typography.Text>{detailInvoice.supplier_name}</Typography.Text>
              {detailInvoice.invoice_date ? (
                <>
                  <Typography.Text type="secondary">开票日期</Typography.Text>
                  <Typography.Text>{detailInvoice.invoice_date}</Typography.Text>
                </>
              ) : null}
              <Typography.Text type="secondary">价税合计</Typography.Text>
              <Typography.Text strong>
                ¥ {Number(detailInvoice.total_amount).toFixed(2)}
              </Typography.Text>
              <Typography.Text type="secondary">创建人</Typography.Text>
              <Typography.Text>{resolveHaoligoDocumentCreatorName(detailInvoice)}</Typography.Text>
            </Space>
            <Table
              size="small"
              rowKey="id"
              loading={detailLoading}
              dataSource={detailInvoice.lines ?? []}
              pagination={false}
              tableLayout="fixed"
              summary={(pageData) => {
                const rows = pageData as unknown as Record<string, unknown>[];
                const { amountSum, taxSum, totalSum } = computeInvoiceLineTotals(
                  rows.map((ln) => ({
                    ...ln,
                    invoice_unit_price: ln.invoice_unit_price,
                    quantity: ln.quantity,
                    tax_amount: ln.tax_amount,
                  })),
                );
                return (
                  <Table.Summary>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={5} align="right">
                        <Typography.Text strong>合计</Typography.Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={5} align="right">
                        <Typography.Text strong style={{ whiteSpace: 'nowrap' }}>
                          {amountSum.toFixed(2)}
                        </Typography.Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={6} />
                      <Table.Summary.Cell index={7} align="right">
                        <Typography.Text strong style={{ whiteSpace: 'nowrap' }}>
                          {taxSum.toFixed(2)}
                        </Typography.Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={8} />
                    </Table.Summary.Row>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={5} align="right">
                        <Typography.Text strong>价税合计（小写）</Typography.Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={5} colSpan={4} align="left">
                        <Typography.Text strong style={{ whiteSpace: 'nowrap' }}>
                          ¥ {Number(detailInvoice.total_amount || totalSum).toFixed(2)}
                        </Typography.Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
              columns={[
                {
                  title: '项目名称',
                  dataIndex: 'material_name',
                  width: '12%',
                  ellipsis: true,
                },
                {
                  title: '规格型号',
                  dataIndex: 'spec',
                  width: '14%',
                  ellipsis: true,
                  render: (v, row) => String(v || row.material_code || '').trim() || '—',
                },
                {
                  title: '单位',
                  dataIndex: 'unit',
                  width: 48,
                  render: (v) => v || '—',
                },
                {
                  title: '数量',
                  dataIndex: 'quantity',
                  width: 72,
                  align: 'right',
                  render: (v) => {
                    if (v == null || v === '') return '—';
                    const n = Number(v);
                    const text = Number.isFinite(n) ? String(n) : String(v);
                    return <span style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{text}</span>;
                  },
                },
                {
                  title: '单价',
                  dataIndex: 'invoice_unit_price',
                  width: 132,
                  align: 'right',
                  render: (v) => (
                    <span style={{ whiteSpace: 'nowrap', fontSize: 12 }} title={formatFinanceUnitPrice(v)}>
                      {formatFinanceUnitPrice(v)}
                    </span>
                  ),
                },
                {
                  title: '金额',
                  key: 'line_amount',
                  width: 88,
                  align: 'right',
                  render: (_, row) => {
                    const amount = lineAmountValue({
                      quantity: row.quantity,
                      invoice_unit_price: row.invoice_unit_price,
                    });
                    return <span style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{amount.toFixed(2)}</span>;
                  },
                },
                {
                  title: '税率',
                  key: 'tax_rate',
                  width: 52,
                  align: 'right',
                  render: (_, row) => {
                    const amount = lineAmountValue({
                      quantity: row.quantity,
                      invoice_unit_price: row.invoice_unit_price,
                    });
                    const tax = row.tax_amount != null ? Number(row.tax_amount) : NaN;
                    if (!(amount > 0) || !Number.isFinite(tax)) return '—';
                    const rate = Math.round((tax / amount) * 10000) / 100;
                    return <span style={{ whiteSpace: 'nowrap' }}>{`${rate}%`}</span>;
                  },
                },
                {
                  title: '税额',
                  dataIndex: 'tax_amount',
                  width: 80,
                  align: 'right',
                  render: (v) => (
                    <span style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                      {v != null ? Number(v).toFixed(2) : '—'}
                    </span>
                  ),
                },
                {
                  title: '比对',
                  dataIndex: 'line_status',
                  width: 72,
                  render: (v, row) => {
                    const status = String(v);
                    if (status === '差异' || status === '需改价') {
                      return (
                        <Space direction="vertical" size={0}>
                          {lineStatusTag(status)}
                          <Typography.Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                            清单 {formatFinanceUnitPrice(row.system_unit_price)}
                          </Typography.Text>
                        </Space>
                      );
                    }
                    return lineStatusTag(status);
                  },
                },
              ]}
            />
          </>
        ) : null}
      </Modal>

      <HaoligoDocumentPrintModal
        open={printAcceptanceOpen}
        onClose={() => {
          setPrintAcceptanceOpen(false);
          setPrintAcceptanceId(null);
        }}
        documentType="finance_material_acceptance"
        documentId={printAcceptanceId}
        title={printAcceptanceTitle}
      />
    </>
  );
};

export default FinanceInvoiceVerifyPage;

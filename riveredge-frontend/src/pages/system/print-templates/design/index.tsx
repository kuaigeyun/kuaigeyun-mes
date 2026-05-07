import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Button, Input, Space, Typography, Card, Select, InputNumber, Divider, ColorPicker, Radio, Checkbox, theme } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, EyeOutlined, QrcodeOutlined, DashOutlined, FontSizeOutlined, BoldOutlined, AlignCenterOutlined, AlignLeftOutlined, AlignRightOutlined, AppstoreOutlined, FunctionOutlined, OrderedListOutlined, SettingOutlined, ZoomInOutlined, ZoomOutOutlined, DeleteOutlined, VerticalAlignTopOutlined, VerticalAlignBottomOutlined, AppstoreAddOutlined, PlusOutlined, TableOutlined, BarcodeOutlined, PictureOutlined, HolderOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { compilePrintTemplate, compilePreviewPrintTemplate, getPrintTemplateByUuid, updatePrintTemplate } from '../../../../services/printTemplate';
import { getArrayTableTemplates, getTemplateVariableItems, type TemplateVariableItem } from '../../../../config/printTemplateSchemas';
import { useSiteLogoUrl } from '../../../../hooks/useSiteLogoUrl';
import { QRCodeSVG } from 'qrcode.react';
import {
  buildPrintTemplateDesignExport,
  parsePrintTemplateDesignImport,
  type PrintTemplateDesignPortableV1,
} from '../../../../utils/printTemplateDesignPortable';
import { SYSTEM_VIEWPORT_OFFSETS, getViewportHeightExpr } from '../../../../components/layout-templates/constants';

import {
  DndContext, 
  closestCenter,
  closestCorners,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
  useDraggable,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const { Title } = Typography;

type BlockStyle = {
  fontSize?: string;
  fontWeight?: string;
  textAlign?: string;
  color?: string;
  letterSpacing?: string;
};

/** {t('pages.system.printTemplatesDesign.compDetailTable')} table styles (compiled into HTML) */
type DetailTableStyle = {
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'none';
  cellPadding?: number;
  fontSize?: string;
  headerFontSize?: string;
  headerFontWeight?: string;
  headerBgColor?: string;
  headerTextColor?: string;
  bodyTextColor?: string;
  headerTextAlign?: 'left' | 'center' | 'right';
  bodyTextAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  zebraStripe?: boolean;
  zebraBgColor?: string;
  width?: string;
};

type DetailTableColumn = {
  key: string;
  label: string;
  type?: 'text' | 'image' | 'qrcode' | 'number';
  /** Decimal places when type is number, default 2 */
  precision?: number;
  width?: string;
  /** Use table style "Body Align" if not set */
  bodyTextAlign?: 'left' | 'center' | 'right';
  /** Use table style "Vertical Align" if not set */
  verticalAlign?: 'top' | 'middle' | 'bottom';
};

type DesignerNodeSchema =
  | { id: string; type: 'text'; content: string; tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'div'; style?: BlockStyle }
  | { id: string; type: 'field'; key: string; label: string; showLabel?: boolean; style?: BlockStyle }
  | { id: string; type: 'if'; condition: string; content: string }
  | { id: string; type: 'for'; item: string; collection: string; template: string }
  | { id: string; type: 'qrcode'; key: string; size: number; style?: BlockStyle }
  | { id: string; type: 'barcode'; key: string; format: string; height: number; style?: BlockStyle }
  | { id: string; type: 'image'; url: string; width: number; height: number; keepRatio?: boolean; style?: BlockStyle }
  | { id: string; type: 'spacer'; height: number }
  | { id: string; type: 'divider' }
  | { id: string; type: 'detail_table'; collection: string; row_alias: string; columns: DetailTableColumn[]; tableStyle?: DetailTableStyle }
  | {
      id: string;
      type: 'columns';
      horizontalAlign?: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
      verticalAlign?: 'top' | 'middle' | 'bottom' | 'stretch';
      cols: Array<{
        id: string;
        width: string;
        horizontalAlign?: 'start' | 'center' | 'end';
        verticalAlign?: 'top' | 'middle' | 'bottom' | 'stretch';
        blocks: DesignerNodeSchema[];
      }>;
    };

interface DesignerSchema {
  version: string;
  pageSize?: string;
  orientation?: 'portrait' | 'landscape';
  margins?: { top: number; right: number; bottom: number; left: number };
  itemSpacing?: number;
  tableRowLimit?: number;
  blocks: DesignerNodeSchema[];
}

const PAPER_SIZES: Record<string, { width: number; height: number; labelKey: string }> = {
  A4: { width: 210, height: 297, labelKey: 'pages.system.printTemplatesDesign.paperSizeA4' },
  A3: { width: 297, height: 420, labelKey: 'pages.system.printTemplatesDesign.paperSizeA3' },
  A5: { width: 148, height: 210, labelKey: 'pages.system.printTemplatesDesign.paperSizeA5' },
  'A4-2': { width: 210, height: 148.5, labelKey: 'pages.system.printTemplatesDesign.paperSizeA4_2' },
  'A4-3': { width: 210, height: 99, labelKey: 'pages.system.printTemplatesDesign.paperSizeA4_3' },
  '241-1': { width: 241, height: 280, labelKey: 'pages.system.printTemplatesDesign.paperSize241_1' },
  '241-2': { width: 241, height: 140, labelKey: 'pages.system.printTemplatesDesign.paperSize241_2' },
  '241-3': { width: 241, height: 93, labelKey: 'pages.system.printTemplatesDesign.paperSize241_3' },
};

/** Keep in sync with `_PRINT_TEMPLATE_BODY_FONT_STACK` in print_template_service.py */
const PRINT_TEMPLATE_BODY_FONT_STACK =
  "'Noto Sans CJK SC', 'Noto Sans SC', 'Source Han Sans SC', " +
  "'WenQuanYi Micro Hei', 'WenQuanYi Zen Hei', 'Microsoft YaHei', " +
  "'PingFang SC', 'Hiragino Sans GB', " +
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, " +
  "'Helvetica Neue', Helvetica, Arial, sans-serif";

type SamplePreset = { key: string; label: string; data: Record<string, any> };

const getSamplePresetsByDocType = (t: any, docType: string): SamplePreset[] => {
  const QUOTATION_SAMPLE_PRESETS: SamplePreset[] = [
    {
      key: 'quotation-short',
      label: t('pages.system.printTemplatesDesign.sampleQuotationShort'),
      data: {
      quotation_code: 'BJ-2026-0001',
      customer_name: t('pages.system.printTemplatesDesign.sampleCustomer1'),
      quotation_date: '2026-04-25',
      total_amount: 12345.67,
      notes: t('pages.system.printTemplatesDesign.sampleNotes1'),
      items: [
        {
          material_code: 'MAT-001',
          material_name: t('pages.system.printTemplatesDesign.sampleMaterial1'),
          material_spec: 'A356-T6',
          material_unit: t('pages.system.printTemplatesDesign.sampleUnit1'),
          quote_quantity: 100,
          unit_price: 12.34,
          total_amount: 1234,
        },
      ],
    },
  },
  {
    key: 'quotation-long',
    label: t('pages.system.printTemplatesDesign.sampleQuotationLong'),
    data: {
      quotation_code: 'BJ-2026-0099',
      customer_name: t('pages.system.printTemplatesDesign.sampleCustomer2'),
      quotation_date: '2026-04-25',
      total_amount: 286420.5,
      notes: t('pages.system.printTemplatesDesign.sampleNotes2'),
      items: Array.from({ length: 35 }).map((_, i) => ({
        material_code: `MAT-${String(i + 1).padStart(3, '0')}`,
        material_name: `${t('pages.system.printTemplatesDesign.sampleMaterial4')}-${i + 1}`,
        material_spec: `${t('pages.system.printTemplatesDesign.sampleSpec')}-${(i % 7) + 1}`,
        material_unit: t('pages.system.printTemplatesDesign.sampleUnit1'),
        quote_quantity: (i + 1) * 3,
        unit_price: Number((8.6 + i * 0.37).toFixed(2)),
        total_amount: Number((((i + 1) * 3) * (8.6 + i * 0.37)).toFixed(2)),
      })),
    },
  },
  {
    key: 'quotation-notes',
    label: t('pages.system.printTemplatesDesign.sampleQuotationNotes'),
    data: {
      quotation_code: 'BJ-2026-0108',
      customer_name: t('pages.system.printTemplatesDesign.sampleCustomer3'),
      quotation_date: '2026-04-25',
      total_amount: 56432,
      notes: t('pages.system.printTemplatesDesign.sampleNotes3'),
      items: [
        {
          material_code: 'MAT-110',
          material_name: t('pages.system.printTemplatesDesign.sampleMaterial2'),
          material_spec: 'CP-20',
          material_unit: t('pages.system.printTemplatesDesign.sampleUnit2'),
          quote_quantity: 20,
          unit_price: 688.5,
          total_amount: 13770,
        },
        {
          material_code: 'MAT-111',
          material_name: t('pages.system.printTemplatesDesign.sampleMaterial3'),
          material_spec: 'BR-07',
          material_unit: t('pages.system.printTemplatesDesign.sampleUnit2'),
          quote_quantity: 50,
          unit_price: 293.24,
          total_amount: 14662,
        },
      ],
      page_num: 1,
      total_pages: 1,
      logo: 'https://img.alicdn.com/tfs/TB1.77Ag8r0gK0jSZFnXXbRRXXa-200-200.png'
    },
  },
];

const SALES_ORDER_SAMPLE_PRESETS: SamplePreset[] = [
  {
    key: 'sales-order-default',
    label: t('pages.system.printTemplatesDesign.sampleSalesOrder'),
    data: {
      order_code: 'SO-2026-0012',
      customer_name: t('pages.system.printTemplatesDesign.sampleCustomer4'),
      order_date: '2026-04-25',
      delivery_date: '2026-05-03',
      total_amount: 98650.2,
      notes: t('pages.system.printTemplatesDesign.sampleNotes4'),
      items: [
        { material_code: 'SOM-001', material_name: t('pages.system.printTemplatesDesign.sampleMaterial5'), material_spec: 'DZ-01', material_unit: t('pages.system.printTemplatesDesign.sampleUnit1'), order_quantity: 50, unit_price: 320, total_amount: 16000 },
        { material_code: 'SOM-002', material_name: t('pages.system.printTemplatesDesign.sampleMaterial6'), material_spec: 'DW-09', material_unit: t('pages.system.printTemplatesDesign.sampleUnit1'), order_quantity: 80, unit_price: 180.5, total_amount: 14440 },
      ],
    },
  },
];

const PURCHASE_ORDER_SAMPLE_PRESETS: SamplePreset[] = [
  {
    key: 'purchase-order-default',
    label: t('pages.system.printTemplatesDesign.samplePurchaseOrder'),
    data: {
      order_code: 'PO-2026-0038',
      supplier_name: t('pages.system.printTemplatesDesign.sampleSupplier1'),
      order_date: '2026-04-25',
      required_date: '2026-05-08',
      total_amount: 46320,
      notes: t('pages.system.printTemplatesDesign.sampleNotes5'),
      items: [
        { material_code: 'POM-001', material_name: t('pages.system.printTemplatesDesign.sampleMaterial7'), material_spec: '304-2mm', material_unit: t('pages.system.printTemplatesDesign.sampleUnit3'), ordered_quantity: 120, unit_price: 132, total_amount: 15840 },
        { material_code: 'POM-002', material_name: t('pages.system.printTemplatesDesign.sampleMaterial8'), material_spec: 'M8*20', material_unit: t('pages.system.printTemplatesDesign.sampleUnit4'), ordered_quantity: 5000, unit_price: 2.1, total_amount: 10500 },
      ],
    },
  },
];

const COMMON_SAMPLE_PRESETS: SamplePreset[] = [
  {
    key: 'common-default',
    label: t('pages.system.printTemplatesDesign.sampleCommon'),
    data: {
      code: 'DOC-2026-0001',
      name: t('pages.system.printTemplatesDesign.sampleName1'),
      date: '2026-04-25',
      total_amount: 0,
      notes: t('pages.system.printTemplatesDesign.sampleNotes6'),
      items: [{ item_code: 'ITEM-001', item_name: t('pages.system.printTemplatesDesign.sampleItemName1'), quantity: 1, unit_price: 0, total_amount: 0 }],
      page_num: 1,
      total_pages: 1,
      logo: 'https://img.alicdn.com/tfs/TB1.77Ag8r0gK0jSZFnXXbRRXXa-200-200.png'
    },
  },
];

  if (docType === 'quotation') return QUOTATION_SAMPLE_PRESETS;
  if (docType === 'sales_order') return SALES_ORDER_SAMPLE_PRESETS;
  if (docType === 'purchase_order') return PURCHASE_ORDER_SAMPLE_PRESETS;
  return COMMON_SAMPLE_PRESETS;
};

type VariableCategory = {
  title: string;
  items: TemplateVariableItem[];
};

const groupVariables = (t: any, items: TemplateVariableItem[]): VariableCategory[] => {
  const groups: Record<string, VariableCategory> = {
    header: { title: t('pages.system.printTemplatesDesign.groupHeader'), items: [] },
    financial: { title: t('pages.system.printTemplatesDesign.groupFinancial'), items: [] },
    items: { title: t('pages.system.printTemplatesDesign.groupItems'), items: [] },
    other: { title: t('pages.system.printTemplatesDesign.groupOther'), items: [] },
  };

  items.forEach((item) => {
    const k = item.key.toLowerCase();
    if (k.includes('code') || k.includes('date') || k.includes('name') || k.includes('customer') || k.includes('supplier')) {
      groups.header.items.push(item);
    } else if (k.includes('amount') || k.includes('price') || k.includes('tax') || k.includes('currency') || k.includes('total')) {
      groups.financial.items.push(item);
    } else if (k.includes('items') || k.includes('line')) {
      groups.items.items.push(item);
    } else {
      groups.other.items.push(item);
    }
  });

  return Object.values(groups).filter((g) => g.items.length > 0);
};

const normalizeFontSize = (size?: string) => {
  if (!size) return undefined;
  if (/^\d+$/.test(size)) return `${size}px`;
  return size;
};

const DETAIL_TABLE_STYLE_DEFAULTS: Required<DetailTableStyle> = {
  borderWidth: 1,
  borderColor: '#e2e8f0',
  borderStyle: 'solid',
  cellPadding: 8,
  fontSize: '13px',
  headerFontSize: '13px',
  headerFontWeight: '600',
  headerBgColor: '#f8fafc',
  headerTextColor: '#475569',
  bodyTextColor: '#334155',
  headerTextAlign: 'left',
  bodyTextAlign: 'left',
  verticalAlign: 'top',
  zebraStripe: false,
  zebraBgColor: '#fafafa',
  width: '100%',
};

function resolveDetailTableStyle(ts?: DetailTableStyle): Required<DetailTableStyle> {
  return { ...DETAIL_TABLE_STYLE_DEFAULTS, ...ts };
}

const TextBlock: React.FC<{ block: DesignerNodeSchema & { type: 'text' }; selected?: boolean; onSelect?: () => void }> = ({ block, selected, onSelect }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { content, style, tag = 'div' } = block;
  const Tag = tag as any;
  return (
    <div
      style={{
        padding: 10,
        border: selected ? `1px solid ${token.colorPrimary}` : `1px dashed ${token.colorBorderSecondary}`,
        borderRadius: 6,
        marginBottom: 0,
        background: token.colorBgContainer,
        textAlign: (style?.textAlign as React.CSSProperties['textAlign']) || 'left',
        color: style?.color || 'inherit',
        letterSpacing: style?.letterSpacing || 'normal',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
    >
      <Tag style={{ 
        margin: 0, 
        fontSize: normalizeFontSize(style?.fontSize) || (tag === 'div' ? 'inherit' : undefined), 
        fontWeight: style?.fontWeight || (tag === 'div' ? 'normal' : undefined), 
        textAlign: 'inherit', 
        color: style?.color || 'inherit', 
        whiteSpace: 'pre-wrap',
        display: 'block',
        width: '100%',
        wordBreak: 'break-all'
      }}>
        {content || t('pages.system.printTemplatesDesign.blockText')}
      </Tag>
    </div>
  );
};

const FieldBlock: React.FC<{ block: DesignerNodeSchema & { type: 'field' }; selected?: boolean; onSelect?: () => void }> = ({ block, selected, onSelect }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { key: fieldKey, label, style, showLabel = true } = block;
  return (
    <div
      style={{
        padding: 10,
        border: selected ? `1px solid ${token.colorPrimary}` : `1px solid ${token.colorPrimaryBorder}`,
        borderRadius: 6,
        marginBottom: 0,
        background: token.colorPrimaryBg,
        fontSize: normalizeFontSize(style?.fontSize) || 'inherit',
        fontWeight: style?.fontWeight || 'bold',
        textAlign: (style?.textAlign as React.CSSProperties['textAlign']) || 'left',
        color: style?.color || token.colorPrimary,
        letterSpacing: style?.letterSpacing || 'normal',
        position: 'relative'
      }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
    >
      <div style={{ display: 'block', width: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 'inherit', fontWeight: 'inherit' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600 }}>{label || fieldKey}</div>
          {!showLabel && (
            <div style={{ fontSize: 9, background: token.colorPrimaryBgHover, color: token.colorPrimary, padding: '1px 4px', borderRadius: 4 }}>{t('pages.system.printTemplatesDesign.valueOnly')}</div>
          )}
        </div>
        <div style={{ fontFamily: 'monospace', opacity: 0.8 }}>
          {showLabel ? `${label || fieldKey}：{{ ${fieldKey} }}` : `{{ ${fieldKey} }}`}
        </div>
      </div>
    </div>
  );
};

const DividerBlock: React.FC<{ selected?: boolean; onSelect?: () => void }> = ({ selected, onSelect }) => {
  return (
    <div
      style={{
        padding: '12px 10px',
        border: selected ? '1px solid #1677ff' : '1px transparent solid',
        borderRadius: 6,
        cursor: 'pointer',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
    >
      <Divider style={{ margin: 0 }} />
    </div>
  );
};




const BarcodeBlock: React.FC<{ block: DesignerNodeSchema & { type: 'barcode' }; selected?: boolean; onSelect?: () => void }> = ({ block, selected, onSelect }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        padding: 10,
        border: selected ? `1px solid ${token.colorPrimary}` : `1px dashed ${token.colorBorderSecondary}`,
        borderRadius: 6,
        marginBottom: 0,
        background: token.colorBgContainer,
        textAlign: (block.style?.textAlign as React.CSSProperties['textAlign']) || 'center',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
    >
      <div style={{ display: 'inline-block', padding: 8, border: `1px solid ${token.colorBorderSecondary}` }}>
        <div style={{ height: block.height || 40, width: 150, background: token.colorFillTertiary, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${token.colorBorder}` }}>
          <DashOutlined style={{ fontSize: 24, opacity: 0.5 }} />
          <span style={{ fontSize: 10, marginLeft: 4 }}>Barcode Preview</span>
        </div>
        <div style={{ fontSize: 10, color: token.colorTextSecondary, marginTop: 4 }}>{block.format}: {block.key}</div>
      </div>
    </div>
  );
};

const ImageBlock: React.FC<{ block: DesignerNodeSchema & { type: 'image' }; selected?: boolean; onSelect?: () => void }> = ({ block, selected, onSelect }) => {
  const { token } = theme.useToken();
  // Placeholders like {{ logo }} / {{ company_logo }} will be replaced by the backend with the site logo;
  // In the designer, we use the current site logo URL for a WYSIWYG experience.
  const siteLogoUrl = useSiteLogoUrl();
  const rawUrl = block.url || '';
  const previewUrl = /\{\{\s*(logo|company_logo)\s*\}\}/i.test(rawUrl) ? siteLogoUrl : rawUrl;
  return (
    <div
      style={{
        padding: 10,
        border: selected ? `1px solid ${token.colorPrimary}` : `1px dashed ${token.colorBorderSecondary}`,
        borderRadius: 6,
        marginBottom: 0,
        background: token.colorBgContainer,
        textAlign: (block.style?.textAlign as React.CSSProperties['textAlign']) || 'left',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
    >
      <div style={{ display: 'inline-block', maxWidth: '100%' }}>
        {previewUrl ? (
          <img 
            src={previewUrl} 
            alt="Logo" 
            style={{ 
              width: block.width, 
              height: block.keepRatio ? 'auto' : block.height, 
              objectFit: 'contain' 
            }} 
          />
        ) : (
          <div style={{ width: block.width || 100, height: block.height || 60, background: token.colorFillTertiary, border: `1px dashed ${token.colorBorderSecondary}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: token.colorTextQuaternary }}>
            <PictureOutlined style={{ fontSize: 24, marginBottom: 4 }} />
            <span style={{ fontSize: 10 }}>IMAGE / LOGO</span>
          </div>
        )}
      </div>
    </div>
  );
};

const SpacerBlock: React.FC<{ block: DesignerNodeSchema & { type: 'spacer' }; selected?: boolean; onSelect?: () => void }> = ({ block, selected, onSelect }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  return (
    <div
      style={{
        height: block.height || 20,
        border: selected ? `1px solid ${token.colorPrimary}` : `1px dashed ${token.colorBorderSecondary}`,
        borderRadius: 4,
        background: selected ? token.colorPrimaryBg : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        color: token.colorTextQuaternary,
        cursor: 'pointer',
        marginBottom: 0,
        transition: 'all 0.2s'
      }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
    >
      <VerticalAlignTopOutlined style={{ marginRight: 4 }} />
      <span>{t('pages.system.printTemplatesDesign.verticalSpacing', { height: block.height })}</span>
      <VerticalAlignBottomOutlined style={{ marginLeft: 4 }} />
    </div>
  );
};

const DragOverlayBlock: React.FC<{ type: string; label?: string }> = ({ type, label }) => {
  const iconMap: Record<string, React.ReactNode> = {
    text: <FontSizeOutlined />,
    field: <FunctionOutlined />,
    divider: <DashOutlined />,
    qrcode: <QrcodeOutlined />,
    barcode: <BarcodeOutlined />,
    image: <PictureOutlined />,
    spacer: <VerticalAlignBottomOutlined />,
    columns: <AppstoreOutlined />,
    detail_table: <TableOutlined />,
    if: <FunctionOutlined />,
    for: <FunctionOutlined />,
  };

  return (
    <div style={{
      width: 42,
      height: 42,
      background: '#1677ff',
      color: '#fff',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 6px 16px rgba(22, 119, 255, 0.4)',
      fontSize: 20,
      opacity: 0.95,
      cursor: 'grabbing',
      transform: 'translate(-50%, -50%)', // Centered on the pointer/handle
      pointerEvents: 'none',
      border: '2px solid #fff',
      zIndex: 1000
    }}>
      {iconMap[type] || <AppstoreAddOutlined />}
    </div>
  );
};

const SortableBlockWrapper: React.FC<{ 
  id: string; 
  type?: string;
  marginBottom?: number | string;
  children: React.ReactNode;
}> = ({ id, type, marginBottom = 8, children }) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({ 
    id,
    data: { type: 'block' }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
    opacity: isDragging ? 0.4 : 1, // Ghost state
    position: 'relative' as const,
    marginBottom: marginBottom,
    display: 'flex',
    alignItems: 'center',
    // Professional Insertion Line Indicator
    borderTop: (isOver && !isDragging) ? '3px solid #1677ff' : '3px solid transparent',
    paddingTop: (isOver && !isDragging) ? 4 : 0,
    transitionProperty: 'transform, opacity, border, padding',
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-block-wrapper">
      {/* Drag handle — top-right, inside the block, visible on hover */}
      <div 
        {...attributes} 
        {...listeners} 
        className="drag-handle"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          opacity: 0,
          transition: 'all 0.2s',
          padding: '4px 6px',
          position: 'absolute',
          left: -32,
          top: type === 'columns' ? 8 : '50%', // Special top-left position for column containers
          transform: type === 'columns' ? 'none' : 'translateY(-50%)',
          color: '#8c8c8c',
          background: '#f0f0f0',
          borderRadius: 4,
          border: '1px solid #d9d9d9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          fontSize: 12,
          userSelect: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
        title={t('pages.system.printTemplatesDesign.dragToReorder')}
      >
        <span style={{ letterSpacing: 1, lineHeight: 1, display: 'block' }}>⠿</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
      <style>{`
        .sortable-block-wrapper:hover .drag-handle {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};


const DraggableSidebarItem: React.FC<{ 
  type: string; 
  label: string; 
  icon: React.ReactNode;
  onClick: () => void;
  payload?: any;
}> = ({ type, label, icon, onClick, payload }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `sidebar-${type}-${payload?.key || payload?.collection || label}`,
    data: { type: 'sidebar-item', blockType: type, payload }
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: 1000,
    opacity: 0.8,
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Button 
        block 
        onClick={onClick} 
        style={{ 
          height: 64, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: 4,
          padding: '8px 4px',
          fontSize: 12,
          borderRadius: 8
        }}
      >
        <div style={{ fontSize: 20, color: '#1677ff' }}>{icon}</div>
        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center', color: '#595959' }}>
          {label}
        </div>
      </Button>
    </div>
  );
};



const LogicBlock: React.FC<{
  title: string;
  body: string;
  selected?: boolean;
  onSelect?: () => void;
  extra?: React.ReactNode;
}> = ({ title, body, selected, onSelect, extra }) => {
  return (
    <div
      style={{
        padding: 10,
        border: selected ? '1px solid #1677ff' : '1px solid #d9d9d9',
        borderRadius: 6,
        marginBottom: 0,
        background: '#fff7e6',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ fontFamily: 'monospace', color: '#595959', whiteSpace: 'pre-wrap' }}>{body}</div>
      {extra}
    </div>
  );
};

function columnAlignResolved(
  col: DetailTableColumn,
  defaults: Required<DetailTableStyle>,
): { headerTextAlign: 'left' | 'center' | 'right'; bodyTextAlign: 'left' | 'center' | 'right'; verticalAlign: 'top' | 'middle' | 'bottom' } {
  const bt = col.bodyTextAlign;
  const va = col.verticalAlign;
  return {
    headerTextAlign: defaults.headerTextAlign,
    bodyTextAlign: bt === 'left' || bt === 'center' || bt === 'right' ? bt : defaults.bodyTextAlign,
    verticalAlign: va === 'top' || va === 'middle' || va === 'bottom' ? va : defaults.verticalAlign,
  };
}

function formatDetailTableNumberPreview(precision?: number): string {
  const d =
    precision !== undefined && Number.isFinite(precision) && precision >= 0 && precision <= 12
      ? Math.floor(precision)
      : 2;
  return (12345.678).toFixed(d);
}

const DetailTableMiniPreview: React.FC<{ tableStyle?: DetailTableStyle; columns: DetailTableColumn[] }> = ({
  tableStyle,
  columns,
}) => {
  const { t } = useTranslation();
  const s = resolveDetailTableStyle(tableStyle);
  const keyed = columns.filter((c) => (c.key || '').trim());
  const labels =
    keyed.length > 0
      ? keyed.map((c) => (c.label || c.key).trim() || '—')
      : [t('pages.system.printTemplatesDesign.noCols')];
  const borderCss =
    s.borderStyle === 'none' ? undefined : `${s.borderWidth}px ${s.borderStyle} ${s.borderColor}`;
  const thBase: React.CSSProperties = {
    border: borderCss,
    padding: s.cellPadding,
    fontSize: normalizeFontSize(s.headerFontSize) || s.headerFontSize,
    fontWeight: s.headerFontWeight as React.CSSProperties['fontWeight'],
    backgroundColor: s.headerBgColor,
    color: s.headerTextColor,
    wordBreak: 'break-word',
  };
  const tdBase: React.CSSProperties = {
    border: borderCss,
    padding: s.cellPadding,
    fontSize: normalizeFontSize(s.fontSize) || s.fontSize,
    color: s.bodyTextColor,
    wordBreak: 'break-word',
  };

  const alignAt = (idx: number) =>
    keyed[idx]
      ? columnAlignResolved(keyed[idx], s)
      : {
          headerTextAlign: s.headerTextAlign,
          bodyTextAlign: s.bodyTextAlign,
          verticalAlign: s.verticalAlign,
        };

  return (
    <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>{t('pages.system.printTemplatesDesign.stylePreview')}</div>
      <div style={{ overflow: 'auto', maxHeight: 220, background: '#fff' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: borderCss,
            tableLayout: 'auto',
            borderRadius: 0,
          }}
        >
          {keyed.length > 0 && (
            <colgroup>
              {keyed.map((col, i) => (
                <col key={col.key || i} style={col.width ? { width: col.width } : undefined} />
              ))}
            </colgroup>
          )}
          <thead>
            <tr>
              {labels.map((lb, i) => {
                const al = alignAt(i);
                return (
                  <th key={i} style={{ ...thBase, textAlign: al.headerTextAlign, verticalAlign: al.verticalAlign }}>
                    {lb}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr style={{ backgroundColor: 'transparent' }}>
              {labels.map((_, i) => {
                const al = alignAt(i);
                const col = keyed[i];
                const sample =
                  col?.type === 'number'
                    ? formatDetailTableNumberPreview(col.precision)
                    : '…';
                return (
                  <td key={i} style={{ ...tdBase, textAlign: al.bodyTextAlign, verticalAlign: al.verticalAlign }}>
                    {sample}
                  </td>
                );
              })}
            </tr>
            {s.zebraStripe && (
              <tr style={{ backgroundColor: s.zebraBgColor }}>
                {labels.map((_, i) => {
                  const al = alignAt(i);
                  const col = keyed[i];
                  const sample =
                    col?.type === 'number'
                      ? formatDetailTableNumberPreview(col.precision)
                      : '…';
                  return (
                    <td key={i} style={{ ...tdBase, textAlign: al.bodyTextAlign, verticalAlign: al.verticalAlign }}>
                      {sample}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const OrientationSelector: React.FC<{
  value: 'portrait' | 'landscape';
  onChange: (val: 'portrait' | 'landscape') => void;
}> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const options = [
    { key: 'portrait', label: t('pages.system.printTemplatesDesign.orientationPortrait'), icon: <div style={{ width: 14, height: 20, border: `2px solid currentColor`, borderRadius: 2 }} /> },
    { key: 'landscape', label: t('pages.system.printTemplatesDesign.orientationLandscape'), icon: <div style={{ width: 20, height: 14, border: `2px solid currentColor`, borderRadius: 2 }} /> }
  ];

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {options.map(opt => {
        const isActive = value === opt.key;
        return (
          <div
            key={opt.key}
            onClick={() => onChange(opt.key as any)}
            style={{
              flex: 1,
              padding: '12px 8px',
              border: `2px solid ${isActive ? token.colorPrimary : token.colorBorderSecondary}`,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              background: isActive ? token.colorPrimaryBg : token.colorBgContainer,
              color: isActive ? token.colorPrimary : token.colorTextSecondary,
              transition: 'all 0.3s'
            }}
          >
            {opt.icon}
            <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400 }}>{opt.label}</span>
          </div>
        );
      })}
    </div>
  );
};

const PaperRuler: React.FC<{ orientation: 'horizontal' | 'vertical'; size: number }> = ({ orientation, size }) => {
  const { token } = theme.useToken();
  const ticks: React.ReactNode[] = [];
  // Render labels every 20mm to avoid overlap
  for (let i = 0; i <= size; i += 20) {
    ticks.push(
      <div 
        key={i} 
        style={{ 
          position: 'absolute', 
          [orientation === 'horizontal' ? 'left' : 'top']: `${i}mm`,
          fontSize: 9,
          color: token.colorTextTertiary,
          lineHeight: '1',
          padding: 2
        }}
      >
        {i}
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      top: orientation === 'horizontal' ? 0 : '10mm',
      left: orientation === 'horizontal' ? '10mm' : 0,
      [orientation === 'horizontal' ? 'width' : 'height']: `${size}mm`,
      [orientation === 'horizontal' ? 'height' : 'width']: '10mm',
      background: token.colorFillQuaternary,
      border: `1px solid ${token.colorBorderSecondary}`,
      boxSizing: 'border-box',
      backgroundImage: orientation === 'horizontal' 
        ? `repeating-linear-gradient(90deg, ${token.colorBorderSecondary} 0, ${token.colorBorderSecondary} 1px, transparent 1px, transparent 1mm),
           repeating-linear-gradient(90deg, ${token.colorTextTertiary} 0, ${token.colorTextTertiary} 1px, transparent 1px, transparent 5mm),
           repeating-linear-gradient(90deg, ${token.colorTextSecondary} 0, ${token.colorTextSecondary} 1px, transparent 1px, transparent 10mm)`
        : `repeating-linear-gradient(180deg, ${token.colorBorderSecondary} 0, ${token.colorBorderSecondary} 1px, transparent 1px, transparent 1mm),
           repeating-linear-gradient(180deg, ${token.colorTextTertiary} 0, ${token.colorTextTertiary} 1px, transparent 1px, transparent 5mm),
           repeating-linear-gradient(180deg, ${token.colorTextSecondary} 0, ${token.colorTextSecondary} 1px, transparent 1px, transparent 10mm)`,
      backgroundSize: orientation === 'horizontal' ? 'auto 4px, auto 8px, auto 12px' : '4px auto, 8px auto, 12px auto',
      backgroundPosition: orientation === 'horizontal' ? 'bottom' : 'right',
      backgroundRepeat: orientation === 'horizontal' ? 'repeat-x' : 'repeat-y',
    }}>
      {ticks}
    </div>
  );
};

const SortableTableColumnItem: React.FC<{
  id: string;
  index: number;
  col: DetailTableColumn;
  onUpdate: (index: number, partial: Partial<DetailTableColumn>) => void;
  onRemove: (index: number) => void;
}> = ({ id, index, col, onUpdate, onRemove }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const outerStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    marginBottom: 10,
    background: isDragging ? token.colorPrimaryBg : token.colorBgContainer,
    zIndex: isDragging ? 10 : 1,
    position: 'relative',
    borderRadius: 4,
    border: `1px solid ${token.colorBorderSecondary}`,
    padding: '8px 10px',
  };

  const miniLabel = { marginBottom: 2, fontSize: 11, color: token.colorTextSecondary } as const;

  return (
    <div ref={setNodeRef} style={outerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: token.colorTextQuaternary, padding: '2px 4px' }}
        >
          <HolderOutlined />
        </div>
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => onRemove(index)} />
      </div>
      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
        <div style={{ width: '100%' }}>
          <div style={miniLabel}>{t('pages.system.printTemplatesDesign.colName')}</div>
          <Input
            size="small"
            placeholder={t('pages.system.printTemplatesDesign.colPlaceholder')}
            value={col.label}
            onChange={(e) => onUpdate(index, { label: e.target.value })}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ width: '100%' }}>
          <div style={miniLabel}>{t('pages.system.printTemplatesDesign.colKey')}</div>
          <Input
            size="small"
            placeholder={t('pages.system.printTemplatesDesign.keyPlaceholder')}
            value={col.key}
            onChange={(e) => onUpdate(index, { key: e.target.value })}
            style={{ width: '100%', fontFamily: 'monospace' }}
          />
        </div>
        <div style={{ width: '100%' }}>
          <div style={miniLabel}>{t('pages.system.printTemplatesDesign.colType')}</div>
          <Select
            size="small"
            value={col.type || 'text'}
            onChange={(val) => {
              if (val === 'number') {
                onUpdate(index, { type: val, precision: col.precision ?? 2 });
              } else {
                onUpdate(index, { type: val, precision: undefined });
              }
            }}
            style={{ width: '100%' }}
            options={[
              { label: t('pages.system.printTemplatesDesign.typeText'), value: 'text' },
              { label: t('pages.system.printTemplatesDesign.typeNumber'), value: 'number' },
              { label: t('pages.system.printTemplatesDesign.typeImage'), value: 'image' },
              { label: t('pages.system.printTemplatesDesign.typeQRCode'), value: 'qrcode' },
            ]}
          />
        </div>
        {col.type === 'number' ? (
          <div style={{ width: '100%' }}>
            <div style={miniLabel}>{t('pages.system.printTemplatesDesign.decimalPlaces')}</div>
            <InputNumber
              size="small"
              min={0}
              max={12}
              style={{ width: '100%' }}
              value={col.precision ?? 2}
              onChange={(v) => onUpdate(index, { precision: v ?? 2 })}
            />
          </div>
        ) : null}
        <div style={{ width: '100%' }}>
          <div style={miniLabel}>{t('pages.system.printTemplatesDesign.colAlign')}</div>
          <Radio.Group
            size="small"
            buttonStyle="solid"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}
            value={(col.bodyTextAlign ?? 'inherit') as string}
            onChange={(e) => {
              const v = e.target.value as string;
              onUpdate(index, { bodyTextAlign: v === 'inherit' ? undefined : (v as 'left' | 'center' | 'right') });
            }}
          >
            <Radio.Button value="inherit">{t('pages.system.printTemplatesDesign.default')}</Radio.Button>
            <Radio.Button value="left" title={t('pages.system.printTemplatesDesign.alignLeft')}>
              <AlignLeftOutlined />
            </Radio.Button>
            <Radio.Button value="center" title={t('pages.system.printTemplatesDesign.alignCenter')}>
              <AlignCenterOutlined />
            </Radio.Button>
            <Radio.Button value="right" title={t('pages.system.printTemplatesDesign.alignRight')}>
              <AlignRightOutlined />
            </Radio.Button>
          </Radio.Group>
        </div>
        <div style={{ width: '100%' }}>
          <div style={miniLabel}>{t('pages.system.printTemplatesDesign.colVerticalAlign')}</div>
          <Radio.Group
            size="small"
            buttonStyle="solid"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}
            value={(col.verticalAlign ?? 'inherit') as string}
            onChange={(e) => {
              const v = e.target.value as string;
              onUpdate(index, {
                verticalAlign: v === 'inherit' ? undefined : (v as 'top' | 'middle' | 'bottom'),
              });
            }}
          >
            <Radio.Button value="inherit">{t('pages.system.printTemplatesDesign.default')}</Radio.Button>
            <Radio.Button value="top" title={t('pages.system.printTemplatesDesign.alignTop')}>
              <VerticalAlignTopOutlined />
            </Radio.Button>
            <Radio.Button value="middle" title={t('pages.system.printTemplatesDesign.alignMiddle')}>
              <AlignCenterOutlined />
            </Radio.Button>
            <Radio.Button value="bottom" title={t('pages.system.printTemplatesDesign.alignBottom')}>
              <VerticalAlignBottomOutlined />
            </Radio.Button>
          </Radio.Group>
        </div>
        <div style={{ width: '100%' }}>
          <div style={miniLabel}>{t('pages.system.printTemplatesDesign.colWidth')}</div>
          <Input
            size="small"
            placeholder={t('pages.system.printTemplatesDesign.widthPlaceholder')}
            value={col.width || ''}
            onChange={(e) => onUpdate(index, { width: e.target.value.trim() ? e.target.value.trim() : undefined })}
            style={{ width: '100%' }}
          />
        </div>
      </Space>
    </div>
  );
};

const TableColumnDesigner: React.FC<{
  columns: DetailTableColumn[];
  onChange: (cols: DetailTableColumn[]) => void;
}> = ({ columns, onChange }) => {
  const { t } = useTranslation();
  const handleAdd = () => onChange([...columns, { key: '', label: t('pages.system.printTemplatesDesign.newColumn'), type: 'text' }]);
  const handleRemove = (index: number) => {
    const next = [...columns];
    next.splice(index, 1);
    onChange(next);
  };
  const handleUpdate = (index: number, partial: Partial<DetailTableColumn>) => {
    const next = [...columns];
    next[index] = { ...next[index], ...partial };
    onChange(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((_, i) => `col-${i}` === active.id);
      const newIndex = columns.findIndex((_, i) => `col-${i}` === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(columns, oldIndex, newIndex));
      }
    }
  };

  // Generate IDs for sortable
  const items = columns.map((_, i) => `col-${i}`);

  return (
    <div style={{ background: '#fafafa', padding: 12, borderRadius: 8, border: '1px solid #f0f0f0' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#595959' }}>{t('pages.system.printTemplatesDesign.colConfig')}</span>
        <Button type="primary" ghost size="small" icon={<PlusOutlined />} onClick={handleAdd}>{t('pages.system.printTemplatesDesign.addCol')}</Button>
      </div>
      
      <DndContext 
        sensors={useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {columns.map((col, idx) => (
            <SortableTableColumnItem 
              key={`col-${idx}`}
              id={`col-${idx}`}
              index={idx}
              col={col}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          ))}
        </SortableContext>
      </DndContext>
      
      {columns.length === 0 && <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '10px 0', fontSize: 12 }}>{t('pages.system.printTemplatesDesign.noCols')}</div>}
    </div>
  );
};

const QRBlock: React.FC<{ block: DesignerNodeSchema & { type: 'qrcode' }; selected?: boolean; onSelect?: () => void }> = ({ block, selected, onSelect }) => {
  const { token } = theme.useToken();
  // In design mode, show a real QR code with the field key as preview value
  const previewValue = `{{ ${block.key} }}`;
  return (
    <div
      style={{
        padding: 10,
        border: selected ? `2px solid ${token.colorPrimary}` : `1px dashed ${token.colorPrimaryBorder}`,
        borderRadius: 6,
        marginBottom: 0,
        background: token.colorPrimaryBg,
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
    >
      <QRCodeSVG
        value={previewValue}
        size={block.size || 100}
      />
      <div style={{ fontSize: 11, color: token.colorPrimary, fontFamily: 'monospace', background: token.colorPrimaryBgHover, padding: '2px 8px', borderRadius: 4 }}>
        {previewValue}
      </div>
    </div>
  );
};

const DroppableColumn: React.FC<{ 
  id: string; 
  children: React.ReactNode; 
  style?: React.CSSProperties;
  isSelected?: boolean;
  isDragging?: boolean;
}> = ({ id, children, style, isSelected, isDragging }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'column', colId: id }
  });

  return (
    <div 
      ref={setNodeRef} 
      style={{ 
        ...style,
        // When ANY drag is active: show the column as a bright landing zone
        background: isOver
          ? token.colorPrimaryBgHover
          : isDragging
          ? token.colorPrimaryBg
          : style?.background,
        border: isOver
          ? `2px solid ${token.colorPrimary}`
          : isDragging
          ? `1.5px dashed ${token.colorPrimaryBorder}`
          : (style?.border as string) || `1px dotted ${token.colorBorderSecondary}`,
        transition: 'all 0.2s',
        minHeight: isDragging ? 80 : undefined,
      }}
    >
      <div style={{ fontSize: 10, color: isOver ? token.colorPrimary : token.colorTextQuaternary, marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: isOver ? 600 : 400 }}>
        <span>{isOver ? t('pages.system.printTemplatesDesign.dropToColumn') : t('pages.system.printTemplatesDesign.colLayout')}</span>
      </div>
      {children}
    </div>
  );
};

const ColumnsBlock: React.FC<{ 
  block: DesignerNodeSchema & { type: 'columns' }; 
  selectedId?: string | null; 
  onSelect: (id: string) => void;
  renderBlocks: (blocks: DesignerNodeSchema[]) => React.ReactNode;
  isDragging?: boolean;
}> = ({ block, selectedId, onSelect, renderBlocks, isDragging }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const isSelected = selectedId === block.id;
  const justifyContentMap: Record<string, React.CSSProperties['justifyContent']> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    'space-between': 'space-between',
    'space-around': 'space-around',
    'space-evenly': 'space-evenly',
  };
  const alignItemsMap: Record<string, React.CSSProperties['alignItems']> = {
    top: 'flex-start',
    middle: 'center',
    bottom: 'flex-end',
    stretch: 'stretch',
  };
  const textAlignMap: Record<string, React.CSSProperties['textAlign']> = {
    start: 'left',
    center: 'center',
    end: 'right',
  };
  const colCrossAlignMap: Record<string, React.CSSProperties['alignItems']> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
  };
  return (
    <div 
      style={{ 
        display: 'flex', 
        gap: 16, 
        justifyContent: justifyContentMap[block.horizontalAlign || 'start'] || 'flex-start',
        // Stretch columns to the same height first to ensure vertical alignment visibility
        alignItems: 'stretch',
        padding: 8, 
        border: isDragging
          ? `1.5px dashed ${token.colorPrimaryBorder}`
          : isSelected ? `1px solid ${token.colorPrimary}` : `1px dashed ${token.colorBorderSecondary}`,
        borderRadius: 6,
        background: isDragging ? token.colorPrimaryBgHover : isSelected ? token.colorPrimaryBg : 'transparent',
        marginBottom: 0,
        minHeight: isDragging ? 120 : 60,
        transition: 'all 0.2s',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(block.id); }}
    >
      {block.cols.map((col) => (
        <DroppableColumn 
          key={col.id} 
          id={col.id}
          isSelected={isSelected}
          isDragging={isDragging}
          style={{ 
            flex: col.width || '1', 
            padding: '8px 4px', 
            position: 'relative', 
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: alignItemsMap[col.verticalAlign || block.verticalAlign || 'top'] || 'flex-start',
              alignItems: colCrossAlignMap[col.horizontalAlign || 'start'] || 'flex-start',
              textAlign: textAlignMap[col.horizontalAlign || 'start'] || 'left',
              minHeight: '100%',
              width: '100%',
            }}
          >
            <SortableContext 
              id={col.id} 
              items={col.blocks.map(b => b.id)} 
              strategy={verticalListSortingStrategy}
            >
              {renderBlocks(col.blocks)}
            </SortableContext>
            {col.blocks.length === 0 && (
              <div style={{ 
                padding: isDragging ? '28px 10px' : '20px 10px', 
                textAlign: 'center', 
                color: isDragging ? token.colorPrimary : token.colorTextQuaternary, 
                fontSize: isDragging ? 12 : 11, 
                fontWeight: isDragging ? 600 : 400,
                border: isDragging ? `1px dashed ${token.colorPrimaryBorder}` : `1px dashed ${token.colorBorderSecondary}`,
                borderRadius: 4,
                transition: 'all 0.2s',
                width: '100%',
              }}>
                {isDragging ? t('pages.system.printTemplatesDesign.dropToColumn') : t('pages.system.printTemplatesDesign.clickOrDragToInsert')}
              </div>
            )}
          </div>
        </DroppableColumn>
      ))}
    </div>
  );
};

const CanvasArea: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  const { setNodeRef } = useDroppable({
    id: 'canvas-root',
    data: { type: 'root' }
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        background: '#fff',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        padding: 0, 
        boxSizing: 'border-box',
        position: 'absolute',
        left: '10mm', // Offset for rulers
        top: '10mm',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const RootEndDropZone: React.FC<{ activeDragId: string }> = ({ activeDragId }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { setNodeRef, isOver } = useDroppable({
    id: 'root-end-drop',
    data: { type: 'root-end' }
  });

  return (
    <div 
      ref={setNodeRef}
      style={{ 
        marginTop: 12,
        padding: '24px',
        textAlign: 'center',
        background: isOver ? token.colorPrimaryBgHover : token.colorPrimaryBg,
        border: isOver ? `2px dashed ${token.colorPrimary}` : `2px dashed ${token.colorPrimaryBorder}`,
        borderRadius: 8,
        color: token.colorPrimary,
        fontWeight: 500,
        transition: 'all 0.2s'
      }}
    >
      {isOver ? t('pages.system.printTemplatesDesign.dropToBottom') : t('pages.system.printTemplatesDesign.dropToBottom')}
    </div>
  );
};

const ComponentLibrary: React.FC<{
  onInsertText: () => void;
  onDivider: () => void;
  onTable: (collection: string, cols: any[]) => void;
  onIf: () => void;
  onFor: () => void;
  onColumns: () => void;
  onQRCode: () => void;
  onBarcode: () => void;
  onImage: () => void;
  onSpacer: (height: number) => void;
  onLogo: () => void;
  onHeader: (style: number) => void;
  onFooter: () => void;
  templateType: string;
}> = ({ 
  onInsertText, onDivider, onTable, onIf, onFor, onColumns, onQRCode, onBarcode, onImage, 
  onSpacer, onLogo, onHeader, onFooter,
  templateType 
}) => {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#8c8c8c', marginBottom: 4 }}>{t('pages.system.printTemplatesDesign.compBase')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <DraggableSidebarItem type="text" label={t('pages.system.printTemplatesDesign.compText')} icon={<FontSizeOutlined />} onClick={onInsertText} />
        <DraggableSidebarItem type="columns" label={t('pages.system.printTemplatesDesign.compColumns')} icon={<AppstoreOutlined />} onClick={onColumns} />
        <DraggableSidebarItem type="spacer" label={t('pages.system.printTemplatesDesign.compSpacer')} icon={<VerticalAlignBottomOutlined />} onClick={() => onSpacer(20)} />
        <DraggableSidebarItem type="divider" label={t('pages.system.printTemplatesDesign.compDivider')} icon={<DashOutlined />} onClick={onDivider} />
      </div>
      
      <div style={{ fontWeight: 600, fontSize: 13, color: '#8c8c8c', marginTop: 12, marginBottom: 4 }}>{t('pages.system.printTemplatesDesign.compIndustrialId')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <DraggableSidebarItem type="qrcode" label={t('pages.system.printTemplatesDesign.typeQRCode')} icon={<QrcodeOutlined />} onClick={onQRCode} />
        <DraggableSidebarItem type="barcode" label={t('pages.system.printTemplatesDesign.typeBarcode')} icon={<BarcodeOutlined />} onClick={onBarcode} />
        <DraggableSidebarItem type="image" label={t('pages.system.printTemplatesDesign.compImage')} icon={<PictureOutlined />} onClick={onImage} />
        <DraggableSidebarItem type="image" label={t('pages.system.printTemplatesDesign.compLogo')} icon={<PictureOutlined />} onClick={onLogo} />
      </div>

      <div style={{ fontWeight: 600, fontSize: 13, color: '#8c8c8c', marginTop: 12, marginBottom: 4 }}>{t('pages.system.printTemplatesDesign.compPreset')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <DraggableSidebarItem type="columns" label={t('pages.system.printTemplatesDesign.compHeader')} icon={<VerticalAlignTopOutlined />} onClick={() => onHeader(1)} />
        <DraggableSidebarItem type="columns" label={t('pages.system.printTemplatesDesign.compFooter')} icon={<VerticalAlignBottomOutlined />} onClick={onFooter} />
      </div>
      
      <div style={{ fontWeight: 600, fontSize: 13, color: '#8c8c8c', marginTop: 12, marginBottom: 4 }}>{t('pages.system.printTemplatesDesign.compLogic')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <DraggableSidebarItem type="if" label={t('pages.system.printTemplatesDesign.compIf')} icon={<FunctionOutlined />} onClick={onIf} />
        <DraggableSidebarItem type="for" label={t('pages.system.printTemplatesDesign.compFor')} icon={<FunctionOutlined />} onClick={onFor} />
      </div>
    </div>
  );
};

const VariableLibrary: React.FC<{
  onInsert: (key: string, label: string) => void;
  onInsertQR: (key: string) => void;
  onInsertTable: (key: string, label: string) => void;
  templateType: string;
}> = ({ onInsert, onInsertQR, onInsertTable, templateType }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const allVars = useMemo(() => getTemplateVariableItems(templateType), [templateType]);
  const filteredVars = useMemo(() => {
    if (!query.trim()) return allVars;
    const q = query.toLowerCase();
    return allVars.filter(v => v.label.toLowerCase().includes(q) || v.key.toLowerCase().includes(q));
  }, [allVars, query]);

  const groups = useMemo(() => groupVariables(t, filteredVars), [t, filteredVars]);

  return (
    <div>
      <Input.Search
        placeholder={t('pages.system.printTemplatesDesign.searchVariables')}
        allowClear
        style={{ marginBottom: 16 }}
        onChange={e => setQuery(e.target.value)}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map(group => (
          <div key={group.title} style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#8c8c8c', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              {group.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {group.items.map(v => (
                <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {/* Main field insert button */}
                  <Button
                    block
                    icon={<FunctionOutlined />}
                    onClick={() => onInsert(v.key, v.label)}
                    style={{ textAlign: 'left', height: 36, flex: 1, fontSize: 13 }}
                    title={t('pages.system.printTemplatesDesign.insertFieldTitle', { key: v.key })}
                  >
                    {v.label}
                  </Button>
                  {/* Insert as QR Code or Table */}
                  {v.kind === 'detailTable' ? (
                    <Button
                      size="small"
                      icon={<AppstoreOutlined />}
                      onClick={() => onInsertTable(v.key, v.label)}
                      title={t('pages.system.printTemplatesDesign.insertAsTableTitle', { key: v.key })}
                      style={{ flexShrink: 0, height: 36, width: 36 }}
                    />
                  ) : (
                    <Button
                      size="small"
                      icon={<QrcodeOutlined />}
                      onClick={() => onInsertQR(v.key)}
                      title={t('pages.system.printTemplatesDesign.insertAsQRTitle', { key: v.key })}
                      style={{ flexShrink: 0, height: 36, width: 36 }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PrintTemplateDesignPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const siteLogoUrl = useSiteLogoUrl();
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [templateType, setTemplateType] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const [templateCode, setTemplateCode] = useState<string>('');
  const [templateDescription, setTemplateDescription] = useState<string>('');
  const [schemaBlocks, setSchemaBlocks] = useState<DesignerNodeSchema[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [compiledPreview, setCompiledPreview] = useState('');
  const [compileWarnings, setCompileWarnings] = useState<string[]>([]);
  const [selectedSamplePreset, setSelectedSamplePreset] = useState<string>('');
  const [previewDataText, setPreviewDataText] = useState('{}');
  const [pageSize, setPageSize] = useState<string>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margins, setMargins] = useState<{ top: number; right: number; bottom: number; left: number }>({ top: 10, right: 10, bottom: 10, left: 10 });
  const [renderedHtmlPreview, setRenderedHtmlPreview] = useState('');
  const [renderMode, setRenderMode] = useState<'design' | 'preview'>('design');
  const [activeSidebarKey, setActiveSidebarKey] = useState<'components' | 'variables' | 'outline' | 'preview' | 'settings'>('components');
  const [zoom, setZoom] = useState(100);
  const [itemSpacing, setItemSpacing] = useState(0);
  const [tableRowLimit, setTableRowLimit] = useState(0);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const workspaceRef = React.useRef<HTMLDivElement>(null);

  const handleFitToWidth = useCallback(() => {
    const container = workspaceRef.current;
    if (!container) return;
    const preset = PAPER_SIZES[pageSize] || PAPER_SIZES.A4;
    const isLandscape = orientation === 'landscape';
    // Total physical width of the canvas element including 10mm ruler space on each side (for symmetry)
    const paperWidthMm = (isLandscape ? preset.height : preset.width) + 20; 
    const paperPx = paperWidthMm * 3.78;
    
    // Use getBoundingClientRect for more accurate measurement including subpixels
    const rect = container.getBoundingClientRect();
    const availablePx = rect.width - 48; // Subtract 24px padding on each side
    
    if (availablePx <= 0) return;
    
    const targetZoom = Math.floor((availablePx / paperPx) * 100);
    // Auto-shrink only if it's wider than the viewport; do not exceed 100%
    setZoom(Math.max(30, Math.min(100, targetZoom)));
  }, [pageSize, orientation]);

  const samplePresets = useMemo(() => getSamplePresetsByDocType(t, templateType), [t, templateType]);
  const hasLoaded = React.useRef(false);
  const designImportInputRef = React.useRef<HTMLInputElement>(null);

  const getPaperStyles = useCallback(() => {
    const preset = PAPER_SIZES[pageSize] || PAPER_SIZES.A4;
    const isLandscape = orientation === 'landscape';
    const width = isLandscape ? preset.height : preset.width;
    const height = isLandscape ? preset.width : preset.height;
    return {
      width: `${width}mm`,
      minHeight: `${height}mm`,
      padding: `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`,
    };
  }, [pageSize, orientation, margins]);

  const loadTemplate = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const data = await getPrintTemplateByUuid(uuid);
      const docType = data.config?.document_type || data.type || '';
      setTemplateType(docType);
      setTemplateName(data.name);
      setTemplateCode(data.code || '');
      setTemplateDescription(data.description || '');
      const existingSchema = (data.config?.designer_schema as DesignerSchema | undefined) || null;
      if (existingSchema) {
        setPageSize(existingSchema.pageSize || 'A4');
        setOrientation(existingSchema.orientation || 'portrait');
        if (existingSchema.margins) {
          setMargins(existingSchema.margins);
        }
        if (existingSchema.blocks?.length) {
          setSchemaBlocks(existingSchema.blocks);
          setSelectedBlockId(existingSchema.blocks[0]?.id ?? null);
        }
        if (existingSchema.itemSpacing !== undefined) {
          setItemSpacing(existingSchema.itemSpacing);
        }
        if (existingSchema.tableRowLimit !== undefined) {
          setTableRowLimit(existingSchema.tableRowLimit);
        }
      } else {
        const first: DesignerNodeSchema = {
          id: `text-${Date.now()}`,
          type: 'text',
          content: data.content || t('pages.system.printTemplatesDesign.textContentPlaceholder'),
        };
        setSchemaBlocks([first]);
        setSelectedBlockId(first.id);
      }
      document.title = t('pages.system.printTemplatesDesign.documentTitle');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      messageApi.error(msg || t('pages.system.printTemplatesDesign.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [uuid, t, messageApi]);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      void loadTemplate().then(() => {
        // Initial auto-fit
        window.setTimeout(handleFitToWidth, 300);
      });
    }
  }, [loadTemplate, handleFitToWidth]);

  useEffect(() => {
    const el = workspaceRef.current;
    if (!el || !hasLoaded.current) return;

    // Use ResizeObserver to handle container size changes (window resize, sidebar toggle)
    const observer = new window.ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        handleFitToWidth();
      });
    });

    observer.observe(el);
    // Also trigger immediately when pageSize/orientation/handleFitToWidth changes
    handleFitToWidth();

    return () => observer.disconnect();
  }, [pageSize, orientation, handleFitToWidth]);

  useEffect(() => {
    const first = samplePresets[0];
    if (first && !selectedSamplePreset) {
      // Defer to avoid synchronous cascading render warning
      Promise.resolve().then(() => {
        setSelectedSamplePreset(first.key);
        setPreviewDataText(JSON.stringify(first.data, null, 2));
      });
    }
  }, [samplePresets, selectedSamplePreset]);

  const getNormalizedSchema = useCallback((): DesignerSchema => {
    const normalizeBlocks = (blocks: DesignerNodeSchema[]): DesignerNodeSchema[] => {
      return blocks.map(blk => {
        const newBlk = { ...blk } as any;
        if (newBlk.style?.fontSize) {
          newBlk.style = { 
            ...newBlk.style, 
            fontSize: normalizeFontSize(newBlk.style.fontSize) 
          };
        }
        if (newBlk.type === 'field') {
          const k = (newBlk.key || '').toLowerCase();
          const isFin = (k.includes('amount') || k.includes('price') || k.includes('tax') || k.includes('total')) && !k.includes('quantity') && !k.includes('count');
          if (isFin) {
            if (newBlk.label && !newBlk.label.includes(t('pages.system.printTemplatesDesign.yuan'))) {
              newBlk.label = `${newBlk.label} (${t('pages.system.printTemplatesDesign.yuan')})`;
            }
          }
        }
        if (newBlk.type === 'columns') {
          newBlk.cols = newBlk.cols.map((col: any) => ({
            ...col,
            blocks: normalizeBlocks(col.blocks)
          }));
        }
        return newBlk;
      });
    };

    return {
      version: 'v1',
      pageSize,
      orientation,
      margins,
      itemSpacing,
      tableRowLimit,
      blocks: normalizeBlocks(schemaBlocks)
    };
  }, [pageSize, orientation, margins, itemSpacing, tableRowLimit, schemaBlocks]);

  const applyPortableDesign = useCallback((data: PrintTemplateDesignPortableV1) => {
    const schema = data.template.designer_schema as unknown as DesignerSchema;
    setTemplateName(data.template.name);
    setTemplateCode(data.template.code ?? '');
    setTemplateDescription(data.template.description ?? '');
    setTemplateType(data.template.document_type || '');
    setPageSize(schema.pageSize || 'A4');
    setOrientation(schema.orientation === 'landscape' ? 'landscape' : 'portrait');
    if (schema.margins) {
      setMargins(schema.margins);
    }
    setItemSpacing(schema.itemSpacing ?? 0);
    setTableRowLimit(schema.tableRowLimit ?? 0);
    const blocks = Array.isArray(schema.blocks) ? schema.blocks : [];
    setSchemaBlocks(blocks as DesignerNodeSchema[]);
    setSelectedBlockId(blocks.length ? (blocks[0] as DesignerNodeSchema).id : null);
  }, []);

  const handleExportPortableDesign = useCallback(() => {
    try {
      const schema = getNormalizedSchema();
      const payload = buildPrintTemplateDesignExport({
        name: templateName.trim() || t('pages.system.printTemplates.columnName'),
        code: templateCode.trim() || undefined,
        description: templateDescription.trim() || undefined,
        document_type: templateType.trim() || undefined,
        designer_schema: schema as unknown as Record<string, unknown>,
      });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = (templateName.trim() || 'print-template-design').replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80);
      a.href = url;
      a.download = `${base}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      messageApi.success(t('pages.system.printTemplatesDesign.exportPortableSuccess'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      messageApi.error(msg || t('pages.system.printTemplatesDesign.exportPortableFailed'));
    }
  }, [getNormalizedSchema, templateName, templateCode, templateDescription, templateType, messageApi, t]);

  const handleDesignImportFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        const raw = JSON.parse(text);
        const parsed = parsePrintTemplateDesignImport(raw);
        if (!parsed.ok) {
          messageApi.error(parsed.error);
          return;
        }
        modalApi.confirm({
          title: t('pages.system.printTemplatesDesign.importConfirmTitle'),
          content: t('pages.system.printTemplatesDesign.importConfirmDesc'),
          okText: t('pages.system.printTemplatesDesign.apply'),
          cancelText: t('pages.system.printTemplatesDesign.cancel'),
          onOk: () => {
            applyPortableDesign(parsed.data);
            messageApi.success(t('pages.system.printTemplatesDesign.importPortableSuccess'));
          },
        });
      } catch {
        messageApi.error(t('pages.system.printTemplatesDesign.importPortableParseFailed'));
      }
    },
    [applyPortableDesign, messageApi, modalApi, t]
  );

  const handleSave = async () => {
    if (!uuid) return;
    try {
      const schema = getNormalizedSchema();
      const compiled = await compilePrintTemplate({
        source_type: 'designer_json',
        source: schema,
        target_engine: 'jinja2',
        document_type: templateType || undefined,
      });
      setCompiledPreview(compiled.compiled_template || '');
      setCompileWarnings(compiled.warnings || []);
      await updatePrintTemplate(uuid, {
        content: compiled.compiled_template,
        config: {
          document_type: templateType || undefined,
          engine: 'jinja2',
          source_type: 'designer_json',
          designer_version: compiled.schema_version || 'v1',
          designer_schema: schema,
        },
      });
      messageApi.success(t('pages.system.printTemplatesDesign.saveSuccess'));
      if (compiled.warnings?.length) {
        messageApi.warning(t('pages.system.printTemplatesDesign.saveSuccessWithWarnings', { count: compiled.warnings.length }));
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      messageApi.error(msg || t('pages.system.printTemplatesDesign.saveFailed'));
    }
  };

  const handleCompilePreview = async () => {
    try {
      setPreviewLoading(true);
      const schema = getNormalizedSchema();
      const compiled = await compilePrintTemplate({
        source_type: 'designer_json',
        source: schema,
        target_engine: 'jinja2',
        document_type: templateType || undefined,
      });
      setCompiledPreview(compiled.compiled_template || '');
      setCompileWarnings(compiled.warnings || []);
      messageApi.success(t('pages.system.printTemplatesDesign.compilePreviewUpdated'));
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.printTemplatesDesign.compilePreviewFailed'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDataPreview = useCallback(async (silent = false) => {
    try {
      setPreviewLoading(true);
      let previewData: Record<string, any> = {};
      try {
        previewData = previewDataText.trim() ? JSON.parse(previewDataText) : {};
        // Inject page variables if missing for preview purposes
        if (previewData.page_num === undefined) previewData.page_num = 1;
        if (previewData.total_pages === undefined) previewData.total_pages = 1;
      } catch {
        if (!silent) messageApi.error(t('pages.system.printTemplatesDesign.sampleDataError'));
        return;
      }
      const schema = getNormalizedSchema();
      const result = await compilePreviewPrintTemplate({
        source_type: 'designer_json',
        source: schema,
        target_engine: 'jinja2',
        document_type: (templateType as any) || undefined,
        preview_data: previewData,
      });
      setCompiledPreview(result.compiled_template || '');
      setCompileWarnings(result.warnings || []);
      setRenderedHtmlPreview(result.rendered_html || '');
      if (!silent) messageApi.success(t('pages.system.printTemplatesDesign.previewGenerated'));
    } catch (error: any) {
      if (!silent) messageApi.error(error?.message || t('pages.system.printTemplatesDesign.previewFailed'));
    } finally {
      setPreviewLoading(false);
    }
  }, [schemaBlocks, pageSize, orientation, margins, previewDataText, templateType, messageApi]);

  useEffect(() => {
    if (renderMode === 'preview') {
      const timer = window.setTimeout(() => {
        void handleDataPreview(true);
      }, 1000); // 1s debounce to avoid over-fetching
      return () => window.clearTimeout(timer);
    }
  }, [renderMode, handleDataPreview]);

  const handleApplySamplePreset = (presetKey: string) => {
    const preset = samplePresets.find((x) => x.key === presetKey);
    if (!preset) return;
    setPreviewDataText(JSON.stringify(preset.data, null, 2));
    messageApi.success(t('pages.system.printTemplatesDesign.sampleFilled', { label: t(preset.label) }));
  };

  const handleInsertText = () => {
    const item: DesignerNodeSchema = { id: `text-${Date.now()}`, type: 'text', content: t('pages.system.printTemplatesDesign.textContentPlaceholder') };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertField = (key: string, label: string) => {
    const item: DesignerNodeSchema = { id: `field-${Date.now()}`, type: 'field', key, label, style: { fontWeight: 'bold' } };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertDivider = () => {
    const item: DesignerNodeSchema = { id: `divider-${Date.now()}`, type: 'divider' };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertFieldAsQR = (key: string) => {
    const item: DesignerNodeSchema = { id: `qrcode-${Date.now()}`, type: 'qrcode', key, size: 100 };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertFieldToken = (key: string, label: string) => {
    const k = key.toLowerCase();
    const isFinancial = k.match(/amount|price|tax|total/) && !k.includes('quantity') && !k.includes('count');
    const token = isFinancial ? `{{ "%.2f"|format(${key}) }} ${t('pages.system.printTemplatesDesign.yuan')}` : `{{ ${key} }}`;
    if (!selectedBlockId) {
      const fieldKey = isFinancial ? `${key}|format("%.2f")` : key;
      const fieldLabel = isFinancial ? `${label} (${t('pages.system.printTemplatesDesign.yuan')})` : label;
      handleInsertField(fieldKey, fieldLabel);
      return;
    }
    let consumed = false;
    setSchemaBlocks((prev) =>
      prev.map((blk) => {
        if (blk.id !== selectedBlockId) return blk;
        if (blk.type === 'text') {
          consumed = true;
          return { ...blk, content: `${blk.content || ''}${blk.content ? '\n' : ''}${token}` };
        }
        if (blk.type === 'if') {
          consumed = true;
          return { ...blk, content: `${blk.content || ''}${blk.content ? '\n' : ''}${token}` };
        }
        if (blk.type === 'for') {
          consumed = true;
          return { ...blk, template: `${blk.template || ''}${blk.template ? '\n' : ''}${token}` };
        }
        return blk;
      }),
    );
    if (consumed) {
      messageApi.success(t('pages.system.printTemplatesDesign.insertedField', { label }));
    } else {
      handleInsertField(key, label);
      messageApi.info(t('pages.system.printTemplatesDesign.compNotSupported'));
    }
  };

  const handleInsertVariableAsTable = (key: string, label: string) => {
    const tableTemplates = getArrayTableTemplates(templateType);
    const tpl = tableTemplates.find(t => t.arrayKey === key);
    if (tpl) {
      handleInsertDetailTable(tpl.arrayKey, tpl.columns);
      messageApi.success(t('pages.system.printTemplatesDesign.insertedDetailTable', { label }));
    } else {
      // Fallback: Default columns
      handleInsertDetailTable(key, [
        { key: 'material_code', label: t('pages.system.printTemplatesDesign.colMaterialCode') },
        { key: 'material_name', label: t('pages.system.printTemplatesDesign.colMaterialName') },
        { key: 'quote_quantity', label: t('pages.system.printTemplatesDesign.colQuantity') },
        { key: 'unit_price', label: t('pages.system.printTemplatesDesign.colUnitPrice') },
        { key: 'total_amount', label: t('pages.system.printTemplatesDesign.colAmount') },
      ]);
      messageApi.info(t('pages.system.printTemplatesDesign.insertedTableStructure', { label }));
    }
  };

  const handleInsertIf = () => {
    const item: DesignerNodeSchema = {
      id: `if-${Date.now()}`,
      type: 'if',
      condition: `status == "${t('pages.system.printTemplatesDesign.passed')}"`,
      content: t('pages.system.printTemplatesDesign.conditionalContent'),
    };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertFor = () => {
    const item: DesignerNodeSchema = {
      id: `for-${Date.now()}`,
      type: 'for',
      item: 'item',
      collection: 'items',
      template: '<div>{{ item.material_name }} - {{ item.quote_quantity }}</div>',
    };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertDetailTable = (collection: string, columns: Array<{ key: string; label: string }>) => {
    const item: DesignerNodeSchema = {
      id: `table-${Date.now()}`,
      type: 'detail_table',
      collection,
      row_alias: 'row',
      columns: columns.slice(0, 8),
    };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertSpacer = (height: number = 20) => {
    const item: DesignerNodeSchema = { id: `spacer-${Date.now()}`, type: 'spacer', height };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertLogo = () => {
    const item: DesignerNodeSchema = { 
      id: `logo-${Date.now()}`, 
      type: 'image', 
      url: siteLogoUrl || '{{ logo }}', 
      width: 100, 
      height: 60,
      style: { textAlign: 'right' }
    };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertHeaderPreset = (style: number = 1) => {
    let item: DesignerNodeSchema;
    if (style === 1) {
      // Style 1: Logo Left, Title Center, Info Right
      item = {
        id: `header-${Date.now()}`,
        type: 'columns',
        horizontalAlign: 'start',
        verticalAlign: 'top',
        cols: [
          { id: `c1-${Date.now()}`, width: '1', blocks: [{ id: `txt-${Date.now()}-1`, type: 'text', content: t('pages.system.printTemplatesDesign.companyNamePlaceholder'), tag: 'h3' }] },
          { id: `c2-${Date.now()}`, width: '1', horizontalAlign: 'end', blocks: [{ id: `img-${Date.now()}-2`, type: 'image', url: siteLogoUrl || '{{ logo }}', width: 80, height: 40, style: { textAlign: 'right' } }] }
        ]
      };
    } else {
      // Style 2: Title Center with line
      item = {
        id: `header-${Date.now()}`,
        type: 'columns',
        horizontalAlign: 'center',
        verticalAlign: 'top',
        cols: [
          { id: `c1-${Date.now()}`, width: '1', horizontalAlign: 'center', blocks: [
            { id: `txt-${Date.now()}-1`, type: 'text', content: t('pages.system.printTemplatesDesign.quotationTitlePlaceholder'), tag: 'h2', style: { textAlign: 'center' } },
            { id: `div-${Date.now()}-2`, type: 'divider' }
          ] }
        ]
      };
    }
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertFooterPreset = () => {
    const item: DesignerNodeSchema = {
      id: `footer-${Date.now()}`,
      type: 'columns',
      horizontalAlign: 'center',
      verticalAlign: 'top',
      cols: [
        { id: `c1-${Date.now()}`, width: '1', horizontalAlign: 'center', blocks: [{ id: `txt-${Date.now()}-1`, type: 'text', content: t('pages.system.printTemplatesDesign.pageNumberPlaceholder', { current: '{{ page_num }}', total: '{{ total_pages }}' }), style: { textAlign: 'center', fontSize: '12px' } }] }
      ]
    };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertColumns = () => {
    const item: DesignerNodeSchema = {
      id: `columns-${Date.now()}`,
      type: 'columns',
      horizontalAlign: 'start',
      verticalAlign: 'top',
      cols: [
        { id: `col-${Date.now()}-1`, width: '1', horizontalAlign: 'start', verticalAlign: 'top', blocks: [] },
        { id: `col-${Date.now()}-2`, width: '1', horizontalAlign: 'start', verticalAlign: 'top', blocks: [] },
      ],
    };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertQRCode = () => {
    const item: DesignerNodeSchema = {
      id: `qr-${Date.now()}`,
      type: 'qrcode',
      key: 'qr_key',
      size: 100,
    };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertBarcode = () => {
    const item: DesignerNodeSchema = {
      id: `bc-${Date.now()}`,
      type: 'barcode',
      key: 'bc_key',
      format: 'CODE128',
      height: 40,
    };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const handleInsertImage = () => {
    const item: DesignerNodeSchema = {
      id: `img-${Date.now()}`,
      type: 'image',
      url: '',
      width: 120,
      height: 60,
    };
    setSchemaBlocks((prev) => [...prev, item]);
    setSelectedBlockId(item.id);
  };

  const findTargetInfo = (blocks: DesignerNodeSchema[], targetId: string): { list: DesignerNodeSchema[], index: number } | null => {
    const idStr = String(targetId);
    
    // Check if target is the root canvas or the special end drop zone
    if (idStr === 'canvas-root' || idStr === 'root-end-drop') {
      return { list: blocks, index: blocks.length };
    }

    for (let i = 0; i < blocks.length; i++) {
      const blk = blocks[i];
      if (String(blk.id) === idStr) return { list: blocks, index: i };
      
      if (blk.type === 'columns') {
        for (const col of blk.cols) {
          if (String(col.id) === idStr) {
            return { list: col.blocks, index: col.blocks.length };
          }
          const found = findTargetInfo(col.blocks, idStr);
          if (found) return found;
        }
      }
    }
    return null;
  };


  const customCollisionDetection = useCallback((args: any) => {
    // 1. Try rectIntersection first to find specific drop zones (like the end zone)
    const rectCollisions = rectIntersection(args);
    
    // Prioritize the "Drop to end" zone if we are over it
    const endZone = rectCollisions.find(c => c.id === 'root-end-drop');
    if (endZone) return [endZone];

    // Prioritize column containers if we are over them (to allow dropping into empty columns)
    const columnZone = rectCollisions.find(c => c.data?.current?.type === 'column');
    if (columnZone) return [columnZone];

    // 2. Use closestCenter for component reordering (Standard practice for vertical lists)
    return closestCenter(args);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    // Handle reordering / internal moves for existing canvas items
    if (active.id !== over.id && !String(active.id).startsWith('sidebar-')) {
      const activeId = String(active.id);
      const overId = String(over.id);

      setSchemaBlocks(prev => {
        let draggedBlock: DesignerNodeSchema | null = null;
        
        // Step 1: Deep search and remove the block
        const remove = (blocks: DesignerNodeSchema[]): DesignerNodeSchema[] => {
          const idx = blocks.findIndex(b => String(b.id) === activeId);
          if (idx !== -1) {
            draggedBlock = blocks[idx];
            return [...blocks.slice(0, idx), ...blocks.slice(idx + 1)];
          }
          return blocks.map(blk => {
            if (blk.type === 'columns') {
              return { ...blk, cols: blk.cols.map(c => ({ ...c, blocks: remove(c.blocks) })) };
            }
            return blk;
          });
        };

        const afterRemove = remove(prev);
        
        if (!draggedBlock) {
          console.error('[DnD] Could not find dragged block in schema:', activeId);
          return prev;
        }

        // Step 2: Find target info in the tree where the block has already been removed
        const targetInfo = findTargetInfo(afterRemove, overId);
        
        if (targetInfo) {
          const insert = (blocks: DesignerNodeSchema[]): DesignerNodeSchema[] => {
            // Reference equality check for the list
            if (blocks === targetInfo.list) {
              const list = [...blocks];
              list.splice(targetInfo.index, 0, draggedBlock!);
              return list;
            }
            return blocks.map(blk => {
              if (blk.type === 'columns') {
                return { ...blk, cols: blk.cols.map(c => ({ ...c, blocks: insert(c.blocks) })) };
              }
              return blk;
            });
          };
          
          const result = insert(afterRemove);
          messageApi.success(t('pages.system.printTemplatesDesign.compMoveSuccess'));
          return result;
        } else {
          // Fallback: Drop on root canvas background or unknown target -> move to end of root
          messageApi.info(t('pages.system.printTemplatesDesign.movedToEnd'));
          return [...afterRemove, draggedBlock];
        }
      });
      return;
    }


    // Handle sidebar drop
    if (String(active.id).startsWith('sidebar-')) {
      const data = active.data.current;
      if (!data) return;

      const blockType = data.blockType;
      const payload = data.payload;
      const id = `${blockType}-${Date.now()}`;
      
      let newBlock: DesignerNodeSchema;
      switch (blockType) {
        case 'text':
          newBlock = { id, type: 'text', content: t('pages.system.printTemplatesDesign.textContent') };
          break;
        case 'field':
          newBlock = { id, type: 'field', key: payload.key, label: payload.label, showLabel: true };
          break;
        case 'divider':
          newBlock = { id, type: 'divider' };
          break;
        case 'columns':
          newBlock = {
            id,
            type: 'columns',
            horizontalAlign: 'start',
            verticalAlign: 'top',
            cols: [
              { id: `col-${Date.now()}-1`, width: '1', horizontalAlign: 'start', verticalAlign: 'top', blocks: [] },
              { id: `col-${Date.now()}-2`, width: '1', horizontalAlign: 'start', verticalAlign: 'top', blocks: [] },
            ],
          };
          break;
        case 'if':
          newBlock = { id, type: 'if', condition: 'true', content: t('pages.system.printTemplatesDesign.conditionalContent') };
          break;
        case 'for':
          newBlock = { id, type: 'for', item: 'item', collection: 'items', template: t('pages.system.printTemplatesDesign.content') };
          break;
        case 'detail_table':
          newBlock = { id, type: 'detail_table', collection: payload.collection, row_alias: 'item', columns: payload.columns };
          break;
        case 'qrcode':
          newBlock = { id, type: 'qrcode', key: payload?.key || 'qr_key', size: 100 };
          break;
        case 'barcode':
          newBlock = { id, type: 'barcode', key: payload?.key || 'bc_key', format: 'CODE128', height: 40 };
          break;
        case 'image':
          newBlock = { id, type: 'image', url: payload?.url || '', width: 100, height: 60, keepRatio: true };
          break;
        case 'spacer':
          newBlock = { id, type: 'spacer', height: 20 };
          break;
        default:
          return;
      }

      // Find where to insert — checks block IDs AND column IDs (DroppableColumn targets)
      const overId = String(over.id);
      const overData = over.data?.current;

      // Direct drop onto a column container (useDroppable registered the col.id)
      if (overData?.type === 'column') {
        const colId = String(overId);
        const insertIntoCol = (blocks: DesignerNodeSchema[]): DesignerNodeSchema[] => {
          return blocks.map(blk => {
            if (blk.type === 'columns') {
              return {
                ...blk,
                cols: blk.cols.map(c => {
                  if (c.id === colId) {
                    return { ...c, blocks: [...c.blocks, newBlock] };
                  }
                  return { ...c, blocks: insertIntoCol(c.blocks) };
                }),
              };
            }
            return blk;
          });
        };
        setSchemaBlocks(prev => insertIntoCol(prev));
        setSelectedBlockId(id);
        return;
      }

      // Drop onto the ROOT CANVAS (empty area)
      if (overData?.type === 'root') {
        setSchemaBlocks(prev => [...prev, newBlock]);
        setSelectedBlockId(id);
        return;
      }

      // Drop onto a specific block position (or empty canvas)
      const overInfo = findTargetInfo(schemaBlocks, overId);
      if (overInfo) {
        const updateTree = (blocks: DesignerNodeSchema[]): DesignerNodeSchema[] => {
          if (blocks === overInfo.list) {
            const list = [...blocks];
            list.splice(overInfo.index, 0, newBlock);
            return list;
          }
          return blocks.map(blk => {
            if (blk.type === 'columns') {
              return { ...blk, cols: blk.cols.map(c => ({ ...c, blocks: updateTree(c.blocks) })) };
            }
            return blk;
          });
        };
        setSchemaBlocks(prev => updateTree(prev));
      } else {
        setSchemaBlocks(prev => [...prev, newBlock]);
      }
      setSelectedBlockId(id);
    }
  };


  const renderDesignerBlocks = (blocks: DesignerNodeSchema[], isNested = false) => {
    return blocks.map((blk) => {
      const isSelected = selectedBlockId === blk.id;
      return (
        <SortableBlockWrapper key={blk.id} id={blk.id} type={blk.type} marginBottom={isNested ? 0 : `${itemSpacing}mm`}>
          <div 
            style={{ position: 'relative', transition: 'all 0.2s' }}
            className="designer-block-wrap"
          >
            {blk.type === 'text' && <TextBlock block={blk} selected={isSelected} onSelect={() => setSelectedBlockId(blk.id)} />}
            {blk.type === 'field' && <FieldBlock block={blk} selected={isSelected} onSelect={() => setSelectedBlockId(blk.id)} />}
            {blk.type === 'divider' && <DividerBlock selected={isSelected} onSelect={() => setSelectedBlockId(blk.id)} />}
            {blk.type === 'qrcode' && <QRBlock block={blk} selected={isSelected} onSelect={() => setSelectedBlockId(blk.id)} />}
            {blk.type === 'barcode' && <BarcodeBlock block={blk} selected={isSelected} onSelect={() => setSelectedBlockId(blk.id)} />}
            {blk.type === 'image' && <ImageBlock block={blk} selected={isSelected} onSelect={() => setSelectedBlockId(blk.id)} />}
            {blk.type === 'spacer' && <SpacerBlock block={blk} selected={isSelected} onSelect={() => setSelectedBlockId(blk.id)} />}
            {blk.type === 'columns' && (
              <ColumnsBlock 
                block={blk} 
                selectedId={selectedBlockId} 
                onSelect={setSelectedBlockId} 
                renderBlocks={(nested) => renderDesignerBlocks(nested, true)} 
                isDragging={!!activeDragId}
              />
            )}
            {(blk.type === 'if' || blk.type === 'for' || blk.type === 'detail_table') && (
              <LogicBlock
                title={blk.type === 'if' ? t('pages.system.printTemplatesDesign.compIf') : blk.type === 'for' ? t('pages.system.printTemplatesDesign.compFor') : t('pages.system.printTemplatesDesign.compDetailTable')}
                body={
                  blk.type === 'if'
                    ? `{% if ${blk.condition} %}${blk.content}{% endif %}`
                    : blk.type === 'for'
                      ? `{% for ${blk.item} in ${blk.collection} %}${blk.template}{% endfor %}`
                      : blk.type === 'detail_table'
                        ? `collection=${blk.collection}, columns=${blk.columns.length}`
                        : ''
                }
                selected={isSelected}
                onSelect={() => setSelectedBlockId(blk.id)}
                extra={
                  blk.type === 'detail_table' ? (
                    <DetailTableMiniPreview tableStyle={blk.tableStyle} columns={blk.columns} />
                  ) : undefined
                }
              />
            )}
          </div>
        </SortableBlockWrapper>
      );
    });
  };

  const findBlockById = useCallback((blocks: DesignerNodeSchema[], targetId: string): DesignerNodeSchema | null => {
    for (const blk of blocks) {
      if (blk.id === targetId) return blk;
      if (blk.type === 'columns') {
        for (const col of blk.cols) {
          const found = findBlockById(col.blocks, targetId);
          if (found) return found;
        }
      }
    }
    return null;
  }, []);

  const selectedBlock = useMemo(
    () => (selectedBlockId ? findBlockById(schemaBlocks, selectedBlockId) : null),
    [schemaBlocks, selectedBlockId, findBlockById],
  );

  const updateSelectedBlock = (patch: Partial<DesignerNodeSchema>) => {
    if (!selectedBlockId) return;
    setSchemaBlocks((prev) => {
      const updateRecursively = (blocks: DesignerNodeSchema[]): DesignerNodeSchema[] => {
        return blocks.map((blk) => {
          if (blk.id === selectedBlockId) {
            return { ...blk, ...patch } as DesignerNodeSchema;
          }
          if (blk.type === 'columns') {
            return {
              ...blk,
              cols: blk.cols.map((col) => ({ ...col, blocks: updateRecursively(col.blocks) })),
            };
          }
          return blk;
        });
      };
      return updateRecursively(prev);
    });
  };

  const moveSelected = (delta: -1 | 1) => {
    if (!selectedBlockId) return;
    setSchemaBlocks((prev) => {
      const recursiveMove = (blocks: DesignerNodeSchema[]): DesignerNodeSchema[] => {
        const idx = blocks.findIndex((b) => b.id === selectedBlockId);
        if (idx !== -1) {
          const target = idx + delta;
          if (target < 0 || target >= blocks.length) return blocks;
          const copied = [...blocks];
          const [it] = copied.splice(idx, 1);
          copied.splice(target, 0, it);
          return copied;
        }
        return blocks.map((blk) => {
          if (blk.type === 'columns') {
            return {
              ...blk,
              cols: blk.cols.map((col) => ({ ...col, blocks: recursiveMove(col.blocks) })),
            };
          }
          return blk;
        });
      };
      return recursiveMove(prev);
    });
  };

  const removeSelected = () => {
    if (!selectedBlockId) return;
    setSchemaBlocks((prev) => {
      const recursiveRemove = (blocks: DesignerNodeSchema[]): DesignerNodeSchema[] => {
        return blocks
          .filter(blk => blk.id !== selectedBlockId)
          .map(blk => {
            if (blk.type === 'columns') {
              return {
                ...blk,
                cols: blk.cols.map(c => ({ ...c, blocks: recursiveRemove(c.blocks) }))
              };
            }
            return blk;
          });
      };
      
      const next = recursiveRemove(prev);
      // Auto-select something else if possible, or null
      setSelectedBlockId(null); 
      return next;
    });
  };

  if (loading) {
    return <div style={{ padding: 20 }}>{t('pages.system.printTemplatesDesign.loading')}</div>;
  }

  const preset = PAPER_SIZES[pageSize] || PAPER_SIZES.A4;
  const isLandscape = orientation === 'landscape';
  const paperBaseWidth = isLandscape ? preset.height : preset.width;
  const paperBaseHeight = isLandscape ? preset.width : preset.height;
  const MM_TO_PX = 3.78;
  const scaledLayoutWidth = (paperBaseWidth + 20) * MM_TO_PX * (zoom / 100);
  const scaledLayoutHeight = (paperBaseHeight + 20) * MM_TO_PX * (zoom / 100);

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ 
      height: getViewportHeightExpr(SYSTEM_VIEWPORT_OFFSETS.PRINT_TEMPLATE_DESIGN_PX, {
        compensateHeaderInFullscreen: true,
      }), 
      background: token.colorBgLayout, 
      overflow: 'hidden'
    }}>
      <div style={{ 
        height: '100%',
        display: 'flex', 
        overflow: 'hidden',
        borderRadius: token.borderRadiusLG,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: `1px solid ${token.colorBorderSecondary}`
      }}>
        {/* 1. Icon Sidebar (Left Rail) */}
        <div style={{
          width: 72,
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 0',
          gap: 20,
          zIndex: 100,
          flex: '0 0 72px'
        }}>
          {[
            { key: 'components', icon: <AppstoreOutlined />, label: t('pages.system.printTemplatesDesign.sidebarComponents') },
            { key: 'variables', icon: <FunctionOutlined />, label: t('pages.system.printTemplatesDesign.sidebarVariables') },
            { key: 'outline', icon: <OrderedListOutlined />, label: t('pages.system.printTemplatesDesign.sidebarOutline') },
            { key: 'preview', icon: <EyeOutlined />, label: t('pages.system.printTemplatesDesign.sidebarDebug') },
            { key: 'settings', icon: <SettingOutlined />, label: t('pages.system.printTemplatesDesign.sidebarSettings') },
          ].map(item => (
            <div
              key={item.key}
              style={{
                color: activeSidebarKey === item.key ? token.colorPrimary : token.colorTextSecondary,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.3s'
              }}
              onClick={() => setActiveSidebarKey(item.key as 'components' | 'variables' | 'outline' | 'preview' | 'settings')}
            >
              <div style={{ 
                fontSize: 24, 
                padding: 8, 
                background: activeSidebarKey === item.key ? token.colorPrimaryBg : 'transparent',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}>
                {item.icon}
              </div>
              <span style={{ fontSize: 12, fontWeight: activeSidebarKey === item.key ? 600 : 400 }}>{item.label}</span>
            </div>
          ))}
          
          <div style={{ marginTop: 'auto' }}>
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              style={{ color: token.colorTextQuaternary }} 
              onClick={() => navigate(-1)} 
            />
          </div>
        </div>

        {/* 2. Navigation Panel (Active Sidebar Content) */}
        <div style={{
          width: 300,
          height: '100%',
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '4px 0 10px rgba(0,0,0,0.02)',
          overflow: 'hidden',
          flex: '0 0 300px'
        }}>
          <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <Title level={5} style={{ margin: 0 }}>
              {activeSidebarKey === 'components' && t('pages.system.printTemplatesDesign.navComponents')}
              {activeSidebarKey === 'variables' && t('pages.system.printTemplatesDesign.navVariables')}
              {activeSidebarKey === 'outline' && t('pages.system.printTemplatesDesign.navOutline')}
              {activeSidebarKey === 'preview' && t('pages.system.printTemplatesDesign.navDebug')}
              {activeSidebarKey === 'settings' && t('pages.system.printTemplatesDesign.navSettings')}
            </Title>
          </div>
          <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
            {activeSidebarKey === 'components' && (
               <ComponentLibrary
                onInsertText={handleInsertText}
                onDivider={handleInsertDivider}
                onTable={handleInsertDetailTable}
                onIf={handleInsertIf}
                onFor={handleInsertFor}
                onColumns={handleInsertColumns}
                onQRCode={handleInsertQRCode}
                onBarcode={handleInsertBarcode}
                onImage={handleInsertImage}
                onSpacer={handleInsertSpacer}
                onLogo={handleInsertLogo}
                onHeader={handleInsertHeaderPreset}
                onFooter={handleInsertFooterPreset}
                templateType={templateType}
              />
            )}
            {activeSidebarKey === 'variables' && (
              <VariableLibrary
                templateType={templateType}
                onInsert={handleInsertFieldToken}
                onInsertQR={handleInsertFieldAsQR}
                onInsertTable={handleInsertVariableAsTable}
              />
            )}
            {activeSidebarKey === 'outline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {schemaBlocks.map((blk, idx) => (
                  <div 
                    key={blk.id}
                    style={{
                      padding: '10px 12px',
                      background: selectedBlockId === blk.id ? token.colorPrimaryBg : token.colorFillTertiary,
                      border: `1px solid ${selectedBlockId === blk.id ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10
                    }}
                    onClick={() => setSelectedBlockId(blk.id)}
                  >
                    <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>{idx + 1}</span>
                    <span style={{ fontWeight: 500 }}>{blk.type.toUpperCase()}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      <Button size="small" type="text" icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); setSelectedBlockId(blk.id); removeSelected(); }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeSidebarKey === 'preview' && (
              <Space orientation="vertical" style={{ width: '100%' }} size={16}>
                 <div style={{ fontWeight: 600, fontSize: 13, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.compileControl')}</div>
                 <Button block type="primary" onClick={handleCompilePreview}>{t('pages.system.printTemplatesDesign.refreshSource')}</Button>
                 {compileWarnings.length > 0 && (
                   <div style={{ background: token.colorWarningBg, border: `1px solid ${token.colorWarningBorder}`, padding: 10, borderRadius: 6, fontSize: 12 }}>
                     <div style={{ color: token.colorWarningText, fontWeight: 600 }}>{t('pages.system.printTemplatesDesign.compileWarning')}</div>
                     {compileWarnings.map((w, i) => <div key={i}>• {w}</div>)}
                   </div>
                 )}
                 <Input.TextArea rows={8} value={compiledPreview} readOnly placeholder="Jinja2 Source..." style={{ fontFamily: 'monospace', fontSize: 12 }} />
                 
                 <Divider style={{ margin: '8px 0' }} />
                 <div style={{ fontWeight: 600, fontSize: 13, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.dataSimulation')}</div>
                 <div style={{ display: 'flex', gap: 8 }}>
                   <Select
                      style={{ flex: 1 }}
                      value={selectedSamplePreset}
                      options={samplePresets.map((x) => ({ label: t(x.label), value: x.key }))}
                      onChange={setSelectedSamplePreset}
                    />
                    <Button onClick={() => handleApplySamplePreset(selectedSamplePreset)}>{t('pages.system.printTemplatesDesign.apply')}</Button>
                 </div>
                 <Input.TextArea
                    rows={8}
                    value={previewDataText}
                    onChange={(e) => setPreviewDataText(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                 <Button block icon={<EyeOutlined />} loading={previewLoading} onClick={() => handleDataPreview()}>{t('pages.system.printTemplatesDesign.executePreview')}</Button>
              </Space>
            )}
            {activeSidebarKey === 'settings' && (
              <Space orientation="vertical" style={{ width: '100%' }} size={16}>
                <div>
                  <div style={{ marginBottom: 8, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.paperSize')}</div>
                  <Select
                    style={{ width: '100%' }}
                    value={pageSize}
                    options={Object.keys(PAPER_SIZES).map(k => ({ label: t(PAPER_SIZES[k].labelKey), value: k }))}
                    onChange={setPageSize}
                  />
                </div>
                <div>
                  <div style={{ marginBottom: 8, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.paperOrientation')}</div>
                  <OrientationSelector 
                    value={orientation}
                    onChange={setOrientation}
                  />
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div>
                  <div style={{ marginBottom: 8, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.itemSpacingLabel')}</div>
                  <InputNumber 
                    size="small" 
                    style={{ width: '100%' }} 
                    value={itemSpacing} 
                    onChange={v => setItemSpacing(v || 0)} 
                    placeholder={t('pages.system.printTemplatesDesign.itemSpacingPlaceholder')}
                  />
                  <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 4 }}>
                    {t('pages.system.printTemplatesDesign.itemSpacingHint')}
                  </div>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div>
                  <div style={{ marginBottom: 8, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.tableRowLimitLabel')}</div>
                  <InputNumber 
                    size="small" 
                    style={{ width: '100%' }} 
                    value={tableRowLimit} 
                    onChange={v => setTableRowLimit(v || 0)} 
                    placeholder={t('pages.system.printTemplatesDesign.tableRowLimitPlaceholder')}
                    min={0}
                  />
                  <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 4 }}>
                    {t('pages.system.printTemplatesDesign.tableRowLimitHint')}
                  </div>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div>
                  <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 13 }}>{t('pages.system.printTemplatesDesign.paperMargins')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>{t('pages.system.printTemplatesDesign.marginTop')}</div>
                      <InputNumber size="small" style={{ width: '100%' }} value={margins.top} onChange={v => setMargins(m => ({ ...m, top: v || 0 }))} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>{t('pages.system.printTemplatesDesign.marginBottom')}</div>
                      <InputNumber size="small" style={{ width: '100%' }} value={margins.bottom} onChange={v => setMargins(m => ({ ...m, bottom: v || 0 }))} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>{t('pages.system.printTemplatesDesign.marginLeft')}</div>
                      <InputNumber size="small" style={{ width: '100%' }} value={margins.left} onChange={v => setMargins(m => ({ ...m, left: v || 0 }))} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>{t('pages.system.printTemplatesDesign.marginRight')}</div>
                      <InputNumber size="small" style={{ width: '100%' }} value={margins.right} onChange={v => setMargins(m => ({ ...m, right: v || 0 }))} />
                    </div>
                  </div>
                </div>

                <Divider style={{ margin: '16px 0' }} />
                <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>{t('pages.system.printTemplatesDesign.exportPortable')} / {t('pages.system.printTemplatesDesign.importPortable')}</div>
                <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                  <Button block icon={<DownloadOutlined />} onClick={handleExportPortableDesign}>
                    {t('pages.system.printTemplatesDesign.exportPortable')}
                  </Button>
                  <Button block icon={<UploadOutlined />} onClick={() => designImportInputRef.current?.click()}>
                    {t('pages.system.printTemplatesDesign.importPortable')}
                  </Button>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 11 }}>
                    {t('pages.system.printTemplatesDesign.importPortableTooltip')}
                  </Typography.Paragraph>
                </Space>
                <input
                  ref={designImportInputRef}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={handleDesignImportFileChange}
                />
              </Space>
            )}
          </div>
        </div>

        {/* 3. Main Workspace (Canvas) */}
        <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', background: token.colorBgLayout, minWidth: 0, overflow: 'hidden' }}>
          {/* Workspace Toolbar */}
          <div style={{ 
            height: 64, 
            background: token.colorBgContainer, 
            borderBottom: `1px solid ${token.colorBorderSecondary}`, 
            display: 'flex', 
            alignItems: 'center', 
            padding: '0 24px',
            justifyContent: 'space-between'
          }}>
            <Space size={24} style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <Title level={5} style={{ 
                margin: 0, 
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 400
              }}>
                {templateName || t('pages.system.printTemplatesDesign.templateNameFallback')}
              </Title>
              <Divider orientation="vertical" />
              <Space>
                <Button icon={<ZoomOutOutlined />} onClick={() => setZoom(Math.max(50, zoom - 10))} />
                <span style={{ minWidth: 40, textAlign: 'center' }}>{zoom}%</span>
                <Button icon={<ZoomInOutlined />} onClick={() => setZoom(Math.min(200, zoom + 10))} />
                <Button size="small" onClick={handleFitToWidth}>{t('pages.system.printTemplatesDesign.fitWidth')}</Button>
              </Space>
            </Space>
            <Space style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
              <Radio.Group 
                value={renderMode} 
                onChange={e => {
                  const val = e.target.value;
                  setRenderMode(val);
                  if (val === 'preview') {
                    handleDataPreview(true);
                  }
                }}
                buttonStyle="solid"
                size="middle"
                style={{ whiteSpace: 'nowrap', display: 'inline-flex' }}
              >
                <Radio.Button value="design" style={{ whiteSpace: 'nowrap' }}>{t('pages.system.printTemplatesDesign.modeDesign')}</Radio.Button>
                <Radio.Button value="preview" style={{ whiteSpace: 'nowrap' }}>{t('pages.system.printTemplatesDesign.modePreview')}</Radio.Button>
              </Radio.Group>
              <Divider orientation="vertical" />
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>{t('pages.system.printTemplatesDesign.saveTemplate')}</Button>
            </Space>
          </div>

          {/* Canvas Area Container */}
          <div 
            ref={workspaceRef}
            style={{ 
              flex: 1, 
              padding: '0 24px', // Side padding, vertical margin handled by inner wrapper
              overflow: 'auto', 
              background: token.colorFillQuaternary,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start'
            }}
          >
            {/* The Outer Scaling Wrapper: Occupies the actual visual space */}
            <div style={{ 
              width: scaledLayoutWidth,
              height: scaledLayoutHeight,
              position: 'relative',
              flexShrink: 0,
              transition: 'all 0.2s ease',
              margin: '40px auto'
            }}>
              {/* The Inner Scaled Content: Transformed to zoom level */}
              <div style={{ 
                position: 'absolute',
                left: 0,
                top: 0,
                width: `${paperBaseWidth + 40}mm`,
                height: `${paperBaseHeight + 40}mm`,
                transform: `scale(${zoom / 100})`, 
                transformOrigin: 'top left',
                transition: 'transform 0.2s'
              }}>
                {/* Paper Rulers: Moved outside CanvasArea to avoid cumulative offsets */}
                <PaperRuler orientation="horizontal" size={paperBaseWidth} />
                <PaperRuler orientation="vertical" size={paperBaseHeight} />

                <CanvasArea style={getPaperStyles()}>
                  {renderMode === 'design' ? (
                    <>
                      {schemaBlocks.length === 0 && (
                        <div style={{ color: token.colorTextSecondary, padding: 40, textAlign: 'center', border: `2px dashed ${token.colorBorderSecondary}`, borderRadius: 8 }}>
                          <AppstoreOutlined style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }} />
                          <div>{t('pages.system.printTemplatesDesign.dragToStart')}</div>
                        </div>
                      )}
                        <SortableContext 
                          items={schemaBlocks.map(b => b.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {renderDesignerBlocks(schemaBlocks)}
                        </SortableContext>
                        
                        {/* Drop zone at the end of the root canvas */}
                        {activeDragId && (
                           <RootEndDropZone activeDragId={activeDragId} />
                        )}
                    </>
                  ) : (
                    <div 
                      className="print-preview-inner"
                      style={{ 
                        width: '100%', 
                        minHeight: '100%', 
                        background: '#fff',
                        position: 'relative',
                        boxSizing: 'border-box'
                      }}
                      dangerouslySetInnerHTML={{ 
                        __html: `
                        <style>
                          /* Keep designer preview consistent with PDF output:
                             Same font stack as compiled template body (see print_template_service.py). */
                          .print-preview-inner { color: #334155; line-height: 1.5; font-family: ${PRINT_TEMPLATE_BODY_FONT_STACK}; }
                          .print-preview-inner * { font-family: inherit; }
                          .print-preview-inner > div, 
                          .print-preview-inner > table, 
                          .print-preview-inner > p, 
                          .print-preview-inner > h1, 
                          .print-preview-inner > h2, 
                          .print-preview-inner > h3, 
                          .print-preview-inner > h4 { 
                            width: 100%; 
                            margin-top: 0 !important; 
                            margin-bottom: ${itemSpacing}mm !important; 
                            word-break: break-word; 
                            min-height: 0 !important; 
                          }
                          .print-preview-inner table { 
                            border-collapse: collapse; 
                            margin-bottom: ${itemSpacing}mm !important; 
                          }
                          .print-preview-inner .columns-layout { 
                            margin-bottom: ${itemSpacing}mm !important; 
                          }
                          .print-preview-inner .columns-layout div { 
                            margin-bottom: 0 !important; 
                          }
                          .print-preview-inner .page-current, 
                          .print-preview-inner .page-total { 
                            display: inline-block !important; 
                            min-width: 1ch; 
                            text-align: center; 
                          }
                          .print-preview-inner .page-current::after { content: "1"; }
                          .print-preview-inner .page-total::after { content: "1"; }
                          .print-preview-inner .print-block {
                            width: 100%;
                            position: relative;
                            margin-bottom: ${itemSpacing}mm !important;
                          }
                        </style>
                        ${renderedHtmlPreview}` 
                      }} 
                    />
                  )}
                </CanvasArea>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Property Panel (Right) */}
        <div style={{
          width: 320,
          background: token.colorBgContainer,
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 10px rgba(0,0,0,0.02)',
          overflow: 'hidden',
          flex: '0 0 320px'
        }}>
          <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <Title level={5} style={{ margin: 0 }}>{t('pages.system.printTemplatesDesign.propertyPanel')}</Title>
          </div>
          <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
            {selectedBlock ? (
              <Space orientation="vertical" style={{ width: '100%' }} size={16}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: token.colorText }}>
                    {selectedBlock.type === 'text' && t('pages.system.printTemplatesDesign.compText')}
                    {selectedBlock.type === 'field' && t('pages.system.printTemplatesDesign.compVariables')}
                    {selectedBlock.type === 'divider' && t('pages.system.printTemplatesDesign.compDivider')}
                    {selectedBlock.type === 'spacer' && t('pages.system.printTemplatesDesign.compSpacer')}
                    {selectedBlock.type === 'qrcode' && t('pages.system.printTemplatesDesign.typeQRCode')}
                    {selectedBlock.type === 'barcode' && t('pages.system.printTemplatesDesign.typeBarcode')}
                    {selectedBlock.type === 'image' && t('pages.system.printTemplatesDesign.compImage')}
                    {selectedBlock.type === 'if' && t('pages.system.printTemplatesDesign.compIf')}
                    {selectedBlock.type === 'for' && t('pages.system.printTemplatesDesign.compFor')}
                    {selectedBlock.type === 'detail_table' && t('pages.system.printTemplatesDesign.compDetailTable')}
                  </span>
                  <Space>
                    <Button size="small" icon={<VerticalAlignTopOutlined />} onClick={() => moveSelected(-1)} />
                    <Button size="small" icon={<VerticalAlignBottomOutlined />} onClick={() => moveSelected(1)} />
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={removeSelected} />
                  </Space>
                </div>

                {(selectedBlock.type === 'text' || selectedBlock.type === 'field' || selectedBlock.type === 'qrcode' || selectedBlock.type === 'barcode' || selectedBlock.type === 'image') && (
                  <Card size="small" title={t('pages.system.printTemplatesDesign.styleSettings')} styles={{ header: { border: 0, fontSize: 13, color: token.colorTextSecondary } }}>
                    <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Input
                          placeholder={t('pages.system.printTemplatesDesign.fontSize')}
                          value={selectedBlock.style?.fontSize}
                          onChange={e => updateSelectedBlock({ style: { ...selectedBlock.style, fontSize: e.target.value } })}
                          suffix="px"
                        />
                        <ColorPicker
                          value={selectedBlock.style?.color || '#000'}
                          onChange={(_, hex) => updateSelectedBlock({ style: { ...selectedBlock.style, color: hex } })}
                        />
                      </div>
                      <Radio.Group
                        size="small"
                        value={selectedBlock.style?.textAlign || 'left'}
                        onChange={e => updateSelectedBlock({ style: { ...selectedBlock.style, textAlign: e.target.value } })}
                      >
                        <Radio.Button value="left"><AlignLeftOutlined /></Radio.Button>
                        <Radio.Button value="center"><AlignCenterOutlined /></Radio.Button>
                        <Radio.Button value="right"><AlignRightOutlined /></Radio.Button>
                      </Radio.Group>
                      <Button
                        block
                        icon={<BoldOutlined />}
                        type={selectedBlock.style?.fontWeight === 'bold' ? 'primary' : 'default'}
                        onClick={() => updateSelectedBlock({ style: { ...selectedBlock.style, fontWeight: selectedBlock.style?.fontWeight === 'bold' ? 'normal' : 'bold' } })}
                      >
                        {t('pages.system.printTemplatesDesign.bold')}
                      </Button>
                    </Space>
                  </Card>
                )}

                <Card size="small" title={t('pages.system.printTemplatesDesign.contentSettings')} styles={{ header: { border: 0, fontSize: 13, color: token.colorTextSecondary } }}>
                  {selectedBlock.type === 'text' && (
                    <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.textType')}</div>
                        <Select
                          style={{ width: '100%' }}
                          value={selectedBlock.tag || 'div'}
                          onChange={val => updateSelectedBlock({ tag: val })}
                          options={[
                            { label: t('pages.system.printTemplatesDesign.typeNormal'), value: 'div' },
                            { label: t('pages.system.printTemplatesDesign.typeParagraph'), value: 'p' },
                            { label: t('pages.system.printTemplatesDesign.typeH1'), value: 'h1' },
                            { label: t('pages.system.printTemplatesDesign.typeH2'), value: 'h2' },
                            { label: t('pages.system.printTemplatesDesign.typeH3'), value: 'h3' },
                            { label: t('pages.system.printTemplatesDesign.typeH4'), value: 'h4' },
                          ]}
                        />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.textContent')}</div>
                        <Input.TextArea
                          rows={6}
                          value={selectedBlock.content}
                          onChange={e => updateSelectedBlock({ content: e.target.value })}
                          placeholder={t('pages.system.printTemplatesDesign.textContentPlaceholder')}
                        />
                      </div>
                    </Space>
                  )}
                  {selectedBlock.type === 'field' && (
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, background: token.colorFillTertiary, padding: '8px 12px', borderRadius: 6 }}>
                        <span style={{ fontSize: 13 }}>{t('pages.system.printTemplatesDesign.showLabel')}</span>
                        <Radio.Group 
                          size="small" 
                          value={selectedBlock.showLabel !== false} 
                          onChange={e => updateSelectedBlock({ showLabel: e.target.value })}
                        >
                          <Radio.Button value={true}>{t('pages.system.printTemplatesDesign.on')}</Radio.Button>
                          <Radio.Button value={false}>{t('pages.system.printTemplatesDesign.off')}</Radio.Button>
                        </Radio.Group>
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.displayName')}</div>
                        <Input value={selectedBlock.label} placeholder={t('pages.system.printTemplatesDesign.displayName')} onChange={e => updateSelectedBlock({ label: e.target.value })} />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.variableField')}</div>
                        <Input value={selectedBlock.key} placeholder={t('pages.system.printTemplatesDesign.variableField')} readOnly disabled />
                      </div>
                    </Space>
                  )}
                  {selectedBlock.type === 'qrcode' && (
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.variableField')}</div>
                        <Input value={selectedBlock.key} onChange={e => updateSelectedBlock({ key: e.target.value })} placeholder="e.g. order_no" />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.sizePx')}</div>
                        <InputNumber min={40} max={300} style={{ width: '100%' }} value={selectedBlock.size} onChange={v => updateSelectedBlock({ size: v || 100 })} />
                      </div>
                    </Space>
                  )}
                  {selectedBlock.type === 'barcode' && (
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.barcodeField')}</div>
                        <Input value={selectedBlock.key} onChange={e => updateSelectedBlock({ key: e.target.value })} placeholder="e.g. barcode_val" />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.barcodeFormat')}</div>
                        <Select
                          style={{ width: '100%' }}
                          value={selectedBlock.format}
                          onChange={v => updateSelectedBlock({ format: v })}
                          options={[
                            { label: 'CODE128', value: 'CODE128' },
                            { label: 'EAN13', value: 'EAN13' },
                            { label: 'CODE39', value: 'CODE39' },
                          ]}
                        />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.heightPx')}</div>
                        <InputNumber min={20} max={100} style={{ width: '100%' }} value={selectedBlock.height} onChange={v => updateSelectedBlock({ height: v || 40 })} />
                      </div>
                    </Space>
                  )}
                  {selectedBlock.type === 'image' && (
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, background: token.colorFillTertiary, padding: '8px 12px', borderRadius: 6 }}>
                        <span style={{ fontSize: 13 }}>{t('pages.system.printTemplatesDesign.keepRatio')}</span>
                        <Radio.Group 
                          size="small" 
                          value={selectedBlock.keepRatio !== false} 
                          onChange={e => updateSelectedBlock({ keepRatio: e.target.value })}
                        >
                          <Radio.Button value={true}>{t('pages.system.printTemplatesDesign.on')}</Radio.Button>
                          <Radio.Button value={false}>{t('pages.system.printTemplatesDesign.off')}</Radio.Button>
                        </Radio.Group>
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.imageUrl')}</div>
                        <Input.TextArea rows={3} value={selectedBlock.url} onChange={e => updateSelectedBlock({ url: e.target.value })} placeholder={t('pages.system.printTemplatesDesign.imageUrlPlaceholder')} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.widthPx')}</div>
                          <InputNumber style={{ width: '100%' }} value={selectedBlock.width} onChange={v => updateSelectedBlock({ width: v || 100 })} />
                        </div>
                        <div>
                          <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.heightPx')} {selectedBlock.keepRatio && <span style={{ color: '#bfbfbf' }}>{t('pages.system.printTemplatesDesign.auto')}</span>}</div>
                          <InputNumber disabled={selectedBlock.keepRatio} style={{ width: '100%' }} value={selectedBlock.height} onChange={v => updateSelectedBlock({ height: v || 60 })} />
                        </div>
                      </div>
                    </Space>
                  )}
                  {selectedBlock.type === 'spacer' && (
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.spacing')}{t('pages.system.printTemplatesDesign.heightPx')}</div>
                        <InputNumber min={1} max={500} style={{ width: '100%' }} value={selectedBlock.height} onChange={v => updateSelectedBlock({ height: v || 20 })} />
                      </div>
                    </Space>
                  )}
                  {selectedBlock.type === 'if' && (
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <Input value={selectedBlock.condition} placeholder={t('pages.system.printTemplatesDesign.conditionExpr')} onChange={e => updateSelectedBlock({ condition: e.target.value })} />
                      <Input.TextArea value={selectedBlock.content} placeholder={t('pages.system.printTemplatesDesign.content')} onChange={e => updateSelectedBlock({ content: e.target.value })} />
                    </Space>
                  )}
                  {selectedBlock.type === 'for' && (
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <Input value={selectedBlock.item} placeholder={t('pages.system.printTemplatesDesign.itemVar')} onChange={e => updateSelectedBlock({ item: e.target.value })} />
                      <Input value={selectedBlock.collection} placeholder={t('pages.system.printTemplatesDesign.collectionVar')} onChange={e => updateSelectedBlock({ collection: e.target.value })} />
                      <Input.TextArea value={selectedBlock.template} placeholder={t('pages.system.printTemplatesDesign.itemTemplate')} onChange={e => updateSelectedBlock({ template: e.target.value })} />
                    </Space>
                  )}
                  {selectedBlock.type === 'detail_table' && (
                    <Space orientation="vertical" style={{ width: '100%' }} size={16}>
                      <div style={{ background: token.colorWarningBg, padding: '8px 12px', border: `1px solid ${token.colorWarningBorder}`, borderRadius: 6, fontSize: 12, color: token.colorWarningText }}>
                        <TableOutlined style={{ marginRight: 8 }} />
                        {t('pages.system.printTemplatesDesign.compDetailTableHint')}
                      </div>
                      <Card size="small" title={t('pages.system.printTemplatesDesign.tableStyle')} styles={{ header: { border: 0, fontSize: 13, color: token.colorTextSecondary } }}>
                        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.borderStyle')}</div>
                              <Select
                                style={{ width: '100%' }}
                                value={selectedBlock.tableStyle?.borderStyle ?? 'solid'}
                                onChange={(v) =>
                                  updateSelectedBlock({
                                    tableStyle: { ...selectedBlock.tableStyle, borderStyle: v },
                                  })
                                }
                                options={[
                                  { label: t('pages.system.printTemplatesDesign.solid'), value: 'solid' },
                                  { label: t('pages.system.printTemplatesDesign.dashed'), value: 'dashed' },
                                  { label: t('pages.system.printTemplatesDesign.none'), value: 'none' },
                                ]}
                              />
                            </div>
                            <div>
                              <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.border')}{t('pages.system.printTemplatesDesign.widthPx')}</div>
                              <InputNumber
                                min={0}
                                max={8}
                                style={{ width: '100%' }}
                                value={selectedBlock.tableStyle?.borderWidth ?? 1}
                                disabled={selectedBlock.tableStyle?.borderStyle === 'none'}
                                onChange={(v) =>
                                  updateSelectedBlock({
                                    tableStyle: { ...selectedBlock.tableStyle, borderWidth: v ?? 1 },
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: '#8c8c8c', flexShrink: 0 }}>{t('pages.system.printTemplatesDesign.borderColor')}</span>
                            <ColorPicker
                              value={selectedBlock.tableStyle?.borderColor ?? '#e2e8f0'}
                              disabled={selectedBlock.tableStyle?.borderStyle === 'none'}
                              onChange={(_, hex) =>
                                updateSelectedBlock({
                                  tableStyle: { ...selectedBlock.tableStyle, borderColor: hex },
                                })
                              }
                            />
                          </div>
                          <div>
                            <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.cellPadding')}</div>
                            <InputNumber
                              min={0}
                              max={32}
                              style={{ width: '100%' }}
                              value={selectedBlock.tableStyle?.cellPadding ?? 8}
                              onChange={(v) =>
                                updateSelectedBlock({
                                  tableStyle: { ...selectedBlock.tableStyle, cellPadding: v ?? 8 },
                                })
                              }
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.bodyFontSize')}</div>
                              <Input
                                placeholder={t('pages.system.printTemplatesDesign.defaultFontSize')}
                                value={selectedBlock.tableStyle?.fontSize ?? ''}
                                onChange={(e) =>
                                  updateSelectedBlock({
                                    tableStyle: {
                                      ...selectedBlock.tableStyle,
                                      fontSize: e.target.value.trim() || undefined,
                                    },
                                  })
                                }
                              />
                            </div>
                            <div>
                              <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.headerFontSize')}</div>
                              <Input
                                placeholder={t('pages.system.printTemplatesDesign.sameAsBody')}
                                value={selectedBlock.tableStyle?.headerFontSize ?? ''}
                                onChange={(e) =>
                                  updateSelectedBlock({
                                    tableStyle: {
                                      ...selectedBlock.tableStyle,
                                      headerFontSize: e.target.value.trim() || undefined,
                                    },
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div>
                            <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.headerFontWeight')}</div>
                            <Select
                              style={{ width: '100%' }}
                              value={selectedBlock.tableStyle?.headerFontWeight ?? '600'}
                              onChange={(v) =>
                                updateSelectedBlock({
                                  tableStyle: { ...selectedBlock.tableStyle, headerFontWeight: v },
                                })
                              }
                              options={[
                                { label: t('pages.system.printTemplatesDesign.weightNormal'), value: '400' },
                                { label: t('pages.system.printTemplatesDesign.weightMedium'), value: '500' },
                                { label: t('pages.system.printTemplatesDesign.weightSemiBold'), value: '600' },
                                { label: t('pages.system.printTemplatesDesign.weightBold'), value: 'bold' },
                              ]}
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.headerBackground')}</div>
                              <ColorPicker
                                value={selectedBlock.tableStyle?.headerBgColor ?? '#f8fafc'}
                                onChange={(_, hex) =>
                                  updateSelectedBlock({
                                    tableStyle: { ...selectedBlock.tableStyle, headerBgColor: hex },
                                  })
                                }
                              />
                            </div>
                            <div>
                              <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.headerTextColor')}</div>
                              <ColorPicker
                                value={selectedBlock.tableStyle?.headerTextColor ?? '#475569'}
                                onChange={(_, hex) =>
                                  updateSelectedBlock({
                                    tableStyle: { ...selectedBlock.tableStyle, headerTextColor: hex },
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div>
                            <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.bodyTextColor')}</div>
                            <ColorPicker
                              value={selectedBlock.tableStyle?.bodyTextColor ?? '#334155'}
                              onChange={(_, hex) =>
                                updateSelectedBlock({
                                  tableStyle: { ...selectedBlock.tableStyle, bodyTextColor: hex },
                                })
                              }
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.headerAlign')}</div>
                              <Radio.Group
                                size="small"
                                value={selectedBlock.tableStyle?.headerTextAlign ?? 'left'}
                                onChange={(e) =>
                                  updateSelectedBlock({
                                    tableStyle: { ...selectedBlock.tableStyle, headerTextAlign: e.target.value },
                                  })
                                }
                              >
                                <Radio.Button value="left"><AlignLeftOutlined /></Radio.Button>
                                <Radio.Button value="center"><AlignCenterOutlined /></Radio.Button>
                                <Radio.Button value="right"><AlignRightOutlined /></Radio.Button>
                              </Radio.Group>
                            </div>
                            <div>
                              <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.bodyAlign')}</div>
                              <Radio.Group
                                size="small"
                                value={selectedBlock.tableStyle?.bodyTextAlign ?? 'left'}
                                onChange={(e) =>
                                  updateSelectedBlock({
                                    tableStyle: { ...selectedBlock.tableStyle, bodyTextAlign: e.target.value },
                                  })
                                }
                              >
                                <Radio.Button value="left"><AlignLeftOutlined /></Radio.Button>
                                <Radio.Button value="center"><AlignCenterOutlined /></Radio.Button>
                                <Radio.Button value="right"><AlignRightOutlined /></Radio.Button>
                              </Radio.Group>
                            </div>
                          </div>
                          <div>
                            <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.verticalAlign')}</div>
                            <Radio.Group
                              size="small"
                              value={selectedBlock.tableStyle?.verticalAlign ?? 'top'}
                              onChange={(e) =>
                                updateSelectedBlock({
                                  tableStyle: { ...selectedBlock.tableStyle, verticalAlign: e.target.value },
                                })
                              }
                            >
                              <Radio.Button value="top" title={t('pages.system.printTemplatesDesign.alignTopAlt')}>
                                <VerticalAlignTopOutlined />
                              </Radio.Button>
                              <Radio.Button value="middle" title={t('pages.system.printTemplatesDesign.alignMiddleAlt')}>
                                <AlignCenterOutlined />
                              </Radio.Button>
                              <Radio.Button value="bottom" title={t('pages.system.printTemplatesDesign.alignBottomAlt')}>
                                <VerticalAlignBottomOutlined />
                              </Radio.Button>
                            </Radio.Group>
                          </div>
                          <div>
                            <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.tableWidth')}</div>
                            <Input
                              placeholder={t('pages.system.printTemplatesDesign.defaultTableWidth')}
                              value={selectedBlock.tableStyle?.width ?? ''}
                              onChange={(e) =>
                                updateSelectedBlock({
                                  tableStyle: {
                                    ...selectedBlock.tableStyle,
                                    width: e.target.value.trim() || undefined,
                                  },
                                })
                              }
                            />
                          </div>
                          <Checkbox
                            checked={selectedBlock.tableStyle?.zebraStripe === true}
                            onChange={(e) =>
                              updateSelectedBlock({
                                tableStyle: { ...selectedBlock.tableStyle, zebraStripe: e.target.checked },
                              })
                            }
                          >
                            {t('pages.system.printTemplatesDesign.zebraStripe')}
                          </Checkbox>
                          {selectedBlock.tableStyle?.zebraStripe ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.alternateColor')}</span>
                              <ColorPicker
                                value={selectedBlock.tableStyle?.zebraBgColor ?? '#fafafa'}
                                onChange={(_, hex) =>
                                  updateSelectedBlock({
                                    tableStyle: { ...selectedBlock.tableStyle, zebraBgColor: hex },
                                  })
                                }
                              />
                            </div>
                          ) : null}
                        </Space>
                      </Card>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.collectionVarHint')}</div>
                        <Input value={selectedBlock.collection} onChange={e => updateSelectedBlock({ collection: e.target.value })} />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.itemAliasHint')}</div>
                        <Input value={selectedBlock.row_alias} onChange={e => updateSelectedBlock({ row_alias: e.target.value })} />
                      </div>
                      <TableColumnDesigner 
                        columns={selectedBlock.columns || []}
                        onChange={cols => updateSelectedBlock({ columns: cols })}
                      />
                    </Space>
                  )}
                  {selectedBlock.type === 'columns' && (
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <div style={{ marginBottom: 8, fontWeight: 600 }}>{t('pages.system.printTemplatesDesign.columnConfig')}</div>
                      <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                        <div>
                          <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.horizontalAlign')}</div>
                          <Radio.Group
                            size="small"
                            buttonStyle="solid"
                            style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 4 }}
                            value={selectedBlock.horizontalAlign || 'start'}
                            onChange={(e) => updateSelectedBlock({ horizontalAlign: e.target.value })}
                          >
                            <Radio.Button value="start" title={t('pages.system.printTemplatesDesign.alignLeft')}><AlignLeftOutlined /></Radio.Button>
                            <Radio.Button value="center" title={t('pages.system.printTemplatesDesign.alignMiddleAlt')}><AlignCenterOutlined /></Radio.Button>
                            <Radio.Button value="end" title={t('pages.system.printTemplatesDesign.alignRight')}><AlignRightOutlined /></Radio.Button>
                            <Radio.Button value="space-between" title={t('pages.system.printTemplatesDesign.spaceBetween')}><OrderedListOutlined /></Radio.Button>
                            <Radio.Button value="space-around" title={t('pages.system.printTemplatesDesign.spaceAround')}><AppstoreOutlined /></Radio.Button>
                            <Radio.Button value="space-evenly" title={t('pages.system.printTemplatesDesign.spaceEvenly')}><AppstoreAddOutlined /></Radio.Button>
                          </Radio.Group>
                        </div>
                        <div>
                          <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>{t('pages.system.printTemplatesDesign.verticalAlign')}</div>
                          <Radio.Group
                            size="small"
                            buttonStyle="solid"
                            style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 4 }}
                            value={selectedBlock.verticalAlign || 'top'}
                            onChange={(e) => updateSelectedBlock({ verticalAlign: e.target.value })}
                          >
                            <Radio.Button value="top" title={t('pages.system.printTemplatesDesign.alignTopAlt')}><VerticalAlignTopOutlined /></Radio.Button>
                            <Radio.Button value="middle" title={t('pages.system.printTemplatesDesign.alignMiddleAlt')}><AlignCenterOutlined /></Radio.Button>
                            <Radio.Button value="bottom" title={t('pages.system.printTemplatesDesign.alignBottomAlt')}><VerticalAlignBottomOutlined /></Radio.Button>
                          </Radio.Group>
                        </div>
                      </Space>
                      {selectedBlock.cols.map((col, idx) => (
                        <div key={col.id} style={{ marginBottom: 12, padding: 8, border: '1px solid #f0f0f0', borderRadius: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 12 }}>{t('pages.system.printTemplatesDesign.colNumber', { n: idx + 1 })}</span>
                            <Button 
                              size="small" 
                              type="text"
                              danger 
                              icon={<DeleteOutlined />} 
                              onClick={() => {
                                const newCols = selectedBlock.cols.filter(c => c.id !== col.id);
                                updateSelectedBlock({ cols: newCols });
                              }} 
                            />
                          </div>
                          <Space.Compact style={{ width: '100%' }}>
                            <Input
                              size="small"
                              readOnly
                              value={t('pages.system.printTemplatesDesign.widthRatio')}
                              style={{ width: '32%' }}
                            />
                            <Input
                              size="small"
                              value={col.width}
                              placeholder={t('pages.system.printTemplatesDesign.widthRatioPlaceholder')}
                              style={{ width: '68%' }}
                              onChange={(e) => {
                                const newCols = selectedBlock.cols.map((c) =>
                                  c.id === col.id ? { ...c, width: e.target.value } : c,
                                );
                                updateSelectedBlock({ cols: newCols });
                              }}
                            />
                          </Space.Compact>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                            <Radio.Group
                              size="small"
                              buttonStyle="solid"
                              style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
                              value={col.horizontalAlign || 'start'}
                              onChange={(e) => {
                                const newCols = selectedBlock.cols.map(c => c.id === col.id ? { ...c, horizontalAlign: e.target.value } : c);
                                updateSelectedBlock({ cols: newCols });
                              }}
                            >
                              <Radio.Button value="start" title={t('pages.system.printTemplatesDesign.alignLeft')}><AlignLeftOutlined /></Radio.Button>
                              <Radio.Button value="center" title={t('pages.system.printTemplatesDesign.alignMiddleAlt')}><AlignCenterOutlined /></Radio.Button>
                              <Radio.Button value="end" title={t('pages.system.printTemplatesDesign.alignRight')}><AlignRightOutlined /></Radio.Button>
                            </Radio.Group>
                            <Radio.Group
                              size="small"
                              buttonStyle="solid"
                              style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
                              value={col.verticalAlign || 'top'}
                              onChange={(e) => {
                                const newCols = selectedBlock.cols.map(c => c.id === col.id ? { ...c, verticalAlign: e.target.value } : c);
                                updateSelectedBlock({ cols: newCols });
                              }}
                            >
                              <Radio.Button value="top" title={t('pages.system.printTemplatesDesign.alignTopAlt')}><VerticalAlignTopOutlined /></Radio.Button>
                              <Radio.Button value="middle" title={t('pages.system.printTemplatesDesign.alignMiddleAlt')}><AlignCenterOutlined /></Radio.Button>
                              <Radio.Button value="bottom" title={t('pages.system.printTemplatesDesign.alignBottomAlt')}><VerticalAlignBottomOutlined /></Radio.Button>
                            </Radio.Group>
                          </div>
                        </div>
                      ))}
                      <Button block type="dashed" icon={<AppstoreAddOutlined />} onClick={() => {
                        const newCol = { id: `col-${Date.now()}`, width: '1', horizontalAlign: 'start' as const, verticalAlign: 'top' as const, blocks: [] };
                        updateSelectedBlock({ cols: [...selectedBlock.cols, newCol] });
                      }}>{t('pages.system.printTemplatesDesign.addColumn')}</Button>
                    </Space>
                  )}
                </Card>

              </Space>
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#bfbfbf' }}>
                <AppstoreOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }} />
                <div>{t('pages.system.printTemplatesDesign.selectToEdit')}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      <DragOverlay adjustScale={false} dropAnimation={null}>
        {activeDragId ? (
            (() => {
              // 1. Sidebar Item Check
              if (activeDragId.startsWith('sidebar-')) {
                const parts = activeDragId.split('-');
                const type = parts[1];
                return <DragOverlayBlock type={type} label={t('pages.system.printTemplatesDesign.addNewComponent')} />;
              }
              
              // 2. Canvas Item Check
              const block = findBlockById(schemaBlocks, activeDragId);
              if (block) {
                const typeLabels: Record<string, string> = {
                  text: t('pages.system.printTemplatesDesign.textContent'),
                  field: t('pages.system.printTemplatesDesign.compVariables'),
                  qrcode: t('pages.system.printTemplatesDesign.typeQRCode'),
                  barcode: t('pages.system.printTemplatesDesign.typeBarcode'),
                  image: t('pages.system.printTemplatesDesign.compImage'),
                  divider: t('pages.system.printTemplatesDesign.compDivider'),
                  spacer: t('pages.system.printTemplatesDesign.compSpacer'),
                  columns: t('pages.system.printTemplatesDesign.compColumns'),
                  detail_table: t('pages.system.printTemplatesDesign.compDetailTable'),
                  if: t('pages.system.printTemplatesDesign.compIf'),
                  for: t('pages.system.printTemplatesDesign.compFor')
                };
                return <DragOverlayBlock type={block.type} label={t('pages.system.printTemplatesDesign.moveComponent')} />;
              }
              
              return null;
            })()
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default PrintTemplateDesignPage;

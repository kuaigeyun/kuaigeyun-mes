import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Button, Input, Space, Typography, Card, Select, InputNumber, Divider, ColorPicker, Radio, theme } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, EyeOutlined, QrcodeOutlined, DashOutlined, FontSizeOutlined, BoldOutlined, AlignCenterOutlined, AlignLeftOutlined, AlignRightOutlined, AppstoreOutlined, FunctionOutlined, OrderedListOutlined, SettingOutlined, ZoomInOutlined, ZoomOutOutlined, DeleteOutlined, VerticalAlignTopOutlined, VerticalAlignBottomOutlined, AppstoreAddOutlined, PlusOutlined, TableOutlined, BarcodeOutlined, PictureOutlined } from '@ant-design/icons';
import { compilePrintTemplate, compilePreviewPrintTemplate, getPrintTemplateByUuid, updatePrintTemplate } from '../../../../services/printTemplate';
import { getArrayTableTemplates, getTemplateVariableItems } from '../../../../config/printTemplateSchemas';
import { useSiteLogoUrl } from '../../../../hooks/useSiteLogoUrl';
import { QRCodeSVG } from 'qrcode.react';

import {
  DndContext, 
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
  useDraggable,
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
  | { id: string; type: 'detail_table'; collection: string; row_alias: string; columns: Array<{ key: string; label: string }> }
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
  blocks: DesignerNodeSchema[];
}

const PAPER_SIZES: Record<string, { width: number; height: number; label: string }> = {
  A4: { width: 210, height: 297, label: 'A4 (210x297mm)' },
  A3: { width: 297, height: 420, label: 'A3 (297x420mm)' },
  A5: { width: 148, height: 210, label: 'A5 (148x210mm)' },
  'A4-2': { width: 210, height: 148.5, label: 'A4 二分单 (210x148.5mm)' },
  'A4-3': { width: 210, height: 99, label: 'A4 三分单 (210x99mm)' },
  '241-1': { width: 241, height: 280, label: '针式 241 全叠 (241x280mm)' },
  '241-2': { width: 241, height: 140, label: '针式 241 二分 (241x140mm)' },
  '241-3': { width: 241, height: 93, label: '针式 241 三分 (241x93mm)' },
};

type SamplePreset = { key: string; label: string; data: Record<string, any> };

const QUOTATION_SAMPLE_PRESETS: SamplePreset[] = [
  {
    key: 'quotation-short',
    label: '报价单-短单',
    data: {
      quotation_code: 'BJ-2026-0001',
      customer_name: '深圳某制造客户',
      quotation_date: '2026-04-25',
      total_amount: 12345.67,
      notes: '交期 7 天，含税含运费。',
      items: [
        {
          material_code: 'MAT-001',
          material_name: '铝合金壳体',
          material_spec: 'A356-T6',
          material_unit: '件',
          quote_quantity: 100,
          unit_price: 12.34,
          total_amount: 1234,
        },
      ],
    },
  },
  {
    key: 'quotation-long',
    label: '报价单-长单(分页压测)',
    data: {
      quotation_code: 'BJ-2026-0099',
      customer_name: '华南电子装备集团有限公司',
      quotation_date: '2026-04-25',
      total_amount: 286420.5,
      notes: '用于测试长明细分页、表头重复、尾部金额对齐。',
      items: Array.from({ length: 35 }).map((_, i) => ({
        material_code: `MAT-${String(i + 1).padStart(3, '0')}`,
        material_name: `高精密结构件-${i + 1}`,
        material_spec: `规格-${(i % 7) + 1}`,
        material_unit: '件',
        quote_quantity: (i + 1) * 3,
        unit_price: Number((8.6 + i * 0.37).toFixed(2)),
        total_amount: Number((((i + 1) * 3) * (8.6 + i * 0.37)).toFixed(2)),
      })),
    },
  },
  {
    key: 'quotation-notes',
    label: '报价单-多行备注',
    data: {
      quotation_code: 'BJ-2026-0108',
      customer_name: '华东自动化设备有限公司',
      quotation_date: '2026-04-25',
      total_amount: 56432,
      notes: '备注第一行：本报价含13%增值税。\n备注第二行：付款方式月结30天。\n备注第三行：如需开模费用请另行确认。\n备注第四行：报价有效期15天。',
      items: [
        {
          material_code: 'MAT-110',
          material_name: '控制面板总成',
          material_spec: 'CP-20',
          material_unit: '套',
          quote_quantity: 20,
          unit_price: 688.5,
          total_amount: 13770,
        },
        {
          material_code: 'MAT-111',
          material_name: '支架组件',
          material_spec: 'BR-07',
          material_unit: '套',
          quote_quantity: 50,
          unit_price: 293.24,
          total_amount: 14662,
        },
      ],
    },
  },
];

const SALES_ORDER_SAMPLE_PRESETS: SamplePreset[] = [
  {
    key: 'sales-order-default',
    label: '销售订单-标准样本',
    data: {
      order_code: 'SO-2026-0012',
      customer_name: '华北装备制造有限公司',
      order_date: '2026-04-25',
      delivery_date: '2026-05-03',
      total_amount: 98650.2,
      notes: '请按生产排期分批交付。',
      items: [
        { material_code: 'SOM-001', material_name: '装配底座', material_spec: 'DZ-01', material_unit: '件', order_quantity: 50, unit_price: 320, total_amount: 16000 },
        { material_code: 'SOM-002', material_name: '定位板', material_spec: 'DW-09', material_unit: '件', order_quantity: 80, unit_price: 180.5, total_amount: 14440 },
      ],
    },
  },
];

const PURCHASE_ORDER_SAMPLE_PRESETS: SamplePreset[] = [
  {
    key: 'purchase-order-default',
    label: '采购订单-标准样本',
    data: {
      order_code: 'PO-2026-0038',
      supplier_name: '苏州金属材料有限公司',
      order_date: '2026-04-25',
      required_date: '2026-05-08',
      total_amount: 46320,
      notes: '来料请附材质证明与质检报告。',
      items: [
        { material_code: 'POM-001', material_name: '不锈钢板', material_spec: '304-2mm', material_unit: '张', ordered_quantity: 120, unit_price: 132, total_amount: 15840 },
        { material_code: 'POM-002', material_name: '六角螺栓', material_spec: 'M8*20', material_unit: '个', ordered_quantity: 5000, unit_price: 2.1, total_amount: 10500 },
      ],
    },
  },
];

const COMMON_SAMPLE_PRESETS: SamplePreset[] = [
  {
    key: 'common-default',
    label: '通用样本',
    data: {
      code: 'DOC-2026-0001',
      name: '示例单据',
      date: '2026-04-25',
      total_amount: 0,
      notes: '请按实际单据字段调整样本 JSON。',
      items: [{ item_code: 'ITEM-001', item_name: '示例项', quantity: 1, unit_price: 0, total_amount: 0 }],
    },
  },
];

type VariableCategory = {
  title: string;
  items: Array<{ key: string; label: string }>;
};

const groupVariables = (items: Array<{ key: string; label: string }>): VariableCategory[] => {
  const groups: Record<string, VariableCategory> = {
    header: { title: '基础信息', items: [] },
    financial: { title: '财务金额', items: [] },
    items: { title: '明细数据', items: [] },
    other: { title: '其他', items: [] },
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

const getSamplePresetsByDocType = (docType: string): SamplePreset[] => {
  if (docType === 'quotation') return QUOTATION_SAMPLE_PRESETS;
  if (docType === 'sales_order') return SALES_ORDER_SAMPLE_PRESETS;
  if (docType === 'purchase_order') return PURCHASE_ORDER_SAMPLE_PRESETS;
  return COMMON_SAMPLE_PRESETS;
};

const TextBlock: React.FC<{ block: DesignerNodeSchema & { type: 'text' }; selected?: boolean; onSelect?: () => void }> = ({ block, selected, onSelect }) => {
  const { content, style, tag = 'div' } = block;
  const Tag = tag as any;
  return (
    <div
      style={{
        padding: 10,
        border: selected ? '1px solid #1677ff' : '1px dashed #d9d9d9',
        borderRadius: 6,
        marginBottom: 0,
        background: '#fff',
        fontSize: style?.fontSize || 'inherit',
        fontWeight: style?.fontWeight || 'normal',
        textAlign: (style?.textAlign as React.CSSProperties['textAlign']) || 'left',
        color: style?.color || 'inherit',
        letterSpacing: style?.letterSpacing || 'normal',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
    >
      <Tag style={{ margin: 0, fontSize: 'inherit', fontWeight: 'inherit', textAlign: 'inherit', color: 'inherit', whiteSpace: 'pre-wrap' }}>
        {content || '文本块'}
      </Tag>
    </div>
  );
};

const FieldBlock: React.FC<{ block: DesignerNodeSchema & { type: 'field' }; selected?: boolean; onSelect?: () => void }> = ({ block, selected, onSelect }) => {
  const { key: fieldKey, label, style, showLabel = true } = block;
  return (
    <div
      style={{
        padding: 10,
        border: selected ? '1px solid #1677ff' : '1px solid #91caff',
        borderRadius: 6,
        marginBottom: 0,
        background: '#e6f4ff',
        fontSize: style?.fontSize || 'inherit',
        fontWeight: style?.fontWeight || 'bold',
        textAlign: (style?.textAlign as React.CSSProperties['textAlign']) || 'left',
        color: style?.color || '#1677ff',
        letterSpacing: style?.letterSpacing || 'normal',
        position: 'relative'
      }}
      onClick={onSelect}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600 }}>{label || fieldKey}</div>
        {!showLabel && (
          <div style={{ fontSize: 9, background: '#bae7ff', color: '#0050b3', padding: '1px 4px', borderRadius: 4 }}>仅数值</div>
        )}
      </div>
      <div style={{ fontFamily: 'monospace', opacity: 0.8 }}>
        {showLabel ? `${label || fieldKey}：{{ ${fieldKey} }}` : `{{ ${fieldKey} }}`}
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
      onClick={onSelect}
    >
      <Divider style={{ margin: 0 }} />
    </div>
  );
};




const BarcodeBlock: React.FC<{ block: DesignerNodeSchema & { type: 'barcode' }; selected?: boolean; onSelect?: () => void }> = ({ block, selected, onSelect }) => {
  return (
    <div
      style={{
        padding: 10,
        border: selected ? '1px solid #1677ff' : '1px dashed #d9d9d9',
        borderRadius: 6,
        marginBottom: 0,
        background: '#fff',
        textAlign: (block.style?.textAlign as React.CSSProperties['textAlign']) || 'center',
      }}
      onClick={onSelect}
    >
      <div style={{ display: 'inline-block', padding: 8, border: '1px solid #f0f0f0' }}>
        <div style={{ height: block.height || 40, width: 150, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ccc' }}>
          <DashOutlined style={{ fontSize: 24, opacity: 0.5 }} />
          <span style={{ fontSize: 10, marginLeft: 4 }}>Barcode Preview</span>
        </div>
        <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 4 }}>{block.format}: {block.key}</div>
      </div>
    </div>
  );
};

const ImageBlock: React.FC<{ block: DesignerNodeSchema & { type: 'image' }; selected?: boolean; onSelect?: () => void }> = ({ block, selected, onSelect }) => {
  return (
    <div
      style={{
        padding: 10,
        border: selected ? '1px solid #1677ff' : '1px dashed #d9d9d9',
        borderRadius: 6,
        marginBottom: 0,
        background: '#fff',
        textAlign: (block.style?.textAlign as React.CSSProperties['textAlign']) || 'left',
      }}
      onClick={onSelect}
    >
      <div style={{ display: 'inline-block', maxWidth: '100%' }}>
        {block.url ? (
          <img 
            src={block.url} 
            alt="Logo" 
            style={{ 
              width: block.width, 
              height: block.keepRatio ? 'auto' : block.height, 
              objectFit: 'contain' 
            }} 
          />
        ) : (
          <div style={{ width: block.width || 100, height: block.height || 60, background: '#fafafa', border: '1px dashed #d9d9d9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#bfbfbf' }}>
            <PictureOutlined style={{ fontSize: 24, marginBottom: 4 }} />
            <span style={{ fontSize: 10 }}>IMAGE / LOGO</span>
          </div>
        )}
      </div>
    </div>
  );
};

const SpacerBlock: React.FC<{ block: DesignerNodeSchema & { type: 'spacer' }; selected?: boolean; onSelect?: () => void }> = ({ block, selected, onSelect }) => {
  return (
    <div
      style={{
        height: block.height || 20,
        border: selected ? '1px solid #1677ff' : '1px dashed #f0f0f0',
        borderRadius: 4,
        background: selected ? 'rgba(22, 119, 255, 0.05)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        color: '#bfbfbf',
        cursor: 'pointer',
        marginBottom: 0,
        transition: 'all 0.2s'
      }}
      onClick={onSelect}
    >
      <VerticalAlignTopOutlined style={{ marginRight: 4 }} />
      <span>垂直间距 {block.height}px</span>
      <VerticalAlignBottomOutlined style={{ marginLeft: 4 }} />
    </div>
  );
};

const SortableBlockWrapper: React.FC<{ 
  id: string; 
  children: React.ReactNode;
}> = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative' as const,
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-block-wrapper">
      {/* Drag handle — top-right, inside the block, visible on hover */}
      <div 
        {...attributes} 
        {...listeners} 
        className="drag-handle"
        style={{
          position: 'static',
          cursor: isDragging ? 'grabbing' : 'grab',
          opacity: 0,
          transition: 'opacity 0.2s',
          padding: '6px 5px',
          marginLeft: -28,
          marginRight: 8,
          color: '#8c8c8c',
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 4,
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          border: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          fontSize: 14,
          userSelect: 'none',
        }}
        title="拖拽调整顺序"
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
        icon={icon} 
        onClick={onClick} 
        style={{ textAlign: 'left', height: 40 }}
      >
        {label}
      </Button>
    </div>
  );
};



const LogicBlock: React.FC<{ title: string; body: string; selected?: boolean; onSelect?: () => void }> = ({ title, body, selected, onSelect }) => {
  return (
    <div
      style={{
        padding: 10,
        border: selected ? '1px solid #1677ff' : '1px solid #d9d9d9',
        borderRadius: 6,
        marginBottom: 0,
        background: '#fff7e6',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
    >
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ fontFamily: 'monospace', color: '#595959', whiteSpace: 'pre-wrap' }}>{body}</div>
    </div>
  );
};

const OrientationSelector: React.FC<{
  value: 'portrait' | 'landscape';
  onChange: (val: 'portrait' | 'landscape') => void;
}> = ({ value, onChange }) => {
  const { token } = theme.useToken();
  const options = [
    { key: 'portrait', label: '纵向', icon: <div style={{ width: 14, height: 20, border: `2px solid currentColor`, borderRadius: 2 }} /> },
    { key: 'landscape', label: '横向', icon: <div style={{ width: 20, height: 14, border: `2px solid currentColor`, borderRadius: 2 }} /> }
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
              border: `2px solid ${isActive ? token.colorPrimary : '#f0f0f0'}`,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              background: isActive ? token.colorPrimaryBg : '#fff',
              color: isActive ? token.colorPrimary : '#8c8c8c',
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
  const ticks = [];
  // Render labels every 20mm to avoid overlap
  for (let i = 0; i <= size; i += 20) {
    ticks.push(
      <div 
        key={i} 
        style={{ 
          position: 'absolute', 
          [orientation === 'horizontal' ? 'left' : 'top']: `${i}mm`,
          fontSize: 9,
          color: '#8c8c8c',
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
      background: '#f5f5f5',
      border: '1px solid #d9d9d9',
      boxSizing: 'border-box',
      backgroundImage: orientation === 'horizontal' 
        ? `repeating-linear-gradient(90deg, #d9d9d9 0, #d9d9d9 1px, transparent 1px, transparent 1mm),
           repeating-linear-gradient(90deg, #8c8c8c 0, #8c8c8c 1px, transparent 1px, transparent 5mm),
           repeating-linear-gradient(90deg, #595959 0, #595959 1px, transparent 1px, transparent 10mm)`
        : `repeating-linear-gradient(180deg, #d9d9d9 0, #d9d9d9 1px, transparent 1px, transparent 1mm),
           repeating-linear-gradient(180deg, #8c8c8c 0, #8c8c8c 1px, transparent 1px, transparent 5mm),
           repeating-linear-gradient(180deg, #595959 0, #595959 1px, transparent 1px, transparent 10mm)`,
      backgroundSize: orientation === 'horizontal' ? 'auto 4px, auto 8px, auto 12px' : '4px auto, 8px auto, 12px auto',
      backgroundPosition: orientation === 'horizontal' ? 'bottom' : 'right',
      backgroundRepeat: orientation === 'horizontal' ? 'repeat-x' : 'repeat-y',
    }}>
      {ticks}
    </div>
  );
};

const TableColumnDesigner: React.FC<{
  columns: Array<{ key: string; label: string }>;
  onChange: (cols: Array<{ key: string; label: string }>) => void;
}> = ({ columns, onChange }) => {
  const handleAdd = () => onChange([...columns, { key: '', label: '新列' }]);
  const handleRemove = (index: number) => {
    const next = [...columns];
    next.splice(index, 1);
    onChange(next);
  };
  const handleUpdate = (index: number, partial: Partial<{ key: string; label: string }>) => {
    const next = [...columns];
    next[index] = { ...next[index], ...partial };
    onChange(next);
  };

  return (
    <div style={{ background: '#fafafa', padding: 12, borderRadius: 8, border: '1px solid #f0f0f0' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#595959' }}>列字段配置</span>
        <Button type="primary" ghost size="small" icon={<PlusOutlined />} onClick={handleAdd}>添加列</Button>
      </div>
      {columns.map((col, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <Input 
            size="small" 
            placeholder="列名" 
            value={col.label} 
            onChange={e => handleUpdate(idx, { label: e.target.value })} 
            style={{ width: '45%' }}
          />
          <Input 
            size="small" 
            placeholder="字段" 
            value={col.key} 
            onChange={e => handleUpdate(idx, { key: e.target.value })} 
            style={{ width: '45%', fontFamily: 'monospace' }}
          />
          <Button 
            type="text" 
            danger 
            size="small" 
            icon={<DeleteOutlined />} 
            onClick={() => handleRemove(idx)} 
          />
        </div>
      ))}
      {columns.length === 0 && <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '10px 0', fontSize: 12 }}>暂无列配置</div>}
    </div>
  );
};

const QRBlock: React.FC<{ block: DesignerNodeSchema & { type: 'qrcode' }; selected?: boolean; onSelect?: () => void }> = ({ block, selected, onSelect }) => {
  // In design mode, show a real QR code with the field key as preview value
  const previewValue = `{{ ${block.key} }}`;
  return (
    <div
      style={{
        padding: 10,
        border: selected ? '2px solid #1677ff' : '1px dashed #91caff',
        borderRadius: 6,
        marginBottom: 0,
        background: '#e6f4ff',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
      }}
      onClick={onSelect}
    >
      <QRCodeSVG
        value={previewValue}
        size={block.size || 100}
      />
      <div style={{ fontSize: 11, color: '#1677ff', fontFamily: 'monospace', background: '#bae7ff', padding: '2px 8px', borderRadius: 4 }}>
        {previewValue}
      </div>
    </div>
  );
};

const DroppableColumn: React.FC<{ 
  id: string; 
  children: React.ReactNode; 
  style?: React.CSSProperties;
  onInsertToCol?: (type: 'text' | 'field' | 'qrcode' | 'divider' | 'barcode' | 'image' | 'spacer') => void;
  isSelected?: boolean;
  isDragging?: boolean;
}> = ({ id, children, style, onInsertToCol, isSelected, isDragging }) => {
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
          ? 'rgba(22, 119, 255, 0.10)'
          : isDragging
          ? 'rgba(22, 119, 255, 0.04)'
          : style?.background,
        border: isOver
          ? '2px solid #1677ff'
          : isDragging
          ? '1.5px dashed #91caff'
          : (style?.border as string) || '1px dotted #f0f0f0',
        transition: 'all 0.2s',
        minHeight: isDragging ? 80 : undefined,
      }}
    >
      <div style={{ fontSize: 10, color: isOver ? '#1677ff' : '#bfbfbf', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: isOver ? 600 : 400 }}>
        <span>{isOver ? '↓ 放置到此列' : 'Column'}</span>
        {isSelected && onInsertToCol && (
          <Space size={4}>
             <Button size="small" type="text" icon={<QrcodeOutlined />} onClick={(e) => { e.stopPropagation(); onInsertToCol('qrcode'); }} title="添加二维码" />
             <Button size="small" type="text" icon={<BarcodeOutlined />} onClick={(e) => { e.stopPropagation(); onInsertToCol('barcode'); }} title="添加条形码" />
             <Button size="small" type="text" icon={<PictureOutlined />} onClick={(e) => { e.stopPropagation(); onInsertToCol('image'); }} title="添加图片/Logo" />
             <Button size="small" type="text" icon={<DashOutlined />} onClick={(e) => { e.stopPropagation(); onInsertToCol('divider'); }} title="添加分割线" />
          </Space>
        )}
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
  onInsertToCol: (colId: string, type: 'text' | 'field' | 'qrcode' | 'divider' | 'barcode' | 'image' | 'spacer') => void;
  isDragging?: boolean;
}> = ({ block, selectedId, onSelect, renderBlocks, onInsertToCol, isDragging }) => {
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
        // 列先统一拉伸到同高，保证每栏垂直对齐可见
        alignItems: 'stretch',
        padding: 8, 
        border: isDragging
          ? '1.5px dashed #69b1ff'
          : isSelected ? '1px solid #1677ff' : '1px dashed #d9d9d9',
        borderRadius: 6,
        background: isDragging ? 'rgba(230, 244, 255, 0.5)' : isSelected ? '#f0f7ff' : 'transparent',
        marginBottom: 0,
        minHeight: isDragging ? 120 : 100,
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
          onInsertToCol={(type) => onInsertToCol(col.id, type)}
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
                color: isDragging ? '#69b1ff' : '#d9d9d9', 
                fontSize: isDragging ? 12 : 11, 
                fontWeight: isDragging ? 600 : 400,
                border: isDragging ? '1px dashed #91caff' : '1px dashed #eee',
                borderRadius: 4,
                transition: 'all 0.2s',
                width: '100%',
              }}>
                {isDragging ? '⬇ 拖拽到此处' : 'Drop Here'}
              </div>
            )}
          </div>
        </DroppableColumn>
      ))}
    </div>
  );
};

const CanvasArea: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: '#fff',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      padding: '20mm 15mm', // Standard print margins
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
  const tableTemplates = useMemo(() => getArrayTableTemplates(templateType), [templateType]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#8c8c8c', marginBottom: 4 }}>基础组件</div>
      <DraggableSidebarItem type="text" label="文本内容" icon={<FontSizeOutlined />} onClick={onInsertText} />
      <DraggableSidebarItem type="divider" label="横向分割线" icon={<DashOutlined />} onClick={onDivider} />
      <DraggableSidebarItem type="columns" label="分栏容器 (Row/Cols)" icon={<AppstoreOutlined />} onClick={onColumns} />
      <DraggableSidebarItem type="spacer" label="纵向间距 (Spacer)" icon={<VerticalAlignBottomOutlined />} onClick={() => onSpacer(20)} />
      
      <div style={{ fontWeight: 600, fontSize: 13, color: '#8c8c8c', marginTop: 12, marginBottom: 4 }}>工业标识</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DraggableSidebarItem type="qrcode" label="二维码" icon={<QrcodeOutlined />} onClick={onQRCode} />
        <DraggableSidebarItem type="barcode" label="条形码" icon={<BarcodeOutlined />} onClick={onBarcode} />
        <DraggableSidebarItem type="image" label="图片内容" icon={<PictureOutlined />} onClick={onImage} />
        <DraggableSidebarItem type="image" label="公司 LOGO" icon={<PictureOutlined />} onClick={onLogo} />
      </div>

      <div style={{ fontWeight: 600, fontSize: 13, color: '#8c8c8c', marginTop: 12, marginBottom: 4 }}>页面预设</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <DraggableSidebarItem type="columns" label="标准页眉 (Logo+标题)" icon={<VerticalAlignTopOutlined />} onClick={() => onHeader(1)} />
        <DraggableSidebarItem type="columns" label="居中页眉 (标题+线)" icon={<VerticalAlignTopOutlined />} onClick={() => onHeader(2)} />
        <DraggableSidebarItem type="columns" label="标准页脚 (页码)" icon={<VerticalAlignBottomOutlined />} onClick={onFooter} />
      </div>
      
      <div style={{ fontWeight: 600, fontSize: 13, color: '#8c8c8c', marginTop: 12, marginBottom: 4 }}>逻辑与表格</div>
      <DraggableSidebarItem type="if" label="条件判断 (If)" icon={<FunctionOutlined />} onClick={onIf} />
      <DraggableSidebarItem type="for" label="循环遍历 (For)" icon={<FunctionOutlined />} onClick={onFor} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tableTemplates.map(tpl => (
          <DraggableSidebarItem 
            key={tpl.arrayKey} 
            type="detail_table" 
            label={`${tpl.label} (表格)`} 
            icon={<AppstoreOutlined />} 
            onClick={() => onTable(tpl.arrayKey, tpl.columns)} 
            payload={{ collection: tpl.arrayKey, columns: tpl.columns }}
          />
        ))}
      </div>
    </div>
  );
};

const VariableLibrary: React.FC<{
  onInsert: (key: string, label: string) => void;
  onInsertQR: (key: string) => void;
  templateType: string;
}> = ({ onInsert, onInsertQR, templateType }) => {
  const [query, setQuery] = useState('');
  const allVars = useMemo(() => getTemplateVariableItems(templateType), [templateType]);
  const filteredVars = useMemo(() => {
    if (!query.trim()) return allVars;
    const q = query.toLowerCase();
    return allVars.filter(v => v.label.toLowerCase().includes(q) || v.key.toLowerCase().includes(q));
  }, [allVars, query]);

  const groups = useMemo(() => groupVariables(filteredVars), [filteredVars]);

  return (
    <div>
      <Input.Search
        placeholder="搜索变量..."
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
                    title={`插入字段: ${v.key}`}
                  >
                    {v.label}
                  </Button>
                  {/* Insert as QR Code */}
                  <Button
                    size="small"
                    icon={<QrcodeOutlined />}
                    onClick={() => onInsertQR(v.key)}
                    title={`以二维码插入: ${v.key}`}
                    style={{ flexShrink: 0, height: 36, width: 36 }}
                  />
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
  const { message: messageApi } = App.useApp();
  const siteLogoUrl = useSiteLogoUrl();
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [templateType, setTemplateType] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
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

  const samplePresets = useMemo(() => getSamplePresetsByDocType(templateType), [templateType]);
  const hasLoaded = React.useRef(false);

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
      } else {
        const first: DesignerNodeSchema = {
          id: `text-${Date.now()}`,
          type: 'text',
          content: data.content || '请输入文本内容',
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

  const handleSave = async () => {
    if (!uuid) return;
    try {
      const schema: DesignerSchema = { 
        version: 'v1', 
        pageSize, 
        orientation, 
        margins,
        blocks: schemaBlocks 
      };
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
        messageApi.warning(`模板已保存，编译告警 ${compiled.warnings.length} 条`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      messageApi.error(msg || t('pages.system.printTemplatesDesign.saveFailed'));
    }
  };

  const handleCompilePreview = async () => {
    try {
      setPreviewLoading(true);
      const schema: DesignerSchema = { 
        version: 'v1', 
        pageSize, 
        orientation, 
        margins,
        blocks: schemaBlocks 
      };
      const compiled = await compilePrintTemplate({
        source_type: 'designer_json',
        source: schema,
        target_engine: 'jinja2',
        document_type: templateType || undefined,
      });
      setCompiledPreview(compiled.compiled_template || '');
      setCompileWarnings(compiled.warnings || []);
      messageApi.success('Uni-Print 编译预览已更新');
    } catch (error: any) {
      messageApi.error(error?.message || '编译预览失败');
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
      } catch {
        if (!silent) messageApi.error('样本数据 JSON 格式错误');
        return;
      }
      const schema: DesignerSchema = { version: 'v1', pageSize, orientation, margins, blocks: schemaBlocks };
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
      if (!silent) messageApi.success('预览结果已生成');
    } catch (error: any) {
      if (!silent) messageApi.error(error?.message || '数据预览失败');
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
    messageApi.success(`已填充样本：${preset.label}`);
  };

  const handleInsertText = () => {
    const item: DesignerNodeSchema = { id: `text-${Date.now()}`, type: 'text', content: '请输入文本内容' };
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
    const token = `{{ ${key} }}`;
    if (!selectedBlockId) {
      handleInsertField(key, label);
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
      messageApi.success(`已插入变量：${label}`);
    } else {
      handleInsertField(key, label);
      messageApi.info('当前块不支持内嵌变量，已新增字段块');
    }
  };

  const handleInsertIf = () => {
    const item: DesignerNodeSchema = {
      id: `if-${Date.now()}`,
      type: 'if',
      condition: 'status == "已通过"',
      content: '条件满足后显示',
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
      url: siteLogoUrl || '{{ company_logo }}', 
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
          { id: `c1-${Date.now()}`, width: '1', blocks: [{ id: `txt-${Date.now()}-1`, type: 'text', content: '### 某某制造有限公司', tag: 'h3' }] },
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
            { id: `txt-${Date.now()}-1`, type: 'text', content: '## 报价单', tag: 'h2', style: { textAlign: 'center' } },
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
        { id: `c1-${Date.now()}`, width: '1', horizontalAlign: 'center', blocks: [{ id: `txt-${Date.now()}-1`, type: 'text', content: '页码：{{ page_num }} / {{ total_pages }}', style: { textAlign: 'center', fontSize: '12px' } }] }
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
    for (let i = 0; i < blocks.length; i++) {
      const blk = blocks[i];
      if (blk.id === targetId) return { list: blocks, index: i };
      
      if (blk.type === 'columns') {
        for (const col of blk.cols) {
          // If the target is the column itself (e.g. drop on empty column)
          if (col.id === targetId) {
            return { list: col.blocks, index: col.blocks.length };
          }
          const found = findTargetInfo(col.blocks, targetId);
          if (found) return found;
        }
      }
    }
    return null;
  };

  const handleInsertToCol = (colId: string, type: 'text' | 'field' | 'qrcode' | 'divider' | 'barcode' | 'image' | 'spacer') => {
    setSchemaBlocks((prev) => {
      const recursiveInsert = (blocks: DesignerNodeSchema[]): DesignerNodeSchema[] => {
        return blocks.map((blk) => {
          if (blk.type === 'columns') {
            const hasCol = blk.cols.find((c) => c.id === colId);
            if (hasCol) {
              const newInnerBlk: DesignerNodeSchema = 
                type === 'text' ? { id: `text-${Date.now()}`, type: 'text', content: '子文本内容' } :
                type === 'divider' ? { id: `divider-${Date.now()}`, type: 'divider' } :
                type === 'qrcode' ? { id: `qr-${Date.now()}`, type: 'qrcode', key: 'qr_key', size: 60 } :
                type === 'barcode' ? { id: `bc-${Date.now()}`, type: 'barcode', key: 'bc_key', format: 'CODE128', height: 40 } :
                type === 'image' ? { id: `img-${Date.now()}`, type: 'image', url: '', width: 80, height: 40 } :
                type === 'spacer' ? { id: `spacer-${Date.now()}`, type: 'spacer', height: 20 } :
                { id: `field-${Date.now()}`, type: 'field', key: 'key', label: '变量' };
              
              return {
                ...blk,
                cols: blk.cols.map((c) =>
                  c.id === colId ? { ...c, blocks: [...c.blocks, newInnerBlk] } : c
                ),
              };
            }
            return {
              ...blk,
              cols: blk.cols.map((c) => ({ ...c, blocks: recursiveInsert(c.blocks) })),
            };
          }
          return blk;
        });
      };
      return recursiveInsert(prev);
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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

    // Handle reordering / internal moves
    if (active.id !== over.id && !String(active.id).startsWith('sidebar-')) {
      const activeId = String(active.id);
      const overId = String(over.id);
      const overType = over.data?.current?.type;

      // Case 1: Dropping a canvas block INTO a column container
      if (overType === 'column') {
        const colId = overId;
        setSchemaBlocks(prev => {
          // Step 1: find and remove the dragged block from wherever it is
          let draggedBlock: DesignerNodeSchema | null = null;
          const removeBlock = (blocks: DesignerNodeSchema[]): DesignerNodeSchema[] => {
            const idx = blocks.findIndex(b => b.id === activeId);
            if (idx !== -1) {
              draggedBlock = blocks[idx];
              return [...blocks.slice(0, idx), ...blocks.slice(idx + 1)];
            }
            return blocks.map(blk => {
              if (blk.type === 'columns') {
                return { ...blk, cols: blk.cols.map(c => ({ ...c, blocks: removeBlock(c.blocks) })) };
              }
              return blk;
            });
          };
          const afterRemove = removeBlock(prev);
          if (!draggedBlock) return prev;

          // Step 2: append the block into the target column
          const addToCol = (blocks: DesignerNodeSchema[]): DesignerNodeSchema[] => {
            return blocks.map(blk => {
              if (blk.type === 'columns') {
                return {
                  ...blk,
                  cols: blk.cols.map(c => {
                    if (c.id === colId) return { ...c, blocks: [...c.blocks, draggedBlock!] };
                    return { ...c, blocks: addToCol(c.blocks) };
                  })
                };
              }
              return blk;
            });
          };
          return addToCol(afterRemove);
        });
        return;
      }

      // Case 2: Normal reorder within the same list (root or within a column)
      const activeInfo = findTargetInfo(schemaBlocks, activeId);
      const overInfo = findTargetInfo(schemaBlocks, overId);
      if (!activeInfo || !overInfo) return;

      if (activeInfo.list === overInfo.list) {
        // Same container — simple reorder by IDs
        setSchemaBlocks(prev => {

          // Reorder by IDs — works for both root and nested column contexts
          const reorder = (blocks: DesignerNodeSchema[]): DesignerNodeSchema[] => {
            const ids = blocks.map(b => b.id);
            if (ids.includes(activeId) && ids.includes(overId)) {
              return arrayMove([...blocks], ids.indexOf(activeId), ids.indexOf(overId));
            }
            return blocks.map(blk => {
              if (blk.type === 'columns') {
                return { ...blk, cols: blk.cols.map(col => ({ ...col, blocks: reorder(col.blocks) })) };
              }
              return blk;
            });
          };
          return reorder(prev);
        });
      } else {
        // Cross-container: remove from source, insert at target position
        setSchemaBlocks(prev => {
          let removed: DesignerNodeSchema | null = null;
          const remove = (blocks: DesignerNodeSchema[]): DesignerNodeSchema[] => {
            const idx = blocks.findIndex(b => b.id === activeId);
            if (idx !== -1) { removed = blocks[idx]; return [...blocks.slice(0, idx), ...blocks.slice(idx + 1)]; }
            return blocks.map(blk => blk.type === 'columns' ? { ...blk, cols: blk.cols.map(c => ({ ...c, blocks: remove(c.blocks) })) } : blk);
          };
          const afterRemove = remove(prev);
          if (!removed) return prev;
          const insert = (blocks: DesignerNodeSchema[]): DesignerNodeSchema[] => {
            const idx = blocks.findIndex(b => b.id === overId);
            if (idx !== -1) { const l = [...blocks]; l.splice(idx, 0, removed!); return l; }
            return blocks.map(blk => blk.type === 'columns' ? { ...blk, cols: blk.cols.map(c => ({ ...c, blocks: insert(c.blocks) })) } : blk);
          };
          return insert(afterRemove);
        });
      }
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
          newBlock = { id, type: 'text', content: '新文本内容' };
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
          newBlock = { id, type: 'if', condition: 'true', content: '条件内容' };
          break;
        case 'for':
          newBlock = { id, type: 'for', item: 'item', collection: 'items', template: '内容' };
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


  const renderDesignerBlocks = (blocks: DesignerNodeSchema[]) => {
    return blocks.map((blk) => {
      const isSelected = selectedBlockId === blk.id;
      return (
        <SortableBlockWrapper key={blk.id} id={blk.id}>
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
                renderBlocks={renderDesignerBlocks} 
                onInsertToCol={handleInsertToCol}
                isDragging={!!activeDragId}
              />
            )}
            {(blk.type === 'if' || blk.type === 'for' || blk.type === 'detail_table') && (
              <LogicBlock
                title={blk.type === 'if' ? '条件块' : blk.type === 'for' ? '循环块' : '明细表块'}
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
      const idx = prev.findIndex((b) => b.id === selectedBlockId);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const copied = [...prev];
      const [it] = copied.splice(idx, 1);
      copied.splice(target, 0, it);
      return copied;
    });
  };

  const removeSelected = () => {
    if (!selectedBlockId) return;
    setSchemaBlocks((prev) => {
      const next = prev.filter((blk) => blk.id !== selectedBlockId);
      setSelectedBlockId(next[0]?.id ?? null);
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
    <div style={{ 
      height: 'calc(100vh - 48px)', 
      background: '#f0f2f5', 
      overflow: 'hidden'
    }}>
      <div style={{ 
        height: '100%',
        display: 'flex', 
        overflow: 'hidden',
        borderRadius: token.borderRadiusLG,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid #e8e8e8'
      }}>
        {/* 1. Icon Sidebar (Left Rail) */}
        <div style={{
          width: 72,
          background: '#001529',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 0',
          gap: 20,
          zIndex: 100,
          flex: '0 0 72px'
        }}>
          {[
            { key: 'components', icon: <AppstoreOutlined />, label: '组件' },
            { key: 'variables', icon: <FunctionOutlined />, label: '变量' },
            { key: 'outline', icon: <OrderedListOutlined />, label: '大纲' },
            { key: 'preview', icon: <EyeOutlined />, label: '调试' },
            { key: 'settings', icon: <SettingOutlined />, label: '设置' },
          ].map(item => (
            <div
              key={item.key}
              style={{
                color: activeSidebarKey === item.key ? '#fff' : '#8c8c8c',
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
                background: activeSidebarKey === item.key ? '#1677ff' : 'transparent',
                borderRadius: 8
              }}>
                {item.icon}
              </div>
              <span style={{ fontSize: 12 }}>{item.label}</span>
            </div>
          ))}
          
          <div style={{ marginTop: 'auto' }}>
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              style={{ color: '#8c8c8c' }} 
              onClick={() => navigate(-1)} 
            />
          </div>
        </div>

        {/* 2. Navigation Panel (Active Sidebar Content) */}
        <div style={{
          width: 300,
          height: '100%',
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '4px 0 10px rgba(0,0,0,0.02)',
          overflow: 'hidden',
          flex: '0 0 300px'
        }}>
          <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
            <Title level={5} style={{ margin: 0 }}>
              {activeSidebarKey === 'components' && '组件库'}
              {activeSidebarKey === 'variables' && '业务变量'}
              {activeSidebarKey === 'outline' && '图层大纲'}
              {activeSidebarKey === 'preview' && '逻辑调试'}
              {activeSidebarKey === 'settings' && '页面设置'}
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
              />
            )}
            {activeSidebarKey === 'outline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {schemaBlocks.map((blk, idx) => (
                  <div 
                    key={blk.id}
                    style={{
                      padding: '10px 12px',
                      background: selectedBlockId === blk.id ? '#e6f4ff' : '#fafafa',
                      border: `1px solid ${selectedBlockId === blk.id ? '#91caff' : '#f0f0f0'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10
                    }}
                    onClick={() => setSelectedBlockId(blk.id)}
                  >
                    <span style={{ color: '#8c8c8c', fontSize: 12 }}>{idx + 1}</span>
                    <span style={{ fontWeight: 500 }}>{blk.type.toUpperCase()}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      <Button size="small" type="text" icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); setSelectedBlockId(blk.id); removeSelected(); }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeSidebarKey === 'preview' && (
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                 <div style={{ fontWeight: 600, fontSize: 13, color: '#8c8c8c' }}>编译控制</div>
                 <Button block type="primary" onClick={handleCompilePreview}>刷新编译源码</Button>
                 {compileWarnings.length > 0 && (
                   <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', padding: 10, borderRadius: 6, fontSize: 12 }}>
                     <div style={{ color: '#d46b08', fontWeight: 600 }}>编译告警:</div>
                     {compileWarnings.map((w, i) => <div key={i}>• {w}</div>)}
                   </div>
                 )}
                 <Input.TextArea rows={8} value={compiledPreview} readOnly placeholder="Jinja2 Source..." style={{ fontFamily: 'monospace', fontSize: 12 }} />
                 
                 <Divider style={{ margin: '8px 0' }} />
                 <div style={{ fontWeight: 600, fontSize: 13, color: '#8c8c8c' }}>数据模拟</div>
                 <div style={{ display: 'flex', gap: 8 }}>
                   <Select
                      style={{ flex: 1 }}
                      value={selectedSamplePreset}
                      options={samplePresets.map((x) => ({ label: x.label, value: x.key }))}
                      onChange={setSelectedSamplePreset}
                    />
                    <Button onClick={() => handleApplySamplePreset(selectedSamplePreset)}>应用</Button>
                 </div>
                 <Input.TextArea
                    rows={8}
                    value={previewDataText}
                    onChange={(e) => setPreviewDataText(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                 <Button block icon={<EyeOutlined />} loading={previewLoading} onClick={() => handleDataPreview()}>执行数据预览</Button>
              </Space>
            )}
            {activeSidebarKey === 'settings' && (
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <div>
                  <div style={{ marginBottom: 8, color: '#8c8c8c' }}>纸张尺寸</div>
                  <Select
                    style={{ width: '100%' }}
                    value={pageSize}
                    options={Object.keys(PAPER_SIZES).map(k => ({ label: PAPER_SIZES[k].label, value: k }))}
                    onChange={setPageSize}
                  />
                </div>
                <div>
                  <div style={{ marginBottom: 8, color: '#8c8c8c' }}>纸张方向</div>
                  <OrientationSelector 
                    value={orientation}
                    onChange={setOrientation}
                  />
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div>
                  <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 13 }}>纸张边距 (mm)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>上边距</div>
                      <InputNumber size="small" style={{ width: '100%' }} value={margins.top} onChange={v => setMargins(m => ({ ...m, top: v || 0 }))} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>下边距</div>
                      <InputNumber size="small" style={{ width: '100%' }} value={margins.bottom} onChange={v => setMargins(m => ({ ...m, bottom: v || 0 }))} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>左边距</div>
                      <InputNumber size="small" style={{ width: '100%' }} value={margins.left} onChange={v => setMargins(m => ({ ...m, left: v || 0 }))} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>右边距</div>
                      <InputNumber size="small" style={{ width: '100%' }} value={margins.right} onChange={v => setMargins(m => ({ ...m, right: v || 0 }))} />
                    </div>
                  </div>
                </div>
              </Space>
            )}
          </div>
        </div>

        {/* 3. Main Workspace (Canvas) */}
        <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', background: '#f0f2f5', minWidth: 0, overflow: 'hidden' }}>
          {/* Workspace Toolbar */}
          <div style={{ 
            height: 64, 
            background: '#fff', 
            borderBottom: '1px solid #f0f0f0', 
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
                {templateName || '报价单打印模板(新版)'}
              </Title>
              <Divider type="vertical" />
              <Space>
                <Button icon={<ZoomOutOutlined />} onClick={() => setZoom(Math.max(50, zoom - 10))} />
                <span style={{ minWidth: 40, textAlign: 'center' }}>{zoom}%</span>
                <Button icon={<ZoomInOutlined />} onClick={() => setZoom(Math.min(200, zoom + 10))} />
                <Button size="small" onClick={handleFitToWidth}>自适应宽度</Button>
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
                <Radio.Button value="design" style={{ whiteSpace: 'nowrap' }}>设计模式</Radio.Button>
                <Radio.Button value="preview" style={{ whiteSpace: 'nowrap' }}>预览模式</Radio.Button>
              </Radio.Group>
              <Divider type="vertical" />
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存模板</Button>
            </Space>
          </div>

          {/* Canvas Area Container */}
          <div 
            ref={workspaceRef}
            style={{ 
              flex: 1, 
              padding: '0 24px', // Side padding, vertical margin handled by inner wrapper
              overflow: 'auto', 
              background: '#e9ebed', // Slightly darker industrial background for contrast
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
                        <div style={{ color: '#8c8c8c', padding: 40, textAlign: 'center', border: '2px dashed #d9d9d9', borderRadius: 8 }}>
                          <AppstoreOutlined style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }} />
                          <div>从左侧点击或拖拽组件开始设计</div>
                        </div>
                      )}
                      <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext 
                          items={schemaBlocks.map(b => b.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {renderDesignerBlocks(schemaBlocks)}
                        </SortableContext>
                      </DndContext>
                    </>
                  ) : (
                    <div 
                      className="print-preview-inner"
                      style={{ 
                        width: '100%', 
                        minHeight: '100%', 
                        background: '#fff',
                        position: 'relative',
                        // Ensure images and barcodes don't overflow
                      }}
                      dangerouslySetInnerHTML={{ __html: renderedHtmlPreview }}
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
          background: '#fff',
          borderLeft: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 10px rgba(0,0,0,0.02)',
          overflow: 'hidden',
          flex: '0 0 320px'
        }}>
          <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
            <Title level={5} style={{ margin: 0 }}>属性面板</Title>
          </div>
          <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
            {selectedBlock ? (
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: '#333' }}>
                    {selectedBlock.type === 'text' && '文本组件'}
                    {selectedBlock.type === 'field' && '字段变量'}
                    {selectedBlock.type === 'divider' && '分割线'}
                    {selectedBlock.type === 'spacer' && '间距组件'}
                    {selectedBlock.type === 'qrcode' && '二维码'}
                    {selectedBlock.type === 'barcode' && '条形码'}
                    {selectedBlock.type === 'image' && '图片组件'}
                    {selectedBlock.type === 'if' && '条件块'}
                    {selectedBlock.type === 'for' && '循环块'}
                    {selectedBlock.type === 'detail_table' && '明细表'}
                  </span>
                  <Space>
                    <Button size="small" icon={<VerticalAlignTopOutlined />} onClick={() => moveSelected(-1)} />
                    <Button size="small" icon={<VerticalAlignBottomOutlined />} onClick={() => moveSelected(1)} />
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={removeSelected} />
                  </Space>
                </div>

                {(selectedBlock.type === 'text' || selectedBlock.type === 'field' || selectedBlock.type === 'qrcode' || selectedBlock.type === 'barcode' || selectedBlock.type === 'image') && (
                  <Card size="small" title="样式设置" headStyle={{ border: 0, fontSize: 13, color: '#8c8c8c' }}>
                    <Space direction="vertical" style={{ width: '100%' }} size={12}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Input
                          placeholder="字号"
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
                        加粗
                      </Button>
                    </Space>
                  </Card>
                )}

                <Card size="small" title="内容配置" headStyle={{ border: 0, fontSize: 13, color: '#8c8c8c' }}>
                  {selectedBlock.type === 'text' && (
                    <Space direction="vertical" style={{ width: '100%' }} size={12}>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>文本类型</div>
                        <Select
                          style={{ width: '100%' }}
                          value={selectedBlock.tag || 'div'}
                          onChange={val => updateSelectedBlock({ tag: val })}
                          options={[
                            { label: '普通文本', value: 'div' },
                            { label: '段落 (P)', value: 'p' },
                            { label: '标题 1 (H1)', value: 'h1' },
                            { label: '标题 2 (H2)', value: 'h2' },
                            { label: '标题 3 (H3)', value: 'h3' },
                            { label: '标题 4 (H4)', value: 'h4' },
                          ]}
                        />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>文本内容</div>
                        <Input.TextArea
                          rows={6}
                          value={selectedBlock.content}
                          onChange={e => updateSelectedBlock({ content: e.target.value })}
                          placeholder="请输入内容 (支持换行，无需 HTML)"
                        />
                      </div>
                    </Space>
                  )}
                  {selectedBlock.type === 'field' && (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, background: '#f5f5f5', padding: '8px 12px', borderRadius: 6 }}>
                        <span style={{ fontSize: 13 }}>显示文本标签</span>
                        <Radio.Group 
                          size="small" 
                          value={selectedBlock.showLabel !== false} 
                          onChange={e => updateSelectedBlock({ showLabel: e.target.value })}
                        >
                          <Radio.Button value={true}>开启</Radio.Button>
                          <Radio.Button value={false}>关闭</Radio.Button>
                        </Radio.Group>
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>显示名称</div>
                        <Input value={selectedBlock.label} placeholder="显示名称" onChange={e => updateSelectedBlock({ label: e.target.value })} />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>变量字段</div>
                        <Input value={selectedBlock.key} placeholder="变量字段" readOnly disabled />
                      </div>
                    </Space>
                  )}
                  {selectedBlock.type === 'qrcode' && (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>变量字段</div>
                        <Input value={selectedBlock.key} onChange={e => updateSelectedBlock({ key: e.target.value })} placeholder="e.g. order_no" />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>尺寸 (px)</div>
                        <InputNumber min={40} max={300} style={{ width: '100%' }} value={selectedBlock.size} onChange={v => updateSelectedBlock({ size: v || 100 })} />
                      </div>
                    </Space>
                  )}
                  {selectedBlock.type === 'barcode' && (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>条码字段</div>
                        <Input value={selectedBlock.key} onChange={e => updateSelectedBlock({ key: e.target.value })} placeholder="e.g. barcode_val" />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>条码格式</div>
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
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>高度 (px)</div>
                        <InputNumber min={20} max={100} style={{ width: '100%' }} value={selectedBlock.height} onChange={v => updateSelectedBlock({ height: v || 40 })} />
                      </div>
                    </Space>
                  )}
                  {selectedBlock.type === 'image' && (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, background: '#f5f5f5', padding: '8px 12px', borderRadius: 6 }}>
                        <span style={{ fontSize: 13 }}>保持原始比例</span>
                        <Radio.Group 
                          size="small" 
                          value={selectedBlock.keepRatio !== false} 
                          onChange={e => updateSelectedBlock({ keepRatio: e.target.value })}
                        >
                          <Radio.Button value={true}>开启</Radio.Button>
                          <Radio.Button value={false}>关闭</Radio.Button>
                        </Radio.Group>
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>图片 URL (Jinja2)</div>
                        <Input.TextArea rows={3} value={selectedBlock.url} onChange={e => updateSelectedBlock({ url: e.target.value })} placeholder="e.g. {{ logo_url }} 或静态地址" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>宽度 (px)</div>
                          <InputNumber style={{ width: '100%' }} value={selectedBlock.width} onChange={v => updateSelectedBlock({ width: v || 100 })} />
                        </div>
                        <div>
                          <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>高度 (px) {selectedBlock.keepRatio && <span style={{ color: '#bfbfbf' }}>(自动)</span>}</div>
                          <InputNumber disabled={selectedBlock.keepRatio} style={{ width: '100%' }} value={selectedBlock.height} onChange={v => updateSelectedBlock({ height: v || 60 })} />
                        </div>
                      </div>
                    </Space>
                  )}
                  {selectedBlock.type === 'spacer' && (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>间距高度 (px)</div>
                        <InputNumber min={1} max={500} style={{ width: '100%' }} value={selectedBlock.height} onChange={v => updateSelectedBlock({ height: v || 20 })} />
                      </div>
                    </Space>
                  )}
                  {selectedBlock.type === 'if' && (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Input value={selectedBlock.condition} placeholder="条件表达式 (Jinja2)" onChange={e => updateSelectedBlock({ condition: e.target.value })} />
                      <Input.TextArea value={selectedBlock.content} placeholder="内容" onChange={e => updateSelectedBlock({ content: e.target.value })} />
                    </Space>
                  )}
                  {selectedBlock.type === 'for' && (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Input value={selectedBlock.item} placeholder="单项变量名" onChange={e => updateSelectedBlock({ item: e.target.value })} />
                      <Input value={selectedBlock.collection} placeholder="集合变量名" onChange={e => updateSelectedBlock({ collection: e.target.value })} />
                      <Input.TextArea value={selectedBlock.template} placeholder="每一项的模板" onChange={e => updateSelectedBlock({ template: e.target.value })} />
                    </Space>
                  )}
                  {selectedBlock.type === 'detail_table' && (
                    <Space direction="vertical" style={{ width: '100%' }} size={16}>
                      <div style={{ background: '#fffbe6', padding: '8px 12px', border: '1px solid #ffe58f', borderRadius: 6, fontSize: 12, color: '#856404' }}>
                        <TableOutlined style={{ marginRight: 8 }} />
                        明细表组件：用于渲染动态列表数据。
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>明细集合变量 (e.g. items)</div>
                        <Input value={selectedBlock.collection} onChange={e => updateSelectedBlock({ collection: e.target.value })} />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>单行记录别名 (e.g. row)</div>
                        <Input value={selectedBlock.row_alias} onChange={e => updateSelectedBlock({ row_alias: e.target.value })} />
                      </div>
                      <TableColumnDesigner 
                        columns={selectedBlock.columns || []}
                        onChange={cols => updateSelectedBlock({ columns: cols })}
                      />
                    </Space>
                  )}
                  {selectedBlock.type === 'columns' && (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div style={{ marginBottom: 8, fontWeight: 600 }}>分栏配置</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>水平对齐</div>
                          <Select
                            size="small"
                            style={{ width: '100%' }}
                            value={selectedBlock.horizontalAlign || 'start'}
                            onChange={(val) => updateSelectedBlock({ horizontalAlign: val })}
                            options={[
                              { label: '左对齐', value: 'start' },
                              { label: '居中', value: 'center' },
                              { label: '右对齐', value: 'end' },
                              { label: '两端对齐', value: 'space-between' },
                              { label: '环绕分布', value: 'space-around' },
                              { label: '均匀分布', value: 'space-evenly' },
                            ]}
                          />
                        </div>
                        <div>
                          <div style={{ marginBottom: 4, fontSize: 12, color: '#8c8c8c' }}>垂直对齐</div>
                          <Select
                            size="small"
                            style={{ width: '100%' }}
                            value={selectedBlock.verticalAlign || 'top'}
                            onChange={(val) => updateSelectedBlock({ verticalAlign: val })}
                            options={[
                              { label: '顶部', value: 'top' },
                              { label: '居中', value: 'middle' },
                              { label: '底部', value: 'bottom' },
                              { label: '拉伸', value: 'stretch' },
                            ]}
                          />
                        </div>
                      </div>
                      {selectedBlock.cols.map((col, idx) => (
                        <div key={col.id} style={{ marginBottom: 12, padding: 8, border: '1px solid #f0f0f0', borderRadius: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 12 }}>第 {idx + 1} 栏</span>
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
                          <Input 
                            size="small"
                            addonBefore="宽度占比" 
                            value={col.width} 
                            placeholder="e.g. 1 或固定宽度 300" 
                            onChange={e => {
                              const newCols = selectedBlock.cols.map(c => c.id === col.id ? { ...c, width: e.target.value } : c);
                              updateSelectedBlock({ cols: newCols });
                            }} 
                          />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                            <Select
                              size="small"
                              value={col.horizontalAlign || 'start'}
                              onChange={(val) => {
                                const newCols = selectedBlock.cols.map(c => c.id === col.id ? { ...c, horizontalAlign: val } : c);
                                updateSelectedBlock({ cols: newCols });
                              }}
                              options={[
                                { label: '左对齐', value: 'start' },
                                { label: '居中', value: 'center' },
                                { label: '右对齐', value: 'end' },
                              ]}
                            />
                            <Select
                              size="small"
                              value={col.verticalAlign || 'top'}
                              onChange={(val) => {
                                const newCols = selectedBlock.cols.map(c => c.id === col.id ? { ...c, verticalAlign: val } : c);
                                updateSelectedBlock({ cols: newCols });
                              }}
                              options={[
                                { label: '顶对齐', value: 'top' },
                                { label: '垂直居中', value: 'middle' },
                                { label: '底对齐', value: 'bottom' },
                                { label: '拉伸', value: 'stretch' },
                              ]}
                            />
                          </div>
                        </div>
                      ))}
                      <Button block type="dashed" icon={<AppstoreAddOutlined />} onClick={() => {
                        const newCol = { id: `col-${Date.now()}`, width: '1', horizontalAlign: 'start', verticalAlign: 'top', blocks: [] };
                        updateSelectedBlock({ cols: [...selectedBlock.cols, newCol] });
                      }}>添加一栏</Button>
                    </Space>
                  )}
                </Card>

              </Space>
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#bfbfbf' }}>
                <AppstoreOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }} />
                <div>选择画布中的组件进行编辑</div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default PrintTemplateDesignPage;

/**
 * 打印模板设计器：合同主体（甲方 / 乙方）内置组件。
 * 乙方使用 seal_overlay，印章衬于变量文字下方，不参与换行排版。
 */

import { createDefaultSealOverlayFields } from './printSealOverlayDefaults';

type BlockStyle = {
  fontSize?: string;
  fontWeight?: string | number;
  textAlign?: string;
  color?: string;
};

type DesignerNodeSchema =
  | { id: string; type: 'text'; content: string; tag?: 'div'; style?: BlockStyle }
  | {
      id: string;
      type: 'field';
      key: string;
      label: string;
      showLabel?: boolean;
      style?: BlockStyle;
    }
  | {
      id: string;
      type: 'seal_overlay';
      url: string;
      width: number;
      height: number;
      sizeUnit?: 'mm' | 'px';
      keepRatio?: boolean;
      content: string;
      sealAlign?: 'left' | 'center' | 'right';
      sealOffsetX?: number;
      sealOffsetY?: number;
      style?: BlockStyle;
    }
  | {
      id: string;
      type: 'columns';
      horizontalAlign?: 'start' | 'center' | 'end';
      verticalAlign?: 'top' | 'middle' | 'bottom';
      cols: Array<{
        id: string;
        width: string;
        blocks: DesignerNodeSchema[];
      }>;
    };

const PARTY_TITLE_STYLE: BlockStyle = { fontSize: '16px', fontWeight: '700' };
const PARTY_LINE_STYLE: BlockStyle = { fontSize: '13px' };

/** 供方 / 甲方（卖方）：静态单位信息，自行在模板中填写或改为变量 */
export const PARTY_A_SELLER_LINES = [
  '单位名称：',
  '统一社会信用代码：',
  '单位地址：',
  '法定代表人：',
  '委托代理人：',
  '电话：',
  '开户银行：',
  '账号：',
] as const;

/** 需方 / 乙方（买方）：客户主数据与开票资料变量 */
export const PARTY_B_BUYER_SEAL_CONTENT = `单位名称：{{ customer_name }}
统一社会信用代码：{{ tax_registration_no }}
单位地址：{{ invoice_address }}
法定代表人：
委托代理人：
电话：{{ customer_phone }}
开户银行：{{ invoice_bank_name }}
账号：{{ invoice_bank_account }}`;

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function buildPartySellerBlocks(title = '甲方（卖方）'): DesignerNodeSchema[] {
  return [
    { id: newId('pa-title'), type: 'text', tag: 'div', content: title, style: PARTY_TITLE_STYLE },
    ...PARTY_A_SELLER_LINES.map((line) => ({
      id: newId('pa-line'),
      type: 'text' as const,
      tag: 'div' as const,
      content: line,
      style: PARTY_LINE_STYLE,
    })),
  ];
}

export function buildPartyBuyerSealBlocks(title = '乙方（买方）'): DesignerNodeSchema[] {
  return [
    { id: newId('pb-title'), type: 'text', tag: 'div', content: title, style: PARTY_TITLE_STYLE },
    {
      id: newId('pb-seal'),
      type: 'seal_overlay',
      ...createDefaultSealOverlayFields(PARTY_B_BUYER_SEAL_CONTENT, {
        sealOffsetX: 0,
        sealOffsetY: 8,
        style: PARTY_LINE_STYLE,
      }),
    },
  ];
}

/** 单列甲方组件（占满宽） */
export function createPartySellerComponent(title?: string): DesignerNodeSchema {
  return {
    id: newId('party-a'),
    type: 'columns',
    horizontalAlign: 'start',
    verticalAlign: 'top',
    cols: [{ id: newId('party-a-col'), width: '1', blocks: buildPartySellerBlocks(title) }],
  };
}

/** 单列乙方组件（含签章叠放） */
export function createPartyBuyerComponent(title?: string): DesignerNodeSchema {
  return {
    id: newId('party-b'),
    type: 'columns',
    horizontalAlign: 'start',
    verticalAlign: 'top',
    cols: [{ id: newId('party-b-col'), width: '1', blocks: buildPartyBuyerSealBlocks(title) }],
  };
}

/** 甲乙双栏 */
export function createPartyDualColumnsComponent(
  sellerTitle = '甲方（卖方）',
  buyerTitle = '乙方（买方）',
): DesignerNodeSchema {
  return {
    id: newId('party-dual'),
    type: 'columns',
    horizontalAlign: 'start',
    verticalAlign: 'top',
    cols: [
      { id: newId('party-dual-a'), width: '1', blocks: buildPartySellerBlocks(sellerTitle) },
      { id: newId('party-dual-b'), width: '1', blocks: buildPartyBuyerSealBlocks(buyerTitle) },
    ],
  };
}

export const PARTY_COMPONENT_DOCUMENT_TYPES = new Set([
  'sales_contract',
  'sales_order',
  'quotation',
]);

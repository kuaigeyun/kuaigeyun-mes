/**
 * 打印模板设计器：合同主体（甲方 / 乙方）内置组件。
 * 不在组件名中绑定买方/卖方；标题、正文、是否签章由属性面板配置。
 */

import { createDefaultSealOverlayFields } from './printSealOverlayDefaults';

type BlockStyle = {
  fontSize?: string;
  fontWeight?: string | number;
  textAlign?: string;
  color?: string;
  whiteSpace?: string;
};

export type PartyKind = 'a' | 'b';

export type PartyColumnBlock = {
  id: string;
  type: 'columns';
  partyKind: PartyKind;
  partyTitle: string;
  partyBody: string;
  partySealEnabled: boolean;
  horizontalAlign?: 'start' | 'center' | 'end';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  cols: Array<{
    id: string;
    width: string;
    blocks: DesignerNodeSchema[];
  }>;
};

type DesignerNodeSchema =
  | { id: string; type: 'text'; content: string; tag?: 'div'; style?: BlockStyle }
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
  | PartyColumnBlock
  | {
      id: string;
      type: 'columns';
      horizontalAlign?: string;
      verticalAlign?: string;
      cols: Array<{ id: string; width: string; blocks: DesignerNodeSchema[] }>;
    };

const PARTY_TITLE_STYLE: BlockStyle = { fontSize: '16px', fontWeight: '700' };
const PARTY_LINE_STYLE: BlockStyle = { fontSize: '13px' };
const PARTY_BODY_PRE_WRAP: BlockStyle = { fontSize: '13px', whiteSpace: 'pre-wrap' };

/** 默认正文：空白单位信息行（不含买方/卖方语义） */
export const PARTY_DEFAULT_BODY = `单位名称：
统一社会信用代码：
单位地址：
法定代表人：
委托代理人：
电话：
开户银行：
账号：`;

/** 可选：客户主数据与开票资料变量（属性面板一键插入） */
export const PARTY_CUSTOMER_VARS_BODY = `单位名称：{{ customer_name }}
统一社会信用代码：{{ tax_registration_no }}
单位地址：{{ invoice_address }}
法定代表人：
委托代理人：
电话：{{ customer_phone }}
开户银行：{{ invoice_bank_name }}
账号：{{ invoice_bank_account }}`;

/** @deprecated 兼容旧脚本 */
export const PARTY_SELLER_LINES = PARTY_DEFAULT_BODY.split('\n');
export const PARTY_BUYER_CONTENT = PARTY_CUSTOMER_VARS_BODY;
export const PARTY_A_SELLER_LINES = PARTY_SELLER_LINES;
export const PARTY_B_BUYER_SEAL_CONTENT = PARTY_CUSTOMER_VARS_BODY;

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function buildPartyInnerBlocks(options: {
  title: string;
  body: string;
  sealEnabled: boolean;
}): DesignerNodeSchema[] {
  const blocks: DesignerNodeSchema[] = [
    { id: newId('party-title'), type: 'text', tag: 'div', content: options.title, style: PARTY_TITLE_STYLE },
  ];
  if (options.sealEnabled) {
    blocks.push({
      id: newId('party-seal'),
      type: 'seal_overlay',
      ...createDefaultSealOverlayFields(options.body, {
        sealOffsetX: 0,
        sealOffsetY: 8,
        style: PARTY_LINE_STYLE,
      }),
    });
  } else {
    blocks.push({
      id: newId('party-body'),
      type: 'text',
      tag: 'div',
      content: options.body,
      style: PARTY_BODY_PRE_WRAP,
    });
  }
  return blocks;
}

/** 合同主体根块 id：party-a-* / party-b-*（排除 party-a-col 等子栏 id 误匹配） */
const PARTY_A_ROOT_ID = /^party-a-\d/;
const PARTY_B_ROOT_ID = /^party-b-\d/;

export function isPartyColumnBlock(block: { type?: string; partyKind?: PartyKind; id?: string } | null | undefined): block is PartyColumnBlock {
  if (!block || block.type !== 'columns') return false;
  if (block.partyKind === 'a' || block.partyKind === 'b') return true;
  const id = String(block.id || '');
  return PARTY_A_ROOT_ID.test(id) || PARTY_B_ROOT_ID.test(id);
}

function inferPartyKind(block: { partyKind?: PartyKind; id?: string } | null | undefined): PartyKind {
  if (!block) return 'a';
  if (block.partyKind === 'a' || block.partyKind === 'b') return block.partyKind;
  return PARTY_B_ROOT_ID.test(String(block.id || '')) ? 'b' : 'a';
}

const DEFAULT_PARTY_CONFIG = {
  partyKind: 'a' as PartyKind,
  partyTitle: '甲方',
  partyBody: PARTY_DEFAULT_BODY,
  partySealEnabled: false,
};

/** 从已有子块解析配置（兼容未写 partyTitle 的旧模板） */
export function parsePartyConfigFromColumnBlock(
  block: {
    partyKind?: PartyKind;
    partyTitle?: string;
    partyBody?: string;
    partySealEnabled?: boolean;
    id?: string;
    cols?: Array<{ blocks?: DesignerNodeSchema[] }>;
  } | null | undefined,
): { partyKind: PartyKind; partyTitle: string; partyBody: string; partySealEnabled: boolean } {
  if (!block) {
    return { ...DEFAULT_PARTY_CONFIG };
  }
  const partyKind = inferPartyKind(block);
  const defaultTitle = partyKind === 'b' ? '乙方' : '甲方';
  const inner = block.cols?.[0]?.blocks || [];
  const titleBlock = inner.find((b) => b.type === 'text');
  const sealBlock = inner.find((b) => b.type === 'seal_overlay');
  const bodyBlock = inner.find((b) => b.type === 'text' && b !== titleBlock);
  return {
    partyKind,
    partyTitle: String(block.partyTitle ?? titleBlock?.content ?? defaultTitle),
    partyBody: String(
      block.partyBody ?? sealBlock?.content ?? bodyBlock?.content ?? PARTY_DEFAULT_BODY,
    ),
    partySealEnabled: block.partySealEnabled ?? Boolean(sealBlock),
  };
}

export function applyPartyConfigToColumnBlock<T extends PartyColumnBlock>(
  block: T | null | undefined,
  patch: Partial<Pick<PartyColumnBlock, 'partyTitle' | 'partyBody' | 'partySealEnabled'>> = {},
): T {
  const safeBlock = (block || {
    id: newId('party-a'),
    type: 'columns',
    partyKind: 'a',
    partyTitle: '甲方',
    partyBody: PARTY_DEFAULT_BODY,
    partySealEnabled: false,
    cols: [],
  }) as T;
  const parsed = parsePartyConfigFromColumnBlock(safeBlock);
  const partyTitle = patch.partyTitle ?? parsed.partyTitle;
  const partyBody = patch.partyBody ?? parsed.partyBody;
  const partySealEnabled = patch.partySealEnabled ?? parsed.partySealEnabled;
  const cols = Array.isArray(safeBlock.cols) ? safeBlock.cols : [];
  const col = cols[0] || { id: newId('party-col'), width: '1', blocks: [] };
  return {
    ...safeBlock,
    partyKind: parsed.partyKind,
    partyTitle,
    partyBody,
    partySealEnabled,
    cols: [
      {
        ...col,
        blocks: buildPartyInnerBlocks({ title: partyTitle, body: partyBody, sealEnabled: partySealEnabled }),
      },
    ],
  };
}

export function createPartyAComponent(overrides?: Partial<Pick<PartyColumnBlock, 'partyTitle' | 'partyBody' | 'partySealEnabled'>>): PartyColumnBlock {
  const base: PartyColumnBlock = {
    id: newId('party-a'),
    type: 'columns',
    partyKind: 'a',
    partyTitle: '甲方',
    partyBody: PARTY_DEFAULT_BODY,
    partySealEnabled: false,
    horizontalAlign: 'start',
    verticalAlign: 'top',
    cols: [{ id: newId('party-a-col'), width: '1', blocks: [] }],
  };
  return applyPartyConfigToColumnBlock({ ...base, ...overrides });
}

export function createPartyBComponent(overrides?: Partial<Pick<PartyColumnBlock, 'partyTitle' | 'partyBody' | 'partySealEnabled'>>): PartyColumnBlock {
  const base: PartyColumnBlock = {
    id: newId('party-b'),
    type: 'columns',
    partyKind: 'b',
    partyTitle: '乙方',
    partyBody: PARTY_DEFAULT_BODY,
    partySealEnabled: true,
    horizontalAlign: 'start',
    verticalAlign: 'top',
    cols: [{ id: newId('party-b-col'), width: '1', blocks: [] }],
  };
  return applyPartyConfigToColumnBlock({ ...base, ...overrides });
}

/** 打开模板时补全 partyKind / 属性字段 */
export function normalizePartyColumnBlocks<T extends { type?: string; id?: string }>(blocks: T[]): T[] {
  const walk = (items: T[]): T[] =>
    items.map((blk) => {
      if (isPartyColumnBlock(blk as PartyColumnBlock)) {
        return applyPartyConfigToColumnBlock(blk as PartyColumnBlock) as T;
      }
      if (blk?.type === 'columns' && 'cols' in blk && Array.isArray((blk as PartyColumnBlock).cols)) {
        const cols = (blk as PartyColumnBlock).cols.map((col) => ({
          ...col,
          blocks: walk((col.blocks || []) as T[]),
        }));
        return { ...blk, cols };
      }
      return blk;
    });
  return walk(blocks);
}

/** @deprecated */
export const createPartyBuyerComponent = createPartyAComponent;
/** @deprecated */
export const createPartySellerComponent = createPartyBComponent;

export const PARTY_COMPONENT_DOCUMENT_TYPES = new Set([
  'sales_contract',
  'sales_order',
  'quotation',
]);

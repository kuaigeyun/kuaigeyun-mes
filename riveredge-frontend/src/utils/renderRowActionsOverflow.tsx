import React from 'react';
import { Button, Dropdown, Space } from 'antd';

/** 列表操作列：最多平铺个数，从第 (maxInline+1) 个起收入「更多」 */
export const ROW_ACTIONS_INLINE_MAX = 4;

const PRIMARY_ACTION_ORDER = ['详情', '编辑', '删除', '下推'];

function readNodeText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(readNodeText).join('');
  if (!React.isValidElement(node)) return '';
  return readNodeText(node.props?.children);
}

function normalizeActionLabelText(text: string): string {
  const trimmed = (text || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed === '查看') return '详情';
  return trimmed;
}

function resolvePrimaryActionRank(node: React.ReactNode): number {
  const text = readNodeText(node).replace(/\s+/g, '').trim();
  if (!text) return Number.MAX_SAFE_INTEGER;
  if (text.includes('详情')) return 0;
  if (text.includes('编辑')) return 1;
  if (text.includes('删除')) return 2;
  if (text.includes('下推')) return 3;
  return Number.MAX_SAFE_INTEGER;
}

function resolveActionKind(node: React.ReactNode): 'detail' | 'edit' | 'delete' | 'push' | null {
  const text = readNodeText(node).replace(/\s+/g, '').trim();
  if (!text) return null;
  if (text.includes('详情') || text.includes('查看')) return 'detail';
  if (text.includes('编辑') || text.includes('修改')) return 'edit';
  if (text.includes('删除')) return 'delete';
  if (text.includes('下推')) return 'push';
  return null;
}

function toMenuItem(node: React.ReactNode, key: string) {
  const text = normalizeActionLabelText(readNodeText(node)) || '操作';
  if (React.isValidElement(node) && node.type === Button) {
    const props = (node.props || {}) as Record<string, unknown>;
    const onClick = typeof props.onClick === 'function' ? (props.onClick as () => void) : undefined;
    return {
      key,
      label: text,
      danger: !!props.danger,
      disabled: !!props.disabled,
      onClick,
    };
  }
  return {
    key,
    label: text,
  };
}

function normalizeActionNode(node: React.ReactNode): React.ReactNode {
  if (!React.isValidElement(node)) return node;
  if (node.type === Button) {
    return normalizeButtonNode(node);
  }

  const hasDropdownMenuItems = Array.isArray(node.props?.menu?.items);
  if (hasDropdownMenuItems) {
    const items = node.props.menu.items as Array<any>;
    const normalizedItems = items.map((item) => ({ ...item }));
    const enabledItems = normalizedItems.filter((item) => item && item.type !== 'divider' && !item.disabled);
    const isPushAction = readNodeText(node).includes('下推');
    const disabledByMenu = isPushAction && enabledItems.length === 0;
    const triggerChild = React.Children.toArray(node.props?.children)[0];
    let nextChild = triggerChild as React.ReactNode;
    if (React.isValidElement(triggerChild) && triggerChild.type === Button) {
      nextChild = React.cloneElement(triggerChild, {
        ...resolveButtonTone(readNodeText(triggerChild)),
        size: 'small',
        icon: undefined,
        disabled: disabledByMenu || !!(triggerChild.props as any)?.disabled,
      } as Record<string, unknown>);
    }
    return React.cloneElement(node, { children: nextChild });
  }

  return node;
}

function resolveButtonTone(text: string): { type: 'default' | 'primary'; danger?: boolean } {
  const normalized = text.replace(/\s+/g, '');
  if (/删除|驳回|报废/.test(normalized)) {
    return { type: 'default', danger: true };
  }
  if (/详情|编辑|下推|提交|确认|审核|通过/.test(normalized)) {
    return { type: 'primary' };
  }
  return { type: 'default' };
}

function normalizeButtonNode(node: React.ReactElement): React.ReactElement {
  const text = normalizeActionLabelText(readNodeText(node));
  const tone = resolveButtonTone(text);
  const nextChildren = normalizeActionLabelText(readNodeText(node.props?.children)) || node.props?.children;
  return React.cloneElement(node, {
    type: tone.type,
    danger: tone.danger,
    size: 'small',
    icon: undefined,
    style: undefined,
    children: nextChildren,
  } as Record<string, unknown>);
}

/**
 * 列表操作列渲染：平铺前 maxInline 个按钮，其余收入「更多」下拉。
 */
export function renderRowActionsOverflow(
  nodes: React.ReactNode[],
  keyPrefix: string,
  maxInline: number = ROW_ACTIONS_INLINE_MAX,
): React.ReactNode {
  const flat = (nodes.filter(Boolean) as React.ReactNode[]).map((node) => normalizeActionNode(node));
  const hasDetail = flat.some((node) => resolveActionKind(node) === 'detail');
  const hasEdit = flat.some((node) => resolveActionKind(node) === 'edit');
  const hasDelete = flat.some((node) => resolveActionKind(node) === 'delete');

  // 统一占位：详情/编辑/删除在每一行都可见，缺失时灰色禁用，保证同页对齐。
  if (!hasDetail) {
    flat.unshift(
      <Button key={`${keyPrefix}-placeholder-detail`} type="default" size="small" disabled>
        详情
      </Button>,
    );
  }
  if (!hasEdit) {
    flat.push(
      <Button key={`${keyPrefix}-placeholder-edit`} type="default" size="small" disabled>
        编辑
      </Button>,
    );
  }
  if (!hasDelete) {
    flat.push(
      <Button key={`${keyPrefix}-placeholder-delete`} type="default" size="small" danger disabled>
        删除
      </Button>,
    );
  }

  const primaryNodes = flat
    .map((node) => ({ node, rank: resolvePrimaryActionRank(node) }))
    .filter((item) => item.rank !== Number.MAX_SAFE_INTEGER)
    .sort((a, b) => a.rank - b.rank)
    .map((item) => item.node);
  const inlineByRule = primaryNodes.slice(0, Math.min(maxInline, PRIMARY_ACTION_ORDER.length));
  const overflowByRule = flat.filter((node) => !inlineByRule.includes(node));

  if (overflowByRule.length === 0) {
    return (
      <Space size="small" wrap>
        {inlineByRule}
      </Space>
    );
  }
  return (
    <Space size="small" wrap>
      {inlineByRule}
      <Dropdown
        menu={{
          items: overflowByRule.map((node, i) => toMenuItem(node, `${keyPrefix}-more-${i}`)),
        }}
        trigger={['click']}
      >
        <Button type="default" size="small">
          更多
        </Button>
      </Dropdown>
    </Space>
  );
}

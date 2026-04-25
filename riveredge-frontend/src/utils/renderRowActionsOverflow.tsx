import React from 'react';
import { Button, Dropdown, Space } from 'antd';

/**
 * 统一规则：
 * - 详情/编辑/删除固定排在前 3 位（存在时）
 * - 第 4 位放最常用动作（按 priority 或语义推断）
 * - 总数 <= 5：直接展示全部
 * - 总数 > 5：仅展示前 4 + 第 5 个「更多」
 */
export const ROW_ACTIONS_DIRECT_MAX = 5;

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

type ActionKind = 'detail' | 'edit' | 'delete' | 'common' | 'other';

function resolveActionKind(node: React.ReactNode): ActionKind {
  const text = readNodeText(node).replace(/\s+/g, '').trim();
  if (!text) return 'other';
  if (text.includes('详情') || text.includes('查看')) return 'detail';
  if (text.includes('编辑') || text.includes('修改')) return 'edit';
  if (text.includes('删除')) return 'delete';
  if (/下推|提交|审核|确认|执行|发布|启用|停用|同步|添加|新增|子项/.test(text)) return 'common';
  return 'other';
}

function readActionPriority(node: React.ReactNode): number | undefined {
  if (!React.isValidElement(node)) return undefined;
  const raw = (node.props as any)?.['data-action-priority'];
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeAndSortActions(nodes: React.ReactNode[]): React.ReactNode[] {
  const flat = (nodes.filter(Boolean) as React.ReactNode[]).map((node) => normalizeActionNode(node));

  const withMeta = flat.map((node, index) => {
    const kind = resolveActionKind(node);
    const explicitPriority = readActionPriority(node);
    const kindRank =
      kind === 'detail' ? 0 :
      kind === 'edit' ? 1 :
      kind === 'delete' ? 2 :
      kind === 'common' ? 3 : 4;
    const finalPriority = explicitPriority ?? kindRank;
    return { node, index, finalPriority, kindRank };
  });

  withMeta.sort((a, b) => {
    if (a.finalPriority !== b.finalPriority) return a.finalPriority - b.finalPriority;
    if (a.kindRank !== b.kindRank) return a.kindRank - b.kindRank;
    return a.index - b.index;
  });

  return withMeta.map((x) => x.node);
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
  if (typeof node.type === 'string' && node.type.toLowerCase() === 'a') {
    const props = (node.props || {}) as Record<string, unknown>;
    const text = normalizeActionLabelText(readNodeText(node));
    const tone = resolveButtonTone(text);
    return (
      <Button
        type={tone.type}
        danger={tone.danger}
        size="small"
        onClick={typeof props.onClick === 'function' ? (props.onClick as any) : undefined}
        disabled={!!props.disabled}
      >
        {text || props.children}
      </Button>
    );
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

  if (node.props?.children != null) {
    let mutated = false;
    const nextChildren = React.Children.map(node.props.children, (child) => {
      const normalized = normalizeActionNode(child);
      if (normalized !== child) mutated = true;
      return normalized;
    });
    if (mutated) {
      return React.cloneElement(node, { children: nextChildren } as Record<string, unknown>);
    }
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
 * 列表操作列渲染（统一顺序 + 更多收纳）
 */
export function renderRowActionsOverflow(
  nodes: React.ReactNode[],
  keyPrefix: string,
  directMax: number = ROW_ACTIONS_DIRECT_MAX,
): React.ReactNode {
  const sorted = normalizeAndSortActions(nodes);
  if (sorted.length <= directMax) {
    return (
      <Space size="small" wrap>
        {sorted}
      </Space>
    );
  }
  const inline = sorted.slice(0, Math.max(1, directMax - 1));
  const overflow = sorted.slice(Math.max(1, directMax - 1));

  return (
    <Space size="small" wrap>
      {inline}
      <Dropdown
        menu={{
          items: overflow.map((node, i) => toMenuItem(node, `${keyPrefix}-more-${i}`)),
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

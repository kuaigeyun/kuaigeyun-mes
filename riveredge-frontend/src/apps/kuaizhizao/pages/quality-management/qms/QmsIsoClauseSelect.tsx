import React, { useEffect, useMemo, useState } from 'react';
import { TreeSelect } from 'antd';
import { useTranslation } from 'react-i18next';
import { qualityQmsApi, QmsIsoClauseTreeNode } from '../../../services/quality-qms';

type TreeSelectNode = {
  value: number;
  title: string;
  children?: TreeSelectNode[];
  disabled?: boolean;
};

function mapClauseTree(
  nodes: QmsIsoClauseTreeNode[],
  excludeId?: number,
): TreeSelectNode[] {
  return nodes
    .filter((node) => node.id !== excludeId)
    .map((node) => ({
      value: node.id,
      title: `${node.clause_code} ${node.title}`,
      children:
        node.children && node.children.length > 0
          ? mapClauseTree(node.children, excludeId)
          : undefined,
    }));
}

export type QmsIsoClauseSelectProps = {
  value?: number | null;
  onChange?: (value?: number | null) => void;
  standardCode?: string;
  excludeId?: number;
  disabled?: boolean;
  placeholder?: string;
};

export const QmsIsoClauseSelect: React.FC<QmsIsoClauseSelectProps> = ({
  value,
  onChange,
  standardCode = 'ISO9001:2015',
  excludeId,
  disabled,
  placeholder,
}) => {
  const { t } = useTranslation();
  const [tree, setTree] = useState<QmsIsoClauseTreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    qualityQmsApi.isoClauses
      .tree({ standard_code: standardCode })
      .then((res) => {
        if (!cancelled) setTree(res ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [standardCode]);

  const treeData = useMemo(() => mapClauseTree(tree, excludeId), [tree, excludeId]);

  return (
    <TreeSelect
      allowClear
      showSearch
      treeDefaultExpandAll
      treeNodeFilterProp="title"
      loading={loading}
      disabled={disabled}
      value={value ?? undefined}
      placeholder={placeholder ?? t('app.kuaizhizao.quality.qms.selectIsoClause')}
      treeData={treeData}
      onChange={(next) => onChange?.(next ?? null)}
      style={{ width: '100%' }}
    />
  );
};

export default QmsIsoClauseSelect;

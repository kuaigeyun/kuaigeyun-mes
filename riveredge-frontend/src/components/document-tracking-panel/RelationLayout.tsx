/**
 * 上下游关系可视化：单链横向滚动；多下游时主轴 + 并列分支
 */

import React from 'react';
import { ArrowRightOutlined } from '@ant-design/icons';
import type { DocumentTrackingResponse } from '../../services/documentTracking';
import { buildRelationChainSegments } from './relationGraph';
import { RelationNodeChip, RelationEmptyHint } from './RelationNodeChip';

const arrow = (
  <ArrowRightOutlined style={{ color: 'var(--ant-color-text-secondary)', flexShrink: 0 }} aria-hidden />
);

export interface RelationLayoutProps {
  data: DocumentTrackingResponse;
  onDocumentClick?: (type: string, id: number) => void;
}

export const RelationLayout: React.FC<RelationLayoutProps> = ({ data, onDocumentClick }) => {
  const up = data.relations.upstream;
  const down = data.relations.downstream;

  if (up.length === 0 && down.length === 0) {
    return <RelationEmptyHint />;
  }

  const linearSegments = buildRelationChainSegments(data);

  const useBranchDownstream = down.length > 1;

  if (!useBranchDownstream) {
    return (
      <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', minWidth: 'max-content' }}>
          {linearSegments.map((seg, index) => (
            <React.Fragment key={seg.key}>
              {index > 0 ? arrow : null}
              <RelationNodeChip
                variant={seg.variant}
                relation={seg.relation}
                documentType={data.document_type}
                documentId={data.document_id}
                documentCode={data.document_code}
                onDocumentClick={onDocumentClick}
              />
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 12,
          rowGap: 12,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            minWidth: 'min-content',
            flexShrink: 0,
          }}
        >
          {up.map((r) => (
            <React.Fragment key={`${r.type}-${r.id}-up-row`}>
              <RelationNodeChip variant="upstream" relation={r} onDocumentClick={onDocumentClick} />
              {arrow}
            </React.Fragment>
          ))}
          <RelationNodeChip
            variant="current"
            documentType={data.document_type}
            documentId={data.document_id}
            documentCode={data.document_code}
          />
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'flex-start',
            gap: 10,
            minWidth: 0,
            flex: '1 1 200px',
            maxWidth: '100%',
          }}
        >
          <span style={{ marginTop: 8, flexShrink: 0 }} aria-hidden>
            {arrow}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
              {down.map((r) => (
                <div key={`${r.type}-${r.id}-down`} style={{ display: 'flex', alignItems: 'center', maxWidth: '100%' }}>
                  <RelationNodeChip variant="downstream" relation={r} onDocumentClick={onDocumentClick} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

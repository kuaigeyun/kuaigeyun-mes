import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { TraceProfile } from '../../../services/traceability';
import {
  dropBackwardSankeyLinks,
  dropDirectedSankeyCycles,
  floorSankeyLinkValues,
  formatTraceSankeyIdLabel,
  getTraceSankeyDocumentTypeColor,
  promoteSameRankSankeyLinks,
  resolveSankeyDocumentType,
  sankeyStageRank,
  traceProfileToSankeyModel,
} from './traceToSankey';

const t = ((key: string) => key) as TFunction;

describe('traceToSankey', () => {
  it('drops reverse-process edges that form cycles in bidirectional traces', () => {
    const links = dropBackwardSankeyLinks([
      { source: 'batch:FG', target: 'work_order:WO', value: 1 },
      { source: 'work_order:WO', target: 'batch:FG', value: 1 },
      { source: 'work_order:WO', target: 'reporting_record:R1', value: 1 },
    ]);
    expect(links).toEqual([
      { source: 'batch:FG', target: 'work_order:WO', value: 1 },
      { source: 'work_order:WO', target: 'reporting_record:R1', value: 1 },
    ]);
  });

  it('promotes same-rank reporting chain into parallel links from the previous stage', () => {
    const promoted = promoteSameRankSankeyLinks([
      { source: 'production_picking:LL1', target: 'reporting_record:R1', value: 1 },
      { source: 'reporting_record:R1', target: 'reporting_record:R2', value: 1 },
      { source: 'reporting_record:R2', target: 'reporting_record:R3', value: 1 },
    ]);
    expect(promoted).toEqual([
      { source: 'production_picking:LL1', target: 'reporting_record:R1', value: 1 },
      { source: 'production_picking:LL1', target: 'reporting_record:R2', value: 1 },
      { source: 'production_picking:LL1', target: 'reporting_record:R3', value: 1 },
    ]);
  });

  it('floors tiny quantities so later nodes keep visible thickness', () => {
    const floored = floorSankeyLinkValues([
      { source: 'a', target: 'b', value: 1000 },
      { source: 'b', target: 'c', value: 1 },
    ]);
    expect(floored[0].value).toBe(1000);
    expect(floored[1].value).toBe(120);
  });

  it('removes remaining directed cycles', () => {
    const acyclic = dropDirectedSankeyCycles([
      { source: 'a', target: 'b', value: 1 },
      { source: 'b', target: 'c', value: 1 },
      { source: 'c', target: 'a', value: 1 },
    ]);
    expect(acyclic.some((l) => l.source === 'c' && l.target === 'a')).toBe(false);
    expect(acyclic.length).toBe(2);
  });

  it('ranks reporting after picking', () => {
    expect(sankeyStageRank('production_picking:LL1')).toBeLessThan(
      sankeyStageRank('reporting_record:R1'),
    );
  });

  it('builds i18n labels from node id instead of backend Chinese label', () => {
    const profile: TraceProfile = {
      anchor: { identifierType: 'batch', code: 'FG-1' },
      summary: { eventCount: 2, nodeCount: 2, edgeCount: 1, direction: 'both' },
      events: [],
      nodes: [
        {
          id: 'production_picking:LL1',
          label: '生产领料: LL1',
          type: 'outbound',
          data: { document_type: 'production_picking', document_code: 'LL1' },
        },
        {
          id: 'reporting_record:R1',
          label: '报工: R1',
          type: 'reporting_record',
          data: { document_type: 'reporting_record', document_code: 'R1' },
        },
      ],
      edges: [{ source: 'production_picking:LL1', target: 'reporting_record:R1' }],
    };
    const model = traceProfileToSankeyModel(profile, t);
    expect(model.links).toEqual([
      { source: 'production_picking:LL1', target: 'reporting_record:R1', value: 1 },
    ]);
    expect(model.labelById.get('production_picking:LL1')).toBe(
      'app.kuaizhizao.quality.traceability.nodeType.productionPicking: LL1',
    );
    expect(model.labelById.get('reporting_record:R1')).toBe(
      'app.kuaizhizao.quality.traceability.nodeType.reportingRecord: R1',
    );
    expect(model.nodes).toEqual([
      { key: 'production_picking:LL1', documentType: 'production_picking' },
      { key: 'reporting_record:R1', documentType: 'reporting_record' },
    ]);
  });

  it('assigns the same color to nodes of the same document type', () => {
    expect(getTraceSankeyDocumentTypeColor('work_order')).toBe(
      getTraceSankeyDocumentTypeColor('work_order'),
    );
    expect(getTraceSankeyDocumentTypeColor('work_order')).not.toBe(
      getTraceSankeyDocumentTypeColor('reporting_record'),
    );
    expect(resolveSankeyDocumentType('production_picking:LL1', [])).toBe('production_picking');
  });

  it('formats unknown sankey endpoint ids with i18n document type', () => {
    expect(formatTraceSankeyIdLabel('work_order:WO1', t)).toBe(
      'app.kuaizhizao.quality.traceability.nodeType.workOrder: WO1',
    );
  });
});

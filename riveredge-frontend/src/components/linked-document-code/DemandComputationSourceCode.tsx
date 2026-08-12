/**
 * 需求计算「来源单号」：首码可点开上游原版详情抽屉；多来源后缀「等N个」用徽章展示。
 */

import React, { useCallback, useMemo, useState } from 'react';
import { App, Space, Tag, Typography, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { getDemand } from '../../apps/kuaizhizao/services/demand';
import { normalizeDemandTypeKey } from '../../apps/kuaizhizao/utils/demandType';
import {
  canOpenLinkedDocumentDetail,
  type LinkedDocumentType,
} from '../../apps/kuaizhizao/utils/linkedDocumentDetail';
import { useOptionalLinkedDocumentDetail } from '../linked-document-detail';

export type DemandComputationSourceCodeProps = {
  demandCode?: string | null;
  demandType?: string | null;
  demandId?: number | null;
  /** 多来源时取首个；与 demandId 二选一即可 */
  demandIds?: number[] | null;
  sourceId?: number | null;
  emptyText?: string;
  copyable?: boolean;
  style?: React.CSSProperties;
};

/** 解析来源单号展示：首码 + 可选总数 N（多来源） */
export function parseDemandComputationSourceDisplay(code: string): {
  primary: string;
  totalCount: number | null;
  fullText: string;
} {
  const raw = String(code ?? '').trim();
  if (!raw) return { primary: '', totalCount: null, fullText: '' };

  const suffixOnly = raw.match(/^(.+?)等(\d+)个$/);
  if (suffixOnly && !/[,，]/.test(suffixOnly[1])) {
    const n = Number(suffixOnly[2]);
    return {
      primary: suffixOnly[1].trim(),
      totalCount: Number.isFinite(n) && n > 1 ? n : null,
      fullText: raw,
    };
  }

  if (/[,，]/.test(raw)) {
    const parts = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    let totalFromSuffix: number | null = null;
    const codes: string[] = [];
    for (const p of parts) {
      const sm = p.match(/^(.+?)等(\d+)个$/);
      if (sm) {
        codes.push(sm[1].trim());
        const n = Number(sm[2]);
        if (Number.isFinite(n)) totalFromSuffix = n;
      } else {
        codes.push(p);
      }
    }
    const primary = codes[0] || raw;
    const totalCount = totalFromSuffix ?? (codes.length > 1 ? codes.length : null);
    return { primary, totalCount, fullText: raw };
  }

  return { primary: raw, totalCount: null, fullText: raw };
}

function firstDemandId(demandId?: number | null, demandIds?: number[] | null): number {
  if (Array.isArray(demandIds)) {
    for (const x of demandIds) {
      const n = Number(x);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  const n = Number(demandId);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function resolveUpstreamLink(params: {
  demandType?: string | null;
  demandId?: number | null;
  demandIds?: number[] | null;
  sourceId?: number | null;
}): Promise<{ documentType: LinkedDocumentType; documentId: number } | null> {
  const dtype = normalizeDemandTypeKey(params.demandType);
  const sourceId = Number(params.sourceId);
  const demandPk = firstDemandId(params.demandId, params.demandIds);

  if (dtype === 'demand_plan') {
    const id = Number.isFinite(sourceId) && sourceId > 0 ? sourceId : demandPk;
    if (id > 0 && canOpenLinkedDocumentDetail('demand')) {
      return { documentType: 'demand', documentId: id };
    }
    return null;
  }

  if (dtype === 'sales_order' || dtype === 'sales_forecast') {
    if (Number.isFinite(sourceId) && sourceId > 0 && canOpenLinkedDocumentDetail(dtype)) {
      return { documentType: dtype, documentId: sourceId };
    }
    if (demandPk <= 0) return null;
    const demand = await getDemand(demandPk, false, false);
    const upstreamId = Number(demand.source_id);
    if (!Number.isFinite(upstreamId) || upstreamId <= 0) return null;
    if (!canOpenLinkedDocumentDetail(dtype)) return null;
    return { documentType: dtype, documentId: upstreamId };
  }

  return null;
}

export function DemandComputationSourceCode({
  demandCode,
  demandType,
  demandId,
  demandIds,
  sourceId,
  emptyText = '-',
  copyable = true,
  style,
}: DemandComputationSourceCodeProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const linked = useOptionalLinkedDocumentDetail();
  const [opening, setOpening] = useState(false);

  const parsed = useMemo(() => parseDemandComputationSourceDisplay(String(demandCode ?? '')), [demandCode]);
  const primary = parsed.primary;
  const totalCount = parsed.totalCount;
  const dtype = normalizeDemandTypeKey(demandType);
  const demandPk = firstDemandId(demandId, demandIds);
  const sourcePk = Number(sourceId);
  const hasSourcePk = Number.isFinite(sourcePk) && sourcePk > 0;

  const canTryOpen =
    Boolean(primary) &&
    Boolean(linked) &&
    ((dtype === 'demand_plan' && (hasSourcePk || demandPk > 0)) ||
      (dtype === 'sales_order' && (hasSourcePk || demandPk > 0)) ||
      (dtype === 'sales_forecast' && (hasSourcePk || demandPk > 0)));

  const displayText =
    primary && totalCount != null && totalCount > 1
      ? `${primary}${t('app.kuaizhizao.demandComputation.sourceAndMore', { count: totalCount })}`
      : primary;

  const onOpen = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!canTryOpen || !linked || opening) return;
      setOpening(true);
      try {
        const target = await resolveUpstreamLink({
          demandType,
          demandId,
          demandIds,
          sourceId,
        });
        if (!target) {
          message.warning(t('app.kuaizhizao.demandComputation.sourceLinkUnavailable'));
          return;
        }
        const opened = linked.openLinkedDocumentDetail(target.documentType, target.documentId);
        if (!opened) {
          message.warning(t('app.kuaizhizao.demandComputation.sourceLinkUnavailable'));
        }
      } catch (err: unknown) {
        const eobj = err as { message?: string; detail?: string };
        message.error(eobj?.message || eobj?.detail || t('common.loadFailed'));
      } finally {
        setOpening(false);
      }
    },
    [canTryOpen, linked, opening, demandType, demandId, demandIds, sourceId, message, t],
  );

  const stopRow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!primary) {
    return <span style={style}>{emptyText}</span>;
  }

  return (
    <Space
      size={4}
      wrap={false}
      style={{ maxWidth: '100%', ...style }}
      onClick={stopRow}
      onMouseDown={stopRow}
    >
      {canTryOpen ? (
        <Typography.Link
          onClick={onOpen}
          disabled={opening}
          title={parsed.fullText || primary}
          style={{ fontSize: 'inherit', maxWidth: 140 }}
          ellipsis
        >
          {primary}
        </Typography.Link>
      ) : (
        <Typography.Text
          ellipsis={{ tooltip: parsed.fullText || primary }}
          style={{ maxWidth: 140 }}
        >
          {primary}
        </Typography.Text>
      )}
      {copyable ? (
        <Typography.Text
          copyable={{
            text: displayText,
            tooltips: [t('field.invitationCode.copy'), t('app.kuaizhizao.demandComputation.copied')],
          }}
          style={{ margin: 0 }}
        />
      ) : null}
      {totalCount != null && totalCount > 1 ? (
        <Tag
          title={parsed.fullText || displayText}
          style={{
            marginInlineEnd: 0,
            lineHeight: '18px',
            paddingInline: 6,
            color: token.colorPrimary,
            background: token.colorPrimaryBg,
            borderColor: token.colorPrimaryBorder,
          }}
        >
          {t('app.kuaizhizao.demandComputation.sourceAndMore', { count: totalCount })}
        </Tag>
      ) : null}
    </Space>
  );
}

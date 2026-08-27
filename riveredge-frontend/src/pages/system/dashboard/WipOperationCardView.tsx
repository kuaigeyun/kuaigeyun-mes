/**
 * 在制工序卡（工作台展示）
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { theme } from 'antd';
import type { TFunction } from 'i18next';
import type { ProcessProgressItem } from '../../../services/dashboard';
import { getQuickEntryHeaderColors } from '../../../components/quick-entry/quickEntryGradients';
import { useThemeStore } from '../../../stores/themeStore';
import { formatQuantity } from '../../../utils/format';

type WipDeltaField = 'progress' | 'planned' | 'completed' | 'qualified' | 'unqualified';

function sameQty(a?: number | null, b?: number | null): boolean {
  return Number(a ?? 0) === Number(b ?? 0);
}

function collectWipDeltas(prev: ProcessProgressItem, next: ProcessProgressItem): WipDeltaField[] {
  const fields: WipDeltaField[] = [];
  if (Math.round(prev.current_progress ?? 0) !== Math.round(next.current_progress ?? 0)) {
    fields.push('progress');
  }
  if (!sameQty(prev.planned_quantity, next.planned_quantity)) fields.push('planned');
  if (!sameQty(prev.completed_quantity, next.completed_quantity)) fields.push('completed');
  if (!sameQty(prev.qualified_quantity, next.qualified_quantity)) fields.push('qualified');
  if (!sameQty(prev.unqualified_quantity, next.unqualified_quantity)) fields.push('unqualified');
  return fields;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function WipDeltaText({
  field,
  active,
  className,
  children,
  onDone,
}: {
  field: WipDeltaField;
  active: boolean;
  className?: string;
  children: React.ReactNode;
  onDone: (field: WipDeltaField) => void;
}) {
  return (
    <span
      className={[className, active ? 'dashboard-wip-operation-card__delta' : '']
        .filter(Boolean)
        .join(' ')}
      onAnimationEnd={(event) => {
        if (event.animationName !== 'dashboard-wip-delta-flash') return;
        onDone(field);
      }}
    >
      {children}
    </span>
  );
}

export interface WipOperationCardViewProps {
  item: ProcessProgressItem;
  colorIndex: number;
  isDark?: boolean;
  t: TFunction;
  onClick?: () => void;
  /** 首屏进度条从 0 动画到目标值 */
  animateProgress?: boolean;
}

export function WipOperationCardSkeleton({ colorIndex = 0 }: { colorIndex?: number }) {
  return (
    <div
      className="dashboard-wip-operation-card dashboard-wip-operation-card--skeleton"
      aria-hidden
    >
      <div className="dashboard-wip-operation-card__head">
        <div
          className="dashboard-wip-operation-card__head-fill dashboard-wip-operation-card__head-fill--loading"
          style={{ animationDelay: `${colorIndex * 80}ms` }}
        />
        <div className="dashboard-wip-operation-card__head-content">
          <span className="dashboard-wip-operation-card__skeleton-line dashboard-wip-operation-card__skeleton-line--name" />
          <span className="dashboard-wip-operation-card__skeleton-line dashboard-wip-operation-card__skeleton-line--pct" />
        </div>
      </div>
      <div className="dashboard-wip-operation-card__body">
        <div className="dashboard-wip-operation-card__main">
          <div className="dashboard-wip-operation-card__skeleton-line dashboard-wip-operation-card__skeleton-line--value" />
          <div className="dashboard-wip-operation-card__skeleton-line dashboard-wip-operation-card__skeleton-line--label" />
        </div>
        <div className="dashboard-wip-operation-card__metrics">
          {[0, 1, 2].map((row) => (
            <div key={row} className="dashboard-wip-operation-card__metric-row">
              <span className="dashboard-wip-operation-card__skeleton-line dashboard-wip-operation-card__skeleton-line--metric-label" />
              <span className="dashboard-wip-operation-card__skeleton-line dashboard-wip-operation-card__skeleton-line--metric-value" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WipOperationCardView({
  item,
  colorIndex,
  isDark = false,
  t,
  onClick,
  animateProgress = true,
}: WipOperationCardViewProps) {
  const { token } = theme.useToken();
  const themeStyle = useThemeStore((s) => s.resolved.themeStyle);
  const isPlain = themeStyle === 'plain';
  const completed = item.completed_quantity ?? 0;
  const headerColors = useMemo(
    () =>
      getQuickEntryHeaderColors(
        colorIndex,
        isDark,
        themeStyle,
        token.colorPrimary,
        token.colorPrimaryBg,
      ),
    [colorIndex, isDark, themeStyle, token.colorPrimary, token.colorPrimaryBg],
  );
  const progressPct = Math.min(100, Math.max(0, Math.round(item.current_progress ?? 0)));
  const [fillPct, setFillPct] = useState(() => (animateProgress ? 0 : progressPct));
  const prevItemRef = useRef<ProcessProgressItem | null>(null);
  const [deltaFields, setDeltaFields] = useState<ReadonlySet<WipDeltaField>>(new Set());
  const [deltaTick, setDeltaTick] = useState(0);

  useLayoutEffect(() => {
    const prev = prevItemRef.current;
    prevItemRef.current = item;
    if (prev == null || prefersReducedMotion()) return;
    const fields = collectWipDeltas(prev, item);
    if (fields.length === 0) return;
    setDeltaTick((n) => n + 1);
    setDeltaFields(new Set(fields));
  }, [item]);

  const clearDelta = (field: WipDeltaField) => {
    setDeltaFields((current) => {
      if (!current.has(field)) return current;
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  };

  useLayoutEffect(() => {
    if (!animateProgress) {
      setFillPct(progressPct);
      return;
    }
    if (prefersReducedMotion()) {
      setFillPct(progressPct);
      return;
    }
    const frame = requestAnimationFrame(() => {
      setFillPct(progressPct);
    });
    return () => cancelAnimationFrame(frame);
  }, [animateProgress, progressPct]);

  return (
    <button
      type="button"
      className={['dashboard-wip-operation-card', isPlain ? 'dashboard-wip-operation-card--plain' : '']
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      disabled={!onClick}
    >
      <div
        className="dashboard-wip-operation-card__head"
        style={{ background: headerColors.progressBackground }}
      >
        <div
          className="dashboard-wip-operation-card__head-fill"
          style={{
            width: `${fillPct}%`,
            background: headerColors.solid,
            transitionDelay: animateProgress ? `${colorIndex * 60}ms` : undefined,
          }}
        />
        <div className="dashboard-wip-operation-card__head-content">
          <span
            className="dashboard-wip-operation-card__head-name"
            title={item.process_name}
          >
            {item.process_name}
          </span>
          <WipDeltaText
            key={deltaFields.has('progress') ? `progress-${deltaTick}` : 'progress'}
            field="progress"
            active={deltaFields.has('progress')}
            className="dashboard-wip-operation-card__head-progress"
            onDone={clearDelta}
          >
            {t('pages.dashboard.wipOperationCurrentProgress', { value: progressPct })}
          </WipDeltaText>
        </div>
      </div>

      <div className="dashboard-wip-operation-card__body">
        <div className="dashboard-wip-operation-card__main">
          <WipDeltaText
            key={deltaFields.has('planned') ? `planned-${deltaTick}` : 'planned'}
            field="planned"
            active={deltaFields.has('planned')}
            className="dashboard-wip-operation-card__main-value"
            onDone={clearDelta}
          >
            {formatQuantity(item.planned_quantity)}
          </WipDeltaText>
          <div className="dashboard-wip-operation-card__main-label">
            {t('pages.dashboard.wipOperationTaskQty')}
          </div>
        </div>

        <div className="dashboard-wip-operation-card__metrics">
          <div className="dashboard-wip-operation-card__metric-row">
            <span className="dashboard-wip-operation-card__metric-label">
              {t('pages.dashboard.wipOperationCompletedQty')}
            </span>
            <WipDeltaText
              key={deltaFields.has('completed') ? `completed-${deltaTick}` : 'completed'}
              field="completed"
              active={deltaFields.has('completed')}
              className="dashboard-wip-operation-card__metric-value dashboard-wip-operation-card__metric-value--primary"
              onDone={clearDelta}
            >
              {formatQuantity(completed)}
            </WipDeltaText>
          </div>
          <div className="dashboard-wip-operation-card__metric-row">
            <span className="dashboard-wip-operation-card__metric-label">
              {t('pages.dashboard.wipOperationQualifiedQty')}
            </span>
            <WipDeltaText
              key={deltaFields.has('qualified') ? `qualified-${deltaTick}` : 'qualified'}
              field="qualified"
              active={deltaFields.has('qualified')}
              className="dashboard-wip-operation-card__metric-value dashboard-wip-operation-card__metric-value--success"
              onDone={clearDelta}
            >
              {formatQuantity(item.qualified_quantity)}
            </WipDeltaText>
          </div>
          <div className="dashboard-wip-operation-card__metric-row">
            <span className="dashboard-wip-operation-card__metric-label">
              {t('pages.dashboard.wipOperationUnqualifiedQty')}
            </span>
            <WipDeltaText
              key={deltaFields.has('unqualified') ? `unqualified-${deltaTick}` : 'unqualified'}
              field="unqualified"
              active={deltaFields.has('unqualified')}
              className="dashboard-wip-operation-card__metric-value dashboard-wip-operation-card__metric-value--danger"
              onDone={clearDelta}
            >
              {formatQuantity(item.unqualified_quantity)}
            </WipDeltaText>
          </div>
        </div>
      </div>
    </button>
  );
}

export default WipOperationCardView;

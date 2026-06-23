import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Modal, Select, Space, Spin, Statistic, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

export type UniRelationImportEntity = 'material' | 'processRoute' | 'operation' | 'performance';
export type UniRelationImportWriteStrategy = 'upsert' | 'create_only' | 'link_only' | 'strict_fail';

export interface UniRelationImportSummary {
  created?: number;
  updated?: number;
  linked?: number;
  failed?: number;
}

export interface UniRelationImportResult {
  success?: boolean;
  message?: string;
  summary?: UniRelationImportSummary;
  errors?: string[];
  warnings?: string[];
}

export interface UniRelationImportModalProps {
  open: boolean;
  rawRows: string[][];
  defaultEntities: UniRelationImportEntity[];
  defaultWriteStrategy: UniRelationImportWriteStrategy;
  supportedStrategies: UniRelationImportWriteStrategy[];
  onCancel: () => void;
  onPrecheck?: (payload: {
    rawRows: string[][];
    entities: UniRelationImportEntity[];
    writeStrategy: UniRelationImportWriteStrategy;
  }) => Promise<UniRelationImportResult | void>;
  onSubmit: (payload: {
    rawRows: string[][];
    entities: UniRelationImportEntity[];
    writeStrategy: UniRelationImportWriteStrategy;
  }) => Promise<UniRelationImportResult | void>;
}

export const UniImportRelationModal: React.FC<UniRelationImportModalProps> = ({
  open,
  rawRows,
  defaultEntities,
  defaultWriteStrategy,
  supportedStrategies,
  onCancel,
  onPrecheck,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<UniRelationImportEntity[]>(defaultEntities);
  const [writeStrategy, setWriteStrategy] = useState<UniRelationImportWriteStrategy>(defaultWriteStrategy);
  const [loading, setLoading] = useState(false);
  const [precheckResult, setPrecheckResult] = useState<UniRelationImportResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setEntities(defaultEntities);
    setWriteStrategy(defaultWriteStrategy);
    setPrecheckResult(null);
  }, [open, defaultEntities, defaultWriteStrategy]);

  const entityOptions = useMemo(
    () => [
      { value: 'material', label: t('components.uniImport.relationEntityMaterial') },
      { value: 'processRoute', label: t('components.uniImport.relationEntityProcessRoute') },
      { value: 'operation', label: t('components.uniImport.relationEntityOperation') },
      { value: 'performance', label: t('components.uniImport.relationEntityPerformance') },
    ],
    [t],
  );

  const strategyOptions = useMemo(
    () =>
      supportedStrategies.map((s) => ({
        value: s,
        label: t(`components.uniImport.relationStrategy.${s}`),
      })),
    [supportedStrategies, t],
  );

  const dataRows = Math.max(0, rawRows.length - 2);

  const runPrecheck = async () => {
    if (!onPrecheck) return;
    setLoading(true);
    try {
      const res = await onPrecheck({ rawRows, entities, writeStrategy });
      setPrecheckResult(res ?? null);
    } finally {
      setLoading(false);
    }
  };

  const runSubmit = async () => {
    setLoading(true);
    try {
      const res = await onSubmit({ rawRows, entities, writeStrategy });
      setPrecheckResult(res ?? null);
      if (res?.success !== false && !res?.errors?.length) {
        onCancel();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      width={760}
      onCancel={onCancel}
      destroyOnHidden
      title={t('components.uniImport.relationImportTitle')}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button onClick={runPrecheck} loading={loading} disabled={!onPrecheck || entities.length === 0}>
            {t('components.uniImport.relationPrecheck')}
          </Button>
          <Button type="primary" onClick={runSubmit} loading={loading} disabled={entities.length === 0}>
            {t('components.uniImport.relationSubmit')}
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          {t('components.uniImport.relationRowsSummary', { rows: dataRows })}
        </Typography.Text>

        <div>
          <Typography.Text>{t('components.uniImport.relationEntityTitle')}</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Checkbox.Group
              value={entities}
              options={entityOptions}
              onChange={(vals) => setEntities(vals as UniRelationImportEntity[])}
            />
          </div>
        </div>

        <div>
          <Typography.Text>{t('components.uniImport.relationStrategyTitle')}</Typography.Text>
          <div style={{ marginTop: 8, maxWidth: 320 }}>
            <Select
              value={writeStrategy}
              options={strategyOptions}
              onChange={(v) => setWriteStrategy(v)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 12 }}>
            <Spin />
          </div>
        )}

        {precheckResult?.summary && (
          <Space wrap>
            <Statistic title={t('components.uniImport.relationSummaryCreated')} value={precheckResult.summary.created ?? 0} />
            <Statistic title={t('components.uniImport.relationSummaryUpdated')} value={precheckResult.summary.updated ?? 0} />
            <Statistic title={t('components.uniImport.relationSummaryLinked')} value={precheckResult.summary.linked ?? 0} />
            <Statistic title={t('components.uniImport.relationSummaryFailed')} value={precheckResult.summary.failed ?? 0} />
          </Space>
        )}

        {precheckResult?.warnings?.length ? (
          <Alert
            type="warning"
            showIcon
            message={t('components.uniImport.relationWarnings')}
            description={precheckResult.warnings.join('\n')}
          />
        ) : null}

        {precheckResult?.errors?.length ? (
          <Alert
            type="error"
            showIcon
            message={t('components.uniImport.relationErrors')}
            description={precheckResult.errors.join('\n')}
          />
        ) : null}
      </Space>
    </Modal>
  );
};

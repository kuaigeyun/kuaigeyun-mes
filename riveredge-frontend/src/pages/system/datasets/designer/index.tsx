/**
 * 数据集设计器页面
 *
 * 参照流程设计器，在新 tab 中打开。
 * 左侧：SQL/API 查询配置或图形化查询构建
 * 右侧：查询结果预览
 * 查询框和查询结果预览同屏显示
 */

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, Button, Card, Tabs, Input, Table, Badge, Space, Spin, Form } from 'antd';
import { SaveOutlined, CloseOutlined, PlayCircleOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { CanvasPageTemplate } from '../../../../components/layout-templates';
import DatasetQueryBuilder from '../../../../components/dataset-query-builder/DatasetQueryBuilder';
import { CODE_FONT_FAMILY } from '../../../../constants/fonts';
import {
  getDatasetByUuid,
  updateDataset,
  executeDatasetQuery,
  Dataset,
  ExecuteQueryResponse,
} from '../../../../services/dataset';

const { TextArea } = Input;

const DatasetDesignerPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uuid = searchParams.get('uuid');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [editorTab, setEditorTab] = useState<'sql' | 'visual'>('sql');
  const [sqlText, setSqlText] = useState<string>('');
  const [parametersList, setParametersList] = useState<Array<{ key: string; value: string }>>([{ key: '', value: '' }]);
  const [queryConfigForVisual, setQueryConfigForVisual] = useState<Record<string, any>>({});
  const [executeResult, setExecuteResult] = useState<ExecuteQueryResponse | null>(null);
  const resultTableWrapRef = useRef<HTMLDivElement>(null);
  const [resultTableBodyScrollY, setResultTableBodyScrollY] = useState(360);

  useLayoutEffect(() => {
    const isMetric =
      dataset?.output_type === 'metric' || dataset?.output_type === 'multi_metric';
    if (!executeResult?.success || !executeResult.data?.length || isMetric) return;
    const el = resultTableWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const h = el.getBoundingClientRect().height;
      // 表头 + 分页条 + 边框余量（scroll.y 仅作用在表体滚动区）
      setResultTableBodyScrollY(Math.max(160, Math.floor(h - 100)));
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [executeResult, dataset?.output_type]);

  useEffect(() => {
    if (!uuid) {
      messageApi.error(t('pages.system.datasets.missingUuid'));
      navigate('/system/datasets');
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const detail = await getDatasetByUuid(uuid);
        setDataset(detail);
        const cfg = detail.query_config || {};
        setSqlText(cfg.sql || '');
        const params = cfg.parameters || {};
        setParametersList(
          Object.keys(params).length > 0
            ? Object.entries(params).map(([k, v]) => ({ key: k, value: String(v ?? '') }))
            : [{ key: '', value: '' }]
        );
        setQueryConfigForVisual(cfg);
      } catch (error: any) {
        messageApi.error(error?.message || t('pages.system.datasets.loadFailed'));
        navigate('/system/datasets');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [uuid, navigate, messageApi]);

  const buildQueryConfigFromForm = (): Record<string, any> => {
    const params: Record<string, any> = {};
    parametersList.forEach(({ key, value }) => {
      if (key?.trim()) params[key.trim()] = value;
    });
    return { sql: sqlText, parameters: params };
  };

  const handleSave = async () => {
    if (!uuid) return;
    const queryConfig = editorTab === 'visual'
      ? queryConfigForVisual
      : buildQueryConfigFromForm();
    const saveQueryType = 'sql';
    try {
      setSaving(true);
      await updateDataset(uuid, {
        query_type: saveQueryType,
        query_config: queryConfig,
      });
      messageApi.success(t('pages.system.datasets.saveSuccess'));
      setDataset((prev) => (prev ? { ...prev, query_type: saveQueryType, query_config: queryConfig } : null));
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.datasets.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleExecute = async () => {
    if (!uuid) return;
    const draftQueryConfig =
      editorTab === 'visual' ? { ...queryConfigForVisual } : buildQueryConfigFromForm();
    try {
      setExecuting(true);
      setExecuteResult(null);
      const result = await executeDatasetQuery(uuid, {
        limit: 100,
        offset: 0,
        query_config: draftQueryConfig,
      });
      setExecuteResult(result);
      if (result.success) {
        messageApi.success(t('pages.system.datasets.executeSuccess'));
      } else {
        messageApi.error(result.error || t('pages.system.datasets.executeFailed'));
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.datasets.executeFailed'));
      setExecuteResult({
        success: false,
        data: [],
        total: 0,
        columns: [],
        elapsed_time: 0,
        error: error.message || t('pages.system.datasets.executeFailed'),
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleBack = () => {
    navigate('/system/datasets');
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: 'var(--ant-color-text-secondary)' }}>{t('pages.system.datasets.loading')}</div>
      </div>
    );
  }

  if (!dataset) {
    return null;
  }

  const toolbar = (
    <Space>
      <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
        {t('pages.system.datasets.save')}
      </Button>
      <Button icon={<PlayCircleOutlined />} loading={executing} onClick={handleExecute}>
        {t('pages.system.datasets.executeQuery')}
      </Button>
      <Button icon={<CloseOutlined />} onClick={handleBack}>
        {t('pages.system.datasets.back')}
      </Button>
      <span style={{ marginLeft: 16, color: '#666' }}>
        {dataset.name} ({dataset.code})
      </span>
    </Space>
  );

  const queryConfigPanel = (
    <Tabs
      activeKey={editorTab}
      size="small"
      onChange={(k) => {
        setEditorTab(k as 'sql' | 'visual');
        if (k === 'visual') {
          // 图形化只生成 SQL，不覆盖当前 JSON
        }
      }}
      tabBarStyle={{ marginBottom: 0 }}
      items={[
        {
          key: 'sql',
          label: t('pages.system.datasets.sqlConfig'),
          children: (
            <div style={{ paddingTop: 8 }}>
              <div
                style={{
                  marginBottom: 8,
                  padding: '6px 10px',
                  background: 'var(--ant-color-info-bg)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--ant-color-info)',
                }}
              >
                {t('pages.system.datasets.tenantIsolationTip')}
              </div>
              <Form layout="vertical" size="small" style={{ marginBottom: 0 }}>
                <Form.Item label={t('pages.system.datasets.sqlLabel')} style={{ marginBottom: 8 }}>
                  <TextArea
                    value={sqlText}
                    onChange={(e) => setSqlText(e.target.value)}
                    rows={12}
                    placeholder={t('pages.system.datasets.sqlPlaceholder')}
                    style={{ fontFamily: CODE_FONT_FAMILY, width: '100%', resize: 'vertical' }}
                  />
                </Form.Item>
                <Form.Item label={t('pages.system.datasets.paramsLabel')} style={{ marginBottom: 0 }}>
                  {parametersList.map((item, idx) => (
                    <Space key={idx} style={{ display: 'flex', marginBottom: 6 }} align="baseline">
                      <Input
                        placeholder={t('pages.system.datasets.paramNamePlaceholder')}
                        value={item.key}
                        onChange={(e) => {
                          const next = [...parametersList];
                          next[idx] = { ...next[idx], key: e.target.value };
                          setParametersList(next);
                        }}
                        style={{ width: 120 }}
                      />
                      <Input
                        placeholder={t('pages.system.datasets.paramValuePlaceholder')}
                        value={item.value}
                        onChange={(e) => {
                          const next = [...parametersList];
                          next[idx] = { ...next[idx], value: e.target.value };
                          setParametersList(next);
                        }}
                        style={{ width: 140 }}
                      />
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={() => setParametersList(parametersList.filter((_, i) => i !== idx))}
                      />
                    </Space>
                  ))}
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => setParametersList([...parametersList, { key: '', value: '' }])}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    {t('pages.system.datasets.addParam')}
                  </Button>
                </Form.Item>
              </Form>
            </div>
          ),
        },
        {
          key: 'visual',
          label: t('pages.system.datasets.visualQuery'),
          children: (
            <div style={{ paddingTop: 8 }}>
              <DatasetQueryBuilder
                dataSourceUuid={dataset.data_source_uuid}
                value={queryConfigForVisual}
                onChange={(config) => setQueryConfigForVisual(config)}
              />
            </div>
          ),
        },
      ]}
    />
  );

  const panelShellStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--ant-color-border-secondary)',
    borderRadius: 8,
    overflow: 'hidden',
    background: 'var(--ant-color-bg-container)',
  };

  const panelHeaderStyle: React.CSSProperties = {
    flexShrink: 0,
    padding: '8px 12px',
    borderBottom: '1px solid var(--ant-color-border-secondary)',
    fontWeight: 600,
    fontSize: 14,
  };

  const panelBodyStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: '8px 12px',
  };

  const resultPanel = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {executeResult && (
          <>
            <Badge status={executeResult.success ? 'success' : 'error'} />
            <span>{executeResult.success ? t('pages.system.datasets.executeSuccessShort') : t('pages.system.datasets.executeFailedShort')}</span>
            <span style={{ color: 'var(--ant-color-text-secondary)' }}>
              {t('pages.system.datasets.elapsedTime')}: {executeResult.elapsed_time}s
            </span>
            {executeResult.total !== undefined && (
              <span style={{ color: 'var(--ant-color-text-secondary)' }}>
                {t('pages.system.datasets.totalRows')}: {executeResult.total}
              </span>
            )}
          </>
        )}
      </div>
      {executeResult?.error && (
        <div
          style={{
            marginBottom: 8,
            padding: '8px 10px',
            backgroundColor: 'var(--ant-color-error-bg)',
            borderRadius: 6,
            color: 'var(--ant-color-error)',
            fontSize: 13,
          }}
        >
          {executeResult.error}
        </div>
      )}
      <div ref={resultTableWrapRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!executeResult ? (
          <div
            style={{
              height: '100%',
              minHeight: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ant-color-text-secondary)',
              fontSize: 13,
            }}
          >
            {t('pages.system.datasets.clickExecuteTip')}
          </div>
        ) : executeResult.success && executeResult.data && executeResult.data.length > 0 ? (
          (dataset?.output_type === 'metric' || dataset?.output_type === 'multi_metric') ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {(dataset.output_type === 'metric'
                ? [{ key: 'value', label: '值', value: (executeResult.data[0] as any)?.value }]
                : Object.entries(executeResult.data[0] || {}).map(([k, v]) => ({ key: k, label: k, value: v }))
              ).map(({ key, label, value }) => (
                <Card key={key} size="small" style={{ minWidth: 140 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{value ?? '-'}</div>
                </Card>
              ))}
            </div>
          ) : (
            <Table
              dataSource={executeResult.data}
              columns={
                executeResult.columns?.map((col) => ({
                  title: col,
                  dataIndex: col,
                  key: col,
                  ellipsis: true,
                })) || []
              }
              pagination={{ pageSize: 20, showSizeChanger: true }}
              scroll={{ x: 'max-content', y: resultTableBodyScrollY }}
              size="small"
            />
          )
        ) : executeResult.success && (!executeResult.data || executeResult.data.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--ant-color-text-secondary)' }}>
            {t('pages.system.datasets.emptyResult')}
          </div>
        ) : null}
      </div>
    </div>
  );

  const canvas = (
    <div
      style={{
        display: 'flex',
        gap: 12,
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <section style={{ ...panelShellStyle, flex: '1 1 0', minWidth: 280 }}>
        <header style={panelHeaderStyle}>{t('pages.system.datasets.queryConfigTitle')}</header>
        <div style={panelBodyStyle}>{queryConfigPanel}</div>
      </section>
      <section style={{ ...panelShellStyle, flex: '1 1 0', minWidth: 280 }}>
        <header style={panelHeaderStyle}>{t('pages.system.datasets.resultPreviewTitle')}</header>
        <div style={panelBodyStyle}>{resultPanel}</div>
      </section>
    </div>
  );

  return (
    <CanvasPageTemplate
      toolbar={toolbar}
      canvas={canvas}
      canvasSurface="plain"
      functionalTitle={`${t('pages.system.datasets.designTitle')} - ${dataset.name}`}
    />
  );
};

export default DatasetDesignerPage;

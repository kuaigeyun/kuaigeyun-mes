/**
 * 数据集设计器页面
 *
 * 参照流程设计器，在新 tab 中打开。
 * 左侧：SQL/API 查询配置或图形化查询构建
 * 右侧：查询结果预览
 * 查询框和查询结果预览同屏显示
 */

import React, { useState, useEffect } from 'react';
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
  const [queryType, setQueryType] = useState<'sql' | 'api'>('sql');
  const [sqlText, setSqlText] = useState<string>('');
  const [parametersList, setParametersList] = useState<Array<{ key: string; value: string }>>([{ key: '', value: '' }]);
  const [queryConfigForVisual, setQueryConfigForVisual] = useState<Record<string, any>>({});
  const [executeResult, setExecuteResult] = useState<ExecuteQueryResponse | null>(null);

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
        setQueryType(detail.query_type);
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
      setQueryType(saveQueryType);
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.datasets.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleExecute = async () => {
    if (!uuid) return;
    try {
      setExecuting(true);
      setExecuteResult(null);
      const result = await executeDatasetQuery(uuid, { limit: 100, offset: 0 });
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
        <Spin size="large" tip={t('pages.system.datasets.loading')} />
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
      onChange={(k) => {
        setEditorTab(k as 'sql' | 'visual');
        if (k === 'visual') {
          setQueryType('sql'); // 图形化只生成 SQL，不覆盖当前 JSON
        }
      }}
      items={[
        {
          key: 'sql',
          label: t('pages.system.datasets.sqlConfig'),
          children: (
            <div style={{ padding: '8px 0' }}>
              <div style={{ marginBottom: 8, padding: '8px 12px', background: '#e6f7ff', borderRadius: 4, fontSize: 12, color: '#0050b3' }}>
                {t('pages.system.datasets.tenantIsolationTip')}
              </div>
              <Form layout="vertical" size="small">
                <Form.Item label={t('pages.system.datasets.sqlLabel')} style={{ marginBottom: 12 }}>
                  <TextArea
                    value={sqlText}
                    onChange={(e) => setSqlText(e.target.value)}
                    rows={10}
                    placeholder={t('pages.system.datasets.sqlPlaceholder')}
                    style={{ fontFamily: CODE_FONT_FAMILY, width: '100%', resize: 'vertical' }}
                  />
                </Form.Item>
                <Form.Item label={t('pages.system.datasets.paramsLabel')} style={{ marginBottom: 8 }}>
                  {parametersList.map((item, idx) => (
                    <Space key={idx} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
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
                    style={{ width: '100%' }}
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
            <div style={{ padding: '8px 0' }}>
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

  const resultPanel = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        {executeResult && (
          <>
            <Badge status={executeResult.success ? 'success' : 'error'} />
            <span>{executeResult.success ? t('pages.system.datasets.executeSuccessShort') : t('pages.system.datasets.executeFailedShort')}</span>
            <span style={{ color: '#999' }}>{t('pages.system.datasets.elapsedTime')}: {executeResult.elapsed_time}s</span>
            {executeResult.total !== undefined && (
              <span style={{ color: '#999' }}>{t('pages.system.datasets.totalRows')}: {executeResult.total}</span>
            )}
          </>
        )}
      </div>
      {executeResult?.error && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            backgroundColor: '#fff2f0',
            borderRadius: 4,
            color: '#cf1322',
          }}
        >
          {executeResult.error}
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 200 }}>
        {!executeResult ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
            }}
          >
            {t('pages.system.datasets.clickExecuteTip')}
          </div>
        ) : executeResult.success && executeResult.data && executeResult.data.length > 0 ? (
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
            scroll={{ x: 'max-content' }}
            size="small"
          />
        ) : executeResult.success && (!executeResult.data || executeResult.data.length === 0) ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>{t('pages.system.datasets.emptyResult')}</div>
        ) : null}
      </div>
    </div>
  );

  const canvas = (
    <div
      style={{
        display: 'flex',
        gap: 16,
        height: '100%',
        minHeight: 500,
        overflow: 'hidden',
      }}
    >
      <Card
        title={t('pages.system.datasets.queryConfigTitle')}
        style={{ flex: '0 0 50%', minWidth: 320, overflow: 'auto' }}
        styles={{ body: { padding: 16 } }}
      >
        {queryConfigPanel}
      </Card>
      <Card
        title={t('pages.system.datasets.resultPreviewTitle')}
        style={{ flex: 1, minWidth: 320, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, overflow: 'hidden', padding: 16 } }}
      >
        {resultPanel}
      </Card>
    </div>
  );

  return (
    <CanvasPageTemplate
      toolbar={toolbar}
      canvas={canvas}
      functionalTitle={`${t('pages.system.datasets.designTitle')} - ${dataset.name}`}
    />
  );
};

export default DatasetDesignerPage;

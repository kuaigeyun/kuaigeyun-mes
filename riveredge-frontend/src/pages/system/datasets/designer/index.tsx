/**
 * 数据集设计器页面
 *
 * 参照流程设计器，在新 tab 中打开。
 * 左侧：SQL/API 查询配置或图形化查询构建
 * 右侧：查询结果预览
 * 查询框和查询结果预览同屏显示
 */

import React, { useState, useEffect } from 'react';
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
      messageApi.error('缺少数据集 UUID');
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
        messageApi.error(error?.message || '加载数据集失败');
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
      messageApi.success('保存成功');
      setDataset((prev) => (prev ? { ...prev, query_type: saveQueryType, query_config: queryConfig } : null));
      setQueryType(saveQueryType);
    } catch (error: any) {
      messageApi.error(error?.message || '保存失败');
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
        messageApi.success('查询执行成功');
      } else {
        messageApi.error(result.error || '查询执行失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '查询执行失败');
      setExecuteResult({
        success: false,
        data: [],
        total: 0,
        columns: [],
        elapsed_time: 0,
        error: error.message || '查询执行失败',
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
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!dataset) {
    return null;
  }

  const toolbar = (
    <Space>
      <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
        保存
      </Button>
      <Button icon={<PlayCircleOutlined />} loading={executing} onClick={handleExecute}>
        执行查询
      </Button>
      <Button icon={<CloseOutlined />} onClick={handleBack}>
        返回
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
          label: 'SQL 配置',
          children: (
            <div style={{ padding: '8px 0' }}>
              <div style={{ marginBottom: 8, padding: '8px 12px', background: '#e6f7ff', borderRadius: 4, fontSize: 12, color: '#0050b3' }}>
                共享库租户隔离：系统自动注入 tenant_id 过滤，仅返回当前租户数据。
              </div>
              <Form layout="vertical" size="small">
                <Form.Item label="SQL 语句" style={{ marginBottom: 12 }}>
                  <TextArea
                    value={sqlText}
                    onChange={(e) => setSqlText(e.target.value)}
                    rows={10}
                    placeholder="SELECT * FROM users WHERE status = :status"
                    style={{ fontFamily: CODE_FONT_FAMILY, width: '100%', resize: 'vertical' }}
                  />
                </Form.Item>
                <Form.Item label="查询参数（SQL 中用 :参数名 引用）" style={{ marginBottom: 8 }}>
                  {parametersList.map((item, idx) => (
                    <Space key={idx} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Input
                        placeholder="参数名"
                        value={item.key}
                        onChange={(e) => {
                          const next = [...parametersList];
                          next[idx] = { ...next[idx], key: e.target.value };
                          setParametersList(next);
                        }}
                        style={{ width: 120 }}
                      />
                      <Input
                        placeholder="值"
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
                    添加参数
                  </Button>
                </Form.Item>
              </Form>
            </div>
          ),
        },
        {
          key: 'visual',
          label: '图形化查询',
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
            <span>{executeResult.success ? '执行成功' : '执行失败'}</span>
            <span style={{ color: '#999' }}>耗时: {executeResult.elapsed_time}s</span>
            {executeResult.total !== undefined && (
              <span style={{ color: '#999' }}>总行数: {executeResult.total}</span>
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
            点击「执行查询」预览结果
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
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>查询结果为空</div>
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
        title="查询配置"
        style={{ flex: '0 0 50%', minWidth: 320, overflow: 'auto' }}
        styles={{ body: { padding: 16 } }}
      >
        {queryConfigPanel}
      </Card>
      <Card
        title="查询结果预览"
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
      functionalTitle={`数据集设计 - ${dataset.name}`}
    />
  );
};

export default DatasetDesignerPage;

/**
 * 数据集图形化查询构建器
 *
 * 支持表/列选择、条件构建，生成 query_config
 * 依赖数据源 schema API
 */

import React, { useEffect, useState } from 'react';
import { Select, Input, Button, Space, Form, InputNumber, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getDataSourceSchema, SchemaTable } from '../../services/dataSource';
import { CODE_FONT_FAMILY } from '../../constants/fonts';

export interface QueryBuilderConfig {
  sql?: string;
  parameters?: Record<string, any>;
}

export interface DatasetQueryBuilderProps {
  dataSourceUuid: string | null;
  value?: QueryBuilderConfig;
  onChange?: (config: QueryBuilderConfig) => void;
  disabled?: boolean;
}

const DatasetQueryBuilder: React.FC<DatasetQueryBuilderProps> = ({
  dataSourceUuid,
  value,
  onChange,
  disabled,
}) => {
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [conditions, setConditions] = useState<Array<{ column: string; op: string; value: string }>>([]);
  const [orderBy, setOrderBy] = useState<string>('');
  const [orderDir, setOrderDir] = useState<'ASC' | 'DESC'>('ASC');
  const [limit, setLimit] = useState<number>(100);

  const currentTable = tables.find((t) => t.name === selectedTable);
  const columns = currentTable?.columns || [];

  useEffect(() => {
    if (!dataSourceUuid) {
      setTables([]);
      setSelectedTable('');
      setSelectedColumns([]);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const res = await getDataSourceSchema(dataSourceUuid);
        if (res.error) {
          message.warning(res.error);
          setTables([]);
        } else {
          setTables(res.tables || []);
        }
      } catch (e: any) {
        message.error(e?.message || '加载 schema 失败');
        setTables([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dataSourceUuid]);

  const emitChange = (config: QueryBuilderConfig) => {
    onChange?.(config);
  };

  const buildSql = () => {
    if (!selectedTable) return;
    const cols = selectedColumns.length > 0 ? selectedColumns.join(', ') : '*';
    let sql = `SELECT ${cols} FROM ${selectedTable}`;
    const params: Record<string, any> = {};
    if (conditions.length > 0) {
      const parts = conditions.map((c, i) => {
        const p = `param_${i}`;
        params[p] = c.value;
        return `${c.column} ${c.op} :${p}`;
      });
      sql += ' WHERE ' + parts.join(' AND ');
    }
    if (orderBy) {
      sql += ` ORDER BY ${orderBy} ${orderDir}`;
    }
    sql += ` LIMIT ${limit}`;
    emitChange({ sql, parameters: params });
  };

  const addCondition = () => {
    if (columns.length > 0) {
      setConditions([...conditions, { column: columns[0].name, op: '=', value: '' }]);
    }
  };

  const removeCondition = (i: number) => {
    setConditions(conditions.filter((_, idx) => idx !== i));
  };

  const updateCondition = (i: number, field: string, val: string) => {
    const next = [...conditions];
    (next[i] as any)[field] = val;
    setConditions(next);
  };

  if (!dataSourceUuid) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
        请先选择数据源
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center' }}>加载表结构...</div>;
  }

  if (tables.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
        该数据源暂不支持图形化查询，请使用 SQL 配置
      </div>
    );
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Form.Item label="表">
        <Select
          placeholder="选择表"
          value={selectedTable || undefined}
          onChange={(v) => {
            setSelectedTable(v || '');
            setSelectedColumns([]);
            setConditions([]);
            setOrderBy('');
          }}
          options={tables.map((t) => ({ label: t.name, value: t.name }))}
          style={{ width: '100%' }}
          disabled={disabled}
        />
      </Form.Item>
      {currentTable && (
        <>
          <Form.Item label="列">
            <Select
              mode="multiple"
              placeholder="选择列（可多选，不选则 *）"
              value={selectedColumns}
              onChange={setSelectedColumns}
              options={columns.map((c) => ({ label: `${c.name} (${c.type})`, value: c.name }))}
              style={{ width: '100%' }}
              disabled={disabled}
            />
          </Form.Item>
          <Form.Item label="条件">
            {conditions.map((c, i) => (
              <Space key={i} style={{ marginBottom: 8, display: 'flex' }}>
                <Select
                  value={c.column}
                  onChange={(v) => updateCondition(i, 'column', v)}
                  options={columns.map((col) => ({ label: col.name, value: col.name }))}
                  style={{ width: 120 }}
                  disabled={disabled}
                />
                <Select
                  value={c.op}
                  onChange={(v) => updateCondition(i, 'op', v)}
                  options={[
                    { label: '=', value: '=' },
                    { label: '!=', value: '!=' },
                    { label: '>', value: '>' },
                    { label: '<', value: '<' },
                    { label: '>=', value: '>=' },
                    { label: '<=', value: '<=' },
                    { label: 'LIKE', value: 'LIKE' },
                  ]}
                  style={{ width: 80 }}
                  disabled={disabled}
                />
                <Input
                  value={c.value}
                  onChange={(e) => updateCondition(i, 'value', e.target.value)}
                  placeholder="值或 :param"
                  style={{ width: 140 }}
                  disabled={disabled}
                />
                <Button type="text" icon={<DeleteOutlined />} onClick={() => removeCondition(i)} disabled={disabled} />
              </Space>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={addCondition} disabled={disabled}>
              添加条件
            </Button>
          </Form.Item>
          <Form.Item label="排序">
            <Space>
              <Select
                placeholder="排序列"
                value={orderBy || undefined}
                onChange={setOrderBy}
                options={columns.map((c) => ({ label: c.name, value: c.name }))}
                style={{ width: 140 }}
                disabled={disabled}
              />
              <Select
                value={orderDir}
                onChange={(v) => setOrderDir(v)}
                options={[
                  { label: '升序', value: 'ASC' },
                  { label: '降序', value: 'DESC' },
                ]}
                style={{ width: 100 }}
                disabled={disabled}
              />
            </Space>
          </Form.Item>
          <Form.Item label="限制行数">
            <InputNumber value={limit} onChange={(v) => setLimit(v || 100)} min={1} max={10000} disabled={disabled} />
          </Form.Item>
          <Button type="primary" onClick={buildSql} disabled={disabled}>
            生成 SQL
          </Button>
          {value?.sql && (
            <pre
              style={{
                margin: 0,
                padding: 8,
                fontSize: 12,
                fontFamily: CODE_FONT_FAMILY,
                background: '#f5f5f5',
                borderRadius: 4,
                overflow: 'auto',
              }}
            >
              {value.sql}
            </pre>
          )}
        </>
      )}
    </Space>
  );
};

export default DatasetQueryBuilder;

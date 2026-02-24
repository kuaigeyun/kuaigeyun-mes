/**
 * 高级搜索弹窗
 *
 * 根据 fields 动态生成搜索表单，提交后调用 onSearch 展示结果列表，选择一项后 onSelect 并关闭。
 */

import React, { useState } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Button, List, theme } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { AdvancedSearchField } from './types';
import dayjs from 'dayjs';

export interface AdvancedSearchModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  fields: AdvancedSearchField[];
  onSearch: (values: Record<string, any>) => Promise<Array<{ value: any; label: string }>>;
  onSelect: (value: any, label: string) => void;
}

export const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  open,
  onClose,
  title = '高级搜索',
  fields,
  onSearch,
  onSelect,
}) => {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ value: any; label: string }>>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    try {
      const values = await form.validateFields().catch(() => ({}));
      const normalized: Record<string, any> = {};
      Object.keys(values).forEach((k) => {
        const v = values[k];
        if (v !== undefined && v !== null && v !== '') {
          normalized[k] = dayjs.isDayjs(v) ? v.format('YYYY-MM-DD') : v;
        }
      });
      setLoading(true);
      setSearched(true);
      const list = await onSearch(normalized);
      setResults(Array.isArray(list) ? list : []);
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: { value: any; label: string }) => {
    onSelect(item.value, item.label);
    handleClose();
  };

  const handleClose = () => {
    form.resetFields();
    setResults([]);
    setSearched(false);
    onClose();
  };

  const renderField = (field: AdvancedSearchField) => {
    const { name, label: fieldLabel, type = 'text' } = field;
    if (type === 'number') {
      return (
        <Form.Item key={name} name={name} label={fieldLabel} style={{ marginBottom: 12 }}>
          <InputNumber placeholder={`请输入${fieldLabel}`} style={{ width: '100%' }} />
        </Form.Item>
      );
    }
    if (type === 'date') {
      return (
        <Form.Item key={name} name={name} label={fieldLabel} style={{ marginBottom: 12 }}>
          <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
        </Form.Item>
      );
    }
    return (
      <Form.Item key={name} name={name} label={fieldLabel} style={{ marginBottom: 12 }}>
        <Input placeholder={`请输入${fieldLabel}`} allowClear />
      </Form.Item>
    );
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={480}
      destroyOnHidden
      styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
    >
      <Form form={form} layout="vertical" onFinish={handleSearch}>
        {fields.map(renderField)}
        <Form.Item style={{ marginBottom: 16 }}>
          <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading} block>
            搜索
          </Button>
        </Form.Item>
      </Form>
      {searched && (
        <div style={{ borderTop: `1px solid ${token.colorBorder}`, paddingTop: 12 }}>
          <div style={{ marginBottom: 8, fontWeight: 600, color: token.colorTextHeading }}>
            搜索结果（点击选择）
          </div>
          {results.length === 0 ? (
            <div style={{ color: token.colorTextSecondary, padding: '12px 0' }}>暂无结果</div>
          ) : (
            <List
              size="small"
              dataSource={results}
              style={{ maxHeight: 260, overflow: 'auto' }}
              renderItem={(item) => (
                <List.Item
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = token.colorFillTertiary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {item.label}
                </List.Item>
              )}
            />
          )}
        </div>
      )}
    </Modal>
  );
};

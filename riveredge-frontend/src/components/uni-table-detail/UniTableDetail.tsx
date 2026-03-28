import React from 'react';
import { Table, Form as AntForm, Button, Space } from 'antd';
import type { TableProps, ColumnsType } from 'antd/es/table';
import { PlusOutlined, ImportOutlined, DeleteOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import './index.less';

export interface UniTableDetailProps<RecordType = any> {
  /** 对应 Form.List 的 name */
  name: string | (string | number)[];
  /** 列定义 */
  columns: ColumnsType<RecordType>;
  /** 标题 */
  title?: React.ReactNode;
  /** 是否必填（显示星号，默认 false） */
  required?: boolean;
  /** 是否禁用添加按钮 */
  disabledAdd?: boolean;
  /** 是否禁用删除按钮 */
  disabledRemove?: boolean;
  /** 添加按钮文字 */
  addText?: string;
  /** 添加行时的默认值 */
  initialValue?: RecordType;
  /** 自定义工具栏操作（右侧，如导入按钮） */
  headerExtra?: React.ReactNode;
  /** 底部额外按钮（如“物料批量选择”） */
  footerExtra?: React.ReactNode;
  /** 多选物料点击事件 */
  onBatchSelect?: () => void;
  /** 多选物料按钮文字 */
  batchSelectText?: string;
  /** 自定义汇总行 */
  summary?: (data: readonly RecordType[]) => React.ReactNode;
  /** 表格属性透传 */
  tableProps?: Partial<TableProps<RecordType>>;
  /** 是否隐藏操作列（删除） */
  hideOperation?: boolean;
  /** 导入按钮点击事件 */
  onImport?: () => void;
  /** 容器自定义样式 */
  containerStyle?: React.CSSProperties;
}

/**
 * 通用明细表格组件 (UniTableDetail)
 * 
 * 基准设计：报价单新建Modal中的物料明细表。
 * 支持 Form.List 自动关联、响应式滚动、自定义页脚按钮等。
 */
export const UniTableDetail: React.FC<UniTableDetailProps> = ({
  name,
  columns,
  title,
  required = false,
  disabledAdd,
  disabledRemove,
  addText,
  initialValue = {},
  headerExtra,
  footerExtra,
  summary,
  tableProps,
  hideOperation,
  onImport,
  onBatchSelect,
  batchSelectText,
  containerStyle,
}) => {
  const { t } = useTranslation();

  return (
    <div className="uni-table-detail" style={containerStyle}>
      {(title || (headerExtra || onImport)) && (
        <div className="uni-table-detail-header">
          <span className="detail-title">
            {required && <span className="required-mark">*</span>}
            {title}
          </span>
          <div className="uni-table-detail-header-actions">
            {headerExtra}
            {onImport && (
              <Button type="default" size="small" icon={<ImportOutlined />} onClick={onImport}>
                {t('common.import') ?? '导入明细'}
              </Button>
            )}
          </div>
        </div>
      )}

      <AntForm.List
        name={name}
        rules={[
          {
            validator: async (_, value) => {
              if (required && (!value || value.length < 1)) {
                return Promise.reject(new Error(t('common.itemsRequired') ?? '请至少添加一行明细'));
              }
            },
          },
        ]}
      >
        {(fields, { add, remove }) => {
          // 计算列总宽度（用于横向滚动）
          const totalWidth = columns.reduce((s, c) => s + (Number(c.width) || 0), 0) + (hideOperation ? 0 : 70);

          // 合并操作列
          const finalColumns = [...columns];
          if (!hideOperation && !disabledRemove) {
            finalColumns.push({
              title: t('common.operate') ?? '操作',
              key: 'operation',
              width: 70,
              align: 'center',
              fixed: 'right',
              render: (_, __, index) => (
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => remove(index)}
                >
                  {t('common.delete') ?? '删除'}
                </Button>
              ),
            });
          }

          return (
            <div className="detail-table-wrapper">
              <Table
                className="uni-detail-table"
                dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                columns={finalColumns}
                pagination={false}
                size="small"
                rowKey="key"
                scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                summary={summary}
                {...tableProps}
                footer={() => (
                  <div className="detail-table-footer">
                    <Space style={{ width: '100%' }} wrap>
                      {!disabledAdd && (
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => add(initialValue)}
                          style={{ flex: 1, minWidth: 120 }}
                        >
                          {addText || t('common.addRow') || '添加明细'}
                        </Button>
                      )}
                      {onBatchSelect && (
                        <Button
                          type="default"
                          icon={<AppstoreAddOutlined />}
                          onClick={onBatchSelect}
                          style={{ flex: 1, minWidth: 120 }}
                        >
                          {batchSelectText || t('app.kuaizhizao.common.materialBatchSelect') || '多选物料'}
                        </Button>
                      )}
                      {footerExtra}
                    </Space>
                  </div>
                )}
              />
            </div>
          );
        }}
      </AntForm.List>
    </div>
  );
};

export default UniTableDetail;

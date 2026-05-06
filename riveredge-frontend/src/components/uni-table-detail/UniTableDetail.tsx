import React from 'react';
import { Table, Form as AntForm, Button, Space, theme } from 'antd';
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
  /** 是否必填（显示星号，默认 true） */
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
  /** 底部额外按钮（如"物料批量选择"） */
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
  /** 至少保留行数；达到下限时禁用行删除（默认不限制） */
  minRows?: number;
  /** 导入按钮点击事件 */
  onImport?: () => void;
  /** 容器自定义样式 */
  containerStyle?: React.CSSProperties;
}

export interface UniTableDetailHeaderProps {
  /** 标题 */
  title?: React.ReactNode;
  /** 是否必填（显示星号，默认 true） */
  required?: boolean;
  /** 标题左侧扩展（紧邻标题） */
  leftExtra?: React.ReactNode;
  /** 右侧标准动作按钮（统一 size/type） */
  actions?: Array<{
    key: string;
    label: React.ReactNode;
    onClick: () => void;
    icon?: React.ReactNode;
    type?: 'default' | 'primary' | 'dashed' | 'link' | 'text';
    danger?: boolean;
    disabled?: boolean;
  }>;
  /** 标题右侧自定义内容（兼容旧用法） */
  headerExtra?: React.ReactNode;
  /** 导入按钮点击事件 */
  onImport?: () => void;
  /** 导入按钮文案 */
  importText?: React.ReactNode;
}

export const UniTableDetailHeader: React.FC<UniTableDetailHeaderProps> = ({
  title,
  required = true,
  leftExtra,
  actions,
  headerExtra,
  onImport,
  importText,
}) => {
  const { t } = useTranslation();

  if (!title && !leftExtra && !actions?.length && !headerExtra && !onImport) return null;

  return (
    <div className="uni-table-detail-header">
      <Space align="center" size={12}>
        <span className="detail-title">
          {required && <span className="required-mark">*</span>}
          {title}
        </span>
        {leftExtra}
      </Space>
      <div className="uni-table-detail-header-actions">
        {(actions || []).map((action) => (
          <Button
            key={action.key}
            type={action.type ?? 'default'}
            size="small"
            icon={action.icon}
            danger={action.danger}
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
        {headerExtra}
        {onImport && (
          <Button type="default" size="small" icon={<ImportOutlined />} onClick={onImport}>
            {importText ?? t('common.import') ?? '导入明细'}
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * 通用明细表格组件 (UniTableDetail)
 *
 * 基准设计：报价单新建 Modal 中的物料明细表。
 * 支持 Form.List 自动关联、响应式滚动、自定义页脚按钮等。
 *
 * ⚠️ 背景色注入策略：
 *   操作列（fixed:'right'）的表头/单元格背景通过 onHeaderCell/onCell 的 inline style
 *   直接注入，不依赖 Less 选择器去覆盖 antd v6 CSS-in-JS 生成的样式。
 *   Inline style 优先级最高，与 antd 版本解耦，不受 CSS-in-JS 哈希类干扰。
 */
export const UniTableDetail: React.FC<UniTableDetailProps> = ({
  name,
  columns,
  title,
  required = true,
  disabledAdd,
  disabledRemove,
  addText,
  initialValue = {},
  headerExtra,
  footerExtra,
  summary,
  tableProps,
  hideOperation,
  minRows,
  onImport,
  onBatchSelect,
  batchSelectText,
  containerStyle,
}) => {
  const { t } = useTranslation();
  // 从 antd design token 中读取正确的背景色，与主题保持一致
  const { token } = theme.useToken();

  return (
    <div className="uni-table-detail" style={containerStyle}>
      <UniTableDetailHeader title={title} required={required} headerExtra={headerExtra} onImport={onImport} />

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
          // 关键：通过 onHeaderCell / onCell 用 inline style 注入背景色。
          // 不依赖 CSS 选择器，彻底规避 antd v6 CSS-in-JS 与 Less 的优先级冲突。
          const finalColumns: ColumnsType<any> = [...columns];
          if (!hideOperation && !disabledRemove) {
            finalColumns.push({
              title: t('common.operate') ?? '操作',
              key: 'operation',
              width: 70,
              align: 'center',
              fixed: 'right',
              // ✅ 表头单元格：inline style 直接给背景色，优先级高于一切 CSS
              onHeaderCell: () => ({
                style: { background: token.colorFillAlter },
              }),
              // ✅ 数据单元格：同理
              onCell: () => ({
                style: { background: token.colorBgContainer },
              }),
              render: (_, __, index) => {
                const deleteDisabled = minRows != null && fields.length <= minRows;
                return (
                  <Button
                    type="link"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    disabled={deleteDisabled}
                    onClick={() => remove(index)}
                  >
                    {t('common.delete') ?? '删除'}
                  </Button>
                );
              },
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

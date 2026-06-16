import React, { useLayoutEffect, useRef, useState } from 'react';
import { Table, Form as AntForm, Button, Space } from 'antd';
import type { TableProps, ColumnsType } from 'antd/es/table';
import { PlusOutlined, ImportOutlined, DeleteOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { hasFormListItems } from '../../utils/formListItems';
import './index.less';

export interface UniTableDetailProps<RecordType = any> {
  /** 对应 Form.List 的 name */
  name: string | (string | number)[];
  /** 列定义（不含操作列，由组件统一追加 fixed:'right' 删除列） */
  columns: ColumnsType<RecordType>;
  /** 标题 */
  title?: React.ReactNode;
  /** 是否必填（显示星号，默认 true） */
  required?: boolean;
  /** 至少一行校验失败时的提示 */
  requiredMessage?: string;
  /** 标题左侧扩展（如含税/不含税开关） */
  leftExtra?: React.ReactNode;
  /** 导入按钮文案 */
  importText?: React.ReactNode;
  /** 是否禁用添加按钮 */
  disabledAdd?: boolean;
  /** 是否禁用删除按钮 */
  disabledRemove?: boolean;
  /** 添加按钮文字 */
  addText?: string;
  /** 添加行时的默认值；可为函数以便读取表单上下文 */
  initialValue?: RecordType | (() => RecordType);
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
  /** 添加按钮位置：header=标题栏右上（默认），footer=表格底栏 */
  addPlacement?: 'header' | 'footer';
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

/** 仅在实际横向溢出时启用 scroll.x，避免未超高/未超宽时出现多余滚动条 */
const AdaptiveScrollDetailTable: React.FC<
  TableProps<any> & { totalWidth: number; rowCount: number }
> = ({ totalWidth, rowCount, scroll: userScroll, ...tableProps }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scrollX, setScrollX] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const measure = () => {
      // 用「各列定义宽度之和」与容器可视宽度比较，而非渲染后表格的 scrollWidth。
      // 否则未设 scroll.x 时表格会自动压缩列去适配容器，scrollWidth 恒等于 clientWidth，
      // 导致滚动条永不出现、列被一直压窄到数字显示不全。
      setScrollX(totalWidth > el.clientWidth + 1 ? totalWidth : undefined);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rowCount, totalWidth]);

  const mergedUserScroll = typeof userScroll === 'object' && userScroll != null ? userScroll : undefined;
  const scroll: TableProps<any>['scroll'] =
    scrollX != null
      ? { ...mergedUserScroll, x: scrollX }
      : mergedUserScroll?.y != null
        ? { y: mergedUserScroll.y }
        : undefined;

  return (
    <div ref={wrapRef} className="uni-table-detail-scroll">
      <Table {...tableProps} scroll={scroll} />
    </div>
  );
};

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
          <Button type="default" icon={<ImportOutlined />} onClick={onImport}>
            {importText ?? t('common.importDetail')}
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
 * 默认「添加明细」在标题栏右上角（与 headerExtra 并列）；可用 addPlacement="footer" 恢复底栏虚线按钮。
 *
 * ⚠️ 固定操作列：表头/单元格背景在 index.less（.uni-table-detail 作用域）；
 *   表格 wrapper 与报价单 hand-roll 一致（双层 div + overflowX: auto + Table width:100%）。
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
  leftExtra,
  footerExtra,
  summary,
  tableProps,
  hideOperation,
  minRows,
  onImport,
  importText,
  onBatchSelect,
  batchSelectText,
  containerStyle,
  requiredMessage,
  addPlacement = 'header',
}) => {
  const { t } = useTranslation();

  return (
    <div className="uni-table-detail" style={containerStyle}>
      <AntForm.List
        name={name}
        rules={[
          {
            validator: async (_, value) => {
              if (required && !hasFormListItems(value)) {
                return Promise.reject(new Error(requiredMessage ?? t('common.itemsRequired')));
              }
            },
          },
        ]}
      >
        {(fields, { add, remove }) => {
          const handleAdd = () => {
            const row = typeof initialValue === 'function' ? initialValue() : initialValue;
            add(row);
          };

          const headerActions: NonNullable<UniTableDetailHeaderProps['actions']> = [];
          if (!disabledAdd && addPlacement === 'header') {
            headerActions.push({
              key: 'add',
              label: addText || t('common.addDetail'),
              icon: <PlusOutlined />,
              type: 'default',
              onClick: handleAdd,
            });
          }
          if (onBatchSelect && addPlacement === 'header') {
            headerActions.push({
              key: 'batch-select',
              label: batchSelectText || t('app.kuaizhizao.common.materialBatchSelect'),
              icon: <AppstoreAddOutlined />,
              type: 'default',
              onClick: onBatchSelect,
            });
          }

          const showFooter =
            Boolean(footerExtra) ||
            (!disabledAdd && addPlacement === 'footer') ||
            (Boolean(onBatchSelect) && addPlacement === 'footer');

          // 计算列总宽度（用于横向滚动）
          const totalWidth = columns.reduce((s, c) => s + (Number(c.width) || 0), 0) + (hideOperation ? 0 : 48);

          const finalColumns: ColumnsType<any> = [...columns];
          if (!hideOperation && !disabledRemove) {
            finalColumns.push({
              title: t('common.actions'),
              key: 'operation',
              width: 48,
              align: 'center',
              fixed: 'right',
              onHeaderCell: () => ({ className: 'uni-detail-fixed-op-header' }),
              render: (_, __, index) => {
                const deleteDisabled = minRows != null && fields.length <= minRows;
                return (
                  <Button
                    type="link"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    disabled={deleteDisabled}
                    aria-label={t('common.delete')}
                    onClick={() => remove(index)}
                  />
                );
              },
            });
          }

          return (
            <>
              <UniTableDetailHeader
                title={title}
                required={required}
                leftExtra={leftExtra}
                actions={headerActions}
                headerExtra={headerExtra}
                onImport={onImport}
                importText={importText}
              />
              <div className="uni-table-detail-body">
                <AdaptiveScrollDetailTable
                  totalWidth={totalWidth}
                  rowCount={fields.length}
                  dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                  columns={finalColumns}
                  pagination={false}
                  size="small"
                  bordered={false}
                  rowKey="key"
                  {...tableProps}
                  // uni-detail-table 必须始终存在（固定列不透明背景 CSS 依赖它）；
                  // 与调用方自定义 className 合并，避免被 tableProps 覆盖丢失。
                  className={['uni-detail-table', tableProps?.className].filter(Boolean).join(' ')}
                  style={{ width: '100%', margin: 0, ...tableProps?.style }}
                  summary={summary}
                  footer={
                    showFooter
                      ? () => (
                          <div className="detail-table-footer">
                            <Space style={{ width: '100%' }} wrap>
                              {!disabledAdd && addPlacement === 'footer' && (
                                <Button
                                  type="dashed"
                                  icon={<PlusOutlined />}
                                  onClick={handleAdd}
                                  style={{ flex: 1, minWidth: 120 }}
                                >
                                  {addText || t('common.addDetail')}
                                </Button>
                              )}
                              {onBatchSelect && addPlacement === 'footer' && (
                                <Button
                                  type="default"
                                  icon={<AppstoreAddOutlined />}
                                  onClick={onBatchSelect}
                                  style={{ flex: 1, minWidth: 120 }}
                                >
                                  {batchSelectText || t('app.kuaizhizao.common.materialBatchSelect')}
                                </Button>
                              )}
                              {footerExtra}
                            </Space>
                          </div>
                        )
                      : undefined
                  }
                />
              </div>
            </>
          );
        }}
      </AntForm.List>
    </div>
  );
};

export default UniTableDetail;

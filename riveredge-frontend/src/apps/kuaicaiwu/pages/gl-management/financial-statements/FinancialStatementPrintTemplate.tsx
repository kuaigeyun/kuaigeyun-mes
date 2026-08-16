/**
 * 三大报表法定打印版式（对标小企业准则简表）
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import './FinancialStatementPrintTemplate.less';

export type StatementKind = 'balance-sheet' | 'income' | 'cash-flow';
export type StatementRow = Record<string, unknown>;

const NS = 'app.kuaicaiwu.gl.statements';

export function formatStatementMoney(value: unknown): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n === 0) return '—';
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isHeader(row: StatementRow): boolean {
  return Boolean(row.is_total) && Number(row.amount || 0) === 0 && !row.account_id;
}

function isTotal(row: StatementRow): boolean {
  return Boolean(row.is_total);
}

function splitBalanceColumns(rows: StatementRow[]) {
  const left = rows.filter((r) => String(r.section || '') === 'asset');
  const right = rows.filter((r) => {
    const section = String(r.section || '');
    return section === 'liability' || section === 'equity';
  });
  const size = Math.max(left.length, right.length);
  return Array.from({ length: size }, (_, i) => ({ left: left[i], right: right[i] }));
}

function cashFlowGroups(rows: StatementRow[], t: (key: string, opts?: Record<string, string>) => string) {
  const groups = [
    { key: 'operating', label: t(`${NS}.print.section.operating`, { defaultValue: '一、经营活动产生的现金流量' }) },
    { key: 'investing', label: t(`${NS}.print.section.investing`, { defaultValue: '二、投资活动产生的现金流量' }) },
    { key: 'financing', label: t(`${NS}.print.section.financing`, { defaultValue: '三、筹资活动产生的现金流量' }) },
  ];
  return groups.map((group) => ({
    ...group,
    items: rows.filter((r) => String(r.category || '') === group.key),
  }));
}

export interface FinancialStatementPrintTemplateProps {
  kind: StatementKind;
  title: string;
  year: number;
  month: number;
  companyName: string;
  preparedBy?: string;
  printTime?: string;
  rows: StatementRow[];
  summary?: StatementRow | null;
}

const FinancialStatementPrintTemplate: React.FC<FinancialStatementPrintTemplateProps> = ({
  kind,
  title,
  year,
  month,
  companyName,
  preparedBy,
  printTime,
  rows,
  summary,
}) => {
  const { t } = useTranslation();
  const lastDay = new Date(year, month, 0).getDate();
  const periodLabel =
    kind === 'balance-sheet'
      ? t(`${NS}.print.asOf`, {
          defaultValue: '{{year}}年{{month}}月{{day}}日',
          year,
          month: String(month).padStart(2, '0'),
          day: String(lastDay).padStart(2, '0'),
        })
      : t(`${NS}.print.period`, {
          defaultValue: '{{year}}年{{month}}月',
          year,
          month: String(month).padStart(2, '0'),
        });

  let lineNo = 0;
  const nextLine = (row?: StatementRow) => {
    if (!row || isHeader(row)) return '';
    lineNo += 1;
    return String(lineNo);
  };
  let leftLine = 0;
  let rightLine = 0;
  const sideLine = (row: StatementRow | undefined, side: 'left' | 'right') => {
    if (!row || isHeader(row)) return '';
    if (side === 'left') {
      leftLine += 1;
      return String(leftLine);
    }
    rightLine += 1;
    return String(rightLine);
  };

  return (
    <div className="fs-print-sheet">
      <h1 className="fs-print-title">{title}</h1>
      <div className="fs-print-meta">
        <span>
          {t(`${NS}.print.company`, { defaultValue: '编制单位' })}：{companyName || '—'}
        </span>
        <span>{periodLabel}</span>
        <span>{t(`${NS}.print.unit`, { defaultValue: '单位：元' })}</span>
      </div>

      {kind === 'balance-sheet' ? (
        <table className="fs-print-table">
          <thead>
            <tr>
              <th className="col-item">{t(`${NS}.print.asset`, { defaultValue: '资产' })}</th>
              <th className="col-line">{t(`${NS}.print.lineNo`, { defaultValue: '行次' })}</th>
              <th className="col-amt">{t(`${NS}.col.amount`, { defaultValue: '期末余额' })}</th>
              <th className="col-item">{t(`${NS}.print.liabEquity`, { defaultValue: '负债和所有者权益' })}</th>
              <th className="col-line">{t(`${NS}.print.lineNo`, { defaultValue: '行次' })}</th>
              <th className="col-amt">{t(`${NS}.col.amount`, { defaultValue: '期末余额' })}</th>
            </tr>
          </thead>
          <tbody>
            {splitBalanceColumns(rows).map((pair, idx) => (
              <tr key={`bs-${idx}`}>
                <td className={isTotal(pair.left || {}) ? 'is-total' : isHeader(pair.left || {}) ? 'is-header' : ''}>
                  {pair.left ? String(pair.left.label || '') : ''}
                </td>
                <td className="col-line">{sideLine(pair.left, 'left')}</td>
                <td className={`col-amt${isTotal(pair.left || {}) ? ' is-total' : ''}`}>
                  {pair.left && !isHeader(pair.left) ? formatStatementMoney(pair.left.amount) : ''}
                </td>
                <td className={isTotal(pair.right || {}) ? 'is-total' : isHeader(pair.right || {}) ? 'is-header' : ''}>
                  {pair.right ? String(pair.right.label || '') : ''}
                </td>
                <td className="col-line">{sideLine(pair.right, 'right')}</td>
                <td className={`col-amt${isTotal(pair.right || {}) ? ' is-total' : ''}`}>
                  {pair.right && !isHeader(pair.right) ? formatStatementMoney(pair.right.amount) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {kind === 'income' ? (
        <table className="fs-print-table">
          <thead>
            <tr>
              <th className="col-item">{t(`${NS}.col.label`, { defaultValue: '项目' })}</th>
              <th className="col-line">{t(`${NS}.print.lineNo`, { defaultValue: '行次' })}</th>
              <th className="col-amt">{t(`${NS}.col.periodAmount`, { defaultValue: '本期金额' })}</th>
              <th className="col-amt">{t(`${NS}.col.yearAmount`, { defaultValue: '本年累计' })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={String(row.line_key ?? idx)} className={isTotal(row) ? 'is-total' : isHeader(row) ? 'is-header' : ''}>
                <td>{String(row.label || '')}</td>
                <td className="col-line">{nextLine(row)}</td>
                <td className="col-amt">{isHeader(row) ? '' : formatStatementMoney(row.period_amount)}</td>
                <td className="col-amt">{isHeader(row) ? '' : formatStatementMoney(row.year_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {kind === 'cash-flow' ? (
        <table className="fs-print-table">
          <thead>
            <tr>
              <th className="col-item">{t(`${NS}.col.label`, { defaultValue: '项目' })}</th>
              <th className="col-line">{t(`${NS}.print.lineNo`, { defaultValue: '行次' })}</th>
              <th className="col-amt">{t(`${NS}.col.periodAmount`, { defaultValue: '本期金额' })}</th>
            </tr>
          </thead>
          <tbody>
            {cashFlowGroups(rows, t).map((group) => (
              <React.Fragment key={group.key}>
                <tr className="is-header">
                  <td>{group.label}</td>
                  <td className="col-line" />
                  <td className="col-amt" />
                </tr>
                {group.items.map((row, idx) => (
                  <tr key={String(row.item_code ?? idx)}>
                    <td>{String(row.item_name || '')}</td>
                    <td className="col-line">{nextLine(row)}</td>
                    <td className="col-amt">{formatStatementMoney(row.signed_amount ?? row.amount)}</td>
                  </tr>
                ))}
                <tr className="is-total">
                  <td>
                    {t(`${NS}.print.net.${group.key}`, {
                      defaultValue:
                        group.key === 'operating'
                          ? '经营活动现金流量净额'
                          : group.key === 'investing'
                            ? '投资活动现金流量净额'
                            : '筹资活动现金流量净额',
                    })}
                  </td>
                  <td className="col-line">{nextLine({ amount: 1 })}</td>
                  <td className="col-amt">
                    {formatStatementMoney(
                      group.key === 'operating'
                        ? summary?.operating_net
                        : group.key === 'investing'
                          ? summary?.investing_net
                          : summary?.financing_net,
                    )}
                  </td>
                </tr>
              </React.Fragment>
            ))}
            <tr className="is-total">
              <td>{t(`${NS}.print.netIncrease`, { defaultValue: '四、现金及现金等价物净增加额' })}</td>
              <td className="col-line">{nextLine({ amount: 1 })}</td>
              <td className="col-amt">{formatStatementMoney(summary?.net_increase)}</td>
            </tr>
          </tbody>
        </table>
      ) : null}

      <div className="fs-print-sign">
        <span>{t(`${NS}.print.legal`, { defaultValue: '单位负责人' })}：________</span>
        <span>{t(`${NS}.print.accountant`, { defaultValue: '会计机构负责人' })}：________</span>
        <span>
          {t(`${NS}.print.preparedBy`, { defaultValue: '制表人' })}：{preparedBy || '________'}
        </span>
      </div>
      {printTime ? (
        <div className="fs-print-time">
          {t(`${NS}.print.printedAt`, { defaultValue: '打印时间' })}：{printTime}
        </div>
      ) : null}
    </div>
  );
};

export default FinancialStatementPrintTemplate;

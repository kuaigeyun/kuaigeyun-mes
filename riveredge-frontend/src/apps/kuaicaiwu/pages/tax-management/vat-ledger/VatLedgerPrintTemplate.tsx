import React, { forwardRef } from 'react';
import type { VatLedgerSummary } from '../../../services/tax';

type Props = {
  summary: VatLedgerSummary;
  companyName: string;
};

const VatLedgerPrintTemplate = forwardRef<HTMLDivElement, Props>(({ summary, companyName }, ref) => {
  const money = (v: number) => Number(v || 0).toFixed(2);
  return (
    <div ref={ref} style={{ padding: 24, fontFamily: 'SimSun, serif', color: '#000' }}>
      <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        应交增值税属期台账
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 13 }}>
        <span>编制单位：{companyName || '—'}</span>
        <span>属期：{summary.tax_period}</span>
        <span>单位：元</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {[
            ['销项税额', money(summary.output_tax)],
            ['进项税额', money(summary.input_tax)],
            ['进项转出', money(summary.transfer_out)],
            ['应纳税额', money(summary.tax_payable)],
            ['城建税', money(summary.surcharge_urban)],
            ['教育费附加', money(summary.surcharge_education)],
            ['地方教育附加', money(summary.surcharge_local_education)],
            ['附加税合计', money(summary.surcharge_total)],
          ].map(([label, val]) => (
            <tr key={label}>
              <td style={{ border: '1px solid #333', padding: '6px 8px', width: '40%' }}>{label}</td>
              <td style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'right' }}>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 48, display: 'flex', justifyContent: 'space-between' }}>
        <span>制表：</span>
        <span>审核：</span>
        <span>盖章：</span>
      </div>
    </div>
  );
});

VatLedgerPrintTemplate.displayName = 'VatLedgerPrintTemplate';
export default VatLedgerPrintTemplate;

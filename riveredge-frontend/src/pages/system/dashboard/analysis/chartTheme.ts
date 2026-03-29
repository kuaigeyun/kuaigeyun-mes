/** 运营看板 AntV 暗色主题与强调色 */
export const accent = {
  cyan: '#38bdf8',
  emerald: '#34d399',
  amber: '#fbbf24',
  violet: '#a78bfa',
  rose: '#fb7185',
  slate: '#94a3b8',
};

export const businessBoardChartTheme = {
  styleSheet: {
    backgroundColor: 'transparent',
  },
  axis: {
    x: {
      label: { fill: '#cbd5e1', fontSize: 9 },
      grid: { stroke: 'rgba(255,255,255,0.06)' },
      line: { stroke: 'rgba(255,255,255,0.14)' },
    },
    y: {
      label: { fill: '#cbd5e1', fontSize: 9 },
      grid: { stroke: 'rgba(255,255,255,0.06)' },
      line: { stroke: 'rgba(255,255,255,0.14)' },
    },
  },
  legend: { text: { fill: '#94a3b8' } },
};

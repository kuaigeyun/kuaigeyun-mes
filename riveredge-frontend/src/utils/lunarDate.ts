import type { Dayjs } from 'dayjs';
import { Solar } from 'lunar-javascript';

/**
 * 将公历日期格式化为农历展示串（干支年 + 月日中文）
 */
export function formatLunarDate(d: Dayjs): string {
  const solar = Solar.fromYmd(d.year(), d.month() + 1, d.date());
  const lunar = solar.getLunar();
  return `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
}

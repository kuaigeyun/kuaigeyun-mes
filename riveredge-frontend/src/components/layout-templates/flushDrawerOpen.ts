import { flushSync } from 'react-dom';

/**
 * 在发起详情请求前同步提交「打开抽屉」相关 state，使首帧即可开始滑入动画并与网络请求重叠。
 * 典型用法：在回调内 setVisible(true)、写入列表行快照；随后再 await 拉详情。
 */
export function flushDrawerOpen(run: () => void): void {
  flushSync(run);
}

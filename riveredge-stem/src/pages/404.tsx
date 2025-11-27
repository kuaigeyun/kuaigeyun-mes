/**
 * 404 页面
 * 
 * 页面未找到时的展示页面
 */

import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

/**
 * 404 页面组件
 */
export default function NotFoundPage() {
  const navigate = useNavigate();
  
  return (
    <Result
      status="404"
      title="404"
      subTitle="抱歉，您访问的页面不存在"
      extra={
        <Button type="primary" onClick={() => navigate('/')}>
          返回首页
        </Button>
      }
    />
  );
}


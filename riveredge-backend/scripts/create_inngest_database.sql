-- 创建 Inngest 专用数据库
-- 用于存储 Inngest 工作流状态和执行历史

-- 创建数据库
-- 使用 template0 作为模板，避免排序规则冲突
CREATE DATABASE inngest
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    TEMPLATE = template0
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

-- 添加注释
COMMENT ON DATABASE inngest IS 'Inngest 工作流引擎专用数据库，用于存储工作流状态和执行历史';


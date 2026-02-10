"""
数据库迁移：为不良品记录添加检验单关联字段

为 apps_kuaizhizao_defect_records 表添加：
- incoming_inspection_id: 来料检验单ID（关联IncomingInspection）
- incoming_inspection_code: 来料检验单编码
- process_inspection_id: 过程检验单ID（关联ProcessInspection）
- process_inspection_code: 过程检验单编码
- finished_goods_inspection_id: 成品检验单ID（关联FinishedGoodsInspection）
- finished_goods_inspection_code: 成品检验单编码

同时将work_order_id、operation_id等字段改为可选（nullable）

Author: Auto (AI Assistant)
Date: 2026-01-27
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：为不良品记录添加检验单关联字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加来料检验单关联字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_defect_records' 
                AND column_name = 'incoming_inspection_id'
            ) THEN
                ALTER TABLE apps_kuaizhizao_defect_records 
                ADD COLUMN incoming_inspection_id INTEGER NULL;
                COMMENT ON COLUMN apps_kuaizhizao_defect_records.incoming_inspection_id IS '来料检验单ID（关联IncomingInspection）';
            END IF;
        END $$;
        
        -- 添加来料检验单编码字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_defect_records' 
                AND column_name = 'incoming_inspection_code'
            ) THEN
                ALTER TABLE apps_kuaizhizao_defect_records 
                ADD COLUMN incoming_inspection_code VARCHAR(50) NULL;
                COMMENT ON COLUMN apps_kuaizhizao_defect_records.incoming_inspection_code IS '来料检验单编码';
            END IF;
        END $$;
        
        -- 添加过程检验单关联字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_defect_records' 
                AND column_name = 'process_inspection_id'
            ) THEN
                ALTER TABLE apps_kuaizhizao_defect_records 
                ADD COLUMN process_inspection_id INTEGER NULL;
                COMMENT ON COLUMN apps_kuaizhizao_defect_records.process_inspection_id IS '过程检验单ID（关联ProcessInspection）';
            END IF;
        END $$;
        
        -- 添加过程检验单编码字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_defect_records' 
                AND column_name = 'process_inspection_code'
            ) THEN
                ALTER TABLE apps_kuaizhizao_defect_records 
                ADD COLUMN process_inspection_code VARCHAR(50) NULL;
                COMMENT ON COLUMN apps_kuaizhizao_defect_records.process_inspection_code IS '过程检验单编码';
            END IF;
        END $$;
        
        -- 添加成品检验单关联字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_defect_records' 
                AND column_name = 'finished_goods_inspection_id'
            ) THEN
                ALTER TABLE apps_kuaizhizao_defect_records 
                ADD COLUMN finished_goods_inspection_id INTEGER NULL;
                COMMENT ON COLUMN apps_kuaizhizao_defect_records.finished_goods_inspection_id IS '成品检验单ID（关联FinishedGoodsInspection）';
            END IF;
        END $$;
        
        -- 添加成品检验单编码字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_defect_records' 
                AND column_name = 'finished_goods_inspection_code'
            ) THEN
                ALTER TABLE apps_kuaizhizao_defect_records 
                ADD COLUMN finished_goods_inspection_code VARCHAR(50) NULL;
                COMMENT ON COLUMN apps_kuaizhizao_defect_records.finished_goods_inspection_code IS '成品检验单编码';
            END IF;
        END $$;
        
        -- 将work_order_id改为可选（如果当前是NOT NULL）
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_defect_records' 
                AND column_name = 'work_order_id'
                AND is_nullable = 'NO'
            ) THEN
                ALTER TABLE apps_kuaizhizao_defect_records 
                ALTER COLUMN work_order_id DROP NOT NULL;
            END IF;
        END $$;
        
        -- 将work_order_code改为可选（如果当前是NOT NULL）
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_defect_records' 
                AND column_name = 'work_order_code'
                AND is_nullable = 'NO'
            ) THEN
                ALTER TABLE apps_kuaizhizao_defect_records 
                ALTER COLUMN work_order_code DROP NOT NULL;
            END IF;
        END $$;
        
        -- 将operation_id改为可选（如果当前是NOT NULL）
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_defect_records' 
                AND column_name = 'operation_id'
                AND is_nullable = 'NO'
            ) THEN
                ALTER TABLE apps_kuaizhizao_defect_records 
                ALTER COLUMN operation_id DROP NOT NULL;
            END IF;
        END $$;
        
        -- 将operation_code改为可选（如果当前是NOT NULL）
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_defect_records' 
                AND column_name = 'operation_code'
                AND is_nullable = 'NO'
            ) THEN
                ALTER TABLE apps_kuaizhizao_defect_records 
                ALTER COLUMN operation_code DROP NOT NULL;
            END IF;
        END $$;
        
        -- 将operation_name改为可选（如果当前是NOT NULL）
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_defect_records' 
                AND column_name = 'operation_name'
                AND is_nullable = 'NO'
            ) THEN
                ALTER TABLE apps_kuaizhizao_defect_records 
                ALTER COLUMN operation_name DROP NOT NULL;
            END IF;
        END $$;
        
        -- 添加索引
        CREATE INDEX IF NOT EXISTS idx_defect_records_incoming_inspection_id 
        ON apps_kuaizhizao_defect_records(incoming_inspection_id);
        
        CREATE INDEX IF NOT EXISTS idx_defect_records_process_inspection_id 
        ON apps_kuaizhizao_defect_records(process_inspection_id);
        
        CREATE INDEX IF NOT EXISTS idx_defect_records_finished_goods_inspection_id 
        ON apps_kuaizhizao_defect_records(finished_goods_inspection_id);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除检验单关联字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS idx_defect_records_finished_goods_inspection_id;
        DROP INDEX IF EXISTS idx_defect_records_process_inspection_id;
        DROP INDEX IF EXISTS idx_defect_records_incoming_inspection_id;
        
        -- 删除字段
        ALTER TABLE apps_kuaizhizao_defect_records 
        DROP COLUMN IF EXISTS finished_goods_inspection_code;
        
        ALTER TABLE apps_kuaizhizao_defect_records 
        DROP COLUMN IF EXISTS finished_goods_inspection_id;
        
        ALTER TABLE apps_kuaizhizao_defect_records 
        DROP COLUMN IF EXISTS process_inspection_code;
        
        ALTER TABLE apps_kuaizhizao_defect_records 
        DROP COLUMN IF EXISTS process_inspection_id;
        
        ALTER TABLE apps_kuaizhizao_defect_records 
        DROP COLUMN IF EXISTS incoming_inspection_code;
        
        ALTER TABLE apps_kuaizhizao_defect_records 
        DROP COLUMN IF EXISTS incoming_inspection_id;
    """

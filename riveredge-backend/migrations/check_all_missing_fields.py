"""
检查所有缺失字段

一次性检查所有模型的缺失字段，并生成综合迁移文件。

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

# 模型字段定义（从模型文件中提取）
MODEL_FIELDS = {
    'apps_kuaizhizao_cost_calculations': {
        # BaseModel 字段
        'id': 'INTEGER',
        'uuid': 'VARCHAR',
        'tenant_id': 'INTEGER',
        'created_at': 'TIMESTAMP',
        'updated_at': 'TIMESTAMP',
        # 基本信息
        'calculation_no': 'VARCHAR(50)',
        'calculation_type': 'VARCHAR(50)',
        # 关联信息
        'work_order_id': 'INTEGER',
        'work_order_code': 'VARCHAR(50)',
        'product_id': 'INTEGER',
        'product_code': 'VARCHAR(50)',
        'product_name': 'VARCHAR(200)',
        # 数量
        'quantity': 'NUMERIC(12,2)',
        # 成本明细
        'material_cost': 'NUMERIC(12,2)',
        'labor_cost': 'NUMERIC(12,2)',
        'manufacturing_cost': 'NUMERIC(12,2)',
        'total_cost': 'NUMERIC(12,2)',
        'unit_cost': 'NUMERIC(12,2)',
        # 成本明细（JSON格式）
        'cost_details': 'JSONB',
        # 核算信息
        'calculation_date': 'DATE',
        'calculation_status': 'VARCHAR(50)',
        # 备注
        'remark': 'TEXT',
        # 软删除字段
        'deleted_at': 'TIMESTAMP',
    },
    'apps_kuaizhizao_cost_rules': {
        # BaseModel 字段
        'id': 'INTEGER',
        'uuid': 'VARCHAR',
        'tenant_id': 'INTEGER',
        'created_at': 'TIMESTAMP',
        'updated_at': 'TIMESTAMP',
        # 基本信息
        'code': 'VARCHAR(50)',
        'name': 'VARCHAR(200)',
        # 规则类型
        'rule_type': 'VARCHAR(50)',
        'cost_type': 'VARCHAR(50)',
        # 计算方法
        'calculation_method': 'VARCHAR(50)',
        'calculation_formula': 'JSONB',
        # 规则参数
        'rule_parameters': 'JSONB',
        # 状态信息
        'is_active': 'BOOLEAN',
        'description': 'TEXT',
        # 软删除字段
        'deleted_at': 'TIMESTAMP',
    },
}

# 字段映射（数据库字段名 -> 模型字段名）
FIELD_MAPPINGS = {
    'apps_kuaizhizao_cost_calculations': {
        'code': 'calculation_no',  # 数据库中的 code 对应模型中的 calculation_no
        'status': 'calculation_status',  # 数据库中的 status 对应模型中的 calculation_status
        'overhead_cost': 'manufacturing_cost',  # 数据库中的 overhead_cost 对应模型中的 manufacturing_cost
        'remarks': 'remark',  # 数据库中的 remarks 对应模型中的 remark
    },
}


async def check_all_tables():
    """检查所有表的缺失字段"""
    conn = await asyncpg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', '5432')),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )
    
    try:
        all_missing_fields = {}
        
        for table_name, model_fields in MODEL_FIELDS.items():
            print(f"\n{'='*80}")
            print(f"检查表: {table_name}")
            print(f"{'='*80}")
            
            # 获取现有字段
            cols = await conn.fetch(f"""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = '{table_name}' 
                ORDER BY column_name
            """)
            
            existing_cols = {c['column_name'] for c in cols}
            print(f"\n现有字段 ({len(existing_cols)} 个):")
            for c in sorted(cols):
                print(f"  {c['column_name']}: {c['data_type']} ({'NULL' if c['is_nullable'] == 'YES' else 'NOT NULL'})")
            
            # 检查缺失的字段
            missing_fields = {}
            field_mapping = FIELD_MAPPINGS.get(table_name, {})
            
            for model_field, field_type in model_fields.items():
                # 检查是否直接存在
                if model_field in existing_cols:
                    continue
                
                # 检查是否有映射字段
                mapped_field = None
                for db_field, model_field_name in field_mapping.items():
                    if model_field_name == model_field and db_field in existing_cols:
                        mapped_field = db_field
                        break
                
                if mapped_field:
                    print(f"\n⚠️  字段映射: {mapped_field} -> {model_field} (需要添加 {model_field} 字段)")
                    missing_fields[model_field] = {
                        'type': field_type,
                        'mapped_from': mapped_field,
                    }
                else:
                    print(f"\n❌ 缺失字段: {model_field} ({field_type})")
                    missing_fields[model_field] = {
                        'type': field_type,
                        'mapped_from': None,
                    }
            
            if missing_fields:
                all_missing_fields[table_name] = missing_fields
                print(f"\n📊 缺失字段统计: {len(missing_fields)} 个")
            else:
                print(f"\n✅ 所有字段都存在")
        
        return all_missing_fields
        
    finally:
        await conn.close()


async def main():
    """主函数"""
    print("="*80)
    print("检查所有表的缺失字段")
    print("="*80)
    
    missing_fields = await check_all_tables()
    
    if missing_fields:
        print("\n" + "="*80)
        print("缺失字段汇总")
        print("="*80)
        for table_name, fields in missing_fields.items():
            print(f"\n表: {table_name}")
            print(f"缺失字段数: {len(fields)}")
            for field_name, field_info in fields.items():
                if field_info['mapped_from']:
                    print(f"  - {field_name} ({field_info['type']}) [映射自: {field_info['mapped_from']}]")
                else:
                    print(f"  - {field_name} ({field_info['type']})")
    else:
        print("\n✅ 所有表的字段都完整！")


if __name__ == '__main__':
    asyncio.run(main())

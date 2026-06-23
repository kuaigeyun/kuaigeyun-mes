"""BOM 关联导入契约的基础单元测试。"""

import asyncio
import unittest

from pydantic_core import ValidationError

from apps.master_data.schemas.material_schemas import BOMRelationImportRequest
from apps.master_data.services.material_service import MaterialService


class TestBOMRelationImportContract(unittest.TestCase):
    def test_relation_request_entities_are_deduplicated(self):
        payload = BOMRelationImportRequest(
            rows=[["*父件编号", "*子件编号", "*子件数量"], ["示例", "示例", "1"], ["A", "B", "2"]],
            entities=["material", "material", "operation"],
            write_strategy="upsert",
            dry_run=True,
        )
        self.assertEqual(payload.entities, ["material", "operation"])

    def test_relation_request_rejects_empty_entities(self):
        with self.assertRaises(ValidationError):
            BOMRelationImportRequest(
                rows=[["*父件编号", "*子件编号", "*子件数量"], ["示例", "示例", "1"], ["A", "B", "2"]],
                entities=[],
                write_strategy="upsert",
                dry_run=True,
            )

    def test_relation_import_requires_bom_base_headers_before_db_access(self):
        req = BOMRelationImportRequest(
            rows=[["子件编号", "子件数量"], ["示例", "1"], ["B", "2"]],
            entities=["material"],
            write_strategy="upsert",
            dry_run=True,
        )
        result = asyncio.run(MaterialService._relation_import_bom_v2(tenant_id=1, data=req))
        self.assertFalse(result.success)
        self.assertTrue(any("缺少必需表头" in err for err in result.errors))

    def test_relation_import_requires_entity_headers_before_db_access(self):
        req = BOMRelationImportRequest(
            rows=[["*父件编号", "*子件编号", "*子件数量"], ["示例", "示例", "1"], ["A", "B", "2"]],
            entities=["processRoute"],
            write_strategy="upsert",
            dry_run=True,
        )
        result = asyncio.run(MaterialService._relation_import_bom_v2(tenant_id=1, data=req))
        self.assertFalse(result.success)
        self.assertTrue(any("processRoute" in err for err in result.errors))


if __name__ == "__main__":
    unittest.main()

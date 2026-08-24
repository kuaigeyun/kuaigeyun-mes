"""编码批量生成辅助测试。"""

import pytest

from core.services.business.code_generation_service import CodeGenerationService


@pytest.mark.asyncio
async def test_generate_code_batch_empty_returns_empty_list():
    assert await CodeGenerationService.generate_code_batch(1, "SETTLEMENT_CODE", 0) == []

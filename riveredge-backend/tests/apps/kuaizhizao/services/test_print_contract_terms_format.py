from apps.kuaizhizao.services.print_service import _format_sales_contract_terms_for_print


def test_format_sales_contract_terms_uses_chinese_index():
    text = _format_sales_contract_terms_for_print(
        [
            {"term_name": "付款方式", "content": "1. 付款方式：转账"},
            {"term_name": "交货期限", "content": "1. 收到预付款后35个工作日"},
        ]
    )
    assert text.startswith("一、付款方式")
    assert "二、交货期限" in text


def test_format_sales_contract_terms_empty():
    assert _format_sales_contract_terms_for_print(None) == ""
    assert _format_sales_contract_terms_for_print([]) == ""

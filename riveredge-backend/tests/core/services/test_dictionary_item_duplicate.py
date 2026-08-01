from core.services.data.data_dictionary_service import dictionary_item_duplicate_message


def test_duplicate_message_by_value():
    assert (
        dictionary_item_duplicate_message(
            candidate_value="VIP",
            candidate_label="新客户",
            existing_value="VIP",
            existing_label="重要客户",
        )
        == "字典项值 VIP 已存在"
    )


def test_duplicate_message_by_label():
    assert (
        dictionary_item_duplicate_message(
            candidate_value="vip-2",
            candidate_label="重要客户",
            existing_value="vip-1",
            existing_label="重要客户",
        )
        == "字典项标签 重要客户 已存在"
    )


def test_no_duplicate_message():
    assert (
        dictionary_item_duplicate_message(
            candidate_value="vip-2",
            candidate_label="普通客户",
            existing_value="vip-1",
            existing_label="重要客户",
        )
        is None
    )

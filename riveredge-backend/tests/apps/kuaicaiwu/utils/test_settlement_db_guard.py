from apps.kuaicaiwu.utils.settlement_db_guard import is_settlements_table_missing


def test_is_settlements_table_missing_positive():
    exc = Exception('relation "apps_kuaicaiwu_settlements" does not exist')
    assert is_settlements_table_missing(exc) is True


def test_is_settlements_table_missing_negative():
    assert is_settlements_table_missing(Exception("duplicate key value")) is False
    assert is_settlements_table_missing(Exception("apps_kuaicaiwu_settlements unique violation")) is False

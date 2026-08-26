import importlib.util
from pathlib import Path
import unittest

_SRC = Path(__file__).resolve().parents[4] / "src"
_MODULE_PATH = _SRC / "core/services/data/data_dictionary_service.py"
_spec = importlib.util.spec_from_file_location("data_dictionary_service_mod", _MODULE_PATH)
assert _spec and _spec.loader
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

DataDictionaryService = _mod.DataDictionaryService


class TestDataDictionaryLabel(unittest.TestCase):
    def test_system_dictionary_label_map_payment_terms(self):
        label_map = DataDictionaryService.system_dictionary_label_map("PAYMENT_TERMS")
        self.assertEqual(label_map.get("NET30"), "月结30天")

    def test_system_dictionary_label_map_shipping_method(self):
        label_map = DataDictionaryService.system_dictionary_label_map("SHIPPING_METHOD")
        self.assertEqual(label_map.get("LOGISTICS"), "物流")


if __name__ == "__main__":
    unittest.main()

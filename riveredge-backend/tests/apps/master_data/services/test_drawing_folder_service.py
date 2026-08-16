"""图纸仓库文件夹：后代收集。"""

import unittest

from apps.master_data.services.drawing_folder_service import collect_descendant_ids


class TestDrawingFolderHelpers(unittest.TestCase):
    def test_collect_descendant_ids_includes_self_and_children(self):
        parent_of = {
            1: None,
            2: 1,
            3: 1,
            4: 2,
            5: None,
        }
        self.assertEqual(sorted(collect_descendant_ids(1, parent_of)), [1, 2, 3, 4])
        self.assertEqual(sorted(collect_descendant_ids(2, parent_of)), [2, 4])
        self.assertEqual(collect_descendant_ids(5, parent_of), [5])

    def test_collect_descendant_ids_breaks_cycle(self):
        parent_of = {1: 2, 2: 1}
        result = collect_descendant_ids(1, parent_of)
        self.assertEqual(sorted(result), [1, 2])

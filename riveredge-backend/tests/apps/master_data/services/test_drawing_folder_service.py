"""图纸仓库文件夹：后代收集与数量汇总。"""

import unittest

from apps.master_data.schemas.drawing_folder_schemas import DrawingFolderResponse
from apps.master_data.services.drawing_folder_service import (
    DrawingFolderService,
    collect_descendant_ids,
)


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

    def test_apply_drawing_counts_includes_descendants(self):
        child = DrawingFolderResponse(
            id=2,
            uuid="child",
            tenant_id=1,
            name="child",
            parent_id=1,
            sort_order=0,
            is_active=True,
            created_at="2026-01-01T00:00:00+00:00",
            updated_at="2026-01-01T00:00:00+00:00",
        )
        root = DrawingFolderResponse(
            id=1,
            uuid="root",
            tenant_id=1,
            name="root",
            parent_id=None,
            sort_order=0,
            is_active=True,
            created_at="2026-01-01T00:00:00+00:00",
            updated_at="2026-01-01T00:00:00+00:00",
            children=[child],
        )
        parent_of = {1: None, 2: 1}
        direct_counts = {1: 2, 2: 3, None: 1}
        DrawingFolderService._apply_drawing_counts([root], parent_of, direct_counts)
        self.assertEqual(root.drawing_count, 5)
        self.assertEqual(child.drawing_count, 3)

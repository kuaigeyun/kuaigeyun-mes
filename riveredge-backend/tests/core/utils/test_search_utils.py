"""search_utils.apply_keyword_icontains 契约。"""

from tortoise.expressions import Q

from core.utils.search_utils import apply_keyword_icontains


class _Query:
    def __init__(self):
        self.filtered = None

    def filter(self, cond):
        self.filtered = cond
        return self


def test_apply_keyword_icontains_skips_blank():
    query = _Query()
    assert apply_keyword_icontains(query, "  ", ["name", "code"]) is query
    assert query.filtered is None


def test_apply_keyword_icontains_or_fields():
    query = _Query()
    result = apply_keyword_icontains(query, "模具", ["name", "code"])
    assert result is query
    assert isinstance(query.filtered, Q)

    def collect_filters(node: Q) -> dict:
        merged = dict(node.filters or {})
        for child in node.children:
            if isinstance(child, Q):
                merged.update(collect_filters(child))
        return merged

    filters = collect_filters(query.filtered)
    assert filters.get("name__icontains") == "模具"
    assert filters.get("code__icontains") == "模具"

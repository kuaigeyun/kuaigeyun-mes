"""official_provenance 常量与 remote 规范化测试。"""

from infra.constants.official_provenance import (
    is_official_git_remote,
    normalize_git_remote,
    official_repo_urls,
)


def test_normalize_git_remote_strips_git_suffix():
    assert normalize_git_remote("https://Gitee.com/kuaigeyun/kuaigeyun.git") == (
        "https://gitee.com/kuaigeyun/kuaigeyun"
    )


def test_normalize_git_remote_ssh_form():
    assert normalize_git_remote("git@gitee.com:kuaigeyun/kuaigeyun.git") == (
        "https://gitee.com/kuaigeyun/kuaigeyun"
    )


def test_is_official_git_remote_accepts_gitee_and_github():
    assert is_official_git_remote("https://gitee.com/kuaigeyun/kuaigeyun")
    assert is_official_git_remote("git@github.com:kuaigeyun/kuaigeyun-mes.git")
    assert is_official_git_remote("git@github.com:kuaigeyun/kuaigeyun.git")


def test_is_official_git_remote_rejects_fork():
    assert not is_official_git_remote("https://gitee.com/someone/kuaigeyun-fork")


def test_official_repo_urls_contains_both_hosts():
    urls = official_repo_urls()
    assert any("gitee.com" in u for u in urls)
    assert any("github.com" in u for u in urls)

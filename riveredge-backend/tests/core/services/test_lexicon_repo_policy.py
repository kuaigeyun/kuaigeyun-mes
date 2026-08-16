"""确认敏感词词库不会被 Git 跟踪。"""

import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
LEXICON_REL = "riveredge-backend/src/core/data/sensitive_words"
FORBIDDEN_TRACKED = (
    f"{LEXICON_REL}/insult.txt",
    f"{LEXICON_REL}/porn.txt",
    f"{LEXICON_REL}/porn_types.txt",
    f"{LEXICON_REL}/extra.txt",
    f"{LEXICON_REL}/lexicon.pack",
)
ALLOWED_TRACKED_SUFFIXES = ("NOTICE.md", "allowlist.txt", "LICENSE.")


def _git(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


def test_lexicon_pack_and_plain_sources_are_gitignored():
    for rel_path in FORBIDDEN_TRACKED:
        ignored = _git("check-ignore", "-q", rel_path)
        assert ignored.returncode == 0, f"应被 .gitignore 忽略: {rel_path}"


def test_lexicon_pack_is_not_tracked():
    listed = _git("ls-files", LEXICON_REL)
    tracked = [line.strip() for line in listed.stdout.splitlines() if line.strip()]
    forbidden = [path for path in tracked if any(path.endswith(name) for name in (
        "insult.txt", "porn.txt", "porn_types.txt", "extra.txt", "lexicon.pack",
    ))]
    assert forbidden == [], f"敏感词文件已被 Git 跟踪: {forbidden}"


def test_only_metadata_may_be_tracked_under_lexicon_dir():
    listed = _git("ls-files", LEXICON_REL)
    tracked = [line.strip() for line in listed.stdout.splitlines() if line.strip()]
    for path in tracked:
        assert any(marker in path for marker in ALLOWED_TRACKED_SUFFIXES), (
            f"敏感词目录只允许提交说明/白名单/许可: {path}"
        )

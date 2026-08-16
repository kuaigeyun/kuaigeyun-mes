"""lexicon.pack 封装往返。"""

from core.services.content.lexicon_pack import pack_words, unpack_words


def test_pack_roundtrip_without_plaintext():
    sample = ["alpha", "beta"]
    blob = pack_words(sample)
    assert b"alpha" not in blob
    assert unpack_words(blob) == sample

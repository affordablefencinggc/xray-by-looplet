"""Unit tests for grammar.py — token -> typed-entity classification."""

from xray.grammar import classify, normalize_tag, parse_spec_token


class W:
    """Word-like token (reassemble.Word duck-type)."""

    def __init__(self, text, x0, y0, x1, y1, page=0, source="text"):
        self.text = text
        self.x0, self.y0, self.x1, self.y1 = x0, y0, x1, y1
        self.page = page
        self.source = source


def by_type(entities, type):
    return [e for e in entities if e.type == type]


# ---------------------------------------------------------- normalize_tag

def test_tag_confusables_normalized():
    assert normalize_tag("W0l") == "W01"      # l -> 1 inside the numeric tail
    assert normalize_tag("WO2") == "W02"      # O -> 0
    assert normalize_tag("D3a") == "D3A"      # suffix uppercased


def test_tag_hyphen_and_prefix_variants():
    assert normalize_tag("WT-2") == "WT2"
    assert normalize_tag("RWH1") == "RWH1"
    assert normalize_tag("PF10B") == "PF10B"


def test_pure_words_never_become_tags():
    assert normalize_tag("DOOR") is None       # no digit in tail
    assert normalize_tag("W") is None
    assert normalize_tag("Do") is None
    assert normalize_tag("4500") is None       # DIM, not a tag


# -------------------------------------------------------- parse_spec_token

def test_spec_token_full_parse():
    spec = parse_spec_token("16Lx9Wx4.2H|10°|4bays")
    assert spec == {"L": 16.0, "W": 9.0, "eave": 4.2, "pitch": 10.0, "bays": 4}


def test_spec_token_degree_confusables_and_embedding():
    for tok in ("Shed.16Lx9Wx4.2H|10º|4bays", "x16Lx9Wx4.2H|10o|4bays"):
        assert parse_spec_token(tok) == {
            "L": 16.0, "W": 9.0, "eave": 4.2, "pitch": 10.0, "bays": 4}


def test_spec_token_non_match():
    assert parse_spec_token("16Lx9W") is None
    assert parse_spec_token("no dims here") is None


# ---------------------------------------------------------------- classify

def test_classify_dim_basic_and_commas():
    ents = classify([W("4500", 10, 10, 40, 20),
                     W("5,400", 100, 10, 140, 20)], (1000.0, 700.0))
    dims = by_type(ents, "DIM")
    assert [d.value for d in dims] == [4500, 5400]
    assert dims[0].id == "e0-0" and dims[1].id == "e0-1"
    assert dims[0].confidence == 1.0 and dims[0].source == "text"


def test_classify_rejects_implausible_dims():
    ents = classify([W("39", 10, 10, 25, 20),          # below DIM_MIN
                     W("123456", 50, 10, 100, 20)],     # above DIM_MAX
                    (1000.0, 700.0))
    assert by_type(ents, "DIM") == []
    assert ents == []
def test_classify_tag_with_confusable_fix():
    ents = classify([W("W0l", 10, 10, 30, 20)], (1000.0, 700.0))
    tags = by_type(ents, "TAG")
    assert len(tags) == 1
    assert tags[0].value == "W01"
    assert tags[0].raw == "W0l"


def test_classify_std_two_token_pair():
    ents = classify([W("AS", 10, 100, 30, 110),
                     W("1684.2", 32, 100, 80, 110)], (1000.0, 700.0))
    stds = by_type(ents, "STD")
    assert len(stds) == 1
    assert stds[0].value == "AS 1684.2"
    assert stds[0].raw == "AS 1684.2"
    assert stds[0].bbox == (10.0, 100.0, 80.0, 110.0)


def test_classify_std_single_token():
    ents = classify([W("AS/NZS4600", 10, 100, 90, 110)], (1000.0, 700.0))
    stds = by_type(ents, "STD")
    assert len(stds) == 1
    assert stds[0].value == "AS/NZS4600"


def test_classify_level_single_and_pair():
    ents = classify([W("RL12.500", 10, 10, 70, 20)], (1000.0, 700.0))
    levels = by_type(ents, "LEVEL")
    assert len(levels) == 1
    assert levels[0].value == {"kind": "RL", "value": 12.5}

    ents2 = classify([W("FFL", 10, 10, 34, 20),
                      W("6.500", 36, 10, 75, 20)], (1000.0, 700.0))
    levels2 = by_type(ents2, "LEVEL")
    assert len(levels2) == 1
    assert levels2[0].value == {"kind": "FFL", "value": 6.5}
    assert levels2[0].raw == "FFL 6.500"


def test_classify_notekey():
    ents = classify([W("CH.", 10, 10, 30, 20),
                     W("MIN", 100, 10, 130, 20)], (1000.0, 700.0))
    keys = by_type(ents, "NOTEKEY")
    assert [k.value for k in keys] == ["CH", "MIN"]


def test_classify_spec_entity():
    ents = classify([W("Shed.16Lx9Wx4.2H|10°|4bays", 10, 10, 200, 20)],
                    (1000.0, 700.0))
    specs = by_type(ents, "SPEC")
    assert len(specs) == 1
    assert specs[0].value == {"L": 16.0, "W": 9.0, "eave": 4.2,
                              "pitch": 10.0, "bays": 4}


def test_classify_label_groups_multiword_baselines():
    ents = classify([W("PORTAL", 100, 10, 160, 20),
                     W("RAFTER", 165, 10, 230, 20),
                     W("OVER", 235, 10, 280, 20)], (1000.0, 700.0))
    labels = by_type(ents, "LABEL")
    assert len(labels) == 1
    assert labels[0].value == "PORTAL RAFTER OVER"
    assert labels[0].bbox == (100.0, 10.0, 280.0, 20.0)


def test_classify_single_caps_word_is_not_a_label():
    ents = classify([W("DECK", 10, 10, 50, 20)], (1000.0, 700.0))
    assert by_type(ents, "LABEL") == []


def test_classify_separate_baselines_are_separate_labels():
    ents = classify([W("NORTH", 100, 10, 160, 20),
                     W("WALL", 165, 10, 220, 20),
                     W("SOUTH", 100, 200, 160, 210),
                     W("WALL", 165, 200, 220, 210)], (1000.0, 700.0))
    labels = by_type(ents, "LABEL")
    assert sorted(l.value for l in labels) == ["NORTH WALL", "SOUTH WALL"]


def test_classify_document_order_ids_and_reassembled_confidence():
    ents = classify([W("4500", 10, 10, 40, 20, page=0, source="text"),
                     W("W0l", 100, 10, 120, 20, page=0, source="reassembled"),
                     W("1:200", 200, 10, 235, 20, page=0, source="text")],
                    (1000.0, 700.0))
    assert [e.id for e in ents] == ["e0-0", "e0-1", "e0-2"]
    assert [e.type for e in ents] == ["DIM", "TAG", "SCALE"]
    assert ents[1].confidence == 0.9 and ents[1].source == "reassembled"
    assert ents[0].confidence == 1.0 and ents[0].source == "text"


def test_classify_accepts_raw_fitz_word_tuples():
    ents = classify([(100.0, 200.0, 140.0, 210.0, "1:100", 1, 2, 3)],
                    (1000.0, 700.0))
    scales = by_type(ents, "SCALE")
    assert len(scales) == 1
    assert scales[0].value == "1:100"
    assert scales[0].page == 0 and scales[0].source == "text"


def test_classify_skips_empty_words():
    ents = classify([W("", 0, 0, 1, 1), W("   ", 0, 0, 1, 1),
                     W("4500", 10, 10, 40, 20)], (1000.0, 700.0))
    assert len(ents) == 1 and ents[0].type == "DIM"


def test_classify_scale():
    ents = classify([W("1:200", 10, 10, 45, 20)], (1000.0, 700.0))
    scales = by_type(ents, "SCALE")
    assert len(scales) == 1
    assert scales[0].value == "1:200"
    assert scales[0].bbox == (10.0, 10.0, 45.0, 20.0)
def test_classify_does_not_mutate_input_words():
    words = [W("4500", 10, 10, 40, 20), W("W0l", 100, 10, 120, 20)]
    classify(words, (1000.0, 700.0))
    assert words[0].text == "4500" and words[1].text == "W0l"
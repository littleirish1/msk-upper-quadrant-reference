from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

import source_intake_engine as engine
from source_intake_policy import normalize_archive_member, sanitize_tracked_line, scan_sensitive


def make_zip(files: dict[str, bytes], compression=zipfile.ZIP_DEFLATED) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression) as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    return output.getvalue()


class PrivacyPolicyTests(unittest.TestCase):
    def assert_category(self, category: str, value: str):
        self.assertIn(category, {finding.category for finding in scan_sensitive(value, ["Governed Fixture Name"])})

    def test_fictional_sensitive_categories(self):
        self.assert_category("email-address", "learner" + "@example.test")
        self.assert_category("telephone-number", " ".join(["07123", "456", "789"]))
        self.assert_category("telephone-number", " ".join(["+44", "7123", "456", "789"]))
        self.assert_category("uk-postcode", " ".join(["AB1", "2CD"]))
        self.assert_category("date-of-birth", "".join(["DOB: 01/02/", "1990"]))
        self.assert_category("date-of-birth", " ".join(["born", "1", "January", "1990"]))
        self.assert_category("student-or-candidate-identifier", " ".join(["student", "id:", "ZZ12345"]))
        self.assert_category("governed-sensitive-name", "Governed Fixture Name")
        self.assert_category("contact-or-correspondence-block", "Presented by Dr Fiction Person, email learner" + "@example.test")

    def test_safe_archive_path_and_unicode_rejections(self):
        self.assertEqual(normalize_archive_member("folder/file.txt", 100), ("folder/file.txt", None))
        self.assertIsNotNone(normalize_archive_member("../file.txt", 100)[1])
        self.assertIsNotNone(normalize_archive_member("folder/\u202efile.txt", 100)[1])


class IdentityTests(unittest.TestCase):
    def test_full_digest_groups_exact_bytes(self):
        items = [engine.Occurrence("a", "a.txt", b"same"), engine.Occurrence("b", "b.txt", b"same"), engine.Occurrence("c", "c.txt", b"different")]
        groups = engine.group_occurrences(items)
        self.assertEqual(sorted(map(len, groups.values())), [1, 2])

    def test_prefix_collision_fails(self):
        def fake(value: bytes) -> str:
            return "a" * 12 + ("b" * 52 if value == b"one" else "c" * 52)
        with self.assertRaisesRegex(ValueError, "prefix collision"):
            engine.group_occurrences([engine.Occurrence("a", "a", b"one"), engine.Occurrence("b", "b", b"two")], fake)


class CredentialDecisionTests(unittest.TestCase):
    def setUp(self):
        self.value = "".join(["AK", "IA", "FICT", "URE0", "1234", "5678"])
        self.data = ("fixture " + self.value).encode()
        self.full = engine.digest(self.data)
        self.checksum = f"sha256:{self.full}"
        self.source_id = engine.display_id(self.full)
        self.entry = {"checksum": self.checksum, "sourceId": self.source_id, "detectorRuleId": "aws-access-key-shaped", "matchCount": 1, "decision": "false-positive-confirmed", "decisionScope": "credential-stop-override-for-exact-checksum-only"}

    def test_genuine_shape_still_stops_without_decision(self):
        self.assertTrue(engine.credential_stop_required(self.checksum, self.source_id, self.data.decode(), {})[0])

    def test_exact_decision_allows_only_exact_source(self):
        decisions = {(self.checksum, "aws-access-key-shaped"): self.entry}
        self.assertFalse(engine.credential_stop_required(self.checksum, self.source_id, self.data.decode(), decisions)[0])
        changed = b"x " + self.data; changed_full = engine.digest(changed)
        self.assertTrue(engine.credential_stop_required(f"sha256:{changed_full}", engine.display_id(changed_full), changed.decode(), decisions)[0])
        self.assertTrue(engine.credential_stop_required(self.checksum, "src-bbbbbbbbbbbb", self.data.decode(), decisions)[0])

    def test_value_is_still_suppressed_from_tracked_output(self):
        safe, findings = sanitize_tracked_line(self.data.decode(), [])
        self.assertIsNone(safe)
        self.assertTrue(any(item["category"] == "credential-value" for item in findings))


class ArchiveTests(unittest.TestCase):
    def test_safe_and_bad_members_continue(self):
        data = make_zip({"good.txt": b"good", "../bad.txt": b"bad", "also-good.txt": b"also"})
        items, warnings = engine.safe_archive_occurrences(data, "src-aaaaaaaaaaaa")
        self.assertEqual(len(items), 2)
        self.assertTrue(any(item["warningCode"] == "path-traversal" for item in warnings))

    def test_member_count_limit(self):
        data = make_zip({f"{index}.txt": b"x" for index in range(engine.LIMITS["maximumMemberCount"] + 1)}, zipfile.ZIP_STORED)
        items, warnings = engine.safe_archive_occurrences(data, "src-aaaaaaaaaaaa")
        self.assertFalse(items)
        self.assertEqual(warnings[0]["warningCode"], "member-count-limit")

    def test_high_ratio_and_size_limits(self):
        high = make_zip({"large.txt": b"0" * 20000})
        with mock.patch.dict(engine.LIMITS, {"maximumCompressionRatio": 2}):
            self.assertFalse(engine.safe_archive_occurrences(high, "src-aaaaaaaaaaaa")[0])
        with mock.patch.dict(engine.LIMITS, {"maximumExpandedMemberBytes": 10}):
            self.assertFalse(engine.safe_archive_occurrences(make_zip({"large.txt": b"x" * 11}, zipfile.ZIP_STORED), "src-aaaaaaaaaaaa")[0])

    def test_corrupt_member_does_not_hide_other_members(self):
        data = bytearray(make_zip({"bad.txt": b"BAD-CONTENT", "good.txt": b"GOOD-CONTENT"}, zipfile.ZIP_STORED))
        position = data.find(b"BAD-CONTENT")
        data[position] ^= 1
        items, warnings = engine.safe_archive_occurrences(bytes(data), "src-aaaaaaaaaaaa")
        self.assertEqual(len(items), 1)
        self.assertTrue(any(item["warningCode"] == "member-read-failed" for item in warnings))

    def test_encrypted_member_is_rejected(self):
        data = bytearray(make_zip({"secret.txt": b"fixture"}, zipfile.ZIP_STORED))
        local = data.find(b"PK\x03\x04"); central = data.find(b"PK\x01\x02")
        data[local + 6] |= 1; data[central + 8] |= 1
        items, warnings = engine.safe_archive_occurrences(bytes(data), "src-aaaaaaaaaaaa")
        self.assertFalse(items)
        self.assertTrue(any(item["warningCode"] == "encrypted-member" for item in warnings))


class OfficeProvenanceTests(unittest.TestCase):
    def test_pptx_uses_relationships_for_non_contiguous_parts(self):
        ns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
        files = {
            "ppt/presentation.xml": f'<p:presentation xmlns:p="p" xmlns:r="{ns}"><p:sldIdLst><p:sldId r:id="rIdA"/><p:sldId r:id="rIdB"/></p:sldIdLst></p:presentation>'.encode(),
            "ppt/_rels/presentation.xml.rels": b'<Relationships><Relationship Id="rIdA" Target="slides/slide9.xml"/><Relationship Id="rIdB" Target="slides/slide2.xml"/></Relationships>',
            "ppt/slides/slide9.xml": b'<p:sld xmlns:p="p"><p:p><p:r><p:t>First slide</p:t></p:r></p:p></p:sld>',
            "ppt/slides/slide2.xml": b'<p:sld xmlns:p="p"><p:p><p:r><p:t>Second slide</p:t></p:r></p:p></p:sld>',
            "ppt/slides/_rels/slide9.xml.rels": b'<Relationships><Relationship Id="n" Type="x/notesSlide" Target="../notesSlides/notesSlide4.xml"/><Relationship Id="l" Type="x/hyperlink" TargetMode="External" Target="https://example.test/first"/></Relationships>',
            "ppt/slides/_rels/slide2.xml.rels": b'<Relationships><Relationship Id="n" Type="x/notesSlide" Target="../notesSlides/notesSlide7.xml"/></Relationships>',
            "ppt/notesSlides/notesSlide4.xml": b'<p:notes xmlns:p="p"><p:p><p:r><p:t>First note</p:t></p:r></p:p></p:notes>',
            "ppt/notesSlides/notesSlide7.xml": b'<p:notes xmlns:p="p"><p:p><p:r><p:t>Second note</p:t></p:r></p:p></p:notes>',
        }
        units, _ = engine.extract_pptx(make_zip(files))
        self.assertEqual([unit["part"] for unit in units], ["ppt/slides/slide9.xml", "ppt/slides/slide2.xml"])
        self.assertIn("First note", units[0]["notes"])
        self.assertEqual(units[0]["links"], ["https://example.test/first"])
        self.assertIn("Second note", units[1]["notes"])

    def test_xlsx_preserves_shared_string_positions_and_cell_types(self):
        ns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
        files = {
            "xl/workbook.xml": f'<workbook xmlns:r="{ns}"><sheets><sheet name="One" r:id="r1"/><sheet name="Two" r:id="r2"/></sheets></workbook>'.encode(),
            "xl/_rels/workbook.xml.rels": b'<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Target="worksheets/sheet2.xml"/></Relationships>',
            "xl/sharedStrings.xml": b'<sst><si><t></t></si><si><t>Alpha</t></si><si><t xml:space="preserve">  </t></si><si><r><t>Rich</t></r><r><t>&amp;Text</t></r></si><si><t>Omega</t></si></sst>',
            "xl/worksheets/sheet1.xml": b'<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row></sheetData></worksheet>',
            "xl/worksheets/sheet2.xml": b'<worksheet><sheetData><row><c r="A1" t="s"><v>3</v></c><c r="B1" t="s"><v>4</v></c><c r="C1" t="inlineStr"><is><r><t>Inline</t></r><r><t>Text</t></r></is></c><c r="D1" t="s"><v>99</v></c></row></sheetData></worksheet>',
        }
        units, metadata = engine.extract_xlsx(make_zip(files))
        self.assertEqual(units[0]["text"], "A1= | B1=Alpha | C1=  ")
        self.assertEqual(units[1]["text"], "A1=Rich&Text | B1=Omega | C1=InlineText")
        self.assertEqual(metadata["warnings"], {"shared-string-index-invalid": 1})


class CitationTests(unittest.TestCase):
    def make_source(self):
        return {"sourceId": "src-aaaaaaaaaaaa", "checksum": "sha256:" + "a" * 64, "topicTags": ["rcrsp"], "regionTags": ["shoulder"]}

    def test_classifications_and_excerpt_limit(self):
        text = "References\nFiction et al. (2020). A structured title. Journal 2(1): 1-9. doi:10.1234/fixture.1\nFiction (2020) mentioned this in prose.\nhttps://example.test/licence\nhttps://example.test/video"
        units = [{"number": 1, "kind": "slide", "text": text, "links": ["https://example.test/licence", "https://example.test/video"]}]
        refs, _ = engine.reference_candidates(self.make_source(), units, [])
        self.assertTrue(any(item["classification"] == "full-looking-unverified" for item in refs))
        self.assertTrue(all(len(item["citationText"]) <= 280 for item in refs))

    def test_contact_candidate_is_suppressed(self):
        units = [{"number": 1, "kind": "slide", "text": "Contact: learner" + "@example.test", "links": []}]
        refs, suppressed = engine.reference_candidates(self.make_source(), units, [])
        self.assertFalse(refs); self.assertGreater(suppressed, 0)


class AtomicOutputTests(unittest.TestCase):
    def test_failed_replace_restores_previous_output(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root); destination = root / "reports"; staging = root / "staging"
            destination.mkdir(); staging.mkdir(); (destination / "old.txt").write_text("old"); (staging / "new.txt").write_text("new")
            real_replace = os.replace; calls = 0
            def flaky(source, target):
                nonlocal calls; calls += 1
                if calls == 2: raise OSError("fixture interruption")
                return real_replace(source, target)
            with mock.patch.object(engine.os, "replace", flaky), self.assertRaises(OSError): engine._atomic_publish(staging, destination)
            self.assertEqual((destination / "old.txt").read_text(), "old")


if __name__ == "__main__":
    unittest.main()

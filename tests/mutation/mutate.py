"""Mutation check: break each safety floor of contracts/icarus.py and prove
the direct suite fails, then prove the unbroken contract passes.

Run from the repo root:  python tests/mutation/mutate.py
Exit status 0 only if every mutant is killed and the control passes. The
sweep works on a temporary copy of contracts/ and tests/, so the repository's
own files are never touched. A floor guarded in two places is broken in both
at once (a list of replacements), or one of the two mutants is equivalent and
would report a false pin.
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile

REPO = pathlib.Path(__file__).resolve().parents[2]
TEXT = (REPO / "contracts" / "icarus.py").read_text(encoding="utf-8")

MUTATIONS = [
    # ── grounding: the floor and its mirror, which are the product ──────────
    ("a line is installed on paperwork alone",
     '        if status == "INSTALLED" and not saw_image:', "        if False:"),
    ("an adverse finding needs no observation",
     '        elif status in ("ABSENT", "CONTRADICTED") and not (saw_image or saw_inspector):',
     "        elif False:"),
    ("a criterion is met on paperwork alone",
     '        if status in ("MET", "NOT_MET") and not (saw_image or saw_inspector):',
     "        if False:"),
    ("a party's own document counts as an observation",
     '            any(kind_of[e] == "DOCUMENT" and role_of[e] == "INSPECTOR" for e in seen))',
     '            any(kind_of[e] == "DOCUMENT" for e in seen))'),
    ("grounding reads a basis the round never held",
     "    seen = [e for e in cited if e in kind_of]", "    seen = list(cited)"),

    # ── derivation: doubt and conflict never pay ────────────────────────────
    ("conflicts no longer undetermine",
     '    if conflicts:\n        return "UNDETERMINED"',
     '    if False:\n        return "UNDETERMINED"'),
    ("a line the evidence shows absent no longer rejects",
     '    if any(v == "ABSENT" for v in line_values) or any(v == "NOT_MET" for v in crit_values):',
     "    if False:"),
    ("doubt pays",
     '    if any(v != "INSTALLED" for v in line_values) or any(v != "MET" for v in crit_values):',
     "    if False:"),
    # ("an empty judgment accepts") is left out on purpose: _validate_terms
    # refuses terms with neither a schedule nor criteria, so that guard is
    # unreachable and its mutant would be equivalent, a pin holding nothing.
    ("the receipt calls insufficient evidence sufficient",
     '    if any(v in ("UNIDENTIFIED", "NOT_SHOWN") for v in lines.values()) \\',
     "    if False and any(True for v in lines.values()) \\"),

    # ── consensus: what a validator must reproduce ──────────────────────────
    ("an acceptance stands without the validator's own acceptance",
     '    if leader_decision == "ACCEPTED" and my_decision != "ACCEPTED":', "    if False:"),
    ("a rejection stands on a line the validator does not reproduce",
     '            if tl[lid] == "ABSENT" and ml[lid] != "ABSENT":', "            if False:"),
    ("a rejection stands on a criterion the validator does not reproduce",
     '            if tc[cid] == "NOT_MET" and mc[cid] != "NOT_MET":', "            if False:"),
    ("a rejection ignores a conflict the validator sees",
     "        if mine_conflicts:\n            return \"this node sees a conflict",
     "        if False:\n            return \"this node sees a conflict"),
    ("a leader withholds an acceptance a validator would grant",
     '    if leader_decision == "UNDETERMINED" and my_decision == "ACCEPTED":', "    if False:"),
    ("a conflict the leader alone reports is recorded",
     "    if theirs_conflicts and not mine_conflicts:", "    if False:"),
    ("a leader that does not rate every line stands",
     "    if any(v not in LINE_STATUSES for v in tl.values()):", "    if False:"),
    ("a leader that does not rate every criterion stands",
     "    if any(v not in CRITERION_STATUSES for v in tc.values()):", "    if False:"),
    ("the record overstates what was decisive",
     '        return {"lines": [k for k, v in lines.items() if v == "ABSENT"],\n'
     '                "criteria": [k for k, v in criteria.items() if v == "NOT_MET"]}',
     '        return {"lines": list(lines), "criteria": list(criteria)}'),
    ("a blind leader is agreed with",
     '            if not theirs.get("images_received"):', "            if False:"),
    ("a blind validator agrees anyway",
     '            if not mine["images_received"]:', "            if False:"),
    ("a failed leader is agreed with",
     '                print("[DISAGREE] the leader\'s round failed")\n                return False',
     '                print("mutant")\n                return True'),
    ("a malformed leader result is agreed with",
     '                print("[DISAGREE] the leader\'s result is malformed")\n                return False',
     '                print("mutant")\n                return True'),
    ("a validator whose own reading failed agrees",
     '                print("[DISAGREE] this validator could not judge the evidence: " + str(e)[:200])\n'
     "                return False",
     '                print("mutant")\n                return True'),
    ("an unrated line is read as installed, with grounding off too", [
        ('            lines[lid] = status if status in LINE_STATUSES else "NOT_SHOWN"',
         '            lines[lid] = status if status in LINE_STATUSES else "INSTALLED"'),
        ('        if status == "INSTALLED" and not saw_image:', "        if False:")]),
    ("an unrated criterion is read as met, with grounding off too", [
        ('            criteria[cid] = status if status in CRITERION_STATUSES else "UNCLEAR"',
         '            criteria[cid] = status if status in CRITERION_STATUSES else "MET"'),
        ('        if status in ("MET", "NOT_MET") and not (saw_image or saw_inspector):',
         "        if False:")]),

    # ── the prompt: blind reading, fences, and what never reaches it ────────
    ("the reading step is told what to expect",
     '        head = ("You are reading photographs from a renewable-energy installation site. "',
     '        head = ("Expect Helion Solar HX-550M modules and a Volterra VT-50K inverter. "'),
    ("fences can be forged",
     '    return str(text or "").replace("<<<", "< <<").replace(">>>", ">> >").replace("END ITEM", "END_ITEM")',
     '    return str(text or "")'),
    ("a declaration reaches a round, past both gates", [
        ('            elif it["kind"] == "DOCUMENT":', '            elif it["kind"] != "IMAGE":'),
        ('                  if e not in chosen and self._item(e)["role"] != "INSTALLER"\n'
         '                  and self._item(e)["kind"] != "DECLARATION"]',
         '                  if e not in chosen and self._item(e)["role"] != "INSTALLER"]')]),

    # ── terms: what the contract will accept as an agreement ───────────────
    ("a schedule line states a quantity of zero",
     "            quantity = 1 if raw_quantity is None else int(raw_quantity)",
     "            quantity = int(raw_quantity or 1)"),
    ("an evidence requirement states a count of zero",
     "            count = 1 if raw_count is None else int(raw_count)",
     "            count = int(raw_count or 1)"),
    ("a line needs no manufacturer or model",
     "        if not manufacturer or not model:", "        if False:"),
    ("identification is required of nobody",
     '        if not any(r["kind"] == "IMAGE" and r["from_role"] == "INSTALLER" for r in reqs):',
     "        if False:"),
    ("a milestone has nothing to judge",
     "    if not equipment and not criteria:", "    if False:"),
    ("terms require an inspector the project never named",
     '        if role == "INSPECTOR" and not has_inspector:', "        if False:"),
    ("terms ask for more than one round reads",
     "            if need > room:", "            if False:"),
    ("a deadline in the past",
     "    if deadline <= now:", "    if False:"),

    # ── evidence: who may file, and what is read ───────────────────────────
    ("a stranger files evidence",
     '            _refuse("only the owner, the installer and the named inspector file evidence")',
     "            pass"),
    ("evidence is filed against a standing acceptance",
     '        if m["state"] == "ACCEPTED":\n            _refuse("the acceptance stands;',
     '        if False:\n            _refuse("the acceptance stands;'),
    ("a party files past its quota",
     "        if len(mine) >= quota:", "        if False:"),
    ("an appeal reads unbounded new evidence",
     "        if len(added) >= limit:", "        if False:"),
    ("an image the runner cannot read is stored",
     '            _refuse("the runtime reads PNG and JFIF JPEG only; '
     're-save the image and file it again")', "            pass"),
    ("the installer hides the counterparty's evidence",
     '        others = [e for e in on_version\n'
     '                  if e not in chosen and self._item(e)["role"] != "INSTALLER"\n'
     '                  and self._item(e)["kind"] != "DECLARATION"]',
     "        others = []"),
    ("an assessment runs without the evidence the terms require",
     "        gap = _coverage_gap(terms, [self._item(e) for e in eids])\n        if gap:",
     "        gap = _coverage_gap(terms, [self._item(e) for e in eids])\n        if False:"),
    ("one round reads unbounded evidence from the installer",
     '            if counts[_bucket(it["kind"])] > MAX_NAMED[_bucket(it["kind"])]:',
     "            if False:"),
    # ("a declaration counts as coverage") is left out: request_assessment
    # refuses to name one and never adds one to the counterparty set, so no
    # declaration reaches _coverage_gap and that filter is a second guard on
    # a door already locked. Its mutant would be equivalent.


    # ── money and the state machine ────────────────────────────────────────
    ("a milestone reserves escrow another milestone holds",
     "        if payment > self._unreserved(p):", "        if False:"),
    ("new terms reserve escrow the project does not hold",
     "        if extra > self._unreserved(p):", "        if False:"),
    ("the owner withdraws reserved escrow",
     "        if amount > self._unreserved(p):", "        if False:"),
    ("an acceptance pays inside its appeal window",
     '        if standing["appealable"] and _now() <= _parse_iso(standing["window_ends"]):',
     "        if False:"),
    ("a milestone closes before its deadline",
     '            if now <= _parse_iso(self._terms(m, version)["deadline"]):', "            if False:"),
    ("a close kills terms the installer can still sign",
     '        if pending and _parse_iso(self._terms(m, int(pending))["deadline"]) > now:',
     "        if False:"),
    ("a close ignores a standing appeal window",
     "            if standing and standing.get(\"appealable\") and standing.get(\"window_ends\") \\",
     "            if False and standing and standing.get(\"window_ends\") \\"),
    ("cancel rewrites settled milestones",
     '            if m["state"] in ("CLOSED", "FINALIZED"):\n                continue',
     "            if False:\n                continue"),
    ("a version is signed after its own deadline",
     '        if _parse_iso(terms["deadline"]) <= _now():', "        if False:"),
    ("signing a project forces an expired version into force",
     "            if _parse_iso(self._terms(m, pending)[\"deadline\"]) <= now:\n                continue",
     "            if False:\n                continue"),
    ("an appeal opens outside its window",
     '        if now > _parse_iso(standing["window_ends"]):', "        if False:"),
    # ("a decision is appealed twice") is left out: opening an appeal moves
    # the milestone to APPEALED, and every standing written afterwards is
    # unappealable, so the flag never decides on its own. Equivalent.

    ("the wrong party appeals",
     "        if who != allowed:", "        if False:"),
    ("a readjudication runs during the evidence period",
     '        if _now() <= _parse_iso(appeal["evidence_ends"]):', "        if False:"),
    ("an appeal lapses early",
     '        if _now() <= _parse_iso(appeal["evidence_ends"]) + timedelta(seconds=APPEAL_LAPSE_SECONDS):',
     "        if False:"),
    ("a refused creation keeps the value",
     "            # way out of here has to be a return, not a raise.\n"
     "            if wei:\n                self._credit(sender, wei)",
     "            # way out of here has to be a return, not a raise.\n            pass"),
    ("a claim is paid before the balance is cleared",
     '        row["claimable"] = "0"\n        row["claimed"] = str(int(row["claimed"]) + owed)\n'
     "        self.ledger[who] = json.dumps(row, sort_keys=True)",
     "        pass"),
    ("assessments are unbounded per version",
     '        if int(m["version_assessments"]) >= MAX_ASSESSMENTS_PER_VERSION:',
     "        if False:"),
    ("a view raises at a reader who mistypes an address",
     "        return self.ledger.get(_address_or_refuse(addr)) or",
     "        return self.ledger.get(str(addr)) or"),
]


def suite_passes(work: pathlib.Path) -> tuple:
    r = subprocess.run([sys.executable, "-m", "pytest", "tests/direct/", "-q", "-x",
                        "--tb=no", "-p", "no:cacheprovider"],
                       cwd=work, capture_output=True, text=True)
    tail = [ln for ln in r.stdout.splitlines() if ln.strip()][-1:] or [""]
    return r.returncode == 0, tail[0]


def apply(text: str, edits: list):
    for old, new in edits:
        if text.count(old) != 1:
            return None
        text = text.replace(old, new)
    return text


def main() -> int:
    survivors = []
    with tempfile.TemporaryDirectory(prefix="icarus-mutants-") as tmp:
        work = pathlib.Path(tmp)
        shutil.copytree(REPO / "contracts", work / "contracts")
        shutil.copytree(REPO / "tests", work / "tests",
                        ignore=shutil.ignore_patterns("__pycache__", "mutation"))
        shutil.copy(REPO / "pyproject.toml", work / "pyproject.toml")
        target = work / "contracts" / "icarus.py"
        for entry in MUTATIONS:
            name = entry[0]
            edits = entry[1] if isinstance(entry[1], list) else [(entry[1], entry[2])]
            mutant = apply(TEXT, edits)
            if mutant is None:
                print(f"SKIPPED  {name}: a target is missing or ambiguous", flush=True)
                survivors.append(name)
                continue
            target.write_text(mutant, encoding="utf-8", newline="\n")
            passed, tail = suite_passes(work)
            print(f"{'SURVIVED' if passed else 'killed  '} {name}  ({tail})", flush=True)
            if passed:
                survivors.append(name)
        target.write_text(TEXT, encoding="utf-8", newline="\n")
        passed, tail = suite_passes(work)
    print(f"control, the contract as written: {'passes' if passed else 'FAILS'} ({tail})")
    print(f"{len(MUTATIONS) - len(survivors)}/{len(MUTATIONS)} mutants killed")
    if survivors:
        print("survivors: " + "; ".join(survivors))
    return 0 if passed and not survivors else 1


if __name__ == "__main__":
    sys.exit(main())

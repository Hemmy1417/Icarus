"""Mutation check: break each safety floor of contracts/icarus.py and prove
the direct suite fails, then prove the unbroken contract passes.

Run from the repo root:  python tests/mutation/mutate.py
Name some words to run only the mutants whose description contains one of
them:  python tests/mutation/mutate.py cure substitut
Two switches narrow a local run further; neither is used in CI:
  --since=N       only the mutants from position N in the list onwards
  --tests=a,b     run these test files instead of the whole direct suite
Exit status 0 only if every mutant is killed and the control passes. The
sweep works on a temporary copy of contracts/ and tests/, so the repository's
own files are never touched. A floor guarded in two places is broken in both
at once (a list of replacements), or one of the two mutants is equivalent and
would report a false pin.
"""
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

REPO = pathlib.Path(__file__).resolve().parents[2]
TEXT = (REPO / "contracts" / "icarus.py").read_text(encoding="utf-8")

MUTATIONS = [
    # -- blindness: a node votes only on evidence it says it saw ------------
    ("a node that never claims to have seen the image counts as a reader",
     '                readable = bool(row.get("readable", False)) and bool(row.get("shows"))',
     '                readable = bool(row.get("readable", True)) and bool(row.get("shows"))'),
    ("a reading with nothing in it counts as a reader",
     '                readable = bool(row.get("readable", False)) and bool(row.get("shows"))',
     '                readable = bool(row.get("readable", False))'),

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
     '        if my_decision != "ACCEPTED":\n            return "the leader accepts',
     '        if False:\n            return "the leader accepts'),
    ("a rejection stands on a line the validator does not find absent",
     '        if tl[lid] in ("INSTALLED", "ABSENT") and ml[lid] != tl[lid]:',
     '        if tl[lid] in ("INSTALLED",) and ml[lid] != tl[lid]:'),
    ("a line is recorded installed on the leader's word alone",
     '        if tl[lid] in ("INSTALLED", "ABSENT") and ml[lid] != tl[lid]:',
     '        if tl[lid] in ("ABSENT",) and ml[lid] != tl[lid]:'),
    ("a rejection stands on a criterion the validator does not find unmet",
     '        if tc[cid] in ("MET", "NOT_MET") and mc[cid] != tc[cid]:',
     '        if tc[cid] in ("MET",) and mc[cid] != tc[cid]:'),
    ("a criterion is recorded met on the leader's word alone",
     '        if tc[cid] in ("MET", "NOT_MET") and mc[cid] != tc[cid]:',
     '        if tc[cid] in ("NOT_MET",) and mc[cid] != tc[cid]:'),
    ("a decision that falls short ignores a conflict the validator sees",
     "    if _unsettled(ml, mine_conflicts) and not _unsettled(tl, theirs_conflicts):", "    if False:"),
    ("a leader hides a contradicted line the validator sees",
     "    if _unsettled(ml, mine_conflicts) and not _unsettled(tl, theirs_conflicts):",
     "    if mine_conflicts and not theirs_conflicts:"),
    ("a leader alone declares a line contradicted, and with it that there is no cure",
     "    if _unsettled(tl, theirs_conflicts) and not _unsettled(ml, mine_conflicts):",
     "    if theirs_conflicts and not mine_conflicts:"),
    ("a leader withholds an acceptance a validator would grant",
     '    if leader_decision == "UNDETERMINED" and my_decision == "ACCEPTED":', "    if False:"),
    ("a conflict the leader alone reports is recorded",
     "    if _unsettled(tl, theirs_conflicts) and not _unsettled(ml, mine_conflicts):", "    if False:"),
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
     '    while "<<<" in out or ">>>" in out:', "    while False:"),
    ("a run of four brackets leaves a fence behind",
     '    while "<<<" in out or ">>>" in out:', '    if "<<<" in out or ">>>" in out:'),
    ("half a character reaches a prompt",
     '    text = "".join(" " if ord(c) < 0x20 or 0xD800 <= ord(c) <= 0xDFFF else c',
     '    text = "".join(" " if ord(c) < 0x20 else c'),
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
    ("a milestone closes before its deadline", [
        ('            if now <= _parse_iso(self._terms(m, version)["deadline"]):', "            if False:"),
        ("            if now <= self._work_ends(m):", "            if False:")]),
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
     '        if int(m["version_assessments"]) >= MAX_ASSESSMENTS_PER_VERSION:\n'
     '            _refuse(f"these terms have had the',
     '        if False:\n            _refuse(f"these terms have had the'),
    ("a view raises at a reader who mistypes an address",
     "        return self.ledger.get(_address_or_refuse(addr)) or",
     "        return self.ledger.get(str(addr)) or"),

    # ── a substitute: who may ask, and what a proposal must be ──────────────
    ("a stranger proposes a substitute",
     '            _refuse("only the installer proposes a substitute")', "            pass"),
    ("a substitute is proposed against a standing acceptance or an open appeal",
     '        if m["state"] not in ("AWAITING_EVIDENCE", "REJECTED", "UNDETERMINED"):\n'
     '            _refuse("a substitute is proposed',
     '        if False:\n            _refuse("a substitute is proposed'),
    ("a substitute is proposed after the time for the work",
     '            _refuse("the time for work on these terms has passed")', "            pass"),
    ("two proposals are open at once",
     '            _refuse("a substitution is already open on this milestone")', "            pass"),
    ("proposals are unbounded per version",
     "                >= MAX_SUBSTITUTIONS_PER_VERSION:", "                >= 10**9:"),
    ("a model too short to check a page for",
     "        if not MODEL_KEY_MIN <= len(key) <= MODEL_KEY_MAX \\",
     "        if not len(key) <= MODEL_KEY_MAX \\"),
    ("a model with a key of any length",
     "        if not MODEL_KEY_MIN <= len(key) <= MODEL_KEY_MAX \\",
     "        if not MODEL_KEY_MIN <= len(key) \\"),
    ("a model of digits alone, which any page with a year on it names",
     "                or not any(ch.isalpha() for ch in key) or not any(ch.isdigit() for ch in key):",
     "                or not any(ch.isdigit() for ch in key):"),
    ("a model that is only a phrase, which any product page contains",
     "                or not any(ch.isalpha() for ch in key) or not any(ch.isdigit() for ch in key):",
     "                or not any(ch.isalpha() for ch in key):"),
    ("a model carries characters a name is not written in",
     '                or not _PLAIN.fullmatch(substitute["model"]):', "                or False:"),
    ("a model of any length",
     '        if len(substitute["model"]) > SUBSTITUTE_NAME_MAX \\', "        if False \\"),
    ("a maker's name carries a sentence into every later prompt",
     '        if not _MAKER.fullmatch(substitute["manufacturer"]):', "        if False:"),
    ("a rating carries a sentence into every later prompt",
     '                                     or not _RATING.fullmatch(substitute["rating"])',
     "                                     or False"),
    ("a rating of any length",
     '        if substitute["rating"] and (len(substitute["rating"]) > SUBSTITUTE_NAME_MAX',
     '        if substitute["rating"] and (False'),
    ("a rating with no figure in it",
     '                                     or not any(ch.isdigit() for ch in substitute["rating"])):',
     "                                     or False):"),
    ("a rated line is replaced by a product with no stated rating",
     '        if line["rating"] and not substitute["rating"]:', "        if False:"),
    ("the line's own product is proposed as its substitute",
     "        if _same_product(substitute, line):", "        if False:"),
    ("five point nought and fifty are one rating",
     '        return "".join(ch for ch in str(value or "").upper() if ch.isalnum() or ch == ".")',
     '        return "".join(ch for ch in str(value or "").upper() if ch.isalnum())'),
    ("a proposal gives no reason",
     '        if not reason:\n            _refuse("say why', '        if False:\n            _refuse("say why'),
    ("a product link of any scheme and any character",
     "    if len(url) > URL_MAX or not _LINK.fullmatch(url):", "    if len(url) > URL_MAX:"),
    ("a product link of any length",
     "    if len(url) > URL_MAX or not _LINK.fullmatch(url):", "    if not _LINK.fullmatch(url):"),
    ("a product page sits on an unnamed or numeric host",
     "    if not _HOSTNAME.fullmatch(host) or host.endswith(_NOT_PUBLIC):",
     "    if host.endswith(_NOT_PUBLIC):"),
    ("a product page sits on a private name",
     "    if not _HOSTNAME.fullmatch(host) or host.endswith(_NOT_PUBLIC):",
     "    if not _HOSTNAME.fullmatch(host):"),

    # ── a substitute: the owner's answer, and silence ───────────────────────
    ("a stranger answers a proposal",
     '            _refuse("only the owner answers a proposed substitute")', "            pass"),
    ("the owner answers after the window",
     '        if now > _parse_iso(s["respond_by"]):', "        if False:"),
    ("anything truthy counts as the owner's yes",
     "        if agree is True:", "        if agree:"),
    ("a refusal needs no grounds",
     "            if not grounds:", "            if False:"),
    ("a no on a plain line goes to the validators",
     '            if s["or_equivalent"]:\n                # The objection goes on the record',
     '            if True:\n                # The objection goes on the record'),
    ("a no on an or-equivalent line ends the matter",
     '            if s["or_equivalent"]:\n                # The objection goes on the record',
     '            if False:\n                # The objection goes on the record'),
    ("a stranger withdraws a proposal",
     '            _refuse("only the installer withdraws their proposal")', "            pass"),
    ("a proposal on a plain line is closed while the owner may still answer",
     '            if now <= _parse_iso(s["respond_by"]):', "            if False:"),
    ("a plain line is put to the validators",
     '        if not s["or_equivalent"]:\n            if now <= _parse_iso(s["respond_by"]):',
     '        if False:\n            if now <= _parse_iso(s["respond_by"]):'),
    ("the validators are asked before the owner can object",
     '                and now <= _parse_iso(s["decide_from"]):', "                and False:"),
    ("an objection on record still waits out the objection period",
     '        if s["or_equivalent"] and s["status"] == "PROPOSED" \\', '        if s["or_equivalent"] \\'),
    ("the objection period is the whole of a short window",
     'OBJECTION_SECONDS_MAX, int(p["appeal_window_seconds"]) // 4))),',
     'OBJECTION_SECONDS_MAX, int(p["appeal_window_seconds"])))),'),
    ("the objection period grows with a long window",
     'OBJECTION_SECONDS_MAX, int(p["appeal_window_seconds"]) // 4))),',
     '10**9, int(p["appeal_window_seconds"]) // 4))),'),
    ("an or-equivalent line waits on the owner, whose silence runs out the clock",
     '        if not s["or_equivalent"]:\n            if now <= _parse_iso(s["respond_by"]):',
     '        if True:\n            if now <= _parse_iso(s["respond_by"]):'),

    # ── a substitute: the page, and what code takes from a reading ──────────
    ("a page too short to be a page is weighed",
     '        at = _find_model(page, s["substitute"]["model"]) if len(page) >= PAGE_MIN_CHARS else -1',
     '        at = _find_model(page, s["substitute"]["model"])'),
    ("a page that never names the model is weighed",
     "        if at < 0:\n            found[\"reasoning\"]",
     "        if len(page) < PAGE_MIN_CHARS:\n            found[\"reasoning\"]"),
    ("a longer model number counts as the one proposed",
     "        if at in begins and at + len(key) in begins:", "        if at in begins:"),
    ("the tail of a longer model number counts as the one proposed",
     "        if at in begins and at + len(key) in begins:", "        if at + len(key) in begins:"),
    ("an error page is read as the product page",
     '            if int(getattr(got, "status", 0)) != 200:', "            if False:"),
    ("text inside a script names the model",
     '_BLOCK_TAGS = ("script", "style", "noscript", "template", "svg")', "_BLOCK_TAGS = ()"),
    ("a two-character model is found in any page",
     "    if not MODEL_KEY_MIN <= len(key) <= MODEL_KEY_MAX:\n        return -1",
     "    if not len(key) <= MODEL_KEY_MAX:\n        return -1"),
    ("the search runs for a key of any length",
     "    if not MODEL_KEY_MIN <= len(key) <= MODEL_KEY_MAX:\n        return -1",
     "    if not MODEL_KEY_MIN <= len(key):\n        return -1"),
    ("a page nobody could read is recorded as a refusal", [
        ('        if verdict == "UNREAD":', "        if False:")]),
    ("an unread page is weighed like a read one",
     '    if found["page_chars"] < PAGE_MIN_CHARS:\n        return "UNREAD"',
     '    if False:\n        return "UNREAD"'),
    ("a page nobody answerable published approves a substitute",
     '            or found["publisher"] == "UNKNOWN":', "            or False:"),
    ("the verdict ignores whether the page names the model",
     '    if not found["names_model"] or not found["documents_model"] \\',
     '    if not found["documents_model"] \\'),
    ("a page about a relative of the model approves it",
     '    if not found["names_model"] or not found["documents_model"] \\',
     '    if not found["names_model"] \\'),
    ("anything truthy counts as documenting the model",
     '        "documents_model": raw.get("documents_model") is True,',
     '        "documents_model": bool(raw.get("documents_model")),'),
    ("equipment of another role approves",
     '    if not found["same_role"] or found["meets"] == "NO":', '    if found["meets"] == "NO":'),
    ("a shortfall the page shows is only doubt",
     '    if not found["same_role"] or found["meets"] == "NO":', '    if not found["same_role"]:'),
    ("a page that does not give the figures approves",
     '    if found["meets"] == "YES":\n        return "EQUIVALENT"',
     '    if True:\n        return "EQUIVALENT"'),
    ("anything truthy counts as the same role",
     '        "same_role": raw.get("same_role") is True,',
     '        "same_role": bool(raw.get("same_role")),'),
    ("anything truthy counts as naming the model",
     '        "names_model": raw.get("names_model") is True,',
     '        "names_model": bool(raw.get("names_model")),'),
    ("any word a node sends counts as a publisher",
     '        "publisher": publisher if publisher in PAGE_PUBLISHERS else "UNKNOWN",',
     '        "publisher": publisher or "UNKNOWN",'),
    ("a node reports a page longer than a page can be",
     '        "page_chars": chars if type(chars) is int and 0 <= chars <= PAGE_RAW_MAX else 0,',
     '        "page_chars": chars if type(chars) is int and 0 <= chars else 0,'),
    ("true counts as a page length",
     '        "page_chars": chars if type(chars) is int and 0 <= chars <= PAGE_RAW_MAX else 0,',
     '        "page_chars": chars if isinstance(chars, int) and 300 * chars <= PAGE_RAW_MAX else 0,'),
    ("what is not findings is read as findings",
     '    if not isinstance(raw, dict):\n        raise gl.vm.UserError(f"{ERROR_LLM} the validators returned no usable findings")',
     '    if not isinstance(raw, dict):\n        raw = {}'),
    ("a node's reasoning is stored at any length",
     '        "reasoning": _clean(raw.get("reasoning"), 900) if isinstance(raw.get("reasoning"), str)',
     '        "reasoning": raw.get("reasoning") if isinstance(raw.get("reasoning"), str)'),
    ("the prompt carries the whole page",
     "    return page[start:start + PAGE_EXCERPT_CHARS]", "    return page[start:]"),
    ("the prompt carries the top of the page whatever it names",
     "    start = max(0, at - PAGE_EXCERPT_CHARS // 3)", "    start = 0"),
    ("page text closes a fence",
     'f"<<<BEGIN PAGE\\n{_defuse(excerpt)}\\nEND PAGE>>>\\n"',
     'f"<<<BEGIN PAGE\\n{excerpt}\\nEND PAGE>>>\\n"'),
    ("the installer's reason closes a fence",
     'f"<<<BEGIN REASON\\n{_defuse(s[\'reason\'])}\\nEND REASON>>>\\n"',
     'f"<<<BEGIN REASON\\n{s[\'reason\']}\\nEND REASON>>>\\n"'),
    ("the owner's objection closes a fence",
     'f"<<<BEGIN OBJECTION\\n{_defuse(s[\'objection\'])}\\nEND OBJECTION>>>"',
     'f"<<<BEGIN OBJECTION\\n{s[\'objection\']}\\nEND OBJECTION>>>"'),
    ("a second substitute is measured against the first, not against what was signed",
     '        old, new = s["signed"], s["substitute"]', '        old, new = s["replaces"], s["substitute"]'),
    # ("a leader result that is not a dict is weighed") is left out: with the
    # check removed the rebuild of the findings raises inside the validator,
    # and a validator that raises has not agreed. Equivalent.

    # ── a substitute: consensus, and when it is in force ────────────────────
    ("a substitute is approved without the validator's own approval",
     '            if (theirs == "EQUIVALENT") != (mine == "EQUIVALENT") \\',
     "            if False \\"),
    ("a refusal is recorded on a page only the leader says it read",
     '                    or (theirs == "UNREAD") != (mine == "UNREAD"):', "                    or False:"),
    ("a failed reading of the page is agreed with",
     '                print("[DISAGREE] the leader\'s reading failed")\n                return False',
     '                print("mutant")\n                return True'),
    ("a validator that could not weigh the substitute agrees",
     '                print("[DISAGREE] this validator could not weigh the substitute: " + str(e)[:200])\n'
     "                return False",
     '                print("mutant")\n                return True'),
    ("any verdict puts the substitute in force",
     '        if verdict == "EQUIVALENT":\n            self._put_in_force(m, p, s, "APPROVED", now)',
     '        if True:\n            self._put_in_force(m, p, s, "APPROVED", now)'),
    ("a substitute is proposed with no round left to judge it",
     '            _refuse("these terms have no round left to judge a substitute; "\n'
     '                    "the owner can propose new terms")', "            pass"),
    ("a lapsed appeal leaves a cure period on the record",
     '        m["appeal"] = None\n        m["cure_until"] = None\n        self._save_milestone(m)\n'
     '        self._event(p["project_id"], "APPEAL_LAPSED", mid, "")',
     '        m["appeal"] = None\n        self._save_milestone(m)\n'
     '        self._event(p["project_id"], "APPEAL_LAPSED", mid, "")'),
    ("a rejection stands over a validator that only finds doubt",
     '    if leader_decision == "REJECTED" and my_decision != "REJECTED":', "    if False:"),
    ("the word false in the terms signs a line or equivalent",
     '            "or_equivalent": entry.get("or_equivalent") is True,',
     '            "or_equivalent": bool(entry.get("or_equivalent")),'),
    ("a proposal changes the schedule before anyone agrees to it",
     '            if int(s["version"]) != int(version) or s["status"] not in SUBSTITUTION_IN_FORCE:',
     '            if int(s["version"]) != int(version):'),
    ("a substitute follows the milestone into new terms",
     '            if int(s["version"]) != int(version) or s["status"] not in SUBSTITUTION_IN_FORCE:',
     '            if s["status"] not in SUBSTITUTION_IN_FORCE:'),
    ("an open proposal survives the signing of new terms",
     '        self._void_substitution(m, "new terms were signed")', "        pass"),
    ("an open proposal survives the closing of its milestone",
     '        self._void_substitution(m, "the milestone closed")', "        pass"),
    ("a round runs while the schedule is in question",
     '        if self._open_substitution(m):\n'
     '            _refuse("a substitution is open on this milestone; it is settled or "\n'
     '                    "withdrawn before the evidence is judged")',
     "        pass"),
    ("a decision is appealed while the schedule is in question",
     '        if self._open_substitution(m):\n'
     '            _refuse("a substitution is open on this milestone; it is settled or "\n'
     '                    "withdrawn before the decision is appealed")',
     "        pass"),

    # ── the cure round ──────────────────────────────────────────────────────
    ("a stranger asks for a cure round",
     '            _refuse("only the installer asks for a cure round")', "            pass"),
    ("a cure carries findings from a decision that lapsed on appeal",
     '        if standing["kind"] == "APPEAL_LAPSED":', "        if False:"),
    ("a line the evidence disagrees about is not a conflict",
     '    return bool(conflicts) or "CONTRADICTED" in lines.values()', "    return bool(conflicts)"),
    ("a conflict the panel reports is not a conflict",
     '    return bool(conflicts) or "CONTRADICTED" in lines.values()',
     '    return "CONTRADICTED" in lines.values()'),
    ("a cure is heard after its period",
     '            _refuse("the period for curing this decision has ended")', "            pass"),
    ("a cure asks the same question again on the same evidence",
     "        if not any(_num(e) > mark for e in chosen):", "        if False:"),
    ("an item held back from the decision counts as filed since",
     '            # what a cure may rest on.\n'
     '            "item_mark": int(self.counters.get("item") or "0"),',
     '            # what a cure may rest on.\n'
     '            "item_mark": max([_num(e) for e in eids] or [0]),'),
    ("a line the decision found missing is carried as installed",
     '                      if base["lines"][line["id"]] != "INSTALLED" or line["id"] in changed\n',
     '                      if line["id"] in changed\n'),
    ("a line substituted since the decision is carried as installed",
     '                      if base["lines"][line["id"]] != "INSTALLED" or line["id"] in changed\n',
     '                      if base["lines"][line["id"]] != "INSTALLED"\n'),
    ("a line is carried from a decision that found the evidence in conflict",
     "                      or nothing_settled]", "                      or False]"),
    ("a criterion left open is carried as met",
     '                         if status != "MET" or changed or nothing_settled]',
     "                         if changed or nothing_settled]"),
    ("a criterion met with the old equipment is carried over to the new",
     '                         if status != "MET" or changed or nothing_settled]',
     '                         if status != "MET" or nothing_settled]'),
    ("a criterion is carried from a decision that found the evidence in conflict",
     '                         if status != "MET" or changed or nothing_settled]',
     '                         if status != "MET" or changed]'),
    ("a criterion already met is judged again",
     '                         if status != "MET" or changed or nothing_settled]',
     "                         if True]"),
    ("a second substitute is proposed inside the window the first one added",
     '        if m["cure_until"] and m["cure_until"] != m["cure_base"] \\', "        if False \\"),
    ("no substitute is proposed once any has extended the period, however long is left",
     '                and now > _parse_iso(m["cure_base"]):', "                and True:"),
    ("a cure that keeps nothing reads less than the terms require",
     "        if nothing_settled:\n            # Every line is judged again, so this is a full reading",
     "        if False:\n            # Every line is judged again, so this is a full reading"),
    ("every cure is held to the full evidence requirements again",
     "        if nothing_settled:\n            # Every line is judged again, so this is a full reading",
     "        if True:\n            # Every line is judged again, so this is a full reading"),
    ("a fence closes across the join of a substitute's maker and model",
     '''            product = _defuse(f"{line['manufacturer']} {line['model']}"
                              + (f", {line['rating']}" if line["rating"] else ""))''',
     '''            product = (f"{_defuse(line['manufacturer'])} {_defuse(line['model'])}"
                       + (f", {_defuse(line['rating'])}" if line["rating"] else ""))'''),
    ("a substitute comes into force after any round could hear it",
     "        if now > self._work_ends(m):\n            self._lapse(s, now)\n            return",
     "        if False:\n            self._lapse(s, now)\n            return"),
    ("a panel is asked about a substitute no round could hear",
     "        if now > self._work_ends(m):\n            # No round can judge a new product any more",
     "        if False:\n            # No round can judge a new product any more"),
    ("a late yes leaves the installer with neither an appeal nor time to cure",
     '        if m["cure_until"]:\n            window = timedelta(',
     '        if False:\n            window = timedelta('),
    ("a substitute in force cuts a longer cure period short",
     '            m["cure_until"] = _iso(max(_parse_iso(m["cure_until"]), now + window))',
     '            m["cure_until"] = _iso(now + window)'),
    ("the owner objects twice",
     '        if s["status"] != "PROPOSED" and agree is not True:', "        if False:"),
    ("an owner who objected can never come round to a yes",
     '        if s["status"] != "PROPOSED" and agree is not True:',
     '        if s["status"] != "PROPOSED":'),
    ("the closing words of a fence pass through party text",
     '    out = _FENCE_END.sub(r"END_\\1", str(text or ""))', '    out = str(text or "")'),
    ("a cure round rates lines the decision settled",
     '                      if scope is None or line["id"] in scope["lines"]]',
     "                      if True]"),
    ("a cure round rates criteria the decision settled",
     '                         if scope is None or c["id"] in scope["criteria"]]',
     "                         if True]"),
    ("cure rounds are not counted against the allowance",
     '        if kind in ("ASSESSMENT", "CURE"):\n            m["version_assessments"]',
     '        if kind == "ASSESSMENT":\n            m["version_assessments"]'),
    ("a cured decision cannot be appealed",
     '        appealable = kind in ("ASSESSMENT", "CURE") \\',
     '        appealable = kind == "ASSESSMENT" \\'),
    ("every cure round renews the cure period",
     '        if kind == "ASSESSMENT" or (kind == "APPEAL" and appeal["against"] == "ACCEPTED"):',
     '        if kind != "APPEAL" or (kind == "APPEAL" and appeal["against"] == "ACCEPTED"):'),
    ("an acceptance lost on appeal leaves no time to cure",
     '        if kind == "ASSESSMENT" or (kind == "APPEAL" and appeal["against"] == "ACCEPTED"):',
     '        if kind == "ASSESSMENT":'),
    ("the installer's own appeal renews the cure period",
     '        if kind == "ASSESSMENT" or (kind == "APPEAL" and appeal["against"] == "ACCEPTED"):',
     '        if kind == "ASSESSMENT" or kind == "APPEAL":'),
    ("an acceptance by a cure round or on appeal leaves a cure period showing",
     '        if outcome["decision"] == "ACCEPTED" \\', "        if False \\"),
    ("a substitute's name is printed in a later prompt as though the parties wrote it",
     '            if line.get("substitution"):\n                # Named by the installer',
     '            if False:\n                # Named by the installer'),
    ("a substitute's name sits in a later prompt outside any fence",
     'f"<<<BEGIN NAME {product} END NAME>>>")', 'f"{product}")'),
    ("terms with no round left hold a cure period open",
     "                or int(m[\"version_assessments\"]) >= MAX_ASSESSMENTS_PER_VERSION:\n"
     "            # An acceptance leaves nothing to cure",
     "                or False:\n            # An acceptance leaves nothing to cure"),
    ("an acceptance leaves a cure period open", [
        ('            m["cure_until"] = None if outcome["decision"] == "ACCEPTED" else \\',
         '            m["cure_until"] = None if False else \\'),
        ('        if outcome["decision"] == "ACCEPTED" \\', "        if False \\")]),
    ("a decision at the deadline leaves no time to cure",
     "                _iso(max(deadline, now + timedelta(seconds=window)))", "                _iso(deadline)"),
    ("a cure period cuts the time to the deadline short",
     "                _iso(max(deadline, now + timedelta(seconds=window)))",
     "                _iso(now + timedelta(seconds=window))"),
    ("the cure period is not time in which work is heard",
     '        if m.get("cure_until"):\n            ends = max(', '        if False:\n            ends = max('),
    ("a milestone closes inside its cure period",
     "            if now <= self._work_ends(m):", "            if False:"),
    ("a cure period outlives the terms it belonged to",
     '        m["cure_until"] = None\n        self._void_substitution(m, "new terms were signed")',
     '        self._void_substitution(m, "new terms were signed")'),
    ("an appeal of a cured decision reads only the cure's own evidence",
     '        recorded = list(prior["chain"])',
     '        recorded = [row["item_id"] for row in prior["evidence"]]'),
    ("an appeal skips what the owner filed before it opened",
     '                   and (_num(e) > mark or self._item(e)["role"] != "INSTALLER")]',
     "                   and _num(e) > mark]"),
    ("an appeal reads everything the installer ever left unpresented",
     '                   and (_num(e) > mark or self._item(e)["role"] != "INSTALLER")]',
     "                   and True]"),
    ("a rejection of one schedule is appealed against another",
     "        if self._changed_since(m, json.loads(self.rounds[f\"{mid}|{int(standing['round'])}\"])):",
     "        if False:"),
    ("a line is never seen to have changed",
     '                if line.get("substitution") != judged[line["id"]]]', "                if False]"),
    ("an appeal sweeps in everything filed since the decision",
     '                       "item_mark": int(self.counters.get("item") or "0"),',
     '                       "item_mark": int(standing["item_mark"]),'),
    ("a cure's record forgets the evidence it carries findings from",
     '            "chain": (list(base["chain"]) + [e for e in eids if e not in base["chain"]])\n'
     "                     if base else list(eids),",
     '            "chain": list(eids),'),
    ("a round records the schedule as signed, not as judged",
     '            "schedule": outcome["equipment"],',
     '            "schedule": self._terms(m, version)["equipment"],'),
]


TESTS = ["tests/direct/"]


def suite_passes(work: pathlib.Path) -> tuple:
    r = subprocess.run([sys.executable, "-m", "pytest", *TESTS, "-q", "-x",
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
    words, since = [], 0
    for arg in sys.argv[1:]:
        if arg.startswith("--since="):
            since = int(arg.split("=", 1)[1])
        elif arg.startswith("--tests="):
            TESTS[:] = arg.split("=", 1)[1].split(",")
        else:
            words.append(arg.lower())
    chosen = [m for m in MUTATIONS[since:]
              if not words or any(w in m[0].lower() for w in words)]
    survivors = []
    with tempfile.TemporaryDirectory(prefix="icarus-mutants-") as tmp:
        work = pathlib.Path(tmp)
        shutil.copytree(REPO / "contracts", work / "contracts")
        shutil.copytree(REPO / "tests", work / "tests",
                        ignore=shutil.ignore_patterns("__pycache__", "mutation"))
        shutil.copy(REPO / "pyproject.toml", work / "pyproject.toml")
        target = work / "contracts" / "icarus.py"
        for entry in chosen:
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
                if os.environ.get("GITHUB_ACTIONS"):
                    # An annotation, so the name shows on the run's own page.
                    print(f"::error title=mutant survived::{name}", flush=True)
        target.write_text(TEXT, encoding="utf-8", newline="\n")
        passed, tail = suite_passes(work)
    print(f"control, the contract as written: {'passes' if passed else 'FAILS'} ({tail})")
    print(f"{len(chosen) - len(survivors)}/{len(chosen)} mutants killed")
    if survivors:
        print("survivors: " + "; ".join(survivors))
    return 0 if passed and not survivors else 1


if __name__ == "__main__":
    sys.exit(main())

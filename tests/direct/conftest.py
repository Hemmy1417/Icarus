"""Direct-mode harness for ICARUS: the real contract module against a stub
`genlayer` that is as strict as the runtime where it matters.

  VALIDATORS RUN. `gl.vm.run_nondet` runs the leader, then the validator
  closure on the leader's result; a validator returning False fails the
  round with nothing written, like the network.

  THE MODEL. `exec_prompt` answers from per-role queues, one for image
  prompts ("look") and one for criteria prompts ("judge"), so a test can make
  the leader and the validator read the same evidence differently. It also
  enforces GenVM's image rules measured in docs/PROBE-REPORT: at most two
  images, each at most 5 MB, PNG or JFIF-headed JPEG only.

  THE CLOCK. `set_now(iso)` sets the transaction datetime; nothing advances
  on its own, so both sides of every deadline and window are testable.

  MONEY. `pay(who, wei)` sets the transaction value; `_Payee.emit_transfer`
  appends to `transfers()`. A public write that raises reverts every tree,
  like the runtime, so a refusal can never leave half a state behind.
"""

import importlib.util
import json
import os
import pathlib
import sys
import types
from datetime import datetime, timezone

import pytest
from eth_utils import to_checksum_address

CONTRACT_PATH = (pathlib.Path(__file__).resolve().parents[2]
                 / "contracts" / "icarus.py")

# EIP-55 checksummed, the form the contract records signers in.
OWNER = to_checksum_address("0x691e25a08e00fa16fc95b159589ba563727d77a8")
INSTALLER = to_checksum_address("0x56e71175c0772a21a6170e3d95184f126526e9f2")
INSPECTOR = to_checksum_address("0x69730962ce945c8da10817a6ae53fbaff7675531")
STRANGER = to_checksum_address("0xd41fca7210904c6d2f4e00c377e76f8aad43ec9e")
DEPLOYER = to_checksum_address("0x26ed19d786db6c920d0969b2d8a25f6a0fc8e338")

GEN = 10**18

_ROLE = ["leader"]
_ANSWERS = {"look": {"leader": [], "validator": []}, "judge": {"leader": [], "validator": []}}
_CALLS = {"look": {"leader": 0, "validator": 0}, "judge": {"leader": 0, "validator": 0}}
_PROMPTS = []
_FORGED = []
_ACCEPTED = []
_PRINTS = []
_TRANSFERS = []
_NOW = [datetime(2026, 9, 20, 9, 0, 0, tzinfo=timezone.utc)]


class _NoAnswer(BaseException):
    """A test forgot to queue a model answer. BaseException, so the
    contract's per-image isolation cannot swallow a harness mistake."""


class _UserError(Exception):
    def __init__(self, data):
        super().__init__(data)
        self.data = data

    def __str__(self):
        return str(self.data)


class _VMError:
    def __init__(self, message):
        self.message = message


class _Return:
    def __init__(self, calldata):
        self.calldata = calldata


def _roundtrip(value):
    """Consensus serializes the leader's result; round-tripping enforces
    that everything returned is plain data."""
    return json.loads(json.dumps(value))


def _run_nondet(leader_fn, validator_fn):
    if _ACCEPTED:
        # A result the network accepted whatever it says: tests the contract's
        # own boundary checks, the layer behind the validators.
        return _ACCEPTED.pop(0)
    if _FORGED:
        forged = _FORGED.pop(0)
        _ROLE[0] = "validator"
        try:
            ok = validator_fn(_Return(forged))
        except Exception:
            ok = False
        finally:
            _ROLE[0] = "leader"
        if not ok:
            raise _UserError("[LLM_ERROR] validators did not agree with the leader")
        return forged
    try:
        value = _roundtrip(leader_fn())
    except _UserError as e:
        _ROLE[0] = "validator"
        try:
            agreed = validator_fn(e)
        except Exception:
            agreed = False
        finally:
            _ROLE[0] = "leader"
        raise _UserError(e.data if agreed else
                         "[LLM_ERROR] validators disagreed with the leader's failure")
    _ROLE[0] = "validator"
    try:
        ok = validator_fn(_Return(value))
    except Exception:
        ok = False
    finally:
        _ROLE[0] = "leader"
    if not ok:
        raise _UserError("[LLM_ERROR] validators did not agree with the leader")
    return value


class _TreeMap(dict):
    def __class_getitem__(cls, item):
        return cls

    def get(self, k, default=None):
        return super().get(k, default)


class _U256(int):
    def __new__(cls, v):
        return super().__new__(cls, int(v))


class _Address:
    def __init__(self, v):
        text = str(v).strip()
        if not (text.startswith("0x") and len(text) == 42):
            raise ValueError("not an address")
        int(text[2:], 16)
        self.as_hex = to_checksum_address(text)

    def __str__(self):
        return self.as_hex


class _ViewDeco:
    def __call__(self, fn):
        return fn


class _WriteDeco:
    payable = staticmethod(lambda fn: fn)

    def __call__(self, fn):
        return fn


class _Public:
    view = _ViewDeco()
    write = _WriteDeco()


def _sniff_ok(img: bytes) -> bool:
    return img[:8] == b"\x89PNG\r\n\x1a\n" or img[:4] == b"\xff\xd8\xff\xe0"


def _exec_prompt(prompt, response_format=None, images=None):
    role = _ROLE[0]
    kind = "look" if images else "judge"
    if images is not None:
        if len(images) > 2:
            raise RuntimeError("TOO_MANY_IMAGES")
        for img in images:
            if len(img) > 5 * 1024 * 1024:
                raise RuntimeError("IMAGE_TOO_LARGE")
            if not _sniff_ok(bytes(img)):
                raise RuntimeError("INVALID_IMAGE")
    _PROMPTS.append({"role": role, "kind": kind, "prompt": prompt,
                     "images": len(images or [])})
    queue = _ANSWERS[kind][role] or _ANSWERS[kind]["leader"]
    if not queue:
        raise _NoAnswer(f"test ran a {kind} prompt without an answer for it")
    idx = min(_CALLS[kind][role], len(queue) - 1)
    _CALLS[kind][role] += 1
    answer = queue[idx]
    if callable(answer):
        answer = answer(prompt, images)
    if isinstance(answer, BaseException):
        raise answer
    return answer


class _PayeeProxy:
    def __init__(self, addr):
        self.addr = str(addr)

    def emit_transfer(self, value=0):
        _TRANSFERS.append({"to": self.addr, "wei": int(value)})


def _contract_interface(cls):
    return _PayeeProxy


def _print_hook(*args, **kwargs):
    _PRINTS.append(" ".join(str(a) for a in args))


def _install():
    gl = types.ModuleType("genlayer")
    gl.public = _Public()
    gl.contract = types.SimpleNamespace(Contract=type("Contract", (), {}))
    gl.storage = types.SimpleNamespace(TreeMap=_TreeMap)
    gl.vm = types.SimpleNamespace(UserError=_UserError, VMError=_VMError,
                                  Return=_Return, run_nondet=_run_nondet)
    gl.nondet = types.SimpleNamespace(exec_prompt=_exec_prompt,
                                      web=types.SimpleNamespace())
    gl.message = types.SimpleNamespace(sender_address=DEPLOYER, value=0)
    gl.evm = types.SimpleNamespace(contract_interface=_contract_interface)
    gl_types = types.ModuleType("genlayer.types")
    gl_types.u256 = _U256
    gl_types.Address = _Address
    gl.types = gl_types
    sys.modules["genlayer"] = gl
    sys.modules["genlayer.types"] = gl_types
    return gl


class _FakeDateTime(datetime):
    @classmethod
    def now(cls, tz=None):
        return _NOW[0]


def _load():
    _install()
    spec = importlib.util.spec_from_file_location("icarus_contract", CONTRACT_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.print = _print_hook
    mod.datetime = _FakeDateTime
    return mod


@pytest.fixture
def module():
    # The stub SDK must not outlive its test: the official-runner suite loads
    # the real `genlayer` in the same session.
    saved = {k: v for k, v in sys.modules.items()
             if k == "genlayer" or k.startswith("genlayer.")}
    try:
        yield _load()
    finally:
        for k in [k for k in sys.modules if k == "genlayer" or k.startswith("genlayer.")]:
            del sys.modules[k]
        sys.modules.update(saved)


if sys.platform == "win32":
    # genlayer-test's direct loader unlinks a temp file it still holds open,
    # which POSIX allows and Windows refuses; tolerate exactly that locally.
    _real_unlink = os.unlink

    def _tolerant_unlink(path, *args, **kwargs):
        try:
            _real_unlink(path, *args, **kwargs)
        except PermissionError:
            pass

    os.unlink = _tolerant_unlink


_TREES = ("counters", "projects", "role_index", "milestones", "items", "item_bytes",
          "item_text", "version_items", "rounds", "ledger", "events")

_PUBLIC_WRITES = ("create_project", "fund_project", "accept_project", "accept_inspector_role",
                  "cancel_project", "withdraw_escrow", "add_milestone", "propose_version",
                  "accept_version", "submit_image", "submit_document", "submit_declaration",
                  "request_assessment", "open_appeal", "decide_appeal", "lapse_appeal",
                  "finalize", "close_milestone", "claim")


def _revert_on_raise(inst, name):
    fn = getattr(inst, name)

    def wrapped(*args, **kwargs):
        snapshot = {t: dict(getattr(inst, t)) for t in _TREES}
        n_transfers = len(_TRANSFERS)
        try:
            return fn(*args, **kwargs)
        except BaseException:
            for t, data in snapshot.items():
                tree = getattr(inst, t)
                tree.clear()
                tree.update(data)
            del _TRANSFERS[n_transfers:]
            raise

    return wrapped


def _fresh_instance(mod):
    inst = mod.Icarus.__new__(mod.Icarus)
    for name in _TREES:
        setattr(inst, name, _TreeMap())
    mod.gl.message.sender_address = DEPLOYER
    mod.gl.message.value = 0
    inst.__init__()
    for name in _PUBLIC_WRITES:
        setattr(inst, name, _revert_on_raise(inst, name))
    return inst


def _reset():
    _ROLE[0] = "leader"
    for kind in _ANSWERS:
        for role in _ANSWERS[kind]:
            _ANSWERS[kind][role].clear()
            _CALLS[kind][role] = 0
    _PROMPTS.clear()
    _FORGED.clear()
    _ACCEPTED.clear()
    _PRINTS.clear()
    _TRANSFERS.clear()
    _NOW[0] = datetime(2026, 9, 20, 9, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def c(module):
    _reset()
    return _fresh_instance(module)


# ── helpers ──────────────────────────────────────────────────────────────────

def as_(module, who, value=0):
    module.gl.message.sender_address = who
    module.gl.message.value = value


def err(module):
    return module.gl.vm.UserError


def set_now(iso):
    _NOW[0] = datetime.fromisoformat(iso.replace("Z", "+00:00"))


def reset_prompts():
    _PROMPTS.clear()


def prompts(kind=None, role=None):
    return [p for p in _PROMPTS if (kind is None or p["kind"] == kind)
            and (role is None or p["role"] == role)]


def prints():
    return list(_PRINTS)


def transfers():
    return list(_TRANSFERS)


def forge_leader(value):
    _FORGED.append(value)


def network_accepts(value):
    """The next round's consensus result, as if the network had accepted it."""
    _ACCEPTED.append(value)


def jfif(tag=b"", size=4000):
    """A JPEG with the JFIF header GenVM's gateway accepts."""
    body = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + tag
    return body + b"\x00" * max(0, size - len(body))


def png(tag=b"", size=2000):
    body = b"\x89PNG\r\n\x1a\n" + tag
    return body + b"\x00" * max(0, size - len(body))


def exif_jpeg(size=4000):
    body = b"\xff\xd8\xff\xe1\x00\x10Exif\x00"
    return body + b"\x00" * max(0, size - len(body))




# ── the domain: parties, terms, evidence, model answers ──────────────────────

from _fixtures import (  # noqa: E402  (after the stub is installed)
    CRITERIA, DEADLINE, REQUIREMENTS, SCHEDULE, judge_all, judge_answer,
    look_all, look_answer, project_params, terms,
)


def create_project(module, c, escrow=5 * GEN, installer=None, **over):
    as_(module, OWNER, escrow)
    out = json.loads(c.create_project(project_params(installer or INSTALLER, **over)))
    assert out["refused"] is False, out
    return out["project_id"]


def active_milestone(module, c, escrow=5 * GEN, inspector="", **terms_over):
    """A project the installer signed, with one milestone in force."""
    pid = create_project(module, c, escrow=escrow, inspector=inspector)
    as_(module, OWNER)
    mid = json.loads(c.add_milestone(pid, terms(**terms_over)))["milestone_id"]
    as_(module, INSTALLER)
    c.accept_project(pid)
    if inspector:
        as_(module, inspector)
        c.accept_inspector_role(pid)
    return pid, mid


def image(module, c, mid, who=INSTALLER, req="R1", line="", data=None,
          caption="The array from the north parapet", origin="PHOTO", **meta):
    as_(module, who)
    m = {"requirement_id": req, "equipment_id": line, "caption": caption, "origin": origin,
         "claimed_capture": "2026-09-14", "claimed_location": "Plot 14, Canal Road"}
    m.update(meta)
    return json.loads(c.submit_image(mid, json.dumps(m),
                                     data if data is not None else jfif(caption.encode())))["item_id"]


def document(module, c, mid, who=INSTALLER, req="", line="", title="Inverter datasheet",
             text="Volterra VT-50K, 50 kW string inverter, three phase.", reference="DS-VT50K"):
    as_(module, who)
    meta = {"requirement_id": req, "equipment_id": line, "title": title, "reference": reference}
    return json.loads(c.submit_document(mid, json.dumps(meta), text))["item_id"]


def declaration(module, c, mid, who=INSTALLER, text="The system is installed and energised."):
    as_(module, who)
    return json.loads(c.submit_declaration(mid, text))["item_id"]


def llm(look=None, judge=None, v_look=None, v_judge=None):
    """Queue model answers; validator queues default to the leader's."""
    for kind, leader, validator in (("look", look, v_look), ("judge", judge, v_judge)):
        _ANSWERS[kind]["leader"].clear()
        _ANSWERS[kind]["validator"].clear()
        _CALLS[kind]["leader"] = 0
        _CALLS[kind]["validator"] = 0
        if leader is not None:
            _ANSWERS[kind]["leader"].extend(leader if isinstance(leader, list) else [leader])
        if validator is not None:
            _ANSWERS[kind]["validator"].extend(validator if isinstance(validator, list) else [validator])


def assess(module, c, mid, items, look=None, judge=None, **kw):
    llm(look=look if look is not None else look_all(),
        judge=judge if judge is not None else judge_all(), **kw)
    as_(module, INSTALLER)
    return json.loads(c.request_assessment(mid, json.dumps(items)))


def claimable(c, addr):
    return int(json.loads(c.get_balance(addr))["claimable"])


def milestone(c, mid):
    return json.loads(c.get_milestone(mid))


def project(c, pid):
    return json.loads(c.get_project(pid))


def rounds(c, mid, n):
    return json.loads(c.get_round(mid, n))

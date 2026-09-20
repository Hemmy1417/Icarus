"""The domain half of the harness: terms with an equipment schedule, the
parties, evidence, and the model answers a round reads. Imported into
conftest so every test file gets them without an import line."""
import json

DEADLINE = "2026-10-20T12:00:00Z"

# The flagship: a commercial rooftop array whose inverter must be identified.
SCHEDULE = [
    {"role": "MODULE", "manufacturer": "Helion Solar", "model": "HX-550M",
     "rating": "550 W", "quantity": 92, "identify": True},
    {"role": "INVERTER", "manufacturer": "Volterra", "model": "VT-50K",
     "rating": "50 kW", "quantity": 1, "identify": True},
    {"role": "MOUNTING", "manufacturer": "Ridgeline", "model": "RL-Flat",
     "quantity": 1, "identify": False},
]
CRITERIA = [
    {"text": "The array is installed to the approved layout, in the orientation the design shows."},
]
REQUIREMENTS = [
    {"text": "Photographs of the installed array and its equipment", "kind": "IMAGE",
     "from_role": "INSTALLER", "min_count": 2},
]


def terms(**over):
    t = {"milestone_type": "PV_MODULE_INSTALLATION",
         "title": "PV system installation complete",
         "description": "Modules, inverter and mounting installed and ready for commissioning.",
         "requirements": "The array is installed to the approved design with the specified "
                         "equipment, and the inverter is identifiable on site.",
         "specification": "50 kW rooftop array, 92 modules on a flat-roof ballasted system, "
                          "one string inverter at the plant room wall.",
         "equipment": SCHEDULE, "criteria": CRITERIA,
         "evidence_requirements": REQUIREMENTS,
         "payment_wei": str(2 * 10**18), "deadline": DEADLINE}
    t.update(over)
    return json.dumps(t)


def project_params(installer, **over):
    p = {"title": "50 kW commercial rooftop solar", "description": "Demonstration project",
         "site": "Plot 14, Canal Road", "system_type": "COMMERCIAL_SOLAR",
         "capacity_kw": "50", "installer": installer, "inspector": "",
         "appeal_window_seconds": 3600}
    p.update(over)
    return json.dumps(p)


# ── model answers ────────────────────────────────────────────────────────────

def look_answer(images, received=True):
    """images: list of {shows, labels, concerns} dicts, one per image read."""
    return {"images": [{"n": i + 1, "readable": received,
                        "shows": row.get("shows", "A rooftop array of framed modules."),
                        "labels": row.get("labels", []),
                        "concerns": row.get("concerns", [])}
                       for i, row in enumerate(images)]}


def look_all(n_images=2, labels=None, received=True, shows=None):
    row = {"labels": labels or [], "shows": shows or "A rooftop array of framed modules."}
    return look_answer([dict(row) for _ in range(n_images)], received=received)


def judge_answer(lines, criteria=None, conflicts=False, note="", basis=None, notes=None):
    """lines: {E1: INSTALLED|...}; criteria: {C1: MET|NOT_MET|UNCLEAR}."""
    b = basis if basis is not None else {}
    default = ["ev-000001"]
    return {
        "reasoning": "Matched what the labels read against the schedule.",
        "lines": [{"id": k, "status": v, "basis": b.get(k, default),
                   "note": (notes or {}).get(k, "")} for k, v in lines.items()],
        "criteria": [{"id": k, "status": v, "basis": b.get(k, default)}
                     for k, v in (criteria or {}).items()],
        "conflicts_detected": conflicts, "conflict_note": note,
    }


def judge_all(line_status="INSTALLED", crit_status="MET", n_lines=3, n_criteria=1,
              conflicts=False, basis=None):
    return judge_answer({f"E{i + 1}": line_status for i in range(n_lines)},
                        {f"C{i + 1}": crit_status for i in range(n_criteria)},
                        conflicts=conflicts, basis=basis)

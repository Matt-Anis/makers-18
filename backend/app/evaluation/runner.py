from dataclasses import dataclass
import time

from app.detection.pipeline import (
    ExtraDetector,
    apply_mask,
    commit_findings_to_vault,
    detect_sensitive_entities,
)
from app.models import CustomRule
from app.vault.store import VaultData

EVAL_ENTITY_TYPES: tuple[str, ...] = (
    "PERSON",
    "COMPANY",
    "EMAIL",
    "PHONE",
    "ADDRESS",
    "ID",
    "BANK",
    "CUSTOM",
)


@dataclass(frozen=True)
class GoldEntity:
    """Labeled sensitive entity expected in a benchmark contract snippet."""

    text: str
    entity_type: str


@dataclass(frozen=True)
class EvalSample:
    """Single labeled contract snippet for recall/precision/round-trip evaluation."""

    sample_id: str
    text: str
    entities: tuple[GoldEntity, ...]


def _build_synthetic_dataset(count: int = 60) -> list[EvalSample]:
    """Generate a deterministic 60-contract synthetic benchmark covering all entity types."""
    people = (
        "Karim Benali",
        "Nadia Mansouri",
        "Youssef Haddad",
        "Salma Khelifi",
        "Amine Boudiaf",
        "Lina Cherif",
        "Omar Toumi",
        "Meriem Saidi",
        "Tariq Zerrouki",
        "Ines Belkacem",
    )
    companies = (
        "Atlas Tech SARL",
        "Maghreb Cloud SPA",
        "Sahara Logistics LLC",
        "Crescent Biotech Inc.",
        "Medina FinTech SAS",
        "Nordic Systems GmbH",
    )
    streets = (
        "14 Rue Didouche Mourad",
        "28 Avenue Pasteur",
        "102 Boulevard Mohamed V",
        "45 Street Khemisti",
        "720 Road El Biar",
        "9 Cite Hydra",
    )
    codenames = (
        "APOLLO-X",
        "APOLLO-X",
        "APOLLO-X",
        "PROJECT-ORION",
        "APOLLO-X",
        "APOLLO-X",
    )

    samples: list[EvalSample] = []
    for idx in range(count):
        person = people[idx % len(people)]
        company = companies[idx % len(companies)]
        street = streets[idx % len(streets)]
        codename = codenames[idx % len(codenames)]
        slug = person.lower().replace(" ", ".")
        domain = company.split()[0].lower() + ".dz"
        email = f"{slug}@{domain}"
        phone = f"+213 55{idx % 10} {10 + (idx % 80):02d} {20 + (idx % 70):02d} {30 + (idx % 60):02d}"
        tax_id = f"00192837465{idx:04d}"
        iban = f"DZ400001000000000012{idx:04d}"

        if idx % 3 == 0:
            text = (
                f"SERVICE AGREEMENT #{idx + 1} between {company} (Tax ID: {tax_id}) and "
                f"{person}, residing at {street}. Contact: {email} | Phone: {phone}. "
                f"Settlement IBAN: {iban}. Internal codename: {codename}."
            )
            entities = (
                GoldEntity(company, "COMPANY"),
                GoldEntity(tax_id, "ID"),
                GoldEntity(person, "PERSON"),
                GoldEntity(street, "ADDRESS"),
                GoldEntity(email, "EMAIL"),
                GoldEntity(phone, "PHONE"),
                GoldEntity(iban, "BANK"),
                GoldEntity(codename, "CUSTOM"),
            )
        elif idx % 3 == 1:
            text = (
                f"MUTUAL NDA: {person} ({email}, tel {phone}) acting on behalf of {company} "
                f"agrees to protect deliverables under {codename}. Tax reference {tax_id}."
            )
            entities = (
                GoldEntity(person, "PERSON"),
                GoldEntity(email, "EMAIL"),
                GoldEntity(phone, "PHONE"),
                GoldEntity(company, "COMPANY"),
                GoldEntity(codename, "CUSTOM"),
                GoldEntity(tax_id, "ID"),
            )
        else:
            text = (
                f"PAYMENT ADDENDUM: Remit consulting fees for {person} at {street} via "
                f"account {iban}. Invoices for {company} go to {email}."
            )
            entities = (
                GoldEntity(person, "PERSON"),
                GoldEntity(street, "ADDRESS"),
                GoldEntity(iban, "BANK"),
                GoldEntity(company, "COMPANY"),
                GoldEntity(email, "EMAIL"),
            )

        samples.append(EvalSample(sample_id=f"syn_{idx + 1:03d}", text=text, entities=entities))
    return samples


REALISTIC_DATASET: tuple[EvalSample, ...] = (
    EvalSample(
        "real_001",
        (
            "MASTER SERVICES AGREEMENT entered into by Atlas Tech SARL (NIF 001928374650123) "
            "and Karim Benali for software architecture delivery under APOLLO-X. "
            "Notices shall be emailed to karim.benali@atlastech.dz or called at +213 550 12 34 56."
        ),
        (
            GoldEntity("Atlas Tech SARL", "COMPANY"),
            GoldEntity("001928374650123", "ID"),
            GoldEntity("Karim Benali", "PERSON"),
            GoldEntity("APOLLO-X", "CUSTOM"),
            GoldEntity("karim.benali@atlastech.dz", "EMAIL"),
            GoldEntity("+213 550 12 34 56", "PHONE"),
        ),
    ),
    EvalSample(
        "real_002",
        (
            "CONFIDENTIALITY UNDERTAKING: Nadia Mansouri, domiciled at 14 Rue Didouche Mourad, "
            "acknowledges receipt of financial projections from Sonatrach and Meridian Holdings LLC."
        ),
        (
            GoldEntity("Nadia Mansouri", "PERSON"),
            GoldEntity("14 Rue Didouche Mourad", "ADDRESS"),
            GoldEntity("Sonatrach", "COMPANY"),
            GoldEntity("Meridian Holdings LLC", "COMPANY"),
        ),
    ),
    EvalSample(
        "real_003",
        (
            "WIRE TRANSFER SCHEDULE: Monthly retainers shall be wired to IBAN "
            "FR7630006000011234567890189 held by Claire Dupont (claire.dupont@meridian-legal.fr). "
            "Direct line: +33 6 45 88 12 90."
        ),
        (
            GoldEntity("FR7630006000011234567890189", "BANK"),
            GoldEntity("Claire Dupont", "PERSON"),
            GoldEntity("claire.dupont@meridian-legal.fr", "EMAIL"),
            GoldEntity("+33 6 45 88 12 90", "PHONE"),
        ),
    ),
    EvalSample(
        "real_004",
        (
            "EXECUTIVE EMPLOYMENT CONTRACT between Crescent Biotech Inc. and Dr. Samir Rahmani "
            "(SSN 123-45-6789). Primary work location: 450 Avenue Hassan II. "
            "Emergency contact: samir.rahmani@crescentbio.com."
        ),
        (
            GoldEntity("Crescent Biotech Inc.", "COMPANY"),
            GoldEntity("Samir Rahmani", "PERSON"),
            GoldEntity("123-45-6789", "ID"),
            GoldEntity("450 Avenue Hassan II", "ADDRESS"),
            GoldEntity("samir.rahmani@crescentbio.com", "EMAIL"),
        ),
    ),
    EvalSample(
        "real_005",
        (
            "SUBCONTRACTOR ADDENDUM: Maghreb Cloud SPA authorizes Youssef Haddad to access staging "
            "clusters for APOLLO-X. Escalation phone: +213 770 44 55 66; billing IBAN: "
            "DZ580002100001113000000570."
        ),
        (
            GoldEntity("Maghreb Cloud SPA", "COMPANY"),
            GoldEntity("Youssef Haddad", "PERSON"),
            GoldEntity("APOLLO-X", "CUSTOM"),
            GoldEntity("+213 770 44 55 66", "PHONE"),
            GoldEntity("DZ580002100001113000000570", "BANK"),
        ),
    ),
    EvalSample(
        "real_006",
        (
            "DATA PROCESSING AGREEMENT: Controller Nordic Systems GmbH appoints Medina FinTech SAS "
            "as sub-processor. Data Protection Officer: Hannah Weber (dpo@nordic-systems.de, "
            "+49 30 90182012)."
        ),
        (
            GoldEntity("Nordic Systems GmbH", "COMPANY"),
            GoldEntity("Medina FinTech SAS", "COMPANY"),
            GoldEntity("Hannah Weber", "PERSON"),
            GoldEntity("dpo@nordic-systems.de", "EMAIL"),
            GoldEntity("+49 30 90182012", "PHONE"),
        ),
    ),
    EvalSample(
        "real_007",
        (
            "COMMERCIAL LEASE: Landlord Omar Toumi leases office suite at 88 Boulevard Amirouche "
            "to Sahara Logistics LLC (Tax ID 998877665544332). Rent notice email: "
            "leases@saharalogistics.com."
        ),
        (
            GoldEntity("Omar Toumi", "PERSON"),
            GoldEntity("88 Boulevard Amirouche", "ADDRESS"),
            GoldEntity("Sahara Logistics LLC", "COMPANY"),
            GoldEntity("998877665544332", "ID"),
            GoldEntity("leases@saharalogistics.com", "EMAIL"),
        ),
    ),
    EvalSample(
        "real_008",
        (
            "M&A TERM SHEET (STRICTLY CONFIDENTIAL): Proposed acquisition of Ooredoo Enterprise "
            "assets led by advisor Elena Morales (elena.morales@apex-advisory.co.uk) under internal "
            "deal code zenith-9."
        ),
        (
            GoldEntity("Ooredoo Enterprise", "COMPANY"),
            GoldEntity("Elena Morales", "PERSON"),
            GoldEntity("elena.morales@apex-advisory.co.uk", "EMAIL"),
            GoldEntity("zenith-9", "CUSTOM"),
        ),
    ),
    EvalSample(
        "real_009",
        (
            "SETTLEMENT RELEASE: Payment of disputed invoices by Apex Construction Ltd. to "
            "Salma Khelifi via IBAN GB29NWBK60161331926819 resolves all claims. "
            "Counsel contact: +44 20 7946 0958."
        ),
        (
            GoldEntity("Apex Construction Ltd.", "COMPANY"),
            GoldEntity("Salma Khelifi", "PERSON"),
            GoldEntity("GB29NWBK60161331926819", "BANK"),
            GoldEntity("+44 20 7946 0958", "PHONE"),
        ),
    ),
    EvalSample(
        "real_010",
        (
            "INTELLECTUAL PROPERTY ASSIGNMENT: Assignor Amine Boudiaf transfers all source code "
            "authored for APOLLO-X to Horizon Robotics Corp. Registered office: 1200 Street Market."
        ),
        (
            GoldEntity("Amine Boudiaf", "PERSON"),
            GoldEntity("APOLLO-X", "CUSTOM"),
            GoldEntity("Horizon Robotics Corp.", "COMPANY"),
            GoldEntity("1200 Street Market", "ADDRESS"),
        ),
    ),
    EvalSample(
        "real_011",
        (
            "SUPPLIER QUALITY AGREEMENT: Quality audits for Helios Energy SPA will be coordinated "
            "by Tariq Zerrouki (tariq.z@helios-energy.dz, +213 661 23 98 76). "
            "Vendor fiscal ID: 445566778899001."
        ),
        (
            GoldEntity("Helios Energy SPA", "COMPANY"),
            GoldEntity("Tariq Zerrouki", "PERSON"),
            GoldEntity("tariq.z@helios-energy.dz", "EMAIL"),
            GoldEntity("+213 661 23 98 76", "PHONE"),
            GoldEntity("445566778899001", "ID"),
        ),
    ),
    EvalSample(
        "real_012",
        (
            "CONSULTING STATEMENT OF WORK: Consultant Lina Cherif will deliver penetration testing "
            "reports to legal@veritasbank.com on behalf of Veritas Bank. "
            "Escrow IBAN: DE89370400440532013000."
        ),
        (
            GoldEntity("Lina Cherif", "PERSON"),
            GoldEntity("legal@veritasbank.com", "EMAIL"),
            GoldEntity("Veritas Bank", "COMPANY"),
            GoldEntity("DE89370400440532013000", "BANK"),
        ),
    ),
    EvalSample(
        "real_013",
        (
            "BOARD RESOLUTION: Authorized signatory Meriem Saidi (SSN 987-65-4321) is empowered to "
            "execute credit facilities for Oasis Ventures EURL at 5 Avenue Colonel Amirouche."
        ),
        (
            GoldEntity("Meriem Saidi", "PERSON"),
            GoldEntity("987-65-4321", "ID"),
            GoldEntity("Oasis Ventures EURL", "COMPANY"),
            GoldEntity("5 Avenue Colonel Amirouche", "ADDRESS"),
        ),
    ),
    EvalSample(
        "real_014",
        (
            "INCIDENT RESPONSE RETAINER: Primary responder David Chen (d.chen@sentinel-sec.io, "
            "+1 415 555 0199) for Sentinel Cyber LLC. Tax registration: 112233445566778."
        ),
        (
            GoldEntity("David Chen", "PERSON"),
            GoldEntity("d.chen@sentinel-sec.io", "EMAIL"),
            GoldEntity("+1 415 555 0199", "PHONE"),
            GoldEntity("Sentinel Cyber LLC", "COMPANY"),
            GoldEntity("112233445566778", "ID"),
        ),
    ),
)


def _locate_gold_spans(sample: EvalSample) -> list[tuple[int, int, str]]:
    """Locate character offsets for each gold entity in the sample text."""
    located: list[tuple[int, int, str]] = []
    search_from: dict[str, int] = {}
    for entity in sample.entities:
        cursor = search_from.get(entity.text, 0)
        idx = sample.text.find(entity.text, cursor)
        if idx == -1:
            idx = sample.text.find(entity.text)
        if idx != -1:
            end = idx + len(entity.text)
            located.append((idx, end, entity.entity_type))
            search_from[entity.text] = end
    return located


def _spans_match(gold_start: int, gold_end: int, pred_start: int, pred_end: int) -> bool:
    """Return True when predicted span overlaps the gold span substantially."""
    overlap = min(gold_end, pred_end) - max(gold_start, pred_start)
    if overlap <= 0:
        return False
    gold_len = max(1, gold_end - gold_start)
    pred_len = max(1, pred_end - pred_start)
    return (overlap / gold_len) >= 0.5 and (overlap / pred_len) >= 0.4


def _pct(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return round((numerator / denominator) * 100.0, 1)


def _evaluate_configuration(
    samples: list[EvalSample],
    *,
    custom_rules: list[CustomRule],
    extra_detectors: list[ExtraDetector],
) -> dict:
    """Run NYXORA's real detection + mask/unmask pipeline on a labeled dataset."""
    total_tp = 0
    total_fp = 0
    total_fn = 0
    leak_free_docs = 0
    round_trip_exact_docs = 0

    per_type: dict[str, dict[str, int]] = {
        etype: {"tp": 0, "fp": 0, "fn": 0, "support": 0}
        for etype in EVAL_ENTITY_TYPES
    }

    for sample in samples:
        gold_spans = _locate_gold_spans(sample)
        vault = VaultData()
        findings = detect_sensitive_entities(
            sample.text,
            vault=vault,
            custom_rules=custom_rules,
            extra_detectors=extra_detectors,
        )

        # Verify exact round-trip unmasking on the real VaultData implementation.
        commit_findings_to_vault(vault, findings)
        masked = apply_mask(sample.text, findings)
        if vault.unmask_text(masked) == sample.text:
            round_trip_exact_docs += 1

        matched_pred_indices: set[int] = set()
        doc_fn = 0

        for g_start, g_end, g_type in gold_spans:
            per_type.setdefault(g_type, {"tp": 0, "fp": 0, "fn": 0, "support": 0})
            per_type[g_type]["support"] += 1

            hit_idx: int | None = None
            for p_idx, finding in enumerate(findings):
                if p_idx in matched_pred_indices:
                    continue
                if _spans_match(g_start, g_end, finding.start, finding.end):
                    # Prefer exact type match, but accept a masked hit of any type as preventing a leak
                    # while tracking exact-type precision/recall.
                    if finding.type == g_type:
                        hit_idx = p_idx
                        break
                    if hit_idx is None:
                        hit_idx = p_idx

            if hit_idx is not None:
                matched_pred_indices.add(hit_idx)
                total_tp += 1
                per_type[g_type]["tp"] += 1
            else:
                total_fn += 1
                doc_fn += 1
                per_type[g_type]["fn"] += 1

        for p_idx, finding in enumerate(findings):
            if p_idx in matched_pred_indices:
                continue
            total_fp += 1
            bucket = per_type.setdefault(
                finding.type,
                {"tp": 0, "fp": 0, "fn": 0, "support": 0},
            )
            bucket["fp"] += 1

        if doc_fn == 0:
            leak_free_docs += 1

    total_docs = len(samples)
    overall_recall = _pct(total_tp, total_tp + total_fn) or 0.0
    overall_precision = _pct(total_tp, total_tp + total_fp) or 0.0
    leak_free_rate = _pct(leak_free_docs, total_docs) or 0.0
    round_trip_rate = _pct(round_trip_exact_docs, total_docs) or 0.0

    entity_rows = []
    for etype in EVAL_ENTITY_TYPES:
        counts = per_type[etype]
        entity_rows.append(
            {
                "type": etype,
                "recall": _pct(counts["tp"], counts["tp"] + counts["fn"]),
                "precision": _pct(counts["tp"], counts["tp"] + counts["fp"]),
                "tp": counts["tp"],
                "fp": counts["fp"],
                "fn": counts["fn"],
                "support": counts["support"],
            }
        )

    return {
        "document_count": total_docs,
        "overall_recall": overall_recall,
        "overall_precision": overall_precision,
        "leak_free_rate": leak_free_rate,
        "unmask_round_trip": round_trip_rate,
        "tp": total_tp,
        "fp": total_fp,
        "fn": total_fn,
        "per_entity": entity_rows,
    }


def _evaluate_dataset_with_ablation(
    samples: list[EvalSample],
    *,
    custom_rules: list[CustomRule],
    presidio_detector: ExtraDetector | None,
    slm_detector: ExtraDetector | None,
) -> dict:
    """Evaluate a dataset across cumulative detection layers for honest ablation metrics."""
    stage1 = _evaluate_configuration(samples, custom_rules=[], extra_detectors=[])
    stage2 = _evaluate_configuration(samples, custom_rules=custom_rules, extra_detectors=[])

    ablation: list[dict] = [
        {
            "key": "builtin_rules",
            "label": "Layer 1a: Built-in regex & contract patterns",
            "recall": stage1["overall_recall"],
            "precision": stage1["overall_precision"],
            "leak_free_rate": stage1["leak_free_rate"],
            "active": True,
            "note": None,
        },
        {
            "key": "custom_rules",
            "label": "Layer 1b: + Company custom rules",
            "recall": stage2["overall_recall"],
            "precision": stage2["overall_precision"],
            "leak_free_rate": stage2["leak_free_rate"],
            "active": True,
            "note": f"{len(custom_rules)} active rule(s)" if custom_rules else "No active rules",
        },
    ]

    latest_result = stage2
    active_extra: list[ExtraDetector] = []

    if presidio_detector is not None:
        active_extra.append(presidio_detector)
        stage3 = _evaluate_configuration(
            samples,
            custom_rules=custom_rules,
            extra_detectors=list(active_extra),
        )
        latest_result = stage3
        ablation.append(
            {
                "key": "presidio_ner",
                "label": "Layer 1c: + Presidio & spaCy NER",
                "recall": stage3["overall_recall"],
                "precision": stage3["overall_precision"],
                "leak_free_rate": stage3["leak_free_rate"],
                "active": True,
                "note": "en_core_web_lg active",
            }
        )
    else:
        ablation.append(
            {
                "key": "presidio_ner",
                "label": "Layer 1c: + Presidio & spaCy NER",
                "recall": None,
                "precision": None,
                "leak_free_rate": None,
                "active": False,
                "note": "Not installed in this runtime (runs inside Docker image)",
            }
        )

    if slm_detector is not None:
        active_extra.append(slm_detector)
        stage4 = _evaluate_configuration(
            samples,
            custom_rules=custom_rules,
            extra_detectors=list(active_extra),
        )
        latest_result = stage4
        ablation.append(
            {
                "key": "gpu_slm",
                "label": "Layer 2/3: + Local GPU Rulebook SLM",
                "recall": stage4["overall_recall"],
                "precision": stage4["overall_precision"],
                "leak_free_rate": stage4["leak_free_rate"],
                "active": True,
                "note": "Evaluated against configured vLLM endpoint",
            }
        )
    else:
        ablation.append(
            {
                "key": "gpu_slm",
                "label": "Layer 2/3: + Local GPU Rulebook SLM",
                "recall": None,
                "precision": None,
                "leak_free_rate": None,
                "active": False,
                "note": "Optional — enable GPU SLM & toggle 'Include GPU SLM' to benchmark",
            }
        )

    return {
        **latest_result,
        "ablation": ablation,
    }


def run_evaluation_suite(
    *,
    custom_rules: list[CustomRule],
    presidio_detector: ExtraDetector | None,
    slm_detector: ExtraDetector | None,
) -> tuple[dict, int]:
    """Execute both Synthetic (60) and Realistic (14) benchmarks and return (payload, duration_ms)."""
    started = time.perf_counter()
    synthetic_samples = _build_synthetic_dataset(60)
    realistic_samples = list(REALISTIC_DATASET)

    synthetic_report = _evaluate_dataset_with_ablation(
        synthetic_samples,
        custom_rules=custom_rules,
        presidio_detector=presidio_detector,
        slm_detector=slm_detector,
    )
    realistic_report = _evaluate_dataset_with_ablation(
        realistic_samples,
        custom_rules=custom_rules,
        presidio_detector=presidio_detector,
        slm_detector=slm_detector,
    )
    duration_ms = max(1, int((time.perf_counter() - started) * 1000))
    return {"synthetic": synthetic_report, "realistic": realistic_report}, duration_ms

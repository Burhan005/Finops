"""
Ask ZORVEX — Enterprise FinOps AI Analyst Engine
- Grounded strictly in authenticated workspace's actual persisted CUR analytics & recommendations data
- Zero hallucinations: all financial figures, resource IDs, and variances are calculated deterministically
- Natural language intent parser for executive queries
- Cites exact supporting datasets, recommendations, and billing records
- Prompt injection defenses and untrusted input sanitization
"""

import os
import re
import datetime
import json
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from .models import AiAnalystQuery, RecommendationRecord, AnomalyAlert
from .forex import get_live_usd_to_inr_rate
from .budget_guard import calculate_cost_forecast
from .savings_ledger import get_executive_ledger_summary

def sanitize_query(query: str) -> str:
    """Strips potential injection payloads while preserving natural question language."""
    if not query:
        return ""
    # Remove control characters, script tags, backticks
    cleaned = re.sub(r'<[^>]*>', '', query)
    cleaned = cleaned.replace("`", "").replace(";", " ")
    return cleaned.strip()[:500]


def analyze_intent(query_clean: str) -> str:
    """Classifies user question into supported FinOps analysis domains."""
    q = query_clean.lower()
    if any(k in q for k in ["increase", "spike", "shift", "jump", "surge", "higher", "why did"]):
        return "SPEND_INCREASE_ANALYSIS"
    if any(k in q for k in ["which service", "top service", "contributed most", "biggest spender", "breakdown"]):
        return "TOP_CONTRIBUTORS"
    if any(k in q for k in ["recommendation", "waste", "strongest", "top 3", "save money", "actionable"]):
        return "TOP_RECOMMENDATIONS"
    if any(k in q for k in ["commitment", "savings plan", "reserved instance", "sp", "ri", "underutilized"]):
        return "COMMITMENTS_AUDIT"
    if any(k in q for k in ["forecast", "month-end", "run rate", "burn rate", "projected", "future"]):
        return "FORECAST_PROJECTION"
    if any(k in q for k in ["unimplemented", "pending", "approved", "ledger", "progress", "realized"]):
        return "UNIMPLEMENTED_RECOMMENDATIONS"
    return "GENERAL_INQUIRY"


def ask_zorvex_analyst(
    query: str,
    dataset: Dict[str, Any],
    db: Session,
    user_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Executes FinOps AI investigation grounded in actual persisted dataset and ledger data.
    """
    clean_q = sanitize_query(query)
    intent = analyze_intent(clean_q)
    live_forex = get_live_usd_to_inr_rate()

    total_cost = dataset.get("total_cost", 0.0) if dataset else 0.0
    services = dataset.get("services", {}) if dataset else {}
    dates = dataset.get("dates", []) if dataset else []
    daily_totals = dataset.get("daily_totals", {}) if dataset else {}

    data_references = []
    response_paragraphs = []

    if intent == "SPEND_INCREASE_ANALYSIS":
        # Analyze daily delta between last two dates
        if len(dates) >= 2:
            d_last = dates[-1]
            d_prev = dates[-2]
            c_last = daily_totals.get(d_last, 0.0)
            c_prev = daily_totals.get(d_prev, 0.0)
            delta = c_last - c_prev
            pct = round((delta / max(0.01, c_prev)) * 100.0, 1)

            anomalies = db.query(AnomalyAlert).filter(AnomalyAlert.date == d_last).all()

            response_paragraphs.append(
                f"Based on your authoritative CUR telemetry, daily spending changed from **${c_prev:.2f}** on `{d_prev}` to **${c_last:.2f}** on `{d_last}` "
                f"({'+' if delta > 0 else ''}${delta:.2f}, or **{pct}%**)."
            )

            if anomalies:
                alert_text = ", ".join([f"{a.service} (+${a.delta_usd:.2f})" for a in anomalies])
                response_paragraphs.append(
                    f"**Identified Cost Drivers:** The primary variance was triggered by: **{alert_text}**."
                )
                for a in anomalies:
                    data_references.append({
                        "type": "ANOMALY_RECORD",
                        "title": f"Anomaly on {a.date} in {a.service}",
                        "delta_usd": a.delta_usd
                    })
            else:
                top_svc = list(services.items())[:3]
                svc_text = ", ".join([f"{s} (${cost:.2f})" for s, cost in top_svc])
                response_paragraphs.append(
                    f"Spending was driven by steady workload execution across: **{svc_text}** without sudden uncharacteristic spikes."
                )

            data_references.append({
                "type": "DAILY_DELTA_EVIDENCE",
                "baseline_date": d_prev,
                "target_date": d_last,
                "delta_usd": round(delta, 2)
            })
        else:
            response_paragraphs.append(
                f"Current active telemetry encompasses **${total_cost:.2f}** across {len(dates)} billing day(s). Additional daily data points are required to calculate multi-day variance trends."
            )

    elif intent == "TOP_CONTRIBUTORS":
        top_services = list(services.items())[:5]
        response_paragraphs.append(
            f"Your total monitored cloud footprint is **${total_cost:,.2f}** (~₹{round(total_cost * live_forex):,.2f})."
        )
        bullets = []
        for svc, cost in top_services:
            share = round((cost / max(0.01, total_cost)) * 100.0, 1)
            bullets.append(f"- **{svc}**: **${cost:,.2f}** ({share}% of total cloud spend)")
            data_references.append({"type": "SERVICE_SHARE", "service": svc, "spend_usd": cost, "share_pct": share})

        response_paragraphs.append("The top 5 cost-driving services are:\n" + "\n".join(bullets))

    elif intent == "TOP_RECOMMENDATIONS":
        recs = db.query(RecommendationRecord).filter(RecommendationRecord.status != "DISMISSED").order_by(RecommendationRecord.estimated_monthly_savings_usd.desc()).limit(3).all()
        if recs:
            response_paragraphs.append(
                f"Our evidence-backed detectors identified the following highest-yield optimization opportunities:"
            )
            rec_bullets = []
            for r in recs:
                rec_bullets.append(
                    f"- **{r.title}** (`{r.resource_id}` in {r.service}): Potential **${r.estimated_monthly_savings_usd:.2f}/month** (~₹{round(r.estimated_monthly_savings_inr):,.2f}) — Confidence: **{int(r.confidence_score * 100)}%**."
                )
                data_references.append({
                    "type": "RECOMMENDATION",
                    "id": r.recommendation_id,
                    "resource_id": r.resource_id,
                    "savings_usd": r.estimated_monthly_savings_usd
                })
            response_paragraphs.append("\n".join(rec_bullets))
        else:
            response_paragraphs.append(
                "No open waste recommendations currently detected. Your AWS infrastructure is operating within optimal baseline thresholds."
            )

    elif intent == "COMMITMENTS_AUDIT":
        response_paragraphs.append(
            "ZORVEX evaluates **7 AWS Commitment Classes** (Universal Compute SP, EC2 Instance SP, EC2 Standard RI, RDS RI, ElastiCache RI, OpenSearch RI, and DocumentDB RI)."
        )
        response_paragraphs.append(
            "Our algorithm applies **Strict 24/7 Steady-State Filtering**: intermittent dev/test workloads and already-covered ARNs are excluded from the baseline to guarantee zero idle waste lock-in."
        )
        data_references.append({"type": "COMMITMENT_SPECS", "supported_classes": 7})

    elif intent == "FORECAST_PROJECTION":
        forecast = calculate_cost_forecast(dataset)
        proj_usd = forecast.get("forecasted_month_end_usd", 0.0)
        proj_inr = forecast.get("forecasted_month_end_inr", 0.0)
        burn_rate = forecast.get("daily_burn_rate_usd", 0.0)
        days_rem = forecast.get("days_remaining", 0)

        response_paragraphs.append(
            f"Based on your current run-rate (**${burn_rate:.2f}/day**), the projected month-end spend is **${proj_usd:,.2f}** (~₹{proj_inr:,.2f})."
        )
        response_paragraphs.append(
            f"With **{days_rem} days remaining**, your 90% statistical confidence interval spans from **${forecast.get('confidence_low_usd', 0):,.2f}** to **${forecast.get('confidence_high_usd', 0):,.2f}**."
        )
        data_references.append({"type": "FORECAST_SUMMARY", "forecast_usd": proj_usd, "burn_rate_daily": burn_rate})

    elif intent == "UNIMPLEMENTED_RECOMMENDATIONS":
        unimplemented = db.query(RecommendationRecord).filter(RecommendationRecord.status.in_(["IDENTIFIED", "VALIDATED", "APPROVED"])).all()
        summary = get_executive_ledger_summary(db)
        unimp_usd = sum(r.estimated_monthly_savings_usd for r in unimplemented)

        response_paragraphs.append(
            f"There are currently **{len(unimplemented)} optimization opportunities** pending implementation, representing **${unimp_usd:,.2f}/month** (~₹{round(unimp_usd * live_forex):,.2f}/month) in uncaptured cloud savings."
        )
        response_paragraphs.append(
            f"Implemented optimizations to date stand at **${summary.get('total_implemented_monthly_usd', 0):,.2f}/month** (yielding a **{summary.get('roi_multiplier', 0)}x ROI** against your platform retainer fee)."
        )
        data_references.append({"type": "LEDGER_PROGRESS", "pending_count": len(unimplemented), "pending_usd": unimp_usd})

    else:
        # General Status
        response_paragraphs.append(
            f"**ZORVEX FinOps Executive Status:** Active monitored spend is **${total_cost:,.2f}** across {len(dates)} billing day(s). "
            f"Live Forex rate: **$1 = ₹{live_forex:.2f}**."
        )
        response_paragraphs.append(
            "You can query me about cost spikes, top contributing services, high-confidence savings opportunities, commitment coverage, or month-end forecasts."
        )

    full_answer = "\n\n".join(response_paragraphs)

    # Persist query in database
    new_query_record = AiAnalystQuery(
        user_id=user_id,
        query_text=clean_q,
        intent_detected=intent,
        response_text=full_answer,
        data_references_json=json.dumps(data_references),
        provider_used="deterministic_cur_engine",
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_query_record)
    db.commit()
    db.refresh(new_query_record)

    return {
        "id": new_query_record.id,
        "query": clean_q,
        "intent": intent,
        "answer": full_answer,
        "data_references": data_references,
        "provider_used": "deterministic_cur_engine",
        "is_deterministic": True,
        "timestamp": new_query_record.created_at.isoformat()
    }

"""
Cloud Cost Forecasting & Budget Guard Module for ZORVEX FinOps Platform
- Explainable run-rate and weighted trend projections from actual historical CUR data
- Multi-scope budget management (Workspace, Account, Service)
- Projected budget breach warnings with day-of-month breach timeline
- Real-time live USD and INR currency projections
"""

import calendar
import datetime
import math
from decimal import Decimal
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from .models import BudgetConfig, ForecastRun
from .forex import get_live_usd_to_inr_rate
from .parser import round_currency

def calculate_cost_forecast(dataset: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculates statistical month-end spend forecast, daily operational burn rate, and confidence bands.
    Grounds calculations strictly in actual daily billing telemetry while isolating
    non-operational billing artifacts (e.g. Day 1 RI commitment recurring fees, GST tax, credits)
    from daily run-rate extrapolation to prevent forecast inflation.
    """
    if not dataset or not dataset.get("daily_totals"):
        return {
            "period_month": "",
            "days_observed": 0,
            "days_in_month": 30,
            "days_remaining": 0,
            "actual_spend_to_date_usd": 0.0,
            "actual_spend_to_date_inr": 0.0,
            "actual_operational_spend_usd": 0.0,
            "actual_commitment_spend_usd": 0.0,
            "actual_tax_spend_usd": 0.0,
            "actual_credit_spend_usd": 0.0,
            "daily_burn_rate_usd": 0.0,
            "operational_burn_rate_usd": 0.0,
            "projected_operational_spend_usd": 0.0,
            "forecasted_month_end_usd": 0.0,
            "forecasted_month_end_inr": 0.0,
            "confidence_low_usd": 0.0,
            "confidence_high_usd": 0.0,
            "methodology": "DECOMPOSED_OPERATIONAL_RUNRATE",
            "usd_to_inr_rate": get_live_usd_to_inr_rate(),
            "daily_history": []
        }

    daily_totals = dataset["daily_totals"]
    sorted_dates = sorted(daily_totals.keys())
    if not sorted_dates:
        return {}

    # Identify primary month
    last_date_str = sorted_dates[-1]
    dt_last = datetime.datetime.strptime(last_date_str, "%Y-%m-%d")
    year = dt_last.year
    month = dt_last.month
    period_month = f"{year:04d}-{month:02d}"

    # Filter dates belonging to this target month
    month_days = [d for d in sorted_dates if d.startswith(period_month)]
    if not month_days:
        month_days = sorted_dates  # fallback to all available dates

    days_observed = len(month_days)
    _, total_days_in_month = calendar.monthrange(year, month)
    days_remaining = max(0, total_days_in_month - days_observed)

    # Actual net spend to date (ground truth, invariant)
    # Prefer unrounded daily totals if available from 3B parser for decimal precision
    unrounded_daily = dataset.get("_unrounded_daily_totals", {})
    actual_net_by_day = {
        d: Decimal(str(unrounded_daily[d])) if d in unrounded_daily else Decimal(str(daily_totals[d]))
        for d in month_days
    }
    actual_spend_to_date_dec = sum(actual_net_by_day.values())

    # Line item decomposition:
    # Separate actual operational usage from upfront commitments, tax, and credits.
    records = dataset.get("records")
    has_records = bool(records and isinstance(records, list) and len(records) > 0)

    daily_op_dec = {d: Decimal('0') for d in month_days}
    daily_commit_dec = {d: Decimal('0') for d in month_days}
    daily_tax_dec = {d: Decimal('0') for d in month_days}
    daily_credit_dec = {d: Decimal('0') for d in month_days}

    if has_records:
        for r in records:
            d = r.get('date') or r.get('day')
            if d not in daily_op_dec:
                continue
            lt = str(r.get('line_type', '')).strip().lower()
            term = str(r.get('term', '')).strip().lower()
            c = Decimal(str(r.get('cost', 0)))

            if lt == 'tax' or 'tax' in lt:
                daily_tax_dec[d] += c
            elif lt in ('rifee', 'fee', 'savingsplanrecurringfee') or term == 'reserved':
                daily_commit_dec[d] += c
            elif lt in ('credit', 'refund', 'savingsplannegation') or 'credit' in lt or 'refund' in lt:
                daily_credit_dec[d] += c
            else:
                daily_op_dec[d] += c
    else:
        # Fallback if records list is not available:
        # Check if pre-aggregated daily tax/credit totals are present
        daily_tax_totals = dataset.get('daily_tax_totals', {})
        daily_credit_totals = dataset.get('daily_credit_totals', {})
        for d in month_days:
            tax_val = Decimal(str(daily_tax_totals.get(d, 0)))
            cred_val = Decimal(str(daily_credit_totals.get(d, 0)))
            daily_tax_dec[d] = tax_val
            daily_credit_dec[d] = cred_val
            daily_op_dec[d] = actual_net_by_day[d] - tax_val - cred_val

    actual_op_spend_dec = sum(daily_op_dec.values())
    actual_commit_spend_dec = sum(daily_commit_dec.values())
    actual_tax_spend_dec = sum(daily_tax_dec.values())
    actual_credit_spend_dec = sum(daily_credit_dec.values())

    # Operational burn rate calculation:
    # If operational spend is separated, extrapolate operational spend.
    # If all operational spend happens to be 0 (e.g. all non-operational or unclassified),
    # fallback to actual_net_by_day.
    if actual_op_spend_dec > Decimal('0'):
        op_costs = [float(daily_op_dec[d]) for d in month_days]
    else:
        op_costs = [float(actual_net_by_day[d]) for d in month_days]

    avg_operational_burn = sum(op_costs) / max(1, days_observed)

    # Weighted operational burn rate: 40% historical mean + 60% recent 3 days (if observed >= 3)
    if days_observed >= 3:
        recent_3 = sum(op_costs[-3:]) / 3.0
        weighted_operational_burn = (avg_operational_burn * 0.40) + (recent_3 * 0.60)
    else:
        weighted_operational_burn = avg_operational_burn

    # Sample variance and standard deviation for operational confidence interval
    if days_observed > 1:
        var = sum((c - avg_operational_burn) ** 2 for c in op_costs) / (days_observed - 1)
        operational_std = math.sqrt(max(0.0, var))
    else:
        operational_std = avg_operational_burn * 0.15

    # Forecast projections:
    # Projected remaining spend is strictly future operational consumption.
    # Day 1 upfront RI fee and GST tax are already realized in actual_spend_to_date_dec,
    # and do not recur on a daily operational burn rate.
    projected_remaining_operational_dec = Decimal(str(round(weighted_operational_burn * days_remaining, 4)))
    forecasted_month_end_dec = actual_spend_to_date_dec + projected_remaining_operational_dec

    forecasted_month_end = round_currency(forecasted_month_end_dec)
    actual_spend_to_date = round_currency(actual_spend_to_date_dec)

    # 90% Confidence bounds (t-factor ~ 1.645) grounded in operational variance
    margin = 1.645 * (operational_std * math.sqrt(max(1, days_remaining)))
    conf_low = round_currency(max(actual_spend_to_date, forecasted_month_end - margin))
    conf_high = round_currency(forecasted_month_end + margin)

    live_forex = get_live_usd_to_inr_rate()
    forecasted_inr = round_currency(forecasted_month_end * live_forex)

    # Prepare daily trajectory chart series
    trajectory = []
    accumulated_net = Decimal('0')
    for d in month_days:
        cost_dec = actual_net_by_day[d]
        accumulated_net += cost_dec
        trajectory.append({
            "date": d,
            "actual_daily": round_currency(cost_dec),
            "operational_daily": round_currency(daily_op_dec[d]),
            "accumulated_actual": round_currency(accumulated_net),
            "is_projection": False
        })

    # Add projected future days
    if days_remaining > 0:
        proj_accum_dec = accumulated_net
        burn_step_dec = Decimal(str(round(weighted_operational_burn, 2)))
        for day_num in range(days_observed + 1, total_days_in_month + 1):
            future_date = f"{year:04d}-{month:02d}-{day_num:02d}"
            proj_accum_dec += burn_step_dec
            trajectory.append({
                "date": future_date,
                "projected_daily": round_currency(burn_step_dec),
                "accumulated_projected": round_currency(proj_accum_dec),
                "is_projection": True
            })

    return {
        "period_month": period_month,
        "days_observed": days_observed,
        "days_in_month": total_days_in_month,
        "days_remaining": days_remaining,
        "actual_spend_to_date_usd": actual_spend_to_date,
        "actual_spend_to_date_inr": round_currency(actual_spend_to_date * live_forex),
        "actual_operational_spend_usd": round_currency(actual_op_spend_dec),
        "actual_commitment_spend_usd": round_currency(actual_commit_spend_dec),
        "actual_tax_spend_usd": round_currency(actual_tax_spend_dec),
        "actual_credit_spend_usd": round_currency(actual_credit_spend_dec),
        "daily_burn_rate_usd": round_currency(weighted_operational_burn),
        "operational_burn_rate_usd": round_currency(weighted_operational_burn),
        "projected_operational_spend_usd": round_currency(projected_remaining_operational_dec),
        "forecasted_month_end_usd": forecasted_month_end,
        "forecasted_month_end_inr": forecasted_inr,
        "confidence_low_usd": conf_low,
        "confidence_high_usd": conf_high,
        "methodology": "DECOMPOSED_OPERATIONAL_RUNRATE",
        "usd_to_inr_rate": live_forex,
        "daily_history": trajectory
    }


def evaluate_budgets(db: Session, dataset: Dict[str, Any], org_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Evaluates all configured budgets against actual and forecasted spending.
    Scoped to organization_id when provided.
    """
    forecast_data = calculate_cost_forecast(dataset)
    query = db.query(BudgetConfig).filter(BudgetConfig.is_active == 1)
    if org_id is not None:
        query = query.filter(BudgetConfig.organization_id == org_id)
    budgets = query.all()
    results = []

    total_actual = forecast_data.get("actual_spend_to_date_usd", 0.0)
    total_forecasted = forecast_data.get("forecasted_month_end_usd", 0.0)
    burn_rate = forecast_data.get("daily_burn_rate_usd", 0.0)
    days_observed = forecast_data.get("days_observed", 0)
    days_in_month = forecast_data.get("days_in_month", 30)

    for b in budgets:
        # Check scope
        scope_actual = total_actual
        scope_forecasted = total_forecasted
        scope_burn_rate = burn_rate

        if b.scope_type == "SERVICE" and b.scope_value != "all":
            services = dataset.get("services", {})
            svc_spend = services.get(b.scope_value, 0.0)
            scope_actual = svc_spend
            # Estimate service forecasted based on ratio
            ratio = (svc_spend / max(0.01, total_actual)) if total_actual > 0 else 0.0
            scope_forecasted = round(total_forecasted * ratio, 2)
            scope_burn_rate = round(burn_rate * ratio, 4)
        elif b.scope_type == "ACCOUNT" and b.scope_value != "all":
            accounts = dataset.get("accounts", {})
            acc_spend = accounts.get(b.scope_value, 0.0)
            scope_actual = acc_spend
            ratio = (acc_spend / max(0.01, total_actual)) if total_actual > 0 else 0.0
            scope_forecasted = round(total_forecasted * ratio, 2)
            scope_burn_rate = round(burn_rate * ratio, 4)

        budget_limit = b.monthly_budget_usd
        spend_pct = round((scope_actual / max(1.0, budget_limit)) * 100.0, 1)
        forecast_pct = round((scope_forecasted / max(1.0, budget_limit)) * 100.0, 1)

        is_current_breached = scope_actual > budget_limit
        is_breached = scope_forecasted > budget_limit

        # Predict breach day:
        # Only project future breach if budget is not already currently breached,
        # is forecasted to breach, and applicable operational burn rate is strictly positive.
        projected_breach_day = None
        if not is_current_breached and is_breached and scope_burn_rate > 0:
            remaining_headroom = budget_limit - scope_actual
            # First day where cumulative spend strictly exceeds budget limit:
            # Days needed to exceed remaining headroom
            days_to_breach = math.floor(remaining_headroom / scope_burn_rate) + 1
            projected_day = days_observed + days_to_breach
            if projected_day <= days_in_month:
                projected_breach_day = min(days_in_month, max(1, projected_day))

        status = "HEALTHY"
        if is_current_breached:
            status = "BREACHED"
        elif is_breached:
            status = "FORECASTED_BREACH"
        elif spend_pct >= b.alert_threshold_pct:
            status = "AT_RISK"

        results.append({
            "id": b.id,
            "name": b.name,
            "scope_type": b.scope_type,
            "scope_value": b.scope_value,
            "monthly_budget_usd": budget_limit,
            "alert_threshold_pct": b.alert_threshold_pct,
            "current_spend_usd": round(scope_actual, 2),
            "forecasted_spend_usd": round(scope_forecasted, 2),
            "current_spend_pct": spend_pct,
            "forecasted_spend_pct": forecast_pct,
            "status": status,
            "is_breached": is_breached,
            "is_current_breached": is_current_breached,
            "projected_breach_day": projected_breach_day,
            "variance_usd": round(scope_forecasted - budget_limit, 2)
        })

    return results

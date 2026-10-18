"""Analytics and governance schemas for ZORVEX."""

from typing import Optional
from pydantic import BaseModel

class CompareRequest(BaseModel):
    baseline_date: str
    target_date: str
    account_id: Optional[str] = None

class DailyDeltaRequest(BaseModel):
    target_date: str
    baseline_date: Optional[str] = None
    account_id: Optional[str] = None

class MonthlyCompareRequest(BaseModel):
    baseline_month: str
    target_month: str
    account_id: Optional[str] = None

class RootCauseRequest(BaseModel):
    baseline_start: str
    baseline_end: str
    target_start: str
    target_end: str
    service: Optional[str] = None
    account_id: Optional[str] = None
    min_delta: Optional[float] = 0.001

class S3SyncConfigRequest(BaseModel):
    bucket_name: str
    region: Optional[str] = "us-east-1"
    prefix: Optional[str] = ""
    role_arn: Optional[str] = ""

class AgencyBrandingRequest(BaseModel):
    agency_name: str
    client_name: str
    prepared_by: str
    contact_email: Optional[str] = "cloudops@finopsclay.io"
    confidentiality_note: Optional[str] = "Strictly Confidential — Prepared for Executive Boardroom Review"

class UnitEconomicsRequest(BaseModel):
    metric_name: str
    metric_unit: str
    current_volume: float
    previous_volume: float
    target_unit_cost: Optional[float] = None
    notes: Optional[str] = ""

class SavingsPlanSimulatorRequest(BaseModel):
    commitment_hourly: Optional[float] = None
    reserved_units: Optional[int] = None
    term_years: int = 1
    payment_option: str = "NO_UPFRONT"
    plan_type: Optional[str] = "COMPUTE_SP"
    account_id: Optional[str] = None
    region: Optional[str] = None

class AnomalyActionRequest(BaseModel):
    user_name: Optional[str] = "Admin"
    notes: Optional[str] = None

class BudgetCreateRequest(BaseModel):
    name: str
    scope_type: str = "WORKSPACE"
    scope_value: str = "all"
    monthly_budget_usd: float
    alert_threshold_pct: float = 80.0
    notification_email: Optional[str] = None

class RecommendationStatusRequest(BaseModel):
    status: str
    user_name: Optional[str] = "Admin"
    notes: Optional[str] = None

class AiQueryRequest(BaseModel):
    query: str

class ExportTicketRequest(BaseModel):
    format: str = "html"
    baseline_date: Optional[str] = None
    target_date: Optional[str] = None
    account_id: Optional[str] = None

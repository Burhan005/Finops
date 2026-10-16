"""
SQLAlchemy Models for ZORVEX Enterprise FinOps Platform
Multi-tenant architecture with organization-level scoping, 
cryptographic reset tokens, normalized billing persistence, and foreign key integrity.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from .database import Base

def utc_now():
    """Generates timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    name = Column(String(128), nullable=False)
    company = Column(String(128), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=utc_now)

    organization = relationship("Organization", back_populates="users")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Integer, default=0, index=True)  # 1 = used, 0 = active
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="reset_tokens")


class ExportTicket(Base):
    __tablename__ = "export_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
    export_format = Column(String(16), default="html")  # 'html' or 'excel'
    params_json = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    used = Column(Integer, default=0, index=True)  # 1 = consumed, 0 = pending
    created_at = Column(DateTime, default=utc_now)


class DatasetRecord(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    filename = Column(String(255), index=True)
    filepath = Column(String(512))
    file_type = Column(String(32), default='upload')  # 'sample' or 'upload'
    checksum_sha256 = Column(String(64), index=True, nullable=True)
    total_cost = Column(Float, default=0.0)      # Gross operational spend
    net_cost = Column(Float, default=0.0)        # Net invoiced cost after credits/refunds/tax
    credits_total = Column(Float, default=0.0)   # Sum of credits
    refunds_total = Column(Float, default=0.0)   # Sum of refunds
    taxes_total = Column(Float, default=0.0)     # Sum of taxes
    total_rows = Column(Integer, default=0)
    is_active = Column(Integer, default=0, index=True)
    uploaded_at = Column(DateTime, default=utc_now)
    notes = Column(Text, nullable=True)

    billing_records = relationship("BillingRecord", back_populates="dataset", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_datasets_org_active", "organization_id", "is_active"),
    )


class BillingRecord(Base):
    __tablename__ = "billing_records"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), index=True, nullable=False)
    usage_date = Column(String(16), index=True, nullable=False)      # YYYY-MM-DD
    usage_month = Column(String(16), index=True, nullable=False)     # YYYY-MM
    usage_hour = Column(String(8), default="00:00")
    service = Column(String(64), index=True, nullable=False)
    resource_id = Column(String(255), index=True, nullable=False)
    short_id = Column(String(128), default="")
    account_id = Column(String(64), index=True, nullable=False)
    region = Column(String(64), index=True, nullable=False)
    cost = Column(Float, nullable=False, default=0.0)               # Effective operational cost
    unblended_cost = Column(Float, nullable=False, default=0.0)     # Raw unblended cost
    line_item_type = Column(String(32), index=True, nullable=False) # Usage, Credit, Refund, Tax, RIFee, Fee
    usage_type = Column(String(128), default="")
    pricing_term = Column(String(32), default="OnDemand")
    resource_name = Column(String(255), default="")
    sp_arn = Column(String(255), default="")
    ri_arn = Column(String(255), default="")
    created_at = Column(DateTime, default=utc_now)

    dataset = relationship("DatasetRecord", back_populates="billing_records")

    __table_args__ = (
        Index("ix_billing_records_dataset_service", "dataset_id", "service", "cost"),
        Index("ix_billing_records_dataset_date", "dataset_id", "usage_date", "cost"),
        Index("ix_billing_records_dataset_resource", "dataset_id", "resource_id", "cost"),
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    timestamp = Column(DateTime, default=utc_now)
    action = Column(String(64), index=True)  # UPLOAD, COMPARE, EXPORT, PASSWORD_RESET, AUTH_LOGIN
    ip_address = Column(String(64), nullable=True)
    details = Column(Text)


class S3SyncConfig(Base):
    __tablename__ = "s3_sync_configs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    bucket_name = Column(String(255), nullable=False)
    region = Column(String(64), default="us-east-1")
    prefix = Column(String(255), default="")
    role_arn = Column(String(255), nullable=True)
    is_enabled = Column(Integer, default=1)
    last_synced_at = Column(DateTime, nullable=True)
    last_status = Column(String(64), default="IDLE")  # IDLE, SYNCED, FAILED, NOT_CONFIGURED
    last_message = Column(Text, nullable=True)


class AgencyBrandingConfig(Base):
    __tablename__ = "agency_branding_configs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    agency_name = Column(String(255), default="Cloud FinOps Advisory Partners")
    client_name = Column(String(255), default="Enterprise Client Organization")
    prepared_by = Column(String(255), default="Burhan Kapasi, Principal FinOps Lead")
    contact_email = Column(String(255), default="cloudops@finopsclay.io")
    confidentiality_note = Column(Text, default="Strictly Confidential — Prepared for Executive Boardroom Review")
    updated_at = Column(DateTime, default=utc_now)


class UnitEconomicsConfig(Base):
    __tablename__ = "unit_economics_configs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    metric_name = Column(String(128), default="Monthly Active Users (MAU)")
    metric_unit = Column(String(64), default="Users")
    current_volume = Column(Float, default=25000.0)
    previous_volume = Column(Float, default=18000.0)
    target_unit_cost = Column(Float, default=0.10)
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utc_now)


class RecommendationRecord(Base):
    __tablename__ = "recommendations"
    __table_args__ = (
        UniqueConstraint("organization_id", "recommendation_id", name="uix_recommendations_org_rec"),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    recommendation_id = Column(String(128), index=True, nullable=False)
    category = Column(String(64), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    resource_id = Column(String(255), index=True, nullable=False)
    service = Column(String(64), index=True, nullable=False)
    region = Column(String(64), default="global")
    account_id = Column(String(64), default="all")
    status = Column(String(32), default="IDENTIFIED", index=True)
    estimated_monthly_savings_usd = Column(Float, default=0.0)
    estimated_monthly_savings_inr = Column(Float, default=0.0)
    realized_monthly_savings_usd = Column(Float, default=0.0)
    realized_monthly_savings_inr = Column(Float, default=0.0)
    confidence_score = Column(Float, default=0.90)
    risk_level = Column(String(32), default="LOW")
    evidence_json = Column(Text, nullable=True)
    remediation_type = Column(String(32), default="AWS_CLI")
    approved_by = Column(String(128), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    implemented_by = Column(String(128), nullable=True)
    implemented_at = Column(DateTime, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now)


class AnomalyAlert(Base):
    __tablename__ = "anomaly_alerts"
    __table_args__ = (
        UniqueConstraint("organization_id", "alert_key", name="uix_anomaly_alerts_org_alert"),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    alert_key = Column(String(128), index=True, nullable=False)
    date = Column(String(32), index=True, nullable=False)
    service = Column(String(64), index=True, nullable=False)
    account_id = Column(String(64), default="all")
    region = Column(String(64), default="global")
    severity = Column(String(32), default="WARNING", index=True)
    status = Column(String(32), default="OPEN", index=True)
    baseline_spend_usd = Column(Float, default=0.0)
    actual_spend_usd = Column(Float, default=0.0)
    delta_usd = Column(Float, default=0.0)
    delta_pct = Column(Float, default=0.0)
    root_cause_summary = Column(Text, nullable=False)
    evidence_json = Column(Text, nullable=True)
    acknowledged_by = Column(String(128), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(128), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)


class BudgetConfig(Base):
    __tablename__ = "budget_configs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    name = Column(String(128), nullable=False)
    scope_type = Column(String(32), default="WORKSPACE")
    scope_value = Column(String(128), default="all")
    monthly_budget_usd = Column(Float, nullable=False)
    alert_threshold_pct = Column(Float, default=80.0)
    notification_email = Column(String(255), nullable=True)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now)


class ForecastRun(Base):
    __tablename__ = "forecast_runs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    period_month = Column(String(16), index=True, nullable=False)
    methodology = Column(String(64), default="HOLT_WINTERS_RUNRATE")
    days_observed = Column(Integer, default=0)
    days_remaining = Column(Integer, default=0)
    actual_spend_to_date_usd = Column(Float, default=0.0)
    daily_burn_rate_usd = Column(Float, default=0.0)
    forecasted_month_end_usd = Column(Float, default=0.0)
    forecasted_month_end_inr = Column(Float, default=0.0)
    confidence_low_usd = Column(Float, default=0.0)
    confidence_high_usd = Column(Float, default=0.0)
    variance_pct = Column(Float, default=0.0)
    status = Column(String(32), default="COMPLETED")
    created_at = Column(DateTime, default=utc_now)


class AiAnalystQuery(Base):
    __tablename__ = "ai_analyst_queries"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    query_text = Column(Text, nullable=False)
    intent_detected = Column(String(64), default="GENERAL_INQUIRY")
    response_text = Column(Text, nullable=False)
    data_references_json = Column(Text, nullable=True)
    provider_used = Column(String(64), default="deterministic_cur_engine")
    created_at = Column(DateTime, default=utc_now)


class S3SyncExecutionHistory(Base):
    __tablename__ = "s3_sync_execution_history"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    s3_config_id = Column(Integer, ForeignKey("s3_sync_configs.id", ondelete="CASCADE"), index=True, nullable=True)
    started_at = Column(DateTime, default=utc_now)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(32), default="IN_PROGRESS")
    records_ingested = Column(Integer, default=0)
    bytes_downloaded = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    manifest_key = Column(String(512), nullable=True)

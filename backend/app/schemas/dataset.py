"""Dataset management schemas for ZORVEX."""

from typing import Optional
from pydantic import BaseModel

class SelectDatasetRequest(BaseModel):
    filename: str

class RenameDatasetRequest(BaseModel):
    dataset_id_or_filename: Optional[str] = None
    account_name: str
    propagate_to_account: bool = True

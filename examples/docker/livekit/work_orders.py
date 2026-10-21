"""Reusable typed metadata; canonical values stay independent of TTS readbacks."""
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator


class Equipment(BaseModel):
    equipment_id: str = Field(min_length=1,max_length=200)
    maintenance_type: str | None = None
    exhaust_fan_quantity: int | None = Field(default=None,ge=0,le=10000)
    panel_fan_quantity: int | None = Field(default=None,ge=0,le=10000)
    source_text: str | None = None
    readback_text: str | None = None


class SparePart(BaseModel):
    part_number: str = Field(min_length=1,max_length=200)
    serial_number: str = Field(min_length=1,max_length=200)
    equipment_id: str | None = None
    manufactured_on: date | None = None
    capacitance_value: Decimal | None = Field(default=None,ge=0)
    capacitance_unit: str | None = None
    source_text: str | None = None
    readback_text: str | None = None


class WorkOrder(BaseModel):
    reported_at: datetime | None = None
    customer: str | None = None
    work_order_name: str | None = None
    site_code: str | None = None
    test_result: str | None = None
    source_text: str | None = None
    readback_text: str | None = None
    equipment: list[Equipment] = Field(default_factory=list,max_length=100)
    spare_parts: list[SparePart] = Field(default_factory=list,max_length=100)

    @field_validator('reported_at')
    @classmethod
    def timezone_required(cls,value):
        if value is not None and value.tzinfo is None:
            raise ValueError('Reported time must include a timezone, e.g. +08:00')
        return value

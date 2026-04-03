from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..config.database import worker_calendar, collection_worker, db

class SlotItem(BaseModel):
    start: str
    end: str

class DayAvailability(BaseModel):
    workerId: str
    date: datetime
    availableStatus: str
    available: bool
    slots: Optional[List[SlotItem]] = None

from datetime import datetime, date

class AvailabilityRepository:

    @staticmethod
    def update_day(day: DayAvailability):
        # Convert slots to dicts
        slots_data = [slot.dict() for slot in day.slots] if day.available and day.slots else []

        # Convert date to datetime
        date_dt = datetime.combine(day.date, datetime.min.time()) if isinstance(day.date, date) else day.date

        result = worker_calendar.update_one(
            {"workerId": day.workerId, "date": date_dt},
            {"$set": {"available": day.available, "slots": slots_data}},
            upsert=True
        )
        return result
    @staticmethod
    def get_day(worker_id: str, date_value):
        # Ensure date_value is a datetime object
        if isinstance(date_value, str):
            date_value = datetime.strptime(date_value, "%Y-%m-%d")
        return worker_calendar.find_one({"workerId": worker_id, "date": date_value})
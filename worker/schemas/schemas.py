from pydantic import BaseModel, EmailStr, Field #pydantic validates all incoming requests loike the format is correcft or not
from typing import List, Optional, Dict, Literal, Union
from datetime import datetime

# This schema is used to validate customer-related requests
class CustomerSchema(BaseModel):
    id: Optional[int] = None 
    first_name: str
    last_name: str
    email: str
    password:str
    phoneNo:str
    address: Optional[str]
    province: Optional[str]
    role: str

class Availability(BaseModel):
    monday: Dict[str, bool]
    tuesday: Dict[str, bool]
    wednesday: Dict[str, bool]
    thursday: Dict[str, bool]
    friday: Dict[str, bool]
    saturday: Dict[str, bool]
    sunday: Dict[str, bool]
# This schema is used to validate worker-related requests


class SlotSchema(BaseModel):
    start: str   # "09:00"
    end:   str   # "17:00"

class SubSkill(BaseModel):
    name: str
    price: float = 0

class StatusUpdate(BaseModel):
    status: str 

class Skill(BaseModel):
    name: str
    price: Optional[float] = 0
    subSkills: List[SubSkill] = []

class WorkerCreateSchema(BaseModel):
    firstName:      str
    lastName:       str
    phoneNo:        str
    email:          str
    password:       str
    taskType:       str
    skills:         List[Skill]
    minHours:       Optional[int]                        = 1
    isAvailable:    Optional[bool]                       = True
    profilePhoto:   Optional[str]                        = ""
    description:    Optional[str]                        = ""
    serviceAreas:   List[str]                            = []
    face_verified:  Optional[bool]                       = False
    skill_verified: Optional[Union[bool, str]]           = False
    role:           Optional[Literal["worker", "admin"]] = "worker"
    hours:          Optional[Dict[str, List[SlotSchema]]] = Field(
        default_factory=lambda: {
            "Monday": [], "Tuesday": [], "Wednesday": [],
            "Thursday": [], "Friday": [], "Saturday": [], "Sunday": [],
        }
    )
class Coordinates(BaseModel):
    lat: float
    lng: float

class ServiceArea(BaseModel):
    primaryCity: Optional[str] = ""
    cities: List[str] = []
    coordinates: Optional[Coordinates] = None

class WorkerResponseSchema(BaseModel):
    id: str
    firstName: str
    lastName: str
    ratings: float
    taskType: str
    skills: List[Skill]
    noOfCompletedTask: int
    responseTime: int
    profilePhoto: Optional[str]
    description: Optional[str]
    isAvailable: bool
    minHours: int
    serviceArea: Optional[ServiceArea] = None

class ResetPasswordSchema(BaseModel):
    email:        str
    new_password: str

class LoginSchema(BaseModel):
    email:       EmailStr
    password:    str
    remember_me: bool = False   # ← add this


class EmailRequest(BaseModel):
    email: EmailStr
    
class OTPRequest(BaseModel):
    email: EmailStr
    otp: str

class TaskResponse(BaseModel):
    taskName: str
    taskType: str
    taskDescrip: str
    estimatedHours: int
    price: int
    selectedService: str
    address: str
    lat: str
    lng: str
    userId: str
    taskImg: Optional[List[str]] = Field(default_factory=list) 
    createdAt: float
    status: str

class DuplicateCheck(BaseModel):
    emailExists: bool
    phoneExists: Optional[bool] = None

class TaskRequest(BaseModel):
    query: str

class PredictionItem(BaseModel):
    label: str
    confidence: float

class PredictionResponse(BaseModel):
    broad: list[PredictionItem]
    sub: list[PredictionItem]

class Reviews(BaseModel):
    workerId: str
    user_id: str
    task_id :str
    createdAt: str
    stars: float
    text: str
    useful: int

class SearchSchema(BaseModel):
    id: str
    name: str    
    category: str   
    keywords: List[str]

class TextInput(BaseModel):
    text: str

class PredictionItem(BaseModel):
    label: str
    confidence: str

class PredictionResponse(BaseModel):
    text: str
    predicted_label: str
    confidence: str
    all_predictions: List[PredictionItem]
    
class ImagePredictionRequest(BaseModel):
    # Can be empty because we handle UploadFile
    pass

class ImagePredictionResponse(BaseModel):
    label: str
    confidence: float

# schemas/schemas.py
from pydantic import BaseModel, EmailStr
from typing import Optional

class GoogleLogin(BaseModel):
    email: EmailStr
    name: str
    google_id: str
    picture: Optional[str] = None

class GoogleLoginResponse(BaseModel):
    _id: str
    first_name: str
    last_name: str
    email: str
    picture: Optional[str] = None
    role: str
    phoneNo: Optional[str] = ""  # ✅ Match your DB structure
    access_token: str
    token_type: str
    is_new_user: bool
    
    class Config:
        from_attributes = True


class TaskResponseUpdate(BaseModel):
    status: str      # "confirmed" or "declined"
    userId: str  # so we know who to notify
    

class WorkerStatsResponse(BaseModel):
    tasksCompleted: int
    tasksPending: int
    totalTasks: int
    completionRate: float
    totalEarnings: float
    averageRating: float
    totalReviews: int
    recent_review: Optional[list]
    tasksToday: list
    tasksTomorrow: list
    tasksNextWeek: list

# schemas.py
class TaskOfferUpdate(BaseModel):
    estimatedHours: float
    additionalCost: float
    offerStatus: str

class RefundCreate(BaseModel):
    task_id: str
    requester_id: str
    reported_id: Optional[str]
    requester_type: Literal["customer","worker"]
    reported_type: Literal["customer","worker"]
    amount_customer: float = Field(..., ge=0)
    amount_worker: float = Field(..., ge=0)
    reason: str
    requested_by: Literal["customer","worker","admin"]
    esewa_ref_id: Optional[str]  # for eSewa sandbox

class RefundOut(BaseModel):
    id: str
    task_id: str
    requester_id: str
    reported_id: Optional[str]
    requester_type: str
    reported_type: str
    amount_customer: float
    amount_worker: float
    reason: str
    requested_by: str
    status: str
    admin_note: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]

class RefundUpdateStatus(BaseModel):
    status: Literal["approved","rejected"]
    admin_note: Optional[str]

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from bson import ObjectId


REPORT_REASONS = [
    "Fraud / Scam",
    "Harassment",
    "No show",
    "Poor quality work",
    "Fake profile",
    "Inappropriate behavior",
    "Other"
]

REPORT_STATUSES = ["pending", "resolved", "declined"]


# ── Pydantic Models ───────────────────────────────────────────────────────────

class CreateReportRequest(BaseModel):
    reporterId:   str   # email of the person filing the report
    reporterType: str   # "customer" | "worker"
    reportedId:   str   # email of the person being reported
    reportedType: str   # "customer" | "worker"
    reason:       str   # one of REPORT_REASONS
    description:  Optional[str] = ""


class UpdateReportStatusRequest(BaseModel):
    status:    str            # "resolved" | "declined"
    adminNote: Optional[str] = ""
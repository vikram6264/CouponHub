from pydantic import BaseModel
from typing import Optional
from datetime import date

class UserRegister(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class CouponSubmit(BaseModel):
    title: str
    code: str
    description: Optional[str] = ""
    category: str
    discount_type: str
    discount_value: Optional[str] = ""
    store: Optional[str] = ""
    expiry_date: Optional[date] = None

class CouponAction(BaseModel):
    status: str  # 'approved' or 'rejected'
    reject_reason: Optional[str] = ""

class UserBan(BaseModel):
    is_banned: bool

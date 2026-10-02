from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, Literal
from datetime import date

class UserRegister(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

class UserLogin(BaseModel):
    # str (not EmailStr): usernames like "vikram" are valid login identifiers
    email: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=1, max_length=128)

class CouponSubmit(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    code: str = Field(min_length=2, max_length=100)
    description: Optional[str] = Field(default="", max_length=2000)
    category: str
    discount_type: Literal['percent', 'flat', 'bogo', 'free_shipping'] = 'percent'
    discount_value: Optional[str] = Field(default=None, max_length=20)
    store: Optional[str] = Field(default=None, max_length=100)
    expiry_date: Optional[date] = None

    @field_validator('discount_value', 'store', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator('description', mode='before')
    @classmethod
    def none_desc_to_empty(cls, v):
        return v if v is not None else ""

class CouponAction(BaseModel):
    status: Literal['approved', 'rejected']
    reject_reason: Optional[str] = Field(default="", max_length=255)

class UserBan(BaseModel):
    is_banned: bool

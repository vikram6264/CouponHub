from fastapi import APIRouter, Depends, HTTPException
from database import get_db, get_cursor
from models import UserRegister, UserLogin
from auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])

@router.post("/register")
def register(data: UserRegister, db=Depends(get_db)):
    cur = get_cursor(db)
    cur.execute("SELECT id FROM users WHERE email=%s", (data.email,))
    if cur.fetchone():
        raise HTTPException(400, "Email already registered")
    hashed = hash_password(data.password)
    cur.execute("INSERT INTO users (name, email, password_hash) VALUES (%s,%s,%s)",
                (data.name, data.email, hashed))
    db.commit()
    return {"message": "Registered successfully"}

@router.post("/login")
def login(data: UserLogin, db=Depends(get_db)):
    cur = get_cursor(db)
    cur.execute("SELECT * FROM users WHERE email=%s OR name=%s", (data.email, data.email))
    user = cur.fetchone()
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    if user["is_banned"]:
        raise HTTPException(403, "Account banned")
    token = create_token({
        "sub": str(user["id"]),
        "name": user["name"],
        "email": user["email"],
        "is_admin": bool(user["is_admin"]),
        "points": user["points"]
    })
    return {"access_token": token, "user": {
        "id": user["id"], "name": user["name"],
        "email": user["email"], "points": user["points"],
        "is_admin": bool(user["is_admin"])
    }}

@router.get("/profile")
def get_profile(user=Depends(get_current_user), db=Depends(get_db)):
    cur = get_cursor(db)
    cur.execute("SELECT id,name,email,points,created_at FROM users WHERE id=%s", (user["sub"],))
    return cur.fetchone()

@router.get("/my-submissions")
def my_submissions(user=Depends(get_current_user), db=Depends(get_db)):
    cur = get_cursor(db)
    cur.execute("SELECT * FROM coupons WHERE submitted_by=%s ORDER BY created_at DESC", (user["sub"],))
    return cur.fetchall()

@router.get("/my-claims")
def my_claims(user=Depends(get_current_user), db=Depends(get_db)):
    cur = get_cursor(db)
    cur.execute("""SELECT c.*, cl.claimed_at FROM coupons c
                   JOIN claims cl ON c.id=cl.coupon_id
                   WHERE cl.user_id=%s ORDER BY cl.claimed_at DESC""", (user["sub"],))
    return cur.fetchall()

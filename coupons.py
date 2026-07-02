from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db, get_cursor
from models import CouponSubmit
from auth import get_current_user
from typing import Optional

router = APIRouter(prefix="/api/coupons", tags=["coupons"])

@router.get("")
def browse(
    category: Optional[str] = None,
    search: Optional[str] = None,
    store: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(12, le=50),
    db=Depends(get_db)
):
    cur = get_cursor(db)
    conditions = ["status='approved'", "(expiry_date IS NULL OR expiry_date >= CURDATE())"]
    params = []
    if category:
        conditions.append("category=%s"); params.append(category)
    if store:
        conditions.append("store LIKE %s"); params.append(f"%{store}%")
    if search:
        conditions.append("(title LIKE %s OR description LIKE %s OR code LIKE %s)")
        params += [f"%{search}%", f"%{search}%", f"%{search}%"]
    where = " AND ".join(conditions)
    offset = (page - 1) * limit
    cur.execute(f"SELECT COUNT(*) as total FROM coupons WHERE {where}", params)
    total = cur.fetchone()["total"]
    cur.execute(f"SELECT c.*, u.name as submitter_name FROM coupons c LEFT JOIN users u ON c.submitted_by=u.id WHERE {where} ORDER BY c.created_at DESC LIMIT %s OFFSET %s",
                params + [limit, offset])
    return {"coupons": cur.fetchall(), "total": total, "page": page, "pages": (total + limit - 1) // limit}

@router.post("")
def submit(data: CouponSubmit, user=Depends(get_current_user), db=Depends(get_db)):
    cur = get_cursor(db)
    cur.execute("SELECT id FROM coupons WHERE code=%s AND store=%s AND status!='rejected'",
                (data.code, data.store or ""))
    if cur.fetchone():
        raise HTTPException(400, "Coupon code already exists for this store")
    cur.execute("""INSERT INTO coupons (title,code,description,category,discount_type,discount_value,store,expiry_date,submitted_by)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (data.title, data.code, data.description, data.category,
                 data.discount_type, data.discount_value, data.store,
                 data.expiry_date, user["sub"]))
    db.commit()
    cur.execute("UPDATE users SET points=points+5 WHERE id=%s", (user["sub"],))
    db.commit()
    return {"message": "Coupon submitted for review", "points_earned": 5}

@router.post("/{coupon_id}/claim")
def claim(coupon_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    cur = get_cursor(db)
    cur.execute("SELECT * FROM coupons WHERE id=%s AND status='approved'", (coupon_id,))
    coupon = cur.fetchone()
    if not coupon:
        raise HTTPException(404, "Coupon not found")
    cur.execute("SELECT id FROM claims WHERE coupon_id=%s AND user_id=%s", (coupon_id, user["sub"]))
    if cur.fetchone():
        raise HTTPException(400, "Already claimed")
    cur.execute("INSERT INTO claims (coupon_id,user_id) VALUES (%s,%s)", (coupon_id, user["sub"]))
    cur.execute("UPDATE coupons SET claim_count=claim_count+1 WHERE id=%s", (coupon_id,))
    cur.execute("UPDATE users SET points=points+2 WHERE id=%s", (user["sub"],))
    db.commit()
    return {"message": "Coupon claimed!", "code": coupon["code"]}

@router.get("/categories")
def get_categories(db=Depends(get_db)):
    cur = get_cursor(db)
    cur.execute("SELECT DISTINCT category FROM coupons WHERE status='approved' AND category IS NOT NULL")
    return [r["category"] for r in cur.fetchall()]

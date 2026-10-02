from fastapi import APIRouter, Depends, HTTPException, Query, Request
from database import get_db, get_cursor
from models import CouponSubmit
from auth import get_current_user, decode_token
from typing import Optional
from datetime import date

router = APIRouter(prefix="/api/coupons", tags=["coupons"])


def _num(v) -> str:
    """Format numeric discount values without trailing zeros (handles Decimal)."""
    try:
        f = float(v)
        return str(int(f)) if f == int(f) else str(f)
    except (TypeError, ValueError):
        return str(v)


def _format_discount(discount_type, discount_value) -> str:
    if discount_type == "percent" and discount_value is not None:
        return f"{_num(discount_value)}% OFF"
    if discount_type == "flat" and discount_value is not None:
        return f"₹{_num(discount_value)} OFF"
    if discount_type == "bogo":
        return "BOGO"
    if discount_type == "free_shipping":
        return "Free Shipping"
    return "DEAL"


def _mask_code(code: str) -> str:
    if not code:
        return ""
    if len(code) <= 2:
        return code[0] + "****"
    return code[:2] + "****"


def _user_id_from_request(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        payload = decode_token(auth[7:])
        if payload:
            return payload.get("sub")
    return None


@router.get("/browse")
@router.get("")
def browse(
    request: Request,
    category: Optional[str] = None,
    search: Optional[str] = None,
    store: Optional[str] = None,
    sort: str = "newest",
    page: int = Query(1, ge=1),
    limit: int = Query(12, le=50),
    db=Depends(get_db)
):
    cur = get_cursor(db)
    conditions = ["c.status='approved'", "(c.expiry_date IS NULL OR c.expiry_date >= CURDATE())"]
    params = []
    if category:
        conditions.append("c.category=%s"); params.append(category)
    if store:
        conditions.append("c.store LIKE %s"); params.append(f"%{store}%")
    if search:
        conditions.append("(c.title LIKE %s OR c.description LIKE %s OR c.code LIKE %s)")
        params += [f"%{search}%", f"%{search}%", f"%{search}%"]
    where = " AND ".join(conditions)
    offset = (page - 1) * limit

    cur.execute(f"SELECT COUNT(*) as total FROM coupons c WHERE {where}", params)
    total = cur.fetchone()["total"]

    # Stats in a single round-trip
    cur.execute("""
        SELECT
            (SELECT COUNT(*) FROM coupons WHERE status='approved'
                AND (expiry_date IS NULL OR expiry_date >= CURDATE())) AS total_active,
            (SELECT COUNT(*) FROM claims WHERE DATE(claimed_at)=CURDATE()) AS claims_today,
            COALESCE((SELECT SUM(discount_value) FROM coupons
                WHERE status='approved' AND discount_type='flat'), 0) AS total_savings
    """)
    stats = cur.fetchone()

    order_by = "c.created_at DESC" if sort != "popular" else "c.claim_count DESC"
    cur.execute(
        f"""SELECT c.id, c.title, c.code, c.description, c.category, c.discount_type,
                   c.discount_value, c.store, c.expiry_date, c.claim_count, c.created_at,
                   u.name as submitter_name
            FROM coupons c LEFT JOIN users u ON c.submitted_by=u.id
            WHERE {where} ORDER BY {order_by} LIMIT %s OFFSET %s""",
        params + [limit, offset])
    coupons = cur.fetchall()

    # Which of these has the current user already claimed?
    claimed_ids = set()
    user_id = _user_id_from_request(request)
    if user_id and coupons:
        ids = [c["id"] for c in coupons]
        placeholders = ",".join(["%s"] * len(ids))
        cur.execute(f"SELECT coupon_id FROM claims WHERE user_id=%s AND coupon_id IN ({placeholders})",
                    [user_id] + ids)
        claimed_ids = {r["coupon_id"] for r in cur.fetchall()}

    for c in coupons:
        c["platform"] = c.pop("store") or "Other"
        c["discount"] = _format_discount(c["discount_type"], c["discount_value"])
        is_claimed = c["id"] in claimed_ids
        c["is_claimed_by_me"] = is_claimed
        c["code_hidden"] = _mask_code(c["code"])
        if not is_claimed:
            c["code"] = None  # never leak unclaimed codes in list responses

    return {
        "coupons": coupons,
        "total": total,
        "total_active": stats["total_active"],
        "claims_today": stats["claims_today"],
        "total_savings": int(stats["total_savings"]),
        "page": page,
        "pages": (total + limit - 1) // limit,
    }

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

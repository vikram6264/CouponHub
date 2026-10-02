from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from database import get_db, get_cursor
from models import CouponAction, UserBan
from auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/stats")
def stats(admin=Depends(require_admin), db=Depends(get_db)):
    cur = get_cursor(db)
    cur.execute("SELECT COUNT(*) as total FROM users WHERE is_admin=0")
    users = cur.fetchone()["total"]
    cur.execute("SELECT COUNT(*) as total FROM coupons WHERE status='pending'")
    pending = cur.fetchone()["total"]
    cur.execute("SELECT COUNT(*) as total FROM coupons WHERE status='approved'")
    approved = cur.fetchone()["total"]
    cur.execute("SELECT COUNT(*) as total FROM claims")
    claims = cur.fetchone()["total"]
    cur.execute("SELECT COUNT(*) as total FROM coupons WHERE status='rejected'")
    rejected = cur.fetchone()["total"]
    return {"users": users, "pending": pending, "approved": approved,
            "claims": claims, "rejected": rejected}

@router.get("/coupons")
def all_coupons(status: Optional[str] = None, admin=Depends(require_admin), db=Depends(get_db)):
    cur = get_cursor(db)
    if status:
        cur.execute("""SELECT c.*, u.name as submitter_name FROM coupons c
                       LEFT JOIN users u ON c.submitted_by=u.id
                       WHERE c.status=%s ORDER BY c.created_at DESC""", (status,))
    else:
        cur.execute("""SELECT c.*, u.name as submitter_name FROM coupons c
                       LEFT JOIN users u ON c.submitted_by=u.id ORDER BY c.created_at DESC""")
    return cur.fetchall()

@router.put("/coupons/{coupon_id}")
def update_coupon_status(coupon_id: int, data: CouponAction,
                          admin=Depends(require_admin), db=Depends(get_db)):
    cur = get_cursor(db)
    cur.execute("SELECT * FROM coupons WHERE id=%s", (coupon_id,))
    coupon = cur.fetchone()
    if not coupon:
        raise HTTPException(404, "Coupon not found")
    cur.execute("UPDATE coupons SET status=%s, reject_reason=%s WHERE id=%s",
                (data.status, data.reject_reason, coupon_id))
    # Award +10 only on transition into 'approved' (never on re-approve)
    if data.status == "approved" and coupon["status"] != "approved" and coupon["submitted_by"]:
        cur.execute("UPDATE users SET points=points+10 WHERE id=%s", (coupon["submitted_by"],))
    db.commit()
    return {"message": f"Coupon {data.status}"}

@router.post("/coupons/bulk")
def bulk_action(payload: dict, admin=Depends(require_admin), db=Depends(get_db)):
    ids = payload.get("ids", [])
    action = payload.get("action")
    reason = payload.get("reason", "")
    if not ids or action not in ("approved", "rejected"):
        raise HTTPException(400, "Invalid bulk action")
    cur = get_cursor(db)
    awarded = 0
    for cid in ids:
        cur.execute("SELECT status, submitted_by FROM coupons WHERE id=%s", (cid,))
        row = cur.fetchone()
        if not row:
            continue
        cur.execute("UPDATE coupons SET status=%s, reject_reason=%s WHERE id=%s",
                    (action, reason, cid))
        if action == "approved" and row["status"] != "approved" and row["submitted_by"]:
            cur.execute("UPDATE users SET points=points+10 WHERE id=%s", (row["submitted_by"],))
            awarded += 1
    db.commit()
    return {"message": f"{len(ids)} coupons {action}", "points_awarded": awarded}

@router.get("/users")
def all_users(admin=Depends(require_admin), db=Depends(get_db)):
    cur = get_cursor(db)
    cur.execute("""SELECT u.id,u.name,u.email,u.points,u.is_banned,u.created_at,
                   COUNT(c.id) as coupon_count FROM users u
                   LEFT JOIN coupons c ON u.id=c.submitted_by
                   WHERE u.is_admin=0 GROUP BY u.id ORDER BY u.created_at DESC""")
    return cur.fetchall()

@router.put("/users/{user_id}/ban")
def ban_user(user_id: int, data: UserBan, admin=Depends(require_admin), db=Depends(get_db)):
    cur = get_cursor(db)
    cur.execute("UPDATE users SET is_banned=%s WHERE id=%s AND is_admin=0",
                (data.is_banned, user_id))
    db.commit()
    return {"message": "User updated"}

@router.get("/analytics")
def analytics(admin=Depends(require_admin), db=Depends(get_db)):
    cur = get_cursor(db)
    cur.execute("""SELECT category, COUNT(*) as count FROM coupons
                   WHERE status='approved' GROUP BY category""")
    by_category = cur.fetchall()
    cur.execute("""SELECT DATE(created_at) as date, COUNT(*) as count FROM coupons
                   WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                   GROUP BY DATE(created_at) ORDER BY date""")
    by_day = cur.fetchall()
    cur.execute("""SELECT store, COUNT(*) as count FROM coupons
                   WHERE status='approved' AND store IS NOT NULL
                   GROUP BY store ORDER BY count DESC LIMIT 10""")
    top_stores = cur.fetchall()
    return {"by_category": by_category, "by_day": by_day, "top_stores": top_stores}

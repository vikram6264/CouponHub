"""
admin.py — CouponShare
All admin-only API endpoints.
Protected by require_admin dependency.
"""

from fastapi import APIRouter, Depends, HTTPException
from database import get_db, get_cursor
from models import CouponAction, UserBan
from auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Admin guard ─────────────────────────────────────
def require_admin(user=Depends(get_current_user)):
    """Only allow users with is_admin=True."""
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ══════════════════════════════════════════════════════
# DASHBOARD STATS
# GET /api/admin/stats
# ══════════════════════════════════════════════════════
@router.get("/stats")
def get_stats(admin=Depends(require_admin), db=Depends(get_db)):
    cur = get_cursor(db)

    cur.execute("SELECT COUNT(*) AS total FROM users WHERE is_admin=0")
    total_users = cur.fetchone()["total"]

    cur.execute("SELECT COUNT(*) AS total FROM coupons WHERE status='pending'")
    pending = cur.fetchone()["total"]

    cur.execute("SELECT COUNT(*) AS total FROM coupons WHERE status='approved' AND (expiry_date IS NULL OR expiry_date >= CURDATE())")
    approved = cur.fetchone()["total"]

    cur.execute("SELECT COUNT(*) AS total FROM coupons WHERE status='rejected'")
    rejected = cur.fetchone()["total"]

    cur.execute("SELECT COUNT(*) AS total FROM claims")
    total_claims = cur.fetchone()["total"]

    cur.execute("SELECT COUNT(*) AS total FROM users WHERE is_admin=0 AND DATE(created_at)=CURDATE()")
    new_today = cur.fetchone()["total"]

    # Top platforms
    cur.execute("""
        SELECT store, COUNT(*) AS cnt
        FROM coupons WHERE status='approved' AND store IS NOT NULL AND store != ''
        GROUP BY store ORDER BY cnt DESC LIMIT 5
    """)
    top_platforms = cur.fetchall()

    return {
        "total_users":  total_users,
        "pending":      pending,
        "approved":     approved,
        "rejected":     rejected,
        "total_claims": total_claims,
        "new_today":    new_today,
        "top_platforms": top_platforms,
    }


# ══════════════════════════════════════════════════════
# ALL COUPONS  (with optional status filter)
# GET /api/admin/coupons?status=pending
# ══════════════════════════════════════════════════════
@router.get("/coupons")
def all_coupons(
    status: str = "",
    admin=Depends(require_admin),
    db=Depends(get_db)
):
    cur = get_cursor(db)
    if status:
        cur.execute("""
            SELECT c.*, u.name AS submitter_name, u.email AS submitter_email
            FROM coupons c
            LEFT JOIN users u ON c.submitted_by = u.id
            WHERE c.status = %s
            ORDER BY c.created_at DESC
        """, (status,))
    else:
        cur.execute("""
            SELECT c.*, u.name AS submitter_name, u.email AS submitter_email
            FROM coupons c
            LEFT JOIN users u ON c.submitted_by = u.id
            ORDER BY c.created_at DESC
        """)
    rows = cur.fetchall()
    # Convert dates to string for JSON
    for r in rows:
        if r.get("expiry_date"):
            r["expiry_date"] = str(r["expiry_date"])
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])
    return {"coupons": rows, "total": len(rows)}


# ══════════════════════════════════════════════════════
# APPROVE / REJECT A COUPON
# PUT /api/admin/coupons/{id}
# Body: { status: "approved" | "rejected", reject_reason: "..." }
# ══════════════════════════════════════════════════════
@router.put("/coupons/{coupon_id}")
def review_coupon(
    coupon_id: int,
    data: CouponAction,
    admin=Depends(require_admin),
    db=Depends(get_db)
):
    cur = get_cursor(db)

    # Check coupon exists
    cur.execute("SELECT * FROM coupons WHERE id = %s", (coupon_id,))
    coupon = cur.fetchone()
    if not coupon:
        raise HTTPException(404, "Coupon not found")

    if data.status not in ("approved", "rejected"):
        raise HTTPException(400, "Status must be 'approved' or 'rejected'")

    cur.execute(
        "UPDATE coupons SET status=%s, reject_reason=%s WHERE id=%s",
        (data.status, data.reject_reason or "", coupon_id)
    )
    db.commit()

    # Give submitter +10 points on approval
    if data.status == "approved" and coupon.get("submitted_by"):
        cur.execute(
            "UPDATE users SET points = points + 10 WHERE id=%s",
            (coupon["submitted_by"],)
        )
        db.commit()

    return {
        "message": f"Coupon {data.status} successfully",
        "coupon_id": coupon_id,
    }


# ══════════════════════════════════════════════════════
# DELETE A COUPON
# DELETE /api/admin/coupons/{id}
# ══════════════════════════════════════════════════════
@router.delete("/coupons/{coupon_id}")
def delete_coupon(
    coupon_id: int,
    admin=Depends(require_admin),
    db=Depends(get_db)
):
    cur = get_cursor(db)
    cur.execute("SELECT id FROM coupons WHERE id=%s", (coupon_id,))
    if not cur.fetchone():
        raise HTTPException(404, "Coupon not found")
    cur.execute("DELETE FROM coupons WHERE id=%s", (coupon_id,))
    db.commit()
    return {"message": "Coupon deleted"}


# ══════════════════════════════════════════════════════
# ALL USERS
# GET /api/admin/users?search=rahul
# ══════════════════════════════════════════════════════
@router.get("/users")
def all_users(
    search: str = "",
    admin=Depends(require_admin),
    db=Depends(get_db)
):
    cur = get_cursor(db)
    if search:
        cur.execute("""
            SELECT u.id, u.name, u.email, u.points, u.is_admin,
                   u.is_banned, u.created_at,
                   COUNT(DISTINCT c.id) AS submitted,
                   COUNT(DISTINCT cl.id) AS claimed
            FROM users u
            LEFT JOIN coupons c  ON c.submitted_by = u.id
            LEFT JOIN claims  cl ON cl.user_id = u.id
            WHERE u.is_admin = 0
              AND (u.name LIKE %s OR u.email LIKE %s)
            GROUP BY u.id
            ORDER BY u.created_at DESC
        """, (f"%{search}%", f"%{search}%"))
    else:
        cur.execute("""
            SELECT u.id, u.name, u.email, u.points, u.is_admin,
                   u.is_banned, u.created_at,
                   COUNT(DISTINCT c.id)  AS submitted,
                   COUNT(DISTINCT cl.id) AS claimed
            FROM users u
            LEFT JOIN coupons c  ON c.submitted_by = u.id
            LEFT JOIN claims  cl ON cl.user_id = u.id
            WHERE u.is_admin = 0
            GROUP BY u.id
            ORDER BY u.created_at DESC
        """)
    rows = cur.fetchall()
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])
    return {"users": rows, "total": len(rows)}


# ══════════════════════════════════════════════════════
# BAN / UNBAN USER
# PUT /api/admin/users/{id}/ban
# Body: { is_banned: true | false }
# ══════════════════════════════════════════════════════
@router.put("/users/{user_id}/ban")
def ban_user(
    user_id: int,
    data: UserBan,
    admin=Depends(require_admin),
    db=Depends(get_db)
):
    cur = get_cursor(db)
    cur.execute("SELECT id, is_admin FROM users WHERE id=%s", (user_id,))
    user = cur.fetchone()
    if not user:
        raise HTTPException(404, "User not found")
    if user["is_admin"]:
        raise HTTPException(400, "Cannot ban another admin")

    cur.execute(
        "UPDATE users SET is_banned=%s WHERE id=%s",
        (1 if data.is_banned else 0, user_id)
    )
    db.commit()
    action = "banned" if data.is_banned else "unbanned"
    return {"message": f"User {action} successfully"}

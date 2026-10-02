from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from users import router as users_router
from coupons import router as coupons_router
from admin import router as admin_router
from database import connection_pool

app = FastAPI(title="Coupon Share API")

# CORS middleware for local development
# Note: allow_credentials must stay False with a wildcard origin (spec-invalid combo).
# Auth uses the Authorization header, not cookies, so credentials are not needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers FIRST so /api/* routes are matched before any catch-all
app.include_router(users_router)
app.include_router(coupons_router)
app.include_router(admin_router)

# ── Static API data ──────────────────────────────────────────────
@app.get("/api/platforms")
async def get_platforms():
    """Return list of popular platforms"""
    platforms = [
        {"id": "amazon", "name": "Amazon", "emoji": "📦"},
        {"id": "flipkart", "name": "Flipkart", "emoji": "🛒"},
        {"id": "myntra", "name": "Myntra", "emoji": "👗"},
        {"id": "zomato", "name": "Zomato", "emoji": "🍔"},
        {"id": "swiggy", "name": "Swiggy", "emoji": "🛵"},
        {"id": "ajio", "name": "Ajio", "emoji": "🧥"},
        {"id": "nykaa", "name": "Nykaa", "emoji": "💄"},
        {"id": "meesho", "name": "Meesho", "emoji": "🏷️"},
        {"id": "bigbasket", "name": "BigBasket", "emoji": "🥦"},
        {"id": "blinkit", "name": "Blinkit", "emoji": "⚡"},
        {"id": "makemytrip", "name": "MakeMyTrip", "emoji": "✈️"},
        {"id": "irctc", "name": "IRCTC", "emoji": "🚆"},
        {"id": "paytm", "name": "Paytm", "emoji": "💳"},
        {"id": "phonepe", "name": "PhonePe", "emoji": "📱"},
        {"id": "other", "name": "Other", "emoji": "🌐"},
    ]
    return {"platforms": platforms}

# Single source of truth for categories — used by submit form AND browse chips
@app.get("/api/categories")
async def get_categories():
    categories = [
        "Fashion & Apparel", "Electronics", "Groceries & Food",
        "Travel & Hotels", "Beauty & Health", "Home & Furniture",
        "Books & Education", "Gaming", "Sports & Fitness", "Other",
        "Recharge"
    ]
    return {"categories": categories}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# ── Static file serving (registered LAST so it never shadows APIs) ──
BASE_DIR = Path(__file__).resolve().parent
ALLOWED_STATIC_EXT = {".html", ".css", ".js", ".svg", ".png", ".ico"}

@app.get("/", response_class=HTMLResponse)
async def root():
    return FileResponse(BASE_DIR / "index.html")

@app.get("/{page}.html", response_class=HTMLResponse)
async def serve_html(page: str):
    file = BASE_DIR / f"{page}.html"
    if not file.is_file():
        raise HTTPException(404)
    return FileResponse(file)

@app.get("/{asset_path:path}")
async def serve_asset(asset_path: str):
    """Serve only public assets (.css/.js/etc). Never exposes .env, .py, .db…"""
    file = (BASE_DIR / asset_path).resolve()
    if BASE_DIR not in file.parents or not file.is_file():
        raise HTTPException(404)
    if file.suffix.lower() not in ALLOWED_STATIC_EXT:
        raise HTTPException(404)
    return FileResponse(file)

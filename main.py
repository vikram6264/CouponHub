from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from users import router as users_router
from coupons import router as coupons_router
from admin import router as admin_router
from database import connection_pool

app = FastAPI(title="Coupon Share API")

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users_router)
app.include_router(coupons_router)
app.include_router(admin_router)

# Mount static files at root and enable HTML mode so index.html is served
# Static files are mounted after routers so API routes still take precedence.
# Static platform list for frontend
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

# Wait, coupons.py already has a /categories endpoint. Let's make sure it doesn't conflict, 
# or we use the dynamic one. coupons.py has /api/coupons/categories.
# The frontend uses /api/categories for submit form, so we keep this one too.
@app.get("/api/categories")
async def get_categories():
    categories = [
        "Fashion & Apparel", "Electronics", "Groceries & Food",
        "Travel & Hotels", "Beauty & Health", "Home & Furniture",
        "Books & Education", "Gaming", "Sports & Fitness", "Other",
        "Recharge"
    ]
    return {"categories": categories}

# Mount static files at root and enable HTML mode so index.html is served
# Place this after all API route definitions so API routes take precedence.
app.mount("/", StaticFiles(directory=".", html=True), name="static")

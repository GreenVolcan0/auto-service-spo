from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.init_db import init_db
from app.routers import admin, appointments, auth, employees, price_list, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Автосервис — запись на услуги",
    description="REST API: запись клиентов на услуги автосервиса без пересечений по времени у сотрудника.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (auth.router, users.router, price_list.router, employees.router,
               appointments.router, admin.router):
    app.include_router(router, prefix="/api")


@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok"}

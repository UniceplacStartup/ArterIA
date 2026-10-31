"""
Roteador principal da versão 1 da API ArterIA.
"""

from fastapi import APIRouter
from app.api.v1.endpoints import auditoria, auth, exames, pacientes

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(pacientes.router)
api_router.include_router(exames.router)
api_router.include_router(auditoria.router)


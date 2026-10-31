"""
Script de Seed Inicial para o Banco de Dados PostgreSQL (Neon) ou ambiente de desenvolvimento.
Cria um médico demonstração e os pacientes iniciais criptografados caso o banco esteja vazio.

Execução (a partir da pasta `backend/`):
    python -m scripts.seed_neon
"""

from datetime import date
import logging
from app.core.security import gerar_hash_senha
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.exame import ModoValidacaoEnum, NivelCalcificacaoEnum, StatusExameEnum
from app.repositories.exame_repo import ExameRepository
from app.repositories.paciente_repo import PacienteRepository
from app.repositories.usuario_repo import UsuarioRepository

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("arteria.seed")


def popular_dados_iniciais() -> None:
    """Popula médico inicial e pacientes de exemplo com criptografia LGPD ativa."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        usuario_repo = UsuarioRepository(db)
        paciente_repo = PacienteRepository(db)
        exame_repo = ExameRepository(db)

        email_demo = "medico@arteria.med.br"
        medico = usuario_repo.buscar_por_email(email_demo)
        if not medico:
            medico = usuario_repo.criar(
                nome="Dra. Helena Vasconcelos",
                email=email_demo,
                senha_hash=gerar_hash_senha("ArterIA@2026"),
                crm="123456",
                uf_crm="DF",
            )
            logger.info("Médico inicial criado: %s (CRM 123456-DF)", email_demo)
        else:
            # Garante que a conta padrão esteja sempre ativa, desbloqueada e com a senha padrão
            medico.senha_hash = gerar_hash_senha("ArterIA@2026")
            medico.ativo = True
            medico.tentativas_falhas_login = 0
            medico.bloqueado_ate = None
            usuario_repo.atualizar(medico)

        pacientes_existentes = paciente_repo.listar_todos()
        if not pacientes_existentes:
            # 1. Adriana Silva (LAUDADO)
            p1 = paciente_repo.criar(
                nome="Adriana Silva",
                cpf="11122233344",
                email="adriana.silva@exemplo.com",
                data_nascimento=date(1975, 4, 12),
                criado_por_id=medico.id,
            )
            ex1 = exame_repo.criar_exame(
                paciente_id=p1.id,
                medico_id=medico.id,
                nome_arquivo_seguro="",
                sha256_hash="a1b2c3d4e5f60718293a4b5c6d7e8f9011223344556677889900aabbccddeeff",
                tamanho_bytes=0,
                status_inicial=StatusExameEnum.PENDENTE_LAUDO,
            )
            exame_repo.salvar_resultado_ia(
                exame=ex1,
                classificacao=NivelCalcificacaoEnum.MODERADA,
                localizacao="Quadrante Superior Externo",
                padrao="Linear em trilho de trem",
                nivel_confianca=92.0,
                leitura_tecnica=(
                    "Identificada calcificação vascular de padrão linear em topografia de artéria mamária, "
                    "quadrante superior externo, compatível com calcificação arterial mamária de grau moderado."
                ),
            )
            exame_repo.assinar_laudo(
                exame=ex1,
                medico_id=medico.id,
                diagnostico_final=(
                    "Confirmado achado de calcificação arterial mamária moderada, padrão linear, "
                    "quadrante superior externo. Recomendo acompanhamento cardiovascular de rotina."
                ),
                modo_validacao=ModoValidacaoEnum.CONFIRMAR,
                classificacao_final=NivelCalcificacaoEnum.MODERADA,
                laudo_pdf_url=f"/api/exames/{ex1.id}/laudo.pdf",
            )

            # 2. Luís Felipe (PENDENTE_LAUDO com IA pronta para revisão)
            p2 = paciente_repo.criar(
                nome="Luís Felipe",
                cpf="22233344455",
                email="luis.felipe@exemplo.com",
                data_nascimento=date(1968, 11, 2),
                criado_por_id=medico.id,
            )
            ex2 = exame_repo.criar_exame(
                paciente_id=p2.id,
                medico_id=medico.id,
                nome_arquivo_seguro="",
                sha256_hash="b2c3d4e5f60718293a4b5c6d7e8f9011223344556677889900aabbccddeeff01",
                tamanho_bytes=0,
                status_inicial=StatusExameEnum.PENDENTE_LAUDO,
            )
            exame_repo.salvar_resultado_ia(
                exame=ex2,
                classificacao=NivelCalcificacaoEnum.LEVE,
                localizacao="Quadrante Inferior Interno",
                padrao="Puntiforme vascular inicial",
                nivel_confianca=88.5,
                leitura_tecnica=(
                    "Focos puntiformes de calcificação em topografia vascular, quadrante inferior interno, "
                    "sugestivos de calcificação arterial mamária leve."
                ),
            )

            # 3. André de Souza (FALHA_PROCESSAMENTO para testar botão de Reprocessar)
            p3 = paciente_repo.criar(
                nome="André de Souza",
                cpf="33344455566",
                email="andre.souza@exemplo.com",
                data_nascimento=date(1980, 1, 20),
                criado_por_id=medico.id,
            )
            exame_repo.criar_exame(
                paciente_id=p3.id,
                medico_id=medico.id,
                nome_arquivo_seguro="",
                sha256_hash="c3d4e5f60718293a4b5c6d7e8f9011223344556677889900aabbccddeeff0102",
                tamanho_bytes=0,
                status_inicial=StatusExameEnum.FALHA_PROCESSAMENTO,
            )

            # 4. Marina Gomes (PENDENTE)
            p4 = paciente_repo.criar(
                nome="Marina Gomes",
                cpf="44455566677",
                email="marina.gomes@exemplo.com",
                data_nascimento=date(1990, 7, 15),
                criado_por_id=medico.id,
            )
            exame_repo.criar_exame(
                paciente_id=p4.id,
                medico_id=medico.id,
                nome_arquivo_seguro="",
                sha256_hash="",
                tamanho_bytes=0,
                status_inicial=StatusExameEnum.PENDENTE,
            )

            # 5. Julia Gabriela (PENDENTE)
            p5 = paciente_repo.criar(
                nome="Julia Gabriela",
                cpf="55566677788",
                email="julia.gabriela@exemplo.com",
                data_nascimento=date(1985, 9, 30),
                criado_por_id=medico.id,
            )
            exame_repo.criar_exame(
                paciente_id=p5.id,
                medico_id=medico.id,
                nome_arquivo_seguro="",
                sha256_hash="",
                tamanho_bytes=0,
                status_inicial=StatusExameEnum.PENDENTE,
            )

            logger.info("5 pacientes iniciais e exames criados com criptografia LGPD.")
        else:
            logger.info("Banco já possui pacientes cadastrados. Seed ignorado.")
    finally:
        db.close()


if __name__ == "__main__":
    popular_dados_iniciais()

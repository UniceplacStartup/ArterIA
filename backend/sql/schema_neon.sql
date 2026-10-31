-- ==============================================================================
-- ARTERIA — SCRIPT DDL POSTGRESQL PARA NEON SERVERLESS POSTGRES
-- ==============================================================================
-- Este script pode ser executado diretamente no SQL Editor do Neon (neon.tech)
-- ou gerenciado automaticamente pelo SQLAlchemy / Alembic no startup da API.
--
-- Foco em Segurança e LGPD (Lei Geral de Proteção de Dados - Art. 5º e Art. 11):
-- 1. Chaves primárias em UUIDv4 para prevenir ataques de enumeração de IDs (IDOR).
-- 2. Dados pessoais sensíveis (CPF, E-mail de pacientes) são armazenados
--    exclusivamente criptografados (Fernet AES) + Blind Index (HMAC-SHA256).
-- 3. Logs imutáveis de Auditoria (LGPD) e de Divergência Clínica (RA01).
-- ==============================================================================

-- Extensão nativa para geração de UUIDs criptográficos no PostgreSQL
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. TIPOS ENUMERADOS (DOMÍNIOS DO SISTEMA)
-- ------------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE status_exame_enum AS ENUM (
        'PENDENTE',
        'PROCESSANDO',
        'FALHA_PROCESSAMENTO',
        'PENDENTE_LAUDO',
        'LAUDADO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE nivel_calcificacao_enum AS ENUM (
        'AUSENTE',
        'LEVE',
        'MODERADA',
        'ACENTUADA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE modo_validacao_enum AS ENUM (
        'CONFIRMAR',
        'AJUSTAR',
        'INVALIDAR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE perfil_usuario_enum AS ENUM (
        'MEDICO',
        'ADMIN'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 2. TABELA DE PROFISSIONAIS DE SAÚDE (USUÁRIOS AUTENTICADOS - RF01)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    crm VARCHAR(20) NOT NULL,
    uf_crm CHAR(2) NOT NULL,
    perfil perfil_usuario_enum NOT NULL DEFAULT 'MEDICO',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    tentativas_falhas_login INTEGER NOT NULL DEFAULT 0,
    bloqueado_ate TIMESTAMPTZ NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_usuarios_crm_uf UNIQUE (crm, uf_crm)
);

CREATE INDEX IF NOT EXISTS ix_usuarios_email ON usuarios (email);
CREATE INDEX IF NOT EXISTS ix_usuarios_crm_uf ON usuarios (crm, uf_crm);

COMMENT ON TABLE usuarios IS 'Profissionais médicos habilitados com acesso ao sistema ArterIA.';
COMMENT ON COLUMN usuarios.senha_hash IS 'Hash Bcrypt com salt único por usuário. Jamais armazena senha em texto claro.';

-- ------------------------------------------------------------------------------
-- 3. TABELA DE PACIENTES (PROTEGIDA POR CRIPTOGRAFIA DE CAMPO - RF07 / LGPD)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pacientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_publico VARCHAR(20) NOT NULL UNIQUE,
    nome_encrypted TEXT NOT NULL,
    cpf_encrypted TEXT NOT NULL,
    cpf_blind_index VARCHAR(64) NOT NULL UNIQUE,
    email_encrypted TEXT NOT NULL,
    data_nascimento DATE NOT NULL,
    criado_por_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_pacientes_cpf_blind_index ON pacientes (cpf_blind_index);
CREATE INDEX IF NOT EXISTS ix_pacientes_criado_em ON pacientes (criado_em DESC);

COMMENT ON TABLE pacientes IS 'Pacientes cadastrados com PII criptografada em nível de aplicação (LGPD).';
COMMENT ON COLUMN pacientes.cpf_encrypted IS 'CPF criptografado com AES (Fernet) antes de persistir no banco.';
COMMENT ON COLUMN pacientes.cpf_blind_index IS 'Hash HMAC-SHA256 com pepper secreto para busca de unicidade sem revelar o CPF.';

-- ------------------------------------------------------------------------------
-- 4. TABELA DE EXAMES MAMOGRÁFICOS (RF02 / RF04 / RF05 / RE02)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exames (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    medico_responsavel_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    arquivo_dicom_nome_seguro VARCHAR(255) NULL,
    arquivo_dicom_sha256 VARCHAR(64) NULL,
    arquivo_dicom_tamanho_bytes BIGINT NULL,
    status status_exame_enum NOT NULL DEFAULT 'PENDENTE',
    modo_validacao_medica modo_validacao_enum NULL,
    classificacao_final_medica nivel_calcificacao_enum NULL,
    diagnostico_final_encrypted TEXT NULL,
    laudo_pdf_url VARCHAR(500) NULL,
    laudado_em TIMESTAMPTZ NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_exames_paciente_id ON exames (paciente_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_exames_status ON exames (status);

COMMENT ON TABLE exames IS 'Registros de exames mamográficos vinculados aos pacientes.';
COMMENT ON COLUMN exames.arquivo_dicom_sha256 IS 'Hash SHA-256 do arquivo DICOM original para garantia de integridade clínica.';

-- ------------------------------------------------------------------------------
-- 5. TABELA DE RESULTADOS DA INTELIGÊNCIA ARTIFICIAL (RF03)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resultados_ia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exame_id UUID NOT NULL UNIQUE REFERENCES exames(id) ON DELETE CASCADE,
    classificacao nivel_calcificacao_enum NOT NULL,
    localizacao VARCHAR(150) NOT NULL,
    padrao VARCHAR(150) NOT NULL,
    nivel_confianca NUMERIC(5,2) NOT NULL CHECK (nivel_confianca >= 0 AND nivel_confianca <= 100),
    leitura_tecnica TEXT NOT NULL,
    versao_modelo VARCHAR(50) NOT NULL DEFAULT 'ArterIA-CAM-v1.0',
    tempo_processamento_ms INTEGER NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_resultados_ia_exame_id ON resultados_ia (exame_id);

COMMENT ON TABLE resultados_ia IS 'Resultados estruturados produzidos pelo pipeline de IA para cada exame.';

-- ------------------------------------------------------------------------------
-- 6. TABELA DE LOGS DE DIVERGÊNCIA CLÍNICA IA vs MÉDICO (RA01)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logs_divergencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exame_id UUID NOT NULL REFERENCES exames(id) ON DELETE CASCADE,
    medico_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    classificacao_ia nivel_calcificacao_enum NOT NULL,
    modo_validacao modo_validacao_enum NOT NULL,
    classificacao_medica nivel_calcificacao_enum NULL,
    diagnostico_medico_resumo TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_logs_divergencia_exame_id ON logs_divergencia (exame_id);
CREATE INDEX IF NOT EXISTS ix_logs_divergencia_medico_id ON logs_divergencia (medico_id);

COMMENT ON TABLE logs_divergencia IS 'Registro de auditoria clínica (RA01) sempre que o médico ajusta ou invalida a sugestão da IA.';

-- ------------------------------------------------------------------------------
-- 7. TABELA DE TRILHA DE AUDITORIA DE SEGURANÇA E LGPD
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    acao VARCHAR(100) NOT NULL,
    recurso VARCHAR(100) NOT NULL,
    recurso_id VARCHAR(100) NULL,
    ip_origem VARCHAR(64) NULL,
    user_agent VARCHAR(500) NULL,
    detalhes JSONB NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_logs_auditoria_usuario_id ON logs_auditoria (usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_logs_auditoria_acao ON logs_auditoria (acao);


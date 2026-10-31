# 🫀 ArterIA — Plataforma Full-Stack (React + Python FastAPI + Neon PostgreSQL)

**Plataforma de apoio à análise de mamografias e à classificação da Calcificação Arterial Mamária (CAM) com arquitetura limpa e segurança hospitalar (LGPD).**

---

## 🏗️ Arquitetura de Pastas do Projeto

O projeto está organizado em uma arquitetura **Monorepo Full-Stack** com separação estrita de responsabilidades entre **Frontend (React + TypeScript)** e **Backend (Python + FastAPI + SQLAlchemy 2.0 + Neon Serverless Postgres)**:

```text
ArterIA-main/
├── .gitignore                        # Proteção global contra vazamento de .env, chaves e arquivos DICOM
├── README.md                         # Documentação geral de arquitetura, segurança e execução
│
├── frontend/                         # Aplicação Web em React 19 + TypeScript + Vite + MUI
│   ├── .env.example                  # Exemplo de configuração de conexão com a API Python
│   ├── package.json
│   └── src/
│       ├── assets/                   # Imagens e recursos visuais
│       ├── components/               # Componentes desacoplados (AuthCard, DicomUpload, StatusBadge, etc.)
│       ├── hooks/                    # Hooks customizados com TanStack React Query (useExame, usePacientes)
│       ├── layouts/                  # Layouts estruturais (DashboardLayout)
│       ├── mocks/                    # Dados simulados para modo offline (VITE_USE_MOCKS=true)
│       ├── pages/                    # Telas (Login, CadastroProfissional, CadastroPaciente, Dashboard, Resultado)
│       ├── routes/                   # Guarda de rotas autenticadas (ProtectedRoute)
│       ├── schemas/                  # Validação estrita de formulários e arquivos DICOM com Zod
│       ├── services/                 # Cliente HTTP Axios com interceptors JWT e refresh automático
│       ├── stores/                   # Gerenciamento de estado de sessão em sessionStorage (Zustand)
│       ├── theme/                    # Identidade visual e paleta acessível (Material UI)
│       └── types/                    # Contratos TypeScript espelhados com o Backend Python
│
└── backend/                          # API REST em Python (FastAPI) em Arquitetura em Camadas (Clean Architecture)
    ├── .env.example                  # Template de variáveis de ambiente (Neon DB, JWT, AES Fernet, Pepper)
    ├── requirements.txt              # Dependências Python fixadas
    ├── scripts/
    │   ├── gerar_chaves_seguranca.py # Gerador de chaves criptográficas para o .env
    │   └── seed_neon.py              # Script de seed inicial criptografado para o Neon Postgres
    ├── sql/
    │   └── schema_neon.sql           # DDL SQL completo para execução direta no SQL Editor do Neon
    └── app/
        ├── main.py                   # Inicialização FastAPI, CORS restrito, Lifespan e Middlewares
        ├── core/
        │   ├── config.py             # Configurações tipadas (Pydantic Settings) e validação de produção
        │   ├── crypto.py             # Criptografia AES/Fernet (PII/PHI), Blind Index HMAC-SHA256 e Mascaramento LGPD
        │   ├── security.py           # Hash Bcrypt (12 rounds) e emissão/validação de JWT (Access + Refresh)
        │   ├── middlewares.py        # Headers de Segurança OWASP (HSTS, CSP, No-Store) e Rate Limiting por IP
        │   └── exceptions.py         # Tratamento global de erros sem exposição de stack traces
        ├── db/
        │   ├── base.py               # DeclarativeBase SQLAlchemy 2.0 com convenção de nomes PostgreSQL
        │   └── session.py            # Engine PostgreSQL otimizada para Neon Serverless (SSL/TLS, pool_pre_ping)
        ├── models/                   # Entidades ORM (Usuario, Paciente, Exame, ResultadoIA, LogDivergencia, LogAuditoria)
        ├── schemas/                  # DTOs Pydantic v2 com sanitização contra XSS/Injection
        ├── repositories/             # Camada de persistência com criptografia/descriptografia transparente
        ├── services/                 # Regras de negócio, validação binária DICOM (DICM) e pipeline de IA
        └── api/
            ├── deps.py               # Injeção de dependências e verificação de JWT Bearer
            └── v1/endpoints/         # Endpoints REST (/auth, /pacientes, /exames, /auditoria)
```

---

## 🔐 Camadas de Segurança e Proteção de Dados Sensíveis (LGPD)

Por lidar com **Dados Pessoais Sensíveis de Saúde (PII & PHI — Art. 5º, II e Art. 11 da LGPD)**, o sistema implementa defesa em profundidade:

1. **Criptografia de Dados em Repouso (Field-Level Encryption — AES + HMAC)**:
   - O **Nome**, **CPF** e **E-mail** dos pacientes, bem como o **Diagnóstico Final Médico**, são criptografados na camada de aplicação com **Fernet (AES-128-CBC + HMAC-SHA256)** antes de serem enviados ao banco PostgreSQL no Neon (`nome_encrypted`, `cpf_encrypted`, `email_encrypted`, `diagnostico_final_encrypted`).
2. **Blind Indexing para Busca sem Exposição (`HMAC-SHA256` com Pepper Secreto)**:
   - Para impedir cadastros duplicados de CPF sem jamais salvar o CPF em texto puro no banco, o sistema calcula um `cpf_blind_index` usando `HMAC-SHA256(cpf_normalizado, BLIND_INDEX_PEPPER)`.
3. **Mascaramento Automático de Dados (Data Masking)**:
   - Nas respostas da API, o CPF é retornado mascarado (`***.456.789-**`) e o e-mail parcialmente oculto (`ad***@dominio.com`), respeitando o princípio da minimização de dados (LGPD Art. 6º, III).
4. **Autenticação Médica Forte e Bloqueio contra Força Bruta**:
   - Senhas armazenadas exclusivamente com hash **Bcrypt (12 rounds)**.
   - Autenticação via **JWT (`Access Token` de curta duração + `Refresh Token`)**.
   - **Account Lockout**: bloqueio automático temporário (15 minutos) após 5 tentativas de senha incorretas, além de **Rate Limiting** por IP nas rotas `/api/auth/*`.
5. **Cofre Seguro e Validação Binária de Imagens DICOM**:
   - Verifica a assinatura binária **Magic Bytes `DICM`** nos bytes `128..132` do cabeçalho DICOM (tanto no Frontend quanto no Backend).
   - Leitura em streaming com limite estrito de **100 MB** (prevenção de DoS de memória).
   - Renomeação automática para `UUIDv4.dcm` em diretório isolado (`storage/dicom_vault`) fora da raiz pública, bloqueando *Path Traversal*, com cálculo de hash **SHA-256** de integridade clínica.
6. **Trilha de Auditoria Imutável (LGPD Art. 37 & RA01)**:
   - Toda ação sensível (login, cadastro, visualização de prontuário, upload DICOM, assinatura de laudo) gera registro em `logs_auditoria`.
   - Sempre que o médico ajusta ou invalida a classificação da IA, um registro é gravado em `logs_divergencia` (**RA01**).

---

## 🐘 Como Configurar e Subir o Banco PostgreSQL no Neon

1. Acesse [https://neon.tech](https://neon.tech) e crie um novo projeto PostgreSQL (ex.: `arteria-db`).
2. No painel do Neon, clique em **Connection Details** e selecione a opção **Pooled connection** (`-pooler`).
3. Copie a connection string e adicione ao arquivo `backend/.env` usando o prefixo `postgresql+psycopg://` e `sslmode=require`:
   ```env
   DATABASE_URL="postgresql+psycopg://neondb_owner:SUA_SENHA@ep-seu-endpoint-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
   ```
4. Você pode criar as tabelas de duas formas:
   - **Automática**: Ao iniciar o Backend Python (`uvicorn app.main:app`), o SQLAlchemy verifica e cria automaticamente todas as tabelas e tipos enumerados no Neon.
   - **Via SQL Editor do Neon**: Copie o conteúdo de [`backend/sql/schema_neon.sql`](./backend/sql/schema_neon.sql) e execute diretamente no **SQL Editor** do painel do Neon.

---

## 🚀 Como Executar o Projeto Completo

### 1️⃣ Backend (Python + FastAPI + Neon Postgres)

```bash
cd backend

# 1. Crie e ative um ambiente virtual Python
python -m venv .venv
.\.venv\Scripts\activate

# 2. Instale as dependências
pip install -r requirements.txt

# 3. Gere suas chaves criptográficas seguras e configure o arquivo .env
copy .env.example .env
python scripts/gerar_chaves_seguranca.py
# (Cole as chaves geradas e a DATABASE_URL do Neon no arquivo backend/.env)

# 4. (Opcional) Popule dados iniciais de teste criptografados no Neon
python -m scripts.seed_neon

# 5. Inicie o servidor FastAPI na porta 8000
uvicorn app.main:app --reload --port 8000
```
- Documentação interativa da API (Swagger UI): `http://localhost:8000/docs`

### 2️⃣ Frontend (React + TypeScript + Vite)

```bash
cd frontend

# 1. Copie o arquivo de variáveis de ambiente
copy .env.example .env
# Use VITE_USE_MOCKS="false" para usar o Backend Python + Neon Postgres
# ou VITE_USE_MOCKS="true" para testar apenas a interface com mocks em memória

# 2. Instale as dependências (caso ainda não instaladas)
npm install

# 3. Inicie o servidor de desenvolvimento Vite
npm run dev
```
- Acesse a aplicação em: `http://localhost:5173`


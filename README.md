# ArterIA

Sistema de Apoio ao Diagnóstico Radiológico por IA — front-end desenvolvido em React + TypeScript + Vite + Material UI.

## Stack utilizada

- React 19
- TypeScript
- Vite
- React Router DOM
- Material UI (MUI)
- Axios
- React Hook Form + Zod
- TanStack Query (React Query)
- Zustand
- React Dropzone
- React Hot Toast
- Day.js
- Lucide React
- ESLint + Prettier

## Pré-requisitos

Antes de começar, você precisa ter instalado:

- Node.js (versão 18 ou superior) — https://nodejs.org/
- Git — https://git-scm.com/

Para conferir se já tem o Node instalado, rode no terminal:

```bash
node -v
```

## Como instalar e rodar o projeto

1. Clone o repositório

```bash
git clone https://github.com/UniceplacStartup/ArterIA.git
```

2. Entre na pasta do projeto

```bash
cd ArterIA
```

3. Instale as dependências

```bash
npm install
```

4. Rode o projeto em modo de desenvolvimento

```bash
npm run dev
```

O terminal vai mostrar um link parecido com este:

```
Local:   http://localhost:5173/
```

Abra esse endereço no navegador para visualizar o projeto.

## Telas disponíveis

| Rota                      | Descrição                          |
|----------------------------|-------------------------------------|
| /cadastro-profissional     | Cadastro do profissional (médico)  |
| /cadastro-paciente         | Cadastro de novo paciente           |

Acessando a raiz do projeto (/), você é redirecionado automaticamente para /cadastro-profissional.

## Build de produção

Para gerar a versão de produção do projeto:

```bash
npm run build
```

Os arquivos finais são gerados na pasta dist/.

## Lint

Para checar o padrão de código do projeto:

```bash
npm run lint
```
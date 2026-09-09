# Jornadas

Plataforma multiedição para gestão da Jornada Farmacêutica: programação, inscrições, presença administrativa por RA, passaporte digital, certificados, brindes, sorteios, estoque, notificações e relatórios.

## Desenvolvimento local

Pré-requisito: Node.js 20.9 ou mais recente.

```bash
npm install
copy .env.example .env
npm run setup
npm run dev
```

Acesse `http://127.0.0.1:3000`. Em um telefone conectado à mesma rede
Wi-Fi, abra `http://IP-DO-COMPUTADOR:3000`.

No macOS ou Linux, substitua `copy .env.example .env` por
`cp .env.example .env`.

Para simular a execução final depois de preparar o banco:

```bash
npm run build
npm start
```

Contas DEV (dados fictícios):

- Participante: primeiro nome `Lívia`, RA `48884`.
- Administração: `admin@jornadas.dev`, senha `Jornada@2026!`.
- Operação: `operador@jornadas.dev`, senha `Jornada@2026!`.

O seed só é executado quando `DEV_SEED=true`. Não use as credenciais DEV em produção.

## Verificação

```bash
npm test
npm run typecheck
npm run lint
npm run build
$env:E2E_START_SERVER="1"; npm run test:e2e
```

SQLite é usado no preview local. O schema de produção está em `prisma/schema.postgresql.prisma`; defina uma URL PostgreSQL e gere/aplique as migrations desse schema no ambiente de produção. A pasta `prisma/migrations` contém a migração reproduzível do preview.

Operações automáticas de no-show, promoção de espera e expiração podem ser executadas com `npm run jobs` em um agendador confiável.

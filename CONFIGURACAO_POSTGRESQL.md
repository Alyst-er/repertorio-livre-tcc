# Configuração PostgreSQL

## Estado atual

O backend Flask desta versão usa PostgreSQL diretamente por meio do pacote `psycopg`. Não há fallback automático para SQLite. O serviço PostgreSQL deve estar iniciado antes de executar `app.py`.

Banco local configurado:

```text
Host: 127.0.0.1
Porta: 5432
Banco: repertorio_livre
Usuário: repertorio_user
```

A conexão pode ser alterada pela variável de ambiente `DATABASE_URL`. Se ela não for definida, o backend usa a URL local padrão configurada para desenvolvimento.

## Windows

Na pasta do projeto:

```cmd
py -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
```

Crie o banco pelo pgAdmin ou SQL Shell e aplique:

```cmd
psql -h localhost -U repertorio_user -d repertorio_livre -f database\schema.sql
```

Defina a conexão na sessão do terminal, substituindo a senha pela senha do seu usuário PostgreSQL:

```cmd
set DATABASE_URL=postgresql://repertorio_user:SUA_SENHA@127.0.0.1:5432/repertorio_livre
set SECRET_KEY=troque-por-uma-chave-secreta
python app.py
```

Depois abra `http://localhost:5000/api/health`. O resultado esperado contém:

```json
{"database":"postgresql","status":"ok"}
```

## Administrador mestre

No primeiro início, o backend garante a conta `alyssonpatricks15@gmail.com` com permissão administrativa mestre. O banco PostgreSQL armazena somente o hash da senha. O painel fica em `http://localhost:5000/admin.html`.

## Segurança

Não publique a senha do PostgreSQL no código nem no Git. Em produção, use variável de ambiente ou um gerenciador de segredos, configure `COOKIE_SECURE=1` atrás de HTTPS, troque a senha inicial do administrador e adicione migrations, CSRF, rate limiting, logs e backups.

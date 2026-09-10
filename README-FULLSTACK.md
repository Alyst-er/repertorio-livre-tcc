# Repertório Livre — versão Fullstack

Esta versão mantém as páginas HTML, o stylesheet CSS e a lógica JavaScript, acrescentando um backend em **Python + Flask** conectado diretamente ao **PostgreSQL** por meio do pacote `psycopg`.

A aplicação começa deliberadamente sem repertórios, músicas, eventos ou perfil de demonstração. O conteúdo deverá ser cadastrado por usuários autenticados.

## Executar localmente

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL='postgresql://repertorio_user:SUA_SENHA@127.0.0.1:5432/repertorio_livre'
export SECRET_KEY='troque-por-uma-chave-secreta'
python app.py
```

No Windows PowerShell:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:DATABASE_URL='postgresql://repertorio_user:SUA_SENHA@127.0.0.1:5432/repertorio_livre'
$env:SECRET_KEY='troque-por-uma-chave-secreta'
python app.py
```

Abra `http://localhost:5000`. O endpoint `http://localhost:5000/api/health` deve informar `database: postgresql` e `status: ok`.

## Banco de dados

O arquivo `database/schema.sql` cria as entidades `users`, `bands`, `band_members`, `repertoires`, `songs`, `repertoire_songs`, `events` e `comments`. Execute-o no banco `repertorio_livre` antes de iniciar o Flask. O backend também executa o esquema de forma idempotente na inicialização.

## Administrador mestre

A conta `alyssonpatricks15@gmail.com` é garantida automaticamente no primeiro início com a permissão mestre. O painel restrito fica em `admin.html` e permite consultar usuários, repertórios e bandas, além de apagar usuários comuns e repertórios. A senha não é armazenada em texto puro: o backend guarda somente um hash derivado.

Por segurança, troque a senha inicial antes de qualquer publicação na internet e não coloque senhas do PostgreSQL ou chaves Flask no Git.

## Funcionalidades

A API fornece cadastro, login, logout, sessão autenticada, perfil, criação e edição de repertórios, músicas com letra e cifra, controle de visibilidade, sincronização do estado local, comentários, bandas, membros, eventos e endpoint público para links compartilhados.

Esta é uma base funcional de desenvolvimento. Antes de disponibilizar publicamente, devem ser adicionados migrations versionadas, HTTPS, proteção CSRF, rate limiting, recuperação de senha, logs, backups e testes automatizados de segurança.

## Escopo acadêmico

A plataforma demonstra criação, organização, edição, visualização e compartilhamento controlado de repertórios, além de colaboração entre músicos e bandas. A avaliação com usuários especialistas continua sendo uma etapa metodológica do TCC e deve ser realizada com participantes reais, usando um questionário estruturado.

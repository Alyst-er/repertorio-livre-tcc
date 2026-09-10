import json
import os
import secrets
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json
from flask import Flask, jsonify, request, session, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
DATABASE_URL = os.getenv("DATABASE_URL")
MASTER_ADMIN_EMAIL = "alyssonpatricks15@gmail.com"
MASTER_ADMIN_PASSWORD_HASH = "scrypt:32768:8:1$ILIggyUwhedll6se$e970bce0e93065211d8f7ba55c003f60c00e8ca01eef8866de2d25f365de7dda9623bc941499c1bdc07926b734547c45fa4bef80d54ec74c2706edd95b3b2ea0"
app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
app.secret_key = os.getenv("SECRET_KEY", secrets.token_hex(32))
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax", SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "0") == "1")


def now():
    return datetime.now(timezone.utc)


def db():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL não configurada. Defina a URL do PostgreSQL antes de iniciar o Flask.")
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def execute(connection, statement, params=()):
    return connection.execute(statement.replace("?", "%s"), params)


def init_db():
    schema_path = BASE_DIR / "database" / "schema.sql"
    with db() as connection:
        connection.execute(schema_path.read_text(encoding="utf-8"))
        execute(connection, """INSERT INTO users (name,email,password_hash,is_admin,stage_name)
            VALUES (?,?,?,?,?) ON CONFLICT (email) DO UPDATE SET is_admin=TRUE""",
            ("Administrador mestre", MASTER_ADMIN_EMAIL, MASTER_ADMIN_PASSWORD_HASH, True, ""))


def json_row(row):
    return dict(row) if row else None


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    with db() as connection:
        return json_row(execute(connection, "SELECT id,name,email,is_admin,stage_name,role,city,bio,instruments,created_at FROM users WHERE id=?", (user_id,)).fetchone())


def login_required(handler):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        if not current_user():
            return jsonify({"error": "Autenticação necessária."}), 401
        return handler(*args, **kwargs)
    return wrapper


def admin_required(handler):
    @wraps(handler)
    @login_required
    def wrapper(*args, **kwargs):
        if not current_user().get("is_admin"):
            return jsonify({"error": "Acesso exclusivo do administrador mestre."}), 403
        return handler(*args, **kwargs)
    return wrapper


def can_access(connection, repertoire_id, write=False):
    user_id = session.get("user_id")
    item = execute(connection, "SELECT * FROM repertoires WHERE id=?", (repertoire_id,)).fetchone()
    if not item:
        return None
    master = execute(connection, "SELECT is_admin FROM users WHERE id=?", (user_id,)).fetchone()
    if master and master["is_admin"]:
        return item
    if item["owner_id"] == user_id:
        return item
    if item["band_id"]:
        member = execute(connection, "SELECT permission FROM band_members WHERE band_id=? AND user_id=?", (item["band_id"], user_id)).fetchone()
        if member and (not write or member["permission"] in ("owner", "editor")):
            return item
    if not write and item["visibility"] == "shared":
        return item
    return None


def repertoire_payload(connection, item):
    songs = execute(connection, """SELECT s.id,s.title,s.artist,s.musical_key AS key,s.duration,s.bpm,s.lyrics,s.chords,s.notes,
      rs.position,rs.notes AS repertoire_notes FROM songs s JOIN repertoire_songs rs ON rs.song_id=s.id
      WHERE rs.repertoire_id=? ORDER BY rs.position,s.id""", (item["id"],)).fetchall()
    result = dict(item)
    result["songs"] = [dict(song) for song in songs]
    result["events"] = [dict(event) for event in execute(connection, "SELECT * FROM events WHERE repertoire_id=? ORDER BY event_date,event_time", (item["id"],)).fetchall()]
    return result


@app.get("/api/health")
def health():
    try:
        with db() as connection:
            connection.execute("SELECT 1")
        return jsonify({"status": "ok", "database": "postgresql", "message": "Conexão PostgreSQL ativa."})
    except Exception as error:
        return jsonify({"status": "error", "database": "postgresql", "message": str(error)}), 503


@app.post("/api/auth/register")
def register():
    payload = request.get_json(silent=True) or {}
    name, email, password = str(payload.get("name", "")).strip(), str(payload.get("email", "")).strip().lower(), str(payload.get("password", ""))
    if not name or "@" not in email or len(password) < 6:
        return jsonify({"error": "Informe nome, e-mail válido e senha com pelo menos 6 caracteres."}), 400
    try:
        with db() as connection:
            user = execute(connection, """INSERT INTO users (name,email,password_hash,stage_name) VALUES (?,?,?,?) RETURNING id""", (name, email, generate_password_hash(password), "")).fetchone()
            session["user_id"] = user["id"]
    except psycopg.errors.UniqueViolation:
        return jsonify({"error": "Este e-mail já está cadastrado."}), 409
    return jsonify({"user": current_user()}), 201


@app.post("/api/auth/login")
def login():
    payload = request.get_json(silent=True) or {}
    email, password = str(payload.get("email", "")).strip().lower(), str(payload.get("password", ""))
    with db() as connection:
        user = execute(connection, "SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "E-mail ou senha inválidos."}), 401
    session["user_id"] = user["id"]
    return jsonify({"user": current_user()})


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/auth/me")
def me():
    user = current_user()
    return jsonify({"user": user}) if user else (jsonify({"user": None}), 401)


@app.get("/api/repertoires")
@login_required
def list_repertoires():
    user_id = session["user_id"]
    with db() as connection:
        rows = execute(connection, """SELECT DISTINCT r.* FROM repertoires r LEFT JOIN band_members bm ON bm.band_id=r.band_id
          WHERE r.owner_id=? OR bm.user_id=? ORDER BY r.updated_at DESC""", (user_id, user_id)).fetchall()
        return jsonify({"repertoires": [repertoire_payload(connection, item) for item in rows]})


@app.get("/api/state")
@login_required
def get_state():
    with db() as connection:
        rows = execute(connection, "SELECT * FROM repertoires WHERE owner_id=? ORDER BY updated_at DESC", (session["user_id"],)).fetchall()
        return jsonify({"repertoires": [repertoire_payload(connection, item) for item in rows], "profile": current_user()})


@app.put("/api/state")
@login_required
def put_state():
    payload, timestamp = request.get_json(silent=True) or {}, now()
    with db() as connection:
        owned = execute(connection, "SELECT id FROM repertoires WHERE owner_id=?", (session["user_id"],)).fetchall()
        for item in owned:
            execute(connection, "DELETE FROM repertoires WHERE id=?", (item["id"],))
        for repertoire in payload.get("repertoires", []):
            rep_id = execute(connection, """INSERT INTO repertoires (name,category,event_date,event_time,location,notes,visibility,owner_id,share_token,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id""", (repertoire.get("name", "Sem nome"), repertoire.get("category", ""), repertoire.get("date") or None, repertoire.get("time") or None, repertoire.get("location", ""), repertoire.get("notes", ""), repertoire.get("visibility", "private"), session["user_id"], secrets.token_urlsafe(18), timestamp, timestamp)).fetchone()["id"]
            for position, song in enumerate(repertoire.get("songs", [])):
                if str(song.get("title", "")).strip():
                    song_id = execute(connection, """INSERT INTO songs (title,artist,musical_key,duration,bpm,lyrics,chords,notes) VALUES (?,?,?,?,?,?,?,?) RETURNING id""", (song.get("title", ""), song.get("artist", ""), song.get("key", ""), song.get("duration", ""), song.get("bpm"), song.get("lyrics", ""), song.get("chords", ""), song.get("notes", ""))).fetchone()["id"]
                    execute(connection, "INSERT INTO repertoire_songs (repertoire_id,song_id,position,notes) VALUES (?,?,?,?)", (rep_id, song_id, position, song.get("notes", "")))
    return jsonify({"ok": True})


def insert_songs(connection, repertoire_id, songs):
    for position, song in enumerate(songs):
        if not str(song.get("title", "")).strip():
            continue
        song_id = execute(connection, """INSERT INTO songs (title,artist,musical_key,duration,bpm,lyrics,chords,notes) VALUES (?,?,?,?,?,?,?,?) RETURNING id""", (song.get("title", ""), song.get("artist", ""), song.get("key", ""), song.get("duration", ""), song.get("bpm"), song.get("lyrics", ""), song.get("chords", ""), song.get("notes", ""))).fetchone()["id"]
        execute(connection, "INSERT INTO repertoire_songs (repertoire_id,song_id,position,notes) VALUES (?,?,?,?)", (repertoire_id, song_id, position, song.get("notes", "")))


@app.post("/api/repertoires")
@login_required
def create_repertoire():
    payload, timestamp = request.get_json(silent=True) or {}, now()
    name = str(payload.get("name", "")).strip()
    if not name:
        return jsonify({"error": "O nome do repertório é obrigatório."}), 400
    with db() as connection:
        rep_id = execute(connection, """INSERT INTO repertoires (name,category,event_date,event_time,location,notes,visibility,owner_id,band_id,share_token,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id""", (name, payload.get("category", ""), payload.get("date") or None, payload.get("time") or None, payload.get("location", ""), payload.get("notes", ""), payload.get("visibility", "private"), session["user_id"], payload.get("band_id"), secrets.token_urlsafe(18), timestamp, timestamp)).fetchone()["id"]
        insert_songs(connection, rep_id, payload.get("songs", []))
        item = execute(connection, "SELECT * FROM repertoires WHERE id=?", (rep_id,)).fetchone()
        return jsonify({"repertoire": repertoire_payload(connection, item)}), 201


@app.get("/api/repertoires/<int:repertoire_id>")
@login_required
def get_repertoire(repertoire_id):
    with db() as connection:
        item = can_access(connection, repertoire_id)
        return jsonify({"repertoire": repertoire_payload(connection, item)}) if item else (jsonify({"error": "Repertório não encontrado ou sem permissão."}), 404)


@app.put("/api/repertoires/<int:repertoire_id>")
@login_required
def update_repertoire(repertoire_id):
    payload, timestamp = request.get_json(silent=True) or {}, now()
    with db() as connection:
        item = can_access(connection, repertoire_id, write=True)
        if not item:
            return jsonify({"error": "Você não tem permissão para editar este repertório."}), 403
        execute(connection, """UPDATE repertoires SET name=?,category=?,event_date=?,event_time=?,location=?,notes=?,visibility=?,band_id=?,updated_at=? WHERE id=?""", (payload.get("name", item["name"]), payload.get("category", item["category"]), payload.get("date") or None, payload.get("time") or None, payload.get("location", item["location"]), payload.get("notes", item["notes"]), payload.get("visibility", item["visibility"]), payload.get("band_id", item["band_id"]), timestamp, repertoire_id))
        if "songs" in payload:
            execute(connection, "DELETE FROM repertoire_songs WHERE repertoire_id=?", (repertoire_id,))
            insert_songs(connection, repertoire_id, payload["songs"])
        return jsonify({"repertoire": repertoire_payload(connection, execute(connection, "SELECT * FROM repertoires WHERE id=?", (repertoire_id,)).fetchone())})


@app.delete("/api/repertoires/<int:repertoire_id>")
@login_required
def delete_repertoire(repertoire_id):
    with db() as connection:
        if not can_access(connection, repertoire_id, write=True):
            return jsonify({"error": "Você não tem permissão para excluir este repertório."}), 403
        execute(connection, "DELETE FROM repertoires WHERE id=?", (repertoire_id,))
    return jsonify({"ok": True})


@app.post("/api/repertoires/<int:repertoire_id>/comments")
@login_required
def comment_repertoire(repertoire_id):
    body = str((request.get_json(silent=True) or {}).get("body", "")).strip()
    if not body:
        return jsonify({"error": "O comentário não pode ficar vazio."}), 400
    with db() as connection:
        if not can_access(connection, repertoire_id):
            return jsonify({"error": "Sem permissão para comentar."}), 403
        comment = execute(connection, "INSERT INTO comments (repertoire_id,user_id,body) VALUES (?,?,?) RETURNING *", (repertoire_id, session["user_id"], body)).fetchone()
        return jsonify({"comment": json_row(comment)}), 201


@app.get("/share/<share_token>")
def public_share(share_token):
    with db() as connection:
        item = execute(connection, "SELECT * FROM repertoires WHERE share_token=? AND visibility IN ('shared','public')", (share_token,)).fetchone()
        return jsonify({"repertoire": repertoire_payload(connection, item)}) if item else (jsonify({"error": "Link de compartilhamento inválido ou privado."}), 404)


@app.get("/api/profile")
@login_required
def profile():
    return jsonify({"profile": current_user()})


@app.put("/api/profile")
@login_required
def update_profile():
    payload = request.get_json(silent=True) or {}
    instruments = payload.get("instruments", [])
    if isinstance(instruments, str):
        instruments = [item.strip() for item in instruments.split(",") if item.strip()]
    with db() as connection:
        execute(connection, "UPDATE users SET name=?,stage_name=?,role=?,city=?,bio=?,instruments=? WHERE id=?", (payload.get("name", ""), payload.get("stage_name", ""), payload.get("role", "Músico"), payload.get("city", ""), payload.get("bio", ""), Json(instruments), session["user_id"]))
    return jsonify({"profile": current_user()})


@app.get("/api/admin/overview")
@admin_required
def admin_overview():
    with db() as connection:
        return jsonify({"users": [dict(x) for x in execute(connection, "SELECT id,name,email,is_admin,created_at FROM users ORDER BY created_at").fetchall()], "repertoires": [dict(x) for x in execute(connection, "SELECT id,name,visibility,owner_id,created_at,updated_at FROM repertoires ORDER BY updated_at DESC").fetchall()], "bands": [dict(x) for x in execute(connection, "SELECT id,name,owner_id,created_at FROM bands ORDER BY created_at DESC").fetchall()]})


@app.delete("/api/admin/users/<int:user_id>")
@admin_required
def admin_delete_user(user_id):
    with db() as connection:
        target = execute(connection, "SELECT email FROM users WHERE id=?", (user_id,)).fetchone()
        if not target:
            return jsonify({"error": "Usuário não encontrado."}), 404
        if target["email"].lower() == MASTER_ADMIN_EMAIL:
            return jsonify({"error": "A conta mestre não pode ser apagada por esta interface."}), 400
        execute(connection, "DELETE FROM users WHERE id=?", (user_id,))
    return jsonify({"ok": True})


@app.delete("/api/admin/repertoires/<int:repertoire_id>")
@admin_required
def admin_delete_repertoire(repertoire_id):
    with db() as connection:
        execute(connection, "DELETE FROM repertoires WHERE id=?", (repertoire_id,))
    return jsonify({"ok": True})


@app.get("/api/bands")
@login_required
def list_bands():
    with db() as connection:
        rows = execute(connection, "SELECT DISTINCT b.*,bm.permission FROM bands b JOIN band_members bm ON bm.band_id=b.id WHERE bm.user_id=? ORDER BY b.name", (session["user_id"],)).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            item["members"] = [dict(member) for member in execute(connection, "SELECT u.id,u.name,u.email,bm.permission FROM users u JOIN band_members bm ON bm.user_id=u.id WHERE bm.band_id=? ORDER BY u.name", (row["id"],)).fetchall()]
            result.append(item)
        return jsonify({"bands": result})


@app.post("/api/bands")
@login_required
def create_band():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    if not name:
        return jsonify({"error": "Informe o nome da banda ou grupo."}), 400
    with db() as connection:
        band_id = execute(connection, "INSERT INTO bands (name,description,owner_id) VALUES (?,?,?) RETURNING id", (name, payload.get("description", ""), session["user_id"])).fetchone()["id"]
        execute(connection, "INSERT INTO band_members (band_id,user_id,permission) VALUES (?,?,?)", (band_id, session["user_id"], "owner"))
        return jsonify({"band": json_row(execute(connection, "SELECT * FROM bands WHERE id=?", (band_id,)).fetchone())}), 201


@app.post("/api/bands/<int:band_id>/members")
@login_required
def add_band_member(band_id):
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    with db() as connection:
        owner = execute(connection, "SELECT 1 FROM band_members WHERE band_id=? AND user_id=? AND permission='owner'", (band_id, session["user_id"])).fetchone()
        user = execute(connection, "SELECT id FROM users WHERE email=?", (email,)).fetchone()
        if not owner:
            return jsonify({"error": "Somente o proprietário pode adicionar integrantes."}), 403
        if not user:
            return jsonify({"error": "O usuário precisa criar uma conta antes do convite."}), 404
        execute(connection, "INSERT INTO band_members (band_id,user_id,permission) VALUES (?,?,?) ON CONFLICT (band_id,user_id) DO UPDATE SET permission=EXCLUDED.permission", (band_id, user["id"], payload.get("permission", "member")))
    return jsonify({"ok": True})


@app.post("/api/repertoires/<int:repertoire_id>/events")
@login_required
def create_event(repertoire_id):
    payload = request.get_json(silent=True) or {}
    with db() as connection:
        if not can_access(connection, repertoire_id, write=True):
            return jsonify({"error": "Sem permissão para agendar neste repertório."}), 403
        event = execute(connection, "INSERT INTO events (repertoire_id,title,event_date,event_time,location,status) VALUES (?,?,?,?,?,?) RETURNING *", (repertoire_id, payload.get("title", "Apresentação"), payload.get("event_date", ""), payload.get("event_time", "00:00"), payload.get("location", ""), payload.get("status", "scheduled"))).fetchone()
        return jsonify({"event": json_row(event)}), 201


@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_files(path):
    if path.startswith("api/") or path.startswith("share/"):
        return jsonify({"error": "Rota não encontrada."}), 404
    candidate = BASE_DIR / path
    return send_from_directory(BASE_DIR, path if candidate.is_file() else "index.html")


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG", "0") == "1")

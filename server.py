from __future__ import annotations

import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "niveltech.db"

app = Flask(__name__, static_folder=".", static_url_path="")
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "niveltech-demo-secret")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "None"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("SESSION_COOKIE_SECURE", "true").lower() in {"1", "true", "yes", "on"}
app.config["REMEMBER_COOKIE_SAMESITE"] = "None"
app.config["REMEMBER_COOKIE_SECURE"] = app.config["SESSION_COOKIE_SECURE"]

ALLOWED_ORIGINS = {
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
}


@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = app.make_response("")
        response.status_code = 204
        response.headers["Access-Control-Allow-Origin"] = request.headers.get("Origin") or "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, X-Requested-With"
        response.headers["Access-Control-Max-Age"] = "86400"
        response.headers["Vary"] = "Origin"
        return response


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin:
        if ALLOWED_ORIGINS and origin not in ALLOWED_ORIGINS:
            return response
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, X-Requested-With"
    response.headers["Access-Control-Expose-Headers"] = "Content-Type, Authorization"
    return response


MANAGERS = [
    "antoniodanielferreiraalencar@gmail.com",
    "airtongleisson@gmail.com",
    "thyagosilvalima664@gmail.com",
    "gabrielribeirolima667@gmail.com",
    "joaovenanciotexeira7@gmail.com",
    "thcontaparaafiliacao@gmail.com",
]
DEFAULT_MANAGER_PASSWORD = "Tgdv2026"


def normalize_email(value: str | None) -> str:
    return (value or "").strip().lower()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone TEXT,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'client',
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            company TEXT NOT NULL,
            type TEXT,
            description TEXT,
            reference TEXT,
            status TEXT NOT NULL DEFAULT 'Pendente',
            deadline TEXT,
            requested_days INTEGER DEFAULT 0,
            price REAL DEFAULT 0,
            manager_note TEXT,
            client_name TEXT,
            client_email TEXT,
            client_phone TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            sender TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(order_id) REFERENCES orders(id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            note TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(order_id) REFERENCES orders(id)
        )
        """
    )

    for email in MANAGERS:
        existing = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if existing is None:
            conn.execute(
                "INSERT INTO users (id, name, email, phone, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    uuid.uuid4().hex,
                    email.split("@")[0],
                    email,
                    "",
                    generate_password_hash(DEFAULT_MANAGER_PASSWORD),
                    "manager",
                    now_iso(),
                ),
            )
        else:
            conn.execute(
                "UPDATE users SET password_hash = ?, role = 'manager' WHERE email = ?",
                (generate_password_hash(DEFAULT_MANAGER_PASSWORD), email),
            )
    conn.commit()
    conn.close()


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(user) if user else None


def require_login():
    user = current_user()
    if not user:
        return None
    return user


def serialize_order(order_row, conn):
    order = dict(order_row)
    messages = conn.execute(
        "SELECT * FROM messages WHERE order_id = ? ORDER BY created_at ASC",
        (order["id"],),
    ).fetchall()
    payments = conn.execute(
        "SELECT * FROM payments WHERE order_id = ? ORDER BY date DESC, created_at DESC",
        (order["id"],),
    ).fetchall()
    order["messages"] = [dict(m) for m in messages]
    order["payments"] = [dict(p) for p in payments]
    order["received"] = sum(float(p["amount"]) for p in payments)
    return order


@app.route("/")
def index():
    return send_from_directory(str(BASE_DIR), "index.html")


@app.get("/api/session")
def session_route():
    user = current_user()
    return jsonify({"user": user})


@app.post("/api/register")
def register_user():
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    email = normalize_email(payload.get("email"))
    password = str(payload.get("password") or "")
    phone = (payload.get("phone") or "").strip()

    if not name or not email or len(password) < 6:
        return jsonify({"error": "Nome, e-mail e senha com pelo menos 6 caracteres são obrigatórios."}), 400

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "Este e-mail já está cadastrado."}), 409

    user_id = uuid.uuid4().hex
    conn.execute(
        "INSERT INTO users (id, name, email, phone, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, 'client', ?)",
        (user_id, name, email, phone, generate_password_hash(password), now_iso()),
    )
    conn.commit()
    session["user_id"] = user_id
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return jsonify({"user": dict(user)})


@app.post("/api/login")
def login_user():
    payload = request.get_json(silent=True) or {}
    email = normalize_email(payload.get("email"))
    password = str(payload.get("password") or "")

    if not email or not password:
        return jsonify({"error": "Informe e-mail e senha."}), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "E-mail ou senha inválidos."}), 401

    if not check_password_hash(user["password_hash"], password):
        conn.close()
        return jsonify({"error": "E-mail ou senha inválidos."}), 401

    session["user_id"] = user["id"]
    conn.close()
    return jsonify({"user": dict(user)})


@app.post("/api/logout")
def logout_user():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/orders")
def get_orders():
    user = require_login()
    if not user:
        return jsonify({"error": "Sessão expirada."}), 401

    conn = get_db()
    if user["role"] == "manager":
        rows = conn.execute("SELECT * FROM orders ORDER BY created_at DESC").fetchall()
    else:
        rows = conn.execute("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", (user["id"],)).fetchall()

    orders = [serialize_order(row, conn) for row in rows]
    conn.close()
    return jsonify({"orders": orders})


@app.post("/api/orders")
def create_order():
    user = require_login()
    if not user or user["role"] != "client":
        return jsonify({"error": "Acesso restrito para clientes."}), 403

    payload = request.get_json(silent=True) or {}
    company = (payload.get("company") or "").strip()
    order_type = (payload.get("type") or "").strip()
    description = (payload.get("description") or "").strip()
    reference = (payload.get("reference") or "").strip()
    start_date = (payload.get("startDate") or "").strip()
    requested_days = int(payload.get("requestedDays") or 0)

    if not company or not order_type:
        return jsonify({"error": "Empresa e tipo do projeto são obrigatórios."}), 400

    order_id = f"NT-{uuid.uuid4().hex[:8].upper()}"
    created_at = now_iso()
    deadline = start_date
    if start_date and requested_days > 0:
        try:
            from datetime import timedelta
            deadline = (datetime.fromisoformat(start_date) + timedelta(days=requested_days)).date().isoformat()
        except ValueError:
            deadline = start_date

    conn = get_db()
    conn.execute(
        """
        INSERT INTO orders (
            id, user_id, company, type, description, reference, status,
            deadline, requested_days, price, manager_note,
            client_name, client_email, client_phone,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            order_id,
            user["id"],
            company,
            order_type,
            description,
            reference,
            "Pendente",
            deadline,
            requested_days,
            0,
            "",
            user["name"],
            user["email"],
            user["phone"],
            created_at,
            created_at,
        ),
    )
    conn.execute(
        "INSERT INTO messages (id, order_id, sender, sender_name, text, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (
            uuid.uuid4().hex,
            order_id,
            "sistema",
            "Sistema",
            f"Recebemos seu pedido para {company}. Nossa equipe vai analisar os detalhes e responder em breve.",
            created_at,
        ),
    )
    conn.commit()
    order = serialize_order(conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone(), conn)
    conn.close()
    return jsonify({"order": order})


@app.post("/api/orders/<order_id>/message")
def add_message(order_id):
    user = require_login()
    if not user:
        return jsonify({"error": "Sessão expirada."}), 401

    payload = request.get_json(silent=True) or {}
    text = (payload.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Mensagem vazia."}), 400

    sender = "cliente" if user["role"] == "client" else "gerente"
    sender_name = user["name"] if user["role"] == "client" else "Gerente"

    conn = get_db()
    order = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not order:
        conn.close()
        return jsonify({"error": "Pedido não encontrado."}), 404

    if user["role"] != "manager" and order["user_id"] != user["id"]:
        conn.close()
        return jsonify({"error": "Este pedido não pertence a você."}), 403

    message_id = uuid.uuid4().hex
    conn.execute(
        "INSERT INTO messages (id, order_id, sender, sender_name, text, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (message_id, order_id, sender, sender_name, text, now_iso()),
    )
    conn.execute(
        "UPDATE orders SET updated_at = ? WHERE id = ?",
        (now_iso(), order_id),
    )
    conn.commit()
    order = serialize_order(order, conn)
    conn.close()
    return jsonify({"order": order})


@app.post("/api/orders/<order_id>/status")
def update_order_status(order_id):
    user = require_login()
    if not user or user["role"] != "manager":
        return jsonify({"error": "Acesso restrito a gerentes."}), 403

    payload = request.get_json(silent=True) or {}
    status = (payload.get("status") or "").strip()
    price = payload.get("price")
    manager_note = (payload.get("manager_note") or "").strip()
    if not status:
        return jsonify({"error": "Status obrigatório."}), 400

    conn = get_db()
    order = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not order:
        conn.close()
        return jsonify({"error": "Pedido não encontrado."}), 404

    update_values = [status, now_iso()]
    query = "UPDATE orders SET status = ?, updated_at = ?"
    if price is not None:
        query += ", price = ?"
        update_values.append(float(price))
    if manager_note:
        query += ", manager_note = ?"
        update_values.append(manager_note)
    query += " WHERE id = ?"
    update_values.append(order_id)

    conn.execute(query, tuple(update_values))
    conn.commit()
    updated = serialize_order(conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone(), conn)
    conn.close()
    return jsonify({"order": updated})


@app.post("/api/orders/<order_id>/payment")
def add_payment(order_id):
    user = require_login()
    if not user or user["role"] != "manager":
        return jsonify({"error": "Acesso restrito a gerentes."}), 403

    payload = request.get_json(silent=True) or {}
    amount = payload.get("amount")
    note = (payload.get("note") or "").strip()
    date = (payload.get("date") or datetime.utcnow().date().isoformat()).strip()
    if amount is None:
        return jsonify({"error": "Valor do pagamento obrigatório."}), 400

    conn = get_db()
    order = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not order:
        conn.close()
        return jsonify({"error": "Pedido não encontrado."}), 404

    payment_id = uuid.uuid4().hex
    conn.execute(
        "INSERT INTO payments (id, order_id, amount, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (payment_id, order_id, float(amount), date, note, now_iso()),
    )
    conn.execute("UPDATE orders SET updated_at = ? WHERE id = ?", (now_iso(), order_id))
    conn.commit()
    updated = serialize_order(conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone(), conn)
    conn.close()
    return jsonify({"order": updated})


@app.get("/api/managers")
def manager_list():
    return jsonify({"managers": [
        {"name": email.split("@")[0], "email": email} for email in MANAGERS
    ]})


@app.route("/health")
def health():
    return jsonify({"ok": True})


init_db()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "0").lower() in {"1", "true", "yes"}
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)


from flask import Flask, render_template, request, jsonify
import sqlite3
import math
from datetime import date

app = Flask(__name__)

# Database file location
DATABASE = "pennytrack.db"


# ----------------------------------
# 1. Connect to SQLite database
# ----------------------------------

def get_db_connection():

    connection = sqlite3.connect(DATABASE)

    connection.row_factory = sqlite3.Row

    return connection


# ----------------------------------
# 2. Create database table
# ----------------------------------

def initialize_database():

    connection = get_db_connection()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS transactions (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            title TEXT NOT NULL,

            category TEXT NOT NULL,

            type TEXT NOT NULL,

            amount REAL NOT NULL,

            date TEXT NOT NULL

        )
    """)

    connection.commit()

    connection.close()


# ----------------------------------
# 3. Home page
# ----------------------------------

@app.route("/")
def home():

    return render_template("index.html")


# ----------------------------------
# 4. Get all transactions
# ----------------------------------

@app.route("/api/transactions", methods=["GET"])
def get_transactions():

    connection = get_db_connection()

    rows = connection.execute(
        "SELECT * FROM transactions ORDER BY date DESC, id DESC"
    ).fetchall()

    connection.close()

    transactions = [dict(row) for row in rows]

    return jsonify(transactions)


# ----------------------------------
# 5. Add a new transaction
# ----------------------------------

@app.route("/api/transactions", methods=["POST"])
def add_transaction():

    data = request.get_json(silent=True) or {}

    title = str(data.get("title", "")).strip()
    category = str(data.get("category", "")).strip()
    transaction_type = data.get("type")
    transaction_date = data.get("date")

    try:
        amount = float(data.get("amount", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount"}), 400

    if not title or not category:
        return jsonify({"error": "Title and category are required"}), 400

    if transaction_type not in ["income", "expense"]:
        return jsonify({"error": "Invalid transaction type"}), 400

    if not math.isfinite(amount) or amount <= 0:
        return jsonify({"error": "Amount must be greater than zero"}), 400

    try:
        date.fromisoformat(transaction_date)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid date"}), 400

    connection = get_db_connection()

    cursor = connection.execute("""
        INSERT INTO transactions
        (title, category, type, amount, date)

        VALUES (?, ?, ?, ?, ?)
    """, (
        title,
        category,
        transaction_type,
        amount,
        transaction_date
    ))

    connection.commit()

    new_id = cursor.lastrowid

    connection.close()

    return jsonify({
        "message": "Transaction added successfully",
        "id": new_id
    }), 201


# ----------------------------------
# 6. Delete a transaction
# ----------------------------------

@app.route("/api/transactions/<int:transaction_id>", methods=["DELETE"])
def delete_transaction(transaction_id):

    connection = get_db_connection()

    cursor = connection.execute(
        "DELETE FROM transactions WHERE id = ?",
        (transaction_id,)
    )

    connection.commit()

    deleted_rows = cursor.rowcount

    connection.close()

    if deleted_rows == 0:
        return jsonify({
            "error": "Transaction not found"
        }), 404

    return jsonify({
        "message": "Transaction deleted successfully"
    }), 200


# ----------------------------------
# 8. Update an existing transaction
# ----------------------------------

@app.route("/api/transactions/<int:transaction_id>", methods=["PUT"])
def update_transaction(transaction_id):

    data = request.get_json(silent=True) or {}

    title = str(data.get("title", "")).strip()
    category = str(data.get("category", "")).strip()
    transaction_type = data.get("type")
    transaction_date = data.get("date")

    try:
        amount = float(data.get("amount", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount"}), 400

    if not title or not category:
        return jsonify({"error": "Title and category are required"}), 400

    if transaction_type not in ["income", "expense"]:
        return jsonify({"error": "Invalid transaction type"}), 400

    if not math.isfinite(amount) or amount <= 0:
        return jsonify({"error": "Amount must be greater than zero"}), 400

    try:
        date.fromisoformat(transaction_date)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid date"}), 400

    connection = get_db_connection()

    cursor = connection.execute("""
        UPDATE transactions
        SET title = ?, category = ?, type = ?, amount = ?, date = ?
        WHERE id = ?
    """, (
        title,
        category,
        transaction_type,
        amount,
        transaction_date,
        transaction_id
    ))

    connection.commit()

    updated_rows = cursor.rowcount

    connection.close()

    if updated_rows == 0:
        return jsonify({"error": "Transaction not found"}), 404

    return jsonify({
        "message": "Transaction updated successfully"
    }), 200


# ----------------------------------
# 9. Monthly Financial Report
# ----------------------------------

@app.route("/api/reports/monthly", methods=["GET"])
def monthly_report():

    year = request.args.get("year")
    month = request.args.get("month")

    # Validate year and month
    try:
        year = int(year)
        month = int(month)

        if year < 2000 or year > 2100:
            raise ValueError("Invalid year")

        if month < 1 or month > 12:
            raise ValueError("Invalid month")

    except (ValueError, TypeError):
        return jsonify({
            "error": "Please provide a valid year and month"
        }), 400

    connection = get_db_connection()

    # Calculate income and expenses
    summary = connection.execute("""
        SELECT

            COALESCE(SUM(
                CASE WHEN type = 'income'
                THEN amount ELSE 0 END
            ), 0) AS income,

            COALESCE(SUM(
                CASE WHEN type = 'expense'
                THEN amount ELSE 0 END
            ), 0) AS expenses

        FROM transactions

        WHERE strftime('%Y', date) = ?
        AND strftime('%m', date) = ?

    """, (str(year), f"{month:02d}")).fetchone()

    # Calculate category-wise expenses
    categories = connection.execute("""
        SELECT
            category,
            SUM(amount) AS total

        FROM transactions

        WHERE type = 'expense'
        AND strftime('%Y', date) = ?
        AND strftime('%m', date) = ?

        GROUP BY category

        ORDER BY total DESC

    """, (str(year), f"{month:02d}")).fetchall()

    connection.close()

    income = summary["income"]
    expenses = summary["expenses"]

    savings = income - expenses

    savings_rate = (
        (savings / income) * 100
        if income > 0 else 0
    )

    return jsonify({

        "year": year,
        "month": month,

        "income": income,
        "expenses": expenses,
        "savings": savings,

        "savings_rate": round(savings_rate, 2),

        "categories": [
            dict(category)
            for category in categories
        ]

    }), 200


# ----------------------------------
# 7. Start application
# ----------------------------------

if __name__ == "__main__":

    initialize_database()

    app.run(debug=True)

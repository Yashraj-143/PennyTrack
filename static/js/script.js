
// ======================================
// PENNYTRACK - FRONTEND APPLICATION
// ======================================


// 1. Application variables

let transactions = [];
let expenseChart = null;


// 2. Get HTML elements

const modal = document.getElementById("transactionModal");
const openButton = document.getElementById("openModal");
const closeButton = document.getElementById("closeModal");
const form = document.getElementById("transactionForm");


// 3. Open and close transaction modal


function resetTransactionForm() {

    form.reset();

    delete modal.dataset.editId;

    document.querySelector(".modal-header h2").textContent =
        "Add Transaction";

    document.querySelector(".save-button").textContent =
        "Save Transaction";
}

openButton.addEventListener("click", function () {

    resetTransactionForm();

    modal.classList.add("show");
});

closeButton.addEventListener("click", function () {

    modal.classList.remove("show");

    resetTransactionForm();
});

modal.addEventListener("click", function (event) {

    if (event.target === modal) {

        modal.classList.remove("show");

        resetTransactionForm();
    }
});



// 4. Fetch transactions from Python API

async function loadTransactions() {

    try {

        const response = await fetch("/api/transactions");

        if (!response.ok) {
            throw new Error("Could not load transactions");
        }

        transactions = await response.json();

        updateDashboard();

        await loadMonthlyReport();      

        console.log("Transactions loaded from SQLite:", transactions);

    } catch (error) {

        console.error("Loading error:", error);

        alert("Unable to load transactions. Check your Flask server.");

    }
}


// 5. Update financial summary

function updateDashboard() {

    let totalIncome = 0;
    let totalExpenses = 0;

    transactions.forEach(function (transaction) {

        const amount = Number(transaction.amount);

        if (transaction.type === "income") {
            totalIncome += amount;
        } else {
            totalExpenses += amount;
        }

    });

    const balance = totalIncome - totalExpenses;

    document.getElementById("balance").textContent =
        "₹" + balance.toLocaleString("en-IN");

    document.getElementById("income").textContent =
        "₹" + totalIncome.toLocaleString("en-IN");

    document.getElementById("expenses").textContent =
        "₹" + totalExpenses.toLocaleString("en-IN");

    renderTransactions();

    updateExpenseChart();
}


// 6. Display transactions in HTML table


function renderTransactions() {

    const transactionList =
        document.getElementById("transactionList");

    const emptyMessage =
        document.getElementById("emptyMessage");

    const searchInput =
        document.getElementById("searchInput");

    const typeFilter =
        document.getElementById("typeFilter");

    const categoryFilter =
        document.getElementById("categoryFilter");

    // Get filter values
    const searchText = searchInput.value
        .trim()
        .toLowerCase();

    const selectedType = typeFilter.value;

    const selectedCategory = categoryFilter.value;

    // Filter transactions
    const filteredTransactions = transactions.filter(
        function (transaction) {

            const matchesSearch =
                transaction.title.toLowerCase().includes(searchText);

            const matchesType =
                selectedType === "all" ||
                transaction.type === selectedType;

            const matchesCategory =
                selectedCategory === "all" ||
                transaction.category === selectedCategory;

            return matchesSearch &&
                matchesType &&
                matchesCategory;
        }
    );

    transactionList.innerHTML = "";

    // Show empty message when no results exist
    emptyMessage.hidden = filteredTransactions.length > 0;

    filteredTransactions.forEach(function (transaction) {

        const row = document.createElement("tr");

        const titleCell = document.createElement("td");
        titleCell.textContent = transaction.title;

        const categoryCell = document.createElement("td");
        categoryCell.textContent = transaction.category;

        const dateCell = document.createElement("td");

        const date = new Date(transaction.date + "T00:00:00");

        dateCell.textContent = date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });

        const amountCell = document.createElement("td");

        const isIncome = transaction.type === "income";

        amountCell.className = isIncome ? "positive" : "negative";

        amountCell.textContent =
            (isIncome ? "+ ₹" : "- ₹") +
            Number(transaction.amount).toLocaleString("en-IN");

        // Edit and Delete buttons
        const actionsCell = document.createElement("td");

        const editButton = document.createElement("button");

        editButton.textContent = "Edit";
        editButton.className = "edit-button";

        editButton.addEventListener("click", function () {
            editTransaction(transaction);
        });

        const deleteButton = document.createElement("button");

        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-button";

        deleteButton.addEventListener("click", function () {
            deleteTransaction(transaction.id);
        });

        actionsCell.append(editButton, deleteButton);

        row.append(
            titleCell,
            categoryCell,
            dateCell,
            amountCell,
            actionsCell
        );

        transactionList.appendChild(row);

    });

}



// ----------------------------------
// Delete transaction from SQLite
// ----------------------------------

async function deleteTransaction(transactionId) {

    const confirmed = confirm(
        "Are you sure you want to delete this transaction?"
    );

    if (!confirmed) {
        return;
    }

    try {

        const response = await fetch(
            `/api/transactions/${transactionId}`,
            {
                method: "DELETE"
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Deletion failed");
        }

        // Reload updated database records
        await loadTransactions();

        alert("Transaction deleted successfully!");

    } catch (error) {

        console.error("Delete error:", error);

        alert(error.message);

    }
}


// ----------------------------------
// Edit transaction
// ----------------------------------

function editTransaction(transaction) {

    // Fill the form with existing details
    document.getElementById("title").value =
        transaction.title;

    document.getElementById("type").value =
        transaction.type;

    document.getElementById("category").value =
        transaction.category;

    document.getElementById("amount").value =
        transaction.amount;

    document.getElementById("date").value =
        transaction.date;

    // Store the transaction ID being edited
    document.getElementById("transactionModal").dataset.editId =
        transaction.id;

    // Change modal heading
    document.querySelector(".modal-header h2").textContent =
        "Edit Transaction";

    // Change save button text
    document.querySelector(".save-button").textContent =
        "Update Transaction";

    // Open modal
    modal.classList.add("show");
}



// 7. Update monthly spending chart

function updateExpenseChart() {

    if (!expenseChart) {
        return;
    }

    // Create 12 months of empty data
    const monthlyIncome = Array(12).fill(0);
    const monthlyExpenses = Array(12).fill(0);

    const currentYear = new Date().getFullYear();

    // Process each transaction
    transactions.forEach(function (transaction) {

        const [year, month] = transaction.date
            .split("-")
            .map(Number);

        // Only show transactions from current year
        if (year !== currentYear) {
            return;
        }

        const monthIndex = month - 1;
        const amount = Number(transaction.amount);

        if (transaction.type === "income") {

            monthlyIncome[monthIndex] += amount;

        } else if (transaction.type === "expense") {

            monthlyExpenses[monthIndex] += amount;

        }

    });

    // Update income dataset
    expenseChart.data.datasets[0].data = monthlyIncome;

    // Update expense dataset
    expenseChart.data.datasets[1].data = monthlyExpenses;

    // Redraw chart
    expenseChart.update();
}


// ----------------------------------
// Monthly Financial Report
// ----------------------------------

async function loadMonthlyReport() {

    const monthInput = document.getElementById("reportMonth");

    const selectedMonth = monthInput.value;

    if (!selectedMonth) {
        return;
    }

    const [year, month] = selectedMonth.split("-");

    try {

        const response = await fetch(
            `/api/reports/monthly?year=${year}&month=${month}`
        );

        const report = await response.json();

        if (!response.ok) {
            throw new Error(report.error || "Unable to load report");
        }

        // Format currency
        function formatCurrency(amount) {

            return "₹" + Number(amount).toLocaleString("en-IN", {
                maximumFractionDigits: 2
            });

        }

        // Update summary cards
        document.getElementById("reportIncome").textContent =
            formatCurrency(report.income);

        document.getElementById("reportExpenses").textContent =
            formatCurrency(report.expenses);

        document.getElementById("reportSavings").textContent =
            formatCurrency(report.savings);

        document.getElementById("reportSavingsRate").textContent =
            report.savings_rate + "%";

        // Update category breakdown
        const categoryList =
            document.getElementById("categoryReportList");

        const emptyMessage =
            document.getElementById("reportEmptyMessage");

        categoryList.innerHTML = "";

        emptyMessage.hidden = report.categories.length > 0;

        report.categories.forEach(function (item) {

            const row = document.createElement("tr");

            const categoryCell = document.createElement("td");

            categoryCell.textContent = item.category;

            const amountCell = document.createElement("td");

            amountCell.textContent = formatCurrency(item.total);

            row.append(categoryCell, amountCell);

            categoryList.appendChild(row);

        });

        console.log("Monthly report loaded:", report);

    } catch (error) {

        console.error("Monthly report error:", error);

        alert(error.message);

    }

}


// 8. Send new transaction to Python backend

form.addEventListener("submit", async function (event) {

    event.preventDefault();

    const title = document.getElementById("title").value.trim();

    const type = document.getElementById("type").value;

    const category = document.getElementById("category").value;

    const amount = Number(document.getElementById("amount").value);

    const date = document.getElementById("date").value;


    if (!title || !date || !Number.isFinite(amount) || amount <= 0) {

        alert("Please enter valid transaction details.");

        return;
    }


    const newTransaction = {
        title: title,
        type: type,
        category: category,
        amount: amount,
        date: date
    };


    try {


        const editId = modal.dataset.editId;

        const url = editId
            ? `/api/transactions/${editId}`
            : "/api/transactions";

        const method = editId ? "PUT" : "POST";

        const response = await fetch(url, {

            method: method,

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(newTransaction)

        });



        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Unable to save transaction");
        }


        // Reload saved records from SQLite
        await loadTransactions();

        form.reset();

        modal.classList.remove("show");

        delete modal.dataset.editId;

        document.querySelector(".modal-header h2").textContent =
            "Add Transaction";

        document.querySelector(".save-button").textContent =
            "Save Transaction";

        alert(editId
            ? "Transaction updated successfully!"
            : "Transaction saved successfully!"
        );

        console.log("Saved transaction:", result);


    } catch (error) {

        console.error("Saving error:", error);

        alert(error.message);

    }

});



// ----------------------------------
// 9. Initialize Income vs Expenses Chart
// ----------------------------------

const chartCanvas = document.getElementById("expenseChart");

if (chartCanvas && typeof Chart !== "undefined") {

    expenseChart = new Chart(chartCanvas, {

        type: "bar",

        data: {

            labels: [
                "Jan", "Feb", "Mar", "Apr",
                "May", "Jun", "Jul", "Aug",
                "Sep", "Oct", "Nov", "Dec"
            ],

            datasets: [

                {
                    label: "Income (₹)",
                    data: Array(12).fill(0),
                    backgroundColor: "#39775A",
                    borderRadius: 6,
                    maxBarThickness: 28
                },

                {
                    label: "Expenses (₹)",
                    data: Array(12).fill(0),
                    backgroundColor: "#E59A62",
                    borderRadius: 6,
                    maxBarThickness: 28
                }

            ]

        },

        options: {

            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: true,
                    position: "top"
                },

                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ": ₹" +
                                context.parsed.y.toLocaleString("en-IN");
                        }
                    }
                }
            },

            scales: {
                y: {
                    beginAtZero: true,

                    ticks: {
                        callback: function (value) {
                            return "₹" + value.toLocaleString("en-IN");
                        }
                    }
                }
            }

        }

    });

}

// Search and filter event listeners

document.getElementById("searchInput").addEventListener(
    "input",
    renderTransactions
);

document.getElementById("typeFilter").addEventListener(
    "change",
    renderTransactions
);

document.getElementById("categoryFilter").addEventListener(
    "change",
    renderTransactions
);

// Initialize month selector with current month

const reportMonth = document.getElementById("reportMonth");

const now = new Date();

const currentMonth =
    now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0");

reportMonth.value = currentMonth;

// Reload report when month changes
reportMonth.addEventListener("change", loadMonthlyReport);

// Load initial monthly report
loadMonthlyReport();

// 10. Load database data when page opens

loadTransactions();

console.log("PennyTrack application initialized!");

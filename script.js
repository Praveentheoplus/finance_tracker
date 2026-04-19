document.addEventListener('DOMContentLoaded', () => {
    const transactionForm = document.getElementById('transaction-form');
    const transactionList = document.getElementById('transaction-list');
    const totalBalance = document.getElementById('total-balance');
    const totalIncome = document.getElementById('total-income');
    const totalExpenses = document.getElementById('total-expenses');
    const logoutBtn = document.getElementById('logout-btn');
    const reportBtn = document.getElementById('report-btn');

    let transactions = [];

    // Check authentication on page load
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    // Add auth header to fetch requests
    const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    async function loadTransactions() {
        try {
            const response = await fetch('/api/transactions', {
                headers: authHeaders
            });
            transactions = await response.json();
            renderTransactions();
            updateBalance();
        } catch (error) {
            console.error('Error loading transactions:', error);
            if (error.message.includes('401') || error.message.includes('403')) {
                handleLogout();
            }
        }
    }

    function updateBalance() {
        const income = transactions
            .filter(t => t.type === 'income')
            .reduce((acc, t) => acc + t.amount, 0);
        const expenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => acc + t.amount, 0);
        const balance = income - expenses;

        totalBalance.textContent = balance.toFixed(2);
        totalIncome.textContent = income.toFixed(2);
        totalExpenses.textContent = expenses.toFixed(2);
    }

    async function addTransaction(description, amount, type) {
        try {
            const response = await fetch('/api/transactions', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ description, amount, type })
            });
            if (response.ok) {
                const newTransaction = await response.json();
                transactions.push(newTransaction);
                renderTransactions();
                updateBalance();
            } else if (response.status === 401 || response.status === 403) {
                handleLogout();
            } else {
                console.error('Error adding transaction');
            }
        } catch (error) {
            console.error('Error adding transaction:', error);
            if (error.message.includes('401') || error.message.includes('403')) {
                handleLogout();
            }
        }
    }

    async function deleteTransaction(id) {
        try {
            const response = await fetch(`/api/transactions/${id}`, {
                method: 'DELETE',
                headers: authHeaders
            });
            if (response.ok) {
                transactions = transactions.filter(transaction => transaction.id !== id);
                renderTransactions();
                updateBalance();
            } else if (response.status === 401 || response.status === 403) {
                handleLogout();
            } else {
                console.error('Error deleting transaction');
            }
        } catch (error) {
            console.error('Error deleting transaction:', error);
            if (error.message.includes('401') || error.message.includes('403')) {
                handleLogout();
            }
        }
    }

    async function generateReport() {
        try {
            reportBtn.disabled = true;
            reportBtn.textContent = '📄 Generating...';

            const response = await fetch('/api/reports/generate-pdf', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ transactions })
            });

            if (response.ok) {
                // Create a blob from the response
                const blob = await response.blob();
                
                // Create a temporary URL for the blob
                const url = window.URL.createObjectURL(blob);
                
                // Create a link element and trigger download
                const link = document.createElement('a');
                link.href = url;
                link.download = `finance-report-${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            } else if (response.status === 401 || response.status === 403) {
                handleLogout();
            } else {
                alert('Error generating report');
            }
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Failed to generate report');
        } finally {
            reportBtn.disabled = false;
            reportBtn.textContent = '📄 Generate Report';
        }
    }

    function renderTransactions() {
        transactionList.innerHTML = '';
        transactions.forEach(transaction => {
            const div = document.createElement('div');
            div.className = `transaction-item ${transaction.type}`;
            div.innerHTML = `
                <div class="transaction-details">
                    <div class="transaction-description">${transaction.description}</div>
                    <div class="transaction-amount ${transaction.type}">$${transaction.amount.toFixed(2)}</div>
                </div>
                <button class="delete-btn" onclick="deleteTransaction(${transaction.id})">Delete</button>
            `;
            transactionList.appendChild(div);
        });
    }

    function handleLogout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }

    transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = document.getElementById('description').value;
        const amount = document.getElementById('amount').value;
        const type = document.getElementById('type').value;
        await addTransaction(description, amount, type);
        transactionForm.reset();
    });

    reportBtn.addEventListener('click', generateReport);

    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: authHeaders
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
        handleLogout();
    });

    // Make deleteTransaction global for onclick
    window.deleteTransaction = deleteTransaction;

    loadTransactions();
});
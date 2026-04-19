const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key-change-in-production';
const DATA_FILE = path.join(__dirname, 'transactions.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());

// In-memory user storage (in production, use a database)
let users = [];
let sessions = new Map();

// Load users from file
function loadUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        users = JSON.parse(data);
    } catch (error) {
        users = [];
    }
}

// Save users to file
function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Helper function to read transactions from file
function readTransactions(userId) {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const allTransactions = JSON.parse(data);
        return allTransactions.filter(t => t.userId === userId);
    } catch (error) {
        return [];
    }
}

// Helper function to write transactions to file
function writeTransactions(transactions, userId) {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        let allTransactions = JSON.parse(data);

        // Remove existing transactions for this user
        allTransactions = allTransactions.filter(t => t.userId !== userId);

        // Add updated transactions
        allTransactions = allTransactions.concat(transactions.map(t => ({ ...t, userId })));

        fs.writeFileSync(DATA_FILE, JSON.stringify(allTransactions, null, 2));
    } catch (error) {
        // If file doesn't exist, create it
        fs.writeFileSync(DATA_FILE, JSON.stringify(transactions.map(t => ({ ...t, userId })), null, 2));
    }
}

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if user already exists
        const existingUser = users.find(u => u.username === username || u.email === email);
        if (existingUser) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = {
            id: Date.now(),
            username,
            email,
            password: hashedPassword,
            createdAt: new Date().toISOString()
        };

        users.push(user);
        saveUsers();

        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        // Find user
        const user = users.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
    // In a real app, you might want to blacklist the token
    res.json({ message: 'Logged out successfully' });
});

// Protected Transaction Routes
app.get('/api/transactions', authenticateToken, (req, res) => {
    const transactions = readTransactions(req.user.id);
    res.json(transactions);
});

app.post('/api/transactions', authenticateToken, (req, res) => {
    const { description, amount, type } = req.body;
    if (!description || !amount || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const transactions = readTransactions(req.user.id);
    const newTransaction = {
        id: Date.now(),
        description,
        amount: parseFloat(amount),
        type
    };
    transactions.push(newTransaction);
    writeTransactions(transactions, req.user.id);
    res.status(201).json(newTransaction);
});

app.delete('/api/transactions/:id', authenticateToken, (req, res) => {
    const id = parseInt(req.params.id);
    let transactions = readTransactions(req.user.id);
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Transaction not found' });
    }
    transactions.splice(index, 1);
    writeTransactions(transactions, req.user.id);
    res.status(204).send();
});

// Serve static files (frontend)
app.use(express.static('.'));

// Route to serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Protect main app route
app.get('/', (req, res) => {
    // Check for auth token in query or header
    const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);

    if (!token) {
        return res.redirect('/login');
    }

    try {
        jwt.verify(token, JWT_SECRET);
        res.sendFile(path.join(__dirname, 'index.html'));
    } catch (error) {
        res.redirect('/login');
    }
});

// PDF Report Generation
app.post('/api/reports/generate-pdf', authenticateToken, (req, res) => {
    try {
        const { transactions } = req.body;

        // Create a PDF document
        const doc = new PDFDocument();

        // Set response headers for file download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="finance-report-${new Date().toISOString().split('T')[0]}.pdf"`);

        // Pipe the PDF to the response
        doc.pipe(res);

        // Title
        doc.fontSize(24).font('Helvetica-Bold').text('Finance Tracker Report', { align: 'center' });
        doc.moveDown(0.5);

        // Date
        doc.fontSize(11).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(1);

        // Summary Section
        const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const expenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        const balance = income - expenses;

        doc.fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true });
        doc.moveDown(0.3);

        doc.fontSize(12).font('Helvetica');
        doc.text(`Total Income: $${income.toFixed(2)}`, { color: '#38a169' });
        doc.text(`Total Expenses: $${expenses.toFixed(2)}`, { color: '#e53e3e' });
        doc.text(`Total Balance: $${balance.toFixed(2)}`, { color: '#2b6cb0', font: 'Helvetica-Bold' });
        doc.moveDown(1);

        // Transactions Section
        doc.fontSize(14).font('Helvetica-Bold').text('Transaction Details', { underline: true });
        doc.moveDown(0.3);

        if (transactions.length === 0) {
            doc.fontSize(11).font('Helvetica').text('No transactions recorded', { color: '#718096' });
        } else {
            // Table headers
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Date', 50, doc.y, { width: 80 });
            doc.text('Description', 140, doc.y, { width: 200 });
            doc.text('Type', 350, doc.y, { width: 60 });
            doc.text('Amount', 420, doc.y, { width: 80, align: 'right' });
            doc.moveDown(0.5);

            // Separator line
            doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
            doc.moveDown(0.3);

            // Table rows
            doc.fontSize(9).font('Helvetica');
            transactions.forEach(transaction => {
                const date = new Date(transaction.id).toLocaleDateString();
                const color = transaction.type === 'income' ? '#38a169' : '#e53e3e';
                const sign = transaction.type === 'income' ? '+' : '-';

                doc.text(date, 50, doc.y, { width: 80 });
                doc.text(transaction.description, 140, doc.y, { width: 200 });
                doc.text(transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1), 350, doc.y, { width: 60 });
                doc.fillColor(color).text(`${sign}$${transaction.amount.toFixed(2)}`, 420, doc.y, { width: 80, align: 'right' });
                doc.fillColor('#1a202c');
                doc.moveDown(0.4);
            });
        }

        doc.moveDown(1);

        // Footer
        doc.fontSize(10).font('Helvetica').fillColor('#718096');
        doc.text('This report was automatically generated by Finance Tracker', { align: 'center' });

        // End the document
        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ message: 'Error generating report' });
    }
});

// Load users on startup
loadUsers();

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
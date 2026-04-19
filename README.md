# Finance Tracker

A simple web application to track your income and expenses with user authentication.

## Features

- User registration and login
- Add income and expense transactions
- View transaction history
- Calculate total balance
- Data persists per user on the server

## How to Run

### Backend Setup
1. Ensure Node.js is installed (version 14 or higher).
2. Run `npm install` to install dependencies.
3. Run `npm start` to start the server on `http://localhost:3000`.

### Using the Application
1. Open `http://localhost:3000` in your web browser.
2. If not logged in, you'll be redirected to the login page.
3. Create a new account or log in with existing credentials.
4. Add transactions, view your balance, and manage your finances.
5. Use the logout button to sign out.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify authentication token
- `POST /api/auth/logout` - Logout user

### Transactions (Protected)
- `GET /api/transactions` - Get all transactions for authenticated user
- `POST /api/transactions` - Add new transaction
- `DELETE /api/transactions/:id` - Delete transaction by ID

## Technologies Used

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Authentication: JWT tokens
- Data Storage: JSON files (user-specific)

## Security Notes

- Passwords are hashed using bcrypt
- JWT tokens expire after 24 hours
- User data is isolated per account
- In production, use environment variables for secrets and a proper database
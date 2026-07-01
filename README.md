# The Verandah — Hotel Management System

A hotel guest-dining system: customers register and log in (validated against
MySQL on every attempt), browse a digital menu, view full details of a
specific meal, and place orders that are stored in the database.

Because a browser cannot talk to MySQL directly, this project uses a small
**Node.js/Express** backend in between. The frontend is still plain
**HTML, CSS, and JavaScript** — no frontend framework, no build step.

## Stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript (`/public`)
- **Backend:** Node.js + Express (`/server`)
- **Database:** MySQL (`/database/schema.sql`)
- **Auth:** bcrypt password hashing, server-side sessions, login-attempt logging, account lockout after repeated failures

## Project structure

```
hotel-management-system/
├── database/
│   └── schema.sql          # Run this first — creates DB, tables, sample menu
├── server/
│   ├── server.js           # Express app entry point
│   ├── db.js                # MySQL connection pool
│   ├── authRoutes.js        # /api/auth/register, /login, /logout, /session
│   ├── menuRoutes.js        # /api/menu, /api/menu/item/:id
│   ├── orderRoutes.js       # /api/orders (place order, view history)
│   ├── authMiddleware.js    # requireAuth guard for protected routes
│   └── validators.js        # Registration/login validation rules
├── public/
│   ├── index.html
│   ├── css/styles.css
│   └── js/ (api.js, auth.js, menu.js, app.js)
├── package.json
└── .env.example
```

## 1. Set up MySQL

Make sure MySQL is installed and running, then create the database and tables:

```bash
mysql -u root -p < database/schema.sql
```

This creates the `hotel_management` database with:
- `customers` — registered guest accounts (passwords stored as bcrypt hashes only)
- `login_attempts` — a record of every login attempt, success or failure
- `menu_categories` / `menu_items` — the digital menu (pre-loaded with sample dishes)
- `orders` / `order_items` — placed orders and their line items

## 2. Configure the backend

```bash
cd hotel-management-system
cp .env.example .env
```

Edit `.env` with your real MySQL credentials:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=hotel_management
SESSION_SECRET=replace_this_with_a_long_random_string
PORT=3000
```

## 3. Install dependencies and run

```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

For auto-restart during development: `npm run dev` (uses nodemon).

## How it satisfies each requirement

| Requirement | Where it's implemented |
|---|---|
| Capture customer details, store in DB | `POST /api/auth/register` → `customers` table |
| Validate every login attempt | `POST /api/auth/login` checks credentials against MySQL on every call, and every attempt (pass/fail) is written to `login_attempts` |
| Logged-in customers view digital menu | `GET /api/menu` (protected by `requireAuth`); menu screen in the UI |
| View a specific meal | `GET /api/menu/item/:id`; clicking a dish opens a detail modal |
| Orders stored in DB | `POST /api/orders` writes to `orders` + `order_items` inside a transaction |

## Security notes

- Passwords are hashed with **bcrypt** (12 salt rounds) — plain text is never stored or logged.
- All SQL uses **parameterized queries** (via `mysql2`), so user input can't be used for SQL injection.
- Accounts **lock for 15 minutes** after 5 consecutive failed login attempts.
- Login requests are **rate-limited** at the network layer too.
- Sessions are server-side (`express-session`) with an `httpOnly` cookie — the session ID, not credentials, is what the browser holds.
- Order prices are always recalculated **server-side** from the current menu price; the client's submitted price (if any) is never trusted.

## Extending it

- Add an admin role/screen to manage `menu_items` (add/edit/disable dishes).
- Add email verification on registration.
- Add a `password_reset_tokens` table for "forgot password" flows.
- Swap `express-session`'s default memory store for a persistent store (e.g. `connect-mysql-session`) if you need sessions to survive server restarts in production.

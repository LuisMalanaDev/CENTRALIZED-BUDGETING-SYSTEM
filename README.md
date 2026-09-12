# WealthSync — Centralized Personal Finance & Lifestyle Expense Management

> A modern, Apple/Linear-inspired minimalist monochrome financial command center designed for personal and lifestyle expense management.

---

## Features

- **Apple/Linear Monochrome Aesthetic**: Clean, high-contrast, minimalist design with zero visual clutter.
- **Dynamic Cashflow & Money Left**: Real-time tracking of current cash across physical wallets, digital wallets (e.g. GCash, Maya), and bank accounts.
- **Automated Expense Deductions**: Every logged expense automatically deducts from your remaining money and account balances.
- **Interactive Clickable 31-Day Calendar Filter**:
  - Filter metrics, transactions, and analytics by exact day, whole month, whole year, or all-time.
  - Interactive calendar popover with days of the week, quick steppers, and 1-click shortcuts.
- **Parcel & Lifestyle Tracker**:
  - Track orders, delivery statuses, groceries, and essential purchases.
- **Dynamic Budget Caps & Vaults**:
  - Category-based budget limits with real-time percentage indicators and savings goals.
- **Mobile-Ready Progressive Web App (PWA)**:
  - 1-tap install on Android and iOS (home screen icon, standalone fullscreen mode, zero browser URL bars).
  - Dynamic local network routing so phones on Wi-Fi connect seamlessly to the local backend.
- **Android APK Ready**:
  - Built-in PWA manifest, high-res icons, and GitHub Actions workflow (`build-apk.yml`) for automated APK generation.

---

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide React
- **Backend**: Fastify v5, TypeScript, JWT authentication, cookie management, CORS
- **Database & ORM**: PostgreSQL / SQLite with Prisma ORM
- **Package Manager**: `pnpm` workspace

---

## Project Structure

```text
CENTRALIZED-BUDGETING-SYSTEM/
├── backend/                  # Fastify REST API
│   ├── prisma/               # Prisma schema & seed scripts
│   ├── src/                  # Routes, controllers, and services
│   └── package.json
├── frontend/                 # Next.js 15 Web & Mobile PWA
│   ├── public/               # Static assets & app icons (192x192, 512x512, SVG)
│   ├── src/
│   │   ├── app/              # Next.js App Router (Dashboard, Ledger, Tracker, Analytics)
│   │   ├── components/       # UI components & interactive calendar
│   │   └── lib/              # Dynamic API client
│   └── package.json
├── .github/workflows/        # Cloud APK build workflows
├── pnpm-workspace.yaml       # Monorepo configuration
└── package.json
```

---

## Getting Started

### Prerequisites
- Node.js v18+ (Node v20+ recommended)
- `pnpm` (`npm install -g pnpm`)

### 1. Installation
```bash
pnpm install
```

### 2. Environment Setup
Create `.env` in `backend/`:
```env
PORT=4000
HOST=0.0.0.0
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wealthsync?schema=public"
JWT_SECRET="your_jwt_secret_key"
COOKIE_SECRET="your_cookie_secret_salt_min_32_characters"
FRONTEND_URL="http://localhost:3000"
```

Create `.env.local` in `frontend/`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_NAME=WealthSync
```

### 3. Database Migration & Seed
```bash
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate
```

### 4. Running the Application
Run both backend and frontend:
```bash
# Backend (http://localhost:4000)
pnpm --filter backend dev

# Frontend (http://localhost:3000)
pnpm --filter frontend dev
```

---

## Mobile Installation (PWA)

1. Connect your phone to the same Wi-Fi network as your PC.
2. Open `http://<YOUR_PC_IP>:3000` in Google Chrome (Android) or Safari (iOS).
3. Tap **Menu (⋮)** → **"Install app"** or **"Add to Home Screen"**.
4. Launch WealthSync full-screen with native app behavior!

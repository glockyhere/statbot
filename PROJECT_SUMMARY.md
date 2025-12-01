# Telegram CRM Bot - Project Summary

## Overview
Telegram bot for Auto Center Service that automates customer registration into Bestune CRM system.

## Core Features
- ✅ Telegram bot interface with registration flow
- ✅ Multi-user queue system for concurrent registrations
- ✅ Vehicle info extraction after VIN selection
- ✅ Automatic CRM form filling with Puppeteer
- ✅ SQL database (SQLite) for all registrations
- ✅ Branch-specific specialist assignment
- ✅ Complete field validation

## Main Files

### Core Bot Files
- **telegram-bot-v2.js** - Main Telegram bot with registration flow & queue system
- **bot.js** - CRM automation using Puppeteer (login, form filling, VIN search)
- **sql-database.js** - SQLite database for storing all registration data

### Configuration
- **specialists.js** - Service specialist definitions
- **users.js** - Authorized Telegram users with branch assignments

### Utilities
- **view-database.js** - View database stats and export to CSV

### Documentation
- **README.md** - Main project documentation
- **DATABASE_README.md** - SQL database documentation

## Database
- **registrations.db** - SQLite database with all registration data
- Includes: VIN, vehicle info, customer details, timestamps, branch info
- Indexes for fast queries (VIN, branch, date, phone)

## How to Run

```bash
# Start the bot
node telegram-bot-v2.js

# View database stats
node view-database.js
```

## Registration Flow
1. User sends VIN query (last 4-5 digits)
2. Bot searches CRM and shows matching VINs
3. User selects VIN → Bot extracts vehicle info (Mashina, Rangi, Ombor, Garantiya, Qarzdorlik)
4. Bot shows vehicle details to user
5. User enters: license plate, region, name, mileage, reason, phone
6. Bot submits to CRM (adds reason first, then service transfer)
7. Data saved to SQL database

## Branch Mapping
- 2bekat → "2 Bekat Service"
- 5bekat → "Jetour Service"
- texnopark → "Roxat Service"

## Technology Stack
- Node.js
- node-telegram-bot-api (Telegram Bot API)
- Puppeteer (Browser automation)
- better-sqlite3 (SQL database)
- dotenv (Environment variables)

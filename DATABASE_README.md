# SQL Database Documentation

## Overview
All registration data is automatically saved to an SQLite database (`registrations.db`) for easy querying, reporting, and analysis.

## Database Schema

### Table: `registrations`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `created_at` | DATETIME | Registration timestamp |
| `updated_at` | DATETIME | Last update timestamp |
| **User Info** |
| `telegram_user_id` | INTEGER | Telegram chat ID |
| `telegram_username` | TEXT | Telegram username |
| `branch_id` | TEXT | Branch ID (2bekat, 5bekat, texnopark) |
| `branch_name` | TEXT | Branch display name |
| `user_branch` | TEXT | User's assigned branch |
| **Vehicle Info** |
| `vin` | TEXT | Vehicle VIN number (required) |
| `mashina` | TEXT | Vehicle model |
| `rangi` | TEXT | Vehicle color |
| `ombor` | TEXT | Warehouse/storage location |
| `garantiya` | TEXT | Warranty status |
| `qarzdorlik` | TEXT | Debt status |
| **Registration Data** |
| `plate_number` | TEXT | License plate number |
| `region_code` | TEXT | Region code |
| `region_name` | TEXT | Region name |
| `customer_name` | TEXT | Customer full name |
| `phone` | TEXT | Customer phone number |
| `mileage` | INTEGER | Vehicle odometer reading |
| `reason` | TEXT | Service reason |
| `service_type` | TEXT | Service type (M/X or K/A) |
| `service_specialist` | TEXT | Assigned service specialist |
| `arrival_datetime` | DATETIME | Arrival date and time |
| **Status** |
| `status` | TEXT | Registration status (default: 'completed') |
| `crm_submitted` | BOOLEAN | Whether submitted to CRM (default: true) |
| `notes` | TEXT | Additional notes |

## Indexes
- `idx_vin` - Fast VIN lookup
- `idx_branch` - Fast branch filtering
- `idx_created_at` - Fast date range queries
- `idx_telegram_user` - Fast user history lookup
- `idx_phone` - Fast customer lookup

## Usage Examples

### View Database Statistics
```bash
node view-database.js
```

This will show:
- Total registrations
- Statistics by time period (today, this week, this month)
- Registrations by branch
- Top vehicles
- Top customers
- Recent registrations
- Export to CSV

### Query from Node.js

```javascript
const sqlDatabase = require('./sql-database.js');

// Get all registrations
const all = sqlDatabase.getAllRegistrations(100, 0);

// Get by VIN
const byVin = sqlDatabase.getRegistrationsByVIN('LVPC52898RCB03045');

// Get by branch
const byBranch = sqlDatabase.getRegistrationsByBranch('2bekat');

// Get by phone
const byPhone = sqlDatabase.getRegistrationsByPhone('+998901234567');

// Get by date range
const byDate = sqlDatabase.getRegistrationsByDateRange(
  '2025-01-01',
  '2025-12-31'
);

// Search
const results = sqlDatabase.search('03045'); // Searches VIN, name, phone, plate

// Get statistics
const stats = sqlDatabase.getStats();

// Update registration
sqlDatabase.updateRegistration(1, {
  customer_name: 'New Name',
  notes: 'Customer called back'
});

// Export to CSV
sqlDatabase.exportToCSV('./export.csv');
```

### Direct SQL Queries

You can also use any SQLite client to query the database:

```bash
sqlite3 registrations.db
```

Example queries:
```sql
-- Get all registrations from today
SELECT * FROM registrations
WHERE DATE(created_at) = DATE('now');

-- Count by vehicle model
SELECT mashina, COUNT(*) as count
FROM registrations
GROUP BY mashina
ORDER BY count DESC;

-- Find repeat customers
SELECT phone, customer_name, COUNT(*) as visits
FROM registrations
GROUP BY phone
HAVING visits > 1
ORDER BY visits DESC;

-- Get all registrations for a specific branch
SELECT * FROM registrations
WHERE branch_id = '2bekat'
ORDER BY created_at DESC;

-- Average mileage by vehicle model
SELECT mashina, AVG(mileage) as avg_mileage
FROM registrations
WHERE mileage IS NOT NULL
GROUP BY mashina;
```

## API Methods

### `addRegistration(data)`
Add a new registration record. Returns the inserted record.

### `getRegistrationById(id)`
Get a single registration by ID.

### `getAllRegistrations(limit, offset)`
Get all registrations with pagination.

### `getRegistrationsByVIN(vin)`
Get all registrations for a specific VIN.

### `getRegistrationsByBranch(branchId)`
Get all registrations for a specific branch.

### `getRegistrationsByPhone(phone)`
Get all registrations for a customer phone number.

### `getRegistrationsByDateRange(startDate, endDate)`
Get registrations within a date range.

### `getRegistrationsByTelegramUser(telegramUserId)`
Get all registrations from a specific Telegram user.

### `getStats()`
Get comprehensive statistics about all registrations.

### `search(query)`
Search across VIN, customer name, phone, and plate number.

### `updateRegistration(id, updates)`
Update specific fields of a registration.

### `deleteRegistration(id)`
Delete a registration by ID.

### `exportToCSV(outputPath)`
Export all data to CSV file.

## Backup

To backup the database:
```bash
cp registrations.db registrations_backup_$(date +%Y%m%d).db
```

## Reports

The database makes it easy to generate reports:
- Daily/weekly/monthly registration counts
- Performance by branch
- Most common vehicles
- Repeat customers
- Service specialist workload
- Average mileage by vehicle type

## Integration

The database is automatically integrated into the Telegram bot. Every successful registration is saved with:
- All form data
- Vehicle information (from VIN lookup)
- Telegram user info
- Timestamp
- CRM submission status

## File Location
- Database file: `registrations.db`
- Database module: `sql-database.js`
- Viewer script: `view-database.js`
- Export location: `registrations_export.csv`

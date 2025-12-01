const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'registrations.db');

class SQLDatabase {
  constructor() {
    this.db = new Database(DB_PATH);
    this.initTables();
    console.log('✓ SQL Database initialized:', DB_PATH);
  }

  initTables() {
    // Create registrations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        -- User info
        telegram_user_id INTEGER,
        telegram_username TEXT,
        branch_id TEXT,
        branch_name TEXT,
        user_branch TEXT,

        -- Vehicle info (from VIN selection)
        vin TEXT NOT NULL,
        mashina TEXT,
        rangi TEXT,
        ombor TEXT,
        garantiya TEXT,
        qarzdorlik TEXT,

        -- Registration data
        plate_number TEXT,
        region_code TEXT,
        region_name TEXT,
        customer_name TEXT,
        phone TEXT,
        mileage INTEGER,
        reason TEXT,
        service_type TEXT,
        service_specialist TEXT,
        arrival_datetime DATETIME,

        -- Photos
        photo_vin TEXT,
        photo_45 TEXT,
        photo_probeg TEXT,

        -- Status tracking
        status TEXT DEFAULT 'completed',
        crm_submitted BOOLEAN DEFAULT 1,
        notes TEXT
      )
    `);

    // Create index for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_vin ON registrations(vin);
      CREATE INDEX IF NOT EXISTS idx_branch ON registrations(branch_id);
      CREATE INDEX IF NOT EXISTS idx_created_at ON registrations(created_at);
      CREATE INDEX IF NOT EXISTS idx_telegram_user ON registrations(telegram_user_id);
      CREATE INDEX IF NOT EXISTS idx_phone ON registrations(phone);
    `);

    console.log('✓ Database tables initialized');
  }

  addRegistration(data) {
    const stmt = this.db.prepare(`
      INSERT INTO registrations (
        telegram_user_id,
        telegram_username,
        branch_id,
        branch_name,
        user_branch,
        vin,
        mashina,
        rangi,
        ombor,
        garantiya,
        qarzdorlik,
        plate_number,
        region_code,
        region_name,
        customer_name,
        phone,
        mileage,
        reason,
        service_type,
        service_specialist,
        arrival_datetime,
        photo_vin,
        photo_45,
        photo_probeg,
        status,
        crm_submitted
      ) VALUES (
        @telegramUserId,
        @telegramUsername,
        @branchId,
        @branchName,
        @userBranch,
        @vin,
        @mashina,
        @rangi,
        @ombor,
        @garantiya,
        @qarzdorlik,
        @plateNumber,
        @regionCode,
        @regionName,
        @customerName,
        @phone,
        @mileage,
        @reason,
        @serviceType,
        @serviceSpecialist,
        @arrivalDateTime,
        @photoVin,
        @photo45,
        @photoProbeg,
        @status,
        @crmSubmitted
      )
    `);

    // Extract vehicle info if present
    const vehicleInfo = data.vehicleInfo || {};

    const params = {
      telegramUserId: data.telegramUserId || null,
      telegramUsername: data.telegramUsername || null,
      branchId: data.branchId || null,
      branchName: data.branchName || null,
      userBranch: data.userBranch || null,
      vin: data.vin,
      mashina: vehicleInfo.mashina || null,
      rangi: vehicleInfo.rangi || null,
      ombor: vehicleInfo.ombor || null,
      garantiya: vehicleInfo.garantiya || null,
      qarzdorlik: vehicleInfo.qarzdorlik || null,
      plateNumber: data.plateNumber || data.plate || null,
      regionCode: data.regionCode || null,
      regionName: data.regionName || null,
      customerName: data.customerName || data.name || null,
      phone: data.phone || null,
      mileage: data.mileage || data.odometer || null,
      reason: data.reason || null,
      serviceType: data.serviceType || null,
      serviceSpecialist: data.serviceSpecialist || data.specialist || null,
      arrivalDateTime: data.arrivalDateTime ? new Date(data.arrivalDateTime).toISOString() : new Date().toISOString(),
      photoVin: data.photoVin || null,
      photo45: data.photo45 || null,
      photoProbeg: data.photoProbeg || null,
      status: data.status || 'completed',
      crmSubmitted: data.crmSubmitted !== false ? 1 : 0
    };

    const result = stmt.run(params);
    const insertedId = result.lastInsertRowid;

    console.log(`✓ Saved registration #${insertedId} to SQL database`);

    return this.getRegistrationById(insertedId);
  }

  getRegistrationById(id) {
    const stmt = this.db.prepare('SELECT * FROM registrations WHERE id = ?');
    return stmt.get(id);
  }

  getAllRegistrations(limit = 100, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT * FROM registrations
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  }

  getRegistrationsByVIN(vin) {
    const stmt = this.db.prepare(`
      SELECT * FROM registrations
      WHERE vin = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(vin);
  }

  getRegistrationsByBranch(branchId) {
    const stmt = this.db.prepare(`
      SELECT * FROM registrations
      WHERE branch_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(branchId);
  }

  getRegistrationsByPhone(phone) {
    const stmt = this.db.prepare(`
      SELECT * FROM registrations
      WHERE phone = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(phone);
  }

  getRegistrationsByDateRange(startDate, endDate) {
    const stmt = this.db.prepare(`
      SELECT * FROM registrations
      WHERE created_at BETWEEN ? AND ?
      ORDER BY created_at DESC
    `);
    return stmt.all(startDate, endDate);
  }

  getRegistrationsByTelegramUser(telegramUserId) {
    const stmt = this.db.prepare(`
      SELECT * FROM registrations
      WHERE telegram_user_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(telegramUserId);
  }

  // Statistics queries
  getStats() {
    const stats = {};

    // Total registrations
    stats.total = this.db.prepare('SELECT COUNT(*) as count FROM registrations').get().count;

    // Registrations by branch
    stats.byBranch = this.db.prepare(`
      SELECT branch_id, branch_name, COUNT(*) as count
      FROM registrations
      GROUP BY branch_id
      ORDER BY count DESC
    `).all();

    // Registrations today
    stats.today = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM registrations
      WHERE DATE(created_at) = DATE('now')
    `).get().count;

    // Registrations this week
    stats.thisWeek = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM registrations
      WHERE created_at >= DATE('now', '-7 days')
    `).get().count;

    // Registrations this month
    stats.thisMonth = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM registrations
      WHERE created_at >= DATE('now', 'start of month')
    `).get().count;

    // Top customers (by phone)
    stats.topCustomers = this.db.prepare(`
      SELECT phone, customer_name, COUNT(*) as visit_count
      FROM registrations
      WHERE phone IS NOT NULL
      GROUP BY phone
      ORDER BY visit_count DESC
      LIMIT 10
    `).all();

    // Most common vehicles
    stats.topVehicles = this.db.prepare(`
      SELECT mashina, COUNT(*) as count
      FROM registrations
      WHERE mashina IS NOT NULL
      GROUP BY mashina
      ORDER BY count DESC
      LIMIT 10
    `).all();

    return stats;
  }

  // Search registrations
  search(query) {
    const stmt = this.db.prepare(`
      SELECT * FROM registrations
      WHERE
        vin LIKE ? OR
        customer_name LIKE ? OR
        phone LIKE ? OR
        plate_number LIKE ?
      ORDER BY created_at DESC
      LIMIT 50
    `);
    const searchPattern = `%${query}%`;
    return stmt.all(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  // Update registration
  updateRegistration(id, updates) {
    const allowedFields = [
      'customer_name', 'phone', 'mileage', 'reason',
      'service_type', 'service_specialist', 'status', 'notes'
    ];

    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (setClause.length === 0) {
      return null;
    }

    setClause.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE registrations SET ${setClause.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    stmt.run(...values);

    return this.getRegistrationById(id);
  }

  // Delete registration
  deleteRegistration(id) {
    const stmt = this.db.prepare('DELETE FROM registrations WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Export to CSV
  exportToCSV(outputPath) {
    const fs = require('fs');
    const rows = this.getAllRegistrations(10000); // Get all records

    if (rows.length === 0) {
      return 'No data to export';
    }

    // Get column names from first row
    const headers = Object.keys(rows[0]);
    const csvLines = [headers.join(',')];

    // Add data rows
    for (const row of rows) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvLines.push(values.join(','));
    }

    fs.writeFileSync(outputPath, csvLines.join('\n'));
    console.log(`✓ Exported ${rows.length} registrations to ${outputPath}`);
    return outputPath;
  }

  close() {
    this.db.close();
    console.log('✓ Database connection closed');
  }
}

module.exports = new SQLDatabase();

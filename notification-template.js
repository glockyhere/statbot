// Notification message template configuration
// Available variables: All fields from registrationData + additional variables listed below

module.exports = {
  // Main notification template
  // Available variables:
  // - ${branchName} - Branch name (e.g., "2 Bekat Service")
  // - ${vin} - Vehicle VIN number
  // - ${stateNumber} - License plate number
  // - ${regionCode} - Region code (e.g., "01")
  // - ${regionName} - Region name (e.g., "Toshkent")
  // - ${mashina} - Vehicle model/type
  // - ${rangi} - Vehicle color
  // - ${ombor} - Warehouse location
  // - ${garantiya} - Warranty status
  // - ${qarzdorlik} - Debt status
  // - ${customerName} - Customer name
  // - ${customerPhone} - Customer phone number
  // - ${mileage} - Mileage (auto-formatted with spaces)
  // - ${reason} - Service reason
  // - ${serviceType} - Service type
  // - ${specialist} - Assigned specialist
  // - ${registeredBy} - Name of user who made the registration (from users.js)
  // - ${dbRecordId} - Database record ID (optional, may be empty)

  template: `
*VIN:* \${vin}

\${mashina}

*Davlat raqami:* \${stateNumber}
*Viloyat:* \${regionCode} - \${regionName}
*Mijoz:* \${customerName}
*Telefon:* \${customerPhone}
*Probeg:* \${mileage} km

📝 *Sabab:* \${reason}
💼 *Xizmat turi:* \${serviceType}
👨‍🔧 *Usta:* \${specialist}

✍️ *Qabul qildi:* \${registeredBy}\${idLine}`
};

# Notification Message Configuration

The notification messages sent to branch group chats can be fully customized by editing the `notification-template.js` file.

## How to Customize

Edit the `notification-template.js` file to change the message format, add/remove fields, or rearrange the layout.

## Available Variables

You can use any of these variables in your template by using the `${variableName}` syntax:

### Required Fields (Always Available)
- `${branchName}` - Branch name (e.g., "2 Bekat Service")
- `${vin}` - Vehicle VIN number
- `${stateNumber}` - License plate number
- `${regionCode}` - Region code (e.g., "01")
- `${regionName}` - Region name (e.g., "Toshkent")
- `${customerName}` - Customer name
- `${customerPhone}` - Customer phone number
- `${mileage}` - Mileage (auto-formatted with thousand separators)
- `${reason}` - Service reason
- `${serviceType}` - Service type
- `${specialist}` - Assigned specialist
- `${registeredBy}` - Name of user who made the registration (from users.js)

### Optional Fields (May Be Empty)
- `${mashina}` - Vehicle model/type
- `${rangi}` - Vehicle color
- `${ombor}` - Warehouse location
- `${garantiya}` - Warranty status
- `${qarzdorlik}` - Debt status
- `${dbRecordId}` - Database record ID

## Template Structure

The template is a single string where you can use any of the available variables by using the `${variableName}` syntax.

**Special variable:**
- `${idLine}` - Automatically includes the ID line (🆔 *ID:* #123) if dbRecordId is available, otherwise empty

All variables are automatically replaced with their values. If a field is empty, it will be replaced with an empty string.

## Formatting

- Use **Markdown** formatting:
  - `*bold text*` for bold
  - `` \`code\` `` for monospace (note: you need to escape backticks with backslashes like `` \\\`text\\\` ``)
  - Emojis work normally (🚗 📍 🔍 etc.)

- Line breaks: Use actual line breaks in the template string

## Example Customizations

### Change Field Order
Move any field to a different position in the template:

```javascript
template: `🚗 *Yangi Qabul*

👤 *Mijoz:* \${customerName}
📞 *Telefon:* \${customerPhone}

🔍 *VIN:* \\\`\${vin}\\\`
...
```

### Add/Remove Emojis
```javascript
template: `Yangi Qabul

Filial: \${branchName}
VIN: \${vin}
...
```

### Change Labels
```javascript
template: `🚗 *Yangi Xizmat*

📍 *Bo'lim:* \${branchName}
🔍 *VIN Raqam:* \\\`\${vin}\\\`
...
```

### Conditionally Show Fields
To only show a field when it has data, you can't do it in the template directly - the code handles empty values by replacing them with empty strings. If you want to hide a field completely when empty, you'll need to remove it from the template.

## Important Notes

1. **Variable names must match exactly** - Use the exact variable names listed above
2. **Escape special characters** - For backticks in Markdown, use `\\\`` (three backslashes)
3. **Test after changes** - Send a test registration to verify formatting
4. **Keep backup** - Save a copy of the original template before making changes
5. **No code restart needed** - The bot automatically reloads the template file

## Troubleshooting

- **Variables not replacing:** Check spelling and ensure you're using `${variableName}` syntax
- **Markdown not working:** Make sure you're escaping backticks correctly with `\\\``
- **Missing line breaks:** Use actual line breaks in the template string, not `\n`
- **Photos not attaching:** This is automatic - all photos from the registration are included

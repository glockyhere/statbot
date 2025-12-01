require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const CRMBot = require('./bot.js');
const specialists = require('./specialists.js');
const usersDb = require('./users.js');
const sqlDatabase = require('./sql-database.js');
const branchGroups = require('./branch-groups.js');
const notificationTemplate = require('./notification-template.js');
const fs = require('fs');
const path = require('path');

// Create photos directory if it doesn't exist
const PHOTOS_DIR = path.join(__dirname, 'photos');
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

// Helper function to format numbers with thousand separators
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Helper function to download and save photo to specific folder
async function downloadPhoto(fileId, folderPath, filename) {
  try {
    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const file = await telegramBot.getFile(fileId);
    const filePath = path.join(folderPath, filename);
    await telegramBot.downloadFile(fileId, folderPath);

    // Rename the downloaded file to our custom filename
    const downloadedPath = path.join(folderPath, path.basename(file.file_path));
    if (fs.existsSync(downloadedPath)) {
      fs.renameSync(downloadedPath, filePath);
    }

    return filePath;
  } catch (error) {
    console.error('Error downloading photo:', error);
    return null;
  }
}

// Helper function to send registration notification to branch group
async function sendBranchGroupNotification(branchId, registrationData, dbRecordId, photos = {}, userName = null) {
  try {
    const groupChatId = branchGroups.getGroupChatId(branchId);

    if (!groupChatId) {
      console.log(`No group chat ID configured for branch: ${branchId}`);
      return false;
    }

    const branchName = branchGroups.getBranchName(branchId);

    // Build ID line if dbRecordId is available
    const idLine = dbRecordId ? `\n\n🆔 *ID:* #${dbRecordId}` : '';

    // Prepare template variables (with fallback for missing values)
    const templateVars = {
      branchName: branchName || '',
      vin: registrationData.vin || '',
      stateNumber: registrationData.stateNumber || '',
      regionCode: registrationData.regionCode || '',
      regionName: registrationData.regionName || '',
      mashina: registrationData.mashina || '',
      rangi: registrationData.rangi || '',
      ombor: registrationData.ombor || '',
      garantiya: registrationData.garantiya || '',
      qarzdorlik: registrationData.qarzdorlik || '',
      customerName: registrationData.customerName || '',
      customerPhone: registrationData.customerPhone || '',
      mileage: registrationData.mileage ? formatNumber(registrationData.mileage) : '',
      reason: registrationData.reason || '',
      serviceType: registrationData.serviceType || '',
      specialist: registrationData.specialist || '',
      registeredBy: userName || '',
      idLine: idLine
    };

    // Build message from template
    let message = notificationTemplate.template;
    Object.keys(templateVars).forEach(key => {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      message = message.replace(regex, templateVars[key]);
    });

    // Collect all available photos
    const mediaGroup = [];
    if (photos.photo45) {
      mediaGroup.push({
        type: 'photo',
        media: photos.photo45,
        caption: mediaGroup.length === 0 ? message : undefined,
        parse_mode: mediaGroup.length === 0 ? 'Markdown' : undefined
      });
    }
    if (photos.photoProbeg) {
      mediaGroup.push({
        type: 'photo',
        media: photos.photoProbeg,
        caption: mediaGroup.length === 0 ? message : undefined,
        parse_mode: mediaGroup.length === 0 ? 'Markdown' : undefined
      });
    }
    if (photos.photoVin) {
      mediaGroup.push({
        type: 'photo',
        media: photos.photoVin,
        caption: mediaGroup.length === 0 ? message : undefined,
        parse_mode: mediaGroup.length === 0 ? 'Markdown' : undefined
      });
    }
    if (photos.nameplatePhotos && photos.nameplatePhotos.length > 0) {
      photos.nameplatePhotos.forEach(photoPath => {
        mediaGroup.push({
          type: 'photo',
          media: photoPath,
          caption: mediaGroup.length === 0 ? message : undefined,
          parse_mode: mediaGroup.length === 0 ? 'Markdown' : undefined
        });
      });
    }

    // Send as media group if photos are available, otherwise send text message
    if (mediaGroup.length > 0) {
      await telegramBot.sendMediaGroup(groupChatId, mediaGroup);
      console.log(`✓ Sent notification with ${mediaGroup.length} photo(s) to ${branchName} group (${groupChatId})`);
    } else {
      await telegramBot.sendMessage(groupChatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          remove_keyboard: true
        }
      });
      console.log(`✓ Sent notification to ${branchName} group (${groupChatId})`);
    }

    return true;
  } catch (error) {
    console.error(`Error sending group notification for branch ${branchId}:`, error);
    return false;
  }
}

// Initialize Telegram Bot
const token = process.env.TELEGRAM_BOT_TOKEN;
const telegramBot = new TelegramBot(token, { polling: true });

// Initialize CRM Bot (single instance, keep browser open)
let crmBot = null;
let isInitialized = false;

// Store user sessions
const userSessions = {};

// CRM operation queue
const crmQueue = [];
let isProcessingQueue = false;

// State flow definition for navigation
const stateFlow = {
  'vin': null,
  'plate': 'vin',
  'region': 'plate',
  'name': 'region',
  'phone': 'name',
  'mileage': 'phone',
  'reason': 'mileage',
  'serviceType': 'reason',
  'specialist': 'serviceType'
};

// Queue processor - executes CRM operations one at a time
async function processCRMQueue() {
  if (isProcessingQueue || crmQueue.length === 0) return;

  isProcessingQueue = true;

  while (crmQueue.length > 0) {
    const operation = crmQueue.shift(); // Get first operation

    try {
      console.log(`Processing queue: ${operation.type} for user ${operation.chatId}`);
      await operation.execute();
      console.log(`✓ Queue operation completed: ${operation.type}`);
    } catch (error) {
      console.error(`Queue operation failed: ${operation.type}`, error);
      // Notify user of error if callback exists
      if (operation.onError) {
        await operation.onError(error);
      }
    }

    // Small delay between operations to ensure CRM stability
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  isProcessingQueue = false;
}

// Add operation to queue and start processing
function addToQueue(operation) {
  crmQueue.push(operation);
  console.log(`Added to queue: ${operation.type} (Queue size: ${crmQueue.length})`);

  // Start processing queue (non-blocking)
  processCRMQueue().catch(err => {
    console.error('Queue processing error:', err);
    isProcessingQueue = false;
  });
}

// Initialize CRM bot on startup
async function initCRMBot() {
  if (isInitialized) return;

  console.log('Initializing CRM bot...');
  crmBot = new CRMBot();
  await crmBot.init(true); // headless mode
  await crmBot.login();
  await crmBot.warmup(); // Pre-load vincode-status page
  isInitialized = true;
  console.log('✓ CRM bot initialized and logged in');
}

// Helper function to check if user is authorized
function isUserAuthorized(userId) {
  return usersDb.admins.includes(userId) || usersDb.users.hasOwnProperty(userId);
}

// Helper function to check if user is admin
function isUserAdmin(userId) {
  return usersDb.admins.includes(userId);
}

// Helper function to get user's branch
function getUserBranch(userId) {
  if (usersDb.users[userId]) {
    return usersDb.users[userId].branch;
  }
  return null;
}

// Helper function to get user info
function getUserInfo(userId) {
  if (usersDb.admins.includes(userId)) {
    return { name: 'Admin', branch: null, isAdmin: true };
  }
  if (usersDb.users[userId]) {
    return { ...usersDb.users[userId], isAdmin: false };
  }
  return null;
}

// Helper function to go back to previous state
async function goToPreviousState(chatId, session) {
  const previousState = stateFlow[session.step];

  if (!previousState) {
    // Already at first step, cancel instead
    delete userSessions[chatId];
    await telegramBot.sendMessage(chatId, `❌ Bekor qilindi`, {
      reply_markup: mainMenuKeyboard
    });
    return;
  }

  session.step = previousState;
  await promptForState(chatId, session);
}

// Helper function to prompt user based on current state
async function promptForState(chatId, session) {
  const step = session.step;

  switch(step) {
    case 'vin':
      await telegramBot.sendMessage(chatId, `🔍 *VIN*\n\nmin 4 belgi`, {
        parse_mode: 'Markdown',
        reply_markup: registrationKeyboard
      });
      break;
    case 'plate':
      await telegramBot.sendMessage(chatId, `🚗 *Davlat raqami*`, {
        parse_mode: 'Markdown',
        reply_markup: registrationKeyboard
      });
      break;
    case 'region':
      const regionKeyboard = [];
      for (let i = 0; i < regions.length; i += 2) {
        const row = [
          { text: `${regions[i].code} - ${regions[i].name}`, callback_data: `region_${regions[i].code}` }
        ];
        if (i + 1 < regions.length) {
          row.push({ text: `${regions[i + 1].code} - ${regions[i + 1].name}`, callback_data: `region_${regions[i + 1].code}` });
        }
        regionKeyboard.push(row);
      }
      regionKeyboard.push([{ text: '← Orqaga', callback_data: 'back' }]);
      await telegramBot.sendMessage(chatId, `📍 *Viloyat*`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: regionKeyboard }
      });
      break;
    case 'name':
      await telegramBot.sendMessage(chatId, `👤 *Mijoz ismi*`, {
        parse_mode: 'Markdown',
        reply_markup: registrationKeyboard
      });
      break;
    case 'phone':
      await telegramBot.sendMessage(chatId, `📞 *Telefon*`, {
        parse_mode: 'Markdown',
        reply_markup: registrationKeyboard
      });
      break;
    case 'mileage':
      await telegramBot.sendMessage(chatId, `🛣 *Probeg* (km)`, {
        parse_mode: 'Markdown',
        reply_markup: registrationKeyboard
      });
      break;
    case 'reason':
      await telegramBot.sendMessage(chatId, `📝 *Sabab*`, {
        parse_mode: 'Markdown',
        reply_markup: registrationKeyboard
      });
      break;
    case 'serviceType':
      const serviceTypeKeyboard = {
        inline_keyboard: [
          [
            { text: 'M/X', callback_data: 'service_type_mx' },
            { text: 'K/A', callback_data: 'service_type_ka' }
          ],
          [{ text: '← Orqaga', callback_data: 'back' }]
        ]
      };
      await telegramBot.sendMessage(chatId, `💼 *Xizmat turi*`, {
        parse_mode: 'Markdown',
        reply_markup: serviceTypeKeyboard
      });
      break;
    case 'specialist':
      const userBranch = session.data.userBranch;
      const branchSpecialists = specialists.specialists[userBranch];

      const specialistKeyboard = [];
      for (let i = 0; i < branchSpecialists.length; i += 2) {
        const row = [
          { text: branchSpecialists[i], callback_data: `specialist_${userBranch}_${i}` }
        ];
        if (i + 1 < branchSpecialists.length) {
          row.push({ text: branchSpecialists[i + 1], callback_data: `specialist_${userBranch}_${i + 1}` });
        }
        specialistKeyboard.push(row);
      }
      specialistKeyboard.push([{ text: '← Orqaga', callback_data: 'back' }]);

      await telegramBot.sendMessage(chatId, `👨‍🔧 *Usta*`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: specialistKeyboard }
      });
      break;
    case 'photo_vin':
      await telegramBot.sendMessage(chatId, `📸 *VIN rasmini yuboring*`, {
        parse_mode: 'Markdown',
        reply_markup: registrationKeyboard
      });
      break;
    case 'photo_45':
      await telegramBot.sendMessage(chatId, `📸 *45 gradus rasm*`, {
        parse_mode: 'Markdown',
        reply_markup: registrationKeyboard
      });
      break;
    case 'photo_probeg':
      await telegramBot.sendMessage(chatId, `📸 *Probeg rasmini yuboring*`, {
        parse_mode: 'Markdown',
        reply_markup: registrationKeyboard
      });
      break;
  }
}

// Regions of Uzbekistan with official vehicle registration codes (first code from each range)
const regions = [
  { name: 'Toshkent shahri', code: '01' },
  { name: 'Toshkent viloyati', code: '10' },
  { name: 'Sirdaryo viloyati', code: '20' },
  { name: 'Jizzax viloyati', code: '25' },
  { name: 'Samarqand viloyati', code: '30' },
  { name: 'Farg\'ona viloyati', code: '40' },
  { name: 'Namangan viloyati', code: '50' },
  { name: 'Andijon viloyati', code: '60' },
  { name: 'Qashqadaryo viloyati', code: '70' },
  { name: 'Surxondaryo viloyati', code: '75' },
  { name: 'Buxoro viloyati', code: '80' },
  { name: 'Navoiy viloyati', code: '85' },
  { name: 'Xorazm viloyati', code: '90' },
  { name: 'Qoraqalpog\'iston Respublikasi', code: '95' }
];

// Main menu keyboard
const mainMenuKeyboard = {
  keyboard: [
    [{ text: '📝 Registratsiya' }],
    [{ text: '📊 Xisobot' }, { text: '💡 Holat' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

// Registration mode keyboard (cancel + back)
const registrationKeyboard = {
  keyboard: [
    [{ text: '← Orqaga' }, { text: '❌ Bekor qilish' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

// Start command
telegramBot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Check if user is authorized
  if (!isUserAuthorized(userId)) {
    await telegramBot.sendMessage(chatId,
      `*Ruxsat yo'q*

Admin: @responsophobia
ID: \`${userId}\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const userInfo = getUserInfo(userId);
  const branchInfo = userInfo.branch ? `\n\n📍 Filial: *${specialists.branches.find(b => b.id === userInfo.branch)?.name || userInfo.branch}*` : '';

  await telegramBot.sendMessage(chatId,
    `👋 Xush kelibsiz${userInfo.name ? ', *' + userInfo.name + '*' : ''}${branchInfo}`,
    {
      parse_mode: 'Markdown',
      reply_markup: mainMenuKeyboard
    }
  );
});

// Handle main menu button clicks
telegramBot.onText(/^📝 Registratsiya$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Check authorization
  if (!isUserAuthorized(userId)) {
    await telegramBot.sendMessage(chatId,
      `*Ruxsat yo'q*

Admin: @responsophobia
ID: \`${userId}\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const userBranch = getUserBranch(userId);
  const userName = usersDb.users[userId]?.name || null; // Get user's name from users.js

  // Initialize session for addservice
  userSessions[chatId] = {
    step: 'vin',
    username: msg.from.username || null, // Telegram username
    userName: userName, // Name from users.js (e.g., "Saidabbos", "Komilbek")
    data: {
      userBranch: userBranch // Store user's branch in session
    }
  };

  await telegramBot.sendMessage(chatId,
    `🔍 *VIN*\n\nmin 4 belgi`,
    {
      parse_mode: 'Markdown',
      reply_markup: registrationKeyboard
    }
  );
});

telegramBot.onText(/^📊 Xisobot$/, async (msg) => {
  const chatId = msg.chat.id;

  await telegramBot.sendMessage(chatId,
    `Tez orada...`,
    {
      reply_markup: mainMenuKeyboard
    }
  );
});

telegramBot.onText(/^💡 Holat$/, async (msg) => {
  const chatId = msg.chat.id;

  const status = isInitialized ? '✅ Faol' : '❌ Faol emas';
  const crmStatus = isInitialized ? '🔗 Ulangan' : '⚠️ Ulanmagan';

  await telegramBot.sendMessage(chatId,
    `*Status*\n\nBot: ${status}\nCRM: ${crmStatus}`,
    {
      parse_mode: 'Markdown',
      reply_markup: mainMenuKeyboard
    }
  );
});

// Handle callback queries (inline button clicks)
telegramBot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  // Ignore all callback queries from groups and supergroups
  if (callbackQuery.message.chat.type === 'group' || callbackQuery.message.chat.type === 'supergroup') {
    await telegramBot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  const session = userSessions[chatId];

  // Handle back button
  if (data === 'back') {
    if (session) {
      await telegramBot.answerCallbackQuery(callbackQuery.id);
      await telegramBot.deleteMessage(chatId, callbackQuery.message.message_id);
      await goToPreviousState(chatId, session);
    }
    return;
  }

  // Handle cancel button
  if (data === 'cancel') {
    delete userSessions[chatId];
    await telegramBot.answerCallbackQuery(callbackQuery.id);
    await telegramBot.editMessageText(`Bekor qilindi`, {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id
    });
    await telegramBot.sendMessage(chatId, `Menyu:`, {
      reply_markup: mainMenuKeyboard
    });
    return;
  }

  if (data.startsWith('vin_')) {
    const selectedVIN = data.substring(4);
    const session = userSessions[chatId];

    if (session) {
      await telegramBot.answerCallbackQuery(callbackQuery.id, { text: 'Ma\'lumotlar yuklanmoqda...' });

      // Add to queue to extract vehicle info for selected VIN
      addToQueue({
        type: 'extract_vehicle_info',
        chatId: chatId,
        execute: async () => {
          // Extract vehicle info for the selected VIN
          const vinData = await crmBot.selectVINAndExtractInfo(selectedVIN);

          // Store VIN and spread vehicle info into session.data
          session.data.vin = selectedVIN;
          session.data.mashina = vinData.mashina;
          session.data.rangi = vinData.rangi;
          session.data.ombor = vinData.ombor;
          session.data.garantiya = vinData.garantiya;
          session.data.qarzdorlik = vinData.qarzdorlik;
          session.step = 'plate';

          // Format vehicle info message
          let infoMsg = `*VIN:* \`${vinData.vin}\`\n`;
          if (vinData.mashina) infoMsg += `*Mashina:* ${vinData.mashina}\n`;
          if (vinData.rangi) infoMsg += `*Rangi:* ${vinData.rangi}\n`;
          if (vinData.ombor) infoMsg += `*Ombor:* ${vinData.ombor}\n`;
          if (vinData.garantiya) infoMsg += `*Garantiya:* ${vinData.garantiya}\n`;
          if (vinData.qarzdorlik !== undefined) infoMsg += `*Qarzdorlik:* ${vinData.qarzdorlik}\n`;

          await telegramBot.editMessageText(infoMsg, {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            parse_mode: 'Markdown'
          });

          await telegramBot.sendMessage(chatId, `*Davlat raqami:*`, {
            parse_mode: 'Markdown',
            reply_markup: registrationKeyboard
          });
        },
        onError: async (error) => {
          console.error('Error extracting vehicle info:', error);
          await telegramBot.sendMessage(chatId, `❌ Xatolik: ${error.message}`, {
            reply_markup: registrationKeyboard
          });
        }
      });

      return; // Exit early since we answered the callback
    }
  }
  else if (data.startsWith('region_')) {
    const regionCode = data.substring(7);
    const region = regions.find(r => r.code === regionCode);
    const session = userSessions[chatId];

    if (session && region) {
      session.data.regionCode = region.code;
      session.data.regionName = region.name;
      session.step = 'name';

      await telegramBot.editMessageText(
        `${region.code} - ${region.name}`,
        {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id
        }
      );

      await telegramBot.sendMessage(chatId, `👤 *Mijoz ismi*`, { parse_mode: 'Markdown' });
    }
  }
  else if (data.startsWith('service_type_')) {
    const serviceType = data === 'service_type_mx' ? 'M/X' : 'K/A';
    const session = userSessions[chatId];

    if (session) {
      session.data.serviceType = serviceType;
      session.step = 'specialist';

      await telegramBot.editMessageText(serviceType, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id
      });

      // Get user's branch from session
      const userBranch = session.data.userBranch;

      if (!userBranch) {
        await telegramBot.sendMessage(chatId, `Filial topilmadi`);
        delete userSessions[chatId];
        return;
      }

      // Store branch info in session
      const branch = specialists.branches.find(b => b.id === userBranch);
      session.data.branch = branch ? branch.name : userBranch;
      session.data.branchId = userBranch;

      // Show specialists for user's branch (2 per row)
      const branchSpecialists = specialists.specialists[userBranch];

      if (!branchSpecialists || branchSpecialists.length === 0) {
        await telegramBot.sendMessage(chatId, `Xodimlar topilmadi`);
        delete userSessions[chatId];
        return;
      }

      const specialistKeyboard = [];
      for (let i = 0; i < branchSpecialists.length; i += 2) {
        const row = [
          { text: branchSpecialists[i], callback_data: `specialist_${userBranch}_${i}` }
        ];
        if (i + 1 < branchSpecialists.length) {
          row.push({ text: branchSpecialists[i + 1], callback_data: `specialist_${userBranch}_${i + 1}` });
        }
        specialistKeyboard.push(row);
      }

      await telegramBot.sendMessage(chatId, `👨‍🔧 *Usta*`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: specialistKeyboard }
      });
    }
  }
  else if (data.startsWith('specialist_')) {
    const parts = data.substring(11).split('_');
    const branchId = parts[0];
    const specialistIndex = parseInt(parts[1]);
    const specialistName = specialists.specialists[branchId][specialistIndex];
    const session = userSessions[chatId];

    if (session && specialistName) {
      session.data.specialist = specialistName;
      session.step = 'photos_all';
      session.data.photoQueue = []; // Initialize photo queue

      await telegramBot.editMessageText(specialistName, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id
      });

      // Move to photo upload steps - ask for ALL photos at once
      await telegramBot.sendMessage(chatId, `📸 *Rasmlarni yuboring (minimum 3 ta)*

1️⃣ 45 gradus
2️⃣ Probeg
3️⃣ VIN
4️⃣+ Nameplate (ixtiyoriy)`, {
        parse_mode: 'Markdown',
        reply_markup: registrationKeyboard
      });
    }
  }
  else if (data === 'submit_registration') {
    const session = userSessions[chatId];
    if (!session) return;

    // Validate that user has uploaded minimum 3 photos
    if (!session.data.photo45 || !session.data.photoProbeg || !session.data.photoVin) {
      await telegramBot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Iltimos, avval 3 ta rasmni yuboring (45 gradus, Probeg, VIN)',
        show_alert: true
      });
      return;
    }

    // Show summary and save
    const summary = `📋 *Ma'lumotlar*

🔍 VIN: \`${session.data.vin}\`
🚗 Davlat raqami: *${session.data.stateNumber}*
📍 Viloyat: ${session.data.regionCode} - ${session.data.regionName}

👤 Mijoz: *${session.data.customerName}*
📞 Telefon: ${session.data.customerPhone}

🛣 Probeg: ${formatNumber(session.data.mileage)} km
📝 Sabab: ${session.data.reason}

💼 Xizmat: *${session.data.serviceType}*
📍 Filial: ${session.data.branch}
👨‍🔧 Usta: ${session.data.specialist}`;

    const queuePosition = crmQueue.length + 1;
    const queueText = queuePosition > 1 ? `\n\n📋 Navbat: ${queuePosition}` : '';
    await telegramBot.sendMessage(chatId, summary + queueText, { parse_mode: 'Markdown' });

    if (!isInitialized) {
      await initCRMBot();
    }

    // Map branch to correct service specialist name
    const branchToSpecialist = {
      '2bekat': '2 Bekat Service',
      '5bekat': 'Jetour Service',
      'texnopark': 'Roxat Service'
    };

    const serviceSpecialist = branchToSpecialist[session.data.branchId] || session.data.specialist;

    // Prepare CRM data with all required fields
    const crmData = {
      ...session.data,
      odometer: session.data.mileage,
      serviceSpecialist: serviceSpecialist,
      arrivalDateTime: new Date()
    };

    // Add to queue for processing
    addToQueue({
      type: 'service_transfer',
      chatId: chatId,
      execute: async () => {
        // Step 1: Add reason first
        console.log('Adding reason to CRM...');
        await crmBot.addServiceReason(crmData.reason);

        // Step 2: Add service transfer with newly created reason
        console.log('Adding service transfer to CRM...');
        await crmBot.addServiceTransfer(crmData, false);

        // Save to SQL database with Telegram user info
        const dbRecord = sqlDatabase.addRegistration({
          ...session.data,
          ...crmData,
          telegramUserId: chatId,
          telegramUsername: session.username || null,
          crmSubmitted: true
        });

        await telegramBot.sendMessage(chatId, `✅ *Saqlandi*\n\nCRMga muvaffaqiyatli qo'shildi\nID: #${dbRecord.id}`, {
          parse_mode: 'Markdown',
          reply_markup: mainMenuKeyboard
        });

        // Clear session after successful save
        delete userSessions[chatId];
      },
      onError: async (error) => {
        console.error('Error adding service transfer:', error);
        await telegramBot.sendMessage(chatId, `❌ *Xatolik*\n\n${error.message}`, {
          parse_mode: 'Markdown',
          reply_markup: mainMenuKeyboard
        });
        delete userSessions[chatId];
      }
    });
  }

  // Answer callback query
  await telegramBot.answerCallbackQuery(callbackQuery.id);
});

// Handle regular messages
telegramBot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Ignore all messages from groups and supergroups
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    return;
  }

  // Ignore if it's a command (except /start)
  if (text && text.startsWith('/')) {
    if (text !== '/start') {
      await telegramBot.sendMessage(chatId, `Menyudan foydalaning`, {
        reply_markup: mainMenuKeyboard
      });
    }
    return;
  }

  // Check if user has an active session
  const session = userSessions[chatId];
  if (!session) {
    await telegramBot.sendMessage(chatId, `Menyudan tanlang`, {
      reply_markup: mainMenuKeyboard
    });
    return;
  }

  // Handle text commands: orqaga, bekor, cancel
  const trimmedText = text?.trim();

  if (trimmedText === '← Orqaga') {
    await goToPreviousState(chatId, session);
    return;
  }

  if (trimmedText === '❌ Bekor qilish') {
    delete userSessions[chatId];
    await telegramBot.sendMessage(chatId, `❌ Bekor qilindi`, {
      reply_markup: mainMenuKeyboard
    });
    return;
  }

  // Handle different steps
  if (session.step === 'vin') {
    // User entered VIN search query (minimum 4 chars, no max limit)
    const vinQuery = text.trim();

    if (vinQuery.length < 4) {
      await telegramBot.sendMessage(chatId, `Min 4 belgi`);
      return;
    }

    const queuePosition = crmQueue.length + 1;
    const queueText = queuePosition > 1 ? ` (Navbat: ${queuePosition})` : '';
    const processingMsg = await telegramBot.sendMessage(chatId, `🔍 Qidiryapman...${queueText}`);

    if (!isInitialized) {
      await initCRMBot();
    }

    // Add VIN search to queue
    addToQueue({
      type: 'vin_search',
      chatId: chatId,
      execute: async () => {
        // Search for VINs
        const vins = await crmBot.searchVIN(vinQuery);

        await telegramBot.deleteMessage(chatId, processingMsg.message_id);

        if (vins.length === 0) {
          await telegramBot.sendMessage(chatId, `❌ Topilmadi`, {
            reply_markup: registrationKeyboard
          });
          return;
        }

        // If only 1 VIN found, auto-select it and extract info
        if (vins.length === 1) {
          const selectedVIN = vins[0];

          // Extract vehicle info for the selected VIN
          const vinData = await crmBot.selectVINAndExtractInfo(selectedVIN);

          // Store VIN and spread vehicle info into session.data
          session.data.vin = vinData.vin;
          session.data.mashina = vinData.mashina;
          session.data.rangi = vinData.rangi;
          session.data.ombor = vinData.ombor;
          session.data.garantiya = vinData.garantiya;
          session.data.qarzdorlik = vinData.qarzdorlik;
          session.step = 'plate';

          // Format vehicle info message
          let infoMsg = `*VIN:* \`${vinData.vin}\`\n`;
          if (vinData.mashina) infoMsg += `*Mashina:* ${vinData.mashina}\n`;
          if (vinData.rangi) infoMsg += `*Rangi:* ${vinData.rangi}\n`;
          if (vinData.ombor) infoMsg += `*Ombor:* ${vinData.ombor}\n`;
          if (vinData.garantiya) infoMsg += `*Garantiya:* ${vinData.garantiya}\n`;
          if (vinData.qarzdorlik !== undefined) infoMsg += `*Qarzdorlik:* ${vinData.qarzdorlik}\n`;
          infoMsg += `\n*Davlat raqami:*`;

          await telegramBot.sendMessage(chatId, infoMsg, {
            parse_mode: 'Markdown',
            reply_markup: registrationKeyboard
          });
          return;
        }

        // Multiple VINs found - show inline keyboard for selection
        const keyboard = vins.map(vin => ([{
          text: vin,
          callback_data: `vin_${vin}`
        }]));

        await telegramBot.sendMessage(chatId, `${vins.length} ta VIN:`, {
          reply_markup: { inline_keyboard: keyboard }
        });
      },
      onError: async (error) => {
        await telegramBot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
        await telegramBot.sendMessage(chatId, `❌ *Xatolik*\n\n${error.message}`, {
          parse_mode: 'Markdown',
          reply_markup: registrationKeyboard
        });
      }
    });
  }
  else if (session.step === 'plate') {
    // User entered plate number - validate
    const plate = text.trim();

    if (plate.length < 3) {
      await telegramBot.sendMessage(chatId, `Juda qisqa. Qayta kiriting:`);
      return;
    }

    if (plate.length > 20) {
      await telegramBot.sendMessage(chatId, `Juda uzun. Qayta kiriting:`);
      return;
    }

    // Auto-format: convert all letters to uppercase
    session.data.stateNumber = plate.toUpperCase();
    session.step = 'region';

    // Create inline keyboard with regions (2 buttons per row)
    const regionKeyboard = [];
    for (let i = 0; i < regions.length; i += 2) {
      const row = [
        { text: `${regions[i].code} - ${regions[i].name}`, callback_data: `region_${regions[i].code}` }
      ];
      if (i + 1 < regions.length) {
        row.push({ text: `${regions[i + 1].code} - ${regions[i + 1].name}`, callback_data: `region_${regions[i + 1].code}` });
      }
      regionKeyboard.push(row);
    }

    await telegramBot.sendMessage(chatId, `📍 *Viloyat*`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: regionKeyboard }
    });
  }
  else if (session.step === 'region') {
    // User typed text instead of using inline keyboard
    await telegramBot.sendMessage(chatId, `Tugmalardan tanlang`);
    return;
  }
  else if (session.step === 'name') {
    // User entered customer name - validate
    const name = text.trim();

    if (name.length < 2) {
      await telegramBot.sendMessage(chatId, `Juda qisqa. Qayta kiriting:`);
      return;
    }

    if (name.length > 100) {
      await telegramBot.sendMessage(chatId, `Juda uzun. Qayta kiriting:`);
      return;
    }

    session.data.customerName = name;
    session.step = 'phone';

    await telegramBot.sendMessage(chatId, `📞 *Telefon*`, { parse_mode: 'Markdown' });
  }
  else if (session.step === 'serviceType') {
    // User typed text instead of using inline keyboard
    await telegramBot.sendMessage(chatId, `Tugmalardan tanlang`);
    return;
  }
  else if (session.step === 'phone') {
    // User entered phone number - validate and format
    let phoneNumber = text.trim();

    // Remove all non-digit characters
    phoneNumber = phoneNumber.replace(/\D/g, '');

    // Remove leading country code if present (998)
    if (phoneNumber.startsWith('998')) {
      phoneNumber = phoneNumber.substring(3);
    }

    // Validate: should be exactly 9 digits after removing country code
    if (phoneNumber.length !== 9) {
      await telegramBot.sendMessage(chatId, `9 raqam kerak`);
      return;
    }

    // Validate: should start with valid Uzbekistan operator code
    const validPrefixes = ['90', '91', '93', '94', '95', '97', '98', '99', '33', '88', '77'];
    const prefix = phoneNumber.substring(0, 2);

    if (!validPrefixes.includes(prefix)) {
      await telegramBot.sendMessage(chatId, `Noto'g'ri operator`);
      return;
    }

    // Format: +998XXXXXXXXX
    session.data.customerPhone = `+998${phoneNumber}`;
    session.step = 'mileage';

    await telegramBot.sendMessage(chatId, `🛣 *Probeg* (km)`, { parse_mode: 'Markdown', reply_markup: registrationKeyboard });
  }
  else if (session.step === 'mileage') {
    // User entered mileage - validate
    let mileage = text.trim();

    // Remove all non-digit characters
    mileage = mileage.replace(/\D/g, '');

    // Validate: should be a positive number
    if (!mileage || parseInt(mileage) <= 0) {
      await telegramBot.sendMessage(chatId, `Musbat son kerak`);
      return;
    }

    // Validate: reasonable mileage (max 1,000,000 km)
    if (parseInt(mileage) > 1000000) {
      await telegramBot.sendMessage(chatId, `Max 1,000,000 km`);
      return;
    }

    session.data.mileage = mileage;
    session.step = 'reason';

    await telegramBot.sendMessage(chatId, `📝 *Sabab*`, { parse_mode: 'Markdown' });
  }
  else if (session.step === 'photo_vin' || session.step === 'photo_45' || session.step === 'photo_probeg') {
    // During photo steps, only accept photos, ignore text messages
    await telegramBot.sendMessage(chatId, `📸 Iltimos, rasm yuboring`);
    return;
  }
  else if (session.step === 'reason') {
    // User entered reason - validate
    const reason = text.trim();

    if (reason.length < 2) {
      await telegramBot.sendMessage(chatId, `Juda qisqa. Qayta kiriting:`);
      return;
    }

    if (reason.length > 500) {
      await telegramBot.sendMessage(chatId, `Juda uzun. Qayta kiriting:`);
      return;
    }

    session.data.reason = reason;
    session.step = 'serviceType';

    // Show service type selection with inline buttons
    const serviceTypeKeyboard = {
      inline_keyboard: [
        [
          { text: 'M/X', callback_data: 'service_type_mx' },
          { text: 'K/A', callback_data: 'service_type_ka' }
        ],
        [{ text: '← Orqaga', callback_data: 'back' }]
      ]
    };

    await telegramBot.sendMessage(chatId, `💼 *Xizmat turi*`, {
      parse_mode: 'Markdown',
      reply_markup: serviceTypeKeyboard
    });
  }
  else if (session.step === 'specialist') {
    // User typed text instead of using inline keyboard - remind them to use buttons
    await telegramBot.sendMessage(chatId, `Tugmalardan tanlang`);
    return;
  }
  else if (session.step === 'photos_all') {
    // User is in photo upload step - photos are handled by the photo handler
    // Ignore text messages during this step
    return;
  }
  else {
    // Unexpected state - should not happen, but handle gracefully
    await telegramBot.sendMessage(chatId, `Noma'lum xatolik. Qaytadan boshlang`);
    delete userSessions[chatId];
    return;
  }
});

// Error handling
telegramBot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// Graceful shutdown
// Store media groups temporarily to collect all photos in an album
const mediaGroups = new Map();

// Handle photo uploads
telegramBot.on('photo', async (msg) => {
  const chatId = msg.chat.id;

  // Ignore all photos from groups and supergroups
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    return;
  }

  const session = userSessions[chatId];

  if (!session) return;

  // Check if user is in the photo step
  if (session.step === 'photos_all') {
    const photo = msg.photo[msg.photo.length - 1]; // Get highest quality photo
    const mediaGroupId = msg.media_group_id;

    // Create folder name: VIN_username_timestamp
    if (!session.data.photoFolder) {
      const timestamp = Date.now();
      const username = session.userName || session.username || `user${chatId}`;
      const vin = session.data.vin || 'novin';
      session.data.photoFolder = `${vin}_${username}_${timestamp}`;
      session.data.photoQueue = []; // Initialize queue
      session.data.nameplatePhotos = []; // Store nameplate photos
    }

    // If this is part of a media group (album), collect all photos first
    if (mediaGroupId) {
      if (!mediaGroups.has(mediaGroupId)) {
        mediaGroups.set(mediaGroupId, {
          chatId: chatId,
          photos: [],
          timeout: null
        });
      }

      const group = mediaGroups.get(mediaGroupId);
      group.photos.push(photo);

      // Clear existing timeout
      if (group.timeout) {
        clearTimeout(group.timeout);
      }

      // Wait 500ms for all photos in the album to arrive
      group.timeout = setTimeout(async () => {
        const allPhotos = group.photos;
        mediaGroups.delete(mediaGroupId);

        // Process all photos in the album
        await processPhotoAlbum(chatId, session, allPhotos);
      }, 500);
    } else {
      // Single photo sent, process immediately
      await processSinglePhoto(chatId, session, photo);
    }
  }
});

// Function to process a single photo
async function processSinglePhoto(chatId, session, photo) {
  const folderPath = path.join(PHOTOS_DIR, session.data.photoFolder);

  // Add photo to queue
  session.data.photoQueue.push(photo.file_id);
  const position = session.data.photoQueue.length;

  // Determine filename based on position: 1=45deg, 2=probeg, 3=vin, 4+=nameplate
  let filename;
  if (position === 1) {
    filename = '45_degree.jpg';
  } else if (position === 2) {
    filename = 'probeg.jpg';
  } else if (position === 3) {
    filename = 'vin.jpg';
  } else {
    filename = `nameplate_${position - 3}.jpg`;
  }

  const filePath = await downloadPhoto(photo.file_id, folderPath, filename);

  if (filePath) {
    // Store the photo paths based on position
    if (position === 1) {
      session.data.photo45 = filePath;
    } else if (position === 2) {
      session.data.photoProbeg = filePath;
    } else if (position === 3) {
      session.data.photoVin = filePath;

      // Send confirmation AFTER all 3 required photos are received
      await telegramBot.sendMessage(chatId, `✅ 3 ta rasm qabul qilindi\n\n📋 Ma'lumotlarni tekshiring...`, { parse_mode: 'Markdown' });

        // Send notification to branch group IMMEDIATELY after receiving minimum 3 photos
        const branchId = session.data.userBranch || session.data.branchId;
        if (branchId) {
          await sendBranchGroupNotification(branchId, {
            vin: session.data.vin,
            stateNumber: session.data.stateNumber,
            regionCode: session.data.regionCode,
            regionName: session.data.regionName,
            customerName: session.data.customerName,
            customerPhone: session.data.customerPhone,
            mileage: session.data.mileage,
            reason: session.data.reason,
            serviceType: session.data.serviceType,
            specialist: session.data.specialist,
            mashina: session.data.mashina,
            rangi: session.data.rangi,
            ombor: session.data.ombor,
            garantiya: session.data.garantiya,
            qarzdorlik: session.data.qarzdorlik
          }, null, { // No DB record ID yet, pass photos
            photo45: session.data.photo45,
            photoProbeg: session.data.photoProbeg,
            photoVin: session.data.photoVin,
            nameplatePhotos: session.data.nameplatePhotos
          }, session.userName); // Pass userName from session
        }

        // After receiving minimum 3 photos, proceed to submit
        const summary = `📋 *Ma'lumotlar*

🔍 VIN: \`${session.data.vin}\`
🚗 Davlat raqami: *${session.data.stateNumber}*
📍 Viloyat: ${session.data.regionCode} - ${session.data.regionName}

👤 Mijoz: *${session.data.customerName}*
📞 Telefon: ${session.data.customerPhone}

🛣 Probeg: ${formatNumber(session.data.mileage)} km
📝 Sabab: ${session.data.reason}

💼 Xizmat: *${session.data.serviceType}*
📍 Filial: ${session.data.branch}
👨‍🔧 Usta: ${session.data.specialist}`;

        const queuePosition = crmQueue.length + 1;
        const queueText = queuePosition > 1 ? `\n\n📋 Navbat: ${queuePosition}` : '';
        await telegramBot.sendMessage(chatId, summary + queueText, { parse_mode: 'Markdown' });
      } else {
        // Handle nameplate photos (position > 3) - silently store them
        if (!session.data.nameplatePhotos) {
          session.data.nameplatePhotos = [];
        }
        session.data.nameplatePhotos.push(filePath);
        // No confirmation message - photos sent in batch shouldn't spam
      }

      // Only continue to CRM submission if we have at least 3 photos
      if (position === 3) {

        if (!isInitialized) {
          await initCRMBot();
        }

        const branchToSpecialist = {
          '2bekat': '2 Bekat Service',
          '5bekat': 'Jetour Service',
          'texnopark': 'Roxat Service'
        };

        const serviceSpecialist = branchToSpecialist[session.data.branchId] || session.data.specialist;

        const crmData = {
          ...session.data,
          odometer: session.data.mileage,
          serviceSpecialist: serviceSpecialist,
          arrivalDateTime: new Date()
        };

        addToQueue({
          type: 'service_transfer',
          chatId: chatId,
          execute: async () => {
            console.log('Adding reason to CRM...');
            await crmBot.addServiceReason(crmData.reason);

            console.log('Adding service transfer to CRM...');
            const transferSuccess = await crmBot.addServiceTransfer(crmData, false);

            if (!transferSuccess) {
              // Service transfer failed, don't upload photos
              console.log('⚠️  Skipping photo upload due to failed service transfer');

              const dbRecord = sqlDatabase.addRegistration({
                ...session.data,
                ...crmData,
                telegramUserId: chatId,
                telegramUsername: session.username || null,
                crmSubmitted: false  // Mark as not submitted since it failed
              });

              await telegramBot.sendMessage(chatId, `⚠️ *Qisman saqlandi*\n\nCRMga qo'shishda xatolik yuz berdi (validatsiya xatosi)\nMa'lumotlar bazaga saqlandi\nID: #${dbRecord.id}`, {
                parse_mode: 'Markdown',
                reply_markup: mainMenuKeyboard
              });

              delete userSessions[chatId];
              return;
            }

            // Upload photos to car status page
            console.log('Uploading photos to car status page...');
            await crmBot.uploadPhotosToCarStatus(
              {
                vin: session.data.vin,
                stateNumber: session.data.stateNumber,
                customerName: session.data.customerName,
                arrivalDateTime: crmData.arrivalDateTime
              },
              session.data.photoVin,
              session.data.photo45,
              session.data.photoProbeg,
              session.data.nameplatePhotos || []
            );

            const dbRecord = sqlDatabase.addRegistration({
              ...session.data,
              ...crmData,
              telegramUserId: chatId,
              telegramUsername: session.username || null,
              crmSubmitted: true
            });

            await telegramBot.sendMessage(chatId, `✅ *Saqlandi*\n\nCRMga muvaffaqiyatli qo'shildi\nRasmlar yuklandi\nID: #${dbRecord.id}`, {
              parse_mode: 'Markdown',
              reply_markup: mainMenuKeyboard
            });

            delete userSessions[chatId];
          },
          onError: async (error) => {
            console.error('Error adding service transfer:', error);
            await telegramBot.sendMessage(chatId, `❌ *Xatolik*\n\n${error.message}`, {
              parse_mode: 'Markdown',
              reply_markup: mainMenuKeyboard
            });
            delete userSessions[chatId];
          }
        });
      }
    } else {
      await telegramBot.sendMessage(chatId, `❌ Rasmni saqlashda xatolik. Qayta yuboring.`);
    }
  }

// Function to process all photos from an album at once
async function processPhotoAlbum(chatId, session, photos) {
  const folderPath = path.join(PHOTOS_DIR, session.data.photoFolder);

  // Process each photo in the album
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    session.data.photoQueue.push(photo.file_id);
    const position = session.data.photoQueue.length;

    // Determine filename based on position: 1=45deg, 2=probeg, 3=vin, 4+=nameplate
    let filename;
    if (position === 1) {
      filename = '45_degree.jpg';
    } else if (position === 2) {
      filename = 'probeg.jpg';
    } else if (position === 3) {
      filename = 'vin.jpg';
    } else {
      filename = `nameplate_${position - 3}.jpg`;
    }

    const filePath = await downloadPhoto(photo.file_id, folderPath, filename);

    if (filePath) {
      // Store the photo paths based on position
      if (position === 1) {
        session.data.photo45 = filePath;
      } else if (position === 2) {
        session.data.photoProbeg = filePath;
      } else if (position === 3) {
        session.data.photoVin = filePath;
      } else {
        // Nameplate photos (position > 3)
        if (!session.data.nameplatePhotos) {
          session.data.nameplatePhotos = [];
        }
        session.data.nameplatePhotos.push(filePath);
      }
    }
  }

  // After processing all photos, send ONE confirmation message
  const photoCount = photos.length;
  if (photoCount >= 3) {
    await telegramBot.sendMessage(chatId, `✅ ${photoCount} ta rasm qabul qilindi\n\n📋 Ma'lumotlarni tekshiring...`, { parse_mode: 'Markdown' });

    // Send notification to branch group IMMEDIATELY
    const branchId = session.data.userBranch || session.data.branchId;
    if (branchId) {
      await sendBranchGroupNotification(branchId, {
        vin: session.data.vin,
        stateNumber: session.data.stateNumber,
        regionCode: session.data.regionCode,
        regionName: session.data.regionName,
        customerName: session.data.customerName,
        customerPhone: session.data.customerPhone,
        mileage: session.data.mileage,
        reason: session.data.reason,
        serviceType: session.data.serviceType,
        specialist: session.data.specialist,
        mashina: session.data.mashina,
        rangi: session.data.rangi,
        ombor: session.data.ombor,
        garantiya: session.data.garantiya,
        qarzdorlik: session.data.qarzdorlik
      }, null, { // No DB record ID yet, pass photos
        photo45: session.data.photo45,
        photoProbeg: session.data.photoProbeg,
        photoVin: session.data.photoVin,
        nameplatePhotos: session.data.nameplatePhotos
      }, session.userName); // Pass userName from session
    }

    // Show summary
    const summary = `📋 *Ma'lumotlar*

🔍 VIN: \`${session.data.vin}\`
🚗 Davlat raqami: *${session.data.stateNumber}*
📍 Viloyat: ${session.data.regionCode} - ${session.data.regionName}

👤 Mijoz: *${session.data.customerName}*
📞 Telefon: ${session.data.customerPhone}

🛣 Probeg: ${formatNumber(session.data.mileage)} km
📝 Sabab: ${session.data.reason}

💼 Xizmat: *${session.data.serviceType}*
📍 Filial: ${session.data.branch}
👨‍🔧 Usta: ${session.data.specialist}`;

    const queuePosition = crmQueue.length + 1;
    const queueText = queuePosition > 1 ? `\n\n📋 Navbat: ${queuePosition}` : '';
    await telegramBot.sendMessage(chatId, summary + queueText, { parse_mode: 'Markdown' });

    // Submit to CRM
    if (!isInitialized) {
      await initCRMBot();
    }

    const branchToSpecialist = {
      '2bekat': '2 Bekat Service',
      '5bekat': 'Jetour Service',
      'texnopark': 'Roxat Service'
    };

    const serviceSpecialist = branchToSpecialist[session.data.branchId] || session.data.specialist;

    const crmData = {
      ...session.data,
      odometer: session.data.mileage,
      serviceSpecialist: serviceSpecialist,
      arrivalDateTime: new Date()
    };

    addToQueue({
      type: 'service_transfer',
      chatId: chatId,
      execute: async () => {
        console.log('Adding reason to CRM...');
        await crmBot.addServiceReason(crmData.reason);

        console.log('Adding service transfer to CRM...');
        const transferSuccess = await crmBot.addServiceTransfer(crmData, false);

        if (!transferSuccess) {
          // Service transfer failed, don't upload photos
          console.log('⚠️  Skipping photo upload due to failed service transfer');

          const dbRecord = sqlDatabase.addRegistration({
            ...session.data,
            ...crmData,
            telegramUserId: chatId,
            telegramUsername: session.username || null,
            crmSubmitted: false  // Mark as not submitted since it failed
          });

          await telegramBot.sendMessage(chatId, `⚠️ *Qisman saqlandi*\n\nCRMga qo'shishda xatolik yuz berdi (validatsiya xatosi)\nMa'lumotlar bazaga saqlandi\nID: #${dbRecord.id}`, {
            parse_mode: 'Markdown',
            reply_markup: mainMenuKeyboard
          });

          delete userSessions[chatId];
          return;
        }

        // Upload photos to car status page
        console.log('Uploading photos to car status page...');
        await crmBot.uploadPhotosToCarStatus(
          {
            vin: session.data.vin,
            stateNumber: session.data.stateNumber,
            customerName: session.data.customerName,
            arrivalDateTime: crmData.arrivalDateTime
          },
          session.data.photoVin,
          session.data.photo45,
          session.data.photoProbeg,
          session.data.nameplatePhotos || []
        );

        const dbRecord = sqlDatabase.addRegistration({
          ...session.data,
          ...crmData,
          telegramUserId: chatId,
          telegramUsername: session.username || null,
          crmSubmitted: true
        });

        await telegramBot.sendMessage(chatId, `✅ *Saqlandi*\n\nCRMga muvaffaqiyatli qo'shildi\nRasmlar yuklandi\nID: #${dbRecord.id}`, {
          parse_mode: 'Markdown',
          reply_markup: mainMenuKeyboard
        });

        delete userSessions[chatId];
      },
      onError: async (error) => {
        console.error('Error adding service transfer:', error);
        await telegramBot.sendMessage(chatId, `❌ *Xatolik*\n\n${error.message}`, {
          parse_mode: 'Markdown',
          reply_markup: mainMenuKeyboard
        });
        delete userSessions[chatId];
      }
    });
  } else {
    // Less than 3 photos
    await telegramBot.sendMessage(chatId, `❌ Kamida 3 ta rasm kerak (45 gradus, Probeg, VIN). Siz ${photoCount} ta yubordi.`);
  }
}

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  if (crmBot) {
    await crmBot.close();
  }
  process.exit(0);
});

console.log('🤖 Telegram bot started!');
console.log('Waiting for messages...');

// Initialize CRM bot on startup
(async () => {
  try {
    console.log('\n⏳ Logging into CRM...');
    await initCRMBot();
    console.log('✅ CRM login successful! Bot is ready.\n');
  } catch (error) {
    console.error('❌ Failed to login to CRM on startup:', error.message);
    console.error('Bot will try to login when first command is received.\n');
  }
})();

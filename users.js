// Authorized users database with branch assignments
// Structure: { telegramId: { name, branch, role } }

module.exports = {
  // Admin users (can manage the bot and users)
  admins: [
    1882610013,
    1016166638  // Replace with actual admin Telegram ID
  ],

  // Authorized users with their branch assignments
  users: {
    // Example format:
    1882610013: { name: 'Saidabbos', branch: '2bekat' },
    1016166638: { name: 'Komilbek', branch: '2bekat' },
    // 987654321: { name: 'Jane Smith', branch: 'texnopark' },
    // 555555555: { name: 'Ali Karimov', branch: '5bekat' },
  }
};

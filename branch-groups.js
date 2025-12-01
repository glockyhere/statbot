// Branch-specific Telegram group chat IDs
// Structure: { branchId: groupChatId }

module.exports = {
  branchGroups: {
    // 2 Bekat Service branch group
    '2bekat': -5008214188, // Replace with actual group chat ID (e.g., -1001234567890)

    // Jetour Service (5 Bekat) branch group
    '5bekat': null, // Replace with actual group chat ID (e.g., -1001234567891)

    // Texnopark Service branch group
    'texnopark': null, // Replace with actual group chat ID (e.g., -1001234567892)
  },

  // Helper function to get group chat ID for a branch
  getGroupChatId(branchId) {
    return this.branchGroups[branchId] || null;
  },

  // Helper function to get branch name
  getBranchName(branchId) {
    const branchNames = {
      '2bekat': '2 Bekat Service',
      '5bekat': 'Jetour Service',
      'texnopark': 'Texnopark Service'
    };
    return branchNames[branchId] || branchId;
  }
};

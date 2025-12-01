require('dotenv').config();
const puppeteer = require('puppeteer');

class CRMBot {
  constructor() {
    this.browser = null;
    this.page = null;
    this.loginUrl = process.env.CRM_URL;
    this.username = process.env.CRM_LOGIN;
    this.password = process.env.CRM_PASSWORD;
    this.modalOpen = false; // Track modal state
    this.warmedUp = false; // Track warmup state
  }

  async init(headless = false) {
    console.log('Launching browser...');
    this.browser = await puppeteer.launch({
      headless: headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 800 });
  }

  async isLoggedIn() {
    try {
      // Check if we're on the login page or logged in
      const currentUrl = this.page.url();
      if (currentUrl.includes('/login')) {
        return false;
      }

      // Check for login form elements
      const loginForm = await this.page.$('input[type="tel"]');
      if (loginForm) {
        return false;
      }

      return true;
    } catch (error) {
      // If we get an error (like detached frame), assume we need to re-login
      console.log('Error checking login status, will re-login:', error.message);
      return false;
    }
  }

  async ensureLoggedIn() {
    console.log('Checking login status...');
    const loggedIn = await this.isLoggedIn();

    if (!loggedIn) {
      console.log('Not logged in. Logging in now...');
      await this.login();
    } else {
      console.log('Already logged in');
    }
  }

  async login() {
    console.log('Navigating to login page...');
    await this.page.goto(this.loginUrl, { waitUntil: 'networkidle2' });

    console.log('Filling login form...');

    // Wait for login form to be visible (phone input is type="tel")
    await this.page.waitForSelector('input[type="tel"]', { timeout: 10000 });

    // Find and fill the phone field
    const phoneInput = await this.page.$('input[type="tel"]');
    if (phoneInput) {
      await phoneInput.click({ clickCount: 3 }); // Select all
      await phoneInput.type(this.username);
      console.log('Phone number entered');
    }

    // Find and fill the password field
    const passwordInput = await this.page.$('input#password');
    if (passwordInput) {
      await passwordInput.type(this.password);
      console.log('Password entered');
    }

    // Find and click the submit button
    const submitButton = await this.page.$('button[type="submit"]');
    if (submitButton) {
      console.log('Clicking login button...');
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
          console.log('Navigation completed or timed out');
        }),
        submitButton.click()
      ]);
    }

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Login successful!');
    console.log('Current URL:', this.page.url());
  }

  async screenshot(filename = 'screenshot.png') {
    await this.page.screenshot({ path: filename, fullPage: true });
    console.log(`Screenshot saved: ${filename}`);
  }

  async warmup() {
    if (this.warmedUp) {
      console.log('Already warmed up');
      return;
    }

    console.log('Warming up CRM connection...');

    try {
      // Navigate to vincode-status page to cache it
      await this.page.goto('https://bestune.kahero.uz/vincode-status', { waitUntil: 'domcontentloaded' });
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for page to fully load

      console.log('✓ CRM warmed up and ready');
      this.warmedUp = true;
    } catch (error) {
      console.error('Warmup failed:', error.message);
      // Don't throw, just log - warmup is optional optimization
    }
  }

  async debugFormFields() {
    // Helper function to log all form fields for debugging
    const fields = await this.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      return inputs.map(el => ({
        tag: el.tagName,
        type: el.type,
        name: el.name,
        placeholder: el.placeholder,
        id: el.id,
        value: el.value
      }));
    });
    console.log('=== Form Fields Debug ===');
    fields.forEach((field, idx) => {
      console.log(`[${idx}] ${field.tag} - type:${field.type} name:${field.name} placeholder:${field.placeholder}`);
    });
    console.log('========================');
  }

  async waitForSelector(selector, timeout = 5000) {
    return await this.page.waitForSelector(selector, { timeout });
  }

  async clickElement(selector) {
    await this.page.waitForSelector(selector);
    await this.page.click(selector);
  }

  async typeText(selector, text) {
    await this.page.waitForSelector(selector);
    await this.page.type(selector, text);
  }

  async selectOption(selector, value) {
    await this.page.waitForSelector(selector);
    await this.page.select(selector, value);
  }

  async evaluate(fn) {
    return await this.page.evaluate(fn);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed');
    }
  }

  async navigateToSabablar() {
    console.log('Navigating to Sabablar (Service Reasons) page...');
    await this.ensureLoggedIn();

    // Navigate directly to the service-reason URL
    await this.page.goto('https://bestune.kahero.uz/service-reason', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Current URL:', this.page.url());
  }

  async addServiceReason(reasonText) {
    // Ensure we're logged in before proceeding
    await this.ensureLoggedIn();

    console.log(`Adding service reason: "${reasonText}"`);

    // Ensure we're on the service-reason page
    await this.navigateToSabablar();

    // Click the "Qo'shish" (Add) button
    const clicked = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const qoshishButton = buttons.find(btn =>
        btn.textContent?.trim() === 'Qo\'shish' ||
        btn.textContent?.toLowerCase().includes('qo\'shish')
      );
      if (qoshishButton) {
        qoshishButton.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      throw new Error('Could not find Qo\'shish (Add) button');
    }

    // Wait for modal to appear
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Fill the textarea using keyboard simulation (to trigger validation)
    const textareaSelector = 'textarea[placeholder="Sabab"]';
    await this.page.waitForSelector(textareaSelector, { timeout: 5000 });
    await this.page.click(textareaSelector);
    await this.page.type(textareaSelector, reasonText, { delay: 10 });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Click the "Saqlash" (Save) button
    const saved = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const saveButton = buttons.find(btn => {
        const text = btn.textContent?.trim() || '';
        return text === 'Saqlash' || text === 'Save';
      });
      if (saveButton) {
        saveButton.click();
        return true;
      }
      return false;
    });

    if (!saved) {
      throw new Error('Could not find Saqlash (Save) button');
    }

    // Wait for save to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('✓ Service reason added successfully');
    return true;
  }

  async searchVIN(vinQuery, keepModalOpen = false) {
    // Ensure we're logged in before proceeding
    await this.ensureLoggedIn();

    console.log(`Searching for VINs with query: ${vinQuery}`);

    // Close modal if it's open but we're starting a fresh search
    if (this.modalOpen && !keepModalOpen) {
      console.log('Closing previous modal...');
      await this.closeModal();
      this.modalOpen = false;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Only navigate and open modal if not already open
    if (!keepModalOpen || !this.modalOpen) {
      const currentUrl = this.page.url();

      // Only navigate if we're not already on the page
      if (!currentUrl.includes('vincode-status')) {
        console.log('Navigating to vincode-status page...');
        // OPTIMIZATION: Use 'domcontentloaded' instead of 'networkidle2' (much faster)
        await this.page.goto('https://bestune.kahero.uz/vincode-status', { waitUntil: 'domcontentloaded' });
        await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for page to fully load
      } else {
        // Already on page - if warmed up, minimal wait; otherwise full wait
        const waitTime = this.warmedUp ? 300 : 500;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Click Qo'shish button to open form - retry up to 3 times
      let clicked = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        clicked = await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const qoshishButton = buttons.find(btn => btn.textContent?.trim() === 'Qo\'shish');
          if (qoshishButton) {
            qoshishButton.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          console.log('✓ Found and clicked Qo\'shish button');
          break;
        }

        console.log(`Attempt ${attempt + 1}: Qo'shish button not found, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!clicked) {
        throw new Error('Qo\'shish tugmasi topilmadi. Sahifani yangilang');
      }

      // Wait for VIN input to appear instead of fixed timeout
      await this.page.waitForSelector('input[id*=":r"]', { timeout: 5000 });
      await new Promise(resolve => setTimeout(resolve, 300)); // Reduced from 2000ms
      this.modalOpen = true; // Mark modal as open
    } else {
      // Modal is already open, just clear the VIN input
      const vinInputSelector = 'input[id*=":r"]';
      const vinInputs = await this.page.$$(vinInputSelector);
      if (vinInputs.length > 0) {
        await vinInputs[0].click({ clickCount: 3 }); // Select all
        await this.page.keyboard.press('Backspace'); // Clear
        await new Promise(resolve => setTimeout(resolve, 200)); // Reduced from 300ms
      }
    }

    // Find the VIN autocomplete input and type the last 5 characters
    const vinInputSelector = 'input[id*=":r"]'; // MUI autocomplete generates IDs like :r2:
    await this.page.waitForSelector(vinInputSelector, { timeout: 5000 });

    // OPTIMIZATION: Type faster with 30ms delay instead of 50ms
    const vinInputs = await this.page.$$(vinInputSelector);
    if (vinInputs.length > 0) {
      await vinInputs[0].click();
      await vinInputs[0].type(vinQuery, { delay: 30 });
    }

    // Wait for autocomplete dropdown to appear - retry approach for reliability
    await new Promise(resolve => setTimeout(resolve, 800));

    // Extract VIN options from dropdown - try multiple times in case dropdown is slow
    let vinOptions = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      vinOptions = await this.page.evaluate(() => {
        const options = Array.from(document.querySelectorAll('.MuiAutocomplete-option, [role="option"]'));
        return options.map(opt => opt.textContent?.trim()).filter(Boolean);
      });

      if (vinOptions.length > 0) {
        break; // Found options, stop trying
      }

      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (vinOptions.length === 0) {
      console.log('No VIN options found after 3 attempts');
    }

    console.log(`Found ${vinOptions.length} matching VINs`);
    return vinOptions;
  }

  // NEW METHOD: Select a VIN and extract its vehicle info
  async selectVINAndExtractInfo(vin) {
    console.log(`Selecting VIN and extracting info: ${vin}`);

    // Click the VIN option from the dropdown
    const clicked = await this.page.evaluate((targetVin) => {
      const options = Array.from(document.querySelectorAll('.MuiAutocomplete-option, [role="option"]'));
      const matchingOption = options.find(opt => opt.textContent?.trim() === targetVin);
      if (matchingOption) {
        matchingOption.click();
        return true;
      }
      return false;
    }, vin);

    if (!clicked) {
      console.log(`Could not find VIN option for: ${vin}`);
      return { vin };
    }

    // Wait for form to populate with vehicle info
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Extract vehicle info
    const vehicleInfo = await this.extractVehicleInfo();

    console.log(`✓ Extracted vehicle info for ${vin}:`, vehicleInfo);

    return {
      vin: vin,
      ...vehicleInfo
    };
  }

  async closeModal() {
    // Close the modal by clicking outside or finding close button
    const closed = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const closeButton = buttons.find(btn =>
        btn.textContent?.trim() === 'Bekor qilish' ||
        btn.textContent?.trim() === 'Cancel' ||
        btn.querySelector('svg') // Close icon
      );
      if (closeButton) {
        closeButton.click();
        return true;
      }
      return false;
    });

    if (closed) {
      await new Promise(resolve => setTimeout(resolve, 500));
      this.modalOpen = false;
    }
  }

  async addServiceTransfer(data, modalAlreadyOpen = false) {
    // Ensure we're logged in before proceeding
    await this.ensureLoggedIn();

    console.log('Adding service transfer entry...');

    // Only navigate and open modal if not already open
    if (!modalAlreadyOpen) {
      // Close any open modals before navigating
      console.log('Closing any open modals before navigation...');
      await this.page.keyboard.press('Escape');
      await new Promise(resolve => setTimeout(resolve, 300));
      await this.page.keyboard.press('Escape');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Wait for modals to actually close
      await this.page.waitForFunction(() => {
        const modals = document.querySelectorAll('[role="dialog"], .modal, .MuiDialog-root, [class*="Modal"]');
        return modals.length === 0;
      }, { timeout: 5000 }).catch(() => {
        console.log('⚠️  Timeout waiting for modals to close, proceeding anyway...');
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const currentUrl = this.page.url();

      // Only navigate if we're not already on the page
      if (!currentUrl.includes('vincode-status')) {
        console.log('Navigating to vincode-status page...');
        // OPTIMIZATION: Use 'domcontentloaded' instead of 'networkidle2'
        await this.page.goto('https://bestune.kahero.uz/vincode-status', { waitUntil: 'domcontentloaded' });
        await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for page to fully load
      } else {
        // Already on page, just wait a bit to ensure elements are ready
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Click Qo'shish button - retry up to 3 times
      let clicked = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        clicked = await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const qoshishButton = buttons.find(btn => btn.textContent?.trim() === 'Qo\'shish');
          if (qoshishButton) {
            qoshishButton.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          console.log('✓ Found and clicked Qo\'shish button');
          break;
        }

        console.log(`Attempt ${attempt + 1}: Qo'shish button not found, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!clicked) {
        throw new Error('Qo\'shish tugmasi topilmadi. Sahifani yangilang');
      }

      // Wait for form to appear
      await this.page.waitForSelector('input[id*=":r"]', { timeout: 5000 });
      await new Promise(resolve => setTimeout(resolve, 300)); // Reduced from 2000ms
    }

    // Select VIN if provided
    if (data.vin && !modalAlreadyOpen) {
      // ONLY type VIN if modal was NOT already open (i.e., fresh start)
      // If modalAlreadyOpen=true, VIN was already typed in searchVIN()
      const vinInputSelector = 'input[id*=":r"]';
      const vinInputs = await this.page.$$(vinInputSelector);
      if (vinInputs.length > 0) {
        await vinInputs[0].click();
        await vinInputs[0].type(data.vin, { delay: 30 }); // Reduced from 100ms

        // Wait for dropdown and click the matching option
        await this.page.waitForSelector('.MuiAutocomplete-option, [role="option"]', { timeout: 3000 });
        await new Promise(resolve => setTimeout(resolve, 200)); // Reduced from 1500ms

        const selected = await this.page.evaluate((targetVin) => {
          const options = Array.from(document.querySelectorAll('.MuiAutocomplete-option, [role="option"]'));
          const matchingOption = options.find(opt => opt.textContent?.trim() === targetVin);
          if (matchingOption) {
            matchingOption.click();
            return true;
          }
          return false;
        }, data.vin);

        if (selected) {
          console.log(`✓ Selected VIN: ${data.vin}`);
          await new Promise(resolve => setTimeout(resolve, 300)); // Reduced from 1000ms
        }
      }
    } else if (data.vin && modalAlreadyOpen) {
      // CRITICAL OPTIMIZATION: VIN was already typed in searchVIN(), just click the option!
      console.log(`✓ Reusing VIN from search: ${data.vin}`);

      // Wait a tiny bit for dropdown to be ready
      await new Promise(resolve => setTimeout(resolve, 200));

      const selected = await this.page.evaluate((targetVin) => {
        const options = Array.from(document.querySelectorAll('.MuiAutocomplete-option, [role="option"]'));
        const matchingOption = options.find(opt => opt.textContent?.trim() === targetVin);
        if (matchingOption) {
          matchingOption.click();
          return true;
        }
        return false;
      }, data.vin);

      if (selected) {
        console.log(`✓ Selected VIN: ${data.vin}`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Fill Sabab (Reason) field - select the recently created one
    if (data.reason) {
      // Find the second autocomplete input (first is VIN, second is Sabab)
      const allAutocompleteInputs = await this.page.$$('input[id*=":r"]');
      if (allAutocompleteInputs.length >= 2) {
        const sababInput = allAutocompleteInputs[1];

        // Click the field to open dropdown
        await sababInput.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        // Clear any existing value first
        await sababInput.click({ clickCount: 3 });
        await this.page.keyboard.press('Backspace');
        await new Promise(resolve => setTimeout(resolve, 300));

        // Type the exact reason text to find it in dropdown
        await sababInput.type(data.reason, { delay: 50 });

        // Wait longer for autocomplete dropdown to populate (recently added items might take time)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Try multiple times to find and click the option
        let reasonSelected = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          console.log(`Attempt ${attempt} to select Sabab option...`);

          reasonSelected = await this.page.evaluate(() => {
            const options = Array.from(document.querySelectorAll('.MuiAutocomplete-option, [role="option"]'));
            console.log(`Found ${options.length} reason options in dropdown`);

            if (options.length > 0) {
              const firstOption = options[0];
              console.log(`Clicking first reason option: "${firstOption.textContent?.trim()}"`);
              firstOption.click();
              return true;
            }
            return false;
          });

          if (reasonSelected) {
            console.log(`✓ Selected first Sabab option from dropdown`);
            await new Promise(resolve => setTimeout(resolve, 500));
            break;
          }

          // If no options found, wait a bit longer and try again
          if (attempt < 3) {
            console.log(`No options found, waiting 1 second before retry...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Re-click the field to refresh dropdown
            await sababInput.click();
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        if (!reasonSelected) {
          console.log(`❌ Failed to select Sabab after 3 attempts!`);
          throw new Error(`Sabab dropdown did not populate after adding reason: "${data.reason}". This will cause validation error.`);
        }
      }
    }

    // Skip "Kafolat" checkbox field (leave as is)
    // Skip "Holati" field (leave as is)
    // Note: These fields come after Sabab but we intentionally skip them per requirements

    // Fill specialist field (Servis xodimi) - use serviceSpecialist if provided
    const specialistToUse = data.serviceSpecialist || data.specialist;
    if (specialistToUse) {
      console.log(`Attempting to fill Servis xodimi with: "${specialistToUse}"`);

      // Wait a bit to ensure previous fields are settled
      await new Promise(resolve => setTimeout(resolve, 500));

      // Find all autocomplete inputs
      const allAutocompleteInputs = await this.page.$$('input[id*=":r"]');

      // Servis xodimi is index 2: VIN(0), Sabab(1), Servis xodimi(2)
      if (allAutocompleteInputs.length > 2) {
        const specialistInput = allAutocompleteInputs[2];

        // CLICK the field to open dropdown (don't type!)
        await specialistInput.click();
        console.log('Clicked Servis xodimi field');

        // Wait for dropdown options to be fully rendered in DOM
        await new Promise(resolve => setTimeout(resolve, 1200));

        // Explicitly wait for dropdown options to appear
        try {
          await this.page.waitForSelector('.MuiAutocomplete-option, [role="option"]', { timeout: 3000 });
          console.log('Dropdown options are now visible in DOM');
        } catch (err) {
          console.log('Warning: Timeout waiting for dropdown options, attempting anyway...');
        }

        // Wait another moment for full render
        await new Promise(resolve => setTimeout(resolve, 300));

        // Select the matching specialist from dropdown
        const selected = await this.page.evaluate((targetSpecialist) => {
          const options = Array.from(document.querySelectorAll('.MuiAutocomplete-option, [role="option"]'));

          // Find the matching option (case-insensitive)
          const matchingOption = options.find(opt => {
            const optText = opt.textContent?.trim().toLowerCase() || '';
            const targetText = targetSpecialist.toLowerCase();
            return optText === targetText || optText.includes(targetText);
          });

          if (matchingOption) {
            matchingOption.click();
            return { success: true, found: matchingOption.textContent?.trim(), total: options.length };
          }

          return { success: false, total: options.length, options: options.slice(0, 5).map(o => o.textContent?.trim()) };
        }, specialistToUse);

        if (selected.success) {
          console.log(`✓ Selected Servis xodimi: "${selected.found}" (matched from ${selected.total} options)`);
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.log(`❌ Could not find specialist "${specialistToUse}" in dropdown!`);
          console.log(`Found ${selected.total} options:`, selected.options);
          // await this.screenshot('specialist-not-found.png');
        }
      } else {
        console.log(`❌ Could not find Servis xodimi input field (need at least 3 autocomplete fields)!`);
      }
    }

    // Fill Probeg (odometer/mileage)
    if (data.odometer) {
      await this.page.click('input[name="odometer"]');
      await this.page.type('input[name="odometer"]', data.odometer.toString(), { delay: 20 });
      console.log(`✓ Filled Probeg: ${data.odometer} km`);
    }

    // Fill Davlat raqami (state number)
    if (data.stateNumber) {
      await this.page.click('input[name="stateNumber"]');
      await this.page.type('input[name="stateNumber"]', data.stateNumber, { delay: 20 });
      console.log(`✓ Filled Davlat raqami: ${data.stateNumber}`);
    }

    // Fill Mijoz ismi (customer name)
    if (data.customerName) {
      await this.page.click('input[name="customerName"]');
      await this.page.type('input[name="customerName"]', data.customerName, { delay: 20 });
      console.log(`✓ Filled Mijoz ismi: ${data.customerName}`);
    }

    // Fill Kelgan kuni (arrival date/time) in format: dd-mm-yyyy | hh:mm
    if (data.arrivalDateTime) {
      const date = new Date(data.arrivalDateTime);

      // Format: dd-mm-yyyy | hh:mm
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      const formattedDateTime = `${day}-${month}-${year} | ${hours}:${minutes}`;

      // Find all tel inputs and select the one with date pattern in placeholder
      const allTelInputs = await this.page.$$('input[type="tel"]');

      let dateField = null;
      for (const input of allTelInputs) {
        const placeholder = await input.evaluate(el => el.placeholder);
        // Match pattern like "29-11-2025 | 12:22"
        if (placeholder && placeholder.match(/\d{2}-\d{2}-\d{4}\s*\|\s*\d{2}:\d{2}/)) {
          dateField = input;
          break;
        }
      }

      if (dateField) {
        // Clear the field first
        await dateField.click();
        await dateField.evaluate(el => el.value = '');

        // Type the date in the masked input format: ddmmyyyyArrowRightArrowRighthhmm
        // NO spaces, dashes, or separators - just type digits and arrow keys
        const dateDigits = `${day}${month}${year}`;
        const timeDigits = `${hours}${minutes}`;

        await dateField.type(dateDigits, { delay: 30 });
        await this.page.keyboard.press('ArrowRight');
        await this.page.keyboard.press('ArrowRight');
        await dateField.type(timeDigits, { delay: 30 });

        // Trigger change and blur events to ensure the value is registered
        await dateField.evaluate(() => {
          const el = document.activeElement;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
        });

        console.log(`✓ Filled Kelgan kuni: ${formattedDateTime} (typed as ${dateDigits}→→${timeDigits})`);
      } else {
        console.log('⚠ Could not find Kelgan kuni field');
      }
    }

    // Fill Mijoz telefon raqami (customer phone)
    if (data.customerPhone) {
      const phoneInput = 'input[placeholder="+998-__-__-_"]';
      await this.page.click(phoneInput);
      // Clear default +998 - use Ctrl+A to select all then type (faster)
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('A');
      await this.page.keyboard.up('Control');
      await this.page.type(phoneInput, data.customerPhone, { delay: 20 });
      console.log(`✓ Filled Mijoz telefon raqami: ${data.customerPhone}`);
    }

    // Wait a bit before saving to ensure all fields are filled
    await new Promise(resolve => setTimeout(resolve, 500));

    // Take screenshot before saving for verification
    // await this.screenshot('before-save.png');
    // console.log('Screenshot saved: before-save.png');

    // Click Save
    const saved = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const saveButton = buttons.find(btn => btn.textContent?.trim() === 'Saqlash');
      if (saveButton) {
        console.log('Found Saqlash button, clicking...');
        saveButton.click();
        return true;
      }
      console.log('Saqlash button not found!');
      return false;
    });

    if (!saved) {
      // await this.screenshot('saqlash-not-found.png');
      throw new Error('Could not find Saqlash button');
    }

    console.log('Saqlash button clicked, waiting for save...');

    // Wait for save to complete - look for success indication or modal to close
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot after saving
    // await this.screenshot('after-save.png');
    // console.log('Screenshot saved: after-save.png');

    // Check if there are any error messages
    const errorMessage = await this.page.evaluate(() => {
      const errors = Array.from(document.querySelectorAll('.MuiAlert-message, .error, [class*="error"]'));
      return errors.map(el => el.textContent).join(', ');
    });

    if (errorMessage) {
      console.log(`⚠️  Error messages found: ${errorMessage}`);

      // Check if it's a validation error (not just field markers like *)
      if (errorMessage.toLowerCase().includes('validation') || errorMessage.toLowerCase().includes('error')) {
        console.log('❌ Service transfer failed due to validation error');
        this.modalOpen = false;
        return false;
      }
    }

    // Mark modal as closed after successful save
    this.modalOpen = false;

    console.log('✓ Service transfer entry added successfully');
    return true;
  }

  // Extract vehicle info from the form after VIN selection
  async extractVehicleInfo() {
    console.log('Extracting vehicle info from form...');

    await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for form to populate

    // Take screenshot for debugging
    // await this.screenshot('vehicle-info-extraction.png');

    const result = await this.page.evaluate(() => {
      const info = {};

      // Since clicking a VIN populates form fields, extract from text displayed next to labels
      // Look for text elements containing our labels and get adjacent values

      const findDisplayedValue = (labelText) => {
        // Find all elements
        const allElements = Array.from(document.querySelectorAll('*'));

        for (const el of allElements) {
          const text = el.textContent || '';

          // Check if this element contains the label
          if (text.includes(labelText + ':')) {
            // Try to extract the value after the colon
            const match = text.match(new RegExp(labelText + ':\\s*(.+?)(?:\\s*(?:Vin:|Mashina:|Rangi:|Ombor:|Garantiya:|Qarzdorlik:|Sabab)|$)', 'i'));
            if (match && match[1]) {
              return match[1].trim();
            }
          }

          // Alternative: Check if element text exactly matches label
          const trimmed = text.trim();
          if (trimmed === labelText || trimmed === labelText + ':') {
            // Look for next sibling with value
            let next = el.nextElementSibling;
            if (next && next.textContent) {
              const val = next.textContent.trim();
              if (val && !val.includes(':')) {
                return val;
              }
            }

            // Look in parent's next child
            const parent = el.parentElement;
            if (parent) {
              const children = Array.from(parent.children);
              const idx = children.indexOf(el);
              if (idx >= 0 && idx < children.length - 1) {
                const val = children[idx + 1].textContent?.trim();
                if (val && !val.includes(':')) {
                  return val;
                }
              }
            }
          }
        }
        return null;
      };

      info.mashina = findDisplayedValue('Mashina');
      info.rangi = findDisplayedValue('Rangi');
      info.ombor = findDisplayedValue('Ombor');
      info.garantiya = findDisplayedValue('Garantiya');
      info.qarzdorlik = findDisplayedValue('Qarzdorlik');

      return info;
    });

    console.log('Extracted vehicle info:', result);
    return result;
  }

  async uploadPhotosToCarStatus(submissionData, photoVinPath, photo45Path, photoProbegPath, nameplatePhotos = []) {
    // Ensure we're logged in before proceeding
    await this.ensureLoggedIn();

    console.log(`Uploading photos for submission - VIN: ${submissionData.vin}, Plate: ${submissionData.stateNumber}`);

    try {
      // AGGRESSIVELY close any open modals/dialogs
      console.log('Forcefully closing any open modals...');

      // Try pressing Escape multiple times
      for (let i = 0; i < 3; i++) {
        await this.page.keyboard.press('Escape');
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Force-remove any modal elements from the DOM
      await this.page.evaluate(() => {
        const modals = document.querySelectorAll('[role="dialog"], .modal, .MuiDialog-root, [class*="Modal"], [class*="Dialog"]');
        modals.forEach(modal => modal.remove());

        // Also remove backdrops
        const backdrops = document.querySelectorAll('.MuiBackdrop-root, [class*="Backdrop"]');
        backdrops.forEach(backdrop => backdrop.remove());

        // Remove any overlay elements
        const overlays = document.querySelectorAll('[class*="overlay"]');
        overlays.forEach(overlay => overlay.remove());
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Navigate to car status page
      const carStatusUrl = 'https://bestune.kahero.uz/car-status-stats';
      console.log(`Navigating to: ${carStatusUrl}`);
      await this.page.goto(carStatusUrl, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      // await this.screenshot('car-status-page.png');

      // Search for the exact submission by matching multiple criteria
      console.log(`Searching for submission - VIN: ${submissionData.vin}, Plate: ${submissionData.stateNumber}, Customer: ${submissionData.customerName}`);

      const carFound = await this.page.evaluate((data) => {
        const rows = Array.from(document.querySelectorAll('tr, [role="row"]'));
        const matchingRows = [];

        // Find all rows that match the VIN
        for (const row of rows) {
          const rowText = row.textContent;
          if (rowText.includes(data.vin)) {
            matchingRows.push(row);
          }
        }

        console.log(`Found ${matchingRows.length} rows with VIN ${data.vin}`);

        if (matchingRows.length === 0) {
          return false;
        }

        // If multiple matches, try to find the most specific match
        let bestMatch = null;
        let highestScore = 0;

        for (const row of matchingRows) {
          const rowText = row.textContent;
          let score = 1; // Base score for VIN match

          // Additional points for matching state number
          if (data.stateNumber && rowText.includes(data.stateNumber)) {
            score += 3;
          }

          // Additional points for matching customer name
          if (data.customerName && rowText.includes(data.customerName)) {
            score += 2;
          }

          if (score > highestScore) {
            highestScore = score;
            bestMatch = row;
          }
        }

        // If we still have multiple matches with same score, pick the first one (most recent)
        const targetRow = bestMatch || matchingRows[0];

        console.log(`Selected row with match score: ${highestScore}`);

        // Try to find and click the row or an action button
        const buttons = targetRow.querySelectorAll('button, [role="button"], a');
        for (const btn of buttons) {
          const btnText = btn.textContent.toLowerCase();
          if (btnText.includes('edit') || btnText.includes('details') || btn.querySelector('svg')) {
            btn.click();
            return true;
          }
        }

        // If no specific button, try clicking the row itself
        targetRow.click();
        return true;
      }, submissionData);

      if (!carFound) {
        console.log(`Could not find submission with VIN: ${submissionData.vin}`);
        return false;
      }

      console.log('Car found, waiting for details/edit form to load...');

      // Wait for file inputs to appear (form loads dynamically)
      await this.page.waitForSelector('input[type="file"]', { timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      // await this.screenshot('car-details-form.png');

      // Upload VIN photo
      if (photoVinPath) {
        console.log('Uploading VIN photo...');
        const vinUploaded = await this.uploadPhotoToField('vin', photoVinPath);
        if (vinUploaded) {
          console.log('✓ VIN photo uploaded');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Upload 45-degree photo
      if (photo45Path) {
        console.log('Uploading 45-degree photo...');
        const photo45Uploaded = await this.uploadPhotoToField('45', photo45Path);
        if (photo45Uploaded) {
          console.log('✓ 45-degree photo uploaded');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Upload Probeg photo
      if (photoProbegPath) {
        console.log('Uploading Probeg photo...');
        const probegUploaded = await this.uploadPhotoToField('probeg', photoProbegPath);
        if (probegUploaded) {
          console.log('✓ Probeg photo uploaded');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Upload Nameplate photos (if any)
      if (nameplatePhotos && nameplatePhotos.length > 0) {
        console.log(`Uploading ${nameplatePhotos.length} nameplate photo(s)...`);
        for (let i = 0; i < nameplatePhotos.length; i++) {
          const nameplatePath = nameplatePhotos[i];
          if (nameplatePath) {
            console.log(`Uploading nameplate photo ${i + 1}/${nameplatePhotos.length}...`);
            const nameplateUploaded = await this.uploadPhotoToField('nameplate', nameplatePath);
            if (nameplateUploaded) {
              console.log(`✓ Nameplate photo ${i + 1} uploaded`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
      }

      // Save/submit the form
      console.log('Saving photo uploads...');

      // Click the Saqlash button using Puppeteer's click instead of evaluate
      const saqlashButton = await this.page.evaluateHandle(() => {
        const saveButtons = Array.from(document.querySelectorAll('button'));
        return saveButtons.find(btn => {
          const text = btn.textContent.toLowerCase();
          return text.includes('save') || text.includes('saqlash') || text.includes('submit');
        });
      });

      if (saqlashButton && saqlashButton.asElement()) {
        await saqlashButton.asElement().click();
        console.log('✓ Clicked Saqlash button');

        // Wait for the success notification or URL change
        try {
          await Promise.race([
            // Wait for success message
            this.page.waitForFunction(() => {
              return document.body.textContent.includes('Success') ||
                     document.body.textContent.includes('successfully') ||
                     document.body.textContent.includes('muvaffaqiyatli');
            }, { timeout: 5000 }),
            // Or wait for modal to close
            this.page.waitForFunction(() => {
              const modals = document.querySelectorAll('[role="dialog"], .modal, .MuiDialog-root');
              return modals.length === 0;
            }, { timeout: 5000 })
          ]);
          console.log('✓ Photos saved successfully');
        } catch (waitError) {
          console.log('⚠️  Save button clicked but could not confirm success');
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
        // await this.screenshot('photos-saved.png');
      } else {
        console.log('❌ Could not find Saqlash button');
      }

      // Navigate back to car-status-stats page and click "Ha" button for THIS specific car
      console.log('Navigating back to car-status-stats page...');
      await this.page.goto('https://bestune.kahero.uz/car-status-stats', { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Click the "Ha" button for the specific VIN we just uploaded photos for
      console.log(`Looking for Ha button for VIN: ${submissionData.vin}`);
      const haClicked = await this.page.evaluate((vin) => {
        // Find all buttons on the page
        const allButtons = Array.from(document.querySelectorAll('button'));

        // Look for "Ha" buttons
        const haButtons = allButtons.filter(btn => {
          const text = btn.textContent?.trim() || '';
          return text === 'Ha' || text === 'ha';
        });

        console.log(`Found ${haButtons.length} Ha buttons on page`);

        // For each Ha button, check if it's in a row containing our VIN
        for (const haButton of haButtons) {
          // Find the closest table row
          const row = haButton.closest('tr, [class*="MuiTableRow"], [class*="row"]');

          if (row && row.textContent.includes(vin)) {
            console.log(`✓ Found Ha button for VIN ${vin}`);
            haButton.click();
            return true;
          }
        }

        console.log(`⚠️ Could not find Ha button for VIN ${vin}, clicking first Ha button as fallback`);
        // Fallback: click first Ha button if VIN-specific one not found
        if (haButtons.length > 0) {
          haButtons[0].click();
          return true;
        }

        return false;
      }, submissionData.vin);

      if (haClicked) {
        console.log('✓ Clicked "Ha" button');

        // Wait for modal/drawer to appear
        try {
          await this.page.waitForSelector('.MuiModal-root', { timeout: 5000 });
          console.log('✓ Modal appeared');
        } catch (e) {
          console.log('⚠️ Modal did not appear after clicking Ha');
          return true; // Continue anyway, might not be critical
        }

        // Wait for modal to be fully rendered and look for the Autocomplete with placeholder "Servisni tanlang"
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Looking for "Servisni tanlang" autocomplete...');

        // Find and click the Autocomplete popup button for the input with placeholder "Servisni tanlang"
        let dropdownOpened = false;

        try {
          const autocompleteClicked = await this.page.evaluate(() => {
            // Find the input with placeholder "Servisni tanlang"
            const inputs = Array.from(document.querySelectorAll('input[placeholder="Servisni tanlang"]'));

            if (inputs.length === 0) return false;

            // Find the autocomplete container
            const input = inputs[0];
            const autocompleteContainer = input.closest('.MuiAutocomplete-root');

            if (!autocompleteContainer) return false;

            // Find the popup indicator button
            const popupButton = autocompleteContainer.querySelector('button.MuiAutocomplete-popupIndicator');

            if (popupButton) {
              popupButton.click();
              return true;
            }
            return false;
          });

          if (autocompleteClicked) {
            console.log('✓ Clicked "Servisni tanlang" autocomplete button');
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check if menu appeared
            const menuVisible = await this.page.$('[role="listbox"], .MuiAutocomplete-listbox');
            if (menuVisible) {
              dropdownOpened = true;
              console.log('✓ Dropdown menu appeared');
            }
          } else {
            console.log('⚠️ Could not find "Servisni tanlang" autocomplete');
          }
        } catch (e) {
          console.log('Error clicking dropdown:', e.message);
        }

        if (dropdownOpened) {
          // Select the first option from the dropdown (first service in the list)
          const optionSelected = await this.page.evaluate(() => {
            const options = Array.from(document.querySelectorAll('[role="option"], .MuiMenuItem-root'));
            if (options.length > 0) {
              console.log(`Found ${options.length} options, clicking first one: "${options[0].textContent?.trim()}"`);
              options[0].click();
              return true;
            }
            return false;
          });

          if (optionSelected) {
            console.log('✓ Selected option from dropdown');
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.log('⚠️ Dropdown opened but no options found');
          }
        } else {
          console.log('⚠️ Could not open dropdown - skipping service selection');
        }

        // Wait a bit before clicking Saqlash
        await new Promise(resolve => setTimeout(resolve, 500));

        // Click Saqlash button - find the one that's inside the modal and visible
        const saqlashClicked = await this.page.evaluate(() => {
          const allButtons = Array.from(document.querySelectorAll('button'));
          const saqlashBtns = allButtons.filter(btn => btn.textContent?.trim() === 'Saqlash');

          // Find the visible one inside the modal
          const modalSaqlash = saqlashBtns.find(btn => {
            const modal = btn.closest('.MuiModal-root, [role="dialog"]');
            if (!modal) return false;

            // Check if button is visible
            const style = window.getComputedStyle(btn);
            const rect = btn.getBoundingClientRect();
            const isVisible = style.display !== 'none' &&
                             style.visibility !== 'hidden' &&
                             parseFloat(style.opacity) > 0 &&
                             rect.width > 0 && rect.height > 0;

            return isVisible;
          });

          if (modalSaqlash) {
            modalSaqlash.click();
            return true;
          }
          return false;
        });

        if (saqlashClicked) {
          console.log('✓ Clicked Saqlash button in modal');
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.log('⚠️ Could not find Saqlash button in modal');
        }
      } else {
        console.log('⚠️ Could not find "Ha" button');
      }

      return true;
    } catch (error) {
      console.error('Error uploading photos to car status:', error);
      // await this.screenshot('photo-upload-error.png');
      return false;
    }
  }

  async uploadPhotoToField(fieldType, photoPath) {
    try {
      // Map field types to their specific input IDs in the CRM
      const fieldIdMap = {
        'vin': 'vinImgUrl',
        '45': 'carImgUrl',  // 45-degree car photo
        'probeg': 'odometerImgUrl',  // Odometer/mileage photo
        'nameplate': 'nameplateImgUrl'  // Nameplate photo
      };

      const inputId = fieldIdMap[fieldType];
      if (!inputId) {
        console.log(`Unknown field type: ${fieldType}`);
        return false;
      }

      // Debug: Check what file inputs exist on the page
      const pageInfo = await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
        return {
          url: window.location.href,
          inputs: inputs.map(input => ({
            id: input.id,
            name: input.name,
            visible: input.offsetParent !== null
          }))
        };
      });
      console.log(`  Page: ${pageInfo.url}`);
      console.log(`  File inputs found:`, pageInfo.inputs);

      // Find the file input by ID
      const fileInput = await this.page.$(`input[type="file"]#${inputId}`);

      if (!fileInput) {
        console.log(`  ❌ Could not find file input with ID: ${inputId}`);
        return false;
      }

      console.log(`  ✓ Found file input#${inputId}`);

      // Upload the file directly to the input (uploadFile automatically triggers events)
      await fileInput.uploadFile(photoPath);
      console.log(`  File uploaded to input#${inputId}: ${photoPath}`);

      // Wait for the upload to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      return true;
    } catch (error) {
      console.error(`Error uploading ${fieldType} photo:`, error);
      return false;
    }
  }
}

// Example usage
async function main() {
  const bot = new CRMBot();

  try {
    // Initialize with headless=false to see what's happening
    await bot.init(false);

    // Login to CRM
    await bot.login();

    // Take a screenshot after login
    // await bot.screenshot('after-login.png');

    // Wait a bit to see the result
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Add your data input automation here
    // Example:
    // await bot.clickElement('#add-record-button');
    // await bot.typeText('#name-field', 'Test Name');
    // await bot.typeText('#phone-field', '+998901234567');
    // await bot.clickElement('#save-button');

    console.log('Bot tasks completed!');

  } catch (error) {
    console.error('Error:', error.message);
    // await bot.screenshot('error-screenshot.png');
  } finally {
    // Keep browser open for inspection (remove this in production)
    console.log('Browser staying open for inspection. Press Ctrl+C to close.');
    // await bot.close();
  }
}

// Run the bot
if (require.main === module) {
  main();
}

module.exports = CRMBot;

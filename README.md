# Auto Center Service - CRM Bot

Telegram bot orqali Bestune CRM tizimiga avtomatik ma'lumot kiritish.

**Made by [@responsophobia](https://t.me/responsophobia)**

## Xususiyatlar

- **Foydalanuvchi autentifikatsiyasi**: Faqat ruxsat etilgan foydalanuvchilar botdan foydalanishi mumkin
- **Filial tizimi**: Har bir foydalanuvchi o'z filialiga biriktirilgan
- **Avtomatik filial filtrlash**: Servis xodimlari foydalanuvchining fililiga qarab avtomatik ko'rsatiladi
- Telegram bot orqali CRMga ma'lumot qo'shish
- Avtomatik login va sessiya boshqaruvi
- Servis sabablari (Sabablar) qo'shish
- Xatolarni qayta ishlash

## O'rnatish

### 1. Dependencylarni o'rnatish

```bash
npm install
```

### 2. Telegram Bot yaratish

1. Telegram'da [@BotFather](https://t.me/botfather)ga yozing
2. `/newbot` buyrug'ini yuboring
3. Bot nomini kiriting (masalan: "Bestune CRM Bot")
4. Bot username kiriting (masalan: `bestune_crm_bot`)
5. BotFather sizga tokenni beradi (masalan: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 3. .env faylni sozlash

`.env` faylini oching va quyidagi ma'lumotlarni to'ldiring:

```env
CRM_LOGIN=+998887050998
CRM_PASSWORD=7050998
CRM_URL=https://bestune.kahero.uz/login

# Telegram Bot Token (BotFatherdan olgan tokeningiz)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 4. Foydalanuvchilarni sozlash

`users.js` faylida foydalanuvchilar va ularning filiallarini sozlang:

```javascript
module.exports = {
  // Admin foydalanuvchilar (Telegram ID)
  admins: [
    123456789  // Admin Telegram ID'sini kiriting
  ],

  // Ruxsat etilgan foydalanuvchilar va ularning filiallari
  users: {
    987654321: { name: 'Ali Karimov', branch: '2bekat' },
    555555555: { name: 'Sardor Ahmedov', branch: 'texnopark' },
    777777777: { name: 'Bobur Tursunov', branch: '5bekat' }
  }
};
```

**Telegram ID ni qanday topish mumkin:**
1. Botni ishga tushiring
2. Foydalanuvchi `/start` yozsin
3. Bot ruxsat yo'q xabarida Telegram ID'ni ko'rsatadi

**Mavjud filiallar:**
- `2bekat` - 2-Bekat filiali
- `texnopark` - TEXNOPARK filiali
- `5bekat` - 5-Bekat filiali

### 5. Servis xodimlarini sozlash

`specialists.js` faylida har bir filial uchun servis xodimlarini sozlang:

```javascript
module.exports = {
  branches: [
    { id: '2bekat', name: '2-Bekat' },
    { id: 'texnopark', name: 'TEXNOPARK' },
    { id: '5bekat', name: '5-Bekat' }
  ],
  specialists: {
    '2bekat': [
      'Abbos Rahmonov',
      'Bobur Karimov',
      'Davron Tursunov'
    ],
    'texnopark': [
      'Eldor Sharipov',
      'Farrux Aliyev',
      'Jasur Mahmudov',
      'Komil Saidov'
    ],
    '5bekat': [
      'Nodir Yusupov',
      'Otabek Salimov',
      'Rustam Abdullayev'
    ]
  }
};
```

## Ishlatish

### Telegram Botni ishga tushirish

```bash
node telegram-bot-v2.js
```

Bot ishga tushgach:
1. Avtomatik ravishda CRMga login qiladi (10-15 soniya)
2. "✅ CRM login successful! Bot is ready." xabarini ko'rsatadi
3. Telegramda botingizni toping va botni ishga tushiring

**Eslatma:** Bot ishga tushishi bilan CRM sessiyasi ochiladi, shuning uchun birinchi registratsiya juda tez ishlaydi.

### Asosiy Menyu

Bot ishga tushgach, sizga 3 ta asosiy tugma ko'rsatiladi:

```
┌─────────────────────────┐
│   📝 Registratsiya      │  ← Yangi avtomobilni servisga ko'chirish
├─────────────────────────┤
│   📊 Xisobot            │  ← Statistika va xisobotlar (coming soon)
├─────────────────────────┤
│   📍 Holat              │  ← Bot va CRM holati
└─────────────────────────┘
```

#### 📝 Registratsiya
Yangi avtomobilni servisga ko'chirish (VIN qidirish va ma'lumot qo'shish)
- VIN qidirish (min 4 belgi)
- Davlat raqami
- Sabab (Reason)
- Mijoz ismi va telefon raqami
- Avtomatik CRMga saqlash

#### 📊 Xisobot
Kunlik va oylik statistikani ko'rish
- Kunlik registratsiyalar
- Oylik statistika
- VIN bo'yicha qidiruv
- *(Tez orada qo'shiladi)*

#### 📍 Holat
Bot va CRM ulanish holatini tekshirish
- Bot versiyasi
- CRM ulanish holati
- Oxirgi yangilanish sanasi

### Registratsiya Jarayoni

#### 📝 Registratsiya (Asosiy menyudan)
Yangi avtomobilni servisga ko'chirish. **Registratsiya** tugmasini bosing, bot sizdan quyidagilarni so'raydi:

1. **VIN qidiruv** - Kamida 4 belgi kiriting (masalan: oxirgi 4-5 belgi yoki to'liq VIN)
2. **VIN ni tanlash** - Bot topilgan VINlarni inline tugmalar sifatida ko'rsatadi
3. **Davlat raqami** - Masalan: 01ABC123
4. **Viloyat** - 14 ta viloyat va shahardan birini tanlang (inline buttons)
5. **Mijoz ismi** - Masalan: Sardor Ahmedov
6. **Telefon raqami** - Masalan: 901234567 (mamlakat kodi shart emas, avtomatik formatlanadi)
7. **Probeg (km)** - Masalan: 25000 (faqat raqamlar, avtomatik validatsiya)
8. **Sabab (Reason)** - Masalan: Motor moyi almashtirildi, Tormoz kolodkalari almashtirildi
9. **Xizmat turi** - M/X (Mijoz xisobidan) yoki K/A (Kafolat asosida)
10. **Servis xodimi** - Sizning filialingiz uchun servis xodimlari avtomatik ko'rsatiladi (inline buttons)

**Eslatma:** Servis xodimlari ro'yxati sizning filialingizga qarab avtomatik filterlanadi. Masalan, agar siz 2-Bekat filialida ishlasangiz, faqat 2-Bekat filialidagi servis xodimlarni ko'rasiz.

**Qidiruv Imkoniyatlari:**
- Oxirgi 4 belgi: `8862` → `LDP45G962RD088620` (avtomatik tanlanadi)
- Oxirgi 5 belgi: `03054` → 6 ta VIN topiladi (inline buttons)
- To'liq VIN: `LGJE1EE04NM030544` (avtomatik tanlanadi)

**Viloyatlar va Kodlar (Rasmiy avtomobil raqamlari):**
Bot quyidagi 14 ta viloyat va shaharni qo'llab-quvvatlaydi:
- 01 - Toshkent shahri
- 10 - Toshkent viloyati
- 20 - Sirdaryo viloyati
- 25 - Jizzax viloyati
- 30 - Samarqand viloyati
- 40 - Farg'ona viloyati
- 50 - Namangan viloyati
- 60 - Andijon viloyati
- 70 - Qashqadaryo viloyati
- 75 - Surxondaryo viloyati
- 80 - Buxoro viloyati
- 85 - Navoiy viloyati
- 90 - Xorazm viloyati
- 95 - Qoraqalpog'iston Respublikasi

**Telefon Raqami Validatsiyasi:**
Bot telefon raqamlarni avtomatik formatlaydi va tekshiradi:
- **Qabul qilinadigan formatlar:**
  - `901234567` (faqat raqamlar)
  - `90 123 45 67` (bo'shliqlar bilan)
  - `+998901234567` (mamlakat kodi bilan)
  - `998901234567` (+ belgisisiz)
- **Avtomatik formatlash:** Barcha formatlar `+998901234567` ga aylantiriladi
- **Validatsiya:**
  - 9 ta raqam talab qilinadi
  - To'g'ri operator kodi: 90, 91, 93, 94, 95, 97, 98, 99, 33, 88, 77

**Aqlli Avtomatik Tanlash:**
- Agar faqat 1 ta VIN topilsa, avtomatik tanlanadi va keyingi qadamga o'tiladi
- Bir nechta VIN topilsa, inline tugmalar ko'rsatiladi

**Jarayon (1 ta VIN - avtomatik tanlash):**
```
Siz: [📝 Registratsiya tugmasini bosadi]
Bot: VIN qidirish uchun kamida 4 belgi kiriting
Siz: 8862
Bot: ✅ VIN topildi va avtomatik tanlandi: LDP45G962RD088620
     Davlat raqamini kiriting
Siz: 01ABC123
Bot: Viloyatni tanlang:
     [01 - Toshkent shahri] [10 - Toshkent viloyati]
     [20 - Sirdaryo viloyati] [25 - Jizzax viloyati]
     [30 - Samarqand viloyati] [40 - Farg'ona viloyati]
     ... (14 ta variant)
Siz: [01 - Toshkent shahri ni bosadi]
Bot: Mijoz ismini kiriting
Siz: Sardor Ahmedov
Bot: Telefon raqamini kiriting
Siz: 901234567
Bot: Probeg (km) ni kiriting
Siz: 25000
Bot: Sabab (Reason) ni kiriting
Siz: Motor moyi almashtirildi
Bot: Xizmat turini tanlang:
     [💰 M/X (Mijoz xisobidan)]
     [🛡 K/A (Kafolat asosida)]
Siz: [M/X tugmasini bosadi]
Bot: Servis xodimini tanlang:
     [Abbos Rahmonov] [Bobur Karimov]
     [Davron Tursunov]
     (Faqat sizning filialingiz uchun servis xodimlari)
Siz: [Abbos Rahmonov tugmasini bosadi]
Bot: 📋 Ma'lumotlarni tasdiqlang:
     🚗 VIN: LDP45G962RD088620
     🚗 Davlat raqami: 01ABC123
     📍 Viloyat: 01 - Toshkent shahri
     👤 Mijoz: Sardor Ahmedov
     📞 Telefon: +998901234567
     🛣 Probeg: 25000 km
     📝 Sabab: Motor moyi almashtirildi
     💼 Xizmat turi: M/X
     🏢 Filial: 2-Bekat
     👨‍🔧 Servis xodimi: Abbos Rahmonov
     ⏳ CRMga saqlanmoqda...
Bot: ✅ Muvaffaqiyatli saqlandi!
```

**Jarayon (Bir nechta VIN - tanlash kerak):**
```
Siz: [📝 Registratsiya tugmasini bosadi]
Bot: VIN qidirish uchun kamida 4 belgi kiriting
Siz: 03054
Bot: ✅ 6 ta VIN topildi. VIN ni tanlang:
     [LGJE1EE04NM030544]
     [LGJE1EE06NM030545]
     ... (va boshqalar)
Siz: [Inline tugmani bosasiz]
Bot: Davlat raqamini kiriting
... (davomi yuqoridagi kabi)
```

## CRM Bot (Dasturchi uchun)

### To'g'ridan-to'g'ri ishlatish

```javascript
const CRMBot = require('./bot.js');

async function main() {
  const bot = new CRMBot();

  // Brauzerni ishga tushirish
  await bot.init(false); // false = headless emas (ko'rinadi)

  // Login qilish
  await bot.login();

  // Servis sababini qo'shish
  await bot.addServiceReason('Test sabab - avtomatik qo\'shilgan');

  // Screenshot olish
  await bot.screenshot('result.png');

  // Brauzerni yopish
  await bot.close();
}

main();
```

### Mavjud metodlar

- `init(headless)` - Brauzerni ishga tushirish
- `login()` - CRMga kirish
- `isLoggedIn()` - Login holatini tekshirish
- `ensureLoggedIn()` - Agar logout bo'lsa qayta login qilish
- `navigateToSabablar()` - Sabablar sahifasiga o'tish
- `addServiceReason(text)` - Yangi sabab qo'shish
- `searchVIN(vinLast5, keepModalOpen)` - VIN kodlarni qidirish
- `addServiceTransfer(data, modalAlreadyOpen)` - Servisga ko'chirish ma'lumotini qo'shish
- `closeModal()` - Ochiq modalni yopish
- `screenshot(filename)` - Screenshot olish
- `close()` - Brauzerni yopish

## Xavfsizlik va Ruxsatlar 🔐

Bot foydalanuvchi autentifikatsiya tizimi bilan jihozlangan:

### Ruxsat tizimi

**Faqat ruxsat etilgan foydalanuvchilar botdan foydalanishi mumkin:**
- Har bir foydalanuvchi `users.js` faylida ro'yxatga olinishi kerak
- Har bir foydalanuvchi o'z filialiga biriktiriladi
- Ruxsatsiz foydalanuvchilar xatolik xabari oladi va ularning Telegram ID'si ko'rsatiladi

### Admin foydalanuvchilar

Admin foydalanuvchilar maxsus imtiyozlarga ega:
- Botning barcha funksiyalaridan foydalanish
- Barcha filiallardan servis xodimlarini ko'rish (kelajakda)
- Foydalanuvchilarni boshqarish (kelajakda)

### Telegram ID ni topish

Ruxsatsiz foydalanuvchi `/start` yozganda, bot uning Telegram ID'sini ko'rsatadi:
```
❌ Ruxsat yo'q!

Siz ushbu botdan foydalanish uchun ruxsatga ega emassiz.
Iltimos admin bilan bog'laning: @responsophobia

📝 Sizning Telegram ID: 123456789
```

Admin bu ID ni `users.js` fayliga qo'shishi mumkin.

### Filial tizimi

Har bir foydalanuvchi o'z filialiga biriktirilgan:
- **2-Bekat** - 2-Bekat filiali xodimlari
- **TEXNOPARK** - TEXNOPARK filiali xodimlari
- **5-Bekat** - 5-Bekat filiali xodimlari

Foydalanuvchi faqat o'z filialidagi servis xodimlarni ko'radi va tanlashi mumkin.

## Ishlash tezligi ⚡

Bot ishlash tezligini oshirish uchun quyidagi optimizatsiyalar amalga oshirildi:

### Performance Metrics (Test natijalari)
```
VIN Search:  2.6 soniya  (avval: ~8-10 soniya)
Save Data:   3.4 soniya  (avval: ~8-10 soniya)
─────────────────────────────────────────────────
TOTAL FLOW:  6.1 soniya  (avval: ~18-20 soniya)
```

**Tezlik oshishi: ~70% tezroq! 🚀**

### Qanday optimizatsiya qilindi?

#### 1. Startup Login
Bot ishga tushganda avtomatik ravishda CRMga login qiladi:
- ✓ Foydalanuvchi hech qachon login kutishga majbur emas
- ✓ Birinchi buyruq darhol ishlaydi

#### 2. VIN Qayta Ishlatish (ENG KATTA OPTIMIZATSIYA!)
VIN qidirganda kiritilgan qiymat qayta ishlatiladi:
- ❌ Avval: VIN 2 marta kiritilardi (search + save) = 3.4s kutish
- ✅ Hozir: VIN 1 marta kiritiladi (faqat search) = 0.5s kutish
- **Tejaldi: ~2.9 soniya!**

#### 3. Modal Qayta Ishlatish
VIN qidiruv vaqtida ochilgan modal yopilmaydi:
- ❌ Avval: Modal qayta ochilardi (~3s)
- ✅ Hozir: Modal ochiq qoladi (~0s)

#### 4. Tezkor Navigation
- ✓ `domcontentloaded` instead of `networkidle2` (2x tezroq)
- ✓ URL checking: keraksiz navigatsiya yo'q
- ✓ Smart selectors: elementlar paydo bo'lishini kutadi

#### 5. Tezkor Typing
- Typing delay: 100ms → 30ms VIN uchun (3x tezroq)
- Typing delay: 50ms → 20ms boshqa fieldlar uchun (2.5x tezroq)
- Phone clear: 4x Backspace → Ctrl+A (tezroq)

#### 6. Optimizatsiya qilingan Kutishlar
```
VIN search modal:   2000ms → 300ms
VIN typing wait:    1500ms → 200ms
VIN select wait:    1000ms → 300ms
Form submit wait:   3000ms → 1500ms
Navigation wait:    1500ms → 800ms
```

**Jami tejaldi: ~5.1 soniya!**

## Loyiha strukturasi

```
/statbot
├── telegram-bot.js      # Telegram bot (asosiy file)
├── bot.js              # CRM automation bot
├── add-test-direct.js  # Test uchun misol
├── .env                # Konfiguratsiya (tokenlar, parollar)
├── .gitignore          # Git ignore fayli
├── package.json        # NPM dependencies
├── /examples           # Misollar
├── /screenshots        # Screenshot lar
└── /archive            # Eski test filelar
```

## Xavfsizlik

- `.env` faylini hech qachon git ga commit qilmang
- `.gitignore` faylida `.env` mavjud
- Parollar va tokenlarni hech kimga bermang

## Xatolarni hal qilish

### "TELEGRAM_BOT_TOKEN is not defined"
`.env` faylida `TELEGRAM_BOT_TOKEN` ni to'g'ri kiriting

### "Login failed"
`.env` faylida CRM login va parolni tekshiring

### "Could not find Qo'shish button"
CRM interfeysi o'zgargan bo'lishi mumkin. Bot kodini yangilang.

## Ishlab chiquvchi

Ushbu bot Auto Center Service uchun maxsus yaratilgan.

**Developer:** @responsophobia

Bot Bestune CRM tizimiga avtomatik ma'lumot kiritish uchun ishlab chiqilgan.


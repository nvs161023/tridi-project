/**
 * Демо-аккаунт Мастерской: пользователь, подписка Pro и тестовые данные.
 *
 * Зачем: витрина /tools/workshop показывает гостю, что он покупает, но до
 * оплаты мастерскую не видел никто. Скрипт создаёт демо-аккаунт с заказами,
 * складом, принтерами, клиентами и товарами, чтобы снять скриншоты и открыть
 * демо-доступ кнопкой на витрине. Писать в демо нельзя: запрет живёт в
 * lib/workshop/demo.ts и в каждой Server Action.
 *
 * Запуск: npm run seed:demo
 * Требует в .env.local: NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.
 * Пароль берётся из DEMO_WORKSHOP_PASSWORD; если переменной нет, скрипт
 * генерирует пароль и дописывает его в .env.local (файл в .gitignore).
 *
 * Скрипт идемпотентен: данные демо-аккаунта удаляются и создаются заново,
 * поэтому повторный запуск возвращает эталонный набор.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const DEMO_EMAIL = (process.env.DEMO_WORKSHOP_EMAIL || "demo@tridi-print.ru").trim();
const DAY = 24 * 60 * 60 * 1000;

function loadEnv() {
  try {
    if (fs.existsSync(ENV_FILE)) {
      process.loadEnvFile(ENV_FILE);
    }
  } catch {
    // Ниже будет понятная ошибка, если ключей действительно нет.
  }
}

function readEnvValue(key) {
  if (!fs.existsSync(ENV_FILE)) return "";
  const line = fs
    .readFileSync(ENV_FILE, "utf8")
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(key + "="));
  if (!line) return "";
  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

function saveEnvValue(key, value) {
  const text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
  const lines = text.split(/\r?\n/).filter((line) => !line.trim().startsWith(key + "="));
  lines.push(key + "=" + value);
  fs.writeFileSync(ENV_FILE, lines.join("\n").replace(/\n+$/, "\n"), "utf8");
}


const CLIENTS = [
  {
    key: "anna",
    name: "Анна Соколова",
    phone: "+7 (921) 448-12-30",
    email: "a.sokolova@mail.ru",
    address: "Санкт-Петербург, наб. реки Мойки, 12, кв. 34",
    notes: "Постоянная клиентка: берёт вазы и кашпо каждый сезон. Любит матовые цвета.",
  },
  {
    key: "forma",
    name: "Мастерская «Форма» (ИП Литвинов)",
    phone: "+7 (495) 120-45-77",
    email: "zakaz@forma-studio.ru",
    address: "Москва, ул. Малая Пионерская, 7, офис 12",
    notes: "Оптовые заказы от 20 штук. Оплата по счёту, отсрочка 5 дней.",
  },
  {
    key: "kovalev",
    name: "Дмитрий Ковалёв",
    phone: "+7 (911) 205-77-14",
    email: "d.kovalev@yandex.ru",
    address: "Санкт-Петербург, пр. Энгельса, 154, кв. 88",
    notes: "Забирает самовывозом с Парнаса. Пишет в Telegram.",
  },
  {
    key: "par",
    name: "Кофейня «Пар»",
    phone: "+7 (812) 640-22-18",
    email: "hello@par-coffee.ru",
    address: "Санкт-Петербург, ул. Некрасова, 40",
    notes: "Подставки с логотипом для зала. Логотип присылают в SVG.",
  },
  {
    key: "melnik",
    name: "Ольга Мельник",
    phone: "+7 (903) 311-09-52",
    email: "o.melnik@gmail.com",
    address: "Санкт-Петербург, Кузнечный пер., 9, кв. 5",
    notes: "Дважды просила ночники в подарок. Упаковка — крафт и лента.",
  },
];

const PRODUCTS = [
  {
    key: "vase120",
    sku: "VZ-SPIRAL-120",
    title: "Ваза «Спираль» 120 мм",
    description: "Спиральная ваза с толщиной стенки 1,2 мм. Печать без поддержек.",
    price: 1400,
    old_price: 1750,
    color: "Чёрный",
    size: "120 × 60 мм",
    weight_g: 120,
    length_mm: 60,
    width_mm: 60,
    height_mm: 120,
    category: "Декор",
  },
  {
    key: "vase180",
    sku: "VZ-SPIRAL-180",
    title: "Ваза «Спираль» 180 мм",
    description: "Высокая версия спиральной вазы. Под сухоцветы и одиночные стебли.",
    price: 2400,
    old_price: null,
    color: "Чёрный",
    size: "180 × 75 мм",
    weight_g: 210,
    length_mm: 75,
    width_mm: 75,
    height_mm: 180,
    category: "Декор",
  },
  {
    key: "stand",
    sku: "PS-HOLDER-01",
    title: "Подставка для телефона",
    description: "Регулируемый угол наклона, под кабель. Логотип печатается на дне.",
    price: 450,
    old_price: null,
    color: "Белый",
    size: "95 × 80 × 90 мм",
    weight_g: 55,
    length_mm: 95,
    width_mm: 80,
    height_mm: 90,
    category: "Аксессуары",
  },
  {
    key: "pot140",
    sku: "KP-WAVE-140",
    title: "Кашпо «Волна» 140 мм",
    description: "Кашпо с дренажом и поддоном. Внутренний диаметр 132 мм.",
    price: 1200,
    old_price: 1450,
    color: "Синий матовый",
    size: "140 × 120 мм",
    weight_g: 160,
    length_mm: 140,
    width_mm: 140,
    height_mm: 120,
    category: "Кашпо",
  },
  {
    key: "night",
    sku: "NL-MOON-120",
    title: "Ночник «Луна» 120 мм",
    description: "Тонкостенная сфера с литофановой поверхностью. Тёплый LED в комплекте.",
    price: 3200,
    old_price: null,
    color: "Золотой шёлк",
    size: "120 × 120 × 110 мм",
    weight_g: 180,
    length_mm: 120,
    width_mm: 120,
    height_mm: 110,
    category: "Декор",
  },
  {
    key: "organizer",
    sku: "OR-PEN-03",
    title: "Органайзер для ручек, 3 отделения",
    description: "Настольный органайзер с тремя секциями под ручки и маркеры.",
    price: 950,
    old_price: null,
    color: "Графит",
    size: "150 × 70 × 80 мм",
    weight_g: 70,
    length_mm: 150,
    width_mm: 70,
    height_mm: 80,
    category: "Аксессуары",
  },
];

const FILAMENTS = [
  {
    key: "plaBlack",
    brand: "Prusament",
    type: "PLA",
    color: "Galaxy Black",
    total_weight_g: 1000,
    remaining_weight_g: 610,
    price_per_kg: 3200,
    min_threshold_g: 200,
    purchase_url: "https://www.prusament.com/",
    usage_type: "stock",
  },
  {
    key: "petgWhite",
    brand: "Bestfilament",
    type: "PETG",
    color: "Белый",
    total_weight_g: 1000,
    remaining_weight_g: 140,
    price_per_kg: 1900,
    min_threshold_g: 200,
    purchase_url: "https://bestfilament.ru/",
    usage_type: "stock",
  },
  {
    key: "silkGold",
    brand: "REC",
    type: "PLA",
    color: "Шёлк золотой",
    total_weight_g: 750,
    remaining_weight_g: 430,
    price_per_kg: 2400,
    min_threshold_g: 150,
    purchase_url: null,
    usage_type: "stock",
  },
  {
    key: "absGray",
    brand: "eSUN",
    type: "ABS",
    color: "Серый",
    total_weight_g: 1000,
    remaining_weight_g: 870,
    price_per_kg: 2100,
    min_threshold_g: 250,
    purchase_url: null,
    usage_type: "stock",
  },
  {
    key: "plaMatteBlue",
    brand: "Bestfilament",
    type: "PLA",
    color: "Синий матовый",
    total_weight_g: 1000,
    remaining_weight_g: 720,
    price_per_kg: 1900,
    min_threshold_g: 200,
    purchase_url: "https://bestfilament.ru/",
    usage_type: "stock",
  },
  {
    key: "tpu",
    brand: "Devil Design",
    type: "TPU",
    color: "Чёрный",
    total_weight_g: 500,
    remaining_weight_g: 310,
    price_per_kg: 3600,
    min_threshold_g: 120,
    purchase_url: null,
    usage_type: "stock",
  },
  {
    key: "petgOrdered",
    brand: "Prusament",
    type: "PETG",
    color: "Оранжевый",
    total_weight_g: 1000,
    remaining_weight_g: 1000,
    price_per_kg: 2900,
    min_threshold_g: 200,
    purchase_url: "https://www.prusament.com/",
    usage_type: "ordered",
  },
];

const PRINTERS = [
  {
    key: "x1c",
    name: "Bambu X1C",
    brand: "Bambu Lab",
    model: "X1 Carbon",
    total_hours: 412.5,
    nozzle_hours: 148.2,
    nozzle_interval: 300,
    lubrication_hours: 96.5,
    lubrication_interval: 500,
    z_screw_hours: 120.5,
    z_screw_interval: 800,
    last_maintenance_date: daysAgo(12),
    protocol_type: "bambu",
    ip_address: "192.168.1.31",
    status: "idle",
    progress: 0,
    remaining_time: 0,
    serial_number: "01S00C3A1800123",
  },
  {
    key: "mk4",
    name: "Prusa MK4S",
    brand: "Prusa",
    model: "Original Prusa MK4S",
    total_hours: 268.4,
    nozzle_hours: 268.4,
    nozzle_interval: 400,
    lubrication_hours: 210.1,
    lubrication_interval: 600,
    z_screw_hours: 45.5,
    z_screw_interval: 800,
    last_maintenance_date: daysAgo(34),
    protocol_type: "moonraker",
    ip_address: "192.168.1.42",
    status: "printing",
    progress: 42,
    remaining_time: 7200,
  },
  {
    key: "ender",
    name: "Ender 3 S1 Pro",
    brand: "Creality",
    model: "Ender-3 S1 Pro",
    total_hours: 731.2,
    nozzle_hours: 396.8,
    nozzle_interval: 400,
    lubrication_hours: 412.6,
    lubrication_interval: 500,
    z_screw_hours: 260.4,
    z_screw_interval: 600,
    last_maintenance_date: daysAgo(58),
    protocol_type: "octoprint",
    ip_address: "192.168.1.57",
    status: "idle",
    progress: 0,
    remaining_time: 0,
  },
  {
    key: "kobra",
    name: "Anycubic Kobra 2",
    brand: "Anycubic",
    model: "Kobra 2",
    total_hours: 156.9,
    nozzle_hours: 88.3,
    nozzle_interval: 300,
    lubrication_hours: 60.2,
    lubrication_interval: 400,
    z_screw_hours: 30.1,
    z_screw_interval: 800,
    last_maintenance_date: daysAgo(21),
    protocol_type: "moonraker",
    ip_address: "192.168.1.63",
    status: "idle",
    progress: 0,
    remaining_time: 0,
  },
];

/**
 * Заказы демо-мастерской.
 *
 * `daysAgo` — когда заказ создали (по нему считается выручка месяца),
 * `dueInDays` — срок сдачи, `items` — позиции каталога, `job` — задание печати.
 * Статусы взяты из жизни: две печати идут, одна ждёт принтер, остальные
 * разложены по колонкам «Новые», «Готово» и «Доставлено».
 */
const ORDERS = [
  {
    key: "vaseAnna",
    title: "Ваза «Спираль» 180 мм",
    client: "anna",
    status: "ready",
    total_cost: 2400,
    material_weight_g: 210,
    print_time_hours: 6.5,
    printer: "x1c",
    filament: "plaBlack",
    notes: "Подарок: упаковать в крафт и добавить открытку.",
    daysAgo: 2,
    dueInDays: 2,
    items: [{ product: "vase180", quantity: 1 }],
  },
  {
    key: "standPar",
    title: "Подставки с логотипом для кофейни",
    client: "par",
    status: "printing",
    total_cost: 5400,
    material_weight_g: 330,
    print_time_hours: 9.6,
    printer: "mk4",
    filament: "petgWhite",
    notes: "12 подставок, логотип на дне. Первые три — образцы.",
    daysAgo: 1,
    dueInDays: 1,
    items: [{ product: "stand", quantity: 12 }],
    job: { status: "printing", progress: 42, remaining: 7200, estimated: 21600 },
  },
  {
    key: "potKovalev",
    title: "Кашпо «Волна» 140 мм",
    client: "kovalev",
    status: "new",
    total_cost: 1200,
    material_weight_g: 160,
    print_time_hours: 5.1,
    printer: "ender",
    filament: "plaMatteBlue",
    notes: "Дренажные отверстия побольше, под фикус.",
    daysAgo: 0,
    dueInDays: 4,
    items: [{ product: "pot140", quantity: 1 }],
  },
  {
    key: "nightMelnik",
    title: "Ночник «Луна» 120 мм",
    client: "melnik",
    status: "delivered",
    total_cost: 3200,
    material_weight_g: 180,
    print_time_hours: 7.4,
    printer: "kobra",
    filament: "silkGold",
    notes: "LED-модуль вложен в коробку, батарейки отдельно.",
    daysAgo: 5,
    dueInDays: -3,
    items: [{ product: "night", quantity: 1 }],
    job: { status: "done", progress: 100, remaining: 0, estimated: 26640 },
  },
  {
    key: "organizerForma",
    title: "Органайзеры для ручек, партия 20 шт.",
    client: "forma",
    status: "delivered",
    total_cost: 14250,
    material_weight_g: 1400,
    print_time_hours: 28.5,
    printer: "x1c",
    filament: "plaBlack",
    notes: "Оплата по счёту, отгрузка через СДЭК.",
    daysAgo: 9,
    dueInDays: -4,
    items: [{ product: "organizer", quantity: 20 }],
  },
  {
    key: "potAnna",
    title: "Кашпо «Волна» 140 мм, матовый синий",
    client: "anna",
    status: "new",
    total_cost: 1200,
    material_weight_g: 160,
    print_time_hours: 5.1,
    printer: "mk4",
    filament: "plaMatteBlue",
    notes: "Как в прошлый раз, без поддона.",
    daysAgo: 3,
    dueInDays: 6,
    items: [{ product: "pot140", quantity: 1 }],
  },

  {
    key: "vasePar",
    title: "Вазы «Спираль» 120 мм для зала",
    client: "par",
    status: "printing",
    total_cost: 4200,
    material_weight_g: 360,
    print_time_hours: 11.2,
    printer: "ender",
    filament: "petgWhite",
    notes: "Три вазы, вторая и третья — после первой.",
    daysAgo: 2,
    dueInDays: 3,
    items: [{ product: "vase120", quantity: 3 }],
    job: { status: "queued", progress: 0, remaining: 0, estimated: 40320 },
  },
  {
    key: "standKovalev",
    title: "Подставка под планшет",
    client: "kovalev",
    status: "ready",
    total_cost: 900,
    material_weight_g: 95,
    print_time_hours: 3.4,
    printer: "kobra",
    filament: "absGray",
    notes: "Просил серый, как на фото. Проверить устойчивость.",
    daysAgo: 4,
    dueInDays: 0,
    items: [{ product: "stand", quantity: 1 }],
  },
  {
    key: "vaseMelnik",
    title: "Ваза «Спираль» 120 мм, шёлк",
    client: "melnik",
    status: "new",
    total_cost: 1400,
    material_weight_g: 120,
    print_time_hours: 4.2,
    printer: "x1c",
    filament: "silkGold",
    notes: "К 8 марта, упаковать отдельно.",
    daysAgo: 0,
    dueInDays: 8,
    items: [{ product: "vase120", quantity: 1 }],
  },
  {
    key: "standProbe",
    title: "Подставка для телефона, пробная",
    client: null,
    status: "delivered",
    total_cost: 450,
    material_weight_g: 55,
    print_time_hours: 1.8,
    printer: null,
    filament: "plaBlack",
    notes: "Образец для фото в карточку товара.",
    daysAgo: 14,
    dueInDays: -12,
    items: [{ product: "stand", quantity: 1 }],
  },
  {
    key: "ozonSet",
    title: "Набор «Утро»: кашпо и подставка",
    client: null,
    status: "new",
    total_cost: 2890,
    material_weight_g: 215,
    print_time_hours: 6.9,
    printer: "x1c",
    filament: "petgWhite",
    notes: "Заказ площадки: собрать комплект и наклеить штрихкод Ozon.",
    daysAgo: 1,
    dueInDays: 2,
    items: [
      { product: "pot140", quantity: 1 },
      { product: "stand", quantity: 1 },
    ],
    marketplace: {
      source: "ozon",
      orderId: "4821-7730",
      totalAmount: 2890,
      commission: 520,
      printCost: 610,
    },
  },
];


function daysAgo(days) {
  return new Date(Date.now() - days * DAY);
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}


/** Демо-аккаунт с почтой и метаданными. Пароль нужен только для входа. */
async function ensureDemoUser(admin, password) {
  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw new Error("Не удалось прочитать пользователей: " + listError.message);
  }

  const existing = list.users.find(
    (user) => (user.email || "").toLowerCase() === DEMO_EMAIL.toLowerCase(),
  );
  const metadata = {
    is_demo: true,
    first_name: "Демо",
    last_name: "Мастерская",
    name: "Демо Мастерская",
  };

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) {
      throw new Error("Не удалось обновить демо-пользователя: " + error.message);
    }

    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (error || !data.user) {
    throw new Error("Не удалось создать демо-пользователя: " + (error?.message || ""));
  }

  return data.user.id;
}

/** Подписка Pro на год: без неё мастерская закрыта. */
async function ensureSubscription(admin, userId) {
  const expiresAt = new Date(Date.now() + 365 * DAY).toISOString();
  const { data, error } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Не удалось прочитать подписку: " + error.message);
  }

  if (data?.id) {
    const { error: updateError } = await admin
      .from("subscriptions")
      .update({ status: "active", expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    if (updateError) {
      throw new Error("Не удалось обновить подписку: " + updateError.message);
    }

    return;
  }

  const { error: insertError } = await admin.from("subscriptions").insert({
    user_id: userId,
    status: "active",
    expires_at: expiresAt,
  });

  if (insertError) {
    throw new Error("Не удалось создать подписку: " + insertError.message);
  }
}

/** Полная очистка данных мастерской демо-аккаунта. */
async function resetWorkshopData(admin, userId) {
  const steps = [
    ["workshop_print_events", "user_id"],
    ["workshop_print_jobs", "user_id"],
    ["workshop_order_items", "user_id"],
    ["workshop_order_comments", "user_id"],
    ["workshop_marketplace_links", "user_id"],
    ["workshop_orders", "user_id"],
    ["workshop_discovered_printers", "user_id"],
    ["workshop_filaments", "user_id"],
    ["workshop_printers", "user_id"],
    ["workshop_products", "user_id"],
    ["workshop_clients", "user_id"],
  ];

  for (const [table, column] of steps) {
    const { error } = await admin.from(table).delete().eq(column, userId);

    // Таблицы может не быть, если миграцию ещё не применили: это не повод
    // останавливать заливку, сообщаем и идём дальше.
    if (error && error.code !== "PGRST205" && error.code !== "42P01") {
      throw new Error("Очистка " + table + ": " + error.message);
    }
  }
}

/** Настройки калькулятора и реквизиты для документов. */
async function seedSettings(admin, userId) {
  const { error } = await admin.from("workshop_settings").upsert(
    {
      user_id: userId,
      electricity_cost_kwh: 5.2,
      printer_power_w: 165,
      depreciation_cost_hour: 12,
      labor_cost_hour: 450,
      company_type: "ip",
      company_name: "ИП Ковалёв Павел Игоревич",
      inn: "780612345678",
      ogrn: "324780000012345",
      legal_address: "191014, Санкт-Петербург, ул. Некрасова, 40, пом. 12-Н",
      bank_details:
        "Р/с 40802810000000123456, АО «Тинькофф Банк», БИК 044525974, к/с 30101810145250000974",
      contact_phone: "+7 (921) 100-24-18",
      contact_email: "pavel@tridi-print.ru",
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error("Настройки мастерской: " + error.message);
  }
}


async function seedClients(admin, userId) {
  const { data, error } = await admin
    .from("workshop_clients")
    .insert(
      CLIENTS.map((client, index) => ({
        user_id: userId,
        name: client.name,
        phone: client.phone,
        email: client.email,
        address: client.address,
        notes: client.notes,
        created_at: new Date(Date.now() - (20 - index * 3) * DAY).toISOString(),
      })),
    )
    .select("id, name");

  if (error) {
    throw new Error("Клиенты: " + error.message);
  }

  const byKey = new Map();

  CLIENTS.forEach((client) => {
    const row = data.find((item) => item.name === client.name);
    if (row) byKey.set(client.key, row.id);
  });

  return byKey;
}

async function seedProducts(admin, userId) {
  const { data, error } = await admin
    .from("workshop_products")
    .insert(
      PRODUCTS.map((product) => ({
        user_id: userId,
        sku: product.sku,
        title: product.title,
        description: product.description,
        price: product.price,
        old_price: product.old_price,
        color: product.color,
        size: product.size,
        weight_g: product.weight_g,
        length_mm: product.length_mm,
        width_mm: product.width_mm,
        height_mm: product.height_mm,
        category: product.category,
        brand: "TriDi",
      })),
    )
    .select("id, sku");

  if (error) {
    throw new Error("Товары: " + error.message);
  }

  return new Map(data.map((row) => [row.sku, row.id]));
}

async function seedFilaments(admin, userId) {
  const { data, error } = await admin
    .from("workshop_filaments")
    .insert(
      FILAMENTS.map((filament, index) => ({
        user_id: userId,
        brand: filament.brand,
        type: filament.type,
        color: filament.color,
        total_weight_g: filament.total_weight_g,
        remaining_weight_g: filament.remaining_weight_g,
        price_per_kg: filament.price_per_kg,
        min_threshold_g: filament.min_threshold_g,
        purchase_url: filament.purchase_url,
        usage_type: filament.usage_type,
        created_at: new Date(Date.now() - (30 - index * 4) * DAY).toISOString(),
      })),
    )
    .select("id, brand, color");

  if (error) {
    throw new Error("Склад: " + error.message);
  }

  const byKey = new Map();

  FILAMENTS.forEach((filament) => {
    const row = data.find(
      (item) => item.brand === filament.brand && item.color === filament.color,
    );
    if (row) byKey.set(filament.key, row.id);
  });

  return byKey;
}

async function seedPrinters(admin, userId) {
  const { data, error } = await admin
    .from("workshop_printers")
    .insert(
      PRINTERS.map((printer) => ({
        user_id: userId,
        name: printer.name,
        brand: printer.brand,
        model: printer.model,
        total_hours: printer.total_hours,
        nozzle_hours: printer.nozzle_hours,
        nozzle_interval: printer.nozzle_interval,
        lubrication_hours: printer.lubrication_hours,
        lubrication_interval: printer.lubrication_interval,
        z_screw_hours: printer.z_screw_hours,
        z_screw_interval: printer.z_screw_interval,
        last_maintenance_date: printer.last_maintenance_date,
        protocol_type: printer.protocol_type,
        ip_address: printer.ip_address,
        status: printer.status,
        progress: printer.progress,
        remaining_time: printer.remaining_time,
        serial_number: printer.serial_number ?? null,
        last_seen_at: new Date(Date.now() - 60 * 1000).toISOString(),
      })),
    )
    .select("id, name");

  if (error) {
    throw new Error("Принтеры: " + error.message);
  }

  const byKey = new Map();

  PRINTERS.forEach((printer) => {
    const row = data.find((item) => item.name === printer.name);
    if (row) byKey.set(printer.key, row.id);
  });

  return byKey;
}


async function seedOrders(admin, userId, refs) {
  const productByKey = new Map(PRODUCTS.map((product) => [product.key, product]));
  const clientByKey = new Map(CLIENTS.map((client) => [client.key, client]));
  let inserted = 0;

  for (const order of ORDERS) {
    const createdAt = daysAgo(order.daysAgo);
    const client = order.client ? clientByKey.get(order.client) : null;
    const marketplace = order.marketplace ?? null;
    const payload = {
      user_id: userId,
      title: order.title,
      client_name: client ? client.name : null,
      client_id: order.client ? refs.clients.get(order.client) ?? null : null,
      status: order.status,
      total_cost: order.total_cost,
      material_weight_g: order.material_weight_g,
      print_time_hours: order.print_time_hours,
      printer_id: order.printer ? refs.printers.get(order.printer) ?? null : null,
      filament_id: order.filament ? refs.filaments.get(order.filament) ?? null : null,
      notes: order.notes,
      deadline: dateOnly(new Date(Date.now() + order.dueInDays * DAY)),
      created_at: createdAt.toISOString(),
      source: marketplace ? marketplace.source : "manual",
      marketplace_order_id: marketplace ? marketplace.orderId : null,
      total_amount: marketplace ? marketplace.totalAmount : null,
      marketplace_commission: marketplace ? marketplace.commission : null,
      internal_print_cost: marketplace ? marketplace.printCost : null,
    };

    const { data: orderRow, error } = await admin
      .from("workshop_orders")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      throw new Error("Заказ «" + order.title + "»: " + error.message);
    }

    const itemRows = order.items.map((item) => {
      const product = productByKey.get(item.product);

      return {
        user_id: userId,
        order_id: orderRow.id,
        product_id: product ? refs.products.get(product.sku) ?? null : null,
        sku: product ? product.sku : null,
        quantity: item.quantity,
        created_at: createdAt.toISOString(),
      };
    });

    const { data: itemData, error: itemError } = await admin
      .from("workshop_order_items")
      .insert(itemRows)
      .select("id, sku");

    if (itemError) {
      throw new Error("Позиции «" + order.title + "»: " + itemError.message);
    }

    if (order.job) {
      const jobPrinterKey =
        order.job.printer === null ? null : order.job.printer ?? order.printer;
      const job = {
        user_id: userId,
        order_id: orderRow.id,
        order_item_id: itemData[0].id,
        printer_id: jobPrinterKey ? refs.printers.get(jobPrinterKey) ?? null : null,
        gcode_url: null,
        status: order.job.status,
        estimated_seconds: order.job.estimated,
        filament_grams: order.material_weight_g,
        created_at: createdAt.toISOString(),
      };

      const { data: jobRow, error: jobError } = await admin
        .from("workshop_print_jobs")
        .insert(job)
        .select("id")
        .single();

      if (jobError) {
        throw new Error("Задание «" + order.title + "»: " + jobError.message);
      }

      if (order.job.status === "printing") {
        const { error: progressError } = await admin
          .from("workshop_print_jobs")
          .update({
            progress: order.job.progress,
            remaining_time: order.job.remaining,
            started_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
          })
          .eq("id", jobRow.id);

        if (progressError) {
          throw new Error("Прогресс «" + order.title + "»: " + progressError.message);
        }
      }
    }

    inserted += 1;
  }

  return inserted;
}


async function countRows(admin, userId, table) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return error ? "?" : String(count);
}

async function main() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Нет NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY в .env.local",
    );
  }

  let password =
    process.env.DEMO_WORKSHOP_PASSWORD || readEnvValue("DEMO_WORKSHOP_PASSWORD");
  let generated = false;

  if (!password) {
    password = randomBytes(12).toString("base64url");
    saveEnvValue("DEMO_WORKSHOP_PASSWORD", password);
    generated = true;
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userId = await ensureDemoUser(admin, password);
  await ensureSubscription(admin, userId);
  await resetWorkshopData(admin, userId);
  await seedSettings(admin, userId);

  const clients = await seedClients(admin, userId);
  const products = await seedProducts(admin, userId);
  const filaments = await seedFilaments(admin, userId);
  const printers = await seedPrinters(admin, userId);
  const orders = await seedOrders(admin, userId, {
    clients,
    products,
    filaments,
    printers,
  });

  console.log("Демо-аккаунт готов.");
  console.log("  почта: " + DEMO_EMAIL);
  console.log(
    "  пароль: " +
      password +
      (generated ? " (сгенерирован и записан в .env.local)" : ""),
  );
  console.log("  user_id: " + userId);
  console.log("  заказов: " + orders);
  console.log("  позиций: " + (await countRows(admin, userId, "workshop_order_items")));
  console.log("  заданий печати: " + (await countRows(admin, userId, "workshop_print_jobs")));
  console.log("  катушек: " + (await countRows(admin, userId, "workshop_filaments")));
  console.log("  принтеров: " + (await countRows(admin, userId, "workshop_printers")));
  console.log("  клиентов: " + (await countRows(admin, userId, "workshop_clients")));
  console.log("  товаров: " + (await countRows(admin, userId, "workshop_products")));
  console.log("Скриншоты: npm run shots:workshop (нужен запущенный сервер).");
}

main().catch((error) => {
  console.error("Seed не выполнен:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});


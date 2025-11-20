const { program } = require('commander');
const express = require('express'); // Підключаємо Express
const app = express(); // Створюємо програму
const fs = require('node:fs').promises;
const path = require('node:path');
const fsSync = require('node:fs');
const superagent = require('superagent');
program
    .requiredOption('-h,--host <string>', 'Input IP adress of server')
    .requiredOption('-p,--port <number>', 'Input Port')
    .requiredOption('-c, --cache <path>', 'Input path ')
    .configureOutput({
        writeErr: () => { }
    });
program.exitOverride();

try {
    program.parse(process.argv);
} catch (err) {
    // Якщо не вказано обов'язкову опцію
    if (err.code === 'commander.missingMandatoryOptionValue' ||
        err.message.includes('required option')) {
        console.error('Please do required option');
        process.exit(1);
    }
    throw err;
}
const options = program.opts();

// --- НАЛАШТУВАННЯ КЕШУ 
const cachePath = path.resolve(options.cache);

console.log(`Перевірка директорії кешу: ${cachePath}`);
try {
    // 1. Перевіряємо, чи папка ВЖЕ ІСНУЄ
    if (!fsSync.existsSync(cachePath)) {
        // 2. Якщо ні - створюємо її
        fsSync.mkdirSync(cachePath, { recursive: true });
        console.log('Директорію кешу успішно створено.');
    } else {
        console.log('Директорія кешу вже існує.');
    }
} catch (err) {
    console.error(`Помилка при створенні директорії кешу: ${err.message}`);
    process.exit(1);
}

// --- 2. НАЛАШТУВАННЯ СХОВИЩА ДАНИХ ---
// Масив для зберігання інформації про речі (поки сервер працює)
let inventory = [];

// --- 3. НАЛАШТУВАННЯ MULTER (ЗАВАНТАЖЕННЯ ФОТО) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Вказуємо, що файли треба зберігати в папку cachePath
        cb(null, cachePath);
    },
    filename: function (req, file, cb) {
        // Генеруємо унікальне ім'я файлу (щоб файли з однаковими назвами не перезаписали один одного)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- 4. НАЛАШТУВАННЯ EXPRESS ---

app.use(express.json()); // Щоб сервер розумів JSON
app.use(express.urlencoded({ extended: true })); // Щоб сервер розумів дані з форм

// --- 5. МАРШРУТИ (ENDPOINTS) ---
// GET /inventory - Отримання списку всіх речей
app.get('/inventory', (req, res) => {
    // Створюємо новий список, де замість імені файлу буде посилання
    const responseList = inventory.map(item => {
        return {
            id: item.id,
            name: item.name,
            description: item.description,
            // Формуємо посилання: /inventory/<ID>/photo
            photo: item.photo ? `/inventory/${item.id}/photo` : null
        };
    });

    res.json(responseList);
});
app.post('/register', upload.single('photo'), (req, res) => {
    // Отримуємо текстові дані з форми
    const { inventory_name, description } = req.body;

    // Перевірка: Ім'я обов'язкове 
    if (!inventory_name) {
        return res.status(400).send('Bad Request: inventory_name is required');
    }

    // Створюємо новий об'єкт
    const newItem = {
        id: Date.now().toString(), // Генеруємо ID
        name: inventory_name,
        description: description || '',
        // Якщо фото завантажено, зберігаємо його ім'я, інакше null
        photo: req.file ? req.file.filename : null
    };

    // Додаємо в масив
    inventory.push(newItem);

    // Повертаємо статус 201 Created [cite: 80]
    res.status(201).send('Created');
});
// GET /inventory/:id - Отримання інформації про конкретну річ
app.get('/inventory/:id', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);

    if (!item) {
        return res.status(404).send('Not found');
    }
    const responseItem = {
        id: item.id,
        name: item.name,
        description: item.description,
        // Якщо фото є, формуємо повне посилання: /inventory/<ID>/photo
        photo: item.photo ? `/inventory/${item.id}/photo` : null
    };

    res.json(responseItem);
});

// Головна сторінка (для тесту)
app.get('/', (req, res) => {
    res.send('Inventory Service is Running. Use Postman to test /register and /inventory');
});

// Запуск сервера
app.listen(options.port, options.host, () => {
    console.log(`Server running on http://${options.host}:${options.port}`);
});
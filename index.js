const { program } = require('commander');
const express = require('express'); // Підключаємо Express
const app = express(); // Створюємо програму
const multer = require('multer');
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
// PUT /inventory/:id - Оновлення імені або опису
app.put('/inventory/:id', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);

    if (!item) {
        return res.status(404).send('Not found');
    }

    // Оновлюємо поля, якщо вони передані
    if (req.body.name) {
        item.name = req.body.name;
    }
    if (req.body.description) {
        item.description = req.body.description;
    }

    res.json(item); // Повертаємо оновлений об'єкт
});
// GET /inventory/:id/photo - Отримання фото зображення
app.get('/inventory/:id/photo', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);

    if (!item || !item.photo) {
        return res.status(404).send('Not found');
    }

    const photoPath = path.join(cachePath, item.photo);
    // res.sendFile автоматично встановлює правильний Content-Type
    res.setHeader('Content-Type', 'image/jpeg');
    res.sendFile(photoPath);
});
// PUT /inventory/:id/photo - Оновлення фото
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);

    if (!item) {
        return res.status(404).send('Not found');
    }

    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    // Оновлюємо посилання на нове фото
    item.photo = req.file.filename;

    res.send('Photo updated');
});
// DELETE /inventory/:id - Видалення речі
app.delete('/inventory/:id', (req, res) => {
    const index = inventory.findIndex(i => i.id === req.params.id);

    if (index === -1) {
        return res.status(404).send('Not found');
    }

    // Видаляємо 1 елемент починаючи зі знайденого індексу
    inventory.splice(index, 1);
    res.send('Deleted');
});
app.get('/RegisterForm.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

app.get('/SearchForm.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'SearchForm.html'));
});
// POST /search - Пошук пристрою
app.post('/search', (req, res) => {
    const { id, has_photo } = req.body; // Отримуємо дані з форми

    const item = inventory.find(i => i.id === id);

    if (!item) {
        return res.status(404).send('Not Found');
    }

    // Створюємо копію об'єкта, щоб не змінювати оригінал в базі
    let responseItem = { ...item };

    // Логіка з прапорцем has_photo (згідно завдання)
    if (has_photo === 'on' || has_photo === 'true') {
        responseItem.description += ` Photo link: /inventory/${item.id}/photo`;
    }

    res.json(responseItem);
});
// --- ОБРОБКА ПОМИЛОК 405 (Method Not Allowed) ---

// Для /register дозволено тільки POST, решта - 405
app.all('/register', (req, res) => {
    res.status(405).send('Method Not Allowed');
});

// Для /inventory дозволено GET, решта - 405
// (Увага: це перехопить тільки точний URL /inventory)
app.all('/inventory', (req, res) => {
    res.status(405).send('Method Not Allowed');
});

// Для /search дозволено POST, решта - 405
app.all('/search', (req, res) => {
    res.status(405).send('Method Not Allowed');
});

// Для конкретних речей /inventory/:id ми маємо GET, PUT, DELETE.
// Якщо прийшов POST чи PATCH - повертаємо 405.
app.all('/inventory/:id', (req, res) => {
    res.status(405).send('Method Not Allowed');
});
// Головна сторінка (для тесту)
app.get('/', (req, res) => {
    res.send('Inventory Service is Running. Use Postman to test /register and /inventory');
});

// Запуск сервера
app.listen(options.port, options.host, () => {
    console.log(`Server running on http://${options.host}:${options.port}`);
});
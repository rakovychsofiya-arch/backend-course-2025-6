const { program } = require('commander');
const http = require('node:http');
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
const server = http.createServer(async (req, res) => {
    console.log(`NEW REQUEST: ${req.method} ${req.url}`);
    const fileId = req.url.slice(1);

    if (!fileId) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
    }

    const filePath = path.join(cachePath, fileId + '.jpeg');

});

server.listen(options.port, options.host, () => {
    console.log(`Server running on http://${options.host}:${options.port}`);
});
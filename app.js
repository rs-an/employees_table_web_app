const http = require('node:http');
const path = require('node:path');
const express = require('express');
const mysql = require('mysql2/promise');
const { WebSocketServer, WebSocket } = require('ws');

const fields = ['name', 'middle_name', 'surname', 'department', 'position', 'birthday', 'tel', 'email'];
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'employees',
    password: process.env.DB_PASSWORD || 'employees_local',
    database: process.env.DB_NAME || 'employeeDB',
    connectionLimit: 5,
    charset: 'utf8mb4',
});
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});
app.use('/public', express.static(path.join(__dirname, 'public')));
for (const [route, file] of Object.entries({
    '/vendor/jquery.js': 'jquery/dist/jquery.min.js',
    '/vendor/datatables.js': 'datatables.net/js/dataTables.min.js',
    '/vendor/datatables.css': 'datatables.net-dt/css/dataTables.dataTables.min.css',
})) {
    app.get(route, (req, res) => res.sendFile(path.join(__dirname, 'node_modules', file)));
}
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views/index.html')));
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok' });
    } catch {
        res.status(503).json({ status: 'database unavailable' });
    }
});

server.on('upgrade', (req, socket, head) => {
    const expectedOrigin = `http://${req.headers.host}`;
    if (req.url !== '/ws' || req.headers.origin !== expectedOrigin) {
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
});
function send(ws, event) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
}
function broadcast(event) {
    for (const client of wss.clients) if (client.initialized) send(client, event);
}
function validId(id) {
    return Number.isSafeInteger(id) && id > 0;
}
function validate(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) return false;
    if (event.requestId !== undefined && (typeof event.requestId !== 'string' || event.requestId.length > 64)) return false;
    if (event.type === 'addRow') {
        if (event.employee === undefined) return true; // Existing clients can still add an empty row.
        return validChanges(event.employee) && fields.every(field => Object.hasOwn(event.employee, field));
    }
    if (event.type === 'updateEmployee') return validId(event.id) && validChanges(event.changes);
    if (!validId(event.id)) return false;
    if (event.type === 'removeRow') return true;
    if (event.type !== 'replaceData' || !fields.includes(event.destination)) return false;
    if (typeof event.data !== 'string' || [...event.data].length > 32) return false;
    if (event.destination === 'department' && !['', 'HR', 'marketing', 'development'].includes(event.data)) return false;
    if (event.destination === 'email' && event.data && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(event.data)) return false;
    if (event.destination === 'birthday' && event.data) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(event.data)) return false;
        const date = new Date(`${event.data}T00:00:00Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== event.data) return false;
    }
    return true;
}
function validChanges(changes) {
    return changes !== null && typeof changes === 'object' && !Array.isArray(changes)
        && Object.keys(changes).length > 0
        && Object.entries(changes).every(([destination, data]) => validate({ type: 'replaceData', id: 1, destination, data }));
}
// A single queue keeps snapshots and writes in the same order for every client.
let queue = Promise.resolve();
function enqueue(ws, action) {
    queue = queue.then(action).catch(error => {
        console.error('Database operation failed:', error.code || error.message);
        send(ws, { type: 'error', message: 'Не удалось сохранить или загрузить данные. Переподключитесь и повторите действие.' });
    });
}
wss.on('connection', ws => {
    ws.initialized = false;
    ws.on('error', error => console.error('WebSocket:', error.message));
    enqueue(ws, async () => {
        const [employees] = await pool.query('SELECT * FROM employees ORDER BY id');
        send(ws, { type: 'allEmployees', employees });
        ws.initialized = true;
    });
    ws.on('message', raw => {
        let event;
        try { event = JSON.parse(raw.toString()); } catch {
            send(ws, { type: 'error', message: 'Некорректный формат сообщения.' });
            return;
        }
        if (!ws.initialized || !validate(event)) {
            send(ws, { type: 'error', message: 'Проверьте данные: максимум 32 символа, корректный email и дата ДД-ММ-ГГГГ.' });
            return;
        }
        enqueue(ws, async () => {
            if (event.type === 'addRow') {
                const [result] = await pool.execute(
                    'INSERT INTO employees (name, middle_name, surname, department, position, birthday, tel, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    fields.map(field => event.employee?.[field] || '')
                );
                broadcast({ type: 'addRow', employee: { id: result.insertId, ...Object.fromEntries(fields.map(field => [field, event.employee?.[field] || ''])) }, requestId: event.requestId });
            } else if (event.type === 'removeRow') {
                await pool.execute('DELETE FROM employees WHERE id = ?', [event.id]);
                broadcast({ type: 'removeRow', id: event.id, requestId: event.requestId });
            } else if (event.type === 'updateEmployee') {
                // All column names and values have passed the same validation as individual edits.
                const columns = Object.keys(event.changes);
                const assignments = columns.map(column => `\`${column}\` = ?`).join(', ');
                const [result] = await pool.execute(`UPDATE employees SET ${assignments} WHERE id = ?`, [...Object.values(event.changes), event.id]);
                if (!result.affectedRows) {
                    send(ws, { type: 'error', message: 'Сотрудник уже удалён. Обновите справочник.' });
                    return;
                }
                broadcast({ type: 'updateEmployee', id: event.id, changes: event.changes, requestId: event.requestId });
            } else {
                // The column name has been checked against a fixed allowlist above.
                const [result] = await pool.execute(`UPDATE employees SET \`${event.destination}\` = ? WHERE id = ?`, [event.data, event.id]);
                if (!result.affectedRows) {
                    send(ws, { type: 'error', message: 'Сотрудник уже удалён. Переподключитесь для обновления таблицы.' });
                    return;
                }
                broadcast(event);
            }
        });
    });
});
async function start() {
    try {
        await pool.query('SELECT id FROM employees LIMIT 1');
        server.listen(port, host, () => console.log(`Справочник сотрудников: http://${host}:${port}`));
    } catch (error) {
        console.error(`Не удалось подключиться к БД (${error.code || error.message}). Проверьте .env и запустите MySQL: docker compose up -d db`);
        await pool.end();
        process.exitCode = 1;
    }
}
server.on('error', async error => {
    console.error('Ошибка запуска HTTP-сервера:', error.code || error.message);
    await pool.end();
    process.exitCode = 1;
});
async function stop() {
    for (const client of wss.clients) client.terminate();
    wss.close();
    server.close();
    await queue;
    await pool.end();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
start();

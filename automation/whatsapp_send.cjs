/**
 * whatsapp_send.cjs
 * 
 * Sends a PDF file via WhatsApp using whatsapp-web.js (FREE — no Twilio needed).
 * 
 * Usage:
 *   node whatsapp_send.cjs --to 923212772720 --file ./reports/report.pdf --message "Your report is ready"
 * 
 * First run: Scan the QR code with your phone (Settings > Linked Devices > Link a Device).
 * After first scan, the session is saved and no QR is needed again.
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

// ── Parse CLI args ──
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i].replace('--', '');
    args[key] = process.argv[i + 1];
}

const TO_NUMBER = args.to || '923212772720';
const FILE_PATH = args.file || '';
const MESSAGE = args.message || '📊 Your automated report is ready.';

// ── Start ──
console.log('[WhatsApp] 🚀 Script starting...');
console.log(`[WhatsApp] Target: ${TO_NUMBER}`);
console.log(`[WhatsApp] File: ${FILE_PATH}`);

// ── Initialize Client ──
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: path.join(__dirname, '.wwebjs_auth'),
    }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1018972166-alpha.html',
    },
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ],
    },
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[WhatsApp] ❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[WhatsApp] ❌ Uncaught Exception:', err);
});

console.log('[WhatsApp] 🔧 Listeners configured.');
const TIMEOUT_MS = 300000; // 5 mins for QR setup

const timeout = setTimeout(() => {
    console.error('[WhatsApp] ❌ TIMEOUT: Could not connect within 5 minutes.');
    process.exit(1);
}, TIMEOUT_MS);

client.on('loading_screen', (percent, message) => {
    console.log(`[WhatsApp] ⏳ Loading: ${percent}% - ${message}`);
});

// ── QR Code (only needed on first run) ──
client.on('qr', (qr) => {
    console.log('\n[WhatsApp] ⚡ QR Code received! Scan with your phone:\n');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('[WhatsApp] ✅ Authenticated!');
});

client.on('auth_failure', (msg) => {
    console.error(`[WhatsApp] ❌ Auth failure: ${msg}`);
    process.exit(1);
});

// ── On Ready: Send message ──
client.on('ready', async () => {
    console.log('[WhatsApp] 🚀 Client ready!');
    clearTimeout(timeout);

    try {
        // Resolve recipient (Phone or Group)
        const chatName = TO_NUMBER;
        let chatId;

        // Priority 1: Check if it's a phone number (Mostly digits)
        const cleanNumber = chatName.replace(/\D/g, '');
        if (cleanNumber.length >= 10 && !chatName.match(/[a-z]/i)) {
            console.log(`[WhatsApp] 👤 Treating as number: ${cleanNumber}`);
            const numberDetails = await client.getNumberId(cleanNumber);
            if (numberDetails) {
                chatId = numberDetails._serialized;
                console.log(`[WhatsApp] 👤 Found Contact: ${cleanNumber}`);
            }
        }

        // Priority 2: If not resolved yet, check groups (only if explicitly requested or numeric resolution failed)
        if (!chatId) {
            try {
                console.log('[WhatsApp] 🔍 Checking groups...');
                const chats = await client.getChats();
                const group = chats.find(chat => chat.isGroup && chat.name === chatName);
                if (group) {
                    console.log(`[WhatsApp] 👥 Found Group: ${group.name} (${group.id._serialized})`);
                    chatId = group.id._serialized;
                }
            } catch (e) {
                console.warn(`[WhatsApp] ⚠️ Warning: Failed to fetch group list: ${e.message}`);
                // If it wasn't a number and group lookup failed, we are stuck
            }
        }

        if (!chatId) {
            console.error(`[WhatsApp] ❌ Could not resolve target '${chatName}'`);
            process.exit(1);
        }

        console.log(`[WhatsApp] ✅ Target Resolved: ${chatId}`);

        let messageObj;
        if (FILE_PATH && fs.existsSync(FILE_PATH)) {
            console.log(`[WhatsApp] 📄 Sharing PDF: ${path.resolve(FILE_PATH)}`);
            const media = MessageMedia.fromFilePath(path.resolve(FILE_PATH));

            messageObj = await client.sendMessage(chatId, media, {
                caption: MESSAGE,
                sendMediaAsDocument: true
            });
            console.log(`[WhatsApp] ✅ PDF Message ID: ${messageObj.id._serialized}`);
        } else {
            if (FILE_PATH) console.warn(`[WhatsApp] ⚠️ File not found: ${FILE_PATH}`);
            messageObj = await client.sendMessage(chatId, MESSAGE);
            console.log(`[WhatsApp] ✅ Text Message ID: ${messageObj.id._serialized}`);
        }

        console.log('[WhatsApp] ⏳ Waiting for server acknowledgment...');

        // Wait for ACK or timeout
        let ackResolved = false;
        const ackPromise = new Promise((resolve) => {
            const checkAck = (msg) => {
                if (msg.id._serialized === messageObj.id._serialized && msg.ack >= 1) {
                    console.log(`[WhatsApp] 📡 Message acknowledged by server (ack=${msg.ack})`);
                    client.off('message_ack', checkAck);
                    ackResolved = true;
                    resolve();
                }
            };
            client.on('message_ack', checkAck);

            // Fallback: wait at most 30 seconds for ACK
            setTimeout(() => {
                if (!ackResolved) {
                    console.warn('[WhatsApp] ⚠️ Timeout waiting for ACK, continuing anyway.');
                    client.off('message_ack', checkAck);
                    resolve();
                }
            }, 30000);
        });

        await ackPromise;
        console.log('[WhatsApp] 🏁 Finished sending.');

        // 5-second buffer to ensure page sync
        console.log('[WhatsApp] ⏳ Syncing (5s)...');
        await new Promise(r => setTimeout(r, 5000));

        console.log('[WhatsApp] ✅ DONE');

        // Graceful shutdown
        await client.destroy();
        process.exit(0);

    } catch (err) {
        console.error(`[WhatsApp] ❌ ERROR: ${err.message}`);
        if (err.stack) console.error(err.stack);
        await client.destroy();
        process.exit(1);
    }
});

client.on('change_state', state => {
    console.log(`[WhatsApp] 🔄 State changed: ${state}`);
});

client.on('disconnected', (reason) => {
    console.log(`[WhatsApp] 🔌 Disconnected: ${reason}`);
});

console.log('[WhatsApp] ⏳ Initializing client...');
client.initialize();

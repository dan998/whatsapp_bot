const { default: makeWASocket, DisconnectReason, useSingleFileAuthState } = require('@adiwajshing/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');

// Authentication file
const { state, saveState } = useSingleFileAuthState('./auth_info.json');

const startBot = () => {
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('Connected to WhatsApp');
        }
    });

    sock.ev.on('creds.update', saveState);

    sock.ev.on('messages.upsert', async (msg) => {
        const message = msg.messages[0];
        if (!message.message) return;

        const from = message.key.remoteJid;
        const content = message.message.conversation;

        console.log(`Received message: ${content}`);

        if (content === '!ping') {
            await sock.sendMessage(from, { text: 'Pong!' });
        } else if (content.startsWith('!echo ')) {
            const reply = content.split('!echo ')[1];
            await sock.sendMessage(from, { text: reply });
        } else if (content === '!time') {
            const time = new Date().toLocaleTimeString();
            await sock.sendMessage(from, { text: `Current time is ${time}` });
        } else {
            await sock.sendMessage(from, { text: 'Unknown command. Try !ping, !echo, or !time.' });
        }
    });
};

startBot();

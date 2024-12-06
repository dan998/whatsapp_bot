const express = require('express');
const { Server } = require('ws');
const { Client } = require('whatsapp-web.js');
const cors = require('cors');

const app = express();
app.use(cors());

let wss;

// Handle regular HTTP requests
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Setup WebSocket when running in production
if (process.env.NODE_ENV === 'production') {
    const server = require('http').createServer(app);
    wss = new Server({ server });
    
    wss.on('connection', handleConnection);
    
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
} else {
    // Development setup
    const devServer = require('http').createServer(app);
    wss = new Server({ server: devServer });
    
    wss.on('connection', handleConnection);
    
    devServer.listen(3000, () => {
        console.log('Development server running on port 3000');
    });
}

function handleConnection(ws) {
    console.log('New client connected');
    
    const client = new Client({
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        }
    });
    
    client.on('qr', (qr) => {
        ws.send(JSON.stringify({
            type: 'qr',
            qr: qr
        }));
    });
    
    client.on('ready', () => {
        ws.send(JSON.stringify({
            type: 'ready'
        }));
    });
    
    client.on('message', (message) => {
        ws.send(JSON.stringify({
            type: 'message',
            message: `${message.from}: ${message.body}`
        }));
    });
    
    client.initialize();
    
    ws.on('message', async (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'send') {
            try {
                const chatId = message.phone.includes('@c.us') 
                    ? message.phone 
                    : `${message.phone}@c.us`;
                    
                await client.sendMessage(chatId, message.message);
                
                ws.send(JSON.stringify({
                    type: 'message',
                    message: `Sent to ${message.phone}: ${message.message}`
                }));
            } catch (error) {
                console.error('Error sending message:', error);
            }
        }
    });
    
    ws.on('close', () => {
        client.destroy();
        console.log('Client disconnected');
    });
}

// Export for Vercel serverless deployment
module.exports = app;

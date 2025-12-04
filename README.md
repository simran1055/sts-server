# Supertonic WebSocket Server

WebSocket server for real-time translation calls in the Supertonic Translator app.

## Features

- Real-time bidirectional messaging between clients
- Call management (request, accept, reject, end)
- Room-based communication
- User presence tracking
- Message routing and broadcasting

## Requirements

- Node.js 18+
- npm or yarn

## Installation

```bash
npm install
```

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `ws://localhost:8080` by default.

## Environment Variables

- `PORT` - Server port (default: 8080)

Example:
```bash
PORT=3000 npm start
```

## Deployment

### Local Network (for testing on physical devices)

1. Start the server on your computer
2. Find your local IP address:
   - macOS/Linux: `ifconfig | grep inet`
   - Windows: `ipconfig`
3. Use `ws://YOUR_LOCAL_IP:8080` in the Flutter app

### Cloud Deployment

#### Heroku

```bash
heroku create your-app-name
git push heroku main
```

Update Flutter app to use: `wss://your-app-name.herokuapp.com`

#### Railway

1. Connect your GitHub repo to Railway
2. Railway will auto-detect the Node.js app
3. Set environment variables if needed
4. Deploy

Update Flutter app to use: `wss://your-project.railway.app`

#### AWS/DigitalOcean/etc.

1. Deploy `websocket-server` folder to your server
2. Install Node.js and dependencies
3. Run with PM2 or similar process manager:
   ```bash
   npm install -g pm2
   pm2 start server.js --name supertonic-ws
   pm2 save
   pm2 startup
   ```
4. Set up reverse proxy (nginx) if needed
5. Update Flutter app with your server URL

## API / Message Types

### Client → Server

**Register**
```json
{
  "type": "register",
  "payload": {
    "userId": "user123",
    "speakLanguage": "en-US",
    "listenLanguage": "es-ES"
  }
}
```

**Send Translation**
```json
{
  "type": "translation",
  "payload": {
    "originalText": "Hello",
    "translatedText": "Hola",
    "fromLanguage": "en-US",
    "toLanguage": "es-ES",
    "timestamp": "2025-12-05T00:00:00Z"
  }
}
```

**Typing Indicator**
```json
{
  "type": "typing",
  "payload": {
    "userId": "user123"
  }
}
```

**Call Request**
```json
{
  "type": "callRequest",
  "payload": {
    "from": "user123",
    "to": "user456"
  }
}
```

**Call Accept**
```json
{
  "type": "callAccept",
  "payload": {
    "userId": "user456",
    "roomId": "room-uuid"
  }
}
```

**Call End**
```json
{
  "type": "callEnd",
  "payload": {
    "userId": "user123",
    "roomId": "room-uuid"
  }
}
```

### Server → Client

**Registration Success**
```json
{
  "type": "register",
  "payload": {
    "success": true,
    "clientId": "client-uuid",
    "message": "Successfully registered"
  }
}
```

**Incoming Translation**
```json
{
  "type": "translation",
  "payload": {
    "originalText": "Hello",
    "translatedText": "Hola",
    "fromLanguage": "en-US",
    "toLanguage": "es-ES",
    "timestamp": "2025-12-05T00:00:00Z"
  }
}
```

**Error**
```json
{
  "type": "error",
  "payload": {
    "message": "Error description"
  }
}
```

## Health Check

The server provides a health check endpoint:

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "ok",
  "clients": 2,
  "rooms": 1
}
```

## Architecture

### Components

- **WebSocket Server**: Handles persistent connections
- **Client Registry**: Tracks connected users and their language preferences
- **Room Manager**: Manages call sessions between users
- **Message Router**: Routes messages between appropriate clients

### Message Flow

```
Client A                Server              Client B
   |                      |                     |
   |---Register---------->|                     |
   |<--Register OK--------|                     |
   |                      |<----Register--------|
   |                      |-----Register OK---->|
   |                      |                     |
   |---Translation------->|                     |
   |                      |----Translation----->|
   |                      |                     |
   |<--Translation--------|<---Translation------|
   |                      |                     |
```

## Troubleshooting

### Port already in use
```bash
# Find process using port 8080
lsof -i :8080

# Kill the process
kill -9 <PID>
```

### WebSocket connection refused
- Check firewall settings
- Verify server is running
- For cloud deployments, ensure WebSocket upgrade is enabled

### Messages not routing
- Check server logs for errors
- Verify both clients are connected
- Check client IDs and room IDs

## Development

### Running Tests

```bash
npm test
```

### Debugging

Enable debug logging:
```javascript
// In server.js, add:
const DEBUG = true;
```

### Adding Features

The server is modular and easy to extend:
- Add new message types in `handleMessage()`
- Implement custom routing logic
- Add authentication/authorization
- Integrate with databases for persistence

## License

MIT License - see parent project for details

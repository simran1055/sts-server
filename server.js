const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Store connected clients with their info
const clients = new Map();
const rooms = new Map();

console.log(`WebSocket server is running on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  console.log('New client connected');
  const clientId = uuidv4();

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(ws, clientId, message);
    } catch (error) {
      console.error('Error parsing message:', error);
      sendError(ws, 'Invalid message format');
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    handleDisconnect(clientId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleMessage(ws, clientId, message) {
  const { type, payload, timestamp } = message;
  console.log(`Received ${type} from ${clientId}:`, payload);

  switch (type) {
    case 'register':
      handleRegister(ws, clientId, payload);
      break;

    case 'translation':
      handleTranslation(clientId, payload);
      break;

    case 'typing':
      handleTyping(clientId);
      break;

    case 'callRequest':
      handleCallRequest(clientId, payload);
      break;

    case 'callAccept':
      handleCallAccept(clientId, payload);
      break;

    case 'callReject':
      handleCallReject(clientId);
      break;

    case 'callEnd':
      handleCallEnd(clientId, payload);
      break;

    default:
      console.log(`Unknown message type: ${type}`);
      sendError(ws, `Unknown message type: ${type}`);
  }
}

function handleRegister(ws, clientId, payload) {
  const { userId, speakLanguage, listenLanguage } = payload;

  clients.set(clientId, {
    ws,
    userId,
    speakLanguage,
    listenLanguage,
    roomId: null,
    partnerId: null,
  });

  console.log(`Registered user: ${userId} (speaks: ${speakLanguage}, listens: ${listenLanguage})`);

  send(ws, 'register', {
    success: true,
    clientId,
    message: 'Successfully registered',
  });

  // Broadcast available users
  broadcastUserList();
}

function handleTranslation(clientId, payload) {
  const client = clients.get(clientId);
  if (!client) {
    console.error('Client not found:', clientId);
    return;
  }

  const { roomId, partnerId } = client;

  // If in a room, send to partner
  if (roomId && partnerId) {
    const partner = clients.get(partnerId);
    if (partner && partner.ws.readyState === WebSocket.OPEN) {
      send(partner.ws, 'translation', payload);
      console.log(`Forwarded translation from ${clientId} to ${partnerId}`);
    }
  } else {
    // Broadcast to all other clients (for demo/testing)
    clients.forEach((otherClient, otherClientId) => {
      if (
        otherClientId !== clientId &&
        otherClient.ws.readyState === WebSocket.OPEN
      ) {
        send(otherClient.ws, 'translation', payload);
      }
    });
  }
}

function handleTyping(clientId) {
  const client = clients.get(clientId);
  if (!client) return;

  const { roomId, partnerId } = client;

  if (roomId && partnerId) {
    const partner = clients.get(partnerId);
    if (partner && partner.ws.readyState === WebSocket.OPEN) {
      send(partner.ws, 'typing', { userId: client.userId });
    }
  }
}

function handleCallRequest(clientId, payload) {
  const { from, to } = payload;
  const roomId = uuidv4();

  // Find the target client
  let targetClientId = null;
  for (const [cId, client] of clients.entries()) {
    if (client.userId === to) {
      targetClientId = cId;
      break;
    }
  }

  if (!targetClientId) {
    const client = clients.get(clientId);
    sendError(client.ws, 'Target user not found');
    return;
  }

  // Create room
  rooms.set(roomId, {
    caller: clientId,
    callee: targetClientId,
    status: 'pending',
  });

  // Update client info
  const caller = clients.get(clientId);
  caller.roomId = roomId;

  // Send call request to target
  const callee = clients.get(targetClientId);
  send(callee.ws, 'callRequest', {
    from,
    roomId,
  });

  console.log(`Call request from ${from} to ${to}, room: ${roomId}`);
}

function handleCallAccept(clientId, payload) {
  const { roomId } = payload;
  const room = rooms.get(roomId);

  if (!room) {
    const client = clients.get(clientId);
    sendError(client.ws, 'Room not found');
    return;
  }

  room.status = 'active';

  // Update both clients
  const caller = clients.get(room.caller);
  const callee = clients.get(room.callee);

  caller.roomId = roomId;
  caller.partnerId = room.callee;

  callee.roomId = roomId;
  callee.partnerId = room.caller;

  // Notify both parties
  send(caller.ws, 'callAccept', { roomId });
  send(callee.ws, 'callAccept', { roomId });

  console.log(`Call accepted in room: ${roomId}`);
}

function handleCallReject(clientId) {
  // Find and close the room
  for (const [roomId, room] of rooms.entries()) {
    if (room.callee === clientId) {
      const caller = clients.get(room.caller);
      if (caller) {
        send(caller.ws, 'callReject', {});
        caller.roomId = null;
        caller.partnerId = null;
      }
      rooms.delete(roomId);
      console.log(`Call rejected in room: ${roomId}`);
      break;
    }
  }
}

function handleCallEnd(clientId, payload) {
  const client = clients.get(clientId);
  if (!client) return;

  const { roomId, partnerId } = client;

  if (roomId && partnerId) {
    const partner = clients.get(partnerId);
    if (partner && partner.ws.readyState === WebSocket.OPEN) {
      send(partner.ws, 'callEnd', {});
      partner.roomId = null;
      partner.partnerId = null;
    }

    rooms.delete(roomId);
    client.roomId = null;
    client.partnerId = null;

    console.log(`Call ended in room: ${roomId}`);
  }
}

function handleDisconnect(clientId) {
  const client = clients.get(clientId);
  if (!client) return;

  // End any active call
  if (client.roomId) {
    handleCallEnd(clientId, { roomId: client.roomId });
  }

  clients.delete(clientId);
  broadcastUserList();
}

function send(ws, type, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type,
        payload,
        timestamp: new Date().toISOString(),
      })
    );
  }
}

function sendError(ws, message) {
  send(ws, 'error', { message });
}

function broadcastUserList() {
  const userList = Array.from(clients.values()).map((client) => ({
    userId: client.userId,
    speakLanguage: client.speakLanguage,
    listenLanguage: client.listenLanguage,
    inCall: client.roomId !== null,
  }));

  clients.forEach((client) => {
    send(client.ws, 'userList', { users: userList });
  });
}

// Health check endpoint
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        clients: clients.size,
        rooms: rooms.size,
      })
    );
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

console.log('WebSocket server ready for connections');
console.log(`Health check available at http://localhost:${PORT}/health`);

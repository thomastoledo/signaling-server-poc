const PORT = 8000;

const express = require('express');
const app = express();
const serverApp = require('http').createServer(app);

const chatServer = require('./chat-server');

app.use(express.static(__dirname + '/public'));
app.get('/', function(req, res) {
	res.render('index.ejs');
});

serverApp.listen(PORT);

const WebSocket = require('ws');
const server = new WebSocket.Server({
  port: 8080
});

let sockets = [];
server.on('connection', function(socket) {
  sockets.push(socket);

  socket.on('message', function(msg) {
    handleMessage(parseMsg(msg), this);
  });

  // When a socket closes, or disconnects, remove it from the array.
  socket.on('close', function() {
    sockets = sockets.filter(s => s !== socket);
  });
});

const TYPES = {
  NEW_USER: 'newUser',
  SIGNAL_MESSAGE_FROM_CLIENT: 'signal_message_from_client',
  DISCONNECTING: 'disconnecting',
  JOINED_ROOM: 'joined_room',
  SIGNAL_MESSAGE_TO_CLIENT: 'signal_message_to_client'
}

const SIGNAL_TYPES = {
  USER_HERE: 'userHere'
}

function handleMessage({type, content}, socket) {
  switch (type) {
    case TYPES.NEW_USER:
      onNewUser(content, socket);
      break;
    case TYPES.SIGNAL_MESSAGE_FROM_CLIENT: 
      onSignal(content, socket);
      break;
    case TYPES.DISCONNECTING:
      onDisconnecting();
      break;
    default:
      break;
  };
}

function onNewUser({userFrom, userTo}, socket) {

    chatServer.connectUsers(userFrom, userTo, socket);
    const signalingUiid = chatServer.generateSignalingIdForRoom(socket.room);
    
    const signalingMsg = prepareMsg({type: TYPES.SIGNAL_MESSAGE_TO_CLIENT, content: {signalType: SIGNAL_TYPES.USER_HERE, message: signalingUiid}});
    broadcastToMe(signalingMsg, socket);
    
    const roomMsg = prepareMsg({type: TYPES.JOINED_ROOM, content: {room: socket.room}});
    broadcastToMe(roomMsg, socket);
    
		if (chatServer.areUsersConnected(userFrom, userTo)) {
			console.log(`User ${userFrom} and user ${userTo} are now connected to room ${socket.room}`);
    }
}

function onSignal({signalType, message}, socket) {
  const signalingMsg = prepareMsg({type: TYPES.SIGNAL_MESSAGE_TO_CLIENT, content: {signalType, message, room: socket.room}});
  broadcastToRoomButMe(signalingMsg, socket);
}

function onDisconnecting(socket) {
  	console.log('disconnecting from socket');
		chatServer.disconnectUsers(socket.room);
}

function prepareMsg(msg) {
  return JSON.stringify(msg);
}

function parseMsg(msg) {
  return JSON.parse(msg);
}

function broadcastToMe(msg, socket) {
  socket.send(msg);
}

function broadcastToRoomButMe(msg, currSocket) {
  sockets.filter(socket => socket.room === currSocket.room && socket !== currSocket).forEach(socket => socket.send(msg));
}
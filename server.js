const PORT = 3000;

const express = require('express');
const app = express();
const server = require('http').createServer(app);
const options = { /* ... */ };
const io = require('socket.io')(server, options);

const chatServer = require('./chat-server');

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
	res.render('index.ejs');
});

io.on('connect', (socket) => {
	socket.on('newUser', function({userFrom, userTo}) {
		const userHereMsg = `User ${userFrom} wants to connect with ${userTo}`;

		console.log(userHereMsg);

		chatServer.connectUsers(userFrom, userTo, socket);
		const room = chatServer.getRoom(userFrom, userTo);
		io.to(room).emit('joined_room', {room});

		io.to(room).emit('signaling_message', {
			type: 'user_here', 
			message: userHereMsg
		})

		if (chatServer.areUsersConnected(userFrom, userTo)) {
			console.log(`User ${userFrom} and user ${userTo} are now connected to room ${room}`);
		}
	});

	socket.on('message', function({message}) {
		console.log(`New message sent: ${message}`);
	});

	socket.on('signal', function({type, message, room}) {
		socket.to(room).emit('signaling_message', {type, message});
	});
});

console.log(`server started on port ${PORT}`);

server.listen(PORT);
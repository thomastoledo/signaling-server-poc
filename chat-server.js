const pendingConnections = {};
const establishedConnections = {};
const rooms = {};
const uuids = {};

let signalingId = 1;

function connectUsers(userFrom, userTo, socket) {
    let room;
    if (!alreadyAsked(userFrom, userTo)) {
        if (!alreadyAsked(userTo, userFrom)) {
            startConnectionBetweenUsers(userFrom, userTo);
            room = `${userFrom}${userTo}`.replace(' ', '');
        } else {
            finishConnectionBetweenUsers(userTo, userFrom);
            room = `${userTo}${userFrom}`.replace(' ', '');
        }
        if (!rooms[room]) {
            rooms[room] = [];
        }
        rooms[room].push(userFrom);
        joinRoom(room, socket);
    }
}

function generateSignalingIdForRoom(room) {
    if (!uuids[room]) {
        uuids[room] = signalingId;
        signalingId++;
    }
    return uuids[room];
}

function joinRoom(room, socket) {
    console.log(`Joingin room ${room}`);
    socket.room = room;
}

function startConnectionBetweenUsers(user1, user2) {
    pendingConnections[user1] = user2;
    console.log(`starting connection between users ${user1} and ${user2}`);
}

function finishConnectionBetweenUsers(user2, user1) {
    console.log(`finishing connection between users ${user1} and ${user2}`);
    establishedConnections[user1] = user2;
    delete pendingConnections[user1];
    delete pendingConnections[user2];
}

function alreadyAsked(userTo, userFrom) {
    return pendingConnections[userTo] === userFrom;
}


function areUsersConnected(user1, user2) {
    return establishedConnections[user1] === user2 || establishedConnections[user2] === user1;
}

function existsRoom(room) {
    console.log(`rooms[${room}]`, rooms[room]);
    return !!rooms[room];
}

function disconnectUsers(room) {
    const [user1, user2] = rooms[room] || [];
    delete pendingConnections[user1];
    delete pendingConnections[user2];
    delete establishedConnections[user1];
    delete establishedConnections[user2];
    delete rooms[room];
}

module.exports = {
    connectUsers,
    areUsersConnected,
    disconnectUsers,
    existsRoom,
    generateSignalingIdForRoom
}
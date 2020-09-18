
import { 
    myVideoArea, 
    otherVideoArea, 
    startStream, 
    displayStream 
} from './video.js';
import { 
    displayElement, 
    displayMessage, 
    hideElement, 
    logError
} from './functions.js';

const connectBtn = document.querySelector('#connect');
const name = document.getElementById('name');
const recipientName = document.getElementById('recipient');
const message = document.querySelector('#message');
const sendMessage = document.querySelector('#sendMessage');
const chatArea = document.querySelector('#chatArea');
const signalingArea = document.querySelector('#signalingArea');

let room;
let socket;

let signalingChannel;
const signalingMsgQueue = [];
const configuration = {iceServers: [{url: 'stun:stun.l.google.com:19302'}]};
let rtcPeerConn;

let isNegotiating = false;

connectBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!name.value || !recipientName.value) {
        return;
    }
    connect(name.value, recipientName.value);
    hideElement('connect-section');
    displayElement('chat-section');
    message.focus();
});

sendMessage.addEventListener('click', (e) => {
    e.preventDefault();
    if (!message.value) {
        return;
    }

    // if it's open we send, else we queue
    if (signalingChannel.readyState === 'open') {
        signalingChannel.send(message.value);
    } else {
        signalingMsgQueue.push(message.value);
    }
    displayMessage(chatArea, message.value);
    message.value = '';
});

/**
 * @brief connect two users via webRTC
 * @param {string} userFrom 
 * @param {string} userTo 
 */
function connect(userFrom, userTo) {
    // Connexion au server SocketIO
    socket = io();
    // When the socket is connected to the server
    socket.on('connect', () => onConnect(userFrom, userTo));

    // When a user joined a room
    socket.on('joined_room', (res) => { room = res.room });

    // Now those are our signaling events
    socket.on('signaling_message', ({type, message}) => {

        onSignalingMessage(type, message);
    })

    // If the rtcPeerConnection is not set, we set it
    if (!rtcPeerConn) {
        startSignaling();
    }
}

function onSignalingMessage(type, message) {
    switch (type) {
        case 'ice_candidate': {
            //it's an ICE Candidate we just received
            onSignalingMessageICECandidate(message);
            break;
        }
        case 'SDP': {
            // the remote peer just made us an offer
            onSignalingMessageSDP(message, rtcPeerConn, socket, room);
            break;
        }
        case 'user_here': {
            onSignalingMessageUserHere(message);
            break;
        }
        default:
            break;
    }
}

function onSignalingMessageICECandidate(message) {
    const { candidate } = JSON.parse(message);
    rtcPeerConn.addIceCandidate(new RTCIceCandidate(candidate));
}

function onSignalingMessageUserHere(message) {
    const id = message;
    // We create a new dataChannel with the same name as the WebSocket room
    if (!signalingChannel) {
        initiateSignalingChannel(id);

    }
}

function initiateSignalingChannel(id) {
    signalingChannel = rtcPeerConn.createDataChannel(room, { negotiated: true, id });

    signalingChannel.onmessage = function ({ data }) { displayMessage(chatArea, data) };

    signalingChannel.onopen = function () {
        // at opening, just send every queued message
        signalingMsgQueue.forEach(msg => this.send(msg));
        // and then clear the queue
        signalingMsgQueue.length = 0;
    };
}

function startSignaling() {
    // initializing the RTCPeerConnection
    rtcPeerConn = new RTCPeerConnection(configuration);

    // when the RTCPeerConnection received ICE Candidates from the STUN Server (in the "configuration" variable)
    rtcPeerConn.onicecandidate = onIceCandidate;

    // when we receive an offer, and we need to send back our own offer
    rtcPeerConn.onnegotiationneeded = onNegotiationNeeded;

    // Workaround for Chrome: skip nested negotiations
    rtcPeerConn.onsignalingstatechange = onSignalingStateChange;

    // once remote stream arrives, show it in the remote video element
    rtcPeerConn.ontrack = onTrack

    // get a local stream, show it in our video tag and add it to be sent
    startStream()
        .then(stream => displayStream(stream, myVideoArea))
        .then(stream => {
            stream.getTracks().forEach(track => {
                // send tracks to peer
                rtcPeerConn.addTrack(track, stream);
            });
        })
        .catch((e) => logError(e, `Could not start stream`));
}

function onTrack(e) {
    displayStream(e.streams[0], otherVideoArea);
}

function onSignalingStateChange() {
    console.log(rtcPeerConn.signalingState)
    isNegotiating = (rtcPeerConn.signalingState !== 'stable');
}

function onNegotiationNeeded() {
    if (isNegotiating) {
        return;
    }
    isNegotiating = true;
    rtcPeerConn.createOffer()
        .then(sendLocalDesc)
        .catch(logError);
}

function onIceCandidate(e) {
    if (e.candidate) {
        // send any ice candidates to the other peer
        socket.emit('signal', { type: 'ice_candidate', message: JSON.stringify({ candidate: e.candidate }), room });
    }
}

function onConnect(userFrom, userTo) {
    // We emit an event to connect both users (it's a request from userFrom)
    socket.emit('newUser', {userFrom, userTo});
}

function onSignalingMessageSDP(message) {
    const {sdp} = JSON.parse(message);
    rtcPeerConn.setRemoteDescription(sdp).then(() => {
        // if we received an offer, we need to answer
        if (rtcPeerConn.remoteDescription.type === 'offer') {
            rtcPeerConn.createAnswer(sendLocalDesc, logError);
        }
    }).catch(logError);
}

function sendLocalDesc(descriptor) {
    rtcPeerConn.setLocalDescription(descriptor, function() {
        socket.emit('signal', {type: 'SDP', message: JSON.stringify({sdp: rtcPeerConn.localDescription}), room});
    }, logError);
}

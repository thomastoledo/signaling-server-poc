
import {myVideoArea, otherVideoArea, startStream, displayStream} from './video.js';

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
    socket.on('connect', () => {
        // We emit an event to connect both users (it's a request from userFrom)
        socket.emit('newUser', {userFrom, userTo});
    });

    // When a user joined a room
    socket.on('joined_room', (res) => {
        // It's done in the server-side. Once it's done, this event is emitted
        // we store the current room
        room = res.room;
    });

    // Now those are our signaling events
    socket.on('signaling_message', ({type, message}) => {
        // Used for debugging
        displayMessage(signalingArea, `Signaling received of type ${type}`);

        // If the rtcPeerConnection is not set, we set it
        if (!rtcPeerConn) {
            startSignaling();
        }

        switch(type) {
            case 'ice_candidate': {
                displayMessage(signalingArea, `[SOCKET SIGNALING ICE_CANDIDATE] Candidate received`);
                //it's an ICE Candidate we just received
                const {candidate} = JSON.parse(message);
                rtcPeerConn.addIceCandidate(new RTCIceCandidate(candidate));
                break;
            }
            case 'SDP': {
                const {sdp} = JSON.parse(message);
                displayMessage(signalingArea, `[SOCKET SIGNALING SDP] SDP received from peer`);

                // the remote peer just made us an offer
                rtcPeerConn.setRemoteDescription(sdp).then(() => {
                    // if we received an offer, we need to answer
                    if (rtcPeerConn.remoteDescription.type === 'offer') {
                        displayMessage(signalingArea, `received offer ${JSON.stringify(sdp)}, initializing answer`);
                        rtcPeerConn.createAnswer(sendLocalDesc, logError);
                    }
                }).catch(logError);
                break;
            }
            case 'user_here': {
                const id = message;
                // We create a new dataChannel with the same name as the WebSocket room
                signalingChannel = rtcPeerConn.createDataChannel(room, {negotiated: true, id});

                signalingChannel.onopen = function() {
                    // at opening, just send every queued message
                    signalingMsgQueue.forEach(msg => this.send(msg));
                    // and then clear the queue
                    signalingMsgQueue.length = 0;
                }

                signalingChannel.onmessage = function({data}) {
                    displayMessage(chatArea, data);
                }
                break;
            }
            default:
                break;
        }
    })
}

function startSignaling() {
    displayMessage(signalingArea, `======== starting signaling... ========`);
    // initializing the RTCPeerConnection
    rtcPeerConn = new RTCPeerConnection(configuration);

    // when the RTCPeerConnection received ICE Candidates from the STUN Server (in the "configuration" variable)
    rtcPeerConn.onicecandidate = function(e) {
        if (e.candidate) {
            // send any ice candidates to the other peer
            socket.emit('signal', {type: 'ice_candidate', message: JSON.stringify({candidate: e.candidate}), room});
            displayMessage(signalingArea, '[ICE CANDIDATES TRIGGERED]');
        }
    }

    // when we receive an offer, and we need to send back our own offer
    rtcPeerConn.onnegotiationneeded = function() {
        if (isNegotiating) {
            return;
        }
        isNegotiating = true;
        displayMessage(signalingArea, 'on negotiation called, sending offer');
        rtcPeerConn.createOffer()
            .then(offer => {displayMessage(signalingArea, `Sending offer ${JSON.stringify(offer)}`); sendLocalDesc(offer)})
            .catch(logError);
    }

    rtcPeerConn.onsignalingstatechange = () => {  // Workaround for Chrome: skip nested negotiations
        isNegotiating = (rtcPeerConn.signalingState !== 'stable');
    }

    // once remote stream arrives, show it in the remote video element
    rtcPeerConn.ontrack = function(e) {
        displayMessage(signalingArea, '[ONTRACK] going to add their stream');
        displayStream(e.streams[0], otherVideoArea);
    }

    // get a local stream, show it in our video tag and add it to be sent
    startStream()
        .then(stream => displayStream(stream, myVideoArea))
        .then(stream => {
            stream.getTracks().forEach(track => {
                // send tracks to peer
                displayMessage(signalingArea, `sending tracks to peer`);
                rtcPeerConn.addTrack(track, stream);
            });
        })
        .catch((e) => logError(e, `Could not start stream`));
}

function sendLocalDesc(descriptor) {
    rtcPeerConn.setLocalDescription(descriptor, function() {
        displayMessage(signalingArea, 'sending local description');
        socket.emit('signal', {type: 'SDP', message: JSON.stringify({sdp: rtcPeerConn.localDescription}), room});
    }, logError);
}

function logError(error) {
    displayMessage(signalingArea, `the following error occured during signaling: ${error}`);
}

function hideElement(id) {
    document.getElementById(id)?.classList?.add('display-none');
}

function displayElement(id) {
    document.getElementById(id)?.classList?.remove('display-none');
}

function displayMessage(area, message) {
    const div = document.createElement('div');
    div.innerText = message;
    area.appendChild(div);
}
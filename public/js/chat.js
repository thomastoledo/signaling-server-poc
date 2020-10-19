
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

let room;
let socket;

let signalingChannel;
const signalingMsgQueue = [];
const candidatesQueue = [];
const configuration = {iceServers: [{url: 'stun:stun.l.google.com:19302'}]};
let rtcPeerConn;

let isNegotiating = false;

const TYPES = {
    NEW_USER: 'newUser',
    SIGNAL_MESSAGE_FROM_CLIENT: 'signal_message_from_client',
    DISCONNECTING: 'disconnecting',
    JOINED_ROOM: 'joined_room',
    SIGNAL_MESSAGE_TO_CLIENT: 'signal_message_to_client'
  }
const SIGNAL_TYPES = {
    USER_HERE: 'userHere',
    ICE_CANDIDATE: 'ice_candidate',
    SDP: 'SDP'
}


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

/**
 * @brief connect two users via webRTC
 * @param {string} userFrom 
 * @param {string} userTo 
 */
function connect(userFrom, userTo) {

    socket = new WebSocket('wss://glacial-beyond-33808.herokuapp.com');
    socket.onopen = () => {
        console.log('connected');
        onConnect(userFrom, userTo)
    }

    socket.onmessage = (msg) => {
        handleMessage(parseMsg(msg.data));
    }

    // If the rtcPeerConnection is not set, we set it
    if (!rtcPeerConn) {
        startSignaling();
    }
}

function onConnect(userFrom, userTo) {
    console.log('onConnect')
    socket.send(prepareMsg({type: TYPES.NEW_USER, content: {userFrom, userTo}}));
}

function prepareMsg(msg) {
    return JSON.stringify(msg);
}

function parseMsg(msg) {
    return JSON.parse(msg);
}

function handleMessage({type, content}) {
    switch (type) {
        case TYPES.JOINED_ROOM:
            room = content.room;
            break;
        case TYPES.SIGNAL_MESSAGE_TO_CLIENT: 
            onSignalingMessage(content);
            break;
        default:
            break;
      };
}

function onSignalingMessage({signalType, message}) {
    switch (signalType) {
        case SIGNAL_TYPES.ICE_CANDIDATE: {
            //it's an ICE Candidate we just received
            console.info('ICE CANDIDATE', new Date());
            onSignalingMessageICECandidate(message);
            break;
        }
        case SIGNAL_TYPES.SDP: {
            // the remote peer just made us an offer
            console.info('SDP', new Date());
            onSignalingMessageSDP(message, rtcPeerConn, socket, room);
            break;
        }
        case SIGNAL_TYPES.USER_HERE: {
            onSignalingMessageUserHere(message);
            break;
        }
        default:
            break;
    }
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

    // at opening, just send every queued message
    signalingChannel.onopen = onOpenSignalingChannel;
}

function onOpenSignalingChannel() {
    signalingMsgQueue.forEach(msg => signalingChannel.send(msg));
    // and then clear the queue
    signalingMsgQueue.length = 0;
}

function onSignalingMessageICECandidate(message) {
    const { candidate } = JSON.parse(message);
    console.log('candidate', candidate);

    if(!(rtcPeerConn?.remoteDescription?.type)){
        candidatesQueue.push(candidate);
    } else {
        rtcPeerConn.addIceCandidate(new RTCIceCandidate(candidate)).then((res) => console.log('fin', res)).catch(err => console.error('error!!', err));
    }
    
}

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
        console.log('onIceCandidate');
        socket.send(prepareMsg({type: TYPES.SIGNAL_MESSAGE_FROM_CLIENT, content: {signalType: SIGNAL_TYPES.ICE_CANDIDATE, message: JSON.stringify({ candidate: e.candidate })}}));
    }
}


function onSignalingMessageSDP(message) {
    const {sdp} = JSON.parse(message);
    rtcPeerConn.setRemoteDescription(sdp).then(() => {
        console.log('OH LA BELLE BLEUE')
        // if we received an offer, we need to answer
        if (rtcPeerConn.remoteDescription.type === 'offer') {
            rtcPeerConn.createAnswer(sendLocalDesc, logError);
        }
        sendQueuedCandidates();
    }).catch(logError);
}

function sendLocalDesc(descriptor) {
    rtcPeerConn.setLocalDescription(descriptor, function() {
        console.log('sendLocalDesc');
        socket.send(prepareMsg({type: TYPES.SIGNAL_MESSAGE_FROM_CLIENT, content: {signalType: SIGNAL_TYPES, message: JSON.stringify({sdp: rtcPeerConn.localDescription})}}));
    }, logError);
}    

function sendQueuedCandidates() {
    candidatesQueue.forEach(candidate => {
        rtcPeerConn.addIceCandidate(new RTCIceCandidate(candidate)).then((res) => console.log('fin', res)).catch(err => console.error('error!!', err));
    });
}
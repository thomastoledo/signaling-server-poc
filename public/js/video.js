// const profilePicCanvas = document.querySelector('#profilePicCanvas');
// const profilePictureOutput = document.querySelector('#profilePictureOutput');
// const takePicButton = document.querySelector('#takePicButton');

// on récupère la vidéo DOM
export const myVideoArea = document.getElementById('myVideoArea');
export const otherVideoArea = document.getElementById('otherVideoArea');

// on récupère le select que l'on va peupler
// const videoSelect = document.getElementById('camera');
const constraints = {
    video: {
        width: { min: 250, ideal: 500 },
        height: { min: 250, ideal: 500 },
        aspectRatio: { ideal: 1.7777777778 },
    },
    audio: {
        sampleSize: 16,
        channelCount: 2,
    }
}
// le stream courant
// let currentStream;
// let streaming = false; // used to determine when the video is loaded

// browsers do not implement this method the same way
// so we basically just affect the first one which is not null
navigator.getUserMedia = 
    navigator.getUserMedia || 
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia;


export async function startStream() {
    return await navigator.mediaDevices.getUserMedia(constraints).catch((e) => logError(e, `Could not get media stream`));
}

export function displayStream(mediaStream, videoArea) {
    videoArea.srcObject = mediaStream;
    return mediaStream;
}

function logError(error, msg = 'An error occured') {
    console.error(`${msg}`, error);
}

// let width = 240; // desired width for the profile picture
// let height = 0; // calculated later based on image ratio

// takePicButton.addEventListener('click', (e) => {
//     e.preventDefault();
//     takeProfilePic({width, height});
// });


// myVideoArea.addEventListener('canplay', debounce(until((e) => canPlay(e), () => !streaming), 100));

// function canPlay(e) {
//     height = myVideoArea.videoHeight / (myVideoArea.videoWidth/width);
    
//     // Firefox currently has a bug where the height can't be read from
//     // the video, so we will make assumptions if this happens.

//     if (isNaN(height)) {
//         height = width / (4/3);
//     }

//     myVideoArea.setAttribute('width', width);
//     myVideoArea.setAttribute('height', height);
//     profilePicCanvas.setAttribute('width', width);
//     profilePicCanvas.setAttribute('height', height);
//     streaming = true;
// }

// function takeProfilePic({width, height}) {
//     const context = profilePicCanvas.getContext('2d');
//     if(width && height) {
//         profilePicCanvas.width = width;
//         profilePicCanvas.height = height;
//         context.drawImage(myVideoArea, 0, 0, width, height);
//         const data = profilePicCanvas.toDataURL('image/png');
//         profilePictureOutput.setAttribute('src', data);
//     }
// }

// affichage ou non des streams avec la dropdown
// videoSelect.addEventListener('input', function(e) {
//     if (e.target.value === 'none') {
//         stopStream(currentStream);
//         hideStream(myVideoArea);
//     } else {
//         constraints.video.deviceId = e.target.value;
//         startStream(constraints)
//             .then(stream => currentStream = stream)
//             .then(stream => displayStream(stream, myVideoArea))
//             .catch((e) => logError(e, `Could not start stream`));
//     }
// });

// Récupérer les sources disponibles
// navigator.mediaDevices.enumerateDevices()
//     .then(getCamerasOptions)
//     .then(options => options.forEach(option => videoSelect.appendChild(option)))
//     .catch((e) => {logError(`An error occured trying to enumerate devices`, e)});

// function getCamerasOptions(devices) {
//     return devices
//     .filter(device => device.kind === 'videoinput')
//     .map((device, idx) => {
//         const option = document.createElement('option');
//         option.value = device.deviceId || device.groupId;
//         option.text = device.label || `camera-${idx}`;
//         return option;
//     });
// };

// function stopStream(mediaStream) {
//     mediaStream.getTracks().forEach(track => track.stop());
// }

// function hideStream(myVideoArea) {
//     myVideoArea.srcObject = null;
// }
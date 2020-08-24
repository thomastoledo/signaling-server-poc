// on récupère la vidéo DOM
export const myVideoArea = document.getElementById('myVideoArea');
export const otherVideoArea = document.getElementById('otherVideoArea');

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
import opus from './opus';
var remoteDestination, audioSourceNode, gainNode;

const constraints = {
    audio: true
};

// keep track of tab on which the extension is active
var tabID;
var port;

var play = false;
var firstTime = true;

var room;
var rtcConn2 = null;
var audioElement = document.createElement('audio');
    audioElement.setAttribute("preload", "auto");
    audioElement.load;


chrome.runtime.onConnect.addListener(function (p) {
    port = p;
    
    p.onMessage.addListener(function (msg) {
        if (msg.type == "init") {
            // optional parameter roomName.
            socket.emit("create room", msg.roomName);
        }
        /*
        if (msg.type == "play") {
            if(room != msg.msg){
                room = msg.msg
                console.log("Active session with ID: " + room + " found!");
                socket.emit("new peer", room);
                setSocketListeners(socket);
                const rtcConn3 = new RTCPeerConnection(servers);
                rtcConn3.onicecandidate = event => {
                    if (!event.candidate) {
                        console.log("No candidate for RTC connection");
                        return;
                    }
                    socket.emit("peer new ice", {
                        id: socket.id,
                        room: room,
                        candidate: event.candidate
                    });
                };
                rtcConn3.onaddstream = event => {
                    audioElement.srcObject = event.stream;
                };
                rtcConn2 = rtcConn3;
                audioElement.pause();
                play = false;
            }
            
            if(!play) {
                audioElement.play();
                play = true;
            } else {
                audioElement.pause();
                play = false;
            }
        
        }
        */
    });
});


function setSocketListeners(socket) {
    socket.on("src ice", iceData => {
        if (iceData.room !== room || iceData.id !== socket.id) {
            console.log("ICE Candidate not for me");
            return;
        }
        rtcConn2
            .addIceCandidate(new RTCIceCandidate(iceData.candidate))
            .then(console.log("Ice Candidate added successfully"))
            .catch(err => console.log(`ERROR on addIceCandidate: ${err}`));
    });

    socket.on("src desc", descData => {
        if (descData.room !== room || descData.id !== socket.id) {
            console.log("ICE Candidate not for me");
            return;
        }
        rtcConn2.setRemoteDescription(new RTCSessionDescription(descData.desc)).then(() => {
            console.log("Setting remote description success");
            createAnswer(descData.desc);
        });
    });
}

function createAnswer(desc) {
    rtcConn2.createAnswer().then(desc => {
        rtcConn2.setLocalDescription(new RTCSessionDescription(desc)).then(function () {
            socket.emit("peer new desc", {
                id: socket.id,
                room: room,
                desc: desc
            });
        });
    });
}

/**
 * allow user to mute/unmute the tab on which extension is running
 */
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
    if(changeInfo.mutedInfo && tabId === tabID) {
        window.audio.muted = changeInfo.mutedInfo.muted;
    }
});

/**
 * capture user's tab audio for sharing with peers
 */
function getTabAudio() {
    chrome.tabCapture.capture(constraints, function (stream) {
        if (!stream) {
            console.error("Error starting tab capture: " + (chrome.runtime.lastError.message || "UNKNOWN"));
            return;
        }
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            var currTab = tabs[0];
            if (currTab) { tabID = currTab.id; }
        });

        let tracks = stream.getAudioTracks(); // MediaStreamTrack[], stream is MediaStream
        let tabStream = new MediaStream(tracks);
        window.audio = document.createElement("audio");
        window.audio.srcObject = tabStream;
        window.audio.play();
        localAudioStream = tabStream;
        console.log("Tab audio captured. Now sending url to injected content script");
    });
}

chrome.browserAction.onClicked.addListener(injectTooninScripts);

function injectTooninScripts() {
    if(firstTime){
        firstTime = false;
        loadAdapter(); // load webRTC adapter
    } else {
        injectAppScript();
    }
}

function loadAdapter() {
    console.log("Starting Toonin Script Injection");
    chrome.tabs.executeScript({
        file: "js/lib/adapter.js"
    }, loadSocketIO)
}

function loadSocketIO() {
    chrome.tabs.executeScript({
        file: "js/lib/socket.io.js"
    }, injectAppScript)
}

function injectAppScript() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var activeTab = tabs[0];
        chrome.tabs.sendMessage(activeTab.id, {"message": "clicked_browser_action"});
      });
}

"use strict";
console.log("application script running");

var socket = io("http://www.toonin.ml:8100");

var peers = {};
var localAudioStream;
var roomID;

const servers = {
    iceServers: [{
        urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
            "stun:stun3.l.google.com:19302",
            "stun:stun4.l.google.com:19302"
        ]
    }]
};

// Set up to exchange only audio.
const offerOptions = {
    offerToReceiveAudio: 1
};

/**
 * convert captured tab stream to a streamable form
 */
function getStreamableData() {
    var audioContext = new AudioContext();
    gainNode = audioContext.createGain();
	gainNode.connect(audioContext.destination);
    audioSourceNode = audioContext.createMediaStreamSource(localAudioStream); // of type MediaStreamAudioSourceNode
    remoteDestination = audioContext.createMediaStreamDestination();
    audioSourceNode.connect(remoteDestination);
}

/**
 * Start sharing user's tab audio with the peer with "peerID"
 * @param {string} peerID 
 */
function startShare(peerID) {
    console.log("Starting new connection for peer: " + peerID);
    const rtcConn = new RTCPeerConnection(servers);
    getStreamableData();

    rtcConn.addTrack(remoteDestination.stream.getAudioTracks()[0]);
    peers[peerID].rtcConn = rtcConn;
    console.log(peers);
    peers[peerID].rtcConn.onicecandidate = function (event) {
        if (!event.candidate) {
            console.log("No candidate for RTC connection");
            return;
        }
        peers[peerID].iceCandidates.push(event.candidate);
        socket.emit("src new ice", {
            id: peerID,
            room: roomID,
            candidate: event.candidate
        });
    };

    rtcConn.createOffer(offerOptions).then((desc) => {
        opus.preferOpus(desc.sdp);
        rtcConn.setLocalDescription(new RTCSessionDescription(desc)).then(function () {
            peers[peerID].localDesc = desc;
            socket.emit("src new desc", {
                id: peerID,
                room: roomID,
                desc: desc
            });
        });
    });
}

/* **************** *
 * Socket Listeners *
 * **************** */
socket.on("room created", (newRoomID) => {
    console.log("New room created with ID: " + newRoomID);
    roomID = newRoomID;
    port.postMessage({
        type: "roomID",
        roomID: newRoomID
    });
    getTabAudio();
});

// server unable to create a room
socket.on("room creation failed", (reason) => {
    port.postMessage({
        type: "room creation fail",
        reason: reason
    });
})

// new peer connection
socket.on("peer joined", (peerData) => {
    console.log("New peer has joined the room");
    peers[peerData.id] = {
        id: peerData.id,
        room: peerData.room,
        iceCandidates: []
    };
    startShare(peerData.id);
});

socket.on("peer ice", (iceData) => {
    console.log("Ice Candidate from peer: " + iceData.id + " in room: " + iceData.room);
    console.log("Ice Candidate: " + iceData.candidate);
    if (roomID != iceData.room || !(iceData.id in peers)) {
        console.log("Ice Candidate not for me");
        return;
    }
    peers[iceData.id].rtcConn
        .addIceCandidate(new RTCIceCandidate(iceData.candidate))
        .then(console.log("Ice Candidate added successfully for peer: " + iceData.id))
        .catch(function (err) {
            console.log("Error on addIceCandidate: " + err);
        });
});

socket.on("peer desc", (descData) => {
    console.log("Answer description from peer: " + descData.id + " in room: " + descData.room);
    console.log("Answer description: " + descData.desc);
    if (roomID != descData.room || !(descData.id in peers)) {
        console.log("Answer Description not for me");
        return;
    }
    peers[descData.id].rtcConn
        .setRemoteDescription(new RTCSessionDescription(descData.desc))
        .then(function () {
            console.log("Remote description set successfully for peer: " + descData.id);
        })
        .catch(function (err) {
            console.log("Error on setRemoteDescription: " + err);
        });
});

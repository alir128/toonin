!function(e){var n={};function o(t){if(n[t])return n[t].exports;var r=n[t]={i:t,l:!1,exports:{}};return e[t].call(r.exports,r,r.exports,o),r.l=!0,r.exports}o.m=e,o.c=n,o.d=function(e,n,t){o.o(e,n)||Object.defineProperty(e,n,{configurable:!1,enumerable:!0,get:t})},o.r=function(e){Object.defineProperty(e,"__esModule",{value:!0})},o.n=function(e){var n=e&&e.__esModule?function(){return e.default}:function(){return e};return o.d(n,"a",n),n},o.o=function(e,n){return Object.prototype.hasOwnProperty.call(e,n)},o.p="",o(o.s=1)}([function(e,n,o){"use strict";var t=function(e,n){var o=e.match(n);return o&&2==o.length?o[1]:null},r=function(e,n){for(var o=e.split(" "),t=new Array,r=0,i=0;i<o.length;i++)3===r&&(t[r++]=n),o[i]!==n&&(t[r++]=o[i]);return t.join(" ")},i=function(e,n){for(var o=e[n].split(" "),r=e.length-1;r>=0;r--){var i=t(e[r],/a=rtpmap:(\d+) CN\/\d+/i);if(i){var c=o.indexOf(i);-1!==c&&o.splice(c,1),e.splice(r,1)}}return e[n]=o.join(" "),e};e.exports={preferOpus:function(e){for(var n=e.split("\r\n"),o=0;o<n.length;o++)if(-1!==n[o].search("m=audio")){var c=o;break}if(null===c)return e;for(o=0;o<n.length;o++)if(-1!==n[o].search("opus/48000")){var a=t(n[o],/:(\d+) opus\/48000/i);a&&(n[c]=r(n[c],a));break}return e=(n=i(n,c)).join("\r\n")}}},function(e,n,o){"use strict";var t,r=o(0),i=(t=r)&&t.__esModule?t:{default:t};var c,a={audio:!0};function s(){chrome.tabs.executeScript({file:"js/lib/socket.io.js"},d)}function d(){chrome.tabs.executeScript({file:"js/inject.js"},function(){chrome.runtime.lastError?console.error(chrome.runtime.lastError.message):console.log("All scripts successfully loaded")})}chrome.runtime.onConnect.addListener(function(e){c=e,e.onMessage.addListener(function(e){"init"==e.type&&p.emit("create room")})}),chrome.browserAction.onClicked.addListener(function(){console.log("Starting Toonin Script Injection"),chrome.tabs.executeScript({file:"js/lib/adapter.js"},s)}),console.log("application script running");var l,u,f,p=io("http://10.0.0.82:8100"),m={},g=[],h=!1,C=null,v=null,w=0,b={iceServers:[{urls:["stun:stun.l.google.com:19302","stun:stun2.l.google.com:19302","stun:stun3.l.google.com:19302","stun:stun4.l.google.com:19302"]}]},j={offerToReceiveAudio:1};function y(e,n){var o=new AudioContext;new Response(e).arrayBuffer().then(function(e){o.decodeAudioData(e,function(e){n.send(e.duration.toString()),w=e.duration})})}function D(){var e=new MediaRecorder(l,{audioBitsPerSecond:128e3,mimeType:'audio/webm;codecs="opus"'});u=e}function S(e){console.log("Starting new connection for peer: "+e);var n=new RTCPeerConnection(b);m[e].rtcConn=n,console.log(m),m[e].dataChannel=n.createDataChannel(e+"-audioChannel"),g.push(m[e].dataChannel),m[e].dataChannel.addEventListener("open",function(n){h||(u.ondataavailable=function(e){if(C)v=new Blob([C,e.data]),new Response(v).arrayBuffer().then(function(e){for(var n=0;n<g.length;n++)g[n].send(e)});else{C=e.data;for(var n=0;n<g.length;n++)y(e.data,g[n])}},u.start(),h=!0),0!==w&&m[e].dataChannel.send(w.toString())}),m[e].rtcConn.onicecandidate=function(n){n.candidate?(m[e].iceCandidates.push(n.candidate),p.emit("src new ice",{id:e,room:f,candidate:n.candidate})):console.log("No candidate for RTC connection")},n.createOffer(j).then(function(o){i.default.preferOpus(o.sdp),n.setLocalDescription(new RTCSessionDescription(o)).then(function(){m[e].localDesc=o,p.emit("src new desc",{id:e,room:f,desc:o})})})}setInterval(function(){if(u&&h)try{u.requestData()}catch(e){}},150),p.on("room created",function(e){var n;console.log("New room created with ID: "+e),f=e,c.postMessage({type:"roomID",roomID:e}),n=D,chrome.tabCapture.capture(a,function(e){if(e){var o=e.getAudioTracks(),t=new MediaStream(o);window.audio=document.createElement("audio"),window.audio.srcObject=t,l=t,n(),console.log("Tab audio captured. Now sending url to injected content script")}else console.error("Error starting tab capture: "+(chrome.runtime.lastError.message||"UNKNOWN"))})}),p.on("peer joined",function(e){console.log("New peer has joined the room"),m[e.id]={id:e.id,room:e.room,iceCandidates:[]},S(e.id)}),p.on("peer ice",function(e){console.log("Ice Candidate from peer: "+e.id+" in room: "+e.room),console.log("Ice Candidate: "+e.candidate),f==e.room&&e.id in m?m[e.id].rtcConn.addIceCandidate(new RTCIceCandidate(e.candidate)).then(console.log("Ice Candidate added successfully for peer: "+e.id)).catch(function(e){console.log("Error on addIceCandidate: "+e)}):console.log("Ice Candidate not for me")}),p.on("peer desc",function(e){console.log("Answer description from peer: "+e.id+" in room: "+e.room),console.log("Answer description: "+e.desc),f==e.room&&e.id in m?m[e.id].rtcConn.setRemoteDescription(new RTCSessionDescription(e.desc)).then(function(){console.log("Remote description set successfully for peer: "+e.id)}).catch(function(e){console.log("Error on setRemoteDescription: "+e)}):console.log("Answer Description not for me")})}]);
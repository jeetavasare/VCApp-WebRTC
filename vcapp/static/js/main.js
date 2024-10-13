console.log("hello there")

var mapPeers = {}

var UsernameInput = document.querySelector('#username')
var btnJoin = document.querySelector('#btn-join')

var username;
var webSocket

function webSocketOnMessage(event){
    var parsedData = JSON.parse(event.data)
    var message = parsedData['message']
    var peerUsername = parsedData['peer']
    var action = parsedData['action']

    if(username == peerUsername){ //if client recieves own channel name ignore
        return;
    }

    var receiver_channel_name = parsedData['message']['receiver_channel_name'] //else pickup the receiver_channel_name

    if(action == 'new-peer'){ //if action is new peer we need to make a offer so we call teh createOfferer method
        createOfferer(peerUsername,receiver_channel_name)
        return
    }

    if(action=='new-offer'){
        var offer = parsedData['message']['sdp']

        createAnswerer(offer,peerUsername,receiver_channel_name)

        return
    }

    if(action == 'new-answer'){
        var answer = parsedData['message']['sdp']

        var peer = mapPeers[peerUsername][0]

        peer.setRemoteDescription(answer)

        return
    }
}
btnJoin.addEventListener('click', ()=>{
    username = UsernameInput.value


    console.log('username',username)
    if(username == ''){
        return;
    }
    UsernameInput.value = ''
    UsernameInput.disabled = true
    UsernameInput.style.visibility = 'hidden'
    
    btnJoin.disabled = true
    btnJoin.style.visibility = 'hidden'
    
    var labelUsername = document.querySelector('#label-username')
    labelUsername.innerHTML = username


    var loc = window.location
    var wsStart = 'ws://'

    if(loc.protocol == 'https:'){
        wsStart = 'wss://' //websocket secure
    }

    var endPoint = wsStart + loc.host + loc.pathname
    console.log(endPoint)
    
    webSocket = new WebSocket(endPoint)

    webSocket.addEventListener('open', (e)=>{
        console.log('connection open')

        sendSignal('new-peer',{}); //send signal of type new-peer to notify others they need to send a new offer
    })

    webSocket.addEventListener('message', webSocketOnMessage)

    webSocket.addEventListener('close', (e)=>{
        console.log('connection closed')
    })

    webSocket.addEventListener('error', (e)=>{
        console.log('error occured')
    })
    

})

var localStream = new MediaStream()

const constraints = {
    'video': true,
    'audio':true
}
const localVideo = document.querySelector('#local-video')

const btnToggleAudio = document.querySelector('#btn-toggle-audio')
const btnToggleVideo = document.querySelector('#btn-toggle-video')


var userMedia = navigator.mediaDevices.getUserMedia(constraints).then(stream => {
    localStream = stream
    localVideo.srcObject = localStream
    localVideo.muted = true

    var audioTracks = stream.getAudioTracks()
    var videoTracks = stream.getVideoTracks()

    audioTracks[0].enabled = true
    videoTracks[0].enabled = true

    btnToggleAudio.addEventListener('click',()=>{
        audioTracks[0].enabled = !audioTracks[0].enabled 

        if(audioTracks[0].enabled){
            btnToggleAudio.innerHTML = 'Audio Mute'
            return 
        }

        btnToggleAudio.innerHTML = 'Audio Unmute'
    })


    btnToggleVideo.addEventListener('click',()=>{
        videoTracks[0].enabled = !videoTracks[0].enabled 

        if(videoTracks[0].enabled){
            btnToggleVideo.innerHTML = 'Video off'
            return 
        }

        btnToggleVideo.innerHTML = 'Video On'



    })

}).catch(error =>{
    console.log("error ",error) //cannot get media device error
})

var btnSendMsg = document.querySelector('#btn-send-msg')
var messageList = document.querySelector("#message-list")
var messageInput = document.querySelector('#msg')

btnSendMsg.addEventListener('click',sendMsgOnClick)

function sendMsgOnClick(){
    var message = messageInput.value

    var li = document.createElement('li')
    li.appendChild(document.createTextNode('Me: '+message))

    messageList.appendChild(li)

    var dataChannels = getDataChannels()

    message = username + ': ' + message

    for(index in dataChannels){
        dataChannels[index].send(message)
    }

    messageInput.value = ''
}

function sendSignal(action, message){
    var jsonStr = JSON.stringify({
        'peer': username,
        'action': action,
        'message': message,
    })

    webSocket.send(jsonStr)
}

function createOfferer(peerUsername, receiver_channel_name){
    var peer = new RTCPeerConnection(null)

    console.log('offerer adding local tracks')
    addLocalTracks(peer) // add the local audio and video to the peer so that it can be streamed to the other peer


    var dc = peer.createDataChannel('channel')
    dc.addEventListener('open',()=>{
        console.log("connection open!")
    })


    dc.addEventListener('message', dcOnMessage)

    var remoteVideo = createVideo(username)
    setOnTrack(peer, remoteVideo)

    mapPeers[peerUsername] = [peer,dc]

    peer.addEventListener('iceconnectionstatechange',()=>{
        var iceConnectionState = peer.iceConnectionState

        if(iceConnectionState==='failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed'){
            delete mapPeers[peerUsername]

            if(iceConnectionState != 'closed'){
                peer.close()
            }

            removeVideo(remoteVideo)
        }
    })

    peer.addEventListener('icecandidate', (event)=>{
        if(event.candidate){
            console.log('new ice candidate', JSON.stringify(peer.localDescription))
            return
        }


        sendSignal('new-offer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name
        })

        peer.createOffer().then(o=>{
            peer.setLocalDescription(o).then(()=>{
                console.log('Local description set successfully')
            })
        })

    })
}

function createAnswerer(offer, peerUsername,receiver_channel_name){
    var peer1 = new RTCPeerConnection(null)

    console.log('offerer adding local tracks')
    addLocalTracks(peer1) // add the local audio and video to the peer so that it can be streamed to the other peer


    var remoteVideo = createVideo(username)
    setOnTrack(peer1, remoteVideo)

    peer1.addEventListener('datachannel',(e)=>{
        peer1.dc = e.channel
        peer1.dc.addEventListener('open',()=>{
            console.log("connection open!")
        })
        peer1.dc.addEventListener('message', dcOnMessage)


        mapPeers[peerUsername] = [peer1,dc]
    })

    

    peer1.addEventListener('iceconnectionstatechange',()=>{
        var iceConnectionState = peer1.iceConnectionState

        if(iceConnectionState==='failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed'){
            delete mapPeers[peerUsername]

            if(iceConnectionState != 'closed'){
                peer1.close()
            }

            removeVideo(remoteVideo)
        }
    })

    peer1.addEventListener('icecandidate', (event)=>{
        if(event.candidate){
            console.log('new ice candidate', JSON.stringify(peer1.localDescription))
            return
        }


        sendSignal('new-answer', {
            'sdp': peer1.localDescription,
            'receiver_channel_name': receiver_channel_name
        })

        peer1.setRemoteDescription(offer).then(()=>{
            console.log('Remote description set successfully for %s', peerUsername)

            return peer1.createAnswer()
        }).then(a=>{
            console.log('Answer created')

            peer1.setLocalDescription(a)
        })

    })
}


function addLocalTracks(peer){
    localStream.getTracks().forEach(track =>{
        console.log(peer.addTrack(track,localStream))
    })

    return
}

function dcOnMessage(event){
    var message = event.data

    var li = document.createElement('li')
    li.appendChild(document.createTextNode(message))


    messageList.appendChild(li)
}


function createVideo(peerUsername){
    var videoContainer = document.querySelector('#video-container')

    var remoteVideo = document.createElement('video')

    remoteVideo.id = peerUsername + '-video'
    remoteVideo.autoplay = true
    remoteVideo.playsInline = true

    var videoWrapper = document.createElement('div')
    videoContainer.appendChild(videoWrapper)

    videoWrapper.appendChild(remoteVideo)

    return remoteVideo
}

function setOnTrack(peer,remoteVideo){
    var remoteStream = new MediaStream()
    remoteVideo.srcObject = remoteStream
    
    peer.addEventListener('track',async (event) => {
        remoteStream.addTrack(event.track, remoteStream)
    })
}

function removeVideo(video){
    var videoWrapper = video.parentNode

    videoWrapper.parentNode.removeChild(videoWrapper)
}
function getDataChannels(){
    var dataChannels = []
    for(let peerUsername in mapPeers){
        var dataChannel = mapPeers[peerUsername][1]

        dataChannels.push(dataChannel)
    }

    return dataChannels
}
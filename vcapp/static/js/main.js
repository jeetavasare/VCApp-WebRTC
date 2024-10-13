console.log("hello there")

var UsernameInput = document.querySelector('#username')
var btnJoin = document.querySelector('#btn-join')

var username;
var webSocket

function webSocketOnMessage(event){
    var parsedData = JSON.parse(event.data)
    var message = parsedData['message']

    console.log('message' ,message)
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

        var jsonStr = JSON.stringify({
            'message': 'This is a message'
        })

        webSocket.send(jsonStr)
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
var userMedia = navigator.mediaDevices.getUserMedia(constraints).then(stream => {
    localStream = stream
    localVideo.srcObject = localStream
    localVideo.muted = true
}).catch(error =>{
    console.log("error ",error)
})
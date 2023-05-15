/**
 * @author Alpha
 */

const express = require('express');
const bodyParser = require('body-parser');


const socketio = require('socket.io');
const e = require('express');
var app = express();
const fs = require('fs');
const https = require('https');
const { url } = require('inspector');
app.use(express.static(__dirname + "/Uploads"));

// parse application/x-www-form-urlencoded
// { extended: true } : support nested object
// Returns middleware that ONLY parses url-encoded bodies and 
// This object will contain key-value pairs, where the value can be a 
// string or array(when extended is false), or any type (when extended is true)
app.use(bodyParser.urlencoded({ extended: true }));

//This return middleware that only parses json and only looks at requests where the Content-type
//header matched the type option. 
//When you use req.body -> this is using body-parser cause it is going to parse 
// the request body to the form we want
app.use(bodyParser.json());

let socketUsers = []; //maximum two users can join a room

let connectedUsers = new Map();


var Files = {};
var uploadFilePath;

var uploadsDir = './Uploads/';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

var server = app.listen(3000, () => {
    console.log('Server is running on port number 3000')
})


//Chat Server
var io = socketio.listen(server)

io.on('connection', function (socket) {

    //The moment one of your client connected to socket.io server it will obtain socket id
    //Let's print this out.
    console.log(`Connection : SocketId = ${socket.id}`)
    //Since we are going to use userName through whole socket connection, Let's make it global.   
    var userName = '';

    socket.on('subscribe', function (data) {
        console.log('subscribe trigged')
        const room_data = JSON.parse(data)
        userName = room_data.userName;
        const roomName = room_data.roomName;

        //checking room already exist
        if (io.sockets.adapter.rooms[`${roomName}`]) {
            io.to(`${room_data.socketId}`).emit('roomAlreadyExist');
        } else {
            socket.join(`${roomName}`)
            console.log(`Username : ${userName} joined Room Name : ${roomName}`)
            socketUsers.push(userName);
            addSocketUsers(roomName, userName);
        }


        //io.to : User who has joined can get a event;
        //socket.broadcast.to : all the users except the user who has joined will get the message
        // socket.broadcast.to(`${roomName}`).emit('newUserToChatRoom',userName);
        io.to(`${roomName}`).emit('newUserToChatRoom', userName);
    }

    )

    socket.on('unsubscribe', function (data) {
        console.log('unsubscribe trigged')
        const room_data = JSON.parse(data)
        const userName = room_data.userName;
        const roomName = room_data.roomName;


        console.log(`Username : ${userName} left Room Name : ${roomName}`)
        socket.broadcast.to(`${roomName}`).emit('userLeftChatRoom', userName)
        socket.leave(`${roomName}`)
        //removing it from socket users lists
        removeSocketUsers(roomName, userName)

    })

    socket.on('addNewUserToRoom', function (data) {
        console.log('addNewUserToRoom trigged')
        const room_data = JSON.parse(data)
        userName = room_data.userName;
        const roomName = room_data.roomName;
        socket.join(`${roomName}`)
        console.log(`Username : ${userName} joined Room Name : ${roomName}`)
        socketUsers.push(userName)
        addSocketUsers(roomName, userName)
        io.to(`${roomName}`).emit('newUserToChatRoom', userName);
    })

    socket.on('notifyOthersOnNewUser', function (data) {
        const room_data = JSON.parse(data)
        userName = room_data.userName;
        const roomName = room_data.roomName;
        console.log('onNewUser trigged')
        io.to(`${roomName}`).emit('onNewUser', userName);
    })


    function addSocketUsers(roomName, userName) {
        if (!connectedUsers.has(roomName)) {
            // no room found, add this one
            connectedUsers.set(roomName, [userName]);
        } else {
            // room found, add to the existing one
            connectedUsers.get(roomName).push(userName);
        }
        console.log(connectedUsers);
    }

    function removeSocketUsers(roomName, userName) {

        let userList = connectedUsers.get(roomName);
        // delete user
        if (userList != null) {
            userList = userList.filter(u => u !== userName);

            // update user list
            if (!userList.length) {
                // delete key if no more users in room
                connectedUsers.delete(roomName);
                const dir = './Uploads/' + roomName;
                if (fs.existsSync(dir)) {
                    fs.rmdir(dir, { recursive: true }, (err) => {
                        if (err) {
                            console.error(err);
                        }
                    });
                }
            } else {
                connectedUsers.set(roomName, userList);
            }

        }

    }


    function removeSocketUser(array, item, roomName) {
        for (var i in array) {
            if (array[i] == item) {
                array.splice(i, 1);
                if (array.length == 0) {
                    console.log("All users have left the room, time to delete the room data")
                    const dir = './Uploads/' + roomName;
                    fs.rmdir(dir, { recursive: true }, (err) => {
                        if (err) {
                            console.error(err);
                        }
                    });
                }
                break;
            }
        }
    }

    socket.on('newMessage', function (data) {
        console.log('newMessage triggered')

        const messageData = JSON.parse(data)
        const messageContent = messageData.messageContent
        const roomName = messageData.roomName
        const mimiType = messageData.mimiType
        const fileNameModified = messageData.fileNameModified

        console.log(`[Room Number ${roomName}] ${userName} : ${messageContent}`)
        // Just pass the data that has been passed from the writer socket

        const chatData = {
            userName: userName,
            messageContent: messageContent,
            roomName: roomName,
            mimiType: mimiType,
            fileNameModified: fileNameModified
        }
        socket.broadcast.to(`${roomName}`).emit('updateChat', JSON.stringify(chatData)) // Need to be parsed into Kotlin object in Kotlin
    })

    socket.on('roomJoinRequest', function (data) {

        console.log('roomJoinRequest triggered')

        const room_data = JSON.parse(data)
        userName = room_data.userName;
        const roomName = room_data.roomName;
        const requestSocketId = room_data.socketId;

        //checking room exist or not
        if (connectedUsers.has(roomName)) {
            if (connectedUsers.get(roomName).length == 2) {
                //sending response back the requested person
                io.to(`${room_data.socketId}`).emit('roomAlreadyFull')
            } else {
                io.to(`${roomName}`).emit('newUserRoomJoinRequest', data)
            }
        } else {
            io.to(`${room_data.socketId}`).emit('roomDoesNotExist')
        }

    })



    socket.on('songDedicationRequest', function (data) {

        console.log('songDedicationRequest triggered')

        const dedication_request_data = JSON.parse(data)
        const dedicatorName = dedication_request_data.dedicatorName;
        const dedicatedSongName = dedication_request_data.songName;
        const roomName = dedication_request_data.roomName;
        // console.log("roomName is"+roomName)

        socket.broadcast.to(`${roomName}`).emit('songDedicationRequestEvent', data)

        //checking room exist or not

        // if (connectedUsers.get(roomName).length == 2) {
        //     //sending response back the requested person
        //     io.to(`${room_data.socketId}`).emit('roomAlreadyFull')
        // } else {
        //     io.to(`${roomName}`).emit('newUserRoomJoinRequest', data)
        // }
    }

    )



    socket.on('acceptRequest', function (data) {

        console.log('acceptRequest Triggered')
        const room_data = JSON.parse(data)
        socket.broadcast.to(`${room_data.socketId}`).emit('requestAcceptCallback')


    })

    socket.on('rejectRequest', function (socketID) {

        console.log('rejectRequest Triggered')

        //Sending response back to the user who had requested to join the room
        socket.broadcast.to(`${socketID}`).emit('requestRejectCallback')

    })


    socket.on('songDedicationRejectRequest', function (socketID) {

        console.log('songDedicationRejectRequest Triggered')
        console.log(socketID)
        //Sending response back to the user who had requested to join the room
        socket.broadcast.to(`${socketID}`).emit('songDedicationRequestRejectCallback')

    })

    socket.on('songDedicationAcceptRequest', function (data) {

        console.log('songDedicationAcceptRequest Triggered')
        const dedication_data = JSON.parse(data)
        console.log(dedication_data.socketId)
        //Sending response back to the user who had requested to join the room
        socket.broadcast.to(`${dedication_data.socketId}`).emit('songDedicationRequestAcceptCallback', data)

    })



    socket.on('playMusicInSync', function (data) {

        console.log('playMusicInSync Triggered')
        const request_data = JSON.parse(data)
        console.log(request_data)

        socket.broadcast.to(`${request_data.roomName}`).emit('playMusicInSyncEvent', data)

    })

    socket.on('playPauseMusicInSync', function (roomName) {

        console.log('playPauseMusicInSync Triggered')


        socket.broadcast.to(`${roomName}`).emit('playPauseMusicInSyncEvent')

    })


    socket.on('seekBarProgressChangeSync', function (data) {

        console.log('seekBarProgressChangeSync Triggered')
        const request_data = JSON.parse(data)
        socket.broadcast.to(`${request_data.roomName}`).emit('seekBarProgressChangeSyncEvent', data)

    })



    socket.on('fileNotDownloaded', function (roomName) {

        console.log('fileNotDownloaded Triggered')

        socket.broadcast.to(`${roomName}`).emit('fileNotDownloadedEvent', roomName)

    })






    // socket.on('typing',function(roomNumber){ //Only roomNumber is needed here
    //     console.log('typing triggered')
    //     socket.broadcast.to(`${roomNumber}`).emit('typing')
    // })

    // socket.on('stopTyping',function(roomNumber){ //Only roomNumber is needed here
    //     console.log('stopTyping triggered')
    //     socket.broadcast.to(`${roomNumber}`).emit('stopTyping')
    // })



    socket.on('uploadFileStart', function (data) {

        var fileName = data['Name'];
        var fileSize = data['Size'];
        var userName = data['userName'];
        var roomName = data['roomName'];
        var Place = 0;

        var dir = './Uploads/' + roomName + '/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        const fileNameModified = fileName.split('.').join('-' + Date.now() + '.')
        uploadFilePath = dir + fileNameModified;

        console.log('uploadFileStart # Uploading file: %s to %s. Complete file size: %d', fileName, uploadFilePath, fileSize);

        Files[fileName] = {  //Create a new Entry in The Files Variable
            FileSize: fileSize,
            Data: "",
            Downloaded: 0
        }

        fs.open(uploadFilePath, "a", 0755, function (err, fd) {
            if (err) {
                console.log(err);
            }
            else {
                console.log('uploadFileStart # Requesting Place: %d Percent %d', Place, 0);
                Files[fileName]['Handler'] = fd; //We store the file handler so we can write to it later
                console.log('fileNameModified0-------------- ' + fileNameModified);
                socket.emit('uploadFileMoreDataReq', { 'Place': Place, 'Percent': 0, 'fileNameModified': fileNameModified });

                // Send webclient upload progress..
            }
        });
    });

    socket.on('uploadFileChuncks', function (data) {

        var Name = data['Name'];
        var base64Data = data['Data'];
        var fileNameModified = data['fileNameModified'];

        var playload = new Buffer(base64Data, 'base64').toString('binary');

        console.log('uploadFileChuncks # Got name: %s, received chunk size %d.', Name, playload.length);

        Files[Name]['Downloaded'] += playload.length;
        Files[Name]['Data'] += playload;

        if (Files[Name]['Downloaded'] == Files[Name]['FileSize']) //If File is Fully Uploaded
        {
            console.log('uploadFileChuncks # File %s receive completed', Name);
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function (err, Writen) {
                // close the file
                fs.close(Files[Name]['Handler'], function () {
                    console.log('file closed');
                });

                // Notify android client we are done.
                socket.emit('uploadFileCompleteRes', { 'IsSuccess': true, 'Name': Name, 'fileNameModified': fileNameModified });
            });
        }
        else if (Files[Name]['Data'].length > 10485760) { //If the Data Buffer reaches 10MB
            console.log('uploadFileChuncks # Updating file %s with received data', Name);

            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function (err, Writen) {
                Files[Name]['Data'] = ""; //Reset The Buffer
                var Place = Files[Name]['Downloaded'];
                var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;

                socket.emit('uploadFileMoreDataReq', { 'Place': Place, 'Percent': Percent, 'fileNameModified': fil });

                // Send webclient upload progress..

            });
        }
        else {
            var Place = Files[Name]['Downloaded'];
            var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
            console.log('uploadFileChuncks # Requesting Place: %d, Percent %s', Place, Percent);

            socket.emit('uploadFileMoreDataReq', { 'Place': Place, 'Percent': Percent, 'fileNameModified': fileNameModified });
            // Send webclient upload progress..
        }
    });


    socket.on('disconnect', function () {
        // console.log("socketUsers "+socketUsers.length)
        console.log("One of sockets disconnected from our server.")
    });

})

module.exports = server; //Exporting for test
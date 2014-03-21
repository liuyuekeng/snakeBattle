var express = require('express'),
    app = express(),
    http = require('http'),
    server = http.createServer(app),
    io = require('socket.io').listen(server),
    port = process.env.PORT || 3000;

server.listen(port);

var hosturl = "127.0.0.1";

//routs
app.use('/client', express.static(__dirname + '/client'));

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/client/index.html');
});

app.get(/^\/room\/([0-9a-zA-z]+)/, function(req, res){
  res.sendfile(__dirname + '/client/gameRoom.html');
});

//mongodb setting
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/snakeBattle');

var db = mongoose.Connection,
    Schema = mongoose.Schema;

var UserNameSchema = new Schema({
    name:String
});
var UserNameModel = mongoose.model('UserName',UserNameSchema);

var RoomSchema = new Schema({
    roomId:String,
    roomMember:[],
    readySet:[],
    snakesData:[]
});
var RoomModel = mongoose.model('Room', RoomSchema);

var setting = {
  boxSize : [90, 60],   //[w, h]for test
  snakesInit: [[[7,4],[6,4],[5,4],[4,4]],
               [[86,7],[86,6],[86,5],[86,4]],
               [[83,56],[84,56],[85,56],[86,56]],
               [[4,53],[4,54],[4,55],[4,56]]],
  snakesDir: ['d', 's', 'a', 'w'],
  bodyImg: ['cross',
            'diamond',
            'bone',
            'windmill'],
  targetScore: 120,
  speed: 500
}

//to sove clash problem
var queryQueue = {
  setName: [],
  creatRoom: [],
  findRoom: [],
  runningGame: [],
  remove: function(data, set){
    var index = this[set].indexOf(data);
    if (index != -1){
      this[set].splice(index, 1);
    }
  }
}

var RegExps = {
  idVerify: /^[0-9a-zA-Z_]{1,12}$/
};

//=================================================================================================================
//clesr rooms in db when start the server
RoomModel.find({}, function(err, doc){
    console.log("i:" + doc.length);
    for (var i in doc){
      console.log("find all:" + doc[i].id);
      doc[i].remove();
      console.log("remov all:" + doc[i].id);
    }
    console.log("DB clean!!");
});
//================================================================================================

//clear names in db when start the server
function cleanDbUser(){
  UserNameModel.find({}, function(err, results){
    if(results.length){
      for (var i in results){
        console.log(results[i]);
        var name = results[i].name;
        console.log(name);
        results[i].remove(function(n){
          return function(){
            console.log(n + " been remove");
          }
        }(name));
      }
    }
  });
}
cleanDbUser();

//warning messages
var messages = {
  wrapper : function(tag, cla, conten){
    return "<" + tag + " class=\"" + cla + "\">" + conten + "</" + tag +">";
  },
  setMessage : function(name, cla, message){
    this[name] = this.wrapper("div", cla, message);
  }
}
messages.setMessage("busy", "warning", "Busy, please try again later.");
messages.setMessage("registered", "warning", "Already registered, please pick anotherone.");
messages.setMessage("error", "warning", "Error, try again.");
messages.setMessage("needName", "warning", "Please set a name first.");
messages.setMessage("illegal", "warning", "You can only use numbers, letters, and underscores here (1-12).");
messages.setMessage("exitFirst", "warning", "You are in a room now, Please exit first.");
messages.setMessage("notExist", "warning", "RoomId does not exist.");
messages.setMessage("roomFull", "warning", "Sorry, the room is full.");
messages.setMessage("stateError", "warning", "Illegal state.");
messages.setMessage("setNoBusy", "displayNone", "");
messages.setMessage("notReady", "warning", "Some one in the room not ready yet.")

//socket.state: 0 in the beginning, 1 after setname, 2 after belong some room, 3 for ready, 4 for playing, 5 for dead
//write a middleware for some socket listenner latter?
io.sockets.on('connection', function(socket){

  socket.busy = false;
  socket.state = 0;

  socket.on('setName', function(data){
    if(socket.busy){
      socket.emit("warning",{$: "#name-warning",
                             message: messages.busy,
                             busy:true});
      return;
    }
    if (socket.state > 0){
      socket.emit("warning", {$: "#name-warning",
                              message: messages.stateError});
      return;
    }
    if(queryQueue.setName.indexOf(data) != -1){
      socket.emit("warning", {$: "#name-warning",
                              message: messages.busy});
      return;
    }
    //verification && clash test
    if(data && RegExps.idVerify.test(data)){
      queryQueue.setName.push(data);
      socket.busy = true;
      UserNameModel.findOne({'name': data + ''},function(err, result){
      if(result){
        console.log("name" + data + "is Already registered");
        socket.emit("warning", {$: "#name-warning",
                                message: messages.registered});
        socket.busy = false;
        queryQueue.remove(data, 'setName');
        }else{
          gameOperations.newName(data, socket);
        }
      });
    }else{
        socket.emit("warning", {$: "#name-warning",
                                message: messages.illegal});
    }
  });

  socket.on('creatRoom', function(data){
    if(socket.busy){
      socket.emit("warning",{$: "#roomId-warning",
                             message: messages.busy,
                             busy:true});
      return;
    }
    if(socket.state < 1){
      socket.emit("warning", {$: "#roomId-warning",
                              message: messages.needName});
      return;
    }
    if(socket.state > 1){
      socket.emit("warning", {$:"#roomId-warning",
                              message: messages.exitFirst});
      return;
    }
    if(queryQueue.creatRoom.indexOf(data) != -1){
      socket.emit("warning",{$: "#roomId-warning",
                             message: messages.busy});
      return;
    }
    if(data && RegExps.idVerify.test(data)){
      queryQueue.creatRoom.push(data);
      socket.busy = true;
      RoomModel.findOne({'roomId': data + ''}, function(err, result){
        if(result){
          console.log("roomId" + data + "is Already registered");
          socket.emit("warning", {$: "#roomId-warning",
                                  message: messages.registered});
          socket.busy = false;
          queryQueue.remove(data, 'creatRoom');
        }else{
          gameOperations.newRoom(data, socket);
        }
      });
    }else{
      socket.emit("warning", {$: "#roomId-warning",
                              message: messages.illegal});
    }
  });

  socket.on('joinRoom', function(data){
    if(socket.busy){
      socket.emit("warning",{$: "#roomId-warning",
                             message: messages.busy,
                             busy:true});
      return;
    }
    if(socket.state < 1){
      socket.emit("warning", {$: "#roomId-warning",
                              message: messages.needName});
      return;
    }
    if(socket.state > 1){
      socket.emit("warning", {$:"#roomId-warning",
                              message: messages.exitFirst});
      return;
    }
    if(queryQueue.findRoom.indexOf(data) != -1){
      socket.emit("warning",{$: "#roomId-warning",
                             message: messages.busy});
      return;
    }
    if(data && RegExps.idVerify.test(data)){
      queryQueue.findRoom.push(data);
      socket.busy = true;
      RoomModel.findOne({'roomId': data + ''}, function(err, result){
        if(result){
          if(result.roomMember.length >= 4){
            socket.emit("warning", {$: "#roomId-warning",
                                    message: messages.roomFull});
            socket.busy = false;
            queryQueue.remove(data, 'findRoom');
          }else{
            gameOperations.joinRoom(result, socket);
          }
        }else{
          socket.emit("warning", {$: "#roomId-warning",
                                  message: messages.notExist});
          socket.busy = false;
          queryQueue.remove(data, 'findRoom');
        }
      });
    }else{
      socket.emit("warning", {$:"#roomId-warning",
                              message: messages.illegal});
    }
  });

  socket.on('ready', function(){
    if(socket.busy){
      socket.emit("warning",{$: "#roomInformation",
                             message: messages.busy,
                             busy:true});
      return;
    }
    if(socket.state != 2){
      socket.emit("warning", {$: "#roomInformation",
                              message: messages.stateError});
      return;
    }
    if(socket.ready){
      socket.emit("warning", {$: "#roomInformation",
                              message: messages.setNoBusy});
      return;
    }
    if(queryQueue.findRoom.indexOf(socket.roomId) != -1){
      socket.emit("warning",{$: "#roomInformation",
                             message: messages.busy});
      return;
    }
    queryQueue.findRoom.push(socket.roomId);
    socket.busy = true;
    RoomModel.findById(socket.roomIdId, function(err, result){
      console.log("find that ready id`s room: " + result.roomId);
      if(result){
        gameOperations.ready(result, socket);
      }else{
        socket.emit("warning", {$: "#roomId-warning",
                                message: messages.error});
        socket.busy = false;
        queryQueue.remove(socket.roomId, 'findName');
      }
    });
  });

  socket.on('go', function(){
    if(socket.busy){
      socket.emit("warning",{$: "#roomInformation",
                             message: messages.busy,
                             busy:true});
      return;
    }
    if(socket.state != 3){
      socket.emit("warning", {$: "#roomInformation",
                              message: messages.stateError});
      return;
    }
    if(queryQueue.findRoom.indexOf(socket.roomId) != -1){
      socket.emit("warning",{$: "#roomInformation",
                             message: messages.busy});
      return;
    }
    queryQueue.findRoom.push(socket.roomId);
    socket.busy = true;
    RoomModel.findById(socket.roomIdId, function(err, result){
      console.log("ready to go, roomId:" + result.roomId);
      if(result){
        if(result.roomMember.length === result.readySet.length){
          gameOperations.go(result, socket);
        }else{
          socket.emit("warning",{$: "#roomInformation",
                                 message: messages.notReady});
        }
      }else{
        socket.emit("warning", {$: "#roomId-warning",
                                message: messages.error});
        socket.busy = false;
        queryQueue.remove(socket.roomId, 'findName');
      }
    })
  });

  socket.on('dir', function(data){
    if(socket.state != 4){
      return;
    }
    var clash = {w:"s", s:"w", a:"d", d:"a"};
    if (clash[socket.dir] === data){
      return;
    }
    socket.opera = data;
  })

});

io.sockets.on('disconnect', function(socket){
  var state = socket.state;
});

//newName, newRoom, joinRoom, snakesDataInit, exitRoom, roomInit Operation
var gameOperations = {
  newName: function(name, socket){
    var newName = new UserNameModel({'name': name});
    newName.save(function(err){
      if(!err){
        socket.name = name;
        socket.nameId = newName.id;
        socket.state = 1;
        console.log(name + " join the game, id:" + newName.id);
        socket.emit("setNameSuccess", {$: "#name-warning",
                                       message: name});
      }else{
        socket.emit("warning",{$: "#name-warning",
                               message: messages.error});
      }
      socket.busy = false;
      queryQueue.remove(name, 'setName');
    });
  },
  
  newRoom: function(id, socket){
    var newRoom = new RoomModel({'roomId': id,
                                 'roomMember': [socket.name],
                                 'readySet': [],
                                 'snakesData': this.snakesDataInit(setting.boxSize[1])});
    newRoom.save(function(err){
      if(!err){
        socket.join(id);
        socket.roomId = id;
        socket.creater = id;
        socket.roomIdId = newRoom.id;
        socket.roomOwner = true;
        socket.state = 2;
        console.log(socket.name + " creat room " + id + ".");
        socket.emit("creatRoomSuccess", {$: "#roomId-warning",
                                         message: [id, socket.name]});
      }else{
        socket.emit("warning", {$: "#roomId-warning",
                                message: messages.error});
      }
      socket.busy = false;
      queryQueue.remove(id, 'creatRoom');
    });
  },

  joinRoom: function(room, socket){
    room.roomMember.push(socket.name);
    room.save(function(err){
      if(!err){
        var roomId = room.roomId;
        socket.join(roomId);
        socket.roomId = roomId;
        socket.roomIdId = room.id;
        socket.state = 2;
        console.log(socket.name + " join room " + roomId + ".");
        socket.emit("joinRoomSuccess", roomId);
        io.sockets.in(roomId).emit("roomMember", [room.roomMember, room.readySet]);
      }else{
        socket.emit("warning", {$: "#roomId-warning",
                                message: messages.error});
      }
      socket.busy = false;
      queryQueue.remove(roomId, 'findRoom');
    });

  },

  ready: function(room, socket){
    room.readySet.push(socket.name);
    room.save(function(err){
      if(!err){
        socket.ready = true;
        socket.state = 3;
        console.log(socket.name + " is ready to play, in room " + socket.roomId);
        socket.emit("readySuccess");
        io.sockets.in(socket.roomId).emit("readySet", room.readySet);
      }else{
        socket.emit("warning", {$: "#roomInformation",
                                message: messages.error});
      }
      socket.busy = false;
      queryQueue.remove(socket.roomId, 'findRoom');
    })
  },

  go: function(room, socket){
    var socketsInRoom = io.sockets.clients(room.roomId);
    this.gameInit(room, socketsInRoom);
    room.save(function(err){
      if(!err){
        var bodyImg = {};
        for(var i = socketsInRoom.length - 1; i > -1; i--){
          var socketI = socketsInRoom[i];
          socketI.state = 4;
          bodyImg[socketI.name] = socketI.bodyImg;
        }
        io.sockets.in(socket.roomId).emit('goSuccess', bodyImg);
        setTimeout(function(){
          snakeStep(room, socketsInRoom);
        },2000);
      }else{
        socket.emit("warning", {$: "#roomInformation",
                                message: messages.error})
      }
      socket.busy = false;
      queryQueue.remove(room.roomId, 'findRoom');
    });
  },

  snakesDataInit: function(n){
    var arr = [];
    for (var i = 0; i < n; i++){
      arr[i] = {};
    }
    return arr;
  },

  gameInit: function(room, socketsInRoom){
    var len = socketsInRoom.length;
    for (var i = 0; i < len; i++){
      var socket = socketsInRoom[i],
          snake = setting.snakesInit[i],
          bodyImg = setting.bodyImg[i],
          dir = setting.snakesDir[i];
      socket.snake = snake;
      socket.bodyImg = bodyImg;
      socket.dir = dir;
      console.log(socket.name + ": " + socket.snake);
      for(var j = snake.length - 1; j > -1; j--){
        var coordinate = snake[j];
        console.log(coordinate);
        if(!room.snakesData[coordinate[1]]){
          room.snakesData[coordinate[1]] = {};
        }
        room.snakesData[coordinate[1]][coordinate[0]] = socket.name;
      }
    }
    console.log(room.snakesData);
  }

}

function snakeStep(room, socketsInRoom){
  console.log('snakeStep');
  var foods = [];
  setTimeout(function(){
    var dead = [],
        snakesMap = [],
        snakes = {};
    for(var i = socketsInRoom.length - 1; i > -1; i--){
      var socketI = socketsInRoom[i];
      if(socketI.state === 4){
        snakes[socketI.name] = {id:socketI.name,
                                bodyImg:socketI.bodyImg,
                                len:socketI.snake.length,
                                dir:socketI.dir,
                                opera:socketI.opera,
                                head:socketI.snake[0],
                                data: socketI.snake,
                                counter: 0}
      }

    }

    gameLogic.setTarget(snakes);
    gameLogic.clearOverBounds(snakes, room.snakesData, setting.boxSize, dead);
    gameLogic.clearWeaker(snakes, room.snakesData, dead);
    gameLogic.setCounter(snakes, foods);
    gameLogic.clearClash(snakes, room.snakesData, dead);
    gameLogic.move(snakes, socketsInRoom, room.snakesData, dead);
    gameLogic.refreshFoods(foods, room.snakesData);
    room.save();

    io.sockets.in(room.roomId).emit('gameStep', [snakes, foods]);
    console.log('gameStep emit');

    if(!gameLogic.gameOver(socketsInRoom, snakes, room)){
      setTimeout(arguments.callee, setting.speed);
    }else{
      var scores = [];
      for(var i = socketsInRoom.length - 1; i > -1; i--){
        scores[i] = {id: socketsInRoom[i].name, score: socketsInRoom[i].snake.length};
      }
      io.sockets.in(room.roomId).emit('gameOver', scores);
    }
  },setting.speed);

}
var gameLogic = {

  //figure out each snake`s next step, according to head and direction
  setTarget : function(snakes){
    var snake;
    for(var id in snakes){
      if (snakes.hasOwnProperty(id)){
        snake = snakes[id];
        var dir = snake.opera || snake.dir;
        switch (dir){
          case 'w':
            snake.target = [snake.head[0], snake.head[1] - 1];
            break;
          case 's':
            snake.target = [snake.head[0], snake.head[1] + 1];
            break;
          case 'a':
            snake.target = [snake.head[0] - 1, snake.head[1]];
            break;
          case 'd':
            snake.target = [snake.head[0] + 1, snake.head[1]];
            break;
        }
      }
    }
  },

  //Bounds test
  clearOverBounds : function(snakes, snakesMap, boxSize, dead){
    var snakeTarget;
    for (var id in snakes){
      if (snakes.hasOwnProperty(id)){
        snakeTarget = snakes[id].target;
        if(snakeTarget[0] < 0 || snakeTarget[1] < 0 || snakeTarget[0] > boxSize[0] || snakeTarget[1] > boxSize[1]){
          this.clearSnakeInSnakesMap(snakes[id].data, snakesMap);
          delete snakes[id];
          dead.push(id);
        }
      }
    }
  },

  //when at least two snakes have same target, only keep the strongest one
  clearWeaker : function(snakes, snakesMap, dead){
    var ids = [];
    for (var id in snakes){
      if (snakes.hasOwnProperty(id))
      ids.push(id);
    }
    
    for (var i = ids.length - 1; i > 0; i--){
      var si = snakes[ids[i]];
      for (var j = i - 1; j > -1; j--){
        var sj = snakes[ids[j]];
        if (si.target[0] === sj.target[0] && si.target[1] === sj.target[1]){
          var comparator = si.len - sj.len;
          if(comparator > 0){
            this.clearSnakeInSnakesMap(snakes[ids[j]].data, snakesMap);
            delete snakes[ids[j]];
            dead.push(ids[j]);
          }else if(comparator < 0){
            this.clearSnakeInSnakesMap(snakes[ids[i]].data, snakesMap);
            delete snakes[ids[i]];
            dead.push(ids[i]);
          }else {
            this.clearSnakeInSnakesMap(snakes[ids[j]].data, snakesMap);
            this.clearSnakeInSnakesMap(snakes[ids[i]].data, snakesMap);
            delete snakes[ids[j]];
            delete snakes[ids[i]];
            dead.push(ids[j], ids[i]);
          }
        }
      }
    }
  },

  //when snakes about to eat food
  setCounter : function(snakes, foods){
    for (var id in snakes){
      if (snakes.hasOwnProperty(id)){
        var foodIndex = this.isFood(snakes[id].target, foods);
        if (foodIndex){
          foods.splice(foodIndex, 1);
          snakes[id].counter ++;
        }
      }
    }
  },
  //figure out if there is a food in the Coordinate
  isFood : function(coordinate, foods){
    for(var i = foods.length - 1; i > -1; i--){
      var food = foods[i];
      if(food[0] === coordinate[0] && food[1] === coordinate[1]){
        return i;
      }
    }
    return false;
  },

  //when snakes about to hit on another snake
  clearClash : function(snakes, snakesMap, dead){

    //figure out which part of snake the coordinate belong to
    function whichPart (id, coordinate, clashSnake){
      var head = clashSnake.head;
      var tail = clashSnake.data[clashSnake.len - 1];
      if (coordinate[0] === head[0] && coordinate[1] === head[1]){
        return true;
      }else if (coordinate[0] === tail[0] && coordinate[1] === tail[1]){
        return false;
      }else{
        that.clearSnakeInSnakesMap(snakes[id].data, snakesMap);
        delete snakes[id]
        dead.push(id);
      }
    }
    function clashHead (snake, clashSnake) {
      var clash = {w:"s", s:"w", a:"d", d:"a"};
      if (clash[snake.dir] === clashSnake.dir){
        var comparator = snake.len - clashSnake.len;
        if (comparator > 0){
          that.clearSnakeInSnakesMap(snakes[clashSnake.id].data, snakesMap);
          delete snakes[clashSnake.id];
          dead.push(clashSnake.id);
        }else if (comparator < 0){
          that.clearSnakeInSnakesMap(snakes[snake.id].data, snakesMap);
          delete snakes[snake.id];
          dead.push(snake.id);
        }else{
          that.clearSnakeInSnakesMap(snakes[clashSnake.id].data, snakesMap);
          that.clearSnakeInSnakesMap(snakes[snake.id].data, snakesMap);
          delete snakes[clashSnake.id];
          delete snakes[snake.id];
          dead.push(clashSnake.id, snake.id);
        }
      }else{
        that.clearSnakeInSnakesMap(snakes[snake.id].data, snakesMap);
        delete snakes[snake.id];
        dead.push(snake.id);
      }
    }
    function clashTail(snake, clashSnake) {
      if (clashSnake.counter > 0){
        that.clearSnakeInSnakesMap(snakes[snake.id].data, snakesMap);
        delete snakes[snake.id];
        dead.push(snake.id);
      }
    }

    var that = this;
    for(var id in snakes){

      if (snakes.hasOwnProperty(id)){
        var snake = snakes[id],
            coordinate = snake.target,
            clashRow = snakesMap[coordinate[1]];
        if(clashRow){
          var clashId = snakesMap[coordinate[1]][coordinate[0]];
          if (clashId){
            var clashSnake = snakes[clashId];
            var headOrTail = whichPart(id, coordinate, clashSnake);  //true for h, false for t
            if (headOrTail){
              this.clashHead(snake, clashSnake);
            }else{
              this.clashTail(snake, clashSnake);
            }
          }

        }
      }
    }
  }, 

  move : function(snakes, socketsInRoom, snakesMap, dead){
    var len = socketsInRoom.length;
    for (var i = 0; i < len; i++){
      var socket = socketsInRoom[i];
      if(socket.state != 5){
        if(dead.indexOf(socket.name) != -1){
          socket.state = 5;
          io.sockets.in(socket.roomId).emit("dead", socket.name);
        }else{
          var snake = snakes[socket.name];
          var target = snake.target;
          socket.snake.unshift(target);
          socket.dir = snake.opera || snake.dir;
          if(!snakesMap[target[1]]){
            snakesMap[target[1]] = {};
          }
          snakesMap[target[1]][target[0]] = socket.name;
          snake.opera = null;
          snake.target = [];
          if(snake.counter == 0){
            var tail = socket.snake.pop();
            delete snakesMap[tail[1]][tail[0]];
          }else{
            snake.counter--;
          }
          snake.len = socket.snake.length;
          snake.head = socket.snake[0];
        }
      }
    }
  },

  refreshFoods : function(foods, snakesMap){
    var that = this;
    function randomCoordinate(){
      coordinate[0] = Math.floor(Math.random() * (setting.boxSize[0] +1));
      coordinate[1] = Math.floor(Math.random() * (setting.boxSize[1] + 1));
      if(!verifyCoordinate()){
        arguments.callee();
      }
    }
    function verifyCoordinate(){
      var snakeRow = snakesMap[coordinate[1]];
      if(!snakeRow || !snakeRow[coordinate[0]]){
        if(!that.isFood(coordinate, foods)){
          return true;
        }
      }
      return false;
    }

    if(foods.length < 10){
      var coordinate = [];
      randomCoordinate();
      foods.push(coordinate);
    }
  },

  clearSnakeInSnakesMap : function(data, snakesMap){
    for(var i = data.length - 1; i > -1; i--){
      var coordinate = data[i];
      var snakeRow = snakesMap[coordinate[1]];
      if(snakesMap[coordinate[1]]){
        delete snakesMap[coordinate[1]][coordinate[0]];
      }
    }
  },

  gameOver : function(socketsInRoom, snakes, room){
    if(this.allDead(socketsInRoom)){
      return true;
    }else if(this.checkTargetScore(snakes)){
      return true;
    }else{
      return false;
    }
  },

  allDead : function(socketsInRoom){
    for(var id in socketsInRoom){
      if(socketsInRoom[id].state === 4){
        return false;
      }
    }
    return true;
  },

  checkTargetScore : function(snakes){
    for (var id in snakes){
      var snake = snakes[id];
      if (snake.len >= setting.targetScore){
        return true;
      }
    }
    return false;
  }
}

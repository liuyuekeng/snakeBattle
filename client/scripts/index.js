(function(){
  var socket = io.connect(),
      busy = false,
      rVerify = /^[0-9a-zA-Z_]{1,12}$/,
      state = 0,
      creater = null,
      boxSize = [900, 600],
      snakeSize = 10;

  var name = $("#name"),
      roomId = $("#roomId"),
      setName = $("#set-name"),
      creat = $("#creat"),
      join = $("#join"),
      stat1 = $("#stat1"),
      stat2 = $("#stat2"),
      ready = $("#ready"),
      exit = $("#exit"),
      go = $("#go"),
      room = $("#room"),
      players = $("#players");
      
  function messageWrapper(data, cla){
    return "<div class=\""+cla+"\">"+data+"</div>";
  }

  function appendWarning(data){
    if(data.busy){
      busy = true;
    }else{
      busy = false;
    }
    $(data.$).empty().append(data.message);
  }

  function setReadyClass(data, playerLen){
    var len = data.length;
    for (var i = len - 1; i > -1; i--){
      var player = $("#id"+data[i]);
      if (player.length){
        player.removeClass("readyPlayer").addClass("readyPlayer");
      }
    }
    draw.roomMember(len, playerLen);
  }

  function setBodyImg(data){
    for(var i in data){
      var player = $("#id"+i);
      if(player.length){
        player.prepend("<img src=\"/client/resources/image/" +
                       data[i] +
                       ".png\">&nbsp;&nbsp;")
      }
    }
  }

  function goButton(readySetLen, playerSetLen){
    if(readySetLen === playerSetLen){
      go.show();
    }else{
      go.hide();
    }
  }

  socket.on("warning", function(data){
    appendWarning(data);
  });
  
  socket.on("setNameSuccess", function(data){
    state = 1;
    busy = false;
    $(data.$).empty().append(messageWrapper("Hello, "+data.message+".", "note"));
    name.attr("disabled", "disabled");
    setName.hide();
    $("#roomId-input-box").show();
  });

  socket.on("creatRoomSuccess", function(data){
    state = 2;
    creater = data.message[0];
    busy = false;
    players.empty().append("<li id=\"id"+data.message[1]+"\" class=\"player\">" + data.message[1] + "</li>");
    room.empty().append(data.message[0]);
    stat1.hide();
    stat2.show();
    draw.roomMember(0, 1);
  });

  socket.on("joinRoomSuccess", function(data){
    state = 2;
    busy = false;
    room.empty().append(data);
    stat1.hide();
    stat2.show();
  });

  socket.on("readySuccess", function(){
    state = 3;
    busy = false;
  });

  socket.on("goSuccess", function(data){
    state = 4;
    busy = false;
    setBodyImg(data);
    draw.gameStart();
  });

  socket.on("roomMember", function(data){
    players.empty();
    var member = data[0],
        ready = data[1];
    var memberLen = member.length;
        readyLen = ready.length;
    for(var i = 0; i < memberLen; i++){
      players.append("<li id=\"id"+member[i]+"\" class=\"player\">" + member[i] + "</li>");
    }
    setReadyClass(ready);
    if(creater){
      goButton(readyLen, memberLen);
    }
    draw.roomMember(readyLen, memberLen);
  });

  socket.on("readySet", function(data){
    var len = data.length;
    var playerLen = $(".player").length;
    setReadyClass(data, playerLen);
    if(creater){
      goButton(len, playerLen);
    }
  });

  socket.on("gameStep",function(data){
    draw.drawSnakes(data[0]);
    draw.drawFoods(data[1]);
  });

  socket.on('dead', function(data){
    if(name.attr('value') === data){
      state = 5;
    }
    var player = $('#id' + data);
    player.removeClass('readyPlayer').removeClass('dead').addClass('dead');
  });

  socket.on('gameOver', function(data){
    draw.gameOver(data);
  });

  //rewrite the events function latter
  setName.click(function(){
    if(busy){
      appendWarning({$: "#name-warning",
                     message: messageWrapper("Busy, please try again latter.","warning")})
      return;
    }
    if(state != 0){
      appendWarning({$: "#name-warning",
                     message: messageWrapper("Illegal state.","warning")})
      return;
    }
    if(!rVerify.test(name.val())){
      appendWarning({$: "#name-warning",
                     message: messageWrapper("You can only use numbers, letters, and underscores here (1-12).","warning")})
      return;
    }
    busy = true;
    socket.emit('setName', name.val());
  });

  creat.click(function(){
    if(busy){
      appendWarning({$: "roomId-warning",
                     message: messageWrapper("Busy, please try again latter.","warning")})
      return;
    }
    if(state != 1){
      appendWarning({$: "#roomId-warning",
                     message: messageWrapper("Illegal state.","warning")})
      return;
    }
    if(!rVerify.test(roomId.val())){
      appendWarning({$: "#roomId-warning",
                     message: messageWrapper("You can only use numbers, letters, and underscores here (1-12).","warning")})
      return;
    }
    busy = true;
    socket.emit('creatRoom', roomId.val());
  });

  join.click(function(){
    if(busy){
      appendWarning({$: "#name-warning",
                     message: messageWrapper("Busy, please try again latter.","warning")})
      return;
    }
    if(state != 1){
      appendWarning({$: "#roomId-warning",
                     message: messageWrapper("Illegal state.","warning")})
      return;
    }
    if(!rVerify.test(roomId.val())){
      appendWarning({$: "#name-warning",
                     message: messageWrapper("You can only use numbers, letters, and underscores here (1-12).","warning")})
      return;
    }
    busy = true;
    socket.emit('joinRoom', roomId.val());
  });

  ready.click(function(){
    if(busy){
      appendWarning({$: "#name-warning",
                     message: messageWrapper("Busy, please try again latter.","warning")})
      return;
    }
    if(state === 3){
      return;
    }
    if(state != 2){
      appendWarning({$: "#roomInformation",
                     message: messageWrapper("Illegal state.","warning")})
      return;
    }
    busy = true;
    socket.emit('ready');
  });

  go.click(function(){
    if(busy){
      appendWarning({$: "#name-warning",
                     message: messageWrapper("Busy, please try again latter.","warning")})
      return;
    }
    if(state != 3 || !creater){
      return;
    }
    busy = true;
    socket.emit('go');
  });

  $(window).keydown(function(even){
    if(state != 4){
      return;
    }
    var dir;
    switch (even.keyCode){
      case 87 : 
        dir = 'w';
        break;
      case 83 :
        dir = 's';
        break;
      case 65 :
        dir = 'a';
        break;
      case 68 :
        dir = 'd';
        break;
    }
    socket.emit('dir', dir);
  });

  var draw = {
    drawInit : function(){
      this.canvasSize = [900,600];
      this.snakeSize = 10;
      this.canvas = document.getElementById('bg');
      if(this.canvas.getContext){
        this.ctx = this.canvas.getContext('2d');
      }
      var img = this.imgLoader;
      img.go.src = '/client/resources/image/go.png';
      img.gameOver.src = '/client/resources/image/gameOver.png';
      img.bone.src = '/client/resources/image/bone.png';
      img.cross.src = '/client/resources/image/cross.png';
      img.diamond.src = '/client/resources/image/diamond.png';
      img.windmill.src = '/client/resources/image/windmill.png';
    },
  
    imgLoader : {
      go : new Image(),
      gameOver : new Image(),
      bone : new Image(),
      cross : new Image(),
      diamond : new Image(),
      windmill : new Image()
    },

    clear : function(){
      this.ctx.clearRect(0, 0, this.canvasSize[0], this.canvasSize[1]);
    },

    gameStart : function(){
      this.clear();
      var img = this.imgLoader.go;
      this.ctx.drawImage(img,
                         (this.canvasSize[0] - img.width) / 2,
                         (this.canvasSize[1] - img.height) / 2);
    },

    roomMember : function(readyLen, memberLen){
      this.clear();
      this.ctx.font = "40px Open Sans";
      this.ctx.fillStyle = "#0095dd";
      this.ctx.textAlign = "center";
      this.ctx.fillText(readyLen + " / " + memberLen, 450, 250);
      if(readyLen === memberLen){
        this.ctx.fillText("Ready to go!!", 450, 300);
      }
    },

    calculatingCoordinate : function(data){
      var x = data[0] * snakeSize,
          y = data[1] * snakeSize;
      return [x, y];
    },

    drawSnakes : function(snakes){
      this.clear();
      var ctx = this.ctx;
      for(var id in snakes){
        var snake = snakes[id],
            data = snake.data,
            len = snake.len,
            bodyImg = snake.bodyImg;
        var coordinate;
        for(var j = 0; j < len; j++){
          var coordinate = this.calculatingCoordinate(data[j]);
          ctx.drawImage(this.imgLoader[bodyImg],
                        coordinate[0],
                        coordinate[1]);
        }
      }
    },
    drawFoods : function(foods){
      var ctx = this.ctx;
      for(var i = foods.length - 1; i > -1; i--){
        var coordinate = this.calculatingCoordinate(foods[i]);
        ctx.fillStyle = "#0095dd";
        ctx.fillRect(coordinate[0], coordinate[1], snakeSize, snakeSize);
      }
    },

    gameOver : function(data){
    }

  }

  draw.drawInit();

})();


(function(){
  var canvasSize = [900, 600],
      snakeSize = 10,
      canvas = document.getElementById("bg");
  if(canvas.getContext){
      var ctx = canvas.getContext('2d');
  }

  var imgLoader = {
    go: new Image(),
    dead: new Image(),
    win: new Image()
  }
  imgLoader.go.src = "/client/resources/image/go.jpg";

  function gameStart(){
    ctx.clearRect(0, 0, canvasSize[0], canvasSize[1]);
  }

  function drawSnakes (snakes) {
  //Be called in each frame, to draw snakes
    var snake,
        data,
        len,
        coordinate;

    ctx.clearRect (0, 0, canvasSize[0], canvasSize[1]);

    for (var i = snakes.length-1; i > -1; i--) {
    //for each snake in array snakes
      snake = snakes[i];
      data = snake.data;
      len = snake.len;

      ctx.fillStyle = snake.color;
      for (var j = 0; j < len; j++){
      //draw the snake
        coordinate = calculatingCoordinate(data[j]);
        ctx.fillRect (coordinate[0], coordinate[1], coordinate[2],coordinate[3]);
      }
    }
  }
  function calculatingCoordinate (data) {
  //called by function drawSnakes to calculate the coordinate
    var x = data[0] * snakeSize,
        y = data[1] * snakeSize;
    return [x, y, snakeSize, snakeSize];
  }


  function gameOver () {
    //When someone win the game
  }

  function buildSnake(id, color, len, dir, head,  data){
  //run on the server, test now
    var snake = {id:id, color:color, len:len, dir:dir, head:head, data:data};
    return snake;
  }

  //test code for drawing a snake
  var snake1 = buildSnake("a", "red", 4, "w", [0,1], [[0,1],[0,2],[0,3],[0,4]]);
  var snake2 = buildSnake("b", "green", 4, "d", [8,2], [[5,2],[6,2],[7,2],[8,2]]);

  $(document).ready(function(){
    var canvasBg = document.getElementById('bg');
    if (canvasBg.getContext){
      ctx = canvasBg.getContext('2d');
    }

    drawSnakes([snake1, snake2]);  //test.....
  });

})();

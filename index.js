const express = require('express');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const app = express();
const path = require('path');
__dirname = path.resolve(path.dirname(''));


app.set('view engine', '.ejs');
app.set('views', path.join(__dirname, 'views'));
app.use("/public", express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//routing
app.get('/', (req, res) => {
  res.render('join.ejs')
});


app.post('/join_game', (req, res) => {
  var name = req.body.name;
  var server = req.body.server;
  res.render('main.ejs', {name: name, server: server})
});

var server = app.listen(3000, () => {
  console.log('server started');
});

//socket.io

var io = require('socket.io')(server);
var game_obj = undefined;
var hill_obj = undefined;

//setting up servers
var s1 = io.of('s1');
var s2 = io.of('s2');
var s3 = io.of('s3');
var s4 = io.of('s4');
setUpServer(s1);
setUpServer(s2);
setUpServer(s3);
setUpServer(s4);


//game logic & continued server setup
function setUpServer(serverVAR){

var teamToReturn = "red";

var players = new Array();
var game = new Game();
var arrows = new Array();
//walls
game.walls.push(new Wall(redEdge(game) - 100, 0, 100, 300));
game.walls.push(new Wall(blueEdge(game), 0, 100, 300));
game.walls.push(new Wall(redEdge(game) - 100, game.height - 300, 100, 300));
game.walls.push(new Wall(blueEdge(game), game.height - 300, 100, 300));
game.walls.push(new Wall(redEdge(game) - 100, 600, 100, game.height - 1200));
game.walls.push(new Wall(blueEdge(game), 600, 100, game.height - 1200));
//WALLS AT Hill
game.walls.push(new Wall(getEdgeOfHill(game, "left") - 20, getEdgeOfHill(game,"top"), 20, game.hill.size / 3));
game.walls.push(new Wall(getEdgeOfHill(game, "left") - 20, getEdgeOfHill(game,"bottom") - game.hill.size/3, 20, game.hill.size / 3));
game.walls.push(new Wall(getEdgeOfHill(game, "right"), getEdgeOfHill(game, "top"), 20, game.hill.size / 3));
game.walls.push(new Wall(getEdgeOfHill(game, "right"), getEdgeOfHill(game, "bottom") - game.hill.size/ 3, 20, game.hill.size / 3));

game.walls.push(new Wall(getEdgeOfHill(game, "left") - 20, getEdgeOfHill(game, "top") - 20, game.hill.size / 3, 20));
game.walls.push(new Wall(getEdgeOfHill(game, "right") - game.hill.size / 3, getEdgeOfHill(game, "top") - 20, game.hill.size / 3 + 20, 20));
game.walls.push(new Wall(getEdgeOfHill(game, "left") - 20, getEdgeOfHill(game, "bottom"), game.hill.size / 3, 20));
game.walls.push(new Wall(getEdgeOfHill(game, "right") - game.hill.size / 3, getEdgeOfHill(game, "bottom"), game.hill.size / 3 + 20, 20));



//server side game update
setInterval(function(){
  game.time += 1;
  for(p in players){
  
    if(game.time % 100 === 0){
      if(players[p]!= undefined){
      players[p].money += 10;
        if(players[p].bow_animation_timer > 20){
      players[p].bow_animation_timer = 20;
    }
      }
    }
  performCollisionDetection(players[p], game);
  game = updateHill(players[p], game);
  if(players[p].health < players[p].maxHealth){
  players[p].health += 0.03;
  }
  if(players[p].health <= 0){
      respawnPlayer(players[p], game);
  }
}
 game_obj = {blueScore: game.blueScore, redScore: game.redScore};
 hill_obj = {capturingTeam: game.hill.capturingTeam, percentageCaptured: game.hill.percentageCaptured};
serverVAR.emit("updateAllPositions", {players: JSON.stringify(players),game: game_obj, hill: hill_obj, arrows: JSON.stringify(arrows)});
}, 1000/30);
//connection
serverVAR.on('connection', function(socket){
  socket.on('leaving', function(key){
    playerLeaving(key, players, serverVAR);
  });
console.log("User has been connected to " + serverVAR.name);
  socket.on('info', function(info){
   var name = info.name.replace(/^\s+|\s+$/, "");
      sendMessageToNamespace(serverVAR, "SERVER", name + " has joined the game", "");
    socket.on("message", function(msg){
      sendMessageToNamespace(serverVAR, name, msg, socket.id);
   });
if (!name || name.length > 20) {
name = name.slice(0, 20);
}
  var newPlayer = new player(name, game, teamToReturn);
  if(teamToReturn === "red"){
    teamToReturn = "blue";
  }else{
    teamToReturn = "red";
  }
  newPlayer.key = socket.id;
  var newPos = getPosition(newPlayer.team, game);
  newPlayer.x = newPos.x;
  newPlayer.y = newPos.y;
   newPlayer.targetX = newPos.x;
  newPlayer.targetY = newPos.y;
  players.push(newPlayer);
  socket.emit('uniqueKey', {key: newPlayer.key, game: game});
  serverVAR.emit("playerUpdate", players);


});
socket.on("bow_start", function(){
  serverVAR.emit("bow_s", socket.id);
});

socket.on("bow_end", function(){
  serverVAR.emit("bow_e", socket.id);
});
socket.on("arrow", function(rotation){
  var player = findPlayer(players, socket.id);
  if(player != undefined){
    var arrow = new Arrow(player.x, player.y, );

  }
});

socket.on("hit", function(sword_id){
  socket.broadcast.emit("hit_anim", socket.id);
  var player = findPlayer(players, socket.id);
  if(player != undefined){
  for(p in players){
   doHit(players,p, player, game, sword_id, game.redStore.sword_upgrades);
   if(players[p].health <= 0){
     respawnPlayer(players[p], game);
     player.money += 100;
   }
  }
  }
});
socket.on("request_buy", function(id){
  var player = findPlayer(players, socket.id);
  if(player.money >= game.redStore.sword_upgrades[id].price){
    player.money -= game.redStore.sword_upgrades[id].price;
    socket.emit("new_sword", {id: id, money: player.money});
  }
});
socket.on("sword_u", function(info){
  var player = findPlayer(players, socket.id);
    if(player != undefined){
        player.selected_sword = info.sword;
        player.mode = "sword";
        socket.broadcast.emit("sword_update", info);
    }
});
socket.on("bow_u", function(info){
  var player = findPlayer(players, socket.id);
    if(player != undefined){
        player.selected_bow = info.sword;
        player.mode = "bow";
        socket.broadcast.emit("bow_update", info);
    }
});

socket.on("requestPlayerUpdate", function(){
  socket.emit("playerUpdate", players);
});
socket.on('position', function(info){
var player = findPlayer(players, info.key);
if(player != undefined){
player.targetX = player.x + (info.xIncrease);
player.targetY = player.y + info.yIncrease;
player.x += info.xIncrease;
player.y += info.yIncrease;
wallCollisionAndResponse(player, game, info);
}
});
socket.on('rotation', function(info){
  var player = findPlayer(players, info.key);
  if(player != undefined){
  player.targetRotation = info.rot;
  player.rotation = player.targetRotation;
  }
});

});
}

function dist(x1, y1, x2, y2){
  var a = x1 - x2;
var b = y1 - y2;

var c = Math.sqrt( a*a + b*b );
  return c;     
}
function doHit(players,p, player, game, sword_id, swords){
  var sword = swords[sword_id];
   if(players[p] != undefined){
    if(players[p].team != player.team){
      var d = dist(player.x, player.y, players[p].x, players[p].y);
      if(d < sword.attack_range){
      var ray = getNormalizedRay(player.rotation);
      var angleBetweenPlayers = angle(player.x, player.y, players[p].x, players[p].y);
      var rot = player.rotation;
      var rot2 = angleBetweenPlayers;

      var d3 = Math.abs(rot2 - ((rot - 90) % 360));
   
      if(d3 < 90){
        players[p].health -= (10 * sword.attack_power);
        players[p].targetX += sword.knockback * (ray.x * d);
        players[p].targetY += sword.knockback * (ray.y * d);
        players[p].x = players[p].targetX;
        players[p].y = players[p].targetY;
        wallCollisionAndResponse(players[p], game, {xIncrease: sword.knockback * (ray.x * d), yIncrease: sword.knockback * (ray.y * d)});
      }
      }

      
      }
    }
}

function updateArrows(arrows){
  for(a in arrows){
    arrows[a].x += arrows[a].vel.x;
    arrows[a].y += arrows[a].vel.y;
  }
}

function Arrow(x, y, vel){
  this.x = x;
  this.y = y;
  this.vel = vel; 
}

function getNormalizedRay(rotation){
  return {x: Math.sin(toRadians(rotation)), y: -Math.cos(toRadians(rotation))};
}
function toRadians (angle) {
  return angle * (Math.PI / 180);
}
function getDegrees(x, y){
  if(x > 0 && y == 0){
    return 90;
  }else if(x < 0 && y == 0){
    return 270;
  }else if(x == 0 && y > 0){
    return 180;
  }else if(x == 0 && y < 0){
    return 0;
  }else if(x > 0 && y > 0){
    return 135;
  }else if(x > 0 && y < 0){
    return 45;
  }else if(x < 0 && y > 0){
    return 225;
  }else {
    return 315;
  }
}

function generateRandomTeam(teamToReturn){
   if(teamToReturn === "red"){
     teamToReturn === "blue";
      return "red";
   }else{
     teamToReturn === "red";
     return "blue";
   }
}

function player(name, g, team){
this.key = "";
this.x = 0;
this.y = 0;
this.playerName = name;
this.targetX = 0;
this.targetY = 0;
this.size = 30;
this.money = 400;
this.team = team;
this.health = 100;
this.maxHealth = 100;
this.rotation = 0;
this.targetRotation = 0;
this.sword_animation_timer = 15;
this.bow_animation_timer = 0;
this.selected_sword = 0;
this.purchased_swords = [];
this.purchased_swords.push(0);
this.mode = "sword";
this.selected_bow = 0;
this.isBowTime = false;
}
function getPosition(team, game){
  var rand = Math.random();
  var x = 0;
  var y = 30 + (rand * (game.height - 60));

  if(team === "red"){
    x = 50;
  }else{
    x = game.width - 50;
  }
  return {x: x,  y: y};
}
function respawnPlayer(player, game){
  var position = getPosition(player.team, game);
  player.x = position.x
  player.y = position.y;
  player.targetX = position.x;
  player.targetY = position.y;
  player.health = player.maxHealth;
}

function updateHill(p, g){
var player = p;
  if(isPlayerOnHill(player, g)){
    if(g.hill.capturingTeam != player.team && g.hill.percentageCaptured > 0){
      g.hill.percentageCaptured -= 0.05;
    }else if(g.hill.capturingTeam != player.team){
      g.hill.capturingTeam = player.team;
      g.hill.percentageCaptured = 0;
    }else if(g.hill.capturingTeam === player.team && g.hill.percentageCaptured < 1){
      g.hill.percentageCaptured += 0.05;
    }else{
      if(g.hill.capturingTeam === "red"){
          g.redScore++;
      }else if(g.hill.capturingTeam === "blue"){
          g.blueScore++;
      }
    }

  
}
return g;
}

function findPlayer(list, key){
  return list.find(function(p){
    return key == p.key;
  });
}
function Game(){
  this.time = 0;
  this.width = 4000;
  this.height = 2000; 
  this.redPercentage = 0.2; 
  this.bluePercentage = 0.2; 
  this.walls = new Array();
  this.redScore = 0;
  this.blueScore = 0;
  this.hill = new Hill(this.width, this.height);
  this.redStore = new Store((this.redPercentage * this.width) - 300, 0, 200, 100);
  this.blueStore = new Store((this.width -(this.bluePercentage * this.width)) + 100, 0, 200, 100);
  
}

function Hill(width, height){
  this.x = width/2;
  this.y = height/2;
  this.capturingTeam = "none";
  this.percentageCaptured = 0;
  this.size = 400; 
}

function Wall(x, y, width, height){
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height; 
}

function redEdge(game){
  return game.width * game.redPercentage;
}
function blueEdge(game){
  return game.width - (game.width * game.bluePercentage);
}

function getEdgeOfHill(game, side){
  if(side === "right"){
    return game.hill.x + game.hill.size / 2;
  }else if (side === "left"){
    return game.hill.x - game.hill.size/2;
  }else if (side === "bottom"){
    return game.hill.y + game.hill.size/2;
  }else{
    return game.hill.y - game.hill.size/2;
  }

}

function Store(x, y, width, height){
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height; 
  this.sword_upgrades = [];
  this.sword_upgrades.push(new Sword("/public/stick.png", "Stick", 0.7, 8, 100, 0, 1));
  this.sword_upgrades.push(new Sword("/public/hammer.png", "Hammer", 1, 25, 100, 400, 3));
  this.sword_upgrades.push(new Sword("/public/iron_sword.png", "Iron Sword", 1, 15, 100, 800, 1));
  this.sword_upgrades.push(new Sword("/public/diamond_sword.png", "Diamond", 1.3, 18, 130, 1200, 1));
   this.sword_upgrades.push(new Sword("/public/ruby_sword.png", "Ruby Sword", 1.5, 20, 140, 1500, 1));
   this.sword_upgrades.push(new Sword("/public/dark_sword.png", "Dark Sword", 2.0, 18, 150, 2000, 0.8));
   this.bow_upgrades = [];
   var cross_bow = [];
   cross_bow[0] = "/public/bow_1.png";
   cross_bow[1] = "/public/bow2.png";
   cross_bow[2] = "/public/bow_3.png";
   this.bow_upgrades.push(new Bow(cross_bow, "Cross Bow", 1, 1, 500, 0));

}

function Bow(img_path, name, attack_power, load_speed, attack_range, price){
  this.name = name;
  this.path = img_path;
  this.attack_power = attack_power;
  this.load_speed = load_speed;
  this.attack_range = attack_range;
  this.price  = price;
  this.image = [];

}

function Sword(img_path, name, attack_power, attack_speed, attack_range, price, kb){
  this.name = name;
  this.description = "";
  this.path = img_path;
  this.attack_power = attack_power;
  this.attack_speed = attack_speed;
  this.attack_range = attack_range;
  this.image = undefined;
  this.price = price;
  this.knockback = kb;
}

function angle(cx, cy, ex, ey) {
var angleDeg = Math.atan2(ey - cy, ex - cx) * 180 / Math.PI;
return angleDeg;
}
function isPlayerInWall(player, game){
  var toReturn = false;
  for(w in game.walls){
    var wall = game.walls[w];
    if(intersectRect({left: player.x - player.size, right: player.x + player.size, top: player.y - player.size, bottom: player.y + player.size}, {left: wall.x, right: wall.x + wall.width, top: wall.y, bottom: wall.y + wall.height})){
      toReturn = true;
    }
  }
  return toReturn;
}
function sendMessageToNamespace(serverVAR, name, message, id){
      serverVAR.emit("client_message", {msg: name + ": " + message, id: id});
}
function wallCollisionAndResponse(player, game, info){
    if(isPlayerInWall(player, game)){
      var isXProblem = false;
      var isYProblem = false;
      //X-TEST
      for(var i = 0; i < 5; i++){
        player.x -= info.xIncrease * (0.1 * (i + 1));
        if(!isPlayerInWall(player, game)){
          isXProblem = true;
          break;
        }
      }

      if(!isXProblem){
      player.x += info.xIncrease;
      //Y-TEST
      for(var i = 0; i < 5; i++){
        player.y -= info.yIncrease * (0.1 * (i + 1));
        if(!isPlayerInWall(player, game)){
          isYProblem = true;
          break;
        }
      }
      if(!isYProblem){player.y += info.yIncrease;}

        while(isPlayerInWall(player, game)){
         player.x -= info.xIncrease * 0.1;
          player.y -= info.yIncrease * 0.1;
        }
      
      }
    }
    player.targetX = player.x;
    player.targetY = player.y;
}

function isPlayerOnHill(player, game){
    var toReturn = false;
    var wall = game.hill;
    if(intersectRect({left: player.x - player.size, right: player.x + player.size, top: player.y - player.size, bottom: player.y + player.size}, {left: wall.x - wall.size/2 + player.size, right: wall.x + wall.size/2 - player.size, top: wall.y - wall.size/2 + player.size, bottom: wall.y + wall.size/2 - player.size})){
      toReturn = true;
  }
  return toReturn;
}

function intersectRect(r1, r2) {
  return !(r2.left > r1.right || 
           r2.right < r1.left || 
           r2.top > r1.bottom ||
           r2.bottom < r1.top);
}

function playerLeaving(key, players, serverVAR){
  console.log("Player Leaving " + key);
    var player = findPlayer(players, key)
    if(player != undefined){
    players.splice(players.indexOf(player), 1);
   serverVAR.emit("playerUpdate", players);
    }
}

function performCollisionDetection(p, g){
    if(p.x + p.size > g.width){
      p.x = g.width - p.size - 1;
   }
    if(p.y + p.size > g.height){
      p.y = g.height - p.size - 1;
    }
    if(p.x - p.size < 0){
      p.x = p.size + 1;
    }
    if(p.y - p.size < 0){
      p.y = p.size + 1;
    }
    if(p.targetX + p.size > g.width){
      p.targetX = g.width - p.size - 1;
   }
    if(p.targetY + p.size > g.height){
      p.targetY = g.height - p.size - 1;
    }
    if(p.targetX - p.size < 0){
      p.targetX = p.size + 1;
    }
    if(p.targetY - p.size < 0){
      p.targetY = p.size + 1;
    }
    
}

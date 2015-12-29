
Meteor.startup(function () {
  // temporarily cleanup all mongo objects when we restart the server
  Ships.remove({});
  Games.remove({});
  Turrets.remove({});
});

Meteor.methods({

  QuickGame: function() {
    var user_id = Meteor.userId();
    var game_id = Games.insert({player1: user_id, player2: 0, turn: 'player1', turn_count: 0, max_turns: 30, pvp: 0});
    var parsed_json = EJSON.parse(Assets.getText("quickgame.json"));
    var parsed_turrets = EJSON.parse(Assets.getText("quickgame_turrets.json"));

    var count = 0;
    for (var ship in parsed_json) {
      parsed_json[ship].game_id = game_id;
      parsed_json[ship].x = parseInt(parsed_json[ship].x, 10);
      parsed_json[ship].y = parseInt(parsed_json[ship].y, 10);
      parsed_json[ship].shield = parseInt(parsed_json[ship].shield, 10);
      parsed_json[ship].armor = parseInt(parsed_json[ship].armor, 10);
      parsed_json[ship].power = parseInt(parsed_json[ship].power, 10);
      if (count < 2) {
        parsed_json[ship].user_id = user_id;
      } else { 
        parsed_json[ship].user_id = 0;
      }

      var ship_id = Ships.insert(parsed_json[ship]);
      parsed_turrets["0"].ship_id = ship_id;
      parsed_turrets["1"].ship_id = ship_id;
      parsed_turrets["2"].ship_id = ship_id;
      parsed_turrets["3"].ship_id = ship_id;
      
      if (parsed_json[ship].hull == "Corvette") {
        Turrets.insert(parsed_turrets["0"]);
        Turrets.insert(parsed_turrets["1"]);
      } else if (parsed_json[ship].hull == "Frigate") {
        Turrets.insert(parsed_turrets["0"]);
        Turrets.insert(parsed_turrets["0"]);
        Turrets.insert(parsed_turrets["1"]);
        Turrets.insert(parsed_turrets["3"]);
      }

      count += 1;
    }
    return game_id;
  },

  JoinPvPGame: function() {
    var user_id = Meteor.userId();
    var game = Games.findOne({player2: 0, pvp: 1})

    if (typeof game === 'undefined') {
      return NewPvPGame();
    } else {
      Games.update(game, {$set: {player2: user_id}});
      Ships.update({game_id: game._id, user_id: 0}, {$set: {user_id: user_id}}, {multi: true});
      return game._id;
    }
  },

  EndTurn: function(game_id) {
    var game = Games.findOne({_id: game_id});
    if (Ships.find({game_id: game._id, user_id: game.player1, destroyed: {$ne: 1}}).count() === 0) {
        return {message: "player 2 wins"};
    } else if (Ships.find({game_id: game._id, user_id: game.player2, destroyed: {$ne: 1}}).count() === 0) {
        return {message: "player 1 wins"};
    }

    if (game.turn === 'player1') {
        Games.update(game, {$set: {turn: 'player2'}});
    } else {
      if (game.turn_count === game.max_turns) {
        return {message: "game over"};
      } else {
        Games.update(game, {$set: {turn: 'player1', turn_count: game.turn_count + 1}});
      }
    }

    game = Games.findOne({_id: game_id});
    var fleet = Ships.find({user_id: game[game.turn], game_id: game._id, destroyed: {$ne: 1}});
    fleet.forEach(function(ship) {
      var energy = Math.min(ship.energy + ship.energy_recharge, ship.full_energy);
      Ships.update({_id: ship._id}, {$set: {has_attacked: 0, moves: ship.speed, energy: energy}});
      Turrets.update({ship_id: ship._id}, {$set: {has_attacked: 0}}, {multi: true});
    });

    if ((game[game.turn] === 0) && (game['pvp'] !== 1)) {
      Meteor.call('AITurn', game_id);
      return {message: "continue"};
    } else {
      return {message: "continue"};
    }
  },

  MoveShip: function(ship_id, direction) {
    var ship = Ships.findOne({_id: ship_id});
    if (ship.moves > 0) {
      if (direction === "up") {
        if (ship.y > 0) {
          ship.y = parseInt(ship.y, 10) - 1;
          ship.moves = parseInt(ship.moves, 10) - 1;
        }
      } else if (direction === "down") {
        if (ship.y < 39) {
          ship.y = parseInt(ship.y, 10) + 1;
          ship.moves = parseInt(ship.moves, 10) - 1;
        }
      } else if (direction === "right") {
        if (ship.x < 39) {
          ship.x = parseInt(ship.x, 10) + 1;
          ship.moves = parseInt(ship.moves, 10) - 1;
        }
      } else if (direction === "left") {
        if (ship.x > 0) {
          ship.x = parseInt(ship.x, 10) - 1;
          ship.moves = parseInt(ship.moves, 10) - 1;
        }
      }
      //console.log(ship.name + " " + ship.x + "-" + ship.y);
      var occupied = Ships.find({game_id: ship.game_id, x: ship.x, y: ship.y, destroyed: {$ne: 1}}).count();
      if (occupied < 1) {
        Ships.update({_id: ship._id}, {$set: {x: ship.x, y: ship.y, moves: ship.moves}});
      }
    }
  },

  Attack: function(params) {
    var turret = Turrets.findOne({_id: params.turret_id});
    if (typeof turret !== "undefined") {
      var ship = Ships.findOne({_id: turret.ship_id});
      var target = Ships.findOne({_id: params.target_id});
      if ((target.destroyed !== 1) && (turret.has_attacked !== 1) && (ship.energy >= turret.energy)) {
        if (target.shield > turret.power) {
          target.shield -= turret.power;
        } else {
          var damage = turret.power - target.shield;
          target.shield = 0;
          target.armor -= damage;
        }

        if (target.armor <= 0) {
          target.destroyed = 1;
        }

        turret.has_attacked = 1;
        ship.energy -= turret.energy;

        Turrets.update({_id: turret._id}, turret);
        Ships.update({_id: target._id}, target);
        Ships.update({_id: ship._id}, ship);
      }
    }
  },

  ChargeShield: function(params) {
    var ship = Ships.findOne({_id: params.ship_id});
    if (typeof ship !== 'undefined') {
      if (ship.destroyed !== 1) {
        if ((ship.shield < ship.full_shield) && (ship.energy >= 2)) {
          ship.shield += 1;
          ship.energy -= 2;
          Ships.update({_id: ship._id}, ship);
        }
      }
    }
  },

  AITurn: function(game_id) {
    AIMoveFleet(game_id);
    AIAttackFleet(game_id);
    AISpecialAction(game_id);
    Meteor.call('EndTurn', game_id);
  }
});

var AIMoveFleet = function(game_id) {
  var maxmoves = Ships.findOne({game_id: game_id, user_id: 0, moves: {$gt: 0}, destroyed: {$ne: 1}}, {sort: {moves: -1}});
  for (var i = 0; i < maxmoves.moves; i++) {
    var fleet = Ships.find({game_id: game_id, user_id: 0, moves: {$gt: 0}});
    fleet.forEach(function(ship) {
      var directions = [];

      var enemy_in_range = Ships.findOne({$and: [{game_id: ship.game_id}, 
                               {user_id: {$ne: ship.user_id}},
                               {destroyed: {$ne: 1}},
                               {x: {$lte: (parseInt(ship.x, 10) + parseInt(ship.scan_range, 10)), $gte: (parseInt(ship.x, 10) - parseInt(ship.scan_range, 10))}},
                               {y: {$lte: (parseInt(ship.y, 10) + parseInt(ship.scan_range, 10)), $gte: (parseInt(ship.y, 10) - parseInt(ship.scan_range, 10))}}
        ]});
      if (typeof enemies !== 'undefined') {
         var move = "";
         if (enemy_in_range.x > ship.x) {
           move = "right";
         } else if (enemy_in_range.x < ship.x) {
           move = "left";
         } else if (enemy_in_range.y < ship.y) {
           move = "up";
         } else if (enemy_in_range.y > ship.y) {
           move = "down";
         }
         Meteor.call("MoveShip", ship._id, move);
      } else {

        if (ship.x > 0) {
          directions.push("left");
        }
        if (ship.x < 9) {
          directions.push("right");
        }
        if (ship.y > 0) {
          directions.push("up");
        }
        if (ship.y < 9) {
          directions.push("down");
        }
        var move_choice = Math.floor(Math.random() * directions.length);
        Meteor.call("MoveShip", ship._id, directions[move_choice]);
      }
    });
  }
};

var AIAttackFleet = function(game_id) {
  var fleet = Ships.find({game_id: game_id, user_id: 0, has_attacked: {$lt: 1}, destroyed: {$ne: 1}});
  fleet.forEach(function(ship) {
    var turrets = Turrets.find({ship_id: ship._id, has_attacked: {$ne: 1}});
    turrets.forEach(function(turret) {
      if (typeof turret !== "undefined") {
        var enemies = Ships.find({$and: [{game_id: ship.game_id},
                                         {user_id: {$ne: 0}},
                                         {x: {$lte: (parseInt(ship.x, 10) + parseInt(turret.range, 10)), $gte: (parseInt(ship.x, 10) - parseInt(turret.range, 10))}},
                                         {y: {$lte: (parseInt(ship.y, 10) + parseInt(turret.range, 10)), $gte: (parseInt(ship.y, 10) - parseInt(turret.range, 10))}}
                                         ]}).fetch();
        if (enemies.length > 0) {
          Meteor.call("Attack", {turret_id: turret._id, target_id: enemies[0]._id});
        }                        
      }
    });
  });
};

var AISpecialAction = function(game_id) {
  var fleet = Ships.find({game_id: game_id, user_id: 0, has_attacked: {$lt: 1}, destroyed: {$ne: 1}});
  fleet.forEach(function(ship) {
    if ((ship.energy >= 2) && (ship.shield < ship.full_shield)) {
      Meteor.call("ChargeShield", {ship_id: ship._id});
    }
  });
};

var NewPvPGame = function() {
  var user_id = Meteor.userId();
  var game_id = Games.insert({player1: user_id, player2: 0, turn: 'player1', turn_count: 0, max_turns: 30, pvp: 1});
  var parsed_json = EJSON.parse(Assets.getText("quickgame.json"));
  var parsed_turrets = EJSON.parse(Assets.getText("quickgame_turrets.json"));

  var count = 0;
  for (var ship in parsed_json) {
    parsed_json[ship].game_id = game_id;
    parsed_json[ship].x = parseInt(parsed_json[ship].x, 10);
    parsed_json[ship].y = parseInt(parsed_json[ship].y, 10);
    parsed_json[ship].shield = parseInt(parsed_json[ship].shield, 10);
    parsed_json[ship].armor = parseInt(parsed_json[ship].armor, 10);
    parsed_json[ship].power = parseInt(parsed_json[ship].power, 10);
    if (count < 2) {
      parsed_json[ship].user_id = user_id;
    } else { 
      parsed_json[ship].user_id = 0;
    }

    var ship_id = Ships.insert(parsed_json[ship]);
    parsed_turrets["0"].ship_id = ship_id;
    parsed_turrets["1"].ship_id = ship_id;
    parsed_turrets["2"].ship_id = ship_id;
    parsed_turrets["3"].ship_id = ship_id;
    
    if (parsed_json[ship].hull == "Corvette") {
      Turrets.insert(parsed_turrets["0"]);
      Turrets.insert(parsed_turrets["1"]);
    } else if (parsed_json[ship].hull == "Frigate") {
      Turrets.insert(parsed_turrets["0"]);
      Turrets.insert(parsed_turrets["0"]);
      Turrets.insert(parsed_turrets["1"]);
      Turrets.insert(parsed_turrets["3"]);
    }

    count += 1;
  }
  return game_id;
};

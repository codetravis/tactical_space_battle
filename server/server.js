
Meteor.startup(function () {
  // temporarily cleanup all mongo objects when we restart the server
  Ships.remove({});
  Games.remove({});
  Turrets.remove({});
});

Meteor.methods({

  QuickGame: function() {
    var user_id = Meteor.userId();
    var game_id = Games.insert({player1: user_id, player2: 0, turn: 'player1', turn_count: 0, max_turns: 30});
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
      //if (parsed_json[ship].hull == "Corvette") {
        parsed_turrets["0"].ship_id = ship_id;
        Turrets.insert(parsed_turrets["0"]);
      //}
      count += 1;
    }
    return game_id;
  },

  EndTurn: function(game_id) {
    var game = Games.findOne({_id: game_id});
    if (Ships.find({game_id: game._id, user_id: game.player1, destroyed: {$ne: 1}}).count() === 0) {
        console.log("player 2 wins");
        return 0;
    } else if (Ships.find({game_id: game._id, user_id: game.player2, destroyed: {$ne: 1}}).count() === 0) {
        console.log("player 1 wins");
        return 0;
    }

    if (game.turn === 'player1') {
        Games.update(game, {$set: {turn: 'player2'}});
    } else {
      if (game.turn_count === game.max_turns) {
        console.log("game over");
        return 0;
      } else {
        Games.update(game, {$set: {turn: 'player1', turn_count: game.turn_count + 1}});
      }
    }

    game = Games.findOne({_id: game_id});
    var fleet = Ships.find({user_id: game[game.turn], game_id: game._id, destroyed: {$ne: 1}});
    fleet.forEach(function(ship) {
      Ships.update({_id: ship._id}, {$set: {has_attacked: 0, moves: ship.speed}});
    });

    if (game[game.turn] === 0) {
      Meteor.call('AITurn', game_id);
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
        if (ship.y < 9) {
          ship.y = parseInt(ship.y, 10) + 1;
          ship.moves = parseInt(ship.moves, 10) - 1;
        }
      } else if (direction === "right") {
        if (ship.x < 9) {
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
    var ship = Ships.findOne({_id: params.ship_id});
    var target = Ships.findOne({_id: params.target_id});
    if ((target.destroyed !== 1) && (ship.has_attacked !== 1)) {
      if (target.shield > 0) {
        target.shield -= ship.power;
      } else {
        target.armor -= ship.power;
      }

      if (target.armor <= 0) {
        target.destroyed = 1;
      }

      ship.has_attacked = 1;

      Ships.update({_id: ship._id}, ship);
      Ships.update({_id: target._id}, target);
    }
  },

  AITurn: function(game_id) {
    AIMoveFleet(game_id);
    AIAttackFleet(game_id);
    Meteor.call('EndTurn', game_id);
  }
});

var AIMoveFleet = function(game_id) {
  var maxmoves = Ships.findOne({game_id: game_id, user_id: 0, moves: {$gt: 0}, destroyed: {$ne: 1}}, {sort: {moves: -1}});
  for (var i = 0; i < maxmoves.moves; i++) {
    var fleet = Ships.find({game_id: game_id, user_id: 0, moves: {$gt: 0}});
    fleet.forEach(function(ship) {
      var directions = [];
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
    });
  }
};

var AIAttackFleet = function(game_id) {
  var fleet = Ships.find({game_id: game_id, user_id: 0, has_attacked: {$lt: 1}, destroyed: {$ne: 1}});
  fleet.forEach(function(ship) {
    var enemies = Ships.find({$and: [{game_id: ship.game_id},
                                     {user_id: {$ne: 0}},
                                     {x: {$lt: (parseInt(ship.x, 10) + parseInt(ship.attack_range, 10)), $gt: (parseInt(ship.x, 10) - parseInt(ship.attack_range, 10))}},
                                     {y: {$lt: (parseInt(ship.y, 10) + parseInt(ship.attack_range, 10)), $gt: (parseInt(ship.y, 10) - parseInt(ship.attack_range, 10))}}
                                     ]}).fetch();
    if (enemies.length > 0) {
      Meteor.call("Attack", {ship_id: ship._id, target_id: enemies[0]._id});
    }                                
  });
};


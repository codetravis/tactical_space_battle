
Meteor.startup(function () {
  // temporarily cleanup all mongo objects when we restart the server
  Ships.remove({});
  Games.remove({});
});

Meteor.methods({

  QuickGame: function() {
    var user_id = Meteor.userId();
    var game_id = Games.insert({player1: user_id, player2: 0, turn: 'player1'});
    var parsed_json = EJSON.parse(Assets.getText("quickgame.json"));
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
      Ships.insert(parsed_json[ship]);
      count += 1;
    }
  },

  EndTurn: function(game_id) {
    var game = Games.findOne({_id: game_id});
    if (game.turn === 'player1') {
      Games.update(game, {$set: {turn: 'player2'}});
    } else {
      Games.update(game, {$set: {turn: 'player1'}});
    }
    game = Games.findOne({_id: game_id});
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
        if (ship.y < 10) {
          ship.y = parseInt(ship.y, 10) + 1;
          ship.moves = parseInt(ship.moves, 10) - 1;
        }
      } else if (direction === "right") {
        if (ship.x < 10) {
          ship.x = parseInt(ship.x, 10) + 1;
          ship.moves = parseInt(ship.moves, 10) - 1;
        }
      } else if (direction === "left") {
        if (ship.x > 0) {
          ship.x = parseInt(ship.x, 10) - 1;
          ship.moves = parseInt(ship.moves, 10) - 1;
        }
      }
      Ships.update({_id: ship._id}, {$set: {x: ship.x, y: ship.y, moves: ship.moves}});
    }
  },

  Attack: function(params) {
    var ship = Ships.findOne({_id: params.ship_id});
    var target = Ships.findOne({_id: params.target_id});

    if (target.shield > 0) {
      target.shield -= ship.power;
    } else {
      target.armor -= ship.power;
    }
    Ships.update({_id: target._id}, target);
  },

  AITurn: function(game_id) {
    Meteor.call('EndTurn', game_id);
  }
  

});

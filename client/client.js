
Template.home.events({
  "click #quick_game": function(event) {
    var user_id = Meteor.userId();
    Meteor.call('QuickGame', function() {
      var game = Games.findOne({player1: user_id});
      window.location.href = "game/" + game._id;
      }
    );
  }

});


Template.game.helpers({
  ships: function () {
      return Ships.find({user_id: Meteor.userId(), game_id: Router.current().params.game_id})
  },
  
  game: function () {
    return Games.find({_id: Router.current().params.game_id});
  },

  draw_friend: function () {
    var canvas = document.getElementById("main_map");
    if (canvas.getContext) {
      var context = canvas.getContext("2d");

      var ship = Ships.findOne({_id: this._id});

      context.fillStyle = "rgb(0, 100, 0, 0.80)";
      context.fillRect(ship.x * 10, ship.y * 10, 10, 10);
    } else {
      console.log('no canvas?');
    }
  }
});

Template.registerHelper('player_turn', function () {
      var game = Games.findOne({_id: Router.current().params.game_id});
      if(typeof game === 'undefined') {
        return false;
      }

      var turn = game["turn"];
      var user_id = Meteor.userId();
      if(game[turn] === user_id) {
        return true;
      } else {
        return false;
      }
    }
);

Template.game.events({
  "click #end_turn": function(event) {
    Meteor.call('EndTurn', Router.current().params.game_id);
  },
  "click .ship_action": function(event) {
    var ship_id = event.target.id;
    window.location.href = "../ship_action/" + ship_id;
  }
});

Template.ship_action.helpers({
  enemies_in_range: function () {
    var ship = Ships.findOne({_id: Router.current().params.ship_id});
    if (typeof ship === 'undefined') {
      return [];
    }
    
    var enemies = Ships.find({$and: [{game_id: ship.game_id}, 
                                     {user_id: {$ne: ship.user_id}},
                                     {x: {$lt: (parseInt(ship.x, 10) + parseInt(ship.attack_range, 10)), $gt: (parseInt(ship.x, 10) - parseInt(ship.attack_range, 10))}},
                                     {y: {$lt: (parseInt(ship.y, 10) + parseInt(ship.attack_range, 10)), $gt: (parseInt(ship.y, 10) - parseInt(ship.attack_range, 10))}}
                                     ]});
    return enemies;
  }
});

Template.ship_action.events({
  "click #move_up": function(event) {
    var ship = Ships.findOne({_id: Router.current().params.ship_id});
    Meteor.call('MoveShip', ship._id, "up");
  },
  "click #move_down": function(event) {
    var ship = Ships.findOne({_id: Router.current().params.ship_id});
    Meteor.call('MoveShip', ship._id, "down"); 
  },
  "click #move_right": function(event) {
    var ship = Ships.findOne({_id: Router.current().params.ship_id});
    Meteor.call('MoveShip', ship._id, "right");
  },
  "click #move_left": function(event) {
    var ship = Ships.findOne({_id: Router.current().params.ship_id});
    Meteor.call('MoveShip', ship._id, "left");
  },
  "click .attack": function(event) {
    var target_id = event.target.id;
    var ship_id = Router.current().params.ship_id;

    Meteor.call('Attack', {ship_id: ship_id, target_id: target_id});
  }
});


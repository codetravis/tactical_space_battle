
Template.home.events({
  "click #quick_game": function(event) {
    var user_id = Meteor.userId();
    Meteor.call('QuickGame', function(err, data) {
      var game_id = data;
      window.location.href = "game/" + game_id;
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
});

Template.game.onRendered( function () {
  Tracker.autorun(load_map);
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
    Meteor.call('EndTurn', Router.current().params.game_id, load_map);
  },
  "click .ship_action": function(event) {
    var ship_id = event.target.id;
    window.location.href = "../ship_action/" + ship_id;
  }
});

Template.ship_action.onRendered( function () {
  Tracker.autorun(load_map);
});

Template.ship_action.helpers({
  enemies_in_range: function () {
    var ship_id = Router.current().params.ship_id;
    var ship = Ships.findOne({_id: ship_id});
    var turret = Turrets.findOne({ship_id: ship_id}); 
    if (typeof ship === 'undefined') {
      return [];
    }
    
    var enemies = Ships.find({$and: [{game_id: ship.game_id}, 
                                     {user_id: {$ne: ship.user_id}},
                                     {x: {$lt: (parseInt(ship.x, 10) + parseInt(turret.range, 10)), $gt: (parseInt(ship.x, 10) - parseInt(turret.range, 10))}},
                                     {y: {$lt: (parseInt(ship.y, 10) + parseInt(turret.range, 10)), $gt: (parseInt(ship.y, 10) - parseInt(turret.range, 10))}},
                                     {destroyed: {$ne: 1}}
                                     ]});
    return enemies;
  },
  get_ship_img: function () {
    var ship = Ships.findOne({_id: Router.current().params.ship_id});
    if (typeof ship === 'undefined') {
      return "mystery_ship.png";
    }

    return ship.hull + ".png";
  }
});

Template.ship_action.events({
  "click #move_up": function(event) {
    var ship = Ships.findOne({_id: Router.current().params.ship_id});
    Meteor.call('MoveShip', ship._id, "up", load_map);
  },
  "click #move_down": function(event) {
    var ship = Ships.findOne({_id: Router.current().params.ship_id});
    Meteor.call('MoveShip', ship._id, "down", load_map); 
  },
  "click #move_right": function(event) {
    var ship = Ships.findOne({_id: Router.current().params.ship_id});
    Meteor.call('MoveShip', ship._id, "right", load_map);
  },
  "click #move_left": function(event) {
    var ship = Ships.findOne({_id: Router.current().params.ship_id});
    Meteor.call('MoveShip', ship._id, "left", load_map);
  },
  "click .attack": function(event) {
    var target_id = event.target.id;
    var ship_id = Router.current().params.ship_id;

    Meteor.call('Attack', {ship_id: ship_id, target_id: target_id}, load_map);
  },
  "click #done": function(event) {
    var ship = Ships.findOne({_id: Router.current().params.ship_id});
    window.location.href = "/game/" + ship.game_id;
  }
});

var load_map = function () {
  var canvas = document.getElementById("main_map");
  var game_id = "";
  var active_ship = "";
  var route_name = Router.current().route.getName();

  if (canvas.getContext) {
    if(route_name === "game") {
      game_id = Router.current().params.game_id;
    } else {
      active_ship = Ships.findOne({_id: Router.current().params.ship_id});
      if (typeof active_ship === "undefined") {
        return false;
      }
      game_id = active_ship.game_id;
    }
    var fleet = Ships.find({user_id: Meteor.userId(), game_id: game_id});
    var context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    fleet.forEach(function (ship) {
      context.fillStyle = "rgb(0, 100, 0)";
      context.fillRect(ship.x * 20, ship.y * 20, 20, 20);

      var enemies = Ships.find({$and: [{game_id: ship.game_id}, 
                               {user_id: {$ne: ship.user_id}},
                               {destroyed: {$ne: 1}},
                               {x: {$lt: (parseInt(ship.x, 10) + parseInt(ship.scan_range, 10)), $gt: (parseInt(ship.x, 10) - parseInt(ship.scan_range, 10))}},
                               {y: {$lt: (parseInt(ship.y, 10) + parseInt(ship.scan_range, 10)), $gt: (parseInt(ship.y, 10) - parseInt(ship.scan_range, 10))}}
        ]});
      enemies.forEach(function(badship) {
        context.fillStyle = "rgb(100, 0, 0)";
        context.fillRect(badship.x * 20, badship.y * 20, 20, 20);
      });
    });
    if(active_ship !== "") {
      context.fillStyle = "rgb(0, 0, 100)";
      context.fillRect(active_ship.x * 20, active_ship.y * 20, 20, 20);
    }
  } else {
    console.log('no canvas?');
  }
};


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
    return Games.findOne({_id: Router.current().params.game_id});
  },
  ship_turrets: function () {
    return Turrets.find({ship_id: this._id});
  }
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
    Meteor.call('EndTurn', Router.current().params.game_id, check_for_win);
  },
  "click .listed_ship": function(event) {
    $(".selected").removeClass("selected");

    var ship_id = $(event.target).closest(".listed_ship").find(".take_ship_action").attr("id");
    $(event.target).closest(".listed_ship").addClass("selected");

    Session.set("selected_ship", ship_id);
    load_map();
  },
  "click .take_ship_action": function(event) {
    var ship_id = event.target.id;
    Session.set("selected_ship", ship_id);
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
    var turret_id = Session.get("turret_id");
    var turret;

    if (typeof turret_id !== 'undefined' && turret_id !== "") {
      turret = Turrets.findOne({_id: turret_id});
    } else {
      turret = Turrets.findOne({ship_id: ship_id});
    }

    if (typeof ship === 'undefined') {
      return [];
    }
    
    var enemies = Ships.find({$and: [{game_id: ship.game_id}, 
                                     {user_id: {$ne: ship.user_id}},
                                     {x: {$lte: (parseInt(ship.x, 10) + parseInt(turret.range, 10)), $gte: (parseInt(ship.x, 10) - parseInt(turret.range, 10))}},
                                     {y: {$lte: (parseInt(ship.y, 10) + parseInt(turret.range, 10)), $gte: (parseInt(ship.y, 10) - parseInt(turret.range, 10))}},
                                     {destroyed: {$ne: 1}}
                                     ]});
    return enemies;
  },
  get_ship: function () {
    return Ships.findOne({_id: Router.current().params.ship_id});
  },
  ship_turrets: function () {
    return Turrets.find({ship_id: Router.current().params.ship_id});
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

    if (typeof Session.get("turret_id") !== "undefined") {
      Meteor.call('Attack', {turret_id: Session.get("turret_id"), target_id: target_id}, load_map);
    }
  },
  "click #charge_shield": function(event) {
    var ship_id = Router.current().params.ship_id;
    Meteor.call('ChargeShield', {ship_id: ship_id});
  },
  "click #back": function(event) {
    var ship = Ships.findOne({_id: Router.current().params.ship_id});
    window.location.href = "/game/" + ship.game_id;
  },
  "click .turret": function(event) {
    $(".selected").removeClass("selected");
    var turret_id = event.target.id;
    $(event.target).addClass("selected");
    Session.set("turret_id", turret_id);
  }
});

var check_for_win = function (err, data) {

  if (data.message === "game over") {
    window.location.href = "../lose_game";
  } else if (data.message === "you won") {
    window.location.href = "../win_game";
  } else {
    load_map();
  }
}


var load_map = function () {
  var canvas = document.getElementById("main_map");
  var game_id = "";
  var active_ship = "";
  var route_name = Router.current().route.getName();

  if (canvas === null) {
    return false;
  }
  if (canvas.getContext) {
    if(route_name === "game") {
      game_id = Router.current().params.game_id;
      active_ship = Ships.findOne({_id: Session.get("selected_ship")});
      if (typeof active_ship === "undefined") {
        active_ship = "";
      }
    } else {
      active_ship = Ships.findOne({_id: Router.current().params.ship_id});
      if (typeof active_ship === "undefined") {
        return false;
      }
      game_id = active_ship.game_id;
    }
    var fleet = Ships.find({user_id: Meteor.userId(), game_id: game_id, destroyed: {$ne: 1}});
    var context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    fleet.forEach(function (ship) {
      context.fillStyle = "rgb(0, 100, 0)";
      context.fillRect(ship.x * 10, ship.y * 10, 10, 10);
      context.fillStyle = "rgba(50, 50, 100, 0.25)";
      context.fillRect((ship.x - ship.scan_range) * 10, (ship.y - ship.scan_range) * 10, (ship.scan_range * 2 + 1) * 10, (ship.scan_range * 2 + 1) * 10);

      var enemies = Ships.find({$and: [{game_id: ship.game_id}, 
                               {user_id: {$ne: ship.user_id}},
                               {destroyed: {$ne: 1}},
                               {x: {$lte: (parseInt(ship.x, 10) + parseInt(ship.scan_range, 10)), $gte: (parseInt(ship.x, 10) - parseInt(ship.scan_range, 10))}},
                               {y: {$lte: (parseInt(ship.y, 10) + parseInt(ship.scan_range, 10)), $gte: (parseInt(ship.y, 10) - parseInt(ship.scan_range, 10))}}
        ]});
      enemies.forEach(function(badship) {
        context.fillStyle = "rgb(100, 0, 0)";
        context.fillRect(badship.x * 10, badship.y * 10, 10, 10);
      });
    });
    if(active_ship !== "") {
      if (active_ship.destroyed != "1") {
        context.fillStyle = "rgb(71, 235, 244)";
        context.fillRect(active_ship.x * 10, active_ship.y * 10, 10, 10);
      }
    }
  } else {
    console.log('no canvas?');
  }
};


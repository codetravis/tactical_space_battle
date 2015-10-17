
Meteor.startup(function () {
  // temporarily cleanup all mongo objects when we restart the server
  Ships.remove({});
  Games.remove({});
});

Meteor.methods({

  QuickGame: function(user_id) {
    var game_id = Games.insert({player1: user_id, player2: 0});
    var parsed_json = EJSON.parse(Assets.getText("quickgame.json"));
    for (var ship in parsed_json) {
      parsed_json[ship].game_id = game_id;
      parsed_json[ship].user_id = user_id;
      Ships.insert(parsed_json[ship]);
      parsed_json[ship].user_id = 0;
      Ships.insert(parsed_json[ship]);
    }
  }

});


Template.home.events({
  "click #quick_game": function(event) {
    var user_id = Session.get("user_id");
    var game_id = Meteor.call('QuickGame', user_id);
    window.location.href = "game/" + game_id;
  }

});

Template.home.created = function() {
  
};


Games = new Mongo.Collection("games");
Ships = new Mongo.Collection("ships");
Turrets = new Mongo.Collection("turrets");

Router.route('/', {
  name: 'home',
  template: 'home'
});

Router.route('/game/:game_id', {
  name: 'game',
  template: 'game'
});

Router.route('ship_action/:ship_id', {
  name: 'ship_action',
  template: 'ship_action'
});

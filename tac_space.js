
Games = new Mongo.Collection("games");
Ships = new Mongo.Collection("ships");

Router.route('/', {
  name: 'home',
  template: 'home'
});

Router.route('/game/:_id', {
  name: 'game',
  template: 'game'
});

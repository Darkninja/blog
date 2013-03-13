if(process.env.VCAP_SERVICES){
	var env = JSON.parse(process.env.VCAP_SERVICES);
    var mongo = env['mongodb-1.8'][0]['credentials'];
}
else{
    var mongo = {
		"hostname":"localhost",
		"port":27017,
		"username":"",
		"password":"",
		"name":"",
		"db":"db"
    }
}
var generate_mongo_url = function(obj){
    obj.hostname = (obj.hostname || 'localhost');
    obj.port = (obj.port || 27017);
    obj.db = (obj.db || 'test');
    if(obj.username && obj.password){
		return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
    }
    else{
		return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
    }
}
var mongourl = generate_mongo_url(mongo);

/**
 * Module dependencies.
 */

var express = require('express'),
	routes = require('./routes'),
	http = require('http'),
	path = require('path'),
	mongoose = require('mongoose'),
	passport = require('passport'),
	LocalStrategy = require('passport-local').Strategy,
	flash = require('connect-flash'),
	crypto = require('crypto'),
	moment = require('moment');

var app = express();

mongoose.connect(mongourl);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback(){
	console.log('Connected to DB');
});
var userSchema = mongoose.Schema({
	username: String,
	password: String
});
var postSchema = mongoose.Schema({
	title: String,
	slug: String,
	body: String,
	date: String
});
userSchema.methods.validatePassword = function(password){
	if (crypto.createHash('sha512').update(password).digest() === this.password){
		return true;
	} else {
		return false;
	}
};
var User = mongoose.model('User', userSchema);
var Post = mongoose.model('Post', postSchema);
var user = new User({
	username: 'andy',
	password: crypto.createHash('sha512').update('randompassword').digest()
});
User.findOne({username: user.username}, function(err, dbuser){
	if(!dbuser){
		user.save();
	}
});

app.configure(function(){
	app.set('port', process.env.VCAP_APP_PORT || 3000);
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(flash());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.cookieParser('random secret key'));
	app.use(express.session({ cookie: { maxAge: 3600000 }}));
	app.use(require('stylus').middleware(__dirname + '/public'));
	app.use(express.static(path.join(__dirname, 'public')));
	app.use(passport.initialize());
	app.use(passport.session());
	app.use(app.router);
	app.locals.pretty = true;
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

passport.serializeUser(function(user, done) {
	done(null, user);
});

passport.deserializeUser(function(obj, done) {
	done(null, obj);
});

passport.use(new LocalStrategy(function(username, password, done) {
    User.findOne({ username: username }, function(err, user) {
		if (err) { 
			return done(err); 
		}
		if (!user) {
			return done(null, false, { message: 'Incorrect username.' });
		}
		if (!user.validatePassword(password)) {
			return done(null, false, { message: 'Incorrect password.' });
		}
		return done(null, user);
    });
  }
));

app.get('/', function(req, res){
	Post.find(function(err, posts){
		if(err){
			res.render('error', {title: 'Blog', error: err});
		} else {
			res.render('index', { title: 'Blog', posts: posts, user: req.user });
		}
	});
});
app.get('/login', routes.login);
app.post('/login', 
	passport.authenticate('local', {
		failureRedirect: '/login',
		failureFlash: true
	}), function(req, res){
		res.redirect('/dashboard')
});
app.get('/logout', function(req, res){
	req.logout();
	res.redirect('/');
});
app.get('/dashboard', ensureAuthenticated, function(req, res){
	Post.find(function(err, posts){
		if(err){
			res.send("500: Server error.")
		} else {
			res.render('dashboard', {
				title: 'Blog', 
				user: req.user, 
				editPost: {
					isEdit: false
				},
				posts: posts.reverse()});
		}
	});
});
app.param('post', function(req, res, next, slug){
	Post.findOne({slug: slug}, function(err, post){
		if(err){
			next(err);
		} else if(post){
			req.post = post;
			next();
		} else {
			next(new Error('Failed to load post.'));
		}
	});
});
app.get('/posts/:post', routes.posts);
app.post('/new', ensureAuthenticated, function(req, res){
		var post = new Post({
			title: req.param('title'),
			slug: makeSlug(req.param('title')),
			body: req.param('body'),
			date: moment().format('LL')
		});
		post.save();
		res.redirect('/');
});
app.get('/edit/:post', ensureAuthenticated, function(req, res){
	Post.find(function(err, posts){
		if(err){
			res.send("500: Server error.")
		} else {
			res.render('dashboard', {
				title: 'Blog', 
				user: req.user,
				editPost: {
					isEdit: true,
					title: req.post.title,
					slug: req.post.slug,
					body: req.post.body
				}, 
				posts: posts.reverse()});
		}
	});
});
app.post('/save/:post', ensureAuthenticated, function(req, res){
	req.post.title = req.param('title');
	req.post.slug = makeSlug(req.param('title'));
	req.post.body = req.param('body');
	req.post.save();
	res.redirect('/dashboard');
});
app.get('/delete/:post', ensureAuthenticated, function(req, res){
		Post.remove({slug: req.post.slug}, function(err){});
		res.redirect('/dashboard');
});

function makeSlug(title){
	var slug = title.toLowerCase().replace(/\s/g,"_").replace(/\W/g,'');
	return slug;
};

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}

http.createServer(app).listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port'));
});

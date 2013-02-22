
/*
 * GET home page.
 */

exports.index = function(req, res){
	
};

exports.login = function(req, res){
	res.render('login', {title: 'Blog', user: req.user});
};

exports.dashboard = function(req, res){
	
};

exports.posts = function(req, res){
	res.render('view', {title: 'Blog', post: req.post, user: req.user});
};


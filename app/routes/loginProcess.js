exports.loginProcess = function(req, res){
	passport.authenticate('local', {
		successRedirect: '/home',
		failureRedirect: '/',
		failureFlash: true
	});
};

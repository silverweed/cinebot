var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');
var parser = require('./cineparser');

var cwd = path.dirname(fs.realpathSync(__filename));
console.log("cwd = " + cwd);
var port = 8888;
var opts = { useCache: true };
parser.apiKey = fs.readFileSync(cwd + '/api.key', 'utf8');

http.createServer(function (req, resp) {
	var u = url.parse(req.url, true);
	var _this = this;
	switch (u.pathname) {
	case '/process':
		parser.reset();
		parser.once('ready', function (data) {
			resp.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
			resp.end(parser.emitCode(), 'utf8');
			console.log('Processed in ' + (new Date() - _this.time) + ' ms.');
		});
		if (u.query.dates.length > 0)
			parser.setDates(u.query.dates);
		this.time = new Date();	
		parser.parse(u.query.page, opts);
		break;
	default:
		resp.writeHead(200, { "Content-Type": "text/html" });
		resp.end(fs.readFileSync(cwd + '/index.html', 'utf8'));
	}
}).listen(port);

console.log("Serving on port " + port +
	"\nusing cache: " + opts.useCache);

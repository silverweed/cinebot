var http = require('http');
var url = require('url');
var fs = require('fs');
var parser = require('./cineparser');

var port = 8888;
parser.apiKey = fs.readFileSync('./api.key', 'utf8');

http.createServer(function (req, resp) {
	var u = url.parse(req.url, true);
	switch (u.pathname) {
	case '/process':
		parser.reset();
		parser.on('ready', function (data) {
			resp.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
			resp.end(parser.emitCode(), 'utf8');
		});
		if (u.query.dates.length > 0)
			parser.setDates(u.query.dates);
		parser.parse(u.query.page, { keepLocal: true });
		break;
	default:
		resp.writeHead(200, { "Content-Type": "text/html" });
		resp.end(fs.readFileSync('index.html', 'utf8'));
	}
}).listen(port);

console.log("Serving on port " + port);

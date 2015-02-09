var http = require('http');
var url = require('url');
var fs = require('fs');
var parser = require('./cineparser');

var server = http.createServer(function (req, resp) {
	var u = url.parse(req.url, true);
	switch (u.pathname) {
	case '/process':
		parser.on('dataReady', function (data) {
			resp.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
			resp.end(parser.emitCode(), 'utf8');
		});
		parser.parse(u.query.page, { keepLocal: true });
		break;
	default:
		resp.writeHead(200, { "Content-Type": "text/html" });
		resp.end(fs.readFileSync('index.html', 'utf8'));
	}
});

server.listen(8888);

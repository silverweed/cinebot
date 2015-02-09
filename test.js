var parser = require('./cineparser');

parser.on('dataReady', function (data) {
	console.log(parser.emitCode());
});
parser.parse('http://www.comingsoon.it/film/noah/49157/scheda/', { keepLocal: true });

/* Fetches a page from comingsoon.it, parses it and fills cineteatrosanluigi
 * template.
 * by silverweed
 */
var cheerio = require('cheerio');
var fs = require('fs');
var https = require('https');
var exec = require('child_process').exec;
var EventEmitter = require('events').EventEmitter;

var Parser = (function () {
	function Parser() {
		this.data = {};
		this.yturl = null;
		this.type = 'CS';
		this.dataReady = false;
		this.dates = [];
		this.ee = new EventEmitter();
		this.apiKey = null;
		this.ytReady = false;
	}
	Parser.prototype.parse = function (url, opts) {
		var file = 'pages/' + url.split('/')[4];
		var that = this;
		if (this.apiKey) {
			this.ytReady = false;
			https.get('https://www.googleapis.com/youtube/v3/search?part=id&q=' + file.slice(6).replace(/-/g, '+') +
				'+trailer+ita&videoEmbeddable=true&maxResults=1&regionCode=IT&type=video&key=' + this.apiKey,
				function (resp) {
					var body = '';
					resp.on('data', function (d) { body += d; });
					resp.on('end', function () {
						console.log(body);
						var video = JSON.parse(body);
						if (!video.items) {
							console.log("Invalid response from YouTube API: " + video);
							return;
						}
						that.yturl = video.items[0].id.videoId;
						console.log("yturl = " + that.yturl);
						that.ytReady = true;
						if (that.dataReady)
							that.ee.emit('ready');
					});
				}).on('error', function (e) { console.log("Error: " + e); });
		}		
		if (fs.existsSync(file)) {
			that.parseCS(file);
			console.log("Parsed page " + file + ".");
			return that;
		}
		exec("curl " + url + " | sed -n '/\"cs-components__section-contentsbox\"/,/<\\/section>/ p' > " + file,
			function (err, stdout, stderr) {
				if (err) throw err;
				console.log("Fetched url " + url + ".");
				that.parseCS(file);
				console.log("Parsed page " + file + ".");
				if (!(opts && opts.keepLocal))
					fs.unlink(file, function (err) { if (err) throw err; console.log("Deleted local file "+file+"."); });
				return that;
			});
	}
	// parse a Comingsoon.it page; subsequent calls to emitCode() will use 
	// data from this page until a new parseCS will be called.
	Parser.prototype.parseCS = function (file) {
		var $ = cheerio.load(fs.readFileSync(file, 'utf8'));

		this.dataReady = false;
		this.data = {};

		// Traverse HTML tree and gather data
		this.data.plot = $('.product-profile-box-toprow-text p').text().trim();
		if (this.data.plot.length > 350) {
			// split in preplot and postplot
			var idx = -1, start = 300, cycles = 0;
			while ((idx < 0 || idx > 400) && cycles++ < 20) {
				idx = this.data.plot.indexOf('.', start);
				if (idx < 0 || idx > 400) {
					idx = this.data.plot.indexOf('!', start);
					if (idx < 0 || idx > 400)
						idx = this.data.plot.indexOf('?', start);
				}
				start -= 10;
			}
			if (idx < 0 || idx > 400) {
				console.log("Warning: couldn't auto split plot. Please split it manually.");
				this.data.preplot = this.data.plot;
			} else {
				this.data.preplot = this.data.plot.slice(0, idx + 1);
				this.data.postplot = this.data.plot.slice(idx + 1);
				if (this.data.postplot)
					this.data.postplot = this.data.postplot.trim();
			}
		} else {
			this.data.preplot = this.data.plot;
			this.data.postplot = null;
		}			

		var list = $('ul.product-profile-box-middlerow-list li');
		for (var j = 0; j < list.length; ++j) {
			var li = list[j];
			for (var i = 0; i < li.children.length; ++i) {
				var c = li.children[i];
				if (c.name === 'strong') {
					switch (c.children[0].data) {
					case "GENERE":
						this.data.genre = c.next.next.children[0].data;
						break;
					case "ANNO":
						this.data.year = c.next.next.children[0].data;
						break;
					case "REGIA":
						this.data.direction = c.next.next.children[0].data;
						break;
					case "ATTORI":
						this.data.cast = li.children.filter(function (e) { 
							return e.name === 'a' && e.attribs && e.attribs.itemprop === 'actor';
						}).map(function (e) { 
							return e.children[0].data;
						}).slice(0, 10);
						break;
					case "PAESE":
						this.data.country = c.next.data.slice(2);
						break;
					case "DURATA":
						this.data.duration = parseInt(c.next.next.children[0].data, 10);
						var hours = Math.floor(this.data.duration / 60);
						this.data.duration = (hours > 0 ? hours + (hours > 1 ? " ore" : " ora") + " e " : "") + (this.data.duration - hours * 60 > 0 ? (this.data.duration - hours * 60) + " minuti" : "");
						break;
					}
				}
			}				
		}
		this.dataReady = true;
		if (this.ytReady)
			this.ee.emit('ready');
		return this;
	}
	// Fill cineteatro template with data. Should only be called when dataReady == true. For ease of writing,
	// this function is compiled from Coffeescript.
	Parser.prototype.emitCode = function () {
	      var code, date, _ref, _ref1;
	      code = "<head>\n<style>\nli.orario\n{\n  margin-top: 15px;\n  color: #000;\n  font-size: large;\n}\n</style>\n</head>\n<div style=\"float: left; margin: 15px 15px 15px 0px;\"><iframe src=\"http://www.youtube.com/embed/" + this.data.yturl + "?iv_load_policy=3&start=12\" height=\"260\" width=\"320\" allowfullscreen=\"\" frameborder=\"0\"></iframe></div>\n<strong>IN SALA:</strong>\n<ul style=\"margin-left: 450px; font-family: arial;\">\n" + (this.dates.length > 0 ? ((function() {
		var _i, _len, _ref, _results;
		_ref = this.dates;
		_results = [];
		for (_i = 0, _len = _ref.length; _i < _len; _i++) {
		  date = _ref[_i];
		  _results.push("\t<li class=\"orario\">" + date + "</li>");
		}
		return _results;
	      }).call(this)).join("\n") : "	<!-- <li class=\"orario\">Inserire l'orario</li> -->") + "\n</ul>\n\n" + this.data.preplot + "\n<!--more-->\n" + ((_ref = this.data.postplot) != null ? _ref : "") + "\n\n<br clear=\"left\" />\n\n<strong>GENERE:</strong> " + this.data.genre + "\n\n<strong>NAZIONE E ANNO:</strong> " + this.data.country + " " + this.data.year + "\n\n<strong>DURATA:</strong> " + this.data.duration + "\n\n<strong>REGIA:</strong> " + this.data.direction + "\n\n<strong>CAST:</strong>\n<ul>\n" + (((_ref1 = this.data.cast) != null ? _ref1.map : void 0) != null ? (this.data.cast.map(function(e) {
		return "\t<li>" + e + "</li>";
	      })).join("\n") : void 0) + "\n</ul>\n\n<strong>PREZZI:</strong>\n- <em>Intero:</em> 6 €\n- <em>Ridotto</em>: 4,50 €";
	      return code;
	}
	Parser.prototype.on = function (selector, callback) {
		return this.ee.on(selector, callback);
	}

	Parser.prototype.setDates = function (rawdates) {
		var lines = rawdates.split("\n");
		var m;
		for (var i = 0; i < lines.length; ++i) {
			console.log("line: "+lines[i]);
			if ((m = lines[i].match(/^\s*(Luned.|Marted.|Mercoled.|Gioved.|Venerd.|Sabato|Domenica) ([0-9]+) (?:alle )?ore ([0-9\-:.,]+)\s*$/i))) {
				if (m[1][0] != 'S' && m[1][0] != 'D')
					m[1] = m[1].slice(0, m[1].length - 1) + 'ì';
				if (m[3].length == 2)
					m[3] += ':00';
				this.dates.push(m[1] + " " + m[2] + " alle ore " + m[3]);
			}
		}
	}

	Parser.prototype.reset = function () {
		this.data = {};
		this.dataReady = false;
		this.ytReady = false;
		this.dates = [];
	}

	return Parser;
})();

module.exports = new Parser();

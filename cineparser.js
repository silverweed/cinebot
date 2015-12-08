/* Fetches a page from comingsoon.it, parses it and fills cineteatrosanluigi
 * template.
 * by silverweed
 */
var cheerio = require('cheerio');
var fs = require('fs');
var path = require('path');
var http = require('http');
var https = require('https');
var exec = require('child_process').exec;
var EventEmitter = require('events').EventEmitter;

var cwd = path.dirname(fs.realpathSync(__filename));

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
		this.LATEST_CS_VERSION = 2;
	}
	Parser.prototype.parse = function (url, opts) {
		console.log('------------------' + (new Date()) + '------------------');
		console.log('** Requested URL: ' + url);
		var files = (function () {
			var f = url.split('/')[4];
			return {
				base: f,
				full: cwd + '/' + f,
				pages: cwd + '/pages/' + f,
				videoIds: cwd + '/videoIds/' + f
			};
		})();
		opts.files = files;
		var _this = this;
		if (this.apiKey) {
			this.ytReady = false;
			var ytQuery = 'https://www.googleapis.com/youtube/v3/search?part=id&q=' +
				files.base.replace(/-/g, '+') +
				'+trailer+ita&videoEmbeddable=true&maxResults=1&regionCode=IT&type=video&key=' + this.apiKey;
			if (opts && opts.useCache && fs.existsSync(files.videoIds)) {
				console.log('** Using cached videoId: ' + files.videoIds);
				fs.readFile(files.videoIds, 'utf-8', function (err, data) {
					if (err) {
						_this.queryYT(ytQuery, opts);
						return;
					}
					_this.yturl = data;
					console.log('**** YT: read cached videoId: ' + _this.yturl);
					_this.ytReady = true;
					if (_this.dataReady)
						_this.ee.emit('ready');
				});
			} else {
				_this.queryYT(ytQuery, opts);
			}
		}		
		if (opts && opts.useCache && fs.existsSync(files.pages)) {
			console.log('** Using cached page: ' + files.pages);
			_this.parseCS(cheerio.load(fs.readFileSync(files.pages, 'utf-8')), opts.csVersion);
			console.log('**** Parsed page: ' + files.pages);
			return _this;
		}
		console.log('** GET page: ' + url);
		http.get(url, function (resp) {
			var body = '';
			resp.on('data', function (d) { body += d; });
			resp.on('end', function () {
				var $ = cheerio.load(body);
				// Concurrently parse page and save it
				console.log('**** Page received. Parsing...');
				_this.parseCS($, opts.csVersion);
				console.log('**** Parsed page: ' + files.pages);
				if (opts && opts.useCache) {
					fs.writeFile(files.pages, '' + $('.contenitore-scheda').html(), function (err) {
						if (err) throw err;
						console.log('** Cached page: ' + files.pages);
						return _this;
					});
				}
			});
		});
	}

	Parser.prototype.queryYT = function (ytQuery, opts) {
		console.log('** Querying YouTube API: ' + ytQuery);
		var _this = this;
		var ready = function () {
			this.ytReady = true;
			if (_this.dataReady)
				_this.ee.emit('ready');
		};
		https.get(ytQuery, function (resp) {
			var body = '';
			resp.on('data', function (d) { body += d; });
			resp.on('end', function () {
				console.log('**** Received from YouTube: ' + body);
				var video = JSON.parse(body);
				if (!video.items[0] || !video.items[0].id) {
					console.log("[!!] Invalid response from YouTube API: " + video);
					ready();
					return;
				}
				_this.yturl = video.items[0].id.videoId;
				console.log('**** YT: received videoId: ' + _this.yturl);
				ready();
				if (opts && opts.useCache) {
					fs.writeFile(opts.files.videoIds, _this.yturl, function (err) {
						if (err) throw err;
						console.log('** Cached videoId: ' + opts.files.videoIds + ' (' + _this.yturl + ')');
						return _this;
					});
				}
			});
		}).on('error', function (e) { console.log("[!!] Error: " + e); });
	}

	// parse a Comingsoon.it page; subsequent calls to emitCode() will use 
	// data from this page until a new parseCS will be called.
	// Argument: a Cheerio parser; [optional] the Comingsoon format version
	// (null = latest; 1: "old", 2: "new")
	Parser.prototype.parseCS = function ($, csVersion) {
		this.dataReady = false;
		this.data = {};
		csVersion = +csVersion || this.LATEST_CS_VERSION;
		if (csVersion < 1 || csVersion > this.LATEST_CS_VERSION)
			csVersion = this.LATEST_CS_VERSION;
		console.log("**** Using csVersion = " + csVersion);
		
		var plotClassName = ['.product-profile-box-toprow-text',
				     '.contenuto-scheda-destra'][csVersion - 1];

		// Traverse HTML tree and gather data
		// The plot is the last child of '.contenuto-scheda-destra'
		this.data.plot = $(plotClassName).children().last().text().trim();
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

		var listClassName = ['div.product-profile-box-middlerow-left ul li',
				     'div.box-descrizione ul li'][csVersion - 1];
		var cname = ['strong', 'span'][csVersion - 1];
		var list = $(listClassName);
		for (var j = 0; j < list.length; ++j) {
			var li = list[j];
			for (var i = 0; i < li.children.length; ++i) {
				var c = li.children[i];
				if (c.name === cname) {
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
						var dtime = c.next.next.attribs.datetime;
						this.data.duration = this.parseDuration(dtime.slice(2, dtime.length - 1));
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

	Parser.prototype.parseDuration = function (min) {
		var dur = parseInt(min, 10);
		var hours = Math.floor(dur / 60);
		return (hours > 0
				? hours + (hours > 1 ? " ore" : " ora") + " e " 
				: ""
			) + (dur - hours * 60 > 0
				? (dur - hours * 60) + " minuti"
				: "");
	}

	// Fill cineteatro template with data. Should only be called when dataReady == true. For ease of writing,
	// this function is compiled from Coffeescript.
	Parser.prototype.emitCode = function () {
	      var code, date, _ref, _ref1;
	      code = "<head>\n<style>\nli.orario\n{\n  margin-top: 15px;\n  color: #000;\n  font-size: large;\n}\n</style>\n</head>\n<div style=\"float: left; margin: 15px 15px 15px 0px;\"><iframe src=\"http://www.youtube.com/embed/" + this.yturl + "?iv_load_policy=3&start=12\" height=\"260\" width=\"320\" allowfullscreen=\"\" frameborder=\"0\"></iframe></div>\n<strong>IN SALA:</strong>\n<ul style=\"margin-left: 450px; font-family: arial;\">\n" + (this.dates.length > 0 ? ((function() {
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

	Parser.prototype.once = function (selector, callback) {
		return this.ee.once(selector, callback);
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

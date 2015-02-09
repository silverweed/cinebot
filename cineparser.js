/* Fetches a page from comingsoon.it, parses it and fills cineteatrosanluigi
 * template.
 * by silverweed
 */
var cheerio = require('cheerio');
var fs = require('fs');
var exec = require('child_process').exec;
var EventEmitter = require('events').EventEmitter;

var Parser = (function () {
	function Parser() {
		this.data = {};
		this.type = 'CS';
		this.dataReady = false;
		this.ee = new EventEmitter();
	}
	Parser.prototype.parse = function (url, opts) {
		var file = url.split('/')[4];
		var that = this;
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
			}
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
		this.ee.emit('dataReady', this.data);
		return this;
	}
	// Fill cineteatro template with data. Should only be called when dataReady == true.
	Parser.prototype.emitCode = function () {
		var code;
		code = "<head>\n<style>\nli.orario\n{\n  margin-top: 15px;\n  color: #000;\n  font-size: large;\n}\n</style>\n</head>\n<div style=\"float: left; margin: 15px 15px 15px 0px;\"><iframe src=\"http://www.youtube.com/embed/" + this.data.yturl + "?iv_load_policy=3&start=12\" height=\"260\" width=\"320\" allowfullscreen=\"\" frameborder=\"0\"></iframe></div>\n<strong>IN SALA:</strong>\n<ul style=\"margin-left: 450px; font-family: arial;\">\n	<!-- <li class=\"orario\">Inserire l'orario</li> -->\n</ul>\n\n" + this.data.preplot + "\n<!--more-->\n" + this.data.postplot + "\n\n<br clear=\"left\" />\n\n<strong>GENERE:</strong> " + this.data.genre + "\n\n<strong>NAZIONE E ANNO:</strong> " + this.data.country + " " + this.data.year + "\n\n<strong>DURATA:</strong> " + this.data.duration + "\n\n<strong>REGIA:</strong> " + this.data.direction + "\n\n<strong>CAST:</strong>\n<ul>\n" + (this.data.cast && this.data.cast.map(function(e) {
		  return "\t<li>" + e + "</li>";
		}).join("\n")) + "\n</ul>\n\n<strong>PREZZI:</strong>\n- <em>Intero:</em> 6 €\n- <em>Ridotto</em>: 4,50 €";
		return code;
	}
	Parser.prototype.on = function (selector, callback) {
		return this.ee.on(selector, callback);
	}

	return Parser;
})();

module.exports = new Parser();
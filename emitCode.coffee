wrapper =
	data: {}
	dates: []
	yturl: undefined
	emitCode: () ->
		code = """
		<head>
		<style>
		li.orario
		{
		  margin-top: 15px;
		  color: #000;
		  font-size: large;
		}
		</style>
		</head>
		<div style="float: left; margin: 15px 15px 15px 0px;"><iframe src="http://www.youtube.com/embed/#{@yturl}?iv_load_policy=3&start=12" height="260" width="320" allowfullscreen="" frameborder="0"></iframe></div>
		<strong>IN SALA:</strong>
		<ul style="margin-left: 450px; font-family: arial;">
		#{if @dates.length > 0 then ("\t<li class=\"orario\">#{date}</li>" for date in @dates).join "\n" else "	<!-- <li class=\"orario\">Inserire l'orario</li> -->"}
		</ul>

		#{@data.preplot}
		<!--more-->
		#{@data.postplot ? ""}

		<br clear="left" />

		<strong>GENERE:</strong> #{@data.genre}

		<strong>NAZIONE E ANNO:</strong> #{@data.country} #{@data.year}

		<strong>DURATA:</strong> #{@data.duration}

		<strong>REGIA:</strong> #{@data.direction}

		<strong>CAST:</strong>
		<ul>
		#{if @data.cast?.map? then (@data.cast.map (e) -> return "\t<li>#{e}</li>").join "\n"}
		</ul>

		<strong>PREZZI:</strong>
		- <em>Intero:</em> 6 €
		- <em>Ridotto</em>: 4,50 €
		"""
		return code

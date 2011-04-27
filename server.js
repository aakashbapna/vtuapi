var app = require('express').createServer(),
 request = require("request"),
 jsdom = require('jsdom'),
 Do = require("./do"),
 redis_pkg = require("redis");

var MAX_USNS = 50;
var MAX_REQUEST_HOUR = 200;
var redis = redis_pkg.createClient();

app.get('/', function(req, res){
    res.sendfile('readme.txt');
});

//check for rate limiting in this handler
app.get("/results.json", function(req,res,next){
	redis.exists("global:rate_limit:hour:"+req.connection.remoteAddress,function(err,reply){
		if (reply == 0 ) {
			//first request from this ip in this hour.
			redis.setex("global:rate_limit:hour:"+req.connection.remoteAddress,3600,MAX_REQUEST_HOUR-1) // hourly rate limit hence expire = 86400 secs
			//redis.expire("global:rate_limit:hour:"+req.connection.remoteAddress,"3600")
			res.header("X-RateLimit-remaining",MAX_REQUEST_HOUR - 1)
			res.header("X-RateLimit-reset",3600);
			next();
		} else  {
		  	redis.decr("global:rate_limit:hour:"+req.connection.remoteAddress, function(err, request_remaining) {
		  	    if (err)
		  	    	console.log("error in redis read"+err);
				if (request_remaining<0) {
				    console.log("Rate limited IP:"+req.connection.remoteAddress);
				    res.header("X-RateLimit-remaining", 0)
				    setRateLimitTTL(function(ttl){
				    	res.send("API rate limiting in effect, please make request after "+Math.ceil(ttl/60)+" mins",400)
				    })
				 } else {
				    res.header("X-RateLimit-remaining",request_remaining)
				    setRateLimitTTL(function(ttl){
				    	next();
				    })
				 	
				 }
			   }) ; 
		
			function setRateLimitTTL(callback){
				redis.ttl("global:rate_limit:hour:"+req.connection.remoteAddress, function(err,ttl){
							 	res.header("X-RateLimit-reset",ttl)
								callback(ttl);	 		
							 })
		
				}
		}
	})

}) 

//main api request handler
app.get('/results.json', function(req, res){
	
	if(!req.query.usn){
		res.send("usn parameter missing",400);
		return;
	}
	var usn_arr = []
	if(req.query.usn.indexOf(":")>0) {
	    var starting_usn = req.query.usn.split(":",2)[0]
		var total_required = parseInt(req.query.usn.split(":",2)[1])
		total_required = total_required> MAX_USNS ?  MAX_USNS : total_required
		for(var i=0;i<total_required;i++) 
		{
			usn_arr.push(starting_usn)
			starting_usn = increment_usn(starting_usn)
		}		
	} else
		usn_arr = req.query.usn.split(",")
	redis.incr("global:total_requests",function(err,total_now){
		console.log("request no: "+ total_now +" for usn:"+ usn_arr);
	})
	
    res.contentType('json');
    
    //force reload of result if reload=true in querystring
    var reload_cache = false
    if(req.query.reload && req.query.reload == "true")
    	reload_cache = true;
    
    
    if(usn_arr.length == 1) {
		vtu_result(usn_arr[0],reload_cache, function(json) {
		  res.send(json);
		})
    } else {
		usn_arr = usn_arr.slice(0,MAX_USNS);
		var actions = usn_arr.map(function (usn) {
						  return vtu_result_multi(usn,reload_cache);
						});
		Do.parallel(actions) (function(results){
				//console.log(results);
				res.send(results);
			})
    
    }    
});

app.listen(process.argv[2]||80)

function vtu_result_multi(usn,reload_cache) {
	return function (callback,errback) {
		vtu_result(usn,reload_cache,callback);
	}
		

}

function vtu_result(usn, reload_cache, callback) {
	redis.get("results:"+usn.toUpperCase(),function(err,json){
		if(err || !json || reload_cache) {
		 //not there or force reload, fetch new
			request_params = {
			   'uri': 'http://results.vtu.ac.in/vitavi.php',
			   'headers': {
			   		   "Content-Type": "application/x-www-form-urlencoded",
				       'User-Agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)'
				   },
			   "method" : "post",
			  "body":"rid="+usn+"&submit=SUBMIT"
				}
			var json = {}
			json.usn = usn.toUpperCase() 
			request(request_params
			 , function (error, response, body) {
			  if(response.statusCode == 200) {
				body = body.replace(/[<]script .*[>][\s\S]*[<][/]script[>]/gi,"") // VTU page has js error!, remove all script tags to init jsdom properly
			  	var window = jsdom.jsdom(body).createWindow();
			  	//console.log("created dom window");
			  	jsdom.jQueryify(window, __dirname+'/jquery.js', function (window, $) {
			  	  //console.log("jqueryfied!")
				  var $t = $('table[bgcolor="#ffffff"] tr td[width="513"]').eq(0) // thats the result table!
				  json.name = $t.find("b").eq(0).text().replace(/[(].*[)]/,"").trim().toProperCase()
				  if(json.name==""||!json.name) {
				  	  delete json.name
					  json.error = "not yet declared for this usn or its not a valid usn itself.";
				  	  callback(json)
				  	  return
				  	}
				  json.results = []
				  var result_tables =  $t.find("table");
				  for( var i=0;i<result_tables.length;i=i+3 )
				  {
				  	var result_obj = {}
				  	result_obj.semester = parseInt(result_tables.eq(i).find("b").eq(1).text())
				  	result_obj.status = result_tables.eq(i).find("b").eq(2).text().split(":",2)[1].toLowerCase().trim()
				  	result_obj.subjects = []
				  	result_tables.eq(i+1).find("tr").each(function(index){
				  		if(index==0)
				  			return; //first row is coloumn names!
				  		var subject_obj = {}
				  		var $cells = $(this).find("td");
				  		var subject_text = $cells.eq(0).text();
				  		subject_obj.name = subject_text.replace(/[(].*[)]/,"").trim();
				  		subject_obj.code = subject_text.match(/[(](.*)[)]/)[1];
				  		subject_obj.marks = {}
				  		subject_obj.marks.external = parseInt($cells.eq(1).text())
				  		subject_obj.marks.internal = parseInt($cells.eq(2).text())
				  		subject_obj.marks.total = parseInt($cells.eq(3).text())
				  		subject_obj.is_passed = $cells.eq(4).text() == "P" ? true:false;
				  		result_obj.subjects.push(subject_obj);
				  	})
				  	result_obj.total = parseInt(result_tables.eq(i+2).find("td").eq(3).text().trim())
				  	json.results.push(result_obj);
				  }
				  //console.log(json)
				  callback(json);
				  redis.setex("results:"+json.usn, 3*30*86400, JSON.stringify(json)) // cache results for 3 months
				  delete window; // to prevent out of memory!
				  delete $;
				});
				
			  } else {
				json.error = 'VTU server status code '+ response.statusCode;
				console.log('VTU error: '+ response.statusCode);
				//console.log(body);
				callback(json);
			  }
			})
		 } else {
		 //its there in  redis cache
		 	callback(JSON.parse(json))
		 	//console.log("redis cache hit for "+usn);
		 }
		 
	
	
	})

	

}



function increment_usn(usn) {
	var match = /([\d]{3})/.exec(usn)
	if(!match)
		return
	var next = (parseInt(match[1],10)+ 1).toString()
	return usn.slice(0,usn.length-next.length)+next;
}

String.prototype.toProperCase = function() {
  return this.toLowerCase().replace(/^(.)|\s(.)/g, 
      function($1) { return $1.toUpperCase(); });
};

String.prototype.trim = function() {
	return this.replace(/^\s+|\s+$/g, "");
};



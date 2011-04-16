var app = require('express').createServer(),
//var scraper = require('scraper');
 request = require("request"),
 jsdom = require('jsdom'),
 os = require("os"),
 Do = require("./do"),
 redis_pkg = require("redis");
/*jsdom.defaultDocumentFeatures = {
   FetchExternalResources   : false, 
   ProcessExternalResources : false,
   MutationEvents           : false,
   QuerySelector            : false
 }*/

var redis = redis_pkg.createClient();

app.get('/', function(req, res){
    res.send('Hello from vtu api');
});

app.get('/results.json', function(req, res){
	
	if(!req.query.usn){
		res.send("usn parameter missing",400);
	}
	var usn_arr = []
	if(req.query.usn.indexOf(":")>0) {
	    var starting_usn = req.query.usn.split(":",2)[0]
		var total_required = parseInt(req.query.usn.split(":",2)[1])
		total_required = total_required>50 ?  50 : total_required
		 
		for(var i=0;i<total_required;i++) 
		{
			usn_arr.push(starting_usn)
			starting_usn = increment_usn(starting_usn)
		}		
	} else
		usn_arr = req.query.usn.split(",")
	console.log("request for usn:"+ usn_arr);
    res.contentType('json');
    if(usn_arr.length == 1) {
		vtu_result(usn_arr[0],function(json){
		if(req.query.__debug)
		{
			json.loadavg = os.loadavg()
			json.freemem = os.freemem()/1024*1024
		}
			res.send(json);
		})
    } else {
    usn_arr = usn_arr.slice(0,50);
    var actions = usn_arr.map(function (usn) {
					  return vtu_result_multi(usn);
					});
	Do.parallel(actions)(function(results){
			//console.log(results);
			res.send(results);
		})
    
    }
   

   
    
	/*scraper(request_params, function(err, $) {
			 	if (err) {
			 		sys.log(err)	
			 	} else {
					 var result_html = $('html').html()
					 res.send(result_html);
			 	}
			}
	);*/

    
});

app.listen(process.argv[2]||80)

function vtu_result_multi(usn) {
	return function (callback,errback) {
		vtu_result(usn,callback);
	}
		

}

function vtu_result(usn,callback) {
	redis.get("results:"+usn.toUpperCase(),function(err,json){
		if(err || !json) {
		 //not there fetch new
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
				body = body.replace(/[<]script .*[>][\s\S]*[<][/]script[>]/gi,"")
				//res.send(body)
			  	var window = jsdom.jsdom(body).createWindow();
			  	console.log("created dom window");
			  	jsdom.jQueryify(window, __dirname+'/jquery.js', function (window, $) {
			  	  console.log("jqueryfied!")
				  var $t = $('table[bgcolor="#ffffff"] tr td[width="513"]').eq(0)
				  json.name = $t.find("b").eq(0).text().replace(/[(].*[)]/,"").trim().toProperCase()
				  if(json.name==""||!json.name) {
				  	  delete json.name
					  json.error = "not yet declared for this usn";
				  	  callback(json)
				  	  return
				  	}
				  json.results = []
				  var result_tables =  $t.find("table");
				  for( var i=0;i<result_tables.length;i=i+3 )
				  {
				  	var result_obj = {}
				  	result_obj.semester = parseInt(result_tables.eq(i).find("b").eq(1).text())
				  	//console.log(i);
				  	result_obj.status = result_tables.eq(i).find("b").eq(2).text().split(":",2)[1].toLowerCase().trim()
				  	result_obj.subjects = []
				  	result_tables.eq(i+1).find("tr").each(function(index){
				  		if(index==0)
				  			return;
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
				  redis.setex("results:"+json.usn,864000,JSON.stringify(json))
				});
				
			  } else {
				json.error = 'VTU server status code '+ response.statusCode;
				//console.log('error: '+ response.statusCode);
				//console.log(body);
				callback(json);
				
			  }
			})
		 } else {
		 //its there in  redis cache
		 	callback(JSON.parse(json))
		 	console.log("redis cache hit for "+usn);
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

String.prototype.trim = function(){
	return this.replace(/^\s+|\s+$/g, "");
};

var utils = {}


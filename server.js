var app = require('express').createServer();
//var scraper = require('scraper');
var request = require("request");
var jsdom = require('jsdom');
/*jsdom.defaultDocumentFeatures = {
   FetchExternalResources   : false, 
   ProcessExternalResources : false,
   MutationEvents           : false,
   QuerySelector            : false
 }*/


app.get('/', function(req, res){
    res.send('Hello from vtu api');
});

app.get('/result/:usn', function(req, res){
	var usn = req.params.usn
	console.log("request for usn:"+usn);
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
   request(request_params
     ,function (error, response, body) {
      if(response.statusCode == 200){
        body = body.replace(/[<]script .*[>][\s\S]*[<][/]script[>]/gi,"")
        //res.send(body)
      	var window = jsdom.jsdom(body).createWindow();
      	console.log("created dom window");
      	jsdom.jQueryify(window, __dirname+'/jquery.js', function (window, $) {
      	  console.log("jqueryfied!")
		  var $t = $('table[bgcolor="#ffffff"] tr td[width=513]').eq(0)
		  json.name = $t.find("b").eq(0).text().replace(/[(].*[)]/,"").trim().toProperCase()
		  json.results = []
		  var result_tables =  $t.find("table");
		  for( var i=0;i<result_tables.length;i=i+3 )
		  {
		  	var result_obj = {}
		  	result_obj.semester = parseInt(result_tables.eq(i).find("b").eq(1).text())
		  	console.log(i);
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
		  res.send(json);
		});
        
      } else {
        console.log('error: '+ response.statusCode);
        console.log(body);
      }
    }
  )
    
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

app.listen(80)

String.prototype.toProperCase = function() {
  return this.toLowerCase().replace(/^(.)|\s(.)/g, 
      function($1) { return $1.toUpperCase(); });
};

String.prototype.trim = function(){
	return this.replace(/^\s+|\s+$/g, "");
};

var utils = {}


var sys = require("sys")
  , ws = require("websocket-server")
  , redis_pkg = require("redis")
  , net = require('net');
//redis_pkg.debug_mode = true;
var redis = redis_pkg.createClient();
var ws_server = ws.createServer({debug: true});
var app = {}
// Handle WebSocket Requests
ws_server.addListener("connection", function(conn){
  sys.log("New connection: "+conn.id);

  conn.addListener("message", function(message) {
    sys.log("message:"+conn.id+">"+message);
    message = JSON.parse(message);
    app.onMessage(message,function(response){
    	conn.send(JSON.stringify(response));
    },function(error){
    	conn.emit(error)
    },function(){
    	var connObj={}
    	connObj.origObj = conn;
    	connObj.id = conn.id;
    	connObj.type = "ws"
    	return connObj;
    })
    
    
  });
 
  
  
});

ws_server.addListener("error", function(){
  sys.log(Array.prototype.join.call(arguments, ", "));
});

app.onMessage = function (message,response,error,get_connection) {
	var conn = get_connection();
	console.log(conn.id);
	sys.log("here");
	switch(message.type) {
    	case "AUTH":  	
    	                redis.get("auth:"+message.auth,function (err, reply) {
    							if(err) {
    								error("error","redis GET error: "+error);
    							} else {
    								var uid = reply;
    								redis.get("user:"+uid+":auth",function(err,reply){
					    					if ( reply != message.auth ) {
						    				 error("bad auth cookie:"+uid+" recvd:"+message.auth);
						    				 return;
						    				}
						    				else {
						    					
						    				 	redis.set(conn.type+"_user:"+conn.id,uid);
								    			redis.set(conn.type+"_event:"+conn.id,message.event_id);
								    			redis.get("user:"+uid+":"+message.event_id+":last_recieved",function(err,reply){
								    				if(err)
								    				{ 
								    					redis.set("user:"+uid+":"+":"+message.event_id+":last_recieved",0);
								    					reply = 0
								    					sys.log("setting to 0");
								    				}
								    				//sys.log("user:"+uid+":"+":"+message.event_id+":last_recieved -"+reply);
								    				redis.set(conn.type+"_timestamp:"+conn.id,reply)
								    				redis.sadd("event:"+message.event_id+":connected",uid)
									    			redis.sadd("user:"+uid+":"+message.event_id+":locations",conn.type+"|"+conn.id+"|"+reply);
									    			response({"type":"NOTIFY","message":"hand shake done"});
								    			})
								    			
						    				}
				    					})
				    				
    							       }
    						});
    						
        break;
    	case "ADD_POST":
    			redis.mget(conn.type+"_user:"+conn.id,conn.type+"_event:"+conn.id,function(err,replies){
  			var uid = replies[0];
		  	var event_id = replies[1];
		  	if(!uid || !event_id) {
		  		error("error","invalid uid,event_id")
		  		return; }
		  	var text = message.text;
		  	var timestamp = new Date().getTime();
		  	redis.incr("global:nextPostId",function(err,reply){
		  		var post_id = reply;
		  		post_json={}
		  		post_json.text=text
		  		post_json.time_posted=timestamp
		  		post_json.post_id = post_id
		  		post_json.user = uid
		  		redis.set("post:"+post_id+":text",text);
		  		redis.set("post:"+post_id+":data",JSON.stringify(post_json));
		  		redis.set("post:"+post_id+":time_posted",timestamp);
		  		redis.set("post:"+post_id+":user",uid);
		  		redis.zadd("event:"+event_id+":posts",timestamp,post_id);
		  		response({"type":"ADD_POST_SUCCESS","message":"post added, id:"+post_id});
		  		app.handleNewPost(event_id);
		  	
		  	})
  	});	
    	break;
    	case "ERROR": error("error", "test");
    	break;
    	default: error("not a valid message type")
    
    
    }

}

app.handleNewPost = function(event_id) {
	sys.log("event for:"+event_id);
	var now = new Date().getTime(); //TODO: more thought on this
	
	redis.smembers("event:"+event_id+":connected",function(err,replies){
		replies.forEach(function(uid,index){
			redis.smembers("user:"+uid+":"+event_id+":locations", function(err,replies) {
			  replies.forEach(function(location_string,index){
			  	var location = location_string.split("|");
			  	var location_type = location[0];
			  	var location_id = location[1];
				var location_timestamp = location[2]? location[2] : 0
				//sys.log("updating to:"+now);
				redis.set(location_type+"_timestamp:"+location_id,now)
				location[2] = now;
				redis.multi()
				     .srem("user:"+uid+":"+event_id+":locations",location_string)
				     .sadd("user:"+uid+":"+event_id+":locations",location.join("|"))
				     .exec()//TODO: this is not good way!
				redis.zrangebyscore("event:"+event_id+":posts","("+location_timestamp,now,function(err,replies){
					if(!replies)
						return;
					for ( var i in replies)
					{
						replies [i] = "post:"+replies[i]+":data"
					}
				redis.mget(replies,function(err,posts){
					  params = {}
				  	  params.type = "NEW_POSTS";
				  	  //sys.log(posts)
				  	  params.posts = []
				  	  for ( var i in posts)
				  	  {
				  	    params.posts.push( JSON.parse(posts[i]) );
				  	  }
					  if(location_type == "ws")
				  	  {
					   ws_server.send(location_id,JSON.stringify(params));
				  	  }
				  	  else if(location_type =="tcp") {
					  	  app.tcp_server_send(location_id,JSON.stringify(params));			  	  
				  	  }
				
				})	
				})
			  	
			  		
			  	
			  })
				
			
			})
		
		})
		
	
	})
	
}

app.endConnection= function (get_connection) {
	var conn= get_connection();
	redis.mget(conn.type+"_user:"+conn.id,conn.type+"_event:"+conn.id,conn.type+"_timestamp:"+conn.id,function(err,replies){
  	var uid = replies[0];
  	var event_id = replies[1];
  	redis.srem("user:"+uid+":"+event_id+":locations",conn.type+"|"+conn.id+"|"+replies[2]);
  	//TODO:convert to hash table
        redis.scard("user:"+uid+":"+event_id+":locations",function(err,reply){
 		if(reply==0)
 			{
 				redis.srem("user:"+event_id+":connected",uid)
 			} 	
 	}) 
  		
  
  });
	
}

ws_server.addListener("disconnect", function(conn){
  //return;
  sys.log(conn.id+" disconnected");
  app.endConnection(function(){
  	var connObj={}
    	connObj.origObj = conn;
    	connObj.id = conn.id;
    	connObj.type = "ws"
    	return connObj;
  })
  
}); 
ws_server.listen(8000);


//TCP SEVER CODE
app.tcp_live_streams = {}
var tcp_server = net.createServer(function (stream) {
  stream.id = stream.remoteAddress + ":" + stream.remotePort
  stream.setEncoding('utf8');
  stream.on('connect', function () {
  	sys.log("connected");
    app.tcp_live_streams[stream.id] = stream;
    var params = {}
    params.type = "GREET"
    params.data = "hello!";
    stream.write(JSON.stringify(params));
  });
  stream.on('data', function (request) {
    sys.log(request);
    var response = {"type":"RESPONSE"}
    try {
    	message = JSON.parse(request)
    	app.onMessage(message,function(response){
    	        console.log(response);
    		stream.write(JSON.stringify(response));
	    }, function(error){
	    	//conn.emit(error)
	    	sys.log(error)
	    }, function() {
	    	var connObj={}
	    	connObj.origObj = stream;
	    	connObj.id = stream.id;
	    	connObj.type = "tcp"
	    	return connObj;
	    })
    }
    catch (e) 
    {
    	response.data = "you provided invalid JSON";
    	sys.log("json parsing exception");    
    }
    //stream.write(JSON.stringify(response));
  });
  stream.on('end', function () {
    sys.log("ended");
    app.endConnection(function(){
	  	var connObj={}
	    	connObj.origObj = stream;
	    	connObj.id = stream.id;
	    	connObj.type = "tcp"
	    	return connObj;
  	})
    delete app.tcp_live_streams[stream.id];
    sys.log(stream);
    stream.write('goodbye\r\n');
    stream.end();
  });
  stream.on("error",function(exception){
  	sys.log(exception);
  })
});

app.tcp_server_send = function (location,data) {
	
	var stream = app.tcp_live_streams[location]
	if(stream && stream.writable) {
		stream.write(data);//TODO:clear buffer before sending ??
		console.log("TCP: sending post to location:"+location);
		console.log(data);
	}
	else {
		console.log("Stream not writeable!");
	}

}
tcp_server.listen(8123);

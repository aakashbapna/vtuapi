var app = require('express').createServer();

app.get('/', function(req, res){
    res.send('Hello from vtu api');
});

app.listen(80)

var net = require("net"),
    domains = ["localhost:8000","192.168.1.3:8000","home.aakash.org:8000"];

net.createServer(
    function(socket)
    {
        socket.write("<?xml version=\"1.0\"?>\n");
        socket.write("<!DOCTYPE cross-domain-policy SYSTEM \"http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd\">\n");
        socket.write("<cross-domain-policy>\n");

        domains.forEach(
            function(domain)
            {
                var parts = domain.split(':');
                socket.write("<allow-access-from domain=\""+parts[0]+"\"to-ports=\""+(parts[1]||'80')+"\"/>\n");
            }
        );

        socket.write("</cross-domain-policy>\n");
        socket.end();   
    }
).listen(843);

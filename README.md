##Running the code
Install latest [Redis](http://redis.io) server and start it.

Install node dependencies via npm
	
	npm install express redis request jsdom

Run the code!
	
	node server.js 8080

> now go to http://localhost:8080

##How to use the vtu api:


###Very straight forward -
Make a HTTP GET request to url: http://vtuapi.aakash.org/results.json?usn=1pe07is000

> It will return with complete vtu result for the supplied USN in JSON encoded format.
	

###Multiple fetch in single api call -
* Give up to 50 USNs seperated by comma to fetch in parallel!

  > eg- http://vtuapi.aakash.org/results.json?usn=1pe07is000,1pe07cs000,1pe07ec000
		
* For you all lazy people- automatically increment USN and fetch results, use as:

  > eg- http://vtuapi.aakash.org/results.json?usn=1pe07is000:50

  >	fetches results of 50 USNs from 1pe07is000 uptill 1pe07is050 !!

###Bypass cache and fetch fresh result from VTU server -
* Add a reload=true parameter to the query string.

  > eg- http://vtuapi.aakash.org/results.json?usn=1pe07is000&reload=true
		
###Rate Limiting -
* You can make at the most 200 calls per hour to the API.
* Beyond that it will ask you to wait before making more requests.
* You can get api calls remaining and seconds to reset information in HTTP response headers.

		
###Notes -
* Shows complete vtu result including backlogs.
* Very fast, developed with nodejs, uses redis for server side caching of results.


####List of cool mashups using vtu api:	
-- to be updated soon, send mail to me[at]aakash.me for a link here --



##DISCLAIMLER - 
* This service uses data that is already public, we just apply transformations to it and make it available in a better way. 
* I am not responsible for wrong results reported.
* The service may break anytime. (yes.sadly.)
	


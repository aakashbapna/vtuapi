How to use the vtu api:


Very straight forward -
	Make a HTTP GET request to url: http://vtuapi.aakash.org/results.json?usn=1pe07is000
	It will return with complete vtu result for the supplied USN in JSON encoded format.
	

Multiple fetch in single api call -
	* Give up to 100 USNs seperated by comma to fetch in parallel!
		eg- http://vtuapi.aakash.org/results.json?usn=1pe07is000,1pe07cs000,1pe07ec000
		
	* For you all lazy people- automatically increment USN and fetch results, use as:
		eg- http://vtuapi.aakash.org/results.json?usn=1pe07is000:100
			fetches results of ALL USN from 1pe07is000 to 1pe07is100 !!

Notes -
	* Shows complete vtu result including backlogs.
	* Very fast, developed with nodejs, uses redis for server side caching of results.
	* Usage help & bug reports, all to me[at]aakash.me

List of cool mashups using vtu api:
	-- to be updated soon, send mail to me[at]aakash.me for a link here --





DISCLAIMLER - 
	* I am not responsible for wrong results reported.
	* Don't abuse the api.
	* The service may break anytime. (yes.sadly.)
	

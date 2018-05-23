// Google Analytics
/**
 * @function ga
 */
(function(i,s,o,g,r,a,m){i["GoogleAnalyticsObject"]=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,"script","https://www.google-analytics.com/analytics.js","ga")

ga("create", "UA-52331300-8", "auto")
ga("require", "displayfeatures")
ga("set", "checkProtocolTask", null)

/**
 * @param eventCategory
 * @param eventAction
 * @param eventLabel
 * @param beacon
 * @param nonInteraction
 */
function gaEvent(eventCategory, eventAction, eventLabel, beacon, nonInteraction) {
	const fieldsObject = {
		eventCategory,
		eventAction,
		eventLabel,
	}
	if (beacon) {
		fieldsObject.transport = "beacon"
	}
	if (nonInteraction) {
		fieldsObject.nonInteraction = true
	}

	ga("send", "event", fieldsObject)
}

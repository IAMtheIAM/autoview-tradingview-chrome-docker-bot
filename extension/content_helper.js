"use strict";
function callback_init() {
	if (typeof TradingView.alertsDispatcher === "undefined" || typeof TradingView.alertsDispatcher.alerts === "undefined") {
		return setTimeout(callback_init, 500);
	}

	TradingView.alertsDispatcher.alerts.on("fired", callback_push)
}

function callback_push(alertEvent) {
	/**
	 * @type {{alertId, symbol, resolution, description, playSound, soundFile, soundDuration, showPopup, fireTime, barTime, crossInterval}}
	 */
	let attributes = alertEvent.attributes
	let message = {};

	message.method = "event";

	message.request = {
		channel: "alert",
		id: +alertEvent._listenId || 0
	};

	message.response = {};
	message.response.m = "success";
	message.response.p = {
		// old <= new alert structure
		id: alertEvent.id,
		aid: attributes.alertId,
		sym: attributes.symbol,
		res: attributes.resolution,
		desc: attributes.description,
		snd: attributes.playSound,
		snd_file: attributes.soundFile,
		snd_duration: attributes.soundDuration,
		popup: attributes.showPopup,
		fire_time: Math.floor(attributes.fireTime.getTime() / 1000),
		bar_time: Math.floor(attributes.barTime.getTime() / 1000),
		cross_int: attributes.crossInterval
	}

	return relay(message);
}

function callback_xhr(data) {
	if ((this.responseType || "text") !== "text") {
		return true; // responseText unavailable
	}

	let message = {};
	const reg = /^https:\/\/.+\.tradingview\.com\/alerts\/$/i;
	const res = reg.exec(this.responseURL);
	if (!res || res.length <= 0) {
		return false;
	}

	const request = safeJSON(data) || parseQuery(data) || {};
	const response = safeJSON(this.responseText) || this.responseText || {};

	message.method = request.m;

	message.request = request.p;

	message.response = {};
	message.response.m = response.m || "error";
	message.response.p = response.p || {};

	return relay(message);
}

function document_init() {
	relay({
		method: "storage",
		response: {
			name: "private_channel",
			value: window.user.private_channel
		}
	});
}

function init() {
	console.log("Content Helper initialized.");

	Autoview.init();
	callback_init();
	document_init();
}

function relay(msg) {
	window.postMessage(msg, location.origin);
}


let av_xhr = XMLHttpRequest.prototype;
const av_xhr_send = av_xhr.send;
av_xhr.send = function(data) {
	this.addEventListener("load", callback_xhr.bind(this, data));

	return av_xhr_send.apply(this, arguments);
};

document.addEventListener("DOMContentLoaded", init);

"use strict"

document.addEventListener("DOMContentLoaded", run.bind(window, init))

ga("send", "pageview", "/popup.html")


function action_tab_select(e, tabs, index) {
	if (tabs.hasOwnProperty(index)) {
		e.preventDefault();

		chrome.tabs.update(tabs[index].id, { selected: true });
	}
	else {
		throw new ReferenceError("Tab was not found: " + index);
	}
}

function* exchange_link(states) {
	const alias = this.getExchangeAlias(0)
	const hasCredentials = yield* this.exchangeHasCredentials()
	const hasPermission = yield* this.exchangeHasPermission()
	const hasSubscription = yield* this.exchangeHasSubscription()

	let link = new Template("#exchange-link");
	link.data = {
		"exchange.alias": alias,
		"exchange.id": alias.toLowerCase(),
		"exchange.name": this.getExchangeName(),
		"exchange.url": this.getExchangeWebsite()
	};
	link.clone();
	let parent = document.getElementById("exchange-" + alias.toLowerCase());
	let element = parent.querySelector(".badge");

	states.total++;

	if (hasPermission && hasSubscription) {
		if (hasCredentials) {
			states.success++;

			element.innerHTML = "Connected"
			parent.classList.add("list-group-item-success");
		}
		else {
			states.warning++;

			element.innerHTML = "Guest";
			parent.classList.add("list-group-item-warning");
		}
	} else {
		states.danger++;

		if (hasPermission) {
			element.innerHTML = "Inactive";
		} else {
			element.innerHTML = "Blocked";
		}
		parent.classList.add("list-group-item-danger");
	}
}

function faq() {
	window.open("https://use.autoview.with.pink/hc/en-us/categories/115000439348-Frequently-Asked-Questions");
}

function* init() {
	const account = yield identity_user_info
	const bgWindow = yield background
	const exchanges = Broker().getExchanges()
	let states = {
		danger: 0,
		success: 0,
		total: 0,
		warning: 0
	}
	let element

	element = document.getElementById("chrome-account")
	if (account.email && account.id) {
		element.classList.add("panel-success")
		element.querySelector(".badge").innerHTML = "Enabled"
	} else {
		element.classList.add("panel-danger")
		element.querySelector(".badge").innerHTML = "Disconnected"
	}

	// Panel: List of exchanges and their status
	for (let i = 0; i < exchanges.length; i++) {
		yield* exchange_link.call(exchanges[i], states)
	}

	// Panel state
	let parent = document.getElementById("exchanges");
	if (states.success > 0) {
		parent.classList.add("panel-success");
	}
	else if (states.warning > 0) {
		parent.classList.add("panel-warning");
	}
	else if (states.danger > 0) {
		parent.classList.add("panel-danger");
	}

	element = parent.querySelector(".panel-heading .badge");
	element.innerHTML = states.success + " / " + states.total;

	// Outgoing
	document.addEventListener("click", click)
	// Options page button
	document.getElementById("settings").addEventListener("click", settings);
	// Wiki button
	document.getElementById("faq").addEventListener("click", faq);

	// Panel: TradingView
	yield* tradingview.call(bgWindow);
}

function click(event) {
	let element = event.target

	switch (element.nodeName) {
		case "A":
			if (element.hasOwnProperty("id")) {
				if (element.id === "settings") {
					gaEvent("navigation", "internal", element.href)
					return settings(event)
				}
			}

			// [target="_blank"]
			if (element.hasAttribute("target") && element.getAttribute("target") === "_blank") {
				gaEvent("navigation", "external", element.href, true)
			}
			break;
	}
}

function settings() {
	if (chrome.runtime.openOptionsPage) {
		chrome.runtime.openOptionsPage();
	} else {
		window.open(chrome.runtime.getURL("options.html"));
	}
}

function* tradingview() {
	let tabs = yield* this.TRADINGVIEW.getTradingViewTabs()
	let parent = document.getElementById("tradingview");
	let element = parent.querySelector(".badge");

	if (tabs.length > 0) {
		parent.classList.add("panel-success");
		element.innerHTML = "Enabled";

		element = parent.querySelector(".panel-heading a");
		element.addEventListener("click", action_tab_select.bind(this, tabs, 0));
	}
	else if (this.TRADINGVIEW.getTradingViewListenerStatus() !== this.TRADINGVIEW_LISTENER_UNSENT) {
		parent.classList.add("panel-info");
		element.innerHTML = "Background";
	}
	else {
		parent.classList.add("panel-danger");
		element.innerHTML = "Disconnected";
	}
}

var chatters = {};
const params = new URLSearchParams(location.search);
var alignBottom = params.get("bottom") || false;
var ignoreCommands = params.get("ignoreCommands") || false;
var ignoreUsers = (params.get("ignoreUsers") || "").split(",").map(x => x.trim().toLowerCase()).filter(x => !!x);
var messageCountLimit = 100;
if (alignBottom) {
	document.querySelector("#chat-container").style.bottom = "0px";
}

document.querySelector("#bottom-scroll").style.visibility = "hidden";
window.onscroll = function(ev) {
	var chatContainer = document.querySelector("body");
	var isScrolledToBottom = (chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.offsetHeight < 2);
	document.querySelector("#bottom-scroll").style.visibility = isScrolledToBottom ? "hidden" : "visible";
};

document.querySelector("#bottom-scroll").addEventListener("click", function(ev) {
	window.scrollTo(0, document.body.scrollHeight);
});

var badgeSets = {};

function loadBadgeSet(id) {
	fetch("https://badges.twitch.tv/v1/badges/global/display?language=en")
		.then(r => r.json())
		.then(function(data) {
			if (data) {
				badgeSets = Object.assign(badgeSets, data.badge_sets || {});
				fetch("https://badges.twitch.tv/v1/badges/channels/" + id + "/display?language=en")
					.then(r => r.json())
					.then(function(data) {
						if (data) {
							// Merge the sets together
							Object.keys(data.badge_sets || {}).forEach(k => {
								if (badgeSets[k].versions) {
									badgeSets[k].versions = Object.assign(badgeSets[k].versions, data.badge_sets[k].versions);
								} else {
									badgeSets[k] = data.badge_sets[k];
								}
							});
						}
					});
			}
		});
}

function htmlEntities(html) {
	function it() {
		return html.map(function(n, i, arr) {
			if (n.length == 1) {
				return n.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
					return '&#' + i.charCodeAt(0) + ';';
				});
			}
			return n;
		});
	}
	var isArray = Array.isArray(html);
	if (!isArray) {
		html = html.split('');
	}
	html = it(html);
	if (!isArray) {
		html = html.join('');
	}
	return html;
}

function formatEmotes(text, emotes) {
	var splitText = text.split('');
	for (var i in emotes) {
		var e = emotes[i];
		for (var j in e) {
			var mote = e[j];
			if (typeof mote == 'string') {
				mote = mote.split('-');
				mote = [parseInt(mote[0]), parseInt(mote[1])];
				var length = mote[1] - mote[0];
				var empty = Array.apply(null, new Array(length + 1)).map(function() {
					return ''
				});
				splitText = splitText.slice(0, mote[0]).concat(empty).concat(splitText.slice(mote[1] + 1, splitText.length));
				splitText.splice(mote[0], 1, '<img width="28px" height="28px" class="chat-message-emote" src="http://static-cdn.jtvnw.net/emoticons/v1/' + i + '/1.0" srcset="https://static-cdn.jtvnw.net/emoticons/v1/' + i + '/1.0 1x,https://static-cdn.jtvnw.net/emoticons/v1/' + i + '/2.0 2x,https://static-cdn.jtvnw.net/emoticons/v1/' + i + '/3.0 4x">');
			}
		}
	}
	return htmlEntities(splitText).join('')
}

function createBadgeFromRole(name, version) {
	try {
		var badge = document.createElement("img");
		badge.className = "chat-badge";
		if (badgeSets[name]) {
			var badgeImage = badgeSets[name].versions[version];
			badge.setAttribute("src", badgeImage.image_url_1x);
			badge.setAttribute("srcset", `${badgeImage.image_url_1x} 1x, ${badgeImage.image_url_2x} 2x, ${badgeImage.image_url_4x} 4x`);
			badge.setAttribute("alt", badgeImage.title);
		}
		return badge;
	} catch (ex) {
		console.log("Error parsing badge role", name, version);
		return document.createElement("img");
	}
}

function cleanOldMessages() {
	var chatContainer = document.querySelector("#chat-container");
	while (chatContainer.children.length > messageCountLimit) {
		chatContainer.removeChild(chatContainer.firstChild);
	}
}

function appendThisMessage(user, message, extra) {
	var isNewChatter = !chatters[user];
	chatters[user] = (chatters[user] || 0) + 1;

	if (ignoreUsers.includes(extra.username)) {
		return;
	}

	var chatElement = document.createElement("div");
	chatElement.id = "msg_" + (extra.id || "unknown");
	chatElement.className += "parent-container";
	var messageElement = document.createElement("div");
	messageElement.className += "translucent-bg";
	if (new RegExp("\\b@?" + params.get("channel") + "\\b", "i").test(message)) {
		messageElement.className += " highlight-bg";
	} else if (isNewChatter) {
		messageElement.className += " notice-bg";
	}
	chatElement.appendChild(messageElement);

	var badges = document.createElement("span");
	badges.className = "chat-badges";
	// Add badges based on type
	if (extra["userBadges"]) {
		Object.keys(extra["userBadges"]).forEach(x => {
			badges.appendChild(createBadgeFromRole(x, extra["userBadges"][x]));
		});
	}
	messageElement.appendChild(badges);

	var userColor = tinycolor(extra.userColor || "#ffffff");
	if (!tinycolor.isReadable(extra.userColor || "#ffffff", "#000", {})) { // userColor.isDark() ) {
		userColor = userColor.lighten(25);
	}
	var userElement = document.createElement("span");
	userElement.innerText = user;
	userElement.style.color = userColor.toHexString();
	userElement.className += "chat-username";
	messageElement.appendChild(userElement);

	var chatText = document.createElement("p");
	chatText.innerHTML = formatEmotes(message, extra.messageEmotes);
	messageElement.appendChild(chatText);

	var chatContainer = document.querySelector("body");
	var isScrolledToBottom = (chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.offsetHeight < 2);
	document.querySelector("#chat-container").appendChild(chatElement);

	document.querySelector("#bottom-scroll").style.visibility = isScrolledToBottom ? "hidden" : "visible";

	// Auto-scroll if we're at the bottom
	if (isScrolledToBottom) {
		// chatElement.scrollIntoView( false );
		window.scrollTo(0, document.body.scrollHeight);
	}
}

ComfyJS.onMessageDeleted = (id, extra) => {
	document.querySelector("#chat-container").removeChild(document.querySelector("#msg_" + id));
};

ComfyJS.onChat = (user, message, flags, self, extra) => {
	appendThisMessage(user, message, extra);
	cleanOldMessages();
};
ComfyJS.onCommand = (user, command, message, flags, extra) => {
	if (!ignoreCommands) {
		appendThisMessage(user, "!" + command + " " + message, extra);
		cleanOldMessages();
	}
};
ComfyJS.onCheer = (user, message, bits, flags, extra) => {
	appendThisMessage(user, message, extra);
	cleanOldMessages();
};
ComfyJS.onSub = (user, message, subTierInfo, extra) => {
	appendThisMessage(user, message, extra);
	cleanOldMessages();
}
ComfyJS.onResub = (user, message, streamMonths, cumulativeMonths, subTierInfo, extra) => {
	appendThisMessage(user, message, extra);
	cleanOldMessages();
}
ComfyJS.Init(params.get("channel"));
fetch("https://api.twitch.tv/helix/users?login=" + params.get("channel"), {
		headers: {
			"Client-ID": "2odsv8xermvalbub7wipebrphqlpqv"
		}
	})
	.then(r => r.json())
	.then(data => {
		loadBadgeSet(data.data[0].id);
	});
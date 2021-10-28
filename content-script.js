function addNewMessage(message) {
    let time = new Date(message.time);
    time = `${time.getHours()}:${time.getMinutes()}`

    switch (message.type) {
        case 'joined':
            return `<li ng-repeat="message in channelHistory.chatHistory" class="chat-history__activity-item angular-animate ng-scope chat-history__activity-item--activity" ng-class="channelHistory.getMessageClasses($index, message)" role="presentation" style="" id="ultra-chat-tools-ignore">
                <div ng-if="channelHistory.getActivityType(message) === 'presence'" bb-chat-activity-message="" message="message" class="ng-scope ng-isolate-scope">
                    <div class="chat-message chat-message--activity" ng-class="{'has-left': chatActivityMessage.left()}" style="border-left: #61D65B 4px solid; background: #DDFFDB;">
                        <p class="chat-message__activity-message">
                            <span class="chat-message__activity-type ng-scope" ng-if="chatActivityMessage.joined()" bb-translate="" analytics-id="session.chat.activity.joined">Joined:</span>
                            <span class="chat-message__activity-name ng-binding">&nbsp;${message.name}</span>
                        </p>
                        <span class="chat-message__time" bb-time="" format="short" epoch="true" aria-hidden="true">${time}</span>
                    </div>
                </div>
            </li>`

        case 'left':
            return `<li ng-repeat="message in channelHistory.chatHistory" class="chat-history__activity-item angular-animate ng-scope chat-history__activity-item--activity" ng-class="channelHistory.getMessageClasses($index, message)" role="presentation" style="" id="ultra-chat-tools-ignore">
                <div ng-if="channelHistory.getActivityType(message) === 'presence'" bb-chat-activity-message="" message="message" class="ng-scope ng-isolate-scope">
                    <div class="chat-message chat-message--activity" ng-class="{'has-left': chatActivityMessage.left()}" style="border-left: #FF7926 4px solid; background: #FFDFB5;">
                    <p class="chat-message__activity-message">
                        <span class="chat-message__activity-type ng-scope" ng-if="chatActivityMessage.leaving() || chatActivityMessage.left()" bb-translate="" analytics-id="session.chat.activity.left">Left:</span>
                        <span class="chat-message__activity-name ng-binding">&nbsp;${message.name}</span>
                    </p>
                    <span class="chat-message__time" bb-time="" format="short" epoch="true" aria-hidden="true">${time}</span>
                </div>
            </div>
            </li>
        `

        case 'message':
            return `
            <li role="presentation" style="" class="history" id="ultra-chat-tools-ignore">
                <div class="ng-scope ng-isolate-scope">
                    <div class="activity-chat chat-message moderator user" style="border-left: #B13DC6 4px solid; background: #F8D7FF;">
                        <div class="activity-message chat-message__content">
                            <h4 class="activity-name chat-message__name ng-scope ng-isolate-scope" aria-hidden="true">
                                <div class="participant-name-container has-tooltip">
                                    <span class="participant-name ng-binding my-user" dir="auto">${message.name}</span>
                                </div>
                            </h4>
                            <div class="activity-channel chat-message__channel ng-binding ng-hide" aria-hidden="true"></div>
                            <p class="activity-time chat-message__time" bb-time="" format="short" epoch="true" aria-hidden="true">${time}</p>
                            <div class="activity-body chat-message__body" aria-hidden="true" style="white-space:normal">
                                <p><span><span>${message.content}</span></span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </li>
        `
        default:
            console.error('Unknown message type: ' + message.type);
    }
}


function HTMLToElement(html) {
    let template = document.createElement('template');
    html = html.trim();
    template.innerHTML = html;
    return template.content.firstChild;
}

const getStorageData = keys =>
    new Promise((resolve, reject) =>
        chrome.storage.sync.get(keys, result =>
            chrome.runtime.lastError
                ? reject(Error(chrome.runtime.lastError.message))
                : resolve(result)
        )
    )

const setStorageData = async (data, keys) => {
    const existingData = await getStorageData(keys);

    keys.forEach(key => {
        if (existingData[key]) {
            data[key] = [...existingData[key], ...data[key]];
        }
    })

    new Promise((resolve, reject) =>
        chrome.storage.sync.set(data, () =>
            chrome.runtime.lastError
                ? reject(Error(chrome.runtime.lastError.message))
                : resolve()
        )
    )
}

function formatMessagePacket(message) {
    return {
        name: message[0],
        time: message[1],
        content: message[2]
    }
}

function squashLines(content) {
    let msgContent = '';

    content.forEach(line => {
        msgContent += line;
    })

    return msgContent;
}

function formatMessages(messages) {
    let formatted = [];
    let previousName = '';
    messages.forEach(message => {
        if (message.className !== 'history' && message.id !== 'saved') {
            message.id = 'saved';
            message = message.innerText.split('\n\n');
            if (message.length == 2) {
                message.unshift(previousName);
            } else if (message.length > 3) {
                message[2] = squashLines(message.slice(2));
            }

            previousName = message[0];
            formatted.push(formatMessagePacket(message));
        }
    })

    return formatted;
}

function downloadChat() {
    const messages = document.querySelectorAll('#chat-channel-history > li');
    const niceMessages = formatMessages(messages);
    const title = document.title.replace(' - Bb Collaborate', '');
    const room = document.querySelector('#panel-chathistory-content > header > h1').innerText;

    let rows = [];
    niceMessages.forEach(c => {
        rows.push(`${c.name},${c.time},${c.content}`);
    })

    let csvContent = 'data:text/csv;charset=utf-8,name,time,message,\n';

    csvContent += rows.join(',\n');

    let encodedUri = encodeURI(csvContent);
    let link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${title}-${room}.csv`);
    document.body.appendChild(link);

    link.click();
}

async function addSaveButton() {
    let container = document.querySelector('#panel-chathistory-content > header');
    let testForButton = document.querySelector('#save-chat-button');
    if (container && !testForButton) {
        let button = document.createElement('button');
        button.innerText = 'Save Chat';
        button.style = 'border-radius: 5px';
        button.onclick = downloadChat;
        button.id = 'save-chat-button';
        button.className = 'makeStylestoolbarControl-0-2-3 makeStylestoolbarControlSubmit-0-2-5';
        container.appendChild(button);
        loadedChatHistory = false;
        observingChatMessages = false;
    }
}

function saveChat() {
    let testForButton = document.querySelector('#save-chat-button');

    if (testForButton) {
        const messages = document.querySelectorAll('#chat-channel-history > li');
        const niceMessages = formatMessages(messages);
        const title = document.title.replace(' - Bb Collaborate', '');
        let room = document.querySelector('#panel-chathistory-content > header > h1').innerText;

        const group = document.querySelector('#chat-history-details > h2');

        if (group) {
            room = `${group.innerText}`;
        }

        let today = new Date();
        const offset = today.getTimezoneOffset();
        today = new Date(today.getTime() - (offset * 60 * 1000));
        today = today.toISOString().split('T')[0];

        const key = `${today}-${title}-${room}`;

        setStorageData({ [key]: niceMessages }, key);
    }
}

async function checkToLoadData() {
    if (!loadedChatHistory) {
        const prevHistory = document.querySelectorAll('#ultra-chat-tools-ignore');
        prevHistory.forEach(node => node.remove());

        let testForButton = document.querySelector('#save-chat-button');
        if (testForButton) {
            const title = document.title.replace(' - Bb Collaborate', '');
            let room = document.querySelector('#panel-chathistory-content > header > h1');

            if (room) {
                const ul = document.querySelector('#chat-channel-history');
                room = room.innerText;
                if (ul) {
                    let today = new Date();
                    const offset = today.getTimezoneOffset();
                    today = new Date(today.getTime() - (offset * 60 * 1000));
                    today = today.toISOString().split('T')[0];

                    const group = document.querySelector('#chat-history-details > h2');

                    if (group) {
                        room = `${group.innerText}`;
                    }
                    const key = `${today}-${title}-${room}`;

                    console.log(`loading from: ${today}-${title}-${room}`);
                    loadedChatHistory = true;
                    // load any previously stored messages
                    const messages = await getStorageData(key);

                    if (messages[key] && messages[key].length) {

                        const start = HTMLToElement('<div style="box-shadow: inset 0px -5px 6px -5px rgba(187, 0, 255, 0.50);;" id="ultra-chat-tools-ignore" class="chat-history__empty ng-scope"><li style="border: #FCEEFF 1px solid; box-shadow: 0px 0px 5px 0px #BFBFBF;"><h3>Begin Chat History</h3></li></div>');
                        const end = HTMLToElement('<div style="box-shadow: inset 0px 5px 6px -5px rgba(187, 0, 255, 0.50);"  id="ultra-chat-tools-ignore" class="chat-history__empty ng-scope"><li style="border: #FCEEFF 1px solid; box-shadow: 0px 0px 5px 0px #BFBFBF;"><h3>End Chat History</h3></li></div>');

                        ul.prepend(end);
                        messages[key].reverse();
                        messages[key].forEach(message => {
                            ul.prepend(HTMLToElement(addNewMessage(message)));
                        });

                        ul.prepend(start);
                    }
                }
            }
        }
    }
}

let loadedChatHistory = false;

// const testForChatInterval = setInterval(() => {
//     checkChatActive();
// }, 1500);

// const saveChatInterval = setInterval(() => {
//     saveChat();
// }, 5000)

// const checkLoadChatInterval = setInterval(() => {
//     checkToLoadData();
// }, 3000);


function checkForChatChannelHeader() {
    return Boolean(document.querySelector('#panel-chatchannelselector-content > header'));
}

function checkIfInChatChannel() {
    return Boolean(document.querySelector('#panel-chathistory-content > header'));
}

const checkObserveChat = setInterval(() => {
    observeChatPanel();
}, 500);

let observingChatPanel = false;
let observingChatMessages = false;

function observeChatPanel() {
    if (observingChatPanel) { return };

    const targetNode = document.querySelector('#main-container > main > div.side-panels.offcanvas-right.angular-animate.ng-scope.ng-isolate-scope.active');

    if (targetNode) {
        const attemptToLoad = () => {
            if (checkIfInChatChannel()) {
                // load in save button
                addSaveButton();
                // try to load chat history
                checkToLoadData();
                // watch for new messages
                observeChatMessages();
            }
        }

        if (checkIfInChatChannel()) {
            attemptToLoad();
        }

        observingChatPanel = true;
        const config = { attributes: false, childList: true, subtree: true };

        const observer = new MutationObserver(attemptToLoad);

        observer.observe(targetNode, config);
    }
}

let messages = {};

const storeMessagesInterval = setInterval(() => {
    storeMessages();
}, 10000);


function storeMessages() {
    console.log('Saving...')
    setStorageData(messages, Object.keys(messages));
    clearMessageRecord();
}

function clearMessageRecord() {
    messages = {};
}


function recordMessage(key, type, name, time, content) {
    messages[key] === undefined ? messages[key] = [{
        type,
        name,
        time,
        content
    }] : messages[key].push({
        type,
        name,
        time,
        content
    })
}


function observeChatMessages() {
    if (!observingChatMessages) {
        observingChatMessages = true;
        const config = { attributes: false, childList: true, subtree: false };
        const targetNode = document.querySelector('#chat-channel-history');

        let prevName = '';

        const callback = (mutationsList, observer) => {

            for (const mutation in mutationsList) {
                if (!mutationsList[mutation].addedNodes.length || mutationsList[mutation].addedNodes[0].id === 'ultra-chat-tools-ignore') { return }

                let type, name, message, time;
                time = Date.now();

                let chatEvent = mutationsList[mutation].addedNodes[0].innerText.split(' ')[0].trim();

                switch (chatEvent) {
                    case 'session.chat.activity.joined':
                        type = 'joined';
                        message = 'Joined';
                        name = mutationsList[mutation].addedNodes[0].innerText;
                        name = name.split('\n\n')[0].replace('session.chat.activity.joined', '').trimStart();
                        break;

                    case 'session.chat.activity.left':
                        type = 'left';
                        message = 'Left';
                        name = mutationsList[mutation].addedNodes[0].innerText;
                        name = name.split('\n\n')[0].replace('session.chat.activity.left', '').trimStart();
                        break;

                    default:
                        type = 'message';
                        if (mutationsList[mutation].addedNodes[0].children[0].children[0].children.length == 2) {
                            if (mutationsList[mutation].addedNodes[0].children[0].children[0].children[1].children.length === 4) {
                                name = mutationsList[mutation].addedNodes[0].children[0].children[0].children[1].children[0].innerText;
                                prevName = name;
                                message = mutationsList[mutation].addedNodes[0].children[0].children[0].children[1].children[3].innerText;
                            }
                        } else {
                            name = prevName;
                            if (mutationsList[mutation].addedNodes[0].children[0].children[0].children[0].children[2] === undefined) { return }
                            message = mutationsList[mutation].addedNodes[0].children[0].children[0].children[0].children[2].innerText;
                        }
                        break;
                }
                
                console.log(type, name, message, time);
                const title = document.title.replace(' - Bb Collaborate', '');
                let room = document.querySelector('#panel-chathistory-content > header > h1').innerText;

                const group = document.querySelector('#chat-history-details > h2');

                if (group) {
                    room = `${group.innerText}`;
                }

                let today = new Date();
                const offset = today.getTimezoneOffset();
                today = new Date(today.getTime() - (offset * 60 * 1000));
                today = today.toISOString().split('T')[0];

                const key = `${today}-${title}-${room}`;

                recordMessage(key, type, name, time, message);
            }
        };

        const observer = new MutationObserver(callback);

        observer.observe(targetNode, config);
    }
}


let currentHeader = '';


const checkForHeaderChangeInterval = setInterval(() => {
    if (!checkIfInChatChannel()) return;
    if (currentHeader === '') currentHeader = document.querySelector('#panel-chathistory-content > header > h1').innerText;
    let header = document.querySelector('#panel-chathistory-content > header > h1').innerText
    if (currentHeader !== header) {
        loadedChatHistory = false;
        checkToLoadData();
        currentHeader = header;
    }
}, 100);

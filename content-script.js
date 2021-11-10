let messages = {};
let messageLog = {};
let savedNodes = {};
let recordingNumber = 1;

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

async function loadInitialMessages() {
    const messages = await getStorageData();

    const title = document.title.replace(' - Bb Collaborate', '');
    let today = new Date();
    const offset = today.getTimezoneOffset();
    today = new Date(today.getTime() - (offset * 60 * 1000));
    today = today.toISOString().split('T')[0];

    Object.keys(messages).forEach(key => {
        // this is slightly inefficient
        // the title is updated after page load so we cant try to match it to a key initially
        if (key.startsWith(`${today}`)) {
            messageLog[key] = messages[key];
        }
    })
}

loadInitialMessages();


function addNewMessage(message) {
    let time = new Date(message.time);
    time = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;

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
            // background: #F8D7FF;
            return `
            <li role="presentation" style="" class="history" id="ultra-chat-tools-ignore">
                <div class="ng-scope ng-isolate-scope">
                    <div class="activity-chat chat-message moderator user" style="border-left: #B13DC6 4px solid; ">
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
    const chatMessages = document.querySelectorAll('#chat-channel-history > li');
    let parsedMessages = [];
    let prevName = '';

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

    if (messageLog[key]) {
        parsedMessages = messageLog[key].map(m => {
            let time = new Date(m.time);
            time = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
            return Object.assign(m, { time });
        });
    }

    console.log(parsedMessages);

    chatMessages.forEach(message => {
        if (message.id !== 'ultra-chat-tools-ignore') {
            let type, name, content, time;
            time = Date.now();
            console.log(message);
            let chatEvent = '';

            switch (chatEvent) {
                case 'session.chat.activity.joined':
                    type = 'joined';
                    content = 'Joined';
                    name = message.innerText;
                    name = name.split('\n\n')[0].replace('session.chat.activity.joined', '').trimStart();
                    break;

                case 'session.chat.activity.left':
                    type = 'left';
                    content = 'Left';
                    name = message.innerText;
                    name = name.split('\n\n')[0].replace('session.chat.activity.left', '').trimStart();
                    break;

                default:
                    type = 'message';

                    //message.children[0].children[0].children[0]
                    // message.children[0].children.length
                    if (message.children[0].children.length !== 3) {
                        name = message.children[0].children[0].children[1].children[0].innerText;
                        time = message.children[0].children[0].children[1].children[2].innerText;
                        prevName = name;
                        content = message.children[0].children[0].children[1].children[3].innerText;
                    } else {
                        name = prevName;
                        time = message.children[0].children[1].innerText;
                        content = message.children[0].children[2].innerText;
                    }
                    break;
            }

            console.log(type, name, content, time);

            parsedMessages.push({ content, name, time, type });
        }
    })

    let rows = [];
    parsedMessages.forEach(c => {
        if (c.type === 'message') {
            rows.push(`[${c.time}] ${c.name}: ${c.content}`);
        } else if (c.type === 'join') {
            rows.push(`${c.name} Joined`);
        } else if (c.type === 'leave') {
            rows.push(`${c.name} Left`);
        }
    })

    let textContent = 'data:text/plain;charset=utf-8,';

    textContent += rows.join('\n');

    let encodedUri = encodeURI(textContent);
    let link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${today}-chat-log-${title}-${room}.txt`);
    document.body.appendChild(link);

    link.click();
}

async function addSaveButton() {
    let container = document.querySelector('#panel-chathistory-content > header');
    let testForButton = document.querySelector('#save-chat-button');
    if (container && !testForButton) {
        const styleElement = document.createElement('style');
        styleElement.innerHTML = `
        #save-chat-button {
            border-radius: 5px;
            color: #262626 !important;
            width: 2rem;
            height: 2rem;
            min-width: 5rem;
            font-weight: bold;
            margin-left: auto !important;
            text-size-adjust: 100%;
            background: transparent;
            transition: background .2s;
        }
        #save-chat-button:hover {
            background: #e5e5e5;
        }
        `;
        document.head.appendChild(styleElement);
        let button = document.createElement('button');
        button.innerText = 'Save Chat';
        button.onclick = downloadChat;
        button.id = 'save-chat-button';
        container.appendChild(button);
        loadedChatHistory = false;
        observingChatMessages = false;
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

                    // console.log(`loading from: ${today}-${title}-${room}`);
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

                        checkToSaveMessages(key);
                    }
                }
            }
        }
    }
}

function checkToSaveMessages(key) {
    const chatMessages = document.querySelectorAll('#chat-channel-history > li');
    let unsaved = [];

    chatMessages.forEach(m => {
        savedNodes[key].forEach(n => {
            if (m === n) {
                unsaved.push(m);
            }
        })
    })
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

const storeMessagesInterval = setInterval(() => {
    storeMessages();
}, 10000);


function storeMessages() {
    setStorageData(messages, Object.keys(messages));
    clearMessageRecord();
}

function clearMessageRecord() {
    for (const message in messages) {
        messageLog[message] = messageLog[message] === undefined ? messages[message] : [...messageLog[message], ...messages[message]]
    }
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
                savedNodes[key] === undefined ? savedNodes[key] = [mutationsList[mutation].addedNodes[0]] : messages[key].push(mutationsList[mutation].addedNodes[0])
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


async function startCapture() {
    let data = [];

    async function startRecording(stream) {
        let recorder = new MediaRecorder(stream, {
            audioBitsPerSecond: 128000,
            videoBitsPerSecond: 3000000,
            mimeType: 'video/webm;codecs=vp9'
        });

        recorder.ondataavailable = event => data.push(event.data);
        recorder.start();

        return recorder;
    }

    const dl = document.querySelector('#start-capture-button');

    const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
    });

    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioContext = new AudioContext();
    const micStream = audioContext.createMediaStreamSource(mic);
    const mergedAudioStream = audioContext.createMediaStreamDestination();
    
    micStream.connect(mergedAudioStream);

    if (screenStream.getAudioTracks().length > 0) {
        const desktopStream = new MediaStream();
        desktopStream.addTrack(screenStream.getAudioTracks()[0]);
        const desktopAudioStream = audioContext.createMediaStreamSource(desktopStream);
        desktopAudioStream.connect(mergedAudioStream);
    }

    const combinedStream = new MediaStream();
    combinedStream.addTrack(screenStream.getVideoTracks()[0]);
    combinedStream.addTrack(mergedAudioStream.stream.getAudioTracks()[0]);

    const recorder = await startRecording(combinedStream);

    const stopStream = () => {
        dl.onclick = startCapture;
        combinedStream.getTracks().forEach(t => {
            t.stop();
        });

        screenStream.getTracks().forEach(t => {
            t.stop();
        });

        if (recorder.state !== 'inactive') {
            recorder.stop();
        }
    }

    const saveRecording = () => {
        let recordedBlob = new Blob(data, { type: 'video/webm; codecs=vp9' });

        let recording = document.createElement('video');
        recording.src = URL.createObjectURL(recordedBlob);

        let link = document.createElement('a');
        link.setAttribute('href', recording.src);

        const title = document.title.replace(' - Bb Collaborate', '');
        let today = new Date();
        const offset = today.getTimezoneOffset();
        today = new Date(today.getTime() - (offset * 60 * 1000));
        today = today.toISOString().split('T')[0];

        const vidName = `${today}-${title}-recording-${recordingNumber}.webm`;
        recordingNumber++;

        link.setAttribute('download', vidName);
        document.body.appendChild(link);

        link.click();
        dl.onclick = startCapture;
        link.remove();
    }

    dl.onclick = stopStream;
    screenStream.oninactive = stopStream;
    recorder.onstop = saveRecording;
}

function addCaptureButton() {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
    #start-capture-button {
        height: 30px;
        width: 30px;
        border-radius: 15px;
        border: 2px solid goldenrod;
        color: #262626 !important;
        background: white;
        transition: background .2s;
        position: absolute;
        top: 95%;
        left: 3%;
        z-index: 10000;
    }
    #start-capture-button:hover {
        background: red;
    }
    `;
    document.head.appendChild(styleElement);
    let button = document.createElement('button');
    button.onclick = startCapture;
    button.id = 'start-capture-button';
    document.body.appendChild(button);
}


function init() {
    addCaptureButton();

}

init();
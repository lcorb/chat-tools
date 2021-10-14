function addNewMessage(message) {
    return `
        <li role="presentation" style="" class="history">
            <div class="ng-scope ng-isolate-scope">
                <div class="activity-chat chat-message moderator user">
                    <div class="activity-message chat-message__content">
                        <h4 class="activity-name chat-message__name ng-scope ng-isolate-scope" aria-hidden="true">
                            <div class="participant-name-container has-tooltip">
                                <span class="participant-name ng-binding my-user" dir="auto">${message.name}</span>
                            </div>
                        </h4>
                        <div class="activity-channel chat-message__channel ng-binding ng-hide" aria-hidden="true"></div>
                        <p class="activity-time chat-message__time" bb-time="" format="short" epoch="true" aria-hidden="true">${message.time}</p>
                        <div class="activity-body chat-message__body" aria-hidden="true" style="white-space:normal">
                            <p><span><span>${message.content}</span></span></p>
                        </div>
                    </div>
                </div>
            </div>
        </li>
    `
}


function HTMLToElement(html) {
    let template = document.createElement('template');
    html = html.trim();
    template.innerHTML = html;
    return template.content.firstChild;
}

const getStorageData = key =>
    new Promise((resolve, reject) =>
        chrome.storage.sync.get(key, result =>
            chrome.runtime.lastError
                ? reject(Error(chrome.runtime.lastError.message))
                : resolve(result)
        )
    )

const setStorageData = data =>
    new Promise((resolve, reject) =>
        chrome.storage.sync.set(data, () =>
            chrome.runtime.lastError
                ? reject(Error(chrome.runtime.lastError.message))
                : resolve()
        )
    )

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
        if (message.className !== 'history') {
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

async function checkChatActive() {
    let container = document.querySelector('#panel-chathistory-content > header');
    let testForButton = document.querySelector('#save-chat-button');
    if (container && !testForButton) {
        let button = document.createElement('button');
        button.innerText = 'Save Chat';
        button.style = 'padding-left: 15px';
        button.onclick = downloadChat;
        button.id = 'save-chat-button';
        container.appendChild(button);
        loadedChatHistory = false;
        checkToLoadData();
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

        setStorageData({ [key]: niceMessages });
    }
}

async function checkToLoadData() {
    if (!loadedChatHistory) {
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
                    const key = `${cd}-${title}-${room}`;
                    
                    console.log(`loading from: ${cd}-${title}-${room}`);
                    // load any previously stored messages
                    const messages = await getStorageData(key);

                    if (messages[key]) {
                        console.log(messages[key]);
                    }
        
                    if (messages[key] && messages[key].length) {

                        const start = HTMLToElement('<div class="chat-history__empty ng-scope"><li><h3>Begin Chat History</h3></li></div>');
                        const end = HTMLToElement('<div class="chat-history__empty ng-scope"><li><h3>End Chat History</h3></li></div>');

                        ul.prepend(end);
                        messages[key].reverse();
                        messages[key].forEach(message => {
                            ul.prepend( HTMLToElement( addNewMessage(message) ) );
                            loadedChatHistory = true;
                        });

                        ul.prepend(start);
                    }
                }
            }
        }
    }
}

let loadedChatHistory = false;

const testForChatInterval = setInterval(() => {
    checkChatActive();
}, 1500);

const saveChatInterval = setInterval(() => {
    saveChat();
}, 5000)

// const checkLoadChatInterval = setInterval(() => {
//     checkToLoadData();
// }, 3000);
// inject into page on click
grabChat.addEventListener('click', async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: fetchUltraChat,
    });
});

function fetchUltraChat() {

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
            message = message.innerText.split('\n\n');
            console.log(message);
            if (message.length == 2) {
                message.unshift(previousName);
            } else if (message.length > 3) {
                message[2] = squashLines( message.slice(2) );
            }

            previousName = message[0];
            formatted.push( formatMessagePacket(message) );
        })

        return formatted;
    }

    const messages = document.querySelectorAll('#chat-channel-history > li');

    const niceMessages = formatMessages(messages);
    const title = document.title;

    // const getStorageData = key =>
    // new Promise((resolve, reject) =>
    //     chrome.storage.sync.get(key, result =>
    //     chrome.runtime.lastError
    //         ? reject(Error(chrome.runtime.lastError.message))
    //         : resolve(result)
    //     )
    // )

    // const setStorageData = data =>
    // new Promise((resolve, reject) =>
    //     chrome.storage.sync.set(data, () =>
    //     chrome.runtime.lastError
    //         ? reject(Error(chrome.runtime.lastError.message))
    //         : resolve()
    //     )
    // )

    // await setStorageData({ data: [someData] })

    chrome.storage.sync.set({
        [title]: niceMessages
    });
}


let page = document.getElementById("main");

function buildElements() {
    chrome.storage.sync.get(null, (items) => {
        keys = Object.keys(items);
        keys.forEach(k => {
            chrome.storage.sync.get(k, (messages) => {
                let container = document.createElement('div');
                let header = document.createElement('h2');
                header.innerText = k;
                container.appendChild(header);
                for (chat in messages[k]) {
                    let p = document.createElement('p');
                    p.innerText = `[${messages[k][chat].time}] ${messages[k][chat].name}: ${messages[k][chat].content}`;
                    container.appendChild(p);
                }
    
                page.appendChild(container);
            });
    
        })
    });
}

buildElements();

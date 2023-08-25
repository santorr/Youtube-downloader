// Create context menu items for downloading
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "downloadThumbnail",
        title: "Download from thumbnail",
        contexts: ["image"]
    });
    
    chrome.contextMenus.create({
        id: "downloadVideo",
        title: "Download from video",
        contexts: ["video"]
    });
});

// Handle context menu click events
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "downloadThumbnail") {
        download(info.linkUrl);
    }
    if (info.menuItemId === "downloadVideo") {
        download(tab.url);
    }
});

// Handle keyboard shortcut command
chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command === "download") {
        download(tab.url);
    }
});

/**
 * Send a download request to the server.
 * @param {string} url - The URL of the video to download.
 */
function download(url) {
    const localUrl = "http://localhost:4000/download";

    const data = { 'url' : url };

    // Use fetch API to send a POST request to the server
    fetch(localUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
    })
    .catch(error => {
        console.error('Error sending request to server:', error);
    });
}
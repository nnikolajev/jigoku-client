export function getGameNodeUrl(server, browserOrigin = window.location.origin) {
    if(server.proxyThroughLobby) {
        return browserOrigin;
    }

    const address = server.address;
    let url = `${server.protocol || "https"}://${address}`;

    if(server.port && server.port !== 80 && server.port !== 443) {
        url += `:${server.port}`;
    }

    return url;
}

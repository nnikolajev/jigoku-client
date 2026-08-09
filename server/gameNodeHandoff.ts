export function buildGameNodeHandoff(node, proxyUrl, gameId?) {
    return {
        address: node.address,
        port: node.port,
        protocol: node.protocol,
        name: node.identity,
        proxyThroughLobby: Boolean(proxyUrl),
        ...(gameId ? { gameId } : {})
    };
}

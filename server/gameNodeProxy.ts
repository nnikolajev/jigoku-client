const httpProxy = require("http-proxy");

const GAME_NODE_SOCKET_PATH = /^\/[^/]+\/socket\.io(?:\/|$)/;

export function isGameNodeSocketPath(url) {
    try {
        return GAME_NODE_SOCKET_PATH.test(new URL(url, "http://localhost").pathname);
    } catch(_err) {
        return false;
    }
}

export function getGameNodeProxyOrigin(config) {
    const protocol = config.https === true || config.https === "true" ? "https" : "http";
    const port = config.lobby?.port;
    const portSuffix = port && port !== 80 && port !== 443 ? `:${port}` : "";
    return `${protocol}://${config.domain}${portSuffix}`;
}

export function attachGameNodeProxy(app, server, config, logger) {
    const target = config.gameNode?.proxyUrl;
    if(!target) {
        return;
    }

    const proxy = httpProxy.createProxyServer({
        target,
        ws: true,
        changeOrigin: true,
        headers: {
            origin: getGameNodeProxyOrigin(config)
        }
    });

    proxy.on("error", (err, _request, response) => {
        logger.error(`Game node proxy error: ${err.message}`);
        if(response && typeof response.writeHead === "function") {
            if(!response.headersSent) {
                response.writeHead(502, { "Content-Type": "text/plain" });
            }
            response.end("Game node unavailable");
        } else if(response && typeof response.destroy === "function") {
            response.destroy();
        }
    });

    app.use((request, response, next) => {
        if(!isGameNodeSocketPath(request.url)) {
            return next();
        }
        proxy.web(request, response);
    });

    server.on("upgrade", (request, socket, head) => {
        if(isGameNodeSocketPath(request.url)) {
            proxy.ws(request, socket, head);
        }
    });
}

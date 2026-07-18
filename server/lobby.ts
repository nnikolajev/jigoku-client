const { Server } = require("socket.io");
const Socket = require("./socket.js");
const jwt = require("jsonwebtoken");
const { differenceInSeconds } = require("date-fns");

const logger = require("./log.js");
const version = new Date(require("../version.js").default);
const PendingGame = require("./pendinggame.js");
const GameRouter = require("./gamerouter.js");
const DeckService = require("./services/DeckService.js");
const CardService = require("./services/CardService.js");
const validateDeck = require("../client/deck-validator").default;
const Settings = require("./settings.js");
const GetShadowlandsSummonables = require("./shadowLandsHelper.js");

// Public Crane Baseline used by standardized bot benchmarks and as the default
// playable bot deck. The per-deck tactics live in Jigoku's bot profile layer.
const DEFAULT_BOT_DECKLIST_URL = "https://www.emeralddb.org/api/decklists/4736f7c0-b4a6-4f17-9dde-b71614115c69";
const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;
const ONE_HOUR = 60 * ONE_MINUTE;
const FOUR_HOURS = 4 * ONE_HOUR;

const factions = {
    crab: { name: "Crab Clan", value: "crab" },
    crane: { name: "Crane Clan", value: "crane" },
    dragon: { name: "Dragon Clan", value: "dragon" },
    lion: { name: "Lion Clan", value: "lion" },
    phoenix: { name: "Phoenix Clan", value: "phoenix" },
    scorpion: { name: "Scorpion Clan", value: "scorpion" },
    unicorn: { name: "Unicorn Clan", value: "unicorn" }
};

const formats = {
    emerald: { name: "Emerald", value: "emerald" },
    sanctuary: { name: "Sanctuary", value: "sanctuary" },
    stronghold: { name: "Imperial", value: "stronghold" },
    skirmish: { name: "Skirmish", value: "skirmish" },
    obsidian: { name: "Obsidian", value: "obsidian" }
};

const communityFormats = new Set(["emerald", "sanctuary", "obsidian"]);

function buildBotUser(playerName) {
    return {
        username: playerName,
        emailHash: "",
        isBot: true,
        settings: {
            disableGravatar: true,
            timerSettings: {},
            windowTimer: false,
            optionSettings: {}
        },
        promptedActionWindows: {
            dynasty: true,
            draw: true,
            preConflict: true,
            conflict: true,
            fate: true,
            regroup: true
        }
    };
}

function preferredPackId(card, formatValue) {
    const versions = card?.versions;
    if(!versions || versions.length === 0) {
        return undefined;
    }
    return communityFormats.has(formatValue) ? versions[versions.length - 1].pack_id : versions[0].pack_id;
}

class Lobby {
    sockets: any;
    users: any;
    games: any;
    config: any;
    deckService: any;
    cardService: any;
    router: any;
    titleCardData: any;
    io: any;
    lastUserBroadcast: any;
    shortCardData: any;

    constructor(server, options: any = {}) {
        this.sockets = {};
        this.users = {};
        this.games = {};
        this.config = options.config;
        this.deckService = options.deckService || new DeckService(options.db);
        this.cardService = options.cardService || new CardService(options.db);
        this.router = options.router || new GameRouter(this.config);
        this.titleCardData = null;

        this.router.on("onGameClosed", this.onGameClosed.bind(this));
        this.router.on("onPlayerLeft", this.onPlayerLeft.bind(this));
        this.router.on("onWorkerTimedOut", this.onWorkerTimedOut.bind(this));
        this.router.on("onNodeReconnected", this.onNodeReconnected.bind(this));
        this.router.on("onWorkerStarted", this.onWorkerStarted.bind(this));

        this.io = options.io || new Server(server, {
            perMessageDeflate: false,
            pingTimeout: 30000,
            pingInterval: 25000,
            cors: {
                origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : "*",
                credentials: true
            }
        });
        this.io.use(this.handshake.bind(this));
        this.io.on("connection", this.onConnection.bind(this));

        this.lastUserBroadcast = new Date();

        this.loadCardData();

        setInterval(() => this.clearStaleGames(), ONE_MINUTE);
    }

    async loadCardData() {
        this.shortCardData = await this.cardService.getAllCards({ shortForm: true });
    }

    // External methods
    getStatus() {
        var nodeStatus = this.router.getNodeStatus();

        return nodeStatus;
    }

    disableNode(nodeName) {
        return this.router.disableNode(nodeName);
    }

    enableNode(nodeName) {
        return this.router.enableNode(nodeName);
    }

    debugDump() {
        var games = Object.values(this.games).map(game => {
            var players = Object.values(game.players).map(player => {
                return {
                    name: player.name,
                    left: player.left,
                    disconnected: player.disconnected,
                    id: player.id
                };
            });

            var spectators = Object.values(game.spectators).map(spectator => {
                return {
                    name: spectator.name,
                    id: spectator.id
                };
            });

            return {
                name: game.name,
                players: players,
                spectators: spectators,
                id: game.id,
                started: game.started,
                node: game.node ? game.node.identity : "None",
                startedAt: game.createdAt
            };
        });

        var nodes = this.router.getNodeStatus();

        return {
            games: games,
            nodes: nodes,
            socketCount: Object.keys(this.sockets).length,
            userCount: Object.keys(this.users).length
        };
    }

    // Helpers
    findGameForUser(user) {
        return Object.values(this.games).find(game => {
            if(game.spectators[user]) {
                return true;
            }

            var player = game.players[user];

            if(!player || player.left) {
                return false;
            }

            return true;
        });
    }

    getUserList() {
        let userList = Object.values(this.users).map(function(user) {
            return {
                name: user.username,
                emailHash: user.emailHash,
                noAvatar: user.settings.disableGravatar
            };
        });

        userList = userList.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        return userList;
    }

    handshake(socket, next) {
        var versionInfo = undefined;

        // Socket.io v4 uses auth object, v1 used query string
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if(token && token !== "undefined") {
            jwt.verify(token, this.config.secret, function(err, user) {
                if(err) {
                    logger.info(`Lobby JWT verification failed: ${err.message}`);
                    return;
                }

                socket.request.user = user;
            });
        }

        const versionStr = socket.handshake.auth?.version || socket.handshake.query?.version;
        if(versionStr) {
            versionInfo = new Date(versionStr);
        }

        if(!versionInfo || versionInfo < version) {
            socket.emit("banner", "Your client version is out of date, please refresh or clear your cache to get the latest version");
        }

        next();
    }

    // Actions
    filterGameListWithBlockList(user) {
        if(!user) {
            return this.games;
        }

        return Object.values(this.games).filter(game => {
            let userBlockedByOwner = game.isUserBlocked(user);
            let userHasBlockedPlayer = Object.values(game.players).some(player => user.blockList && user.blockList.includes(player.name.toLowerCase()));
            return !userBlockedByOwner && !userHasBlockedPlayer;
        });
    }

    mapGamesToGameSummaries(games) {
        const gamesArray = Array.isArray(games) ? games : Object.values(games);
        return gamesArray
            .map(game => game.getSummary())
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .sort((a, b) => (a.started === b.started) ? 0 : a.started ? 1 : -1);
    }

    sendUserListFilteredWithBlockList(socket, userList) {
        let filteredUsers = userList;

        if(socket.user && socket.user.blockList) {
            filteredUsers = userList.filter(user => !socket.user.blockList.includes(user.name.toLowerCase()));
        }

        socket.send("users", filteredUsers);
    }

    broadcastGameList(socket?) {
        let sockets = socket ? [socket] : Object.values(this.sockets);
        sockets.forEach(socket => {
            if(socket) {
                let filteredGames = this.filterGameListWithBlockList(socket.user);
                let gameSummaries = this.mapGamesToGameSummaries(filteredGames);
                socket.send("games", gameSummaries);
            }
        });
    }

    broadcastUserList() {
        var now = new Date();

        if(differenceInSeconds(now, this.lastUserBroadcast) < 60) {
            return;
        }

        this.lastUserBroadcast = new Date();

        let users = this.getUserList();

        Object.values(this.sockets).forEach(socket => {
            if(socket) {
                this.sendUserListFilteredWithBlockList(socket, users);
            }
        });
    }

    sendGameState(game) {
        if(game.started) {
            return;
        }

        Object.values(game.getPlayersAndSpectators()).forEach(player => {
            if(!this.sockets[player.id]) {
                // Bot seats never have a socket; only log for real players.
                if(player.id !== "BOT" && !(player as any).isBot) {
                    logger.info(`Wanted to send to ${player.id} but have no socket`);
                }
                return;
            }

            this.sockets[player.id].send("gamestate", game.getSummary(player.name));
        });
    }

    hydrateDeckCards(deck, cards) {
        if(deck.stronghold) {
            deck.stronghold.forEach(stronghold => {
                stronghold.card = cards[stronghold.card.id];
            });
        }

        if(deck.role) {
            deck.role.forEach(role => {
                role.card = cards[role.card.id];
            });
        }

        if(deck.provinceCards) {
            deck.provinceCards.forEach(province => {
                province.card = cards[province.card.id];
            });
        }

        if(deck.conflictCards) {
            deck.conflictCards.forEach(conflict => {
                conflict.card = cards[conflict.card.id];
            });
        }

        if(deck.dynastyCards) {
            deck.dynastyCards.forEach(dynasty => {
                dynasty.card = cards[dynasty.card.id];
            });
        }
    }

    async hydrateDeck(deckId, gameMode) {
        const [cards, packs, deck] = await Promise.all([this.cardService.getAllCards(), this.cardService.getAllPacks(), this.deckService.getById(deckId)]);
        if(!deck) {
            throw new Error(`No such deck ${deckId}`);
        }

        this.hydrateDeckCards(deck, cards);
        deck.outsideTheGameCards = GetShadowlandsSummonables(cards);
        deck.status = await validateDeck(deck, { packs: packs, includeExtendedStatus: false, gameMode: gameMode });
        return deck;
    }

    toEmeraldDecklistApiUrl(url) {
        return url.replace("/decks/", "/api/decklists/");
    }

    async fetchEmeraldDecklist(url) {
        const response = await fetch(this.toEmeraldDecklistApiUrl(url));
        if(!response.ok) {
            throw new Error(`EmeraldDB deck fetch failed: HTTP ${response.status}`);
        }
        return response.json();
    }

    async buildDeckFromEmeraldDecklistUrl(url, gameMode) {
        const decklist = await this.fetchEmeraldDecklist(url);
        const [cards, packs] = await Promise.all([this.cardService.getAllCards(), this.cardService.getAllPacks()]);
        let formatValue = decklist.format || gameMode || "emerald";
        if(formatValue === "standard") {
            formatValue = "stronghold";
        }

        const deck = {
            name: decklist.name || "Jigoku Bot Deck",
            faction: factions[decklist.primary_clan] || factions.lion,
            alliance: decklist.secondary_clan ? factions[decklist.secondary_clan] : { name: "", value: "" },
            format: formats[formatValue] || formats.emerald,
            stronghold: [],
            role: [],
            provinceCards: [],
            conflictCards: [],
            dynastyCards: []
        };

        const cardPackIds = decklist.card_pack_ids || {};
        Object.entries(decklist.cards || {}).forEach(([id, count]) => {
            const card = cards[id];
            if(!card) {
                logger.warn(`Bot default deck skipped missing card ${id}`);
                return;
            }

            const entry = { count: count, card: card, pack_id: cardPackIds[id] || preferredPackId(card, formatValue) };
            if(card.type === "province") {
                deck.provinceCards.push(entry);
            } else if(card.side === "dynasty") {
                deck.dynastyCards.push(entry);
            } else if(card.side === "conflict") {
                deck.conflictCards.push(entry);
            } else if(card.type === "stronghold") {
                deck.stronghold.push(entry);
            } else {
                deck.role.push(entry);
            }
        });

        deck.outsideTheGameCards = GetShadowlandsSummonables(cards);
        deck.status = await validateDeck(deck, { packs: packs, includeExtendedStatus: false, gameMode: gameMode });
        return deck;
    }

    async addBotOpponent(game, botDetails: any = {}) {
        if(!botDetails.enabled) {
            return;
        }

        const botConfig = {
            playerName: botDetails.playerName || "Jigoku Bot",
            // The deck id doubles as the analysis-cache key on the game node,
            // so the default deck must carry its decklist URL explicitly.
            deckId: botDetails.deckId || DEFAULT_BOT_DECKLIST_URL,
            seed: botDetails.seed || 1,
            difficulty: botDetails.difficulty || "mvp",
            policy: botDetails.policy,
            trace: botDetails.trace !== false,
            // Default LM Studio integration; the game node warns and falls
            // back to pure heuristics when the server is unreachable.
            llm: botDetails.llm || {
                enabled: process.env.BOT_LLM_ENABLED !== "false",
                baseUrl: process.env.BOT_LLM_BASE_URL || "http://localhost:1234",
                model: process.env.BOT_LLM_MODEL || "qwen/qwen3.5-9b",
                liveConsult: process.env.BOT_LLM_LIVE_CONSULT !== "false",
                consultTimeoutMs: Number(process.env.BOT_LLM_CONSULT_TIMEOUT_MS) || 120000
            }
        };

        const botUser = buildBotUser(botConfig.playerName);
        game.addBot("BOT", botUser, botConfig);

        let deck;
        if(botConfig.deckId && /^https?:\/\//i.test(botConfig.deckId)) {
            deck = await this.buildDeckFromEmeraldDecklistUrl(botConfig.deckId, game.gameMode);
        } else if(botConfig.deckId) {
            deck = await this.hydrateDeck(botConfig.deckId, game.gameMode);
        } else {
            deck = await this.buildDeckFromEmeraldDecklistUrl(DEFAULT_BOT_DECKLIST_URL, game.gameMode);
        }

        game.selectDeck(botConfig.playerName, deck);
    }

    clearGamesForNode(nodeName) {
        Object.values(this.games).forEach(game => {
            if(game.node && game.node.identity === nodeName) {
                delete this.games[game.id];
            }
        });

        this.broadcastGameList();
    }

    clearStaleGames() {
        let now = Date.now();
        const pendingTimeout = ONE_HOUR;
        let changed = false;

        Object.values(this.games).forEach(game => {
            if(!game) {
                return;
            }

            let age = now - game.createdAt;

            // Pending games older than 1 hour
            if(!game.started && age > pendingTimeout) {
                logger.info(`closed pending game ${game.id} due to inactivity`);
                delete this.games[game.id];
                changed = true;
                return;
            }

            if(!game.started) {
                return;
            }

            // Started games with no players after 5 minutes
            if(age > FIVE_MINUTES && Object.keys(game.getPlayers()).length === 0) {
                logger.info(`closed started game ${game.id} due to no active players`);
                delete this.games[game.id];
                this.router.closeGame(game);
                changed = true;
                return;
            }

            // Started games whose node no longer exists
            if(game.node && !this.router.workers[game.node.identity]) {
                logger.info(`closed game ${game.id} because node ${game.node.identity} is no longer connected`);
                delete this.games[game.id];
                changed = true;
                return;
            }

            // Any game older than 4 hours is stale
            if(age > FOUR_HOURS) {
                logger.info(`closed game ${game.id} after ${Math.round(age / ONE_HOUR)}h (maximum game age exceeded)`);
                delete this.games[game.id];
                this.router.closeGame(game);
                changed = true;
            }
        });

        if(changed) {
            this.broadcastGameList();
        }
    }

    // Events
    onConnection(ioSocket) {
        var socket = new Socket(ioSocket, { config: this.config });

        socket.registerEvent("newgame", this.onNewGame.bind(this));
        socket.registerEvent("joingame", this.onJoinGame.bind(this));
        socket.registerEvent("leavegame", this.onLeaveGame.bind(this));
        socket.registerEvent("watchgame", this.onWatchGame.bind(this));
        socket.registerEvent("startgame", this.onStartGame.bind(this));
        socket.registerEvent("chat", this.onPendingGameChat.bind(this));
        socket.registerEvent("selectdeck", this.onSelectDeck.bind(this));
        socket.registerEvent("connectfailed", this.onConnectFailed.bind(this));
        socket.registerEvent("removegame", this.onRemoveGame.bind(this));

        socket.on("authenticate", this.onAuthenticated.bind(this));
        socket.on("disconnect", this.onSocketDisconnected.bind(this));

        this.sockets[ioSocket.id] = socket;

        if(socket.user) {
            this.users[socket.user.username] = Settings.getUserWithDefaultsSet(socket.user);

            this.broadcastUserList();
        }

        // Force user list send for the newly connected socket, bypassing the throttle
        this.sendUserListFilteredWithBlockList(socket, this.getUserList());

        this.broadcastGameList(socket);

        if(!socket || !socket.user) {
            return;
        }

        var game = this.findGameForUser(socket.user.username);
        if(game && game.started) {
            socket.send("handoff", { address: game.node.address, port: game.node.port, protocol: game.node.protocol, name: game.node.identity, gameId: game.id });
        }
    }

    onAuthenticated(socket, user) {
        let userWithDefaults = Settings.getUserWithDefaultsSet(user);
        this.users[user.username] = userWithDefaults;

        this.broadcastUserList();
    }

    onSocketDisconnected(socket, reason) {
        if(!socket) {
            return;
        }

        delete this.sockets[socket.id];

        if(!socket.user) {
            return;
        }

        delete this.users[socket.user.username];

        logger.info("user '%s' disconnected from the lobby: %s", socket.user.username, reason);

        var game = this.findGameForUser(socket.user.username);
        if(!game) {
            return;
        }

        game.disconnect(socket.user.username);

        if(game.isEmpty()) {
            delete this.games[game.id];
        } else {
            this.sendGameState(game);
        }

        this.broadcastGameList();
    }

    onNewGame(socket, gameDetails) {
        var existingGame = this.findGameForUser(socket.user.username);
        if(existingGame) {
            return;
        }

        let game = new PendingGame(socket.user, gameDetails);
        game.newGame(socket.id, socket.user, gameDetails.password, (err, message) => {
            if(err) {
                logger.info(`game failed to create: ${err} ${message}`);

                return;
            }

            this.addBotOpponent(game, gameDetails.bot)
                .then(() => {
                    socket.joinChannel(game.id);
                    this.sendGameState(game);

                    this.games[game.id] = game;
                    this.broadcastGameList();
                })
                .catch(err => {
                    logger.info(`failed to add bot opponent: ${err}`);
                });
        });
    }

    onJoinGame(socket, gameId, password) {
        var existingGame = this.findGameForUser(socket.user.username);
        if(existingGame) {
            return;
        }

        var game = this.games[gameId];
        if(!game) {
            return;
        }

        game.join(socket.id, socket.user, password, (err, message) => {
            if(err) {
                socket.send("passworderror", message);

                return;
            }

            socket.joinChannel(game.id);

            this.sendGameState(game);

            this.broadcastGameList();
        });
    }

    onStartGame(socket, gameId) {
        var game = this.games[gameId];

        if(!game || game.started) {
            return;
        }

        if(Object.values(game.getPlayers()).some(function(player) {
            return !player.deck;
        })) {
            return;
        }

        if(!game.isOwner(socket.user.username)) {
            return;
        }

        var gameNode = this.router.startGame(game);
        if(!gameNode) {
            return;
        }

        game.node = gameNode;
        game.started = true;

        this.broadcastGameList();

        this.io.to(game.id).emit("handoff", { address: gameNode.address, port: gameNode.port, protocol: game.node.protocol, name: game.node.identity });
    }

    onWatchGame(socket, gameId, password) {
        var existingGame = this.findGameForUser(socket.user.username);
        if(existingGame) {
            return;
        }

        var game = this.games[gameId];
        if(!game) {
            return;
        }

        game.watch(socket.id, socket.user, password, (err, message) => {
            if(err) {
                socket.send("passworderror", message);

                return;
            }

            socket.joinChannel(game.id);

            if(game.started) {
                this.router.addSpectator(game, socket.user);
                socket.send("handoff", { address: game.node.address, port: game.node.port, protocol: game.node.protocol, name: game.node.identity });
            } else {
                this.sendGameState(game);
            }
        });
    }

    onLeaveGame(socket) {
        var game = this.findGameForUser(socket.user.username);
        if(!game) {
            return;
        }

        game.leave(socket.user.username);
        socket.send("cleargamestate");
        socket.leaveChannel(game.id);

        if(game.isEmpty()) {
            delete this.games[game.id];
        } else {
            this.sendGameState(game);
        }

        this.broadcastGameList();
    }

    onPendingGameChat(socket, message) {
        var game = this.findGameForUser(socket.user.username);
        if(!game) {
            return;
        }

        game.chat(socket.user.username, message);
        this.sendGameState(game);
    }

    onSelectDeck(socket, gameId, deckId) {
        if(deckId && typeof deckId === "object") {
            deckId = deckId._id;
        }

        var game = this.games[gameId];
        if(!game) {
            return;
        }

        this.hydrateDeck(deckId, game.gameMode)
            .then(deck => {
                game.selectDeck(socket.user.username, deck);

                this.sendGameState(game);
            })
            .catch(err => {
                logger.info(`Error loading deck: ${err}`);

                return;
            });
    }

    onConnectFailed(socket) {
        var game = this.findGameForUser(socket.user.username);
        if(!game) {
            return;
        }

        logger.info("user '%s' failed to handoff to game server", socket.user.username);
        this.router.notifyFailedConnect(game, socket.user.username);
    }

    onRemoveGame(socket, gameId) {
        var isAdmin = socket && socket.user.admin;
        var game = this.games[gameId];
        if(!game) {
            return;
        }

        var isOwner = game.owner.username === socket.user.username;
        if(!isAdmin && !isOwner) {
            return;
        }

        logger.info(`${socket.user.username} closed game ${game.id} (${game.name}) forcefully`);

        if(!game.started) {
            delete this.games[game.id];
            this.broadcastGameList();
        } else {
            this.router.closeGame(game);
        }
    }

    // router Events
    onGameClosed(gameId) {
        var game = this.games[gameId];

        if(!game) {
            return;
        }

        delete this.games[gameId];

        this.broadcastGameList();
    }

    onPlayerLeft(gameId, player) {
        var game = this.games[gameId];

        if(!game) {
            return;
        }

        game.leave(player);

        if(game.isEmpty()) {
            delete this.games[gameId];
        }

        this.broadcastGameList();
    }

    onWorkerTimedOut(nodeName) {
        this.clearGamesForNode(nodeName);
    }

    onWorkerStarted(nodeName) {
        const shortCardData = this.shortCardData ? Object.values(this.shortCardData) : [];
        this.router.sendCommand(nodeName, "CARDDATA", { titleCardData: this.titleCardData, shortCardData });
    }

    onNodeReconnected(nodeName, games) {
        for(let game of Object.values(games)) {
            if(!game || !game.owner || !game.players) {
                continue;
            }

            let owner = undefined;
            for(let player of Object.values(game.players)) {
                if(player.name === game.owner.username) {
                    owner = player;
                    break;
                }
            }

            if(!owner) {
                logger.error(`Got a game where the owner wasn't a player: ${game.owner}`);
                continue;
            }

            let syncGame = new PendingGame({ username: game.owner }, { spectators: game.allowSpectators, name: game.name });
            syncGame.id = game.id;
            syncGame.node = this.router.workers[nodeName];
            syncGame.createdAt = game.startedAt;
            syncGame.started = game.started;
            syncGame.gameType = game.gameType;
            syncGame.password = game.password;

            for(let player of Object.values(game.players)) {
                if(!player) {
                    continue;
                }

                syncGame.players[player.name] = {
                    id: player.id,
                    name: player.name,
                    emailHash: player.emailHash,
                    owner: game.owner === player.name,
                    faction: { cardData: { code: player.faction } }
                };
            }

            for(let player of Object.values(game.spectators)) {
                if(!player) {
                    continue;
                }

                syncGame.spectators[player.name] = {
                    id: player.id,
                    name: player.name,
                    emailHash: player.emailHash
                };
            }
            this.games[syncGame.id] = syncGame;
        }

        for(let game of Object.values(this.games)) {
            if(!game) {
                continue;
            }

            if(game.node && game.node.identity === nodeName && Object.values(games).find(nodeGame => {
                return nodeGame && game && nodeGame.id === game.id;
            })) {
                this.games[game.id] = game;
            } else if(game.node && game.node.identity === nodeName) {
                delete this.games[game.id];
            }
        }

        this.broadcastGameList();
    }
}

module.exports = Lobby;

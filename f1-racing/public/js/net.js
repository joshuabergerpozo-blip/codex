// Réseau pair-à-pair (WebRTC via PeerJS) : aucun serveur de jeu à héberger.
// Le navigateur qui crée le groupe fait office de serveur (HostRoom) ; les
// autres s'y connectent directement grâce au code du groupe.
//
// L'interface reste celle d'un client WebSocket : `send(msg)` / `on(type, fn)`.
import { ProfileStore, publicInfo } from "./profile.js";
import { HostRoom } from "./room.js";

const PREFIX = "f1-garage-racing-";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode() {
  let c = "";
  for (let i = 0; i < 5; i++) {
    c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return c;
}

// Serveur de mise en relation PeerJS : celui de PeerJS par défaut, ou un autre
// via l'URL (?peer=hote:port) pour les tests en local.
function peerOptions() {
  const custom = new URLSearchParams(location.search).get("peer");
  if (!custom) return { debug: 1 };
  const [host, port] = custom.split(":");
  return {
    host,
    port: Number(port) || 9000,
    path: "/",
    secure: false,
    debug: 1,
  };
}

export class Net {
  constructor() {
    this.handlers = new Map();
    this.profile = new ProfileStore();
    this.peer = null;
    this.conn = null; // connexion vers l'hôte (si on a rejoint)
    this.room = null; // groupe (si on est l'hôte)
    this.local = null; // notre client dans `room`
    this.myId = null;
    this.inRace = false;
    this.timer = null;
  }

  async connect() {
    if (!window.Peer) throw new Error("PeerJS introuvable");
    this.emit({ t: "welcome", profile: this.profile.p });
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
  }

  emit(msg) {
    for (const fn of this.handlers.get(msg.t) || []) fn(msg);
  }

  // Message reçu depuis le groupe (hôte local ou distant).
  receive(msg) {
    if (!msg || typeof msg.t !== "string") return;
    this.lastHostMsg = Date.now();
    if (msg.t === "ping") return;
    if (msg.t === "joined") this.myId = msg.you;
    if (msg.t === "raceStart") this.inRace = msg.grid.includes(this.myId);
    if (msg.t === "raceResults") this.inRace = false;
    if (msg.t === "bonus") {
      this.profile.addRaceBonus(Number(msg.amount) || 0, Boolean(msg.won));
      this.emit({ t: "profile", profile: this.profile.p });
      return;
    }
    this.emit(msg);
  }

  toGroup(msg) {
    if (this.room && this.local) this.room.handle(this.local, msg);
    else if (this.conn?.open) this.conn.send(msg);
  }

  profileChanged() {
    this.emit({ t: "profile", profile: this.profile.p });
    this.toGroup({ t: "info", info: publicInfo(this.profile.p) });
  }

  send(msg) {
    const pr = this.profile;
    switch (msg.t) {
      case "hello":
        pr.setName(msg.name);
        this.emit({ t: "welcome", profile: pr.p });
        return;
      case "create":
        this.create();
        return;
      case "join":
        this.join(msg.code);
        return;
      case "leave":
        this.close();
        return;
      case "lap": {
        const res = pr.lap(Number(msg.time), Boolean(msg.clean), this.inRace);
        if (!res) return;
        this.emit({ t: "profile", profile: pr.p });
        this.emit({
          t: "reward",
          amount: res.reward,
          best: res.best,
          clean: Boolean(msg.clean),
        });
        this.toGroup({ t: "lapDone", time: Number(msg.time), best: res.best });
        if (res.best) this.toGroup({ t: "info", info: publicInfo(pr.p) });
        return;
      }
      case "buy": {
        const err = pr.buy(msg.kind, msg.id);
        if (err) {
          this.emit({ t: "error", msg: err });
          return;
        }
        this.profileChanged();
        this.emit({ t: "bought", kind: msg.kind, id: msg.id });
        return;
      }
      case "customize":
        pr.customize(msg);
        this.profileChanged();
        return;
      case "repair": {
        const cost = pr.repair(msg.missing);
        if (cost === null) {
          this.emit({ t: "error", msg: "Pas assez d'argent pour réparer." });
          return;
        }
        this.emit({ t: "profile", profile: pr.p });
        this.emit({ t: "repaired", cost });
        return;
      }
      default:
        // state, startRace, cancelRace, finish, chat
        this.toGroup(msg);
    }
  }

  // --- Création d'un groupe (on devient l'hôte) -------------------------------

  create(attempt = 0) {
    this.close();
    const code = randomCode();
    const peer = new window.Peer(PREFIX + code, peerOptions());
    this.peer = peer;
    peer.on("open", () => {
      this.room = new HostRoom(code);
      // Notre propre joueur : messages livrés de façon asynchrone comme sur le réseau.
      this.local = this.room.add(
        (m) => queueMicrotask(() => this.receive(m)),
        publicInfo(this.profile.p),
      );
    });
    peer.on("connection", (conn) => this.acceptGuest(conn));
    // Signal de vie : permet aux invités de voir vite si l'hôte est parti.
    this.timer = setInterval(() => this.room?.broadcast({ t: "ping" }), 2000);
    peer.on("disconnected", () => {
      // Perte du serveur de mise en relation : les parties en cours continuent,
      // on tente de se reconnecter pour accepter de nouveaux joueurs.
      if (!peer.destroyed) peer.reconnect();
    });
    peer.on("error", (err) => {
      if (err.type === "unavailable-id" && attempt < 5) {
        this.create(attempt + 1);
        return;
      }
      if (!this.room) this.fail(err);
    });
  }

  acceptGuest(conn) {
    let client = null;
    conn.on("data", (msg) => {
      if (!this.room) return;
      if (!client) {
        if (msg?.t !== "hello") return;
        client = this.room.add((m) => {
          if (conn.open) conn.send(m);
        }, msg.info);
        if (!client) setTimeout(() => conn.close(), 500);
        return;
      }
      this.room.handle(client, msg);
    });
    const bye = () => {
      if (client && this.room) this.room.remove(client);
      client = null;
    };
    conn.on("close", bye);
    conn.on("error", bye);
  }

  // --- Rejoindre un groupe ------------------------------------------------------

  join(code) {
    this.close();
    const clean = String(code || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    const peer = new window.Peer(peerOptions());
    this.peer = peer;
    let opened = false;
    const timeout = setTimeout(() => {
      if (!opened) {
        this.emit({
          t: "error",
          msg: "Impossible de joindre ce groupe (délai dépassé).",
        });
        this.close();
      }
    }, 15000);
    peer.on("open", () => {
      const conn = peer.connect(PREFIX + clean, {
        reliable: true,
        serialization: "json",
      });
      this.conn = conn;
      conn.on("open", () => {
        opened = true;
        clearTimeout(timeout);
        this.lastHostMsg = Date.now();
        conn.send({ t: "hello", info: publicInfo(this.profile.p) });
        this.timer = setInterval(() => {
          if (Date.now() - this.lastHostMsg > 10000) this.hostLost(conn);
        }, 2000);
      });
      conn.on("data", (msg) => this.receive(msg));
      conn.on("close", () => this.hostLost(conn));
    });
    peer.on("error", (err) => {
      clearTimeout(timeout);
      if (err.type === "peer-unavailable") {
        this.emit({ t: "error", msg: "Aucun groupe avec ce code." });
        this.close();
      } else if (!opened) {
        this.fail(err);
      }
    });
  }

  hostLost(conn) {
    if (this.conn !== conn) return;
    this.close();
    this.emit({ t: "close", reason: "L'hôte du groupe s'est déconnecté." });
  }

  fail(err) {
    console.error(err);
    this.emit({
      t: "error",
      msg: "Connexion impossible au service multijoueur. Vérifie ta connexion Internet.",
    });
    this.close();
  }

  close() {
    clearInterval(this.timer);
    this.timer = null;
    const conn = this.conn;
    this.conn = null;
    conn?.close();
    this.room = null;
    this.local = null;
    this.peer?.destroy();
    this.peer = null;
  }
}

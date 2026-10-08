// Connexion WebSocket au serveur du jeu.
export class Net {
  constructor() {
    this.handlers = new Map();
    this.ws = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = (e) => reject(e);
      ws.onclose = () => this.emit({ t: "close" });
      ws.onmessage = (e) => {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        this.emit(msg);
      };
    });
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
  }

  emit(msg) {
    for (const fn of this.handlers.get(msg.t) || []) fn(msg);
  }

  send(msg) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }
}

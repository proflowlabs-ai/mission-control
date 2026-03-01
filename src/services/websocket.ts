import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

export interface WsEvent {
  type: "task.stdout" | "task.stderr" | "task.exit" | "scheduler.update";
  payload: Record<string, unknown>;
}

class WebsocketService {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();

  setup(server: HttpServer): void {
    if (this.wss) {
      return;
    }

    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (socket) => {
      this.clients.add(socket);
      socket.on("close", () => this.clients.delete(socket));
    });
  }

  broadcast(event: WsEvent): void {
    const message = JSON.stringify(event);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}

export const websocketService = new WebsocketService();

// @ts-ignore
import P2PCF from "p2pcf";

export class Master {
    identifier: string;

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    p2pcf: any;
    user_id: string;
    time: Date;
    reveal_now_state?: unknown;

    constructor(identifier: string) {
        this.identifier = identifier;
        this.user_id = crypto.randomUUID();
        this.time = new Date();
        const p2pcf = new P2PCF(this.user_id, this.identifier, {
            // workerUrl: ''
        });
        this.p2pcf = p2pcf;
    }

    async listen_new_user() {
        this.p2pcf.start();

        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        this.p2pcf.on("peerconnect", (peer: any) => {
            // New peer connected

            // Peer is an instance of simple-peer (https://github.com/feross/simple-peer)
            //
            // The peer has two custom fields:
            // - id (a per session unique id)
            // - client_id (which was passed to their P2PCF constructor)

            console.log("New peer:", peer.id, peer.client_id);

            // Add a media stream to the peer to start sending it
        });

        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        this.p2pcf.on("peerclose", (peer: any) => {
            console.log("Close peer:", peer.id, peer.client_id);
        });
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    async send_message(message: any) {
        this.reveal_now_state = message;

        const decoder = new TextEncoder();
        const msg_str = `${JSON.stringify(message)}\0`;
        const buffer = decoder.encode(msg_str);

        const state = JSON.stringify(buffer);

        this.p2pcf.broadcast(state);
    }
}

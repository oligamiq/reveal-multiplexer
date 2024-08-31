// @ts-ignore
import P2PCF from "p2pcf";

export class Client {
    identifier: string;
    reader: (arg: unknown) => void;

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    p2pcf: any;
    user_id: string;
    time: Date;

    constructor(identifier: string, reader: (arg: unknown) => void) {
        this.identifier = identifier;
        this.reader = reader;
        this.user_id = crypto.randomUUID();
        this.time = new Date();
        const p2pcf = new P2PCF(this.user_id, this.identifier, {
            // workerUrl: ''
        });
        this.p2pcf = p2pcf;
    }

    async connect() {
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

        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        this.p2pcf.on("msg", (peer: any, data: any) => {
            const decoder = new TextDecoder("utf-8");
            const msg = decoder.decode(data);

            const state = JSON.parse(msg);
            this.reader(state);
        });
    }
}

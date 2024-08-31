// Ref https://github.com/joeskeen/reveal-monaco/blob/master/plugin.js

import { Client as PipingClient } from "./piping/client";
import { Master as PipingMaster } from "./piping/master";
import { Client as P2PCFClient } from "./p2pcf/client";
import { Master as P2PCFMaster } from "./p2pcf/master";
import type Reveal from "./piping/reveal";

type OptionType = {
    identifier: string;
    can_master: (init_master: () => void) => void;
};

const defaultOptions: OptionType = {
    identifier: "default-identifier",
    can_master: (init_master: () => void) => {
        init_master();
    },
};

type MessageType = {
    state: Reveal.RevealState;
    content?: Event;
};

export class MultiplexerPlugin {
    deck: Reveal.Api;
    options: OptionType;

    constructor(reveal: Reveal.Api) {
        this.deck = reveal;
        const revealOptions: OptionType =
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            ((this.deck.getConfig() as unknown as any).multiplexer ||
                {}) as OptionType;
        if (revealOptions.identifier == null) {
            throw new Error("Identifier is required for multiplexer plugin");
        }
        this.options = { ...defaultOptions, ...revealOptions };
    }

    async init() {
        console.log("Multiplexer plugin initialized");
        const { identifier, can_master } = this.options;
        const client_func = (message: unknown) => {
            // https://github.com/reveal/multiplex/blob/master/client.js
            console.log(message);
            const { state } = message as MessageType;
            if (state) {
                console.log("Received state", state);
                try {
                    this.deck.setState(state);
                } catch (e) {
                    console.warn(e);
                }
            }
        };
        const client = new PipingClient(identifier, client_func);
        console.log("Connecting to multiplexer server");
        try {
            await client.connect();
            console.log("Connected to multiplexer server");
        } catch (e) {
            console.warn(e);

            await new Promise((resolve) => setTimeout(resolve, 3000));

            if (
                (e as Error).message ===
                "Identifier is invalid Or Master is not listening"
            ) {
                can_master(() => {
                    const master = new PipingMaster(identifier);
                    master.listen_new_user();
                    const alt_master = new P2PCFMaster(identifier);
                    alt_master.listen_new_user();

                    const post = (_evt: Event) => {
                        const message: MessageType = {
                            state: this.deck.getState(),
                            // content: _evt,
                        };
                        master.send_message(message);
                        alt_master.send_message(message);
                    };

                    window.addEventListener("load", post);
                    this.deck.on("slidechanged", post);
                    this.deck.on("fragmentshown", post);
                    this.deck.on("fragmenthidden", post);
                    this.deck.on("overviewhidden", post);
                    this.deck.on("overviewshown", post);
                    this.deck.on("paused", post);
                    this.deck.on("resumed", post);
                    document.addEventListener("send", post); // broadcast custom events sent by other plugins
                });
            } else {
                const alt_client = new P2PCFClient(identifier, client_func);
                await alt_client.connect();
                console.log("Connected to multiplexer alt server");
            }
        }
    }
}

export const Plugin: Reveal.PluginFunction = () => {
    return {
        id: "reveal-multiplexer",

        init: (reveal: Reveal.Api) => {
            const plugin = new MultiplexerPlugin(reveal);
            return plugin.init();
        },
    };
};

export default Plugin;

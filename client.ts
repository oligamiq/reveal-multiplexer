import { PreUrl } from "./config";

class Client {
    identifier: string;
    reader: (arg: unknown) => void;
    cancel_loop?: () => void;
    user_id?: string;

    constructor(identifier: string, reader: (arg: unknown) => void) {
        this.identifier = identifier;
        this.reader = reader;
    }

    async check_server() {
        let status: number | undefined = undefined;
        try {
            const response = await fetch(`${PreUrl}${this.identifier}/listen`, {
                method: "POST",
                body: "check number of user\0",
                headers: { "Content-Type": "text/plain;charset=UTF-8" },
            });

            status = response.status;

            await response.body?.cancel();
        } catch (_e) {}
        if (status) {
            if (status === 200) {
                throw new Error(
                    "Identifier is invalid Or Master is not listening"
                );
            }
        }
    }

    async connect() {
        await this.check_server();

        console.log(`Try Get User ID: ${PreUrl}${this.identifier}/listen`);
        const user_id_response = await fetch(
            `${PreUrl}${this.identifier}/listen`,
            {
                method: "GET",
                headers: { "Content-Type": "text/plain;charset=UTF-8" },
            }
        );
        console.log(user_id_response);
        if (user_id_response.status === 400) {
            throw new Error("Identifier is invalid Or Master is not listening");
        }
        // const user_id_reader = user_id_response.body
        //     ?.pipeThrough(new TextDecoderStream())
        //     .getReader();
        // if (!user_id_reader) {
        //     throw new Error("Reader is null");
        // }
        // const { value, done } = await user_id_reader.read();
        // // console.log(user_id_value);
        // if (done) {
        //     throw new Error("Reader is done");
        // }
        // console.log(value);
        // console.dir(value);
        // const user_id_value_value = value;
        // console.log(user_id_value_value);
        const user_id = await user_id_response.text();
        // console.log(textDecoder.decode(user_id_value_value));

        // const user_id = user_id_value_value;

        console.log(`Get User ID: ${user_id}`);
        console.log(user_id);

        this.user_id = user_id;
        console.log(`Get User ID: ${this.user_id}`);

        const property_normal: RequestInit = {
            method: "GET",
            headers: { "Content-Type": "text/plain;charset=UTF-8" },
        };
        const property = {
            ...property_normal,
            allowHTTP1ForStreamingUpload: true,
        };
        console.log(`Try Connect to ${PreUrl}${this.identifier}/${user_id}`);
        const response = await fetch(
            `${PreUrl}${this.identifier}/${user_id}`,
            property
        );
        console.log(`Connect to ${PreUrl}${this.identifier}/${user_id}`);
        const reader = response.body?.getReader();
        if (response.status === 400) {
            throw new Error("User ID is invalid");
        }
        if (reader) {
            const { value, done } = await reader.read();
            if (done) {
                throw new Error("Reader is done");
            }
            if (value) {
                this.parse_message(textDecoder.decode(value));
            }
            console.log("Connected");
            let cancel_resolve: (arg: undefined) => void;
            this.cancel_loop = () => {
                cancel_resolve(undefined);
            };
            (async () => {
                while (true) {
                    const canceller: Promise<undefined> = new Promise(
                        (resolve) => {
                            cancel_resolve = resolve;
                        }
                    );
                    const reader_ret = await Promise.race([
                        reader.read(),
                        canceller,
                    ]);
                    if (reader_ret === undefined) {
                        while (true) {
                            const { value, done } = await reader.read();
                            if (done) {
                                break;
                            }
                            if (value) {
                                this.parse_message(textDecoder.decode(value));
                            }
                        }
                        reader.cancel();
                        break;
                    }
                    const { value, done } = reader_ret;
                    if (done) {
                        break;
                    }
                    if (value) {
                        this.parse_message(textDecoder.decode(value));
                    }
                }
            })();
        } else {
            throw new Error("Reader is null");
        }
    }

    async connect_new_server(server: string) {
        // console.log(`Connect to ${server}`);
        if (!this.user_id) {
            throw new Error("User ID is null");
        }
        const property_normal: RequestInit = {
            method: "GET",
            headers: { "Content-Type": "text/plain;charset=UTF-8" },
        };
        const property = {
            ...property_normal,
            allowHTTP1ForStreamingUpload: true,
        };
        const response = await fetch(server, property);
        const reader = response.body?.getReader();
        if (response.status === 400) {
            throw new Error("NewServer Url is invalid");
        }
        if (reader) {
            const textDecoder = new TextDecoder();
            const { value, done } = await reader.read();
            if (done) {
                throw new Error("Reader is done");
            }
            if (value) {
                this.parse_message(textDecoder.decode(value));
            }
            this.cancel_loop?.();

            let cancel_resolve: (arg: undefined) => void;
            this.cancel_loop = () => {
                cancel_resolve(undefined);
            };
            (async () => {
                while (true) {
                    const canceller: Promise<undefined> = new Promise(
                        (resolve) => {
                            cancel_resolve = resolve;
                        }
                    );
                    const reader_ret = await Promise.race([
                        reader.read(),
                        canceller,
                    ]);
                    if (reader_ret === undefined) {
                        while (true) {
                            const { value, done } = await reader.read();
                            if (done) {
                                break;
                            }
                            if (value) {
                                this.parse_message(textDecoder.decode(value));
                            }
                        }
                        reader.cancel();
                        break;
                    }
                    const { value, done } = reader_ret;
                    if (done) {
                        break;
                    }
                    if (value) {
                        this.parse_message(textDecoder.decode(value));
                    }
                }
            })();
        } else {
            throw new Error("Reader is null");
        }
    }

    parse_message(message: string) {
        const msgs = message.split("\0");
        for (const msg of msgs) {
            if (msg === "") {
            } else if (msg === "accept") {
                console.log("Accept");
            } else if (msg === "new server") {
                console.log("New Server");
            } else if (msg === "check number of user") {
                console.log("Check Number of User");
                this.check_number_of_users();
            } else if (msg.startsWith("new server: ")) {
                console.log(`New Server: ${msg.slice(12)}`);
                this.connect_new_server(
                    `${PreUrl}${this.identifier}/${msg.slice(12)}`
                );
            } else {
                const state = JSON.parse(msg);
                this.reader(state);
            }
        }
    }

    async check_number_of_users() {
        if (this.user_id) {
            // console.log(
            //     `Standing server url: ${PreUrl}${this.identifier}/${this.user_id}`
            // );
            const readableStream = new ReadableStream({
                start(controller) {
                    controller.enqueue("check number of user\0");
                    controller.close();
                },
            });
            const property_normal: RequestInit = {
                method: "POST",
                body: readableStream.pipeThrough(new TextEncoderStream()),
                headers: { "Content-Type": "text/plain;charset=UTF-8" },
            };
            const property = {
                ...property_normal,
                allowHTTP1ForStreamingUpload: true,
                duplex: "half",
            };
            await fetch(
                `${PreUrl}${this.identifier}/${this.user_id}`,
                property
            );

            // console.log(response);
            // console.log(`Check Number of User: ${await response.text()}`);
        } else {
            throw new Error("User ID is null");
        }
    }
}

export { Client };

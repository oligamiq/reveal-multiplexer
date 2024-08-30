import { PreUrl } from "./config";

const sleep = (waitTime: number) =>
    new Promise((resolve) => setTimeout(resolve, waitTime));

class Master {
    identifier: string;
    users: string[];
    receive_server?: WritableStreamDefaultWriter<string>;
    receive_server_handle?: Promise<Response>;
    new_user_receive_servers: WritableStreamDefaultWriter<string>[];
    new_user_receive_servers_handle: Promise<Response>[];
    new_users: string[];
    user_id: string;
    update_server_flag = false;

    reveal_now_state?: unknown;

    constructor(identifier: string) {
        this.identifier = identifier;
        this.users = [];
        this.new_user_receive_servers = [];
        this.new_user_receive_servers_handle = [];
        this.new_users = [];
        this.user_id = crypto.randomUUID();

        console.log(`Master ID: ${this.user_id}`);
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    async send_message(message: any) {
        this.reveal_now_state = message;
        console.log("Send message:", message);
        const msg = `${JSON.stringify(message)}\0`;
        const handles: Promise<void>[] = [];
        console.log("users:", this.users);
        console.log("new_users:", this.new_users);
        if (this.receive_server) {
            handles.push(this.receive_server.write(msg));
        }
        for (const server of this.new_user_receive_servers) {
            // console.log("Send message to new user");
            handles.push(server.write(msg));
        }
        await Promise.all(handles);
    }

    async listen_new_user() {
        while (true) {
            const new_user_id = crypto.randomUUID();
            const readableStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new_user_id);
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
            const [writer, handle] = await this.accept_new_user(new_user_id);
            const response = await fetch(
                `${PreUrl}${this.identifier}/listen`,
                property
            );
            const reader = response.body?.getReader();
            if (response.status === 400) {
                console.error("Master is full");
                throw new Error("Master is full");
            }
            if (reader) {
                while (true) {
                    const { done } = await reader.read();
                    if (done) {
                        break;
                    }
                }
            }

            reader?.cancel();

            console.log(`Accept new user ID: ${new_user_id}`);

            if (this.reveal_now_state) {
                writer.write(`${JSON.stringify(this.reveal_now_state)}\0`);
            }
            this.new_users.push(new_user_id);
            this.new_user_receive_servers.push(writer);
            this.new_user_receive_servers_handle.push(handle);

            this.update_server();

            console.log("listen_new_user:", new_user_id);
        }
    }

    async accept_new_user(
        user_id: string
    ): Promise<[WritableStreamDefaultWriter<string>, Promise<Response>]> {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const property_normal: RequestInit = {
            method: "POST",
            body: readable.pipeThrough(new TextEncoderStream()),
            headers: { "Content-Type": "text/plain;charset=UTF-8" },
        };
        const property = {
            ...property_normal,
            allowHTTP1ForStreamingUpload: true,
            duplex: "half",
        };
        console.log(`Can accept new user ID: ${user_id}`);
        const msg = this.reveal_now_state
            ? `${JSON.stringify(this.reveal_now_state)}\0`
            : "accept\0";
        // const write_handle = await writer.write(msg);
        console.log(`wait connect: ${PreUrl}${this.identifier}/${user_id}`);
        await writer.write(msg);
        const handle = fetch(
            `${PreUrl}${this.identifier}/${user_id}`,
            property
        );

        return [writer, handle];
        // console.log(`Accept new user ID: ${user_id}`);
        // // await write_handle;
        // const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader();
        // if (reader) {
        //     console.log(`Accept new user ID: ${user_id}`);
        //     const textDecoder = new TextDecoder();
        //     while (true) {
        //         const { value } = await reader.read();
        //         const value_str = textDecoder.decode(value);
        //         if (value_str.includes("Start sending")) {
        //             break;
        //         }
        //     }
        // } else {
        //     throw new Error("Reader is null");
        // }
        // this.new_user_receive_servers.push(writable);
    }

    async update_server() {
        console.log("Update server1");

        if (this.update_server_flag) {
            return;
        }

        this.update_server_flag = true;

        await sleep(1000);

        setTimeout(async () => {
            if (this.update_server_flag) {
                this.update_server_flag = false;
                await this.update_server();
            }
        }, 10000);

        await this.check_number_of_user();

        console.log("Update server3");

        await this.stand_new_server();
        this.update_server_flag = false;
    }

    async check_number_of_user() {
        if (this.receive_server) {
            await this.receive_server.write("check number of user\0");
            await sleep(2000);
            const new_users: string[] = [];
            const handles: Promise<void>[] = [];
            for (const user of this.users) {
                const handle = (async () => {
                    // console.log(`Check user ID: ${user}`);
                    // console.log(
                    //     `Check user URL: ${PreUrl}${this.identifier}/${user}`
                    // );
                    const response = await fetch(
                        `${PreUrl}${this.identifier}/${user}`,
                        {
                            method: "GET",
                        }
                    );
                    if (response.status === 200) {
                        // console.log(`User ID: ${user} is connected`);
                        new_users.push(user);
                    }
                })();
                handles.push(handle);
            }
            await Promise.all(handles);
            this.users = new_users;
        }
    }

    async stand_new_server() {
        const this_new_users = [...this.new_users];
        // console.log("Stand new users:", this_new_users);
        // console.log("Stand new.users:", this.new_users);
        // console.log("old users:", this.users);
        const number_of_user = this.users.length + this_new_users.length;
        // const new_server_id = crypto.randomUUID();
        const new_server_id = "new";
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const property_normal: RequestInit = {
            method: "POST",
            body: readable.pipeThrough(new TextEncoderStream()),
            headers: { "Content-Type": "text/plain;charset=UTF-8" },
        };
        const property = {
            ...property_normal,
            allowHTTP1ForStreamingUpload: true,
            duplex: "half",
        };
        await writer.write("new server\0");
        const handle = fetch(
            `${PreUrl}${this.identifier}/${new_server_id}?n=${number_of_user}`,
            property
        );
        // console.log(
        //     "Stand new server:",
        //     `${PreUrl}${this.identifier}/${new_server_id}?n=${number_of_user}`
        // );

        let is_end = false;

        // const self_response_handle = fetch(
        //     `${PreUrl}${this.identifier}/${new_server_id}?n=${number_of_user}`,
        //     {
        //         method: "GET",
        //         headers: { "Content-Type": "text/plain;charset=UTF-8" },
        //     }
        // );

        console.log(
            `Stand new server: ${PreUrl}${this.identifier}/${new_server_id}?n=${number_of_user}`
        );

        const writer_handle = [];
        if (this.receive_server) {
            writer_handle.push(
                this.receive_server?.write(
                    `new server: ${new_server_id}?n=${number_of_user}\0`
                )
            );
        }

        let i = 0;
        for (const _user of this_new_users) {
            writer_handle.push(
                this.new_user_receive_servers[i].write(
                    `new server: ${new_server_id}?n=${number_of_user}\0`
                )
            );
            i++;
        }
        const result = await Promise.all(writer_handle);
        console.log("Stand new server result:", result);

        setTimeout(async () => {
            if (!is_end) {
                console.warn("some users not connected");
                while (!is_end) {
                    try {
                        const response = await fetch(
                            `${PreUrl}${this.identifier}/${new_server_id}?n=${number_of_user}`,
                            {
                                method: "GET",
                            }
                        );
                        if (response.status === 400) {
                            is_end = true;
                        }
                        response.body?.cancel();
                    } catch (e) {
                        console.warn(e);
                    }
                }
            }
        }, 10000);

        // await writer.write("end\0");

        console.log("Stand new server end");

        is_end = true;

        // if (self_response.status === 200) {
        //     is_end = true;
        // }
        // if (self_response.status === 400) {
        //     throw new Error("Identifier is invalid");
        // }
        // self_response.body?.cancel();

        this.receive_server?.close();
        this.receive_server = writer;
        this.receive_server_handle = handle;
        // console.log("users:", this.users);
        // console.log("Stand new users:", this_new_users);
        // console.log("Stand new.users:", this.new_users);
        this.users = this.users.concat(this_new_users);
        for (const _user of this_new_users) {
            const user = this.new_users.shift();
            // console.log("Stand new _user:", _user);
            // console.log("Stand new user:", user);
            if (user !== _user) {
                throw new Error("User ID is invalid");
            }
            const server = this.new_user_receive_servers.shift();
            server?.close();
        }

        console.log(
            "stand_new_server end:",
            `${PreUrl}${this.identifier}/${new_server_id}?n=${this.users.length}\0`
        );
    }
}

export { Master };

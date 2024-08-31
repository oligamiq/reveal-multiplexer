// bunx tsc && node test.js

import { Master } from "./master";
import { Client } from "./client";

(async () => {
    const identity = "068b6893-6ff1-4bcc-81aa-2d1b6a8b6c10";

    // Masterがいないため、失敗する
    const failed_client = new Client(identity, (message) => {
        console.log(message);
    });
    try {
        failed_client.connect().catch((e) => {
            console.log(e);
        });
    } catch (e) {
        console.log(e);
    }

    const master = new Master(identity);

    master.listen_new_user();

    const client = new Client(identity, (message) => {
        console.log(message);
    });

    const c = client.connect();

    master.send_message({
        type: "message",
        content: "Hello, World!",
    });

    await c;

    master.send_message({
        type: "message",
        content: "Hello, World!!",
    });

    const sleep = (waitTime: number) =>
        new Promise((resolve) => setTimeout(resolve, waitTime));

    let n = 0;
    while (true) {
        await sleep(1000);

        const new_client = new Client(identity, (message) => {
            // console.log(message);
        });

        new_client.connect();

        master.send_message({
            type: "message",
            content: `Hello, World!!! ${n}`,
        });

        n += 1;
    }
})();

// ! BodyTimeoutError

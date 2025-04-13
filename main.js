const { Client } = require("openiap");
const fs = require("fs");

const client = new Client();
client.enable_tracing("openiap=info", "");

// Default workitem queue
const defaultwiq = "default_queue";

function cleanupFiles(originalFiles) {
    const currentFiles = fs.readdirSync(__dirname).filter(file => fs.lstatSync(file).isFile());
    const filesToDelete = currentFiles.filter(file => !originalFiles.includes(file));
    filesToDelete.forEach(file => fs.unlinkSync(file));
}

async function ProcessWorkitem(workitem) {
    client.info(`Processing workitem id ${workitem.id}, retry #${workitem.retries}`);
    if (!workitem.payload) workitem.payload = {};
    workitem.payload.name = "Hello kitty";
    workitem.name = "Hello kitty";
}

async function ProcessWorkitemWrapper(workitem) {
    try {
        ProcessWorkitem(workitem);
        workitem.state = "successful";
    } catch (error) {
        workitem.state = "retry";
        workitem.errortype = "application"; // Retryable error
        workitem.errormessage = error.message || error;
        workitem.errorsource = error.stack || "Unknown source";
        client.error(error.message || error);
    }
    client.update_workitem({ workitem });
}

async function onConnected() {
    try {
        let wiq = process.env.wiq || defaultwiq;
        let queue = process.env.queue || wiq;
        const originalFiles = fs.readdirSync(__dirname).filter(file => fs.lstatSync(file).isFile());
        const queuename = client.register_queue({ queuename: queue }, async () => {
            try {
                let workitem;
                let counter = 0;
                do {
                    workitem = await client.pop_workitem({ wiq });
                    if (workitem) {
                        counter++;
                        await ProcessWorkitemWrapper(workitem);
                        cleanupFiles(originalFiles);
                    }
                } while (workitem);

                if (counter > 0) {
                    client.info(`No more workitems in ${wiq} workitem queue`);
                }
            } catch (error) {
                client.error(error.message || error);
            } finally {
                cleanupFiles(originalFiles);
            }
        });
        client.info(`Consuming queue: ${queuename}`);
    } catch (error) {
        client.error(error.message || error);
    }
}

async function main() {
    try {
        await client.connect();
        client.on_client_event(event => {
            if (event && event.event === "SignedIn") {
                onConnected().catch(client.error);
            }
        });
    } catch (error) {
        client.error(error.message || error);
    }
}

main();
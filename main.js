const { Client } = require("openiap");
const fs = require("fs");

const client = new Client();
client.enable_tracing("openiap=info", "");

// Default workitem queue
const defaultwiq = "default_queue";

function cleanupFiles(originalFiles) {
    try {
        const currentFiles = fs.readdirSync(__dirname).filter(file => {
            try {
                return fs.existsSync(file) && fs.lstatSync(file).isFile();
            } catch (error) {
                client.error(`Error checking file ${file}: ${error.message}`);
                return false;
            }
        });
        const filesToDelete = currentFiles.filter(file => !originalFiles.includes(file));
        filesToDelete.forEach(file => {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    client.info(`Cleaned up file: ${file}`);
                }
            } catch (error) {
                client.error(`Error deleting file ${file}: ${error.message}`);
            }
        });
    } catch (error) {
        client.error(`Error in cleanupFiles: ${error.message}`);
    }
}

async function ProcessWorkitem(workitem) {
    client.info(`Processing workitem id ${workitem.id}, retry #${workitem.retries}`);
    if (!workitem.payload) workitem.payload = {};
    workitem.payload.name = "Hello kitty";
    workitem.name = "Hello kitty";
    fs.writeFileSync("hello.txt", "Hello kitty");
}

async function ProcessWorkitemWrapper(originalFiles, workitem) {
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
    const currentFiles = fs.readdirSync(__dirname).filter(file => {
        try {
            return fs.existsSync(file) && fs.lstatSync(file).isFile();
        } catch (error) {
            client.error(`Error checking current file ${file}: ${error.message}`);
            return false;
        }
    });
    const filesAdd = currentFiles.filter(file => !originalFiles.includes(file));
    if (filesAdd.length > 0) {
        client.update_workitem({ workitem, files: filesAdd });
    } else {
        client.update_workitem({ workitem });
    }
}

async function onConnected() {
    try {
        let wiq = process.env.wiq || defaultwiq;
        let queue = process.env.queue || wiq;
        client.info(`Using workitem queue: ${wiq}`);
        client.info(`Using queue name: ${queue}`);
        const originalFiles = fs.readdirSync(__dirname).filter(file => {
            try {
                return fs.existsSync(file) && fs.lstatSync(file).isFile();
            } catch (error) {
                client.error(`Error checking original file ${file}: ${error.message}`);
                return false;
            }
        });
        const queuename = client.register_queue({ queuename: queue }, async () => {
            try {
                let workitem;
                let counter = 0;
                do {
                    workitem = await client.pop_workitem({ wiq });
                    if (workitem) {
                        counter++;
                        await ProcessWorkitemWrapper(originalFiles, workitem);
                        cleanupFiles(originalFiles);
                    }
                } while (workitem);

                if (counter > 0) {
                    client.info(`No more workitems in ${wiq} workitem queue`);
                }
            } catch (error) {
                client.error(error.message || error);
                process.exit(1);
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
            } else {
                client.info(`Client event: ${JSON.stringify(event)}`);
            }
        });

    } catch (error) {
        client.error(error.message || error);
    }
}

main();
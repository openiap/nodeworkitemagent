const { Client } = require('openiap');
const client = new Client();
const fs = require('fs');
// If testing this toward app.openiap.io you MUST update this to your own workitem queue
const defaultwiq = "nodeagent"
function ProcessWorkitem(workitem) {
    console.log(`Processing workitem id ${workitem._id} retry #${workitem.retries}`);
    if(workitem.payload == null) workitem.payload = {};
    workitem.payload.name = "Hello kitty"
    workitem.name = "Hello kitty"
}
function ProcessWorkitemWrapper(workitem) {
    var original = [];
    var files = fs.readdirSync(__dirname);
    files.forEach(file => {
        if (fs.lstatSync(file).isFile()) original.push(file);
    });
    try {
        var filename = "";
        var preserve = [];
        var files = fs.readdirSync(__dirname);
        files.forEach(file => {
            if (fs.lstatSync(file).isFile()) preserve.push(file);
        });

        ProcessWorkitem(workitem, filename);
        workitem.state = "successful"
    } catch (error) {
        workitem.state = "retry"
        workitem.errortype = "application" // business rule will never retry / application will retry as mamy times as defined on the workitem queue"
        workitem.errormessage = error.message ? error.message : error
        workitem.errorsource = error.stack.toString()
    }
    let current_files = fs.readdirSync(__dirname);
    files = [];
    current_files.forEach(file => {
        if (fs.lstatSync(file).isFile()) files.push(file);
    });

    files = files.filter(x => preserve.indexOf(x) == -1);
    client.update_workitem({ workitem, files })
    files = fs.readdirSync(__dirname);
    files = files.filter(x => original.indexOf(x) == -1);
    files.forEach(file => {
        if (fs.lstatSync(file).isFile()) {
            fs.unlinkSync(file);
        }
    });
}
async function onConnected() {
    try {
        var queue = process.env.queue;
        var wiq = process.env.wiq;
        if(wiq == null || wiq == "") wiq = defaultwiq;
        if(queue == null || queue == "") queue = wiq;
        const queuename = client.register_queue({queuename: queue}, (event)=> {
            try {
                let workitem = null;
                let counter = 0;
                do {
                    workitem = client.pop_workitem({  wiq: wiq });
                    if(workitem != null) {
                        counter++;
                        ProcessWorkitemWrapper(workitem);
                    }    
                } while(workitem != null)
                if(counter > 0) {
                    console.log(`No more workitems in ${wiq} workitem queue`)
                }
            } catch (error) {
                console.error(error)                
            }
        })
        console.log("Consuming queue " + queuename);
    } catch (error) {
        console.error(error)
        // process.exit(1)
    }
}
async function main() {
    var wiq = process.env.wiq;
    var queue = process.env.queue;
    if(wiq == null || wiq == "") wiq = defaultwiq;
    if(queue == null || queue == "") queue = wiq;
    await client.connect();
    client.on_client_event((event) => {
        if(event && event.event == "SignedIn") {
            onConnected().catch((error) => {
                console.error(error)
            });
        }
    });
    
}
main()
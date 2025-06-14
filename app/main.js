import readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const repl = () => {
    rl.question("$ ", (answer) => {
        if (answer == "exit 0") {
            rl.close();
            process.exit(0);
        }
        console.log(`${answer}: command not found`);

        repl();
    });
};

repl();
